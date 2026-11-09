import { BufferAttribute } from 'three';

// These four values depend only on the authored vertex and stroke, not progress.
// One additional vec4 attribute stays well inside WebGL2's 16-slot minimum.
// Source position/normal/UV/index buffers and all fragment shaders stay intact.
export const MOBILE_HAIR_ATTRIBUTE = 'aMobileHair';
const prepared = new WeakMap();
const clamp = value => Math.max(0, Math.min(1, value));
const smoothstep = (low, high, value) => {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
};

export function prepareMobileHairGeometry(geometry, { stroke, allHair = false, backing = false }) {
  const position = geometry.getAttribute('position');
  const key = JSON.stringify([stroke, allHair, backing]);
  const cached = prepared.get(geometry);
  if (cached?.key === key && geometry.getAttribute(MOBILE_HAIR_ATTRIBUTE) === cached.attribute) return cached.shader;
  // Unsupported geometry retains the original shader rather than risking a draw
  // failure. The original radius safeguard is retained for axis-adjacent meshes.
  const slots = Object.entries(geometry.attributes).reduce((sum, [name, attribute]) =>
    sum + (name === MOBILE_HAIR_ATTRIBUTE ? 0 : Math.ceil(attribute.itemSize / 4)), 0);
  if (!position || position.itemSize !== 3 || slots + 1 > 16) return null;
  const du = stroke.referenceRadius * (stroke.theta1 - stroke.theta0);
  const dy = stroke.y1 - stroke.y0, length = Math.hypot(du, dy);
  const directionU = du / length, directionY = dy / length;
  const values = new Float32Array(position.count * 4);
  let needsRadiusGuard = false;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const angle = Math.atan2(x, z), radius = Math.hypot(x, z);
    if (!Number.isFinite(radius) || !Number.isFinite(y)) return null;
    if (radius < .00001) needsRadiusGuard = true;
    const c = Math.cos(angle), s = Math.sin(angle);
    const hairline = .232 + .025 * Math.max(c, 0) - .055 * Math.max(-c, 0);
    const deltaU = (angle - stroke.theta0) * stroke.referenceRadius, deltaY = y - stroke.y0;
    const along = deltaU * directionU + deltaY * directionY;
    const across = Math.abs(deltaU * -directionY + deltaY * directionU);
    const staticMask = (1 - smoothstep(.039, .047, across)) * smoothstep(0, .012, along)
      * smoothstep(hairline - .003, hairline + .009, y);
    const shortRadius = 1 / Math.sqrt(s * s / (.200 * .200) + c * c / (.250 * .250))
      - .013 * smoothstep(.28, .41, y) - .018 * c + .00065 * Math.sin(y * 1751 + angle * 587);
    const targetRadius = shortRadius - (backing ? .001 : 0) + Math.max(0, radius - shortRadius) * .08;
    const offset = i * 4;
    values[offset] = along;
    values[offset + 1] = staticMask;
    values[offset + 2] = (Math.min(radius, targetRadius) - radius) / Math.max(radius, .00001);
    values[offset + 3] = allHair ? 1 : smoothstep(hairline - .004, hairline + .009, y);
    if (!Number.isFinite(values[offset] + values[offset + 1] + values[offset + 2] + values[offset + 3])) return null;
  }
  // BufferAttribute retains this typed array; Float32BufferAttribute would copy
  // it and briefly double the extra allocation while the scene is loading.
  const attribute = new BufferAttribute(values, 4);
  const shader = Object.freeze({
    cacheKey: 'mobile-precomputed-v1' + (needsRadiusGuard ? '-axis' : ''),
    preamble: `uniform float uProgress;\nattribute vec4 ${MOBILE_HAIR_ATTRIBUTE};\n`,
    normal: `#include <beginnormal_vertex>
   float cutT=clamp((uProgress-${stroke.start})/${stroke.end - stroke.start},0.0,1.0);
   float shaveForNormal=${MOBILE_HAIR_ATTRIBUTE}.y*(1.0-smoothstep(cutT*${length}-0.003,cutT*${length}+0.002,${MOBILE_HAIR_ATTRIBUTE}.x))*step(0.000001,cutT);
   vec3 radialNormal=normalize(vec3(position.x,0.0,position.z));
   objectNormal=normalize(mix(objectNormal,radialNormal,shaveForNormal*${backing ? 0.94 : 0.82}));`,
    vertex: `#include <begin_vertex>
   vNativePosition=position;
   vShaveAmount=shaveForNormal;
   vHairAmount=${allHair ? '1.0' : MOBILE_HAIR_ATTRIBUTE + '.w'};
   transformed.xz*=${needsRadiusGuard ? 'min(1.0,length(position.xz)/0.00001)' : '1.0'}+${MOBILE_HAIR_ATTRIBUTE}.z*vShaveAmount;`
  });
  geometry.setAttribute(MOBILE_HAIR_ATTRIBUTE, attribute);
  prepared.set(geometry, { key, attribute, shader });
  return shader;
}
