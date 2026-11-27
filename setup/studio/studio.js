/* Cenkbot setup studio. Talks only to the local studio server, which writes plain files in the cenkbot folder. */
const $ = id => document.getElementById(id);
const url = new URL(location.href);
if (url.searchParams.get('t')) { sessionStorage.setItem('cenkbot-setup', url.searchParams.get('t')); history.replaceState(null, '', '/'); }
const token = sessionStorage.getItem('cenkbot-setup') || '';

const TEXT = {
  tr: {
    navLook: 'görünüm', navAbout: 'hakkında', navKeys: 'anahtarlar', navSite: 'siteye bağla',
    title: 'Sitene küçük bir asistan.', lead: 'Nasıl görüneceğini seç, ne bildiğini yaz, anahtarlarını ekle. Sağda gördüğün, sitende göreceğin şeyin aynısı.',
    look: 'Görünüm', icon: 'İkon', upload: 'kendi görselin', botName: 'Adı', greeting: 'İlk mesajı', placeholder: 'Yazı alanındaki ipucu', accent: 'Renk', position: 'Konum', right: 'sağ alt', left: 'sol alt',
    about: 'Hakkında', aboutNote: 'Burada yazdığın her şeyi ziyaretçiler sorabilir. Yalnızca herkese açık bilgi yaz.', language: 'Yanıt dili', owner: 'Site kimin?', aboutText: 'Kendini ve işini anlat', projects: 'Projeler', addProject: '+ proje ekle', contact: 'İletişim',
    tone: 'Tavır', warm: 'sıcak', formal: 'resmî', neutral: 'nötr', detail: 'Yanıt uzunluğu', brief: 'kısa', balanced: 'dengeli',
    keys: 'Anahtarlar', keysNote: 'Anahtarlar yalnızca bu bilgisayardaki .env.local dosyasına yazılır, tarayıcıya ya da siteye gitmez.', getKey: 'anahtar al', model: 'Model', modelHint: 'openrouter/free ücretsiz bir model seçer. Daha tutarlı yanıt için belirli bir model yaz.', review: 'Jev ile yanıtları denetle',
    site: 'Siteye bağla', siteUrl: 'Sitenin adresi', serviceUrl: 'Cenkbot servisinin adresi', serviceHint: 'Statik ya da başka altyapıdaki siteler için Cenkbot ayrı küçük bir servis olarak yayına çıkar.', connect: 'Siteye ekle',
    save: 'Kaydet', previewHint: 'Önizleme sohbeti kaydedilmiş bilgiyle ve anahtarınla çalışır.',
    projectName: 'ad', projectSummary: 'kısa açıklama', projectUrl: 'bağlantı', remove: 'sil',
    saved: 'Kaydedildi.', saving: 'Kaydediliyor…', connecting: 'Siteye ekleniyor, bağımlılıklar kuruluyor…', need: 'Site sahibini ve kısa tanıtımı yaz.',
    keySaved: 'kayıtlı. Değiştirmek için yenisini yaz.', keyMissing: 'henüz yok', docs: n => `content/ klasöründe ${n} belge var. İstersen oraya kendi .md dosyalarını da koyabilirsin.`,
    nextSite: 'Next.js sitesi bulundu', nextHow: 'Cenkbot aynı domainde /api/cenkbot olarak çalışır, ayrıca bir şey barındırman gerekmez.',
    serviceSite: 'Site bulundu', serviceHow: 'Cenkbot ayrı küçük bir servis olarak çalışır, widget kodu sayfana eklenir.',
    noSite: 'Bu klasör bir sitenin içinde değil', noSiteHow: 'cenkbot klasörünü sitenin kök klasörüne koy ve kurulumu oradan aç.',
    changed: 'Değişen dosyalar', next: 'Sıradaki', snippet: 'Sayfana eklenen kod', done: 'Siteye eklendi.',
    greetingDefault: owner => `Merhaba! ${owner || 'Benim'} hakkında, projeleri ve deneyimi üzerine sorabilirsin.`,
    nameDefault: owner => owner ? `${owner} asistanı` : 'Cenkbot', mockText: 'Kendini ve işini anlattığın kısa metin burada görünür.',
  },
  en: {
    navLook: 'look', navAbout: 'about', navKeys: 'keys', navSite: 'connect',
    title: 'A small assistant for your site.', lead: 'Pick how it looks, tell it what it knows, add your keys. What you see on the right is what your visitors will see.',
    look: 'Look', icon: 'Icon', upload: 'your image', botName: 'Name', greeting: 'First message', placeholder: 'Input hint', accent: 'Color', position: 'Position', right: 'bottom right', left: 'bottom left',
    about: 'About', aboutNote: 'Visitors can ask about anything you write here. Only add public information.', language: 'Reply language', owner: 'Whose site is this?', aboutText: 'Describe yourself and your work', projects: 'Projects', addProject: '+ add a project', contact: 'Contact',
    tone: 'Tone', warm: 'warm', formal: 'formal', neutral: 'neutral', detail: 'Answer length', brief: 'brief', balanced: 'balanced',
    keys: 'Keys', keysNote: 'Keys are written only to .env.local on this computer. They never reach the browser or your site.', getKey: 'get a key', model: 'Model', modelHint: 'openrouter/free picks a free model. Name a specific model for steadier answers.', review: 'Check replies with Jev',
    site: 'Connect your site', siteUrl: 'Your site address', serviceUrl: 'Cenkbot service address', serviceHint: 'For static sites and other stacks, Cenkbot goes live as its own small service.', connect: 'Add to my site',
    save: 'Save', previewHint: 'The preview chat uses your saved content and key.',
    projectName: 'name', projectSummary: 'short description', projectUrl: 'link', remove: 'remove',
    saved: 'Saved.', saving: 'Saving…', connecting: 'Adding to your site and installing dependencies…', need: 'Add the owner and a short description.',
    keySaved: 'saved. Type a new one to replace it.', keyMissing: 'not added yet', docs: n => `There are ${n} documents in content/. You can drop your own .md files there too.`,
    nextSite: 'Next.js site found', nextHow: 'Cenkbot runs on your own domain at /api/cenkbot. Nothing else to host.',
    serviceSite: 'Site found', serviceHow: 'Cenkbot runs as its own small service and the widget code goes into your page.',
    noSite: 'This folder is not inside a website', noSiteHow: 'Put the cenkbot folder in your site\'s root folder and open setup from there.',
    changed: 'Changed files', next: 'Next', snippet: 'Code added to your page', done: 'Added to your site.',
    greetingDefault: owner => `Hi! Ask me about ${owner ? owner + '\'s' : 'my'} projects and experience.`,
    nameDefault: owner => owner ? `${owner}'s assistant` : 'Cenkbot', mockText: 'The short text about you and your work shows up here.',
  },
};
let ui = 'tr';
let state = null;
const form = { icon: 'cenkbot', accent: '#5b4bd6', position: 'right', language: 'tr', tone: 'warm', detail: 'brief', projects: [], upload: null };
const t = key => TEXT[ui][key];

async function api(path, payload) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Setup-Token': token }, body: JSON.stringify(payload ?? {}) });
  const data = await response.json().catch(() => ({ error: 'invalid response' }));
  if (response.status === 403) throw new Error(ui === 'tr' ? 'Bu sayfayı terminaldeki bağlantıdan aç.' : 'Open this page from the link in the terminal.');
  return data;
}

/* ---------- text ---------- */
function translate() {
  document.documentElement.lang = ui;
  for (const el of document.querySelectorAll('[data-t]')) { const value = t(el.dataset.t); if (typeof value === 'string') el.textContent = value; }
  for (const button of document.querySelectorAll('[data-lang]')) button.setAttribute('aria-pressed', String(button.dataset.lang === ui));
  renderProjects(); renderKeys(); renderSite(); renderDocs(); preview();
}

/* ---------- projects ---------- */
function renderProjects() {
  const root = $('projects');
  root.replaceChildren();
  form.projects.forEach((project, index) => {
    const row = document.createElement('div');
    row.className = 'project';
    for (const [key, label] of [['name', 'projectName'], ['summary', 'projectSummary'], ['url', 'projectUrl']]) {
      const input = document.createElement('input');
      input.value = project[key] || ''; input.placeholder = t(label); input.setAttribute('aria-label', t(label));
      input.addEventListener('input', () => { project[key] = input.value; });
      row.append(input);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', t('remove'));
    remove.addEventListener('click', () => { form.projects.splice(index, 1); renderProjects(); });
    row.append(remove);
    root.append(row);
  });
}
$('addProject').addEventListener('click', () => { form.projects.push({ name: '', summary: '', url: '' }); renderProjects(); $('projects').lastElementChild?.querySelector('input')?.focus(); });

/* ---------- choices ---------- */
function choose(name, value) {
  form[name] = value;
  for (const button of document.querySelectorAll(`.choice[data-name="${name}"] button`)) button.setAttribute('aria-pressed', String(button.dataset.value === value));
  preview();
}
for (const group of document.querySelectorAll('.choice')) for (const button of group.querySelectorAll('button')) button.addEventListener('click', () => choose(group.dataset.name, button.dataset.value));
function pickIcon(name) {
  form.icon = name;
  for (const option of document.querySelectorAll('.icon-option')) option.setAttribute('aria-checked', String(option.dataset.icon === name));
  preview();
}
for (const option of document.querySelectorAll('button.icon-option')) option.addEventListener('click', () => pickIcon(option.dataset.icon));
$('iconFile').addEventListener('change', () => {
  const file = $('iconFile').files[0];
  if (!file) return;
  if (file.size > 512 * 1024) { status(ui === 'tr' ? 'Görsel 512 KB\'tan küçük olmalı.' : 'The image must be under 512 KB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = () => { form.upload = reader.result; $('customIcon').src = reader.result; $('customIcon').hidden = false; pickIcon('custom'); };
  reader.readAsDataURL(file);
});
function setAccent(color) {
  form.accent = color;
  $('accent').value = color;
  document.documentElement.style.setProperty('--accent', color);
  for (const swatch of document.querySelectorAll('.swatch')) swatch.setAttribute('aria-pressed', String(swatch.dataset.color === color));
  preview();
}
for (const swatch of document.querySelectorAll('.swatch')) { swatch.style.setProperty('--c', swatch.dataset.color); swatch.addEventListener('click', () => setAccent(swatch.dataset.color)); }
$('accent').addEventListener('input', () => setAccent($('accent').value));
for (const id of ['owner', 'about-text', 'botName', 'greeting', 'placeholder']) $(id).addEventListener('input', preview);
$('review').addEventListener('change', () => { $('jevField').hidden = !$('review').checked; });
for (const button of document.querySelectorAll('[data-lang]')) button.addEventListener('click', () => { ui = button.dataset.lang; translate(); });

/* ---------- preview ---------- */
const escapeXml = text => text.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
function letterIcon() {
  const letter = ($('owner').value.trim()[0] || 'C').toLocaleUpperCase(form.language === 'tr' ? 'tr-TR' : 'en');
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${form.accent}"/><text x="32" y="43" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="30" font-weight="600" fill="#fff">${escapeXml(letter)}</text></svg>`);
}
function iconSource() {
  if (form.icon === 'letter') return letterIcon();
  if (form.icon === 'custom') return form.upload || '/icon?v=' + Date.now();
  return `/icons/${form.icon}.svg`;
}
function preview() {
  const owner = $('owner').value.trim();
  const lang = form.language;
  const bot = $('bot');
  $('letterIcon').src = letterIcon();
  bot.setAttribute('lang', lang);
  bot.setAttribute('endpoint', `/api/chat?t=${token}`);
  bot.setAttribute('name', $('botName').value.trim() || TEXT[lang].nameDefault(owner));
  bot.setAttribute('greeting', $('greeting').value.trim() || TEXT[lang].greetingDefault(owner));
  bot.setAttribute('accent', form.accent);
  bot.setAttribute('position', form.position);
  bot.setAttribute('icon', iconSource());
  if ($('placeholder').value.trim()) bot.setAttribute('placeholder', $('placeholder').value.trim()); else bot.removeAttribute('placeholder');
  $('botName').placeholder = TEXT[lang].nameDefault(owner);
  $('greeting').placeholder = TEXT[lang].greetingDefault(owner);
  $('mockName').textContent = owner || (ui === 'tr' ? 'Senin siten' : 'Your website');
  $('mockText').textContent = $('about-text').value.trim() || t('mockText');
}

/* ---------- keys, site, docs ---------- */
function renderKeys() {
  if (!state) return;
  for (const name of ['openrouter', 'jev']) {
    const el = $(`${name}State`);
    el.textContent = state.keys[name] ? `✓ ${t('keySaved')}` : t('keyMissing');
    el.className = 'state' + (state.keys[name] ? ' ok' : '');
    $(name).placeholder = state.keys[name] ? '••••••••••••' : '';
  }
}
function renderSite() {
  if (!state) return;
  const info = $('siteInfo');
  const site = state.site;
  const [title, how] = !site.isSite ? [t('noSite'), t('noSiteHow')] : site.kind === 'next' ? [t('nextSite'), t('nextHow')] : [t('serviceSite'), t('serviceHow')];
  info.replaceChildren();
  const strong = document.createElement('strong'); strong.textContent = title;
  const path = document.createElement('span'); path.textContent = site.path;
  const detail = document.createElement('span'); detail.textContent = how;
  info.append(strong, path, detail);
  $('serviceField').hidden = site.kind === 'next';
  $('connect').disabled = !site.isSite;
}
function renderDocs() { if (state) $('docs').textContent = t('docs')(state.docs.length); }

/* ---------- save and connect ---------- */
function answers() {
  const owner = $('owner').value.trim();
  return {
    language: form.language, owner, botName: $('botName').value.trim(), about: $('about-text').value.trim(), contact: $('contact').value.trim(),
    projects: form.projects.filter(p => p.name.trim()).map(p => ({ name: p.name.trim(), summary: p.summary.trim(), url: p.url.trim() })),
    tone: form.tone, detail: form.detail, siteUrl: $('siteUrl').value.trim(), serviceUrl: $('serviceUrl').value.trim(), model: $('model').value.trim() || 'openrouter/free', review: $('review').checked,
    icon: form.icon, accent: form.accent, position: form.position, greeting: $('greeting').value.trim(), placeholder: $('placeholder').value.trim(),
    ...(form.icon === 'custom' && form.upload ? { iconUpload: form.upload } : {}),
  };
}
function status(text, kind = '') { $('status').textContent = text; $('status').className = kind; }
function valid(a) {
  if (!a.owner || !a.about) { status(t('need'), 'error'); location.hash = '#about'; ($('owner').value ? $('about-text') : $('owner')).focus(); return false; }
  return true;
}
async function save() {
  const a = answers();
  if (!valid(a)) return null;
  const keys = { openrouter: $('openrouter').value.trim() || undefined, jev: $('jev').value.trim() || undefined };
  status(t('saving'));
  $('save').disabled = true;
  try {
    const result = await api('/api/save', { answers: a, keys });
    if (!result.ok) { status(result.error || 'Error', 'error'); return null; }
    state = result.state; form.upload = null;
    $('openrouter').value = ''; $('jev').value = '';
    renderKeys(); renderDocs(); preview();
    status(t('saved'), 'ok');
    return result;
  } catch (error) { status(error.message, 'error'); return null; }
  finally { $('save').disabled = false; }
}
$('form').addEventListener('submit', event => { event.preventDefault(); save(); });
$('connect').addEventListener('click', async () => {
  if (!(await save())) return;
  const box = $('result');
  $('connect').disabled = true;
  box.hidden = false;
  box.textContent = t('connecting');
  try {
    const result = await api('/api/connect', { answers: answers() });
    box.replaceChildren();
    if (!result.ok) { const p = document.createElement('p'); p.className = 'error'; p.textContent = result.error; box.append(p); return; }
    state = result.state;
    const done = document.createElement('p'); done.textContent = t('done'); box.append(done);
    const list = (title, items) => { if (!items.length) return; const h = document.createElement('h3'); h.textContent = title; const ul = document.createElement('ul'); for (const item of items) { const li = document.createElement('li'); li.textContent = item; ul.append(li); } box.append(h, ul); };
    list(t('changed'), result.changed);
    list(t('next'), result.notes);
  } catch (error) { box.textContent = error.message; }
  finally { $('connect').disabled = !state?.site.isSite; }
});

/* ---------- navigation highlight ---------- */
const links = [...document.querySelectorAll('.top nav a')];
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) for (const link of links) link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
}, { rootMargin: '-40% 0px -55% 0px' });

/* ---------- start ---------- */
(async () => {
  try {
    state = await api('/api/state');
    if (state.error) throw new Error(state.error);
  } catch (error) { status(error.message, 'error'); return; }
  const a = state.answers;
  ui = a.language === 'en' ? 'en' : 'tr';
  $('owner').value = a.owner || ''; $('about-text').value = a.about || ''; $('contact').value = a.contact || '';
  $('botName').value = a.botName && a.botName !== TEXT[a.language || 'tr'].nameDefault(a.owner) ? a.botName : '';
  $('greeting').value = a.greeting && a.greeting !== TEXT[a.language || 'tr'].greetingDefault(a.owner) ? a.greeting : '';
  $('placeholder').value = a.placeholder || '';
  $('siteUrl').value = a.siteUrl || ''; $('serviceUrl').value = a.serviceUrl || ''; $('model').value = a.model || 'openrouter/free';
  $('review').checked = !!a.review; $('jevField').hidden = !a.review;
  form.projects = (a.projects || []).map(p => ({ name: p.name || '', summary: p.summary || '', url: p.url || '' }));
  choose('language', a.language || 'tr'); choose('tone', a.tone || 'warm'); choose('detail', a.detail || 'brief'); choose('position', a.position || 'right');
  setAccent(a.accent || '#5b4bd6');
  if (a.icon === 'custom') { $('customIcon').src = '/icon?v=' + Date.now(); $('customIcon').hidden = false; }
  pickIcon(a.icon || 'cenkbot');
  translate();
  document.querySelectorAll('section[id]').forEach(section => observer.observe(section));
})();
