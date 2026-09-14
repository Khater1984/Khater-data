import { toLine, rebase, en } from "./engine.js";
import { loadEngine } from "./live.js";
import { mountPurchasingAccordion } from "./accordion.js";

const COLORS={purchasing:"#FF5252",usd_egp_mid:"#14B8A6",gold_egp_oz:"#FFD700",silver_egp_oz:"#C0C0C0",qqq_egp:"#A855F7",spy_egp:"#3B82F6",egx30_close:"#10B981",deposit:"#F59E0B",tbill:"#34D399"};
const LABELS={usd_egp_mid:"سعر الدولار",gold_egp_oz:"الذهب",silver_egp_oz:"الفضة",spy_egp:"الأسهم الأمريكية (S&P 500)",qqq_egp:"أسهم التكنولوجيا (ناسداك)",egx30_close:"البورصة المصرية (EGX30)",purchasing:"القوة الشرائية للنقد",deposit:"ودائع البنوك",tbill:"أذون الخزانة"};
