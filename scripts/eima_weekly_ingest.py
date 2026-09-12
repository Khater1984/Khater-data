#!/usr/bin/env python3
"""EIMA weekly report discovery, completeness validation and atomic import.

Parser v2:
  - Dual extraction: pdfplumber tables + layout-text fallback (page-3 safety)
  - Coverage gate vs previous successful report fund set
  - Page completeness + identity + duplicate gates
  - EGX 30 / Market Return excluded from Fund Universe
  - Corrupt tokens (e.g. 0-Jan-00) never coerced to numeric returns
"""
from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher
from io import BytesIO

import pdfplumber
import requests
from bs4 import BeautifulSoup

EIMA_REPORTS_URL = os.getenv("EIMA_REPORTS_URL", "https://eima.org.eg/?page_id=1886")
UA = {"User-Agent": "Khater-EIMA-Pipeline/1.0 (+https://github.com/Khater1984/Khater-data)"}
PDF_HORIZONS = ["weekly", "4weeks", "ytd", "last12m", "2y", "3y", "4y", "5y", "6y"]
PARSER_VERSION = "eima_weekly_v2"
# Soft floor: typical weekly reports have ~190+ matchable funds after identity rules
MIN_MATCHED_FUNDS = int(os.getenv("EIMA_MIN_MATCHED_FUNDS", "190"))
# Hard drop vs previous report: block if we lose more than this many previously-seen funds
MAX_FUND_DROP_VS_PREV = int(os.getenv("EIMA_MAX_FUND_DROP_VS_PREV", "5"))


def norm(s: str | None) -> str:
    s = (s or "").lower().replace("–", "-").replace("—", "-")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def num(s) -> float | None:
    """Parse numeric token; never invent numbers from corrupt text like 0-Jan-00."""
    if s is None:
        return None
    s = str(s).strip().replace(",", "")
    if not s or s.upper() in {"N/A", "NA", "-"}:
        return None
    if re.search(r"[A-Za-z]", s):
        return None
    try:
        return float(re.sub(r"[^0-9.\-]", "", s))
    except ValueError:
        return None


def discover():
    r = requests.get(EIMA_REPORTS_URL, headers=UA, timeout=45)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    found = []
    rx = re.compile(
        r"/wp-content/uploads/(\d{4})/(\d{2})/(Performance-[^\"']+?Time-Weighted(?:-Amended)?\.pdf)",
        re.I,
    )
    for a in soup.find_all("a", href=True):
        m = rx.search(a["href"])
        if not m:
            continue
        url = a["href"] if a["href"].startswith("http") else requests.compat.urljoin(EIMA_REPORTS_URL, a["href"])
        found.append((url, a.get_text(" ", strip=True), m.group(3)))
    if not found:
        raise RuntimeError("EIMA report discovery returned no Performance PDF links")

    def key(x):
        m = re.search(r"Performance-(\d{1,2})-of-([A-Za-z]+)-(\d{4})", x[2], re.I)
        if not m:
            return (0, 0, 0)
        try:
            month = list(calendar.month_name).index(m.group(2).capitalize())
        except ValueError:
            month = 0
        return (int(m.group(3)), month, int(m.group(1)))

    return sorted(found, key=key, reverse=True)[0]


def report_date_from_text(text: str) -> str:
    m = re.search(
        r"Performance of\s+Egyptian Mutual Funds\s+(\d{1,2})[-/]([A-Za-z]{3,})[-/](\d{2,4})",
        text,
        re.I,
    )
    if not m:
        raise RuntimeError("Could not determine report date from PDF")
    y = int(m.group(3))
    y = y + 2000 if y < 100 else y
    month_name = m.group(2).capitalize()
    # Accept both full and abbreviated month names
    months = {name: i for i, name in enumerate(calendar.month_name) if name}
    months.update({name[:3]: i for i, name in enumerate(calendar.month_abbr) if name})
    month = months.get(month_name) or months.get(month_name[:3])
    if not month:
        raise RuntimeError(f"Unknown month in report header: {m.group(2)}")
    return f"{y:04d}-{month:02d}-{int(m.group(1)):02d}"


def clean_row(row):
    r = [None if x is None else str(x).strip() for x in row]
    while r and not r[0]:
        r.pop(0)
    if len(r) >= 7 and re.fullmatch(r"\d+", r[0] or "") and r[1]:
        r = r[1:]
    return r


def is_fund_row(r) -> bool:
    if len(r) < 6 or not r[0] or not r[1]:
        return False
    if norm(r[0]) in {"fund", "average", "nav", "market return", "egx 30"}:
        return False
    if re.search(r"disclaimer|average|market return", " ".join(x or "" for x in r[:5]), re.I):
        return False
    if not re.search(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}$", r[2] or "", re.I):
        return False
    return num(r[3]) is not None and num(r[4]) is not None


def _append_horizon_rows(rows, *, page, table, category, name, manager, nav, values, warnings, source):
    """values: list of 18 slots (ret,rank) x 9 horizons — may be shorter."""
    values = (list(values) + [None] * 18)[:18]
    for i, h in enumerate(PDF_HORIZONS):
        raw_ret = values[i * 2]
        ret = num(raw_ret)
        rank = num(values[i * 2 + 1])
        if ret is None and raw_ret and str(raw_ret).upper() not in {"N/A", "NA", "-", ""}:
            warnings.append(f"page {page} {source}: unparsable return for {name}/{h}: {raw_ret!r}")
        rows.append(
            {
                "page": page,
                "table": table,
                "category": category,
                "name": name,
                "manager": manager,
                "nav": nav,
                "horizon": h,
                "return_pct": ret,
                "rank": rank,
                "raw": None,
                "source": source,
            }
        )


def parse_tables_page(page, pno: int, rows: list, warnings: list) -> tuple[int, set]:
    """Primary path: pdfplumber extract_tables."""
    tables = page.extract_tables() or []
    detected = 0
    categories: set = set()
    category = None
    for ti, table in enumerate(tables, 1):
        for raw in table:
            r = clean_row(raw)
            if not r:
                continue
            joined = " ".join(x or "" for x in r)
            if (
                re.search(
                    r"^Open End|^Closed End|Capital Protected|Capital Guaranteed|Money Market|Fixed Income|Equity|Balanced|Mixed Money|Islamic",
                    joined,
                    re.I,
                )
                and not is_fund_row(r)
            ):
                category = joined.strip()
                categories.add(category)
                continue
            if not is_fund_row(r):
                continue
            detected += 1
            name, manager, inception, initial, nav = r[:5]
            _append_horizon_rows(
                rows,
                page=pno,
                table=ti,
                category=category,
                name=name,
                manager=manager,
                nav=nav,
                values=r[5:23],
                warnings=warnings,
                source="table",
            )
    return detected, categories


def parse_layout_text_page(text: str, pno: int, rows: list, warnings: list, known_names: set[str]) -> int:
    """
    Fallback for sections where extract_tables drops rows (classic page-3 Islamic MM / Fixed Income).
    Only recovers funds whose exact name is already in the active fund universe (known_names),
    so we do not invent identities.
    """
    if not text or not known_names:
        return 0

    # Longest names first to avoid partial overlaps
    ordered = sorted(known_names, key=len, reverse=True)
    detected = 0
    seen_on_page: set[str] = set()

    for line in text.splitlines():
        if not line.strip():
            continue
        if re.search(r"Average|Disclaimer|chang(?:ed|ned)|split the initial|Market Return", line, re.I):
            continue
        # Typical layout: optional rank + fund name + manager + Mon-YY + initial + NAV + pairs
        hit_name = None
        for name in ordered:
            if name in line:
                hit_name = name
                break
        if not hit_name or hit_name in seen_on_page:
            continue

        s = re.sub(r"^\s*\d+\s+", "", line)
        idx = s.find(hit_name)
        if idx < 0:
            continue
        after = s[idx + len(hit_name) :].strip()
        parts = [p.strip() for p in re.split(r"\s{2,}", after) if p.strip()]
        incept_i = None
        for i, p in enumerate(parts):
            if re.match(r"^[A-Za-z]{3}-\d{2,4}$", p):
                incept_i = i
                break
        if incept_i is None:
            continue
        mgr = " ".join(parts[:incept_i]) if incept_i > 0 else None
        rest = parts[incept_i + 1 :]
        if len(rest) < 2:
            continue
        nav = num(rest[1])
        if nav is None:
            continue

        flat: list[str] = []
        for t in rest[2:]:
            flat.extend(t.split())

        # Build ret/rank pairs into values[18]
        values: list = [None] * 18
        i = 0
        hi = 0
        while i < len(flat) and hi < len(PDF_HORIZONS):
            tok = flat[i]
            if tok.upper() in {"N/A", "NA", "-", "—"} or (re.search(r"[A-Za-z]", tok) and not re.match(r"^-?\d", tok)):
                values[hi * 2] = None
                i += 1
                if i < len(flat) and (flat[i].isdigit() or flat[i].upper() in {"N/A", "NA"}):
                    i += 1
                hi += 1
                continue
            ret = num(tok)
            if ret is not None:
                values[hi * 2] = tok
                i += 1
                if i < len(flat) and re.match(r"^\d+$", flat[i]) and int(flat[i]) < 200:
                    values[hi * 2 + 1] = flat[i]
                    i += 1
                hi += 1
            else:
                i += 1

        seen_on_page.add(hit_name)
        detected += 1
        _append_horizon_rows(
            rows,
            page=pno,
            table=0,
            category=None,
            name=hit_name,
            manager=mgr,
            nav=str(nav),
            values=values,
            warnings=warnings,
            source="layout_text",
        )

    return detected


def merge_rows_prefer_tables(table_rows: list, layout_rows: list) -> list:
    """Prefer table extraction; add layout rows only for fund names missing from tables."""
    table_names = {norm(r["name"]) for r in table_rows if r.get("name")}
    merged = list(table_rows)
    added = 0
    for r in layout_rows:
        if norm(r["name"]) in table_names:
            continue
        merged.append(r)
        added += 1
    return merged


def parse_pdf(blob: bytes, known_fund_names: set[str] | None = None):
    known_fund_names = known_fund_names or set()
    pdf = pdfplumber.open(BytesIO(blob))
    pages = []
    table_rows: list = []
    layout_rows: list = []
    report_date = None

    for pno, page in enumerate(pdf.pages, 1):
        text = page.extract_text() or ""
        if not report_date:
            try:
                report_date = report_date_from_text(text)
            except RuntimeError:
                pass

        warnings: list = []
        t_count, categories = parse_tables_page(page, pno, table_rows, warnings)
        l_count = parse_layout_text_page(text, pno, layout_rows, warnings, known_fund_names)

        data_looking = bool(re.search(r"Fund\s+Management Company|Egyptian Mutual Funds", text, re.I))
        market = bool(re.search(r"Market Return|EGX\s*30", text, re.I))
        combined = t_count  # page gate uses table count; layout is recovery
        if data_looking and not market and t_count == 0 and l_count == 0:
            warnings.append(f"data-looking page {pno} yielded zero fund rows (tables+layout)")
        elif data_looking and not market and t_count == 0 and l_count > 0:
            warnings.append(f"page {pno}: tables empty, recovered {l_count} funds via layout_text")
        elif l_count > t_count:
            warnings.append(f"page {pno}: layout_text found extra candidates tables={t_count} layout={l_count}")

        pages.append(
            {
                "page_number": pno,
                "extracted_text_length": len(text),
                "detected_fund_rows_tables": t_count,
                "detected_fund_rows_layout": l_count,
                "detected_fund_rows": max(t_count, l_count),
                "detected_category_headers": len(categories),
                "detected_market_return": market,
                "data_looking": data_looking,
                "parser_status": "ok" if not warnings else "warning",
                "extraction_warnings": warnings,
            }
        )

    if not report_date:
        raise RuntimeError("Report date not found")

    rows = merge_rows_prefer_tables(table_rows, layout_rows)
    return report_date, pages, rows


def headers():
    k = os.environ["SUPABASE_SERVICE_KEY"]
    return {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"}


def sb_get(path, params):
    b = os.environ["SUPABASE_URL"].rstrip("/")
    r = requests.get(f"{b}/rest/v1/{path}", headers=headers(), params=params, timeout=45)
    r.raise_for_status()
    return r.json()


def load_known_fund_names() -> set[str]:
    funds = sb_get(
        "funds",
        {"select": "fund_id,canonical_name,eima_name_raw,active", "limit": "1000"},
    )
    names: set[str] = set()
    for f in funds:
        if f.get("active") is False:
            continue
        for n in (f.get("canonical_name"), f.get("eima_name_raw")):
            if n and n.strip():
                names.add(n.strip())
    try:
        aliases = sb_get(
            "fund_name_aliases",
            {"select": "alias_name", "limit": "5000"},
        )
        for a in aliases:
            if a.get("alias_name"):
                names.add(a["alias_name"].strip())
    except Exception:
        pass
    return names


def previous_report_fund_ids(before_date: str) -> set[str]:
    """Fund ids that appeared in the most recent report before before_date."""
    reps = sb_get(
        "eima_reports",
        {
            "select": "report_id,report_date",
            "report_date": f"lt.{before_date}",
            "order": "report_date.desc",
            "limit": "1",
        },
    )
    if not reps:
        return set()
    prev = reps[0]["report_date"]
    ids: set[str] = set()
    offset = 0
    while True:
        batch = sb_get(
            "fund_performance_history",
            {
                "select": "fund_id",
                "report_date": f"eq.{prev}",
                "limit": "1000",
                "offset": str(offset),
            },
        )
        if not batch:
            break
        for row in batch:
            ids.add(row["fund_id"])
        offset += len(batch)
        if len(batch) < 1000:
            break
    return ids


def match_rows(rows):
    funds = sb_get(
        "funds",
        {
            "select": "fund_id,canonical_name,eima_name_raw,management_company,currency,active",
            "limit": "1000",
        },
    )
    aliases = sb_get(
        "fund_name_aliases",
        {"select": "fund_id,alias_name,normalized_alias,match_confidence", "limit": "5000"},
    )
    by = {}
    fund_by_id = {f["fund_id"]: f for f in funds}
    for f in funds:
        for n in (f.get("canonical_name"), f.get("eima_name_raw")):
            if n:
                by[norm(n)] = f
    for a in aliases:
        f = fund_by_id.get(a["fund_id"])
        if f:
            by[norm(a.get("alias_name"))] = f

    unmatched = []
    matched = []
    for r in rows:
        if norm(r["name"]) in {"egx 30", "market return"}:
            continue
        f = by.get(norm(r["name"]))
        score = 1.0 if f else 0.0
        if not f:
            candidates = []
            for x in funds:
                s = SequenceMatcher(None, norm(r["name"]), norm(x["canonical_name"])).ratio()
                if s >= 0.93:
                    candidates.append((s, x))
            if len(candidates) == 1:
                score, f = candidates[0]
        if not f:
            unmatched.append({"name": r["name"], "manager": r.get("manager"), "source": r.get("source")})
            continue
        # Skip pure null horizon rows at match time? keep structure; filter at insert
        r.update(
            {
                "fund_id": f["fund_id"],
                "currency": f.get("currency") or "EGP",
                "match_score": score,
            }
        )
        matched.append(r)
    return matched, unmatched


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--url")
    args = ap.parse_args()

    run_id = "eima_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:8]
    url = args.url or discover()[0]
    r = requests.get(url, headers=UA, timeout=60)
    r.raise_for_status()
    blob = r.content
    sha = hashlib.sha256(blob).hexdigest()

    known_names = load_known_fund_names()
    report_date, pages, rows = parse_pdf(blob, known_fund_names=known_names)

    existing = sb_get(
        "eima_reports",
        {
            "select": "report_id,report_date,source_sha256",
            "or": f"(report_date.eq.{report_date},source_sha256.eq.{sha})",
        },
    )
    matched, unmatched = match_rows(rows)

    # Only keep rows with a real return or that came with NAV context — drop all-null noise optional:
    # Insert convention: skip horizons where return_pct is None (same as manual recovery)
    matched_for_insert = [m for m in matched if m.get("return_pct") is not None]

    errors: list[str] = []
    for p in pages:
        if p["data_looking"] and not p["detected_market_return"] and p["detected_fund_rows"] == 0:
            errors.append(f"PAGE_{p['page_number']}_ZERO_FUNDS")

    # Deduplicate unmatched names for gate
    unmatched_names = sorted({x["name"] for x in unmatched})
    if unmatched_names:
        errors.append("UNMATCHED_FUNDS")

    seen = set()
    for r in matched_for_insert:
        k = (r["fund_id"], report_date, r["horizon"])
        if k in seen:
            errors.append(f"DUPLICATE:{k}")
        seen.add(k)

    if existing:
        errors.append("REPORT_ALREADY_EXISTS")

    # --- Coverage gates (prevent silent page-3 style drops) ---
    funds_matched_ids = {m["fund_id"] for m in matched_for_insert}
    funds_matched_count = len(funds_matched_ids)

    if funds_matched_count < MIN_MATCHED_FUNDS:
        errors.append(f"COVERAGE_BELOW_MIN:{funds_matched_count}<{MIN_MATCHED_FUNDS}")

    prev_ids = previous_report_fund_ids(report_date)
    coverage_meta = {
        "previous_report_fund_count": len(prev_ids),
        "current_matched_fund_count": funds_matched_count,
        "dropped_vs_previous": [],
    }
    if prev_ids:
        dropped = sorted(prev_ids - funds_matched_ids)
        coverage_meta["dropped_vs_previous"] = dropped
        if len(dropped) > MAX_FUND_DROP_VS_PREV:
            errors.append(f"COVERAGE_DROP_VS_PREV:{len(dropped)}>{MAX_FUND_DROP_VS_PREV}")

    layout_recovered = len({norm(r["name"]) for r in rows if r.get("source") == "layout_text"})
    table_names = {norm(r["name"]) for r in rows if r.get("source") == "table"}
    layout_only = len({norm(r["name"]) for r in rows if r.get("source") == "layout_text"} - table_names)

    result = {
        "run_id": run_id,
        "status": "blocked" if errors else "validated",
        "parser_version": PARSER_VERSION,
        "report_date": report_date,
        "source_url": url,
        "source_sha256": sha,
        "page_count": len(pages),
        "pages_processed": len(pages),
        "pages_with_funds": sum(p["detected_fund_rows"] > 0 for p in pages),
        "funds_detected": len({r["name"] for r in rows}),
        "funds_matched": funds_matched_count,
        "funds_unmatched": len(unmatched_names),
        "layout_only_funds": layout_only,
        "performance_rows": len(matched_for_insert),
        "coverage": coverage_meta,
        "errors": errors,
        "unmatched": [{"name": n} for n in unmatched_names],
        "pages": pages,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if errors or args.dry_run:
        return 0 if args.dry_run else 2

    payload = {
        "report_id": f"eima_{report_date}",
        "report_date": report_date,
        "report_label": f"EIMA Performance {report_date}",
        "source_url": url,
        "source_sha256": sha,
        "page_count": len(pages),
        "parser_version": PARSER_VERSION,
        "notes": json.dumps(
            {
                "run_id": run_id,
                "page_audit": pages,
                "coverage": coverage_meta,
                "layout_only_funds": layout_only,
            }
        ),
    }
    dbrows = [
        {
            "fund_id": r["fund_id"],
            "report_date": report_date,
            "horizon": r["horizon"],
            "nav_value": num(r["nav"]),
            "return_pct": r["return_pct"],
            "rank": r["rank"],
            "currency": r["currency"],
            "report_status": "official",
            "source_id": f"eima_{report_date}",
            "raw": {
                "page": r["page"],
                "table": r["table"],
                "eima_name": r["name"],
                "management_company": r.get("manager"),
                "category": r.get("category"),
                "extraction_source": r.get("source"),
            },
        }
        for r in matched_for_insert
    ]
    b = os.environ["SUPABASE_URL"].rstrip("/")
    rr = requests.post(
        f"{b}/rest/v1/rpc/import_eima_report_atomic",
        headers=headers(),
        json={"p_report": payload, "p_rows": dbrows},
        timeout=60,
    )
    rr.raise_for_status()
    print(json.dumps({"status": "imported", "result": rr.json()}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
