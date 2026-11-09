// Derived assets keep the desktop originals and continuous hair backing intact.
// Selection is fixed at startup, so rotation/resizing cannot trigger asset reloads.
export function selectRenderQuality({width=globalThis.innerWidth||1024,coarse=globalThis.matchMedia?.('(pointer: coarse)').matches||false,dpr=globalThis.devicePixelRatio||1}={}){
 const mobile=width<=760||coarse;
 return Object.freeze({mobile,pixelRatio:Math.min(dpr,mobile?1:1.5),minimumPixelRatio:mobile?.8:1,assets:mobile?Object.freeze({'head-data':'./assets/barber_head_filled_curls_mobile.glb','density-data':'./assets/runtime_hair_coverage_mobile.glb','clipper-data':'./assets/hair_clipper_web_mobile.glb'}):null});
}
