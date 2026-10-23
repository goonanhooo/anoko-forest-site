import * as THREE from './vendor/three.module.js';
// Smooth the imported mesh while retaining UV seams and each part's bounds.
export function softenImportedGeometry(geometry,iterations=2){
 const p=geometry.attributes.position,u=geometry.attributes.uv,source=geometry.index?.array;
 let positions=[],faces=[],faceUV=[],weld=new Map(),remap=[];
 for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)],key=v.map(n=>Math.round(n*1e6)).join(',');if(!weld.has(key)){weld.set(key,positions.length);positions.push(v);}remap[i]=weld.get(key);}
 const oldMin=[0,1,2].map(a=>Math.min(...positions.map(v=>v[a]))),oldMax=[0,1,2].map(a=>Math.max(...positions.map(v=>v[a])));
 for(let i=0;i<(source?.length??p.count);i+=3){const ids=[0,1,2].map(k=>source?source[i+k]:i+k);faces.push(ids.map(id=>remap[id]));faceUV.push(ids.map(id=>[u.getX(id),u.getY(id)]));}
 for(let iteration=0;iteration<iterations;iteration++){
  const neighbours=positions.map(()=>new Set()),edges=new Map();
  function edge(a,b,opposite){const key=a<b?a+','+b:b+','+a;if(!edges.has(key))edges.set(key,{a:Math.min(a,b),b:Math.max(a,b),opposites:[]});edges.get(key).opposites.push(opposite);neighbours[a].add(b);neighbours[b].add(a);}
  for(const [a,b,c] of faces){edge(a,b,c);edge(b,c,a);edge(c,a,b);}
  const boundaries=positions.map(()=>[]);for(const e of edges.values())if(e.opposites.length===1){boundaries[e.a].push(e.b);boundaries[e.b].push(e.a);}
  const next=positions.map((v,i)=>{const border=boundaries[i];if(border.length===2)return v.map((q,a)=>q*.75+(positions[border[0]][a]+positions[border[1]][a])*.125);const ns=[...neighbours[i]],n=ns.length;if(n<3)return v.slice();const beta=n===3?3/16:3/(8*n);return v.map((q,a)=>q*(1-n*beta)+ns.reduce((s,j)=>s+positions[j][a],0)*beta);});
  for(const e of edges.values()){e.index=next.length;next.push([0,1,2].map(a=>e.opposites.length===2?(positions[e.a][a]+positions[e.b][a])*3/8+(positions[e.opposites[0]][a]+positions[e.opposites[1]][a])/8:(positions[e.a][a]+positions[e.b][a])*.5));}
  const nextFaces=[],nextUV=[],mid=(a,b)=>a.map((v,i)=>(v+b[i])*.5),eid=(a,b)=>edges.get(a<b?a+','+b:b+','+a).index;
  faces.forEach(([a,b,c],i)=>{const ab=eid(a,b),bc=eid(b,c),ca=eid(c,a),[ua,ub,uc]=faceUV[i],uab=mid(ua,ub),ubc=mid(ub,uc),uca=mid(uc,ua);nextFaces.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);nextUV.push([ua,uab,uca],[ub,ubc,uab],[uc,uca,ubc],[uab,ubc,uca]);});positions=next;faces=nextFaces;faceUV=nextUV;
 }
 const min=[0,1,2].map(a=>Math.min(...positions.map(v=>v[a]))),max=[0,1,2].map(a=>Math.max(...positions.map(v=>v[a])));positions=positions.map(v=>v.map((q,a)=>(q-min[a])/Math.max(1e-7,max[a]-min[a])*(oldMax[a]-oldMin[a])+oldMin[a]));
 const normals=positions.map(()=>[0,0,0]);for(const f of faces){const [a,b,c]=f.map(i=>positions[i]),ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];for(const id of f)for(let k=0;k<3;k++)normals[id][k]+=n[k];}
 for(const n of normals){const len=Math.hypot(...n)||1;for(let a=0;a<3;a++)n[a]/=len;}const pos=[],nor=[],uv=[];faces.forEach((f,i)=>f.forEach((v,j)=>{pos.push(...positions[v]);nor.push(...normals[v]);uv.push(...faceUV[i][j]);}));
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));out.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return out;
}
