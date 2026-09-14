import { toLine, rebase, en } from "./engine.js";
import { loadEngine } from "./live.js";
import { mountPurchasingAccordion } from "./accordion.js";

const COLORS={purchasing:"#D9383A",usd_egp_mid:"#0D9474",gold_egp_oz:"#C57633",silver_egp_oz:"#7A9A95",qqq_egp:"#5D6E9A",spy_egp:"#14B891",egx30_close:"#0D9474",deposit:"#B8841B",tbill:"#0D9474"};
const LABELS={usd_egp_mid:"سعر الدولار",gold_egp_oz:"الذهب",silver_egp_oz:"الفضة",spy_egp:"الأسهم الأمريكية (S&P 500)",qqq_egp:"أسهم التكنولوجيا (ناسداك)",egx30_close:"البورصة المصرية (EGX30)",purchasing:"القوة الشرائية للنقد",deposit:"ودائع البنوك",tbill:"أذون الخزانة"};
const META={
 usd_egp_mid:{text:"نفس الـ100 جنيه لو تحوّلت دولاراً في أول سعر متاح بعد يناير 2016 ثم قُيّمت بآخر سعر صرف في القاعدة.",href:"https://www.cbe.org.eg/en/economic-research/statistics/exchange-rates",link:"البنك المركزي — أسعار الصرف"},
 gold_egp_oz:{text:"سعر أونصة الذهب بالدولار محوّل للجنيه بسعر الصرف في كل فترة، ثم قياس ماذا أصبحت 100 جنيه من أول نقطة 2016.",href:"https://www.cbe.org.eg/en/economic-research/statistics/exchange-rates",link:"منهج التحويل عبر سعر الصرف"},
 silver_egp_oz:{text:"سعر أونصة الفضة بالدولار محوّل للجنيه بسعر الصرف، بنفس قاعدة الـ100 جنيه من 2016.",href:"https://www.cbe.org.eg/en/economic-research/statistics/exchange-rates",link:"منهج التحويل عبر سعر الصرف"},
 spy_egp:{text:"مؤشر الأسهم الأمريكية الأوسع مُقوَّم بالجنيه عبر سعر الصرف. الرقم = ماذا أصبحت 100 جنيه منذ أول تداول في 2016.",href:"https://finance.yahoo.com/quote/SPY/",link:"سلسلة SPY (ثم التحويل للجنيه)"},
 qqq_egp:{text:"أسهم التكنولوجيا الأمريكية مُقوَّمة بالجنيه عبر سعر الصرف من أول تداول 2016.",href:"https://finance.yahoo.com/quote/QQQ/",link:"سلسلة QQQ (ثم التحويل للجنيه)"},
 egx30_close:{text:"ماذا أصبحت 100 جنيه لو تحركت مع إغلاق مؤشر البورصة المصرية من أول جلسة في يناير 2016 أو بعدها.",href:"https://www.egx.com.eg/",link:"البورصة المصرية"},
 purchasing:{text:"النقد بلا استثمار. نركّب التضخم الشهري المعلن منذ 2016 لنرى كم تبقى من قوة 100 جنيه الشرائية.",href:"https://www.cbe.org.eg/en/economic-research/statistics/inflation-rates",link:"معدلات التضخم — البنك المركزي / الجهاز المركزي"},
 deposit:{text:"عائد الوديعة القصيرة يُطبَّق على عدد الأيام الفعلي بين المشاهدات، لا بقسمة سعرين.",href:"https://www.cbe.org.eg/en/economic-research/statistics/interest-rates",link:"أسعار العائد — البنك المركزي"},
 tbill:{text:"عائد مزاد أذون 91 يوماً يُطبَّق زمنياً. أول مزاد في السلسلة قد يكون بعد يناير 2016 ويُذكر على البطاقة.",href:"https://www.cbe.org.eg/",link:"أذون الخزانة — مزادات"}
};
const START="2016-01-01";
const GROUPS={value:["usd_egp_mid","gold_egp_oz","silver_egp_oz","spy_egp","qqq_egp","egx30_close"],policy:["purchasing","deposit","tbill"]};
const $=id=>document.getElementById(id);
const state={series:null,group:"value",range:"all",lines:{}};

function rowsOf(key){
  const s=state.series?.[key];
  if(!s)return [];
  if(Array.isArray(s)){
    return s.map(r=>({time:r[0],value:Number(r[1])})).filter(r=>r.time&&Number.isFinite(r.value));
  }
  return (s.rows||[]).map(r=>({time:r.time||r.ts_date,value:Number(r.value)})).filter(r=>r.time&&Number.isFinite(r.value));
}
function lastOf(key){const rows=rowsOf(key);return rows.length?rows[rows.length-1]:null}
function path(key){const rows=rowsOf(key);if(!rows.length)return[];const from=state.range==="all"?START:state.range==="5"?"2021-01-01":"2024-01-01";const sliced=rows.filter(r=>r.time>=from);if(key==="purchasing"||key==="deposit"||key==="tbill")return toLine(sliced);return rebase(sliced)}
function card(key,cash=false){const last=lastOf(key);const v=last?en(last.value,1):"—";const t=last?last.time:"—";return `<button type="button" class="tile" data-k="${key}"><div class="tile-k">${LABELS[key]}</div><div class="tile-v">${v}</div><div class="tile-t">${t}</div></button>`}
function openDetail(key){const m=META[key];if(!m)return;$("mtitle").textContent=LABELS[key];$("msum").textContent=m.text;$("mmethod").innerHTML=`<a href="${m.href}" target="_blank" rel="noopener">${m.link}</a>`;$("modal").classList.add("on");const host=$("dchart");host.innerHTML="";const c=LightweightCharts.createChart(host,{layout:{background:{color:"#FFFFFF"},textColor:"#4a6b6c",fontFamily:"IBM Plex Sans"},grid:{vertLines:{color:"#E1EFEA"},horzLines:{color:"#E1EFEA"}},rightPriceScale:{borderColor:"#CCE0DC",mode:1},timeScale:{borderColor:"#CCE0DC"},width:host.clientWidth,height:280});const data=path(key);if(data.length){const s=c.addLineSeries({color:COLORS[key],lineWidth:2.3});s.setData(data);c.timeScale().fitContent()}}
function render(){const chart=window.__mapChart;if(!chart)return;Object.values(state.lines).forEach(s=>chart.removeSeries(s));state.lines={};GROUPS[state.group].forEach(key=>{const data=path(key);if(!data.length)return;const s=chart.addLineSeries({color:COLORS[key],lineWidth:2.3,priceLineVisible:false,lastValueVisible:true});s.setData(data);state.lines[key]=s});chart.timeScale().setVisibleRange(visibleRange())}
function visibleRange(){const end="2026-12-31";return state.range==="all"?{from:START,to:end}:state.range==="5"?{from:"2021-01-01",to:end}:{from:"2024-01-01",to:end}}
const chartEl=$("chart"),chart=LightweightCharts.createChart(chartEl,{layout:{background:{color:"#FFFFFF"},textColor:"#4a6b6c",fontFamily:"IBM Plex Sans"},grid:{vertLines:{color:"#E1EFEA"},horzLines:{color:"#E1EFEA"}},rightPriceScale:{borderColor:"#CCE0DC",mode:1},timeScale:{borderColor:"#CCE0DC"}});window.__mapChart=chart;
new ResizeObserver(()=>chart.applyOptions({width:chartEl.clientWidth,height:440})).observe(chartEl);

try{
const packed=await loadEngine();state.series=packed.series;await mountPurchasingAccordion($("pp-root"));
$("assets").innerHTML=["usd_egp_mid","gold_egp_oz","silver_egp_oz","spy_egp","qqq_egp","egx30_close"].map(k=>card(k)).join("");
$("policy").innerHTML=card("purchasing",true)+card("deposit")+card("tbill");
document.querySelectorAll(".tile").forEach(t=>t.onclick=()=>openDetail(t.dataset.k));
$("mclose").onclick=()=>$("modal").classList.remove("on");$("modal").addEventListener("click",e=>{if(e.target.id==="modal")e.currentTarget.classList.remove("on")});
const cash=lastOf("purchasing");if(cash)$("pound").textContent=`100 جنيه نقداً في يناير 2016 أصبحت حوالي ${en(cash.value,1)} جنيهاً من القوة الشرائية في ${cash.time} بسبب التضخم المتراكم.`;
chart.subscribeCrosshairMove(param=>{const tip=$("tip");if(!param.time){tip.style.display="none";return}const rows=Object.entries(state.lines).map(([k,s])=>{const v=param.seriesData.get(s);return v?`<div>${LABELS[k]}: <b>${en(v.value,1)} ج.م</b></div>`:"";}).join("");tip.style.display="block";tip.innerHTML=`<div class="muted">${param.time}</div>${rows}`});
document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".seg button").forEach(x=>x.classList.remove("on"));b.classList.add("on");state.group=b.dataset.g;render()});
document.querySelectorAll(".ranges button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".ranges button").forEach(x=>x.classList.remove("on"));b.classList.add("on");state.range=b.dataset.r;render()});
chart.applyOptions({width:chartEl.clientWidth,height:440});render();
const st=$("mapStatus");if(st){st.textContent="";st.className="";st.hidden=true;}
}catch(err){
const st=$("mapStatus");
if(st){st.className="error-state";st.textContent="تعذر تحميل المسارات: "+(err&&err.message?err.message:String(err));}
console.error(err);
}
