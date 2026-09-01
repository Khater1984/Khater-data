#!/usr/bin/env python3
"""Step 1: Align stored effective_weights with actual SmartScore renormalization.

- Does not delete any rows or tables.
- Only updates effective_weights (and a small flag inside calculation_inputs).
- Requires SUPABASE_URL + SUPABASE_SERVICE_KEY.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE_WEIGHTS = {
    "performance": 0.30,
    "risk": 0.25,
    "benchmark": 0.25,
    "consistency": 0.10,
    "inflation": 0.10,
}


def env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        raise SystemExit(f"Missing env {name}")
    return v.rstrip("/")


def http(method: str, url: str, key: str, body: dict | None = None, extra_headers: dict | None = None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        raise SystemExit(f"HTTP {e.code} {method} {url}\n{err}") from e


def renormalize(availability: dict | None) -> dict:
    availability = availability or {}
    used = {}
    for key, weight in BASE_WEIGHTS.items():
        if availability.get(key) is True:
            used[key] = weight
    total = sum(used.values())
    if total <= 0:
        # keep template zeros — unqualified / empty
        return {k: 0.0 for k in BASE_WEIGHTS}
    return {k: (used[k] / total if k in used else 0.0) for k in BASE_WEIGHTS}


def weights_equal(a: dict | None, b: dict, tol: float = 1e-9) -> bool:
    a = a or {}
    for k in BASE_WEIGHTS:
        if abs(float(a.get(k, 0) or 0) - float(b.get(k, 0) or 0)) > tol:
            return False
    return True


def main() -> None:
    base = env("SUPABASE_URL")
    key = env("SUPABASE_SERVICE_KEY")
    page_size = 200
    offset = 0
    scanned = 0
    updated = 0
    unchanged = 0

    while True:
        url = (
            f"{base}/rest/v1/smartscore_evaluations"
            f"?select=evaluation_id,component_availability,effective_weights,calculation_inputs"
            f"&order=evaluation_id&limit={page_size}&offset={offset}"
        )
        status, rows = http("GET", url, key)
        if not rows:
            break
        for row in rows:
            scanned += 1
            new_w = renormalize(row.get("component_availability"))
            if weights_equal(row.get("effective_weights"), new_w):
                unchanged += 1
                continue
            inputs = row.get("calculation_inputs") or {}
            if not isinstance(inputs, dict):
                inputs = {"_original_inputs": inputs}
            inputs = dict(inputs)
            inputs["weights_renormalized"] = True
            inputs["weights_basis"] = "available_components_only"
            patch_url = (
                f"{base}/rest/v1/smartscore_evaluations"
                f"?evaluation_id=eq.{row['evaluation_id']}"
            )
            http(
                "PATCH",
                patch_url,
                key,
                {
                    "effective_weights": new_w,
                    "calculation_inputs": inputs,
                },
                extra_headers={"Prefer": "return=minimal"},
            )
            updated += 1
        if len(rows) < page_size:
            break
        offset += page_size

    print(
        json.dumps(
            {
                "scanned": scanned,
                "updated": updated,
                "unchanged": unchanged,
                "note": "Only effective_weights (+ calculation_inputs flags) updated; scores untouched",
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
