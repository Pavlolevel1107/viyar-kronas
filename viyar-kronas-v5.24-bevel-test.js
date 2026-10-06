(async()=>{try{
const N=v=>{let n=parseFloat(String(v??"").replace(",","."));return Number.isFinite(n)?n:0};
const C=v=>String(v??"").replace(/\s+/g," ").trim();
const UUID=()=>crypto.randomUUID?crypto.randomUUID():("id-"+Date.now()+"-"+Math.random().toString(16).slice(2));
const rows=[...document.querySelectorAll('#detailsTable tr[id^="row-"]')];
if(!rows.length)throw Error('Відкрий вкладку "Деталі"');

const materials=[],matMap=new Map(),edgeDefs=[],edgeMap=new Map(),details=[];
const getEdgeIndex=e=>{
 if(!e||e.t<=0)return null;
 const name=e.name||("Крайка "+e.t+" мм");
 const k=name+"|"+e.t;
 if(edgeMap.has(k))return edgeMap.get(k);
 const idx=edgeDefs.length; edgeMap.set(k,idx);
 edgeDefs.push({article:"VIYAR_EDGE_"+(idx+1),name,thickness:String(e.t),width:"22.0",type:"ПВХ",laser:false});
 return idx;
};

let did=1;
for(const r of rows){
 const key=+r.id.replace("row-","");
 const td=r.querySelectorAll("td");
 const mm=(td[4]?.innerText||"").match(/([\d.,]+)\s*[×x]\s*([\d.,]+)\s*[×x]\s*([\d.,]+)/);
 if(!mm)continue;
 const L=N(mm[1]),W=N(mm[2]),T=N(mm[3]),count=N(td[5]?.innerText)||1;
 let meta={};try{meta=getDetailDataByKey(key)||{}}catch(e){}
 const article=String(meta.materialArticle||meta.materialId||"VIYAR");
 let mi=matMap.get(article);
 if(mi==null){mi=materials.length;matMap.set(article,mi);materials.push({article,height:2800,name:"Viyar material "+article,thickness:T,width:2070,client_id:null,type:"ЛДСП",parts:[],index:mi});}

 const ec=r.querySelector(".kromkaPad");
 const readEdge=s=>{const e=ec?.querySelector("#"+s);return{t:N(e?.textContent),name:(e?.title||"").trim()}};
 const e0={left:readEdge("left"),right:readEdge("right"),top:readEdge("top"),bottom:readEdge("bottom")};

 let holesRaw=[];
 try{
  const h=$("<div>").html(await $.post("/service/system/views/additives/inc/tableHoles.php",{detail_key:key}));
  holesRaw=h.find('tr[id^="holeKeyId-"]').map(function(){const q=$(this);return{
   side:C(q.find('[name="side"]').text()),corner:C(q.find('[name="corner"]').text()),
   x:N(q.find('[name="x"]').text()),y:N(q.find('[name="y"]').text()),
   depth:N(q.find('[name="depth"]').text()),diam:N(q.find('[name="diameter"]').text())
  }}).get();
 }catch(e){console.warn("HOLES",key,e)}

 const holes=[];
 for(const h of holesRaw){
  const s=h.side.toLowerCase(); let side="",x=0,y=0,z="",X=h.x,Y=h.y;
  if(s.includes("лиць")||s.includes("лиц")||s.includes("тиль")){
   if(h.corner==="П.В.")X=L-h.x;
   else if(h.corner==="Л.Н.")Y=W-h.y;
   else if(h.corner==="П.Н."){X=L-h.x;Y=W-h.y}
   side=(s.includes("тиль")?"back":"front"); x=X;y=Y;z="";
  }else if(s.includes("ліва")||s.includes("лева")||s.includes("права")){
   if(h.corner.endsWith("Н."))Y=W-h.y;
   side=(s.includes("прав")?"right":"left"); x=(side==="right"?L:0);y=Y;z=T/2;
  }else if(s.includes("верх")||s.includes("ниж")){
   if(h.corner.startsWith("П."))X=L-h.x;
   side=s.includes("верх")?"top":"bottom";x=X;y=0;z=T/2;
  }else continue;
  holes.push({side,x,y,z,depth:h.depth,diam:h.diam,x_axis:"left",y_axis:"bottom",comment:""});
 }

 let groovesRaw=[];
 try{
  const g=$("<div>").html(await $.post("/service/system/views/additives/inc/tableGrooves.php",{detail_key:key,machineId:typeof machine!=="undefined"?machine:""}));
  groovesRaw=g.find('tr[id^="grooveKeyId-"]').map(function(){const c=$(this).find("td");return{
   side:C(c.eq(1).text()),corner:C(c.eq(2).text()),dir:C(c.eq(3).text()),
   x:N(c.eq(4).text()),y:N(c.eq(5).text()),depth:N(c.eq(6).text()),w:N(c.eq(7).text()),len:N(c.eq(8).text())
  }}).get();
 }catch(e){console.warn("GROOVES",key,e)}
 const rects=[];
 for(const g of groovesRaw){
  const vertical=g.dir.toLowerCase().includes("вер");
  const side=/тиль/i.test(g.side)?"back":"front";
  const off=vertical?g.x:g.y;
  rects.push({side,x:vertical?off:0,y:vertical?0:off,z:0,width:vertical?g.w:g.len,height:vertical?g.len:g.w,depth:g.depth||7,r:0,edge:null,ext:false,type:"Groove"});
 }

 let det={};
 try{
  let raw=await $.post("/service/system/controllers/JsonController.php",{controller:"Additives",action:"getDetail",detail_key:key,set_current_detail:0,machineId:typeof machine!=="undefined"?machine:false});
  det=typeof raw==="string"?JSON.parse(raw):raw;
  if(det&&det.data&&typeof det.data==="object")det=det.data;
 }catch(e){console.warn("DETAIL API",key,e);det={}}

 const bevels=[];
 for(const side of ["left","top","right","bottom"]){
  const e=det?.data_edges?.[side];
  if(!e||e.type!=="srezkrom")continue;
  const alpha=N(e.srez),start=N(e.otstup); if(!alpha)continue;
  bevels.push({id:UUID(),subType:"bevel",validationErrors:[],isHidden:false,alpha,dataForConstructor:{},excludeFromCalculation:false,isGrinding:false,isTemplate:null,side,start});
 }

 const edges={left:getEdgeIndex(e0.left),right:getEdgeIndex(e0.right),top:getEdgeIndex(e0.top),bottom:getEdgeIndex(e0.bottom)};
 details.push({productId:1,id:did++,name:C(td[3]?.innerText)||("Деталь "+(key+1)),detailDescription:"",material:mi,material_id:article,isRotateTexture:false,h:W,l:L,preCutting:{left:null,right:null,top:null,bottom:null},multiplicity:null,count,holes,edges,rects,mills:[],contour:[],corners:[],bevels,arcs:[],smiles:[]});
}

const data={glue_type:"PUR",glue_color:"white",products:{"1":{id:1,name:"ViyarPro V5.24 FULL TEST",code:""}},materials,edges:edgeDefs,furnitures:[],details,emptyList:[],constructor:{created:{provider_name:"Kronas-Giblab",provider_version:"1.0"}}};
const txt=JSON.stringify(data,null,2),blob=new Blob([txt],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
a.href=url;a.download="Viyar_to_KRONAS_V5_24_FULL_TEST.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
const hc=details.reduce((n,d)=>n+d.holes.length,0),gc=details.reduce((n,d)=>n+d.rects.length,0),bc=details.reduce((n,d)=>n+d.bevels.length,0);
alert("V5.24 FULL TEST\n\nДеталей: "+details.length+"\nОтворів: "+hc+"\nПазів: "+gc+"\nКрайок: "+edgeDefs.length+"\nЗрізів: "+bc+"\n\nV5.23 НЕ ЗМІНЕНО.");
}catch(e){console.error(e);alert("V5.24 FULL TEST ПОМИЛКА:\n"+e.message)}})();