import {chapters} from './business-content.js';
import Motion from './reference-motion.js';
import {createNativeMobileScroll} from './native-mobile-scroll.js';
const $=s=>document.querySelector(s),app=$('#app'),panel=$('#panel'),content=$('#section-content');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let nativeScroll=null;
let reduced=motionPreference.matches,value=0,active=-1,yaw=0,focusMix=0,callback=()=>{},frameId=null,last=0,animationEpoch=0;
const pose=(p,f)=>({theta:0,phi:0,radius:1,y:p,sx:f,sy:0});
const motion=new Motion.Controller(pose(0,0));
function chapterAt(p){return p<.07?0:p<.28?1:p<.66?2:p<.9?3:4;}
function setMenu(open){nativeScroll?.setLocked(open);app.classList.toggle('menu-open',open);$('.menu-toggle').setAttribute('aria-expanded',String(open));$('.menu-toggle').setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');}
function syncVisibility(){const show=active>0&&!motion.active;app.classList.toggle('panel-visible',show);app.classList.toggle('transitioning',motion.active);panel.inert=!show;panel.setAttribute('aria-hidden',String(!show));}
function renderUI(){$('#scrub').value=Math.round(value*1000);$('#percent').textContent=Math.round(value*100)+'%';app.style.setProperty('--progress',value);syncVisibility();}
function setChapter(index,hashMode='replace'){
 if(index===active)return;active=index;const c=chapters[index];
 app.classList.toggle('focused',index>0);$('#home-content').inert=index>0;$('#home-content').setAttribute('aria-hidden',String(index>0));
 if(index){content.innerHTML=c.body;content.scrollTop=0;$('#panel-label').textContent=c.label;$('.section-number').textContent=String(index).padStart(2,'0');$('.big-index').textContent=String(index).padStart(2,'0');$('.location-name').innerHTML=c.place+'<br>'+c.label;}
 document.querySelectorAll('[data-section]').forEach(e=>{const on=e.dataset.section===c.id;if(on)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');if(e.classList.contains('hotspot'))e.classList.toggle('selected',on);});
 $('#prev').disabled=index===0;$('#next').disabled=index===4;
 if(hashMode&&location.hash!=='#'+c.id)history[hashMode==='push'?'pushState':'replaceState']({chapter:c.id},'', '#'+c.id);
}
function invalidate(){if(frameId===null&&!document.hidden){last=performance.now();frameId=requestAnimationFrame(frame);}}
function frame(now){frameId=null;const state=nativeScroll?.consume();if(state){if(state.index!==active){setChapter(state.index);const target=pose(chapters[state.index].p,state.index>0?1:0);if(reduced)motion.reset(target);else motion.retarget(target);animationEpoch++;}content.scrollTop=state.panelTop;}const dt=Math.max(0,(now-last)/1000);last=now;const current=motion.step(dt);value=clamp(current.y);focusMix=clamp(current.sx);renderUI();callback(value,focusMix,yaw);if(motion.active)frameId=requestAnimationFrame(frame);else $('#status').textContent=chapters[active].label+'. Contenu disponible.';}
function seek(p,{animate=false,index=null,hashMode='replace'}={}){p=clamp(p);const ix=index===null?chapterAt(p):index;const target=pose(p,ix>0?1:0);nativeScroll?.seek(p,ix,{smooth:false});setChapter(ix,hashMode);if(animate&&!reduced)motion.retarget(target);else{motion.reset(target);value=p;focusMix=ix>0?1:0;}animationEpoch++;renderUI();invalidate();}
function go(index,hashMode='push'){index=clamp(index,0,4);setMenu(false);if(index===active)return;seek(chapters[index].p,{animate:true,index,hashMode});}
function stopMotion(){if(motion.active){const end=pose(chapters[active].p,active>0?1:0);motion.reset(end);value=end.y;focusMix=end.sx;renderUI();invalidate();}}
function clearTouch(){}
app.addEventListener('click',e=>{const jump=e.target.closest('[data-barber-jump]');if(jump){go(2);selectBarber(jump.dataset.barberJump);return;}const tab=e.target.closest('[data-barber]');if(tab){selectBarber(tab.dataset.barber);return;}const b=e.target.closest('[data-section]');if(b){e.preventDefault();go(chapters.findIndex(c=>c.id===b.dataset.section));return;}if(e.target.closest('[data-action="orbit"]')){yaw+=Math.PI/4;invalidate();}});
nativeScroll=createNativeMobileScroll({app,panel,content,chapters,edges:[0,.07,.28,.66,.9,1],onInput:invalidate});
$('#scrub').addEventListener('input',e=>seek(+e.target.value/1000));$('#prev').addEventListener('click',()=>go(active-1));$('#next').addEventListener('click',()=>go(active+1));$('.menu-toggle').addEventListener('click',()=>setMenu(!app.classList.contains('menu-open')));
$('.skip-link').addEventListener('click',e=>{e.preventDefault();seek(chapters[Math.max(1,active)].p,{index:Math.max(1,active)});content.focus({preventScroll:true});});
$('#credits-open').addEventListener('click',()=>{stopMotion();$('#credits-dialog').showModal();});$('#credits-close').addEventListener('click',()=>$('#credits-dialog').close());$('#dismiss-error').addEventListener('click',()=>$('#error-banner').hidden=true);
addEventListener('keydown',e=>{if(e.defaultPrevented||e.target.closest('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;if(e.key==='Escape'){if(app.classList.contains('menu-open'))setMenu(false);else go(0);return;}if(e.target.closest('.panel-scroll')&&['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key))return;const next=['ArrowDown','ArrowRight','PageDown'].includes(e.key),prev=['ArrowUp','ArrowLeft','PageUp'].includes(e.key);if(next||prev){e.preventDefault();go(active+(next?1:-1));}else if(e.key==='Home'){e.preventDefault();go(0);}else if(e.key==='End'){e.preventDefault();go(4);}});
function fromHash(){const ix=chapters.findIndex(c=>'#'+c.id===location.hash);go(ix<0?0:ix,null);}
addEventListener('popstate',fromHash);addEventListener('hashchange',fromHash);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameId);frameId=null;}else invalidate();});
motionPreference.addEventListener?.('change',e=>{reduced=e.matches;if(reduced)stopMotion();});
const initial=chapters.findIndex(c=>'#'+c.id===location.hash);seek(chapters[Math.max(0,initial)].p,{index:Math.max(0,initial),hashMode:null});
export const experience={get scheduledFrameWait(){return 0;},get isDirectManipulation(){return false;},get manipulationEpoch(){return animationEpoch;},get animationEpoch(){return animationEpoch;},get isAnimating(){return motion.active;},repaint:invalidate,get progress(){return value;},get sectionIndex(){return active;},get focus(){return focusMix;},get yaw(){return yaw;},subscribe(fn){callback=fn;fn(value,focusMix,yaw);},seek,go,orbit(delta){yaw+=delta;invalidate();},setYaw(v){yaw=v;invalidate();},reveal(){$('#loading').classList.add('done');setTimeout(()=>$('#loading').hidden=true,450);},pending(){app.classList.add('no-webgl');app.classList.add('loading-3d');$('#scene-status').hidden=false;this.reveal();},loaded(){app.classList.remove('no-webgl');app.classList.remove('loading-3d');$('#scene-status').hidden=true;$('#error-banner').hidden=true;this.reveal();},error(message){app.classList.add('no-webgl');app.classList.remove('loading-3d');$('#scene-status').hidden=true;$('#error-message').textContent=message;$('#error-banner').hidden=false;this.reveal();},chapters};
window.seekPreview=p=>seek(p);window.previewUI=()=>({progress:value,chapter:chapters[active].id,focused:active>0,menuOpen:app.classList.contains('menu-open'),transitioning:motion.active,panelVisible:app.classList.contains('panel-visible'),layoutRevision:9});
function selectBarber(id){
 content.querySelectorAll('[data-barber]').forEach(b=>{const on=b.dataset.barber===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
 content.querySelectorAll('.portfolio-group').forEach(p=>p.hidden=p.id!=='works-'+id);
}
app.addEventListener('keydown',e=>{
 const tab=e.target.closest('[data-barber]');if(!tab)return;
 if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
 e.preventDefault();e.stopPropagation();const list=Array.from(content.querySelectorAll('[data-barber]'));const i=(list.indexOf(tab)+(e.key==='ArrowRight'?1:list.length-1))%list.length;selectBarber(list[i].dataset.barber);list[i].focus();
});
const photoDialog=document.querySelector('#photo-dialog');
app.addEventListener('click',e=>{const b=e.target.closest('[data-photo]');if(!b)return;stopMotion();clearTouch();photoDialog.querySelector('img').src=b.dataset.photo;photoDialog.querySelector('img').alt=b.dataset.caption;photoDialog.querySelector('figcaption').textContent=b.dataset.caption;photoDialog.showModal();});
document.querySelector('#photo-close').addEventListener('click',()=>photoDialog.close());
photoDialog.addEventListener('click',e=>{if(e.target===photoDialog)photoDialog.close();});
