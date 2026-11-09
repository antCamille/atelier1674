import { Group, Mesh, SphereGeometry, BufferGeometry, Float32BufferAttribute, MeshPhysicalMaterial, TextureLoader, DataTexture, SRGBColorSpace } from 'three';
// Additive anatomical replacement; source mesh and source assets are never modified.
// Units are original glTF/native coordinates, measured by ray casting the approved sculpt.
export const EYE_FITS = [
  { x: -.083, y: .071, z: .208, width: .034, top: .0072, bottom: .0054 },
  { x: .101, y: .071, z: .208, width: .034, top: .0072, bottom: .0054 }
];
function cap(radius, lift = 0) {
  const p=[],uv=[],ix=[],rings=6,segs=48;
  for(let j=0;j<=rings;j++)for(let i=0;i<=segs;i++){
    const r=radius*j/rings,a=i/segs*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r;
    // Same ellipsoid as globe: iris is embedded, not a disk standing proud of lids.
    const z=.029*Math.sqrt(Math.max(0,1-(x/.038)**2-(y/.028)**2))+lift;
    p.push(x,y,z);uv.push(x/(2*radius)+.5,y/(2*radius)+.5);
    if(j<rings&&i<segs){const k=j*(segs+1)+i;ix.push(k,k+segs+1,k+1,k+1,k+segs+1,k+segs+2);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function installEyeRestoration(headMesh, { enabled=true, onLoad=()=>{}, textures=null }={}) {
  if(!headMesh?.isMesh||Array.isArray(headMesh.material))throw new TypeError('Pass the native geometry_0 mesh with its patched material.');
  const material=headMesh.material, previousCompile=material.onBeforeCompile, previousKey=material.customProgramCacheKey;
  const amount={value:enabled?1:0};let disposed=false;
  const root=new Group();root.name='Anatomical_Eyes';root.visible=enabled;headMesh.add(root);
  const ownedTextures=[];const pending=[];
  function loadTexture(kind,url,pixel) {
    if(textures?.[kind])return textures[kind];
    let texture;
    if(typeof document==='undefined') texture=new DataTexture(new Uint8Array([...pixel,255]),1,1);
    else pending.push(new Promise((resolve,reject)=>{
      texture=new TextureLoader().load(url,()=>{onLoad();resolve();},undefined,reject);
    }));
    texture.colorSpace=SRGBColorSpace;texture.needsUpdate=true;ownedTextures.push(texture);return texture;
  }
  const irisTexture=loadTexture('iris','./assets/anatomical-eyes-iris.png',[30,19,11]);
  const scleraTexture=loadTexture('sclera','./assets/anatomical-eyes-sclera.png',[83,77,67]);
  const ready=Promise.all(pending);
  const scleraMaterial=new MeshPhysicalMaterial({map:scleraTexture,roughness:.48,metalness:0,specularIntensity:.15,clearcoat:0,clearcoatRoughness:.28});
  const irisMaterial=new MeshPhysicalMaterial({map:irisTexture,roughness:.55,metalness:0,specularIntensity:.08,clearcoat:0,clearcoatRoughness:.2});
  const corneaMaterial=new MeshPhysicalMaterial({color:0x15110d,transparent:true,opacity:.10,roughness:.08,metalness:0,specularIntensity:.6,clearcoat:.35,clearcoatRoughness:.08,depthWrite:false});
  // Clip the globe itself to the surgical aperture too: no sclera can peek beneath
  // the original lower lid in an oblique view or where the scan has tiny defects.
  for(const [m,sx,sy] of [[scleraMaterial,.038,.028],[irisMaterial,1,1],[corneaMaterial,1,1]]) {
    m.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 vEyeAperture;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvEyeAperture=position.xy*vec2(${sx.toFixed(3)},${sy.toFixed(3)});`);
      shader.fragmentShader='varying vec2 vEyeAperture;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
        float ex=abs(vEyeAperture.x)/0.034;
        float ey=vEyeAperture.y;
        float eh=(ey>0.0?0.0072:0.0054)*pow(max(0.0,1.0-ex*ex),0.70);
        if(ex>=1.0||abs(ey)>=eh)discard;
      `);
    };
    m.customProgramCacheKey=()=>`eye-aperture-${sx}-${sy}`;
  }
  const globeGeometry=new SphereGeometry(1,40,24);const pos=globeGeometry.attributes.position,uv=globeGeometry.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)*.5+.5,pos.getY(i)*.5+.5);
  const irisGeometry=cap(.0145,.00012),corneaGeometry=cap(.0146,.00038);
  for(const fit of EYE_FITS){
    const socket=new Group();socket.position.set(fit.x,fit.y,fit.z);root.add(socket);
    const globe=new Mesh(globeGeometry,scleraMaterial);globe.scale.set(.038,.028,.029);globe.name='Recessed_Sclera';socket.add(globe);
    const iris=new Mesh(irisGeometry,irisMaterial);iris.name='Curved_Iris_And_Pupil';socket.add(iris);
    const cornea=new Mesh(corneaGeometry,corneaMaterial);cornea.name='Corneal_Surface';socket.add(cornea);
  }
  material.onBeforeCompile=function(shader,renderer){
    previousCompile.call(this,shader,renderer);
    shader.uniforms.uAnatomicalEyes=amount;
    shader.vertexShader='varying vec3 vEyeNativePosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeNativePosition=position;');
    shader.fragmentShader='uniform float uAnatomicalEyes; varying vec3 vEyeNativePosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      vec3 ep=vEyeNativePosition;
      float ex=min(abs(ep.x+0.083),abs(ep.x-0.101))/0.034;
      float ey=ep.y-0.071;
      float eh=(ey>0.0?0.0072:0.0054)*pow(max(0.0,1.0-ex*ex),0.70);
      if(uAnatomicalEyes>0.5 && ep.z>0.205 && ex<1.0 && abs(ey)<eh) discard;
    `);
  };
  material.customProgramCacheKey=function(){return previousKey.call(this)+'|anatomical-eyes-v7';};material.needsUpdate=true;
  return {root,ready,setEnabled(value){amount.value=value?1:0;root.visible=!!value;},dispose(){if(disposed)return;disposed=true;root.removeFromParent();[globeGeometry,irisGeometry,corneaGeometry].forEach(g=>g.dispose());[scleraMaterial,irisMaterial,corneaMaterial].forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());material.onBeforeCompile=previousCompile;material.customProgramCacheKey=previousKey;material.needsUpdate=true;}};
}
