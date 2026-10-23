// Runs inside the self-contained MCP App, alongside resultRenderer.
export const planEditorStyles = String.raw`
.plan .editor{font-size:13px;line-height:1.5;border:1px solid var(--line);border-radius:14px;padding:16px;display:grid;gap:16px}
.plan .editor fieldset{min-width:0;gap:16px}.plan .editor legend{font-size:13px;font-weight:600}.plan .editor label{font-size:13px;font-weight:550}
.plan .editor .control{display:grid;gap:8px}.plan .editor .control-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.plan .editor input.entry,.plan .editor select,.plan .editor textarea{background:Canvas;color:CanvasText;border:1px solid var(--line);border-radius:8px;font:inherit;padding:9px;width:100%;min-width:0}
.plan .editor .amount{max-width:112px;text-align:right;font-variant-numeric:tabular-nums}
.plan .editor input[type=range]{width:100%;margin:0;accent-color:CanvasText;cursor:pointer;min-height:24px}
.plan .editor .check{display:flex;align-items:center;gap:9px}.plan .editor input[type=checkbox]{accent-color:CanvasText;width:17px;height:17px}
.plan .editor .estimate-total{font-size:26px;font-weight:650;font-variant-numeric:tabular-nums}.plan .editor .caption{margin:0}.plan .editor details{margin:0;padding:10px 12px}.plan .editor details>fieldset{margin-top:18px}
.plan .editor .preferences{display:grid;gap:18px}.plan .editor .preferences>legend{display:none}
.plan .editor .radio-group{display:grid;gap:4px}.plan .editor .radio-group legend{font-weight:550;margin-bottom:4px}.plan .editor .radio-group+.radio-group{border-top:1px solid var(--line);padding-top:16px}
.plan .editor .radio-option{display:flex;align-items:center;gap:9px;min-height:32px;cursor:pointer;font-weight:400}.plan .editor input[type=radio]{accent-color:CanvasText;width:18px;height:18px;margin:0;flex:none}
.plan .editor .household-counts{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px}.plan .editor .household-counts[hidden]{display:none}
.plan .editor .extra-preferences{display:grid;grid-template-columns:1fr 1fr;gap:14px}.plan .editor .extra-preferences>legend{font-weight:550}
.plan .editor .actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.plan .editor button{margin:0;min-height:36px;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:550;line-height:1.25;white-space:nowrap}.plan .editor summary{font-size:13px;font-weight:550;line-height:1.4}.plan .editor .apply{background:CanvasText;color:Canvas}.plan .editor .reset{background:transparent;color:CanvasText;border:1px solid var(--line)}
.plan .editor .status{font-size:13px;margin:0}.plan .editor :disabled{opacity:.5}.plan .editor .preview{padding-bottom:14px;border-bottom:1px solid var(--line)}
@media(max-width:420px){.plan .editor{padding:14px}.plan .editor .extra-preferences{grid-template-columns:1fr}}
`;

export const planEditorRenderer = String.raw`
  function renderPlanEditor(plan, parent) {
    if(!plan.state){parent.append(element('p','Rebuild this plan to enable expense editing.'));return;}
    const form=element('form','','editor');parent.append(form);
    const controls={}, expenses={}, sliders={};
    const money=value=>Number(value).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const preview=element('div','','preview'),total=element('div','','estimate-total'),balance=element('p','','caption');
    preview.append(element('div','Estimated starting cost','eyebrow'),total,balance);form.append(preview);
    const source=plan.budget.estimateSource==='model'?'AI cost estimates':plan.budget.estimateSource==='user'?'Your cost estimates':'MoveFlow cost estimates';
    form.append(element('p',source+'. You can change these estimates. They are not based on verified statistics or current company quotes.','caption'));
    const group=element('fieldset');group.append(element('legend','Change estimated costs (USD)'));form.append(group);
    const defaults={monthlyRent:plan.budget.monthlyRent,transportation:plan.budget.transportation,additional:plan.budget.additional+(plan.budget.housingFees??0)+(plan.budget.moving||0)+(plan.budget.temporaryAccommodation||0)};
    function expense(key,label,max){
      const wrap=element('div','','control'),heading=element('div','','control-heading'),title=element('label',label),input=element('input'),slider=element('input');
      input.type='number';input.id='cost-'+key;input.className='entry amount';input.min='0';input.max='1000000';input.step='any';input.value=String(defaults[key]);input.required=true;title.htmlFor=input.id;
      slider.type='range';slider.min='0';slider.max=String(Math.max(max,defaults[key]*2));slider.step='1';slider.value=input.value;slider.setAttribute('aria-label',label+' slider');
      const changed=()=>{
        // Apply the chosen rent to the search as well as the expense estimate.
        if(key==='monthlyRent')controls.maxRent.value=input.value;
        refresh();
      };
      input.oninput=()=>{slider.max=String(Math.max(Number(slider.max),Number(input.value)||0));slider.value=input.value;changed();};
      slider.oninput=()=>{input.value=slider.value;changed();};
      heading.append(title,input);wrap.append(heading,slider);group.append(wrap);expenses[key]=input;sliders[key]=slider;
      if(key==='monthlyRent')wrap.append(element('p','Changing rent also updates the rental search limit. Select Update plan to refresh homes and the map. You can set a different limit in Edit move details.','caption'));
    }
    expense('monthlyRent','Estimated monthly rent',6000);
    const depositLabel=element('label','','check'),deposit=element('input');deposit.type='checkbox';deposit.checked=plan.budget.includeSecurityDeposit??true;deposit.onchange=()=>refresh();depositLabel.append(deposit,element('span',"Include security deposit equal to one month's rent"));group.append(depositLabel);
    expense('transportation','Travel and luggage',4000);
    expense('additional','Other costs (housing fees, movers, a temporary stay, supplies, and extra costs)',4000);
    const details=element('details');details.append(element('summary','Edit move details'));form.append(details);
    const preferences=element('fieldset');preferences.className='preferences';preferences.append(element('legend','Your move'));details.append(preferences);
    const fields=plan.state.fields;
    function preference(key,label,type,value,parent=preferences){
      const wrap=element('div','','control'),title=element('label',label),input=element(type==='textarea'?'textarea':'input');
      input.id='preference-'+key;title.htmlFor=input.id;
      if(type!=='textarea'){input.type=type;input.className='entry';input.required=key!=='budget'||fields.budget!==undefined;if(type==='number'){input.min=key==='adults'?'1':'0';input.max=['adults','children','pets','minBedrooms'].includes(key)?'20':key==='suitcases'?'1000':'1000000';input.step=['maxRent','budget'].includes(key)?'any':'1';}}
      if(type==='textarea')input.maxLength=1500;
      input.value=String(value??'');input.oninput=()=>refresh();input.onchange=()=>refresh();wrap.append(title,input);parent.append(wrap);controls[key]=input;
    }
    function radioPreference(key,label,value,options,onChange){
      const group=element('fieldset','','radio-group'),control={value:String(value)};
      group.id='preference-'+key;group.append(element('legend',label));
      options.forEach(([value,label])=>{
        const wrap=element('label','','radio-option'),radio=element('input');radio.type='radio';radio.name='preference-'+key;radio.id='preference-'+key+'-'+value;radio.value=value;radio.checked=control.value===value;radio.required=true;
        radio.onchange=()=>{if(!radio.checked)return;control.value=radio.value;if(onChange)onChange(radio.value);refresh();};wrap.append(radio,element('span',label));group.append(wrap);
      });
      preferences.append(group);return {group,control};
    }
    const householdValue=plan.move.children===0&&plan.move.adults===1?'solo':plan.move.children===0&&plan.move.adults===2?'couple':'family';
    const household=radioPreference('household',"Who's moving?",householdValue,[['solo','Just me'],['couple','Two adults'],['family','Family / group']],value=>{
      householdCounts.hidden=value!=='family';
      if(value!=='family'){controls.adults.value=value==='solo'?'1':'2';controls.children.value='0';}
      resize();
    });
    const householdCounts=element('div','','household-counts');householdCounts.hidden=householdValue!=='family';household.group.append(householdCounts);
    preference('adults','Adults','number',plan.move.adults,householdCounts);
    preference('children','Children','number',plan.move.children,householdCounts);
    controls.furniture=radioPreference('furniture','What are you bringing?',String(plan.move.furniture),[['false','Suitcases and moving boxes'],['true','Furniture and other belongings']]).control;
    controls.needsHousing=radioPreference('needsHousing','Housing',String(plan.move.needsHousing),[['true','Find a rental'],['false','Already arranged']]).control;
    preference('maxRent','Monthly rent limit (USD)','number',plan.move.maxRent);
    controls.transport=radioPreference('transport','How you want to travel',plan.move.transport,[['fly','Flight'],['drive','Drive'],['compare','Compare driving and flying']]).control;
    preference('movingDate','Move date','date',plan.move.movingDate);
    preference('budget','Total available budget (USD, optional)','number',plan.budget.budget);
    const extraDetails=element('details');extraDetails.append(element('summary','More move details'));preferences.append(extraDetails);
    const extraPreferences=element('fieldset','','extra-preferences');extraPreferences.append(element('legend','Packing and housing details'));extraDetails.append(extraPreferences);
    preference('pets','Pets','number',plan.move.pets,extraPreferences);
    preference('suitcases','Suitcases / boxes','number',fields.suitcases??2*(plan.move.adults+plan.move.children),extraPreferences);
    preference('minBedrooms','Minimum bedrooms','number',plan.move.minBedrooms,extraPreferences);
    preference('otherNeeds','Other needs','textarea',fields.otherNeeds);
    const actions=element('div','','actions'),apply=element('button','Update plan','apply'),reset=element('button','Reset edits','reset');apply.type='submit';reset.type='button';actions.append(apply,reset);form.append(actions);
    const status=element('p','','status');status.setAttribute('role','status');form.append(status);
    function number(input){return Number(input.value)||0;}
    function refresh(){
      const housing=controls.needsHousing?controls.needsHousing.value==='true':plan.move.needsHousing;
      expenses.monthlyRent.disabled=!housing;sliders.monthlyRent.disabled=!housing;deposit.disabled=!housing;
      const rent=housing?number(expenses.monthlyRent):0;
      const value=rent*(deposit.checked?2:1)+number(expenses.transportation)+number(expenses.additional);
      total.textContent=money(value);const available=controls.budget.value.trim()===''?null:number(controls.budget);
      balance.textContent=available===null?'Add a budget to compare · Preview; select Update plan to apply these changes.':((available-value)<0?'Over budget: ':'Money left: ')+money(Math.abs(available-value))+' · Preview; select Update plan to apply these changes.';
    }
    reset.onclick=()=>{if(busy)return;renderPlan(plan,currentPlanMeta);};
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;
      if(typeof form.reportValidity==='function'&&!form.reportValidity())return;
      const changes={};
      Object.entries(controls).forEach(([key,input])=>{if(key==='budget'&&input.value.trim()==='')return;const value=['furniture','needsHousing'].includes(key)?input.value==='true':['transport','movingDate','otherNeeds'].includes(key)?input.value:number(input);const previous=fields[key]??(key==='transport'?plan.move.transport:key==='suitcases'?2*(plan.move.adults+plan.move.children):'');if(value!==previous)changes[key]=value;});
      const estimates={source:'user',includeSecurityDeposit:deposit.checked,housingFees:0,moving:0,temporaryAccommodation:0};Object.entries(expenses).forEach(([key,input])=>{estimates[key]=number(input);});
      busy=true;apply.disabled=true;reset.disabled=true;group.disabled=true;preferences.disabled=true;apply.textContent='Updating…';status.textContent=Object.keys(changes).some(key=>['maxRent','minBedrooms','needsHousing','pets'].includes(key))?'Searching rentals and refreshing your plan…':'Updating estimates and refreshing your plan…';root.querySelector('.error')?.remove();
      try{
        const reply=await request('tools/call',{name:'update_move_plan',arguments:{state:plan.state,interactionMode:'widget',changes,estimates}});
        const latest=await update(reply);
        if(latest?.status==='ready'){
          const details=root.querySelector('.editor-details');if(details)details.open=true;
          const latestStatus=root.querySelector('.status');
          if(latestStatus)latestStatus.textContent='Plan updated · '+money(latest.budget.recommended)+' total · '+(latest.move.needsHousing?money(latest.move.maxRent)+'/month limit · '+latest.housing.totalMatches+' matching homes':'housing already arranged')+' · '+(latest.budget.remaining===null?'budget not provided':latest.budget.remaining<0?money(Math.abs(latest.budget.remaining))+' over budget':money(latest.budget.remaining)+' remaining');
        }
      }catch(e){apply.disabled=false;reset.disabled=false;group.disabled=false;preferences.disabled=false;apply.textContent='Retry update';status.textContent='Your edits are still here.';showError(e?.message||'The plan could not be updated. Try again.',form);}
      finally{busy=false;resize();}
    };
    refresh();
  }
`;
