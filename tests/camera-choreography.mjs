import assert from 'node:assert/strict';
import {cameraPoseFor,cameraCoordinates,REFERENCE_POSES,headTargetY} from '../src/camera-choreography.js';
import Motion from '../src/reference-motion.js';
import * as THREE from 'three';
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const mobile of [false,true]){
 const home=cameraPoseFor(0,mobile);
 for(let i=0;i<5;i++){
  const p=cameraPoseFor(i,mobile),ref=REFERENCE_POSES[i];
  near(p.theta,ref.theta);near(p.phi,ref.phi);near(p.y,headTargetY(ref.y));
  near(p.radius,(mobile?(i?5.4:14.6):ref.radius)*.13+(i?(mobile?.65:.45):0));
  const xyz=cameraCoordinates(p);near(Math.hypot(xyz.x,xyz.y-p.y,xyz.z),p.radius);
  const w=mobile?390:1440,h=mobile?844:1000,c=new THREE.PerspectiveCamera(43,w/h,.01,50);
  c.position.set(xyz.x,xyz.y,xyz.z);c.lookAt(0,p.y,0);c.setViewOffset(w,h,p.sx*w/2,-p.sy*h/2,w,h);c.updateMatrixWorld();
  const target=new THREE.Vector3(0,p.y,0).project(c);near((target.x+1)/2,(1-p.sx)/2);near((1-target.y)/2,(1+p.sy)/2);
 }
 const m=new Motion.Controller(home);m.retarget(cameraPoseFor(1,mobile));for(let k=0;k<18;k++)m.step(1/60);
 for(const axis of ['theta','phi','radius','y','sx',...(mobile?['sy']:[])])assert.notEqual(m.pose[axis],home[axis],`axis ${axis} did not move`);
 const before=m.snapshot();m.retarget(cameraPoseFor(3,mobile));for(const k of Motion.KEYS)for(const key of ['x','v','a'])near(m.snapshot()[k][key],before[k][key]);
 for(let n=0;n<600;n++)m.step(1/60);assert(!m.active);for(const k of Motion.KEYS)near(m.pose[k],cameraPoseFor(3,mobile)[k]);
 m.reset(home);assert(!m.active);near(m.pose.radius,home.radius);
}
console.log('PASS: authored angles/elevation, v11 overview/targets/offsets with focused-only retreat, projection signs, all moving axes, continuous interruptions, settle and reset.');
