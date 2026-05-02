'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type BuildingAppearance = {
  buildingType?: 'residential' | 'commercial' | 'office' | 'villa' | 'mixed_use';
  facadeMode?: 'image' | 'procedural' | 'hybrid';
  primaryMaterial?: 'stone' | 'brick' | 'cement' | 'glass' | 'composite' | 'paint';
  secondaryMaterial?: 'stone' | 'brick' | 'cement' | 'glass' | 'composite' | 'paint';
  primaryColor?: string;
  secondaryColor?: string;
  roofType?: 'flat' | 'gable' | 'parapet';
  roofColor?: string;
  entranceSide?: 'front' | 'back' | 'left' | 'right';
  entranceWidth?: number;
  entranceHeight?: number;
  groundFloorHeight?: number;
  windowStyle?: 'grid' | 'modern' | 'vertical' | 'strip';
  windowColsFront?: number; windowColsBack?: number; windowColsLeft?: number; windowColsRight?: number;
  windowRows?: number; windowWidth?: number; windowHeight?: number;
  balconySides?: ('front' | 'back' | 'left' | 'right')[]; balconyEveryNFloor?: number; balconyDepth?: number;
  cornerChamfer?: boolean; parapetHeight?: number;
};
type SiteContext = {
  contextMode?: 'manual' | 'osm' | 'hybrid';
  environmentPreset?: 'dense_urban' | 'urban_street' | 'suburban' | 'villa' | 'commercial_strip';
  lotWidth?: number; lotDepth?: number; setbackFront?: number; setbackBack?: number; setbackLeft?: number; setbackRight?: number; siteRotationDeg?: number;
  roadSides?: ('front'|'back'|'left'|'right')[]; roadWidthFront?: number; roadWidthBack?: number; roadWidthLeft?: number; roadWidthRight?: number; sidewalkWidth?: number;
  addFence?: boolean; fenceType?: 'none' | 'metal' | 'wall' | 'hedge'; addGate?: boolean; gateSide?: 'front'|'back'|'left'|'right';
  treeCount?: number; shrubCount?: number; parkingCount?: number; addStreetLights?: boolean; neighborMode?: 'none'|'simple'|'custom'; neighborCount?: number;
};

export type Property3DData = { id?: string; slug?: string; title: string; googleMapsUrl?: string; buildingArea?: number; buildingHeight?: number; floors?: number; floorHeight?: number; rotationDeg?: number; description?: string; facadeFrontUrl?: string; facadeBackUrl?: string; facadeLeftUrl?: string; facadeRightUrl?: string; modelUrl?: string; footprintWidth?: number; footprintDepth?: number; buildingAppearance?: BuildingAppearance; siteContext?: SiteContext; };

const coord = (url?: string) => { if (!url) return null; const a=url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/); if (a) return {lat:+a[1],lng:+a[2]}; const b=url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/); return b?{lat:+b[1],lng:+b[2]}:null; };
const dim=(d:Property3DData)=>{const f=d.floors&&d.floors>0?d.floors:4; const h=d.buildingHeight&&d.buildingHeight>0?d.buildingHeight:f*(d.floorHeight||3); const s=d.buildingArea?Math.sqrt(d.buildingArea):12; return {width:d.footprintWidth||s,depth:d.footprintDepth||s,height:h,floors:f};};
const preset=(d:{width:number;depth:number},s?:SiteContext)=>{const p=s?.environmentPreset||'urban_street'; const map:any={dense_urban:{lotMul:1.6,n:8,t:2,r:['front','back']},urban_street:{lotMul:2.2,n:5,t:6,r:['front']},suburban:{lotMul:3,n:2,t:8,r:['front']},villa:{lotMul:3.4,n:1,t:10,r:['front']},commercial_strip:{lotMul:2.6,n:4,t:2,r:['front']}}[p]; return {lotW:s?.lotWidth||d.width*map.lotMul,lotD:s?.lotDepth||d.depth*map.lotMul,neighbors:s?.neighborCount||map.n,trees:s?.treeCount??map.t,roads:s?.roadSides||map.r,p};};

export function Property3DViewer({ data }: { data: Property3DData }) {
  const ref=useRef<HTMLDivElement|null>(null); const controlsRef=useRef<any>(null); const frame=useRef<number | null>(null);
  const [auto,setAuto]=useState(true); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [osm,setOsm]=useState<any>(null);
  const d=useMemo(()=>dim(data),[data]); const s=useMemo(()=>preset(d,data.siteContext),[d,data.siteContext]);

  useEffect(()=>{ const c=coord(data.googleMapsUrl); const m=data.siteContext?.contextMode||'manual'; if (!c || (m!=='osm'&&m!=='hybrid')) return; fetch(`/api/osm-context?lat=${c.lat}&lng=${c.lng}`).then(r=>r.ok?r.json():null).then(setOsm).catch(()=>setOsm(null)); },[data.googleMapsUrl,data.siteContext?.contextMode]);

  useEffect(()=>{ const el=ref.current; if(!el)return; const scene=new THREE.Scene(); scene.background=new THREE.Color('#0f172a');
    const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.shadowMap.enabled=true; el.appendChild(renderer.domElement);
    const cam=new THREE.PerspectiveCamera(50,1,0.1,2500); cam.position.set(d.width*2.3,d.height*1.2,d.depth*2.3);
    const controls=new OrbitControls(cam,renderer.domElement); controlsRef.current=controls; controls.enableDamping=true; controls.target.set(0,d.height*0.45,0); controls.minDistance=Math.max(d.width,d.depth)*0.6; controls.maxDistance=600;
    scene.add(new THREE.AmbientLight(0xffffff,0.5),new THREE.HemisphereLight(0xcde7ff,0x2f3640,0.7)); const sun=new THREE.DirectionalLight(0xffffff,1.15); sun.position.set(70,80,40); sun.castShadow=true; scene.add(sun);

    const mats:any[]=[]; const geos:any[]=[]; const texs:any[]=[];
    const add=(m:any)=>{scene.add(m);};

    const lot=new THREE.Mesh(new THREE.PlaneGeometry(s.lotW,s.lotD),new THREE.MeshStandardMaterial({color:'#2f3f52'})); lot.rotation.x=-Math.PI/2; lot.receiveShadow=true; add(lot);
    const grass=new THREE.Mesh(new THREE.PlaneGeometry(s.lotW*1.4,s.lotD*1.4),new THREE.MeshStandardMaterial({color:'#27353f'})); grass.rotation.x=-Math.PI/2; grass.position.y=-0.02; add(grass);

    const roads=s.roads as string[]; roads.forEach((side)=>{ const w=(data.siteContext as any)?.[`roadWidth${side[0].toUpperCase()+side.slice(1)}`]||10; const g=side==='front'||side==='back'?new THREE.PlaneGeometry(s.lotW*1.3,w):new THREE.PlaneGeometry(w,s.lotD*1.3); const r=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#1b2431'})); r.rotation.x=-Math.PI/2; if(side==='front')r.position.z=s.lotD/2+w/2; if(side==='back')r.position.z=-s.lotD/2-w/2; if(side==='left')r.position.x=-s.lotW/2-w/2; if(side==='right')r.position.x=s.lotW/2+w/2; add(r); geos.push(g); });

    const root=new THREE.Group(); root.rotation.y=THREE.MathUtils.degToRad(data.rotationDeg||0); add(root);
    const loader=new THREE.TextureLoader(); loader.crossOrigin='anonymous';
    const bApp=data.buildingAppearance||{}; const baseColor=bApp.primaryColor||'#cbd5e1';

    const buildProcedural=async()=>{ const g=new THREE.BoxGeometry(d.width,d.height,d.depth); geos.push(g);
      const [r,l,f,b]=await Promise.all([loader.loadAsync(data.facadeRightUrl||'').catch(()=>null),loader.loadAsync(data.facadeLeftUrl||'').catch(()=>null),loader.loadAsync(data.facadeFrontUrl||'').catch(()=>null),loader.loadAsync(data.facadeBackUrl||'').catch(()=>null)]);
      [r,l,f,b].forEach((t:any)=>{if(t){t.colorSpace=THREE.SRGBColorSpace; texs.push(t);}});
      const mm=(t:any)=>t&&bApp.facadeMode!=='procedural'?new THREE.MeshStandardMaterial({map:t,roughness:0.86}):new THREE.MeshStandardMaterial({color:baseColor,roughness:0.9});
      const mats6=[mm(r),mm(l),new THREE.MeshStandardMaterial({color:bApp.roofColor||'#9ca3af'}),new THREE.MeshStandardMaterial({color:'#94a3b8'}),mm(f),mm(b)]; mats.push(...mats6);
      const body=new THREE.Mesh(g,mats6); body.position.y=d.height/2; body.castShadow=true; body.receiveShadow=true; root.add(body);
      const bandM=new THREE.MeshStandardMaterial({color:bApp.secondaryColor||'#64748b'}); mats.push(bandM);
      for(let i=1;i<d.floors;i++){ const y=(d.height/d.floors)*i; const band=new THREE.Mesh(new THREE.BoxGeometry(d.width*1.01,0.12,d.depth*1.01),bandM); band.position.y=y; root.add(band); }
      const cols={front:bApp.windowColsFront||Math.max(3,Math.floor(d.width/2.4)),back:bApp.windowColsBack||Math.max(3,Math.floor(d.width/2.4)),left:bApp.windowColsLeft||Math.max(2,Math.floor(d.depth/2.6)),right:bApp.windowColsRight||Math.max(2,Math.floor(d.depth/2.6))};
      const rows=bApp.windowRows||Math.max(2,d.floors-1); const wM=new THREE.MeshStandardMaterial({color:'#1e293b',emissive:'#334155',emissiveIntensity:0.25}); mats.push(wM);
      const place=(side:'front'|'back'|'left'|'right')=>{ const count=cols[side]; for(let rr=0;rr<rows;rr++){ for(let cc=0;cc<count;cc++){ const ww=bApp.windowWidth||0.8,hh=bApp.windowHeight||1.1; const pane=new THREE.Mesh(new THREE.PlaneGeometry(ww,hh),wM); const x=((cc+1)/(count+1)-0.5)*(side==='front'||side==='back'?d.width*0.85:d.depth*0.85); const y=((rr+1)/(rows+1))*d.height*0.8+0.8; if(side==='front'){pane.position.set(x,y,d.depth/2+0.02);} if(side==='back'){pane.position.set(-x,y,-d.depth/2-0.02);pane.rotation.y=Math.PI;} if(side==='left'){pane.position.set(-d.width/2-0.02,y,x);pane.rotation.y=-Math.PI/2;} if(side==='right'){pane.position.set(d.width/2+0.02,y,-x);pane.rotation.y=Math.PI/2;} root.add(pane);} } };
      (['front','back','left','right'] as const).forEach(place);
      const eSide=bApp.entranceSide||'front'; const ew=bApp.entranceWidth||2.2,eh=bApp.entranceHeight||3; const ent=new THREE.Mesh(new THREE.PlaneGeometry(ew,eh),new THREE.MeshStandardMaterial({color:'#0b1220'})); mats.push(ent.material); let p:any=[0,eh/2,d.depth/2+0.04,0]; if(eSide==='back')p=[0,eh/2,-d.depth/2-0.04,Math.PI]; if(eSide==='left')p=[-d.width/2-0.04,eh/2,0,-Math.PI/2]; if(eSide==='right')p=[d.width/2+0.04,eh/2,0,Math.PI/2]; ent.position.set(p[0],p[1],p[2]); ent.rotation.y=p[3]; root.add(ent);
      if((bApp.balconySides||['front']).length){ const bM=new THREE.MeshStandardMaterial({color:'#475569'}); mats.push(bM); for(let fl=2;fl<=d.floors;fl+=(bApp.balconyEveryNFloor||2)){ (bApp.balconySides||[]).forEach(side=>{ const dep=bApp.balconyDepth||0.9; const bw=side==='front'||side==='back'?d.width*0.35:d.depth*0.35; const bg=new THREE.BoxGeometry(side==='front'||side==='back'?bw:dep,0.18,side==='front'||side==='back'?dep:bw); const ba=new THREE.Mesh(bg,bM); ba.position.y=(fl/d.floors)*d.height; if(side==='front')ba.position.z=d.depth/2+dep/2; if(side==='back')ba.position.z=-d.depth/2-dep/2; if(side==='left')ba.position.x=-d.width/2-dep/2; if(side==='right')ba.position.x=d.width/2+dep/2; root.add(ba); geos.push(bg); }); }}
      if((bApp.roofType||'parapet')==='gable'){ const rg=new THREE.ConeGeometry(Math.max(d.width,d.depth)*0.7,2.3,4); const rm=new THREE.MeshStandardMaterial({color:bApp.roofColor||'#64748b'}); mats.push(rm); const roof=new THREE.Mesh(rg,rm); roof.position.y=d.height+1.2; roof.rotation.y=Math.PI/4; root.add(roof); geos.push(rg);} else if((bApp.roofType||'parapet')==='parapet'){ const pg=new THREE.BoxGeometry(d.width*1.03,bApp.parapetHeight||0.8,d.depth*1.03); const pm=new THREE.MeshStandardMaterial({color:bApp.roofColor||'#64748b'}); mats.push(pm); const parapet=new THREE.Mesh(pg,pm); parapet.position.y=d.height+(bApp.parapetHeight||0.8)/2; root.add(parapet); geos.push(pg);} 
    };

    const context=()=>{ const n=data.siteContext?.neighborMode==='none'?0:s.neighbors; for(let i=0;i<n;i++){ const h=6+Math.random()*18; const nb=new THREE.Mesh(new THREE.BoxGeometry(6+Math.random()*10,h,6+Math.random()*10),new THREE.MeshStandardMaterial({color:'#4b5563'})); nb.position.set((Math.random()-0.5)*s.lotW*2.2,h/2,(Math.random()-0.5)*s.lotD*2.2); if(Math.abs(nb.position.x)<s.lotW*0.6&&Math.abs(nb.position.z)<s.lotD*0.6) nb.position.x+=s.lotW; add(nb);} for(let i=0;i<s.trees;i++){const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.2,1.3),new THREE.MeshStandardMaterial({color:'#6b4f36'})); const cr=new THREE.Mesh(new THREE.SphereGeometry(0.8,8,8),new THREE.MeshStandardMaterial({color:'#16a34a'})); tr.position.set((Math.random()-0.5)*s.lotW*1.4,0.65,(Math.random()-0.5)*s.lotD*1.4); cr.position.set(tr.position.x,1.8,tr.position.z); add(tr);add(cr);} if(osm?.roads){osm.roads.slice(0,6).forEach((r:any)=>{const geo=new THREE.PlaneGeometry(r.length||40,5); const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#0f172a'})); m.rotation.x=-Math.PI/2; m.position.set(r.cx||0,0.01,r.cz||0); add(m);});}}
    ;

    const run=async()=>{ if(data.modelUrl&&/\.(glb|gltf)$/i.test(data.modelUrl)){ try{const gltf=await new GLTFLoader().loadAsync(data.modelUrl); root.add(gltf.scene); setLoading(false);}catch{setError('Model failed, fallback procedural used.'); await buildProcedural(); setLoading(false);} } else {await buildProcedural(); setLoading(false);} context(); };
    run();

    const resize=()=>{const w=el.clientWidth||1,h=el.clientHeight||1; cam.aspect=w/h; cam.updateProjectionMatrix(); renderer.setSize(w,h);}; const ro=new ResizeObserver(resize); ro.observe(el); resize();
    const loop=()=>{frame.current=requestAnimationFrame(loop); controls.autoRotate=auto; controls.update(); renderer.render(scene,cam);}; loop();
    return ()=>{if(frame.current)cancelAnimationFrame(frame.current); ro.disconnect(); controls.dispose(); texs.forEach(t=>t.dispose?.()); mats.forEach(m=>m.dispose?.()); geos.forEach(g=>g.dispose?.()); renderer.dispose(); el.contains(renderer.domElement)&&el.removeChild(renderer.domElement);};
  },[data,d,s,auto,osm]);

  return <div className="relative h-[58vh] min-h-[380px] w-full"><div ref={ref} className="h-full w-full"/><div className="absolute left-3 top-3 rounded-lg bg-slate-900/80 px-3 py-2 text-sm text-white"><p className="font-semibold">{data.title}</p><p>Area: {Math.round((data.buildingArea||d.width*d.depth)*10)/10} m²</p><p>Height: {Math.round(d.height*10)/10} m</p><p>Floors: {d.floors}</p><p>Preset: {data.siteContext?.environmentPreset||'urban_street'}</p></div><div className="absolute bottom-3 right-3 flex gap-2"><button onClick={()=>controlsRef.current?.reset()} className="rounded bg-white/90 px-3 py-1 text-sm">Reset</button><button onClick={()=>setAuto(v=>!v)} className="rounded bg-white/90 px-3 py-1 text-sm">{auto?'Stop rotate':'Auto rotate'}</button><button onClick={()=>ref.current?.requestFullscreen?.()} className="rounded bg-white/90 px-3 py-1 text-sm">Fullscreen</button></div>{loading&&<p className="absolute bottom-3 left-3 rounded bg-slate-900/80 px-3 py-1 text-xs text-white">Loading 3D view…</p>}{error&&<p className="absolute bottom-10 left-3 rounded bg-amber-700/90 px-3 py-1 text-xs text-white">{error}</p>}</div>;
}
