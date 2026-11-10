// Wizzards' authored six-axis poses. Angles/elevation are retained;
// head-specific framing below deliberately limits its extreme arm close-ups.
export const REFERENCE_POSES = [
 {theta:.39,phi:.025,radius:11.9,y:-.25,sx:-.40,sy:0},
 {theta:-.55,phi:.015,radius:5.05,y:2.12,sx:.47,sy:0},
 {theta:.75,phi:.015,radius:5.05,y:.08,sx:.47,sy:0},
 {theta:-.95,phi:.015,radius:5.05,y:-1.24,sx:.47,sy:0},
 {theta:1.02,phi:-.1,radius:4.2,y:-2.15,sx:.47,sy:0},
];
// Preserve v11's overview, targets and composition. Only retreat from its
// extreme focused close-ups; intentional cinematic cropping is retained.
export const HEAD_DISTANCE_SCALE=.13;
export const headTargetY=y=>.1215+y*.103;
export function cameraPoseFor(index,mobile=false,aspect=mobile?390/844:1.44){
 const ref=REFERENCE_POSES[index];
 if(!ref)throw new RangeError('Unknown camera chapter');
 const original=(mobile?(index?5.4:14.6):ref.radius)*HEAD_DISTANCE_SCALE;
 return {...ref,radius:original+(index?(mobile?.65:.45):0),
  y:headTargetY(ref.y),sx:mobile?(index?-.04:-.40):ref.sx,
  sy:mobile?(index?-.46:.15):ref.sy};
}
export function cameraCoordinates(pose,extraYaw=0){
 const theta=pose.theta+extraYaw,cp=Math.cos(pose.phi);
 return {x:Math.sin(theta)*cp*pose.radius,y:pose.y+Math.sin(pose.phi)*pose.radius,z:Math.cos(theta)*cp*pose.radius,targetY:pose.y};
}
