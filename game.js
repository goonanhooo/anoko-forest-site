import * as THREE from './vendor/three.module.js';
import {loadCharacterAsset,applyExpression} from './character-assets.js';

const canvas=document.querySelector('#forest');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.22;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#cbdac0');
scene.fog=new THREE.FogExp2('#cbdac0',.025);
const viewFov=()=>THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(57/2))*Math.max(1,1.35/(innerWidth/innerHeight))));
const camera=new THREE.PerspectiveCamera(viewFov(),innerWidth/innerHeight,.07,125);
camera.rotation.order='YXZ';
camera.position.set(0,2.75,6.5);
scene.add(camera);
let yaw=0,pitch=-.25,time=0,last=performance.now(),danceStart=-100,danceUntil=-100,juggling=false,muted=false;
let motion=0,handReach=0,petUntil=0,voiceNext=0,stepTime=0;
const keys=new Set(),held=[],characters=[],trees=[],particles=[];
const up=new THREE.Vector3(0,1,0),tmp=new THREE.Vector3();
const rng=(a,b)=>a+Math.random()*(b-a);
let seed=42191;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const sr=(a,b)=>a+rand()*(b-a);
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const color=c=>new THREE.Color(c);
const brown='#4a302d';
const materials=new Map();
function mat(c,opts={}){const k=c+JSON.stringify(opts);if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color:c,roughness:.96,...opts}));return materials.get(k);}
const white=mat('#fffaf5'),cream=mat('#fff0bb'),blue=mat('#83b3cb'),pink=mat('#f9b9c3'),ink=mat(brown),outlineMat=new THREE.MeshBasicMaterial({color:brown,side:THREE.BackSide});
const sphereGeo=new THREE.SphereGeometry(1,24,16);
function mesh(geo,material,parent,pos,scale,outline=false){
 const m=new THREE.Mesh(geo,material);if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);
 if(outline){const o=new THREE.Mesh(geo,outlineMat);o.scale.setScalar(1.016);o.castShadow=false;m.add(o);}return m;
}
function ball(parent,m,pos,s,ol=false){return mesh(sphereGeo,m,parent,pos,s,ol);}
function tube(parent,points,r,m){const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(path,Math.max(8,points.length*5),r,6,false),m,parent);}
function cylinderBetween(parent,a,b,r,m){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const o=mesh(new THREE.CylinderGeometry(r*.8,r,d.length(),7),m,parent,av.clone().add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(up,d.normalize());return o;}

// Warm, diffuse, hand-painted forest light.
scene.add(new THREE.HemisphereLight('#fffbe9','#82946d',2.6));
const sun=new THREE.DirectionalLight('#fff1cd',3.25);sun.position.set(-9,20,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:65});sun.shadow.bias=-.00035;sun.shadow.normalBias=.035;sun.shadow.radius=4;scene.add(sun);
const bounce=new THREE.DirectionalLight('#cceddb',.6);bounce.position.set(10,4,-8);scene.add(bounce);

function groundTexture(){
 const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.fillStyle='#aabc87';x.fillRect(0,0,1024,1024);
 for(let i=0;i<13000;i++){x.fillStyle=['#d1d39a22','#7c9b6a16','#f1e8bd17'][i%3];x.beginPath();x.ellipse(rand()*1024,rand()*1024,sr(2,25),sr(1,8),rand()*6,0,Math.PI*2);x.fill();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10,10);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const ground=mesh(new THREE.PlaneGeometry(220,220),new THREE.MeshStandardMaterial({map:groundTexture(),roughness:1}),scene);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.castShadow=false;
// A soft irregular clearing with a narrow path disappearing into the trees.
const pathCanvas=document.createElement('canvas');pathCanvas.width=pathCanvas.height=1024;
const px=pathCanvas.getContext('2d'),grad=px.createRadialGradient(512,530,100,512,530,490);grad.addColorStop(0,'#e8d8ac');grad.addColorStop(.65,'#dfd0a0f2');grad.addColorStop(1,'#dacead00');px.fillStyle=grad;px.fillRect(0,0,1024,1024);
for(let i=0;i<1500;i++){px.fillStyle=i%2?'#fff4cf22':'#9d926222';px.beginPath();px.ellipse(rand()*1024,rand()*1024,sr(.6,3),sr(.4,1.5),0,0,Math.PI*2);px.fill();}
const clearingTex=new THREE.CanvasTexture(pathCanvas);clearingTex.colorSpace=THREE.SRGBColorSpace;
const clearing=mesh(new THREE.PlaneGeometry(25,28),new THREE.MeshStandardMaterial({map:clearingTex,transparent:true,depthWrite:false,roughness:1}),scene,[0,.012,1]);clearing.rotation.x=-Math.PI/2;clearing.castShadow=false;
const bark=mat('#a59c79'),darkBark=mat('#8c8d6b');
const leafMats=['#91b78c','#a5c299','#b4cc9a','#83aa84','#c1cf9e'].map(c=>mat(c));
function tree(x,z,s){
 const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);
 const h=sr(7,10);mesh(new THREE.CylinderGeometry(.26,.66,h,9),bark,g,[0,h/2,0]);
 for(let j=0;j<4;j++){const a=j*Math.PI/2+sr(-.2,.2);cylinderBetween(g,[Math.cos(a)*.1,.7,Math.sin(a)*.1],[Math.cos(a)*1.1,.035,Math.sin(a)*1.1],.17,darkBark);}
 cylinderBetween(g,[0,h*.6,0],[1.4,h*.83,.2],.2,bark);
 cylinderBetween(g,[0,h*.68,0],[-1.35,h*.9,-.5],.18,bark);
 for(let j=0;j<4;j++)ball(g,leafMats[Math.floor(rand()*leafMats.length)],[sr(-1.6,1.6),h+sr(-.6,.7),sr(-1,1)],[sr(1.7,2.7),sr(1.3,2.2),sr(1.7,2.8)]);
 trees.push({x,z,r:.6*s});
}
for(let i=0;i<90;i++){const a=rand()*Math.PI*2,r=sr(12,47);tree(Math.cos(a)*r,Math.sin(a)*r,sr(.75,1.5));}
tree(-7.8,-2,1.3);tree(8.7,-3,1.25);tree(-8,7,1.4);tree(9,8,1.2);
function bush(x,z,s){for(let j=0;j<3;j++)ball(scene,leafMats[Math.floor(sr(0,5))],[x+sr(-.6,.6)*s,sr(.3,.6)*s,z+sr(-.5,.5)*s],[sr(.6,1)*s,sr(.45,.8)*s,sr(.5,.8)*s]);}
for(let i=0;i<55;i++){const a=rand()*6.28,r=sr(10,30);bush(Math.cos(a)*r,Math.sin(a)*r,sr(.7,1.8));}

// Instanced grass blades, tiny daisies, pebbles and clover.
const grassShape=new THREE.Shape();grassShape.moveTo(-.04,0);grassShape.quadraticCurveTo(-.04,.3,-.15,.52);grassShape.quadraticCurveTo(.04,.35,.055,0);
const grassGeo=new THREE.ShapeGeometry(grassShape),grassMat=mat('#83a573',{side:THREE.DoubleSide});
const grass=new THREE.InstancedMesh(grassGeo,grassMat,4400),dummy=new THREE.Object3D();scene.add(grass);
for(let i=0;i<4400;i++){const a=rand()*6.28,r=sr(4.7,42);const x=Math.cos(a)*r,z=Math.sin(a)*r;dummy.position.set(x,.02,z);dummy.rotation.set(0,rand()*6.28,sr(-.2,.2));dummy.scale.setScalar(sr(.4,1.5));dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,color(['#7d9c6b','#9db47d','#b4c68c'][i%3]));}
const petalGeo=new THREE.SphereGeometry(1,7,5),flowerCount=400,petals=new THREE.InstancedMesh(petalGeo,mat('#fff9e6'),flowerCount*5),centers=new THREE.InstancedMesh(petalGeo,mat('#ecd284'),flowerCount);scene.add(petals,centers);
for(let i=0;i<flowerCount;i++){const a=rand()*6.28,r=sr(5.2,22),x=Math.cos(a)*r,z=Math.sin(a)*r,s=sr(.06,.12);for(let j=0;j<5;j++){const b=j*6.28/5;dummy.position.set(x+Math.cos(b)*s,.08,z+Math.sin(b)*s);dummy.rotation.set(0,b,0);dummy.scale.set(s*.8,.027,s*.45);dummy.updateMatrix();petals.setMatrixAt(i*5+j,dummy.matrix);}dummy.position.set(x,.1,z);dummy.scale.set(s*.5,.04,s*.5);dummy.updateMatrix();centers.setMatrixAt(i,dummy.matrix);}
const rockMat=mat('#b4b49a');for(let i=0;i<32;i++){const a=rand()*6.28,r=sr(5,18);ball(scene,rockMat,[Math.cos(a)*r,.06,Math.sin(a)*r],[sr(.07,.22),sr(.05,.14),sr(.08,.2)]);}
function mushroom(x,z,s){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);mesh(new THREE.CylinderGeometry(.11,.16,.55,12),mat('#f4e3bf'),g,[0,.28,0]);ball(g,mat('#c59179'),[0,.63,0],[.48,.25,.47]);for(let i=0;i<6;i++){const a=i*1.047;ball(g,white,[Math.cos(a)*.31,.8,Math.sin(a)*.3],[.065,.021,.06]);}}
mushroom(-4.8,1.1,1.2);mushroom(-5.3,1.7,.7);mushroom(5,-2,1.05);mushroom(5.4,-1.7,.5);
// A fallen log, moss and a small, still woodland pond.
const log=mesh(new THREE.CylinderGeometry(.4,.47,3.8,12),darkBark,scene,[-5.3,.4,-3.4]);log.rotation.z=Math.PI/2;log.rotation.y=.25;
for(let j=0;j<3;j++)ball(scene,leafMats[0],[-6.2+j*.8,.7,-3.4],[.65,.16,.45]);
const pond=mesh(new THREE.CircleGeometry(3.1,64),mat('#9bbeb2',{roughness:.36,metalness:.12}),scene,[-8.8,.018,1.5],[1,1,.65]);pond.rotation.x=-Math.PI/2;pond.castShadow=false;
for(let i=0;i<9;i++){const a=i*6.28/9;ball(scene,rockMat,[-8.8+Math.cos(a)*3,.03,1.5+Math.sin(a)*1.8],[sr(.3,.6),sr(.1,.2),sr(.3,.6)]);}

const dustGeo=new THREE.BufferGeometry(),dustPositions=new Float32Array(160*3);
for(let i=0;i<160;i++){dustPositions[i*3]=sr(-25,25);dustPositions[i*3+1]=sr(.5,9);dustPositions[i*3+2]=sr(-25,25);}dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
const moteCanvas=document.createElement('canvas');moteCanvas.width=moteCanvas.height=32;const mx=moteCanvas.getContext('2d'),mg=mx.createRadialGradient(16,16,0,16,16,16);mg.addColorStop(0,'#fffbd9ff');mg.addColorStop(.2,'#fffbd9bb');mg.addColorStop(1,'#fffbd900');mx.fillStyle=mg;mx.fillRect(0,0,32,32);
const motes=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#fff7cd',size:.12,map:new THREE.CanvasTexture(moteCanvas),transparent:true,depthWrite:false,opacity:.7}));scene.add(motes);

function spear(type,parent){
 const g=new THREE.Group();parent.add(g);const m=mat(type===0?'#e5a5b3':type===1?'#88b8d2':'#e2c17a');
 cylinderBetween(g,[0,-.5,0],[0,type<2?1.02:.85,0],.035,m);
 if(type<2){
  tube(g,[[-.27,1.47,0],[-.27,1.23,0],[-.22,1.1,0],[-.13,1.03,0],[0,1.01,0],[.13,1.03,0],[.22,1.1,0],[.27,1.23,0],[.27,1.47,0]],.039,m);
  for(const side of [-1,1])for(let j=0;j<3;j++){const spike=mesh(new THREE.ConeGeometry(.041,.14,8),white,g,[side*(j===0?.235:.265),1.16+j*.125,0]);spike.quaternion.setFromUnitVectors(up,new THREE.Vector3(-side,.28,0).normalize());}
  cylinderBetween(g,[0,-.51,0],[0,-.31,0],.042,white);
 }else{ball(g,pink,[0,.85,0],[.075,.14,.075]);ball(g,pink,[0,-.51,0],[.075,.14,.075]);}
 g.position.set(.17,-.01,.5);g.rotation.z=-.35;return g;
}
const tearMat=mat('#a4dbe8',{transparent:true,opacity:.82,roughness:.18});
const names=['치이카와','하치와레','우사기'];
async function createCharacter(type,x,z){
 const asset=await loadCharacterAsset(type);
 const root=new THREE.Group(),rig=new THREE.Group();root.add(rig);rig.add(asset.model);root.position.set(x,0,z);scene.add(root);
 const tears=[];for(const side of [-1,1]){const t=ball(rig,tearMat,[side*.27,1.12,.52],[.033,.12,.025]);t.visible=false;t.castShadow=false;tears.push(t);}
 const weapon=spear(type,asset.arms[1]);weapon.visible=true;
 const c={...asset,type,name:names[type],root,rig,tears,weapon,state:'idle',stateAt:0,until:0,home:new THREE.Vector3(x,0,z),velocity:new THREE.Vector3(),fear:0,tripAt:100,nextIdle:rng(4,9),nextVoice:0,face:'calm',followOffset:0,eatAt:0,danceReact:0};characters[type]=c;return c;
}
camera.rotation.set(pitch,yaw,0);renderer.render(scene,camera);
await Promise.all([createCharacter(0,-2.15,.7),createCharacter(1,0,-.15),createCharacter(2,2.2,.75)]);

// Only the player's fluffy forearms and orange-pink claws are visible.
const hands=[];
for(const side of [-1,1]){
 const hand=new THREE.Group();camera.add(hand);hand.position.set(side*1.04,-.94,-1.4);hand.rotation.y=side*.18;
 const arm=ball(hand,white,[side*.16,-.19,.45],[.29,.3,.78]);arm.rotation.y=side*.12;
 ball(hand,white,[0,0,-.15],[.35,.27,.36]);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ball(hand,white,[Math.cos(a)*.25,Math.sin(a)*.18,.08],[.085,.085,.15]);}
 const orange=mat('#e8b176'),tip=mat('#efbc80'),groove=mat('#6e4d35');
 for(let j=0;j<3;j++){const cx=(j-1)*.205,offset=j===1?-.055:0;ball(hand,orange,[cx,.17,-.36+offset],[.127,.13,.23]);ball(hand,tip,[cx,.19,-.51+offset],[.112,.113,.19]);const claw=mesh(new THREE.ConeGeometry(.092,.22,12),tip,hand,[cx,.17,-.68+offset]);claw.rotation.x=-1.7;
  for(const z of [-.4,-.53])tube(hand,[[cx-.09,.245,z+offset],[cx-.04,.292,z-.012+offset],[cx+.04,.292,z-.012+offset],[cx+.09,.245,z+offset]],.009,groove);
 }
 hand.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});hands.push(hand);
}

// Positional voice clips, a quiet breeze, leaves, steps and gentle toy-like effects.
const clips={0:{fear:['chiikawa-iya.mp3'],idle:[],happy:[]},1:{fear:['hachiware-nani.mp3'],idle:['hachiware-oi.mp3'],happy:['hachiware-oi.mp3']},2:{fear:['usagi-huh.mp3','usagi-yaha.mp3'],idle:['usagi-una.mp3'],happy:['usagi-yaha.mp3']}};
let audioContext=null,master=null,wind=null,voiceBusyUntil=0;
const audioCache=new Map(),activeVoices=new Set();
function initAudio(){if(audioContext){audioContext.resume().catch(()=>{});return;}try{audioContext=new AudioContext();master=audioContext.createGain();master.gain.value=muted?0:.65;master.connect(audioContext.destination);const n=audioContext.sampleRate*5,b=audioContext.createBuffer(1,n,audioContext.sampleRate),d=b.getChannelData(0);let prev=0;for(let i=0;i<n;i++){prev=(prev+Math.random()*.025-.0125)*.988;d[i]=prev;}wind=audioContext.createBufferSource();wind.buffer=b;wind.loop=true;const f=audioContext.createBiquadFilter();f.type='lowpass';f.frequency.value=700;const gain=audioContext.createGain();gain.gain.value=.35;wind.connect(f).connect(gain).connect(master);wind.start();for(const name of new Set(Object.values(clips).flatMap(v=>Object.values(v).flat()))){fetch('./assets/'+name).then(r=>{if(!r.ok)throw Error('audio unavailable');return r.arrayBuffer();}).then(b=>audioContext.decodeAudioData(b)).then(b=>audioCache.set(name,b)).catch(()=>{});}}catch(e){console.warn('Audio unavailable',e);}}
function effect(freq=400,length=.14,volume=.08,type='sine'){if(!audioContext||muted)return;const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*.65),t+length);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+length);o.connect(g).connect(master);o.start();o.stop(t+length);}
function voice(c,kind='fear',force=false){
 if(!audioContext||muted||time<c.nextVoice||(!force&&time<voiceBusyUntil))return;
 const list=clips[c.type][kind];if(!list.length){if(kind==='happy'){effect(650,.09,.025);setTimeout(()=>effect(780,.12,.018),130);c.nextVoice=time+8;}return;}const file=list[Math.floor(Math.random()*list.length)],buffer=audioCache.get(file);if(!buffer)return;
 const source=audioContext.createBufferSource();source.buffer=buffer;const p=audioContext.createStereoPanner(),g=audioContext.createGain();tmp.copy(c.root.position).sub(camera.position);const dist=tmp.length(),side=tmp.x*Math.cos(yaw)-tmp.z*Math.sin(yaw);p.pan.value=clamp(side/7,-.8,.8);g.gain.value=.65*clamp(1-dist/30,.15,1);source.connect(p).connect(g).connect(master);source.start();activeVoices.add(source);source.onended=()=>activeVoices.delete(source);c.nextVoice=time+5;voiceBusyUntil=time+Math.min(buffer.duration,3.5)+.6;
}

function setFace(c,expression){if(c.type===2&&expression==='happy')expression='calm';if(c.face===expression)return;applyExpression(c,expression);c.face=expression;}
function state(c,next,duration=0){c.state=next;c.stateAt=time;c.until=time+duration;}
function freeCharacters(){return characters.filter(c=>!['held','juggle','eating','eaten','thrown'].includes(c.state));}
function nearestTarget(){const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);let best=null,score=1e9;for(const c of freeCharacters()){tmp.copy(c.root.position).add(new THREE.Vector3(0,.95,0)).sub(camera.position);const dist=tmp.length(),dot=tmp.clone().normalize().dot(dir);if(dist<7.8&&dot>.8){const s=dist+(1-dot)*12;if(s<score){score=s;best=c;}}}return best;}
function grab(){const c=nearestTarget();if(!c||held.length>=3){if(!c&&held.length)release(false);return;}state(c,juggling?'juggle':'held');held.push(c);c.weapon.visible=true;c.fear=1;setFace(c,c.type===2?'angry':'scared');voice(c,'fear',true);handReach=1;effect(250,.16,.08);}
function release(toss=false){if(!held.length)return;const c=held.pop();c.root.scale.setScalar(1);c.rig.rotation.set(0,0,0);c.root.rotation.x=0;const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);c.velocity.copy(dir).multiplyScalar(toss?3.6:.7);c.velocity.y=toss?2.6:.2;state(c,'thrown');setFace(c,'scared');effect(220,.25,.05);if(!held.length)juggling=false;}
function toggleJuggle(){if(!held.length)grab();if(!held.length)return;juggling=!juggling;held.forEach(c=>{state(c,juggling?'juggle':'held');setFace(c,juggling?'dizzy':'scared');});effect(juggling?600:400,.2);}
function eat(){if(!held.length){grab();if(!held.length)return;}const c=held.pop();state(c,'eating');c.eatAt=time;c.eatFrom=c.root.position.clone();voice(c,'fear',true);document.body.classList.add('eating');setTimeout(()=>document.body.classList.remove('eating'),1100);effect(105,.55,.2);if(!held.length)juggling=false;}
function scare(){danceUntil=-100;for(const c of freeCharacters()){c.fear=1;if(c.type===0){state(c,'flee',7);c.tripAt=time+1.8;}else if(c.type===1){state(c,'defend',3.7);c.weapon.visible=true;}else{state(c,'dodge',3);c.weapon.visible=true;}setFace(c,c.type===0?'cry':c.type===1?'scared':'angry');voice(c,'fear');}effect(58,.6,.13,'triangle');handReach=.6;}
function dance(){danceStart=time;danceUntil=time+8;for(const c of freeCharacters()){state(c,'cautious',3);c.danceReact=time+3;c.fear=.45;c.weapon.visible=true;setFace(c,'scared');}effect(330,.18,.04);}
function pet(){const c=nearestTarget()||held.at(-1);if(!c)return;petUntil=time+1.4;c.fear=0;setFace(c,'happy');voice(c,'happy');if(!held.includes(c))state(c,'follow',40);effect(730,.12,.025);}
function reset(){held.length=0;juggling=false;danceUntil=-100;characters.forEach(c=>{c.root.position.copy(c.home);c.root.rotation.set(0,0,0);c.root.scale.setScalar(1);c.root.visible=true;c.rig.rotation.set(0,0,0);c.rig.position.set(0,0,0);c.fear=0;c.weapon.visible=true;c.nextIdle=time+rng(5,10);state(c,'idle');setFace(c,'calm');});}
function lookAtCharacter(index){const c=characters[index];if(!c||c.state==='eaten')return;const d=c.root.position.clone().add(new THREE.Vector3(0,1.1,0)).sub(camera.position);yaw=Math.atan2(-d.x,-d.z);pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));}

addEventListener('keydown',e=>{
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();keys.add(e.code);initAudio();if(e.repeat)return;
 switch(e.code){case 'KeyE':grab();break;case 'KeyJ':toggleJuggle();break;case 'KeyQ':release(e.shiftKey);break;case 'KeyG':eat();break;case 'KeyT':dance();break;case 'Space':scare();break;case 'KeyF':pet();break;case 'KeyR':reset();break;case 'Digit1':lookAtCharacter(0);break;case 'Digit2':lookAtCharacter(1);break;case 'Digit3':lookAtCharacter(2);break;case 'KeyM':muted=!muted;if(master)master.gain.setTargetAtTime(muted?0:.65,audioContext.currentTime,.1);break;}
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
let mouseDown=false,mouseMoved=false,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;initAudio();mouseDown=true;mouseMoved=false;lastX=e.clientX;lastY=e.clientY;if(document.pointerLockElement===canvas){if(e.button===0)grab();else if(e.button===2)release(false);}else if(e.button===0){try{const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>{});}catch{}}});
addEventListener('pointerup',()=>mouseDown=false);
addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw-=e.movementX*.0021;pitch-=e.movementY*.0018;}else if(mouseDown){yaw-=(e.clientX-lastX)*.003;pitch-=(e.clientY-lastY)*.003;lastX=e.clientX;lastY=e.clientY;mouseMoved=true;}pitch=clamp(pitch,-1.1,.82);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// Invisible touch gestures keep the world free of interface elements.
const touches=new Map();let touchMove={x:0,y:0},touchGestureAt=0;
canvas.addEventListener('touchstart',e=>{e.preventDefault();initAudio();for(const t of e.changedTouches)touches.set(t.identifier,{x:t.clientX,y:t.clientY,lastX:t.clientX,lastY:t.clientY,at:time,travel:0,left:t.clientX<innerWidth*.43});if(e.touches.length===2){touchGestureAt=time;dance();}else if(e.touches.length===3){touchGestureAt=time;toggleJuggle();}},{passive:false});
canvas.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){const a=touches.get(t.identifier);if(!a)continue;a.travel+=Math.hypot(t.clientX-a.lastX,t.clientY-a.lastY);if(a.left){touchMove.x=clamp((t.clientX-a.x)/65,-1,1);touchMove.y=clamp((t.clientY-a.y)/65,-1,1);}else{yaw-=(t.clientX-a.lastX)*.004;pitch=clamp(pitch-(t.clientY-a.lastY)*.004,-1.1,.82);}a.lastX=t.clientX;a.lastY=t.clientY;}},{passive:false});
canvas.addEventListener('touchend',e=>{e.preventDefault();for(const t of e.changedTouches){const a=touches.get(t.identifier);if(!a)continue;if(time-touchGestureAt>.5&&a.travel<15){if(time-a.at>.65)eat();else{if(held.length)release();else{const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(t.clientX/innerWidth*2-1,1-t.clientY/innerHeight*2),camera);const hit=ray.intersectObjects(characters.filter(c=>c.root.visible).map(c=>c.root),true)[0];if(hit){let obj=hit.object;while(obj.parent&&!characters.some(c=>c.root===obj))obj=obj.parent;const index=characters.findIndex(c=>c.root===obj);if(index>=0)lookAtCharacter(index);}grab();}}}if(a.left)touchMove={x:0,y:0};touches.delete(t.identifier);}},{passive:false});

function moveCharacter(c,target,speed,dt){const dx=target.x-c.root.position.x,dz=target.z-c.root.position.z,dist=Math.hypot(dx,dz);if(dist<.03)return false;const step=Math.min(dist,speed*dt);c.root.position.x+=dx/dist*step;c.root.position.z+=dz/dist*step;const desired=Math.atan2(dx,dz);c.root.rotation.y+=Math.atan2(Math.sin(desired-c.root.rotation.y),Math.cos(desired-c.root.rotation.y))*Math.min(1,dt*5);return true;}
function facePlayer(c,dt){const d=Math.atan2(camera.position.x-c.root.position.x,camera.position.z-c.root.position.z);c.root.rotation.y+=Math.atan2(Math.sin(d-c.root.rotation.y),Math.cos(d-c.root.rotation.y))*Math.min(1,dt*3);}
function updateCharacter(c,dt){
 if(c.state==='eaten')return;
 const t=time-c.stateAt,dist=c.root.position.distanceTo(camera.position),s=c.state;
 let walk=0,bob=0;
 c.root.scale.setScalar(1);c.rig.rotation.x=lerp(c.rig.rotation.x,0,dt*5);c.rig.rotation.z=lerp(c.rig.rotation.z,0,dt*5);c.rig.position.y=0;
 if(s==='held'||s==='juggle'){
  const i=held.indexOf(c),n=held.length;
  let x=(i-(n-1)/2)*(n>1?1.35:0),y=-1.5,z=n>1?-3.5:-2.6;
  if(s==='juggle'){const u=((time-c.stateAt)/3.2+i/Math.max(1,n))%1;x=-1.15+2.3*u;y=-1.5+2.45*4*u*(1-u);z=-3.6; c.rig.rotation.z=Math.sin(u*Math.PI*2)*.28;c.rig.rotation.x=Math.sin(u*Math.PI*2)*.12;if((u<.02||u>.98)&&time>c.nextVoice)voice(c,'fear');}
  else{y+=Math.sin(time*2+i)*.045;c.rig.rotation.z=Math.sin(time*5+i)*.05;}
  const target=new THREE.Vector3(x,y,z).applyQuaternion(camera.quaternion).add(camera.position);c.root.position.lerp(target,Math.min(1,dt*7));facePlayer(c,dt*2);c.weapon.visible=true;
 }else if(s==='eating'){
  const u=clamp(t/1.05,0,1),target=new THREE.Vector3(0,-.1,-.13).applyQuaternion(camera.quaternion).add(camera.position);c.root.position.lerpVectors(c.eatFrom,target,u*u);c.root.scale.setScalar(1-u*.95);c.rig.rotation.z=Math.sin(u*8)*.18;if(u>=1){c.root.visible=false;state(c,'eaten');}
 }else if(s==='thrown'){
  c.velocity.y-=5*dt;c.root.position.addScaledVector(c.velocity,dt);c.rig.rotation.z+=dt*1.4;facePlayer(c,dt);
  if(c.root.position.y<=.03){c.root.position.y=0;state(c,'trip',2.8);setFace(c,'cry');effect(125,.16,.07);}
 }else if(s==='trip'){
  c.rig.rotation.z=lerp(c.rig.rotation.z,c.type===2?-.7:-1.2,Math.min(1,dt*7));c.rig.position.y=.63;c.weapon.visible=true;setFace(c,c.type===2?'dizzy':'cry');
  if(t>2.1){const recovery=1-clamp((t-2.1)/.7,0,1);c.rig.rotation.z*=recovery;c.rig.position.y*=recovery;}
  if(time>c.until){state(c,'cautious',4);setFace(c,'scared');}
 }else if(s==='cautious'){
  facePlayer(c,dt);c.rig.rotation.z=Math.sin(time*12+c.type)*.012;c.weapon.rotation.z=-.35+Math.sin(time*4)*.04;
  if(time>=c.until){if(c.danceReact>c.stateAt-.1&&time-c.danceReact<2){state(c,'follow',120);c.fear=0;setFace(c,'happy');c.weapon.visible=true;voice(c,'happy');}else{state(c,'idle');setFace(c,'calm');c.weapon.visible=true;}}
 }else if(s==='follow'){
  setFace(c,'happy');c.weapon.visible=true;const side=(c.type-1)*1.9,forward=4.2+(c.type===1?.15:0),target=new THREE.Vector3(camera.position.x-Math.sin(yaw)*forward+Math.cos(yaw)*side,0,camera.position.z-Math.cos(yaw)*forward-Math.sin(yaw)*side);
  if(moveCharacter(c,target,.72+c.type*.04,dt))walk=1;facePlayer(c,dt*2);bob=Math.abs(Math.sin(time*4.5+c.type))*.055;
  if(time>c.nextVoice&&time>voiceNext){voice(c,'happy');voiceNext=time+16;}
 }else if(s==='flee'){
  const away=new THREE.Vector3(c.root.position.x-camera.position.x,0,c.root.position.z-camera.position.z).normalize(),target=c.root.position.clone().addScaledVector(away,2);if(Math.hypot(target.x,target.z)>12)target.set(c.home.x+Math.sin(time)*3,0,-6);
  moveCharacter(c,target,c.type===0?1.35:1.6,dt);walk=1.5;bob=Math.abs(Math.sin(time*8))*.1;
  if(time>c.tripAt){state(c,'trip',3.1);c.tripAt=Infinity;voice(c,'fear');}
  else if(time>c.until){state(c,'cautious',4);setFace(c,'scared');}
 }else if(s==='defend'){
  facePlayer(c,dt);c.weapon.visible=true;c.arms[1].rotation.x=-.65+Math.sin(time*8)*.04;c.weapon.rotation.z=-.35+Math.sin(time*6)*.06;setFace(c,'scared');
  if(time>c.until){state(c,'flee',6);c.tripAt=time+2.4;c.weapon.visible=true;}
 }else if(s==='dodge'){
  const target=c.home.clone().add(new THREE.Vector3(Math.sin(t*1.1)*2,0,-1.1));moveCharacter(c,target,1.8,dt);facePlayer(c,dt*2);walk=1.4;bob=Math.abs(Math.sin(t*4))*.24;c.weapon.visible=true;setFace(c,'angry');
  if(time>c.until){state(c,'cautious',3);setFace(c,'calm');}
 }else{
  c.fear=Math.max(0,c.fear-dt*.06);facePlayer(c,dt*.7);c.rig.rotation.z=Math.sin(time*.9+c.type*2)*.018;bob=Math.sin(time*1.5+c.type)*.012;
  if(time>c.nextIdle){c.nextIdle=time+rng(7,14);if(c.type===0&&dist<4.1){state(c,'cautious',3);setFace(c,'scared');}else if(c.type===2){state(c,'curious',2.5);setFace(c,'calm');}else{setFace(c,Math.random()<.5?'happy':'calm');if(Math.random()<.35)voice(c,'idle');}}
  if(s==='curious'){c.rig.rotation.z=Math.sin(t*1.1)*.12;if(time>c.until)state(c,'idle');}
 }
 if(!['held','juggle','eating','thrown'].includes(s))c.root.position.y=bob;
 if(walk){for(let i=0;i<2;i++){c.feet[i].position.y=c.footRest[i]+Math.max(0,Math.sin(time*7*walk+i*Math.PI))*.1;c.arms[i].rotation.x=Math.sin(time*7*walk+i*Math.PI)*.35;}}else{for(let i=0;i<2;i++){c.feet[i].position.y=c.footRest[i];if(s!=='defend')c.arms[i].rotation.x=lerp(c.arms[i].rotation.x,held.includes(c)?-.6:0,dt*4);}}
 const alarm=['cry','scared'].includes(c.face);c.tears.forEach((tear,i)=>{tear.visible=c.face==='cry'||(alarm&&c.type===0);if(tear.visible){tear.position.y=.95-((time*1.1+i*.4)%1)*.34;tear.position.z=.52;tear.scale.y=.11+Math.sin(time*7)*.025;}});
 c.ears.forEach((ear,i)=>{if(c.type===2)ear.rotation.z=(i===0?-.035:.035)+Math.sin(time*1.7+i)*.025+(alarm?(i===0?-.12:.12):0);});
 c.tail.rotation.y=Math.sin(time*2+c.type)*.16;
}

function updatePlayer(dt){
 let vx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touchMove.x;
 let vz=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touchMove.y;
 const magnitude=Math.hypot(vx,vz);if(magnitude>1){vx/=magnitude;vz/=magnitude;}
 const speed=keys.has('ShiftLeft')?2.4:1.5;
 const dx=(vx*Math.cos(yaw)+vz*Math.sin(yaw))*speed*dt,dz=(-vx*Math.sin(yaw)+vz*Math.cos(yaw))*speed*dt;
 if(magnitude>.03){const next=camera.position.clone();next.x+=dx;next.z+=dz;let blocked=false;for(const tree of trees){if(Math.hypot(next.x-tree.x,next.z-tree.z)<tree.r+.4){blocked=true;break;}}if(!blocked&&Math.hypot(next.x,next.z)<29){camera.position.x=next.x;camera.position.z=next.z;}motion+=dt*4;stepTime+=dt;if(stepTime>.65){stepTime=0;effect(rng(65,90),.1,.025,'triangle');}}
 const dancing=time<danceUntil,danceTime=time-danceStart;
 camera.position.y=2.75+(magnitude>.03?Math.sin(motion)*.018:Math.sin(time*.8)*.008)+(dancing?Math.sin(danceTime*3.4)*.055:0);
 camera.rotation.set(pitch+(dancing?Math.sin(danceTime*3.4)*.018:0),yaw,dancing?Math.sin(danceTime*1.7)*.025:0);
 handReach=lerp(handReach,0,dt*4);
 for(let i=0;i<2;i++){const s=i===0?-1:1,h=hands[i];let x=s*1.04,y=-.94,z=-1.4,rz=s*.12;
  if(dancing){x=s*(1+Math.sin(danceTime*1.7)*.35);y=-.65+Math.sin(danceTime*3.4+i*Math.PI)*.33;z=-1.55;rz=s*.32+Math.sin(danceTime*1.7)*.4;}
  else if(juggling){y=-.9+Math.sin(time*3.92+i*Math.PI)*.24;x=s*1.05;z=-1.8;rz=Math.sin(time*3.92+i*Math.PI)*.13;}
  else if(held.length){y=-1.1;x=s*.76;z=-1.9;rz=s*.22;}
  else{y+=Math.sin(time*1.5+i*.4)*.025;if(time<petUntil){y+=.45+Math.sin(time*7)*.1;z=-2.1;}}
  const narrow=clamp(camera.aspect/1.15,.52,1);x*=narrow;h.scale.setScalar(narrow);y+=handReach*.18;z-=handReach*.4;h.position.lerp(new THREE.Vector3(x,y,z),Math.min(1,dt*8));h.rotation.z=lerp(h.rotation.z,rz,dt*7);h.rotation.x=Math.sin(time*1.5+i)*.018;
 }
}

function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;time+=dt;updatePlayer(dt);for(const c of characters)updateCharacter(c,dt);motes.rotation.y=Math.sin(time*.025)*.12;
 const p=dustGeo.attributes.position;for(let i=0;i<160;i++){p.array[i*3+1]+=Math.sin(time*.3+i)*dt*.025;p.array[i*3]+=Math.sin(time*.12+i)*dt*.014;}p.needsUpdate=true;renderer.render(scene,camera);if(Math.floor(time*4)!==Math.floor((time-dt)*4))canvas.dataset.simulation=JSON.stringify(window.forestSimulation.snapshot);
}
requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.fov=viewFov();camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
// A read-only snapshot makes behavioural verification possible without adding UI.
window.forestSimulation={get snapshot(){return {time,dancing:time<danceUntil,juggling,held:held.map(c=>c.name),position:camera.position.toArray(),characters:characters.map(c=>({name:c.name,state:c.state,face:c.face,visible:c.root.visible,position:c.root.position.toArray()})),assetSource:'Nini / original published meshes',audioLoaded:[...audioCache.keys()],drawCalls:renderer.info.render.calls};}};
