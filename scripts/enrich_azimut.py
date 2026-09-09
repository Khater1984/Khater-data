"""Reusable Azimut official parser. Source: https://app.azimut.eg/api/fund/{id}
Does not write NAV. Reads labeled details[] keys only."""
import json,requests
UA={"User-Agent":"Khater-metadata/1.0"}
def fetch_all_details(max_id=30):
    out=[]
    for i in range(1,max_id+1):
        r=requests.get(f"https://app.azimut.eg/api/fund/{i}",headers=UA,timeout=20).json()
        fund=(r.get("response") or {}).get("fund")
        if fund:
            fund.pop("graph", None)
            fund.pop("last_nav", None)
            out.append(fund)
    return out
if __name__=="__main__":
    print(len(fetch_all_details()))
