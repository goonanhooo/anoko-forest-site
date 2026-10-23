// Throws stay at a fixed horizontal distance. Height is measured along world up.
export function juggleMotion(elapsed,index=0,count=1,type=0){
 const phase=((elapsed/3.8+index/Math.max(1,count))%1+1)%1,leg=(phase% .5)*2,arc=4*leg*(1-leg),span=count>1?1.18:.92;
 return {x:(phase<.5?1:-1)*(-span+2*span*leg),y:-1.65+(type===2?3.9:4.25)*arc,z:count>1?-3.85:-3.35,phase,leg,arc};
}

function distanceToSegment(point,a,b){
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(point.x-a.x-dx*t,point.z-a.z-dz*t);
}

// Try curved escape paths before turning around; never run through a tree trunk.
export function escapeTarget(position,player,trees,elapsed,type=0,side=1){
 const dx=position.x-player.x,dz=position.z-player.z,heading=Math.atan2(dx||.001,dz||-.001),sway=Math.sin(elapsed*2.2+type*1.7)*.22;
 for(const turn of [sway,sway+side*.7,sway-side*.7,side*1.35,-side*1.35,Math.PI]){
  const angle=heading+turn,target={x:position.x+Math.sin(angle)*2.3,z:position.z+Math.cos(angle)*2.3};
  if(Math.hypot(target.x,target.z)>21)continue;
  if(trees.every(tree=>distanceToSegment(tree,position,target)>tree.r+.44))return target;
 }
 return {x:position.x,z:position.z};
}
