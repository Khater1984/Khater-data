#!/usr/bin/env python3
"""Safe NAV ingest entrypoint.

Phase 2 adds three contracts on top of the Phase 1 promotion boundary:
- source-published future dates are accepted only inside a bounded 7-day window;
- Snduk is used as a third-party fallback when the manager source has no usable
  current NAV/date;
- provenance remains explicit through source_id/source_url (manager vs Snduk).

No date is ever fabricated by this wrapper.
"""
from __future__ import annotations

import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import ingest_nav as legacy

TODAY = date.today()
FUTURE_MAX_DAYS = 7
SNDuk_PRICES_URL = "https://snduk.com/eg/page/mutual-funds-prices-today?lang=en"


def _normalize_digits(value: str) -> str:
    trans = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
    return str(value or "").translate(trans)


def _parse_source_date(value):
    value = _normalize_digits(value).replace(",", " ").strip()
    for fmt in (
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
        "%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y",
    ):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return legacy.parse_date(value)


def _future_policy(asof: str, source_id: str):
    """Return (accepted, classification) for a source-published future date."""
    if not asof:
        return False, "no_date"
    try:
        d = date.fromisoformat(asof)
    except ValueError:
        return False, "invalid_date"
    delta = (d - TODAY).days
    if delta <= 0:
        return True, "current_or_past"
    if delta <= FUTURE_MAX_DAYS:
        return True, "source_published_bounded_future"
    return False, "future_outside_window"


def safe_row(extracted, nav, asof, url, sid, fund, score, extra=None, currency=None):
    """Build a staging row without ever fabricating an as-of date."""
    raw = dict(extra or {}) if isinstance(extra, dict) else {"raw": extra}
    accepted, future_status = _future_policy(asof, sid)
    raw.setdefault("phase2_date_policy", future_status)
    if asof and not accepted:
        raw["date_rejected_reason"] = future_status

    if currency is None:
        currency = (fund or {}).get("currency") or "EGP"
        raw.setdefault("currency_provenance", "fund_registry")
    else:
        raw.setdefault("currency_provenance", "source_published")

    return {
        "run_id": legacy.RUN_ID,
        "extracted_name": extracted,
        "nav": float(nav),
        "currency": currency,
        "as_of_date": asof or None,
        "source_url": url,
        "source_id": sid,
        "fund_id": None if not fund else fund["fund_id"],
        "canonical_name": None if not fund else fund["canonical_name"],
        "match_status": "matched" if fund else "unmatched",
        "match_score": round(score or 0, 3),
        "verification_status": "pending",
        "raw": raw,
    }


def _existing_official():
    return {
        x["fund_id"]: x
        for x in legacy.sb_get(
            "nav_official",
            select="fund_id,nav,currency,as_of_date,source_id",
            limit="1000",
        )
    }


OUTLIER_MAX_ABS_MOVE = 0.50


def _quarantine_review(row, message):
    """Mark a staging candidate for manual review without promoting it."""
    staging_id = row.get("id")
    if not staging_id:
        print(f"quarantine review (no staging id): {row.get('fund_id')} {message}")
        return

    try:
        response = legacy.requests.patch(
            f"{legacy.BASE}/rest/v1/nav_staging?id=eq.{staging_id}",
            headers={**legacy.H, "Prefer": "return=minimal"},
            json={
                "verification_status": "needs_review",
                "notes": message,
            },
            timeout=20,
        )
        print(
            f"quarantine review: staging_id={staging_id} "
            f"status={response.status_code} {message}"
        )
    except Exception as exc:
        print(
            f"quarantine review ERROR staging_id={staging_id} "
            f"{type(exc).__name__}: {exc}"
        )


def _quarantine_outlier(row, current, move_pct):
    """Keep a large unexplained NAV move in staging for manual/source review."""
    staging_id = row.get("id")
    message = (
        f"Automatic promotion blocked: NAV moved {move_pct:.2%} "
        f"from {current.get('nav')} to {row.get('nav')}."
    )
    if not staging_id:
        print(f"outlier quarantine (no staging id): {row.get('fund_id')} {message}")
        return

    try:
        response = legacy.requests.patch(
            f"{legacy.BASE}/rest/v1/nav_staging?id=eq.{staging_id}",
            headers={**legacy.H, "Prefer": "return=minimal"},
            json={
                "verification_status": "needs_review",
                "notes": message,
            },
            timeout=20,
        )
        print(
            f"outlier quarantine: staging_id={staging_id} "
            f"status={response.status_code} {message}"
        )
    except Exception as exc:
        print(
            f"outlier quarantine ERROR staging_id={staging_id} "
            f"{type(exc).__name__}: {exc}"
        )


def _normalize_manager(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _fund_registry():
    return {
        x["fund_id"]: {
            "currency": _normalize_currency(x.get("currency")),
            "management_company": x.get("management_company"),
            "price_update_url": x.get("price_update_url") or "",
        }
        for x in legacy.sb_get(
            "funds",
            select="fund_id,currency,management_company,price_update_url",
            limit="1000",
        )
    }


def _source_registry():
    return {
        x["source_id"]: {
            "management_company_scope": x.get("management_company_scope"),
            "source_url": x.get("source_url") or "",
            "source_kind": x.get("source_kind") or "",
        }
        for x in legacy.sb_get(
            "sources",
            select="source_id,management_company_scope,source_url,source_kind",
            limit="1000",
        )
    }


def _host(value):
    if not value or "://" not in str(value):
        return ""
    return str(value).split("/")[2].lower().replace("www.", "")


def _source_allowed_for_fund(row, fund_meta, source_meta):
    source_id = row.get("source_id") or ""
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    if source_id == "src_snduk":
        return (
            raw.get("identity_match") == "explicit_alias"
            or (
                _host(row.get("source_url")) == "snduk.com"
                and _host(fund_meta.get("price_update_url")) == "snduk.com"
            )
        )
    if source_id == "src_eima_weekly_tw":
        return raw.get("identity_match") == "exact_fund_id"
    if source_id == "src_eima_performance_integrated":
        return raw.get("identity_match") == "exact_fund_id"

    scope = source_meta.get("management_company_scope")
    if scope:
        return _normalize_manager(fund_meta.get("management_company")) == _normalize_manager(scope)

    if source_meta.get("source_kind") == "management_company_page":
        return bool(
            _host(source_meta.get("source_url"))
            and _host(source_meta.get("source_url")) == _host(fund_meta.get("price_update_url"))
        )

    return False


def _is_usable_current_candidate(row):
    asof = row.get("as_of_date")
    if not asof:
        return False
    accepted, _ = _future_policy(asof, row.get("source_id") or "")
    return accepted


def safe_upsert_official(matched_rows):
    """Promote only dated candidates and never move official history backwards."""
    now = datetime.now(timezone.utc).isoformat()
    existing = _existing_official()
    registry = _fund_registry()
    source_registry = _source_registry()
    best = {}
    skipped_no_date = 0
    skipped_future = 0
    skipped_currency = 0
    skipped_manager = 0

    for row in matched_rows:
        fid = row.get("fund_id")
        if not fid:
            continue
        asof = row.get("as_of_date")
        if not asof:
            skipped_no_date += 1
            continue
        accepted, _ = _future_policy(asof, row.get("source_id") or "")
        if not accepted:
            skipped_future += 1
            continue

        fund_meta = registry.get(fid) or {}
        expected_currency = fund_meta.get("currency")
        incoming_currency = _normalize_currency(row.get("currency"))
        if not expected_currency or not incoming_currency or expected_currency != incoming_currency:
            skipped_currency += 1
            _quarantine_review(
                row,
                f"Automatic promotion blocked: currency mismatch "
                f"(expected={expected_currency}, incoming={incoming_currency}).",
            )
            continue

        source_id = row.get("source_id")
        source_meta = source_registry.get(source_id) or {}
        if not _source_allowed_for_fund(row, fund_meta, source_meta):
            skipped_manager += 1
            if source_meta.get("management_company_scope"):
                message = (
                    "Automatic promotion blocked: source-manager mismatch "
                    f"(source={source_id}, expected={source_meta['management_company_scope']}, "
                    f"actual={fund_meta.get('management_company')})."
                )
            else:
                message = (
                    "Automatic promotion blocked: source identity not authorized "
                    f"for fund (source={source_id}, fund={fid})."
                )
            _quarantine_review(row, message)
            continue

        previous = best.get(fid)
        if not previous or asof >= (previous.get("as_of_date") or ""):
            best[fid] = row

    payload = []
    skipped_older = 0
    skipped_outliers = 0
    for row in best.values():
        fid = row["fund_id"]
        incoming_date = row["as_of_date"]
        current_date = (existing.get(fid) or {}).get("as_of_date")
        if current_date and current_date > incoming_date:
            skipped_older += 1
            continue

        current = existing.get(fid) or {}
        current_nav = current.get("nav")
        incoming_nav = row.get("nav")
        if current_nav not in (None, 0) and incoming_nav not in (None, 0):
            move_pct = abs(float(incoming_nav) / float(current_nav) - 1.0)
            if move_pct >= OUTLIER_MAX_ABS_MOVE:
                skipped_outliers += 1
                _quarantine_outlier(row, current, move_pct)
                continue

        payload.append({
            "fund_id": fid,
            "nav": row["nav"],
            "currency": row.get("currency") or "EGP",
            "as_of_date": incoming_date,
            "source_id": row.get("source_id"),
            "source_url": row.get("source_url"),
            "staging_id": row.get("id"),
            "verified_at": now,
        })

    ok = 0
    failed = 0
    for i in range(0, len(payload), 40):
        batch = payload[i:i + 40]
        response = legacy.sb_post(
            "nav_official", batch,
            prefer="resolution=merge-duplicates,return=minimal",
        )
        if response.status_code in (200, 201):
            ok += len(batch)
            continue

        print("official batch fail", response.status_code, response.text[:300])
        for item in batch:
            patch = legacy.requests.patch(
                f"{legacy.BASE}/rest/v1/nav_official?fund_id=eq.{item['fund_id']}",
                headers={**legacy.H, "Prefer": "return=minimal"},
                json=item,
                timeout=20,
            )
            if patch.status_code in (200, 204):
                ok += 1
            else:
                failed += 1
                print("official item fail", patch.status_code, patch.text[:300])

    print(
        "official promotion: "
        f"upserted={ok} candidates={len(payload)} "
        f"skipped_no_date={skipped_no_date} skipped_future={skipped_future} "
        f"skipped_currency={skipped_currency} skipped_manager={skipped_manager} "
        f"skipped_older={skipped_older} skipped_outliers={skipped_outliers} failed={failed}"
    )
    return ok, len(payload)


def _normalize_currency(code):
    """Map common labels to ISO-like codes used on fund records."""
    c = str(code or "").strip().upper()
    if not c:
        return None
    compact = c.replace(" ", "")
    if compact in {"EGP", "LE", "L.E", "L.E."} or "EGP" in compact:
        return "EGP"
    if compact in {"USD", "US$", "USDOLLAR"} or compact == "$" or "USD" in compact:
        return "USD"
    if compact in {"EUR", "EURO"} or "EURO" in compact or "EUR" in compact:
        return "EUR"
    return compact


def _snduk_row_currency(name, cells, price_text):
    """Infer published currency from Snduk row text only — never invent."""
    blob = " ".join([str(name or "")] + [str(c) for c in (cells or [])] + [str(price_text or "")]).upper()
    if "EUR" in blob or "EURO" in blob or "€" in blob:
        return "EUR"
    if "USD" in blob or "US$" in blob or re.search(r"(^|\s)\$(?=\s*\d)", blob):
        return "USD"
    if "EGP" in blob or "L.E" in blob:
        return "EGP"
    return None


def _currencies_compatible(fund_currency, row_currency):
    """Fallback requires both sides known and equal."""
    fc = _normalize_currency(fund_currency)
    rc = _normalize_currency(row_currency)
    if not fc or not rc:
        return False
    return fc == rc


def _explicit_snduk_alias(name, funds, aliases=None):
    """Resolve only identities registered as verified provider aliases.

    No fuzzy matching is allowed in the fallback path. A fallback identity must
    be represented in fund_name_aliases with the exact published provider label.
    """
    normalized = re.sub(r"[^a-z0-9]+", " ", str(name or "").lower()).strip()
    by_id = {f.get("fund_id"): f for f in funds}
    for alias in aliases or []:
        if alias.get("alias_name") is None or alias.get("fund_id") not in by_id:
            continue
        if not str(alias.get("alias_source") or "").startswith("snduk:verified_identity:"):
            continue
        alias_norm = alias.get("normalized_alias")
        if alias_norm is None:
            alias_norm = re.sub(r"\s+", " ", str(alias.get("alias_name") or "").lower()).strip()
        alias_norm = re.sub(r"[^a-z0-9]+", " ", alias_norm).strip()
        if alias_norm == normalized and float(alias.get("match_confidence") or 0) >= 1.0:
            return by_id[alias["fund_id"]], 1.0
    return None, 0.0


def _snduk_fallback_rows(funds, match=None, aliases=None):
    """Read Snduk consolidated prices and return ONLY explicit-alias fallback rows.

    Identity: explicit verified aliases only (no generic fuzzy match).
    Currency: row currency must match fund.currency before acceptance.
    Provenance: source_id=src_snduk with date_provenance=snduk.
    The unused `match` argument is retained for call-site compatibility.
    """
    import requests

    try:
        response = requests.get(SNDuk_PRICES_URL, headers=legacy.UA, timeout=45)
        response.raise_for_status()
    except Exception as exc:
        print(f"snduk fallback ERROR {type(exc).__name__}: {exc}")
        return []

    soup = BeautifulSoup(response.text, "lxml")
    out = []
    seen = set()
    skipped_no_alias = 0
    skipped_currency = 0
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
            if len(cells) < 4:
                continue
            name = re.sub(r"^\s*\d+", "", cells[0]).strip()
            asof = _parse_source_date(cells[2])
            price_text = _normalize_digits(cells[-1]).replace(",", "")
            nav = legacy.parse_num(price_text)
            if not name or nav is None or not asof:
                continue
            # Explicit identity only — never fall back to generic fuzzy match.
            fund, score = _explicit_snduk_alias(name, funds, aliases)
            if not fund:
                skipped_no_alias += 1
                continue
            row_ccy = _snduk_row_currency(name, cells, price_text)
            fund_ccy = fund.get("currency") or "EGP"
            if not _currencies_compatible(fund_ccy, row_ccy):
                skipped_currency += 1
                continue
            key = (fund["fund_id"], asof)
            if key in seen:
                continue
            seen.add(key)
            out.append(safe_row(
                name, nav, asof, SNDuk_PRICES_URL, "src_snduk", fund, score,
                {
                    "fallback": True,
                    "fallback_reason": "manager_nav_missing_or_stale",
                    "provenance": "third_party_snduk",
                    "date_provenance": "snduk",
                    "frequency_provenance": "snduk_published_frequency",
                    "identity_match": "explicit_alias",
                    "source_page": SNDuk_PRICES_URL,
                    "table_cells": cells,
                    "row_currency": row_ccy,
                },
                currency=_normalize_currency(fund_ccy) or "EGP",
            ))
    print(
        f"snduk fallback: {len(out)} matched rows "
        f"(skipped_no_alias={skipped_no_alias} skipped_currency={skipped_currency})"
    )
    return out


def _latest_eima_fallback_rows(funds):
    """Use the latest exact EIMA weekly NAV as an approved fallback."""
    reports = legacy.sb_get(
        "eima_reports",
        select="report_date",
        order="report_date.desc",
        limit="1",
    )
    if not reports:
        return []
    report_date = reports[0].get("report_date")
    if not report_date:
        return []
    rows = legacy.sb_get(
        "fund_performance_history",
        select="fund_id,report_date,nav_value,currency,source_id,raw",
        report_date=f"eq.{report_date}",
        horizon="eq.weekly",
        source_id="eq.src_eima_weekly_tw",
        nav_value="not.is.null",
        limit="1000",
    )
    by_id = {f.get("fund_id"): f for f in funds}
    out = []
    for row in rows:
        fund = by_id.get(row.get("fund_id"))
        if not fund or row.get("nav_value") is None:
            continue
        raw_source = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        row_currency = _normalize_currency(row.get("currency"))
        fund_currency = _normalize_currency(fund.get("currency"))
        if not row_currency or row_currency != fund_currency:
            continue
        out.append(safe_row(
            raw_source.get("pdf_name") or fund.get("canonical_name"),
            row["nav_value"], report_date,
            raw_source.get("source_url") or "https://eima.org.eg/?page_id=1886",
            "src_eima_weekly_tw", fund, 1.0,
            {
                "fallback": True,
                "fallback_reason": "manager_nav_unavailable_or_unusable",
                "provenance": "eima_weekly_official_industry_report",
                "date_provenance": "eima_report",
                "frequency_provenance": "weekly",
                "identity_match": "exact_fund_id",
                "source_report_date": report_date,
            },
            currency=fund_currency,
        ))
    print(f"eima fallback: {len(out)} exact weekly rows report={report_date}")
    return out

def _select_fallbacks(all_rows, snduk_rows, eima_rows=None):
    """Prefer Snduk, then exact EIMA weekly fallback, only when manager is unusable."""
    current = {}
    for row in all_rows:
        fid = row.get("fund_id")
        if not fid or row.get("source_id") in {"src_snduk", "src_eima_weekly_tw"}:
            continue
        if _is_usable_current_candidate(row):
            current.setdefault(fid, []).append(row)

    selected = []
    used = set()
    for row in snduk_rows:
        fid = row.get("fund_id")
        if fid and not current.get(fid):
            selected.append(row)
            used.add(fid)
    for row in eima_rows or []:
        fid = row.get("fund_id")
        if fid and fid not in used and not current.get(fid):
            selected.append(row)
            used.add(fid)
    return selected


def _normalize_source_ids(rows):
    """Align parser aliases with the canonical sources registry."""
    for row in rows:
        if row.get("source_id") == "src_zaldi":
            row["source_id"] = "src_zaldi_capital"
            raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
            raw["source_id_normalized_from"] = "src_zaldi"
            row["raw"] = raw
    return rows



def _record_run_start(sources_count, target_fund_count):
    """Best-effort run observability; never mask NAV ingestion failures."""
    payload = [{
        "run_id": legacy.RUN_ID,
        "status": "running",
        "sources_attempted": sources_count,
        "rows_extracted": 0,
        "rows_matched": 0,
        "meta": {
            "target_fund_count": target_fund_count,
            "pipeline": "safe_nav",
            "contract": "nav_currency_source_as_of_date",
        },
    }]
    try:
        response = legacy.sb_post(
            "ingest_runs",
            payload,
            prefer="resolution=merge-duplicates,return=minimal",
        )
        print(f"ingest_run start: {response.status_code}")
    except Exception as exc:
        print(f"ingest_run start ERROR {type(exc).__name__}: {exc}")


def _record_run_finish(status, sources_attempted, rows_extracted, rows_matched, fallback_selected, fallback_sources, fallback_scan_attempted, source_errors, attempted_sources, target_fund_count, run_error=None):
    """Persist run outcome and metrics without making observability a hard dependency."""
    payload = {
        "status": status,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "sources_attempted": sources_attempted,
        "rows_extracted": rows_extracted,
        "rows_matched": rows_matched,
        "notes": run_error,
        "meta": {
            "pipeline": "safe_nav",
            "contract": "nav_currency_source_as_of_date",
            "fallback_selected": fallback_selected,
            "fallback_sources": fallback_sources,
            "fallback_scan_attempted": fallback_scan_attempted,
            "attempted_sources": attempted_sources,
            "target_fund_count": target_fund_count,
            "source_errors": source_errors,
        },
    }
    try:
        response = legacy.requests.patch(
            f"{legacy.BASE}/rest/v1/ingest_runs?run_id=eq.{legacy.RUN_ID}",
            headers={**legacy.H, "Prefer": "return=minimal"},
            json=payload,
            timeout=30,
        )
        print(f"ingest_run finish: {response.status_code} status={status}")
    except Exception as exc:
        print(f"ingest_run finish ERROR {type(exc).__name__}: {exc}")

def main():
    legacy.row = safe_row
    legacy.upsert_official = safe_upsert_official

    if not legacy.BASE or not legacy.KEY:
        sys.exit("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")

    funds = legacy.sb_get(
        "funds",
        select="fund_id,canonical_name,management_company,price_update_url,metadata,currency",
        limit="1000",
    )
    aliases = legacy.sb_get(
        "fund_name_aliases",
        select="fund_id,alias_name,alias_source,normalized_alias,match_confidence",
        limit="5000",
    )
    legacy.set_provider_alias_registry(aliases, funds)
    by_name = {f["canonical_name"]: f for f in funds}
    scrapers = [
        ("hermes", lambda: legacy.scrape_hermes(by_name)),
        ("ci", lambda: legacy.scrape_ci(by_name)),
        ("prime", lambda: legacy.scrape_prime(by_name)),
        ("aaim", lambda: legacy.scrape_aaim(by_name, None)),
        ("beltone", lambda: legacy.scrape_beltone_en(by_name, None)),
        ("azimut", lambda: legacy.scrape_azimut(by_name)),
        ("ni", lambda: legacy.scrape_ni(by_name)),
        ("hc", lambda: legacy.scrape_hc(by_name)),
        ("pfi", lambda: legacy.scrape_pfi(by_name)),
        ("granite", lambda: legacy.scrape_granite(by_name)),
        ("alpha_odin", lambda: legacy.scrape_alpha_odin(by_name)),
        ("snduk", lambda: legacy.scrape_snduk(funds)),
        ("abk", lambda: legacy.scrape_abk(funds)),
        ("zaldi", lambda: legacy.scrape_zaldi(funds)),
        ("afim", lambda: legacy.scrape_afim(by_name)),
    ]

    _record_run_start(len(scrapers), len(funds))

    all_rows = []
    source_errors = []
    run_error = None
    fallback_selected = 0
    fallback_sources = {}
    staging_error = False
    promotion_partial = False
    fallback_scan_attempted = False
    attempted_sources = []
    try:
        for name, scraper in scrapers:
            attempted_sources.append(name)
            try:
                rows = _normalize_source_ids(scraper())
                matched_count = sum(1 for row in rows if row.get("fund_id"))
                print(f"{name}: {len(rows)} extracted, {matched_count} matched")
                all_rows.extend(rows)
            except Exception as exc:
                source_errors.append({
                    "source": name,
                    "error": f"{type(exc).__name__}: {exc}",
                })
                print(f"{name} ERROR {type(exc).__name__}: {exc}")

        snduk_fallback = _snduk_fallback_rows(funds, None, aliases)
        eima_fallback = _latest_eima_fallback_rows(funds)
        fallback_scan_attempted = True
        selected = _select_fallbacks(all_rows, snduk_fallback, eima_fallback)
        fallback_selected = len({row.get("fund_id") for row in selected if row.get("fund_id")})
        fallback_sources = {
            "snduk": sum(1 for row in selected if row.get("source_id") == "src_snduk"),
            "eima_weekly": sum(1 for row in selected if row.get("source_id") == "src_eima_weekly_tw"),
        }
        if selected:
            print(f"snduk fallback selected: {fallback_selected} funds")
            all_rows.extend(selected)

        if all_rows:
            response = legacy.sb_post(
                "nav_staging",
                all_rows,
                prefer="return=representation",
            )
            if response.status_code in (200, 201):
                try:
                    staged_rows = response.json()
                    for row, staged in zip(all_rows, staged_rows):
                        row["id"] = staged.get("id")
                except Exception as exc:
                    staging_error = True
                    print(f"staging lineage response parse ERROR {type(exc).__name__}: {exc}")
            else:
                staging_error = True
            print(
                "staging", response.status_code, len(all_rows),
                response.text[:200] if response.status_code not in (200, 201) else "OK",
            )

        matched = [row for row in all_rows if row.get("fund_id")]
        ok, n = safe_upsert_official(matched)
        promotion_partial = ok < n
        print(f"official upserted {ok}/{n} run={legacy.RUN_ID}")
        legacy.audit_coverage(funds, matched)
    except Exception as exc:
        run_error = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        status = "failed" if run_error else (
            "partial" if source_errors or staging_error or promotion_partial else "success"
        )
        _record_run_finish(
            status=status,
            sources_attempted=len(scrapers),
            rows_extracted=len(all_rows),
            rows_matched=sum(1 for row in all_rows if row.get("fund_id")),
            fallback_selected=fallback_selected,
            fallback_sources=fallback_sources,
            fallback_scan_attempted=fallback_scan_attempted,
            source_errors=source_errors,
            attempted_sources=attempted_sources,
            target_fund_count=len(funds),
            run_error=run_error,
        )


if __name__ == "__main__":
    main()
