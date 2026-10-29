/* MURDGRID v3 — minimal, one-case, single-screen GitHub Pages solution viewer. */
'use strict';
const $ = id => document.getElementById(id);
const state = {caseData:null,step:0,mode:'all',actorId:null,assetReady:new Set(),assetPending:new Set()};
const esc = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const encodeCoord = (c,r)=>{let n=c+1,s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s+(r+1);};
function parseCoord(str){const m=/^([A-Z]+)([1-9][0-9]*)$/.exec(String(str||'').toUpperCase());if(!m)return null;let c=0;for(const chr of m[1])c=c*26+chr.charCodeAt(0)-64;return {c:c-1,r:Number(m[2])-1};}
function assetURL(src){if(typeof src!=='string'||src.includes('..')||src.startsWith('/')||/^[a-z]+:/i.test(src))return null;return 'data/'+src.replace(/^data\//,'');}
function requestImage(path){if(!path||state.assetReady.has(path)||state.assetPending.has(path))return;state.assetPending.add(path);const im=new Image();im.onload=()=>{state.assetReady.add(path);render();};im.onerror=()=>{};im.src=path;}
function actor(id){return state.caseData.actors.find(x=>x.id===id);}
function normalizedIndex(raw){return Array.isArray(raw)?raw:raw.cases||raw.puzzles||raw.entries||[];}
function caseFile(entry){const path=entry.file||entry.json||entry.path||entry.data_file||`${entry.id||entry.case_id}.json`;if(typeof path!=='string'||path.includes('..')||path.startsWith('/')||path.includes(':'))throw Error('Invalid data path');return 'data/'+path.replace(/^data\//,'');}
async function json(path){const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);return response.json();}
async function init(){try{
 const id=new URLSearchParams(location.search).get('case')||'KG-EX';
 if(!/^[\w-]+$/.test(id))throw Error('Invalid case URL');
 const entries=normalizedIndex(await json('data/index.json'));
 const entry=entries.find(e=>(e.id||e.case_id)===id);
 if(!entry)throw Error(`Case ${id} is not present in data/index.json`);
 const d=await json(caseFile(entry));
 if(!d?.grid?.room_ids||!d?.frames?.length||!d?.actors?.length||!d?.answer||!d?.timing)throw Error('Missing map, timeline or answer data');
 if(d.grid.room_ids.length!==d.grid.rows||d.grid.room_ids.some(row=>row.length!==d.grid.columns))throw Error('Room map dimensions do not match');
 state.caseData=d;state.actorId=d.actors.find(a=>a.id===d.answer.murderer)?.id||d.actors[0].id;
 $('caseTitle').textContent=d.title||'Case Solution';
 $('killerName').textContent=actor(d.answer.murderer)?.name||d.answer.murderer;
 $('deathTime').textContent=d.answer.death_time||d.frames[d.answer.death_step]?.clock||'—';
 document.title=`${d.title||id} | MURDGRID`;
 $('stepRange').max=d.timing.steps;
 $('actorSelect').replaceChildren();
 for(const a of d.actors){const option=document.createElement('option');option.value=a.id;option.textContent=`${a.id} · ${a.name}`;$('actorSelect').append(option);}
 $('actorSelect').value=state.actorId;
 for(const a of d.actors)requestImage(assetURL(a.portrait));
 for(const o of d.objects||[])requestImage(assetURL(o.image));
 render();
}catch(e){console.error(e);$('fatalText').textContent=e.message||'Unable to load this case.';$('fatal').hidden=false;}}
function updateStep(value){const d=state.caseData;if(!d)return;state.step=Math.max(0,Math.min(Number(d.timing.steps),Number(value)||0));render();}
function changeMode(mode){state.mode=mode;$('allMode').classList.toggle('active',mode==='all');$('trailMode').classList.toggle('active',mode==='trail');$('allMode').setAttribute('aria-pressed',String(mode==='all'));$('trailMode').setAttribute('aria-pressed',String(mode==='trail'));$('actorSelect').hidden=mode!=='trail';render();}
const between=(a,b)=>[a,b].sort().join('|');
function drawMap(d,frame){
 const unit=100,rows=d.grid.rows,cols=d.grid.columns,W=cols*unit,H=rows*unit;
 const defs='<defs><marker id="path-arrow" markerWidth="7" markerHeight="7" viewBox="0 0 7 7" refX="5" refY="3.5" orient="auto"><path d="M 0 0 L 7 3.5 L 0 7 z" fill="#bd7532"/></marker></defs>';
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Movement map, step ${state.step}" viewBox="-3 -3 ${W+6} ${H+6}" preserveAspectRatio="xMidYMid meet">`,defs];
 const colors=new Map((d.rooms||[]).map(room=>[room.id,room.color]));
 const center=cell=>{const x=parseCoord(cell);return x?{x:(x.c+.5)*unit,y:(x.r+.5)*unit}:null;};
 const roomIds=d.grid.room_ids;
 // The room colours and all walls are derived only from the original JSON geometry.
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  parts.push(`<rect x="${c*unit}" y="${r*unit}" width="${unit}" height="${unit}" fill="${esc(colors.get(roomIds[r][c])||'#e7e9e6')}"/>`);
 }
 for(let r=0;r<=rows;r++)parts.push(`<line x1="0" y1="${r*unit}" x2="${W}" y2="${r*unit}" stroke="#939c9a" stroke-width=".85"/>`);
 for(let c=0;c<=cols;c++)parts.push(`<line x1="${c*unit}" y1="0" x2="${c*unit}" y2="${H}" stroke="#939c9a" stroke-width=".85"/>`);
 // Real artwork when available; a plain muted tile is the no-asset fallback.
 for(const obj of d.objects||[]){const cells=(obj.cells||[]).map(parseCoord).filter(Boolean);if(!cells.length)continue;
  const c0=Math.min(...cells.map(x=>x.c)),r0=Math.min(...cells.map(x=>x.r)),c1=Math.max(...cells.map(x=>x.c)),r1=Math.max(...cells.map(x=>x.r));
  const x=c0*unit+2,y=r0*unit+2,w=(c1-c0+1)*unit-4,h=(r1-r0+1)*unit-4;
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#d1cec6"/>`);
  const img=assetURL(obj.image);if(img&&state.assetReady.has(img))parts.push(`<image href="${esc(img)}" x="${x+1}" y="${y+1}" width="${w-2}" height="${h-2}" preserveAspectRatio="xMidYMid meet"/>`);
 }
 // Wall endings make doorways clear. No letter/number annotations, no diagonal door symbols.
 const doorPairs=new Set((d.grid.doors||[]).filter(p=>p?.length>=2).map(p=>between(p[0],p[1])));
 const exterior=d.grid.outer_door;
 const outer=(r,c,side)=>Array.isArray(exterior)&&Number(exterior[0])===r&&Number(exterior[1])===c&&String(exterior[2]).toUpperCase()===side;
 const line=(x1,y1,x2,y2)=>parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#343935" stroke-width="5" stroke-linecap="butt"/>`);
 function wall(x1,y1,x2,y2,isDoor){if(!isDoor){line(x1,y1,x2,y2);return;}
  const vx=x2-x1,vy=y2-y1;
  const a=.225,b=.775;
  line(x1,y1,x1+vx*a,y1+vy*a);
  line(x1+vx*b,y1+vy*b,x2,y2);
  const half=6;
  for(const t of [a,b]){const x=x1+vx*t,y=y1+vy*t;if(Math.abs(vx)<1)line(x-half,y,x+half,y);else line(x,y-half,x,y+half);}
 }
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const x=c*unit,y=r*unit;
  const here=encodeCoord(c,r);
  if(c===0)wall(x,y,x,y+unit,outer(r,c,'L'));
  if(r===0)wall(x,y,x+unit,y,outer(r,c,'T'));
  if(c===cols-1)wall(x+unit,y,x+unit,y+unit,outer(r,c,'R'));
  else if(roomIds[r][c]!==roomIds[r][c+1])wall(x+unit,y,x+unit,y+unit,doorPairs.has(between(here,encodeCoord(c+1,r))));
  if(r===rows-1)wall(x,y+unit,x+unit,y+unit,outer(r,c,'B'));
  else if(roomIds[r][c]!==roomIds[r+1][c])wall(x,y+unit,x+unit,y+unit,doorPairs.has(between(here,encodeCoord(c,r+1))));
 }
 if(state.mode==='trail'){
  const person=actor(state.actorId);
  if(person){const route=[];for(const cell of person.path||[]){if(route.at(-1)!==cell)route.push(cell);}
   const coords=route.map(center).filter(Boolean);
   if(coords.length>1){
    const path=coords.map(p=>`${p.x},${p.y}`).join(' ');
    parts.push(`<polyline points="${path}" fill="none" stroke="#fffaf1" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>`);
    parts.push(`<polyline points="${path}" fill="none" stroke="#be7838" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".86"/>`);
    for(let i=1;i<coords.length;i++){const p=coords[i-1],q=coords[i],dx=q.x-p.x,dy=q.y-p.y;
     const midX=p.x+dx*.53,midY=p.y+dy*.53,n=Math.hypot(dx,dy);if(n<1)continue;
     const ux=dx/n,uy=dy/n,leftX=midX-ux*8-uy*6,leftY=midY-uy*8+ux*6,rightX=midX-ux*8+uy*6,rightY=midY-uy*8-ux*6;
     parts.push(`<path d="M${leftX},${leftY} L${midX+ux*4},${midY+uy*4} L${rightX},${rightY}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    const p=coords[0],q=coords.at(-1);
    parts.push(`<circle cx="${p.x}" cy="${p.y}" r="9" fill="#398f75" stroke="#fff" stroke-width="3"/><circle cx="${q.x}" cy="${q.y}" r="9" fill="#c4883f" stroke="#fff" stroke-width="3"/>`);
   }
  }
 }
 // If multiple people share one cell, preserve visibility of each (particularly the crime step).
 const positions=new Map();
 for(const person of (state.mode==='all'?d.actors:[actor(state.actorId)].filter(Boolean))){
  const loc=frame.positions?.[person.id]||person.path?.[state.step];if(!loc)continue;
  if(!positions.has(loc))positions.set(loc,[]);positions.get(loc).push(person);
 }
 function drawPerson(person,x,y,size){
  const img=assetURL(person.portrait),half=size/2;
  if(img&&state.assetReady.has(img)){
   // Preserve the book's flat original head-and-shoulder artwork.
   parts.push(`<image href="${esc(img)}" x="${x-half}" y="${y-half}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`);
  }else{
   parts.push(`<circle cx="${x}" cy="${y}" r="${size*.4}" fill="#28495a" stroke="#fff" stroke-width="3"/>`);
   parts.push(`<text x="${x}" y="${y+size*.12}" font-size="${size*.42}" font-weight="800" fill="#fff" text-anchor="middle">${esc(person.id)}</text>`);
  }
 }
 for(const [cell,people] of positions){const p=center(cell);if(!p)continue;
  if(people.length===1)drawPerson(people[0],p.x,p.y,unit*.94);
  else people.forEach((person,i)=>{const n=people.length,cols=Math.ceil(Math.sqrt(n)),rr=Math.ceil(n/cols),ix=i%cols,iy=Math.floor(i/cols);
    const size=Math.min(unit*.86/cols,unit*.86/rr);
    const x=p.x+(ix-(cols-1)/2)*(size+1),y=p.y+(iy-(rr-1)/2)*(size+1);
    drawPerson(person,x,y,size);
  });
 }
 // IMPORTANT: The dashed crime ring must NEVER appear before the death step.
 if(state.step>=Number(d.answer.death_step)){
  const p=center(d.answer.scene);
  if(p)parts.push(`<circle cx="${p.x}" cy="${p.y}" r="45.5" fill="none" stroke="#b82f3f" stroke-width="5" stroke-dasharray="10 8" stroke-linecap="round"/>`);
 }
 parts.push('</svg>');return parts.join('');
}
function render(){const d=state.caseData;if(!d)return;const frame=d.frames[state.step];if(!frame)return;
 $('stepRange').value=String(state.step);$('clockLabel').textContent=frame.clock||'';
 $('stepIndicator').textContent=`${state.step} / ${d.timing.steps}`;
 $('prevStep').disabled=state.step<=0;$('nextStep').disabled=state.step>=d.timing.steps;
 $('mapArt').innerHTML=drawMap(d,frame);
}
$('allMode').addEventListener('click',()=>changeMode('all'));
$('trailMode').addEventListener('click',()=>changeMode('trail'));
$('actorSelect').addEventListener('change',e=>{state.actorId=e.target.value;render();});
$('stepRange').addEventListener('input',e=>updateStep(e.target.value));
$('prevStep').addEventListener('click',()=>updateStep(state.step-1));
$('nextStep').addEventListener('click',()=>updateStep(state.step+1));
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(e.key==='ArrowLeft')updateStep(state.step-1);if(e.key==='ArrowRight')updateStep(state.step+1);});
init();
