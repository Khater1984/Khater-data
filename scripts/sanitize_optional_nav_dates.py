#!/usr/bin/env python3
"""Clear source dates for publishers that do not publish a NAV date.

This is a data-hygiene repair, not a NAV-value repair. It deliberately
clears only manager-source rows whose published source is known to omit the
NAV date. Dated third-party rows such as Snduk are never touched.
"""
from __future__ import annotations

import os
import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}


def get(path, **params):
    response = requests.get(
        f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30
    )
    response.raise_for_status()
    return response.json()


def patch(path, query, payload):
    response = requests.patch(
        f"{BASE}/rest/v1/{path}?{query}",
        headers={**H, "Prefer": "return=minimal"},
        json=payload,
        timeout=30,
    )
    response.raise_for_status()


def main():
    funds = get(
        "funds",
        select="fund_id,source_id,price_update_url",
        active="eq.true",
        limit="1000",
    )

    # Confirmed manager pages that currently expose NAV without a source date.
    optional_source_ids = {
        "src_prime_am",
        "src_zaldi_capital",
        "src_zaldi",
        "src_afim_investment",
        "src_granite_eg",
    }
    optional_hosts = {
        "primeholdingco.com",
        "zaldi-capital.com",
        "afim.com.eg",
        "granite.eg",
    }

    targets = []
    for fund in funds:
        source_id = fund.get("source_id")
        url = fund.get("price_update_url") or ""
        host = url.split("/")[2].replace("www.", "") if "://" in url else ""
        if source_id in optional_source_ids or host in optional_hosts:
            targets.append(fund["fund_id"])

    cleared_staging = 0
    cleared_official = 0
    for fund_id in targets:
        # Clear only rows from the confirmed undated manager sources.  This
        # must not touch dated Snduk/Azimut/other fallback rows for the same
        # fund.
        for source_id in optional_source_ids:
            patch(
                "nav_staging",
                f"fund_id=eq.{fund_id}&source_id=eq.{source_id}&as_of_date=not.is.null",
                {"as_of_date": None},
            )
            cleared_staging += 1

        official = get(
            "nav_official",
            select="fund_id,source_id",
            fund_id=f"eq.{fund_id}",
            limit="1",
        )
        if official and official[0].get("source_id") in optional_source_ids:
            patch(
                "nav_official",
                f"fund_id=eq.{fund_id}",
                {"as_of_date": None},
            )
            cleared_official += 1

    print(
        "optional-date sanitizer: "
        f"targets={len(targets)} staging_source_checks="
        f"{len(targets) * len(optional_source_ids)} "
        f"official_targets={cleared_official}"
    )


if __name__ == "__main__":
    main()
