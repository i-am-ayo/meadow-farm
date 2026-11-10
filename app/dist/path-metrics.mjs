const paths=new WeakMap();
// Routes are immutable after construction. A reroute/reloaded save supplies a
// new array and automatically gets fresh lengths; old routes can be collected.
export function routeMetrics(route) {
  let value=paths.get(route);if(value)return value;
  const lengths=route.slice(1).map((p,i)=>Math.hypot(p.x-route[i].x,p.y-route[i].y));
  value={lengths,total:lengths.reduce((a,b)=>a+b,0)};paths.set(route,value);return value;
}
const returns=new WeakMap();
export function returnRoute(route){let value=returns.get(route);if(!value){value=[...route].reverse();returns.set(route,value)}return value}
