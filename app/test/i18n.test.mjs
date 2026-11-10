import test from 'node:test';
import assert from 'node:assert/strict';
import {translate,searchMatches,normalizeLanguage} from '../dist/i18n.mjs';
import {CATALOG,ORDINARY_CATALOG,RESOURCE_NAMES,TYPE_NAMES,TIERS,BASIC_BUILDINGS,ORDERS,QUESTS,CHALLENGES,effectText,summaryText,goodsText,newFarmAccount} from '../dist/rules.mjs';
import {challengeEntry} from '../dist/challenge-entry.mjs';
const BASE=Date.parse('2030-05-12T10:00:00+08:00');
function englishOnly(text){assert.doesNotMatch(translate(text,'en'),/\p{Script=Han}/u,text)}
test('only the two supported languages are accepted and Chinese text restores exactly',()=>{
 assert.equal(normalizeLanguage('en'),'en');assert.equal(normalizeLanguage('zh-CN'),'zh-CN');for(const value of [null,undefined,'fr',''])assert.equal(normalizeLanguage(value),'zh-CN');
 assert.equal(translate('  第 5 阶段 · 丰收庆典  ','zh-CN'),'  第 5 阶段 · 丰收庆典  ');assert.equal(translate('NFT-A-0001 · 80 TOM'),'NFT-A-0001 · 80 TOM');
});
test('all NFT and standard facility names, grades, recipes and effects have English coverage',()=>{
 const before=JSON.stringify({CATALOG,ORDINARY_CATALOG,BASIC_BUILDINGS});
 for(const m of [...CATALOG,...ORDINARY_CATALOG]){englishOnly(m.name);englishOnly(effectText(m));englishOnly(summaryText(m));if(m.cycle){englishOnly(goodsText(m.inputs));englishOnly(goodsText(m.outputs))}}
 for(const text of [...Object.values(RESOURCE_NAMES),...Object.values(TYPE_NAMES),...TIERS])englishOnly(text);
 for(const b of Object.values(BASIC_BUILDINGS)){englishOnly(b.name);englishOnly(b.desc)}
 assert.equal(JSON.stringify({CATALOG,ORDINARY_CATALOG,BASIC_BUILDINGS}),before,'display translation must never modify asset models or their recipes');
});
test('all five stages, orders, milestones and preparation reasons have English coverage',()=>{
 for(const p of CHALLENGES){englishOnly(p.name);englishOnly(p.tip);for(const g of p.goals)englishOnly(g.label)}
 for(const o of ORDERS){englishOnly(o.name);englishOnly(o.desc)}for(const q of QUESTS){englishOnly(q.name);englishOnly(q.desc)}
 const s=newFarmAccount('A',BASE),entry=challengeEntry(s,BASE);for(const check of entry.readiness.checks){englishOnly(check.label);englishOnly(check.reason)}for(const issue of entry.issues)englishOnly(issue.text);
});
test('dynamic stage messages preserve goal quantities, reward values and account IDs',()=>{
 assert.equal(translate('第 5 阶段 · 丰收庆典'),'Stage 5 · Harvest Festival');assert.equal(translate('○ 新生产 10 份蛋糕'),'○ Produce 10 cake');
 assert.equal(translate('运回结算 15 份面包'),'Deliver 15 bread');assert.equal(translate('完成 15 次货车往返'),'Complete 15 delivery trips');
 assert.equal(translate('今日已领 2 / 5 阶段 · 基础奖励 56 TOM'),'Today: 2 / 5 stages · 56 TOM earned');assert.equal(translate('农场主 B ↗'),'Farmer B ↗');
 assert.equal(translate('领取第 5 阶段 · 80 TOM'),'Claim Stage 5 · 80 TOM');
});
test('refund previews and live timers retain their values and meaning',()=>{
 assert.equal(translate('确认拆除 · 返还 150 经营币'),'Confirm removal · Refund 150 coins');assert.equal(translate('拆除高效研磨工坊？'),'Remove Advanced Flour Mill?');
 assert.equal(translate('120 秒后入夜'),'Night in 120s');assert.equal(translate('3 人搬运中'),'3 villagers hauling');assert.equal(translate('货车回来了：＋90 经营币、＋40 星星。'),'Truck returned: +90 farm coins, +40 stars.');
 assert.equal(translate('范围 4 格内搬运时间减少 52.49999999999999%，每 12 秒消耗 2 电力'),'52.5% less hauling time within 4 tiles; uses 2 power every 12s.');
});
test('shop and market search accept both languages and preserve exact asset ID searches',()=>{
 assert.ok(searchMatches('ranch','改良奶牛牧场'));assert.ok(searchMatches('改良','改良奶牛牧场'));assert.ok(searchMatches('PRESSURE','高压供水井'));
 assert.ok(searchMatches('NFT-A-0001','NFT-A-0001'));assert.ok(searchMatches('','木制磨坊'));assert.equal(searchMatches('bakery','木架水井'),false);
});
