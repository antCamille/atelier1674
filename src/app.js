import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { experience } from './layout.js';
import { installSkinStudy } from './skin-study.js';
import { selectRenderQuality } from './mobile-quality.js';
import { installEyeRestoration } from './eye-restoration.js';
import { cameraAngleAt } from './motion-path.js';
import { prepareMobileHairGeometry } from './mobile-hair.js';

function initScene(timeoutMs=45000){

const $=s=>document.querySelector(s), clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)}, lerp=(a,b,t)=>a+(b-a)*t;
const main=$('#scene'),app=$('#app'),panel=$('#panel'),connector=$('#connector path'),hotspots=Array.from(document.querySelectorAll('.hotspot'));
const viewport={w:1,h:1,mobile:false,portrait:false,short:false,panelX:0,panelY:0};let lastViewFocus=NaN;
const quality=selectRenderQuality({width:innerWidth,dpr:devicePixelRatio});
let pixelRatio=quality.pixelRatio,pendingPixelRatio=null;
let renderer,skinStudy=null,eyeRestoration=null;
const abortController=new AbortController(),pendingModels=new Set();let stopped=false,loadTimer;
window.previewMetrics=()=>({webglReady:false,note:'No WebGL measurements are available in this viewer.'});
const skinButtons=Array.from(document.querySelectorAll('[data-skin]'));
function selectSkin(enabled){skinStudy?.setEnabled(enabled);eyeRestoration?.setEnabled(enabled);skinButtons.forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.skin==='study')===enabled)));$('#skin-study-state').textContent=enabled?'Restored face selected. Modeled eyes and authored skin materials.':'Original material selected.';$('#credits-dialog').close();experience.repaint();}
skinButtons.forEach(b=>b.addEventListener('click',()=>selectSkin(b.dataset.skin==='study')));
try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});}catch(e){skinButtons.forEach(b=>b.disabled=true);$('#skin-study-state').textContent='Live material switching needs WebGL. The comparison is an offline render.';experience.error('La 3D n’est pas disponible dans ce navigateur. Une image fixe la remplace ; toutes les rubriques restent accessibles.');return;}
renderer.setPixelRatio(pixelRatio);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;main.appendChild(renderer.domElement);
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(32,1,.01,50);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
scene.add(new THREE.HemisphereLight(0xeaf2fc,0x373032,1.1));
for(const [c,i,p] of [[0xf5f2ea,2.2,[2,3,3]],[0xa3c5ff,1.6,[-2,1,-1]],[0xfbe4c6,2.4,[1,2,-2]]]){const l=new THREE.DirectionalLight(c,i);l.position.set(...p);scene.add(l);}
const subject=new THREE.Group();scene.add(subject);
const progressUniform={value:0};let head,clipper,blade,bladeX=0,ready=false,p=0,dragStart=null;
function release(root){root?.traverse(o=>{if(o.isMesh){o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}}});}
function fail(error,message='La 3D n’a pas pu se charger. Une image fixe la remplace ; toutes les rubriques restent accessibles.'){
 if(stopped)return;stopped=true;ready=false;window.previewReady=false;
 clearTimeout(loadTimer);abortController.abort();skinButtons.forEach(b=>b.disabled=true);
 skinStudy?.dispose();eyeRestoration?.dispose();for(const root of pendingModels)if(!root.parent)release(root);pendingModels.clear();release(scene);scene.environment?.dispose();pmrem.dispose();renderer.dispose();
 renderer.domElement.remove();window.previewError=String(error);console.error(error);experience.error(message);
}
loadTimer=setTimeout(()=>fail(new Error('3D startup timed out after 45 seconds'),'La 3D met trop de temps à charger. Toutes les rubriques sont accessibles ; vous pouvez réessayer.'),timeoutMs);
renderer.domElement.addEventListener('webglcontextlost',()=>fail(new Error('WebGL context lost')));
renderer.debug.onShaderError=()=>{throw new Error('The 3D shader could not compile on this device.');};
const perf={frames:0,cpu:new Float32Array(120),intervals:new Float32Array(120),cpuCount:0,intervalCount:0,lastTime:0,wasAnimating:false,windowCount:0,windowTotal:0,qualityDrops:0,lastEpoch:-1};
window.previewMetrics=()=>{const summary=(a,n)=>{const v=Array.from(a.slice(0,Math.min(n,a.length))).sort((a,b)=>a-b);return {samples:v.length,meanMs:v.length?v.reduce((a,b)=>a+b,0)/v.length:null,p95Ms:v.length?v[Math.floor((v.length-1)*.95)]:null};};return {webglReady:ready,renderedFrames:perf.frames,cpuSubmission:summary(perf.cpu,perf.cpuCount),activeFrameIntervals:summary(perf.intervals,perf.intervalCount),pixelRatio,modelVariant:quality.mobile?'mobile':'desktop',adaptiveQualityDrops:perf.qualityDrops,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,note:'Client-side measurements only. CPU submission is not GPU duration; intervals include display scheduling.'};};
// One continuous stroke. The blade, native curls and density backing use
// this same unwrapped-scalp coordinate system and the same progress value.
const STROKE={start:.18,end:.76,theta0:Math.PI*55/180,theta1:Math.PI*115/180,y0:.238,y1:.371,referenceRadius:.225,halfWidth:.047};
const du=STROKE.referenceRadius*(STROKE.theta1-STROKE.theta0),dy=STROKE.y1-STROKE.y0,strokeLength=Math.hypot(du,dy);
const direction={u:du/strokeLength,y:dy/strokeLength};
function shortRadius(theta,y){return 1/Math.sqrt(Math.sin(theta)**2/.200**2+Math.cos(theta)**2/.250**2)-.013*smooth((y-.28)/.13)-.018*Math.cos(theta);}
function hairline(theta){return .232+.025*Math.max(Math.cos(theta),0)-.055*Math.max(-Math.cos(theta),0);}
const hairCode=`
uniform float uProgress;
float shortRadius(float angle,float y){
 float c=cos(angle),s=sin(angle);float t=clamp((y-0.28)/0.13,0.0,1.0);t=t*t*(3.0-2.0*t);
 return inversesqrt(s*s/(0.200*0.200)+c*c/(0.250*0.250))-0.013*t-0.018*c;
}
float hairline(float a){return 0.232+0.025*max(cos(a),0.0)-0.055*max(-cos(a),0.0);}
float shaveMask(vec3 q,float a){
 vec2 delta=vec2((a-${STROKE.theta0})*${STROKE.referenceRadius},q.y-${STROKE.y0});
 vec2 direction=vec2(${direction.u},${direction.y});
 float along=dot(delta,direction);
 float across=abs(dot(delta,vec2(-direction.y,direction.x)));
 float t=clamp((uProgress-${STROKE.start})/${STROKE.end-STROKE.start},0.0,1.0);
 float width=1.0-smoothstep(0.039,0.047,across);
 float behind=1.0-smoothstep(t*${strokeLength}-0.003,t*${strokeLength}+0.002,along);
 float begin=smoothstep(0.0,0.012,along);
 float hair=smoothstep(hairline(a)-0.003,hairline(a)+0.009,q.y);
 return width*behind*begin*hair*step(0.000001,t);
}
`;
function patchMaterial(mat,allHair=false,backing=false,mobileHair=null){
 mat.onBeforeCompile=shader=>{
  shader.uniforms.uProgress=progressUniform;
  shader.vertexShader=(mobileHair?mobileHair.preamble:hairCode)+'\nvarying vec3 vNativePosition; varying float vShaveAmount; varying float vHairAmount;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',mobileHair?mobileHair.normal:`#include <beginnormal_vertex>
   float nativeAngle=atan(position.x,position.z);
   float shaveForNormal=shaveMask(position,nativeAngle);
   vec3 radialNormal=normalize(vec3(position.x,0.0,position.z));
   objectNormal=normalize(mix(objectNormal,radialNormal,shaveForNormal*${backing?0.94:0.82}));`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',mobileHair?mobileHair.vertex:`#include <begin_vertex>
   vNativePosition=position;
   float angle=nativeAngle;float r=length(position.xz);
   vShaveAmount=shaveForNormal;
   vHairAmount=${allHair?'1.0':'smoothstep(hairline(angle)-0.004,hairline(angle)+0.009,position.y)'};
   float shortR=shortRadius(angle,position.y)+0.00065*sin(position.y*1751.0+angle*587.0);
   float targetR=shortR${backing?"-0.001":""}+max(0.0,r-shortR)*0.08;
   float deformedR=mix(r,min(r,targetR),vShaveAmount);
   transformed.xz*=deformedR/max(r,0.00001);`);
  shader.fragmentShader='varying vec3 vNativePosition; varying float vShaveAmount; varying float vHairAmount;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   // The backing and curls share a charcoal material, never a separate gray card.
   vec3 cell=floor(vNativePosition*2100.0);
   float grain=fract(sin(dot(cell,vec3(12.9898,78.233,41.16)))*43758.5453);
   vec3 charcoal=mix(vec3(0.013,0.011,0.010),vec3(0.024,0.020,0.017),grain);
   float stubble=1.0+vShaveAmount*0.12;
   diffuseColor.rgb=mix(diffuseColor.rgb,charcoal*stubble*${backing?'0.72':'1.0'},vHairAmount);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.98,vHairAmount);');
 };
 mat.customProgramCacheKey=()=>(backing?'backing-hair-deform-v5':allHair?'dense-hair-deform-v5':'native-hair-deform-v5')+(mobileHair?'|'+mobileHair.cacheKey:'');
}
function base64Buffer(id){const raw=atob(document.getElementById(id).textContent.trim()),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes.buffer;}
const loader=new GLTFLoader();
const parse=async id=>{
 const el=document.getElementById(id),mobileSource=quality.mobile&&el.dataset.mobileSrc;
 const source=mobileSource||(el.dataset.src&&(quality.assets?.[id]||el.dataset.src));
 let buffer;
 if(source){
  const response=await fetch(source,{signal:abortController.signal});
  if(!response.ok)throw new Error(`Model request failed (${response.status}): ${source}`);
  buffer=await response.arrayBuffer();
 }else buffer=base64Buffer(id);
 if(stopped)throw new Error('Scene loading cancelled');
 const model=await loader.parseAsync(buffer,'');
 if(stopped){release(model.scene);throw new Error('Scene loading cancelled');}
 pendingModels.add(model.scene);return model;
};
Promise.all([parse('head-data'),parse('clipper-data'),parse('density-data')]).then(async([h,c,d])=>{
 if(stopped){[h,c,d].forEach(g=>release(g.scene));return;}
 head=h.scene;head.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.metalness=0;o.material.roughness=.92;o.material.side=THREE.DoubleSide;patchMaterial(o.material,false,false,quality.mobile?prepareMobileHairGeometry(o.geometry,{stroke:STROKE}):null);if(o.name==='geometry_0')skinStudy=installSkinStudy(o.material,{enabled:true,onLoad:()=>experience.repaint()});o.frustumCulled=false;}});subject.add(head);d.scene.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.side=THREE.DoubleSide;o.material.metalness=0;o.material.roughness=.98;const backing=o.name==='Runtime_Hair_Backing';patchMaterial(o.material,true,backing,quality.mobile?prepareMobileHairGeometry(o.geometry,{stroke:STROKE,allHair:true,backing}):null);o.frustumCulled=false;}});subject.add(d.scene);
 clipper=c.scene;clipper.scale.setScalar(2.18);clipper.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.envMapIntensity=1.8;}});subject.add(clipper);blade=clipper.getObjectByName('Moving_Blade');if(blade)bladeX=blade.position.x;
 eyeRestoration=installEyeRestoration(head.getObjectByName('geometry_0'),{enabled:true,onLoad:()=>experience.repaint()});
 await Promise.all([skinStudy?.ready,eyeRestoration.ready]);
 if(stopped)return;
 // Normal first-frame compilation avoids an unbounded KHR_parallel_shader_compile
 // readiness poll on mobile drivers. A successful draw, not a pending compile
 // promise, is the condition for replacing the poster with the live scene.
 // Warm every material, including the particles that first appear mid-cut.
 // Synchronous compile has no asynchronous readiness poll to strand startup.
 const particleVisibility=specks.visible;specks.visible=true;
 renderer.compile(scene,camera);specks.visible=particleVisibility;
 update(experience.progress);
 clearTimeout(loadTimer);pendingModels.clear();
 perf.wasAnimating=false;perf.lastTime=0;perf.lastEpoch=-1;perf.windowCount=0;perf.windowTotal=0;
 ready=true;window.previewReady=true;experience.loaded();experience.subscribe(()=>{if(ready)try{update(experience.progress);}catch(error){fail(error);}});experience.repaint();
}).catch(fail);
const specks=new THREE.InstancedMesh(new THREE.BoxGeometry(.002,.006,.002),new THREE.MeshStandardMaterial({color:0x171719,roughness:1}),72);scene.add(specks);const dummy=new THREE.Object3D();
function pathState(progress){
 const t=clamp((progress-STROKE.start)/(STROKE.end-STROKE.start));
 const theta=lerp(STROKE.theta0,STROKE.theta1,t),y=lerp(STROKE.y0,STROKE.y1,t);
 let lift=0;if(progress<STROKE.start)lift=.26*(1-smooth((progress-.04)/.14));
 if(progress>STROKE.end)lift=.32*smooth((progress-STROKE.end)/.12);
 return {theta,y,lift,t,active:progress>STROKE.start&&progress<STROKE.end};
}
function angleAt(progress){
 return cameraAngleAt(progress);
}
const scratch={n:new THREE.Vector3(),tip:new THREE.Vector3(),around:new THREE.Vector3(),travel:new THREE.Vector3(),z:new THREE.Vector3(),x:new THREE.Vector3(),yy:new THREE.Vector3(),edge:new THREE.Vector3(),project:new THREE.Vector3(),matrix:new THREE.Matrix4()};
const anchors=[[.05,.39,.12],[.22,.30,.03],[.16,.04,.08],[.02,-.18,.22]].map(q=>new THREE.Vector3(...q));
const particleData=Array.from({length:72},(_,i)=>{const seed=Math.sin(i*71.17)*43758.55;return {cos:Math.cos(i*9.1),sin:Math.sin(i*9.1),scale:.5+seed-Math.floor(seed)};});
function update(progress,draw=true){
 const started=performance.now(),moving=!!(experience.isAnimating||experience.isDirectManipulation);
 app.classList.toggle('is-moving',moving);
 const epoch=experience.isDirectManipulation?'touch-'+experience.manipulationEpoch:experience.animationEpoch;
 if(!quality.mobile&&epoch!==perf.lastEpoch){perf.windowCount=0;perf.windowTotal=0;}
 if(draw&&ready&&moving&&perf.wasAnimating&&epoch===perf.lastEpoch&&!document.hidden){const gap=started-perf.lastTime;if(gap>0){perf.intervals[perf.intervalCount++%120]=gap;
  // Mobile input can pause between frames. Only time after a frame was requested
  // (plus the previous CPU submission) is a useful adaptation signal; the gap
  // between two finger events is not a GPU/frame-time measurement.
  const wait=experience.scheduledFrameWait;
  const cost=quality.mobile?(Number.isFinite(wait)?wait+(perf.cpuCount?perf.cpu[(perf.cpuCount-1)%120]:0):0):gap;
  if(cost>0){perf.windowCount++;perf.windowTotal+=Math.min(cost,250);}}}
 perf.wasAnimating=moving;perf.lastTime=started;perf.lastEpoch=epoch;
 if(perf.windowCount>=30||perf.windowTotal>=1500){if(perf.windowTotal/perf.windowCount>24&&pixelRatio>quality.minimumPixelRatio){const next=Math.max(quality.minimumPixelRatio,Math.round((pixelRatio-.15)*100)/100);
  if(quality.mobile)pendingPixelRatio=next;else{pixelRatio=next;renderer.setPixelRatio(pixelRatio);perf.qualityDrops++;}}perf.windowCount=0;perf.windowTotal=0;}
 // Changing resolution reallocates the drawing buffer. On phones do that only
 // after the gesture/navigation settles, never in the middle of a swipe.
 if(quality.mobile&&pendingPixelRatio!==null&&!moving){pixelRatio=pendingPixelRatio;pendingPixelRatio=null;renderer.setPixelRatio(pixelRatio);perf.qualityDrops++;}
 p=clamp(progress);progressUniform.value=p;
 const {theta,y,lift,t,active}=pathState(p),{n,tip,around,travel,z,x,yy,edge,project,matrix}=scratch;
 n.set(Math.sin(theta),0,Math.cos(theta));tip.copy(n).multiplyScalar(shortRadius(theta,y)+.007+lift);tip.y=y;
 around.set(Math.cos(theta),0,-Math.sin(theta));travel.copy(around).multiplyScalar(direction.u);travel.y+=direction.y;travel.normalize();
 z.copy(travel).multiplyScalar(-.965).addScaledVector(n,.26).normalize();x.crossVectors(n,z).normalize();yy.crossVectors(z,x).normalize();
 clipper.quaternion.setFromRotationMatrix(matrix.makeBasis(x,yy,z));
 edge.set(-.00034085,.00190692,-.1013203).multiplyScalar(2.18).applyQuaternion(clipper.quaternion);clipper.position.copy(tip).sub(edge);clipper.visible=p<.91;
 if(blade)blade.position.x=bladeX+.0005*Math.sin(p*2600)*(active?1:0);
 const yaw=angleAt(p)+experience.yaw,{w,h,mobile,portrait,short}=viewport,f=experience.focus;
 const radius=portrait?lerp(3.0,h<=680?4.6:4.2,f):(short?2.5:1.9);
 camera.position.set(Math.sin(yaw)*radius,.24+Math.sin(p*Math.PI)*.09,Math.cos(yaw)*radius);camera.lookAt(0,.03,0);
 if(f!==lastViewFocus){const cx=portrait?lerp(.62,.50,f):lerp(.58,.29,f),cy=portrait?lerp(.58,.18,f):.51;camera.setViewOffset(w,h,(.5-cx)*w,(.5-cy)*h,w,h);lastViewFocus=f;}camera.updateMatrixWorld();
 const section=experience.sectionIndex,transitioning=app.classList.contains('transitioning');let selectedX=0,selectedY=0;
 if(!transitioning)for(let i=0;i<hotspots.length;i++){if(section>0&&i!==section-1)continue;project.copy(anchors[i]).project(camera);const sx=(project.x*.5+.5)*w,sy=(-project.y*.5+.5)*h;hotspots[i].style.transform=`translate3d(${sx-(mobile?22:12)}px,${sy-(mobile?22:23)}px,0)`;hotspots[i].style.visibility=project.z>1?'hidden':'visible';if(i===section-1){selectedX=sx;selectedY=sy;}}
 if(!transitioning&&section>0&&!mobile)connector.setAttribute('d',`M ${selectedX} ${selectedY} L ${viewport.panelX-28} ${selectedY} L ${viewport.panelX} ${viewport.panelY+35}`);else connector.setAttribute('d','');
 specks.visible=active;
 if(active){for(let i=0;i<72;i++){const age=(i/72+t*5)%1,data=particleData[i];dummy.position.copy(tip).addScaledVector(n,age*.15);dummy.position.x+=data.cos*age*.09;dummy.position.y-=age*age*.32;dummy.position.z+=data.sin*age*.09;dummy.rotation.set(i+age*5,age*8,i*.7);dummy.scale.setScalar((1-age)*data.scale);dummy.updateMatrix();specks.setMatrixAt(i,dummy.matrix);}specks.instanceMatrix.needsUpdate=true;}
 if(draw){renderer.render(scene,camera);perf.cpu[perf.cpuCount++%120]=performance.now()-started;perf.frames++;}
 window.previewState={progress:p,cameraAngle:yaw,cutProgress:t,tip:tip.toArray(),strokeLength,revision:'latelier-mobile5',triangles:renderer.info.render.triangles};
 // Bounded DOM diagnostics support read-only browser QA without a debug overlay.
 if(ready&&(!moving||perf.frames%30===0))main.dataset.renderMetrics=JSON.stringify(window.previewMetrics());
}
main.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){dragStart={x:e.clientX,yaw:experience.yaw};main.setPointerCapture(e.pointerId);}});
main.addEventListener('pointermove',e=>{if(dragStart)experience.setYaw(dragStart.yaw+(e.clientX-dragStart.x)*.008);});
main.addEventListener('pointerup',()=>dragStart=null);main.addEventListener('pointercancel',()=>dragStart=null);
function resize(){if(stopped)return;const w=main.clientWidth,h=main.clientHeight;
 // Mobile browser chrome can resize innerHeight while the svh stage stays fixed.
 // Avoid clearing/reallocating an unchanged canvas during those scroll events.
 if(quality.mobile&&w===viewport.w&&h===viewport.h)return;
 Object.assign(viewport,{w,h,mobile:w<=760,portrait:w<=760&&h>480,short:h<=480,panelX:panel.offsetLeft,panelY:panel.offsetTop});lastViewFocus=NaN;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(ready)experience.repaint();}addEventListener('resize',resize);resize();
window.renderAt=value=>{experience.seek(value);experience.repaint();return window.previewState;};window.freezeOrbit=angle=>{experience.setYaw(THREE.MathUtils.degToRad(angle)-angleAt(p));};
}
export function startScene(timeoutMs=45000){
 try{initScene(timeoutMs);}catch(e){console.error(e);experience.error('La scène 3D n’a pas pu démarrer. Toutes les rubriques restent accessibles.');window.previewError=String(e);}
}
