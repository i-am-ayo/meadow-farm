import {enableFacility,setWeather} from './trace.mjs?v=8.1';
import {domUpdates as dom} from './dom-updates.mjs?v=8.1';
import {RESOURCE_NAMES,RESOURCE_ICONS,TYPE_NAMES,TYPE_ICONS,ownerFor,modelFor,productionInfo,withFarmRead,challengeView} from './rules.mjs?v=8.1';
import {LEVEL_XP,RESEARCH,villageState,farmLevel,researchQuote,buyResearch,weatherView,contractOffers,activeContract,acceptContract,fulfillContract,abandonContract,refreshContracts,achievementRows,claimAchievement} from './village.mjs?v=8.1';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(zh,en)=>document.documentElement.lang==='en'?en:zh;
const named=item=>text(item.zh,item.en);
const clock=seconds=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.max(0,seconds)%60).padStart(2,'0')}`;
const tabs=[['orders','✉','村民委托','Requests'],['research','⌘','农场研究','Research'],['production','⚒','生产调度','Production'],['weather','☀','天气预报','Weather'],['achievements','✧','经营成就','Milestones']];

export function mountVillage(hooks){
  const get=hooks.getState;
  let currentTab=null,signature='',filter='all',confirmAbandon=false;
  const strip=document.createElement('section');strip.className='village-strip';strip.dataset.i18nIgnore='';
  strip.setAttribute('aria-label',text('小镇成长与委托','Town growth and requests'));
  strip.innerHTML=`<button class="village-level" data-village-open="research"><span class="village-emblem">✳</span><span><b id="village-level-label"></b><small id="village-xp-label"></small><span class="village-xp-track"><i id="village-xp-fill"></i></span></span></button><button class="village-weather" data-village-open="weather"><span id="village-weather-icon"></span><span><b id="village-weather-name"></b><small id="village-weather-desc"></small></span></button><div class="village-shortcuts"><button data-village-open="orders" id="village-orders"></button><button data-village-open="research" id="village-research"></button><button data-village-open="production" id="village-production"></button><button data-village-open="achievements" id="village-achievements"></button></div>`;
  $('.layout').before(strip);
  strip.addEventListener('click',e=>{const b=e.target.closest('[data-village-open]');if(b)open(b.dataset.villageOpen);});
  const quick=document.createElement('button');quick.id='quick-village';quick.dataset.i18nIgnore='';$('.action-secondary').prepend(quick);quick.onclick=()=>open('orders');
  $('#modal').addEventListener('close',()=>{currentTab=null;signature='';confirmAbandon=false;});
  $('#modalcontent').addEventListener('click',e=>{
    const tab=e.target.closest('[data-village-tab]');if(tab){currentTab=tab.dataset.villageTab;signature='';confirmAbandon=false;renderPanel();return;}
    const button=e.target.closest('[data-village-action]');if(!button||!currentTab)return;
    const s=get(),action=button.dataset.villageAction,id=button.dataset.id;let success=false,message;
    if(action==='accept'){success=acceptContract(s,id);message=text('已接下委托，准备好全部货物后交给村民。','Request accepted. Prepare the full basket for collection.');}
    if(action==='fulfill'){const r=fulfillContract(s,id);success=!!r;if(r)message=text(`村民取货完成：＋${r.cash} 经营币、＋${r.xp} XP、＋1 研究点。`,`Collected: +${r.cash} coins, +${r.xp} XP and +1 research point.`);}
    if(action==='refresh'){success=refreshContracts(s);message=text('已支付 25 经营币，换了一批委托。','Paid 25 coins for a new set of requests.');}
    if(action==='abandon'){confirmAbandon=true;signature='';renderPanel();return;}
    if(action==='cancel-abandon'){confirmAbandon=false;signature='';renderPanel();return;}
    if(action==='confirm-abandon'){success=abandonContract(s);confirmAbandon=false;message=text('已放弃委托，库存和余额保留。','Request abandoned. Your stock and coins are retained.');}
    if(action==='research'){success=buyResearch(s,id);message=text('研究已完成，新批次开始时生效。','Research complete. New batches use the upgrade.');}
    if(action==='achievement'){success=claimAchievement(s,id);message=text('成就奖励已到账。','Milestone rewards received.');}
    if(action==='weather'){const v=villageState(s);setWeather(s,!v.weatherEnabled);success=true;message=v.weatherEnabled?text('天气加成已开启，新的生产批次会使用当前天气。','Weather bonuses enabled for new batches.'):text('天气加成已关闭，已付款批次保持原有进度。','Weather bonuses disabled. Paid batches keep their progress.');}
    if(action==='toggle'){
      const b=s.buildings.find(b=>facilityId(b)===id),owner=b&&ownerFor(s,b);
      if(owner){enableFacility(s,b,owner.enabled===false);success=true;message=owner.enabled?text('生产已继续。','Production resumed.'):text('设施已暂停，已付款批次保留。','Facility paused. Paid batches are retained.');}
    }
    if(success){hooks.refresh();hooks.notify(message);if(['fulfill','achievement','research'].includes(action))hooks.audio.effect('reward');}
    else{hooks.notify(text('状态发生了变化，请检查库存、研究点或可接委托。','State changed. Check your stock, research points or available requests.'));render();}
  });
  $('#modalcontent').addEventListener('change',e=>{if(e.target.id==='village-line-filter'){filter=e.target.value;signature='';renderPanel();}});
  document.addEventListener('languagechange',()=>{signature='';render();});
  function open(tab='orders'){currentTab=tab;signature='';confirmAbandon=false;renderPanel(true);}
  function render(){
    const s=get(),v=villageState(s),level=farmLevel(s),base=LEVEL_XP[level-1],next=LEVEL_XP[level],weather=weatherView(s),active=activeContract(s);
    dom.text($('#village-level-label'),text(`Lv.${level} · 小镇成长`,`Lv.${level} · Growing town`));
    dom.text($('#village-xp-label'),`${v.xp}${next?` / ${next}`:''} XP · ${v.points} ${text('研究点','RP')}`);
    dom.property($('#village-xp-fill').style,'width',`${next?Math.min(100,(v.xp-base)/(next-base)*100):100}%`);
    dom.text($('#village-weather-icon'),weather.icon);dom.text($('#village-weather-name'),named(weather));
    dom.text($('#village-weather-desc'),weather.enabled?text(...weather.description):text('可开启天气加成','Optional weather bonuses'));
    dom.attribute($('.world'),'data-weather',weather.enabled?weather.id:'off');
    const ready=achievementRows(s).filter(a=>!a.claimed&&a.value>=a.target).length;
    dom.text($('#village-orders'),active?text('✉ 委托进行中','✉ Request active'):text('✉ 村民委托','✉ Requests'));
    dom.text($('#village-research'),text('⌘ 研究','⌘ Research'));dom.text($('#village-production'),text('⚒ 生产调度','⚒ Production'));
    dom.text($('#village-achievements'),text(`✧ 成就${ready?' · '+ready:''}`,`✧ Milestones${ready?' · '+ready:''}`));
    dom.text(quick,text('✉ 小镇事务','✉ Town desk'));
    dom.attribute(strip,'aria-label',text('小镇成长与委托','Town growth and requests'));
    if(currentTab&&$('#modal').open)renderPanel();
  }
  function renderPanel(initial=false){
    if(!currentTab)return;
    // Keep the native filter popup stable while the player is choosing.
    if(signature&&currentTab==='production'&&document.activeElement?.id==='village-line-filter')return;
    const s=get(),v=villageState(s);
    const html=`<div class="village-desk" data-i18n-ignore><div class="eyebrow">THE VILLAGE DESK</div><h1>${text('让小镇有自己的故事','A little town, a bigger story')}</h1><p class="experience-intro">${text('接下邻里委托，选择研究方向，经营每一条产线。','Meet your neighbors, choose a research path and fine-tune production.')}</p><nav class="village-tabs" aria-label="${text('小镇事务分类','Town desk sections')}">${tabs.map(([id,icon,zh,en])=>`<button data-village-tab="${id}" aria-pressed="${id===currentTab}">${icon} ${text(zh,en)}</button>`).join('')}</nav><div id="village-pane">${currentTab==='orders'?ordersPane(s):currentTab==='research'?researchPane(s,v):currentTab==='production'?productionPane(s):currentTab==='weather'?weatherPane(s):achievementPane(s)}</div></div>`;
    if(signature!==html){
      const focus=document.activeElement,action=focus?.dataset?.villageAction,id=focus?.dataset?.id,focusedTab=focus?.dataset?.villageTab;
      signature=html;hooks.dialog(html);
      if(action)for(const el of $('#modalcontent').querySelectorAll('[data-village-action]'))if(el.dataset.villageAction===action&&el.dataset.id===id&&!el.disabled){el.focus({preventScroll:true});break;}
      if(focusedTab)for(const el of $('#modalcontent').querySelectorAll('[data-village-tab]'))if(el.dataset.villageTab===focusedTab){el.focus({preventScroll:true});break;}
      if($('#village-line-filter'))$('#village-line-filter').value=filter;
    }else if(initial&&!$('#modal').open)$('#modal').showModal();
    const active=activeContract(s);if($('#contract-clock'))dom.text($('#contract-clock'),clock(active?active.endsAt-s.seconds:0));
    if($('#weather-clock'))dom.text($('#weather-clock'),clock(weatherView(s).remaining));
    if($('#request-cooldown'))dom.text($('#request-cooldown'),clock(Math.max(0,(s.villageBoard?.refreshAt||0)-s.seconds)));
  }
  function goods(s,items){return `<div class="request-goods">${Object.entries(items).map(([k,n])=>`<span class="${(s[k]||0)>=n?'ready':'missing'}">${RESOURCE_ICONS[k]} ${esc(hooks.localize(RESOURCE_NAMES[k]))}<b>${Math.min(s[k]||0,n)} / ${n}</b></span>`).join('')}</div>`;}
  function ordersPane(s){
    const active=activeContract(s),v=villageState(s),waiting=Math.max(0,(s.villageBoard?.refreshAt||0)-s.seconds),challenge=challengeView(s).status==='active';
    const note=challenge?text('挑战进行中：村民委托不会增加挑战的发货进度，自动出售优先完成挑战；请为委托另外留货。','A challenge is active. Visitor baskets do not count as challenge deliveries. Auto-sell prioritizes the challenge; keep extra goods for requests.'):
      text('一次接 1 单，5 分钟游戏时间内备齐。暂停或关页会暂停委托；准备期自动出售会为已接委托留货。村民到仓库自提，不占用货车。','Accept one request at a time. You have 5 minutes of game time; pausing or closing stops this timer. Preparation auto-sell reserves the basket. Visitors collect from storage without using the truck.');
    return `<div class="village-section-heading"><div><h2>${text('邻里订单板','The neighborhood board')}</h2><p>${text(`累计完成 ${v.contracts} 单 · 每单另获 1 研究点`,`Completed ${v.contracts} requests · each awards 1 research point`)}</p></div><button data-village-action="refresh" ${waiting||s.cash<25?'disabled':''}>↻ ${text('换一批 · 25 经营币','New requests · 25 coins')}</button></div>${waiting?`<p class="village-muted">${text('换单冷却','Refresh cooldown')} <b id="request-cooldown"></b></p>`:''}<p class="village-note">${note}</p>
    ${active?`<article class="request-card active-request"><div class="request-heading"><span class="request-avatar">${active.icon}</span><div><small>${text(...active.visitor)}</small><h3>${named(active)}</h3></div><span class="request-clock">◷ <b id="contract-clock"></b></span></div>${goods(s,active.goods)}<div class="request-reward">◈ ${active.cash} ${text('经营币','coins')} · ${active.xp} XP · ＋1 ${text('研究点','RP')}</div><div class="request-actions"><button class="primary" data-village-action="fulfill" data-id="${esc(active.id)}" ${Object.entries(active.goods).every(([k,n])=>(s[k]||0)>=n)?'':'disabled'}>${text('备齐交货，领取报酬','Hand over basket & collect')}</button>${confirmAbandon?`<button data-village-action="confirm-abandon">${text('确认放弃（不扣库存）','Confirm abandon (keep stock)')}</button><button data-village-action="cancel-abandon">${text('继续准备','Keep preparing')}</button>`:`<button data-village-action="abandon">${text('放弃此单','Abandon request')}</button>`}</div></article>`:''}
    ${s.villageBoard?.lastResult==='expired'?`<p class="village-note">${text('上一单已到期，库存保留，可以接新单。','The previous request expired. Stock is retained; choose a new request.')}</p>`:''}
    <div class="request-grid">${contractOffers(s).map(o=>`<article class="request-card ${o.used?'request-used':''}"><div class="request-heading"><span class="request-avatar">${o.icon}</span><div><small>${text(...o.visitor)}</small><h3>${named(o)}</h3></div></div>${goods(s,o.goods)}<div class="request-reward">◈ ${o.cash} · ${o.xp} XP · ＋1 RP</div><button data-village-action="accept" data-id="${esc(o.id)}" ${active||o.used?'disabled':''}>${o.used?text('本单已接取','Already accepted'):text('接下委托 · 5 分钟','Accept · 5 min')}</button></article>`).join('')}</div><p class="village-muted">${text('每个游戏日（3 分钟）更新候选委托，不改变已接单。建好菜园、林场、牧场与蛋糕房后，会出现更多订单。村民委托收入单独结算，不计入货车销售报表。','Offers change each game day (3 minutes). Active requests are retained. Build gardens, logging camps, dairies and cakeries to attract more requests. Visitor income is separate from truck sales reports.')}</p>`;
  }
  function researchPane(s,v){
    return `<div class="research-summary"><span>📚</span><div><h2>${text(`农场等级 ${farmLevel(s)}`,`Farm level ${farmLevel(s)}`)}</h2><p>${text('货物实际入库、货车回站和村民委托获得经验。每次升级获得 2 研究点。','Earn XP from unloaded goods, returning trucks and visitor requests. Each level awards 2 research points.')}</p></div><strong>${v.points}<small>${text('可用研究点','available RP')}</small></strong></div><div class="research-grid">${RESEARCH.map(r=>{const q=researchQuote(s,r.id);return `<article class="research-card"><span class="research-icon">${r.icon}</span><h3>${named(r)}</h3><p>${text(...r.description)}</p><div class="research-ranks" aria-label="${text('研究等级','Research rank')} ${q.rank}/3">${[1,2,3].map(n=>`<i class="${q.rank>=n?'unlocked':''}"></i>`).join('')}</div><small>${text('当前等级','Current rank')} ${q.rank} / 3</small><button class="${q.allowed?'primary':''}" data-village-action="research" data-id="${r.id}" ${q.allowed?'':'disabled'}>${q.rank===3?text('研究已满级','Fully researched'):farmLevel(s)<q.requiredLevel?text(`需要农场 Lv.${q.requiredLevel}`,`Requires farm Lv.${q.requiredLevel}`):text(`研究下一级 · ${q.cost} 点`,`Next rank · ${q.cost} RP`)}</button></article>`;}).join('')}</div><p class="village-note">${text('研究点需要主动分配，普通设施与 NFT 同样受益。等级、研究与成就跨轮保留；新一轮仍须购买普通设施。研究仅影响新生产批次和新发车，已付款批次不会重置或重新扣料。','Spend points on the path you prefer. Ordinary buildings and NFTs both benefit. Levels, research and milestones persist across rounds; ordinary buildings must still be repurchased. Upgrades apply to new batches and trips, preserving work already paid for.')}</p>`;
  }
  const facilityId=b=>b.assetId||`${b.type}:${b.x},${b.y}`;
  function productionPane(s){return withFarmRead(s,()=>{
    const rows=s.buildings.flatMap(b=>{const m=modelFor(s,b);if(!m?.cycle&&b.type!=='wheat')return [];return [{b,m,owner:ownerFor(s,b),info:productionInfo(s,b)}];});
    const waiting=r=>r.info.blocked||r.info.label==='等待仓储空间';
    const blocked=rows.filter(waiting).length;
    return `<div class="village-section-heading"><div><h2>${text('生产调度台','Production control')}</h2><p>${text(`${rows.length} 处产线 · ${blocked} 处暂停或等待`,`${rows.length} production sites · ${blocked} paused or blocked`)}</p></div><select id="village-line-filter" aria-label="${text('筛选生产线','Filter production lines')}"><option value="all" ${filter==='all'?'selected':''}>${text('全部产线','All production')}</option><option value="blocked" ${filter==='blocked'?'selected':''}>${text('仅暂停或等待','Paused or blocked')}</option></select></div><div class="production-chains"><span>💧 → 🌾 → 🥡 → 🥖</span><span>🌾 ＋ 💧 → 🥛 → 🍰</span><span>💧 → 🥬　🌳 → 🪵</span></div><p class="village-note">${text('暂停可为其他工坊保留原料。已付款批次会保留，继续后从原进度恢复；道路、原料、灌溉、遮阴和仓容均影响生产。','Pause a workshop to reserve ingredients for another. Paid batches retain progress. Roads, ingredients, irrigation, shade and storage affect production.')}</p><div class="production-list">${rows.filter(r=>filter!=='blocked'||waiting(r)).map(({b,m,owner,info})=>`<article class="production-row"><span class="production-icon">${TYPE_ICONS[b.type]||'🌾'}</span><div class="production-info"><b>${esc(hooks.localize(m?.name||TYPE_NAMES[b.type]||'麦田'))}<small>${b.assetId?'NFT':text('经营币设施','Ordinary')} · (${b.x}, ${b.y})</small></b><p class="${info.blocked?'production-blocked':''}">${esc(hooks.localize(info.label))}</p><small>${esc(hooks.localize(info.reason||info.notes.join(' · ')||''))}</small><span class="production-recipe">${b.type==='lumber'?'🌳1':Object.entries(m?.inputs||{water:1}).map(([k,n])=>`${RESOURCE_ICONS[k]}${n}`).join(' ＋ ')||text('无需原料','No inputs')} → ${Object.entries(m?.outputs||{wheat:2}).map(([k,n])=>`${RESOURCE_ICONS[k]}${n}`).join(' ＋ ')} · ${info.cycle}s</span></div><button data-village-action="toggle" data-id="${esc(facilityId(b))}" aria-pressed="${owner.enabled===false}">${owner.enabled===false?text('继续生产','Resume'):text('暂停产线','Pause')}</button></article>`).join('')||`<p class="village-empty">${text('暂无符合筛选的产线。通过建造按钮添加新工坊。','No matching production sites. Use Build to add a workshop.')}</p>`}</div>`;
  });}
  function weatherPane(s){
    const w=weatherView(s);
    return `<div class="weather-current"><span>${w.icon}</span><div><small>${text(`第 ${w.day} 个游戏日`,`Game day ${w.day}`)}</small><h2>${named(w)}</h2><p>${text(...w.description)}</p><p>${text('距下次天气','Next weather in')} <b id="weather-clock"></b></p></div><button data-village-action="weather" class="${w.enabled?'':'primary'}" aria-pressed="${w.enabled}">${w.enabled?text('关闭天气加成','Disable bonuses'):text('开启天气加成','Enable bonuses')}</button></div><h3>${text('未来三日预报','The next three game days')}</h3><div class="weather-forecast">${[1,2,3].map(n=>{const f=weatherView(s,n);return `<article><span>${f.icon}</span><small>${text(`第 ${f.day} 日`,`Day ${f.day}`)}</small><b>${named(f)}</b><p>${text(...f.description)}</p></article>`;}).join('')}</div><p class="village-note">${text('天气玩法默认关闭，可随时开启。每 180 个游戏秒换一次天气，只有正向加成；太阳能夜间仍暂停。天气和研究只缩短新批次的基础周期，不赠送原料、不跳过搬运，也不会重置已经付款的批次。暂停、关闭页面时天气不会前进。','Weather is optional and starts disabled. It changes every 180 game seconds and only grants bonuses. Solar still stops at night. Weather and research shorten base cycles for new batches without granting ingredients, skipping hauling or resetting paid work. Pausing or closing stops the weather clock.')}</p>`;
  }
  function achievementPane(s){
    return `<p class="village-note">${text('从本次升级开始记录，八项长期目标跨轮保留，每项只能领取一次。奖励为经营币与研究点，TOM 仍通过原五阶段挑战获得。','Tracked from this update. Eight lifetime goals persist across rounds and can each be claimed once. Rewards are farm coins and research points; TOM comes from the existing five-stage challenge.')}</p><div class="achievement-grid">${achievementRows(s).map(a=>`<article class="achievement-card ${a.claimed?'claimed':''}"><span>${a.icon}</span><div><h3>${named(a)}</h3><progress aria-label="${esc(named(a))}" max="${a.target}" value="${Math.min(a.value,a.target)}"></progress><small>${Math.min(a.value,a.target)} / ${a.target} · ◈ ${a.cash} · ＋${a.points} RP</small></div><button data-village-action="achievement" data-id="${a.id}" ${a.claimed||a.value<a.target?'disabled':''}>${a.claimed?text('已领取 ✓','Claimed ✓'):text('领取奖励','Claim reward')}</button></article>`).join('')}</div>`;
  }
  return {render,open};
}
