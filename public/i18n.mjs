import {ENGLISH} from './translations.mjs?v=8.1';
export const LANGUAGE_KEY='meadow-farm-language';
export const LANGUAGES=['zh-CN','en'];
export const normalizeLanguage=value=>value==='en'?'en':'zh-CN';
const han=/\p{Script=Han}/u;
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const vocabulary=new RegExp(Object.keys(ENGLISH).sort((a,b)=>b.length-a.length).map(escaped).join('|'),'gu');
const cache=new Map();
const patterns=[
 [/^村民取货完成：＋(\d+) 经营币、＋(\d+) XP、＋1 研究点。$/,(_,cash,xp)=>`Collected: +${cash} coins, +${xp} XP and +1 research point.`],
 [/^林木再生中 · (\d+) 秒$/,(_,n)=>`Tree regrowing · ${n}s`],
 [/^采伐半径 (\d+) 格内的成熟林木，砍后 90 秒再生；装饰景观树不作为木材来源$/,(_,n)=>`Harvest mature trees within ${n} tiles; regrowth takes 90s. Scenery trees are not timber sources.`],
 [/^农场主 ([A-Z])(.+)$/,(_,id,rest)=>`Farmer ${id}${en(rest)}`],
 [/^农场主 ([A-Z])$/,(_,id)=>`Farmer ${id}`],
 [/^今日已领 (\d+) \/ (\d+) 阶段 · 基础奖励 (\d+) TOM$/,(_,n,total,reward)=>`Today: ${n} / ${total} stages · ${reward} TOM earned`],
 [/^第 (\d+) 阶段 · (.+)$/,(_,n,name)=>`Stage ${n} · ${en(name)}`],
 [/^第 (\d+) 阶段 (.+)，(\d+) TOM，(.+)$/,(_,n,name,reward,status)=>`Stage ${n}: ${en(name)}, ${reward} TOM, ${en(status)}`],
 [/^第 (\d+) 轮 · (\d+) 次建设(.*)$/,(_,n,builds,rest)=>`Round ${n} · ${builds} builds${en(rest)}`],
 [/^第 (\d+) 次尝试 · 剩余时间$/,(_,n)=>`Attempt ${n} · Time remaining`],
 [/^领取第 (\d+) 阶段 · (\d+) TOM$/,(_,n,reward)=>`Claim Stage ${n} · ${reward} TOM`],
 [/^查看当前第 (\d+) 阶段任务$/,(_,n)=>`View current Stage ${n}`],
 [/^第 (\d+) 阶段奖励已到账：＋(\d+) TOM。(.*)$/,(_,n,reward,rest)=>`Stage ${n} reward received: +${reward} TOM. ${en(rest)}`],
 [/^新生产 (\d+) 份(.+)$/,(_,n,resource)=>`Produce ${n} ${en(resource).toLowerCase()}`],
 [/^运回结算 (\d+) 份(.+)$/,(_,n,resource)=>`Deliver ${n} ${en(resource).toLowerCase()}`],
 [/^完成 (\d+) 次货车往返$/,(_,n)=>`Complete ${n} delivery trips`],
 [/^(\d+) 秒后入夜$/,(_,n)=>`Night in ${n}s`],
 [/^(\d+) 秒后天亮$/,(_,n)=>`Dawn in ${n}s`],
 [/^(\d+) 人搬运中$/,(_,n)=>`${n} villagers hauling`],
 [/^共 (\d+) (种型号|件资产)$/,(_,n,kind)=>`${n} ${kind==='种型号'?'models':'assets'}`],
 [/^显示 (\d+) \/ (\d+) 款$/,(_,n,total)=>`Showing ${n} / ${total}`],
 [/^(\d+) \/ (\d+) 件可放置 ↗$/,(_,n,total)=>`${n} / ${total} available ↗`],
 [/^还差 (\d+) 经营币$/,(_,n)=>`Need ${n} more coins`],
 [/^每 (\d+) 秒 \/ 次 · 另计搬运时间$/,(_,n)=>`Every ${n}s + hauling`],
 [/^每次运输 (\d+) 秒$/,(_,n)=>`${n}s per delivery`],
 [/^范围 (\d+) 格，搬运提速 ([\d.]+)%$/,(_,n,p)=>`Radius ${n} tiles · Hauling ${p}% faster`],
 [/^建造计价 (\d+) 经营币 · 拆除返还 ([\d.]+)%（向下取整）$/,(_,paid,rate)=>`Paid ${paid} farm coins · ${rate}% removal refund (rounded down)`],
 [/^拆除(.+)？$/,(_,name)=>`Remove ${en(name)}?`],
 [/^拆除 · 返还 (\d+) 经营币$/,(_,n)=>`Remove · Refund ${n} coins`],
 [/^确认拆除 · 返还 (\d+) 经营币$/,(_,n)=>`Confirm removal · Refund ${n} coins`],
 [/^(.+)已拆除，＋(\d+) 经营币已到账。$/,(_,name,n)=>`${en(name)} removed. +${n} farm coins received.`],
 [/^(.+)已建好，支付 (\d+) 经营币。$/,(_,name,n)=>`${en(name)} built for ${n} farm coins.`],
 [/^点击空地放置(.+) · (.+) · Esc 取消$/,(_,name,cost)=>`Click clear land to place ${en(name)} · ${en(cost)} · Esc to cancel`],
 [/^已用 (\d+)，容量 (\d+)$/,(_,used,capacity)=>`Used ${used}, capacity ${capacity}`],
 [/^约 (\d+) 秒后到达$/,(_,n)=>`Arrives in about ${n}s`],
 [/^搬运入库 · 还需 (\d+) 秒$/,(_,n)=>`Hauling to storage · ${n}s left`],
 [/^搬运入库 · (\d+) 秒$/,(_,n)=>`Hauling to storage · ${n}s`],
 [/^生产中 · (\d+) 秒$/,(_,n)=>`Producing · ${n}s`],
 [/^仓库搬运 \+(\d+) 秒(.*)$/,(_,n,rest)=>`Warehouse hauling +${n}s${en(rest)}`],
 [/^水箱 \+(\d+)，灌溉半径 (\d+) 格，仍需水井供水$/,(_,n,r)=>`Water capacity +${n}; irrigation radius ${r} tiles. A well is still needed.`],
 [/^小麦容量 \+(\d+)，可作为附近麦田的入库点$/,(_,n)=>`Wheat capacity +${n}; receives harvests from nearby fields.`],
 [/^加工仓容量 \+(\d+)，缩短附近工坊的搬运距离$/,(_,n)=>`Goods capacity +${n}; shortens hauling from nearby workshops.`],
 [/^灌溉半径 (\d+) 格$/,(_,n)=>`Irrigation radius: ${n} tiles`],
 [/^搬运 −([\d.]+)%$/,(_,n)=>`Hauling −${Number(Number(n).toFixed(1))}%`],
 [/^灌溉 (\d+) 格$/,(_,n)=>`Irrigation: ${n} tiles`],
 [/^运输 (\d+) 秒$/,(_,n)=>`Delivery: ${n}s`],
 [/^范围 (\d+) 格内搬运时间减少 ([\d.]+)%，每 12 秒消耗 (\d+) 电力$/,(_,r,p,cost)=>`${Number(Number(p).toFixed(1))}% less hauling time within ${r} tiles; uses ${cost} power every 12s.`],
 [/^每次消耗 1 电力，贸易运输从 12 秒缩短为 (\d+) 秒；没电时走普通货车$/,(_,n)=>`Uses 1 power per trip to reduce delivery from 12s to ${n}s. Uses a standard truck without power.`],
 [/^货车回来了：＋(\d+) 经营币、＋(\d+) 星星。$/,(_,cash,stars)=>`Truck returned: +${cash} farm coins, +${stars} stars.`],
 [/^货车出发！(电力快递|普通货车) (\d+) 秒后回到货运站结算。$/,(_,kind,n)=>`Truck dispatched! ${kind==='电力快递'?'Powered express':'Standard delivery'} returns in ${n}s to pay out.`],
 [/^(.+)已达成，获得 (\d+) (.+)。$/,(_,name,n,unit)=>`${en(name)} complete: +${n} ${en(unit)}.`],
 [/^已购买 (.+)，请选择空地放置。$/,(_,name)=>`${en(name)} purchased. Choose clear land to place it.`],
 [/^购买成功，(.+) 已进入我的 NFT。$/,(_,name)=>`Purchase complete. ${en(name)} is in My NFTs.`],
 [/^已切换到农场主 ([A-Z])，显示该账户的农场、资产与余额。$/,(_,id)=>`Switched to Farmer ${id}. This account's farm, assets and balance are now shown.`],
 [/^这轮农场已结算过奖励。新开局建设后可挑战今日第 (\d+) 阶段，已经领到的 TOM 会保留。$/,(_,n)=>`This farm has already earned a reward. Rebuild in a fresh round for today's Stage ${n}. Your TOM is preserved.`],
 [/^今天剩余时间不足以完整挑战本阶段（需 (\d+) 分钟），北京时间 00:00 后可开启新一天的阶段。$/,(_,n)=>`Not enough time remains today for this full ${n}-minute stage. New daily stages open at 00:00 Beijing time.`],
 [/^(\d+) 类设施 · (\d+) 款 · 生产与工具设施各三档。当前$/,(_,families,count)=>`${families} families · ${count} options · Three production and tool tiers. Balance: `],
 [/^；每座按价购买，本轮使用。已有 NFT 仍可免费按件数放置。$/,()=>`. Pay per placement for this round. Owned NFTs can still be placed for free, one per copy.`],
 [/^(.+)占用$/,(_,name)=>`${en(name)} usage`],
 [/^\+?(\d+) TOM 已领$/,(_,n)=>`${n} TOM claimed`],
 [/^(.+) 入库$/,(_,resource)=>`${en(resource)} stored`]
];
function en(source){
 if(!han.test(source))return source;
 const core=source.trim();
 if(Object.hasOwn(ENGLISH,core))return source.replace(core,()=>ENGLISH[core]);
 for(const [pattern,format]of patterns){const match=core.match(pattern);if(match)return source.replace(core,()=>format(...match))}
 const decoration=core.match(/^([^\p{L}\p{N}]+)([\s\S]+)$/u);
 if(decoration)return source.replace(core,()=>decoration[1]+en(decoration[2]));
 return source.replace(vocabulary,key=>ENGLISH[key]).replace(/，/g,', ').replace(/。/g,'. ').replace(/；/g,'; ').replace(/：/g,': ').replace(/（/g,' (').replace(/）/g,')').replace(/、/g,', ');
}
export function translate(text,language='en'){
 const source=String(text);if(normalizeLanguage(language)!=='en'||!han.test(source))return source;
 if(cache.has(source))return cache.get(source);
 const result=en(source);if(cache.size>5000)cache.clear();cache.set(source,result);return result;
}
export const searchMatches=(query,...values)=>{const q=String(query).trim().toLowerCase();return !q||values.some(value=>[String(value??''),translate(value??'','en')].some(text=>text.toLowerCase().includes(q)))};
