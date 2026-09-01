#!/usr/bin/env python3
"""Step 1-b: enforce effective_weights policy for future runs."""
from __future__ import annotations

import importlib.util
import json
import os
import urllib.error
import urllib.request


def env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        raise SystemExit(f"Missing env {name}")
    return v.rstrip("/")


def http(method: str, url: str, key: str, body=None, extra=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    if extra:
        headers.update(extra)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


def patch_methodology(base: str, key: str):
    # Read current rules then merge keys we care about
    st, cur = http(
        "GET",
        f"{base}/rest/v1/smartscore_methodology_versions?methodology_version=eq.V2.0-hybrid&select=rules",
        key,
    )
    rules = {}
    if st == 200 and cur:
        rules = dict(cur[0].get("rules") or {})
    rules["effective_weights_rule"] = (
        "When a component is unavailable, its weight is redistributed proportionally "
        "across available components; stored effective_weights must match the weights "
        "used in the final smartscore sum."
    )
    rules["effective_weights_enforcement"] = (
        "Pipeline post-step scripts/fix_effective_weights.py after every compute; "
        "optional DB trigger sql/02_step1b_effective_weights_trigger.sql"
    )
    return http(
        "PATCH",
        f"{base}/rest/v1/smartscore_methodology_versions?methodology_version=eq.V2.0-hybrid",
        key,
        {"rules": rules},
        extra={"Prefer": "return=representation"},
    )


def try_install_trigger(base: str, key: str, sql_text: str):
    attempts = []
    for path, payload in [
        ("rpc/exec_sql", {"sql": sql_text}),
        ("rpc/exec_sql", {"query": sql_text}),
        ("rpc/execute_sql", {"sql": sql_text}),
    ]:
        code, body = http("POST", f"{base}/rest/v1/{path}", key, payload)
        attempts.append({"path": path, "http": code, "body": str(body)[:180]})
        if code == 200:
            return {"installed": True, "attempts": attempts}
    return {
        "installed": False,
        "attempts": attempts,
        "action_required": (
            "Run sql/02_step1b_effective_weights_trigger.sql once in Supabase SQL Editor. "
            "Until then, daily-nav post-step enforces weights via REST after each run."
        ),
    }


def main():
    base = env("SUPABASE_URL")
    key = env("SUPABASE_SERVICE_KEY")

    fix_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fix_effective_weights.py")
    spec = importlib.util.spec_from_file_location("fix_effective_weights", fix_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)

    print("=== 1) realign rows ===", flush=True)
    mod.main()

    print("=== 2) methodology rules ===", flush=True)
    st, body = patch_methodology(base, key)
    print(json.dumps({"http": st, "preview": str(body)[:400]}, ensure_ascii=False), flush=True)

    sql_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "sql",
        "02_step1b_effective_weights_trigger.sql",
    )
    sql_text = open(sql_path, "r", encoding="utf-8").read()
    print("=== 3) trigger install attempt ===", flush=True)
    print(json.dumps(try_install_trigger(base, key, sql_text), ensure_ascii=False), flush=True)

    st, body = http(
        "GET",
        f"{base}/rest/v1/smartscore_evaluations?fund_id=eq.ni_capital_15_30__ni_capital"
        f"&select=effective_weights,component_availability,smartscore,calculation_inputs",
        key,
    )
    print("=== 4) verify sample ===", flush=True)
    print(json.dumps({"http": st, "row": body}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
