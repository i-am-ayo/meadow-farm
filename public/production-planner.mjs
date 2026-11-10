// Temporarily yield ingredients to unfinished deliveries. Do not toggle the
// building or cancel an already paid batch; normal production resumes when the
// demand is satisfied, automation is off, or the attempt ends.
export function shouldYieldIngredients(s, building, now = s.challengeClock ?? Date.now()) {
  const automation = s.preferences?.automation, a = s.daily?.challenge;
  if (!automation?.enabled || automation.balanceProduction === false || building.type !== 'cakery'
    || a?.status !== 'active' || now >= a.endsAt || s.round?.rewardClaimed || a.roundId !== s.round?.id) return false;
  const goals = a.planSnapshot?.goals || [];
  const cake = goals.find(g => g.kind === 'produced' && g.resource === 'cake');
  if (!cake || (a.produced.cake || 0) < cake.target) return false;
  return goals.some(g => ['bread','milk'].includes(g.resource) && ['produced','shipped'].includes(g.kind)
    && (a[g.kind]?.[g.resource] || 0) < g.target);
}
