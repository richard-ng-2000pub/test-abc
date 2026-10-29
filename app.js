/* MURDGRID v5 — secret URLs act as decryption keys; no password form. */
'use strict';
const $ = id => document.getElementById(id);
const state = {caseData:null,step:0,mode:'all',actorId:null,assetReady:new Set(),assetPending:new Set()};
const esc = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const encodeCoord = (c,r)=>{let n=c+1,s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s+(r+1);};
function parseCoord(str){const m=/^([A-Z]+)([1-9][0-9]*)$/.exec(String(str||'').toUpperCase());if(!m)return null;let c=0;for(const chr of m[1])c=c*26+chr.charCodeAt(0)-64;return {c:c-1,r:Number(m[2])-1};}
function assetURL(src){if(typeof src!=='string'||src.includes('..')||src.startsWith('/')||/^[a-z]+:/i.test(src))return null;return 'data/'+src.replace(/^data\//,'');}
function requestImage(path){if(!path||state.assetReady.has(path)||state.assetPending.has(path))return;state.assetPending.add(path);const im=new Image();im.onload=()=>{state.assetReady.add(path);render();};im.onerror=()=>{};im.src=path;}
function actor(id){return state.caseData.actors.find(x=>x.id===id);}
function caseDisplay(id){return id==='KG-EX'?'EXAMPLE':`PUZZLE ${Number(id.slice(3))}`;}
// A URL token is the only key. Never ship a token-to-case lookup table in public assets.
const tokenFromURL = new URLSearchParams(location.search).get('case') || '';
const encoder = new TextEncoder();
const decodeB64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
const normalizeToken = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const validToken = value => /^[A-Z0-9]{12}$/.test(normalizeToken(value)) && /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(value);
const asHex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
async function loadFromSecretURL(token) {
  const normalized = normalizeToken(token);
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode('MURDGRID-V5:' + normalized));
  const filename = asHex(digest);
  const response = await fetch(`data/locked/${filename}.enc.json`, { cache: 'no-store' });
  if (!response.ok) throw Error('This solution link is invalid or unavailable.');
  const encrypted = await response.json();
  if (encrypted.version !== 5 || encrypted.kdf !== 'PBKDF2-SHA256' || encrypted.cipher !== 'AES-256-GCM')
    throw Error('Unsupported solution format.');
  const password = await crypto.subtle.importKey('raw', encoder.encode(normalized), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({
    name: 'PBKDF2', salt: decodeB64(encrypted.salt), iterations: encrypted.iterations, hash: 'SHA-256'
  }, password, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  try {
    const plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: decodeB64(encrypted.nonce), additionalData: encoder.encode('MURDGRID-V5'), tagLength: 128
    }, key, decodeB64(encrypted.ciphertext));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch (_) {
    throw Error('This solution link is invalid or unavailable.');
  }
}
function displayError(title, message) {
  $('app').hidden = true;
  $('errorTitle').textContent = title;
  $('errorMessage').textContent = message;
  $('errorScreen').hidden = false;
}
function loadCase(d){
 const id=d?.case_id;
 if(id!=='KG-EX'&&!/^KG-(00[1-9]|0[1-9][0-9]|100)$/.test(id||''))throw Error('Invalid case data.');
 if(!d?.grid?.room_ids||!d?.frames?.length||!d?.actors?.length||!d?.answer||!d?.timing)throw Error('Missing map, timeline or answer data.');
 if(d.case_id!==id)throw Error('Case identifier mismatch.');
 if(d.grid.room_ids.length!==d.grid.rows||d.grid.room_ids.some(row=>row.length!==d.grid.columns))throw Error('Room map dimensions do not match.');
 state.caseData=d;state.step=0;state.mode='all';state.actorId=d.actors.find(a=>a.id===d.answer.murderer)?.id||d.actors[0].id;
 $('caseTitle').textContent=caseDisplay(id);
 $('killerName').textContent=actor(d.answer.murderer)?.name||d.answer.murderer;
 $('deathTime').textContent=d.answer.death_time||d.frames[d.answer.death_step]?.clock||'—';
 document.title=`${caseDisplay(id)} | MURDGRID`;
 $('stepRange').max=d.timing.steps;
 $('actorSelect').replaceChildren();
 for(const a of d.actors){const option=document.createElement('option');option.value=a.id;option.textContent=`${a.id} · ${a.name}`;$('actorSelect').append(option);}
 $('actorSelect').value=state.actorId;
 $('allMode').classList.add('active');$('trailMode').classList.remove('active');$('actorSelect').hidden=true;
 $('errorScreen').hidden=true;$('app').hidden=false;
 for(const a of d.actors)requestImage(assetURL(a.portrait));
 for(const o of d.objects||[])requestImage(assetURL(o.image));
 render();
}
async function init() {
  if (!validToken(tokenFromURL)) {
    displayError('INVALID LINK', 'This solution link is invalid or missing.');
    return;
  }
  if (!crypto?.subtle) {
    displayError('SECURE CONNECTION REQUIRED', 'Open this website through HTTPS.');
    return;
  }
  $('errorScreen').hidden = false;
  $('errorTitle').textContent = 'OPENING SOLUTION';
  $('errorMessage').textContent = 'Loading…';
  try {
    const data = await loadFromSecretURL(tokenFromURL);
    loadCase(data);
  } catch (error) {
    displayError('LINK UNAVAILABLE', error?.message || 'Unable to open this solution.');
  }
}
function updateStep(value){const d=state.caseData;if(!d)return;state.step=Math.max(0,Math.min(Number(d.timing.steps),Number(value)||0));render();}
function changeMode(mode){state.mode=mode;$('allMode').classList.toggle('active',mode==='all');$('trailMode').classList.toggle('active',mode==='trail');$('allMode').setAttribute('aria-pressed',String(mode==='all'));$('trailMode').setAttribute('aria-pressed',String(mode==='trail'));$('actorSelect').hidden=mode!=='trail';render();}
const between=(a,b)=>[a,b].sort().join('|');
function drawMap(d,frame){
 const unit=100,rows=d.grid.rows,cols=d.grid.columns,W=cols*unit,H=rows*unit;
 const defs='<defs><marker id="path-arrow" markerWidth="7" markerHeight="7" viewBox="0 0 7 7" refX="5" refY="3.5" orient="auto"><path d="M 0 0 L 7 3.5 L 0 7 z" fill="#bd7532"/></marker></defs>';
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Movement map, step ${state.step}" viewBox="-55 -61 ${W+64} ${H+69}" preserveAspectRatio="xMidYMid meet">`,defs];
 const colors=new Map((d.rooms||[]).map(room=>[room.id,room.color]));
 const center=cell=>{const x=parseCoord(cell);return x?{x:(x.c+.5)*unit,y:(x.r+.5)*unit}:null;};
 const roomIds=d.grid.room_ids;
 // Coordinate labels match the printed book: letters above columns and numbers left of rows.
 for(let c=0;c<cols;c++)parts.push(`<text x="${(c+.5)*unit}" y="-22" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="36" fill="#1b2938">${esc(encodeCoord(c,0).replace(/1$/, ''))}</text>`);
 for(let r=0;r<rows;r++)parts.push(`<text x="-33" y="${(r+.5)*unit+12}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="36" fill="#1b2938">${r+1}</text>`);
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
// The browser controls Developer Tools. This notice cannot disable them;
// case JSON remains encrypted until the correct URL token is supplied.
let warningTimer;
function warnShortcut(){const node=$('shortcutWarning');node.hidden=false;clearTimeout(warningTimer);warningTimer=setTimeout(()=>{node.hidden=true;},3200);}
document.addEventListener('keydown',e=>{
 const k=String(e.key).toLowerCase();
 if(k==='f12'||(e.ctrlKey&&e.shiftKey&&['i','j','c'].includes(k))||(e.metaKey&&e.altKey&&['i','j','c'].includes(k))||(e.ctrlKey&&k==='u')){e.preventDefault();e.stopPropagation();warnShortcut();return;}
 if(!state.caseData||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
 if(e.key==='ArrowLeft')updateStep(state.step-1);if(e.key==='ArrowRight')updateStep(state.step+1);
},true);
init();
