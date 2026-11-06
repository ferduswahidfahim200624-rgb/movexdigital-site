(function(){
  const header=document.getElementById('movex-global-header'); if(!header) return;
  const nav=header.querySelector('.nav'); const toggle=header.querySelector('.toggle'); const group=header.querySelector('.nav-group'); const groupLink=group&&group.querySelector(':scope > a');
  const legacy=header.dataset.navMode||'';
  if(toggle&&legacy==='') toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation')});
  if(groupLink&&legacy!=='legacy-full') groupLink.addEventListener('click',e=>{if(window.matchMedia('(max-width:760px)').matches&&!group.classList.contains('open')){e.preventDefault();group.classList.add('open');groupLink.setAttribute('aria-expanded','true')}});
  if(nav&&legacy==='') nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{if(a.closest('.menu'))return;nav.classList.remove('open');toggle&&toggle.setAttribute('aria-expanded','false');group&&group.classList.remove('open')}));
  const path=location.pathname.split('/').pop()||'index.html'; const hash=location.hash;
  header.querySelectorAll('.nav a').forEach(a=>{const u=new URL(a.href,location.href);if((u.pathname.split('/').pop()||'index.html')===path&&u.hash===hash&&a.getAttribute('href')!=='#')a.setAttribute('aria-current','page')});
})();
