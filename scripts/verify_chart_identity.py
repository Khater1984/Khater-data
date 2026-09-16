#!/usr/bin/env python3
"""Chart identity contract — every renderer must consume KHATER_THEME."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

theme = (WEB / "js/platform-theme.js").read_text(encoding="utf-8")
for token in [
    "chartLayout",
    "chartGrid",
    "chartScale",
    "chartText",
    "chartCrosshair",
    "directionColor",
    "directionFill",
    "seriesColor",
    "paletteAt",
    "svgAppearance",
    "lightweightChartOptions",
    "attributionLogo: false",
]:
    if token not in theme:
        raise SystemExit(f"Chart identity failed: platform-theme.js missing {token}")

if "#14B891" in theme or "#5D6E9A" in theme:
    raise SystemExit("Chart identity failed: palette still contains off-token hues")

wealth = (WEB / "js/wealth-page.js").read_text(encoding="utf-8")
macro = (WEB / "js/macro-screen.js").read_text(encoding="utf-8")
perf = (WEB / "js/fund-performance.js").read_text(encoding="utf-8")

if "lightweightChartOptions" not in wealth or "seriesColor" not in wealth:
    raise SystemExit("Chart identity failed: wealth-page.js does not consume KHATER_THEME chart API")
for forbidden in ["fontSize:13", "#e1e8e6", "#dfe7e5", "#8a9695", "rgba(8,127,99,.28)"]:
    if forbidden in wealth:
        raise SystemExit(f"Chart identity failed: wealth-page.js still overrides identity with {forbidden}")

if "paletteAt" not in macro or "KHATER_THEME" not in macro:
    raise SystemExit("Chart identity failed: macro-screen.js does not consume KHATER_THEME.paletteAt")
if "||'#087f63'" in macro or "||'#a9652b'" in macro:
    raise SystemExit("Chart identity failed: macro-screen.js still paints from local hex fallbacks")

if "svgAppearance" not in perf or "KHATER_THEME" not in perf:
    raise SystemExit("Chart identity failed: fund-performance.js does not consume KHATER_THEME.svgAppearance")

chart_pages = {
    "wealth.html": "js/wealth-page.js",
    "macro.html": "js/macro-screen.js",
    "fund.html": "js/fund-performance.js",
}
for name, renderer in chart_pages.items():
    html = (WEB / name).read_text(encoding="utf-8")
    if "js/platform-theme.js" not in html:
        raise SystemExit(f"Chart identity failed: {name} instantiates charts without platform-theme.js")
    if renderer.split("/")[-1] not in html and name != "wealth.html":
        pass
    if name == "wealth.html" and "wealth-page.js" not in html:
        raise SystemExit("Chart identity failed: wealth.html missing wealth-page.js")

create_hosts = []
spark_hosts = []
for path in (WEB / "js").rglob("*.js"):
    text = path.read_text(encoding="utf-8", errors="ignore")
    rel = str(path.relative_to(ROOT))
    if "createChart(" in text:
        create_hosts.append(rel)
    if re.search(r"sparkline", text, re.I):
        spark_hosts.append(rel)

if set(create_hosts) != {"web/js/wealth-page.js"}:
    raise SystemExit(f"Chart identity failed: LightweightCharts hosts must be wealth-page.js only, found {create_hosts}")
if spark_hosts:
    raise SystemExit(f"Chart identity failed: unexpected sparkline renderer {spark_hosts}")

for retired in ["web/js/engine.js", "web/js/live.js", "web/js/map-page.js"]:
    if (ROOT / retired).is_file():
        raise SystemExit(f"Chart identity failed: retired renderer still present: {retired}")

print("Chart identity contract passed")
print(" - theme API: layout/grid/scale/crosshair/svg/LWC options")
print(" - wealth + macro + fund performance consume KHATER_THEME")
print(" - single LightweightCharts host; no sparkline/engine duplicates")
