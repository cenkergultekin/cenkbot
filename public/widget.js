/* Drop-in Cenkbot widget. Visitor messages and answers are always plain text.
 * <cenk-bot endpoint="/api/chat" lang="en" name="Ada's assistant" greeting="Hi!" icon="/icon" accent="#5b4bd6" position="right"></cenk-bot>
 * Attributes can change at any time; the widget updates in place.
 */
(() => {
  const assetBase = new URL('.', document.currentScript.src);
  if (customElements.get('cenk-bot')) return;
  const css = `
:host{--accent:#5b4bd6;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f1d24}
*{box-sizing:border-box}
.launcher{position:fixed;bottom:24px;right:24px;width:60px;height:60px;padding:0;border:0;border-radius:50%;background:color-mix(in srgb,var(--accent) 10%,#fff);cursor:pointer;box-shadow:0 10px 30px color-mix(in srgb,var(--accent) 28%,transparent);display:grid;place-items:center;transition:transform .2s ease}
.launcher:hover{transform:translateY(-2px)}
.launcher img{width:70%;height:70%;object-fit:contain;border-radius:22%}
.panel{position:fixed;bottom:96px;right:24px;width:min(370px,calc(100vw - 32px));height:min(520px,calc(100dvh - 130px));background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(25,20,40,.18);display:flex;flex-direction:column;overflow:hidden}
:host([position="left"]) .launcher{right:auto;left:24px}
:host([position="left"]) .panel{right:auto;left:24px}
:host([inline]) .launcher,:host([inline]) .panel{position:absolute}
:host([inline]) .launcher{bottom:18px;right:18px}
:host([inline][position="left"]) .launcher{left:18px}
:host([inline]) .panel{top:18px;bottom:92px;height:auto;right:18px;width:min(340px,calc(100% - 36px))}
:host([inline][position="left"]) .panel{left:18px}
.panel[hidden]{display:none}
.head{display:flex;align-items:center;gap:10px;padding:14px 10px 14px 16px}
.head img{width:28px;height:28px;object-fit:contain;border-radius:22%}
.head strong{flex:1;font-weight:600;font-size:15px;letter-spacing:-.01em}
.close{border:0;background:none;cursor:pointer;font-size:22px;line-height:1;color:#6d6878;min-width:44px;min-height:44px;border-radius:12px}
.close:hover{background:#f4f2f7}
.messages{padding:6px 16px 16px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px}
.message{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 13px;margin:0;border-radius:16px;max-width:86%;background:#f4f2f7}
.assistant{align-self:flex-start;border-bottom-left-radius:6px}
.user{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:6px}
.status{align-self:flex-start;color:#7a7484;font-size:12.5px;background:none;padding:2px 4px}
.form{display:flex;gap:8px;padding:12px;background:#faf9fc}
input{font:inherit;min-width:0;flex:1;padding:11px 14px;border:0;border-radius:14px;background:#fff;box-shadow:0 0 0 1px #e6e2ee inset}
button.send{font:inherit;font-weight:600;border:0;background:var(--accent);color:#fff;padding:0 16px;border-radius:14px;cursor:pointer}
input,button.send{min-height:44px}
button:focus-visible,input:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 70%,#fff);outline-offset:2px}
button:disabled{opacity:.55;cursor:wait}
@media(max-width:480px){.launcher{right:16px;bottom:16px}:host([position="left"]) .launcher{left:16px}.panel{right:16px;bottom:88px}:host([position="left"]) .panel{left:16px}}
@media(prefers-reduced-motion:reduce){.launcher{transition:none}}`;
  customElements.define('cenk-bot', class extends HTMLElement {
    static get observedAttributes() { return ['name', 'icon', 'accent', 'greeting', 'placeholder', 'lang', 'open']; }
    attributeChangedCallback() { if (this.shadowRoot) this.apply(); }
    get tr() { return this.getAttribute('lang') === 'tr'; }
    apply() {
      const root = this.shadowRoot, tr = this.tr;
      const name = (this.getAttribute('name') || 'Cenkbot').slice(0, 60);
      const icon = this.getAttribute('icon');
      let src = new URL('cenkbot.svg', assetBase).href;
      if (icon) { try { const url = new URL(icon, location.href); if (['http:', 'https:', 'data:'].includes(url.protocol)) src = url.href; } catch {} }
      const accent = this.getAttribute('accent');
      if (accent && /^#[0-9a-f]{3,8}$/i.test(accent)) this.style.setProperty('--accent', accent); else this.style.removeProperty('--accent');
      for (const img of root.querySelectorAll('img')) img.src = src;
      root.querySelector('.launcher').setAttribute('aria-label', tr ? `${name} ile konuş` : `Chat with ${name}`);
      root.querySelector('.panel').setAttribute('aria-label', name);
      root.querySelector('.head strong').textContent = name;
      root.querySelector('.close').setAttribute('aria-label', tr ? 'Kapat' : 'Close');
      const input = root.querySelector('input');
      input.placeholder = this.getAttribute('placeholder') || (tr ? 'Bir şey sor…' : 'Ask something…');
      input.setAttribute('aria-label', tr ? 'Mesaj' : 'Message');
      root.querySelector('.send').textContent = tr ? 'Gönder' : 'Send';
      const greeting = this.getAttribute('greeting');
      let first = root.querySelector('.greeting');
      if (greeting && !first) { first = document.createElement('p'); first.className = 'message assistant greeting'; root.querySelector('.messages').prepend(first); }
      if (first) { if (greeting) first.textContent = greeting.slice(0, 400); else first.remove(); }
      if (this.hasAttribute('open')) { root.querySelector('.panel').hidden = false; root.querySelector('.launcher').setAttribute('aria-expanded', 'true'); }
    }
    connectedCallback() {
      if (this.shadowRoot) return;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${css}</style><button class="launcher" aria-expanded="false"><img alt=""></button><section class="panel" role="dialog" hidden><div class="head"><img alt=""><strong></strong><button class="close">×</button></div><div class="messages" role="log" aria-live="polite"></div><form class="form"><input maxlength="2000" required autocomplete="off"><button class="send" type="submit"></button></form></section>`;
      this.apply();
      const launch = root.querySelector('.launcher'), panel = root.querySelector('.panel'), input = root.querySelector('input'), send = root.querySelector('.send'), messages = root.querySelector('.messages');
      const toggle = open => { panel.hidden = !open; launch.setAttribute('aria-expanded', String(open)); if (open) input.focus(); else launch.focus(); };
      launch.addEventListener('click', () => toggle(panel.hidden));
      root.querySelector('.close').addEventListener('click', () => toggle(false));
      root.addEventListener('keydown', event => { if (event.key === 'Escape') toggle(false); });
      const turns = [];
      const append = (text, role) => { const p = document.createElement('p'); p.className = 'message ' + role; p.textContent = text; messages.append(p); messages.scrollTop = messages.scrollHeight; return p; };
      root.querySelector('form').addEventListener('submit', async event => {
        event.preventDefault();
        const content = input.value.trim(), tr = this.tr;
        if (!content || send.disabled) return;
        const endpoint = new URL(this.getAttribute('endpoint') || '/api/chat', location.href);
        if (!['http:', 'https:'].includes(endpoint.protocol)) return;
        input.value = ''; append(content, 'user'); send.disabled = true;
        const pending = append(tr ? 'Yanıt hazırlanıyor…' : 'Preparing a reply…', 'status');
        try {
          const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turns: [...turns.slice(-8), { role: 'user', content }], style: { language: tr ? 'tr' : 'en' } }), signal: AbortSignal.timeout(45000) });
          const data = await response.json();
          if (!response.ok || typeof data.text !== 'string') throw Error();
          pending.remove(); append(data.text, 'assistant');
          turns.push({ role: 'user', content }, { role: 'assistant', content: data.text });
        } catch {
          pending.textContent = tr ? 'Şu anda yanıt veremiyorum. Biraz sonra tekrar deneyebilirsin.' : 'I cannot reply right now. Please try again shortly.';
        } finally { send.disabled = false; if (!panel.hidden) input.focus(); }
      });
    }
  });
})();
