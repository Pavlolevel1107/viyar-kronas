(async()=>{try{
const N=v=>{let n=parseFloat(String(v??"").replace(",","."));return Number.isFinite(n)?n:0};
const C=v=>String(v??"").replace(/\s+/g," ").trim();
const rows=[...document.querySelectorAll('#detailsTable tr[id^="row-"]')];
if(!rows.length)throw Error('Відкрий вкладку "Деталі"');

const materials=[],matMap=new Map(),details=[];
let did=1,pid=1;

for(const r of rows){
 const key=+r.id.replace("row-","");
 const td=r.querySelectorAll("td");
 const m=(td[4]?.innerText||"").match(/([\d.,]+)\s*[×x]\s*([\d.,]+)\s*[×x]\s*([\d.,]+)/);
 if(!m)continue;
 const L=N(m[1]),W=N(m[2]),T=N(m[3]),count=N(td[5]?.innerText)||1;
 let meta={};try{meta=getDetailDataByKey(key)||{}}catch(e){}
 const article=String(meta.materialArticle||meta.materialId||"VIYAR");
 let mi=matMap.get(article);
 if(mi==null){
   mi=materials.length;matMap.set(article,mi);
   materials.push({article,height:2800,name:"Viyar material "+article,thickness:T,width:2070,client_id:null,type:"ЛДСП",parts:[],index:mi});
 }

 const raw=await $.post("/service/system/controllers/JsonController.php",{
   controller:"Additives",action:"getDetail",detail_key:key,set_current_detail:0,
   machineId:typeof machine!=="undefined"?machine:false
 });
 let det=raw;
 if(typeof det==="string")det=JSON.parse(det);
 if(det&&det.data&&typeof det.data==="object")det=det.data;

 const bevels=[];
 const de=det?.data_edges||{};
 for(const side of ["left","top","right","bottom"]){
   const e=de?.[side];
   if(!e||e.type!=="srezkrom")continue;
   const alpha=N(e.srez),start=N(e.otstup);
   if(!alpha)continue;
   bevels.push({
     id:(crypto.randomUUID?crypto.randomUUID():("bevel-"+key+"-"+side)),
     subType:"bevel",validationErrors:[],isHidden:false,
     alpha,dataForConstructor:{},excludeFromCalculation:false,
     isGrinding:false,isTemplate:null,side,start
   });
 }
 details.push({
   productId:1,id:did++,name:C(td[3]?.innerText)||("Деталь "+(key+1)),
   detailDescription:"",material:mi,material_id:article,isRotateTexture:false,
   h:W,l:L,preCutting:{left:null,right:null,top:null,bottom:null},
   multiplicity:null,count,holes:[],
   edges:{left:null,right:null,top:null,bottom:null},
   rects:[],mills:[],contour:[],corners:[],bevels,arcs:[],smiles:[]
 });
}

const data={
 glue_type:"PUR",glue_color:"white",
 products:{"1":{id:1,name:"ViyarPro V5.24 BEVEL TEST",code:""}},
 materials,edges:[],furnitures:[],details,emptyList:[],
 constructor:{created:{provider_name:"Kronas-Giblab",provider_version:"1.0"}}
};
const txt=JSON.stringify(data,null,2);
const blob=new Blob([txt],{type:"application/json;charset=utf-8"});
const url=URL.createObjectURL(blob),a=document.createElement("a");
a.href=url;a.download="Viyar_to_KRONAS_V5_24_BEVEL_TEST.json";
document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
const n=details.reduce((s,d)=>s+d.bevels.length,0);
alert("V5.24 BEVEL TEST\nДеталей: "+details.length+"\nЗрізів 45°: "+n+"\n\nОсновний V5.23 НЕ ЗМІНЕНО.");
}catch(e){console.error(e);alert("V5.24 TEST ПОМИЛКА:\n"+e.message)}})();