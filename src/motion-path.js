// Shape-preserving Hermite interpolation: keep the authored viewpoints while
// sharing velocity at each knot instead of braking to a stop at every segment.
export const CAMERA_STOPS = [[0,-25],[.18,37],[.38,52],[.58,72],[.76,96],[.84,130],[1,405]];
const spans=CAMERA_STOPS.slice(1).map((p,i)=>p[0]-CAMERA_STOPS[i][0]);
const slopes=spans.map((h,i)=>(CAMERA_STOPS[i+1][1]-CAMERA_STOPS[i][1])/h);
const tangents=CAMERA_STOPS.map((_,i)=>{
 if(i===0||i===CAMERA_STOPS.length-1)return 0;
 const before=slopes[i-1],after=slopes[i];
 if(before*after<=0)return 0;
 const w1=2*spans[i]+spans[i-1],w2=spans[i]+2*spans[i-1];
 return (w1+w2)/(w1/before+w2/after);
});
export function cameraAngleAt(progress){
 const p=Math.max(0,Math.min(1,progress));
 let i=0;while(i<spans.length-1&&p>CAMERA_STOPS[i+1][0])i++;
 const h=spans[i],t=(p-CAMERA_STOPS[i][0])/h,t2=t*t,t3=t2*t;
 const degrees=(2*t3-3*t2+1)*CAMERA_STOPS[i][1]+(t3-2*t2+t)*h*tangents[i]
   +(-2*t3+3*t2)*CAMERA_STOPS[i+1][1]+(t3-t2)*h*tangents[i+1];
 return degrees*Math.PI/180;
}
