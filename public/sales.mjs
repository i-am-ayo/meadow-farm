import {today} from './daily-challenge.mjs?v=8.1';

const blank = () => ({revenue: 0, trips: 0, units: 0, products: {}});
function add(total, sale) {
  total.revenue += sale.cash;
  total.trips++;
  total.units += sale.amount;
  const item = total.products[sale.resource] ??= {revenue: 0, trips: 0, units: 0};
  item.revenue += sale.cash;
  item.trips++;
  item.units += sale.amount;
}
// Called only at the truck's settlement, never at dispatch. The delivery is
// cleared by tick immediately afterwards, preventing duplicate cash or reports.
export function recordSale(s, delivery, now) {
  const book = s.salesBook ??= {totals: blank(), days: {}, recent: []};
  const sale = {resource: delivery.resource || 'bread', amount: delivery.amount ?? 3,
    cash: delivery.cash ?? 90, at: now, roundId: s.round?.id, automatic: !!delivery.automatic};
  add(book.totals, sale);
  add(book.days[today(now)] ??= blank(), sale);
  book.recent.unshift(sale);
  book.recent = book.recent.slice(0, 100);
  for (const day of Object.keys(book.days).sort().slice(0, -30)) delete book.days[day];
}
export function salesReport(s, period = 'today', now = Date.now()) {
  const book = s.salesBook;
  const total = period === 'all' ? book?.totals : book?.days[today(now)];
  return {...structuredClone(total || blank()), recent: (book?.recent || []).filter(sale =>
    period === 'all' || today(sale.at) === today(now))};
}
