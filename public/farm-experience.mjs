import {trace} from './trace.mjs?v=8.1';
import {domUpdates as dom} from './dom-updates.mjs?v=8.1';
import {RESOURCE_NAMES, RESOURCE_ICONS, challengeView, capacity} from './rules.mjs?v=8.1';
import {preferences, inventoryRows, filterInventoryRows, setThreshold, alertTransitions, automationDecision} from './farm-assistant.mjs?v=8.1';
import {salesReport} from './sales.mjs?v=8.1';
import {buildStarter, starterQuote} from './round-layout.mjs?v=8.1';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = selector => document.querySelector(selector);
const text = (zh, en) => document.documentElement.lang === 'en' ? en : zh;
const names = {water:'Water', wheat:'Wheat', flour:'Flour', bread:'Bread', milk:'Milk', cake:'Cake', energy:'Power', vegetables:'Vegetables', wood:'Timber'};
const name = key => text(RESOURCE_NAMES[key], names[key]);
const status = key => ({'no-store':text('未接通仓储','No storage'), full:text('仓储已满','Storage full'),
  low:text('库存不足','Low stock'), inactive:text('尚未启用','Not active'), tight:text('空间紧张','Nearly full'), healthy:text('库存正常','In stock')}[key]);

export function mountFarmExperience(hooks) {
  let currentAccount, previousAlerts, dialogType = '', inventoryQuery = '', inventoryFilter = 'all', reportPeriod = 'today';
  let reportSignature = '', tableSignature = '';
  const get = hooks.getState;
  const toolbar = document.createElement('section');
  toolbar.className = 'farm-actions'; toolbar.dataset.i18nIgnore = '';
  dom.attribute(toolbar,'aria-label',text('农场操作','Farm actions'));
  dom.html(toolbar,`<div class="action-primary"><button id="quick-start"></button><button id="quick-play"></button></div>
    <div class="action-secondary"><button id="quick-build"></button><button id="quick-inventory"></button><button id="quick-reports"></button><button id="quick-settings"></button><button id="quick-help"></button></div>`);
  $('.heading').after(toolbar);
  const coach = document.createElement('section');coach.className='farm-coach';coach.dataset.i18nIgnore='';toolbar.after(coach);
  const hint = document.createElement('div');hint.className='context-hint';hint.dataset.i18nIgnore='';coach.after(hint);
  const search = document.createElement('label');search.className='stock-search';search.dataset.i18nIgnore='';
  dom.html(search,'<span>⌕</span><input id="stock-search" type="search"><button id="stock-clear" type="button">×</button>');
  $('.stocks').before(search);
  const notices = document.createElement('div');notices.id='stock-alerts';notices.dataset.i18nIgnore='';$('.inventory .storagebar').after(notices);
  const stockEmpty = document.createElement('p');stockEmpty.className='stock-empty';dom.property(stockEmpty,'hidden',true);stockEmpty.dataset.i18nIgnore='';search.after(stockEmpty);
  const details = document.createElement('button');details.className='inventory-open';details.dataset.i18nIgnore='';$('.inventory .cargoflow').before(details);
  const auto = document.createElement('div');auto.className='auto-trade';auto.dataset.i18nIgnore='';
  dom.html(auto,'<label><input id="auto-trade" type="checkbox"><span id="auto-label"></span></label><small id="auto-state"></small>');
  $('.orderfoot').after(auto);
  const live = document.createElement('div');live.className='sr-only';dom.attribute(live,'role','status');dom.attribute(live,'aria-live','polite');document.body.append(live);
  const open = (type) => {dialogType=type;renderDialog(type);};
  $('#modal').addEventListener('close',()=>{dialogType='';reportSignature='';tableSignature='';});
  $('#quick-start').onclick=()=>hooks.start();
  $('#quick-play').onclick=()=>hooks.togglePause();
  $('#quick-build').onclick=()=>hooks.shop();
  $('#quick-inventory').onclick=()=>open('inventory');details.onclick=()=>open('inventory');
  $('#quick-reports').onclick=()=>open('reports');
  $('#quick-settings').onclick=()=>open('settings');
  $('#quick-help').onclick=()=>open('help');
  $('#stock-search').oninput=()=>render();
  $('#stock-clear').onclick=()=>{$('#stock-search').value='';render();$('#stock-search').focus();};
  $('#auto-trade').onchange=e=>{preferences(get()).automation.enabled=e.target.checked;trace(get(),'automation',[e.target.checked]);hooks.refresh();};
  function label(selector, zh, en) {dom.text($(selector),text(zh,en));}
  function render() {
    const s=get(),p=preferences(s),v=challengeView(s),rows=inventoryRows(s);dom.attribute(toolbar,'aria-label',text('农场操作','Farm actions'));
    const accountKey=s.accountId+':'+s.round?.id;if(currentAccount!==accountKey){currentAccount=accountKey;previousAlerts=undefined;}
    label('#quick-start',v.status==='active'?'◷ 挑战进度':v.status==='completed'?'✓ 查看奖励':'▶ 开始挑战',
      v.status==='active'?'◷ Challenge progress':v.status==='completed'?'✓ View reward':'▶ Start challenge');
    label('#quick-play',hooks.isPaused()?'▷ 继续经营':'Ⅱ 暂停经营',hooks.isPaused()?'▷ Resume':'Ⅱ Pause');
    label('#quick-build','＋ 建造','＋ Build');label('#quick-inventory','▤ 库存','▤ Inventory');
    label('#quick-reports','↗ 销售报表','↗ Sales');label('#quick-settings','⚙ 设置','⚙ Settings');label('#quick-help','? 帮助','? Help');
    dom.attribute($('#quick-play'),'aria-pressed',String(hooks.isPaused()));
    dom.attribute($('#pause'),'aria-label',hooks.isPaused()?text('继续经营','Resume'):text('暂停','Pause'));
    dom.property($('#quick-play'),'title',text('暂停 / 继续 · Space','Pause / resume · Space'));
    dom.property($('#quick-reports'),'title',text('销售报表 · R','Sales reports · R'));
    dom.property($('#quick-help'),'title',text('帮助与操作 · H','Help & controls · H'));
    dom.property($('#quick-build'),'title',text('打开经营币设施商店 · B','Open the farm coin shop · B'));
    dom.property($('#quick-inventory'),'title',text('查看库存、在途货物与低库存 · I','Stock, incoming goods and shortages · I'));
    dom.property($('#stock-search'),'placeholder',text('搜索产品 / low / 在途','Search products / low / incoming'));
    dom.attribute($('#stock-search'),'aria-label',text('智能产品搜索','Smart product search'));
    dom.attribute($('#stock-clear'),'aria-label',text('清空产品搜索','Clear product search'));
    const matching=new Set(filterInventoryRows(rows,$('#stock-search').value).map(r=>r.resource));
    for(const k of Object.keys(names)){
      const amount=$('#'+k),row=k==='water'?$('.waterstock'):k==='energy'?$('.energystock'):amount.closest('.stocks>div');
      dom.property(row,'hidden',!matching.has(k));const stock=rows.find(r=>r.resource===k);
      row.dataset.stockState=stock.status;
      dom.property(row,'title',`${name(k)} · ${status(stock.status)} · ${text('在制','In production')} ${stock.working} · ${text('在途','Incoming')} ${stock.incoming}`);
      let indicator=row.querySelector('.stock-dot');
      if(!indicator){indicator=document.createElement('small');indicator.className='stock-dot';row.append(indicator);}
      dom.text(indicator,stock.low?'!':stock.incoming?'↓'+stock.incoming:'');
      dom.attribute(indicator,'aria-label',stock.low?text('库存不足','Low stock'):stock.incoming?text('在途货物','Incoming goods'):'');
    }
    dom.property(stockEmpty,'hidden',matching.size>0);dom.text(stockEmpty,text('没有匹配的产品，试试 bread 或清水。','No matching products. Try bread or water.'));
    const alerts=rows.filter(r=>r.relevant&&(r.low||r.full));
    dom.html(notices,alerts.length?`<div class="stock-alert-heading">${text('库存提醒','Stock alerts')} <b>${alerts.length}</b></div>`+
      alerts.slice(0,2).map(r=>`<p><i class="alert-dot"></i>${esc(name(r.resource))}<span>${esc(status(r.status))}</span></p>`).join(''):
      `<p class="stock-calm">✓ ${text('库存实时更新，货物到达后入账','Live inventory · updates on arrival')}</p>`);
    dom.text(details,text('查看全部库存与在途货物 ↗','All stock & incoming goods ↗'));
    const transition=alertTransitions(previousAlerts,rows);previousAlerts=transition.next;
    if(p.alerts&&transition.added.length){
      const first=transition.added[0].split(':');
      dom.text(live,`${name(first[0])} · ${status(first[1]==='full'?'full':'low')}`);
      hooks.notify(text('库存提醒：','Stock alert: ')+live.textContent);
    }
    dom.property($('#auto-trade'),'checked',p.automation.enabled);
    label('#auto-label','自动出售 · 回站后接下一单','Auto-sell · next order after return');
    dom.text($('#auto-state'),hooks.isPaused()?text('经营已暂停，自动出售等待继续','Farm paused · auto-sell waits for resume'):hooks.localize(automationDecision(s).reason));
    renderCoach(s,p);renderHint(s,v,rows);
    if(dialogType==='inventory'&&$('#inventory-table'))renderInventory();
    if(dialogType==='reports'&&$('#sales-body'))renderSales();
  }
  const steps=[
    ['认识你的农场','Meet your farm','左键拖动移动地图，右键连续旋转，滚轮缩放；按 F 回到初始视角。','Drag with the left button to pan, the right button to rotate; scroll to zoom. Press F to reset the camera.'],
    ['搭建第一条产线','Build your first production line','先连道路和仓库，再建水井、麦田、磨坊、面包房。示范布局按标价支付；在溪流上铺路可架木桥。','Connect roads and storage, then add a well, fields, a mill and bakery. The starter layout uses listed prices. Lay roads across the creek to build a bridge.'],
    ['跟着货物看生产','Follow your goods','村民将货物运到仓库后，数量才增加。搜索产品或打开库存，查看在制、在途与预警。','Stock increases when villagers unload. Search products or open Inventory to see production, incoming goods and alerts.'],
    ['出售与开始挑战','Sell, then take a challenge','货车回站后收入到账。可开启自动出售；准备好后点击“开始挑战”，查看目标再确认计时。','The truck pays on return. Auto-sell can handle repeat trips. When ready, open Start challenge, review the goals and confirm the timer.']
  ];
  function renderCoach(s,p){
    const step=Math.max(0,Math.min(3,p.tutorialStep||0)),key=`${document.documentElement.lang}:${step}:${!!p.tutorialDone}:${s.accountId}:${s.round?.id}`;
    dom.property(coach,'hidden',!!p.tutorialDone);if(coach.dataset.key===key)return;coach.dataset.key=key;
    const item=steps[step];
    dom.html(coach,`<span class="coach-number">${step+1}<small>/ 4</small></span><div><b>${text(item[0],item[1])}</b><p>${text(item[2],item[3])}</p></div><div class="coach-actions">${step===1?`<button id="coach-build">${text('示范布局','Starter layout')}</button>`:''}<button id="coach-next">${step===3?text('学会了 ✓','Got it ✓'):text('下一步 →','Next →')}</button><button id="coach-skip">${text('跳过教程','Skip tutorial')}</button></div>`);
    $('#coach-next').onclick=()=>{if(step===3)p.tutorialDone=true;else p.tutorialStep=step+1;hooks.refresh();};
    $('#coach-skip').onclick=()=>{p.tutorialDone=true;hooks.refresh();};
    if($('#coach-build'))$('#coach-build').onclick=()=>open('starter');
  }
  function renderHint(s,v,rows){
    let hintText,action,actionText;
    if(hooks.isPaused()){
      hintText=text('经营已暂停，生产和运输会在继续后恢复；挑战仍按真实时间计时。','The farm is paused. Resume production and transport when ready; the challenge clock keeps running.');
      action=hooks.togglePause;actionText=text('继续经营','Resume');
    }else if(!capacity(s,'wheat')||!capacity(s,'flour')){
      hintText=text('先接通仓库和货运站道路，生产线才有地方入库。','Connect a warehouse to the trade station before production starts.');
      action=()=>starterQuote(s).allowed?open('starter'):hooks.shop();actionText=text('准备产线','Prepare farm');
    }else if(v.needsRebuild){
      hintText=text('本轮可继续经营；新奖励需新一轮，可沿用布局一键重建。','Keep operating this farm. For a new reward, start a fresh round and reuse its layout.');
      action=hooks.newRound;actionText=text('沿用布局开新轮','Reuse layout');
    }else if(rows.some(r=>r.full)){
      hintText=text('仓储已满，出售产品或增建仓库可以恢复入库。','Storage is full. Sell products or add storage to resume unloading.');
      action=()=>open('inventory');actionText=text('查看库存','View stock');
    }else if(v.status==='active'){
      hintText=text('挑战进行中：可开启自动出售，系统优先运送未完成的任务产品。','Challenge in progress: auto-sell prioritizes products still needed by the challenge.');
      action=()=>open('settings');actionText=text('自动化设置','Automation');
    }else{
      hintText=text('生产自动进行。准备好后查看挑战目标，再开始真实倒计时。','Production runs automatically. Review the challenge goals when ready, then start its real-time timer.');
      action=hooks.start;actionText=text('查看目标','View goals');
    }
    const key=hintText+actionText+s.round?.id;if(hint.dataset.key!==key){hint.dataset.key=key;dom.html(hint,`<span>✧ ${hintText}</span><button>${actionText} ↗</button>`);hint.querySelector('button').onclick=action;}
  }
  function heading(kicker,title,desc){return `<div data-i18n-ignore><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="experience-intro">${desc}</p>`;}
  function renderDialog(type){
    tableSignature='';reportSignature='';const s=get(),p=preferences(s);let html;
    if(type==='inventory'){
      html=heading('LIVE INVENTORY',text('仓库工作台','Inventory desk'),text('自动更新 · 在制包含在途，实际到达才计入可用库存。蔬菜、木材与加工品共享货仓容量。','Live updates · In production includes incoming goods. Only unloaded goods are available. Vegetables, timber and processed goods share capacity.'))+
      `<div class="inventory-toolbar"><input id="inventory-query" type="search" value="${esc(inventoryQuery)}" aria-label="${text('搜索库存产品','Search inventory products')}" placeholder="${text('名称 / English / low / 在途','Name / low / incoming')}"><select id="inventory-filter" aria-label="${text('库存筛选','Inventory filter')}"><option value="all">${text('全部产品','All products')}</option><option value="low">${text('低库存','Low stock')}</option><option value="incoming">${text('搬运在途','Incoming')}</option></select></div>
      <div class="inventory-table-wrap"><table class="inventory-table"><thead><tr><th>${text('产品','Product')}</th><th>${text('可用','Available')}</th><th>${text('在制 / 在途','Producing / incoming')}</th><th>${text('状态','Status')}</th></tr></thead><tbody id="inventory-table"></tbody></table></div>
      <p class="experience-footnote">${text('低库存只关注已连通产线。预警阈值可在设置中调整，设为 0 可关闭某个产品的低库存提醒。','Low-stock checks apply to connected production lines. Change thresholds in Settings; 0 disables a product’s low-stock alert.')}</p><button id="inventory-settings" class="primary">${text('调整库存预警与自动出售','Stock alerts & auto-sell settings')}</button></div>`;
    }else if(type==='reports'){
      html=heading('FARM SALES',text('每一趟，都有收获','Every delivery counts'),text('仅统计本次升级后已回站结算的销售，跨轮保留。今日按北京时间计算。','Settled deliveries since this upgrade, retained across rounds. Today follows Beijing time.'))+
      `<div class="report-tools"><select id="report-period" aria-label="${text('报表时间范围','Sales report period')}"><option value="today">${text('今日销售','Today')}</option><option value="all">${text('全部销售','All time')}</option></select><button id="export-sales">↓ ${text('导出 CSV','Export CSV')}</button></div><div id="sales-summary" class="sales-summary"></div><div class="inventory-table-wrap"><table class="inventory-table"><thead><tr><th>${text('产品','Product')}</th><th>${text('交付数量','Units sold')}</th><th>${text('往返次数','Trips')}</th><th>${text('经营币收入','Coin revenue')}</th></tr></thead><tbody id="sales-body"></tbody></table></div><h2 class="report-recent-title">${text('最近交付','Recent deliveries')}</h2><div id="sales-recent"></div></div>`;
    }else if(type==='settings'){
      html=heading('YOUR FARM, YOUR PACE',text('农场设置','Farm settings'),text('设置随当前农场主保存。自动出售不会替你开始任务或领取奖励。','Saved for the current farmer. Automation never starts a challenge or claims a reward.'))+
      `<section class="settings-section"><h2>${text('自动化与库存','Automation & inventory')}</h2>
      <label class="setting-toggle"><span><b>${text('自动出售','Auto-sell')}</b><small>${text('回站后自动发车；默认保留加工所需原料','Dispatch after return; keep ingredients for production')}</small></span><input id="setting-auto" type="checkbox" ${p.automation.enabled?'checked':''}></label>
      <label class="setting-toggle"><span>${text('优先完成挑战交付','Prioritize challenge deliveries')}</span><input id="setting-priority" type="checkbox" ${p.automation.challengePriority?'checked':''}></label>
      <label class="setting-toggle"><span><b>${text('智能原料平衡','Balance production for deliveries')}</b><small>${text('蛋糕产量达标后暂缓新批次，让面包和牛奶优先交付','After the cake target is met, yield ingredients to bread and milk deliveries')}</small></span><input id="setting-balance" type="checkbox" ${p.automation.balanceProduction!==false?'checked':''}></label>
      <label class="setting-number"><span>${text('额外保留产品数量','Minimum product reserve')}</span><input id="setting-reserve" type="number" required min="0" max="999" step="1" value="${p.automation.reserve}"></label>
      <p class="experience-footnote">${text('准备期出售当前所选产品；挑战中优先尚未完成的交付目标。保留量取本设置与下一批加工所需原料的较大值。暂停或关闭页面时不发车。','During preparation, sell the selected product. In a challenge, prioritize unfinished deliveries. Keep the greater of your reserve or one production batch’s ingredients. No dispatch while paused or closed.')}</p>
      <label class="setting-toggle"><span>${text('库存状态变化提醒','Stock change notifications')}</span><input id="setting-alerts" type="checkbox" ${p.alerts?'checked':''}></label>
      <div class="threshold-grid">${Object.keys(names).map(k=>`<label><span>${RESOURCE_ICONS[k]} ${name(k)}</span><input data-threshold="${k}" aria-label="${name(k)} ${text('低库存阈值','low-stock threshold')}" type="number" required min="0" max="999" step="1" value="${p.thresholds[k]??0}"></label>`).join('')}</div></section>
      <section class="settings-section"><h2>${text('声音与画面','Sound & visuals')}</h2>
      <label class="setting-number"><span>${text('画面质量','Graphics quality')}</span><select id="setting-graphics"><option value="auto">${text('自动 · 推荐','Auto · recommended')}</option><option value="smooth">${text('优先流畅','Prefer performance')}</option><option value="sharp">${text('优先清晰','Prefer sharpness')}</option></select></label>
      <label class="setting-toggle"><span><b>${text('昼夜背景音乐','Day & night music')}</b><small>${text('白天轻快，夜晚舒缓 · 本地合成旋律','Bright by day, quiet at night · locally generated')}</small></span><input id="setting-music" type="checkbox" ${p.music?'checked':''} ${hooks.audio.supported?'':'disabled'}></label>
      <label class="setting-toggle"><span>${text('建造、入库与奖励音效','Building, harvest & reward sounds')}</span><input id="setting-effects" type="checkbox" ${p.effects?'checked':''} ${hooks.audio.supported?'':'disabled'}></label>
      <label class="setting-number"><span>${text('音量','Volume')}</span><input id="setting-volume" type="range" min="0" max="100" value="${Math.round(p.volume*100)}"></label>
      <button id="sound-preview" class="subtle-button" ${hooks.audio.supported?'':'disabled'}>${text('试听音效','Preview sound')}</button>
      <label class="setting-toggle"><span><b>${text('溪流涟漪、落叶与庆祝粒子','River ripples, leaves & celebrations')}</b><small>${text('遵循系统的减少动态效果设置','Respects the system’s reduced-motion preference')}</small></span><input id="setting-particles" type="checkbox" ${p.particles?'checked':''}></label></section>
      <p class="experience-footnote">${hooks.audio.supported?text('首次点击后声音才可播放。后台或暂停时静音，背景音乐默认关闭。','Audio starts after an interaction. Hidden or paused farms are silent. Music is off by default.'):text('此浏览器不支持音频，其他功能可正常使用。','Audio is unavailable in this browser. Other features work normally.')}</p><button id="settings-done" class="primary">${text('完成，继续经营','Done, back to the farm')}</button></div>`;
    }else if(type==='starter'){
      const quote=starterQuote(s);
      html=heading('YOUR FIRST PRODUCTION LINE',text('面包生产线示范布局','A starter bread production line'),text('一键按标价购买并放置道路、综合仓库、水井、磨坊、面包房和两块麦田。','Buy and place roads, a barn, well, mill, bakery and two fields at their listed prices.'))+
      `<div class="starter-chain">💧 → 🌾 → 🥡 → 🥖 → 🚚</div><p>${text('共','Total:')} <b>${quote.count||15}</b> ${text('处设施与道路 · 支付','buildings & roads · Pay')} <b>${quote.cost}</b> ${text('经营币','farm coins')}</p><p>${text('余额','Balance:')} ${s.cash} → ${Math.max(0,s.cash-quote.cost)} ${text('经营币，TOM 不变。','coins. TOM stays the same.')}</p><p>${quote.allowed?text('道路与仓库已经按生产需求规划，建好后自动生产；挑战仍需你主动开始。','Roads and storage are planned for production. Work starts automatically; start the challenge when ready.'):text('示范位置已占用，或经营币不足。可以到商店自行建造。','Some starter positions are occupied, or funds are insufficient. Build your own layout in the shop.')}</p><button id="confirm-starter" class="primary" ${quote.allowed?'':'disabled'}>${text('确认搭建','Build this layout')} · ${quote.cost}</button><button id="starter-shop" class="backbutton">${text('自行规划，打开商店','Plan my own layout · open shop')}</button></div>`;
    }else{
      html=heading('FIELD NOTES',text('随时找得到的帮助','Help, always close by'),text('先连道路，再接仓库，最后扩展生产。溪流上铺路可搭桥，连通右岸。','Connect roads and storage, then expand production. Lay roads across the creek to bridge to the other bank.'))+
      `<div class="controls-grid">${[
        ['左键拖动','Left drag','平移地图','Pan the map'],['右键拖动','Right drag','连续旋转','Rotate freely'],['滚轮 / ＋ −','Scroll / ＋ −','缩放地图','Zoom'],['F','F','复位视角','Reset camera'],['Space','Space','暂停 / 继续经营','Pause / resume'],['B / I / R','B / I / R','建造 / 库存 / 销售','Build / inventory / sales'],['H / Esc','H / Esc','帮助 / 取消或关闭','Help / cancel or close']
      ].map(([a,b,c,d])=>`<div><kbd>${text(a,b)}</kbd><span>${text(c,d)}</span></div>`).join('')}</div>
      <p>${text('经营币购买普通设施；TOM 用来购买 NFT。库存只有实际入库后才可使用，货车回站后才有收入。每阶段可重试，暂停仍消耗挑战的真实时间。','Farm coins buy ordinary buildings; TOM buys NFTs. Goods become available on arrival; sales pay when the truck returns. Retry unfinished challenges. Pausing does not stop the real challenge clock.')}</p>
      <p>${text('新奖励需新一轮，但可付经营币沿用原布局。清空旧库存和批次，已有 TOM、NFT 与销售记录保留。','A new reward needs a fresh round. Reuse a layout by repaying its coin cost. Stock and batches reset; TOM, NFTs and sales history stay.')}</p><div class="help-actions"><button id="replay-tutorial" class="primary">${text('重看 4 步教程','Replay the 4-step tutorial')}</button><button id="full-guide">${text('完整小镇手册','Full farm rulebook')}</button></div></div>`;
    }
    hooks.dialog(html);
    if(type==='inventory'){
      $('#inventory-filter').value=inventoryFilter;
      $('#inventory-query').oninput=e=>{inventoryQuery=e.target.value;renderInventory();};
      $('#inventory-filter').onchange=e=>{inventoryFilter=e.target.value;renderInventory();};
      $('#inventory-settings').onclick=()=>open('settings');renderInventory();
    }else if(type==='reports'){
      $('#report-period').value=reportPeriod;$('#report-period').onchange=e=>{reportPeriod=e.target.value;renderSales();};
      $('#export-sales').onclick=exportSales;renderSales();
    }else if(type==='settings'){
      const bind=(id,update,event='change')=>$(id).addEventListener(event,e=>{update(e.target);hooks.audio.update();hooks.refresh();});
      bind('#setting-auto',e=>{p.automation.enabled=e.checked;trace(s,'automation',[e.checked]);});
      bind('#setting-priority',e=>p.automation.challengePriority=e.checked);
      bind('#setting-balance',e=>{p.automation.balanceProduction=e.checked;trace(s,'balance',[e.checked]);});
      bind('#setting-reserve',e=>{const n=Number(e.value);if(e.value!==''&&Number.isInteger(n)&&n>=0&&n<=999)p.automation.reserve=n;});
      for(const key of ['alerts','music','effects','particles'])bind('#setting-'+key,e=>{p[key]=e.checked;if(key==='music'||key==='effects')hooks.audio.unlock();});
      bind('#setting-volume',e=>p.volume=Number(e.value)/100,'input');
      document.querySelectorAll('[data-threshold]').forEach(e=>e.onchange=()=>{if(e.value!==''&&setThreshold(s,e.dataset.threshold,Number(e.value)))hooks.refresh();else e.reportValidity();});
      $('#sound-preview').onclick=async()=>{await hooks.audio.unlock();hooks.audio.effect('reward');};
      $('#setting-graphics').value=p.graphics||'auto';bind('#setting-graphics',e=>{p.graphics=e.value;hooks.graphicsChanged()});
      $('#settings-done').onclick=()=>$('#modal').close();
    }else if(type==='starter'){
      $('#confirm-starter').onclick=()=>{if(!buildStarter(get()))return open('starter');hooks.audio.effect('build');$('#modal').close();hooks.refresh();hooks.resetCamera();};
      $('#starter-shop').onclick=()=>{$('#modal').close();hooks.shop();};
    }else if(type==='help'){
      $('#replay-tutorial').onclick=()=>{p.tutorialDone=false;p.tutorialStep=0;$('#modal').close();hooks.refresh();};
      $('#full-guide').onclick=()=>{dialogType='';hooks.guide();};
    }
  }
  function renderInventory(){
    const rows=inventoryRows(get(),inventoryQuery,inventoryFilter),signature=JSON.stringify([document.documentElement.lang,rows]);
    if(signature===tableSignature)return;tableSignature=signature;
    dom.html($('#inventory-table'),rows.length?rows.map(r=>`<tr data-stock-state="${r.status}"><th>${r.icon} ${esc(name(r.resource))}<small>${text('低于','Low below')} ${r.threshold}</small></th><td><b>${r.amount}</b><small>${text('共享容量','Shared capacity')} ${r.limit}</small></td><td>${r.working} / <b>${r.incoming}</b></td><td><span class="stock-status">${esc(status(r.status))}</span></td></tr>`).join(''):`<tr><td colspan="4" class="empty-report">${text('没有符合筛选的产品。','No products match your search.')}</td></tr>`);
  }
  function renderSales(){
    const report=salesReport(get(),reportPeriod),signature=JSON.stringify([document.documentElement.lang,report]);
    if(signature===reportSignature)return;reportSignature=signature;
    dom.html($('#sales-summary'),[[report.revenue,text('经营币收入','Coins earned')],[report.trips,text('完成往返','Completed trips')],[report.units,text('交付产品','Units delivered')]].map(([n,label])=>`<div><b>${n.toLocaleString()}</b><span>${label}</span></div>`).join(''));
    dom.html($('#sales-body'),Object.entries(report.products).map(([k,item])=>`<tr><th>${RESOURCE_ICONS[k]} ${esc(name(k))}</th><td>${item.units}</td><td>${item.trips}</td><td>◈ ${item.revenue}</td></tr>`).join('')||`<tr><td colspan="4" class="empty-report">${text('还没有结算记录。发出第一车货，回站后这里会自动更新。','No settled sales yet. Send your first delivery; this report updates when the truck returns.')}</td></tr>`);
    dom.html($('#sales-recent'),report.recent.slice(0,8).map(sale=>`<div class="sale-row"><time>${new Date(sale.at).toLocaleTimeString(document.documentElement.lang,{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Shanghai'})}</time><span>${name(sale.resource)} × ${sale.amount}<small>${sale.automatic?text('自动出售','Auto-sell'):text('手动出售','Manual sale')}</small></span><b>＋${sale.cash} ◈</b></div>`).join(''));
  }
  function exportSales(){
    const r=salesReport(get(),reportPeriod),quote=v=>'"'+String(v).replace(/"/g,'""')+'"';
    const rows=[['Product','Units sold','Trips','Farm coin revenue'],...Object.entries(r.products).map(([k,p])=>[names[k],p.units,p.trips,p.revenue]),['Total',r.units,r.trips,r.revenue]];
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`meadow-sales-${reportPeriod}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('languagechange',()=>{render();if(dialogType)renderDialog(dialogType);});
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.closest('input,select,textarea,[contenteditable="true"]')||$('#modal').open)return;
    const key=e.key.toLowerCase();if(key===' '&&e.target.closest('button,a'))return;
    const shortcuts={' ':hooks.togglePause,b:hooks.shop,i:()=>open('inventory'),r:()=>open('reports'),h:()=>open('help'),f:hooks.resetCamera};
    if(shortcuts[key]){e.preventDefault();shortcuts[key]();}
  });
  return {render, open};
}
