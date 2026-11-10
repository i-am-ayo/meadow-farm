// Only wallet farms keep a replay trace. Local teaching/demo farms pay no cost.
export function trace(s,op,args=[]){if(s.proof?.events)s.proof.events.push({op,args});}
export function enableTrace(s,checkpoint=null){
  s.proof={version:1,initial:{roundId:s.round.id,serial:s.roundSerial,createdAt:s.round.startedAt,checkpoint,automation:structuredClone(s.preferences?.automation||{}),
    assets:s.assets.map(a=>({id:a.id,modelId:a.modelId})),claimedStages:s.daily?.stageClaims?.length||0},events:[]};
  return s.proof;
}
export function recallAsset(s,id){
  if(!s.buildings.some(b=>b.assetId===id))return false;
  s.buildings=s.buildings.filter(b=>b.assetId!==id);trace(s,'recall',[id]);return true;
}
export function enableFacility(s,b,enabled){
  const owner=b.assetId?s.assets.find(a=>a.id===b.assetId):b;if(!owner)return false;
  owner.enabled=!!enabled;trace(s,'enable',[b.assetId||null,b.x,b.y,!!enabled]);return true;
}
export function setWeather(s,enabled){s.village.weatherEnabled=!!enabled;trace(s,'weather',[!!enabled]);}
