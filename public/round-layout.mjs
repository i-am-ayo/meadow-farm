import {ROUND_CASH, restartFarm, ordinaryItem, buildOrdinary, placeAsset} from './rules.mjs?v=8.1';

export const STARTER_LAYOUT = [
  ...Array.from({length: 6}, (_, i) => ({kind: 'ordinary', key: 'road', x: i + 2, y: 8})),
  ...Array.from({length: 3}, (_, i) => ({kind: 'ordinary', key: 'road', x: 6, y: i + 5})),
  ...[['barn',5,7],['well',3,7],['mill',6,4],['bakery',7,6],['wheat',2,7],['wheat',3,6]]
    .map(([key,x,y]) => ({kind: 'ordinary', key, x, y}))
];
export function captureLayout(s) {
  const items = [...s.roads.map(b => ({kind: 'ordinary', key: 'road', x: b.x, y: b.y})),
    ...s.buildings.flatMap(b => b.assetId ? [{kind: 'nft', id: b.assetId, x: b.x, y: b.y}]
      : ordinaryItem(b.modelId || b.type) ? [{kind: 'ordinary', key: b.modelId || b.type, x: b.x, y: b.y}] : [])];
  return items.length ? items : structuredClone(s.savedLayout || []);
}
function apply(fresh, items) {
  let cost = 0, reason = '';
  if (!Array.isArray(items) || items.length > 576) return {allowed: false, reason: '布局记录无效', cost: 0};
  // Validate against the real placement/purchase rules using a disposable copy.
  // A failed layout never charges or partially replaces the player's farm.
  const costs = items.map(item => item.kind === 'nft' ? 0 : ordinaryItem(item.key)?.cost);
  if (costs.some(n => !Number.isSafeInteger(n))) return {allowed: false, reason: '布局型号不存在', cost: 0};
  cost = costs.reduce((n, value) => n + value, 0);
  if (cost > fresh.cash) return {allowed: false, cost, reason: '启动资金不足以重建此布局'};
  for (const item of items) {
    const ok = item.kind === 'nft' ? placeAsset(fresh, item.id, item.x, item.y)
      : buildOrdinary(fresh, item.key, item.x, item.y);
    if (!ok) {reason = '布局位置冲突，或 NFT 已挂单 / 不再持有'; break;}
  }
  return {allowed: !reason && items.length > 0, cost, reason: reason || (!items.length ? '暂无可复用布局' : ''), count: items.length};
}
export function roundLayoutQuote(s, now = Date.now()) {
  const items = captureLayout(s), fresh = restartFarm(structuredClone(s), now);
  return {...apply(fresh, items), items, budget: ROUND_CASH};
}
export function startNewRound(s, reuse = false, now = Date.now()) {
  const items = captureLayout(s), fresh = restartFarm(structuredClone(s), now);
  if (reuse && !apply(fresh, items).allowed) return null;
  fresh.savedLayout = items;
  return fresh;
}
export function starterQuote(s) {
  const copy = structuredClone(s);
  return apply(copy, STARTER_LAYOUT);
}
export function buildStarter(s) {
  if (!starterQuote(s).allowed) return false;
  apply(s, STARTER_LAYOUT);
  return true;
}
