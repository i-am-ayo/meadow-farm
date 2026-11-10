import {findHaulRoute} from './hauling.mjs?v=8.1';
import {MAP_SIZE} from './geography.mjs?v=8.1';

export const TREE_REGROW_SECONDS = 90;
const distance = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const treeReady = (s,tree) => tree.type==='tree' && (tree.regrowsAt||0)<=s.seconds;
export function findTimberTree(s,camp,radius) {
  return s.buildings.filter(tree => treeReady(s,tree) && distance(tree,camp)<=radius)
    .sort((a,b)=>distance(a,camp)-distance(b,camp)||a.x-b.x||a.y-b.y)
    .find(tree => findHaulRoute(s,camp,tree,MAP_SIZE));
}
// Reserve the real tree when a paid production batch starts. A second camp
// sees the stump immediately and cannot harvest the same tree a second time.
export function fellTree(s,tree) {
  if (!s.buildings.includes(tree) || !treeReady(s,tree)) return false;
  tree.cutAt=s.seconds;
  tree.regrowsAt=s.seconds+TREE_REGROW_SECONDS;
  return true;
}
export function treeGrowth(s,tree) {
  return treeReady(s,tree) ? 1 : Math.max(0,Math.min(1,1-(tree.regrowsAt-s.seconds)/TREE_REGROW_SECONDS));
}
