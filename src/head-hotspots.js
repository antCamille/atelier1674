import {REFERENCE_POSES,headTargetY} from './camera-choreography.js';
// Surface locations for the four chapter entry points. Camera destinations stay
// on the existing centered orbit; each selected point sits on its visible side.
export const HEAD_HOTSPOTS = [
 {id:'canvas',theta:REFERENCE_POSES[1].theta*180/Math.PI,y:headTargetY(REFERENCE_POSES[1].y),label:'01. Les barbiers. Couronne. Découvrir cette section.'},
 {id:'cut',theta:REFERENCE_POSES[2].theta*180/Math.PI,y:headTargetY(REFERENCE_POSES[2].y),label:'02. Les créations. Tempe. Découvrir cette section.'},
 {id:'detail',theta:REFERENCE_POSES[3].theta*180/Math.PI,y:headTargetY(REFERENCE_POSES[3].y),label:'03. L’espace. Profil. Découvrir cette section.'},
 {id:'reveal',theta:REFERENCE_POSES[4].theta*180/Math.PI,y:headTargetY(REFERENCE_POSES[4].y),label:'04. Rendez-vous. Mâchoire. Découvrir cette section.'},
];
export function connectorPath(x,y,endX,endY){return `M ${x} ${y} L ${x+35} ${y} L ${endX-25} ${endY} L ${endX} ${endY}`;}
export function markerInViewport(x,y,z,w,h){return z>=-1&&z<=1&&x>=15&&x<=w-18&&y>=90&&y<=h-95;}
