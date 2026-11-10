// Ordinary facilities use operating cash, are placed per purchase and remain in
// the current round. Existing basic IDs retain compatibility with saved farms.
export const ORDINARY_GRADES=['基础型','改良型','高效型'];
export const ORDINARY_GROUPS={production:['wheat','vegetable','lumber','mill','bakery','dairy','cakery'],utilities:['well','solar','wind','tower'],logistics:['barn','silo','warehouse','tractor','depot'],construction:['road','tree']};
export function ordinaryCatalog(catalog){
 const costs={well:60,mill:100,bakery:140,solar:140,wind:200,tower:100,silo:130,warehouse:150,tractor:150,depot:180,dairy:180,cakery:240,vegetable:70,lumber:140};
 const names={well:['木架水井','砖砌深水井','高压供水井'],mill:['木制磨坊','改良风车磨坊','高效研磨工坊'],bakery:['乡村面包房','双炉面包房','高效烘焙工坊'],solar:['基础太阳能板','屋顶光伏阵列','高效光伏阵列'],wind:['简易风力机','改良风力机','高效风力机'],tower:['木架水塔','砖砌蓄水塔','大容量蓄水塔'],silo:['木板筒仓','加固粮食筒仓','大容量粮食筒仓'],warehouse:['普通货仓','改良集配货仓','高效集配货仓'],tractor:['简易电动搬运车','电动搬运拖车','高效运输机器人'],depot:['普通快递站','快捷货运站','高效货运站'],dairy:['乡村奶牛牧场','改良奶牛牧场','高效乳品牧场'],cakery:['乡村蛋糕房','改良甜品工坊','高效甜品工坊'],vegetable:['乡村菜地','灌溉蔬菜园','高效蔬菜农场'],lumber:['简易伐木场','改良伐木场','高效林业站']};
 return Object.entries(costs).flatMap(([type,baseCost])=>{
  const counterparts=catalog.filter(n=>n.type===type);
  return [0,1,2].map(grade=>{
   const n=counterparts[Math.min(grade,counterparts.length-1)],fraction=[.6,.75,.9][grade];
   return {...n,id:['basic-','standard-','advanced-'][grade]+type,type,name:names[type][grade],ordinary:true,grade,tier:-1,cost:Math.round(baseCost*[1,1.8,3][grade]/5)*5,price:undefined,
    cycle:n.cycle?(counterparts.length===1?n.cycle+[4,2,1][grade]:Math.ceil(n.cycle*[1.2,1.15,1.08][grade])):0,
    radius:n.radius?Math.max(1,n.radius-1):undefined,
    storage:n.storage?Object.fromEntries(Object.entries(n.storage).map(([k,v])=>[k,Math.floor(v*fraction)])):undefined,
    handlingReduction:n.handlingReduction?n.handlingReduction*[.5,.7,.9][grade]:undefined,
    shippingTime:n.shippingTime?[10,9,8][grade]:undefined};
  });
 });
}
export const ordinaryModels=catalog=>Object.fromEntries(ordinaryCatalog(catalog).filter(m=>m.grade===0).map(m=>[m.type,m]));
