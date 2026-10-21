// Runs inside the self-contained MCP App, alongside resultRenderer.
export const planEditorStyles = String.raw`
.plan .editor{font-size:13px;line-height:1.5;border:1px solid var(--line);border-radius:14px;padding:16px;display:grid;gap:16px}
.plan .editor fieldset{min-width:0;gap:16px}.plan .editor legend{font-size:13px;font-weight:600}.plan .editor label{font-size:13px;font-weight:550}
.plan .editor .control{display:grid;gap:8px}.plan .editor .control-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.plan .editor input.entry,.plan .editor select,.plan .editor textarea{background:Canvas;color:CanvasText;border:1px solid var(--line);border-radius:8px;font:inherit;padding:9px;width:100%;min-width:0}
.plan .editor .amount{max-width:112px;text-align:right;font-variant-numeric:tabular-nums}
.plan .editor input[type=range]{width:100%;margin:0;accent-color:CanvasText;cursor:pointer;min-height:24px}
.plan .editor .check{display:flex;align-items:center;gap:9px}.plan .editor input[type=checkbox]{accent-color:CanvasText;width:17px;height:17px}
.plan .editor .estimate-total{font-size:26px;font-weight:650;font-variant-numeric:tabular-nums}.plan .editor .caption{margin:0}.plan .editor details{margin:0;padding:10px 12px}.plan .editor details fieldset{margin-top:18px}
.plan .editor .preferences{display:grid;grid-template-columns:1fr 1fr;gap:14px}.plan .editor .wide{grid-column:1/-1}
.plan .editor .actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.plan .editor button{margin:0;min-height:36px;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:550;line-height:1.25;white-space:nowrap}.plan .editor summary{font-size:13px;font-weight:550;line-height:1.4}.plan .editor .apply{background:CanvasText;color:Canvas}.plan .editor .reset{background:transparent;color:CanvasText;border:1px solid var(--line)}
.plan .editor .status{font-size:13px;margin:0}.plan .editor :disabled{opacity:.5}.plan .editor .preview{padding-bottom:14px;border-bottom:1px solid var(--line)}
@media(max-width:420px){.plan .editor{padding:14px}.plan .editor .preferences{grid-template-columns:1fr}}
`;

export const planEditorRenderer = String.raw`
  function renderPlanEditor(plan, parent) {
    if(!plan.state){parent.append(element('p','Rebuild this plan to enable expense editing.'));return;}
    const form=element('form','','editor');parent.append(form);
    const controls={}, expenses={}, sliders={};
    const money=value=>Number(value).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const preview=element('div','','preview'),total=element('div','','estimate-total'),balance=element('p','','caption');
    preview.append(element('div','Estimated upfront cash needed','eyebrow'),total,balance);form.append(preview);
    const source=plan.budget.estimateSource==='model'?'GPT planning estimates':plan.budget.estimateSource==='user'?'Your applied estimates':'MoveFlow planning rules';
    form.append(element('p',source+'. Editable estimates, not live quotes or verified market averages.','caption'));
    const group=element('fieldset');group.append(element('legend','Adjust estimated expenses (USD)'));form.append(group);
    const defaults={monthlyRent:plan.budget.monthlyRent,transportation:plan.budget.transportation,moving:plan.budget.moving,temporaryAccommodation:plan.budget.temporaryAccommodation||0,additional:plan.budget.additional,housingFees:plan.budget.housingFees??250};
    function expense(key,label,max){
      const wrap=element('div','','control'),heading=element('div','','control-heading'),title=element('label',label),input=element('input'),slider=element('input');
      input.type='number';input.id='cost-'+key;input.className='entry amount';input.min='0';input.max='1000000';input.step='any';input.value=String(defaults[key]);input.required=true;title.htmlFor=input.id;
      slider.type='range';slider.min='0';slider.max=String(Math.max(max,defaults[key]*2));slider.step='1';slider.value=input.value;slider.setAttribute('aria-label',label+' slider');
      input.oninput=()=>{slider.max=String(Math.max(Number(slider.max),Number(input.value)||0));slider.value=input.value;refresh();};
      slider.oninput=()=>{input.value=slider.value;refresh();};
      heading.append(title,input);wrap.append(heading,slider);group.append(wrap);expenses[key]=input;sliders[key]=slider;
    }
    expense('monthlyRent','Monthly rent assumption',6000);
    const depositLabel=element('label','','check'),deposit=element('input');deposit.type='checkbox';deposit.checked=plan.budget.includeSecurityDeposit??true;deposit.onchange=()=>refresh();depositLabel.append(deposit,element('span',"Include security deposit equal to one month's rent"));group.append(depositLabel);
    expense('housingFees','Housing fees',1500);
    expense('transportation','Travel and luggage',4000);
    expense('moving','Moving services',8000);
    expense('temporaryAccommodation','Temporary accommodation',3000);
    expense('additional','Other costs and contingency',4000);
    const details=element('details');details.append(element('summary','Edit move preferences'));form.append(details);
    const preferences=element('fieldset');preferences.className='preferences';preferences.append(element('legend','Your move'));details.append(preferences);
    const fields=plan.state.fields;
    function preference(key,label,type,value,options){
      const wrap=element('div','','control'+(type==='textarea'?' wide':'')),title=element('label',label),input=element(options?'select':type==='textarea'?'textarea':'input');
      input.id='preference-'+key;title.htmlFor=input.id;
      if(options)options.forEach(([value,label])=>{const option=element('option',label);option.value=value;input.append(option);});
      else if(type!=='textarea'){input.type=type;input.className='entry';input.required=true;if(type==='number'){input.min=key==='adults'?'1':'0';input.max=['adults','children','pets','minBedrooms'].includes(key)?'20':key==='suitcases'?'1000':'1000000';input.step=['maxRent','budget'].includes(key)?'any':'1';}}
      if(type==='textarea')input.maxLength=1500;
      input.value=String(value??'');input.oninput=()=>refresh();input.onchange=()=>refresh();wrap.append(title,input);preferences.append(wrap);controls[key]=input;
    }
    preference('adults','Adults','number',plan.move.adults);
    preference('children','Children','number',plan.move.children);
    preference('pets','Pets','number',plan.move.pets);
    preference('suitcases','Suitcases / boxes','number',fields.suitcases??2*(plan.move.adults+plan.move.children));
    preference('furniture','What are you bringing?','select',plan.move.furniture?'true':'false',[['false','Luggage / boxes only'],['true','Furniture and household belongings']]);
    preference('transport','Preferred travel','select',plan.move.transport,[['compare','Compare driving and flying'],['fly','Flight'],['drive','Drive']]);
    preference('needsHousing','Housing','select',String(plan.move.needsHousing),[['true','Find a rental'],['false','Already arranged']]);
    preference('maxRent','Maximum monthly rent (USD)','number',plan.move.maxRent);
    preference('minBedrooms','Minimum bedrooms','number',plan.move.minBedrooms);
    preference('movingDate','Move date','date',plan.move.movingDate);
    preference('budget','Total available budget (USD)','number',plan.budget.budget);
    preference('otherNeeds','Additional preferences','textarea',fields.otherNeeds);
    const actions=element('div','','actions'),apply=element('button','Update plan','apply'),reset=element('button','Reset edits','reset');apply.type='submit';reset.type='button';actions.append(apply,reset);form.append(actions);
    const status=element('p','','status');status.setAttribute('role','status');form.append(status);
    function number(input){return Number(input.value)||0;}
    function refresh(){
      const housing=controls.needsHousing?controls.needsHousing.value==='true':plan.move.needsHousing;
      const furniture=controls.furniture?controls.furniture.value==='true':plan.move.furniture;
      ['monthlyRent','housingFees'].forEach(key=>{expenses[key].disabled=!housing;sliders[key].disabled=!housing;});deposit.disabled=!housing;
      expenses.moving.disabled=!furniture;sliders.moving.disabled=!furniture;
      const rent=housing?number(expenses.monthlyRent):0;
      const value=rent*(deposit.checked?2:1)+(housing?number(expenses.housingFees):0)+number(expenses.transportation)+(furniture?number(expenses.moving):0)+number(expenses.temporaryAccommodation)+number(expenses.additional);
      total.textContent=money(value);const remaining=(controls.budget?number(controls.budget):plan.budget.budget)-value;
      balance.textContent=(remaining<0?'Budget gap: ':'Budget remaining: ')+money(Math.abs(remaining))+' · Preview; apply to refresh the full plan.';
    }
    reset.onclick=()=>{if(busy)return;renderPlan(plan,currentPlanMeta);};
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;
      if(typeof form.reportValidity==='function'&&!form.reportValidity())return;
      const changes={};
      Object.entries(controls).forEach(([key,input])=>{const value=['furniture','needsHousing'].includes(key)?input.value==='true':['transport','movingDate','otherNeeds'].includes(key)?input.value:number(input);const previous=fields[key]??(key==='transport'?plan.move.transport:key==='suitcases'?2*(plan.move.adults+plan.move.children):'');if(value!==previous)changes[key]=value;});
      const estimates={source:'user',includeSecurityDeposit:deposit.checked};Object.entries(expenses).forEach(([key,input])=>{estimates[key]=number(input);});
      busy=true;apply.disabled=true;reset.disabled=true;group.disabled=true;preferences.disabled=true;apply.textContent='Updating…';status.textContent='Refreshing housing, expenses and your timeline…';root.querySelector('.error')?.remove();
      try{
        const reply=await request('tools/call',{name:'update_move_plan',arguments:{state:plan.state,changes,estimates}});
        update(reply);
        if(reply.structuredContent?.status==='ready'){
          const latest=reply.structuredContent;
          const latestStatus=root.querySelector('.status');
          if(latestStatus)latestStatus.textContent='Plan updated · '+money(latest.budget.recommended)+' total · '+(latest.budget.remaining<0?money(Math.abs(latest.budget.remaining))+' over budget':money(latest.budget.remaining)+' remaining');
          // Keep future conversation context current without creating a chat turn.
          request('ui/update-model-context',{content:[{type:'text',text:JSON.stringify({move:latest.move,budget:latest.budget,nextAction:latest.readiness.nextAction})}]}).catch(()=>{});
        }
      }catch(e){apply.disabled=false;reset.disabled=false;group.disabled=false;preferences.disabled=false;apply.textContent='Retry update';status.textContent='Your edits are still here.';showError(e?.message||'The plan could not be updated. Try again.');}
      finally{busy=false;resize();}
    };
    refresh();
  }
`;
