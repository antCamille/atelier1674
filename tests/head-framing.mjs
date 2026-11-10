import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {cameraPoseFor,cameraCoordinates,REFERENCE_POSES,headTargetY} from '../src/camera-choreography.js';
import Motion from '../src/reference-motion.js';
import {HEAD_HOTSPOTS} from '../src/head-hotspots.js';
const points=[],surfaces=[];
for(const file of ['barber_head_filled_curls.glb','barber_head_filled_curls_mobile.glb']){
 const b=fs.readFileSync(new URL(`../dist/assets/${file}`,import.meta.url)),len=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+len)),bin=b.subarray(28+len);
 const vertices=[],group=new T.Group();
 for(const mesh of j.meshes)for(const p of mesh.primitives){
  const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView],base=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12;
  const positions=[];for(let n=0;n<a.count;n++){const o=base+n*stride;const v=new T.Vector3(bin.readFloatLE(o),bin.readFloatLE(o+4),bin.readFloatLE(o+8));vertices.push(v);positions.push(...v);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  if(p.indices!==undefined){const ia=j.accessors[p.indices],iv=j.bufferViews[ia.bufferView],o=(iv.byteOffset||0)+(ia.byteOffset||0),size=ia.componentType===5125?4:2;g.setIndex(Array.from({length:ia.count},(_,i)=>size===4?bin.readUInt32LE(o+i*size):bin.readUInt16LE(o+i*size)));}
  group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));
 }
 points.push(vertices);group.updateMatrixWorld(true);surfaces.push(group);
}
for(const [w,h] of [[1440,1000],[1024,768],[390,844],[360,640],[320,740],[844,390]]){
 const mobile=w<=760,vertices=points[mobile?1:0];
 function bounds(p,all=true){
  const c=new T.PerspectiveCamera(43,w/h,.01,50),xyz=cameraCoordinates(p);c.position.set(xyz.x,xyz.y,xyz.z);c.lookAt(0,p.y,0);c.setViewOffset(w,h,p.sx*w/2,-p.sy*h/2,w,h);c.updateMatrixWorld();
  let minX=1,maxX=0,minY=1,maxY=0;
  for(let n=0;n<vertices.length;n+=all?1:100){const v=vertices[n].clone().project(c),x=(v.x+1)/2,y=(1-v.y)/2;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);assert(v.z>-1&&v.z<1);}
  // Cinematic cropping is intentional; only near-plane clipping is forbidden.
  return {minX,maxX,minY,maxY};
 }
 for(let i=0;i<5;i++){
  const p=cameraPoseFor(i,mobile,w/h),current=bounds(p);console.log(w,h,i,current);
  const ref=REFERENCE_POSES[i],old={...ref,radius:(mobile?(i?5.4:14.6):ref.radius)*.13,y:headTargetY(ref.y),sx:mobile?(i?-.04:-.4):ref.sx,sy:mobile?(i?-.46:.15):ref.sy},before=bounds(old);
  const height=current.maxY-current.minY,oldHeight=before.maxY-before.minY;
  if(i){assert(height<oldHeight*.85,'insufficient close-up reduction');assert(height>.65,'head became too small');}
  else assert(Math.abs(height-oldHeight)<1e-10,'overview changed');
  const xyz=cameraCoordinates(p),c=new T.PerspectiveCamera(43,w/h,.01,50);c.position.set(xyz.x,xyz.y,xyz.z);c.lookAt(0,p.y,0);c.setViewOffset(w,h,p.sx*w/2,-p.sy*h/2,w,h);c.updateMatrixWorld();
  for(let k=0;k<4;k++){
   if(i&&k!==i-1)continue;const hp=HEAD_HOTSPOTS[k],t=hp.theta*Math.PI/180,origin=new T.Vector3(Math.sin(t),hp.y,Math.cos(t)),direction=new T.Vector3(-Math.sin(t),0,-Math.cos(t));
   const hit=new T.Raycaster(origin,direction).intersectObject(surfaces[mobile?1:0],true)[0];assert(hit,'missing head anchor');const v=hit.point.clone().addScaledVector(direction,-.004).project(c),x=(v.x+1)*w/2,y=(1-v.y)*h/2;
   assert(x>15&&x<w-18&&y>60&&y<h-60,'marker outside viewport');if(i&&!mobile)assert(x+12<w*(h<500?.40:.515),'marker behind desktop panel');
  }
 }
 for(let a=0;a<5;a++)for(let b=0;b<5;b++){
  const m=new Motion.Controller(cameraPoseFor(a,mobile,w/h));m.retarget(cameraPoseFor(b,mobile,w/h));
  for(let f=0;f<180;f++){m.step(1/60);if(f%12===0)bounds(m.pose,false);}
 }
}
console.log('PASS both actual head meshes, six viewports, every settled pose and all 25 transition routes: original overview preserved; focused head stays large with reduced close-up; no near-plane clipping; markers clear.');
