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


def safe_row(extracted, nav, asof, url, sid, fund, score, extra=None, currency="EGP"):
    """Build a staging row without ever fabricating an as-of date."""
    raw = dict(extra or {}) if isinstance(extra, dict) else {"raw": extra}
    accepted, future_status = _future_policy(asof, sid)
    raw.setdefault("phase2_date_policy", future_status)
    if asof and not accepted:
        raw["date_rejected_reason"] = future_status
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
            select="fund_id,as_of_date,source_id",
            limit="1000",
        )
    }


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
    best = {}
    skipped_no_date = 0
    skipped_future = 0

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
        previous = best.get(fid)
        if not previous or asof >= (previous.get("as_of_date") or ""):
            best[fid] = row

    payload = []
    skipped_older = 0
    for row in best.values():
        fid = row["fund_id"]
        incoming_date = row["as_of_date"]
        current_date = (existing.get(fid) or {}).get("as_of_date")
        if current_date and current_date > incoming_date:
            skipped_older += 1
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
        f"skipped_older={skipped_older} failed={failed}"
    )
    return ok, len(payload)


def _explicit_snduk_alias(name, funds):
    """Resolve only identity matches that are verified outside fuzzy name matching."""
    normalized = re.sub(r"[^a-z0-9]+", " ", str(name or "").lower()).strip()
    for fund in funds:
        if fund.get("fund_id") == "misr_money_market_euro__ci_asset_management":
            if "banque misr mutual fund in euro" in normalized:
                return fund, 1.0
    return None, 0.0


def _snduk_fallback_rows(funds, match):
    """Read Snduk's consolidated price table and return matched third-party rows."""
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
            fund, score = _explicit_snduk_alias(name, funds)
            if not fund:
                fund, score = match(name)
            if not fund or score < 0.84:
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
                    "source_page": SNDuk_PRICES_URL,
                    "table_cells": cells,
                },
                currency=(fund.get("currency") or "EGP"),
            ))
    print(f"snduk fallback: {len(out)} matched rows")
    return out


def _select_fallbacks(all_rows, snduk_rows):
    """Use Snduk only where the current manager extraction is not usable."""
    current = {}
    for row in all_rows:
        fid = row.get("fund_id")
        if not fid or row.get("source_id") == "src_snduk":
            continue
        if _is_usable_current_candidate(row):
            current.setdefault(fid, []).append(row)

    return [row for row in snduk_rows if row.get("fund_id") and not current.get(row["fund_id"])]


def _normalize_source_ids(rows):
    """Align parser aliases with the canonical sources registry."""
    for row in rows:
        if row.get("source_id") == "src_zaldi":
            row["source_id"] = "src_zaldi_capital"
            raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
            raw["source_id_normalized_from"] = "src_zaldi"
            row["raw"] = raw
    return rows


def main():
    legacy.row = safe_row
    legacy.upsert_official = safe_upsert_official

    if not legacy.BASE or not legacy.KEY:
        sys.exit("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")

    funds = legacy.load_funds()
    by_name, match = legacy.matcher(funds)
    scrapers = [
        ("hermes", lambda: legacy.scrape_hermes(match)),
        ("ci", lambda: legacy.scrape_ci(by_name, match)),
        ("prime", lambda: legacy.scrape_prime(match)),
        ("aaim", lambda: legacy.scrape_aaim(by_name, match)),
        ("beltone", lambda: legacy.scrape_beltone_en(by_name)),
        ("azimut", lambda: legacy.scrape_azimut(by_name)),
        ("ni", lambda: legacy.scrape_ni(by_name, match)),
        ("hc", lambda: legacy.scrape_hc(match)),
        ("pfi", lambda: legacy.scrape_pfi(by_name)),
        ("granite", lambda: legacy.scrape_granite(by_name)),
        ("snduk", lambda: legacy.scrape_snduk(funds)),
        ("abk", lambda: legacy.scrape_abk(funds)),
        ("zaldi", lambda: legacy.scrape_zaldi(funds)),
        ("afim", lambda: legacy.scrape_afim(by_name)),
    ]

    all_rows = []
    for name, scraper in scrapers:
        try:
            rows = _normalize_source_ids(scraper())
            print(f"{name}: {len(rows)} extracted, {sum(1 for row in rows if row['fund_id'])} matched")
            all_rows.extend(rows)
        except Exception as exc:
            print(f"{name} ERROR {type(exc).__name__}: {exc}")

    snduk_fallback = _snduk_fallback_rows(funds, match)
    selected_fallbacks = _select_fallbacks(all_rows, snduk_fallback)
    if selected_fallbacks:
        print(f"snduk fallback selected: {len(selected_fallbacks)} funds")
        all_rows.extend(selected_fallbacks)

    if all_rows:
        response = legacy.sb_post("nav_staging", all_rows)
        print(
            "staging", response.status_code, len(all_rows),
            response.text[:200] if response.status_code not in (200, 201) else "OK",
        )

    matched = [row for row in all_rows if row.get("fund_id")]
    ok, n = safe_upsert_official(matched)
    print(f"official upserted {ok}/{n} run={legacy.RUN_ID}")
    legacy.audit_coverage(funds, matched)


if __name__ == "__main__":
    main()
