// Compare the source value, not translated innerHTML/textContent. Translation
// may change the live DOM after a write; identical game data still needs no write.
export function createDOMUpdates() {
  let records=new WeakMap();
  function changed(node,key,value) {
    let previous=records.get(node);if(!previous){previous=new Map();records.set(node,previous);}
    if(previous.has(key)&&previous.get(key)===value)return false;
    previous.set(key,value);return true;
  }
  return {
    text(node,value){value=String(value);if(changed(node,'text',value))node.textContent=value;},
    html(node,value){if(changed(node,'html',value))node.innerHTML=value;},
    replaceHTML(node,value){records.delete(node);node.innerHTML=value;},
    attribute(node,key,value){value=String(value);if(changed(node,'attr:'+key,value))node.setAttribute(key,value);},
    property(node,key,value){if(changed(node,'prop:'+key,value))node[key]=value;},
    reset(){records=new WeakMap();}
  };
}

export const domUpdates=createDOMUpdates();
