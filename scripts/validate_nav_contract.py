#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from datetime import date, timedelta

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
}
MAX_FUTURE_DAYS = 7


def sb_get(table: str, **params):
    r = requests.get(f"{BASE}/rest/v1/{table}", headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def norm(value):
    return " ".join(str(value or "").strip().lower().split())


def main() -> int:
    funds = sb_get(
        "funds",
        select="fund_id,canonical_name,management_company,currency",
        active="eq.true",
        limit="1000",
    )
    officials = sb_get(
        "nav_official",
        select="fund_id,nav,currency,as_of_date,source_id,staging_id",
        limit="1000",
    )
    sources = sb_get(
        "sources",
        select="source_id,management_company_scope",
        limit="1000",
    )
    staging = sb_get(
        "nav_staging",
        select="id,fund_id,nav,currency,as_of_date,source_id,verification_status",
        verification_status="neq.rejected",
        limit="10000",
    )

    fund_by_id = {x["fund_id"]: x for x in funds}
    source_scope = {x["source_id"]: x.get("management_company_scope") for x in sources}
    official_by_id = {x["fund_id"]: x for x in officials}
    staging_by_id = {x["id"]: x for x in staging}
    errors = []
    warnings = []
    today = date.today()

    if len(funds) != len(officials):
        errors.append(f"official coverage mismatch: active={len(funds)} official={len(officials)}")

    for fid, fund in fund_by_id.items():
        n = official_by_id.get(fid)
        if not n:
            errors.append(f"missing official NAV: {fund['canonical_name']} ({fid})")
            continue
        if n.get("nav") is None:
            errors.append(f"NULL NAV: {fund['canonical_name']}")
        asof = n.get("as_of_date")
        if not asof:
            errors.append(f"NULL as_of_date: {fund['canonical_name']}")
        else:
            try:
                d = date.fromisoformat(asof)
                if d > today + timedelta(days=MAX_FUTURE_DAYS):
                    errors.append(
                        f"future date outside +{MAX_FUTURE_DAYS}d: {fund['canonical_name']} {asof}"
                    )
            except ValueError:
                errors.append(f"invalid as_of_date: {fund['canonical_name']} {asof}")
        if norm(n.get("currency")) != norm(fund.get("currency")):
            errors.append(
                f"currency mismatch: {fund['canonical_name']} "
                f"expected={fund.get('currency')} incoming={n.get('currency')}"
            )
        scope = source_scope.get(n.get("source_id"))
        if scope and norm(scope) != norm(fund.get("management_company")):
            errors.append(
                f"source-manager mismatch: {fund['canonical_name']} "
                f"source={n.get('source_id')} expected={scope} "
                f"actual={fund.get('management_company')}"
            )
        if not n.get("staging_id"):
            warnings.append(
                f"official row without staging lineage: {fund['canonical_name']}"
            )

    for n in officials:
        fid = n.get("fund_id")
        fund = fund_by_id.get(fid)
        if not fund:
            errors.append(f"official references inactive/unknown fund: {fid}")
            continue
        sid = n.get("staging_id")
        if sid:
            s = staging_by_id.get(sid)
            if not s:
                errors.append(
                    f"broken staging lineage: {fund['canonical_name']} staging_id={sid}"
                )
            else:
                for key in ("fund_id", "nav", "currency", "as_of_date", "source_id"):
                    if s.get(key) != n.get(key):
                        errors.append(
                            f"lineage mismatch: {fund['canonical_name']} "
                            f"field={key} official={n.get(key)!r} staging={s.get(key)!r}"
                        )

    print(
        f"NAV CONTRACT: active={len(funds)} official={len(officials)} "
        f"errors={len(errors)} warnings={len(warnings)}"
    )
    for item in warnings[:50]:
        print(f"WARNING: {item}")
    for item in errors:
        print(f"ERROR: {item}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
