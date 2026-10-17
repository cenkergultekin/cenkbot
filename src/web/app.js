/* Curated presentation data; never render model output or raw traces here. */
const $ = id => document.getElementById(id);
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
const pct = value => (value * 100).toFixed(1) + '%';
const short = model => model.split('/').pop();
const names = { baseline: 'tek model', query: 'Jev yönlendirme', guarded: 'yanıt denetimi', repair: 'tek düzeltme', repair2: 'iki düzeltme' };
const option = (value, text) => { const el = node('option', text); el.value = value; return el; };
let runs = [], modelRun, gateRun, current, previous;
let metric = 'pass', gateView = 'pass', expanded = false;

function bars(target, entries, format, percent = false) {
  const root = $(target);
  root.replaceChildren();
  const known = entries.filter(e => e.value !== null && Number.isFinite(e.value));
  const max = percent ? 1 : Math.max(...known.map(e => e.value), 0) * 1.08 || 1;
  const axis = node('div', undefined, 'bar-axis');
  axis.append(node('span', '0'), node('span', format(max)));
  root.append(axis);
  for (const entry of entries) {
    const row = node('div', undefined, 'result-row' + (entry.highlight ? ' highlighted' : ''));
    const label = node('div', undefined, 'result-label');
    label.append(node('span', entry.label), node('strong', entry.value === null ? entry.missing ?? 'ölçülemedi' : format(entry.value)));
    const track = node('div', undefined, 'result-track');
    if (entry.value !== null) {
      const fill = node('div', undefined, 'result-fill');
      fill.style.width = Math.max(0, Math.min(100, entry.value / max * 100)) + '%';
      track.append(fill);
    }
    row.append(label, track);
    root.append(row);
  }
}
function models() {
  if (!modelRun) { $('model-chart').replaceChildren(node('p', 'Henüz model karşılaştırması yok.', 'empty')); return; }
  const summaries = modelRun.summary.filter(s => s.variant === 'baseline');
  const settings = {
    pass: { title: 'otomatik test başarısı', value: s => s.passRate, format: pct,
      caption: 'Gerekli bilgiyi, kapsamı ve yanıt kurallarını geçen soruların oranı. Başarısız istekler dahil.',
      insight: 'Bu test, genel dil kalitesini veya kullanıcı tercihini ölçmez.' },
    speed: { title: 'yanıt süresi', value: s => s.latencyMs === null ? null : s.latencyMs / 1000, format: v => v.toFixed(1) + ' sn',
      caption: 'Yanıt üretilen turların p95 uçtan uca süresi. Hazır selamlar ve başarısız istekler hariç.',
      insight: 'Daha kısa süre, daha yüksek test başarısı anlamına gelmez.' },
    cost: { title: 'maliyet', value: s => s.costPerPassUsd === null ? null : s.costPerPassUsd * 1000, format: v => '$' + v.toFixed(2),
      caption: 'Testi geçen 1.000 yanıt başına maliyet. Başarısız denemeler dahil; fiyat tahminleri içerebilir.',
      insight: 'Tam maliyeti bilinmeyen sonuçlar fiyat sıralamasına girmez.' },
  };
  const config = settings[metric];
  const entries = summaries.map(s => ({ model:s.model, passRate:s.passRate, label: short(s.model), value: config.value(s), missing: metric === 'cost' ? 'bilinmiyor' : 'yanıt alınamadı' }));
  entries.sort((a,b) => a.value === null ? (b.value === null ? 0 : 1) : b.value === null ? -1 : metric === 'pass' ? b.value - a.value : a.value - b.value);
  // Visual emphasis identifies the leading recorded value, not an accepted production winner.
  if (entries[0]?.value !== null && entries[0]) entries[0].highlight = true;
  $('model-title').textContent = config.title;
  $('model-scope').textContent = `${modelRun.version} · ${summaries.length} model · ${modelRun.questions} soru`;
  $('model-caption').textContent = config.caption;
  const leader = entries.find(e=>e.value!==null);
  $('model-insight').textContent = leader ? metric==='pass' ? `Bu koşudaki en yüksek otomatik geçiş: ${entries.filter(e=>e.value===leader.value).map(e=>e.label).join(' ve ')} · ${pct(leader.value)}.` : `${metric==='speed'?'En kısa yanıt p95’i':'En düşük bilinen maliyet'}: ${leader.label} · test başarısı ${pct(leader.passRate)}.` : config.insight;
  if(modelRun.hasAccessErrors)$('model-caption').textContent += ' Erişim hataları skorda kalır; eksik süre veya maliyet sıralanmaz.';
  $('model-expand').hidden=entries.length<=5;
  $('model-expand').textContent=expanded?'daha az göster':`${entries.length} modelin tamamı`;
  $('model-expand').setAttribute('aria-expanded',String(expanded));
  bars('model-chart', expanded?entries:entries.slice(0,5), config.format, metric === 'pass');
}
const svgNode = (tag, attrs, text) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key,value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text !== undefined) el.textContent = text;
  return el;
};
function correction(summary) {
  const { stages, n, sentRate } = summary.correction;
  const root = $('gate-chart'); root.replaceChildren();
  if (stages.length < 2) { root.append(node('p', 'Bu modelde düzeltme eğrisi için ölçüm yok.', 'empty')); return; }
  const svg = svgNode('svg', { viewBox: '0 0 680 290', role: 'img', 'aria-label': `Sabit ${n} turda taslak başarısı: ${stages.map(pct).join(', ')}. Gönderilen sonuç: ${pct(sentRate)}.` });
  const x = i => 65 + i / (stages.length - 1) * 550, y = rate => 220 - rate * 170;
  for (const rate of [0,.5,1]) {
    svg.append(svgNode('line', {x1:65,x2:615,y1:y(rate),y2:y(rate),class:'curve-grid'}), svgNode('text', {x:48,y:y(rate)+4,'text-anchor':'end'},pct(rate)));
  }
  svg.append(svgNode('polyline', {points:stages.map((rate,i)=>`${x(i)},${y(rate)}`).join(' '),class:'curve-line'}));
  stages.forEach((rate,i)=>svg.append(svgNode('circle',{cx:x(i),cy:y(rate),r:5,class:'curve-point'}),svgNode('text',{x:x(i),y:y(rate)-15,'text-anchor':'middle'},pct(rate)),svgNode('text',{x:x(i),y:252,'text-anchor':'middle'},i===0?'ilk taslak':i===1?'tek düzeltme':'iki düzeltme')));
  root.append(svg);
}
function gate() {
  if (!gateRun) { $('gate-chart').replaceChildren(node('p', 'Henüz denetim karşılaştırması yok.', 'empty')); return; }
  const summaries = gateRun.summary.filter(s => s.model === $('gate-model').value);
  if (gateView === 'pass') {
    $('gate-title').textContent = 'otomatik test başarısı';
    bars('gate-chart', summaries.map(s=>({label:names[s.variant]??s.variant,value:s.passRate,highlight:s.variant==='repair'})),pct,true);
    $('gate-caption').textContent = `Aynı ${gateRun.questions} soru, farklı denetim mekanizmaları. ${gateRun.version} ölçümü.`;
    const baseline = summaries.find(s=>s.variant==='baseline');
    const repairs = summaries.filter(s=>['repair','repair2'].includes(s.variant));
    $('gate-insight').textContent = baseline ? repairs.map(s=>{const diff=(s.passRate-baseline.passRate)*100;return `${names[s.variant]}: ${diff>=0?'+':''}${diff.toFixed(1)} puan`;}).join(' · ') + '. Tek model koşuluna göre.' : 'Karşılaştırma aynı modelin kayıtlı denetim koşullarına aittir.';
  } else {
    const summary = summaries.find(s=>s.variant==='repair2') ?? summaries.find(s=>s.variant==='repair');
    $('gate-title').textContent = 'taslak başarısı';
    if (summary) {
      correction(summary);
      $('gate-caption').textContent = `Aynı ${summary.correction.n} turun taslakları. Düzeltmeye girmeyen turda son taslak korunur.`;
      $('gate-insight').textContent = summary.correction.sentRate === null ? 'Gönderim başarısı ölçülmedi.' : `Kullanıcıya gönderilen sonuçların test başarısı: ${pct(summary.correction.sentRate)}. Taslak başarısı ile gönderim başarısı ayrıdır.`;
    } else {
      $('gate-chart').replaceChildren(node('p','Bu modelde düzeltme ölçümü yok.','empty'));
      $('gate-caption').textContent = ''; $('gate-insight').textContent = '';
    }
  }
}
function versions() {
  const model = $('version-model').value;
  const a = current?.summary.find(s=>s.model===model&&s.variant==='baseline');
  const b = previous?.summary.find(s=>s.model===model&&s.variant==='baseline');
  if (!a || !b) {
    $('version-chart').replaceChildren(node('p', 'Karşılaştırılabilir iki sürüm henüz yok.', 'empty'));
    $('version-caption').textContent = 'Aynı soru kümesi ve değerlendiriciyle ölçülen sürümler gerekir.';
    $('version-insight').textContent = ''; return;
  }
  bars('version-chart', [{label:previous.version,value:b.passRate},{label:current.version,value:a.passRate,highlight:true}],pct,true);
  const diff = (a.passRate-b.passRate)*100;
  $('version-caption').textContent = `aynı ${current.questions} soru · tek model koşulu · aynı değerlendirici`;
  $('version-insight').textContent = `${diff>=0?'+':''}${diff.toFixed(1)} puan. Otomatik test sonucu · ${current.repeats} tekrar.`;
}
function bindTabs(id, attr, panel, change) {
  const tabs = [...$(id).querySelectorAll('[role=tab]')];
  const activate = tab => {
    for (const t of tabs) {t.setAttribute('aria-selected', String(t===tab)); t.tabIndex=t===tab?0:-1;}
    $(panel).setAttribute('aria-labelledby',tab.id); change(tab.dataset[attr]);
  };
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>activate(tab));
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(i+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next!==undefined){event.preventDefault();tabs[next].focus();activate(tabs[next]);}
    });
  });
}
fetch('/cenkbot/data.json').then(response=>{if(!response.ok)throw Error();return response.json();}).then(data=>{
  if(data.schemaVersion!==2||!Array.isArray(data.runs))throw Error();
  runs=data.runs;
  if(data.humanReviewed)$('review-note').textContent='otomatik testler · insan incelemeleri repoda';
  if(!runs.length){$('status').textContent='Henüz yayımlanmış gerçek model ölçümü yok.';return;}
  const usable = runs.filter(r=>!r.blocked);
  // Model comparisons use the broadest same-run baseline; mechanisms use the latest healthy run.
  modelRun = [...usable].sort((a,b)=>b.summary.filter(s=>s.variant==='baseline').length-a.summary.filter(s=>s.variant==='baseline').length)[0];
  gateRun = usable.find(r=>r.summary.some(s=>s.variant!=='baseline'));
  current = usable.find(r=>r.summary.some(s=>s.variant==='baseline'));
  previous = current && usable.find(r=>r.id!==current.id&&r.startedAt<current.startedAt&&r.comparisonKey===current.comparisonKey&&r.summary.some(s=>s.variant==='baseline'&&current.summary.some(c=>c.variant==='baseline'&&c.model===s.model)));
  if(gateRun)for(const model of new Set(gateRun.summary.map(s=>s.model)))$('gate-model').append(option(model,short(model)));
  if(current&&previous)for(const s of current.summary.filter(s=>s.variant==='baseline'&&previous.summary.some(p=>p.variant==='baseline'&&p.model===s.model)))$('version-model').append(option(s.model,short(s.model)));
  $('gate-model').hidden=!gateRun; $('version-model').hidden=!previous;
  $('release-note').textContent=runs.filter(r=>r.blocked).map(r=>`${r.version} ölçümü erişim sorunu nedeniyle karşılaştırmaya alınmadı.`).join(' ');
  $('status').hidden=true; $('results').hidden=false;
  bindTabs('model-tabs','metric','model-panel',value=>{metric=value;expanded=false;models();});
  bindTabs('gate-tabs','gate','gate-panel',value=>{gateView=value;gate();});
  $('model-expand').addEventListener('click',()=>{expanded=!expanded;models();});
  $('gate-model').addEventListener('change',gate); $('version-model').addEventListener('change',versions);
  models(); gate(); versions();
}).catch(()=>{$('status').textContent='Benchmark verisi şu anda yüklenemedi.';});
