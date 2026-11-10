import {challengeView,challengeReadiness} from './rules.mjs?v=8.1';

// Viewing a task never consumes an attempt. Only the final start action checks
// these gates, and every gate has a player-facing explanation and next step.
export function challengeEntry(s,now=Date.now()){
 const view=challengeView(s,now),readiness=challengeReadiness(s,view.plan.id),issues=[];
 if(view.needsRebuild)issues.push({kind:'round',text:s.round?.legacy?'这是旧农场。先新开局重新建设，TOM 和 NFT 会保留。':`这轮农场已结算过奖励。新开局建设后可挑战今日第 ${view.stage} 阶段，已经领到的 TOM 会保留。`});
 if(view.status==='claimed')issues.push({kind:'quota',text:'今天五个阶段已全部领奖。北京时间明天 00:00 重置阶段进度，新的奖励仍需新开局建设。'});
 else if(view.status==='expired')issues.push({kind:'retry',text:'上次任务超时未完成，可以保留农场重新挑战，重置倒计时和本次任务进度。'});
 else if(view.status==='active')issues.push({kind:'active',text:'本轮挑战正在计时。也可选择重新开始：建设和库存保留，倒计时与本次目标进度归零。'});
 else if(view.status==='completed')issues.push({kind:'completed',text:'本轮已在时限内达标，请返回任务面板领取奖励，无需再次开始。'});
 if(!readiness.ready)issues.push({kind:'facilities',text:'生产线还未准备好，请按下方清单补齐、启用并接通设施。'});
 if(!view.canFitToday&&['ready','active','expired'].includes(view.status))issues.push({kind:'time',text:`今天剩余时间不足以完整挑战本阶段（需 ${view.plan.seconds/60} 分钟），北京时间 00:00 后可开启新一天的阶段。`});
 const canStart=view.status==='ready'&&!view.needsRebuild&&readiness.ready&&view.canFitToday;
 const canRetry=['active','expired'].includes(view.status)&&!view.needsRebuild&&readiness.ready&&view.retrySeconds>0;
 const startLabel=canRetry?'重新开始任务':canStart?'确认开始计时':view.status==='active'?'挑战正在进行':view.status==='completed'?'已达标，返回领取奖励':issues.some(i=>i.kind==='quota')?'今日五阶段已完成':issues.some(i=>i.kind==='time')?'今日时间不足':view.needsRebuild?'需先新开局建设':'需先完成设施准备';
 return {view,readiness,issues,canStart,canRetry,canBegin:canStart||canRetry,startLabel};
}
