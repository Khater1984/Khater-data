import { toLine, rebase, en } from "./engine.js";
import { loadEngine } from "./live.js";
import { mountPurchasingAccordion } from "./accordion.js";

function seriesColors(){var t=window.KHATER_THEME&&window.KHATER_THEME.series||{};return{
purchasing:t.purchasing||"#c73538",usd_egp_mid:t.usd_egp_mid||"#087f63",gold_egp_oz:t.gold_egp_oz||"#a9652b",
silver_egp_oz:t.silver_egp_oz||"#607477",qqq_egp:t.qqq_egp||"#3d6b8a",spy_egp:t.spy_egp||"#087f63",
egx30_close:t.egx30_close||"#087f63",deposit:t.deposit||"#9a7112",tbill:t.tbill||"#087f63"
};}
const COLORS=new Proxy({},{get:function(_,k){return seriesColors()[k];}});
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
 tbill:{text:"أذون الخزانة كمرجع نقدي قصير الأجل بنفس منطق العائد التراكمي.",href:"https://www.cbe.org.eg/en/economic-research/statistics/interest-rates",link:"أسعار العائد — البنك المركزي"}
};
const START="2016-01-01";
const state={group:"cash",range:"all",series:{},lines:{}};
const $=id=>document.getElementById(id);
function lastOf(k){const s=state.series[k];return s&&s.length?s[s.length-1]:null;}
function render(){
 Object.values(state.lines).forEach(s=>chart.removeSeries(s));state.lines={};
 const keys=state.group==="cash"?["purchasing","deposit","tbill"]:state.group==="fx"?["usd_egp_mid","gold_egp_oz","silver_egp_oz"]:["egx30_close","spy_egp","qqq_egp"];
 const vr=visibleRange();
 keys.forEach(k=>{
  const raw=state.series[k];if(!raw||!raw.length)return;
  const data=rebase(toLine(raw),START).filter(p=>p.time>=vr.from&&p.time<=vr.to);
  if(!data.length)return;
  const s=chart.addLineSeries({color:COLORS[k],lineWidth:2,title:LABELS[k]});
  s.setData(data);state.lines[k]=s;
 });
 chart.timeScale().fitContent();
}
function visibleRange(){const end="2026-12-31";return state.range==="all"?{from:START,to:end}:state.range==="5"?{from:"2021-01-01",to:end}:{from:"2024-01-01",to:end}}

const chartEl=$("chart");
const chart=LightweightCharts.createChart(chartEl,{layout:(window.KHATER_THEME&&window.KHATER_THEME.chartLayout&&window.KHATER_THEME.chartLayout())||{background:{color:"#fff"},textColor:"#607477",fontFamily:"Cairo, sans-serif"},grid:(window.KHATER_THEME&&window.KHATER_THEME.chartGrid&&window.KHATER_THEME.chartGrid())||{vertLines:{color:"#f8fafb"},horzLines:{color:"#f8fafb"}},rightPriceScale:{borderColor:(window.KHATER_THEME&&window.KHATER_THEME.chartBorder)||"#d9e2e1",mode:1},timeScale:{borderColor:(window.KHATER_THEME&&window.KHATER_THEME.chartBorder)||"#d9e2e1"}});
window.__mapChart=chart;
new ResizeObserver(()=>chart.applyOptions({width:chartEl.clientWidth,height:440})).observe(chartEl);

try{
 const packed=await loadEngine();state.series=packed.series;await mountPurchasingAccordion($("pp-root"));
 const cash=lastOf("purchasing");
 if(cash)$("pound").textContent=`100 جنيه نقداً في يناير 2016 أصبحت حوالي ${en(cash.value,1)} جنيهاً من القوة الشرائية في ${cash.time} بسبب التضخم المتراكم.`;
 chart.subscribeCrosshairMove(param=>{
  const tip=$("tip");
  if(!param.time){tip.style.display="none";return}
  const rows=Object.entries(state.lines).map(([k,s])=>{const v=param.seriesData.get(s);return v?`<div>${LABELS[k]}: <b>${en(v.value,1)} ج.م</b></div>`:"";}).join("");
  tip.style.display="block";tip.innerHTML=`<div class="muted">${param.time}</div>${rows}`;
 });
 document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".seg button").forEach(x=>x.classList.remove("on"));b.classList.add("on");state.group=b.dataset.g;render()});
 document.querySelectorAll(".ranges button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".ranges button").forEach(x=>x.classList.remove("on"));b.classList.add("on");state.range=b.dataset.r;render()});
 $("mclose").onclick=()=>$("modal").classList.remove("on");
 $("modal").addEventListener("click",e=>{if(e.target.id==="modal")e.currentTarget.classList.remove("on")});
 chart.applyOptions({width:chartEl.clientWidth,height:440});render();
 const st=$("mapStatus");if(st){st.textContent="";st.className="";st.hidden=true;}
}catch(err){
 const st=$("mapStatus");
 if(st){st.className="error-state";st.textContent="تعذر تحميل المسارات: "+(err&&err.message?err.message:String(err));}
 console.error(err);
}
