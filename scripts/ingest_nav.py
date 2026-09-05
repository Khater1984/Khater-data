#!/usr/bin/env python3
"""Daily NAV ingest into Supabase nav_staging + nav_official.

Writes raw rows to nav_staging always.
Upserts nav_official only for unique, mapped fund_id matches.
"""
from __future__ import annotations

import os
import re
import sys
import warnings
from datetime import datetime, timezone
from difflib import SequenceMatcher

import requests
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore")

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}
UA = {"User-Agent": "Mozilla/5.0 (compatible; KhaterNAV/1.0; +https://github.com/Khater1984/Khater-data)"}
RUN_ID = "run_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def sb_get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def sb_post(path, payload, prefer="return=minimal"):
    r = requests.post(
        f"{BASE}/rest/v1/{path}",
        headers={**H, "Prefer": prefer},
        json=payload,
        timeout=60,
    )
    return r


def fetch(url):
    r = requests.get(url, headers=UA, timeout=40, verify=False)
    r.raise_for_status()
    return r.text


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (s or "").lower())).strip()


def parse_num(s):
    s = re.sub(r"[^\d.\-]", "", (s or "").replace(",", ""))
    try:
        return float(s)
    except ValueError:
        return None


def parse_date(s):
    s = (s or "").replace(",", "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


BELTONE_ALIAS = {
    "mid bank fund 2": "MID Bank Fund II",
    "mid bank fund 1": "MID Bank Fund I",
    "abc mazaya": "Bank ABC Fund (Mazaya)",
    "banque du caire ii el kahera el yawmi": "Banque Du Caire Fund II",
    "arab bank yomaty": "Arab Bank Fund (Yomaty)",
    "saib money market fund": "Saib (Yaumy Fund)",
    "misr insurance fund": "Misr Insurance Fund",
    "attijariwafa bank money market fund": "Attijariwafa BankFund",
    "beltone 3rd tranche b yawmy fund": "B-Youmy",
    "adib islamic": "ADIB Egypt Shari'a Compliant (Al Nahrda Fund)",
    "egx 30 etf": "EGX30 Index ETF- EGX30 Index ETF",
    "beltone egx33 wafra shariah tracker": "Beltone EGX33 Shariah Index Tracker – Wafra",
    "beltone egx100 tracker": "Beltone EGX100 Index Tracker – Meya Meya",
    "beltone financial fund": "Beltone Financial Fund",
    "beltone real estate fund": "Beltone Real Estate Fund",
    "beltone industrial fund": "Beltone Industrial Fund",
    "beltone consumer fund": "Beltone Consumer Fund",
    "menthum grow fund": "Menthum Grow EGX 30 Capped",
    "egx35 lv": "Beltone EGX 35 Tracker",
    "beltone egx70 tracker": "B70- EGX 70 Tracker",
    "beltone evolve gold fund sabayek": "Sabayek",
    "beltone evolve silver fund fadda": "Beltone Fada",
    "b alpha": "B-Alpha",
    "suez canal bank ii agial": "Suez Canal Bank Fund II (Al Agial)",
    "qnba tawazon": "QNB Al Ahli (Tawazon)",
    "egyptian sport fund": "Sports Fund",
    "beltone fixed income usd fund": "Beltone Fixed Income USD Fund",
    "beltone 2nd tranche b cobonat fund": "B-Couponat",
}

AAIM_ALIAS = {
    "shield equity": "Arab African International Bank (Shield)",
    "juman money market": "Suez Canal Bank (Juman)",
    "iskan money market": "Housing & Development Bank (Iskan)",
    "diamond money market": "CIB Fund II (Diamond)",
    "gozoor fixed income egp": "AAIB (Gozoor)",
    "guard capital protection": "Arab African International Bank (Guard)",
    "afaaq fixed income egp": "Afaaq",
    "istsmar w aman fixed income egp": "Misr Insurance (Istithmar and Aman)",
    "misr takaful sharia compliant money market": "Misr Takaful Fund",
    "bareeq fixed income egp": "Misr Life Insurance (Bareeq)",
    "el fanar money market": "El Fanar",
    "al tameer equity": "Housing & Development Bank ( AL Tameer)",
    "kenz shariah sharia compliant equity": "Kenoz EGX33 Shariah Index Tracker – Shariah",
    "sarwaty money market": "Sarwaty",
    "gosour equity": "Gosour",
    "bond fixed income usd": "Bond$",
}

PFI_ALIAS = {
    "gig money market": "GIG Insurance",
    "gig equity": "GIG Insurance - Egypt Fund I",
    "mawared": "Housing & Development Bank (Mawared)",
    "cashi": "PFI Cashi",
}

AZIMUT_ID = {
    1: "Bank ABC Fund I",
    2: "Ebank Fund II",
    3: "*Maashy",
    4: "Ataa",
    5: "Edkhar",
    6: "AZ Foras",
    8: "Ebank Fund (El Khabeer)",
    10: "Azimut Target Maturity Fund-Target 2027 USD",
    11: "Bank Nxt Fund III (Sanady)",
    12: "Menthum",
    14: "AZ Naser",
    15: "AZ Value",
    16: "AZ Gold",
    17: "AZ Halan",
    18: "AZ-Foras Shariah",
    19: "Azimut Target Maturity Fund-Target 2029 USD",
    21: "AZ Thndr",
    22: "Azimut Target Maturity Fund-Target 2030 USD",
    23: "AZ-LV",
}


def load_funds():
    return sb_get("funds", select="fund_id,canonical_name,management_company,price_update_url,metadata", limit="1000")


def matcher(funds):
    by_name = {f["canonical_name"]: f for f in funds}

    def match(extracted, manager_hint=None):
        if extracted in by_name:
            return by_name[extracted], 1.0
        n = norm(extracted)
        best, sc = None, 0.0
        for f in funds:
            if manager_hint and f.get("management_company") != manager_hint:
                continue
            cands = [f["canonical_name"]]
            md = f.get("metadata") or {}
            if isinstance(md, dict):
                for k in ("info_label", "price_page_label"):
                    v = md.get(k)
                    if v and not str(v).startswith("http"):
                        cands.append(str(v))
            for c in cands:
                nn = norm(c)
                ratio = SequenceMatcher(None, n, nn).ratio()
                if n == nn:
                    ratio = 1.0
                elif n in nn or nn in n:
                    ratio = max(ratio, 0.84)
                if ratio > sc:
                    sc, best = ratio, f
        return (best, sc) if sc >= 0.84 else (None, sc)

    return by_name, match


def row(extracted, nav, asof, url, sid, fund, score, extra=None, currency="EGP"):
    return {
        "run_id": RUN_ID,
        "extracted_name": extracted,
        "nav": float(nav),
        "currency": currency,
        "as_of_date": asof,
        "source_url": url,
        "source_id": sid,
        "fund_id": None if not fund else fund["fund_id"],
        "canonical_name": None if not fund else fund["canonical_name"],
        "match_status": "matched" if fund else "unmatched",
        "match_score": round(score or 0, 3),
        "verification_status": "pending",
        "raw": extra or {},
    }


def scrape_hermes(match):
    url = "https://efgholding.com/en/our-services/mutual-funds"
    soup = BeautifulSoup(fetch(url), "lxml")
    out = []
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
            if len(cells) < 3 or "IC Price" in " ".join(cells):
                continue
            name, nav = cells[0], parse_num(cells[1])
            asof = parse_date(cells[4] if len(cells) > 4 else "")
            if name and nav:
                f, sc = match(name, "Hermes Portfolio and Fund Management")
                if not f:
                    f, sc = match(name)
                out.append(row(name, nav, asof, url, "src_efg_hermes_funds", f, sc, {"cells": cells}))
    return out


def scrape_ci(by_name, match):
    url = "https://www.cicapital.com/fundprice/"
    soup = BeautifulSoup(fetch(url), "lxml")
    tables = soup.find_all("table")
    if len(tables) < 3:
        return []
    out = []
    for tr in tables[2].find_all("tr")[1:]:
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if len(cells) == 3:
            _ft, name, price = cells
        elif len(cells) == 2:
            name, price = cells
        else:
            continue
        nav = parse_num(price)
        if not name or not nav:
            continue
        # skip currency collisions onto USD-only EIMA row
        low = name.lower()
        if "banque misr money market" in low and "(usd)" not in low:
            out.append(row(name, nav, None, url, "src_cicapital_fundprice", None, 0, {"skip": "currency"}))
            continue
        if "al wefak" in low:
            out.append(row(name, nav, None, url, "src_cicapital_fundprice", None, 0, {"skip": "wrong fund"}))
            continue
        f, sc = match(name, "CI Asset Management")
        if not f:
            f, sc = match(name)
        out.append(row(name, nav, None, url, "src_cicapital_fundprice", f, sc))
    return out


def scrape_prime(match):
    url = "https://primeholdingco.com/asset-management/"
    soup = BeautifulSoup(fetch(url), "lxml")
    out = []
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
            if len(cells) < 6 or cells[0].lower() == "fund":
                continue
            name = cells[2]
            nav = None
            for c in cells:
                v = parse_num(c)
                if v and v > 1 and "%" not in c:
                    nav = v
                    break
            if name and nav:
                f, sc = match(name)
                out.append(row(name, nav, None, url, "src_prime_am", f, sc, {"cells": cells}))
    return out


def scrape_aaim(by_name, match):
    url = "https://aaim.com.eg/en/what-we-offer/funds"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    pat = re.compile(r"(.+?)\s+(\d+\.\d+)\s+(EGP|USD)\s+Last update\s+(\d{1,2} \w{3},? \d{4})", re.I)
    out = []
    for m in pat.finditer(text):
        name, nav, cur, dt = m.group(1).strip(), float(m.group(2)), m.group(3).upper(), parse_date(m.group(4))
        name = re.sub(r"^(Funds|الصناديق)\s+", "", name).strip()
        alias = AAIM_ALIAS.get(norm(name))
        f = by_name.get(alias) if alias else None
        sc = 1.0 if f else 0
        if not f:
            f, sc = match(name)
        r = row(name, nav, dt, url, "src_aaim_funds", f, sc, currency=cur)
        out.append(r)
    return out


def scrape_beltone_en(by_name):
    url = "https://www.beltoneholding.com/en/business-line/asset-management-1"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    pat = re.compile(
        r"([A-Za-z][A-Za-z0-9 «»\"'’\-(),./&]+?)\s+(\d+\.\d+)\s+(\d{4}-\d{2}-\d{2})\s+(20\d{2}-\d{2}-\d{2})"
    )
    out = []
    for name, nav, _inc, asof in pat.findall(text):
        alias = BELTONE_ALIAS.get(norm(name))
        f = by_name.get(alias) if alias else None
        out.append(row(name, float(nav), asof, url, "src_beltone_funds", f, 1.0 if f else 0))
    return out


def scrape_azimut(by_name):
    out = []
    url = "https://azimut.eg/funds"
    try:
        listing = requests.get(
            "https://app.azimut.eg/api/fund/list?size=100&web=true",
            headers=UA,
            timeout=40,
            verify=False,
        ).json()["response"]["funds"]["dataList"]
    except Exception as e:
        print("azimut list fail", e)
        listing = []
    seen = set()
    for item in listing:
        fid = item["id"]
        ln = item.get("last_nav") or {}
        if not ln.get("nav"):
            try:
                ln = requests.get(
                    f"https://app.azimut.eg/api/fund/{fid}",
                    headers=UA,
                    timeout=30,
                    verify=False,
                ).json()["response"]["fund"].get("last_nav") or {}
            except Exception:
                ln = {}
        if not ln.get("nav"):
            continue
        canon = AZIMUT_ID.get(fid)
        f = by_name.get(canon) if canon else None
        cur = (item.get("currency") or {}).get("symbol") or "EGP"
        out.append(
            row(
                item.get("name"),
                ln["nav"],
                ln.get("date"),
                url,
                "src_azimut_funds",
                f,
                1.0 if f else 0,
                {"azimut_id": fid},
                currency=cur,
            )
        )
        seen.add(fid)
    for fid, canon in AZIMUT_ID.items():
        if fid in seen:
            continue
        try:
            fund = requests.get(
                f"https://app.azimut.eg/api/fund/{fid}",
                headers=UA,
                timeout=30,
                verify=False,
            ).json()["response"]["fund"]
            ln = fund.get("last_nav") or {}
            if not ln.get("nav"):
                continue
            f = by_name.get(canon)
            out.append(
                row(fund.get("name"), ln["nav"], ln.get("date"), url, "src_azimut_funds", f, 1.0 if f else 0, {"azimut_id": fid})
            )
        except Exception as e:
            print("azimut detail", fid, e)
    return out


def scrape_ni(by_name, match):
    url = "https://nicapital.com.eg/lines-of-business/asset-management/"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    out = []
    mapping = {
        "siula money market fund": "NI Capital (Siula)",
        "15/30 fixed income fund": "NI Capital 15/30",
        "fixed income fund": "NI Capital 15/30",
        "makaseb 1st tranche": "GIG Makaseb Fund First Tranche",
        "makaseb 2nd tranche": "GIG Makaseb Fund Second Tranche",
        "sahmy fund": "NI Capital (Sahmy)",
        "sahmy 70 fund": "NI Capital EGX 70",
        "education for life": "The charitable education Fund",
    }
    pat = re.compile(r"([A-Z][A-Za-z0-9 /&\-']{3,70}?)\s+(\d{1,2} \w+ 20\d{2})\s+Certificate Price\s+EGP\s*(\d+\.\d+)")
    for m in pat.finditer(text):
        name, dt, nav = m.group(1).strip(), parse_date(m.group(2)), float(m.group(3))
        f = by_name.get(mapping.get(norm(name), ""))
        if not f:
            f, sc = match(name)
        else:
            sc = 1
        out.append(row(name, nav, dt, url, "src_nicapital_am", f, sc or 0))
    return out


def scrape_hc(match):
    url = "https://www.hc-si.com"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    pat = re.compile(r"([A-Za-z][A-Za-z0-9 «»'’\-(),./]+?)\s+\{(\d+\.\d+)\}\s+(\d{4}-\d{2}-\d{2})")
    out = []
    for name, nav, asof in pat.findall(text):
        if "YOUR TRUSTED" in name:
            continue
        f, sc = match(name)
        out.append(row(name.strip(), float(nav), asof, url, "src_hc_si", f, sc))
    return out


def scrape_pfi(by_name):
    url = "https://pfi-am.com.eg/funds/"
    soup = BeautifulSoup(fetch(url), "lxml")
    out = []
    for table in soup.find_all("table"):
        cells = [c.get_text(" ", strip=True) for c in table.find_all(["td", "th"])]
        if len(cells) < 2:
            continue
        nav = parse_num(cells[0])
        asof = parse_date(cells[1])
        if not nav:
            continue
        heading = table.find_previous(["h2", "h3", "h1"])
        title = heading.get_text(" ", strip=True) if heading else ""
        f = None
        for k, canon in PFI_ALIAS.items():
            if k in norm(title):
                f = by_name.get(canon)
                break
        out.append(row(title or "PFI table", nav, asof, url, "src_pfi_funds", f, 1.0 if f else 0))
    return out



def scrape_snduk(funds):
    """Per-fund SNDUK pages store currentPrice + lastPriceUpdate in the RSC payload."""
    out = []
    targets = [f for f in funds if "snduk.com" in (f.get("price_update_url") or "").lower()]
    print(f"snduk targets {len(targets)}")
    for f in targets:
        url = f["price_update_url"]
        try:
            html = fetch(url)
        except Exception as e:
            print("snduk fail", f.get("canonical_name"), type(e).__name__)
            continue
        m = re.search(r'currentPrice\\":\\"([0-9.]+)\\"', html)
        if not m:
            m = re.search(r'currentPrice":"([0-9.]+)"', html)
        d = re.search(r'lastPriceUpdate\\":\\"(\d{4}-\d{2}-\d{2})\\"', html)
        if not d:
            d = re.search(r'lastPriceUpdate":"(\d{4}-\d{2}-\d{2})"', html)
        nav = parse_num(m.group(1)) if m else None
        asof = d.group(1) if d else None
        if nav is None or not asof:
            print("snduk parse miss", f.get("canonical_name"), url)
            continue
        out.append(row(f["canonical_name"], nav, asof, url, "src_snduk", f, 1.0))
    return out


def scrape_abk(funds):
    """ABK Egypt Equity Fund page: table Price / Last Update."""
    url = "https://w1.abkegypt.com/Business/Treasury/Investments/Equity-Fund"
    html = fetch(url)
    m = re.search(r"Today.?s ABK-Egypt Equity Fund Price:.*?<td>([0-9.]+)</td>\s*<td>([0-9/]+)</td>", html, re.S|re.I)
    if not m:
        m = re.search(r"<th[^>]*>Price</th>\s*<th[^>]*>Last Update</th>.*?<td>([0-9.]+)</td>\s*<td>([0-9/]+)</td>", html, re.S|re.I)
    if not m:
        print("abk parse miss")
        return []
    nav, raw_d = float(m.group(1)), m.group(2)
    asof = parse_date(raw_d)
    if not asof:
        # US-style m/d/yyyy
        try:
            asof = datetime.strptime(raw_d, "%m/%d/%Y").date().isoformat()
        except ValueError:
            try:
                asof = datetime.strptime(raw_d, "%d/%m/%Y").date().isoformat()
            except ValueError:
                asof = None
    fund = next((f for f in funds if "kuwait" in (f.get("canonical_name") or "").lower() and "fund i" in (f.get("canonical_name") or "").lower() and "ii" not in (f.get("canonical_name") or "").lower()), None)
    if not fund:
        fund = next((f for f in funds if "abkegypt.com" in (f.get("price_update_url") or "").lower()), None)
    print("abk", nav, asof, fund["canonical_name"] if fund else None)
    return [row("ABK Egypt Equity Fund", nav, asof, url, "src_abk_equity", fund, 1.0 if fund else 0)]


def scrape_zaldi(funds):
    """Zaldi homepage lists live certificate prices next to fund names."""
    url = "https://zaldi-capital.com/"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    patterns = [
        (r"Zaldi-?Elmasry\s+EGP\s+([0-9.]+)", "Zaldi El Masry"),
        (r"zaldi star[^0-9]{0,20}EGP\s+EGP\s+([0-9.]+)", "Zaldi Star"),
        (r"zaldi star[^0-9]{0,40}?([0-9]+\.[0-9]+)", "Zaldi Star"),
    ]
    out = []
    for pat, name in patterns:
        m = re.search(pat, text, re.I)
        if not m:
            continue
        nav = float(m.group(1))
        fund = next((f for f in funds if f.get("canonical_name") == name), None)
        if not fund:
            fund = next((f for f in funds if name.lower() in (f.get("canonical_name") or "").lower()), None)
        print("zaldi", name, nav, fund["canonical_name"] if fund else None)
        out.append(row(name, nav, None, url, "src_zaldi", fund, 1.0 if fund else 0))
    return out

def scrape_granite(by_name):
    url = "https://www.granite.eg/"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    m = re.search(r"EGP Money Market Fund NAV\s*([\d.]+)", text)
    if not m:
        return []
    f = by_name.get("Granite First Fund")
    return [row("EGP Money Market Fund", float(m.group(1)), None, url, "src_granite_eg", f, 1.0 if f else 0)]


def upsert_official(matched_rows):
    now = datetime.now(timezone.utc).isoformat()
    # one row per fund_id, prefer dated + later date
    best = {}
    for r in matched_rows:
        fid = r.get("fund_id")
        if not fid:
            continue
        prev = best.get(fid)
        if not prev or (r.get("as_of_date") or "") >= (prev.get("as_of_date") or ""):
            best[fid] = r
    payload = []
    for r in best.values():
        payload.append(
            {
                "fund_id": r["fund_id"],
                "nav": r["nav"],
                "currency": r.get("currency") or "EGP",
                "as_of_date": r.get("as_of_date"),
                "source_id": r.get("source_id"),
                "source_url": r.get("source_url"),
                "verified_at": now,
            }
        )
    ok = 0
    for i in range(0, len(payload), 40):
        batch = payload[i : i + 40]
        rr = sb_post("nav_official", batch, prefer="resolution=merge-duplicates,return=minimal")
        if rr.status_code in (200, 201):
            ok += len(batch)
        else:
            print("official fail", rr.status_code, rr.text[:300])
            # fallback patch one by one
            for item in batch:
                p = requests.patch(
                    f"{BASE}/rest/v1/nav_official?fund_id=eq.{item['fund_id']}",
                    headers={**H, "Prefer": "return=minimal"},
                    json=item,
                    timeout=20,
                )
                if p.status_code in (200, 204) and p.text != "[]":
                    ok += 1
                elif p.status_code in (200, 204):
                    ins = sb_post("nav_official", item)
                    if ins.status_code in (200, 201):
                        ok += 1
    return ok, len(payload)


def main():
    if not BASE or not KEY:
        sys.exit("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")
    funds = load_funds()
    by_name, match = matcher(funds)
    scrapers = [
        ("hermes", lambda: scrape_hermes(match)),
        ("ci", lambda: scrape_ci(by_name, match)),
        ("prime", lambda: scrape_prime(match)),
        ("aaim", lambda: scrape_aaim(by_name, match)),
        ("beltone", lambda: scrape_beltone_en(by_name)),
        ("azimut", lambda: scrape_azimut(by_name)),
        ("ni", lambda: scrape_ni(by_name, match)),
        ("hc", lambda: scrape_hc(match)),
        ("pfi", lambda: scrape_pfi(by_name)),
        ("granite", lambda: scrape_granite(by_name)),
        ("snduk", lambda: scrape_snduk(funds)),
        ("abk", lambda: scrape_abk(funds)),
        ("zaldi", lambda: scrape_zaldi(funds)),
    ]
    all_rows = []
    for name, fn in scrapers:
        try:
            rows = fn()
            print(f"{name}: {len(rows)} extracted, {sum(1 for r in rows if r['fund_id'])} matched")
            all_rows.extend(rows)
        except Exception as e:
            print(f"{name} ERROR {type(e).__name__}: {e}")
    if all_rows:
        rr = sb_post("nav_staging", all_rows)
        print("staging", rr.status_code, len(all_rows), rr.text[:200] if rr.status_code not in (200, 201) else "OK")
    matched = [r for r in all_rows if r.get("fund_id")]
    ok, n = upsert_official(matched)
    print(f"official upserted {ok}/{n} run={RUN_ID}")


if __name__ == "__main__":
    main()
