// Public publishable key — safe in the browser.
window.KHATER = {
  url: "https://jlaqotegkeszuyqzdham.supabase.co",
  key: "sb_publishable_QhfpfXkmTOZMZNIF2NJLoQ__ul_nVSK"
};

(function(){
  const canonical=[['./index.html','الآن'],['./map.html','قيمة فلوسي'],['./macro.html','الاقتصاد'],['./categories.html','المناطق'],['./funds.html','الصناديق']];
  const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const currentKey=path==='fund.html'?'./funds.html':`./${path}`;
  function normalize(){
    document.querySelectorAll('.site-header nav').forEach(nav=>{
      const existing=Array.from(nav.querySelectorAll('a'));
      const byHref=new Map(existing.map(a=>[(a.getAttribute('href')||'').replace(/\?.*$/,'').toLowerCase(),a]));
      const frag=document.createDocumentFragment();
      canonical.forEach(([href,label])=>{const a=byHref.get(href);if(!a)return;a.textContent=label;a.classList.remove('active');a.removeAttribute('aria-current');if(href===currentKey){a.classList.add('active');a.setAttribute('aria-current','page')}frag.appendChild(a)});
      nav.replaceChildren(frag);
    });
  }
  function activateV2(){
    if(path!=='index.html')return;
    const css=document.createElement('link');css.rel='stylesheet';css.href='css/experience-v2-terminal.css';document.head.appendChild(css);
    const script=document.createElement('script');script.src='js/experience-v2-terminal.js';script.defer=true;document.head.appendChild(script);
    document.body.classList.add('experience-v2');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{normalize();activateV2()},{once:true});
  else{normalize();activateV2()}
})();