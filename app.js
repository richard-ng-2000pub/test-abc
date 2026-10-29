/* MURDGRID Volume 1 — static Github Pages viewer. No build tools required. */
'use strict';

const DATA_ROOT = './data/';
let zoomFactor=1;
const LEVELS = ['EXAMPLE / TUTORIAL', 'OPENING MOVES', 'CROSSING PATHS', 'FALSE LEADS', 'NARROW WINDOWS', 'THE PERFECT ALIBI'];
const COLORS = ['#4276a4','#cc7751','#7b6cb3','#45917d','#a96c9a','#9f8740','#c66c69','#3f8d9b','#8d9259','#736d9c','#db9055','#608887','#a35d74','#567bb1','#af7e4d','#6c9968','#926db1','#c26881'];
const state = {manifest:[],record:null,meta:null,caseId:'',activeTab:'investigate',notes:{},tool:'dot',selectedCell:null,unlocked:false,answerShown:false,step:0,actorFilter:'all',trails:true,labels:true,playing:false,timer:null,requestSerial:0,assetPrefix:DATA_ROOT};
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
const letters = n => { let s=''; for(let i=n+1;i>0;i=Math.floor((i-1)/26)){s=String.fromCharCode(65+(i-1)%26)+s;} return s; };
const coord = (str) => {const m=/^([A-Z]+)(\d+)$/i.exec(String(str||'')); if(!m)return null;let c=0;for(const ch of m[1].toUpperCase())c=c*26+ch.charCodeAt(0)-64;return {c:c-1,r:Number(m[2])-1};};
const pairKey=(a,b)=>[a,b].sort().join('~');
const dataPath = p => {const s=String(p||'').replaceAll('\\','/').replace(/^\.\//,''); if(!s||s.startsWith('/')||s.includes('..')||/^[a-z]+:/i.test(s))throw Error('Unsupported file path in data index: '+s);return DATA_ROOT+s.split('/').map(encodeURIComponent).join('/');};
const assetPath = p => {if(!p) return '';try{return dataPath(p);}catch{return '';}};
const shortId = id => id==='KG-EX'?'EX':String(id||'').match(/(\d+)$/)?.[1] || String(id||'').slice(-3);
const actorName = id => state.record?.actors?.find(a=>a.id===id)?.name || id;
function alertError(message){$('errorBanner').textContent=message;$('errorBanner').hidden=false;}
function clearError(){$('errorBanner').hidden=true;}

function indexEntries(raw){
 let rows = Array.isArray(raw)?raw:(raw?.cases||raw?.puzzles||raw?.entries||raw?.items||raw?.files||[]);
 if(!Array.isArray(rows) && rows && typeof rows==='object')rows=Object.entries(rows).map(([key,val])=>typeof val==='object'?{id:key,...val}:{id:key,file:val});
 if(!Array.isArray(rows))return [];
 return rows.map((item,i)=>{
  if(typeof item==='string'){const id=item.split('/').pop().replace(/\.json$/i,'');return {id,title:id,level:id==='KG-EX'?0:1,level_name:'',file:item};}
  if(!item||typeof item!=='object')return null;
  const id=String(item.id || item.case_id || item.case || item.code || item.number || `Case ${i+1}`);
  const file=item.file || item.json || item.path || item.json_path || item.data_file || item.filename || item.case_file || `${id}.json`;
  return {id,title:item.title || item.name || id,level:Number(item.level ?? item.difficulty_level ?? (id==='KG-EX'?0:1)),level_name:item.level_name || '',file,steps:item.steps,actors:item.actors,rooms:item.rooms};
 }).filter(x=>x?.id && x.file && !String(x.file).includes('certificates/'));
}

async function loadIndex(){
 try{const r=await fetch(dataPath('index.json'),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const raw=await r.json();state.manifest=indexEntries(raw);if(!state.manifest.length)throw Error('The index has no compatible case entries.');}
 catch(e){state.manifest=[{id:'KG-EX',title:'The Last Toast',level:0,level_name:'EXAMPLE / TUTORIAL',file:'KG-EX.json'}];alertError('Could not load a full index.json ('+e.message+'). Trying the built-in worked example.');}
 renderArchive();
 const params=new URLSearchParams(location.search);const wanted=params.get('case') || (location.hash.match(/case=([^&]+)/)?.[1]||'');
 const normalized=state.manifest.find(m=>m.id.toLowerCase()===String(wanted).toLowerCase() || (String(wanted).match(/^\d+$/)&&Number(shortId(m.id))===Number(wanted)));
 await loadCase(normalized?.id || state.manifest[0]?.id,false);
}

function renderArchive(){
 const query=$('caseSearch').value.trim().toLowerCase(),level=$('levelFilter').value;
 const filtered=state.manifest.filter(m=>(level==='all'||String(m.level)===level) && (!query || [m.id,m.title,m.level_name].some(s=>String(s||'').toLowerCase().includes(query))));
 $('archiveSummary').textContent=`${filtered.length} CASE FILE${filtered.length===1?'':'S'} · ${state.manifest.length} LOADED`;
 $('caseList').innerHTML=filtered.map(m=>`<button type="button" class="case-entry ${state.caseId===m.id?'active':''}" data-case="${esc(m.id)}" title="${esc(m.title)}"><span class="case-id">${esc(shortId(m.id))}</span><span class="case-text"><strong>${esc(m.title)}</strong><small>${m.level===0?'Worked example':`Level ${Number(m.level)||1} · ${esc(m.id)}`}</small></span></button>`).join('') || '<p class="side-empty">No matching cases.</p>';
}
async function loadCase(id,push=true){
 const m=state.manifest.find(c=>c.id===id);if(!m)return;
 const serial=++state.requestSerial;stopPlayback();clearError();
 try{
  const url=dataPath(m.file),r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status} — ${url}`);
  const d=await r.json();validateBasic(d);
  if(serial!==state.requestSerial)return;
  state.record=d;state.meta=m;state.caseId=m.id;state.notes=readNotes(m.id);state.selectedCell=null;state.tool='dot';state.unlocked=false;state.answerShown=false;state.step=0;state.actorFilter='all';state.trails=true;state.labels=true;
  $('stepSlider').value=0;$('actorFilter').value='all';$('showTrails').checked=true;$('showLabels').checked=true;
  $('accusationResult').innerHTML='';$('hintBox').hidden=true;$('hintBtn').textContent='Show optional forensic clue';$('answerPanel').hidden=true;
  if(push)history.pushState({case:id},'',makeCaseLink(id));
  renderArchive();renderRecord();setTab('investigate');
  $('reconstructionGate').hidden=false;$('reconstructionContent').hidden=true;
  if(push){window.scrollTo({top:0,behavior:'smooth'});}
 }catch(e){if(serial===state.requestSerial){alertError(`Unable to open ${m.id}: ${e.message}. Check file paths in data/index.json and your GitHub repository.`);}}
}
function validateBasic(d){
 if(!d||!d.grid||!Array.isArray(d.grid.room_ids)||!Array.isArray(d.actors)||!Array.isArray(d.frames)||!d.timing)throw Error('This JSON does not match the MURDGRID case schema.');
 if(d.grid.room_ids.length!==d.grid.rows)throw Error('Grid row count does not match room_ids.');
 if(!d.frames.length)throw Error('Case has no animation frames.');
}
function makeCaseLink(id){const u=new URL(location.href);u.searchParams.set('case',id);u.hash='';return u.pathname+u.search;}
function readNotes(id){try{return JSON.parse(localStorage.getItem(`murdgrid-v1-notes-${id}`)||'{}')||{};}catch{return {};}}
function saveNotes(){try{localStorage.setItem(`murdgrid-v1-notes-${state.caseId}`,JSON.stringify(state.notes));}catch{/* private browsing */}}

function renderRecord(){
 const d=state.record,level=Number(d.level??state.meta.level),steps=Number(d.timing.steps||d.frames.length-1);
 $('caseNumber').textContent=level===0?'CASE FILE / WORKED EXAMPLE':`CASE FILE / ${d.case_id}`;
 $('caseDifficulty').textContent=LEVELS[level]||d.level_name||'LOGIC MYSTERY';
 $('caseTitle').textContent=d.title||d.case_id;
 $('caseSummary').textContent=level===0?'A guided mystery in motion — discover what happened during the blackout.':'All the evidence is on the floor plan. Reconstruct the missing minutes.';
 $('caseVerified').textContent=d.validation?.full_timeline_valid?'◆ Logic verified':'◈ Interactive case';
 $('caseStats').innerHTML=[['MAP',`${d.grid.columns} × ${d.grid.rows}`],['ROOMS',d.rooms.length],['CHARACTERS',d.actors.length],['TIME STEPS',steps],['BLACKOUT',`${steps*Number(d.timing.minutes_per_step||1)} min`]].map(([k,v])=>`<div class="hero-stat"><div class="stat-val">${esc(v)}</div><div class="stat-label">${esc(k)}</div></div>`).join('');
 $('beforeClock').textContent=d.timing.start||d.frames[0]?.clock||'—';
 $('afterClock').textContent=d.timing.end||d.frames.at(-1)?.clock||'—';
 $('beforeMap').innerHTML=mapSVG('before');$('afterMap').innerHTML=mapSVG('after');
 renderWorking();renderCast();
 $('suspectSelect').innerHTML='<option value="">Select a suspect</option>'+d.actors.filter(a=>a.id!==d.answer?.victim).map(a=>`<option value="${esc(a.id)}">${esc(a.id)} — ${esc(a.name)}</option>`).join('');
 $('deathStepSelect').innerHTML='<option value="">Select a step</option>'+Array.from({length:steps},(_,i)=>`<option value="${i+1}">Step ${i+1} · +${(i+1)*(d.timing.minutes_per_step||1)} min</option>`).join('');
 $('actorFilter').innerHTML='<option value="all">All characters</option>'+d.actors.map(a=>`<option value="${esc(a.id)}">${esc(a.id)} — ${esc(a.name)}</option>`).join('');
 $('stepSlider').max=steps;
 $('footerStatus').textContent=state.manifest.length===1?'Demo mode · Only the worked example was uploaded':`${state.manifest.length} case files indexed · ${state.caseId}`;
 renderTimeline();
}
function renderCast(){const d=state.record;const all=d.actors.map((a,i)=>`<div class="cast-person"><div class="cast-avatar" style="background:${COLORS[i%COLORS.length]}22;color:${COLORS[i%COLORS.length]}">${esc(a.id)}${a.portrait?`<img src="${esc(assetPath(a.portrait))}" alt="" loading="lazy" onerror="this.remove()">`:''}</div><span><b title="${esc(a.name)}">${esc(a.name)}</b><small class="${a.id===d.answer?.victim?'victim-tag':''}">${a.id===d.answer?.victim?'Victim · '+esc(a.id):'Character '+esc(a.id)}</small></span></div>`).join('');$('castList').innerHTML=all;}
function renderWorking(){$('workingMap').innerHTML=mapSVG('working');if(!state.selectedCell){$('cellDetails').textContent='Select a square to inspect it.';}else{showCellInfo(state.selectedCell);}}
function showCellInfo(cell){const d=state.record,pos=coord(cell);if(!pos)return;const id=d.grid.room_ids[pos.r]?.[pos.c];const room=d.rooms.find(r=>r.id===id);const obstacle=d.objects?.find(o=>o.cells.includes(cell));$('cellDetails').textContent=`${cell} · ${room?.name||'Unknown room'}${obstacle?' · BLOCKED: '+obstacle.name:' · Walkable square'}`;}

function mapSVG(mode){
 const d=state.record;if(!d)return '';
 const CELL=54,LEFT=36,TOP=36,rows=Number(d.grid.rows),cols=Number(d.grid.columns),w=LEFT+cols*CELL+10,h=TOP+rows*CELL+11;
 const isTimeline=mode==='timeline',isWorking=mode==='working';const frame=isTimeline?d.frames.find(x=>x.step===state.step)||d.frames[clamp(state.step,0,d.frames.length-1)]:null;
 const positions=mode==='before'?Object.fromEntries(d.actors.map(a=>[a.id,a.start])):mode==='after'?Object.fromEntries(d.actors.map(a=>[a.id,a.end])):frame?.positions||{};
 const doorSet=new Set((d.grid.doors||[]).filter(x=>x?.length===2).map(x=>pairKey(x[0],x[1])));
 const getName=(r,c)=>`${letters(c)}${r+1}`;
 const roomColors=new Map((d.rooms||[]).map(x=>[x.id,x.color]));
 const blocked=new Set((d.objects||[]).flatMap(x=>x.cells||[]));
 const wall=(x1,y1,x2,y2,thick=3.8,color='#28394a')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${thick}" stroke-linecap="square"/>`;
 let floor='',walls='',items='',trails='',actors='',labels='',marks='',interactions='';
 for(let c=0;c<cols;c++)labels+=`<text x="${LEFT+(c+.5)*CELL}" y="${TOP-15}" text-anchor="middle" fill="#647484" font-size="14" font-weight="800">${letters(c)}</text>`;
 for(let r=0;r<rows;r++){
  labels+=`<text x="${LEFT-17}" y="${TOP+(r+.57)*CELL}" text-anchor="middle" fill="#647484" font-size="14" font-weight="800">${r+1}</text>`;
  for(let c=0;c<cols;c++){
   const x=LEFT+c*CELL,y=TOP+r*CELL,co=getName(r,c),id=d.grid.room_ids[r]?.[c],room=d.rooms.find(q=>q.id===id);
   const color=roomColors.get(id)||'#f2f1e9';
   floor+=`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${esc(color)}" stroke="#ffffff" stroke-opacity=".75" stroke-width=".9"><title>${esc(co)} · ${esc(room?.name||'Room')}</title></rect>`;
   if(c+1<cols && id!==d.grid.room_ids[r][c+1]){
    const edgeX=x+CELL,edgeY=y,hasDoor=doorSet.has(pairKey(co,getName(r,c+1)));
    if(hasDoor){walls+=wall(edgeX,edgeY,edgeX,edgeY+CELL*.24)+wall(edgeX,edgeY+CELL*.76,edgeX,edgeY+CELL)+`<circle cx="${edgeX}" cy="${edgeY+CELL*.26}" r="2.4" fill="#bd9251"/><circle cx="${edgeX}" cy="${edgeY+CELL*.74}" r="2.4" fill="#bd9251"/>`;} else{walls+=wall(edgeX,edgeY,edgeX,edgeY+CELL);}
   }
   if(r+1<rows && id!==d.grid.room_ids[r+1][c]){
    const edgeY=y+CELL,hasDoor=doorSet.has(pairKey(co,getName(r+1,c)));
    if(hasDoor){walls+=wall(x,edgeY,x+CELL*.24,edgeY)+wall(x+CELL*.76,edgeY,x+CELL,edgeY)+`<circle cx="${x+CELL*.26}" cy="${edgeY}" r="2.4" fill="#bd9251"/><circle cx="${x+CELL*.74}" cy="${edgeY}" r="2.4" fill="#bd9251"/>`;}else{walls+=wall(x,edgeY,x+CELL,edgeY);}
   }
   if(isWorking){
    const mark=state.notes[co];if(mark){const middle=LEFT+(c+.5)*CELL,yMiddle=TOP+(r+.55)*CELL;const display=mark==='dot'?'●':mark==='cross'?'×':'?';const paint=mark==='dot'?'#386c85':mark==='cross'?'#ae5b5a':'#996f2e';marks+=`<text x="${middle}" y="${yMiddle}" text-anchor="middle" dominant-baseline="middle" font-weight="900" font-size="31" fill="${paint}" fill-opacity=".82">${display}</text>`;}
    if(state.selectedCell===co)marks+=`<rect x="${x+3}" y="${y+3}" width="${CELL-6}" height="${CELL-6}" fill="none" stroke="#3b6eaa" stroke-width="2.2" stroke-dasharray="4 3" rx="4"/>`;
    interactions+=`<rect x="${x+1}" y="${y+1}" width="${CELL-2}" height="${CELL-2}" fill="#fff" fill-opacity=".001" data-cell="${co}"><title>${esc(co)} · ${esc(room?.name||'Room')}${blocked.has(co)?' · OBSTACLE':''}</title></rect>`;
   }
  }
 }
 // All outside borders stay closed. The external architectural door is decorative and cannot be used as an exit.
 walls+=`<rect x="${LEFT}" y="${TOP}" width="${cols*CELL}" height="${rows*CELL}" fill="none" stroke="#28394a" stroke-width="4.6"/>`;
 if(Array.isArray(d.grid.outer_door)){const [rr,cc,side]=d.grid.outer_door;const xx=LEFT+cc*CELL,yy=TOP+rr*CELL;
  const sides={T:[xx+CELL*.35,yy,xx+CELL*.65,yy],B:[xx+CELL*.35,yy+CELL,xx+CELL*.65,yy+CELL],L:[xx,yy+CELL*.35,xx,yy+CELL*.65],R:[xx+CELL,yy+CELL*.35,xx+CELL,yy+CELL*.65]};
  const a=sides[String(side).toUpperCase()];if(a)walls+=`<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="#c69a51" stroke-width="4" stroke-dasharray="3 3"><title>External door: not a valid exit</title></line>`;
 }
 // Furniture uses exact X1/X2 occupancy from object.cells, not guessed positions.
 for(const ob of (d.objects||[])){
  const coords=(ob.cells||[]).map(coord).filter(Boolean);if(!coords.length)continue;
  const minC=Math.min(...coords.map(o=>o.c)),maxC=Math.max(...coords.map(o=>o.c)),minR=Math.min(...coords.map(o=>o.r)),maxR=Math.max(...coords.map(o=>o.r));
  const x=LEFT+minC*CELL+5,y=TOP+minR*CELL+5,bw=(maxC-minC+1)*CELL-10,bh=(maxR-minR+1)*CELL-10;
  const short=(ob.name||ob.kind||'Prop').split(' ').slice(-2).join(' ');
  items+=`<g><rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="8" fill="#9f8570" fill-opacity=".32" stroke="#857260" stroke-opacity=".8" stroke-width="1.5" stroke-dasharray="3 2"/><path d="M${x+9} ${y+9}L${x+bw-9} ${y+bh-9}M${x+bw-9} ${y+9}L${x+9} ${y+bh-9}" stroke="#8d7c6b" stroke-width="2" opacity=".35"/><text x="${x+bw/2}" y="${y+bh/2+2}" font-size="9" text-anchor="middle" fill="#5f5046" font-weight="800" paint-order="stroke" stroke="#f3eadb" stroke-width="2">${esc(short.length>20?ob.kind:short)}</text>${ob.image?`<image href="${esc(assetPath(ob.image))}" x="${x}" y="${y}" width="${bw}" height="${bh}" preserveAspectRatio="xMidYMid meet"/>`:''}<title>${esc(ob.name)} (${esc(ob.kind)}), ${esc((ob.cells||[]).join(', '))}</title></g>`;
 }
 const showScene=mode==='after'||(isTimeline && frame?.victim_deceased)||isWorking;
 if(showScene && d.answer?.scene){const sc=coord(d.answer.scene);if(sc){const cx=LEFT+(sc.c+.5)*CELL,cy=TOP+(sc.r+.5)*CELL;items+=`<circle cx="${cx}" cy="${cy}" r="${CELL*.36}" fill="#d8615a" fill-opacity=".2" stroke="#b44842" stroke-width="2.2" stroke-dasharray="3 3"><title>Crime scene — ${esc(d.answer.scene)}</title></circle>`;}}
 if(isTimeline&&state.trails){
  d.actors.filter(a=>state.actorFilter==='all'||a.id===state.actorFilter).forEach(a=>{
   const idx=d.actors.indexOf(a),coords=(a.path||[]).slice(0,state.step+1).map(coord).filter(Boolean);
   if(coords.length<=1)return;
   const pts=coords.map(p=>`${LEFT+(p.c+.5)*CELL},${TOP+(p.r+.5)*CELL}`).join(' ');
   trails+=`<polyline points="${pts}" fill="none" stroke="${COLORS[idx%COLORS.length]}" stroke-width="${state.actorFilter==='all'?3.5:5.5}" stroke-opacity="${state.actorFilter==='all'?.63:.92}" stroke-linejoin="round" stroke-linecap="round"/>`;
   coords.forEach((p,i)=>{if(i>0)trails+=`<circle cx="${LEFT+(p.c+.5)*CELL}" cy="${TOP+(p.r+.5)*CELL}" r="2.6" fill="${COLORS[idx%COLORS.length]}"/>`;});
  });
 }
 if(!isWorking){
  const groups=new Map();
  for(const a of d.actors){const pos=positions[a.id];if(!pos)continue;const p=coord(pos);if(!p)continue;const key=`${p.r},${p.c}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
  for(const [key,occupants] of groups){
   const [r,c]=key.split(',').map(Number),cx=LEFT+(c+.5)*CELL,cy=TOP+(r+.5)*CELL;
   // If multiple people occupy a crime cell, show multiple small distinct avatars.
   for(let i=0;i<occupants.length;i++){
    const a=occupants[i],index=d.actors.indexOf(a),dim=occupants.length===1?CELL*.79:CELL*.51;
    const xp=cx+(occupants.length===1?0:(i-(occupants.length-1)/2)*CELL*.46),yp=cy;
    const selected=isTimeline&&state.actorFilter!=='all'&&state.actorFilter!==a.id;
    const alpha=selected?.19:1;
    const dead=(mode==='after'||(isTimeline&&frame?.victim_deceased))&&a.id===d.answer?.victim;
    const x=xp-dim/2,y=yp-dim/2,fill=COLORS[index%COLORS.length];
    actors+=`<g opacity="${alpha}"><rect x="${x}" y="${y}" width="${dim}" height="${dim}" rx="${dim*.26}" fill="#ffffff" stroke="${dead?'#be4b45':fill}" stroke-width="${dead?3.6:2.5}"/>`;
    actors+=`<text x="${xp}" y="${yp+4}" text-anchor="middle" font-size="${occupants.length===1?20:14}" font-weight="900" fill="${fill}">${esc(a.id)}</text>`;
    if(a.portrait)actors+=`<image href="${esc(assetPath(a.portrait))}" x="${x+2}" y="${y+2}" width="${dim-4}" height="${dim-4}" preserveAspectRatio="xMidYMid meet"/>`;
    if(!isTimeline||state.labels){actors+=`<rect x="${x-3}" y="${y-6}" width="18" height="16" rx="5" fill="${fill}" stroke="#fff" stroke-width="1.4"/><text x="${x+6}" y="${y+5.5}" text-anchor="middle" font-size="11" font-weight="900" fill="#fff">${esc(a.id)}</text>`;}
    if(dead)actors+=`<circle cx="${x+dim-2}" cy="${y+dim-3}" r="9" fill="#c65350" stroke="#fff" stroke-width="2"/><path d="M${x+dim-5.5} ${y+dim-6.5}l7 7m0 -7l-7 7" stroke="white" stroke-width="2"/>`;
    actors+=`<title>${esc(a.id)} · ${esc(a.name)} · ${esc(getName(r,c))}${dead?' · VICTIM':''}</title></g>`;
   }
  }
 }
 const title=mode==='before'?'Before blackout':mode==='after'?'After blackout':mode==='working'?'Working grid':`Timeline at step ${state.step}`;
 return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}: ${cols} columns by ${rows} rows, ${d.rooms.length} rooms"><title>${esc(title)} — ${esc(d.title)}</title>${floor}${items}${walls}${trails}${marks}${actors}${labels}${interactions}</svg>`;
}

function setTab(tab){state.activeTab=tab;const investigate=tab==='investigate';$('investigationView').hidden=!investigate;$('reconstructionView').hidden=investigate;$('investigateTab').classList.toggle('active',investigate);$('reconstructTab').classList.toggle('active',!investigate);$('investigateTab').setAttribute('aria-selected',String(investigate));$('reconstructTab').setAttribute('aria-selected',String(!investigate));if(investigate)stopPlayback();}
function checkAccusation(){const d=state.record,id=$('suspectSelect').value,step=Number($('deathStepSelect').value);if(!id||!step){$('accusationResult').innerHTML='<div class="result-bad">Select both a character and a step to check your deduction.</div>';return;}
 const correct=id===d.answer?.murderer && step===d.answer?.death_step;
 $('accusationResult').innerHTML=correct?`<div class="result-good"><strong>Case solved.</strong> ${esc(actorName(id))} at step ${step} (${esc(d.answer.death_time)}). Open Reconstruction to see one valid movement sequence.</div>`:'<div class="result-bad"><strong>Not quite.</strong> That character/step pair does not fit all the public evidence. Check the shortest routes and remaining steps.</div>';
}
function toggleHint(){const box=$('hintBox'),hint=state.record?.hint||{};box.hidden=!box.hidden;if(!box.hidden){box.innerHTML=`<strong>Forensic report (optional)</strong>Examined at ${esc(hint.exam_time||'not available')}. Time elapsed since death: ${esc(hint.elapsed_since_death_minutes??'—')} minutes.<div style="margin-top:7px">Subtract the elapsed time from the exam time, then compare it with the common step clock.</div>`;$('hintBtn').textContent='Hide forensic clue';}else{$('hintBtn').textContent='Show optional forensic clue';}}
function unlockReconstruction(){state.unlocked=true;$('reconstructionGate').hidden=true;$('reconstructionContent').hidden=false;renderTimeline();}
function renderTimeline(){
 const d=state.record;if(!d)return;
 const f=d.frames.find(x=>Number(x.step)===state.step) || d.frames[0];if(!f)return;
 const steps=Number(d.timing.steps||d.frames.length-1);
 $('playerStepLabel').textContent=`STEP ${state.step} / ${steps}`;$('playerClock').textContent=f.clock||'—';$('stepSlider').value=state.step;
 $('playerPhase').textContent=state.step===0?'BLACKOUT BEGINS':state.step===steps?'LIGHTS RETURN':f.victim_deceased?'AFTER THE CRIME · RECONSTRUCTION':'BLACKOUT IN PROGRESS';
 $('timelineMap').innerHTML=mapSVG('timeline');
 $('playBtn').innerHTML=state.playing?'Ⅱ <span>Pause</span>':'▶ <span>Play</span>';
 $('eventHeading').textContent=`Events at step ${state.step}`;
 const filtered=(d.events||[]).filter(e=>Number(e.step)===state.step&&(state.actorFilter==='all'||e.actor===state.actorFilter));
 $('eventList').innerHTML=filtered.length?filtered.map(e=>`<div class="event-item ${e.action==='CRIME'?'event-crime':''}"><span class="event-actor">${esc(e.actor)}</span><div><strong>${esc(e.actor)} · ${esc(actorName(e.actor))} — ${esc(e.action==='CRIME'?'Crime occurs':e.action==='DECEASED'?'Remains at scene':'Moves')}</strong><small>${esc(e.from_coord)} → ${esc(e.to_coord)}${e.action==='CRIME'?' · '+esc(e.detail):''}</small></div></div>`).join(''):`<div class="subtle-note">${state.step===0?'Before the first step: all characters are at their starting locations.':'No events match this character at this step.'}</div>`;
 $('timelineActorNote').textContent=state.actorFilter==='all'?'All characters share one synchronized step counter.':`${actorName(state.actorFilter)} (${state.actorFilter}) · ${f.positions?.[state.actorFilter]||'—'} at step ${state.step}`;
}
function setStep(step){if(!state.record)return;state.step=clamp(Number(step),0,Number(state.record.timing.steps||state.record.frames.length-1));renderTimeline();}
function stopPlayback(){if(state.timer!==null){clearInterval(state.timer);state.timer=null;}state.playing=false;if($('playBtn'))$('playBtn').innerHTML='▶ <span>Play</span>';}
function startPlayback(){stopPlayback();state.playing=true;if(state.step>=Number(state.record.timing.steps))state.step=0;renderTimeline();const period=Number($('speedSelect').value)||950;state.timer=setInterval(()=>{if(state.step>=Number(state.record.timing.steps)){stopPlayback();renderTimeline();return;}setStep(state.step+1);},period);}
function revealAnswer(){
 const d=state.record,a=d.answer||{},person=d.actors.find(x=>x.id===a.murderer);
 state.answerShown=true;$('answerPanel').hidden=false;
 $('answerPanel').innerHTML=`<span class="eyebrow dark-eyebrow">OFFICIAL CASE RESOLUTION</span><h3>The blackout explained.</h3><p class="answer-lead">At step ${esc(a.death_step)}, the murderer and victim reached ${esc(a.scene)} at the same time. The victim remained there; the murderer carried on to their observed final position.</p><div class="answer-grid"><div class="answer-fact"><small>MURDERER</small><strong>${esc(person?.name||a.murderer)} (${esc(a.murderer)})</strong></div><div class="answer-fact"><small>DEATH TIME</small><strong>${esc(a.death_time)} · Step ${esc(a.death_step)}</strong></div><div class="answer-fact"><small>CRIME SCENE</small><strong>${esc(a.scene)}</strong></div></div><p class="proof-note">${esc(d.reconstruction_note||'The displayed reconstruction is one valid timeline; individual character routes may vary.')} The supplied audit reports ${esc(d.validation?.public_only_unique_pairs?.length??'—')} valid killer/time pair(s) from public clues${d.validation?.hint_required===false?', without using the forensic hint':''}.</p><div id="auditSummary" class="audit-summary">Loading the supplied verification certificate...</div>`;
 loadAudit(state.caseId,d.validation?.certificate);
 $('answerPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function loadAudit(id,certificateFile){
 const target=$('auditSummary');if(!certificateFile){target.textContent='No separate verification certificate was listed for this case.';return;}
 try{
  const response=await fetch(dataPath(certificateFile));if(!response.ok)throw Error('certificate unavailable');
  const cert=await response.json();if(state.caseId!==id||!state.answerShown)return;
  const audit=cert.independent_public_pair_audit||{},smart=cert.smart||{};
  const pairs=Array.isArray(audit.unique_pairs)?audit.unique_pairs.length:'—';
  target.innerHTML=`<strong>Independent data certificate</strong><span>${esc(pairs)} valid killer/time pair(s) · ${audit.public_inputs_only?'public clues only':'verification data present'} · ${audit.witness_valid?'witness timeline validated':'timeline status not specified'}${audit.hint_used===false?' · no forensic hint used':''}</span><a href="${esc(dataPath(certificateFile))}" target="_blank" rel="noopener">Inspect original certificate JSON ↗</a>`;
 }catch{if(state.caseId===id)target.textContent='The separate verification certificate is not in the uploaded dataset for this case.';}
}
async function copyLink(){const url=new URL(makeCaseLink(state.caseId),location.href).href;try{await navigator.clipboard.writeText(url);$('copyBtn').textContent='✓ Link copied';setTimeout(()=>{$('copyBtn').textContent='↗ Share case';},2200);}catch{window.prompt('Copy this case URL:',url);}}
function openZoom(kind){
 if(!state.record)return;
 zoomFactor=1;
 const names={before:'BEFORE · Lights on',after:'AFTER · Lights return',working:'WORKING GRID · Notebook',timeline:`TIMELINE · Step ${state.step}`};
 $('zoomHeading').textContent=names[kind]||'Case map';
 $('zoomCanvas').innerHTML=mapSVG(kind);
 $('zoomCanvas').querySelectorAll('[data-cell]').forEach(n=>n.removeAttribute('data-cell'));
 applyZoom();$('zoomDialog').showModal();
}
function applyZoom(){
 const svg=$('zoomCanvas').querySelector('svg');if(!svg)return;
 const d=state.record,ideal=Math.min(980,Math.max(560,Number(d.grid.columns)*54+50));
 svg.style.width=`${Math.round(ideal*zoomFactor)}px`;
 $('zoomSizeLabel').textContent=`${Math.round(zoomFactor*100)}%`;
}
function bindEvents(){
 $('caseList').addEventListener('click',e=>{const button=e.target.closest('[data-case]');if(button)loadCase(button.dataset.case);});
 $('caseSearch').addEventListener('input',renderArchive);$('levelFilter').addEventListener('change',renderArchive);
 $('investigateTab').addEventListener('click',()=>setTab('investigate'));$('reconstructTab').addEventListener('click',()=>setTab('reconstruct'));
 $('copyBtn').addEventListener('click',copyLink);
 document.querySelectorAll('[data-expand]').forEach(b=>b.addEventListener('click',()=>openZoom(b.dataset.expand)));
 $('zoomOutBtn').addEventListener('click',()=>{zoomFactor=clamp(zoomFactor-.25,.5,3);applyZoom();});
 $('zoomInBtn').addEventListener('click',()=>{zoomFactor=clamp(zoomFactor+.25,.5,3);applyZoom();});
 $('closeZoomBtn').addEventListener('click',()=>$('zoomDialog').close());
 $('markTools').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b)return;state.tool=b.dataset.tool;document.querySelectorAll('.tool-chip').forEach(x=>x.classList.toggle('selected',x.dataset.tool===state.tool));});
 $('workingMap').addEventListener('click',e=>{const cell=e.target.closest('[data-cell]')?.dataset.cell;if(!cell||!state.record)return;state.selectedCell=cell;const blocked=state.record.objects?.some(o=>o.cells.includes(cell));if(state.tool==='erase')delete state.notes[cell];else if(!blocked){if(state.notes[cell]===state.tool)delete state.notes[cell];else state.notes[cell]=state.tool;}saveNotes();renderWorking();});
 $('clearMarksBtn').addEventListener('click',()=>{if(!Object.keys(state.notes).length)return;if(confirm('Remove all working-grid notes for this case?')){state.notes={};saveNotes();renderWorking();}});
 $('checkAccusation').addEventListener('click',checkAccusation);$('hintBtn').addEventListener('click',toggleHint);
 $('unlockBtn').addEventListener('click',unlockReconstruction);$('answerBtn').addEventListener('click',revealAnswer);
 $('restartBtn').addEventListener('click',()=>{stopPlayback();setStep(0);});$('prevBtn').addEventListener('click',()=>{stopPlayback();setStep(state.step-1);});$('nextBtn').addEventListener('click',()=>{stopPlayback();setStep(state.step+1);});
 $('playBtn').addEventListener('click',()=>state.playing?(stopPlayback(),renderTimeline()):startPlayback());$('stepSlider').addEventListener('input',e=>{stopPlayback();setStep(e.target.value);});
 $('speedSelect').addEventListener('change',()=>{if(state.playing)startPlayback();});
 $('actorFilter').addEventListener('change',e=>{state.actorFilter=e.target.value;renderTimeline();});
 $('showTrails').addEventListener('change',e=>{state.trails=e.target.checked;renderTimeline();});$('showLabels').addEventListener('change',e=>{state.labels=e.target.checked;renderTimeline();});
 $('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());$('closeHelp').addEventListener('click',()=>$('helpDialog').close());$('gotItBtn').addEventListener('click',()=>$('helpDialog').close());
 $('helpDialog').addEventListener('click',e=>{if(e.target===$('helpDialog'))$('helpDialog').close();});
 window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('case');const entry=state.manifest.find(m=>m.id===id);if(entry)loadCase(entry.id,false);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
}
bindEvents();loadIndex();
