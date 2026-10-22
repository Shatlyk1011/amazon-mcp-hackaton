import { resultRenderer, resultStyles } from "./result-app";
import { planEditorRenderer, planEditorStyles } from "./plan-editor";

export const quizResourceUri = "ui://moveflow/quiz-v4.html";
export const resultResourceUri = "ui://moveflow/plan-v3.html";

// A self-contained resource lets MCP Apps hosts render it without fetching assets.
export const quizHtml = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif;color:var(--color-text-primary,CanvasText);background:var(--color-background-primary,Canvas)}
*{box-sizing:border-box}body{margin:0;padding:16px}main{max-width:540px;margin:auto}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.65}h1{font-size:22px;line-height:1.25;margin:10px 0}p{line-height:1.45;opacity:.78;margin:0 0 16px}fieldset{border:0;padding:0;margin:0;display:grid;gap:8px}legend{font-weight:600;margin-bottom:10px}.option{display:flex;align-items:center;gap:12px;border:1px solid color-mix(in srgb,CanvasText 22%,transparent);border-radius:12px;padding:12px;cursor:pointer}.option:has(input:checked){border-color:#3275b8;background:color-mix(in srgb,#3275b8 12%,Canvas)}input[type=radio]{accent-color:#3275b8;width:18px;height:18px;margin:0;flex:none}label.text-label{display:block;font-weight:600;font-size:14px;margin:16px 0 8px}textarea,input.entry{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,CanvasText 30%,transparent);border-radius:10px;padding:10px;width:100%}textarea{resize:vertical;min-height:72px}button{font:inherit;font-weight:650;border:0;border-radius:10px;background:#286aa8;color:white;padding:11px 18px;margin-top:16px;cursor:pointer}button:disabled{opacity:.5;cursor:wait}:focus-visible{outline:3px solid #6ba6e0;outline-offset:2px}.error{color:#c63636;opacity:1;margin-top:12px}.summary{white-space:pre-wrap}
${resultStyles}
${planEditorStyles}
</style></head><body><main><div class="eyebrow">MoveFlow</div><div id="app" role="region" aria-live="polite"><h1>Preparing your move…</h1></div></main>
<script>
(() => {
  const root = document.getElementById('app');
  let view, busy = false, building = false, buildError, nextId = 0, currentPlanMeta;
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
  function showError(message) { let el=root.querySelector('.error'); if(!el){el=element('p','','error');el.setAttribute('role','alert');root.append(el)} el.textContent=message; resize(); }
${planEditorRenderer}
${resultRenderer}
  function update(result) {
    if(result && result.isError) { const error=new Error(result.content?.[0]?.text || 'Could not save your answer.'); error.toolMessage=true; throw error; }
    if(result?.structuredContent?.status==='ready'){renderPlan(result.structuredContent,result._meta?.moveflow);return;}
    if(!result?.structuredContent?.state) throw new Error('The quiz response was incomplete.');
    view=result.structuredContent; buildError=undefined; render();
    if(view.ready) void buildPlan();
  }
  async function buildPlan() {
    if(building)return;
    building=true; buildError=undefined; render();
    try {
      update(await request('tools/call',{name:'generate_move_plan',arguments:{state:view.state}}));
    } catch(e) {
      buildError=e?.toolMessage ? e.message : 'The plan could not be built. Your answers are still here; please try again.';
      render();
    } finally { building=false; }
  }
  function render() {
    root.replaceChildren();
    if(view.ready){
      if(buildError){
        root.append(element('h1','Your plan could not be built'),element('p','Your answers are still here.'));
        const button=element('button','Retry building my plan'); root.append(button);
        button.onclick=()=>buildPlan();
        showError(buildError);
      }else{
        root.append(element('h1','Building your moving plan…'),element('p','We’re preparing your budget, housing options, moving services, and next steps.'));
      }
      resize(); return;
    }
    const q=view.nextQuestion; if(!q){showError('No question is available. Continue in the conversation.');return;}
    root.append(element('h1',q.title),element('p',q.description));
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
      busy=true;button.disabled=true;button.textContent='Saving…';root.querySelector('.error')?.remove();
      try { const response=await request('tools/call',{name:'answer_move_intake',arguments:{state:view.state,answer:{questionId:q.id,...(choice?{choice:choice.value}:{text})}}}); update(response); }
      catch(e){showError(e?.message || 'Could not save your answer. Try again.');button.disabled=false;button.textContent='Continue';} finally{busy=false;}
    };
    resize();
  }
  window.addEventListener('message',event=>{if(event.source!==parent)return;const m=event.data;if(!m||m.jsonrpc!=='2.0')return;
    if(typeof m.id==='number'&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);return;}
    if(m.method==='ui/notifications/tool-result'){try{update(m.params)}catch(e){showError(e.message)}}
  });
  request('ui/initialize',{appInfo:{name:'MoveFlow',version:'2.0.0'},appCapabilities:{},protocolVersion:'2026-01-26'}).then(()=>notify('ui/notifications/initialized',{})).catch(()=>showError('The quiz could not connect. Continue in the conversation.'));
})();
</script></body></html>`;
