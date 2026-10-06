(()=>{try{
 if(window.__KRONAS_V524_INTERCEPTOR__){alert("V5.24 вже увімкнений. Імпортуй V5.23 .project.");return}
 window.__KRONAS_V524_INTERCEPTOR__=true;
 const norm=x=>String(x??"").replace(/\s+/g," ").trim().toLowerCase();
 const pick=()=>new Promise(res=>{const i=document.createElement("input");i.type="file";i.accept=".json,application/json";i.onchange=()=>res(i.files&&i.files[0]);i.click()});
 (async()=>{
  const bf=await pick();if(!bf){window.__KRONAS_V524_INTERCEPTOR__=false;return}
  const B=JSON.parse(await bf.text());
  if(B?.format!=="VIYAR_KRONAS_V5_24_BEVELS"||!Array.isArray(B.bevels))throw Error("Вибери KRONAS_V5_24_BEVELS.json");
  const inject=J=>{
   const D=Array.isArray(J?.data?.details)?J.data.details:(Array.isArray(J?.details)?J.details:null);
   if(!D)return null;
   const groups=new Map();
   for(const b of B.bevels){const k=[norm(b.detail_name),Number(b.l),Number(b.w)].join("|");if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b)}
   let added=0,matched=0;
   for(const bs of groups.values()){
    const b0=bs[0];
    const d=D.find(d=>norm(d.name)===norm(b0.detail_name)&&(((Number(d.l)===Number(b0.l))&&(Number(d.h)===Number(b0.w)))||((Number(d.l)===Number(b0.w))&&(Number(d.h)===Number(b0.l)))));
    if(!d)continue;
    matched++;if(!Array.isArray(d.bevels))d.bevels=[];
    for(const b of bs){
     if(d.bevels.some(x=>x&&x.side===b.side&&Number(x.start)===Number(b.start)&&Number(x.alpha)===Number(b.alpha)))continue;
     d.bevels.push({id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),subType:"bevel",validationErrors:[],isHidden:false,alpha:Number(b.alpha),dataForConstructor:{},excludeFromCalculation:false,isGrinding:false,isTemplate:null,side:b.side,start:Number(b.start)});
     added++;
    }
   }
   if(!matched)return null;
   console.log("KRONAS V5.24: injected",added,"bevels into",matched,"details");
   if(!window.__KRONAS_V524_DONE__){window.__KRONAS_V524_DONE__=true;setTimeout(()=>alert("V5.24: KRONAS імпорт перехоплено. Додано зрізів: "+added+" із "+B.bevels.length),0)}
   return J;
  };
  const NativeXHR=window.XMLHttpRequest;
  const rt=Object.getOwnPropertyDescriptor(NativeXHR.prototype,"responseText");
  const rr=Object.getOwnPropertyDescriptor(NativeXHR.prototype,"response");
  const cache=new WeakMap();
  const patch=x=>{
   if(cache.has(x))return cache.get(x);
   let raw;try{raw=rt.get.call(x)}catch{return null}
   if(typeof raw!=="string"||raw.length<20)return null;
   try{const J=JSON.parse(raw),P=inject(J);if(!P)return null;const txt=JSON.stringify(P);cache.set(x,txt);return txt}catch{return null}
  };
  if(rt&&rt.configurable)Object.defineProperty(NativeXHR.prototype,"responseText",{configurable:true,enumerable:rt.enumerable,get:function(){return patch(this)??rt.get.call(this)}});
  if(rr&&rr.configurable)Object.defineProperty(NativeXHR.prototype,"response",{configurable:true,enumerable:rr.enumerable,get:function(){
   try{
    if(this.responseType==="json"){const raw=rr.get.call(this);if(raw&&typeof raw==="object"){const copy=JSON.parse(JSON.stringify(raw));return inject(copy)??raw}}
    const p=patch(this);if(p!==null&&(!this.responseType||this.responseType==="text"))return p;
   }catch{}
   return rr.get.call(this)
  }});
  const of=window.fetch;
  window.fetch=async function(...args){
   const r=await of.apply(this,args);
   try{
    const j=await r.clone().json(),p=inject(j);
    if(p)return new Proxy(r,{get(t,k){if(k==="json")return async()=>p;if(k==="text")return async()=>JSON.stringify(p);const v=Reflect.get(t,k,t);return typeof v==="function"?v.bind(t):v}})
   }catch{}
   return r
  };
  alert("V5.24 увімкнено. Тепер імпортуй Viyar_to_KRONAS_V5_23.project у KRONAS.");
 })().catch(e=>{window.__KRONAS_V524_INTERCEPTOR__=false;console.error(e);alert("V5.24 ERROR: "+e.message)});
}catch(e){console.error(e);alert("V5.24 ERROR: "+e.message)}})();