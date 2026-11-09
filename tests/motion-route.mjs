import assert from 'node:assert/strict';
import Motion from '../src/reference-motion.js';
import {buildNativeScrollRoute,nativeScrollStateAt,nativeScrollOffsetFor} from '../src/native-mobile-scroll.js';
const pose=(p,f)=>({theta:0,phi:0,radius:1,y:p,sx:f,sy:0});
const m=new Motion.Controller(pose(0,0));m.retarget(pose(.49,1));
for(let i=0;i<15;i++)m.step(1/60);
assert(m.active);const prior=m.snapshot();m.retarget(pose(.8,1));const after=m.snapshot();
for(const k of Motion.KEYS){assert.equal(prior[k].x,after[k].x);assert.equal(prior[k].v,after[k].v);assert.equal(prior[k].a,after[k].a);}
for(let i=0;i<600;i++)m.step(1/60);assert(!m.active);assert.equal(m.pose.y,.8);
for(const stageHeight of [390,844,1000]){
 const route=buildNativeScrollRoute({edges:[0,.07,.28,.66,.9,1],stageHeight,contentHeight:stageHeight*.65,overflows:[0,1400,2300,450,300]});
 for(const seg of route.segments){
  const start=nativeScrollOffsetFor(route,seg.lo,seg.index);assert.equal(nativeScrollStateAt(route,start).index,seg.index);
  assert.equal(nativeScrollStateAt(route,start+seg.travel*.5).panelTop,0);
  assert.equal(nativeScrollStateAt(route,seg.end-.001).panelTop,seg.overflow);
 }
}
console.log('Passed: derivative-preserving interrupted motion, exact settle, native route dimensions, travel-before-reading, complete content reachability.');
