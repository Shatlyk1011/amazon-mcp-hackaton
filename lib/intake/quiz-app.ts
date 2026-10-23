import { resultRenderer, resultStyles } from "./result-app";
import { planEditorRenderer, planEditorStyles } from "./plan-editor";

export const quizResourceUri = "ui://moveflow/quiz-v5.html";
export const resultResourceUri = "ui://moveflow/plan-v4.html";

// A self-contained resource lets MCP Apps hosts render it without fetching assets.
export const quizHtml = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif;color:var(--color-text-primary,CanvasText);background:var(--color-background-primary,Canvas)}
html{scrollbar-width:none}html::-webkit-scrollbar{display:none}
*{box-sizing:border-box}body{margin:0;padding:16px}main{max-width:540px;margin:auto}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.65}h1{font-size:22px;line-height:1.25;margin:10px 0}p{line-height:1.45;opacity:.78;margin:0 0 16px}fieldset{border:0;padding:0;margin:0;display:grid;gap:8px}legend{font-weight:600;margin-bottom:10px}.option{display:flex;align-items:center;gap:12px;border:1px solid color-mix(in srgb,CanvasText 22%,transparent);border-radius:12px;padding:12px;cursor:pointer}.option:has(input:checked){border-color:#3275b8;background:color-mix(in srgb,#3275b8 12%,Canvas)}input[type=radio]{accent-color:#3275b8;width:18px;height:18px;margin:0;flex:none}label.text-label{display:block;font-weight:600;font-size:14px;margin:16px 0 8px}textarea,input.entry{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,CanvasText 30%,transparent);border-radius:10px;padding:10px;width:100%}textarea{resize:vertical;min-height:72px}button{font:inherit;font-weight:650;border:0;border-radius:10px;background:#286aa8;color:white;padding:11px 18px;margin-top:16px;cursor:pointer}button:disabled{opacity:.5;cursor:wait}:focus-visible{outline:3px solid #6ba6e0;outline-offset:2px}.error{color:#c63636;opacity:1;margin-top:12px}.summary{white-space:pre-wrap}
.intake-progress{font-size:13px;margin:0 0 12px}.answers{margin:18px 0;border:1px solid color-mix(in srgb,CanvasText 18%,transparent);border-radius:10px;padding:12px}.answers summary{cursor:pointer;font-size:13px;font-weight:600}.answers dl{margin:12px 0 0}.answers dl>div{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;padding:6px 0}.answers dt{font-weight:550}.answers dd{margin:0;text-align:right;overflow-wrap:anywhere}.sync-status{margin-top:16px;border-top:1px solid color-mix(in srgb,CanvasText 18%,transparent);padding-top:12px;font-size:12px}.sync-status p{font-size:12px;margin:0}.sync-status button{margin-top:8px;padding:8px 12px;font-size:12px}.sync-status[hidden]{display:none}
${resultStyles}
${planEditorStyles}
</style></head><body><main><div class="eyebrow">MoveFlow</div><div id="connection-status" class="sync-status" role="status" hidden></div><div id="app" role="region" aria-live="polite"><h1>Preparing your move…</h1></div></main>
<script>
(() => {
  const root = document.getElementById('app');
  let view, busy = false, building = false, buildError, nextId = 0, currentPlanMeta;
  let latestContext, syncing = false, contextRevision = 0;
  const mapDisposers = [];
  const pending = new Map();
  const notify = (method, params) => parent.postMessage({jsonrpc:'2.0',method,params}, '*');
  const request = (method, params) => new Promise((resolve,reject) => {
    const id = ++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('The request timed out. Try again.'));},method==='tools/call'?120000:15000);
    pending.set(id,{resolve,reject,timer});
    parent.postMessage({jsonrpc:'2.0',id,method,params}, '*');
  });
  function element(tag, text, className) { const el=document.createElement(tag); if(text) el.textContent=text; if(className) el.className=className; return el; }
  let lastHeight=0;
  function resize() {
    // Leave room for fractional pixel rounding in the host's iframe sizing.
    const height=Math.ceil(document.body.getBoundingClientRect().height)+2;
    if(height>0&&height!==lastHeight){lastHeight=height;notify('ui/notifications/size-changed',{height});}
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(document.body);
  window.addEventListener('resize',resize);
  root.addEventListener('toggle',resize,true);
  function showError(message, parent=root) { let el=parent.querySelector('.error'); if(!el){el=element('p','','error');el.setAttribute('role','alert');parent.append(el)} el.textContent=message; resize(); }
${planEditorRenderer}
${resultRenderer}
  function readResult(result) { return result?._meta?.moveflow?.view ?? result?.structuredContent; }
  function disposeMaps() { mapDisposers.splice(0).forEach(dispose=>dispose()); }
  function contextStatus(failed) {
    const status=document.getElementById('connection-status');
    if(!status)return;
    status.hidden=!failed;status.replaceChildren();
    if(failed){
      status.append(element('p','Your progress is kept in MoveFlow, but chat could not receive the latest details. You can keep using this widget.'));
      const retry=element('button','Retry chat sync');retry.type='button';retry.onclick=()=>{contextStatus(false);void flushContext()};status.append(retry);
    }
    resize();
  }
  async function flushContext() {
    if(syncing||!latestContext)return;
    syncing=true;const revision=contextRevision;
    try{
      await request('ui/update-model-context',{content:[{type:'text',text:JSON.stringify(latestContext)}]});
      if(revision===contextRevision)contextStatus(false);
    }catch{
      if(revision===contextRevision)contextStatus(true);
    }finally{
      syncing=false;
      if(revision!==contextRevision)void flushContext();
    }
  }
  function syncContext(data) {
    latestContext={...data,interactionMode:'widget',owner:'moveflow'};contextRevision++;void flushContext();
  }
  function syncPlan(plan) {
    syncContext({status:'plan_ready',state:plan.state,move:plan.move,budget:plan.budget,housing:plan.housing,nextAction:plan.readiness?.nextAction,instruction:'The MoveFlow widget has completed the intake and displays the plan. Do not restart the quiz or repeat its questions. Answer follow-ups using these confirmed details.'});
  }
  function update(result) {
    if(result && result.isError) { const error=new Error(result.content?.[0]?.text || 'Could not save your answer.'); error.toolMessage=true; throw error; }
    const data=readResult(result);
    if(data?.interaction?.mode==='conversation'){
      disposeMaps();root.replaceChildren(element('h1','Continuing in chat'),element('p','Answer the questions in the conversation. MoveFlow will use those answers to build your plan.'));resize();return;
    }
    if(data?.status==='ready'&&data.readiness){
      const plan=data;
      renderPlan(plan,result._meta?.moveflow);
      syncPlan(plan);
      return;
    }
    if(!data?.state||typeof data.ready!=='boolean'||(!data.ready&&!data.nextQuestion)) throw new Error('MoveFlow could not load its questions. Ask to continue in chat if reopening the widget does not help.');
    view=data; buildError=undefined; render();
    syncContext({status:view.ready?'building_plan':'intake_in_progress',state:view.state,remainingQuestions:view.remainingQuestions,instruction:'The MoveFlow widget handles the intake. Do not ask its questions in chat or start a second quiz.'});
    if(view.ready) void buildPlan();
  }
  async function buildPlan() {
    if(building)return;
    building=true; buildError=undefined; render();
    try {
      update(await request('tools/call',{name:'generate_move_plan',arguments:{state:view.state,interactionMode:'widget'}}));
    } catch(e) {
      buildError=e?.toolMessage ? e.message : 'The plan could not be built. Your answers are still here; please try again.';
      render();
      syncContext({status:'plan_build_failed',state:view.state,instruction:'The MoveFlow widget retains the answers and offers a retry. Do not restart the quiz.'});
    } finally { building=false; }
  }
  function render() {
    disposeMaps();
    root.replaceChildren();
    if(view.ready){
      if(buildError){
        root.append(element('h1','Your plan could not be built'),element('p','Your answers are still here.'));
        const button=element('button','Retry building my plan'); root.append(button);
        button.onclick=()=>buildPlan();
        showError(buildError);
      }else{
        root.append(element('h1','Building your moving plan…'),element('p','Checking rental options and routes, estimating costs, and preparing your next steps. Your answers are complete.'));
      }
      resize(); return;
    }
    const q=view.nextQuestion; if(!q){showError('No question is available. Continue in the conversation.');return;}
    const answered=view.summary?.length??0;
    root.append(element('p',answered?'Your move details · '+view.remainingQuestions+' '+(view.remainingQuestions===1?'question':'questions')+' remaining':'Let’s set up your move','intake-progress'));
    root.append(element('h1',q.title),element('p',q.description));
    if(view.extractionWarning)root.append(element('p',view.extractionWarning,'notice'));
    const form=element('form'); const group=element('fieldset');
    if(q.options.length){ group.append(element('legend','Choose one'));
      q.options.forEach(option=>{const label=element('label','','option');const radio=element('input');radio.type='radio';radio.name='choice';radio.value=option.id;label.append(radio,element('span',option.label));group.append(label)});
      form.append(group);
    }
    const textLabel=element('label',q.options.length?'Or enter your own answer':'Your answer','text-label');textLabel.htmlFor='answer';form.append(textLabel);
    const input=element(q.inputType==='date'||q.inputType==='number'?'input':'textarea');input.id='answer';input.className='entry';input.placeholder=q.placeholder || '';if(q.inputType==='date'||q.inputType==='number')input.type=q.inputType;if(q.inputType==='number')input.min='1';if(q.inputType==='date')input.min=view.state.referenceDate;form.append(input);
    const button=element('button','Continue');button.type='submit';form.append(button);root.append(form);
    input.addEventListener('input',()=>{if(input.value)form.querySelectorAll('input[type=radio]').forEach(r=>r.checked=false)});
    group.addEventListener('change',()=>{input.value=''});
    form.onsubmit=async event=>{event.preventDefault();if(busy)return;const choice=form.querySelector('input[name=choice]:checked');const text=input.value.trim();if(!choice&&!text){showError('Choose an option or enter an answer.');return;}
      busy=true;button.disabled=true;input.disabled=true;group.disabled=true;button.textContent='Saving…';root.querySelector('.error')?.remove();
      try { const response=await request('tools/call',{name:'answer_move_intake',arguments:{state:view.state,interactionMode:'widget',answer:{questionId:q.id,...(choice?{choice:choice.value}:{text})}}}); update(response); }
      catch(e){showError(e?.message || 'Could not save your answer. Try again.',form);button.disabled=false;input.disabled=false;group.disabled=false;button.textContent='Continue';} finally{busy=false;}
    };
    renderAnsweredDetails(view,root);
    resize();
  }
  function renderAnsweredDetails(data,parent) {
    const entries=data.summary??Object.entries(data.state?.fields??{}).map(([field,value])=>({field,value}));
    const labels={origin:'Moving from',destination:'Moving to',movingDate:'Move date',adults:'Adults',children:'Children',pets:'Pets',furniture:'Bringing furniture',needsHousing:'Find a rental',maxRent:'Monthly rent limit',minBedrooms:'Minimum bedrooms',bedrooms:'Bedrooms',budget:'Available budget',transport:'Travel preference',otherNeeds:'Other needs',petInfo:'Pet details',workInfo:'Work details',accessibilityNeeds:'Accessibility needs'};
    const visible=entries.filter(item=>labels[item.field]);if(!visible.length)return;
    const details=element('details','','answers');details.append(element('summary','Your confirmed details'));
    const list=element('dl');visible.forEach(item=>{const row=element('div');const value=item.value;row.append(element('dt',labels[item.field]),element('dd',String(value)==='true'?'Yes':String(value)==='false'?'No':String(value)));list.append(row)});details.append(list);parent.append(details);
    if(data.state&&data.nextQuestion){
      const back=element('button','Edit previous answer');back.type='button';back.onclick=()=>{
        if(busy)return;
        showIntakeEdit(data);
      };details.append(back);
    }
  }
  function showIntakeEdit(data) {
    const labels={origin:'Moving from',destination:'Moving to',adults:'Adults',children:'Children',movingDate:'Move date',minBedrooms:'Minimum bedrooms',bedrooms:'Bedrooms',maxRent:'Monthly rent limit'};
    const panel=element('form','','intake-edit');const label=element('label','Detail to change');label.htmlFor='edit-intake-field';
    const select=element('select');select.id='edit-intake-field';select.className='entry';
    Object.keys(labels).filter(key=>data.state.fields[key]!==undefined).forEach(key=>{const option=element('option',labels[key]);option.value=key;select.append(option)});
    const input=element('input');input.id='edit-intake-answer';input.className='entry';input.required=true;input.setAttribute('aria-label','Updated answer');
    select.onchange=()=>{input.type=['origin','destination'].includes(select.value)?'text':select.value==='movingDate'?'date':'number';input.value=String(data.state.fields[select.value]??'');input.min=select.value==='movingDate'?data.state.referenceDate:select.value==='adults'?'1':'0';input.step=select.value==='maxRent'?'any':'1';};
    select.value=Object.keys(labels).find(key=>data.state.fields[key]!==undefined);select.onchange();
    const apply=element('button','Apply answer');apply.type='submit';panel.onsubmit=async event=>{
      event.preventDefault();
      const text=input.value.trim();if(!text||busy)return;
      const value=input.type==='number'?Number(text):text;busy=true;apply.disabled=true;input.disabled=true;select.disabled=true;root.querySelector('.error')?.remove();
      try{update(await request('tools/call',{name:'answer_move_intake',arguments:{state:data.state,interactionMode:'widget',changes:{[select.value]:value}}}))}catch(e){showError(e?.message||'The answer could not be updated.',panel);apply.disabled=false;input.disabled=false;select.disabled=false}finally{busy=false}
    };
    panel.append(label,select,input,apply);root.querySelector('.intake-edit')?.remove();root.append(panel);resize();
  }
  window.addEventListener('message',event=>{if(event.source!==parent)return;const m=event.data;if(!m||m.jsonrpc!=='2.0')return;
    if(typeof m.id==='number'&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);return;}
    if(m.method==='ui/notifications/tool-result'){try{update(m.params)}catch(e){showError(e.message)}}
  });
  request('ui/initialize',{appInfo:{name:'MoveFlow',version:'2.0.0'},appCapabilities:{},protocolVersion:'2026-01-26'}).then(()=>notify('ui/notifications/initialized',{})).catch(()=>showError('The quiz could not connect. Continue in the conversation.'));
})();
</script></body></html>`;
