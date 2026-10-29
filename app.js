/* MURDGRID solution viewer v2. No external runtime; compatible with GitHub Pages. */
'use strict';
const $ = id => document.getElementById(id);
const s = { data:null, step:0, mode:'all', selected:null, complete:true, zoom:1, px:0, py:0, timer:null, speed:1000, urls:new URLSearchParams(location.search) };
const escapeXML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n=>String(n).padStart(2,'0');
const coord = str => { const m=/^([A-Z]+)(\d+)$/.exec(String(str||'').toUpperCase());if(!m)return null;let col=0;for(const v of m[1])col=col*26+(v.charCodeAt(0)-64);return {c:col-1,r:+m[2]-1}; };
const xy = (str,unit=42,margin=32) => {const p=coord(str);return p?{x:margin+(p.c+.5)*unit,y:margin+(p.r+.5)*unit}:null;};
const actorById = id => s.data.actors.find(a=>a.id===id);
const getCaseId =()=>s.urls.get('case')||'KG-EX';
const readPath = url =>fetch(url,{cache:'no-store'}).then(async res=>{if(!res.ok)throw Error(`HTTP ${res.status}: ${url}`);return res.json();});
function error(message){stop();$('fatalText').textContent=message;$('fatal').hidden=false;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('toast').hidden=true,2500);}
function routeFile(entry){const str=entry.file||entry.json||entry.path||entry.data_file||`${entry.id||entry.case_id}.json`;if(typeof str!=='string'||str.includes('..')||str.startsWith('/')||str.includes(':'))throw Error('Case file path not valid');return 'data/'+str.replace(/^data\//,'');}
async function start(){try{
 const id=getCaseId();if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Invalid case ID.');
 const raw=await readPath('data/index.json');let entries=Array.isArray(raw)?raw:raw.cases||raw.puzzles||raw.entries||[];
 if(!Array.isArray(entries))throw Error('Cannot read case index.');
 const entry=entries.find(e=>(e.id||e.case_id)===id);
 if(!entry)throw Error(`Case ${id} is not listed in data/index.json.`);
 const data=await readPath(routeFile(entry));validate(data);s.data=data;s.selected=data.actors.find(a=>a.id!==data.answer?.victim)?.id||data.actors[0]?.id;
 document.title=`${data.case_id} — ${data.title} | MURDGRID`;populate();setStep(0);
 }catch(e){console.error(e);error(e.message||'Unable to open this case.');}}
function validate(d){if(!d?.grid||!Array.isArray(d.grid.room_ids)||!d.actors?.length||!d.frames?.length||!d.timing)throw Error('This JSON has an incomplete map or timeline.');if(!d.answer||d.answer.murderer===undefined||d.answer.death_step===undefined)throw Error('This case JSON has no official answer.');
 const {rows,columns,room_ids}=d.grid;if(rows!==room_ids.length||room_ids.some(row=>row.length!==columns))throw Error('Room map size mismatch.');
 if(d.frames.length!==Number(d.timing.steps)+1)throw Error('Timeline frame count does not match timing steps.');
 }
function populate(){const d=s.data,a=d.answer,k=actorById(a.murderer);
 $('headerCode').textContent=d.case_id;$('caseEyebrow').textContent=d.level===0?'WORKED EXAMPLE / VOLUME 1':`LEVEL ${d.level} / VOLUME 1`;$('caseTitle').textContent=d.title;
 $('killerName').textContent=k?.name||a.murderer;$('answerInitial').textContent=a.murderer;$('deathTime').textContent=a.death_time||d.frames[a.death_step]?.clock||'—';$('deathStep').textContent=num(a.death_step);$('crimeCell').textContent=a.scene||'—';
 if(k?.portrait){const img=document.createElement('img');img.alt='';img.onerror=()=>img.remove();img.src=assetPath(k.portrait);$('answerPortrait').append(img);}
 $('stepRange').max=d.timing.steps;
 $('actorSelect').replaceChildren();for(const char of d.actors){const o=document.createElement('option');o.value=char.id;o.textContent=`${char.id} — ${char.name}`;$('actorSelect').append(o);}$('actorSelect').value=s.selected;
 $('dataQuality').textContent=d.validation?.public_only_unique_pairs?.length===1?'Unique murderer + step verified':'Official case data';
 }
function assetPath(rel){if(typeof rel!=='string'||rel.includes('..')||rel.startsWith('/')||rel.includes(':'))return '';return 'data/'+rel.replace(/^data\//,'');}
function setStep(step){if(!s.data)return;s.step=Math.max(0,Math.min(s.data.timing.steps,Number(step)||0));$('stepRange').value=s.step;render();}
function setMode(mode){s.mode=mode;$('allMode').classList.toggle('active',mode==='all');$('trailMode').classList.toggle('active',mode==='trail');$('allMode').setAttribute('aria-pressed',String(mode==='all'));$('trailMode').setAttribute('aria-pressed',String(mode==='trail'));$('actorControls').hidden=mode!=='trail';render();}
function render(){const d=s.data;if(!d)return;const f=d.frames[s.step],v=d.answer;
 $('stepIndicator').textContent=`STEP ${s.step} / ${d.timing.steps}`;$('scrubTime').textContent=f.clock||'';$('clockLabel').textContent=f.clock||'';
 $('mapModeCaption').textContent=s.mode==='all'?'SYNCHRONIZED TIMELINE':'CHARACTER MOVEMENT TRAIL';
 $('mapPhase').textContent=s.step===0?'BEFORE · LIGHTS ON':s.step===d.timing.steps?'AFTER · LIGHTS RETURN':s.step===v.death_step?'CRIME OCCURS · STEP '+s.step:`BLACKOUT · STEP ${s.step}`;
 $('filterSummary').textContent=s.mode==='all'?'All characters share one clock. Every selected step displays the complete scene.':`Trace ${actorById(s.selected)?.name||s.selected} from the first to the last known position.`;
 const who=s.mode==='trail'?actorById(s.selected):null;
 const pos=who?.path?.[s.step]||f.positions?.[s.selected];
 $('eventSummary').textContent=s.mode==='all' ? `${d.actors.length} people · ${f.clock}. ${s.step===v.death_step?'The victim is killed at '+v.scene+'.':s.step>v.death_step?'The victim remains at '+v.scene+'.':s.step===0?'Last known positions before the blackout.':'All living people move one tile this step.'}`:`${who?.id} · ${who?.name}: ${who?.start||'—'} → ${who?.end||'—'}. Current cell ${pos||'—'} at step ${s.step}.`;
 $('mapContext').textContent=`${d.grid.columns} × ${d.grid.rows} · ${d.rooms?.length||0} rooms · ${d.objects?.length||0} objects`;
 $('mapArt').innerHTML=drawMap(d,f);applyZoom();
 $('play').textContent=s.timer?'Ⅱ':'▶';$('play').setAttribute('aria-label',s.timer?'Pause':'Play');
 }
function doorSet(d){const out=new Set;for(const pair of (d.grid.doors||[])){if(pair.length>=2){out.add([pair[0],pair[1]].sort().join('|'));}}return out;}
function coordinateAt(c,r){let n=c+1,str='';while(n>0){n--;str=String.fromCharCode(65+n%26)+str;n=Math.floor(n/26);}return str+(r+1);}
function rgba(hex,opacity){return hex;}
function drawMap(d,frame){
 const U=42,M=36,R=d.grid.rows,C=d.grid.columns,width=2*M+C*U,height=2*M+R*U,door=doorSet(d),roomIndex=new Map((d.rooms||[]).map(x=>[x.id,x])),blocked=new Set(d.objects?.flatMap(o=>o.cells)||[]);
 const at=(c,r)=>M+c*U+','+(M+r*U);let q=[];
 q.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-label="Map with ${R} rows and ${C} columns" role="img"><defs><marker id="arrow" markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="none" stroke="#db803c" stroke-width="1.2"/></marker><filter id="glow"><feGaussianBlur stdDeviation="2.5"/></filter></defs>`);
 q.push(`<rect x="${M-7}" y="${M-7}" width="${C*U+14}" height="${R*U+14}" rx="4" fill="#fafbf9" stroke="#c6d1d6"/>`);
 // Exact geometry: paint each original room id; never infer doors from colors.
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){const room=d.grid.room_ids[r][c],color=roomIndex.get(room)?.color||'#edf0ee';q.push(`<rect x="${M+c*U}" y="${M+r*U}" width="${U}" height="${U}" fill="${escapeXML(color)}" stroke="#fff" stroke-width=".65"/>`);}
 for(let c=0;c<C;c++)q.push(`<text x="${M+(c+.5)*U}" y="${M-12}" text-anchor="middle" font-weight="800" font-size="12" fill="#53687a">${coordinateAt(c,0).replace('1','')}</text>`);
 for(let r=0;r<R;r++)q.push(`<text x="${M-13}" y="${M+(r+.5)*U+4}" text-anchor="middle" font-weight="800" font-size="12" fill="#53687a">${r+1}</text>`);
 // Walls and doors: use room_ids and only the door pairs actually present.
 const edge=(x1,y1,x2,y2,doorEdge=false)=>{
 if(!doorEdge)return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#344c5e" stroke-width="4.1" stroke-linecap="round"/>`;
 const midx=(x1+x2)/2,midy=(y1+y2)/2;
 return `<line x1="${midx-4}" y1="${midy-4}" x2="${midx+4}" y2="${midy+4}" stroke="#c09149" stroke-width="3.2" stroke-linecap="round"/>`;
 };
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){
  const room=d.grid.room_ids[r][c],loc=coordinateAt(c,r),x=M+c*U,y=M+r*U;
  if(c===0)q.push(edge(x,y,x,y+U));if(r===0)q.push(edge(x,y,x+U,y));
  if(c===C-1)q.push(edge(x+U,y,x+U,y+U));else if(room!==d.grid.room_ids[r][c+1])q.push(edge(x+U,y,x+U,y+U,door.has([loc,coordinateAt(c+1,r)].sort().join('|'))));
  if(r===R-1)q.push(edge(x,y+U,x+U,y+U));else if(room!==d.grid.room_ids[r+1][c])q.push(edge(x,y+U,x+U,y+U,door.has([loc,coordinateAt(c,r+1)].sort().join('|'))));
 }
 // Objects cover one or two cells. Only draw images from existing asset paths; fallback shapes remain visible.
 for(const o of d.objects||[]){if(!o.cells?.length)continue;const cells=o.cells.map(coord).filter(Boolean);if(!cells.length)continue;
  const minC=Math.min(...cells.map(a=>a.c)),minR=Math.min(...cells.map(a=>a.r)),maxC=Math.max(...cells.map(a=>a.c)),maxR=Math.max(...cells.map(a=>a.r));const x=M+minC*U+4,y=M+minR*U+4,w=(maxC-minC+1)*U-8,h=(maxR-minR+1)*U-8;
  q.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#83919d" stroke="#4d5b65" stroke-width="1.4" opacity=".78"/>`);
  // Deliberate placeholder furniture geometry, not a map passage.
  q.push(`<rect x="${x+4}" y="${y+4}" width="${Math.max(2,w-8)}" height="${Math.max(2,h-8)}" rx="3" fill="none" stroke="#e5e8e8" stroke-width="1.5" stroke-dasharray="4 4" opacity=".9"/>`);
  const img=assetPath(o.image);if(img)q.push(`<image href="${escapeXML(img)}" x="${x+1}" y="${y+1}" width="${w-2}" height="${h-2}" preserveAspectRatio="xMidYMid meet"/>`);
 }
 // Crime scene is always visible on the solution page; do not obscure the geometry.
 const scene=xy(d.answer.scene,U,M);if(scene){q.push(`<circle cx="${scene.x}" cy="${scene.y}" r="17" fill="#be536224" stroke="#b44e5e" stroke-width="2" stroke-dasharray="4 3"/>`);}
 if(s.mode==='trail'){
  const char=actorById(s.selected);if(char){const maxIndex=s.complete?char.path.length-1:Math.min(s.step,char.path.length-1);const path=char.path.slice(0,maxIndex+1);const arr=path.map(x=>xy(x,U,M)).filter(Boolean);
   if(arr.length){const line=arr.map(p=>`${p.x},${p.y}`).join(' ');
    q.push(`<polyline points="${line}" fill="none" stroke="#fff" stroke-width="11" stroke-linejoin="round" opacity=".92"/>`);
    q.push(`<polyline points="${line}" fill="none" stroke="#d78942" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7 5"/>`);
    for(let i=0;i<arr.length;i++){if(i>0&&arr[i].x===arr[i-1].x&&arr[i].y===arr[i-1].y)continue;const p=arr[i],color=i===0?'#3c9884':i===arr.length-1?'#cf8737':'#d58a45';q.push(`<circle cx="${p.x}" cy="${p.y}" r="7" fill="${color}" stroke="#fff" stroke-width="1.8"/><text x="${p.x}" y="${p.y+2.5}" font-size="7" font-weight="900" text-anchor="middle" fill="#fff">${i}</text>`);}
   }
  }
 }
 // Collisions are allowed by the data. Offset badges to avoid visually hiding actors.
 const actors=s.mode==='all'?d.actors:[actorById(s.selected)].filter(Boolean),groups=new Map();for(const a of actors){const loc=frame.positions?.[a.id]||a.path?.[s.step];if(!loc)continue;const all=groups.get(loc)||[];all.push(a);groups.set(loc,all);}
 for(const [loc,arr] of groups){const center=xy(loc,U,M);if(!center)continue;arr.forEach((a,i)=>{
  const n=arr.length;const dx=n===1?0:Math.cos(i*2*Math.PI/n-Math.PI/4)*11,dy=n===1?0:Math.sin(i*2*Math.PI/n-Math.PI/4)*11;
  const x=center.x+dx,y=center.y+dy;
  const victim=a.id===d.answer.victim,killer=a.id===d.answer.murderer;const r=n===1?13.1:10.7;
  q.push(`<circle cx="${x}" cy="${y}" r="${r+3.4}" fill="#fff" opacity=".89"/><circle cx="${x}" cy="${y}" r="${r}" fill="${victim?'#bd5360':killer?'#bd8b3c':'#273e58'}" stroke="${killer?'#f4d389':'#fff'}" stroke-width="1.8"/>`);
  const photo=assetPath(a.portrait);if(photo){const clip=`clip-${escapeXML(a.id)}`;q.push(`<defs><clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${r-1.5}"/></clipPath></defs><image href="${escapeXML(photo)}" x="${x-r+1.5}" y="${y-r+1.5}" width="${(r-1.5)*2}" height="${(r-1.5)*2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`);}
  // Label remains visibly legible if an image has not been uploaded.
  q.push(`<text x="${x}" y="${y+3.5}" text-anchor="middle" font-size="${n===1?12:9.5}" font-weight="900" stroke="#172b3c" stroke-width=".65" paint-order="stroke" fill="#fff">${escapeXML(a.id)}</text>`);
 });}
 // One special marker distinguishes a stationary deceased victim in the solution timeline.
 if(s.step>=d.answer.death_step&&scene)q.push(`<text x="${scene.x+17}" y="${scene.y-16}" font-weight="950" font-size="9" fill="#ae4c59">CRIME</text>`);
 q.push('</svg>');return q.join('');}
function applyZoom(){$('mapArt').style.transform=`translate(${s.px}px,${s.py}px) scale(${s.zoom})`;$('zoomReset').disabled=s.zoom===1&&s.px===0&&s.py===0;}
function zoomBy(delta){s.zoom=Math.max(1,Math.min(3.5,Math.round((s.zoom+delta)*10)/10));if(s.zoom===1){s.px=0;s.py=0;}applyZoom();}
function resetZoom(){s.zoom=1;s.px=0;s.py=0;applyZoom();}
function stop(){if(s.timer){clearInterval(s.timer);s.timer=null;}$('play').textContent='▶';$('play').setAttribute('aria-label','Play');}
function play(){if(s.timer){stop();return;}if(s.step>=s.data.timing.steps)setStep(0);$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause');s.timer=setInterval(()=>{if(s.step>=s.data.timing.steps){stop();return;}setStep(s.step+1);if(s.step>=s.data.timing.steps)stop();},s.speed);}
function bind(){ $('allMode').addEventListener('click',()=>setMode('all'));$('trailMode').addEventListener('click',()=>setMode('trail'));
 $('actorSelect').addEventListener('change',e=>{s.selected=e.target.value;render();});$('fullRoute').addEventListener('change',e=>{s.complete=e.target.checked;render();});
 $('stepRange').addEventListener('input',e=>{stop();setStep(e.target.value);});$('toStart').addEventListener('click',()=>{stop();setStep(0);});$('toEnd').addEventListener('click',()=>{stop();setStep(s.data.timing.steps);});$('prevStep').addEventListener('click',()=>{stop();setStep(s.step-1);});$('nextStep').addEventListener('click',()=>{stop();setStep(s.step+1);});$('play').addEventListener('click',play);$('speed').addEventListener('change',e=>{s.speed=Number(e.target.value);if(s.timer){stop();play();}});
 $('zoomOut').addEventListener('click',()=>zoomBy(-.5));$('zoomIn').addEventListener('click',()=>zoomBy(.5));$('zoomReset').addEventListener('click',resetZoom);
 let dragging=null;const stage=$('mapStage');stage.addEventListener('pointerdown',e=>{if(s.zoom<=1||e.button!==0)return;dragging={id:e.pointerId,x:e.clientX,y:e.clientY,ox:s.px,oy:s.py};stage.setPointerCapture(e.pointerId);});stage.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.id)return;s.px=dragging.ox+e.clientX-dragging.x;s.py=dragging.oy+e.clientY-dragging.y;applyZoom();});stage.addEventListener('pointerup',()=>dragging=null);stage.addEventListener('pointercancel',()=>dragging=null);
 document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(e.key==='ArrowLeft'){stop();setStep(s.step-1);}if(e.key==='ArrowRight'){stop();setStep(s.step+1);}if(e.code==='Space'){e.preventDefault();play();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});$('shareButton').addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('case',s.data?.case_id||getCaseId());try{await navigator.clipboard.writeText(url.href);toast('Direct case link copied');}catch{toast('Copy this address: '+url.href);}});
}
bind();start();
