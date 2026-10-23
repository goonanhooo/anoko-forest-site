import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {softenImportedGeometry} from './refine-geometry.js';
// Nini's published meshes, smoothed and fitted to the user's figure photos.
const loader=new GLTFLoader(),files=['chiikawa','hachiware','usagi'];
const eyeBoxes=[[[305,563,433,683],[624,563,752,683]],[[1136,563,1264,683],[1455,563,1583,683]],[[1376,1740,1485,1843],[1647,1740,1756,1842]]];
const browBoxes=[[[294,455,385,515],[670,455,765,515]],[[1170,475,1216,519],[1505,483,1545,522]],[[1298,1601,1448,1739],[1696,1603,1845,1745]]];
const mouths=[[455,192,160,163],[1272,215,190,175],[1493,1233,175,220]];
const referenceRects=[{
 calm:{eyes:[[66,81,19,19],[114,81,20,20]],brows:[[67,67,14,5],[119,68,13,6]],mouth:[88,103,25,29]},
 happy:{eyes:[[295,77,17,7],[341,77,18,7]],brows:[[292,61,17,9],[346,61,15,6]],mouth:[315,90,26,30]},
 scared:{eyes:[[78,306,15,16],[113,307,17,16]],brows:[[84,293,12,6],[112,294,12,6]],mouth:[94,325,19,23]}
},{
 calm:{eyes:[[67,76,19,19],[117,77,18,19]],brows:[[73,63,7,7],[121,64,8,7]],mouth:[88,98,26,26]},
 happy:{eyes:[[294,76,17,6],[343,77,16,7]],brows:[[299,59,8,5],[346,59,8,5]],mouth:[311,88,30,28]},
 scared:{eyes:[[78,305,15,15],[116,304,15,16]],brows:[[81,293,13,7],[113,293,11,5]],mouth:[94,321,22,26]}
},{
 calm:{eyes:[[66,98,17,17],[109,100,16,16]],brows:[[53,69,26,21],[112,69,30,25]],mouth:[84,117,23,29]}
}];
const referenceImages=[0,1,2].map(type=>{const im=new Image();im.src=`./assets/models/${files[type]}-photo-reference.png`;return im.decode().then(()=>im);});
function extractGlyph(image,rect){
 const [sx,sy,w,h]=rect,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(image,sx,sy,w,h,0,0,w,h);const data=x.getImageData(0,0,w,h);
 for(let i=0;i<data.data.length;i+=4){const r=data.data[i],g=data.data[i+1],b=data.data[i+2],lum=.21*r+.72*g+.07*b,pink=r>g*1.22&&r>b*1.08&&r>160&&g>75&&b>85;if(pink){data.data[i]=239;data.data[i+1]=156;data.data[i+2]=178;data.data[i+3]=THREE.MathUtils.clamp((r-g-12)/35,0,1)*255;}else{data.data[i]=61;data.data[i+1]=35;data.data[i+2]=34;data.data[i+3]=THREE.MathUtils.clamp((172-lum)/90,0,1)*255;}}x.putImageData(data,0,0);return c;
}
function buildPhotoGlyphs(image,type){return Object.fromEntries(Object.entries(referenceRects[type]).map(([name,r])=>[name,{eyes:r.eyes.map(b=>extractGlyph(image,b)),brows:r.brows.map(b=>extractGlyph(image,b)),mouth:extractGlyph(image,r.mouth)}]));}
function textureFromCanvas(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;return t;}
export async function loadCharacterAsset(type){
 const [gltf,reference]=await Promise.all([loader.loadAsync(`./assets/models/${files[type]}.glb`),referenceImages[type]]);
 const model=gltf.scene,part=name=>model.getObjectByName(name),sourceAtlas=part('face').material.map,atlasCanvas=document.createElement('canvas');atlasCanvas.width=atlasCanvas.height=2048;const ac=atlasCanvas.getContext('2d');ac.drawImage(sourceAtlas.image,0,0);if(type===1){ac.fillStyle='#349ed2';ac.fillRect(1356,982,92,92);}if(type===2){ac.fillStyle='#f4dc92';ac.fillRect(1258,982,92,92);}const atlas=textureFromCanvas(atlasCanvas);
 model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.map=atlas;o.castShadow=true;o.receiveShadow=true;o.material.roughness=.98;o.material.metalness=0;if(o.name!=='face')o.geometry=softenImportedGeometry(o.geometry,2);}});
 if(type<2){part('torso').scale.set(.94,.86,.96);for(const side of ['l','r'])part('foot_'+side).scale.setScalar(.88);}
 if(type===2){part('torso').scale.set(.92,.92,.96);for(const side of ['l','r']){part('foot_'+side).scale.setScalar(.88);part('ear_'+side).scale.set(.84,.94,1);}}
 const headPivot=new THREE.Group();headPivot.position.copy(part('head').position);model.add(headPivot);for(const n of ['head','face','ear_l','ear_r'])headPivot.attach(part(n));
 const face=part('face');face.material=face.material.clone();face.castShadow=false;const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
 const asset={model,headPivot,feet:[part('foot_l'),part('foot_r')],arms:[part('arm_l'),part('arm_r')],ears:[part('ear_l'),part('ear_r')],tail:part('tail'),faceMaterial:face.material,originalTexture:atlas,atlasCanvas,faceCanvas:canvas,faceContext:canvas.getContext('2d'),faceTexture:textureFromCanvas(canvas),glyphs:buildPhotoGlyphs(reference,type),footRest:[part('foot_l').position.y,part('foot_r').position.y]};applyExpression({...asset,type},'calm');return asset;
}
export function applyExpression(c,expression){
 if(c.type===2)expression='calm';
 const x=c.faceContext;x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,2048,2048);x.drawImage(c.atlasCanvas,0,0);
 const name=expression==='happy'?'happy':['scared','cry','angry','sad'].includes(expression)?'scared':'calm',glyph=c.glyphs[name];if(c.type===2)x.clearRect(1236,1576,642,289);else x.clearRect(c.type===0?209:1028,432,642,282);
 for(let i=0;i<2;i++){const [l,t,r,b]=eyeBoxes[c.type][i],w=r-l,h=b-t,drawH=name==='happy'?38:h;x.drawImage(glyph.eyes[i],l,(t+b-drawH)/2,w,drawH);const [bl,bt,br,bb]=browBoxes[c.type][i];x.drawImage(glyph.brows[i],bl,bt,br-bl,bb-bt);}
 x.clearRect(...(c.type===0?[404,179,240,187]:c.type===1?[1203,212,297,198]:[1419,1190,297,368]));x.drawImage(glyph.mouth,...mouths[c.type]);
 if(expression==='sad'){
  const [ml,mt,mw,mh]=mouths[c.type];x.clearRect(ml-5,mt-5,mw+10,mh+10);x.strokeStyle='#3d2322';x.lineWidth=11;x.lineCap='round';
  x.beginPath();x.moveTo(ml+mw*.25,mt+mh*.58);x.quadraticCurveTo(ml+mw*.5,mt+mh*.25,ml+mw*.75,mt+mh*.58);x.stroke();
  for(let i=0;i<2;i++){const [l,t,r,b]=browBoxes[c.type][i];x.clearRect(l-4,t-4,r-l+8,b-t+8);x.beginPath();x.moveTo(l,t+(b-t)*(i===0?.75:.2));x.quadraticCurveTo((l+r)/2,t+(b-t)*.15,r,t+(b-t)*(i===0?.2:.75));x.stroke();}
 }
 if(expression==='dizzy')for(const [l,t,r,b]of eyeBoxes[c.type]){x.clearRect(l-4,t-4,r-l+8,b-t+8);x.strokeStyle='#3d2322';x.lineWidth=10;x.lineCap='round';x.beginPath();for(let j=0;j<65;j++){const a=j*.28,rad=j*.6,px=(l+r)/2+Math.cos(a)*rad,py=(t+b)/2+Math.sin(a)*rad;if(!j)x.moveTo(px,py);else x.lineTo(px,py);}x.stroke();}
 c.faceTexture.needsUpdate=true;c.faceMaterial.map=c.faceTexture;c.faceMaterial.needsUpdate=true;
}
