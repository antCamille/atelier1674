// Surface locations for the four chapter entry points. Camera destinations stay
// on the existing centered orbit; each selected point sits on its visible side.
export const HEAD_HOTSPOTS = [
 {id:'canvas',theta:-25,y:.34,label:'01. Les barbiers. Couronne. Découvrir cette section.'},
 {id:'cut',theta:5,y:.24,label:'02. Les créations. Tempe. Découvrir cette section.'},
 {id:'detail',theta:55,y:.08,label:'03. L’espace. Profil. Découvrir cette section.'},
 {id:'reveal',theta:-10,y:-.10,label:'04. Rendez-vous. Mâchoire. Découvrir cette section.'},
];
export function connectorPath(x,y,endX,endY){return `M ${x} ${y} L ${x+35} ${y} L ${endX-25} ${endY} L ${endX} ${endY}`;}
export function markerInViewport(x,y,z,w,h){return z>=-1&&z<=1&&x>=15&&x<=w-18&&y>=90&&y<=h-95;}
