/* Drop-in Cenkbot widget. Visitor messages and answers are always plain text. */
(() => {
  const assetBase = new URL('.',document.currentScript.src);
  if(customElements.get('cenk-bot'))return;
  customElements.define('cenk-bot',class extends HTMLElement {
    connectedCallback(){
      if(this.shadowRoot)return;
      const tr=this.getAttribute('lang')==='tr';
      const root=this.attachShadow({mode:'open'});
      root.innerHTML=`<style>:host{font:14px/1.5 system-ui;color:#292730}.launcher{position:fixed;right:24px;bottom:24px;width:64px;height:64px;padding:10px;border:1px solid #d3cced;border-radius:24px;background:#f5f1ff;cursor:pointer;box-shadow:0 8px 30px #27203822}.launcher img{width:100%;height:100%}.panel{position:fixed;right:24px;bottom:102px;width:min(360px,calc(100vw - 32px));height:min(480px,calc(100dvh - 140px));background:#fffdf9;border:1px solid #ddd5e7;border-radius:22px;box-shadow:0 16px 60px #27203822;display:flex;flex-direction:column;overflow:hidden}.panel[hidden]{display:none}.head{padding:16px 18px;display:flex;justify-content:space-between;border-bottom:1px solid #eae4ec}.close{border:0;background:none;cursor:pointer;font-size:20px;min-width:44px;min-height:44px}.messages{padding:16px;overflow:auto;flex:1}.message{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 12px;margin:0 0 10px;border-radius:14px;background:#f0ebf7}.user{background:#e4ddf5;margin-left:24px}.status{color:#756d80;font-size:12px}.form{display:flex;gap:8px;padding:12px;border-top:1px solid #eae4ec}input{font:inherit;min-width:0;flex:1;padding:10px;border:1px solid #dcd4e5;border-radius:10px}button.send{font:inherit;border:0;background:#51426e;color:#fff;padding:10px 12px;border-radius:10px;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #9d83cd;outline-offset:2px}input,button.send{min-height:44px}button:disabled{opacity:.55;cursor:wait}@media(max-width:480px){.launcher{right:16px;bottom:16px}.panel{right:16px;bottom:94px}}</style><button class="launcher" aria-expanded="false"><img alt="Cenkbot"></button><section class="panel" role="dialog" aria-label="Cenkbot" hidden><div class="head"><strong>Cenkbot</strong><button class="close" aria-label="Close">×</button></div><div class="messages" role="log" aria-live="polite"></div><form class="form"><input maxlength="2000" required autocomplete="off"><button class="send" type="submit"></button></form></section>`;
      root.querySelector('img').src=new URL('cenkbot.svg',assetBase).href;
      const launch=root.querySelector('.launcher'),panel=root.querySelector('.panel'),input=root.querySelector('input'),send=root.querySelector('.send'),messages=root.querySelector('.messages');
      launch.setAttribute('aria-label',tr?'Cenkbot ile konuş':'Chat with Cenkbot');
      input.placeholder=tr?'Projeler hakkında sor…':'Ask about the projects…';input.setAttribute('aria-label',tr?'Mesaj':'Message');send.textContent=tr?'gönder':'send';
      const toggle=open=>{panel.hidden=!open;launch.setAttribute('aria-expanded',String(open));if(open)input.focus();else launch.focus();};
      launch.addEventListener('click',()=>toggle(panel.hidden));root.querySelector('.close').addEventListener('click',()=>toggle(false));root.addEventListener('keydown',e=>{if(e.key==='Escape')toggle(false);});
      const turns=[];
      const append=(text,role)=>{const p=document.createElement('p');p.className='message '+role;p.textContent=text;messages.append(p);messages.scrollTop=messages.scrollHeight;return p;};
      root.querySelector('form').addEventListener('submit',async event=>{
        event.preventDefault();const content=input.value.trim();if(!content||send.disabled)return;
        const endpoint=new URL(this.getAttribute('endpoint')||'/api/chat',location.href);
        if(!['http:','https:'].includes(endpoint.protocol))return;
        input.value='';append(content,'user');send.disabled=true;const pending=append(tr?'Yanıt hazırlanıyor…':'Preparing a reply…','status');
        try{
          const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({turns:[...turns.slice(-8),{role:'user',content}],style:{language:tr?'tr':'en'}}),signal:AbortSignal.timeout(45000)});
          const data=await response.json();if(!response.ok||typeof data.text!=='string')throw Error();
          pending.remove();append(data.text,'assistant');turns.push({role:'user',content},{role:'assistant',content:data.text});
        }catch{pending.textContent=tr?'Şu anda yanıt veremiyorum. Biraz sonra tekrar deneyebilirsin.':'I cannot reply right now. Please try again shortly.';}
        finally{send.disabled=false;if(!panel.hidden)input.focus();}
      });
    }
  });
})();
