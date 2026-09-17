#!/usr/bin/env python3
"""Safe NAV ingest entrypoint.

This wrapper reuses the existing source parsers while enforcing the Phase 1
NAV promotion rules at the staging/official boundary.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

# When executed as ``python scripts/ingest_nav_safe.py``, Python puts
# ``scripts/`` (not the repository root) on sys.path.  Import the existing
# parser as a sibling module so the GitHub Actions entrypoint works reliably.
SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import ingest_nav as legacy


def safe_row(extracted, nav, asof, url, sid, fund, score, extra=None, currency="EGP"):
    """Build a staging row without ever fabricating an as-of date."""
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
        "raw": extra or {},
    }


def safe_upsert_official(matched_rows):
    """Promote only dated candidates and never move official history backwards."""
    now = datetime.now(timezone.utc).isoformat()
    best = {}
    skipped_no_date = 0

    for row in matched_rows:
        fid = row.get("fund_id")
        if not fid:
            continue
        asof = row.get("as_of_date")
        if not asof:
            skipped_no_date += 1
            continue
        previous = best.get(fid)
        if not previous or asof >= (previous.get("as_of_date") or ""):
            best[fid] = row

    existing = {
        x["fund_id"]: x
        for x in legacy.sb_get("nav_official", select="fund_id,as_of_date", limit="1000")
    }

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
        f"skipped_no_date={skipped_no_date} skipped_older={skipped_older} failed={failed}"
    )
    return ok, len(payload)


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
            rows = scraper()
            print(f"{name}: {len(rows)} extracted, {sum(1 for row in rows if row['fund_id'])} matched")
            all_rows.extend(rows)
        except Exception as exc:
            print(f"{name} ERROR {type(exc).__name__}: {exc}")

    if all_rows:
        response = legacy.sb_post("nav_staging", all_rows)
        print("staging", response.status_code, len(all_rows), response.text[:200] if response.status_code not in (200, 201) else "OK")

    matched = [row for row in all_rows if row.get("fund_id")]
    ok, n = safe_upsert_official(matched)
    print(f"official upserted {ok}/{n} run={legacy.RUN_ID}")
    legacy.audit_coverage(funds, matched)


if __name__ == "__main__":
    main()
