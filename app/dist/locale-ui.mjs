import {LANGUAGE_KEY,normalizeLanguage,translate} from './i18n.mjs?v=8.1';
// Track original text per live node, so a switch restores Chinese without rebuilding
// controls, replacing user input, or changing any saved game record.
export function createLanguageUI(doc=document,storage=localStorage){
 let language='zh-CN';try{language=normalizeLanguage(storage.getItem(LANGUAGE_KEY))}catch{}
 const originals=new WeakMap(),attributes=new WeakMap(),attributeNames=['title','aria-label','aria-valuetext','placeholder','alt'];
 const skipped=node=>node.parentElement?.closest('script,style,textarea,[contenteditable="true"],[data-i18n-ignore]');
 const valueFor=(node,value,map)=>{const previous=map.get(node),source=previous&&value===previous.translated?previous.source:value,translated=translate(source,language);map.set(node,{source,translated});return translated};
 function localize(node){
  if(node.nodeType===3){if(!skipped(node)){const next=valueFor(node,node.nodeValue,originals);if(node.nodeValue!==next)node.nodeValue=next}return}
  if(node.nodeType!==1||node.matches('script,style,textarea,[contenteditable="true"],[data-i18n-ignore]'))return;
  let records=attributes.get(node);if(!records){records=new Map();attributes.set(node,records)}
  for(const name of attributeNames)if(node.hasAttribute(name)){const value=node.getAttribute(name),old=records.get(name),source=old&&value===old.translated?old.source:value,next=translate(source,language);records.set(name,{source,translated:next});if(value!==next)node.setAttribute(name,next)}
  for(const child of node.childNodes)localize(child);
 }
 const observer=new MutationObserver(records=>{
  const roots=new Set();for(const record of records){if(record.type==='childList')for(const node of record.addedNodes)roots.add(node);else roots.add(record.target)}
  // Ignore our own translation writes and collapse parent/child mutations into
  // one walk. Attribute updates on a child of an opt-out region need no walk.
  observer.disconnect();
  try{for(const root of roots){
   if(!root.isConnected||root.parentElement?.closest('[data-i18n-ignore]'))continue;
   let parent=root.parentNode,covered=false;while(parent){if(roots.has(parent)){covered=true;break}parent=parent.parentNode}
   if(!covered)localize(root);
  }}finally{observe()}
 });
 const observe=()=>observer.observe(doc.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attributeNames});
 function refresh(){
  observer.disconnect();doc.documentElement.lang=language;localize(doc.documentElement);
  for(const button of doc.querySelectorAll('[data-language-toggle]')){button.setAttribute('aria-label',language==='en'?'Switch to Simplified Chinese':'切换为 English');button.setAttribute('aria-pressed',String(language==='en'));for(const label of button.querySelectorAll('[data-language]'))label.classList.toggle('active',label.dataset.language===language)}
  observe();
 }
 function setLanguage(value){language=normalizeLanguage(value);try{storage.setItem(LANGUAGE_KEY,language)}catch{}refresh();doc.dispatchEvent(new CustomEvent('languagechange',{detail:{language}}))}
 for(const button of doc.querySelectorAll('[data-language-toggle]'))button.addEventListener('click',()=>setLanguage(language==='zh-CN'?'en':'zh-CN'));
 refresh();return {getLanguage:()=>language,setLanguage,refresh,destroy:()=>observer.disconnect()};
}
