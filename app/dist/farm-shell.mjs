import {domUpdates as dom} from './dom-updates.mjs?v=8.1';
import {preferences} from './farm-assistant.mjs?v=8.1';

const $=selector=>document.querySelector(selector);
const text=(zh,en)=>document.documentElement.lang==='en'?en:zh;
const sections=[['inventory','库存','Stock'],['trade','贸易','Trade'],['challenge','挑战','Goals'],['development','发展','Plans'],['assets','资产','Assets']];
const tools=[
  ['development','↗','发展路线','Growth plans'],['assets','✦','NFT 资产','NFT assets'],
  ['orders','✉','村民委托','Requests'],['research','⌘','农场研究','Research'],
  ['production','⚒','生产调度','Production'],['weather','☀','天气预报','Weather'],
  ['achievements','✧','经营成就','Milestones']
];

// Move the existing live nodes instead of cloning markup. Their IDs, saved
// values, build handlers, trade controls and translation records stay intact.
export function mountFarmShell(hooks){
  document.body.classList.add('farm-app');
  const main=$('#farmmain'),layout=$('.layout'),aside=$('.layout>aside'),world=$('.world'),buildbar=$('.buildbar');
  const center=document.createElement('section');center.className='shell-center';
  center.setAttribute('aria-label',text('地图与快捷建造','Map and quick construction'));
  center.append(world,buildbar);
  const rail=document.createElement('nav');rail.className='shell-rail';rail.dataset.i18nIgnore='';
  for(const [id,icon]of tools){const button=document.createElement('button');button.type='button';button.dataset.shellTool=id;button.innerHTML=`<span aria-hidden="true">${icon}</span><b></b>`;rail.append(button);}
  aside.classList.add('shell-sidebar');
  const tabs=document.createElement('nav');tabs.className='shell-tabs';tabs.dataset.i18nIgnore='';
  const pane=document.createElement('div');pane.className='shell-pane';
  const panels={inventory:$('.inventory'),trade:$('.orders'),challenge:$('.dailychallenge'),development:$('.strategyboard'),assets:$('.assetoverview')};
  const learning=document.createElement('section');learning.className='shell-learning';
  const learningHeading=document.createElement('div');learningHeading.className='shell-learning-heading';learningHeading.dataset.i18nIgnore='';
  learning.append(learningHeading,$('.farm-coach'),$('.tip'));panels.learning=learning;
  for(const [id,panel]of Object.entries(panels)){panel.id=`shell-panel-${id}`;panel.setAttribute('role','tabpanel');pane.append(panel);}
  for(const [id]of sections){const b=document.createElement('button');b.type='button';b.dataset.shellTab=id;b.id=`shell-tab-${id}`;b.setAttribute('role','tab');b.setAttribute('aria-controls',panels[id].id);panels[id].setAttribute('aria-labelledby',b.id);tabs.append(b);}
  const close=document.createElement('button');close.className='shell-close-panel';close.dataset.i18nIgnore='';
  const sideFooter=document.createElement('div');sideFooter.className='shell-side-footer';
  const tutorial=document.createElement('button');tutorial.id='shell-tutorial';tutorial.dataset.i18nIgnore='';
  sideFooter.append(tutorial,$('#reset'));
  aside.replaceChildren(close,tabs,pane,sideFooter);layout.replaceChildren(rail,center,aside);
  const mobileTabs=document.createElement('nav');mobileTabs.className='shell-mobile-tabs';mobileTabs.dataset.i18nIgnore='';
  for(const [id]of sections){const b=document.createElement('button');b.type='button';b.dataset.shellTab=id;mobileTabs.append(b);}center.insertBefore(mobileTabs,buildbar);
  const strip=$('.village-strip'),economy=$('.towneconomy'),day=$('.day');
  const coinUnit=document.createElement('em'),starUnit=document.createElement('em');
  $('#cash').parentElement.replaceChildren(document.createTextNode('◈ '),$('#cash'),coinUnit);
  $('#stars').parentElement.replaceChildren(document.createTextNode('☆ '),$('#stars'),starUnit);
  const dayPrefix=document.createElement('span'),daySuffix=document.createElement('span');
  day.replaceChildren($('.live'),$('#skytext'),dayPrefix,$('#day'),daySuffix,$('#dayphase'));
  strip.append(economy,day);
  const hint=$('.context-hint');main.append(hint);
  let active='inventory',sideOpen=false;
  function select(id,focus=false){
    if(!panels[id])return;active=id;sideOpen=true;
    for(const [key,panel]of Object.entries(panels))panel.hidden=key!==id;
    pane.scrollTop=0;render();
    if(focus)tabs.querySelector(`[data-shell-tab="${id}"]`)?.focus();
  }
  function handleTab(e){const button=e.target.closest('[data-shell-tab]');if(button)select(button.dataset.shellTab);}
  tabs.addEventListener('click',handleTab);mobileTabs.addEventListener('click',handleTab);
  tabs.setAttribute('role','tablist');
  tabs.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const current=sections.findIndex(([id])=>id===active),index=e.key==='Home'?0:e.key==='End'?sections.length-1:(current+(e.key==='ArrowRight'?1:-1)+sections.length)%sections.length;
    e.preventDefault();select(sections[index][0],true);
  });
  rail.addEventListener('click',e=>{
    const button=e.target.closest('[data-shell-tool]');if(!button)return;
    const id=button.dataset.shellTool;if(id==='development'||id==='assets')select(id);else hooks.village(id);
  });
  tutorial.onclick=()=>select('learning');close.onclick=()=>{sideOpen=false;render();};
  learningHeading.addEventListener('click',e=>{
    if(e.target.closest('[data-shell-help]'))hooks.help();
    if(e.target.closest('[data-shell-replay]')){const p=preferences(hooks.getState());p.tutorialDone=false;p.tutorialStep=0;hooks.refresh();}
  });
  // Use the existing familiar shortcut, now with an inline inventory panel.
  $('#quick-inventory').onclick=()=>select('inventory');
  function render(){
    const s=hooks.getState(),p=preferences(s),phase=s.seconds%180,daytime=phase<120;
    // This strip owns its bilingual text; it is outside the automatic translator.
    dom.text(coinUnit,text('经营币','Farm coins'));dom.text(starUnit,text('星星','Stars'));
    dom.text($('#skytext'),daytime?text('☀ 白天','☀ Daytime'):text('☾ 夜晚','☾ Night'));
    dom.text(dayPrefix,text(' · 第',' · Day '));dom.text(daySuffix,text('天',''));
    dom.text($('#dayphase'),daytime?text(`${120-phase} 秒后入夜`,`Night in ${120-phase}s`):text(`${180-phase} 秒后天亮`,`Dawn in ${180-phase}s`));
    dom.attribute(center,'aria-label',text('地图与快捷建造','Map and quick construction'));
    for(const [id,zh,en]of sections)for(const button of document.querySelectorAll(`[data-shell-tab="${id}"]`)){
      dom.text(button,text(zh,en));dom.attribute(button,'aria-selected',String(active===id));
      if(button.closest('.shell-tabs'))dom.property(button,'tabIndex',active===id||active==='learning'&&id==='inventory'?0:-1);
    }
    for(const [id,,zh,en]of tools){const button=rail.querySelector(`[data-shell-tool="${id}"]`);dom.text(button.querySelector('b'),text(zh,en));dom.property(button,'title',text(zh,en));
      if(id==='development'||id==='assets')dom.attribute(button,'aria-pressed',String(active===id));
    }
    dom.attribute(rail,'aria-label',text('小镇功能导航','Town tools'));dom.attribute(tabs,'aria-label',text('经营面板','Farm panels'));
    dom.attribute(mobileTabs,'aria-label',text('经营面板快捷切换','Quick farm panels'));
    dom.text(tutorial,text(`? 新手教程${p.tutorialDone?'':' · '+((p.tutorialStep||0)+1)+'/4'}`,`? Tutorial${p.tutorialDone?'':' · '+((p.tutorialStep||0)+1)+'/4'}`));
    dom.attribute(tutorial,'aria-pressed',String(active==='learning'));
    dom.text(close,text('收起面板 →','Close panel →'));
    dom.attribute(layout,'data-side-open',String(sideOpen));
    dom.property($('.village-weather'),'title',$('.village-weather').textContent.trim());
    const hintText=hint.querySelector('span');if(hintText)dom.property(hintText,'title',hintText.textContent);
    dom.html(learningHeading,`<h2>${text('一步一步，建好小镇','A little guidance')}</h2><p>${text('地图一直在旁边，按需要学习。','Keep the farm in view and learn at your own pace.')}</p><button data-shell-replay>${text('重新开始四步教程','Restart the four-step tutorial')}</button><button data-shell-help>${text('查看操作说明','Open controls & help')}</button>`);
  }
  for(const [id,panel]of Object.entries(panels))panel.hidden=id!==active;
  document.addEventListener('languagechange',render);render();
  return {render,select};
}
