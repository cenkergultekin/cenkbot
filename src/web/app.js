/* Public fixture data only. Text is always inserted with textContent, never innerHTML. */
const $ = id => document.getElementById(id);
const node = (tag, text, cls) => { const n = document.createElement(tag); if(text !== undefined)n.textContent=text; if(cls)n.className=cls; return n; };
const pct = n => n === null || n === undefined ? 'ölçülmedi' : (n * 100).toFixed(1) + '%';
const money = n => n === null || n === undefined ? 'bilinmiyor' : '$' + n.toFixed(6);
const ms = n => n === null || n === undefined ? 'ölçülmedi' : Math.round(n) + ' ms';
let runs = [];
let capability = 'all';
const labels = {baseline:'tek model',query:'Jev yönlendirme',guarded:'yanıt denetimi',repair:'tek düzeltme',repair2:'iki düzeltme deneyi'};
const option = (value,text) => {const o=node('option',text);o.value=value;return o;};
function draw(){
  const run=runs.find(r=>r.id===$('run').value);if(!run)return;
  const before=runs.find(r=>r.id===$('previous').value);
  const compatible=before && before.suiteHash===run.suiteHash && before.evaluatorHash===run.evaluatorHash && before.kind===run.kind;
  const timingComparable=compatible&&(before.concurrency??1)===(run.concurrency??1)&&before.runtime===run.runtime&&before.platform===run.platform;
  const selected=run.summary.filter(s=>($('model').value==='all'||s.model===$('model').value)&&($('variant').value==='all'||s.variant===$('variant').value));
  $('provenance').textContent=`${run.version} · ${run.commit.slice(0,7)} · ${run.suiteId}@${run.suiteVersion} · ${run.repeats} tekrar · ${run.concurrency??1} test işi · ${run.runtime}/${run.platform} · ${new Date(run.startedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}`;
  $('recommendation').textContent=run.recommendation?`Ölçümlere göre aday: ${run.recommendation.model}. Canlı ayar otomatik değiştirilmez.`:'Varsayılan model seçimi için henüz yeterli doğrulanmış sonuç yok.';
  const accessErrors=Object.entries(run.errorSummary??{}).filter(([code])=>/HTTP (401|402|403|429)/.test(code));
  $('availability').hidden=!accessErrors.length;
  $('availability').textContent=accessErrors.length?`Erişim/kota hataları: ${accessErrors.map(([code,n])=>`${code} (${n})`).join(', ')}. Bu koşunun skor farkı yalnız kodun kalite etkisi olarak yorumlanamaz.`:'';
  $('summary').replaceChildren();$('quality-bars').replaceChildren();$('repairs').replaceChildren();$('deltas').replaceChildren();
  $('compatibility').textContent=!before?'Karşılaştırılacak bir deney seç.':compatible?'Aynı soru kümesi ve değerlendirici. Farklar otomatik kontrollere aittir; neden-sonuç veya istatistiksel üstünlük göstermez.':'Bu deneylerin soru kümesi veya değerlendiricisi farklı; doğrudan skor farkı gösterilmiyor.';
  drawVisuals(run, before, selected);
  for(const s of selected){
    const tr=node('tr');[`${s.model} / ${labels[s.variant]??s.variant}`,`${pct(s.passRate)} · n=${s.n}`,pct(s.successRate),ms(s.p50Ms),ms(s.p95Ms),money(s.costPerPassUsd),`${s.human.mean===null?'bekliyor':pct(s.human.mean)} · ${s.human.reviewed}/${s.n}`].forEach(v=>tr.append(node('td',v)));$('summary').append(tr);
    if(compatible && !accessLimited(run) && !accessLimited(before)){const p=before.summary.find(p=>p.model===s.model&&p.variant===s.variant);if(p){const diff=(s.passRate-p.passRate)*100;const currentTime=answerP95(run,s),priorTime=answerP95(before,p);const timing=timingComparable&&currentTime!==null&&priorTime!==null?`yanıt p95 farkı ${Math.round(currentTime-priorTime)} ms`:'karşılaştırılabilir yanıt süresi yok';$('deltas').append(node('p',`${s.model} · ${labels[s.variant]}: ${diff>=0?'+':''}${diff.toFixed(1)} puan; ${timing} (${p.n}/${s.n} örnek).`,'delta'));}}
  }
  if(compatible && (accessLimited(run)||accessLimited(before))){$('compatibility').textContent='Erişim/kota hatalı koşu içeriyor. Kodun kalite etkisiyle karışmaması için sürüm farkı hesaplanmıyor.';}
  if(compatible && !$('deltas').children.length && !accessLimited(run) && !accessLimited(before))$('deltas').append(node('p','Seçimde eşleşen model / mekanizma yok.','muted'));
  $('cases').replaceChildren();
  const cases=run.cases.filter(c=>($('model').value==='all'||c.model===$('model').value)&&($('variant').value==='all'||c.variant===$('variant').value));
  let count=0;
  for(const c of cases){
    const prior=compatible?before.cases.find(p=>p.caseId===c.caseId&&p.model===c.model&&p.variant===c.variant&&p.repeat===c.repeat):null;
    if($('case-filter').value==='failed'&&c.pass)continue;
    if($('case-filter').value==='changed'&&(!prior||prior.pass===c.pass))continue;
    const d=node('details');d.append(node('summary',`${c.pass?'geçti':'başarısız'} · ${c.caseId} · ${c.model} · ${labels[c.variant]??c.variant}`));
    d.append(node('p',`${ms(c.totalMs)} · ${money(c.costUsd)} · ${c.category} · tekrar ${c.repeat+1}`,'case-meta'));
    const errors=(c.requests??[]).filter(r=>r.status==='error');if(errors.length)d.append(node('p',errors.map(r=>`${r.purpose}: ${r.error??'istek başarısız'}`).join(' · '),'case-meta'));
    for(const a of c.attempts)d.append(node('p',`${a.index===0?'ilk taslak':`düzeltme ${a.index}`} · ${a.pass?'geçti':'başarısız'} · ${a.verdict}${a.acceptedStyleOnly?' · yalnız stil kusuru kabul edildi':''}\n${a.text}`,'answer'));
    d.append(node('p',`gönderilen yanıt\n${c.finalText}`,'answer'));
    if(prior)d.append(node('p',`önceki sürüm\n${prior.finalText}`,'answer'));
    $('cases').append(d);if(++count>=100)break;
  }
  if(!count)$('cases').append(node('p','Bu filtrede örnek yok.','muted'));
  if(count>=100)$('cases').append(node('p','İlk 100 örnek gösteriliyor; tamamı sonuç verisinde.','muted'));
}
const releaseText = {'0.1.1':'on modelin başlangıç ölçümü','0.1.2':'Jev ve düzeltme karşılaştırması','0.1.3':'kısalık politikasının yeniden testi'};
const groups = {all:null, knowledge:['facts','typos','unknown','false-premise','reasoning'],context:['context','compose'],boundaries:['privacy','commitment','injection','scope'],language:['language','style','social']};
const captions = {all:'Bütün soru kategorileri. Model sıralaması yalnız seçili mekanizma ve bu koşu için geçerlidir.',knowledge:'Olgular, yazım hataları, bilinmeyen bilgi, yanlış öncül ve akıl yürütme. İçeriğe yönelik sabit kontroller.',context:'Önceki konuşmayı izleme ve bilgileri birleştirme. Sabit senaryoların otomatik kontrolleri.',boundaries:'Gizlilik, taahhüt, talimat saldırısı ve kapsam. Birkaç örnekte başarı güvenlik garantisi değildir.',language:'Dil, uzunluk ve sosyal konuşmaya yönelik kontroller. Akıcılık veya üslup tercihi insan tarafından puanlanmadı.'};
const short = model => model.split('/').pop();
const accessLimited = run => Object.keys(run.errorSummary??{}).some(code=>/HTTP (401|402|403)/.test(code));
const rowsFor = (run,s) => run.cases.filter(c=>c.model===s.model&&c.variant===s.variant);
function answerP95(run,s){const times=rowsFor(run,s).filter(c=>c.status==='ok'&&c.attempts.length>0).map(c=>c.totalMs).sort((a,b)=>a-b);return times.length?times[Math.ceil(times.length*.95)-1]:null;}
function barRow(label,value,n,kind=''){const row=node('div',undefined,'bar-row '+kind),head=node('div',undefined,'bar-label');head.append(node('span',label),node('span',`${pct(value)} · n=${n}`));const track=node('div',undefined,'bar-track'),fill=node('div',undefined,'bar-fill');fill.style.width=Math.max(0,Math.min(100,value*100))+'%';track.append(fill);row.append(head,track);return row;}
const svgNode = (tag,attrs,text) => {const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs??{}))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;return el;};
function scatter(target,points,xLabel,format){
  const root=$(target);root.replaceChildren();
  if(!points.length){root.append(node('p','Karşılaştırılabilir ölçüm yok.','empty-chart'));return;}
  const svg=svgNode('svg',{viewBox:'0 0 480 350',role:'img','aria-label':`${xLabel} ve otomatik test başarısı. Noktaların değerleri aşağıdaki listede.`});
  const max=Math.max(...points.map(p=>p.x))*1.15||1, x=v=>52+v/max*382,y=v=>280-v*224;
  for(const rate of [0,.25,.5,.75,1]){svg.append(svgNode('line',{x1:52,x2:434,y1:y(rate),y2:y(rate),class:'plot-grid'}),svgNode('text',{x:42,y:y(rate)+4,'text-anchor':'end'},Math.round(rate*100)+'%'));}
  for(const ratio of [0,.5,1])svg.append(svgNode('text',{x:x(max*ratio),y:304,'text-anchor':'middle'},format(max*ratio)));
  svg.append(svgNode('text',{x:52,y:28},'otomatik test başarısı'),svgNode('text',{x:243,y:335,'text-anchor':'middle'},xLabel));
  points.forEach((p,i)=>{const circle=svgNode('circle',{cx:x(p.x),cy:y(p.y),r:6,class:`point series-${i%10}`});circle.append(svgNode('title',{},`${p.label}: ${pct(p.y)}, ${format(p.x)}${p.n!==undefined?`, n=${p.n}`:''}`));svg.append(circle);});
  root.append(svg);const list=node('ul',undefined,'plot-key');points.forEach((p,i)=>{const item=node('li'),dot=node('span',undefined,`key-dot series-${i%10}`);dot.setAttribute('aria-hidden','true');item.append(dot,node('span',p.label),node('span',`${format(p.x)} · ${pct(p.y)}${p.n!==undefined?` · n=${p.n}`:''}`));list.append(item);});root.append(list);
}
function correctionCurve(rows,s){
  const svg=svgNode('svg',{viewBox:'0 0 420 190',role:'img','aria-label':'Sabit ilk taslak örnekleminde taslak başarısı. Düzeltmeye girmeyen turlarda son taslak korunur. Gönderim başarısı üstteki çubuklarda.'});
  const last=Math.max(...rows.map(c=>c.attempts.length-1)),x=i=>44+i/Math.max(1,last)*330,y=rate=>146-rate*114;
  for(const rate of [0,.5,1])svg.append(svgNode('line',{x1:44,x2:374,y1:y(rate),y2:y(rate),class:'plot-grid'}),svgNode('text',{x:35,y:y(rate)+4,'text-anchor':'end'},Math.round(rate*100)+'%'));
  const rates=Array.from({length:last+1},(_,i)=>rows.filter(c=>c.attempts[Math.min(i,c.attempts.length-1)].pass).length/rows.length);
  svg.append(svgNode('polyline',{points:rates.map((rate,i)=>`${x(i)},${y(rate)}`).join(' '),fill:'none',stroke:'var(--accent)','stroke-width':2}));
  rates.forEach((rate,i)=>{svg.append(svgNode('circle',{cx:x(i),cy:y(rate),r:4,fill:'var(--accent)'}),svgNode('text',{x:x(i),y:y(rate)-10,'text-anchor':'middle'},pct(rate)),svgNode('text',{x:x(i),y:171,'text-anchor':'middle'},i===0?'ilk taslak':`düzeltme ${i}`));});
  const figure=node('figure',undefined,'correction-curve');figure.append(svg,node('figcaption',`Taslak eğrisi · sabit n=${rows.length}. Düzeltmeye girmeyen turda son taslak korunur; gönderim başarısı ayrı gösterilir.`));return figure;
}
function drawVisuals(run,before,selected){
  for(const b of $('releases').children)b.setAttribute('aria-pressed',String(b.dataset.run===run.id));
  const humanCount=selected.reduce((sum,s)=>sum+s.human.reviewed,0);
  $('scope').textContent=`${run.version} · ${new Set(selected.map(s=>s.model)).size} model · ${selected.reduce((sum,s)=>sum+s.n,0)} tur · ${humanCount?humanCount+' tur insan incelemeli':'insan incelemesi yok'}`;
  $('human-note').textContent=humanCount?'İnsan incelemesi kapsamı ayrıntılı tabloda ayrıca gösterilir.':'İnsan incelemesi henüz yapılmadı.';
  $('dataset-note').textContent=`${run.suiteId}@${run.suiteVersion} · ${new Set(run.cases.map(c=>c.caseId)).size} sabit sentetik soru · ${run.repeats} tekrar · ${run.models.length} model · ${run.variants.length} mekanizma. On modellik ilk koşu yalnız tek model mekanizmasını; sonraki koşular üç modeli kapsar. Bu küçük, açık soru kümesi genel yetenek sıralaması değildir.`;
  $('capability-caption').textContent=captions[capability];
  const measured=selected.map(s=>{const rows=rowsFor(run,s).filter(c=>!groups[capability]||groups[capability].includes(c.category));return {s,n:rows.length,rate:rows.length?rows.filter(c=>c.pass).length/rows.length:null};}).sort((a,b)=>(b.rate??-1)-(a.rate??-1));
  for(const {s,n,rate} of measured)if(n)$('quality-bars').append(barRow(`${short(s.model)} · ${labels[s.variant]??s.variant}`,rate,n));
  if(!measured.some(m=>m.n))$('quality-bars').append(node('p','Bu test alanında örnek yok.','muted'));
  $('mechanisms').replaceChildren();
  for(const model of [...new Set(selected.map(s=>s.model))]){
    const conditions=run.summary.filter(s=>s.model===model);if(conditions.length<2)continue;
    const block=node('article');block.append(node('h3',short(model)));
    for(const s of conditions)block.append(barRow(labels[s.variant]??s.variant,s.passRate,s.n,s.variant==='baseline'?'initial':''));
    $('mechanisms').append(block);
  }
  if(!$('mechanisms').children.length)$('mechanisms').append(node('p','Bu koşuda yalnız tek model mekanizması test edildi. Jev karşılaştırması için 0.1.2 koşusunu seç.','muted'));
  const limited=accessLimited(run);
  const plotSelected=$('variant').value==='all'?selected.filter(s=>s.variant==='baseline'):selected;
  const speed=limited?[]:plotSelected.flatMap(s=>{const x=answerP95(run,s);return x===null?[]:[{label:short(s.model),x:x/1000,y:s.passRate,n:rowsFor(run,s).filter(c=>c.status==='ok'&&c.attempts.length>0).length}];});
  const cost=limited?[]:plotSelected.filter(s=>s.costPerPassUsd!==null&&s.costPerPassUsd!==undefined).map(s=>({label:short(s.model),x:s.costPerPassUsd,y:s.passRate}));
  scatter('speed-chart',speed,'yanıt p95 · saniye',v=>v.toFixed(1)+' s');scatter('cost-chart',cost,'geçen yanıt başına USD',v=>'$'+v.toFixed(5));
  $('plot-note').textContent=limited?'Bu koşu erişim/kota hatası içeriyor. Hız ve maliyet sıralaması gösterilmiyor; test başarısındaki düşüş kodun kalite etkisi olarak yorumlanamaz.':`${$('variant').value==='all'?'Bu iki grafikte mekanizmaları karıştırmamak için yalnız tek model koşulu kullanılıyor. ':''}${plotSelected.length-speed.length} sonuçta kullanılabilir yanıt süresi, ${plotSelected.length-cost.length} sonuçta tam maliyet yok. Başarı ekseni tüm turların otomatik test sonucudur.`;
  const repairSelection=run.summary.filter(s=>s.curve.length>1&&($('model').value==='all'||s.model===$('model').value)&&(!['repair','repair2'].includes($('variant').value)||s.variant===$('variant').value));
  for(const s of repairSelection){
    const rows=rowsFor(run,s).filter(c=>c.attempts.length>0);if(!rows.length)continue;
    const block=node('article',undefined,'repair-block');block.append(node('h3',`${short(s.model)} · ${labels[s.variant]??s.variant}`));
    block.append(barRow('ilk taslak',rows.filter(c=>c.attempts[0].pass).length/rows.length,rows.length,'initial'),barRow('gönderilen sonuç',rows.filter(c=>c.pass).length/rows.length,rows.length));
    block.append(correctionCurve(rows,s));
    block.append(node('p',`Düzeltilen turlarda: kurtarılan ${pct(s.recoveryRate)} · bozulan ${pct(s.regressionRate)} · gereksiz düzeltme ${pct(s.unnecessaryRepairRate)}`,'chart-caption'));
    const detail=node('details');detail.append(node('summary','aşama örneklemleri ve maliyet'));
    for(const step of s.curve)detail.append(node('p',`${step.attempt===0?'ilk taslak':`düzeltme ${step.attempt}`}: ${pct(step.passRate)} · n=${step.n} · ${ms(step.p50AttemptMs)} · ${money(step.incrementalCostUsd)}`,'case-meta'));
    const repaired=rows.filter(c=>c.attempts.length>1),firstBad=repaired.filter(c=>!c.attempts[0].pass).length;detail.append(node('p',`Oran paydaları: kurtarma ${firstBad} ilk hatalı taslak; bozma ${repaired.length-firstBad} ilk geçen taslak; gereksiz düzeltme ${repaired.length} düzeltilen tur.`,'case-meta'));
    block.append(detail);$('repairs').append(block);
  }
  if(!$('repairs').children.length)$('repairs').append(node('p','Düzeltme etkisini görmek için tek düzeltme veya iki düzeltme deneyini seç.','muted'));
}
fetch('/cenkbot/data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  if(data.schemaVersion!==1||!Array.isArray(data.runs))throw Error();runs=data.runs;
  if(!runs.length){$('status').textContent='Henüz yayımlanmış gerçek model ölçümü yok. On model adayı seçildi; skorlar eval tamamlandıktan sonra görünecek.';return;}
  $('status').textContent='';$('results').hidden=false;
  $('previous').append(option('none','karşılaştırma yok'));
  for(const r of runs){const label=`${r.version} · ${new Date(r.startedAt).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'})} · ${r.id.slice(-8)}`;$('run').append(option(r.id,label));$('previous').append(option(r.id,label));}
  const usable=runs.find(r=>!accessLimited(r));
  if(usable)$('run').value=usable.id;
  $('selection-note').textContent=usable&&usable.id!==runs[0].id?`Başlangıçta erişim/kota sorunu olmayan son koşu (${usable.version}) gösteriliyor. En yeni ${runs[0].version} koşusu da yukarıdan incelenebilir.`:'Her sürüm kendi deney koşullarıyla saklanır.';
  const fillFilters=()=>{const r=runs.find(r=>r.id===$('run').value);$('model').replaceChildren(option('all','tümü'));$('variant').replaceChildren(option('all','tümü'));for(const m of r.models)$('model').append(option(m.id,m.id));for(const v of r.variants)$('variant').append(option(v,labels[v]??v));if(r.variants.includes('baseline'))$('variant').value='baseline';draw();};
  for(const r of runs){const b=node('button',undefined,'release');b.type='button';b.dataset.run=r.id;b.append(node('strong',r.version),node('span',releaseText[r.version]??'kayıtlı deney'),node('small',`${r.models.length} model · ${r.cases.length} tur${accessLimited(r)?' · erişim/kota etkisi':''}`));b.addEventListener('click',()=>{$('run').value=r.id;fillFilters();});$('releases').append(b);}
  const tabs=[...$('capabilities').querySelectorAll('[role=tab]')];
  const activate=tab=>{capability=tab.dataset.capability;for(const t of tabs){t.setAttribute('aria-selected',String(t===tab));t.tabIndex=t===tab?0:-1;}$('capability-panel').setAttribute('aria-labelledby',tab.id);draw();};
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();tabs[next].focus();activate(tabs[next]);}});});
  $('run').addEventListener('change',fillFilters);for(const id of ['previous','model','variant','case-filter'])$(id).addEventListener('change',draw);fillFilters();
}).catch(()=>{$('status').textContent='Benchmark verisi şu anda yüklenemedi.';});
