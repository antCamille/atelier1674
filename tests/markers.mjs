import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {HEAD_HOTSPOTS,connectorPath,markerInViewport} from '../src/head-hotspots.js';
import {cameraAngleAt} from '../src/motion-path.js';
// Build actual mesh geometry directly from local GLB, without browser/GPU.
function meshes(file){const bytes=fs.readFileSync(file),len=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+len).toString()),bin=bytes.subarray(28+len);const types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array};const attr=i=>{const a=gltf.accessors[i],v=gltf.bufferViews[a.bufferView],size=a.type==='VEC3'?3:1,buf=bin.subarray((v.byteOffset||0)+(a.byteOffset||0),(v.byteOffset||0)+(a.byteOffset||0)+a.count*size*types[a.componentType].BYTES_PER_ELEMENT);return new types[a.componentType](Uint8Array.from(buf).buffer);};const group=new THREE.Group();for(const m of gltf.meshes)for(const p of m.primitives){const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(attr(p.attributes.POSITION),3));if(p.indices!==undefined)geom.setIndex(new THREE.BufferAttribute(attr(p.indices),1));group.add(new THREE.Mesh(geom,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})));}group.updateMatrixWorld(true);return group;}
for(const variant of ['','_mobile']){
 const head=meshes(new URL('../dist/assets/barber_head_filled_curls'+variant+'.glb',import.meta.url));
 const ray=new THREE.Raycaster();
 HEAD_HOTSPOTS.forEach((s,i)=>{const a=s.theta*Math.PI/180,n=new THREE.Vector3(Math.sin(a),0,Math.cos(a));ray.set(n.clone().setY(s.y),n.clone().negate());const hit=ray.intersectObject(head,true)[0];assert(hit,`${s.id} misses ${variant} head`);const anchor=hit.point.addScaledVector(n,.004),yaw=cameraAngleAt([.16,.49,.80,1][i]);
 const camera=new THREE.PerspectiveCamera(32,1440/1000,.01,50);camera.position.set(Math.sin(yaw)*1.75,.24,Math.cos(yaw)*1.75);camera.lookAt(0,.03,0);camera.updateMatrixWorld();const p=anchor.clone().project(camera),x=(p.x*.5+.5)*1440,y=(-p.y*.5+.5)*1000;assert(markerInViewport(x,y,p.z,1440,1000),`${s.id} offscreen`);assert(x<1440*.515,`${s.id} covered by desktop panel: ${x}`);console.log(variant||'desktop',s.id,{x:Math.round(x),y:Math.round(y)});});
}
assert.equal(connectorPath(100,200,500,120),'M 100 200 L 135 200 L 475 120 L 500 120');
console.log('Passed actual mesh intersections, all selected pins visible outside panel, reference connector geometry.');
