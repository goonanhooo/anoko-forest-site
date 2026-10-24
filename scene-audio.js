const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function reactionForState(character,requested='fear'){
 if(!['fear','idle'].includes(requested))return requested;
 if(requested==='idle')return null;
 if(character.state==='juggle')return 'juggle';
 if(['held','eating'].includes(character.state))return 'held';
 if(['thrown','trip'].includes(character.state))return 'drop';
 if(character.face==='sad'||character.state==='mourn')return 'upset';
 return 'flee';
}

// Only recorded character voices and the requested dance chant are played.
export class SceneAudio {
 constructor({fetcher=globalThis.fetch.bind(globalThis),contextFactory=()=>new AudioContext()}={}){
  this.fetcher=fetcher;this.contextFactory=contextFactory;this.context=null;this.muted=false;this.paused=false;
  this.files=new Map();this.buffers=new Map();this.active=new Map();this.tokens=[0,0,0];this.next=[0,0,0];this.sequence=[0,0,0];
  this.nextBackground=0;this.recent=[];this.errors=[];this.danceToken=0;this.danceSource=null;this.nextTick=0;
  this.bankReady=this.loadBank();
 }
 async loadBank(){
  try{
   const response=await this.fetcher('./assets/audio/manifest.json');if(!response.ok)throw Error('Audio manifest unavailable');
   this.bank=await response.json();
   const filenames=new Set(this.bank.characters.flatMap(c=>Object.values(c.events).flat()).concat(this.bank.dance.file));
   for(const file of filenames){
    const promise=this.fetcher('./assets/audio/'+file).then(r=>{if(!r.ok)throw Error('Missing audio: '+file);return r.arrayBuffer();});
    // Retain failures without producing unhandled rejections during preloading.
    promise.catch(error=>this.errors.push(String(error.message)));this.files.set(file,promise);
   }
   return this.bank;
  }catch(error){this.errors.push(String(error.message));return null;}
 }
 unlock(){
  if(!this.context){
   try{
    const context=this.context=this.contextFactory();this.master=context.createGain();this.voices=context.createGain();this.song=context.createGain();
    const limiter=context.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=15;limiter.ratio.value=5;limiter.attack.value=.005;limiter.release.value=.12;
    this.master.gain.value=this.muted?0:.8;this.voices.gain.value=.8;this.song.gain.value=.8;
    this.voices.connect(limiter);this.song.connect(limiter);limiter.connect(this.master);this.master.connect(context.destination);
   }catch(error){this.errors.push(String(error.message));return;}
  }
  if(!this.paused)this.context.resume().catch(()=>{});
 }
 async buffer(file){
  if(!this.buffers.has(file))this.buffers.set(file,this.files.get(file).then(data=>this.context.decodeAudioData(data.slice(0))));
  return this.buffers.get(file);
 }
 setMuted(value){this.muted=value;if(this.master)this.master.gain.setTargetAtTime(value?0:.8,this.context.currentTime,.04);}
 setPaused(value){this.paused=value;if(this.context)(value?this.context.suspend():this.context.resume()).catch(()=>{});}
 stopVoice(type){
  const entry=this.active.get(type);if(!entry)return;this.active.delete(type);
  const now=this.context.currentTime;entry.gain.gain.setTargetAtTime(0,now,.015);try{entry.source.stop(now+.06);}catch{}
 }
 async play(character,event,{force=false,delay=0}={}){
  if(!event||!this.context||this.muted||this.paused)return false;
  const type=character.type,now=this.context.currentTime;
  if(!force&&(now<this.next[type]||now<this.nextBackground||this.danceSource||this.dancePending))return false;
  const token=++this.tokens[type],state=character.state;
  this.next[type]=now+(force?.25:4.5);if(!force)this.nextBackground=now+1.1;
  if(force)this.stopVoice(type);
  try{
   const bank=await this.bankReady,choices=bank?.characters[type]?.events[event];if(!choices?.length)return false;
   const file=choices[this.sequence[type]++%choices.length],buffer=await this.buffer(file);
   if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay*1000));
   if(token!==this.tokens[type]||character.state!==state||this.muted||this.paused)return false;
   if(this.active.size>=2){const oldest=[...this.active.values()].sort((a,b)=>a.at-b.at)[0];this.stopVoice(oldest.type);}
   this.stopVoice(type);
   const context=this.context,source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();source.buffer=buffer;
   const p=character.root.position,listener=this.listener||{x:0,y:2.75,z:6.5,yaw:0},dx=p.x-listener.x,dz=p.z-listener.z,distance=Math.hypot(dx,p.y-listener.y,dz);
   pan.pan.value=clamp((dx*Math.cos(listener.yaw)-dz*Math.sin(listener.yaw))/7,-.75,.75);
   gain.gain.value=.9*clamp(1-distance/26,.18,1);source.connect(gain).connect(pan).connect(this.voices);
   const at=context.currentTime;this.active.set(type,{type,event,source,gain,at});
   source.onended=()=>{if(this.active.get(type)?.source===source)this.active.delete(type);source.disconnect();gain.disconnect();pan.disconnect();};
   source.start(at);this.next[type]=at+Math.max(event==='flee'?6:4.6,buffer.duration+1);
   this.recent.push({character:character.name,event,file,at:Number(at.toFixed(2))});this.recent=this.recent.slice(-16);return true;
  }catch(error){this.errors.push(String(error.message));return false;}
 }
 async startDance(duration=8){
  if(!this.context||this.muted||this.paused)return;
  this.stopDance();const token=this.danceToken;this.dancePending=true;
  for(const type of this.active.keys())this.stopVoice(type);
  try{
   const bank=await this.bankReady;if(!bank)return;const buffer=await this.buffer(bank.dance.file);
   if(token!==this.danceToken||this.muted||this.paused)return;
   for(const type of this.active.keys())this.stopVoice(type);
   const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.song);this.danceSource=source;this.dancePending=false;
   this.voices.gain.setTargetAtTime(.15,this.context.currentTime,.04);
   source.onended=()=>{if(this.danceSource===source){this.danceSource=null;this.voices.gain.setTargetAtTime(.8,this.context.currentTime,.08);}source.disconnect();};
   source.start();source.stop(this.context.currentTime+Math.min(duration,buffer.duration));
   this.recent.push({character:'아노코',event:'dance',file:bank.dance.file,at:Number(this.context.currentTime.toFixed(2))});this.recent=this.recent.slice(-16);
  }catch(error){this.errors.push(String(error.message));}finally{if(token===this.danceToken)this.dancePending=false;}
 }
 stopDance(){
  this.danceToken++;this.dancePending=false;if(this.danceSource){try{this.danceSource.stop();}catch{}this.danceSource=null;}
  if(this.voices)this.voices.gain.setTargetAtTime(.8,this.context.currentTime,.08);
 }
 reset(){this.tokens=this.tokens.map(t=>t+1);for(const type of this.active.keys())this.stopVoice(type);this.next=[0,0,0];this.nextBackground=0;this.stopDance();}
 tick(characters,time,position,yaw,dancing){
  this.listener={x:position.x,y:position.y,z:position.z,yaw};
  if(!dancing&&this.danceSource)this.stopDance();
  if(!this.context||this.muted||this.paused||time<this.nextTick||dancing)return;this.nextTick=time+.4;
  for(const c of characters){if(['held','juggle','flee','mourn','defend','dodge'].includes(c.state))this.play(c,reactionForState(c));}
 }
 get snapshot(){return {ambient:false,synthesizedEffects:false,ready:!!this.bank,loaded:this.buffers.size,active:[...this.active.values()].map(v=>({type:v.type,event:v.event})),dance:!!this.danceSource,muted:this.muted,recent:this.recent.slice(),errors:this.errors.slice(-4)};}
}
