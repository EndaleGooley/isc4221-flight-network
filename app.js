'use strict';
// One three-way comparison (one list-element probe) is counted at each midpoint.
function binaryFind(codes, code) {
  let low = 0, high = codes.length - 1, comparisons = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2), candidate = codes[mid];
    comparisons++;
    if (code === candidate) return {index: mid, comparisons};
    if (code < candidate) high = mid - 1; else low = mid + 1;
  }
  return {index: -1, comparisons};
}
function haversine(a, b) {
  const rad = Math.PI / 180, p1 = a.lat * rad, p2 = b.lat * rad;
  const h = Math.sin((p2-p1)/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin((b.lon-a.lon)*rad/2)**2;
  return 12742 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
function connectionSearch(graph, origin, destination) {
  if (!graph[origin] || !graph[destination]) return {found:false,iterations:0,flights:null,reached:[]};
  const used = new Set(), untouched = new Set(Object.keys(graph));
  let frontier = new Set([origin]), iterations = 0;
  untouched.delete(origin);
  if (origin === destination) return {found:true,iterations:0,flights:0,reached:[origin]};
  while (frontier.size) {
    const next = new Set();
    for (const code of frontier) {
      used.add(code);
      for (const neighbor of graph[code]) if (untouched.has(neighbor)) next.add(neighbor);
    }
    for (const code of next) untouched.delete(code);
    iterations++;
    frontier = next;
    if (frontier.has(destination)) return {found:true,iterations,flights:iterations,reached:[...used,...frontier]};
  }
  return {found:false,iterations,flights:null,reached:[...used]};
}
const $ = id => document.getElementById(id);
const state = {selected:'TLH',highlight:new Set(),zoom:1,panX:0,panY:0,positions:{}};
function project(lon,lat) {
  if (lon > 0) lon -= 360;
  return [lon, -180/Math.PI*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
}
function mapPoint(lon,lat) {
  const [x,y] = project(lon,lat), width=state.width, height=state.height;
  const scale=Math.min(width/132,height/110)*state.zoom;
  return [(x+124)*scale+width/2+state.panX,(y+71)*scale+height/2+state.panY];
}
function drawMap() {
  const canvas=$('map'), rect=canvas.getBoundingClientRect(), ratio=window.devicePixelRatio||1;
  state.width=rect.width; state.height=rect.height;
  canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  ctx.fillStyle='#e6f0f4';ctx.fillRect(0,0,rect.width,rect.height);
  ctx.strokeStyle='#b4c6cb';ctx.fillStyle='#f7faf9';ctx.lineWidth=.7;
  for (const feature of state.states.features) {
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) ring.forEach((p,i)=>{const q=mapPoint(...p);if(i===0)ctx.moveTo(...q);else ctx.lineTo(...q);});
      ctx.fill('evenodd');ctx.stroke();
    }
  }
  state.positions={};
  for(const code of state.data.codes){const a=state.data.airports[code];state.positions[code]=mapPoint(a.lon,a.lat);}
  const line=(a,b)=>{ctx.beginPath();ctx.moveTo(...state.positions[a]);ctx.lineTo(...state.positions[b]);ctx.stroke();};
  ctx.strokeStyle='rgba(41,102,133,.11)';ctx.lineWidth=.55;
  for (const [a,b] of state.data.edges) {
    // Avoid map-spanning chords at the longitude wrap.
    if (Math.abs(state.positions[a][0]-state.positions[b][0]) < rect.width*2) line(a,b);
  }
  ctx.strokeStyle='rgba(206,83,24,.85)';ctx.lineWidth=1.4;
  for (const neighbor of state.graph[state.selected]||[]) line(state.selected,neighbor);
  for(const code of state.data.codes){
    const [x,y]=state.positions[code], a=state.data.airports[code];
    const radius=2+Math.sqrt(a.degree)*.36;
    ctx.beginPath();ctx.arc(x,y,code===state.selected?6:radius,0,2*Math.PI);
    ctx.fillStyle=code===state.selected?'#d95e20':state.highlight.has(code)?'#0b9870':'#287b9b';ctx.fill();
    if(code===state.selected){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
  }
  ctx.font='bold 11px system-ui';ctx.fillStyle='#153047';
  for(const code of new Set(['TLH',...state.data.hubs.slice(0,4).map(x=>x[0]),state.selected])){
    const p=state.positions[code];if(p)ctx.fillText(code,p[0]+7,p[1]-5);
  }
}
function selectAirport(code) {
  $('code').value=code;
  const result=binaryFind(state.data.codes,code), details=$('details');
  if(result.index<0){details.textContent=`${code||'(empty code)'}: not found. Binary search used ${result.comparisons} comparisons.`;return;}
  state.selected=code;state.highlight.clear();
  const a=state.data.airports[code];
  details.innerHTML=`<h3>${code} · ${a.city}</h3><div>${a.name}</div><p><b>Degree: ${a.degree}</b> · ${result.comparisons} binary-search comparisons</p><b>Direct destinations</b><div class="tags" id="destinations"></div><h3>Five nearest active airports</h3><table><thead><tr><th>Code</th><th>City</th><th>km</th></tr></thead><tbody id="nearest"></tbody></table>`;
  for (const neighbor of [...state.graph[code]].sort()) {
    const button=document.createElement('button');button.textContent=neighbor;button.onclick=()=>selectAirport(neighbor);$('destinations').append(button);
  }
  const nearest=state.data.codes.filter(x=>x!==code).map(x=>[x,haversine(a,state.data.airports[x])]).sort((x,y)=>x[1]-y[1]||x[0].localeCompare(y[0])).slice(0,5);
  for (const [x,d] of nearest) {
    const row=document.createElement('tr');
    for (const value of [x,state.data.airports[x].city,d.toFixed(1)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
    $('nearest').append(row);
  }
  $('map-status').textContent=`Selected ${code}: ${a.degree} direct destinations highlighted in orange. Map uses Mercator projection; straight edges show connectivity, not actual flight paths.`;
  drawMap();
}
function checkConnection() {
  const origin=$('origin').value,destination=$('destination').value,result=connectionSearch(state.graph,origin,destination);
  state.highlight=new Set(result.reached);
  const el=$('connection-result');el.className=result.found?'success':'failure';
  el.textContent=`${origin} → ${destination}: ${result.found?'Path exists':'No path'}. Iterations: ${result.iterations}. ${result.found?`Fewest flights: ${result.flights}. `:''}Airports reached: ${result.reached.length}.`;
  $('map-status').textContent=`Green airports were reached by the connection algorithm (${result.reached.length}); selected airport routes remain orange. No-path searches exhaust the origin component.`;
  drawMap();return result;
}
async function initialize() {
  const [networkResponse,statesResponse]=await Promise.all([fetch('data/network.json'),fetch('data/us-states.geojson')]);
  if(!networkResponse.ok||!statesResponse.ok)throw new Error('Could not load local data files.');
  state.data=await networkResponse.json();state.states=await statesResponse.json();state.graph={};
  for(const code of state.data.codes)state.graph[code]=new Set();
  for(const [a,b]of state.data.edges){state.graph[a].add(b);state.graph[b].add(a);}
  const d=state.data;
  for(const [number,label]of [[d.codes.length,'Airports with routes'],[d.edges.length,'Unique edges'],[d.components.length,'Components'],[d.total_us_airports,'All U.S. IATA airports'],[d.isolated_airports,'Without domestic routes']]){
    const el=document.createElement('div');el.className='stat';el.innerHTML=`<strong>${number.toLocaleString()}</strong><span>${label}</span>`;$('stats').append(el);
  }
  const routeNote=document.createElement('p');routeNote.className='hint';routeNote.textContent=`${d.domestic_route_lines.toLocaleString()} domestic route records before merging airlines and directions.`;$('stats').after(routeNote);
  for(const [code,degree]of d.hubs){const button=document.createElement('button');button.className='hub';button.innerHTML=`<b>${code}</b><span class="track"><span class="fill" style="display:block;width:${degree/d.hubs[0][1]*100}%"></span></span><span>${degree}</span>`;button.onclick=()=>selectAirport(code);$('hubs').append(button);}
  d.components.forEach((component,i)=>{const button=document.createElement('button');button.className='component';button.textContent=`Component ${i+1}: ${component.length} airports${i?' · '+component.join(', '):' · largest'}`;button.onclick=()=>{state.highlight=new Set(component);$('map-status').textContent=`Component ${i+1}: ${component.length} airports highlighted in green.`;drawMap();};$('components').append(button);});
  const maxLayer=Math.max(...Object.values(d.tlh_layers));
  for(const [k,count]of Object.entries(d.tlh_layers)){$('layers').insertAdjacentHTML('beforeend',`<div class="layer"><span>${k} flight${k==='1'?'':'s'}</span><i style="width:${count/maxLayer*55}%"></i><b>${count}</b></div>`);}
  $('tlh-nearest').textContent=d.tlh_nearest.map(([c,km])=>`${c}: ${km.toFixed(1)} km`).join(' · ');
  for(const id of ['origin','destination'])for(const code of d.codes){const option=document.createElement('option');option.value=code;option.textContent=`${code} – ${d.airports[code].city}`;$(id).append(option);}
  $('origin').value='TLH';$('destination').value='SEA';
  $('lookup').onsubmit=event=>{event.preventDefault();selectAirport($('code').value.trim().toUpperCase());};
  $('connection').onsubmit=event=>{event.preventDefault();checkConnection();};
  const reset=()=>{state.zoom=1;state.panX=0;state.panY=0;drawMap();};$('reset').onclick=reset;
  const zoomBy=factor=>{state.zoom=Math.min(12,Math.max(.6,state.zoom*factor));drawMap();};
  $('plus').onclick=()=>zoomBy(1.3);$('minus').onclick=()=>zoomBy(1/1.3);
  const canvas=$('map');let drag=null,moved=false;
  canvas.onpointerdown=event=>{drag=[event.clientX,event.clientY];moved=false;canvas.setPointerCapture(event.pointerId);};
  canvas.onpointermove=event=>{
    if(drag){const dx=event.clientX-drag[0],dy=event.clientY-drag[1];if(Math.abs(dx)+Math.abs(dy)>2)moved=true;state.panX+=dx;state.panY+=dy;drag=[event.clientX,event.clientY];drawMap();}
    else {const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;let closest=null,best=10;for(const [code,p]of Object.entries(state.positions)){const distance=Math.hypot(p[0]-x,p[1]-y);if(distance<best){best=distance;closest=code;}}const tip=$('tooltip');tip.style.display=closest?'block':'none';if(closest){tip.textContent=`${closest} · ${d.airports[closest].city} · degree ${d.airports[closest].degree}`;tip.style.left=Math.min(x+12,rect.width-180)+'px';tip.style.top=Math.max(0,y-30)+'px';}}
  };
  canvas.onpointerup=event=>{drag=null;if(moved)return;const rect=canvas.getBoundingClientRect();let closest=null,best=14;for(const [code,p]of Object.entries(state.positions)){const distance=Math.hypot(p[0]-(event.clientX-rect.left),p[1]-(event.clientY-rect.top));if(distance<best){best=distance;closest=code;}}if(closest)selectAirport(closest);};
  canvas.onpointercancel=()=>{drag=null;};canvas.onpointerleave=()=>{$('tooltip').style.display='none';};
  canvas.addEventListener('wheel',event=>{event.preventDefault();zoomBy(event.deltaY<0?1.12:1/1.12);},{passive:false});
  window.addEventListener('resize',drawMap);
  const params=new URLSearchParams(window.location.search);selectAirport((params.get('airport')||'TLH').toUpperCase());
  if(params.has('to')){$('origin').value=params.get('from')||'TLH';$('destination').value=params.get('to');checkConnection();}
  // Exposed for parity checks against the Python implementation.
  window.flightExplorer={state,binaryFind,haversine,connectionSearch,selectAirport,checkConnection};
  document.documentElement.dataset.ready='true';
}
if(typeof document!=='undefined')initialize().catch(error=>{$('load-error').textContent=`${error.message} Serve docs/ over HTTP (python3 -m http.server --directory docs), rather than opening index.html as a file.`;console.error(error);});
