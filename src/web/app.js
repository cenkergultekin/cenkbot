/* Public fixture data only. Text is always inserted with textContent, never innerHTML. */
const $ = id => document.getElementById(id);
const node = (tag, text, cls) => { const n = document.createElement(tag); if(text !== undefined)n.textContent=text; if(cls)n.className=cls; return n; };
const pct = n => n === null || n === undefined ? 'ölçülmedi' : (n * 100).toFixed(1) + '%';
const money = n => n === null || n === undefined ? 'bilinmiyor' : '$' + n.toFixed(6);
const ms = n => n === null || n === undefined ? 'ölçülmedi' : Math.round(n) + ' ms';
let runs = [];
const labels = {baseline:'tek model',query:'Jev yönlendirme',guarded:'yanıt denetimi',repair:'tek düzeltme',repair2:'iki düzeltme deneyi'};
const option = (value,text) => {const o=node('option',text);o.value=value;return o;};
function draw(){
  const run=runs.find(r=>r.id===$('run').value);if(!run)return;
  const before=runs.find(r=>r.id===$('previous').value);
  const compatible=before && before.suiteHash===run.suiteHash && before.evaluatorHash===run.evaluatorHash && before.kind===run.kind;
  const selected=run.summary.filter(s=>($('model').value==='all'||s.model===$('model').value)&&($('variant').value==='all'||s.variant===$('variant').value));
  $('provenance').textContent=`${run.version} · ${run.commit.slice(0,7)} · ${run.suiteId}@${run.suiteVersion} · ${run.repeats} tekrar · ${run.runtime}/${run.platform} · ${new Date(run.startedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}`;
  $('recommendation').textContent=run.recommendation?`Ölçümlere göre aday: ${run.recommendation.model}. Canlı ayar otomatik değiştirilmez.`:'Varsayılan model seçimi için henüz yeterli doğrulanmış sonuç yok.';
  $('summary').replaceChildren();$('quality-bars').replaceChildren();$('repairs').replaceChildren();$('deltas').replaceChildren();
  $('compatibility').textContent=!before?'Karşılaştırılacak bir deney seç.':compatible?'Aynı soru kümesi ve değerlendirici. Pozitif geçme farkı iyileşme demektir.':'Bu deneylerin soru kümesi veya değerlendiricisi farklı; doğrudan skor farkı gösterilmiyor.';
  for(const s of selected){
    const tr=node('tr');[`${s.model} / ${labels[s.variant]??s.variant}`,`${pct(s.passRate)} · n=${s.n}`,ms(s.p50Ms),ms(s.p95Ms),money(s.costPerPassUsd),`${s.human.mean===null?'bekliyor':pct(s.human.mean)} · ${s.human.reviewed}/${s.n}`].forEach(v=>tr.append(node('td',v)));$('summary').append(tr);
    const bar=node('div');const label=node('div',undefined,'bar-label');label.append(node('span',`${s.model} · ${labels[s.variant]??s.variant}`),node('span',`${pct(s.passRate)} [${pct(s.passInterval95[0])}–${pct(s.passInterval95[1])}]`));
    const track=node('div',undefined,'bar-track'),fill=node('div',undefined,'bar-fill');fill.style.setProperty('--bar-width',Math.max(0,Math.min(100,s.passRate*100))+'%');track.append(fill);bar.append(label,track);$('quality-bars').append(bar);
    if(s.curve.length>1){const p=node('p',`${s.model} · ${labels[s.variant]}: kurtarılan ${pct(s.recoveryRate)}, bozulan ${pct(s.regressionRate)}, gereksiz düzeltme ${pct(s.unnecessaryRepairRate)}.`);$('repairs').append(p);for(const step of s.curve)$('repairs').append(node('p',`${step.attempt===0?'ilk taslak':`düzeltme ${step.attempt}`}: ${pct(step.passRate)} · n=${step.n} · ${ms(step.p50AttemptMs)} · aşama maliyeti ${money(step.incrementalCostUsd)} · insan ${pct(step.humanMean)} (${step.humanReviewed??0} inceleme)`,'muted'));}
    if(compatible){const p=before.summary.find(p=>p.model===s.model&&p.variant===s.variant);if(p){const diff=(s.passRate-p.passRate)*100;$('deltas').append(node('p',`${s.model} · ${labels[s.variant]}: ${diff>=0?'+':''}${diff.toFixed(1)} puan; p95 ${Math.round(s.p95Ms-p.p95Ms)} ms (${p.n}/${s.n} örnek).`,diff>=0?'positive':'negative'));}}
  }
  if(!selected.some(s=>s.curve.length>1))$('repairs').append(node('p','Bu seçimde düzeltme eğrisi için sonuç yok.','muted'));
  $('cases').replaceChildren();
  const cases=run.cases.filter(c=>($('model').value==='all'||c.model===$('model').value)&&($('variant').value==='all'||c.variant===$('variant').value));
  let count=0;
  for(const c of cases){
    const prior=compatible?before.cases.find(p=>p.caseId===c.caseId&&p.model===c.model&&p.variant===c.variant&&p.repeat===c.repeat):null;
    if($('case-filter').value==='failed'&&c.pass)continue;
    if($('case-filter').value==='changed'&&(!prior||prior.pass===c.pass))continue;
    const d=node('details');d.append(node('summary',`${c.pass?'geçti':'başarısız'} · ${c.caseId} · ${c.model} · ${labels[c.variant]??c.variant}`));
    d.append(node('p',`${ms(c.totalMs)} · ${money(c.costUsd)} · ${c.category} · tekrar ${c.repeat+1}`,'case-meta'));
    for(const a of c.attempts)d.append(node('p',`${a.index===0?'ilk taslak':`düzeltme ${a.index}`} · ${a.pass?'geçti':'başarısız'} · ${a.verdict}\n${a.text}`,'answer'));
    d.append(node('p',`gönderilen yanıt\n${c.finalText}`,'answer'));
    if(prior)d.append(node('p',`önceki sürüm\n${prior.finalText}`,'answer'));
    $('cases').append(d);if(++count>=100)break;
  }
  if(!count)$('cases').append(node('p','Bu filtrede örnek yok.','muted'));
  if(count>=100)$('cases').append(node('p','İlk 100 örnek gösteriliyor; tamamı sonuç verisinde.','muted'));
}
fetch('/cenkbot/data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  if(data.schemaVersion!==1||!Array.isArray(data.runs))throw Error();runs=data.runs;
  if(!runs.length){$('status').textContent='Henüz yayımlanmış gerçek model ölçümü yok. On model adayı seçildi; skorlar eval tamamlandıktan sonra görünecek.';return;}
  $('status').textContent='';$('results').hidden=false;
  $('previous').append(option('none','karşılaştırma yok'));
  for(const r of runs){const label=`${r.version} · ${new Date(r.startedAt).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'})} · ${r.id.slice(-8)}`;$('run').append(option(r.id,label));$('previous').append(option(r.id,label));}
  const fillFilters=()=>{const r=runs.find(r=>r.id===$('run').value);$('model').replaceChildren(option('all','tümü'));$('variant').replaceChildren(option('all','tümü'));for(const m of r.models)$('model').append(option(m.id,m.id));for(const v of r.variants)$('variant').append(option(v,labels[v]??v));draw();};
  $('run').addEventListener('change',fillFilters);for(const id of ['previous','model','variant','case-filter'])$(id).addEventListener('change',draw);fillFilters();
}).catch(()=>{$('status').textContent='Benchmark verisi şu anda yüklenemedi.';});
