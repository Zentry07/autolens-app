import { useState, useRef, useCallback, useEffect } from "react";
import * as storage from "./services/storage";
import * as payments from "./services/payments";
import * as analytics from "./services/analytics";
import * as haptics from "./services/haptics";
/* ═══ API & Stubs ═══ */
const API_PROXY_URL = import.meta.env.VITE_API_PROXY_URL || "";
const apiCall=async({messages,system,max_tokens=3000}:{messages:any;system?:string;max_tokens?:number})=>{
  const body:any={messages,max_tokens,model:"claude-sonnet-4-20250514"};
  if(system)body.system=system;
  // Use backend proxy (Supabase Edge Function) to keep API key server-side
  if(API_PROXY_URL){
    const r=await fetch(API_PROXY_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||`API error ${r.status}`)}
    return r.json()
  }
  // Fallback: direct call for local development only
  const key=import.meta.env.VITE_ANTHROPIC_API_KEY;
  if(!key){throw new Error("API key not configured. Set VITE_API_PROXY_URL for production or VITE_ANTHROPIC_API_KEY for local dev.")}
  const r=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key":key,
      "anthropic-version":"2023-06-01",
      "anthropic-dangerous-direct-browser-access":"true"
    },
    body:JSON.stringify(body)
  });
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||`API error ${r.status}`)}
  return r.json()
};
const push={register:async()=>{},checkPermissions:async()=>({receive:"granted"}),scheduleLocal:async()=>{}};
const crash={report:(e:any,c?:any)=>console.error("[Crash]",e,c),breadcrumb:()=>{}};
const FREE_SCANS = 3; // per week
/* ═══ CarSnap-inspired Design System — Navy & Clean ═══ */
const C = {
  bg: "#f8fafc", white: "#ffffff", 
  pri: "#0f2b4c", pl: "#1a3d6b", pd: "#0a1f38", pBg: "#eef4fb", pBo: "#c7daf0",
  gold: "#c8a24e", gBg: "#faf6ec", gBo: "#e8dbb5",
  g: "#0d8a5e", gBg2: "#ecfdf5", gBo2: "#a7f3d0",
  r: "#c53030", rBg: "#fef2f2",
  cy: "#0c7a92",
  t1: "#0f172a", t2: "#334155", t3: "#64748b", t4: "#94a3b8", t5: "#cbd5e1",
  border: "#e2e8f0", shadow: "0 1px 3px rgba(15,43,76,.05),0 1px 2px rgba(15,43,76,.03)",
};
const PROMPT = `You are an elite automotive analyst. Analyze this car image(s). Be extremely specific with real numbers and data.
Respond ONLY with valid JSON, no markdown, no backticks:
{"make":"","model":"","year_range":"","trim":"","body_style":"","color":"","confidence":"High/Medium/Low",
"should_buy":{"verdict":"Yes/Maybe/No","reason":""},
"origin":{"brand_country":"","manufacturing_country":"","market":""},
"ratings":{"overall_score":7.5,"reliability_score":8,"value_score":7,"safety_score":8,"fun_factor":6,"comfort_score":7,"tech_score":7,"verdict":""},
"pros":["","","","",""],"cons":["","","",""],
"specs":{"engine":"","horsepower":"","torque":"","transmission":"","drivetrain":"","fuel_type":"","mpg":"","zero_sixty":"","top_speed":"","curb_weight":"","seating":"","cargo_space":"","towing_capacity":"","msrp_range":"","used_price_range":""},
"safety":{"nhtsa_rating":"","iihs_rating":"","driver_assists":["","",""]},
"cost_of_ownership":{"annual_insurance":"","annual_fuel":"","annual_maintenance":"","depreciation_5yr":"","total_annual_cost":""},
"reliability":{"rating":"","known_issues":["",""],"warranty":""},
"where_to_buy":{"best_sources":["","",""],"tips":""},
"competitors":["","",""],
"fun_facts":["",""],
"owner_reviews":{"satisfaction_score":8.0,"common_praise":["","",""],"common_complaints":["","",""],"would_buy_again_pct":"xx%"},
"problems_by_mileage":{"0_30k":[""],"30k_60k":[""],"60k_100k":[""],"100k_plus":[""]},
"resale_prediction":{"1yr_value":"$xx,xxx","3yr_value":"$xx,xxx","5yr_value":"$xx,xxx"},
"maintenance_timeline":[{"miles":"5,000","service":"Oil change","est_cost":"$50-80"},{"miles":"15,000","service":"","est_cost":""},{"miles":"30,000","service":"","est_cost":""},{"miles":"60,000","service":"","est_cost":""}],
"depreciation_curve":{"yr0_pct":100,"yr1_pct":85,"yr2_pct":73,"yr3_pct":63,"yr4_pct":55,"yr5_pct":48},
"negotiation_tips":{"avg_transaction_vs_msrp":"","best_leverage_points":["","",""],"walk_away_price":""},
"diagnose_common":{"check_engine_causes":["",""],"noise_issues":["",""],"wear_items":["",""]}
}`;
const VIN_PROMPT = `You are an elite automotive analyst. Decode this VIN number and provide the same depth of analysis as if you were looking at the car. Respond ONLY with valid JSON, no markdown. Be extremely specific with real numbers and data.`;
const QUIZ_PROMPT = `You are an expert car matchmaker. Based on these preferences, recommend exactly 3 cars. Respond ONLY with valid JSON, no markdown:
{"recommendations":[{"make":"","model":"","year":"","fit_score":9,"price_range":"","why":"","pros":["",""],"cons":[""]},{"make":"","model":"","year":"","fit_score":8,"price_range":"","why":"","pros":["",""],"cons":[""]},{"make":"","model":"","year":"","fit_score":7,"price_range":"","why":"","pros":["",""],"cons":[""]}]}`;
/* ═══ Car Logo ═══ */
const CarLogo=({size=32,color=C.pri})=>(
<svg width={size} height={size} viewBox="0 0 48 48" fill="none">
<path d="M8 30c0 0 1-1 3-1h26c2 0 3 1 3 1v2c0 1-.5 2-2 2H10c-1.5 0-2-1-2-2v-2z" fill={color} opacity=".85"/>
<path d="M14 30l4-8c.5-1 1.5-1.5 2.5-1.5h7c1.5 0 3 .5 4 1.5l5 8H14z" fill={color} opacity=".6"/>
<circle cx="15" cy="34" r="3.5" fill={C.white} stroke={color} strokeWidth="1.5"/>
<circle cx="15" cy="34" r="1.2" fill={color} opacity=".5"/>
<circle cx="35" cy="34" r="3.5" fill={C.white} stroke={color} strokeWidth="1.5"/>
<circle cx="35" cy="34" r="1.2" fill={color} opacity=".5"/>
<circle cx="25" cy="26" r="9" stroke={color} strokeWidth=".8" opacity=".2"/>
<line x1="25" y1="15" x2="25" y2="18" stroke={color} strokeWidth=".7" opacity=".2" strokeLinecap="round"/>
<line x1="25" y1="34" x2="25" y2="37" stroke={color} strokeWidth=".7" opacity=".2" strokeLinecap="round"/>
</svg>);
/* ═══ Icons ═══ */
const Ic={
home:(s=22,c=C.t4)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
wrench:(s=22,c=C.t4)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
camera:(s=24,c="#fff")=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
garage:(s=22,c=C.t4)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7"/><rect x="4" y="9" width="16" height="13" rx="1"/><path d="M8 22v-6h8v6"/><line x1="8" y1="16" x2="16" y2="16"/><line x1="8" y1="18" x2="16" y2="18"/></svg>,
explore:(s=22,c=C.t4)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
check:(s=16,c=C.g)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
star:(s=14,c="#d4b05e")=><svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
heart:(s=18,c=C.t4)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
heartFill:(s=18,c=C.r)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
back:(s=20,c=C.t1)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
share:(s=18,c=C.t3)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
bolt:(s=16,c=C.pri)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg>,
shield:(s=16,c=C.g)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
dollar:(s=16,c=C.gold)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
chat:(s=18,c=C.pri)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
lock:(s=18,c=C.t4)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
right:(s=16,c=C.t4)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
gauge:(s=16,c=C.pri)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
alert:(s=16,c=C.gold)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
gear:(s=20,c=C.t3)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
search:(s=18,c=C.t3)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};
/* ═══ Shared Components ═══ */
const Card=({children,style,className="",...p})=><div className={`card-hover ${className}`} style={{background:C.white,borderRadius:16,padding:18,boxShadow:"0 1px 3px rgba(15,43,76,.04),0 4px 12px rgba(15,43,76,.03)",border:`1px solid ${C.border}`,transition:"transform .15s,box-shadow .15s",...style}} {...p}>{children}</div>;
const Chip=({children,color=C.pri,bg=C.pBg})=><span style={{display:"inline-flex",height:24,padding:"0 10px",borderRadius:12,fontSize:11,fontWeight:600,background:bg,color,alignItems:"center",whiteSpace:"nowrap"}}>{children}</span>;
const ProBadge=()=><span style={{display:"inline-flex",height:18,padding:"0 7px",borderRadius:9,background:"linear-gradient(135deg,#c8a24e,#e0c56e,#c8a24e)",backgroundSize:"200% 200%",animation:"gradientShift 3s ease infinite",color:"#4a3510",fontSize:9,fontWeight:800,alignItems:"center",letterSpacing:".04em"}}>PRO</span>;
const BackBtn=({onClick})=><button onClick={onClick} style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"none",color:C.t2,fontSize:14,fontWeight:600,padding:"8px 0",marginBottom:12}}>{Ic.back(18,C.t2)} Back</button>;
function ScoreRing({score,size=54,color=C.pri,label}){const r=(size-6)/2;const circ=2*Math.PI*r;const[on,setOn]=useState(false);useEffect(()=>{setTimeout(()=>setOn(true),200)},[]);return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{position:"relative",width:size,height:size}}><svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth="3.5"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={on?circ-(score/10)*circ:circ} style={{transition:"stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)"}}/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:14,fontWeight:800,color}}>{score}</span></div></div>{label&&<span style={{fontSize:10,fontWeight:600,color:C.t4}}>{label}</span>}</div>)}
/* ═══ Chat ═══ */
function Chat({result}){const[msgs,setMsgs]=useState([]),[input,setInput]=useState(""),[ld,sld]=useState(false);const ref=useRef(null);const send=async()=>{if(!input.trim()||ld)return;const q=input.trim();setInput("");const nm=[...msgs,{role:"user",content:q}];setMsgs(nm);sld(true);try{const r=await apiCall({system:`You are a helpful car expert. Vehicle: ${result.year_range} ${result.make} ${result.model}. Data: ${JSON.stringify(result)}. Answer concisely in 2-3 sentences.`,messages:nm,max_tokens:500});setMsgs([...nm,{role:"assistant",content:r.content?.map(b=>b.text||"").join("")||"Sorry, couldn't answer."}])}catch{setMsgs([...nm,{role:"assistant",content:"Something went wrong."}])}finally{sld(false)}};useEffect(()=>{ref.current?.scrollTo(0,ref.current.scrollHeight)},[msgs]);return(<div><div ref={ref} style={{maxHeight:260,overflowY:"auto",marginBottom:12,display:"flex",flexDirection:"column",gap:8}}>{msgs.length===0&&<div style={{textAlign:"center",padding:20}}><div style={{width:48,height:48,borderRadius:24,background:C.pBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}>{Ic.chat(22,C.pri)}</div><p style={{color:C.t3,fontSize:13}}>Ask anything about this {result.make} {result.model}</p><div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginTop:10}}>{["Good first car?","Worst years?","Compare to rivals?","Best mods?"].map((s,i)=><button key={i} onClick={()=>setInput(s)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:C.white,color:C.t2,fontSize:11,fontWeight:500}}>{s}</button>)}</div></div>}{msgs.map((m,i)=><div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?C.pri:C.bg,color:m.role==="user"?"#fff":C.t1,fontSize:13,lineHeight:1.5}}>{m.content}</div></div>)}{ld&&<div style={{display:"flex"}}><div style={{padding:"10px 14px",borderRadius:16,background:C.bg,color:C.t3,fontSize:13}}>Thinking...</div></div>}</div><div style={{display:"flex",gap:8}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask about this car..." style={{flex:1,height:42,borderRadius:21,border:`1px solid ${C.border}`,background:C.bg,color:C.t1,fontSize:13,padding:"0 16px",outline:"none",fontFamily:"inherit"}}/><button onClick={send} disabled={ld} style={{height:42,width:42,borderRadius:21,border:"none",background:C.pri,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",opacity:ld?.5:1}}>{Ic.right(16,"#fff")}</button></div></div>)}
/* ═══ MAIN APP ═══ */
export function App(){
  const[tab,setTab]=useState("home");const[prevTab,setPT]=useState("home");const[imgs,setImgs]=useState([]);const[imgDs,setImgDs]=useState([]);const[loading,sl]=useState(false);const[result,sr]=useState(null);const[err,se]=useState(null);const[prog,sp]=useState(0);const[subTab,setSub]=useState("overview");const[hist,setHist]=useState([]);const[favs,setFavs]=useState([]);const[isPro,setIsPro]=useState(false);const[scansUsed,setScansUsed]=useState(0);const[showPay,setPay]=useState(false);const[showOnboard,setOnboard]=useState(true);const[obStep,setObStep]=useState(0);const[showSettings,setSS]=useState(false);
  const[diagItem,setDI]=useState(null);const[diagAns,setDA]=useState("");const[diagLd,setDL]=useState(false);
  const[qStep,setQS]=useState(-1);const[qAns,setQA]=useState({});const[qRes,setQR]=useState(null);const[qLd,setQL]=useState(false);
  const[scanMode,setSM]=useState("photo");const[vinIn,setVI]=useState("");const[dragging,setDr]=useState(false);
  const[toast,setToast]=useState("");
  const[expCat,setEC]=useState(null);const[expRes,setER]=useState(null);const[expLd,setEL]=useState(false);
  const[cmpA,setCmpA]=useState(null);const[cmpB,setCmpB]=useState(null);const[showCmp,setSCmp]=useState(false);
  const[guideItem,setGI]=useState(null);const[guideAns,setGA]=useState("");const[guideLd,setGL]=useState(false);
  const[garQ,setGQ]=useState("");
  const[plan,setPlan]=useState("yr");
  const[aiConsent,setAiC]=useState(false);
  const[showAiC,setSAiC]=useState(false);
  const[proPreview,setProPrev]=useState(false);
  const[marketAlerts,setMA]=useState(false);
  const[streak,setStreak]=useState({count:0,last:null,best:0});
  const[showSoftPay,setSoftPay]=useState(false);
  const fRef=useRef(null);
  const CAR_FACTS=["The average car has over 30,000 parts","A car spends 95% of its life parked","The first car accident happened in 1891","Toyota sells more cars per minute than any brand","The world's longest traffic jam was 62 miles","Your car key has more computing power than Apollo 11","The average American spends 4.3 years driving","White is the most popular car color worldwide"];
  useEffect(()=>{(async()=>{try{await payments.initPayments()}catch{}try{await analytics.initAnalytics()}catch{}try{const r=await storage.getItem("al10");if(r)setHist(r)}catch{}try{const p=await storage.getItem("al10-pro");if(p==="1")setIsPro(true)}catch{}try{const sub=await payments.checkSubscription();if(sub?.isPremium){setIsPro(true);try{await storage.setItem("al10-pro","1")}catch{}}}catch{}try{const s=await storage.getItem("al10-scans");if(s){const sd=typeof s==="string"?JSON.parse(s):s;const cw=Math.floor(Date.now()/604800000);if(sd.week===cw){setScansUsed(sd.count)}else{setScansUsed(0);try{await storage.setItem("al10-scans",{count:0,week:cw})}catch{}}}}catch{}try{const f=await storage.getItem("al10-favs");if(f)setFavs(f)}catch{}try{const o=await storage.getItem("al10-ob");if(o==="1")setOnboard(false)}catch{}try{const ac=await storage.getItem("al10-aic");if(ac==="1")setAiC(true)}catch{}try{const ma=await storage.getItem("al10-ma");if(ma==="1")setMA(true)}catch{}try{const st=await storage.getItem("al10-streak");if(st)setStreak(typeof st==="string"?JSON.parse(st):st)}catch{}})()},[]);
  const saveH=async(l:any)=>{setHist(l);try{await storage.setItem("al10",l)}catch{}};
  const savePro=async()=>{setIsPro(true);try{await storage.setItem("al10-pro","1")}catch{}};
  const saveScans=async(n:number)=>{setScansUsed(n);try{await storage.setItem("al10-scans",{count:n,week:Math.floor(Date.now()/604800000)})}catch{}};
  const saveFavs=async(l:any)=>{setFavs(l);try{await storage.setItem("al10-favs",l)}catch{}};
  const finishOb=async()=>{setOnboard(false);try{await storage.setItem("al10-ob","1")}catch{}};
  const saveAiConsent=async()=>{setAiC(true);try{await storage.setItem("al10-aic","1")}catch{}};
  const saveStreak=async(s:any)=>{setStreak(s);try{await storage.setItem("al10-streak",s)}catch{}};
  const bumpStreak=()=>{const today=new Date().toDateString();if(streak.last===today)return streak;const yest=new Date(Date.now()-86400000).toDateString();const cont=streak.last===yest;const nc=cont?streak.count+1:1;const ns={count:nc,last:today,best:Math.max(nc,streak.best)};saveStreak(ns);return ns};
  const roundRect=(ctx,rx,ry,w,h,r)=>{ctx.beginPath();ctx.moveTo(rx+r,ry);ctx.lineTo(rx+w-r,ry);ctx.quadraticCurveTo(rx+w,ry,rx+w,ry+r);ctx.lineTo(rx+w,ry+h-r);ctx.quadraticCurveTo(rx+w,ry+h,rx+w-r,ry+h);ctx.lineTo(rx+r,ry+h);ctx.quadraticCurveTo(rx,ry+h,rx,ry+h-r);ctx.lineTo(rx,ry+r);ctx.quadraticCurveTo(rx,ry,rx+r,ry);ctx.closePath()};
  const shareCard=async()=>{if(!result)return;const R=result;const cv=document.createElement("canvas");cv.width=600;cv.height=340;const x=cv.getContext("2d");
    const grad=x.createLinearGradient(0,0,600,340);grad.addColorStop(0,"#0a1f38");grad.addColorStop(1,"#1a3d6b");x.fillStyle=grad;x.fillRect(0,0,600,340);
    x.strokeStyle="rgba(255,255,255,.03)";x.lineWidth=.5;for(let i=0;i<600;i+=24){x.beginPath();x.moveTo(i,0);x.lineTo(i,340);x.stroke()}for(let i=0;i<340;i+=24){x.beginPath();x.moveTo(0,i);x.lineTo(600,i);x.stroke()}
    const sc=R.ratings?.overall_score||0;const clr=sc>=8?"#0d8a5e":sc>=6?"#c8a24e":"#c53030";
    x.beginPath();x.arc(68,68,34,-Math.PI/2,Math.PI*2-Math.PI/2);x.strokeStyle="rgba(255,255,255,.08)";x.lineWidth=5;x.stroke();
    x.beginPath();x.arc(68,68,34,-Math.PI/2,-Math.PI/2+(sc/10)*Math.PI*2);x.strokeStyle=clr;x.lineWidth=5;x.lineCap="round";x.stroke();
    x.fillStyle="#fff";x.font="bold 28px sans-serif";x.textAlign="center";x.fillText(String(sc),68,76);x.font="9px sans-serif";x.fillStyle="rgba(255,255,255,.4)";x.fillText("/10",68,90);
    x.textAlign="left";x.fillStyle="#fff";x.font="bold 30px sans-serif";x.fillText(`${R.make} ${R.model}`,124,62);
    x.font="14px sans-serif";x.fillStyle="rgba(255,255,255,.45)";x.fillText(`${R.year_range}${R.trim?" · "+R.trim:""}${R.body_style?" · "+R.body_style:""}`,124,84);
    const isG=R.should_buy?.verdict==="Yes";x.fillStyle=isG?"rgba(13,138,94,.15)":"rgba(200,162,78,.15)";roundRect(x,28,115,544,44,12);x.fill();
    x.fillStyle=isG?"#0d8a5e":"#c8a24e";x.font="bold 16px sans-serif";x.textAlign="left";x.fillText(isG?"Buy It":"Think Twice",48,143);
    x.font="12px sans-serif";x.fillStyle="rgba(255,255,255,.45)";const rsn=R.should_buy?.reason||"";x.fillText(rsn.length>55?rsn.slice(0,52)+"...":rsn,155,143);
    const stats=[["Price",R.specs?.msrp_range||R.specs?.used_price_range||"--"],["MPG",R.specs?.mpg||"--"],["0-60",R.specs?.zero_sixty||"--"],["HP",R.specs?.horsepower||"--"]];
    stats.forEach(([l,v],i)=>{const sx=28+i*143;x.fillStyle="rgba(255,255,255,.04)";roundRect(x,sx,180,130,52,8);x.fill();x.fillStyle="#fff";x.font="bold 15px sans-serif";x.textAlign="center";x.fillText(v,sx+65,208);x.fillStyle="rgba(255,255,255,.3)";x.font="10px sans-serif";x.fillText(l,sx+65,224)});
    (R.pros||[]).slice(0,2).forEach((p,i)=>{x.fillStyle="rgba(13,138,94,.7)";x.font="bold 10px sans-serif";x.textAlign="left";x.fillText("+",36,262+i*18);x.fillStyle="rgba(255,255,255,.6)";x.font="12px sans-serif";x.fillText(p.length>35?p.slice(0,32)+"...":p,50,262+i*18)});
    (R.cons||[]).slice(0,2).forEach((c2,i)=>{x.fillStyle="rgba(197,48,48,.7)";x.font="bold 10px sans-serif";x.textAlign="left";x.fillText("-",316,262+i*18);x.fillStyle="rgba(255,255,255,.6)";x.font="12px sans-serif";x.fillText(c2.length>28?c2.slice(0,25)+"...":c2,330,262+i*18)});
    x.fillStyle="rgba(200,162,78,.2)";roundRect(x,410,310,164,22,11);x.fill();x.fillStyle="#c8a24e";x.font="bold 9px sans-serif";x.textAlign="center";x.fillText("Scanned with AutoLens",492,325);
    x.fillStyle="rgba(255,255,255,.2)";x.font="bold 11px sans-serif";x.textAlign="left";x.fillText("AutoLens",28,326);x.fillStyle="rgba(255,255,255,.1)";x.font="10px sans-serif";x.fillText("autolens.app",100,326);
    const url=cv.toDataURL("image/png");if(navigator.share){try{const blob=await(await fetch(url)).blob();const file=new File([blob],`autolens-${R.make}-${R.model}.png`,{type:"image/png"});await navigator.share({title:`${R.make} ${R.model} — ${sc}/10`,files:[file]})}catch{}}else{const a=document.createElement("a");a.href=url;a.download=`autolens-${R.make}-${R.model}.png`;a.click()}showTst("Share card created!");analytics.trackFeatureUsed("share_card")};
  useEffect(()=>{if(!loading)return;sp(0);const id=setInterval(()=>sp(p=>p>=96?96:p+Math.random()*5),300);return()=>clearInterval(id)},[loading]);
  const isFav=result?favs.some(f=>f.make===result.make&&f.model===result.model):false;
  const showTst=(m)=>{setToast(m);setTimeout(()=>setToast(""),2500)};
  const toggleFav=()=>{if(!result)return;if(isFav){saveFavs(favs.filter(f=>!(f.make===result.make&&f.model===result.model)));showTst("Removed from favorites")}else{saveFavs([...favs,{make:result.make,model:result.model,year:result.year_range,score:result.ratings?.overall_score,thumb:imgs[0],data:result}].slice(0,50));showTst("Saved! We'll watch for price drops.")}};
  const onFiles=useCallback(files=>{const arr=Array.from(files).filter(f=>f.type.startsWith("image/")).slice(0,isPro?4:1);if(!arr.length)return;se(null);sr(null);const urls=arr.map(f=>URL.createObjectURL(f));setImgs(p=>[...p,...urls].slice(0,isPro?4:1));arr.forEach(f=>{const r=new FileReader();r.onload=()=>setImgDs(p=>[...p,{b:r.result.split(",")[1],m:f.type}].slice(0,isPro?4:1));r.readAsDataURL(f)})},[isPro]);
  const handleDrop=(e)=>{e.preventDefault();setDr(false);if(e.dataTransfer.files?.length)onFiles(e.dataTransfer.files)};
  const scan=useCallback(async()=>{if(!imgDs.length)return;if(!aiConsent){setSAiC(true);return}if(!isPro&&scansUsed>=FREE_SCANS){setPay(true);return}sl(true);se(null);try{const content=[];imgDs.forEach(d=>content.push({type:"image",source:{type:"base64",media_type:d.m,data:d.b}}));content.push({type:"text",text:PROMPT});const r=await apiCall({messages:[{role:"user",content}],max_tokens:3000});if(r.error)throw new Error(r.error.message);const parsed=JSON.parse((r.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim());sr(parsed);sp(100);setSub("overview");goTab("result");if(!isPro)saveScans(scansUsed+1);const newH=[{id:Date.now(),make:parsed.make,model:parsed.model,year:parsed.year_range,thumb:imgs[0],data:parsed,date:new Date().toLocaleDateString()},...hist].slice(0,30);saveH(newH);bumpStreak();analytics.trackScan(parsed,"photo");if(!isPro&&scansUsed===0)setTimeout(()=>setSoftPay(true),3000)}catch(e){const offline=!navigator.onLine||e.message?.includes("fetch");se(offline?"No internet connection. Check your network and try again.":e.message);crash.report(e,{action:"scan",offline})}finally{sl(false)}},[imgDs,imgs,hist,isPro,scansUsed,aiConsent]);
  const scanVin=useCallback(async()=>{const vin=vinIn.trim().toUpperCase();if(vin.length!==17){se("VIN must be exactly 17 characters");return}if(!aiConsent){setSAiC(true);return}if(!isPro){setPay(true);return}sl(true);se(null);try{const r=await apiCall({messages:[{role:"user",content:`${VIN_PROMPT}\n\nVIN: ${vin}\n\nRespond with JSON schema:\n${PROMPT.split("Respond ONLY")[1]}`}],max_tokens:3000});if(r.error)throw new Error(r.error.message);const raw=(r.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();const parsed=JSON.parse(raw);sr(parsed);sp(100);setSub("overview");goTab("result");saveScans(scansUsed+1);saveH([{id:Date.now(),make:parsed.make,model:parsed.model,year:parsed.year_range,thumb:null,data:parsed,date:new Date().toLocaleDateString()},...hist].slice(0,30));analytics.trackScan(parsed,"vin")}catch(e){se(e.message||"VIN decode failed.");crash.report(e,{action:"scanVin"})}finally{sl(false)}},[vinIn,hist,isPro,scansUsed,aiConsent]);
  const[diagCar,setDC]=useState(null);const[diagCustom,setDCu]=useState("");
  const DIAG_PROMPT=`You are an expert car mechanic. Diagnose this problem and respond ONLY with JSON:
{"urgency":"low"|"medium"|"high","urgency_note":"1 sentence why","can_drive":true|false,"drive_note":"1 sentence","likely_causes":[{"cause":"","probability":"high"|"medium"|"low","explanation":"1 sentence"}],"estimated_cost":{"low":"$X","high":"$X","note":"1 sentence"},"diy_possible":true|false,"diy_difficulty":"easy"|"medium"|"hard","diy_steps":["step 1","step 2","step 3"],"mechanic_note":"when to see a mechanic, 1-2 sentences","quick_checks":["thing to check 1","thing to check 2","thing to check 3"]}`;
  const askDiag=async(label)=>{setDI(label);setDA("");setDL(true);const carCtx=diagCar?`\nThe car is a ${diagCar.year} ${diagCar.make} ${diagCar.model}.`:"";try{const r=await apiCall({messages:[{role:"user",content:`${DIAG_PROMPT}${carCtx}\n\nProblem: "${label}"`}],max_tokens:1200});const raw=r.content?.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();const parsed=JSON.parse(raw);setDA(parsed);analytics.trackDiagnose(label,!!diagCar)}catch(e){setDA(null);crash.report(e,{action:"diagnose",label})}finally{setDL(false)}};
  const runQuiz=async(answers)=>{setQL(true);try{const r=await apiCall({messages:[{role:"user",content:`${QUIZ_PROMPT}\n\nBudget: ${answers.budget}\nUse: ${answers.use}\nPriority: ${answers.priority}\nSize: ${answers.size}\nCondition: ${answers.condition}`}],max_tokens:1500});const raw=r.content?.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();const parsed=JSON.parse(raw);if(!parsed?.recommendations?.length)throw new Error("No results");setQR(parsed);analytics.trackFeatureUsed("quiz")}catch(e){setQR({recommendations:[]});crash.report(e,{action:"quiz"})}finally{setQL(false)}};
  const reset=()=>{imgs.forEach(u=>{try{URL.revokeObjectURL(u)}catch{}});setImgs([]);setImgDs([]);sr(null);se(null);sp(0);setSub("overview");setSM("photo");setVI("")};
  const goTab=(t)=>{setPT(tab);setTab(t);setQS(-1);setQR(null);setQA({});setQL(false);setDI(null);setDA("");setDL(false);setDCu("");setEC(null);setER(null);setEL(false);setGI(null);setGA("");setGL(false);setGQ("");analytics.trackScreenView(t)};
  const openResult=(d,thumb)=>{sr(d);setImgs(thumb?[thumb]:[]);setSub("overview");goTab("result")};
  const exploreCategory=async(cat)=>{setEC(cat);setER(null);setEL(true);try{const r=await apiCall({messages:[{role:"user",content:`List the top 5 cars for "${cat}" in 2025. Respond ONLY with JSON: {"cars":[{"name":"","price":"","score":8.5,"why":"","best_for":""}]}`}],max_tokens:1200});const raw=r.content?.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();setER(JSON.parse(raw));analytics.trackFeatureUsed("explore")}catch(e){setER({cars:[]});crash.report(e,{action:"explore",cat})}finally{setEL(false)}};
  const loadGuide=async(title)=>{setGI(title);setGA("");setGL(true);try{const r=await apiCall({messages:[{role:"user",content:`Write a helpful, concise guide titled "${title}" for car buyers. Keep it practical, 4-5 short paragraphs. No markdown headers.`}],max_tokens:800});setGA(r.content?.map(b=>b.text||"").join("")||"Could not load guide.");analytics.trackFeatureUsed("guide")}catch(e){setGA("Something went wrong.");crash.report(e,{action:"guide",title})}finally{setGL(false)}};
  /* Styles are in global.css */
  const Shell=({children,nopad})=>(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.t1}}>
      {/* styles in global.css */}
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,padding:"11px 24px",borderRadius:24,fontSize:13,fontWeight:600,animation:"toast 2.5s both",pointerEvents:"none",letterSpacing:".01em",background:"rgba(15,43,76,.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",color:"#fff",boxShadow:"0 8px 32px rgba(0,0,0,.18)"}}>{toast}</div>}
      {showAiC&&<div style={{position:"fixed",inset:0,zIndex:998,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:C.white,borderRadius:20,padding:24,maxWidth:360,width:"100%",boxShadow:"0 10px 30px rgba(0,0,0,.12)"}}>
          <div style={{width:48,height:48,borderRadius:14,background:C.pBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>{Ic.shield(24,C.pri)}</div>
          <h3 style={{fontSize:18,fontWeight:800,textAlign:"center",marginBottom:6}}>AI Data Processing</h3>
          <p style={{fontSize:13,color:C.t2,lineHeight:1.6,textAlign:"center",marginBottom:16}}>AutoLens uses a third-party AI service to analyze your car photos and provide vehicle identification. Your photos are sent to our AI provider for processing and are not stored after analysis.</p>
          <div style={{background:C.bg,borderRadius:12,padding:12,marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:C.t3,marginBottom:6}}>DATA SHARED WITH AI:</div>
            {["Car photos you upload or capture","VIN numbers you enter","Text queries in AI Chat"].map((item,i)=><div key={i} style={{fontSize:12,color:C.t2,padding:"3px 0",display:"flex",gap:6,alignItems:"center"}}><div style={{width:4,height:4,borderRadius:2,background:C.pri,flexShrink:0}}/>{item}</div>)}
          </div>
          <button onClick={()=>{saveAiConsent();setSAiC(false);showTst("AI processing enabled")}} style={{width:"100%",height:48,borderRadius:24,border:"none",background:C.pri,color:"#fff",fontSize:15,fontWeight:700,marginBottom:8}}>I Agree</button>
          <button onClick={()=>setSAiC(false)} style={{width:"100%",height:40,borderRadius:20,border:`1px solid ${C.border}`,background:C.white,color:C.t3,fontSize:13,fontWeight:600}}>Not Now</button>
        </div>
      </div>}
      <div style={{maxWidth:430,margin:"0 auto",paddingBottom:90,...(!nopad&&{padding:"0 18px 90px"})}}>
        {children}
      </div>
      {/* ═══ BOTTOM TAB BAR ═══ */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100}}>
        <div style={{maxWidth:430,margin:"0 auto",background:"rgba(255,255,255,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderTop:`1px solid rgba(226,232,240,.6)`,display:"flex",alignItems:"flex-end",justifyContent:"space-around",padding:"6px 8px 10px"}}>
          {[["home","Home",Ic.home],["diagnose","Diagnose",Ic.wrench],["scan","",""],["garage","Garage",Ic.garage],["explore","Explore",Ic.explore]].map(([id,label,icon],i)=>{
            if(id==="scan")return(
              <button key={id} onClick={()=>{reset();goTab("scan")}} style={{width:58,height:58,borderRadius:29,background:`linear-gradient(145deg,${C.pd},${C.pl})`,border:"none",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-22,boxShadow:`0 4px 20px rgba(15,43,76,.35)`,transition:"transform .15s"}}>
                {Ic.camera(24,"#fff")}
              </button>
            );
            const active=tab===id||(tab==="result"&&id==="home");
            return(<button key={id} onClick={()=>goTab(id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",padding:"4px 12px",minWidth:52,position:"relative"}}>
              {icon(22,active?C.pri:C.t4)}
              <span style={{fontSize:10,fontWeight:active?700:600,color:active?C.pri:C.t4}}>{label}</span>
              {active&&<div style={{position:"absolute",bottom:-2,width:4,height:4,borderRadius:2,background:C.pri,animation:"dotPulse .6s both"}}/>}
            </button>);
          })}
        </div>
      </div>
    </div>
  );
  /* ═══ ONBOARDING — Immersive Dark Mode ═══ */
  if(showOnboard){
    const steps=[
      {title:"Identify Any Car",subtitle:"Instantly",desc:"Point your camera at any car and get make, model, year, specs, and pricing in seconds."},
      {title:"AI-Powered",subtitle:"Accuracy",desc:"Our AI recognizes cars from any angle. Front, back, side — even partial views at night."},
      {title:"Your Personal",subtitle:"Car Expert",desc:"Maintenance schedules, depreciation forecasts, negotiation tips, and answers to any question."},
    ];
    const s=steps[obStep];
    return(
      <div style={{minHeight:"100vh",background:`linear-gradient(165deg,#060e1a 0%,${C.pd} 35%,${C.pri} 70%,${C.pl} 100%)`,backgroundSize:"200% 200%",animation:"gradientShift 8s ease infinite",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
        {/* styles in global.css */}
        {/* Floating orbs */}
        <div style={{position:"absolute",top:"12%",left:"10%",width:120,height:120,borderRadius:"50%",background:"radial-gradient(circle,rgba(200,162,78,.12),transparent 70%)",animation:"float 6s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:"30%",right:"5%",width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,rgba(13,138,94,.1),transparent 70%)",animation:"float 8s ease-in-out 1s infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"25%",left:"20%",width:60,height:60,borderRadius:"50%",background:"radial-gradient(circle,rgba(12,122,146,.08),transparent 70%)",animation:"float 7s ease-in-out 2s infinite",pointerEvents:"none"}}/>
        {/* Grid pattern overlay */}
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.03) 1px,transparent 1px)",backgroundSize:"32px 32px",pointerEvents:"none"}}/>
        {/* Hero area */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 32px 0",position:"relative",zIndex:2}} key={obStep}>
          {/* Animated car icon */}
          <div style={{marginBottom:40,animation:"fadeUp .6s cubic-bezier(.23,1,.32,1) both"}}>
            <div style={{width:100,height:100,borderRadius:30,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",animation:obStep===0?"breathe 3s ease infinite":"none",position:"relative"}}>
              {obStep===0&&<CarLogo size={56} color="rgba(255,255,255,.9)"/>}
              {obStep===1&&<div style={{display:"flex",gap:3}}>{[1,2,3,4,5].map(i=><div key={i} style={{animation:`fadeUp .3s ${i*.08}s both`}}>{Ic.star(18,"#d4b05e")}</div>)}</div>}
              {obStep===2&&<div style={{display:"flex",gap:6}}>{[Ic.shield(24,"rgba(255,255,255,.8)"),Ic.dollar(24,"#d4b05e"),Ic.bolt(24,"rgba(255,255,255,.8)")].map((ic,i)=><div key={i} style={{animation:`fadeUp .3s ${i*.1}s both`}}>{ic}</div>)}</div>}
              {/* Glow ring */}
              <div style={{position:"absolute",inset:-8,borderRadius:38,border:"1px solid rgba(200,162,78,.15)",animation:"glowPulse 3s ease infinite"}}/>
            </div>
          </div>
          {/* Title with gradient text */}
          <div style={{textAlign:"center",animation:"fadeUp .6s .15s cubic-bezier(.23,1,.32,1) both"}}>
            <h1 style={{fontSize:34,fontWeight:800,lineHeight:1.1,marginBottom:4}}>
              <span style={{color:"rgba(255,255,255,.95)"}}>{s.title}</span><br/>
              <span style={{background:"linear-gradient(135deg,#c8a24e,#e8d48a,#c8a24e)",backgroundSize:"200% 200%",animation:"gradientShift 4s ease infinite",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{s.subtitle}</span>
            </h1>
          </div>
          <p style={{fontSize:15,color:"rgba(255,255,255,.5)",lineHeight:1.7,maxWidth:300,margin:"16px auto 0",textAlign:"center",animation:"fadeUp .6s .25s cubic-bezier(.23,1,.32,1) both"}}>{s.desc}</p>
        </div>
        {/* Bottom controls */}
        <div style={{padding:"24px 32px 48px",position:"relative",zIndex:2}}>
          {/* Progress dots */}
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:28}}>{steps.map((_,i)=><div key={i} style={{width:i===obStep?28:8,height:8,borderRadius:4,background:i===obStep?"#c8a24e":i<obStep?"rgba(200,162,78,.4)":"rgba(255,255,255,.15)",transition:"all .4s cubic-bezier(.23,1,.32,1)"}}/>)}</div>
          {/* CTA */}
          <button onClick={()=>{if(obStep<2)setObStep(obStep+1);else finishOb()}} style={{width:"100%",maxWidth:360,height:56,borderRadius:28,background:obStep===2?"linear-gradient(135deg,#c8a24e,#d4b05e)":"rgba(255,255,255,.12)",color:obStep===2?"#4a3510":"#fff",fontSize:16,fontWeight:700,boxShadow:obStep===2?"0 4px 20px rgba(200,162,78,.3)":"none",backdropFilter:obStep<2?"blur(10px)":"none",WebkitBackdropFilter:obStep<2?"blur(10px)":"none",border:obStep<2?"1px solid rgba(255,255,255,.1)":"none",transition:"all .3s",display:"block",margin:"0 auto"}}>
            {obStep<2?"Continue":"Get Started"}
          </button>
          {obStep===2&&<div style={{display:"flex",justifyContent:"center",gap:28,marginTop:24}}>{[["AI","Powered"],["Instant","Results"],["Free","To Start"]].map(([v,l],i)=><div key={i} style={{textAlign:"center",animation:`fadeUp .4s ${.1*i}s both`}}><div style={{fontSize:17,fontWeight:800,color:"rgba(255,255,255,.9)"}}>{v}</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontWeight:500}}>{l}</div></div>)}</div>}
          {obStep<2&&<button onClick={finishOb} style={{display:"block",margin:"16px auto 0",background:"none",border:"none",color:"rgba(255,255,255,.3)",fontSize:13,fontWeight:500}}>Skip</button>}
        </div>
      </div>
    );
  }
  /* ═══ PAYWALL ═══ */
  if(showPay){analytics.trackPaywallView(tab);return(
    <Shell nopad>
    {/* Dark hero */}
    <div style={{background:`linear-gradient(165deg,${C.pd},${C.pri})`,padding:"20px 18px 32px",borderRadius:"0 0 28px 28px",textAlign:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.03) 1px,transparent 1px)",backgroundSize:"24px 24px",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:2}}>
        <div style={{display:"flex",justifyContent:"flex-start",marginBottom:12}}><button onClick={()=>setPay(false)} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.08)",borderRadius:18,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>{Ic.back(18,"rgba(255,255,255,.7)")}</button></div>
        <div style={{width:72,height:72,borderRadius:24,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",animation:"breathe 3s ease infinite"}}><CarLogo size={44} color="#c8a24e"/></div>
        <h2 style={{fontSize:26,fontWeight:800,color:"#fff",marginBottom:4}}>Unlock <span style={{background:"linear-gradient(135deg,#c8a24e,#e8d48a)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Pro</span></h2>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:13}}>Your personal car expert</p>
        <div style={{display:"flex",justifyContent:"center",gap:20,marginTop:16}}>{[["AI","Powered"],["Instant","Analysis"],["All Cars","Covered"]].map(([v,l],i)=><div key={i}><div style={{fontSize:15,fontWeight:800,color:"rgba(255,255,255,.85)"}}>{v}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{l}</div></div>)}</div>
      </div>
    </div>
    <div style={{padding:"0 18px",marginTop:-14,position:"relative",zIndex:2}}>
    {/* Plan toggle */}
    <div style={{display:"flex",gap:8,marginBottom:14}} className="ani">
      {[["yr","Annual","$79.99","/yr","SAVE 33%"],["mo","Monthly","$9.99","/mo",""]].map(([id,l,p,per,badge])=><button key={id} onClick={()=>setPlan(id)} style={{flex:1,padding:"12px 10px",borderRadius:14,border:plan===id?`2px solid ${C.gold}`:`1px solid ${C.border}`,background:plan===id?C.gBg:C.white,position:"relative",textAlign:"left"}}>
        {badge&&<span style={{position:"absolute",top:-8,right:8,padding:"2px 8px",borderRadius:8,background:"linear-gradient(135deg,#c8a24e,#d4b05e)",color:"#4a3510",fontSize:9,fontWeight:800}}>{badge}</span>}
        <div style={{fontSize:11,color:C.t3,marginBottom:2}}>{l}</div>
        <div style={{fontSize:22,fontWeight:800}}>{p}<span style={{fontSize:12,fontWeight:400,color:C.t4}}>{per}</span></div>
        {id==="yr"&&<div style={{fontSize:11,color:C.g,fontWeight:600}}>= $6.67/mo</div>}
      </button>)}
    </div>
    {/* Free vs Pro */}
    <Card style={{marginBottom:12,padding:0,overflow:"hidden"}} className="ani">
      <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px",padding:"10px 14px",background:C.bg,borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontSize:11,fontWeight:700,color:C.t3}}>FEATURE</span><span style={{fontSize:11,fontWeight:700,color:C.t3,textAlign:"center"}}>Free</span><span style={{fontSize:11,fontWeight:700,color:C.gold,textAlign:"center"}}>Pro</span>
      </div>
      {[["Car identification","3 scans","∞"],["AI Chat expert","—","✓"],["VIN decoder","—","✓"],["Cost analysis","—","✓"],["Negotiation tips","—","✓"],["Depreciation data","—","✓"],["Maintenance schedule","—","✓"],["Multi-photo scan","1 photo","4"],["Owner reviews","—","✓"]].map(([f,free,pro],i,a)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px 60px",padding:"9px 14px",borderBottom:i<a.length-1?`1px solid ${C.border}`:"none"}}>
        <span style={{fontSize:12,color:C.t2}}>{f}</span>
        <span style={{fontSize:12,color:free==="—"?C.t5:C.t3,textAlign:"center",fontWeight:500}}>{free}</span>
        <span style={{fontSize:12,color:pro==="✓"||pro==="∞"||pro==="4"?C.g:C.t2,textAlign:"center",fontWeight:700}}>{pro}</span>
      </div>)}
    </Card>
    {/* Testimonial */}
    <Card style={{marginBottom:14,background:"linear-gradient(135deg,#eef4fb,#dce8f7)",border:`1px solid ${C.pBo}`}} className="ani">
      <div style={{display:"flex",gap:3,marginBottom:6}}>{[1,2,3,4,5].map(i=><span key={i}>{Ic.star(12,"#d4b05e")}</span>)}</div>
      <p style={{fontSize:13,color:C.t2,lineHeight:1.5,fontWeight:600}}>Know exactly what to pay</p>
      <p style={{fontSize:12,color:C.t3,lineHeight:1.5,marginTop:4}}>Pro includes walk-away prices, depreciation forecasts, and negotiation tips so you never overpay for a car.</p>
    </Card>
    <button onClick={async()=>{analytics.trackPurchaseStart(plan);try{const offerings=await payments.getOfferings();const pkg=offerings?.current?.availablePackages?.find((p:any)=>plan==="yr"?p.identifier==="$rc_annual":p.identifier==="$rc_monthly")||offerings?.current?.availablePackages?.[0];if(pkg){await payments.purchasePackage(pkg);savePro();setPay(false);showTst("Pro activated! Enjoy unlimited scans.")}else{showTst("Products loading... try again.")}}catch(e:any){if(e.message?.includes("cancel")||e.userCancelled){}else{showTst("Purchase failed. Try again.");crash.report(e,{action:"purchase"})}}}} style={{width:"100%",height:56,borderRadius:28,border:"none",background:"linear-gradient(135deg,#c8a24e,#e0c56e,#c8a24e)",backgroundSize:"200% 200%",animation:"gradientShift 3s ease infinite",color:"#4a3510",fontSize:16,fontWeight:800,boxShadow:"0 4px 20px rgba(200,162,78,.3)"}}>Start 7-Day Free Trial</button>
    <p style={{textAlign:"center",color:C.t4,fontSize:11,marginTop:10}}>Cancel anytime · No charge for 7 days · {plan==="yr"?"$79.99/year after trial":"$9.99/month after trial"}</p>
    <p style={{textAlign:"center",color:C.t5,fontSize:10,marginTop:6,lineHeight:1.5,padding:"0 10px"}}>Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Your Apple ID account will be charged for renewal within 24 hours prior to the end of the current period. You can manage and cancel subscriptions in your Account Settings on the App Store. Free trial converts to paid subscription.</p>
    <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:10}}>
      <button onClick={()=>window.open("https://zentry07.github.io/autolens-app/privacy.html","_blank")} style={{background:"none",border:"none",color:C.t4,fontSize:11,fontWeight:500,textDecoration:"underline"}}>Privacy</button>
      <button onClick={()=>window.open("https://zentry07.github.io/autolens-app/terms.html","_blank")} style={{background:"none",border:"none",color:C.t4,fontSize:11,fontWeight:500,textDecoration:"underline"}}>Terms</button>
      <button onClick={()=>window.open("https://zentry07.github.io/autolens-app/eula.html","_blank")} style={{background:"none",border:"none",color:C.t4,fontSize:11,fontWeight:500,textDecoration:"underline"}}>EULA</button>
    </div>
    <button onClick={async()=>{try{const info=await payments.restorePurchases();if(info?.isPremium){savePro();setPay(false);showTst("Purchases restored!")}else{showTst("No active subscription found.")}}catch{showTst("Could not restore. Try again.")}}} style={{display:"block",margin:"12px auto 0",background:"none",border:"none",color:C.t4,fontSize:12,fontWeight:500}}>Restore Purchases</button>
    </div>{/* close padding div */}
    </Shell>);
  }
  /* ═══ SETTINGS ═══ */
  if(showSettings){return(<Shell>
    <div style={{paddingTop:16}}><BackBtn onClick={()=>setSS(false)}/></div>
    <h1 style={{fontSize:22,fontWeight:800,marginBottom:16}}>Settings</h1>
    <Card style={{marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"4px 0",cursor:"pointer"}} onClick={()=>{if(!isPro)setPay(true)}}>
        <div style={{width:36,height:36,borderRadius:10,background:isPro?C.gBg:C.gBg2,display:"flex",alignItems:"center",justifyContent:"center"}}>{isPro?<ProBadge/>:Ic.bolt(16,C.gold)}</div>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{isPro?"AutoLens Pro":"Upgrade to Pro"}</div><div style={{fontSize:12,color:C.t3}}>{isPro?"Active subscription":"Unlock all features"}</div></div>
        {!isPro&&Ic.right(16,C.t5)}
      </div>
    </Card>
    <Card style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:8}}>AI DATA PROCESSING</div>
      <p style={{fontSize:12,color:C.t2,lineHeight:1.5,marginBottom:8}}>AutoLens sends your car photos and queries to a cloud-based AI service for analysis. Photos are processed in real-time and are not stored after analysis.</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
        <span style={{fontSize:13,color:C.t2}}>AI Processing Consent</span>
        <span style={{fontSize:12,fontWeight:600,color:aiConsent?C.g:C.t4}}>{aiConsent?"Granted":"Not granted"}</span>
      </div>
      {aiConsent&&<button onClick={async()=>{setAiC(false);try{await storage.removeItem("al10-aic")}catch{}showTst("AI consent revoked")}} style={{fontSize:12,color:C.r,background:"none",border:"none",fontWeight:500,padding:"4px 0"}}>Revoke Consent</button>}
    </Card>
    <Card style={{marginBottom:12}}>
      {[["Scan History",`${hist.length} scans`],["Favorites",`${favs.length} saved`]].map(([l,v],i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:i===0?`1px solid ${C.border}`:"none"}}><span style={{fontSize:14,color:C.t2}}>{l}</span><span style={{fontSize:14,color:C.t4}}>{v}</span></div>
      ))}
    </Card>
    <Card style={{marginBottom:12}}>
      <div onClick={async()=>{setHist([]);setFavs([]);setScansUsed(0);setAiC(false);setStreak({count:0,last:null,best:0});setMA(false);try{await storage.removeItem("al10");await storage.removeItem("al10-favs");await storage.removeItem("al10-scans");await storage.removeItem("al10-aic");await storage.removeItem("al10-streak");await storage.removeItem("al10-ma")}catch{}showTst("All data cleared")}} style={{padding:"10px 0",cursor:"pointer"}}><span style={{fontSize:14,color:C.r,fontWeight:500}}>Clear All Data</span></div>
    </Card>
    <Card style={{marginBottom:12}}>
      <div onClick={async()=>{try{const info=await payments.restorePurchases();if(info?.isPremium){savePro();showTst("Purchases restored!")}else{showTst("No active subscription found.")}}catch{showTst("Could not restore. Try again.")}}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}><span style={{fontSize:14,color:C.t2}}>Restore Purchases</span>{Ic.right(16,C.t5)}</div>
      <div onClick={async()=>{try{window.open("https://apps.apple.com/account/subscriptions","_blank")}catch{}showTst("Opening subscription management...")}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",cursor:"pointer"}}><span style={{fontSize:14,color:C.t2}}>Manage Subscription</span>{Ic.right(16,C.t5)}</div>
    </Card>
    <Card style={{marginBottom:12}}>
      {[["Privacy Policy","https://zentry07.github.io/autolens-app/privacy.html"],["Terms of Service","https://zentry07.github.io/autolens-app/terms.html"],["End User License Agreement","https://zentry07.github.io/autolens-app/eula.html"],["Contact Support","mailto:support@autolens.app"],["Rate on App Store","https://apps.apple.com/app/autolens/id6759729366?action=write-review"]].map(([l,url],i,a)=>(
        <div key={i} onClick={()=>{window.open(url,"_blank")}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<a.length-1?`1px solid ${C.border}`:"none",cursor:"pointer"}}><span style={{fontSize:14,color:C.t2}}>{l}</span>{Ic.right(16,C.t5)}</div>
      ))}
    </Card>
    <div style={{textAlign:"center",padding:"12px 0"}}><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:4}}><CarLogo size={18} color={C.t4}/><span style={{fontSize:13,color:C.t4,fontWeight:600}}>AutoLens</span></div><span style={{fontSize:12,color:C.t5}}>Version 1.0.0</span></div>
  </Shell>);}
  /* ═══ QUIZ FLOW ═══ */
  if(qStep>=0){
    const qs=[{q:"What's your budget?",opts:["Under $20k","$20k–$35k","$35k–$55k","$55k+"],key:"budget"},{q:"Primary use?",opts:["Daily commute","Family hauler","Weekend fun","Off-road / towing"],key:"use"},{q:"Top priority?",opts:["Fuel economy","Performance","Safety","Luxury & comfort"],key:"priority"},{q:"Preferred size?",opts:["Compact / sedan","Midsize SUV","Full-size truck/SUV","Sports / coupe"],key:"size"},{q:"Condition preference?",opts:["Brand new","1–3 years used","3–6 years used","Don't mind"],key:"condition"}];
    if(qRes){const recs=qRes.recommendations||[];return(<Shell>
      <div style={{paddingTop:16}}><BackBtn onClick={()=>{setQS(-1);setQR(null);setQA({})}}/></div>
      <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Your Matches</h1>
      <p style={{color:C.t3,fontSize:13,marginBottom:16}}>Based on your preferences</p>
      {recs.length===0?<Card style={{textAlign:"center",padding:28}}><p style={{fontSize:14,color:C.t3,marginBottom:12}}>No matches found. Try different preferences.</p><button onClick={()=>{setQS(0);setQR(null);setQA({})}} style={{padding:"10px 24px",borderRadius:20,border:"none",background:C.pri,color:"#fff",fontSize:13,fontWeight:700}}>Retake Quiz</button></Card>:
      recs.map((rec,i)=><Card key={i} style={{marginBottom:10,border:i===0?`2px solid ${C.gBo2}`:`1px solid ${C.border}`}} className="ani">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8}}>
          <div><div style={{fontSize:17,fontWeight:800}}>{rec.make} {rec.model}</div><div style={{fontSize:12,color:C.t3}}>{rec.year} · {rec.price_range}</div></div>
          <div style={{width:42,height:42,borderRadius:21,background:rec.fit_score>=8?C.gBg2:C.gBg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:15,fontWeight:800,color:rec.fit_score>=8?C.g:C.gold}}>{rec.fit_score}</span></div>
        </div>
        <p style={{fontSize:13,color:C.t2,lineHeight:1.5,marginBottom:8}}>{rec.why}</p>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{rec.pros?.map((p,j)=><Chip key={j} color={C.g} bg={C.gBg2}>{p}</Chip>)}{rec.cons?.map((c,j)=><Chip key={`c${j}`} color={C.r} bg={C.rBg}>{c}</Chip>)}</div>
      </Card>)}
      {recs.length>0&&<button onClick={()=>{setQS(0);setQR(null);setQA({})}} style={{width:"100%",height:44,borderRadius:22,border:`1px solid ${C.border}`,background:C.white,color:C.t2,fontSize:13,fontWeight:600,marginTop:4}}>Retake Quiz</button>}
    </Shell>);}
    if(qLd)return(<Shell><div style={{textAlign:"center",padding:"80px 20px"}}><div style={{width:40,height:40,borderRadius:20,border:`3px solid ${C.border}`,borderTopColor:C.pri,animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/><p style={{fontSize:16,fontWeight:700}}>Finding your match...</p><p style={{color:C.t3,fontSize:13,marginTop:6}}>Analyzing thousands of cars</p></div></Shell>);
    if(qStep>=qs.length)return null;
    const cur=qs[qStep];
    return(<Shell>
      <div style={{paddingTop:16}}><BackBtn onClick={()=>{if(qStep===0){setQS(-1);setQA({})}else setQS(qStep-1)}}/></div>
      <div style={{height:3,borderRadius:2,background:C.border,marginBottom:24}}><div style={{height:"100%",borderRadius:2,background:C.pri,width:`${((qStep+1)/5)*100}%`,transition:"width .4s cubic-bezier(.16,1,.3,1)"}}/></div>
      <h2 style={{fontSize:22,fontWeight:800,marginBottom:4}} className="ani" key={qStep}>{cur.q}</h2>
      <p style={{color:C.t3,fontSize:13,marginBottom:20}}>Step {qStep+1} of 5</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}} className="ani" key={`o${qStep}`}>
        {cur.opts.map((opt,i)=>{const sel=qAns[cur.key]===opt;return(
          <button key={i} onClick={()=>{const na={...qAns,[cur.key]:opt};setQA(na);if(qStep<4)setTimeout(()=>setQS(qStep+1),200);else{setQS(5);runQuiz(na)}}} style={{padding:"14px 16px",borderRadius:12,border:sel?`2px solid ${C.pri}`:`1px solid ${C.border}`,background:sel?C.pBg:C.white,textAlign:"left",fontSize:15,fontWeight:600,color:sel?C.pd:C.t1}}>{opt}</button>);})}
      </div>
    </Shell>);
  }
  /* ═══ DIAGNOSE DETAIL ═══ */
  if(diagItem){const D=diagAns;const urg=D?.urgency;const urgC=urg==="high"?C.r:urg==="medium"?C.gold:C.g;const urgBg=urg==="high"?C.rBg:urg==="medium"?C.gBg:C.gBg2;return(<Shell>
    <div style={{paddingTop:16}}><BackBtn onClick={()=>{setDI(null);setDA("")}}/></div>
    <h2 style={{fontSize:20,fontWeight:800,marginBottom:4}}>{diagItem}</h2>
    {diagCar&&<p style={{fontSize:12,color:C.t3,marginBottom:14}}>{diagCar.year} {diagCar.make} {diagCar.model}</p>}
    {diagLd?<Card><div style={{textAlign:"center",padding:30}}><div style={{width:32,height:32,borderRadius:16,border:`3px solid ${C.border}`,borderTopColor:C.pri,animation:"spin 1s linear infinite",margin:"0 auto 12px"}}/><p style={{fontSize:14,fontWeight:600}}>Diagnosing...</p><p style={{color:C.t3,fontSize:12,marginTop:4}}>Analyzing symptoms & causes</p></div></Card>:
    D?<div className="ani">
      {/* Urgency + Can Drive */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <Card style={{background:urgBg,border:"none",padding:12}}><div style={{fontSize:10,fontWeight:700,color:urgC,marginBottom:4}}>URGENCY</div><div style={{fontSize:16,fontWeight:800,color:urgC,textTransform:"uppercase"}}>{urg||"Unknown"}</div><p style={{fontSize:11,color:C.t3,marginTop:4,lineHeight:1.4}}>{D.urgency_note}</p></Card>
        <Card style={{background:D.can_drive?C.gBg2:C.rBg,border:"none",padding:12}}><div style={{fontSize:10,fontWeight:700,color:D.can_drive?C.g:C.r,marginBottom:4}}>SAFE TO DRIVE?</div><div style={{fontSize:16,fontWeight:800,color:D.can_drive?C.g:C.r}}>{D.can_drive?"Yes":"No"}</div><p style={{fontSize:11,color:C.t3,marginTop:4,lineHeight:1.4}}>{D.drive_note}</p></Card>
      </div>
      {/* Likely Causes */}
      <Card style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>LIKELY CAUSES</div>
        {D.likely_causes?.map((c2,i)=>{const prob=c2.probability;const pC=prob==="high"?C.r:prob==="medium"?C.gold:C.g;return <div key={i} style={{padding:"10px 0",borderBottom:i<D.likely_causes.length-1?`1px solid ${C.border}`:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:14,fontWeight:600}}>{c2.cause}</span>
            <Chip color={pC} bg={prob==="high"?C.rBg:prob==="medium"?C.gBg:C.gBg2}>{prob} likelihood</Chip>
          </div>
          <p style={{fontSize:12,color:C.t3,lineHeight:1.5}}>{c2.explanation}</p>
        </div>})}
      </Card>
      {/* Cost Estimate */}
      <Card style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>ESTIMATED REPAIR COST</div>
        <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:6}}><span style={{fontSize:24,fontWeight:800,color:C.pri}}>{D.estimated_cost?.low} — {D.estimated_cost?.high}</span></div>
        <p style={{fontSize:12,color:C.t3,lineHeight:1.5}}>{D.estimated_cost?.note}</p>
      </Card>
      {/* Quick Checks */}
      {D.quick_checks?.length>0&&<Card style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>QUICK CHECKS YOU CAN DO</div>
        {D.quick_checks.map((s,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<D.quick_checks.length-1?`1px solid ${C.border}`:"none"}}>
          <div style={{width:22,height:22,borderRadius:11,background:C.pBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}><span style={{fontSize:11,fontWeight:700,color:C.pri}}>{i+1}</span></div>
          <p style={{fontSize:13,color:C.t2,lineHeight:1.5}}>{s}</p>
        </div>)}
      </Card>}
      {/* DIY Section */}
      {D.diy_possible&&D.diy_steps?.length>0&&<Card style={{marginBottom:12,background:C.gBg2,border:`1px solid ${C.gBo2}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:C.t3}}>DIY FIX</div><Chip color={D.diy_difficulty==="easy"?C.g:D.diy_difficulty==="medium"?C.gold:C.r} bg={C.white}>{D.diy_difficulty}</Chip></div>
        {D.diy_steps.map((s,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<D.diy_steps.length-1?`1px solid ${C.gBo2}`:"none"}}>
          <div style={{width:22,height:22,borderRadius:11,background:C.white,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}><span style={{fontSize:11,fontWeight:700,color:C.g}}>{i+1}</span></div>
          <p style={{fontSize:13,color:C.t2,lineHeight:1.5}}>{s}</p>
        </div>)}
      </Card>}
      {/* Mechanic Note */}
      <Card style={{marginBottom:12,background:C.pBg,border:`1px solid ${C.pBo}`}}>
        <div style={{display:"flex",gap:10,alignItems:"start"}}>
          {Ic.wrench(16,C.pri)}
          <div><div style={{fontSize:12,fontWeight:700,color:C.pd,marginBottom:4}}>WHEN TO SEE A MECHANIC</div><p style={{fontSize:13,color:C.t2,lineHeight:1.5}}>{D.mechanic_note}</p></div>
        </div>
      </Card>
    </div>:<Card><p style={{fontSize:14,color:C.t3,textAlign:"center",padding:20}}>Could not diagnose. Try again.</p></Card>}
  </Shell>);}
  /* ═══ EXPLORE CATEGORY RESULTS ═══ */
  if(expCat){return(<Shell>
    <div style={{paddingTop:16}}><BackBtn onClick={()=>{setEC(null);setER(null)}}/></div>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:4}}>{expCat}</h2>
    <p style={{color:C.t3,fontSize:13,marginBottom:16}}>AI-curated picks for 2025</p>
    {expLd?<div style={{textAlign:"center",padding:"40px 0"}}><div style={{width:32,height:32,borderRadius:16,border:`3px solid ${C.border}`,borderTopColor:C.pri,animation:"spin 1s linear infinite",margin:"0 auto 12px"}}/><p style={{color:C.t3,fontSize:13}}>Finding the best cars...</p></div>:
    expRes?.cars?.length>0?expRes.cars.map((car,i)=><Card key={i} style={{marginBottom:10,display:"flex",gap:14,alignItems:"start"}} className="ani">
      <div style={{width:44,height:44,borderRadius:22,background:i===0?C.gBg2:i===1?C.pBg:C.gBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:15,fontWeight:800,color:i===0?C.g:i===1?C.pri:C.gold}}>#{i+1}</span></div>
      <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>{car.name}</div><div style={{fontSize:12,color:C.t3,marginTop:2}}>{car.price} · {car.score}/10</div><p style={{fontSize:12,color:C.t2,lineHeight:1.5,marginTop:6}}>{car.why}</p><Chip color={C.cy} bg="rgba(8,145,178,.06)">{car.best_for}</Chip></div>
    </Card>):<Card style={{textAlign:"center",padding:28}}><p style={{color:C.t3}}>No results found. Try again.</p></Card>}
  </Shell>);}
  /* ═══ GUIDE READER ═══ */
  if(guideItem){return(<Shell>
    <div style={{paddingTop:16}}><BackBtn onClick={()=>{setGI(null);setGA("")}}/></div>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>{guideItem}</h2>
    {guideLd?<Card><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:16,height:16,borderRadius:8,border:`2px solid ${C.border}`,borderTopColor:C.pri,animation:"spin 1s linear infinite"}}/><span style={{fontSize:13,color:C.t3}}>Loading guide...</span></div></Card>:
    guideAns?<Card className="ani"><p style={{fontSize:14,color:C.t2,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{guideAns}</p></Card>:null}
  </Shell>);}
  /* ═══ COMPARE ═══ */
  if(showCmp&&cmpA&&cmpB){const a=cmpA.data,b=cmpB.data;return(<Shell>
    <div style={{paddingTop:16}}><BackBtn onClick={()=>setSCmp(false)}/></div>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:14}}>Compare</h2>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <Card style={{textAlign:"center",padding:14}}><div style={{fontSize:15,fontWeight:800}}>{cmpA.make}</div><div style={{fontSize:13,color:C.t3}}>{cmpA.model}</div><div style={{fontSize:24,fontWeight:800,color:C.pri,marginTop:6}}>{a?.ratings?.overall_score||"?"}</div><div style={{fontSize:10,color:C.t4}}>Overall</div></Card>
      <Card style={{textAlign:"center",padding:14}}><div style={{fontSize:15,fontWeight:800}}>{cmpB.make}</div><div style={{fontSize:13,color:C.t3}}>{cmpB.model}</div><div style={{fontSize:24,fontWeight:800,color:C.g,marginTop:6}}>{b?.ratings?.overall_score||"?"}</div><div style={{fontSize:10,color:C.t4}}>Overall</div></Card>
    </div>
    <Card style={{marginBottom:12}}>
      {[["Reliability","reliability_score"],["Value","value_score"],["Safety","safety_score"],["Fun","fun_factor"],["Tech","tech_score"]].map(([l,k],i,arr)=>{const av=a?.ratings?.[k]||0,bv=b?.ratings?.[k]||0;return(
        <div key={k} style={{padding:"10px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:700,color:av>=bv?C.pri:C.t3}}>{av}</span><span style={{fontSize:12,color:C.t3}}>{l}</span><span style={{fontSize:13,fontWeight:700,color:bv>=av?C.g:C.t3}}>{bv}</span></div>
          <div style={{display:"flex",gap:4,height:4}}>
            <div style={{flex:1,borderRadius:2,background:C.border,overflow:"hidden",display:"flex",justifyContent:"flex-end"}}><div style={{width:`${av*10}%`,background:C.pri,borderRadius:2}}/></div>
            <div style={{flex:1,borderRadius:2,background:C.border,overflow:"hidden"}}><div style={{width:`${bv*10}%`,background:C.g,borderRadius:2}}/></div>
          </div>
        </div>);})}
    </Card>
    {a?.specs&&b?.specs&&<Card style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>SPECS</div>
      {[["Engine","engine"],["HP","horsepower"],["MPG","mpg"],["0-60","zero_sixty"],["Price","msrp_range"]].map(([l,k],i,arr)=><div key={k} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,padding:"8px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}><span style={{fontSize:12,fontWeight:600,textAlign:"right"}}>{a.specs[k]||"—"}</span><span style={{fontSize:11,color:C.t4,textAlign:"center"}}>{l}</span><span style={{fontSize:12,fontWeight:600}}>{b.specs[k]||"—"}</span></div>)}
    </Card>}
  </Shell>);}
  /* ═══ RESULT PAGE ═══ */
  if(tab==="result"&&result){
    const R=result;const tabs2=[["overview","Overview"],["specs","Specs"],["cost","Cost"],["safety","Safety"],["chat","Ask AI"]];
    return(<Shell nopad>
      {/* Hero */}
      <div style={{position:"relative"}}>
        {imgs[0]?<img src={imgs[0]} alt="" style={{width:"100%",height:300,objectFit:"cover",display:"block"}}/>:<div style={{height:220,background:`linear-gradient(165deg,${C.pd},${C.pri})`}}/>}
        <div style={{position:"absolute",top:12,left:12}}><button onClick={()=>{reset();goTab(prevTab==="result"?"home":prevTab)}} className="glass-dark" style={{width:38,height:38,borderRadius:19,display:"flex",alignItems:"center",justifyContent:"center"}}>{Ic.back(18,"#fff")}</button></div>
        <div style={{position:"absolute",top:12,right:12,display:"flex",gap:8}}>
          <button onClick={toggleFav} className="glass-dark" style={{width:38,height:38,borderRadius:19,display:"flex",alignItems:"center",justifyContent:"center"}}>{isFav?Ic.heartFill(18,"#ef4444"):Ic.heart(18,"rgba(255,255,255,.8)")}</button>
          <button onClick={shareCard} className="glass-dark" style={{width:38,height:38,borderRadius:19,display:"flex",alignItems:"center",justifyContent:"center"}}>{Ic.share(16,"rgba(255,255,255,.8)")}</button>
        </div>
        {/* Gradient fade to content */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:100,background:`linear-gradient(transparent,${C.bg})`}}/>
      </div>
      <div style={{padding:"0 16px",marginTop:-32,position:"relative",zIndex:2}}>
        {/* Title card */}
        <Card style={{marginBottom:12}} className="ani">
          <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:12}}>
            {/* Big score */}
            <div style={{position:"relative",width:72,height:72,flexShrink:0}}>
              <svg width={72} height={72} style={{transform:"rotate(-90deg)"}}><circle cx={36} cy={36} r={30} fill="none" stroke={C.border} strokeWidth="4.5"/><circle cx={36} cy={36} r={30} fill="none" stroke={R.ratings?.overall_score>=8?C.g:R.ratings?.overall_score>=6?C.gold:C.r} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={2*Math.PI*30} strokeDashoffset={2*Math.PI*30-(R.ratings?.overall_score||0)/10*2*Math.PI*30} style={{transition:"stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)"}}/></svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:22,fontWeight:800}}>{R.ratings?.overall_score}</span><span style={{fontSize:8,color:C.t4,fontWeight:600}}>/10</span></div>
            </div>
            <div style={{flex:1}}>
              <h1 style={{fontSize:22,fontWeight:800,lineHeight:1.15,marginBottom:3}}>{R.make} {R.model}</h1>
              <p style={{fontSize:13,color:C.t3}}>{R.year_range}{R.trim?` · ${R.trim}`:""}{R.origin?.brand_country?` · ${R.origin.brand_country}`:""}</p>
              <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>
                {R.body_style&&<Chip>{R.body_style}</Chip>}
                {R.specs?.fuel_type&&<Chip color={C.cy} bg="rgba(8,145,178,.08)">{R.specs.fuel_type}</Chip>}
              </div>
            </div>
          </div>
          {/* Verdict bar — the hero moment */}
          <div style={{padding:"12px 14px",borderRadius:14,background:R.should_buy?.verdict==="Yes"?"linear-gradient(135deg,#ecfdf5,#d1fae5)":"linear-gradient(135deg,#fefce8,#fef9c3)",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:20,background:R.should_buy?.verdict==="Yes"?C.g:C.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{R.should_buy?.verdict==="Yes"?Ic.check(20,"#fff"):Ic.alert(20,"#fff")}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:R.should_buy?.verdict==="Yes"?"#15803d":"#92400e"}}>{R.should_buy?.verdict==="Yes"?"Buy It":"Think Twice"}</div>
              <p style={{fontSize:12,color:C.t3,lineHeight:1.4,marginTop:2}}>{R.should_buy?.reason}</p>
            </div>
          </div>
          {/* AI Disclaimer */}
          <div style={{padding:"8px 12px",borderRadius:10,background:"rgba(100,116,139,.06)",marginTop:8}}>
            <p style={{fontSize:10,color:C.t4,lineHeight:1.5,textAlign:"center"}}>AI-generated estimates for informational purposes only. Verify all data with a dealer or mechanic before making purchase decisions.</p>
          </div>
        </Card>
        {/* Quick stats strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
          {[["Price",R.specs?.msrp_range||R.specs?.used_price_range,C.pri,C.pBg],["MPG",R.specs?.mpg,C.g,C.gBg2],["0-60",R.specs?.zero_sixty,C.gold,C.gBg]].map(([l,v,clr,bg],i)=><div key={i} style={{background:bg,borderRadius:12,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:800,color:clr}}>{v||"—"}</div><div style={{fontSize:9,color:C.t4,marginTop:2}}>{l}</div></div>)}
        </div>
        {/* Mini score row */}
        <Card style={{marginBottom:12,padding:"10px 14px"}} className="ani">
          <div style={{display:"flex",justifyContent:"space-around"}}>{[["reliability_score","Reliable",C.g],["value_score","Value",C.gold],["safety_score","Safety",C.pri],["fun_factor","Fun","#ec4899"],["tech_score","Tech",C.cy]].map(([k,l,clr])=><ScoreRing key={k} score={R.ratings?.[k]||0} size={44} color={clr} label={l}/>)}</div>
        </Card>
        {/* Sub tabs */}
        <div style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
          {tabs2.map(([id,l])=><button key={id} onClick={()=>{if((id==="cost"||id==="chat")&&!isPro){if(id==="cost"&&!proPreview){setSub(id);setProPrev(true);showTst("Free preview! Unlock Pro for full access.");analytics.trackFeatureUsed("pro_preview");return}setPay(true);return}setSub(id)}} style={{flex:"0 0 auto",height:34,padding:"0 14px",borderRadius:17,border:subTab===id?"none":`1px solid ${C.border}`,background:subTab===id?C.pri:C.white,color:subTab===id?"#fff":C.t3,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>{l}{(id==="cost"||id==="chat")&&!isPro&&<ProBadge/>}</button>)}
        </div>
        {/* OVERVIEW */}
        {subTab==="overview"&&(<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <Card><div style={{fontSize:11,fontWeight:700,color:C.g,marginBottom:8,display:"flex",alignItems:"center",gap:4}}>{Ic.check(13,C.g)} Pros</div>{R.pros?.map((p,i)=><p key={i} style={{fontSize:12,color:C.t2,lineHeight:1.5,marginBottom:4}}>• {p}</p>)}</Card>
            <Card><div style={{fontSize:11,fontWeight:700,color:C.r,marginBottom:8}}>✕ Cons</div>{R.cons?.map((c2,i)=><p key={i} style={{fontSize:12,color:C.t2,lineHeight:1.5,marginBottom:4}}>• {c2}</p>)}</Card>
          </div>
          {R.fun_facts?.length>0&&<Card style={{marginBottom:12,background:C.gBg,border:`1px solid ${C.gBo}`}}><div style={{fontSize:12,fontWeight:700,color:C.gold,marginBottom:8}}>DID YOU KNOW</div>{R.fun_facts.map((f,i)=><p key={i} style={{fontSize:13,color:C.t2,lineHeight:1.6,marginTop:i?6:0}}>{f}</p>)}</Card>}
          {/* Competitors */}
          {R.competitors?.filter(c=>c)?.length>0&&<Card style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>COMPETITORS</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{R.competitors.filter(c=>c).map((c,i)=><Chip key={i} color={C.pri} bg={C.pBg}>{c}</Chip>)}</div>
          </Card>}
          {/* Where to Buy */}
          {R.where_to_buy&&<Card style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>WHERE TO BUY</div>
            {R.where_to_buy.best_sources?.filter(s=>s).map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}>{Ic.check(14,C.g)}<span style={{fontSize:13,color:C.t2}}>{s}</span></div>)}
            {R.where_to_buy.tips&&<p style={{fontSize:12,color:C.t3,lineHeight:1.5,marginTop:8,padding:10,borderRadius:8,background:C.bg}}>{R.where_to_buy.tips}</p>}
          </Card>}
        </>)}
        {/* SPECS */}
        {subTab==="specs"&&(<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {[["0-60",R.specs?.zero_sixty,C.pri,C.pBg],[" HP",R.specs?.horsepower,C.g,C.gBg2],["Top",R.specs?.top_speed,C.gold,C.gBg]].map(([l,v,clr,bg],i)=><Card key={i} style={{padding:14,textAlign:"center",background:bg}}><div style={{fontSize:18,fontWeight:800,color:clr}}>{v||"—"}</div><div style={{fontSize:10,color:C.t4,marginTop:2}}>{l}</div></Card>)}
          </div>
          <Card style={{marginBottom:12}}>{[["Engine",R.specs?.engine],["Torque",R.specs?.torque],["Transmission",R.specs?.transmission],["Drivetrain",R.specs?.drivetrain],["MPG",R.specs?.mpg],["Weight",R.specs?.curb_weight],["Seating",R.specs?.seating],["Cargo",R.specs?.cargo_space]].map(([l,v],i)=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:i<7?`1px solid ${C.border}`:"none"}}><span style={{fontSize:13,color:C.t3}}>{l}</span><span style={{fontSize:13,fontWeight:600}}>{v||"—"}</span></div>)}</Card>
        </>)}
        {/* COST (Pro + free preview) */}
        {subTab==="cost"&&(<>
          {!isPro&&<Card style={{marginBottom:12,padding:12,background:"linear-gradient(135deg,#faf6ec,#fef3e2)",border:`1px solid ${C.gBo}`,display:"flex",alignItems:"center",gap:10}} className="ani">
            {Ic.star(16,C.gold)}<div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:"#92400e"}}>Free Preview</div><div style={{fontSize:11,color:C.t3}}>You're seeing full cost data for this car. Upgrade for unlimited access.</div></div>
            <button onClick={()=>setPay(true)} style={{padding:"6px 14px",borderRadius:14,border:"none",background:C.gold,color:"#fff",fontSize:11,fontWeight:700,flexShrink:0}}>Upgrade</button>
          </Card>}
          <Card style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:12}}>ANNUAL COST OF OWNERSHIP</div><div style={{fontSize:28,fontWeight:800,color:C.gold,marginBottom:16}}>{R.cost_of_ownership?.total_annual_cost||"—"}<span style={{fontSize:13,fontWeight:400,color:C.t3}}> / year</span></div>{[["Insurance",R.cost_of_ownership?.annual_insurance,C.r],["Fuel",R.cost_of_ownership?.annual_fuel,C.gold],["Maintenance",R.cost_of_ownership?.annual_maintenance,C.cy]].map(([l,v,clr])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.t3}}>{l}</span><span style={{fontSize:13,fontWeight:700,color:clr}}>{v||"—"}</span></div>)}</Card>
          <Card style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:12}}>DEPRECIATION FORECAST</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>{[["1 Year",R.resale_prediction?.["1yr_value"]],["3 Year",R.resale_prediction?.["3yr_value"]],["5 Year",R.resale_prediction?.["5yr_value"]]].map(([l,v])=><div key={l} style={{textAlign:"center",padding:12,borderRadius:12,background:C.bg}}><div style={{fontSize:10,color:C.t4,marginBottom:4}}>{l}</div><div style={{fontSize:15,fontWeight:800,color:C.g}}>{v||"—"}</div></div>)}</div></Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}><Card style={{textAlign:"center",background:C.gBg2,border:`1px solid ${C.gBo2}`}}><div style={{fontSize:10,color:C.t3,marginBottom:4}}>NEW MSRP</div><div style={{fontSize:16,fontWeight:800,color:C.g}}>{R.specs?.msrp_range||"—"}</div></Card><Card style={{textAlign:"center",background:C.pBg,border:`1px solid ${C.pBo}`}}><div style={{fontSize:10,color:C.t3,marginBottom:4}}>USED</div><div style={{fontSize:16,fontWeight:800,color:C.pri}}>{R.specs?.used_price_range||"—"}</div></Card></div>
          {R.negotiation_tips&&<Card style={{marginBottom:12,background:C.gBg,border:`1px solid ${C.gBo}`}}><div style={{fontSize:12,fontWeight:700,color:C.gold,marginBottom:10}}>NEGOTIATION TIPS</div>{R.negotiation_tips.walk_away_price&&<div style={{padding:10,borderRadius:10,background:C.white,marginBottom:8}}><div style={{fontSize:10,color:C.t4}}>Walk-Away Price</div><div style={{fontSize:16,fontWeight:800,color:C.g}}>{R.negotiation_tips.walk_away_price}</div></div>}{R.negotiation_tips.best_leverage_points?.map((p,i)=><p key={i} style={{fontSize:12,color:C.t2,lineHeight:1.5,marginBottom:4}}>• {p}</p>)}</Card>}
          {/* Depreciation Chart */}
          {R.depreciation_curve&&<Card style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:14}}>DEPRECIATION CURVE</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,paddingBottom:20,position:"relative"}}>
              {[["New",R.depreciation_curve.yr0_pct],["1yr",R.depreciation_curve.yr1_pct],["2yr",R.depreciation_curve.yr2_pct],["3yr",R.depreciation_curve.yr3_pct],["4yr",R.depreciation_curve.yr4_pct],["5yr",R.depreciation_curve.yr5_pct]].map(([l,v],i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:10,fontWeight:700,color:v>70?C.g:v>50?C.gold:C.r}}>{v}%</span>
                <div style={{width:"100%",borderRadius:6,background:v>70?C.gBg2:v>50?C.gBg:C.rBg,height:`${v}%`,minHeight:4,transition:"height .6s cubic-bezier(.16,1,.3,1)",transitionDelay:`${i*0.1}s`}}/>
                <span style={{fontSize:9,color:C.t4,position:"absolute",bottom:0}}>{l}</span>
              </div>)}
            </div>
          </Card>}
          {/* Owner Reviews */}
          {R.owner_reviews&&<Card style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:C.t3}}>OWNER REVIEWS</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:18,fontWeight:800,color:C.pri}}>{R.owner_reviews.satisfaction_score}</span><span style={{fontSize:11,color:C.t4}}>/10</span></div>
            </div>
            {R.owner_reviews.would_buy_again_pct&&<div style={{padding:10,borderRadius:10,background:C.gBg2,marginBottom:10,textAlign:"center"}}><span style={{fontSize:20,fontWeight:800,color:C.g}}>{R.owner_reviews.would_buy_again_pct}</span><span style={{fontSize:12,color:C.t3}}> would buy again</span></div>}
            <div style={{marginBottom:8}}><div style={{fontSize:11,fontWeight:600,color:C.g,marginBottom:4}}>What owners love</div>{R.owner_reviews.common_praise?.map((p,i)=><div key={i} style={{fontSize:12,color:C.t2,padding:"3px 0",display:"flex",gap:6}}>{Ic.check(12,C.g)}<span>{p}</span></div>)}</div>
            <div><div style={{fontSize:11,fontWeight:600,color:C.r,marginBottom:4}}>Common complaints</div>{R.owner_reviews.common_complaints?.map((c,i)=><div key={i} style={{fontSize:12,color:C.t2,padding:"3px 0",display:"flex",gap:6}}><span style={{color:C.r}}>•</span><span>{c}</span></div>)}</div>
          </Card>}
          {/* Problems by Mileage */}
          {R.problems_by_mileage&&<Card style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>KNOWN ISSUES BY MILEAGE</div>
            {[["0-30k mi",R.problems_by_mileage["0_30k"],C.g],["30-60k mi",R.problems_by_mileage["30k_60k"],C.gold],["60-100k mi",R.problems_by_mileage["60k_100k"],"#f97316"],["100k+ mi",R.problems_by_mileage["100k_plus"],C.r]].map(([range,issues,clr],i)=>issues?.filter(x=>x)?.length>0&&<div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:8,height:8,borderRadius:4,background:clr}}/><span style={{fontSize:12,fontWeight:600}}>{range}</span></div>
              {issues.filter(x=>x).map((issue,j)=><p key={j} style={{fontSize:12,color:C.t3,paddingLeft:14}}>{issue}</p>)}
            </div>)}
          </Card>}
        </>)}
        {/* SAFETY */}
        {subTab==="safety"&&(<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <Card style={{textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:C.t4,marginBottom:6}}>NHTSA</div><div style={{fontSize:28,fontWeight:800,color:C.g}}>{R.safety?.nhtsa_rating||"—"}</div></Card>
            <Card style={{textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:C.t4,marginBottom:6}}>IIHS</div><div style={{fontSize:14,fontWeight:700,color:C.pri}}>{R.safety?.iihs_rating||"—"}</div></Card>
          </div>
          {R.safety?.driver_assists?.length>0&&<Card style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>DRIVER ASSISTS</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{R.safety.driver_assists.map((a,i)=><Chip key={i} color={C.cy} bg="rgba(8,145,178,.06)">{a}</Chip>)}</div></Card>}
          {R.maintenance_timeline&&isPro&&<Card style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.t3}}>MAINTENANCE SCHEDULE</div><ProBadge/></div>{R.maintenance_timeline.filter(m=>m.service).map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><div style={{width:8,height:8,borderRadius:4,background:[C.g,C.g,C.gold,C.gold,C.r][i]||C.t4,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{m.service}</div><div style={{fontSize:11,color:C.t4}}>{m.miles} mi</div></div><span style={{fontSize:12,fontWeight:600,color:C.t3}}>{m.est_cost}</span></div>)}</Card>}
          {R.reliability&&<Card style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:10}}>RELIABILITY</div><Chip color={R.reliability?.rating==="Excellent"||R.reliability?.rating==="Good"?C.g:C.gold} bg={R.reliability?.rating==="Excellent"||R.reliability?.rating==="Good"?C.gBg2:C.gBg}>{R.reliability?.rating}</Chip>{R.reliability?.warranty&&<p style={{fontSize:12,color:C.t3,marginTop:10}}>Warranty: {R.reliability.warranty}</p>}</Card>}
        </>)}
        {/* CHAT */}
        {subTab==="chat"&&(isPro?<Card style={{marginBottom:12}}><Chat result={R}/></Card>:
          <Card style={{marginBottom:12,position:"relative",overflow:"hidden"}}>
            <div style={{filter:"blur(3px)",opacity:.4,pointerEvents:"none"}}>
              <div style={{textAlign:"center",padding:16}}><div style={{width:48,height:48,borderRadius:24,background:C.pBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}>{Ic.chat(22,C.pri)}</div><p style={{color:C.t3,fontSize:13}}>Ask anything about this car</p></div>
            </div>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,.7)"}}>
              {Ic.lock(22,C.pri)}
              <p style={{fontSize:14,fontWeight:700,marginTop:8}}>AI Car Expert</p>
              <p style={{fontSize:12,color:C.t3,marginTop:2}}>Get instant answers about this {R.make}</p>
              <button onClick={()=>setPay(true)} style={{padding:"8px 20px",borderRadius:18,border:"none",background:C.pri,color:"#fff",fontSize:12,fontWeight:700,marginTop:10}}>Try Pro Free</button>
            </div>
          </Card>)}
        {!isPro&&<Card style={{marginBottom:12,position:"relative",overflow:"hidden"}}>
          <div style={{filter:"blur(4px)",opacity:.5,pointerEvents:"none",padding:"8px 0"}}>
            <div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:8}}>ANNUAL COST OF OWNERSHIP</div>
            <div style={{fontSize:24,fontWeight:800,color:C.gold}}>$3,450/yr</div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:12,color:C.t3}}>Insurance</span><span style={{fontSize:12,fontWeight:600}}>$1,200</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:12,color:C.t3}}>Fuel</span><span style={{fontSize:12,fontWeight:600}}>$1,450</span></div>
          </div>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,.6)",backdropFilter:"blur(2px)"}}>
            {Ic.lock(22,C.gold)}
            <p style={{fontSize:14,fontWeight:700,color:C.t1,marginTop:8}}>Unlock Cost & Chat Analysis</p>
            <button onClick={()=>setPay(true)} style={{padding:"8px 20px",borderRadius:18,border:"none",background:"linear-gradient(135deg,#c8a24e,#d4b05e)",color:"#4a3510",fontSize:12,fontWeight:700,marginTop:8}}>Try Pro Free</button>
          </div>
        </Card>}
        {/* Share as card CTA */}
        <Card style={{marginBottom:12,padding:14,display:"flex",gap:12,alignItems:"center",cursor:"pointer",background:"linear-gradient(135deg,#eef4fb,#f8fafc)",border:`1px solid ${C.pBo}`}} className="ani" onClick={shareCard}>
          <div style={{width:42,height:42,borderRadius:14,background:C.white,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(15,43,76,.06)"}}>{Ic.share(18,C.pri)}</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700}}>Share This Car</div><div style={{fontSize:12,color:C.t3}}>Generate a branded card for social media</div></div>
          {Ic.right(16,C.t5)}
        </Card>
        {/* See Listings — deep link to marketplace */}
        <Card style={{marginBottom:12,padding:14,cursor:"pointer",background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",border:`1px solid ${C.gBo2}`}} className="ani" onClick={()=>{const q=encodeURIComponent(`${R.year_range} ${R.make} ${R.model}`);window.open(`https://www.cars.com/shopping/results/?keyword=${q}`,"_blank");analytics.trackFeatureUsed("see_listings")}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:42,height:42,borderRadius:14,background:C.white,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(13,138,94,.08)"}}>{Ic.search(18,C.g)}</div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"#15803d"}}>See Listings Near You</div><div style={{fontSize:12,color:C.t3}}>Browse {R.make} {R.model} for sale on Cars.com</div></div>
            {Ic.right(16,C.t5)}
          </div>
        </Card>
        {/* Potential Savings — show negotiation value */}
        {(()=>{const msrp=R.specs?.msrp_range||R.specs?.used_price_range||"";const walk=R.negotiation_tips?.walk_away_price||"";if(!msrp||!walk)return null;const parsePrice=s=>{const m=String(s).replace(/[^0-9]/g,"");return m?parseInt(m):0};const msrpVal=parsePrice(msrp.includes("-")?msrp.split("-")[0]:msrp);const walkVal=parsePrice(walk);const savings=msrpVal-walkVal;if(savings<=0||savings>50000)return null;return(
        <Card style={{marginBottom:12,padding:16,background:`linear-gradient(135deg,${C.pd},${C.pri})`,border:"none",borderRadius:18,position:"relative",overflow:"hidden"}} className="ani">
          <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px)",backgroundSize:"20px 20px",pointerEvents:"none"}}/>
          <div style={{position:"relative",zIndex:2}}>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(200,162,78,.7)",letterSpacing:".06em",marginBottom:6}}>POTENTIAL SAVINGS</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>
              <span style={{fontSize:32,fontWeight:800,color:"#c8a24e"}}>${savings.toLocaleString()}</span>
              <span style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>off asking price</span>
            </div>
            <div style={{display:"flex",gap:12,marginBottom:12}}>
              <div style={{flex:1,padding:"8px 12px",borderRadius:10,background:"rgba(255,255,255,.06)"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginBottom:2}}>Avg. Asking</div>
                <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,.8)"}}>{msrp.includes("-")?msrp.split("-")[0].trim():msrp}</div>
              </div>
              <div style={{flex:1,padding:"8px 12px",borderRadius:10,background:"rgba(200,162,78,.1)",border:"1px solid rgba(200,162,78,.2)"}}>
                <div style={{fontSize:10,color:"rgba(200,162,78,.6)",marginBottom:2}}>Walk-Away Price</div>
                <div style={{fontSize:14,fontWeight:700,color:"#c8a24e"}}>{walk}</div>
              </div>
            </div>
            <p style={{fontSize:12,color:"rgba(255,255,255,.35)",lineHeight:1.5,marginBottom:isPro?0:10}}>Negotiate to the walk-away price and save up to ${savings.toLocaleString()}. {isPro?"See negotiation tips above.":"Unlock Pro for negotiation scripts & dealer tactics."}</p>
            {!isPro&&<button onClick={()=>setPay(true)} style={{width:"100%",height:42,borderRadius:21,border:"none",background:"linear-gradient(135deg,#c8a24e,#e0c56e)",color:"#4a3510",fontSize:13,fontWeight:700}}>Unlock Negotiation Tips</button>}
          </div>
        </Card>);})()}
        {/* Soft paywall — appears 3s after first scan for free users */}
        {showSoftPay&&!isPro&&<div style={{marginBottom:12,borderRadius:18,padding:2,background:"linear-gradient(135deg,rgba(200,162,78,.4),rgba(200,162,78,.1))",animation:"glowPulse 4s ease infinite"}} className="ani">
          <Card style={{borderRadius:16,border:"none",position:"relative",overflow:"hidden"}}>
            <button onClick={()=>setSoftPay(false)} style={{position:"absolute",top:8,right:8,width:36,height:36,borderRadius:18,background:C.bg,border:"none",fontSize:16,color:C.t4,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            <div style={{textAlign:"center",padding:"4px 0 8px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.gold,letterSpacing:".06em",marginBottom:6}}>YOU JUST UNLOCKED</div>
              <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Full Analysis for This {R.make}</div>
              <p style={{fontSize:13,color:C.t3,marginBottom:14}}>Cost breakdown, depreciation forecast, negotiation tips, and AI expert chat — all for this specific car.</p>
              <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:14,flexWrap:"wrap"}}>
                {["Walk-Away Price","5yr Depreciation","Owner Reviews","AI Chat Expert"].map((f,i)=><Chip key={i} color={C.gold} bg={C.gBg}>{f}</Chip>)}
              </div>
              <button onClick={()=>{setSoftPay(false);setPay(true)}} style={{width:"100%",height:48,borderRadius:24,border:"none",background:"linear-gradient(135deg,#c8a24e,#e0c56e,#c8a24e)",backgroundSize:"200% 200%",animation:"gradientShift 3s ease infinite",color:"#4a3510",fontSize:15,fontWeight:800,boxShadow:"0 4px 16px rgba(200,162,78,.25)"}}>Try Pro Free for 7 Days</button>
              <p style={{fontSize:11,color:C.t5,marginTop:8}}>No charge until trial ends · Cancel anytime</p>
            </div>
          </Card>
        </div>}
        <button onClick={()=>{reset();goTab("scan")}} style={{width:"100%",height:48,borderRadius:24,border:`1px solid ${C.border}`,background:C.white,color:C.t1,fontSize:14,fontWeight:700,marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{Ic.camera(18,C.pri)} Scan Another Car</button>
      </div>
    </Shell>);
  }
  /* ═══ HOME TAB ═══ */
  if(tab==="home"){const hr=new Date().getHours();const greet=hr<12?"Good morning":hr<17?"Good afternoon":"Good evening";return(<Shell nopad>
    {/* Dark hero header */}
    <div style={{background:`linear-gradient(165deg,${C.pd} 0%,${C.pri} 60%,${C.pl} 100%)`,padding:"24px 18px 28px",borderRadius:"0 0 28px 28px",marginBottom:14,position:"relative",overflow:"hidden"}}>
      {/* Subtle grid overlay */}
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.03) 1px,transparent 1px)",backgroundSize:"24px 24px",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:2}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><CarLogo size={30} color="rgba(255,255,255,.9)"/><div><div style={{fontSize:16,fontWeight:800,letterSpacing:"-.02em",color:"#fff"}}>AutoLens</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:500}}>{greet}</div></div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {!isPro?<button onClick={()=>setPay(true)} style={{padding:"7px 16px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#c8a24e,#d4b05e)",color:"#4a3510",fontSize:11,fontWeight:700,boxShadow:"0 2px 10px rgba(200,162,78,.25)"}}>Go Pro</button>:<ProBadge/>}
            <button onClick={()=>setSS(true)} style={{width:34,height:34,borderRadius:17,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>{Ic.gear(16,"rgba(255,255,255,.5)")}</button>
          </div>
        </div>
        {/* Quick actions — glass cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[["Scan Car",Ic.camera(22,"#fff"),"rgba(255,255,255,.08)",()=>{reset();goTab("scan")}],["Diagnose",Ic.wrench(22,"#d4b05e"),"rgba(200,162,78,.1)",()=>goTab("diagnose")],["Find Car",Ic.explore(22,"rgba(255,255,255,.7)"),"rgba(255,255,255,.06)",()=>setQS(0)]].map(([l,ic,bg,fn],i)=>(
            <button key={i} onClick={fn} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,padding:16,borderRadius:16,background:bg,border:"1px solid rgba(255,255,255,.06)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}} className={`ani-d${i+1}`}>
              {ic}<span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.7)"}}>{l}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
    <div style={{padding:"0 18px"}}>
    {/* Continue where you left off — re-engagement */}
    {hist.length>0&&(()=>{const last=hist[0];const score=last.data?.ratings?.overall_score;const clr=score>=8?C.g:score>=6?C.gold:C.r;return(
      <Card style={{marginBottom:14,padding:14,cursor:"pointer"}} className="ani" onClick={()=>openResult(last.data,last.thumb)}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:56,height:42,borderRadius:8,overflow:"hidden",background:C.border,flexShrink:0}}>{last.thumb&&<img src={last.thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,fontWeight:700,color:C.t4,marginBottom:2}}>LAST SCANNED</div>
            <div style={{fontSize:14,fontWeight:700}}>{last.make} {last.model}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:18,fontWeight:800,color:clr}}>{score||"?"}</span>
            {Ic.right(14,C.t5)}
          </div>
        </div>
      </Card>)})()}
    {/* Scan Streak */}
    {streak.count>0&&<Card style={{marginBottom:14,padding:14,background:`linear-gradient(135deg,${C.pd},${C.pri})`,border:"none",position:"relative",overflow:"hidden"}} className="ani">
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px)",backgroundSize:"20px 20px",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:2,display:"flex",alignItems:"center",gap:14}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:56}}>
          <div style={{fontSize:32,fontWeight:800,color:"#c8a24e",lineHeight:1}}>{streak.count}</div>
          <div style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.35)"}}>day{streak.count!==1?"s":""}</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:2}}>Scan Streak {streak.count>=3?"(on fire)":""}</div>
          <p style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Scan a car today to keep your streak going{streak.best>streak.count?` · Best: ${streak.best} days`:""}</p>
          {/* Streak dots */}
          <div style={{display:"flex",gap:4,marginTop:8}}>{[...Array(7)].map((_,i)=><div key={i} style={{width:i<streak.count?10:8,height:i<streak.count?10:8,borderRadius:5,background:i<streak.count?"#c8a24e":"rgba(255,255,255,.1)",transition:"all .3s",animation:i===streak.count-1?"dotPulse 1.5s ease infinite":"none"}}/>)}</div>
        </div>
        {streak.last===new Date().toDateString()&&<div style={{width:32,height:32,borderRadius:16,background:"rgba(200,162,78,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>{Ic.check(16,"#c8a24e")}</div>}
      </div>
    </Card>}
    {/* Daily Challenge — if no scan today */}
    {streak.last!==new Date().toDateString()&&scansUsed>0&&<Card style={{marginBottom:14,padding:14,display:"flex",gap:12,alignItems:"center",cursor:"pointer"}} className="ani" onClick={()=>{reset();goTab("scan")}}>
      <div style={{width:42,height:42,borderRadius:14,background:C.gBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,animation:"breathe 3s ease infinite"}}>{Ic.camera(20,C.gold)}</div>
      <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700}}>Daily Scan Challenge</div><div style={{fontSize:12,color:C.t3}}>Scan any car to continue your {streak.count>0?`${streak.count}-day `:""} streak</div></div>
      {Ic.right(16,C.t5)}
    </Card>}
    {/* Price Watch — shows when user has favorites */}
    {favs.length>0&&<Card style={{marginBottom:14,padding:14,background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",border:`1px solid ${C.gBo2}`}} className="ani">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        {Ic.dollar(16,C.g)}
        <div style={{fontSize:13,fontWeight:700,color:"#15803d"}}>Price Watch Active</div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {favs.slice(0,3).map((f,i)=><Chip key={i} color={C.g} bg={C.white}>{f.make} {f.model}</Chip>)}
        {favs.length>3&&<Chip color={C.t3} bg={C.bg}>+{favs.length-3} more</Chip>}
      </div>
      <p style={{fontSize:11,color:C.t3,marginTop:8}}>Monitoring market prices for your saved cars. We'll notify you when deals appear.</p>
    </Card>}
    {/* Car of the Day */}
    {(()=>{const cars=[{name:"Tesla Model 3",tag:"Best EV Value",score:8.7,color:"#c8a24e",grad:"linear-gradient(135deg,#faf6ec,#fef3e2)"},{name:"Toyota RAV4",tag:"Most Reliable SUV",score:8.9,color:C.g,grad:`linear-gradient(135deg,${C.gBg2},#d1fae5)`},{name:"Mazda MX-5 Miata",tag:"Best Sports Car",score:8.4,color:"#ec4899",grad:"linear-gradient(135deg,#fdf2f8,#fce7f3)"},{name:"Honda Civic",tag:"Best Sedan",score:8.8,color:C.cy,grad:"linear-gradient(135deg,#ecfeff,#cffafe)"},{name:"Ford Maverick",tag:"Best Truck Value",score:8.2,color:C.gold,grad:"linear-gradient(135deg,#faf6ec,#fefce8)"},{name:"Kia EV6",tag:"Best EV Design",score:8.5,color:"#8b5cf6",grad:"linear-gradient(135deg,#f5f3ff,#ede9fe)"},{name:"Subaru Outback",tag:"Best All-Weather",score:8.3,color:C.g,grad:`linear-gradient(135deg,${C.gBg2},#d1fae5)`}];const d=cars[Math.floor(Date.now()/86400000)%cars.length];return(
      <div style={{marginBottom:14,borderRadius:18,padding:2,background:`linear-gradient(135deg,${d.color}40,${d.color}10)`,animation:"glowPulse 4s ease infinite"}} className="ani">
        <div style={{borderRadius:16,padding:16,background:d.grad}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:d.color,marginBottom:4,display:"flex",alignItems:"center",gap:4,letterSpacing:".06em"}}>{Ic.star(10,d.color)} CAR OF THE DAY</div>
              <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>{d.name}</div>
              <Chip color={d.color} bg="rgba(255,255,255,.7)">{d.tag}</Chip>
            </div>
            <div style={{width:56,height:56,borderRadius:28,background:"rgba(255,255,255,.8)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 16px ${d.color}20`}}>
              <span style={{fontSize:20,fontWeight:800,color:d.color,lineHeight:1}}>{d.score}</span>
              <span style={{fontSize:8,color:C.t4,fontWeight:600}}>/10</span>
            </div>
          </div>
        </div>
      </div>);})()}
    {!isPro&&<Card style={{marginBottom:14,padding:14}} className="ani">
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:40,height:40,borderRadius:20,background:C.pBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.camera(18,C.pri)}</div>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{Math.max(0,FREE_SCANS-scansUsed)} free scan{FREE_SCANS-scansUsed!==1?"s":""} this week</div><div style={{height:4,borderRadius:2,background:C.border,marginTop:6}}><div style={{height:"100%",borderRadius:2,background:C.pri,width:`${Math.min(1,scansUsed/FREE_SCANS)*100}%`,transition:"width .5s"}}/></div><div style={{fontSize:11,color:C.t4,marginTop:4}}>Resets every week</div></div>
      </div>
    </Card>}
    {/* Recent scans */}
    {hist.length>0&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:14,fontWeight:700}}>Recent Scans</span><button onClick={()=>goTab("garage")} style={{background:"none",border:"none",color:C.pri,fontSize:12,fontWeight:600}}>See all</button></div>
      <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
        {hist.slice(0,8).map((h,i)=><div key={h.id} onClick={()=>openResult(h.data,h.thumb)} style={{flexShrink:0,width:140,cursor:"pointer"}} className="ani">
          <div style={{width:140,height:100,borderRadius:14,overflow:"hidden",background:C.border,marginBottom:6}}>{h.thumb&&<img src={h.thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}</div>
          <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.make} {h.model}</div>
          <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:11,color:C.t4}}>{h.year}</span><span style={{fontSize:12,fontWeight:700,color:C.g,marginLeft:"auto"}}>{h.data?.ratings?.overall_score}/10</span></div>
        </div>)}
      </div>
    </>}
    {/* Tips cards */}
    <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Car Tips</div>
    {[{title:"When to Buy a Car",desc:"Late December and year-end clearance events offer the best deals on new cars.",icon:Ic.dollar(18,C.gold),bg:C.gBg},{title:"5 Red Flags at a Dealership",desc:"Pressure tactics, hidden fees, and refusing test drives are warning signs.",icon:Ic.alert(18,C.r),bg:C.rBg},{title:"Maintenance Saves Money",desc:"Regular oil changes and tire rotations can prevent costly repairs down the road.",icon:Ic.wrench(18,C.pri),bg:C.pBg}].map((tip,i)=>(
      <Card key={i} style={{marginBottom:8,padding:14,display:"flex",gap:12,alignItems:"center",cursor:"pointer"}} className="ani" onClick={()=>loadGuide(tip.title)}>
        <div style={{width:40,height:40,borderRadius:12,background:tip.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{tip.icon}</div>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{tip.title}</div><div style={{fontSize:12,color:C.t3,lineHeight:1.4,marginTop:2}}>{tip.desc}</div></div>
        {Ic.right(16,C.t5)}
      </Card>
    ))}
    {/* Rate us prompt — after 3+ scans */}
    {scansUsed>=3&&<Card style={{marginBottom:8,padding:14,display:"flex",gap:12,alignItems:"center",background:C.gBg,border:`1px solid ${C.gBo}`}} className="ani">
      <div style={{width:40,height:40,borderRadius:12,background:C.white,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.star(20,"#d4b05e")}</div>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.t1}}>Enjoying AutoLens?</div><div style={{fontSize:12,color:C.t3,lineHeight:1.4,marginTop:2}}>A 5-star review helps us build more features for you.</div></div>
      <button onClick={()=>showTst("Thanks for your support! ⭐")} style={{padding:"6px 14px",borderRadius:12,border:"none",background:C.gold,color:"#4a3510",fontSize:11,fontWeight:700,flexShrink:0}}>Rate</button>
    </Card>}
    {/* Weekly Market Updates — re-engagement */}
    {!marketAlerts&&scansUsed>=1&&<Card style={{marginBottom:8,padding:14,display:"flex",gap:12,alignItems:"center",background:"linear-gradient(135deg,#eef4fb,#f8fafc)",border:`1px solid ${C.pBo}`}} className="ani">
      <div style={{width:40,height:40,borderRadius:12,background:C.white,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.bolt(18,C.pri)}</div>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>Weekly Market Update</div><div style={{fontSize:12,color:C.t3,lineHeight:1.4,marginTop:2}}>Get price trends and deals for cars you've scanned.</div></div>
      <button onClick={async()=>{setMA(true);try{await storage.setItem("al10-ma","1")}catch{}await push.register();showTst("You're subscribed!");analytics.trackFeatureUsed("market_alerts")}} style={{padding:"6px 14px",borderRadius:12,border:"none",background:C.pri,color:"#fff",fontSize:11,fontWeight:700,flexShrink:0}}>Enable</button>
    </Card>}
    {/* Share / Invite */}
    <Card style={{marginBottom:8,padding:14,display:"flex",gap:12,alignItems:"center"}} className="ani">
      <div style={{width:40,height:40,borderRadius:12,background:C.pBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.share(18,C.pri)}</div>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>Share AutoLens</div><div style={{fontSize:12,color:C.t3,lineHeight:1.4,marginTop:2}}>Help a friend find their next car.</div></div>
      <button onClick={()=>{navigator.clipboard?.writeText("Check out AutoLens — the AI car scanner app! https://autolens.app");showTst("Link copied!")}} style={{padding:"6px 14px",borderRadius:12,border:`1px solid ${C.border}`,background:C.white,color:C.t2,fontSize:11,fontWeight:600,flexShrink:0}}>Invite</button>
    </Card>
    </div>{/* close padding div */}
  </Shell>);}
  /* ═══ DIAGNOSE TAB ═══ */
  if(tab==="diagnose"){
    const issues=[
      {label:"Check Engine Light",desc:"Causes & severity levels",icon:Ic.wrench,color:"#b45309",bg:"#fef3e2"},
      {label:"Strange Noises",desc:"Clicking, grinding, squealing",icon:Ic.alert,color:"#6d28d9",bg:"#f3f0ff"},
      {label:"Vibration / Shaking",desc:"While driving, braking, or idle",icon:Ic.gauge,color:"#be185d",bg:"#fdf2f8"},
      {label:"Fluid Leaks",desc:"Identify by color & location",icon:Ic.alert,color:C.pri,bg:C.pBg},
      {label:"Battery / Electrical",desc:"Won't start, dim lights",icon:Ic.bolt,color:C.gold,bg:C.gBg},
      {label:"Brake Problems",desc:"Soft pedal, pulling, noise",icon:Ic.shield,color:C.r,bg:C.rBg},
      {label:"Overheating",desc:"Temp gauge high, steam, smell",icon:Ic.gauge,color:"#dc2626",bg:"#fef2f2"},
      {label:"Transmission Issues",desc:"Slipping, hard shifting, delay",icon:Ic.gear,color:"#0369a1",bg:"#f0f9ff"},
      {label:"AC / Heating",desc:"No cold air, bad smell, noise",icon:Ic.bolt,color:"#0891b2",bg:"#ecfeff"},
      {label:"Steering Problems",desc:"Pulling, stiff, wandering",icon:Ic.gauge,color:"#4338ca",bg:"#eef2ff"},
    ];
    return(<Shell>
      <div style={{padding:"20px 0 16px"}}><h1 style={{fontSize:22,fontWeight:800}}>Diagnose</h1><p style={{color:C.t3,fontSize:13,marginTop:4}}>AI-powered car diagnostics</p></div>
      {/* Car Selector */}
      {hist.length>0&&<Card style={{marginBottom:12,padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.t4,marginBottom:8}}>DIAGNOSING FOR</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setDC(null)} style={{padding:"6px 14px",borderRadius:20,border:!diagCar?`2px solid ${C.pri}`:`1px solid ${C.border}`,background:!diagCar?C.pBg:C.white,fontSize:12,fontWeight:!diagCar?700:500,color:!diagCar?C.pri:C.t3}}>Any car</button>
          {hist.slice(0,5).map((h,i)=><button key={i} onClick={()=>setDC(h)} style={{padding:"6px 14px",borderRadius:20,border:diagCar?.id===h.id?`2px solid ${C.pri}`:`1px solid ${C.border}`,background:diagCar?.id===h.id?C.pBg:C.white,fontSize:12,fontWeight:diagCar?.id===h.id?700:500,color:diagCar?.id===h.id?C.pri:C.t3}}>{h.make} {h.model}</button>)}
        </div>
      </Card>}
      {/* Custom Symptom Input */}
      <Card style={{marginBottom:14,padding:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:14}}>
          <div style={{flex:1}}>
            <input value={diagCustom} onChange={e=>setDCu(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&diagCustom.trim())askDiag(diagCustom.trim())}} placeholder="Describe any symptom..." style={{width:"100%",border:"none",outline:"none",fontSize:14,color:C.t1,background:"none"}}/>
          </div>
          <button onClick={()=>{if(diagCustom.trim())askDiag(diagCustom.trim())}} style={{width:40,height:40,borderRadius:20,border:"none",background:diagCustom.trim()?C.pri:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.right(16,diagCustom.trim()?"#fff":C.t5)}</button>
        </div>
      </Card>
      {/* Photo Diagnose CTA */}
      <Card style={{marginBottom:14,padding:14,background:C.pBg,border:`1px solid ${C.pBo}`,cursor:"pointer"}} className="ani" onClick={()=>{reset();goTab("scan")}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:14,background:C.white,display:"flex",alignItems:"center",justifyContent:"center"}}>{Ic.camera(20,C.pri)}</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.pd}}>Photo Diagnose</div><div style={{fontSize:12,color:C.t3}}>Snap a photo for AI-powered diagnosis</div></div>
          {Ic.right(16,C.pri)}
        </div>
      </Card>
      <div style={{fontSize:12,fontWeight:700,color:C.t4,marginBottom:8}}>COMMON ISSUES</div>
      {issues.map((item,i)=>(
        <Card key={i} style={{marginBottom:8,padding:14,display:"flex",gap:12,alignItems:"center",cursor:"pointer"}} className="ani" onClick={()=>askDiag(item.label)}>
          <div style={{width:42,height:42,borderRadius:12,background:item.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{item.icon(18,item.color)}</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{item.label}</div><div style={{fontSize:12,color:C.t3,marginTop:1}}>{item.desc}</div></div>
          {Ic.right(16,C.t5)}
        </Card>
      ))}
    </Shell>);
  }
  /* ═══ SCAN TAB ═══ */
  if(tab==="scan"){return(<Shell nopad>
    <div style={{background:`linear-gradient(165deg,${C.pd},${C.pri})`,padding:"24px 18px 20px",borderRadius:"0 0 24px 24px",marginBottom:14,textAlign:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.03) 1px,transparent 1px)",backgroundSize:"24px 24px",pointerEvents:"none"}}/>
      <h1 style={{fontSize:22,fontWeight:800,color:"#fff",position:"relative",zIndex:2}}>Identify a Car</h1>
      <p style={{color:"rgba(255,255,255,.45)",fontSize:13,marginTop:4,position:"relative",zIndex:2}}>{scanMode==="photo"?"Take or upload a photo":"Enter a 17-character VIN"}</p>
    </div>
    <div style={{padding:"0 18px"}}>
    {/* Photo / VIN toggle */}
    <div style={{display:"flex",gap:4,background:C.white,borderRadius:10,padding:3,border:`1px solid ${C.border}`,marginBottom:14}}>
      {[["photo","Photo",Ic.camera],["vin","VIN",Ic.lock]].map(([id,l,ic])=><button key={id} onClick={()=>{setSM(id);se(null)}} style={{flex:1,height:36,borderRadius:8,border:"none",background:scanMode===id?C.pri:"transparent",color:scanMode===id?"#fff":C.t3,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{ic(16,scanMode===id?"#fff":C.t4)} {l}{id==="vin"&&!isPro&&<ProBadge/>}</button>)}
    </div>
    {scanMode==="vin"?<>
      <Card style={{marginBottom:14}} className="ani">
        <div style={{fontSize:12,fontWeight:700,color:C.t3,marginBottom:8}}>VEHICLE IDENTIFICATION NUMBER</div>
        <input value={vinIn} onChange={e=>setVI(e.target.value.toUpperCase().slice(0,17))} placeholder="e.g. 1HGBH41JXMN109186" maxLength={17} style={{width:"100%",height:48,borderRadius:12,border:`1px solid ${C.border}`,background:C.bg,color:C.t1,fontSize:16,fontWeight:600,padding:"0 14px",outline:"none",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"1.5px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}><span style={{fontSize:11,color:C.t4}}>Usually on dashboard or door frame</span><span style={{fontSize:11,fontWeight:600,color:vinIn.length===17?C.g:C.t4}}>{vinIn.length}/17</span></div>
      </Card>
      <button onClick={scanVin} disabled={loading||vinIn.length!==17} style={{width:"100%",height:48,borderRadius:24,border:"none",background:vinIn.length===17?C.pri:C.border,color:vinIn.length===17?"#fff":C.t4,fontSize:14,fontWeight:700,marginBottom:14,opacity:loading?.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{loading?<><div style={{width:16,height:16,borderRadius:8,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin 1s linear infinite"}}/> Decoding...</>:<><CarLogo size={18} color={vinIn.length===17?"#fff":C.t4}/> Decode VIN</>}</button>
    </>:
    loading?<Card style={{padding:0,overflow:"hidden",marginBottom:14,border:"none",boxShadow:"0 8px 32px rgba(15,43,76,.12)"}} className="ani">
      <div style={{position:"relative",minHeight:240}}>
        {imgs[0]&&<img src={imgs[0]} alt="" style={{width:"100%",height:240,objectFit:"cover",display:"block"}}/>}
        {/* Scanning lens line */}
        <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
          <div style={{position:"absolute",left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,rgba(200,162,78,.8),transparent)",boxShadow:"0 0 20px rgba(200,162,78,.4),0 0 60px rgba(200,162,78,.2)",animation:"lensScan 2s ease-in-out infinite"}}/>
        </div>
        <div style={{position:"absolute",inset:0,background:"rgba(10,31,56,.75)",backdropFilter:"blur(2px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
          <div style={{position:"relative",width:64,height:64}}>
            <svg width={64} height={64} style={{animation:"spin 2s linear infinite"}}><circle cx={32} cy={32} r={28} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2.5"/><circle cx={32} cy={32} r={28} fill="none" stroke="#c8a24e" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="44 132"/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><CarLogo size={28} color="rgba(255,255,255,.9)"/></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:60,height:3,borderRadius:2,background:"rgba(255,255,255,.1)",overflow:"hidden"}}><div style={{height:"100%",width:`${prog}%`,borderRadius:2,background:"linear-gradient(90deg,#c8a24e,#e8d48a)",transition:"width .25s"}}/></div>
            <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)"}}>{Math.round(prog)}%</span>
          </div>
          <p style={{color:"rgba(255,255,255,.7)",fontSize:13,fontWeight:600}}>Analyzing vehicle...</p>
          <p style={{color:"rgba(255,255,255,.35)",fontSize:11,textAlign:"center",padding:"0 24px",maxWidth:280}}>{Ic.bolt(10,"rgba(200,162,78,.6)")} {CAR_FACTS[Math.floor(prog/13)%CAR_FACTS.length]}</p>
        </div>
      </div>
    </Card>:<>
      {imgs.length>0?<div style={{marginBottom:14}} className="ani">
        <div style={{display:"grid",gridTemplateColumns:imgs.length===1?"1fr":"1fr 1fr",gap:8}}>{imgs.map((im,i)=><div key={i} style={{position:"relative",borderRadius:16,overflow:"hidden",aspectRatio:imgs.length===1?"16/10":"1"}}><img src={im} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><button onClick={()=>{setImgs(p=>p.filter((_,j)=>j!==i));setImgDs(p=>p.filter((_,j)=>j!==i))}} style={{position:"absolute",top:8,right:8,width:28,height:28,borderRadius:14,background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>)}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{setImgs([]);setImgDs([])}} style={{flex:1,height:48,borderRadius:24,border:`1px solid ${C.border}`,background:C.white,color:C.t3,fontSize:14,fontWeight:500}}>Clear</button>
          <button onClick={scan} style={{flex:2,height:48,borderRadius:24,border:"none",background:`linear-gradient(145deg,${C.pd},${C.pl})`,color:"#fff",fontSize:14,fontWeight:700,boxShadow:`0 4px 20px rgba(15,43,76,.3)`,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><CarLogo size={18} color="#fff"/> Identify</button>
        </div>
      </div>:
      <div onClick={()=>fRef.current?.click()} onDragOver={e=>{e.preventDefault();setDr(true)}} onDragLeave={()=>setDr(false)} onDrop={handleDrop} style={{borderRadius:20,border:`2px dashed ${dragging?C.gold:C.border}`,background:dragging?"rgba(200,162,78,.04)":C.white,padding:"52px 24px",textAlign:"center",cursor:"pointer",marginBottom:14,transition:"all .3s",boxShadow:dragging?"0 0 30px rgba(200,162,78,.1)":"none"}} className="ani">
        <div style={{width:80,height:80,borderRadius:28,background:`linear-gradient(145deg,${C.pBg},#dce8f7)`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",position:"relative"}}>
          {Ic.camera(32,C.pri)}
          <div style={{position:"absolute",inset:-3,borderRadius:31,border:`2px solid ${C.pBo}`,opacity:.4,animation:"breathe 3s ease infinite"}}/>
        </div>
        <p style={{fontSize:16,fontWeight:700,color:C.t1}}>Tap to upload a photo</p>
        <p style={{fontSize:13,color:C.t4,marginTop:6}}>Or drag & drop an image here</p>
        <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:16}}>{["JPG","PNG","HEIC"].map(f=><span key={f} style={{fontSize:10,fontWeight:600,color:C.t5,background:C.bg,padding:"3px 8px",borderRadius:6}}>{f}</span>)}</div>
      </div>}
      <input ref={fRef} type="file" accept="image/*" multiple={isPro} capture="environment" onChange={e=>onFiles(e.target.files)} style={{display:"none"}}/>
    </>}
    {err&&<Card style={{border:`1px solid rgba(220,38,38,.2)`,marginBottom:14}}>
      <p style={{color:C.r,fontSize:13,marginBottom:hist.length>0?8:0}}>{err}</p>
      {hist.length>0&&<button onClick={()=>goTab("garage")} style={{width:"100%",padding:"8px 0",borderRadius:10,border:`1px solid ${C.border}`,background:C.bg,fontSize:12,fontWeight:600,color:C.t2}}>View {hist.length} Recent Scan{hist.length!==1?"s":""}</button>}
    </Card>}
    {/* Recently scanned — works offline */}
    {hist.length>0&&<>
      <div style={{fontSize:13,fontWeight:700,marginBottom:8,marginTop:8}}>Recently Scanned</div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:12}}>
        {hist.slice(0,5).map((h,i)=><div key={i} onClick={()=>openResult(h.data,h.thumb)} style={{flexShrink:0,width:120,cursor:"pointer"}} className="ani">
          <div style={{width:120,height:80,borderRadius:10,overflow:"hidden",background:C.border,marginBottom:4}}>{h.thumb&&<img src={h.thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}</div>
          <div style={{fontSize:12,fontWeight:700}}>{h.make} {h.model}</div>
          <div style={{fontSize:10,color:C.t4}}>{h.year}</div>
        </div>)}
      </div>
    </>}
    {/* Quick tips */}
    <div style={{fontSize:13,fontWeight:700,marginBottom:10,marginTop:8}}>Tips for best results</div>
    {[["Take from 10-15 feet away","Shows full car profile"],["Good lighting helps","Avoid dark or backlit shots"],["Multiple angles = better","Side + front is ideal"]].map(([t,d],i)=>(
      <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0"}} className="ani">
        <div style={{width:28,height:28,borderRadius:14,background:C.gBg2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.check(14,C.g)}</div>
        <div><div style={{fontSize:13,fontWeight:600}}>{t}</div><div style={{fontSize:11,color:C.t4}}>{d}</div></div>
      </div>
    ))}
    </div>{/* close padding div */}
  </Shell>);}
  /* ═══ MY GARAGE TAB ═══ */
  if(tab==="garage"){return(<Shell>
    <div style={{padding:"20px 0 16px"}}><h1 style={{fontSize:22,fontWeight:800}}>My Garage</h1><p style={{color:C.t3,fontSize:13,marginTop:4}}>{hist.length} scans · {favs.length} saved</p></div>
    
    {favs.length>0&&<><div style={{fontSize:14,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>{Ic.heartFill(16,C.r)} Favorites</div>
    <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:12,marginBottom:14}}>
      {favs.map((f,i)=><div key={i} onClick={()=>openResult(f.data,f.thumb)} style={{flexShrink:0,width:150,cursor:"pointer"}} className="ani">
        <div style={{width:150,height:110,borderRadius:14,overflow:"hidden",background:C.border,marginBottom:6}}>{f.thumb&&<img src={f.thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}</div>
        <div style={{fontSize:13,fontWeight:700}}>{f.make} {f.model}</div>
        <div style={{fontSize:11,color:C.t4}}>{f.year} · {f.score}/10</div>
      </div>)}
    </div></>}
    <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>All Scans</div>
    {hist.length>=3&&<div style={{marginBottom:10}}><input value={garQ} onChange={e=>setGQ(e.target.value)} placeholder="Search your scans..." style={{width:"100%",height:40,borderRadius:12,border:`1px solid ${C.border}`,background:C.white,color:C.t1,fontSize:13,padding:"0 14px",outline:"none",fontFamily:"inherit"}}/></div>}
    {hist.length>=2&&<Card style={{marginBottom:12,padding:14,background:"linear-gradient(135deg,#eef4fb,#dce8f7)",border:`1px solid ${C.pBo}`,cursor:"pointer"}} onClick={()=>{if(!isPro){setPay(true);return}setCmpA(hist[0]);setCmpB(hist[1]);setSCmp(true)}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:40,height:40,borderRadius:12,background:C.white,display:"flex",alignItems:"center",justifyContent:"center"}}>{Ic.gauge(20,C.pri)}</div>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.pd}}>Compare Cars</div><div style={{fontSize:12,color:C.t3}}>See your last 2 scans side by side</div></div>
        {isPro?Ic.right(16,C.pri):<ProBadge/>}
      </div>
    </Card>}
    {hist.length===0?<Card style={{textAlign:"center",padding:40}}><div style={{width:48,height:48,borderRadius:24,background:C.pBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>{Ic.camera(22,C.pri)}</div><p style={{color:C.t3,fontSize:14}}>No scans yet</p><p style={{color:C.t4,fontSize:12,marginTop:4}}>Tap the camera to get started</p></Card>:
    (()=>{const filt=garQ?hist.filter(h=>`${h.make} ${h.model} ${h.year}`.toLowerCase().includes(garQ.toLowerCase())):hist;return filt.length===0?<p style={{textAlign:"center",color:C.t4,fontSize:13,padding:20}}>No results for "{garQ}"</p>:filt.map((h,i)=>(
      <Card key={h.id} style={{marginBottom:8,padding:12,cursor:"pointer"}} className="ani" onClick={()=>openResult(h.data,h.thumb)}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {h.thumb?<img src={h.thumb} alt="" style={{width:56,height:42,objectFit:"cover",borderRadius:10}}/>:<div style={{width:56,height:42,borderRadius:10,background:C.bg}}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.make} {h.model}</div>
            <div style={{fontSize:12,color:C.t4}}>{h.year} · {h.date}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:16,fontWeight:800,color:C.g}}>{h.data?.ratings?.overall_score}</span>
            <span style={{fontSize:11,color:C.t4}}>/10</span>
          </div>
        </div>
      </Card>
    ))})()}
  </Shell>);}
  /* ═══ EXPLORE TAB ═══ */
  if(tab==="explore"){return(<Shell>
    <div style={{padding:"20px 0 16px"}}><h1 style={{fontSize:22,fontWeight:800}}>Explore</h1><p style={{color:C.t3,fontSize:13,marginTop:4}}>Learn about cars, find your match</p></div>
    <Card style={{marginBottom:14,padding:14,background:"linear-gradient(135deg,#eef4fb,#dce8f7)",border:`1px solid ${C.pBo}`,cursor:"pointer"}} className="ani" onClick={()=>setQS(0)}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:48,height:48,borderRadius:16,background:C.white,display:"flex",alignItems:"center",justifyContent:"center"}}>{Ic.explore(24,"#6d28d9")}</div>
        <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>Find My Car Quiz</div><div style={{fontSize:12,color:C.t3}}>Answer 5 questions, get AI-matched recommendations</div></div>
        {Ic.right(16,C.pri)}
      </div>
    </Card>
    <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Popular Categories</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
      {[["Best SUVs 2025",Ic.gauge,C.pBg,C.pri],["Most Reliable Cars",Ic.shield,C.gBg2,C.g],["Best Under $30k",Ic.dollar,C.gBg,C.gold],["Electric Vehicles",Ic.bolt,"#f3f0ff","#7c3aed"],["Best Family Cars",Ic.heart,"#fdf2f8","#db2777"],["Sports Cars",Ic.gauge,"#fef3e2","#ea580c"]].map(([l,icon,bg,clr],i)=>(
        <Card key={i} style={{padding:14,cursor:"pointer",background:bg,border:"none"}} className="ani" onClick={()=>exploreCategory(l)}>
          <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,.6)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:6}}>{icon(18,clr)}</div>
          <div style={{fontSize:13,fontWeight:600,color:C.t1}}>{l}</div>
        </Card>
      ))}
    </div>
    <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Guides</div>
    {[{t:"First-Time Buyer's Guide",d:"Everything you need to know before your first purchase",c:C.pri},{t:"How to Negotiate Like a Pro",d:"Save thousands with these dealer tactics",c:C.gold},{t:"Understanding Car Insurance",d:"Comprehensive vs collision, what you actually need",c:C.g}].map((g,i)=>(
      <Card key={i} style={{marginBottom:8,padding:14,display:"flex",gap:12,alignItems:"center",cursor:"pointer"}} className="ani" onClick={()=>loadGuide(g.t)}>
        <div style={{width:4,height:36,borderRadius:2,background:g.c,flexShrink:0}}/>
        <div><div style={{fontSize:14,fontWeight:600}}>{g.t}</div><div style={{fontSize:12,color:C.t3,marginTop:2}}>{g.d}</div></div>
        {Ic.right(16,C.t5)}
      </Card>
    ))}
  </Shell>);}
  return <Shell><p>Loading...</p></Shell>;
}