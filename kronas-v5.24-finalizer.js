(()=>{try{
 const pick=(accept,multi=false)=>new Promise(res=>{const i=document.createElement("input");i.type="file";i.accept=accept;i.multiple=multi;i.onchange=()=>res([...i.files]);i.click()});
 (async()=>{
  const bf=(await pick(".json,application/json"))[0];if(!bf)return;
  const B=JSON.parse(await bf.text());
  if(!Array.isArray(B.bevels))throw Error("Спочатку вибери KRONAS_V5_24_BEVELS.json");
  const jf=(await pick(".json,application/json"))[0];if(!jf)return;
  const J=JSON.parse(await jf.text()),D=Array.isArray(J.details)?J.details:(Array.isArray(J?.data?.details)?J.data.details:null);
  if(!D)throw Error("У другому JSON не знайдено details[]");
  const norm=x=>String(x??"").replace(/\s+/g," ").trim().toLowerCase();
  const groups=new Map();
  for(const b of B.bevels){const k=[norm(b.detail_name),Number(b.l),Number(b.w)].join("|");if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b)}
  let added=0,matched=0;
  for(const bs of groups.values()){
   const b0=bs[0];
   const d=D.find(d=>norm(d.name)===norm(b0.detail_name)&&(((Number(d.l)===Number(b0.l))&&(Number(d.h)===Number(b0.w)))||((Number(d.l)===Number(b0.w))&&(Number(d.h)===Number(b0.l)))));
   if(!d){console.warn("V5.24 detail not found",b0);continue}
   matched++;if(!Array.isArray(d.bevels))d.bevels=[];
   for(const b of bs){
    if(d.bevels.some(x=>x&&x.side===b.side&&Number(x.start)===Number(b.start)&&Number(x.alpha)===Number(b.alpha)))continue;
    d.bevels.push({id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),subType:"bevel",validationErrors:[],isHidden:false,alpha:Number(b.alpha),dataForConstructor:{},excludeFromCalculation:false,isGrinding:false,isTemplate:null,side:b.side,start:Number(b.start)});
    added++;
   }
  }
  const o=new Blob([JSON.stringify(J,null,2)],{type:"application/json;charset=utf-8"}),u=URL.createObjectURL(o),a=document.createElement("a");
  a.href=u;a.download="KRONAS_V5_24_FINAL.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
  alert("V5.24: додано зрізів "+added+" із "+B.bevels.length+". Інші поля JSON не змінено.");
 })().catch(e=>{console.error(e);alert("V5.24 ERROR: "+e.message)});
}catch(e){console.error(e);alert("V5.24 ERROR: "+e.message)}})();