import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

// Actual published meshes by Nini (@doniisw), CC BY-NC 4.0.
// The original geometry, UVs, facial artwork and proportions are retained.
const loader=new GLTFLoader();
const smileImage=new Image();smileImage.src='./assets/models/smile-reference.jpg';
const smileReady=smileImage.decode().then(()=>[[760,750,107,31],[1094,761,103,32]].map(([sx,sy,w,h])=>{
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(smileImage,sx,sy,w,h,0,0,w,h);const d=x.getImageData(0,0,w,h);
 for(let i=0;i<d.data.length;i+=4){const alpha=THREE.MathUtils.clamp((230-Math.max(d.data[i],d.data[i+1],d.data[i+2]))/170,0,1);d.data[i]=61;d.data[i+1]=32;d.data[i+2]=32;d.data[i+3]=alpha*255;}
 x.putImageData(d,0,0);return c;
}));
const files=['chiikawa','hachiware','usagi'];
const eyeBoxes=[[[305,563,433,683],[624,563,752,683]],[[1136,563,1264,683],[1455,563,1583,683]],[[1376,1740,1485,1843],[1647,1740,1756,1842]]];
const mouthBoxes=[[404,179,644,366],[1203,212,1500,410],[1419,1190,1716,1558]];
const eyebrowBoxes=[[209,432,850,550],[1028,432,1670,550],[1236,1576,1878,1738]];

export async function loadCharacterAsset(type){
 const [gltf,smileEyes]=await Promise.all([loader.loadAsync(`./assets/models/${files[type]}.glb`),smileReady]);
 const model=gltf.scene;
 const part=name=>model.getObjectByName(name);
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.roughness=.98;o.material.metalness=0;}});
 const face=part('face');face.material=face.material.clone();face.castShadow=false;
 const original=face.material.map;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
 const ctx=canvas.getContext('2d');
 const dynamic=new THREE.CanvasTexture(canvas);dynamic.colorSpace=THREE.SRGBColorSpace;dynamic.flipY=false;
 return {model,feet:[part('foot_l'),part('foot_r')],arms:[part('arm_l'),part('arm_r')],ears:[part('ear_l'),part('ear_r')],tail:part('tail'),faceMaterial:face.material,originalTexture:original,faceCanvas:canvas,faceContext:ctx,faceTexture:dynamic,smileEyes,footRest:[part('foot_l').position.y,part('foot_r').position.y]};
}

export function applyExpression(c,expression){
 if(expression==='calm'||expression==='angry'||(c.type===2&&expression==='happy')){
  c.faceMaterial.map=c.originalTexture;c.faceMaterial.needsUpdate=true;return;
 }
 const x=c.faceContext;x.setTransform(.5,0,0,.5,0,0);x.clearRect(0,0,2048,2048);x.drawImage(c.originalTexture.image,0,0,2048,2048);
 x.strokeStyle='#3d2020';x.fillStyle='#3d2020';x.lineCap='round';x.lineJoin='round';
 for(const [eyeIndex,b] of eyeBoxes[c.type].entries()){
  const [l,t,r,bt]=b,w=r-l,h=bt-t,cx=(l+r)/2,cy=(t+bt)/2;
  if(expression==='happy'||expression==='cry'||expression==='dizzy'){
   x.clearRect(l-8,t-8,w+16,h+16);x.lineWidth=12;
   if(expression==='happy'){x.drawImage(c.smileEyes[eyeIndex],l+3,cy-20,w-6,36);}
   else if(expression==='dizzy'){x.beginPath();for(let i=0;i<65;i++){const a=i*.28,rad=2+i*.6;const px=cx+Math.cos(a)*rad,py=cy+Math.sin(a)*rad;if(!i)x.moveTo(px,py);else x.lineTo(px,py);}x.stroke();}
   else{x.beginPath();x.moveTo(l+8,cy+12);x.quadraticCurveTo(cx,cy-(expression==='happy'?55:25),r-8,cy+12);x.stroke();if(expression==='cry'){x.strokeStyle='#94cfe5';x.lineWidth=12;x.beginPath();x.moveTo(l+14,cy+12);x.lineTo(l+10,bt-2);x.stroke();x.strokeStyle='#3d2020';}}
  }
 }
 if(expression==='scared'||expression==='cry'){
  const [l,t,r,b]=mouthBoxes[c.type],cx=(l+r)/2,cy=(t+b)/2;
  x.clearRect(l,t,r-l,b-t);x.fillStyle='#3d2020';x.beginPath();x.ellipse(cx,cy,(r-l)*.22,(b-t)*.35,0,0,Math.PI*2);x.fill();x.fillStyle='#f1aebd';x.beginPath();x.ellipse(cx,cy+(b-t)*.19,(r-l)*.14,(b-t)*.10,0,0,Math.PI*2);x.fill();
 }
 c.faceTexture.needsUpdate=true;c.faceMaterial.map=c.faceTexture;c.faceMaterial.needsUpdate=true;
}
