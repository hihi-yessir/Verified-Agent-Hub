import { useState, useEffect, useRef, createContext, useContext } from "react";
import * as THREE from "three";

const themes={
  dark:{bg:'#0A0A0A',card:'#141414',cardBorder:'#222222',ink:'#EEEEEE',inkMuted:'#666666',blue:'#375BD2',blueDark:'#2A47A8',blueLight:'#5B7BF0',red:'#D94040',green:'#2EAD6B',meshLine:0xFFFFFF,dust:0x444444,logoDots:[0.3,0.6,0.9]},
  light:{bg:'#FAFAFA',card:'#FFFFFF',cardBorder:'#E0E0E0',ink:'#111111',inkMuted:'#999999',blue:'#375BD2',blueDark:'#2A47A8',blueLight:'#5B7BF0',red:'#D94040',green:'#2EAD6B',meshLine:0x000000,dust:0x999999,logoDots:[0.4,0.6,0.9]},
};
const ThemeCtx=createContext();

// 6 layers matching Whitewall OS 5-Gate + ACE pipeline
const LAYER_LABELS=['IDENTITY','VERIFICATION','LIVENESS','REPUTATION','DON CONSENSUS','ACE POLICY'];

function MeshBG(){
  const ref=useRef(null);
  const mouse=useRef({x:0,y:0});
  const raf=useRef(null);
  const{mode}=useContext(ThemeCtx);
  const modeRef=useRef(mode);
  useEffect(()=>{modeRef.current=mode;},[mode]);

  useEffect(()=>{
    const cv=ref.current;if(!cv)return;
    const W=cv.clientWidth,H=cv.clientHeight;
    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(40,W/H,0.1,200);
    cam.position.set(4,2,45);cam.lookAt(0,0,0);
    const r=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true});
    r.setSize(W,H);r.setPixelRatio(Math.min(devicePixelRatio,2));

    const layerDefs=[
      {x:-8,  op:0.12,spd:0.10,amp:0.45,seg:20,freq:0.40,thick:1,gap:0},
      {x:-4.8,op:0.10,spd:0.20,amp:0.38,seg:28,freq:0.25,thick:3,gap:0.15},
      {x:-1.5,op:0.15,spd:0.32,amp:0.30,seg:40,freq:0.28,thick:2,gap:0.2},
      {x:1.8, op:0.18,spd:0.45,amp:0.24,seg:48,freq:0.22,thick:4,gap:0.12},
      {x:5,   op:0.14,spd:0.60,amp:0.18,seg:34,freq:0.30,thick:2,gap:0.16},
      {x:8,   op:0.08,spd:0.78,amp:0.10,seg:22,freq:0.35,thick:2,gap:0.12},
    ];

    const meshMats=[],layers=[];
    const flash=new Float32Array(6);
    const pH=20,pW=20;

    layerDefs.forEach((c,li)=>{
      for(let t=0;t<c.thick;t++){
        const offset=(t-(c.thick-1)/2)*c.gap;
        const subSeg=Math.max(8,c.seg-t*4);
        const geo=new THREE.PlaneGeometry(pW,pH,subSeg,subSeg);
        const subOp=c.op*(1-t*0.15);
        const mat=new THREE.MeshBasicMaterial({color:0xFFFFFF,wireframe:true,transparent:true,opacity:Math.max(0.02,subOp),side:THREE.DoubleSide});
        mat.userData={baseOp:Math.max(0.02,subOp)};
        const mesh=new THREE.Mesh(geo,mat);
        mesh.rotation.y=Math.PI/2;mesh.position.x=c.x+offset;
        mesh.userData={...c,subIdx:t,layerIdx:li,orig:Float32Array.from(geo.attributes.position.array)};
        scene.add(mesh);layers.push(mesh);meshMats.push(mat);
      }
      const gSeg=Math.max(6,Math.floor(c.seg*0.3));
      const gGeo=new THREE.PlaneGeometry(pW,pH,gSeg,gSeg);
      const gMat=new THREE.MeshBasicMaterial({color:0x375BD2,wireframe:true,transparent:true,opacity:c.op*0.15,side:THREE.DoubleSide});
      gMat.userData={baseOp:c.op*0.15};
      const glow=new THREE.Mesh(gGeo,gMat);
      glow.rotation.y=Math.PI/2;glow.position.x=c.x;
      glow.userData={isGlow:true,layerIdx:li,origG:Float32Array.from(gGeo.attributes.position.array),...c};
      scene.add(glow);layers.push(glow);meshMats.push(gMat);
    });

    const agentGroup=new THREE.Group();scene.add(agentGroup);
    const agents=[],maxAgents=90;
    const blockChance=[0.50,0.50,0.50,0.50,0.50,0.50];

    function spawnAgent(){
      let blockedAt=-1;
      for(let i=0;i<blockChance.length;i++){if(Math.random()<blockChance[i]){blockedAt=i;break;}}
      const isGood=blockedAt===-1;
      const y=(Math.random()-0.5)*13,z=(Math.random()-0.5)*3;
      const geo=new THREE.SphereGeometry(0.06,6,6);
      const mat=new THREE.MeshBasicMaterial({color:0x375BD2,transparent:true,opacity:0.9});
      const mesh=new THREE.Mesh(geo,mat);mesh.position.set(-12,y,z);
      const tc=18,tGeo=new THREE.BufferGeometry(),tPos=new Float32Array(tc*3);
      for(let i=0;i<tc;i++){tPos[i*3]=-12;tPos[i*3+1]=y;tPos[i*3+2]=z;}
      tGeo.setAttribute('position',new THREE.BufferAttribute(tPos,3));
      const tMat=new THREE.LineBasicMaterial({color:0x375BD2,transparent:true,opacity:0.12});
      const trail=new THREE.Line(tGeo,tMat);
      agentGroup.add(mesh);agentGroup.add(trail);
      return{mesh,trail,tGeo,tPos,tc,y,z,isGood,blockedAt,speed:2.5+Math.random()*3.5,blocked:false,blockTime:0,dead:false,bobPh:Math.random()*Math.PI*2,lastLayerPassed:-1};
    }

    for(let i=0;i<22;i++){const a=spawnAgent();a.mesh.position.x=-12+Math.random()*22;for(let j=0;j<a.tc;j++){a.tPos[j*3]=a.mesh.position.x-j*0.15;a.tPos[j*3+1]=a.y;a.tPos[j*3+2]=a.z;}agents.push(a);}

    const dC=35,dGeo=new THREE.BufferGeometry(),dP=new Float32Array(dC*3);
    for(let i=0;i<dC;i++){dP[i*3]=(Math.random()-0.5)*30;dP[i*3+1]=(Math.random()-0.5)*18;dP[i*3+2]=(Math.random()-0.5)*4;}
    dGeo.setAttribute('position',new THREE.BufferAttribute(dP,3));
    const dustMat=new THREE.PointsMaterial({color:0x444444,size:0.02,transparent:true,opacity:0.1});
    scene.add(new THREE.Points(dGeo,dustMat));

    let spawnT=0;
    const anim=(time)=>{
      const t=time*0.001,dt=0.016,mx=mouse.current.x,my=mouse.current.y;
      const isDark=modeRef.current==='dark';
      const lineCol=isDark?0xFFFFFF:0x000000;
      dustMat.color.setHex(isDark?0x444444:0x999999);

      // Gentle flash decay
      for(let i=0;i<6;i++)flash[i]=Math.max(0,flash[i]-dt*1.8);

      layers.forEach(l=>{
        const li=l.userData.layerIdx;
        const fb=flash[li]||0;
        if(l.userData.isGlow){
          const pc=l.userData,o=l.userData.origG,g=l.geometry.attributes.position.array;
          for(let i=0;i<g.length;i+=3){g[i+2]=Math.sin(o[i]*pc.freq*1.1+t*pc.spd*1.3)*Math.cos(o[i+1]*pc.freq*0.5+t*pc.spd*0.4)*pc.amp*1.1;}
          l.geometry.attributes.position.needsUpdate=true;
          l.material.opacity=l.material.userData.baseOp*(0.7+0.3*Math.sin(t*pc.spd*1.8))+fb*0.12;
          return;
        }
        const{spd,amp,freq,orig,subIdx}=l.userData;if(!orig)return;
        if(l.material.color.getHex()!==lineCol)l.material.color.setHex(lineCol);
        const p=l.geometry.attributes.position.array,phase=subIdx*0.7;
        for(let i=0;i<p.length;i+=3){
          const ox=orig[i],oy=orig[i+1];
          let d=Math.sin(ox*freq+t*spd+phase)*Math.cos(oy*freq*0.7+t*spd*0.5)*amp;
          d+=Math.sin(ox*freq*2-t*spd*0.35+phase)*Math.cos(oy*freq*0.4+t*spd*0.15)*amp*0.35;
          d+=Math.sin(oy*freq*0.25+t*spd*0.8)*amp*0.2;
          const ddx=mx*10-ox,ddy=my*10-oy,dist=Math.sqrt(ddx*ddx+ddy*ddy);
          if(dist<5)d+=Math.sin(dist*1.2-t*2)*(1-dist/5)*0.12;
          p[i+2]=d;
        }
        l.geometry.attributes.position.needsUpdate=true;
        l.material.opacity=l.material.userData.baseOp+fb*0.08;
      });

      spawnT+=dt;
      if(spawnT>0.2&&agents.length<maxAgents){spawnT=0;agents.push(spawnAgent());}

      for(let i=agents.length-1;i>=0;i--){
        const a=agents[i];if(a.dead)continue;
        const px=a.mesh.position.x;
        if(!a.blocked){
          for(let li=0;li<layerDefs.length;li++){
            if(li>a.lastLayerPassed){const lx=layerDefs[li].x;if(px>=lx-0.3&&px<=lx+0.3){a.lastLayerPassed=li;flash[li]=Math.min(flash[li]+0.3,1.0);}}}
          if(a.blockedAt>=0){const lx=layerDefs[a.blockedAt].x;
            if(px>=lx-0.2&&px<=lx+0.2){a.blocked=true;a.blockTime=t;a.mesh.material.color.setHex(0xD94040);a.trail.material.color.setHex(0xD94040);a.trail.material.opacity=0.05;flash[a.blockedAt]=Math.min(flash[a.blockedAt]+0.4,1.0);}}
          if(!a.blocked){a.mesh.position.x+=a.speed*dt;a.mesh.position.y=a.y+Math.sin(t*1.2+a.bobPh)*0.04;
            if(px>9&&a.isGood){a.mesh.material.color.setHex(0x2EAD6B);a.trail.material.color.setHex(0x2EAD6B);}
            if(px>13){a.dead=true;agentGroup.remove(a.mesh);agentGroup.remove(a.trail);}}
        }else{const bt=t-a.blockTime;a.mesh.material.opacity=Math.max(0,0.9-bt*0.5);const s=Math.max(0.01,1-bt*0.4);a.mesh.scale.set(s,s,s);a.mesh.position.x-=0.08*dt;if(bt>2.5){a.dead=true;agentGroup.remove(a.mesh);agentGroup.remove(a.trail);}}
        if(!a.dead){const tp=a.tPos;for(let j=a.tc-1;j>0;j--){tp[j*3]=tp[(j-1)*3];tp[j*3+1]=tp[(j-1)*3+1];tp[j*3+2]=tp[(j-1)*3+2];}tp[0]=a.mesh.position.x;tp[1]=a.mesh.position.y;tp[2]=a.mesh.position.z;a.tGeo.attributes.position.needsUpdate=true;}
      }
      for(let i=agents.length-1;i>=0;i--){if(agents[i].dead)agents.splice(i,1);}

      const dp2=dGeo.attributes.position.array;for(let i=0;i<dC;i++){dp2[i*3]+=0.002;if(dp2[i*3]>15)dp2[i*3]=-15;}dGeo.attributes.position.needsUpdate=true;

      cam.position.x=4+mx*1.0;cam.position.y=2+my*0.6;cam.lookAt(0,0,0);
      r.render(scene,cam);raf.current=requestAnimationFrame(anim);
    };
    raf.current=requestAnimationFrame(anim);
    const onM=e=>{const rc=cv.getBoundingClientRect();mouse.current.x=((e.clientX-rc.left)/rc.width)*2-1;mouse.current.y=-((e.clientY-rc.top)/rc.height)*2+1;};
    const onR=()=>{const w2=cv.clientWidth,h2=cv.clientHeight;cam.aspect=w2/h2;cam.updateProjectionMatrix();r.setSize(w2,h2);};
    window.addEventListener('mousemove',onM);window.addEventListener('resize',onR);
    return()=>{cancelAnimationFrame(raf.current);window.removeEventListener('mousemove',onM);window.removeEventListener('resize',onR);r.dispose();};
  },[]);

  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:0}} />;
}

function LayerLabels(){
  const{t}=useContext(ThemeCtx);
  const pcts=['15%','26%','37%','48%','60%','72%'];
  return(<div style={{position:'absolute',bottom:68,left:0,right:0,zIndex:5,pointerEvents:'none'}}>
    {LAYER_LABELS.map((l,i)=>(<div key={i} style={{position:'absolute',left:pcts[i],transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
      <div style={{width:1,height:14,background:`linear-gradient(180deg,${t.inkMuted}30,transparent)`}} />
      <span style={{fontSize:7.5,fontWeight:700,letterSpacing:1.2,color:t.inkMuted,opacity:0.4,whiteSpace:'nowrap'}}>{l}</span>
    </div>))}
  </div>);
}

function ThemeToggle(){const{mode,toggle,t}=useContext(ThemeCtx);const[h,setH]=useState(false);
  return(<button onClick={toggle} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{width:36,height:36,borderRadius:8,border:`1.5px solid ${h?t.blue:t.cardBorder}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',fontSize:16,color:t.ink}}>
    {mode==='dark'?'☀':'☾'}</button>);}

function Btn({children,primary}){const{t}=useContext(ThemeCtx);const[h,setH]=useState(false);
  const base=primary?{padding:'14px 32px',borderRadius:8,border:'none',background:h?t.blueLight:t.blue,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',transform:h?'translateY(-1px)':'none',transition:'all .2s'}
  :{padding:'14px 32px',borderRadius:8,border:`2px solid ${h?t.ink:t.cardBorder}`,background:'transparent',color:t.ink,fontSize:15,fontWeight:700,cursor:'pointer',transition:'all .2s'};
  return <button style={base} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>{children}</button>;}

function NavLink({children}){const{t}=useContext(ThemeCtx);const[h,setH]=useState(false);
  return <a href="#" style={{color:h?t.ink:t.inkMuted,textDecoration:'none',fontSize:14,fontWeight:600,transition:'color .2s'}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>{children}</a>;}

function useReveal(threshold=0.2){
  const ref=useRef(null);const[vis,setVis]=useState(false);
  useEffect(()=>{const el=ref.current;if(!el)return;const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting)setVis(true);},{threshold});obs.observe(el);return()=>obs.disconnect();},[]);
  return[ref,vis];
}

function ProblemSection(){
  const{t}=useContext(ThemeCtx);const[ref,vis]=useReveal();
  const cards=[
    {num:'01',title:'No Identity',desc:'Agents operate without verifiable identity. x402 lets anyone pay — but nobody knows who is behind the agent.',icon:'👤'},
    {num:'02',title:'Sybil Floods',desc:'1,000 anonymous bots pay $0.50 each via x402 and mass-produce deepfake videos. No accountability.',icon:'🔄'},
    {num:'03',title:'No Trust Layer',desc:'AI video generation APIs are open. Without on-chain verification, there is no way to trace who ordered a deepfake.',icon:'⚠'},
  ];
  return(<section ref={ref} style={{padding:'120px 48px',maxWidth:1320,margin:'0 auto'}}>
    <div style={{opacity:vis?1:0,transform:vis?'none':'translateY(24px)',transition:'all .8s cubic-bezier(.16,1,.3,1)'}}>
      <span style={{fontSize:12,fontWeight:700,letterSpacing:2,color:t.blue,textTransform:'uppercase'}}>The Problem</span>
      <h2 style={{fontSize:48,fontWeight:900,letterSpacing:-2,margin:'16px 0 0',lineHeight:1.05,textTransform:'uppercase',maxWidth:640}}>
        AI agents pay $0.50<span style={{color:t.blue}}>.</span><br/>Deepfakes go viral<span style={{color:t.blue}}>.</span><br/>Nobody is accountable<span style={{color:t.blue}}>.</span>
      </h2>
      <p style={{fontSize:17,color:t.inkMuted,margin:'20px 0 0',maxWidth:500,lineHeight:1.7}}>
        VEO3, Grok, and other AI video services are opening APIs. With x402, any agent can autonomously generate content — including deepfakes. The victim exists, but the perpetrator doesn't.
      </p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,marginTop:56}}>
      {cards.map((c,i)=>(<div key={i} style={{opacity:vis?1:0,transform:vis?'none':'translateY(32px)',transition:`all .7s ${0.2+i*0.12}s cubic-bezier(.16,1,.3,1)`,
        background:t.card,border:`1.5px solid ${t.cardBorder}`,borderRadius:14,padding:32,transition2:'background .4s'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
          <span style={{fontSize:11,fontWeight:700,color:t.inkMuted,letterSpacing:1}}>{c.num}</span>
          <span style={{fontSize:24}}>{c.icon}</span>
        </div>
        <h3 style={{fontSize:20,fontWeight:800,margin:'0 0 10px',letterSpacing:-0.5}}>{c.title}</h3>
        <p style={{fontSize:14,color:t.inkMuted,lineHeight:1.65,margin:0}}>{c.desc}</p>
      </div>))}
    </div>
  </section>);
}

function PipelineSection(){
  const{t}=useContext(ThemeCtx);const[ref,vis]=useReveal();
  const steps=[
    {step:'G1',title:'Identity',desc:'EVMClient.read → IdentityRegistry. Is this agent registered with an ERC-8004 NFT?'},
    {step:'G2',title:'Verification',desc:'EVMClient.read → WorldIDValidator. Is the owner human-verified via World ID ZK proof?'},
    {step:'G3',title:'Liveness',desc:'EVMClient.read → Verification TTL. Is the human bond still valid and not expired?'},
    {step:'G4',title:'Reputation',desc:'EVMClient.read → WhitewallConsumer. What tier is this agent? Does it meet the service requirement?'},
    {step:'DON',title:'Consensus',desc:'3/5 DON nodes reach consensus on the verification report. Signed report submitted on-chain.'},
    {step:'ACE',title:'Policy',desc:'runPolicy() — HumanVerifiedPolicy enforces the final on-chain safety check. Approve or reject.'},
  ];
  return(<section ref={ref} style={{padding:'120px 48px',maxWidth:1320,margin:'0 auto'}}>
    <div style={{opacity:vis?1:0,transform:vis?'none':'translateY(24px)',transition:'all .8s cubic-bezier(.16,1,.3,1)'}}>
      <span style={{fontSize:12,fontWeight:700,letterSpacing:2,color:t.blue,textTransform:'uppercase'}}>The Pipeline</span>
      <h2 style={{fontSize:48,fontWeight:900,letterSpacing:-2,margin:'16px 0 0',lineHeight:1.05,textTransform:'uppercase',maxWidth:700}}>
        5-Gate verification<span style={{color:t.blue}}>.</span><br/>DON consensus<span style={{color:t.blue}}>.</span> ACE enforcement<span style={{color:t.blue}}>.</span>
      </h2>
      <p style={{fontSize:17,color:t.inkMuted,margin:'20px 0 0',maxWidth:520,lineHeight:1.7}}>
        Every request passes through CRE's 5-Gate pipeline. DON nodes sign the report. ACE enforces on-chain — even if CRE is compromised.
      </p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,marginTop:56}}>
      {steps.map((s,i)=>(<div key={i} style={{opacity:vis?1:0,transform:vis?'none':'translateY(32px)',transition:`all .7s ${0.3+i*0.1}s cubic-bezier(.16,1,.3,1)`,padding:'28px 24px',
        borderLeft:i%3!==0?`1px solid ${t.cardBorder}`:'none',borderBottom:i<3?`1px solid ${t.cardBorder}`:'none'}}>
        <div style={{fontSize:11,fontWeight:800,color:t.blue,letterSpacing:1.5,marginBottom:14,opacity:0.7}}>{s.step}</div>
        <h3 style={{fontSize:18,fontWeight:800,margin:'0 0 8px',letterSpacing:-0.3}}>{s.title}</h3>
        <p style={{fontSize:13,color:t.inkMuted,lineHeight:1.6,margin:0}}>{s.desc}</p>
      </div>))}
    </div>
  </section>);
}

function FooterCTA(){
  const{t}=useContext(ThemeCtx);const[ref,vis]=useReveal(0.3);
  return(<section ref={ref} style={{padding:'100px 48px 80px',textAlign:'center',maxWidth:800,margin:'0 auto',
    opacity:vis?1:0,transform:vis?'none':'translateY(24px)',transition:'all .8s cubic-bezier(.16,1,.3,1)'}}>
    <h2 style={{fontSize:44,fontWeight:900,letterSpacing:-2,textTransform:'uppercase',lineHeight:1.05}}>
      Every AI-generated video<br/>has an accountable human<span style={{color:t.blue}}>.</span>
    </h2>
    <p style={{fontSize:16,color:t.inkMuted,margin:'20px 0 40px',lineHeight:1.7}}>
      3 lines of Solidity. 1 line of TypeScript. Ship verified agents today.
    </p>
    <div style={{display:'flex',gap:14,justifyContent:'center'}}>
      <Btn primary>Read Docs</Btn><Btn>GitHub</Btn>
    </div>
    <div style={{marginTop:60,paddingTop:30,borderTop:`1px solid ${t.cardBorder}`,display:'flex',justifyContent:'center',gap:32}}>
      {['GitHub','Docs','Discord','Twitter'].map(l=>(<a key={l} href="#" style={{fontSize:13,color:t.inkMuted,textDecoration:'none',fontWeight:600}}>{l}</a>))}
    </div>
    <p style={{fontSize:11,color:t.inkMuted,opacity:0.35,marginTop:20}}>© 2026 Whitewall OS</p>
  </section>);
}

export default function App(){
  const[mode,setMode]=useState('dark');
  const toggle=()=>setMode(m=>m==='dark'?'light':'dark');
  const t=themes[mode];
  const[addr,setAddr]=useState('');
  const[verified,setVerified]=useState(false);
  const[checking,setChecking]=useState(false);
  const doVerify=()=>{if(!addr)return;setChecking(true);setTimeout(()=>{setChecking(false);setVerified(true);},1200);};

  return(
    <ThemeCtx.Provider value={{mode,toggle,t}}>
    <div style={{background:t.bg,minHeight:'100vh',color:t.ink,fontFamily:"'Inter',system-ui,-apple-system,sans-serif",overflow:'auto',transition:'background .4s,color .4s'}}>

      <div style={{position:'relative',height:'100vh',overflow:'hidden'}}>
        <MeshBG />
        <LayerLabels />
        <div style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none',
          background:`linear-gradient(90deg,${t.bg} 0%,transparent 20%,transparent 80%,${t.bg} 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 85%,${t.bg} 100%)`,transition:'background .4s'}} />

        <nav style={{position:'relative',zIndex:10,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 40px',borderBottom:`1px solid ${t.cardBorder}`,transition:'border-color .4s'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{display:'flex',gap:2}}>{[0,1,2].map(i=>(<div key={i} style={{width:4,height:22,borderRadius:1,background:t.ink,opacity:t.logoDots[i],transition:'background .4s'}} />))}</div>
            <span style={{fontWeight:900,fontSize:20,letterSpacing:1,textTransform:'uppercase'}}>Whitewall OS</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:28}}>
            {['Protocol','Docs','Pricing','About'].map(k=><NavLink key={k}>{k}</NavLink>)}
            <div style={{display:'flex',gap:10,marginLeft:12,alignItems:'center'}}>
              <ThemeToggle /><Btn>Read Docs</Btn><Btn primary>Launch App</Btn>
            </div>
          </div>
        </nav>

        <div style={{position:'relative',zIndex:10,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 48px',height:'calc(100vh - 160px)',maxWidth:1320,margin:'0 auto'}}>
          <div style={{maxWidth:560,flexShrink:0}}>
            <div className="ha" style={{animationDelay:'0.2s',display:'inline-block',padding:'5px 14px',borderRadius:20,border:`1.5px solid ${t.blue}`,fontSize:11,fontWeight:700,color:t.blue,marginBottom:28,letterSpacing:1}}>
              TRUST INFRASTRUCTURE FOR THE AGENT ECONOMY</div>
            <h1 style={{fontSize:72,fontWeight:900,lineHeight:0.98,margin:0,letterSpacing:-3,textTransform:'uppercase',color:t.ink,transition:'color .4s'}}>
              <span className="ha" style={{animationDelay:'0.35s',display:'block'}}>The wall</span>
              <span className="ha" style={{animationDelay:'0.5s',display:'block'}}>that lets</span>
              <span className="ha" style={{animationDelay:'0.65s',display:'block'}}>you through<span style={{color:t.blue}}>.</span></span>
            </h1>
            <p className="ha" style={{animationDelay:'0.85s',fontSize:17,color:t.inkMuted,margin:'28px 0 0',lineHeight:1.7,maxWidth:440,fontWeight:400,transition:'color .4s'}}>
              Verify AI agents on-chain. Every action traces back to an accountable human. Powered by Chainlink CRE, DON, and ACE.
            </p>
            <div className="ha" style={{animationDelay:'1s',display:'flex',gap:14,marginTop:40}}>
              <Btn primary>Read Docs</Btn><Btn>Launch App</Btn>
            </div>
          </div>

          <div className="ha" style={{animationDelay:'0.7s',width:340,flexShrink:0,background:t.card,border:`1.5px solid ${t.cardBorder}`,borderRadius:14,padding:26,transition:'background .4s,border-color .4s'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <div style={{width:38,height:38,borderRadius:8,background:`${t.blue}15`,border:`1.5px solid ${t.blue}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🛡</div>
              <div><div style={{fontWeight:800,fontSize:14,letterSpacing:0.5}}>VERIFY AGENT</div><div style={{fontSize:11,color:t.inkMuted}}>5-Gate + DON + ACE</div></div>
            </div>
            <p style={{fontSize:12.5,color:t.inkMuted,margin:'0 0 14px',lineHeight:1.55}}>Enter an agent address to run the full verification pipeline.</p>
            <div style={{display:'flex',gap:8}}>
              <input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="0x agent address..."
                style={{flex:1,padding:'10px 13px',borderRadius:8,border:`1.5px solid ${t.cardBorder}`,background:t.bg,color:t.ink,fontSize:13,outline:'none',transition:'all .3s'}}
                onFocus={e=>e.target.style.borderColor=t.blue} onBlur={e=>e.target.style.borderColor=t.cardBorder} />
              <button onClick={doVerify} style={{padding:'10px 18px',borderRadius:8,border:'none',background:t.blue,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',opacity:checking?0.7:1}}>{checking?'...':'Verify'}</button>
            </div>
            <div style={{marginTop:14,padding:14,borderRadius:10,background:t.bg,border:`1px solid ${t.cardBorder}`,transition:'all .3s'}}>
              {verified?(
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <span style={{fontSize:12,color:t.inkMuted}}>Trust Score</span>
                    <span style={{fontSize:15,fontWeight:800,color:t.green}}>94 / 100</span>
                  </div>
                  <div style={{height:4,background:t.cardBorder,borderRadius:2,overflow:'hidden'}}>
                    <div style={{width:'94%',height:'100%',borderRadius:2,background:`linear-gradient(90deg,${t.blue},${t.green})`}} />
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:12,flexWrap:'wrap'}}>
                    {['Identity ✓','World ID ✓','Tier 2 ✓','DON 3/5 ✓','ACE ✓'].map(v=>(
                      <span key={v} style={{padding:'3px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:`${t.green}15`,color:t.green,border:`1px solid ${t.green}30`}}>{v}</span>
                    ))}
                  </div>
                  <div style={{marginTop:10,fontSize:11,color:t.inkMuted}}>accountableHuman: <span style={{color:t.ink,fontWeight:700}}>Alice (0x4fed...)</span></div>
                </>
              ):(
                <div style={{textAlign:'center',padding:'8px 0'}}>
                  <div style={{fontSize:12,color:t.inkMuted}}>{checking?'Running 5-Gate pipeline...':'Enter an address to verify'}</div>
                  {checking&&<div style={{display:'flex',justifyContent:'center',gap:6,marginTop:10}}>
                    {[0,1,2].map(i=>(<div key={i} style={{width:5,height:5,borderRadius:3,background:t.blue,animation:`pulse 1s ${i*0.2}s infinite`}} />))}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{position:'absolute',bottom:24,left:0,right:0,zIndex:10,padding:'0 48px',display:'flex',alignItems:'center',gap:36}}>
          <span style={{fontSize:12,color:t.inkMuted,whiteSpace:'nowrap',fontWeight:500}}>Powered by:</span>
          {['Chainlink CRE','Chainlink DON','Chainlink ACE','World ID','x402'].map(n=>(
            <span key={n} style={{fontSize:12,color:t.inkMuted,opacity:0.3,fontWeight:800,letterSpacing:0.5,textTransform:'uppercase'}}>{n}</span>
          ))}
        </div>
      </div>

      <ProblemSection />
      <div style={{height:1,background:t.cardBorder,maxWidth:1320,margin:'0 auto'}} />
      <PipelineSection />
      <div style={{height:1,background:t.cardBorder,maxWidth:1320,margin:'0 auto'}} />
      <FooterCTA />

      <style>{`
        @keyframes hi{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .ha{opacity:0;animation:hi .7s cubic-bezier(.16,1,.3,1) forwards}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:${t.blue}30}
        input::placeholder{color:${t.inkMuted}}
        html{scroll-behavior:smooth}
      `}</style>
    </div>
    </ThemeCtx.Provider>);
}
