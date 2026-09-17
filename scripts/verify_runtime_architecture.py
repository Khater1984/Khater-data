from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

errors = []

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

transport = read("web/js/data/supabase-client.js")
benchmark_service = read("web/js/data/benchmark-service.js")
benchmark_registry = read("web/js/data/benchmark-registry.js")
fund_benchmark = read("web/js/fund-benchmark.js")
funds_service = read("web/js/data/funds-service.js")
fund_html = read("web/fund.html")
funds_html = read("web/funds.html")

if "function rpc(" not in transport or "rpc: rpc" not in transport:
    errors.append("supabase-client.js must own the shared RPC transport")

if "benchmarkRegistry" not in benchmark_service or "benchmark_return_generic" not in benchmark_service:
    errors.append("benchmark-service.js must use the canonical registry and DB benchmark RPC")

if "benchmarkRegistry" not in benchmark_registry or "horizonStart" not in benchmark_registry:
    errors.append("benchmark-registry.js must own benchmark vocabulary and horizon boundaries")

if "D.benchmarks" not in fund_benchmark or "getForFund" not in fund_benchmark:
    errors.append("fund-benchmark.js must consume the canonical benchmark service")

if "D.benchmarks" not in funds_service or "benchmarks.getBenchmark" not in funds_service:
    errors.append("funds-service.js must delegate benchmark reads to the canonical benchmark service")

fund_required = [
    "js/data/benchmark-registry.js",
    "js/data/benchmark-service.js",
    "js/data/fund-service.js",
]
for asset in fund_required:
    if asset not in fund_html:
        errors.append(f"fund.html missing explicit architecture dependency: {asset}")

fund_required_order = [
    "js/data/supabase-client.js",
    "js/data/benchmark-registry.js",
    "js/data/benchmark-service.js",
    "js/data/fund-service.js",
]
last = -1
for asset in fund_required_order:
    pos = fund_html.find(asset)
    if pos == -1 or pos < last:
        errors.append("fund.html dependency order is not canonical: " + " → ".join(fund_required_order))
        break
    last = pos

funds_required_order = [
    "js/data/supabase-client.js",
    "js/data/benchmark-registry.js",
    "js/data/benchmark-service.js",
    "js/data/fund-service.js",
    "js/data/funds-service.js",
]
last = -1
for asset in funds_required_order:
    pos = funds_html.find(asset)
    if pos == -1 or pos < last:
        errors.append("funds.html dependency order is not canonical: " + " → ".join(funds_required_order))
        break
    last = pos

for path in (WEB / "js" / "data").glob("*.js"):
    if path.name == "supabase-client.js":
        continue
    text = path.read_text(encoding="utf-8")
    if "fetch(" in text or "XMLHttpRequest" in text:
        errors.append(f"{path.relative_to(ROOT).as_posix()}: direct network client bypasses supabase-client.js")

if errors:
    print("RUNTIME ARCHITECTURE CHECK FAILED")
    for error in errors:
        print(" -", error)
    raise SystemExit(1)

print("RUNTIME ARCHITECTURE CHECK PASSED")
print(" - shared Supabase GET/RPC transport")
print(" - canonical benchmark registry/service")
print(" - explicit page dependency order")
print(" - no direct network clients inside data services")
