/* Thom Vendas — Painel de Vendas (vanilla JS, sem dependências) */
const LS_KEY = "thomvendas_sales_v1";
const GOAL_KEY = "thomvendas_goal_v1";
const LEGACY_LS_KEY = "vendafacil_sales_v1";
const LEGACY_GOAL_KEY = "vendafacil_goal_v1";
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const $ = (s) => document.querySelector(s);

const CATALOG = [
  { produto: "Fone Bluetooth X2", categoria: "Eletrônicos", preco: 299.9 },
  { produto: "Smartwatch Fit Pro", categoria: "Eletrônicos", preco: 549.9 },
  { produto: "Camiseta Essential", categoria: "Moda", preco: 89.9 },
  { produto: "Tênis Runner Air", categoria: "Esporte", preco: 399.9 },
  { produto: "Luminária LED Mesa", categoria: "Casa", preco: 149.9 },
  { produto: "Kit Skincare Glow", categoria: "Beleza", preco: 189.9 },
  { produto: "Mochila Urban 20L", categoria: "Moda", preco: 219.9 },
  { produto: "Air Fryer 5L", categoria: "Casa", preco: 479.9 },
  { produto: "Whey Protein 1kg", categoria: "Esporte", preco: 139.9 },
  { produto: "Perfume Essence 100ml", categoria: "Beleza", preco: 259.9 },
  { produto: "Teclado Mecânico RGB", categoria: "Eletrônicos", preco: 349.9 },
  { produto: "Calça Jeans Slim", categoria: "Moda", preco: 179.9 },
];
const CLIENTS = ["Maria Silva","João Pedro","Ana Costa","Lucas Almeida","Fernanda Rocha","Rafael Souza","Juliana Lima","Pedro Santos","Camila Ferreira","Thiago Oliveira","Beatriz Cardoso","Gustavo Mendes","Larissa Pinto","Diego Ramos","Patrícia Gomes"];
const PAYMENTS = ["Pix","Cartão","Boleto"];
const STATUS = ["Pago","Pago","Pago","Enviado","Pendente","Pago","Enviado","Cancelado"];
const COLORS = ["#6c5ce7","#00c9ff","#00d68f","#ffb020","#ff5c7a","#a363ff"];

// ---------- seed ----------
function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function seedSales(){
  const rnd = mulberry(42);
  const sales = [];
  let id = 1001;
  const today = new Date(); today.setHours(12,0,0,0);
  for(let d=89; d>=0; d--){
    const date = new Date(today); date.setDate(date.getDate()-d);
    const weekday = date.getDay();
    const base = weekday===0?1: weekday===6?3 : 2+Math.floor(rnd()*3);
    for(let i=0;i<base;i++){
      const c = CATALOG[Math.floor(rnd()*CATALOG.length)];
      const qtd = 1+Math.floor(rnd()*2);
      sales.push({
        id: "PED-"+(id++),
        cliente: CLIENTS[Math.floor(rnd()*CLIENTS.length)],
        produto: c.produto, categoria: c.categoria,
        valor: +(c.preco*qtd).toFixed(2), qtd,
        pagamento: PAYMENTS[Math.floor(rnd()*PAYMENTS.length)],
        status: STATUS[Math.floor(rnd()*STATUS.length)],
        data: date.toISOString().slice(0,10),
      });
    }
  }
  return sales;
}
function loadSales(){
  try{
    const raw = localStorage.getItem(LS_KEY) || localStorage.getItem(LEGACY_LS_KEY);
    if(raw){ const arr = JSON.parse(raw); if(Array.isArray(arr)&&arr.length) return arr; }
  }catch{}
  const s = seedSales();
  try{ localStorage.setItem(LS_KEY, JSON.stringify(s)); }catch{}
  return s;
}
function saveSales(s){ try{ localStorage.setItem(LS_KEY, JSON.stringify(s)); }catch{} }
let sales = loadSales();
let goal = +(localStorage.getItem(GOAL_KEY) || localStorage.getItem(LEGACY_GOAL_KEY) || 120000);
let chartType = "line";
let sortKey = "data", sortDir = -1;

// ---------- filters ----------
function filtered(){
  const days = +$("#periodSelect").value;
  const cat = $("#categorySelect").value;
  const q = $("#searchInput").value.trim().toLowerCase();
  const st = $("#statusSelect").value;
  const cutoff = days===0 ? null : (()=>{const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)})();
  return sales.filter(s=>{
    if(cutoff && s.data < cutoff) return false;
    if(cat!=="todas" && s.categoria!==cat) return false;
    if(st!=="todos" && document.querySelector("#view-pedidos").classList.contains("active")===false ? false : (st!=="todos" && s.status!==st)) return false;
    if(q && !(s.cliente+" "+s.produto+" "+s.id).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=> sortKey==="valor" ? (a.valor-b.valor)*sortDir : String(a[sortKey]).localeCompare(String(b[sortKey]))*sortDir);
}
// status filter applies only on pedidos view; dashboard ignores it
function filteredForDashboard(){
  const days = +$("#periodSelect").value;
  const cat = $("#categorySelect").value;
  const q = $("#searchInput").value.trim().toLowerCase();
  const cutoff = days===0 ? null : (()=>{const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)})();
  return sales.filter(s=>{
    if(cutoff && s.data < cutoff) return false;
    if(cat!=="todas" && s.categoria!==cat) return false;
    if(q && !(s.cliente+" "+s.produto+" "+s.id).toLowerCase().includes(q)) return false;
    return true;
  });
}

// ---------- render ----------
function fmtPct(v){ return (v>=0?"▲ +":"▼ ")+v.toFixed(1).replace(".",",").replace("+","")+"%"; }
function render(){
  const list = filteredForDashboard();
  const days = +$("#periodSelect").value || 90;
  // KPIs with previous-period comparison
  const half = Math.floor(list.length/2);
  const prev = list.slice(0,half), cur = list.slice(half);
  const sum = a=>a.reduce((t,s)=>t+(s.status==="Cancelado"?0:s.valor),0);
  const rCur=sum(cur)||sum(list), rPrev=sum(prev)||1;
  const nCur=cur.length||list.length, nPrev=prev.length||1;
  const dR=(rCur-rPrev)/rPrev*100, dN=(nCur-nPrev)/nPrev*100;
  const ticket = list.length? sum(list)/list.filter(s=>s.status!=="Cancelado").length||0:0;

  $("#kpiReceita").textContent = BRL.format(sum(list));
  $("#kpiPedidos").textContent = list.length;
  $("#kpiTicket").textContent = BRL.format(ticket||0);
  $("#kpiConversao").textContent = (18+ (list.length%7) + 0.4).toFixed(1).replace(".",",")+"%";
  const dev = sales.filter(s=>s.status==="Cancelado").length;
  $("#kpiDevolucoes").textContent = dev+" cancelados no total";
  setDelta("#kpiReceitaDelta",dR); setDelta("#kpiPedidosDelta",dN); setDelta("#kpiTicketDelta",(ticket%5)-2);

  // goal (month)
  const month = new Date().toISOString().slice(0,7);
  const monthSum = sales.filter(s=>s.data.startsWith(month)&&s.status!=="Cancelado").reduce((t,s)=>t+s.valor,0);
  const pct = goal? Math.min(100,monthSum/goal*100):0;
  $("#goalValue").textContent=BRL.format(monthSum);
  $("#goalTargetLabel").textContent="de "+BRL.format(goal);
  $("#goalBar").style.width=pct+"%";
  $("#goalPct").textContent=pct.toFixed(1).replace(".",",")+"% alcançado • faltam "+BRL.format(Math.max(0,goal-monthSum));
  $("#sidebarGoalText").textContent=BRL.format(monthSum)+" de "+BRL.format(goal);
  $("#sidebarGoalBar").style.width=pct+"%";
  $("#sidebarGoalPct").textContent=pct.toFixed(0)+"% alcançado";

  drawSalesChart(list, days);
  drawCatChart(list);
  renderTop(list);
  renderRecent(list);
  renderAll();
  renderProducts();
  renderSummaries();
}
function setDelta(sel,v){
  const el=$(sel); el.textContent=(isFinite(v)?fmtPct(v):"— 0%");
  el.className="delta "+(v>0.5?"up":v<-0.5?"down":"neutral");
}

// ---------- charts (canvas vanilla) ----------
function setupCanvas(cv,h=220){
  const dpr=window.devicePixelRatio||1, w=cv.clientWidth||cv.parentElement.clientWidth-36;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.height=h+"px";
  const ctx=cv.getContext("2d"); ctx.scale(dpr,dpr); ctx.clearRect(0,0,w,h);
  return [ctx,w,h];
}
function drawSalesChart(list, days){
  const cv=$("#salesChart"); const [ctx,W,H]=setupCanvas(cv);
  const map={}; list.forEach(s=>{ if(s.status!=="Cancelado") map[s.data]=(map[s.data]||0)+s.valor; });
  const labels=[...Array(days===0?30:Math.min(days,30)).keys()].map(i=>{const d=new Date();d.setDate(d.getDate()-((days===0?30:Math.min(days,30))-1-i));return d.toISOString().slice(0,10)});
  const vals=labels.map(l=>map[l]||0);
  const max=Math.max(...vals,1), padL=8, padB=22, padT=12;
  const cw=W-padL-8, ch=H-padT-padB;
  ctx.strokeStyle="rgba(255,255,255,.08)"; ctx.fillStyle=getComputedStyle(document.body).getPropertyValue("--muted")||"#999"; ctx.font="10px sans-serif";
  for(let g=0;g<=4;g++){const y=padT+ch-(ch*g/4);ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-8,y);ctx.stroke();ctx.fillText(BRL.format(max*g/4).replace(/\,00$/,""),padL+2,y-3);}
  const X=i=>padL+cw*(vals.length===1?.5:i/(vals.length-1));
  const Y=v=>padT+ch-(ch*v/max);
  if(chartType==="line"){
    const grad=ctx.createLinearGradient(0,padT,0,H);grad.addColorStop(0,"rgba(108,92,231,.45)");grad.addColorStop(1,"rgba(108,92,231,0)");
    ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v)));
    ctx.strokeStyle="#8e7bff";ctx.lineWidth=2.5;ctx.lineJoin="round";ctx.stroke();
    ctx.lineTo(X(vals.length-1),padT+ch);ctx.lineTo(X(0),padT+ch);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    vals.forEach((v,i)=>{ctx.beginPath();ctx.arc(X(i),Y(v),3,0,7);ctx.fillStyle="#8e7bff";ctx.fill();});
  }else{
    const bw=Math.max(4,cw/vals.length-6);
    vals.forEach((v,i)=>{const h=ch*v/max;const g=ctx.createLinearGradient(0,Y(v),0,padT+ch);g.addColorStop(0,"#8e7bff");g.addColorStop(1,"#00c9ff");ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(X(i)-bw/2,Y(v),bw,h,3);ctx.fill();});
  }
  ctx.fillStyle=getComputedStyle(document.documentElement).getAttribute("data-theme")==="light"?"#5b6285":"#9aa3c7";
  labels.forEach((l,i)=>{if(i%Math.ceil(labels.length/6)===0)ctx.fillText(l.slice(8)+"/"+l.slice(5,7),X(i)-10,H-6);});
}
function drawCatChart(list){
  const cv=$("#catChart"); const [ctx,W,H]=setupCanvas(cv);
  const cats={}; list.forEach(s=>{if(s.status!=="Cancelado")cats[s.categoria]=(cats[s.categoria]||0)+s.valor});
  const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((t,[,v])=>t+v,0)||1;
  const cx=W/2, cy=H/2-6, R=Math.min(W,H)/2-18;
  let a=-Math.PI/2;
  const isLight=document.documentElement.getAttribute("data-theme")==="light";
  entries.forEach(([k,v],i)=>{
    const a2=a+(v/total)*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,a,a2);ctx.closePath();
    ctx.fillStyle=COLORS[i%COLORS.length];ctx.fill();
    ctx.strokeStyle=isLight?"#fff":"#1c2140";ctx.lineWidth=3;ctx.stroke();
    a=a2;
  });
  ctx.fillStyle=isLight?"#171a30":"#fff";ctx.font="bold 15px sans-serif";ctx.textAlign="center";
  ctx.fillText(BRL.format(total).replace(/\,00$/,""),cx,cy+2);
  ctx.font="11px sans-serif";ctx.fillStyle=isLight?"#5b6285":"#9aa3c7";ctx.fillText("receita total",cx,cy+18);
  $("#catLegend").innerHTML=entries.map(([k,v],i)=>`<span><i class="dot" style="background:${COLORS[i%COLORS.length]}"></i> ${k} <b>${(v/total*100).toFixed(0)}%</b></span>`).join("");
}

// ---------- tables & lists ----------
function badge(s){return `<span class="badge ${s}">${s}</span>`}
function renderRecent(list){
  const rows=[...list].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,6);
  $("#recentCount").textContent=rows.length+" mais recentes de "+list.length;
  $("#recentTable tbody").innerHTML=rows.map(s=>`<tr><td><b>${s.id}</b><br><small class="muted">${s.data.split("-").reverse().join("/")}</small></td><td>${esc(s.cliente)}</td><td><b>${BRL.format(s.valor)}</b></td><td>${badge(s.status)}</td></tr>`).join("")||`<tr><td colspan="4" class="muted">Nenhum pedido no filtro.</td></tr>`;
}
function renderAll(){
  const list=filtered();
  $("#allCount").textContent=list.length+" pedidos • "+BRL.format(list.reduce((t,s)=>t+(s.status==="Cancelado"?0:s.valor),0));
  $("#allTable tbody").innerHTML=list.slice(0,120).map(s=>`<tr><td><b>${s.id}</b></td><td>${esc(s.cliente)}</td><td>${esc(s.produto)} <small class="muted">×${s.qtd}</small></td><td>${s.categoria}</td><td>${s.data.split("-").reverse().join("/")}</td><td><b>${BRL.format(s.valor)}</b></td><td>${badge(s.status)}</td><td><button class="del" data-del="${s.id}" title="Excluir">🗑</button></td></tr>`).join("")||`<tr><td colspan="8" class="muted">Nenhum pedido encontrado.</td></tr>`;
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    sales=sales.filter(x=>x.id!==b.dataset.del);saveSales(sales);render();toast("Pedido "+b.dataset.del+" excluído.");
  });
}
function renderTop(list){
  const byP={}; list.forEach(s=>{if(s.status==="Cancelado")return;byP[s.produto]=byP[s.produto]||{v:0,q:0,cat:s.categoria};byP[s.produto].v+=s.valor;byP[s.produto].q+=s.qtd;});
  const top=Object.entries(byP).sort((a,b)=>b[1].v-a[1].v).slice(0,5);
  const max=top[0]?.[1].v||1;
  $("#topProducts").innerHTML=top.map(([p,d])=>`<div class="tp"><div><b>${esc(p)}</b><br><small>${d.cat} • ${d.q} un.</small></div><b>${BRL.format(d.v)}</b><div class="tp-bar"><i style="width:${(d.v/max*100).toFixed(0)}%"></i></div></div>`).join("")||`<p class="muted">Sem dados.</p>`;
}
function renderProducts(){
  const byP={}; sales.forEach(s=>{byP[s.produto]=byP[s.produto]||{v:0,q:0,cat:s.categoria};byP[s.produto].v+=s.valor;byP[s.produto].q+=s.qtd;});
  $("#productGrid").innerHTML=Object.entries(byP).map(([p,d])=>`<div class="product"><strong>${esc(p)}</strong><small class="muted">${d.cat} • ${d.q} vendidos</small><div class="price">${BRL.format(d.v)}</div></div>`).join("");
  $("#productList").innerHTML=Object.keys(byP).map(p=>`<option value="${esc(p)}">`).join("");
}
function renderSummaries(){
  const byS={},byP={};
  sales.forEach(s=>{byS[s.status]=(byS[s.status]||0)+1;byP[s.pagamento]=(byP[s.pagamento]||0)+s.valor;});
  $("#statusSummary").innerHTML=Object.entries(byS).map(([k,v])=>`<div class="summary-row"><span>${badge(k)}</span><b>${v}</b></div>`).join("");
  $("#paySummary").innerHTML=Object.entries(byP).map(([k,v])=>`<div class="summary-row"><span>${k}</span><b>${BRL.format(v)}</b></div>`).join("");
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

// ---------- events ----------
function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,2600);}
function openModal(o=true){$("#modalBackdrop").hidden=!o;if(o)$("#saleDate").value=new Date().toISOString().slice(0,10);}
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $("#view-"+b.dataset.view).classList.add("active");$("#sidebar").classList.remove("open");render();
});
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>document.querySelector(`.nav-item[data-view="${b.dataset.goto}"]`).click());
["periodSelect","categorySelect","statusSelect"].forEach(id=>$("#"+id).addEventListener("change",render));
$("#searchInput").addEventListener("input",render);
$("#toggleChartType").onclick=(e)=>{chartType=chartType==="line"?"bar":"line";e.target.textContent=chartType==="line"?"ver como barras":"ver como linha";render();};
document.querySelectorAll("#allTable th[data-sort]").forEach(th=>th.onclick=()=>{
  const k=th.dataset.sort; if(sortKey===k)sortDir*=-1; else{sortKey=k;sortDir=1;} render();
});
$("#btnNovaVenda").onclick=()=>openModal(true);
$("#btnNovaVendaSide").onclick=()=>openModal(true);
$("#btnCloseModal").onclick=()=>openModal(false);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")openModal(false)});
$("#saleForm").addEventListener("submit",e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  const maxId=Math.max(...sales.map(s=>+s.id.replace(/\D/g,"")||1000),1000);
  const cat=f.get("categoria");
  sales.unshift({id:"PED-"+(maxId+1),cliente:f.get("cliente"),produto:f.get("produto"),categoria:cat,valor:+(+f.get("valor")*(+f.get("qtd")||1)).toFixed(2),qtd:+f.get("qtd")||1,pagamento:f.get("pagamento"),status:f.get("status"),data:f.get("data")||new Date().toISOString().slice(0,10)});
  saveSales(sales);e.target.reset();openModal(false);render();toast("Venda registrada com sucesso! 🎉");
});
$("#btnSaveGoal").onclick=()=>{goal=Math.max(1000,+$("#goalInput").value||120000);localStorage.setItem(GOAL_KEY,goal);render();toast("Meta atualizada para "+BRL.format(goal));};
$("#goalInput").value=goal;
$("#btnExport").onclick=()=>{
  const list=filtered();
  const csv=["id,cliente,produto,categoria,qtd,valor,pagamento,status,data",...list.map(s=>[s.id,'"'+s.cliente+'"','"'+s.produto+'"',s.categoria,s.qtd,s.valor,s.pagamento,s.status,s.data].join(","))].join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv"}));a.download="vendas.csv";a.click();toast(list.length+" pedidos exportados em CSV.");
};
$("#btnReset").onclick=()=>{if(confirm("Restaurar dados de demonstração?")){sales=seedSales();saveSales(sales);render();toast("Dados restaurados.");}};
$("#themeBtn").onclick=()=>{
  const h=document.documentElement;const light=h.getAttribute("data-theme")==="light";
  if(light){h.removeAttribute("data-theme");$("#themeBtn").textContent="🌙";}else{h.setAttribute("data-theme","light");$("#themeBtn").textContent="☀️";}
  render();
};
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
window.addEventListener("resize",()=>render());

render();
