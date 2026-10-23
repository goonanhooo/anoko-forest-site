import * as THREE from './vendor/three.module.js';

const UP=new THREE.Vector3(0,1,0),AXES=[new THREE.Vector3(-1,0,0),new THREE.Vector3(1,0,0)];
const sphere=new THREE.SphereGeometry(1,18,12);
function material(color){return new THREE.MeshStandardMaterial({color,roughness:.82});}
const white=material('#fffdfa'),pink=material('#eca9c0'),blue=material('#6ab3d8'),yellow=material('#edc431'),cream=material('#f4dc92');
function addMesh(parent,geometry,mat,position,scale){const m=new THREE.Mesh(geometry,mat);m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function ball(parent,mat,p,s){return addMesh(parent,sphere,mat,p,s);}
function shaft(parent,mat,bottom,top,r){return addMesh(parent,new THREE.CylinderGeometry(r,r,top-bottom,16),mat,[0,(top+bottom)/2,0]);}
function makePalm(parent,type){const g=new THREE.Group();parent.add(g);const mat=type===2?cream:white;ball(g,mat,[0,0,0],[.091,.096,.077]);ball(g,mat,[.053,.015,.047],[.043,.052,.046]);return g;}

export function createWeaponRig(type,rig,arms){
 const weapon=new THREE.Group();weapon.name=type===2?'Usagi yellow hunting staff':'Spiked sasumata';rig.add(weapon);weapon.userData.spikes=[];
 if(type===2){
  shaft(weapon,yellow,-.82,.82,.029);shaft(weapon,white,-.84,-.72,.034);shaft(weapon,white,.68,.84,.036);
  shaft(weapon,yellow,-.64,-.53,.038);ball(weapon,yellow,[0,-.65,0],[.042,.06,.042]);
 }else{
  const mat=type===0?pink:blue;shaft(weapon,mat,-.64,.84,.029);shaft(weapon,white,-.66,-.47,.033);
  const pts=[new THREE.Vector3(-.326,1.415,0),new THREE.Vector3(-.309,1.29,0)];
  for(let i=0;i<=32;i++){const theta=Math.PI+i/32*Math.PI;pts.push(new THREE.Vector3(Math.cos(theta)*.30,1.14+Math.sin(theta)*.30,0));}
  pts.push(new THREE.Vector3(.309,1.29,0),new THREE.Vector3(.326,1.415,0));
  const forkPath=new THREE.CatmullRomCurve3(pts);addMesh(weapon,new THREE.TubeGeometry(forkPath,96,.034,12,false),mat,[0,0,0]);
  // The cone base is exactly on the inner surface, with its tip facing the U.
  for(const t of [.075,.16,.255,.745,.84,.925]){
   const root=forkPath.getPointAt(t),tangent=forkPath.getTangentAt(t),direction=new THREE.Vector3(-tangent.y,tangent.x,0).normalize();
   const base=root.clone().addScaledVector(direction,.031),height=.145,center=base.clone().addScaledVector(direction,height/2);
   const spike=addMesh(weapon,new THREE.ConeGeometry(.039,height,14),white,center.toArray());spike.quaternion.setFromUnitVectors(UP,direction);spike.name='Inward white spike';weapon.userData.spikes.push({base:base.toArray(),direction:direction.toArray(),height});
  }
 }
 const gripHands=[makePalm(rig,type),makePalm(rig,type)];
 const armRest=arms.map(arm=>{arm.geometry.computeBoundingBox();return{position:arm.position.clone(),scale:arm.scale.clone(),width:arm.geometry.boundingBox.max.x-arm.geometry.boundingBox.min.x};});
 return {weapon,gripHands,armRest};
}

function poseArm(c,index,grip){
 const rest=c.armRest[index],sign=index===0?-1:1,shoulder=rest.position.clone();shoulder.x-=sign*.065;shoulder.y+=.09;shoulder.z+=.055;
 const delta=grip.clone().sub(shoulder),length=delta.length(),arm=c.arms[index];arm.position.copy(shoulder).add(grip).multiplyScalar(.5);arm.quaternion.setFromUnitVectors(AXES[index],delta.normalize());arm.scale.set(length/Math.max(.01,rest.width)*1.16,.68,.72);c.gripHands[index].position.copy(grip);c.gripHands[index].visible=true;
}

export function updateWeaponGrip(c,time){
 const struggling=['held','juggle','eating'].includes(c.state),phase=time*7.2+c.type*1.6;
 if(c.type===2){
  c.weapon.position.set(struggling?Math.sin(phase)*.075:0,.55+(struggling?Math.sin(phase*.83)*.085:0),.39);
  c.weapon.quaternion.setFromUnitVectors(UP,new THREE.Vector3(1,.28,0).normalize());
  if(struggling)c.weapon.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(phase*.75)*.32,Math.sin(phase*.64)*.18,Math.sin(phase)*.34)));
  const axis=UP.clone().applyQuaternion(c.weapon.quaternion);for(let i=0;i<2;i++){const grip=c.weapon.position.clone().addScaledVector(axis,i===0?-.255:.255);poseArm(c,i,grip);}
 }else{
  const defending=c.state==='defend',nervous=['cautious','defend','flee','trip'].includes(c.state),shake=nervous?Math.sin(time*8)*.016:Math.sin(time*1.7)*.006;
  c.weapon.position.set(.57+(struggling?Math.sin(phase*.82)*.07:0),.64+(struggling?Math.sin(phase)*.10:0),.31+(struggling?Math.cos(phase*.72)*.04:0));
  c.weapon.rotation.set(defending?.50:.08+(struggling?Math.sin(phase*.78)*.38:0),struggling?Math.sin(phase*.65)*.25:0,-.45+shake+(struggling?Math.sin(phase)*.44:0));poseArm(c,1,c.weapon.position);
  c.gripHands[0].visible=false;c.arms[0].position.copy(c.armRest[0].position);c.arms[0].scale.copy(c.armRest[0].scale);
  if(struggling)c.arms[0].rotation.x=Math.sin(phase+1)*.75;c.arms[0].rotation.z=struggling?Math.sin(phase*.8)*.25:0;
 }
}

export function weaponGripSnapshot(c){
 const origin=new THREE.Vector3(),axis=UP.clone(),q=new THREE.Quaternion();c.weapon.getWorldPosition(origin);c.weapon.getWorldQuaternion(q);axis.applyQuaternion(q).normalize();let error=0;
 for(const hand of c.gripHands){if(!hand.visible)continue;const p=new THREE.Vector3();hand.getWorldPosition(p);error=Math.max(error,p.sub(origin).cross(axis).length());}
 return {kind:c.weapon.name,spikes:c.weapon.userData.spikes.length,gripError:Number(error.toFixed(7))};
}
