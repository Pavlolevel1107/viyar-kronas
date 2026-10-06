(async()=>{
try{
const E=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const N=v=>{let n=parseFloat(String(v??"").replace(",","."));return Number.isFinite(n)?n:0};
const C=v=>String(v??"").replace(/\s+/g," ").trim();

const rows=[...document.querySelectorAll('#detailsTable tr[id^="row-"]')];
if(!rows.length)throw Error('Відкрий вкладку "Деталі"');

let gid=10,oid=100;
const parts=[],mats=new Map(),bands=new Map(),ops=[];
const nativeBevels=[];

for(const r of rows){
 const key=+r.id.replace("row-","");
 const td=r.querySelectorAll("td");
 const m=(td[4]?.innerText||"").match(/([\d.,]+)\s*[×x]\s*([\d.,]+)\s*[×x]\s*([\d.,]+)/);
 if(!m)continue;

 const L=N(m[1]),W=N(m[2]),T=N(m[3]),qty=N(td[5]?.innerText)||1;
 let meta={};try{meta=getDetailDataByKey(key)||{}}catch(e){}

 const mat=meta.materialArticle||meta.materialId||"VIYAR";
 if(!mats.has(mat))mats.set(mat,{id:gid++,pid:10000+mats.size,code:mat,t:T});
 const name=C(td[3]?.innerText)||`Деталь ${key+1}`;

 const ec=r.querySelector(".kromkaPad");
 const edge=s=>{const e=ec?.querySelector("#"+s);return{t:N(e?.textContent),name:(e?.title||"").trim()}};

 let holes=[];
 try{
   const h=$("<div>").html(await $.post("/service/system/views/additives/inc/tableHoles.php",{detail_key:key}));
   holes=h.find('tr[id^="holeKeyId-"]').map(function(){
     const q=$(this);
     return{side:C(q.find('[name="side"]').text()),corner:C(q.find('[name="corner"]').text()),
       x:N(q.find('[name="x"]').text()),y:N(q.find('[name="y"]').text()),
       dp:N(q.find('[name="depth"]').text()),d:N(q.find('[name="diameter"]').text())};
   }).get();
 }catch(e){console.warn("HOLES",key,e)}

 let grooves=[];
 try{
   const g=$("<div>").html(await $.post("/service/system/views/additives/inc/tableGrooves.php",
     {detail_key:key,machineId:typeof machine!=="undefined"?machine:""}));
   grooves=g.find('tr[id^="grooveKeyId-"]').map(function(){
     const c=$(this).find("td");
     return{side:C(c.eq(1).text()),corner:C(c.eq(2).text()),dir:C(c.eq(3).text()),
       x:N(c.eq(4).text()),y:N(c.eq(5).text()),dp:N(c.eq(6).text()),
       w:N(c.eq(7).text()),len:N(c.eq(8).text())};
   }).get();
 }catch(e){console.warn("GROOVES",key,e)}

 // V5.12: Г-подібні кутові вирізи — читаємо напряму через tableCorners.php
 // так само, як отвори та пази. Працює для кожної detail_key.
 let cornerCuts=[];
 try{
   const ch=$("<div>").html(await $.post(
     "/service/system/views/additives/inc/tableCorners.php",
     {detail_key:key,machineId:false}
   ));

   cornerCuts=ch.find('tr[id^="corner-"]').map(function(){
     const tr=$(this), c=tr.find("td");
     const type=C(c.eq(1).text());
     if(!/Г-подібний виріз/i.test(type))return null;

     const img=c.eq(0).find("img").attr("src")||"";
     let corner="";
     if(/bottom_left_min\.svg/i.test(img))corner="BL";
     else if(/top_left_min\.svg/i.test(img))corner="TL";
     else if(/top_right_min\.svg/i.test(img))corner="TR";
     else if(/bottom_right_min\.svg/i.test(img))corner="BR";
     if(!corner)return null;

     return{
       corner,
       r:N(c.eq(2).text()),
       x:N(c.eq(3).text()),
       y:N(c.eq(4).text()),
       edge:C(c.eq(5).text()),
       rowId:tr.attr("id")
     };
   }).get().filter(Boolean);

   console.log("CORNER CUTS detail_key="+key,cornerCuts);
 }catch(e){
   console.warn("CORNER CUTS",key,e);
 }

 // V5.15: Вирізи за шаблоном — П-подібний виріз.
 // Перевірене джерело ViyarPro: tableShapesByPattern.php.
 // Формат рядка:
 // td[1] тип, td[2] сторона, td[3] прив'язка, td[4] зміщення,
 // td[5] розмір AxB, td[6] R2/R3, td[8] крайка.
 let uCuts=[];
 try{
   const sh=$("<div>").html(await $.post(
     "/service/system/views/additives/inc/tableShapesByPattern.php",
     {detail_key:key}
   ));

   uCuts=sh.find('tr[id^="shape-"]').map(function(){
     const tr=$(this),c=tr.find("td");
     const type=C(c.eq(1).text());
     if(!/П-подібний виріз/i.test(type))return null;

     const size=C(c.eq(5).text()).match(/([\d.,]+)\s*[xх×]\s*([\d.,]+)/i);
     if(!size)return null;

     const rt=C(c.eq(6).text());
     const r2m=rt.match(/R2\s*:\s*([\d.,]+)/i);
     const r3m=rt.match(/R3\s*:\s*([\d.,]+)/i);

     return{
       side:C(c.eq(2).text()),
       bind:C(c.eq(3).text()),
       off:N(c.eq(4).text()),
       a:N(size[1]),
       b:N(size[2]),
       r2:r2m?N(r2m[1]):0,
       r3:r3m?N(r3m[1]):0,
       edge:C(c.eq(8).text()),
       rowId:tr.attr("id")
     };
   }).get().filter(Boolean);

   console.log("U CUTS detail_key="+key,uCuts);
 }catch(e){
   console.warn("U CUTS",key,e);
 }

 // V5.21: внутрішній "Прямокутний виріз".
 // Viyar tableShapesByPattern.php:
 // td[4] = XxY, td[5] = розмір AxB, td[6] = радіус.
 // Контрольний тест:
 // Viyar X=200,Y=200, size=100x101,R10 на 600x600
 // -> фізично X=200,Y=200, розмір X=100, Y=101, R10.
 let rectCuts=[];
 try{
   const sh=$("<div>").html(await $.post(
     "/service/system/views/additives/inc/tableShapesByPattern.php",
     {detail_key:key}
   ));

   rectCuts=sh.find('tr[id^="shape-"]').map(function(){
     const tr=$(this),c=tr.find("td");
     const type=C(c.eq(1).text());
     if(!/Прямокутний виріз/i.test(type))return null;

     const pos=C(c.eq(4).text()).match(/([\d.,]+)\s*[xх×]\s*([\d.,]+)/i);
     const size=C(c.eq(5).text()).match(/([\d.,]+)\s*[xх×]\s*([\d.,]+)/i);
     if(!pos||!size)return null;

     return{
       side:C(c.eq(2).text()),
       depthText:C(c.eq(3).text()),
       x:N(pos[1]),
       y:N(pos[2]),
       a:N(size[1]),   // Viyar "Розмір по X" / перше число (фізична ширина по X)
       b:N(size[2]),   // Viyar "Розмір по Y" / друге число (фізична висота по Y)
       r:N(c.eq(6).text()),
       edge:C(c.eq(8).text()),
       rowId:tr.attr("id")
     };
   }).get().filter(Boolean);

   console.log("RECT CUTS detail_key="+key,rectCuts);
 }catch(e){
   console.warn("RECT CUTS",key,e);
 }


 // V5.21: ЧВЕРТЬ — беремо з РЕАЛЬНОГО API Viyar Additives/getDetail.
 // Перевірено на живих даних:
 // rabbets: [{side:"65",n:0,z:10,d:5,l:500,... full:1}, ...]
 // side: 65 низ-тильна, 63 верх-тильна, 62 ліва-тильна, 64 права-тильна
 //       15 низ-лицьова, 13 верх-лицьова, 12 ліва-лицьова, 14 права-лицьова
 // Фізичні тести KRONAS підтвердили: z = глибина; d = ширина.
 let rabbets=[];
 try{
   const raw=await $.post(
     "/service/system/controllers/JsonController.php",
     {
       controller:"Additives",
       action:"getDetail",
       detail_key:key,
       set_current_detail:0,
       machineId:typeof machine!=="undefined"?machine:false
     }
   );
   let det=raw;
   if(typeof det==="string"){
     try{det=JSON.parse(det)}catch(parseErr){
       console.warn("RABBETS JSON parse",key,parseErr,raw);
       det={};
     }
   }
   // На випадок, якщо Viyar змінить обгортку відповіді.
   if(det&&det.data&&typeof det.data==="object")det=det.data;

   // V5.24 ADD-ONLY: зріз торця; логіку V5.23 не змінюємо.
   for(const bevelSide of ["left","top","right","bottom"]){
     const be=det?.data_edges?.[bevelSide];
     if(!be||be.type!=="srezkrom")continue;
     const alpha=N(be.srez),start=N(be.otstup);
     if(!alpha)continue;
     nativeBevels.push({detail_key:key,detail_name:name,l:L,w:W,t:T,side:bevelSide,start,alpha,
       edge_code:String(be.kromka??""),edge_name:String(be.edgeName??"")});
   }

   rabbets=Array.isArray(det?.rabbets) ? det.rabbets.map(q=>({
     side:Number(q.side),
     n:N(q.n),
     depth:N(q.z),   // ПІДТВЕРДЖЕНО фізичним тестом: z=10 -> глибина 10
     width:N(q.d),   // ПІДТВЕРДЖЕНО фізичним тестом: d=5 -> ширина 5
     l:N(q.l),
     r:N(q.r),
     type:Number(q.type),
     full:Number(q.full),
     ext:Number(q.ext),
     pattern:Number(q.pattern),
     key:q.key
   })).filter(q=>q.depth>0&&q.width>0) : [];

   console.log("RABBETS detail_key="+key,rabbets);
 }catch(e){
   console.warn("RABBETS getDetail",key,e);
 }

 parts.push({key,name,L,W,T,qty,mat,
   edges:{top:edge("top"),bottom:edge("bottom"),left:edge("left"),right:edge("right")},
   holes,grooves,cornerCuts,uCuts,rectCuts,rabbets});
}

const band=e=>{
 if(!e||e.t<=0)return null;
 const n=e.name||`Крайка ${e.t} мм`;
 if(!bands.has(n))bands.set(n,{id:gid++,op:oid++,name:n,t:e.t,parts:[]});
 return bands.get(n);
};
parts.forEach(p=>Object.values(p.edges).forEach(band));

const pp=[];
const GA={"В.":"grt","Н.":"grb","Л.":"grl","П.":"grr"};
const GS={grt:"grts",grb:"grbs",grl:"grls",grr:"grrs"};
const EA={top:"elt",bottom:"elb",left:"ell",right:"elr"};

parts.forEach((p,i)=>{
 const id=1000+i;
 let attrs="";

 for(const[s,a]of Object.entries(EA)){
   const e=p.edges[s];
   if(e?.t>0){const b=band(e);attrs+=` ${a}="@operation#${b.op}"`;b.parts.push(id);}
 }

 for(const g of p.grooves){
    const a=GA[g.corner]; if(!a) continue;
    const vertical=g.dir.toLowerCase().includes("вер");
    const off=vertical ? g.x : g.y;
    const op=oid++;
    ops.push({type:"GR",op,id,w:g.w,dp:g.dp||7,off,len:g.len});
    const grooveSide=/тиль/i.test(g.side) ? "false" : "true";
    attrs+=` ${a}="@operation#${op}" ${GS[a]}="${grooveSide}"`;
 }

 const hs=p.holes.filter(h=>{
   const s=h.side.toLowerCase();
   return s.includes("лиць")||s.includes("лиц")||s.includes("ліва")||
          s.includes("лева")||s.includes("права")||s.includes("верх")||s.includes("ниж");
 });

 if(hs.length){
   const op=oid++,tools=new Map();
   let xnc=`<program dx="${p.L}" dy="${p.W}" dz="${p.T}">`;
   for(const h of hs){
     const tn="D"+String(h.d).replace(".","_");
     if(!tools.has(h.d)){tools.set(h.d,tn);xnc+=`<tool name="${tn}" d="${h.d}"/>`;}
   }
   for(const h of hs){
     const tn=tools.get(h.d),s=h.side.toLowerCase();
     if(s.includes("лиць")||s.includes("лиц")){
       let X=h.x,Y=h.y;
       switch(h.corner){
         case"Л.В.":X=h.x;Y=h.y;break;
         case"П.В.":X=p.L-h.x;Y=h.y;break;
         case"Л.Н.":X=h.x;Y=p.W-h.y;break;
         case"П.Н.":X=p.L-h.x;Y=p.W-h.y;break;
         default:console.warn("Невідома прив'язка ЛИЦЬОВОГО:",p.name,h);
       }
       xnc+=`<bf name="${tn}" x="${X}" y="${Y}" dp="${h.dp}" ac="1" av="false"/>`;
     }else if(s.includes("ліва")||s.includes("лева")||s.includes("права")){
       let Y=h.y;
       if(h.corner.endsWith("В."))Y=h.y;
       else if(h.corner.endsWith("Н."))Y=p.W-h.y;
       if(s.includes("ліва")||s.includes("лева"))
         xnc+=`<bl name="${tn}" y="${Y}" z="${h.dp}" m="true" dp="${h.dp}"/>`;
       else xnc+=`<br name="${tn}" y="${Y}" z="${h.dp}" m="true" dp="${h.dp}"/>`;
     }else if(s.includes("верх")){
       let X=h.x;
       if(h.corner.startsWith("П."))X=p.L-h.x;
       xnc+=`<bt name="${tn}" x="${X}" z="${h.dp}" m="true" dp="${h.dp}"/>`;
     }else if(s.includes("ниж")){
       let X=h.x;
       if(h.corner.startsWith("П."))X=p.L-h.x;
       xnc+=`<bb name="${tn}" x="${X}" z="${h.dp}" m="true" dp="${h.dp}"/>`;
     }
   }
   xnc+="</program>";
   ops.push({type:"XNC",op,id,code:`VIYAR_${p.key}`,program:xnc,count:hs.length});
 }

 const backHs=p.holes.filter(h=>h.side.toLowerCase().includes("тиль"));
 if(backHs.length){
   const backOp=oid++,backTools=new Map();
   let backXnc=`<program dx="${p.L}" dy="${p.W}" dz="${p.T}">`;
   for(const h of backHs){
     const tn="D"+String(h.d).replace(".","_");
     if(!backTools.has(h.d)){backTools.set(h.d,tn);backXnc+=`<tool name="${tn}" d="${h.d}"/>`;}
   }
   for(const h of backHs){
     const tn=backTools.get(h.d);let X=h.x,Y=h.y;
     switch(h.corner){
       case "Л.В.":X=h.x;Y=h.y;break;
       case "П.В.":X=p.L-h.x;Y=h.y;break;
       case "Л.Н.":X=h.x;Y=p.W-h.y;break;
       case "П.Н.":X=p.L-h.x;Y=p.W-h.y;break;
     }
     backXnc+=`<bf name="${tn}" x="${X}" y="${Y}" dp="${h.dp}" ac="1" av="false"/>`;
   }
   backXnc+="</program>";
   ops.push({type:"XNC",op:backOp,id,code:`VIYAR_BACK_${p.key}`,program:backXnc,count:backHs.length,side:false});
 }


 // V5.21 — ЧВЕРТЬ.
 // Експортуємо тільки full=1: саме цей режим перевірено фізично на всіх 4 сторонах.
 // Часткові чверті full=0 поки НЕ вигадуємо: вони логуються і пропускаються.
 const RABBET_SIDE={
   12:{edge:"left", face:"front"},  14:{edge:"right",face:"front"},
   13:{edge:"top",  face:"front"},  15:{edge:"bottom",face:"front"},
   62:{edge:"left", face:"back"},   64:{edge:"right",face:"back"},
   63:{edge:"top",  face:"back"},   65:{edge:"bottom",face:"back"}
 };

 for(const q of p.rabbets){
   const sm=RABBET_SIDE[q.side];
   if(!sm){
     console.warn("V5.21: невідомий side чверті — пропущено:",p.name,q);
     continue;
   }
   if(q.full!==1){
     console.warn("V5.21: часткова чверть full=0 ще не перевірена — пропущено:",p.name,q);
     continue;
   }

   const width=q.width;       // Viyar d
   const depth=q.depth;       // Viyar z
   const toolD=2*width;       // центр Ø(2*width) на краю => всередину заходить width
   if(!(toolD>0&&depth>0))continue;

   const tn="Q"+String(toolD).replace(".","_");
   let seg="";

   // Усі 4 координати краю перевірені окремими PROJECT-тестами в KRONAS.
   if(sm.edge==="top"){
     seg=`<ms name="${tn}" x="0" y="0" dp="${depth}" c="0" in="1"/>`+
         `<ml x="${p.L}" y="0" dp="${depth}"/>`;
   }else if(sm.edge==="bottom"){
     seg=`<ms name="${tn}" x="0" y="${p.W}" dp="${depth}" c="0" in="1"/>`+
         `<ml x="${p.L}" y="${p.W}" dp="${depth}"/>`;
   }else if(sm.edge==="left"){
     seg=`<ms name="${tn}" x="0" y="0" dp="${depth}" c="0" in="1"/>`+
         `<ml x="0" y="${p.W}" dp="${depth}"/>`;
   }else if(sm.edge==="right"){
     seg=`<ms name="${tn}" x="${p.L}" y="0" dp="${depth}" c="0" in="1"/>`+
         `<ml x="${p.L}" y="${p.W}" dp="${depth}"/>`;
   }

   const op=oid++;
   const program=`<program dx="${p.L}" dy="${p.W}" dz="${p.T}">`+
                 `<tool name="${tn}" d="${toolD}"/>${seg}</program>`;

   ops.push({
     type:"XNC",
     op,id,
     code:`VIYAR_RABBET_${p.key}_${q.key??op}`,
     program,
     count:0,
     side:sm.face==="back"?false:true
   });
 }

 // V5.11 — Г-подібний виріз.
 // Перевірений тест: для TOP-RIGHT 100x100 R10 KRONAS правильно розпізнав
 // траєкторію з Y, дзеркальною до внутрішньої системи KRONAS.
 for(const c of p.cornerCuts){
   const op=oid++;
   const R=Math.max(0,Math.min(c.r,c.x,c.y));
   const toolD=R>0?Math.max(1,2*R):1;
   const tn="M"+String(toolD).replace(".","_");
   let seg="";

   // Координати XNC підібрані під фактичний імпорт GibLab -> KRONAS.
   if(c.corner==="TR"){
     seg=`<ms name="${tn}" x="${p.L-c.x}" y="0" dp="${p.T}" c="0" in="1"/>`+
         `<ml x="${p.L-c.x}" y="${c.y-R}" dp="${p.T}"/>`+
         (R?`<ma x="${p.L-c.x+R}" y="${c.y}" dp="${p.T}" r="${R}" dir="false"/>`:"")+
         `<ml x="${p.L}" y="${c.y}" dp="${p.T}"/>`;
   }else if(c.corner==="TL"){
     seg=`<ms name="${tn}" x="${c.x}" y="0" dp="${p.T}" c="0" in="1"/>`+
         `<ml x="${c.x}" y="${c.y-R}" dp="${p.T}"/>`+
         (R?`<ma x="${c.x-R}" y="${c.y}" dp="${p.T}" r="${R}" dir="true"/>`:"")+
         `<ml x="0" y="${c.y}" dp="${p.T}"/>`;
   }else if(c.corner==="BR"){
     seg=`<ms name="${tn}" x="${p.L-c.x}" y="${p.W}" dp="${p.T}" c="0" in="1"/>`+
         `<ml x="${p.L-c.x}" y="${p.W-c.y+R}" dp="${p.T}"/>`+
         (R?`<ma x="${p.L-c.x+R}" y="${p.W-c.y}" dp="${p.T}" r="${R}" dir="true"/>`:"")+
         `<ml x="${p.L}" y="${p.W-c.y}" dp="${p.T}"/>`;
   }else if(c.corner==="BL"){
     seg=`<ms name="${tn}" x="${c.x}" y="${p.W}" dp="${p.T}" c="0" in="1"/>`+
         `<ml x="${c.x}" y="${p.W-c.y+R}" dp="${p.T}"/>`+
         (R?`<ma x="${c.x-R}" y="${p.W-c.y}" dp="${p.T}" r="${R}" dir="false"/>`:"")+
         `<ml x="0" y="${p.W-c.y}" dp="${p.T}"/>`;
   }
   if(seg){
     const program=`<program dx="${p.L}" dy="${p.W}" dz="${p.T}"><tool name="${tn}" d="${toolD}"/>${seg}</program>`;
     ops.push({type:"XNC",op,id,code:`VIYAR_CORNER_${p.key}_${c.corner}`,program,count:0});
   }
 }

 // V5.15 — П-подібний виріз із tableShapesByPattern.php.
 // Виправлена орієнтація за фактичними контрольними тестами Viyar -> KRONAS.
 // Viyar Верхня/Нижня: XNC Y у KRONAS відображається навпаки.
 // Viyar Ліва/Права: відступ уздовж вертикального торця у Viyar рахується знизу,
 // тому для XNC переводимо його в координату: W - off - along.
 for(const c of p.uCuts){
   const side=c.side.toLowerCase();
   const along=c.a;
   const depth=c.b;
   const off=c.off;

   const R2=Math.max(0,Math.min(c.r2,along/2,depth));
   const R3=Math.max(0,Math.min(c.r3,along/2,depth));
   const toolD=Math.max(1,2*Math.max(R2,R3,0.5));
   const tn="U"+String(toolD).replace(".","_");
   const op=oid++;
   let seg="";

   if(side.includes("верх")){
     // V5.21: ПЕРЕВІРЕНО ізольованим тестом:
     // Viyar Верхня -> XNC y=0 -> depth -> KRONAS Верхня.
     const a=off,b=off+along;
     if(along>0&&depth>0&&a>=0&&b<=p.L&&depth<=p.W){
       seg=`<ms name="${tn}" x="${a}" y="0" dp="${p.T}" c="0" in="1"/>`+
           `<ml x="${a}" y="${depth-R2}" dp="${p.T}"/>`+
           (R2?`<ma x="${a+R2}" y="${depth}" dp="${p.T}" r="${R2}" dir="false"/>`:`<ml x="${a}" y="${depth}" dp="${p.T}"/>`)+
           `<ml x="${b-R3}" y="${depth}" dp="${p.T}"/>`+
           (R3?`<ma x="${b}" y="${depth-R3}" dp="${p.T}" r="${R3}" dir="false"/>`:`<ml x="${b}" y="${depth}" dp="${p.T}"/>`)+
           `<ml x="${b}" y="0" dp="${p.T}"/>`;
     }
   }else if(side.includes("ниж")){
     // V5.21: Viyar Нижня -> XNC y=W -> W-depth -> KRONAS Нижня.
     const a=off,b=off+along;
     if(along>0&&depth>0&&a>=0&&b<=p.L&&depth<=p.W){
       seg=`<ms name="${tn}" x="${a}" y="${p.W}" dp="${p.T}" c="0" in="1"/>`+
           `<ml x="${a}" y="${p.W-depth+R2}" dp="${p.T}"/>`+
           (R2?`<ma x="${a+R2}" y="${p.W-depth}" dp="${p.T}" r="${R2}" dir="true"/>`:`<ml x="${a}" y="${p.W-depth}" dp="${p.T}"/>`)+
           `<ml x="${b-R3}" y="${p.W-depth}" dp="${p.T}"/>`+
           (R3?`<ma x="${b}" y="${p.W-depth+R3}" dp="${p.T}" r="${R3}" dir="true"/>`:`<ml x="${b}" y="${p.W-depth}" dp="${p.T}"/>`)+
           `<ml x="${b}" y="${p.W}" dp="${p.T}"/>`;
     }
   }else if(side.includes("лів")){
     // Viyar off=100 на вертикальному торці = 100 від НИЗУ.
     // XNC/KRONAS потребує початкову координату від протилежного краю.
     const a=p.W-off-along,b=p.W-off;
     if(along>0&&depth>0&&a>=0&&b<=p.W&&depth<=p.L){
       seg=`<ms name="${tn}" x="0" y="${a}" dp="${p.T}" c="0" in="1"/>`+
           `<ml x="${depth-R2}" y="${a}" dp="${p.T}"/>`+
           (R2?`<ma x="${depth}" y="${a+R2}" dp="${p.T}" r="${R2}" dir="true"/>`:`<ml x="${depth}" y="${a}" dp="${p.T}"/>`)+
           `<ml x="${depth}" y="${b-R3}" dp="${p.T}"/>`+
           (R3?`<ma x="${depth-R3}" y="${b}" dp="${p.T}" r="${R3}" dir="true"/>`:`<ml x="${depth}" y="${b}" dp="${p.T}"/>`)+
           `<ml x="0" y="${b}" dp="${p.T}"/>`;
     }
   }else if(side.includes("прав")){
     // Та сама вертикальна система відліку Viyar: off від НИЗУ.
     const a=p.W-off-along,b=p.W-off;
     if(along>0&&depth>0&&a>=0&&b<=p.W&&depth<=p.L){
       seg=`<ms name="${tn}" x="${p.L}" y="${a}" dp="${p.T}" c="0" in="1"/>`+
           `<ml x="${p.L-depth+R2}" y="${a}" dp="${p.T}"/>`+
           (R2?`<ma x="${p.L-depth}" y="${a+R2}" dp="${p.T}" r="${R2}" dir="false"/>`:`<ml x="${p.L-depth}" y="${a}" dp="${p.T}"/>`)+
           `<ml x="${p.L-depth}" y="${b-R3}" dp="${p.T}"/>`+
           (R3?`<ma x="${p.L-depth+R3}" y="${b}" dp="${p.T}" r="${R3}" dir="false"/>`:`<ml x="${p.L-depth}" y="${b}" dp="${p.T}"/>`)+
           `<ml x="${p.L}" y="${b}" dp="${p.T}"/>`;
     }
   }

   if(!seg){
     console.warn("V5.15: П-подібний виріз не експортовано — перевір сторону/розміри:",p.name,c);
     continue;
   }

   const program=`<program dx="${p.L}" dy="${p.W}" dz="${p.T}"><tool name="${tn}" d="${toolD}"/>${seg}</program>`;
   ops.push({type:"XNC",op,id,code:`VIYAR_UCUT_${p.key}_${c.rowId||op}`,program,count:0});
 }
 // V5.21 — внутрішній прямокутний виріз.
 // Важливо: у XNC вісь Y при імпорті KRONAS дзеркалиться.
 // Тому для Viyar Y використовуємо:
 // y0 = висота_деталі - Y_Viyar - розмір_по_Y.
 // Критичне уточнення V5.21 з реальної деталі №6:
 // Viyar 525x530, X=312,Y=190,size=130x250 -> 130 по X, 250 по Y.
 // Отже x1=312+130=442, y0=530-190-250=90.
 // Старе V5.16 міняло 130/250 місцями і через перевірку меж відкидало виріз.
 for(const c of p.rectCuts){
   const w=c.a;       // перше число Viyar size = фізичний розмір по X
   const h=c.b;       // друге число Viyar size = фізичний розмір по Y
   const x0=c.x;
   const y0=p.W-c.y-h;
   const x1=x0+w;
   const y1=y0+h;
   const R=Math.max(0,Math.min(c.r,w/2,h/2));

   if(!(w>0&&h>0&&x0>=0&&y0>=0&&x1<=p.L&&y1<=p.W)){
     console.warn("V5.21: прямокутний виріз не експортовано — перевір координати/розміри:",p.name,c,{x0,y0,x1,y1});
     continue;
   }

   const toolD=Math.max(1,2*Math.max(R,0.5));
   const tn="R"+String(toolD).replace(".","_");
   const op=oid++;
   let seg="";

   if(R>0){
     seg=
       `<ms name="${tn}" x="${x0}" y="${y0+R}" dp="${p.T}" c="0" in="1"/>`+
       `<ml x="${x0}" y="${y1-R}" dp="${p.T}"/>`+
       `<ma x="${x0+R}" y="${y1}" dp="${p.T}" r="${R}" dir="false"/>`+
       `<ml x="${x1-R}" y="${y1}" dp="${p.T}"/>`+
       `<ma x="${x1}" y="${y1-R}" dp="${p.T}" r="${R}" dir="false"/>`+
       `<ml x="${x1}" y="${y0+R}" dp="${p.T}"/>`+
       `<ma x="${x1-R}" y="${y0}" dp="${p.T}" r="${R}" dir="false"/>`+
       `<ml x="${x0+R}" y="${y0}" dp="${p.T}"/>`+
       `<ma x="${x0}" y="${y0+R}" dp="${p.T}" r="${R}" dir="false"/>`;
   }else{
     seg=
       `<ms name="${tn}" x="${x0}" y="${y0}" dp="${p.T}" c="0" in="1"/>`+
       `<ml x="${x0}" y="${y1}" dp="${p.T}"/>`+
       `<ml x="${x1}" y="${y1}" dp="${p.T}"/>`+
       `<ml x="${x1}" y="${y0}" dp="${p.T}"/>`+
       `<ml x="${x0}" y="${y0}" dp="${p.T}"/>`;
   }

   const program=`<program dx="${p.L}" dy="${p.W}" dz="${p.T}"><tool name="${tn}" d="${toolD}"/>${seg}</program>`;
   ops.push({type:"XNC",op,id,code:`VIYAR_RECT_${p.key}_${c.rowId||op}`,program,count:0});
 }

 pp.push({id,p,attrs});
});

let xml=`<?xml version="1.0" encoding="UTF-8"?>
<project currency="грн" version="1">
<good id="1" typeId="product" count="1" name="ViyarPro V5.23">
`;
for(const x of pp)xml+=`<part id="${x.id}" l="${x.p.L}" w="${x.p.W}" dl="${x.p.L}" dw="${x.p.W}" count="${x.p.qty}" txt="false" name="${E(x.p.name)}"${x.attrs}/>\n`;
xml+=`</good>\n<good id="2" typeId="tool.cutting"/>\n`;
for(const m of mats.values())xml+=`<good id="${m.id}" typeId="sheet" name="Viyar material ${E(m.code)}" code="${E(m.code)}" unit="м2" t="${m.t}"><part id="${m.pid}" l="2800" w="2070" count="10000" usedCount="1"/></good>\n`;
if(bands.size)xml+=`<good id="3" typeId="tool.edgeline"/>\n`;
for(const b of bands.values())xml+=`<good id="${b.id}" typeId="band" name="${E(b.name)}" code="${E(b.name)}" unit="м" t="${b.t}" w="22"/>\n`;

let co=10;
for(const m of mats.values()){
 xml+=`<operation id="${co++}" typeId="CS" tool1="2" cSizeMode="1">\n`;
 pp.filter(x=>x.p.mat===m.code).forEach(x=>xml+=`<part id="${x.id}"/>\n`);
 xml+=`<part id="${m.pid}"/>\n<material id="${m.id}"/>\n</operation>\n`;
}
for(const b of bands.values()){
 if(!b.parts.length)continue;
 xml+=`<operation id="${b.op}" typeId="EL" tool1="3">\n`;
 [...new Set(b.parts)].forEach(id=>xml+=`<part id="${id}"/>\n`);
 xml+=`<material id="${b.id}"/>\n</operation>\n`;
}
for(const o of ops.filter(x=>x.type==="GR"))xml+=`<operation id="${o.op}" typeId="GR" grWidth="${o.w}" grDepth="${o.dp}" grOffset="${o.off}" grOffsetIncl="false" grSawthick="${o.w}" grCuttingLength="${o.len}" grCost="0"><part id="${o.id}"/></operation>\n`;
for(const o of ops.filter(x=>x.type==="XNC"))xml+=`<operation id="${o.op}" typeId="XNC" code="${E(o.code)}" count="1" side="${o.side===false?"false":"true"}" turn="0" mirHor="false" mirVert="false" bySizeDetail="true" countBore="${o.count}" priceBore="0" costBore="0" program="${E(o.program)}"><part id="${o.id}"/></operation>\n`;
xml+=`</project>`;

const blob=new Blob([xml],{type:"application/xml;charset=utf-8"});
const url=URL.createObjectURL(blob),a=document.createElement("a");
a.href=url;a.download="Viyar_to_KRONAS_V5_23.project";
document.body.appendChild(a);a.click();a.remove();
setTimeout(()=>URL.revokeObjectURL(url),1500);

 // V5.24 ADD-ONLY: один KRONAS helper. V5.23 .project не змінюється.
 {
   const payload=JSON.stringify({format:"VIYAR_KRONAS_V5_24_BEVELS",version:"5.24",source:"V5.23_LOCKED",count:nativeBevels.length,bevels:nativeBevels});
   const helper=`javascript:(()=>{const B=${payload};const I=document.createElement("input");I.type="file";I.accept=".json,application/json";I.onchange=async()=>{try{const F=I.files&&I.files[0];if(!F)return;const J=JSON.parse(await F.text());const D=Array.isArray(J.details)?J.details:(Array.isArray(J?.data?.details)?J.data.details:null);if(!D)throw Error("Не знайдено details[]");const norm=x=>String(x??"").replace(/\\s+/g," ").trim().toLowerCase();const groups=new Map();for(const b of B.bevels){const k=[norm(b.detail_name),Number(b.l),Number(b.w)].join("|");if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b)}let added=0,matched=0;for(const [k,bs] of groups){const b0=bs[0];let d=D.find(d=>norm(d.name)===norm(b0.detail_name)&&(((Number(d.l)===Number(b0.l))&&(Number(d.h)===Number(b0.w)))||((Number(d.l)===Number(b0.w))&&(Number(d.h)===Number(b0.l)))));if(!d){console.warn("V5.24 detail not found",b0);continue}matched++;if(!Array.isArray(d.bevels))d.bevels=[];for(const b of bs){if(d.bevels.some(x=>x&&x.side===b.side&&Number(x.start)===Number(b.start)&&Number(x.alpha)===Number(b.alpha)))continue;d.bevels.push({id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),subType:"bevel",validationErrors:[],isHidden:false,alpha:Number(b.alpha),dataForConstructor:{},excludeFromCalculation:false,isGrinding:false,isTemplate:null,side:b.side,start:Number(b.start)});added++}}const O=new Blob([JSON.stringify(J,null,2)],{type:"application/json;charset=utf-8"}),U=URL.createObjectURL(O),A=document.createElement("a");A.href=U;A.download="KRONAS_V5_24_FINAL.json";document.body.appendChild(A);A.click();A.remove();setTimeout(()=>URL.revokeObjectURL(U),1500);alert("V5.24: додано зрізів "+added+" із "+B.count+". Деталей зі зрізами: "+matched+". Інші поля JSON не змінювались.")}catch(e){console.error(e);alert("V5.24 ERROR: "+e.message)}};I.click()})()`;
   const hb=new Blob([helper],{type:"text/plain;charset=utf-8"}),hu=URL.createObjectURL(hb),ha=document.createElement("a");
   ha.href=hu;ha.download="KRONAS_V5_24_FINALIZER.txt";document.body.appendChild(ha);ha.click();ha.remove();setTimeout(()=>URL.revokeObjectURL(hu),1500);
 }

const allH=parts.reduce((n,p)=>n+p.holes.length,0);
const exportedH=ops.filter(x=>x.type==="XNC").reduce((n,x)=>n+x.count,0);
const backH=parts.reduce((n,p)=>n+p.holes.filter(h=>h.side.toLowerCase().includes("тиль")).length,0);
const cuts=parts.reduce((n,p)=>n+p.cornerCuts.length,0);
const uCuts=parts.reduce((n,p)=>n+p.uCuts.length,0);
const uCutsExportable=parts.reduce((n,p)=>n+p.uCuts.filter(c=>/(верх|ниж|лів|прав)/i.test(c.side)).length,0);
const rectCuts=parts.reduce((n,p)=>n+p.rectCuts.length,0);
const rabbets=parts.reduce((n,p)=>n+p.rabbets.length,0);
const rabbetsFull=parts.reduce((n,p)=>n+p.rabbets.filter(q=>q.full===1).length,0);
const rabbetsPartial=rabbets-rabbetsFull;

console.log("===== VIYAR → KRONAS V5.24 / V5.23 LOCKED + BEVEL =====");
console.log("Деталей:",parts.length);
console.log("Отворів у Viyar:",allH);
console.log("Експортовано отворів:",exportedH);
console.log("Тильних окремо:",backH);
console.log("Пазів:",ops.filter(x=>x.type==="GR").length);
console.log("Г-подібних вирізів:",cuts);
console.log("П-подібних вирізів у Viyar:",uCuts);
console.log("П-подібних експортовано (4 сторони):",uCutsExportable);
console.log("Прямокутних вирізів:",rectCuts);
console.log("Чвертей у Viyar:",rabbets);
console.log("Чвертей full=1 експортовано:",rabbetsFull);
console.log("Часткових чвертей пропущено:",rabbetsPartial);
console.log("Матеріалів:",mats.size);
console.log("Крайок:",bands.size);
console.log("================================");

alert("V5.24 ГОТОВО\n\nДеталей: "+parts.length+
"\nОтворів Viyar: "+allH+
"\nЕкспортовано: "+exportedH+
"\nТильних окремо: "+backH+
"\nПазів: "+ops.filter(x=>x.type==="GR").length+
"\nГ-подібних вирізів: "+cuts+
"\nП-подібних Viyar: "+uCuts+
"\nП-подібних експортовано: "+uCutsExportable+
"\nПрямокутних вирізів: "+rectCuts+
"\nЧвертей Viyar: "+rabbets+
"\nЧвертей експортовано: "+rabbetsFull+
"\nЧасткових пропущено: "+rabbetsPartial+
"\nЗрізів 45° знайдено: "+nativeBevels.length+
"\n\nСкачано:"+
"\n1. Viyar_to_KRONAS_V5_23.project"+
"\n2. KRONAS_V5_24_FINALIZER.txt");
}catch(e){console.error(e);alert("V5.24 ПОМИЛКА:\n"+e.message);}
})();