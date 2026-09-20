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
        select="fund_id,canonical_name,management_company,currency,price_update_url",
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
        select="source_id,management_company_scope,source_url,source_kind",
        limit="1000",
    )
    fund_by_id = {x["fund_id"]: x for x in funds}
    source_registry = {
        x["source_id"]: {
            "management_company_scope": x.get("management_company_scope"),
            "source_url": x.get("source_url") or "",
            "source_kind": x.get("source_kind") or "",
        }
        for x in sources
    }

    def host(value):
        if not value or "://" not in str(value):
            return ""
        return str(value).split("/")[2].lower().replace("www.", "")

    def source_allowed(row, fund):
        source_id = row.get("source_id") or ""
        raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        if source_id == "src_snduk":
            return raw.get("identity_match") == "explicit_alias"
        if source_id == "src_eima_weekly_tw":
            return raw.get("identity_match") == "exact_fund_id"
        meta = source_registry.get(source_id) or {}
        scope = meta.get("management_company_scope")
        if scope:
            return norm(scope) == norm(fund.get("management_company"))
        if meta.get("source_kind") == "management_company_page":
            return bool(
                host(meta.get("source_url"))
                and host(meta.get("source_url")) == host(fund.get("price_update_url"))
            )
        return False
    official_by_id = {x["fund_id"]: x for x in officials}

    staging_ids = sorted({n["staging_id"] for n in officials if n.get("staging_id")})
    staging = []
    if staging_ids:
        id_list = ",".join(str(int(value)) for value in staging_ids)
        staging = sb_get(
            "nav_staging",
            select="id,fund_id,nav,currency,as_of_date,source_id,verification_status",
            id=f"in.({id_list})",
            verification_status="neq.rejected",
            limit=str(len(staging_ids)),
        )
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
        if not source_allowed(n, fund):
            errors.append(
                f"source identity not authorized: {fund['canonical_name']} "
                f"source={n.get('source_id')}"
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
