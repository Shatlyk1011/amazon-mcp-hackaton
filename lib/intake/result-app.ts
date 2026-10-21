// Shared by the intake resource and direct generate_move_plan resource.
export const resultStyles = String.raw`
main:has(.plan){max-width:1040px}.plan{--line:color-mix(in srgb,CanvasText 18%,transparent);--muted:color-mix(in srgb,CanvasText 65%,Canvas);--accent:#286aa8}
.plan h1{font-family:Geist,Arial,sans-serif;font-size:clamp(26px,5vw,40px);font-weight:600;letter-spacing:-.035em;margin:8px 0 12px;overflow-wrap:anywhere}
.plan h2{font-size:19px;margin:0 0 12px}.plan h3{font-size:15px;margin:0 0 8px}
.plan section{margin-top:26px;border-top:1px solid var(--line);padding-top:20px}
.plan p{opacity:1;color:var(--muted);font-size:14px}.plan .briefing{font-size:16px;line-height:1.6;color:inherit;max-width:74ch}
.plan .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}
.plan .metric{border-left:3px solid var(--accent);padding:4px 12px}.plan .metric strong{display:block;font-size:clamp(19px,3vw,27px);font-weight:650;overflow-wrap:anywhere}.plan .metric span{font-size:12px;color:var(--muted)}
.plan .map{width:100%;display:block;border:1px solid var(--line);border-radius:12px;max-height:420px;object-fit:contain;background:color-mix(in srgb,var(--accent) 5%,Canvas)}
.plan .caption{font-size:12px;margin-top:8px}.plan .table-scroll{overflow:auto;border:1px solid var(--line);border-radius:10px}
.plan table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}.plan th{background:color-mix(in srgb,var(--accent) 7%,Canvas);font-weight:650}.plan td,.plan th{padding:12px;vertical-align:top;border-bottom:1px solid var(--line)}.plan tr:last-child td{border:0}.plan td:first-child{min-width:165px}.plan td small{display:block;margin-top:4px;color:var(--muted)}
.plan a{color:var(--color-text-link,light-dark(#286aa8,#75b8ff));text-underline-offset:3px}.plan .notice{border-left:3px solid #ad7921;padding:10px 14px;background:color-mix(in srgb,#ad7921 8%,Canvas);border-radius:0 8px 8px 0}
.plan .columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}.plan .columns section{min-width:0}.plan .checklist{padding:0;list-style:none;display:grid;gap:12px}.plan .checklist li{padding-left:15px;border-left:2px solid var(--line);font-size:14px;line-height:1.5}.plan .checklist time{display:block;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.plan details{margin-top:24px;padding:16px;border:1px solid var(--line);border-radius:10px}.plan summary{cursor:pointer;font-weight:650}.plan details ul{padding-left:20px;font-size:13px;line-height:1.6}.plan .strategy{padding:12px 0}.plan .strategy+ .strategy{border-top:1px solid var(--line)}.plan .empty{padding:18px;border:1px dashed var(--line);border-radius:10px}.plan footer{font-size:12px;color:var(--muted);margin:24px 0 8px}
@media(max-width:600px){.plan .columns{grid-template-columns:1fr;gap:0}.plan .metrics{gap:8px}.plan .metric{padding-left:8px}.plan td,.plan th{padding:9px}}
`;

export const resultRenderer = String.raw`
  function sourceLink(label, url) {
    const link=element('a',label);
    try {
      const parsed=new URL(url);
      if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)return element('span','Confirm with provider');
      link.href=parsed.href;link.target='_blank';link.rel='noopener noreferrer';
      link.onclick=event=>{event.preventDefault();request('ui/open-link',{url:parsed.href}).catch(()=>showError('The link could not open. Copy the address from the link and open it in your browser.'));};
      return link;
    }catch{return element('span','Confirm with provider');}
  }
  function renderPlan(plan, meta) {
    root.replaceChildren(); const page=element('article','','plan');root.append(page);
    const money=value=>Number(value).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    page.append(element('div','Your moving plan · '+plan.move.movingDate,'eyebrow'),element('h1',plan.move.origin+' → '+plan.move.destination),element('p',plan.briefing.summary,'briefing'));
    const metrics=element('div','','metrics');
    [['Moving allowance',money(plan.budget.recommended)],['Monthly rent ceiling',plan.move.needsHousing?money(plan.move.maxRent):'Arranged'],[plan.budget.remaining<0?'Budget gap':'Budget remaining',money(Math.abs(plan.budget.remaining))]].forEach(([label,value])=>{const box=element('div','','metric');box.append(element('span',label),element('strong',value));metrics.append(box)});page.append(metrics);
    page.append(element('p','Planning estimates, not quotes. No bookings have been made.','notice'));
    function section(title,parent=page){const node=element('section');node.append(element('h2',title));parent.append(node);return node;}
    function table(parent,headers,rows){const wrap=element('div','','table-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',headers.join(', '));const table=element('table');const head=element('thead'),tr=element('tr');headers.forEach(label=>{const th=element('th',label);th.scope='col';tr.append(th)});head.append(tr);table.append(head);const body=element('tbody');rows.forEach(cells=>{const row=element('tr');cells.forEach(content=>{const cell=element('td');if(content instanceof Node)cell.append(content);else cell.textContent=String(content);row.append(cell)});body.append(row)});table.append(body);wrap.append(table);parent.append(wrap);}
    function mapView(parent,map,label){
      if(map?.status==='map' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(map.image||'')){
        const image=element('img');image.className='map';image.alt=label;image.src=map.image;image.onload=resize;image.onerror=()=>{image.replaceWith(element('p','Map image unavailable. Route details remain below.','empty'));resize()};parent.append(image);
      }else if(map?.status==='diagram' && map.points?.length>1){
        const points=map.points.filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));if(points.length>1){
          const lng=points.map(p=>p[0]),lat=points.map(p=>p[1]),minX=Math.min(...lng),minY=Math.min(...lat),dx=Math.max(...lng)-minX||1,dy=Math.max(...lat)-minY||1;
          const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 900 320');svg.setAttribute('class','map');svg.setAttribute('role','img');svg.setAttribute('aria-label',label+' (route diagram without a basemap)');
          const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',points.map(p=>(35+(p[0]-minX)/dx*830)+','+(285-(p[1]-minY)/dy*250)).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#286aa8');line.setAttribute('stroke-width','4');svg.append(line);parent.append(svg);
        }
      }else parent.append(element('p',map?.caption||'A live map is unavailable. No sample route is shown.','empty'));
      if(map?.status!=='unavailable')parent.append(element('p',map?.caption||'','caption'));
    }
    const route=section('The journey');mapView(route,meta?.map,plan.move.origin+' to '+plan.move.destination);
    route.append(element('p',plan.route.status==='live'?plan.route.distanceMiles+' miles · about '+plan.route.durationHours+' hours driving · '+plan.route.source:plan.route.warning));
    route.append(element('p',plan.flights.warning,'notice'));
    const housing=section('Homes to compare');
    housing.append(element('p',plan.move.needsHousing?plan.housing.totalMatches+' live options within '+money(plan.move.maxRent)+'/month and at least '+plan.move.minBedrooms+' bedroom(s). Showing up to 8.':'You said housing is already arranged.'));
    if(meta?.housingMap)mapView(housing,meta.housingMap,'Rental locations in '+plan.move.destination+'; marker numbers match the table');
    if(plan.housing.options.length){
      table(housing,['Home / address','Monthly rent','Beds / baths','Availability','Source'],plan.housing.options.map((home,i)=>{const name=element('div',(i+1)+'. '+home.title);name.append(element('small',home.address));return [name,money(home.monthlyRent),home.bedrooms+' / '+home.bathrooms,home.availability,sourceLink('Search address',home.sourceUrl)];}));
    }else housing.append(element('p',plan.move.needsHousing?'No verified matching rentals are available in this result. Adjust your requirements or check current listings.':'Rental search was not requested.','empty'));
    if(plan.housing.excludedCount)housing.append(element('p',plan.housing.excludedCount+' sample or out-of-criteria rentals were excluded.'));
    housing.append(element('p','Pet policies, fees, move-in dates, and availability need confirmation. Address links open rental searches, not verified listing pages.'));
    if(plan.move.needsHousing&&plan.housing.browseUrl)housing.append(sourceLink('Browse rentals in '+plan.move.destination,plan.housing.browseUrl));
    const columns=element('div','','columns');page.append(columns);
    const budget=section('Moving budget',columns);
    table(budget,['Allowance','Estimate'],[['Housing upfront',money(plan.budget.housingUpfront)],['Travel',money(plan.budget.transportation)],['Moving services',money(plan.budget.moving)],['Supplies and pets',money(plan.budget.additional)],['Recommended total',money(plan.budget.recommended)],['Your budget',money(plan.budget.budget)]]);
    budget.append(element('p','Housing upfront assumes two months of the rent ceiling plus $250 in fees. The monthly ceiling is an input, not a verified market rent. Estimates can exclude taxes, insurance, and location-specific charges.','caption'));
    const timeline=section('Your timeline',columns);const tasks=element('ol','','checklist');plan.timeline.timeline.forEach(task=>{const item=element('li');const date=element('time',task.dueDate+(task.status==='overdue'?' · catch up now':task.status==='due-today'?' · today':''));date.dateTime=task.dueDate;item.append(date,element('span',task.title));tasks.append(item)});timeline.append(tasks);
    const services=section('Moving services');
    if(plan.movers.options.length)table(services,['Provider','Service / location','Contact'],plan.movers.options.map(mover=>{const info=element('div',mover.service);info.append(element('small',mover.address));const contact=element('div',mover.phone);if(mover.sourceUrl)contact.append(sourceLink('Provider website',mover.sourceUrl));return[mover.name,info,contact]}));
    else services.append(element('p',plan.move.furniture?'No live moving providers are available in this result. Request current quotes and confirm service to your destination.':'Your move has no furniture. Arrange luggage or a small shipment if needed.','empty'));
    services.append(element('p','Provider search results do not confirm availability, service coverage, or prices.'));
    const strategies=section('Ways to make the move');plan.strategies.forEach(strategy=>{const block=element('div','','strategy');block.append(element('h3',strategy.label+' · '+money(strategy.cost)),element('p',strategy.transport+' · '+strategy.service+'. '+strategy.explanation));strategies.append(block)});strategies.append(element('p','Strategy estimates are transport/service comparisons, separate from the full budget above.','caption'));
    const next=section('What to do next');next.append(element('p',plan.readiness.nextAction,'briefing'));const blockers=element('ul');plan.readiness.blockers.forEach(blocker=>blockers.append(element('li',blocker.action)));next.append(blockers);
    const assumptions=element('details');assumptions.open=true;assumptions.append(element('summary','Assumptions and unconfirmed details'));const list=element('ul');plan.assumptions.forEach(text=>list.append(element('li',text)));assumptions.append(list);page.append(assumptions);
    const provenance=section('Sources and data status');table(provenance,['Data','Provider','Status / checked'],[['Route',plan.route.source||'Mapbox',plan.route.status],['Housing',plan.housing.source,plan.housing.status+' · '+plan.housing.fetchedAt],['Moving services',plan.movers.source,plan.movers.status+' · '+plan.movers.fetchedAt],['Flights',plan.flights.source,'Unavailable · fictional examples omitted'],['Budget and timeline','MoveFlow planning rules','Estimates / checklist']]);
    [plan.housing.warning,plan.movers.warning].filter(Boolean).forEach(text=>provenance.append(element('p',text,'caption')));
    page.append(element('footer','Generated '+plan.generatedAt+' · This plan is not saved to an account.'));
    resize();
  }
`;
