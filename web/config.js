// Public publishable key — safe in the browser.
window.KHATER = {
  url: "https://jlaqotegkeszuyqzdham.supabase.co",
  key: "sb_publishable_QhfpfXkmTOZMZNIF2NJLoQ__ul_nVSK"
};

/* Experience Architecture V1: one navigation contract across legacy shells.
 * This changes presentation/navigation only; it does not touch financial data.
 */
(function(){
  const canonical = [
    ['./index.html','الآن'],
    ['./map.html','قيمة فلوسي'],
    ['./macro.html','الاقتصاد'],
    ['./categories.html','المناطق'],
    ['./funds.html','الصناديق']
  ];
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isFundDetail = path === 'fund.html';
  const isWhy = path === 'why.html';
  const currentKey = isFundDetail ? './funds.html' : `./${path}`;
  function normalize(){
    document.querySelectorAll('.site-header nav').forEach(nav=>{
      const existing = Array.from(nav.querySelectorAll('a'));
      const byHref = new Map(existing.map(a=>[(a.getAttribute('href')||'').replace(/\?.*$/,'').toLowerCase(),a]));
      const frag = document.createDocumentFragment();
      canonical.forEach(([href,label])=>{
        const a = byHref.get(href);
        if(!a)return;
        a.textContent = label;
        a.classList.remove('active');
        a.removeAttribute('aria-current');
        if(href === currentKey){a.classList.add('active');a.setAttribute('aria-current','page');}
        frag.appendChild(a);
      });
      if(isWhy){
        const why = existing.find(a=>(a.getAttribute('href')||'').replace(/\?.*$/,'').toLowerCase()==='./why.html');
        if(why){why.textContent='المنهج';why.classList.add('active');why.setAttribute('aria-current','page');frag.appendChild(why);}
      }
      nav.replaceChildren(frag);
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',normalize,{once:true});
  else normalize();
})();