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
RUN_ID = os.getenv("NAV_RUN_ID") or ("run_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"))


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



PROVIDER_ALIAS_REGISTRY = {}


def set_provider_alias_registry(aliases, funds):
    """Load verified provider aliases from the database identity registry."""
    by_id = {f.get("fund_id"): f for f in funds}
    registry = {}
    for alias in aliases or []:
        source = str(alias.get("alias_source") or "")
        match = re.match(r"^([a-z0-9_]+):verified_identity:", source)
        if not match:
            continue
        if float(alias.get("match_confidence") or 0) < 1.0:
            continue
        fund = by_id.get(alias.get("fund_id"))
        alias_name = alias.get("alias_name")
        if not fund or not alias_name:
            continue
        provider = match.group(1)
        registry.setdefault(provider, {})[norm(alias_name)] = fund
    PROVIDER_ALIAS_REGISTRY.clear()
    PROVIDER_ALIAS_REGISTRY.update(registry)


def provider_alias_match(name, provider):
    """Resolve exact provider labels from the centralized DB registry."""
    normalized = norm(name)
    registry = PROVIDER_ALIAS_REGISTRY.get(provider, {})
    for alias_norm in sorted(registry, key=len, reverse=True):
        if normalized == alias_norm or normalized.endswith(" " + alias_norm):
            return registry[alias_norm], 1.0
    return None, 0.0


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

CI_ALIAS = {
    "cib money market fund ossoul": "CIB Fund I (Osoul)",
    "united bank egypt money market fund rakhaa": "The United Bank Fund (Rakhaa)",
    "banque misr money market fund usd": "Misr Money Market ($)",
    "sarwa life insurance co fund": "Sarwa Life Insurance Fund",
    "fawry ci capital money market fund yawmy": "Fawry",
    "allianz co money market fund": "Allianz",
    "suez canale bank money market fund": "Suez Canal Bank ( Al Suez Al Youmi)",
    "ciam money market fund misr al youmy": "CI Misr Al Youmy",
    "misr life insurance co money market fund": "Misr Life Insurance Fund",
    "basata fund": "Basata",
    "cib fixed income fund thabat": "CIB (Thabat)",
    "ciam fixed income fund kol shahr": "*CI Fixed Income Fund",
    "banque du caire fixed income fund el thabet": "Banque Du Caire (Al Thabet)",
    "shefa orman charity fund": "Shefa Orman Charity Fund",
    "ciam fixed income fund misr al yomy usd": "CIAM ($)",
    "menthum fixed income fund usd": "Menthum USD $",
    "cib fund 4 hemaya": "CIB Fund IV (Hamaya)",
    "banque misr 5 capital protected": "Misr Capital Guaranteed (Al Omr)",
    "banque misr first fund": "Banque Misr Fund I",
    "cib balanced fund takamol": "CIB Fund (Takamol)",
    "banque misr third fund": "Banque Misr Fund III",
    "banque misr second fund": "Banque Misr Fund II",
    "misr equity fund": "CIAM Misr Equity",
    "cib fund 2 istethmar": "CIB Fund II (Istthmar)",
    "ci real estate value chain": "CIAM 1st Issue (Real Estate)",
    "ci telecoms and it": "CIAM 2nd Issue (Technology)",
    "ci exporters": "CIAM 3rd Issue (Export)",
    "ci consumer and basic needs": "CIAM 4th Issue (Consumption)",
    "ci financials and fintech": "CIAM 5th Issue (Electronic Payments)",
    "ci the quant": "CIAM 6th Issue (The Quant)",
    "ci 20hd": "CIAM 7th Issue (HD 20)",
    "ci ipo": "CIAM 8th Issue (IPOs)",
    "misr esg fund": "CIAM ESG",
    "banque misr fourth fund": "Banque Misr Fund IV",
    "faisal cib fund al aman": "FIBE & CIB (Aman)",
    "sanabel islamic fund": "SAIB & ADIB Fund (Sanabel)",
    "ciam shariaa index equity fund egx 33": "CIAM Misr Shariah Equity",
    "ciam gold fund gold masr": "CIAM Gold Fund",
}

AFIM_ALIAS = {
    "صندوق الواعد": "National Bank of Egypt Fund IV",
    "صندوق حورس": "Hourus",
    "صندوق تميز": "Tamayoz",
    "صندوق الرابع": "National Bank of Egypt Fund IV",
    "صندوق وثاق": "Wethaq",
    "صندوق بشائر": "NBE & Al Baraka Bank Egypt Fund (Bashayer)",
    "صندوق الأول –": "National Bank of Egypt Fund I",
    "صندوق الأهلي حياة": "Al Ahly Hayat",
    "صندوق الثاني": "National Bank of Egypt Fund II",
    "صندوق الثالث": "National Bank of Egypt Fund III",
    "صندوق الخامس": "National Bank of Egypt Fund V",
    "صندوق السابع": "National Bank of Egypt VII",
    "صندوق دهب": "Dahab",
}


def load_funds():
    return sb_get("funds", select="fund_id,canonical_name,management_company,price_update_url,metadata", limit="1000")



def exact_manager_match(extracted, by_name, manager):
    """Match only exact canonical/provider labels within one manager."""
    n = norm(extracted)
    for f in by_name.values():
        if f.get("management_company") != manager:
            continue
        candidates = [f.get("canonical_name")]
        md = f.get("metadata") or {}
        if isinstance(md, dict):
            for key in ("info_label", "price_page_label"):
                value = md.get(key)
                if value and not str(value).startswith("http"):
                    candidates.append(str(value))
        if any(n == norm(candidate) for candidate in candidates if candidate):
            return f, 1.0
    return None, 0.0


def row(extracted, nav, asof, url, sid, fund, score, extra=None, currency="EGP"):
    return {
        "run_id": RUN_ID,
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


def scrape_hermes(by_name):
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
                f, sc = exact_manager_match(name, by_name, "Hermes Portfolio and Fund Management")
                out.append(row(name, nav, asof, url, "src_efg_hermes_funds", f, sc, {"cells": cells}))
    return out


def scrape_ci(by_name, match=None):
    url = "https://www.cicapital.com/fundprice/"
    soup = BeautifulSoup(fetch(url), "lxml")
    tables = soup.find_all("table")
    if len(tables) < 3:
        return []
    out = []
    page_asof = None
    mdt = re.search(r'article:modified_time" content="(\d{4}-\d{2}-\d{2})', str(soup))
    if mdt:
        page_asof = mdt.group(1)
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
        low = name.lower()
        if "banque misr money market" in low and "(usd)" not in low:
            continue
        if "al wefak" in low:
            continue
        alias = CI_ALIAS.get(norm(name))
        f = by_name.get(alias) if alias else None
        sc = 1.0 if f else 0
        if not f:
            f, sc = exact_manager_match(name, by_name, "CI Asset Management")
        if not f:
            continue
        out.append(row(name, nav, page_asof, url, "src_cicapital_fundprice", f, sc))
    return out


def scrape_prime(by_name):
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
                normalized_name = norm(name).lstrip("*").strip()
                f, sc = provider_alias_match(normalized_name, "prime")
                if not f:
                    f, sc = exact_manager_match(name, by_name, "Prime Investments")
                if not f:
                    continue
                out.append(row(name, nav, None, url, "src_prime_am", f, sc, {"cells": cells}))
    return out


def scrape_aaim(by_name, match=None):
    url = "https://aaim.com.eg/en/what-we-offer/funds"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    pat = re.compile(r"(.+?)\s+(\d+\.\d+)\s+(EGP|USD)\s+Last update\s+(\d{1,2} \w{3},? \d{4})", re.I)
    out = []
    for m in pat.finditer(text):
        name, nav, cur, dt = m.group(1).strip(), float(m.group(2)), m.group(3).upper(), parse_date(m.group(4))
        name = re.sub(r"^(Funds|الصناديق)\s+", "", name).strip()
        # AAIM's page can prefix the provider label with boilerplate.
        # Resolve only through the centralized verified provider registry.
        f, sc = provider_alias_match(name, "aaim")
        if not f:
            f, sc = exact_manager_match(name, by_name, "Arab African Investment Management")
        if not f:
            continue
        r = row(name, nav, dt, url, "src_aaim_funds", f, sc, currency=cur)
        out.append(r)
    return out


BELTONE_ROW_RE = re.compile(
    r"([A-Za-z][A-Za-z0-9 «»\"“”'’\-(),./&]+?)\s+(\d+(?:\.\d+)?)\s+(\d{4}-\d{2}-\d{2})\s+(20\d{2}-\d{2}-\d{2})"
)


def parse_beltone_listings(text):
    """Parse Beltone's static EN funds page. Integer NAVs (e.g. B-Secure = 2) are valid."""
    out = []
    for name, nav, inception, asof in BELTONE_ROW_RE.findall(text or ""):
        out.append({
            "name": name.strip(),
            "nav": float(nav),
            "inception": inception,
            "as_of_date": asof,
        })
    return out


def scrape_beltone_en(by_name, match=None):
    url = "https://www.beltoneholding.com/en/business-line/asset-management-1"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    out = []
    unmatched = []
    seen = {}
    for item in parse_beltone_listings(text):
        name, nav, asof = item["name"], item["nav"], item["as_of_date"]
        fund, score = provider_alias_match(name, "beltone")
        if not fund:
            fund, score = exact_manager_match(name, by_name, "Beltone Asset Management")
        if not fund:
            unmatched.append(f"{name}@{asof}={nav}")
            continue
        rec = row(name, nav, asof, url, "src_beltone_funds", fund, score)
        fid = fund["fund_id"]
        prev = seen.get(fid)
        if prev and prev["match_score"] >= rec["match_score"]:
            continue
        seen[fid] = rec
    if unmatched:
        print("beltone unmatched:", "; ".join(unmatched))
    return list(seen.values())


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
        if not canon:
            seen.add(fid)
            continue
        f = by_name.get(canon)
        cur = (item.get("currency") or {}).get("symbol") or "EGP"
        asof = (ln.get("date") or "")[:10] or None
        out.append(
            row(
                item.get("name"),
                ln["nav"],
                asof,
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


def scrape_ni(by_name, match=None):
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
        normalized_name = norm(name)
        f, sc = provider_alias_match(normalized_name, "ni")
        if not f:
            f, sc = exact_manager_match(name, by_name, "NI Capital")
        if not f:
            continue
        out.append(row(name, nav, dt, url, "src_nicapital_am", f, sc))
    return out


def scrape_hc(by_name):
    url = "https://www.hc-si.com"
    text = re.sub(r"\s+", " ", BeautifulSoup(fetch(url), "lxml").get_text(" ", strip=True))
    pat = re.compile(r"([A-Za-z][A-Za-z0-9 «»'’\-(),./]+?)\s+\{(\d+\.\d+)\}\s+(\d{4}-\d{2}-\d{2})")
    out = []
    for name, nav, asof in pat.findall(text):
        if "YOUR TRUSTED" in name or len(name) > 80:
            continue
        f, sc = provider_alias_match(name.strip(), "hc")
        if not f:
            f, sc = exact_manager_match(name, by_name, "HC Securities & Investment")
        if not f:
            continue
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
        if norm(title) in {"contact us", "funds", "fund", ""}:
            continue
        f = None
        for k, canon in PFI_ALIAS.items():
            if k in norm(title):
                f = by_name.get(canon)
                break
        out.append(row(title or "PFI table", nav, asof, url, "src_pfi_funds", f, 1.0 if f else 0))
    return out


def scrape_afim(by_name):
    url = "https://www.afim.com.eg/public/index.php/investment"
    html = fetch(url)
    out = []
    for ar, canon in AFIM_ALIAS.items():
        idx = html.find(ar)
        if idx < 0:
            continue
        chunk = html[idx:idx + 1600]
        m = re.search(r"سعر الوثيقة:\s*<span>([^<]+)</span>", chunk)
        if not m:
            continue
        nav = parse_num(m.group(1))
        if not nav:
            continue
        f = by_name.get(canon)
        out.append(row(ar, nav, None, url, "src_afim_investment", f, 1.0 if f else 0))
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


def scrape_alpha_odin(by_name):
    """Attempt manager-first extraction from the official Alpha/Odin funds page.

    The page is currently JavaScript-driven in public rendering, so this parser
    is deliberately conservative: it only promotes rows when an exact Alpha
    registry label and a source-published date are both present.
    """
    url = "https://alpha-odin.com/ar/funds/"
    soup = BeautifulSoup(fetch(url), "lxml")
    out = []

    def accept_candidate(name, nav, asof):
        fund, score = provider_alias_match(name, "alpha")
        if not fund:
            fund, score = exact_manager_match(
                name, by_name, "Alpha Financial Investments Management"
            )
        if not fund or nav is None or not asof:
            return
        out.append(
            row(
                name,
                nav,
                asof,
                url,
                "src_alpha_odin",
                fund,
                score,
                {"provider": "alpha_odin", "identity_match": "exact"},
                currency=fund.get("currency") or "EGP",
            )
        )

    # Server-rendered tables, if the manager publishes them without JS.
    for tr in soup.find_all("tr"):
        cells = [x.get_text(" ", strip=True) for x in tr.find_all(["td", "th"])]
        if len(cells) < 2:
            continue
        for i, cell in enumerate(cells):
            nav = parse_num(cell)
            if nav is None:
                continue
            name_candidates = cells[:i] or cells[i + 1:]
            dates = [parse_date(x) for x in cells if parse_date(x)]
            if dates:
                for candidate in reversed(name_candidates):
                    if provider_alias_match(candidate, "alpha")[0] or exact_manager_match(
                        candidate, by_name, "Alpha Financial Investments Management"
                    )[0]:
                        accept_candidate(candidate, nav, dates[-1])
                        break
            break

    # Conservative text fallback: only exact provider labels and a nearby
    # source-published date are accepted; never infer a date from fetch time.
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    for alias_norm in sorted(PROVIDER_ALIAS_REGISTRY.get("alpha", {}), key=len, reverse=True):
        if alias_norm not in text.lower():
            continue
        alias_fund = PROVIDER_ALIAS_REGISTRY["alpha"][alias_norm]
        escaped = re.escape(alias_norm)
        pattern = re.compile(
            rf"{escaped}.{{0,180}}?(\d+(?:\.\d+)?)"
            rf".{{0,120}}?(\d{{1,2}}[ /-][A-Za-z]{{3,9}}[ /-]\d{{4}}|\d{{4}}-\d{{2}}-\d{{2}})",
            re.I,
        )
        for m in pattern.finditer(text):
            nav = parse_num(m.group(1))
            asof = parse_date(m.group(2))
            if nav is not None and asof:
                out.append(
                    row(
                        alias_fund["canonical_name"],
                        nav,
                        asof,
                        url,
                        "src_alpha_odin",
                        alias_fund,
                        1.0,
                        {"provider": "alpha_odin", "identity_match": "exact"},
                        currency=alias_fund.get("currency") or "EGP",
                    )
                )
                break

    # Keep one row per fund, preferring the newest source-published date.
    best = {}
    for rec in out:
        fid = rec["fund_id"]
        prev = best.get(fid)
        if not prev or (rec.get("as_of_date") or "") > (prev.get("as_of_date") or ""):
            best[fid] = rec
    return list(best.values())


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
    best = {}
    for r in matched_rows:
        fid = r.get("fund_id")
        if not fid:
            continue
        prev = best.get(fid)
        if not prev or (r.get("as_of_date") or "") >= (prev.get("as_of_date") or ""):
            best[fid] = r
    existing = {x["fund_id"]: x for x in sb_get("nav_official", select="fund_id,as_of_date", limit="1000")}
    payload = []
    for r in best.values():
        asof = r.get("as_of_date") or (existing.get(r["fund_id"]) or {}).get("as_of_date")
        if not asof:
            continue
        payload.append(
            {
                "fund_id": r["fund_id"],
                "nav": r["nav"],
                "currency": r.get("currency") or "EGP",
                "as_of_date": asof,
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
    raise SystemExit(
        "Direct legacy NAV ingestion is disabled. Run scripts/ingest_nav_safe.py "
        "so every promotion passes the central NAV contract."
    )


SUPPORTED_HOSTS = {
    "efgholding.com": "hermes",
    "cicapital.com": "ci",
    "primeholdingco.com": "prime",
    "aaim.com.eg": "aaim",
    "beltoneholding.com": "beltone",
    "azimut.eg": "azimut",
    "nicapital.com.eg": "ni",
    "hc-si.com": "hc",
    "pfi-am.com.eg": "pfi",
    "granite.eg": "granite",
    "snduk.com": "snduk",
    "w1.abkegypt.com": "abk",
    "zaldi-capital.com": "zaldi",
    "afim.com.eg": "afim",
}

DATE_OPTIONAL_HOSTS = {
    "afim.com.eg",
    "zaldi-capital.com",
    "primeholdingco.com",
    "cicapital.com",
}


def host_of(url):
    if not url or "://" not in url:
        return ""
    return url.split("/")[2].replace("www.", "")


def audit_coverage(funds, matched_rows):
    import json
    from pathlib import Path
    got = {r["fund_id"] for r in matched_rows if r.get("fund_id") and r.get("nav") is not None}
    official = {x["fund_id"]: x for x in sb_get("nav_official", select="fund_id,nav,as_of_date,source_id", limit="1000")}
    rows = []
    missing_supported = 0
    for f in funds:
        url = f.get("price_update_url") or ""
        host = host_of(url)
        rule = SUPPORTED_HOSTS.get(host)
        off = official.get(f["fund_id"]) or {}
        has_nav = off.get("nav") is not None
        has_date = bool(off.get("as_of_date"))
        if rule:
            if not has_nav:
                status = "FAIL_NO_NAV"
                missing_supported += 1
            elif not has_date and host not in DATE_OPTIONAL_HOSTS:
                status = "FAIL_NO_DATE"
                missing_supported += 1
            elif not has_date:
                status = "NAV_NO_DATE"
            else:
                status = "OK"
        else:
            status = "UNSUPPORTED_HOST" if not has_nav else "OK_UNOFFICIAL_HOST"
        rows.append(
            {
                "fund_id": f["fund_id"],
                "name": f.get("canonical_name"),
                "host": host,
                "rule": rule,
                "status": status,
                "this_run": f["fund_id"] in got,
                "nav": off.get("nav"),
                "as_of_date": off.get("as_of_date"),
            }
        )
    out = {
        "run_id": RUN_ID,
        "funds": len(funds),
        "ok": sum(1 for r in rows if r["status"].startswith("OK")),
        "fail": sum(1 for r in rows if r["status"].startswith("FAIL")),
        "unsupported": sum(1 for r in rows if r["status"] == "UNSUPPORTED_HOST"),
        "rows": rows,
    }
    dest = Path("web/data/nav_coverage.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"coverage ok={out['ok']} fail={out['fail']} unsupported={out['unsupported']} file={dest}")
    for r in rows:
        if r["status"].startswith("FAIL") or r["status"] == "UNSUPPORTED_HOST":
            print(f"  {r['status']}: {r['name']} [{r['host']}]")
    return missing_supported


if __name__ == "__main__":
    main()
