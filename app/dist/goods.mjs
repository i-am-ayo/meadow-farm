export const RESOURCE_NAMES = {water:'清水',wheat:'小麦',flour:'面粉',bread:'面包',energy:'电力',milk:'牛奶',cake:'蛋糕',vegetables:'蔬菜',wood:'木材'};
export const RESOURCE_ICONS = {water:'💧',wheat:'🌾',flour:'🥡',bread:'🥖',energy:'⚡',milk:'🥛',cake:'🍰',vegetables:'🥬',wood:'🪵'};
// These goods share one warehouse pool. Adding a product must not silently
// create a separate copy of the warehouse's capacity for that product.
export const WAREHOUSE_GOODS = ['flour','bread','milk','cake','vegetables','wood'];
export const warehouseStock = s => WAREHOUSE_GOODS.reduce((n,k) => n+(s[k]||0),0);
