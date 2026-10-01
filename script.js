/* ============================================================================
 * script.js — application core: state, global filters, aggregation engine,
 * alert & insight engines, router, drill-down drawer, order modal.
 * Pages register themselves on window.PAGES and are rendered on demand.
 * ==========================================================================*/
window.PAGES = {};
window.APP = (function () {
  'use strict';
  const DB = window.DB;
  const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOWS_L = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MAXD = DB.meta.nDays - 1;

  /* ------------------------------- state ---------------------------------- */
  const S = {
    page: 'exec',
    f: { preset: 'l7', from: MAXD - 6, to: MAXD, city: 'all', zone: 'all', store: 'all', status: 'all', cat: 'all', cust: 'all', pay: 'all', sla: 'all', hour: 'all', dow: 'all' },
    ctx: null
  };

  /* ---------------------------- formatting -------------------------------- */
  const enIN = (n) => Math.round(n).toLocaleString('en-IN');
  function fmtM(n, dec) {
    const a = Math.abs(n);
    if (a >= 1e7) return '₹' + (n / 1e7).toFixed(dec == null ? 2 : dec) + ' Cr';
    if (a >= 1e5) return '₹' + (n / 1e5).toFixed(dec == null ? 1 : dec) + ' L';
    if (a >= 1000) return '₹' + enIN(n);
    return '₹' + Math.round(n);
  }
  const fmtN = (n) => enIN(n);
  const fx = (n, d) => Number(n || 0).toFixed(d == null ? 1 : d);
  const fmtMin = (n) => fx(n, 1) + ' min';
  const pct1 = (n) => fx(n, 1) + '%';
  function dayLabel(d) { const dy = DB.days[d]; return dy ? DOWS[dy.dow] + ', ' + dy.label : '—'; }
  function dayLabelShort(d) { const dy = DB.days[d]; return dy ? dy.label : '—'; }
  function rangeLabel(from, to) { return from === to ? dayLabel(from) : dayLabelShort(from) + ' – ' + dayLabel(to); }
  const minOfDay = (m) => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return (h < 10 ? '0' + h : h) + ':' + (mm < 10 ? '0' + mm : mm); };
  const absTime = (t) => dayLabelShort(Math.floor(t / 1440)) + ' ' + minOfDay(t);

  /* --------------------------- aggregation -------------------------------- */
  function newAgg() {
    return {
      n: 0, del: 0, canc: 0, ret: 0, ref: 0, gmv: 0, rev: 0, disc: 0, fee: 0, refAmt: 0, items: 0,
      totS: 0, totN: 0, slaB: 0, le10: 0, le15: 0,
      accS: 0, accN: 0, pickS: 0, pickN: 0, packS: 0, packN: 0, asgS: 0, asgN: 0,
      waitS: 0, waitN: 0, rideS: 0, rideN: 0, stS: 0, stN: 0,
      cmp: 0, newC: 0, distS: 0, totArr: null,
      stores: null, riders: null, cus: null
    };
  }
  function addTo(a, o, heavy) {
    a.n++;
    a.gmv += o.val; a.disc += o.disc; a.fee += o.fee; a.items += o.items;
    if (o.status !== 1) a.rev += o.rev;
    a.refAmt += o.ref;
    if (o.status === 0) a.del++;
    else if (o.status === 1) a.canc++;
    else if (o.status === 2) a.ret++;
    else if (o.status === 3) a.ref++;
    if (o.n) a.newC++;
    if (o.cmp >= 0) a.cmp++;
    if (o.total >= 0) {
      a.totS += o.total; a.totN++;
      if (o.sla) a.slaB++;
      if (o.total <= 10) a.le10++;
      if (o.total <= 15) a.le15++;
      if (a.totArr) a.totArr.push(o.total);
    }
    if (o.acc >= 0) { a.accS += o.acc - o.t; a.accN++; }
    if (o.pkE >= 0 && o.pkS >= 0) { a.pickS += o.pkE - o.pkS; a.pickN++; }
    if (o.pkF >= 0 && o.pkE >= 0) { a.packS += o.pkF - o.pkE; a.packN++; }
    if (o.rAs >= 0 && o.acc >= 0) { a.asgS += o.rAs - o.acc; a.asgN++; }
    if (o.ds >= 0 && o.rAr >= 0) { a.waitS += Math.max(0, o.ds - o.rAr); a.waitN++; }
    if (o.del >= 0 && o.ds >= 0) { a.rideS += o.del - o.ds; a.rideN++; a.distS += o.dist; }
    if (o.ds >= 0) { a.stS += o.ds - o.t; a.stN++; }
    if (heavy) { a.stores.add(o.store); a.riders.add(o.rider); a.cus.add(o.cus); }
  }
  function aggregate(L, heavy) {
    const a = newAgg();
    if (heavy) { a.stores = new Set(); a.riders = new Set(); a.cus = new Set(); a.totArr = []; }
    for (let i = 0; i < L.length; i++) addTo(a, L[i], heavy);
    return a;
  }
  const g = (x) => (x && x.__der) || der(x);
  function der(a) {
    const d = {
      slaPct: a.totN ? 100 * (1 - a.slaB / a.totN) : 0,
      cancelRate: a.n ? 100 * a.canc / a.n : 0,
      delivSuccess: a.n ? 100 * a.del / a.n : 0,
      aov: a.n ? a.gmv / a.n : 0,
      revOrder: a.n ? a.rev / a.n : 0,
      avgTotal: a.totN ? a.totS / a.totN : 0,
      avgAcc: a.accN ? a.accS / a.accN : 0,
      avgPick: a.pickN ? a.pickS / a.pickN : 0,
      avgPack: a.packN ? a.packS / a.packN : 0,
      avgAsg: a.asgN ? a.asgS / a.asgN : 0,
      avgWait: a.waitN ? a.waitS / a.waitN : 0,
      avgRide: a.rideN ? a.rideS / a.rideN : 0,
      avgStore: a.stN ? a.stS / a.stN : 0,
      le10p: a.totN ? 100 * a.le10 / a.totN : 0,
      le15p: a.totN ? 100 * a.le15 / a.totN : 0,
      compRate: a.del + a.ref ? 100 * a.cmp / (a.del + a.ref) : 0,
      refundRate: (a.del + a.ref + a.ret) ? 100 * (a.ref + a.ret) / (a.del + a.ref + a.ret) : 0,
      repeatRate: a.n ? 100 * (a.n - a.newC) / a.n : 0,
      discRate: a.gmv ? 100 * a.disc / a.gmv : 0
    };
    if (a.totArr && a.totArr.length) {
      const s = a.totArr.slice().sort((x, y) => x - y);
      const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
      d.p50 = q(0.5); d.p90 = q(0.9); d.p95 = q(0.95);
    }
    return d;
  }
  function groupAgg(L, keyFn, ids) {
    const out = ids || new Map();
    for (let i = 0; i < L.length; i++) {
      const o = L[i], k = keyFn(o);
      if (k == null) continue;
      let a = out.get(k);
      if (!a) { a = newAgg(); out.set(k, a); }
      addTo(a, o, false);
    }
    return out;
  }

  /* ------------------------------ filtering ------------------------------- */
  function presetRange(p) {
    const t = MAXD;
    switch (p) {
      case 'today': return [t, t];
      case 'yesterday': return [t - 1, t - 1];
      case 'l7': return [t - 6, t];
      case 'l30': return [t - 29, t];
      case 'mtd': { let d = t; while (d > 0 && DB.days[d - 1].month === DB.days[t].month) d--; return [d, t]; }
      case 'prev': {
        let e = t; while (e > 0 && DB.days[e].month === DB.days[t].month) e--;
        const m = DB.days[e].month; let s = e;
        while (s > 0 && DB.days[s - 1].month === m) s--;
        return [s, e];
      }
      case 'l90': return [t - 89, t];
      default: return [S.f.from, S.f.to];
    }
  }
  function matcher(f, from, to) {
    const city = f.city === 'all' ? -1 : +f.city, zone = f.zone === 'all' ? -1 : +f.zone,
      store = f.store === 'all' ? -1 : +f.store, status = f.status === 'all' ? -1 : +f.status,
      cat = f.cat === 'all' ? -1 : +f.cat, pay = f.pay === 'all' ? -1 : +f.pay,
      cust = f.cust, sla = f.sla, hour = f.hour === 'all' ? -1 : +f.hour, dow = f.dow === 'all' ? -1 : +f.dow;
    return function (o) {
      if (o.day < from || o.day > to) return false;
      if (city >= 0 && o.city !== city) return false;
      if (zone >= 0 && !(o.city === city && o.zone === zone)) return false;
      if (store >= 0 && o.store !== store) return false;
      if (status >= 0 && o.status !== status) return false;
      if (cat >= 0 && o.cat !== cat) return false;
      if (pay >= 0 && o.pay !== pay) return false;
      if (cust === 'new' && !o.n) return false;
      if (cust === 'repeat' && o.n) return false;
      if (hour >= 0 && o.h !== hour) return false;
      if (dow >= 0 && o.dow !== dow) return false;
      if (sla === 'le10') { if (!(o.total >= 0 && o.total <= 10 && (o.status === 0 || o.status === 3))) return false; }
      else if (sla === 'le15') { if (!(o.total >= 0 && o.total <= 15 && (o.status === 0 || o.status === 3))) return false; }
      else if (sla === 'met') { if (!(o.total >= 0 && o.total <= 20 && (o.status === 0 || o.status === 3))) return false; }
      else if (sla === 'breach') { if (!o.sla) return false; }
      return true;
    };
  }
  function buildCtx() {
    const f = S.f;
    const [from, to] = f.preset === 'custom' ? [f.from, f.to] : presetRange(f.preset);
    f.from = from; f.to = to;
    const len = to - from + 1;
    const prevTo = from - 1, prevFrom = Math.max(0, from - len);
    const m = matcher(f, from, to);
    const cur = DB.orders.filter(m);
    const pm = matcher(f, prevFrom, prevTo);
    const prev = prevTo >= 0 ? DB.orders.filter(pm) : [];
    const hasPrev = prev.length > 0 && prevTo >= 0;

    const ctx = {
      f, from, to, len, prevFrom, prevTo, hasPrev,
      cur, prev,
      k: aggregate(cur, true), d: null,
      pk: aggregate(prev, false), pd: null,
      byDay: groupAgg(cur, o => o.day),
      byStore: groupAgg(cur, o => o.store),
      byCity: groupAgg(cur, o => o.city),
      byCat: groupAgg(cur, o => o.cat),
      byHour: groupAgg(cur, o => o.h),
      byDow: groupAgg(cur, o => o.dow),
      byZone: groupAgg(cur, o => o.city + '|' + o.zone),
      soL: [], soByStore: new Map(), soByCat: new Map(), soByDay: new Map(),
      cmpL: [], cmpByStore: new Map(), cmpByCat: new Map(), cmpByDay: new Map(),
      alerts: null, latestDay: Math.min(to, MAXD)
    };
    ctx.d = der(ctx.k); ctx.pd = der(ctx.pk);
    const fm = matcher(f, 0, 1e9); // non-date filters for event lists
    DB.stockouts.forEach(s => {
      if (s.day < from || s.day > to) return;
      if (f.city !== 'all' && s.city !== +f.city) return;
      if (f.store !== 'all' && s.store !== +f.store) return;
      if (f.cat !== 'all' && s.cat !== +f.cat) return;
      if (f.zone !== 'all') { const st = DB.stores[s.store]; if (st.city !== +f.city || st.zone !== +f.zone) return; }
      ctx.soL.push(s);
      const bump = (map, k, v) => map.set(k, (map.get(k) || 0) + v);
      bump(ctx.soByStore, s.store, 1); bump(ctx.soByCat, s.cat, 1); bump(ctx.soByDay, s.day, 1);
    });
    DB.complaints.forEach(c => {
      if (c.day < from || c.day > to) return;
      if (f.city !== 'all' && c.city !== +f.city) return;
      if (f.store !== 'all' && c.store !== +f.store) return;
      if (f.zone !== 'all') { const st = DB.stores[c.store]; if (st.city !== +f.city || st.zone !== +f.zone) return; }
      ctx.cmpL.push(c);
      const bump = (map, k) => map.set(k, (map.get(k) || 0) + 1);
      bump(ctx.cmpByStore, c.store); bump(ctx.cmpByCat, c.cat); bump(ctx.cmpByDay, c.day);
    });
    // SO rate: % of store-days in scope that had ≥1 stock-out event
    ctx.soRate = 100 * ctx.soL.length / Math.max(1, ctx.k.stores.size * ctx.len);
    ctx.soLost = ctx.soL.reduce((a, s) => a + s.lostRev, 0);
    ctx.soOrders = ctx.soL.reduce((a, s) => a + s.lostOrders, 0);
    S.ctx = ctx;
    return ctx;
  }

  /* --------------------------- alert engine ------------------------------- */
  const SEV = { Critical: [18, '#ff5d7e'], High: [10, '#fb923c'], Medium: [5, '#fbbf24'], Low: [0, '#a94df5'] };
  function sevLabel(score) { return score >= 18 ? 'Critical' : score >= 10 ? 'High' : score >= 5 ? 'Medium' : 'Low'; }
  const ACTION_TEMPLATES = {
    sla: (s) => 'Rebalance rider supply to ' + s.label + ' during peak windows; audit picker roster vs hourly demand.',
    rassign: (s) => 'Deploy ' + Math.max(2, Math.round(DB.storeRiders[s.id].length * 0.25)) + ' additional riders to ' + s.label + ' 6–10 PM; review partner payout surge.',
    pick: (s) => 'Add a picker shift at ' + s.label + '; re-slot fast-moving SKUs closer to packing bay.',
    rwait: (s) => 'Decouple rider arrival from packing completion; enable hold-and-stage shelves at ' + s.label + '.',
    cancel: (s) => 'Fix top cancel driver at ' + s.label + ' — tighten OOS sync and store response SLA.',
    stock: (s) => 'Raise safety stock for top OOS categories at ' + s.label + '; enable twice-daily replenishment.',
    complaint: (s) => 'Root-cause complaints at ' + s.label + ' (order-picking QC audit + delivery retraining).',
    capacity: (s) => 'Increase picker headcount or extend shifts at ' + s.label + ' — peak demand is running at ~' + Math.round(s.load) + '% of picker capacity.'
  };
  function computeAlerts(ctx) {
    if (ctx.alerts) return ctx.alerts;
    const A = [], net = ctx.d;
    const cmpOf = (sid) => ctx.cmpByStore.get(sid) || 0;
    const soOf = (sid) => ctx.soByStore.get(sid) || 0;

    // order: peak hour demand vs capacity per store
    const peakByStore = new Map();
    ctx.cur.forEach(o => {
      if (o.h < 6 || o.h > 23) return;
      const k = o.store;
      const v = peakByStore.get(k);
      // approximate by-hour: use by hour-of-day max across period /len days
    });
    const hrCnt = new Map();
    ctx.cur.forEach(o => { const k = o.store * 100 + o.h; hrCnt.set(k, (hrCnt.get(k) || 0) + 1); });

    ctx.byStore.forEach((a, sid) => {
      const st = DB.stores[sid], d = der(a);
      if (a.n < 10) return;
      const loc = { city: st.city, cityName: DB.cities[st.city].name, sid, storeName: DB.stores[sid].label, code: st.code, s: st };
      // 1. SLA
      if (d.slaPct < 90 && a.totN >= 8) {
        const gap = 90 - d.slaPct;
        const cause = d.avgAsg > net.avgAsg * 1.35 ? 'Rider shortage — assignment takes ' + fmtMin(d.avgAsg) + ' vs network ' + fmtMin(net.avgAsg)
          : d.avgPick > net.avgPick * 1.3 ? 'Slow picking — ' + fmtMin(d.avgPick) + ' vs network ' + fmtMin(net.avgPick)
            : d.avgWait > net.avgWait * 1.5 ? 'Riders waiting at store — packing not decoupled'
              : d.avgRide > net.avgRide * 1.3 ? 'Long last-mile runs — zone geometry / traffic' : 'Mixed — volume spikes vs capacity';
        const ordersImp = Math.round(a.totN * gap / 100);
        A.push({
          rule: 'sla', score: 6 + gap * 1.7, metric: 'SLA compliance', cur: pct1(d.slaPct), target: '≥ 90%',
          curN: d.slaPct, targetN: 90, loc, cause,
          impact: ordersImp + ' orders breached SLA · ≈ ' + fmtM(ordersImp * d.aov) + ' GMV at risk',
          action: ACTION_TEMPLATES.sla({ label: st.label }), ordersImp
        });
      }
      // 2. rider assignment
      if (d.avgAsg > Math.max(3.6, net.avgAsg * 1.3) && a.asgN >= 8) {
        A.push({
          rule: 'rassign', score: 5 + (d.avgAsg - net.avgAsg) * 3.2, metric: 'Rider assignment time', cur: fmtMin(d.avgAsg), target: '≤ ' + fmtMin(net.avgAsg),
          curN: d.avgAsg, targetN: net.avgAsg, loc,
          cause: st.riderShort ? 'Chronic rider shortfall (roster below demand)' : 'Peak-hour rider pool exhausted',
          impact: '+ ' + fmtMin(Math.max(0, d.avgAsg - net.avgAsg)) + ' added to every order cycle',
          action: ACTION_TEMPLATES.rassign({ label: st.label, id: sid })
        });
      }
      // 3. picking
      if (d.avgPick > Math.max(3.8, net.avgPick * 1.3) && a.pickN >= 8) {
        A.push({
          rule: 'pick', score: 4 + (d.avgPick - net.avgPick) * 4, metric: 'Picking time', cur: fmtMin(d.avgPick), target: '≤ ' + fmtMin(net.avgPick),
          curN: d.avgPick, targetN: net.avgPick, loc,
          cause: 'Picker shortage or long store layout during peaks',
          impact: '+ ' + fmtMin(Math.max(0, d.avgPick - net.avgPick)) + ' processing latency per order',
          action: ACTION_TEMPLATES.pick({ label: st.label })
        });
      }
      // 4. rider waiting
      if (d.avgWait > Math.max(3.6, net.avgWait * 1.6) && a.waitN >= 8) {
        A.push({
          rule: 'rwait', score: 3 + (d.avgWait - net.avgWait) * 2.4, metric: 'Rider waiting at store', cur: fmtMin(d.avgWait), target: '≤ ' + fmtMin(net.avgWait),
          curN: d.avgWait, targetN: net.avgWait, loc,
          cause: 'Riders arrive before packing completes — poor staging sync',
          impact: fmtN(Math.round(a.waitN * Math.max(0, d.avgWait - net.avgWait))) + ' rider-minutes idle in period',
          action: ACTION_TEMPLATES.rwait({ label: st.label })
        });
      }
      // 5. cancellations
      if (d.cancelRate > Math.max(8, ctx.d.cancelRate * 1.35) && a.n >= 15) {
        const top = topCancelReason(sid, ctx);
        A.push({
          rule: 'cancel', score: 4 + (d.cancelRate - ctx.d.cancelRate) * 2.2, metric: 'Cancellation rate', cur: pct1(d.cancelRate), target: '≤ 6.0%',
          curN: d.cancelRate, targetN: 6, loc,
          cause: 'Top driver: ' + top,
          impact: fmtN(a.canc) + ' orders · ' + fmtM(a.gmv * a.canc / a.n) + ' GMV cancelled',
          action: ACTION_TEMPLATES.cancel({ label: st.label })
        });
      }
      // 6. stockouts
      const soN = soOf(sid);
      const soRate = 100 * soN / Math.max(1, ctx.len);   // % of days affected
      if (soN >= 3 && soRate > Math.max(1.5, ctx.soRate * 1.6) && st.stockProp > 1.15) {
        const lost = ctx.soL.filter(x => x.store === sid).reduce((z, x) => z + x.lostRev, 0);
        A.push({
          rule: 'stock', score: 3 + soRate * 1.1 + lost / 40000, metric: 'Stock-out events', cur: fmtN(soN) + ' (' + pct1(soRate) + ' of days)', target: '≤ ' + pct1(Math.max(1.2, ctx.soRate)) + ' of days',
          curN: soRate, targetN: ctx.soRate, loc,
          cause: 'Replenishment lag on high-velocity SKUs',
          impact: '≈ ' + fmtM(lost) + ' estimated lost sales',
          action: ACTION_TEMPLATES.stock({ label: st.label })
        });
      }
      // 7. complaints
      const cmpN = cmpOf(sid), cmpRate = (a.del + a.ref) ? 100 * cmpN / (a.del + a.ref) : 0;
      if (cmpRate > Math.max(3, ctx.d.compRate * 1.8) && cmpN >= 3) {
        A.push({
          rule: 'complaint', score: 2 + (cmpRate - ctx.d.compRate) * 2.2, metric: 'Complaint rate', cur: pct1(cmpRate), target: '≤ ' + pct1(Math.max(2, ctx.d.compRate)),
          curN: cmpRate, targetN: ctx.d.compRate, loc,
          cause: d.slaPct < 90 ? 'Late deliveries driving complaints' : 'Order accuracy / QC issues',
          impact: fmtN(cmpN) + ' complaints in period',
          action: ACTION_TEMPLATES.complaint({ label: st.label })
        });
      }
      // 8. capacity > 90%
      let maxHr = 0;
      for (let h = 7; h <= 23; h++) { const v = hrCnt.get(sid * 100 + h) || 0; if (v > maxHr) maxHr = v; }
      const maxHrPerDay = maxHr / ctx.len;
      const cap = st.pickers * 11 * 0.85;
      if (maxHrPerDay > cap * 0.9 && a.n >= 25) {
        A.push({
          rule: 'capacity', score: 4 + (maxHrPerDay / cap - 0.9) * 40, metric: 'Peak-hour capacity load', cur: pct1(100 * maxHrPerDay / cap), target: '≤ 90%',
          curN: 100 * maxHrPerDay / cap, targetN: 90, loc,
          cause: 'Peak demand ≈ ' + fx(maxHrPerDay, 1) + ' orders/hr vs capacity ' + cap.toFixed(0),
          impact: 'Peak orders queue → SLA and cancellations degrade',
          action: ACTION_TEMPLATES.capacity({ label: st.label, load: 100 * maxHrPerDay / cap })
        });
      }
    });
    // city-level SLA watch
    ctx.byCity.forEach((a, ci) => {
      const d = der(a);
      if (d.slaPct < 90 && a.totN >= 30) {
        A.push({
          rule: 'sla', cityLevel: true, score: 4 + (90 - d.slaPct) * 1.2, metric: 'City SLA compliance',
          cur: pct1(d.slaPct), target: '≥ 90%', curN: d.slaPct, targetN: 90,
          loc: { city: ci, cityName: DB.cities[ci].name, sid: -1, storeName: 'All stores (' + a.n + ' orders)' },
          cause: 'Concentrated in evening peak with rider pool shortfall',
          impact: Math.round(a.totN * (90 - d.slaPct) / 100) + ' orders beyond SLA window',
          action: 'Shift rider allocation across ' + DB.cities[ci].name + ' zones during 6–10 PM; open overflow dispatch hub.',
          ordersImp: Math.round(a.totN * (90 - d.slaPct) / 100)
        });
      }
    });
    A.sort((x, y) => y.score - x.score);
    A.forEach(a => { a.sev = sevLabel(a.score); });
    ctx.alerts = A;
    return A;
  }
  function topCancelReason(sid, ctx) {
    const cnt = {};
    ctx.cur.forEach(o => { if (o.store === sid && o.cr >= 0) cnt[o.cr] = (cnt[o.cr] || 0) + 1; });
    let best = -1, bv = 0;
    Object.keys(cnt).forEach(k => { if (cnt[k] > bv) { bv = cnt[k]; best = +k; } });
    return best >= 0 ? DB.cancelReasons[best] : 'Customer Cancelled';
  }

  /* --------------------------- insight engine ------------------------------ */
  function buildInsights(ctx) {
    const I = [], d = ctx.d, pd = ctx.pd;
    const topCities = [...ctx.byCity.entries()].map(([ci, a]) => ({ ci, a, d: der(a) }));
    topCities.sort((x, y) => x.d.slaPct - y.d.slaPct);
    if (topCities.length >= 2) {
      const worst = topCities[0], best = topCities[topCities.length - 1];
      I.push({
        tag: 'SLA · City', tone: worst.d.slaPct < 90 ? 'bad' : 'warn',
        html: '<b>' + DB.cities[worst.ci].name + '</b> has the weakest SLA at <b>' + pct1(worst.d.slaPct) + '</b> (avg ' + fmtMin(worst.d.avgTotal) + ' order-to-delivery). Best: <b>' + DB.cities[best.ci].name + '</b> at ' + pct1(best.d.slaPct) + '.'
      });
    }
    // peak assignment stress
    const pk = aggregate(ctx.cur.filter(o => o.h >= 19 && o.h <= 22), false);
    const off = aggregate(ctx.cur.filter(o => o.h >= 13 && o.h <= 16), false);
    const pkd = der(pk), offd = der(off);
    if (pk.asgN > 20 && pkd.avgAsg > offd.avgAsg * 1.15) {
      I.push({
        tag: 'Riders · Peak', tone: 'bad',
        html: 'Rider assignment takes <b>' + fmtMin(pkd.avgAsg) + '</b> during the 7–10 PM peak vs <b>' + fmtMin(offd.avgAsg) + '</b> mid-afternoon — rider supply falls behind demand exactly when volume peaks (SLA in peak: ' + pct1(pkd.slaPct) + ').'
      });
    }
    // store pick outlier
    let worstPick = null;
    ctx.byStore.forEach((a, sid) => { const x = der(a); if (a.pickN >= 8 && (!worstPick || x.avgPick > worstPick.d.avgPick)) worstPick = { sid, d: x, a }; });
    if (worstPick && worstPick.d.avgPick > d.avgPick * 1.35) {
      const st = DB.stores[worstPick.sid];
      I.push({
        tag: 'Store · Productivity', tone: 'warn',
        html: 'Store <b>' + st.code + ' · ' + st.label + '</b> (' + DB.cities[st.city].name + ') shows picking time of <b>' + fmtMin(worstPick.d.avgPick) + '</b> — <b>' + Math.round(100 * worstPick.d.avgPick / d.avgPick - 100) + '% above network average</b>, despite ' + fmtN(worstPick.a.n) + ' orders in the period.'
      });
    }
    // stockouts
    if (ctx.soL.length) {
      let topCat = -1, topN = 0;
      ctx.soByCat.forEach((v, k) => { if (v > topN) { topN = v; topCat = k; } });
      I.push({
        tag: 'Inventory', tone: 'bad',
        html: 'Stock-outs caused an estimated <b>' + fmtM(ctx.soLost) + '</b> lost sales in this period across <b>' + fmtN(ctx.soL.length) + '</b> events. Heaviest category: <b>' + DB.cats[topCat].name + '</b> (' + fmtN(topN) + ' events).'
      });
    }
    // breach concentration
    const br = [...ctx.byStore.entries()].map(([sid, a]) => ({ sid, b: a.slaB })).sort((a, b) => b.b - a.b);
    const totB = br.reduce((x, y) => x + y.b, 0);
    if (totB > 0) {
      const top5 = br.slice(0, 5).reduce((x, y) => x + y.b, 0);
      const names = br.slice(0, 5).map(x => DB.stores[x.sid].code).join(', ');
      I.push({
        tag: 'SLA · Concentration', tone: 'warn',
        html: 'Just 5 stores (<b>' + names + '</b>) contribute <b>' + pct1(100 * top5 / totB) + '</b> of all ' + fmtN(totB) + ' SLA breaches — targeted fixes beat network-wide policy.'
      });
    }
    // cancellations
    const cN = {};
    ctx.cur.forEach(o => { if (o.cr >= 0) cN[o.cr] = (cN[o.cr] || 0) + 1; });
    let bc = -1, bv = 0;
    Object.keys(cN).forEach(k => { if (cN[k] > bv) { bv = cN[k]; bc = +k; } });
    if (bc >= 0) I.push({
      tag: 'Cancellations', tone: 'warn',
      html: '<b>' + DB.cancelReasons[bc] + '</b> is the #1 cancellation driver (<b>' + pct1(100 * bv / Math.max(1, ctx.k.canc)) + '</b> of ' + fmtN(ctx.k.canc) + ' cancellations, ≈ ' + fmtM(ctx.k.refAmt * 0 + ctx.k.gmv * ctx.k.canc / Math.max(1, ctx.k.n)) + ' GMV lost).'
    });
    // trend vs previous
    if (ctx.hasPrev) {
      const delta = d.slaPct - pd.slaPct;
      I.push({
        tag: 'Trend · vs ' + prevLabel(ctx), tone: delta >= 0 ? 'good' : 'bad',
        html: 'Overall SLA is <b>' + pct1(d.slaPct) + '</b> — <b>' + (delta >= 0 ? 'up' : 'down') + ' ' + fx(Math.abs(delta), 1) + ' pts</b> vs the previous period. Avg delivery ' + fmtMin(d.avgTotal) + ' (was ' + fmtMin(pd.avgTotal) + '). Cancellations ' + pct1(d.cancelRate) + ' (was ' + pct1(pd.cancelRate) + ').'
      });
    }
    // complaints
    if (ctx.cmpL.length) {
      let tc = -1, tv = 0;
      ctx.cmpByCat.forEach((v, k) => { if (v > tv) { tv = v; tc = k; } });
      const lateShare = ctx.cmpL.filter(c => c.cat === 0).length;
      I.push({
        tag: 'Customer', tone: 'warn',
        html: '<b>' + fmtN(ctx.cmpL.length) + '</b> complaints logged — <b>' + DB.complaintCats[tc] + '</b> leads (' + pct1(100 * tv / ctx.cmpL.length) + '). ' + pct1(100 * lateShare / ctx.cmpL.length) + ' are delivery-time related, tying CX directly to SLA performance.'
      });
    }
    // peak hours
    let bh = -1, bn = 0;
    ctx.byHour.forEach((a, h) => { if (a.n > bn) { bn = a.n; bh = h; } });
    if (bh >= 0) I.push({
      tag: 'Demand pattern', tone: 'good',
      html: 'Peak demand hour: <b>' + bh + ':00–' + (bh + 1) + ':00</b> with ≈ ' + fx(bn / ctx.len, 1) + ' orders/day. Staffing and rider rosters should anchor to this window and the secondary 8–10 AM breakfast wave.'
    });
    // refunds / revenue quality
    I.push({
      tag: 'Revenue quality', tone: d.refundRate > 4 ? 'bad' : 'good',
      html: 'Refund rate is <b>' + pct1(d.refundRate) + '</b> costing <b>' + fmtM(ctx.k.refAmt) + '</b>, discounts consume ' + pct1(d.discRate) + ' of GMV, and stock-out-driven lost sales add ' + fmtM(ctx.soLost) + ' on top.'
    });
    return I;
  }
  function prevLabel(ctx) {
    const n = ctx.len;
    return n === 1 ? 'previous day' : n <= 7 ? 'previous ' + n + ' days' : 'previous period';
  }

  /* ------------------------------- KPI cards ------------------------------- */
  function kpiHTML(o) {
    // o: {label, cur, prev, fmt, invert, target, tFmt, ach, color, warn, prevLbl}
    const fmt = o.fmt || fmtN;
    let delta = null, cls = 'flat', arrow = '—';
    if (o.prev != null && isFinite(o.prev) && o.prev !== 0) {
      delta = 100 * (o.cur - o.prev) / Math.abs(o.prev);
      const good = o.invert ? delta < -0.05 : delta > 0.05;
      const flat = Math.abs(delta) <= 0.05;
      cls = flat ? 'flat' : (good ? 'good' : 'bad');
      arrow = flat ? '•' : (delta > 0 ? '▲' : '▼');
    }
    const ach = o.ach != null ? Math.min(100, o.ach) : null;
    return '<div class="kpi" style="--kc:' + (o.color || 'var(--acc)') + '">' +
      '<div class="kpi-label">' + o.label + (o.warn ? '<span class="warn" title="' + o.warn + '">' + '⚠' + '</span>' : '') + '</div>' +
      '<div class="kpi-value">' + fmt(o.cur) + (o.unit ? ' <span class="kpi-unit">' + o.unit + '</span>' : '') + '</div>' +
      '<div class="kpi-row">' +
      (delta != null ? '<span class="kpi-delta ' + cls + '">' + arrow + ' ' + fx(Math.abs(delta), 1) + '%</span>' : '<span class="kpi-delta flat">no baseline</span>') +
      (o.prev != null ? '<span class="kpi-prev">prev ' + (o.prevFmt || fmt)(o.prev) + '</span>' : '') +
      '</div>' +
      (o.target != null ? '<div class="kpi-tgt"><span>Target <b>' + (o.tFmt || fmt)(o.target) + '</b></span><span>' + (ach != null ? fx(ach, 0) + '%' : '') + '</span></div>' +
        '<div class="kpi-bar"><i style="width:' + (ach || 0) + '%"></i></div>' : '') +
      '</div>';
  }
  const kpiGrid = (cards) => '<div class="kpi-grid">' + cards.join('') + '</div>';

  /* ----------------------------- sidebar/nav ------------------------------- */
  const ICONS = {
    grid: '<circle cx="3" cy="3" r="1.6"/><circle cx="9" cy="3" r="1.6"/><circle cx="3" cy="9" r="1.6"/><circle cx="9" cy="9" r="1.6"/>',
    pulse: '<path d="M2 7h3l2-4 3 8 2.5-5 1.5 2h3"/>',
    map: '<path d="M1 3l4 2 4-2 4 2v10l-4-2-4 2-4-2z"/><path d="M5 5v10M9 3v10"/>',
    store: '<path d="M2 7l1-4h8l1 4"/><path d="M2 7h10v6H2z"/><path d="M5 13v-4h4v4"/>',
    clock: '<circle cx="7" cy="7" r="5.5"/><path d="M7 4v3l2.2 1.6"/>',
    branch: '<circle cx="4" cy="3.5" r="1.8"/><circle cx="10" cy="10.5" r="1.8"/><circle cx="4" cy="10.5" r="1.8"/><path d="M4 5.3v3.4M4 8.5h4.2"/>',
    bike: '<circle cx="3.5" cy="10" r="2.3"/><circle cx="10.5" cy="10" r="2.3"/><path d="M3.5 10L6 4.5h2.5L11 10M6 4.5L4 7"/>',
    box: '<path d="M1.5 4.5L7 2l5.5 2.5v5L7 12 1.5 9.5z"/><path d="M1.5 4.5L7 7l5.5-2.5M7 7v5"/>',
    users: '<circle cx="5" cy="4.5" r="2.2"/><path d="M1 12c.6-2.6 2.2-3.8 4-3.8s3.4 1.2 4 3.8"/><circle cx="10.5" cy="5.5" r="1.8"/><path d="M9.5 12c.4-1.8 1.3-2.8 2.5-3"/>',
    x: '<circle cx="7" cy="7" r="5.5"/><path d="M5 5l4 4M9 5l-4 4"/>',
    badge: '<rect x="3" y="2" width="8" height="11" rx="1.5"/><path d="M5.5 5h3M5.5 8h3"/>',
    flame: '<path d="M7 1.5s3.5 3 3.5 6.5a3.5 3.5 0 01-7 0C3.5 4.5 7 1.5 7 1.5z"/>',
    rupee: '<circle cx="7" cy="7" r="5.5"/><path d="M4.5 4.5h5M4.5 6.5h5M4.5 4.5c4 0 4 3.5 0 3.5l3.5 3.5"/>',
    alert: '<path d="M7 1.5L13 12H1z"/><path d="M7 5.5v3M7 10v.5"/>',
    bulb: '<path d="M7 1.5a3.5 3.5 0 012 6.4c-.6.4-1 .8-1 1.6H6c0-.8-.4-1.2-1-1.6A3.5 3.5 0 017 1.5z"/><path d="M5.8 11.5h2.4M6.2 13h1.6"/>',
    check: '<rect x="1.5" y="2.5" width="11" height="10" rx="1.5"/><path d="M4.5 7.5l2 2 3.5-4"/>',
    dl: '<path d="M7 1.5v7"/><path d="M4.2 5.8L7 8.6l2.8-2.8"/><path d="M1.8 10.5h10.4v1.8H1.8z"/>'
  };
  const NAV = [
    { sec: 'Overview' },
    { id: 'exec', t: 'Executive Overview', ic: 'grid', sub: 'Complete operational health' },
    { id: 'live', t: 'Live Operations', ic: 'pulse', sub: 'Today · order pipeline & funnel' },
    { id: 'tower', t: 'City Control Tower', ic: 'map', sub: 'City comparison & drill-down' },
    { sec: 'Network Operations' },
    { id: 'stores', t: 'Store Performance', ic: 'store', sub: 'Dark store league table' },
    { id: 'sla', t: 'SLA & Delivery', ic: 'clock', sub: 'Journey stage analytics' },
    { id: 'delays', t: 'Delay Root Causes', ic: 'branch', sub: 'Why orders are late' },
    { id: 'riders', t: 'Rider Performance', ic: 'bike', sub: 'Fleet supply & utilization' },
    { id: 'workforce', t: 'Workforce & Capacity', ic: 'badge', sub: 'Staffing vs demand' },
    { id: 'peak', t: 'Peak Hour Analysis', ic: 'flame', sub: 'Day × hour heatmaps' },
    { sec: 'Supply & Customers' },
    { id: 'inventory', t: 'Inventory & Stock-outs', ic: 'box', sub: 'Availability & lost sales' },
    { id: 'customers', t: 'Customer Experience', ic: 'users', sub: 'Complaints & retention' },
    { id: 'cancels', t: 'Cancellations & Refunds', ic: 'x', sub: 'Loss funnel & reasons' },
    { sec: 'Business & Command' },
    { id: 'finance', t: 'Financial Efficiency', ic: 'rupee', sub: 'P&L of operations' },
    { id: 'alerts', t: 'Exceptions Center', ic: 'alert', sub: 'Auto-flagged issues', badge: true },
    { id: 'insights', t: 'Director Insights', ic: 'bulb', sub: 'Auto-generated analysis' },
    { id: 'actions', t: 'Action Center', ic: 'check', sub: 'What to do next' },
    { sec: 'Data' },
    { id: 'download', t: 'Download Center', ic: 'dl', sub: 'Export datasets & workbooks' }
  ];
  const svgIc = (name) => '<svg class="sb-ic" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';

  function buildNav() {
    const el = document.getElementById('sbNav');
    let h = '';
    NAV.forEach(n => {
      if (n.sec) { h += '<div class="sb-sec">' + n.sec + '</div>'; return; }
      h += '<div class="sb-link" data-page="' + n.id + '">' + svgIc(n.ic) + n.t +
        (n.badge ? '<span class="badge" id="navBadgeAlerts" style="display:none">0</span>' : '') + '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('.sb-link').forEach(l => l.addEventListener('click', () => goto(l.dataset.page)));
  }

  /* -------------------------------- router --------------------------------- */
  function goto(page) {
    S.page = page;
    document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    el.classList.add('active');
    const meta = NAV.find(n => n.id === page);
    document.getElementById('pageTitle').textContent = meta.t;
    document.getElementById('pageSub').textContent = meta.sub;
    document.getElementById('pages').scrollTop = 0;
    render();
  }
  function render() {
    const ctx = S.ctx || buildCtx();
    updateMeta(ctx);
    // alert badge
    const alerts = computeAlerts(ctx);
    const badge = document.getElementById('navBadgeAlerts');
    const critCount = alerts.filter(a => a.sev === 'Critical' || a.sev === 'High').length;
    if (critCount > 0) { badge.style.display = ''; badge.textContent = critCount; }
    const fn = PAGES[S.page];
    if (fn) { try { fn(ctx); } catch (e) { console.error(e); document.getElementById('page-' + S.page).innerHTML = '<div class="empty">Page error: ' + e.message + '</div>'; } }
    try { if (window.EXPORTS) window.EXPORTS.attach(document.getElementById('page-' + S.page)); }
    catch (e) { console.warn('export-attach', e); }
  }

  /* ------------------------------ filter bar ------------------------------- */
  function fill(id, items, keepSel) {
    const el = document.getElementById(id);
    const was = keepSel ? el.value : null;
    el.innerHTML = items.map(i => '<option value="' + i.v + '"' + (i.sel ? ' selected' : '') + '>' + i.t + '</option>').join('');
    if (was != null && items.some(i => String(i.v) === String(was))) el.value = was;
  }
  function buildFilterBar() {
    fill('fCity', [{ v: 'all', t: 'All India' }].concat(DB.cities.map((c, i) => ({ v: i, t: c.name }))));
    fill('fZone', [{ v: 'all', t: 'All Zones' }]);
    fill('fStore', storeOptions());
    fill('fStatus', [{ v: 'all', t: 'All Statuses' }].concat(DB.statuses.map((s, i) => ({ v: i, t: s }))));
    fill('fCat', [{ v: 'all', t: 'All Categories' }].concat(DB.cats.map((c, i) => ({ v: i, t: c.name }))));
    fill('fPay', [{ v: 'all', t: 'All Methods' }].concat(DB.payMethods.map((p, i) => ({ v: i, t: p }))));
    fill('fHour', [{ v: 'all', t: 'All Hours' }].concat(Array.from({ length: 24 }, (_, h) => ({ v: h, t: (h < 10 ? '0' + h : h) + ':00–' + ((h + 1) < 10 ? '0' : '') + (h + 1) + ':00' }))));
    fill('fDow', [{ v: 'all', t: 'All Days' }].concat(DOWS_L.map((d, i) => ({ v: i, t: d }))));
    const fromIn = document.getElementById('fFrom'), toIn = document.getElementById('fTo');
    fromIn.min = DB.meta.start; fromIn.max = DB.meta.end; toIn.min = DB.meta.start; toIn.max = DB.meta.end;
    fromIn.value = DB.days[S.f.from].date; toIn.value = DB.days[S.f.to].date;

    const on = (id, fn) => document.getElementById(id).addEventListener('change', fn);
    on('fPreset', e => {
      S.f.preset = e.target.value;
      document.getElementById('customWrap').style.display = S.f.preset === 'custom' ? '' : 'none';
      if (S.f.preset !== 'custom') { const [a, b] = presetRange(S.f.preset); S.f.from = a; S.f.to = b; }
      applyFilters();
    });
    const customApply = () => {
      const a = dateToIdx(fromIn.value), b = dateToIdx(toIn.value);
      if (a == null || b == null) return;
      S.f.from = Math.min(a, b); S.f.to = Math.max(a, b); applyFilters();
    };
    fromIn.addEventListener('change', () => { S.f.preset = 'custom'; document.getElementById('fPreset').value = 'custom'; customApply(); });
    toIn.addEventListener('change', () => { S.f.preset = 'custom'; document.getElementById('fPreset').value = 'custom'; customApply(); });
    on('fCity', e => { S.f.city = e.target.value; S.f.zone = 'all'; S.f.store = 'all'; rebuildDeps(); applyFilters(); });
    on('fZone', e => { S.f.zone = e.target.value; S.f.store = 'all'; rebuildDeps(); applyFilters(); });
    on('fStore', e => { S.f.store = e.target.value; applyFilters(); });
    on('fStatus', e => { S.f.status = e.target.value; applyFilters(); });
    on('fCat', e => { S.f.cat = e.target.value; applyFilters(); });
    on('fCust', e => { S.f.cust = e.target.value; applyFilters(); });
    on('fPay', e => { S.f.pay = e.target.value; applyFilters(); });
    on('fSla', e => { S.f.sla = e.target.value; applyFilters(); });
    on('fHour', e => { S.f.hour = e.target.value; applyFilters(); });
    on('fDow', e => { S.f.dow = e.target.value; applyFilters(); });
    document.getElementById('btnReset').addEventListener('click', resetFilters);
    rebuildDeps();
  }
  function dateToIdx(s) { const i = DB.days.findIndex(d => d.date === s); return i < 0 ? null : i; }
  function storeOptions() {
    const f = S.f;
    let list = DB.stores;
    if (f.city !== 'all') list = list.filter(s => s.city === +f.city);
    if (f.zone !== 'all') list = list.filter(s => s.zone === +f.zone);
    return [{ v: 'all', t: 'All Stores (' + list.length + ')' }].concat(list.map(s => ({ v: s.id, t: s.code + ' · ' + s.label, sel: String(s.id) === String(f.store) })));
  }
  function rebuildDeps() {
    const f = S.f;
    if (f.city !== 'all') {
      const zs = DB.cities[+f.city].zones;
      fill('fZone', [{ v: 'all', t: 'All Zones' }].concat(zs.map((z, i) => ({ v: i, t: z, sel: String(i) === String(f.zone) }))), true);
    } else fill('fZone', [{ v: 'all', t: 'All Zones (select a city)' }]);
    fill('fStore', storeOptions(), true);
  }
  function resetFilters() {
    S.f = { preset: 'l7', from: MAXD - 6, to: MAXD, city: 'all', zone: 'all', store: 'all', status: 'all', cat: 'all', cust: 'all', pay: 'all', sla: 'all', hour: 'all', dow: 'all' };
    document.getElementById('fPreset').value = 'l7';
    ['fCity', 'fZone', 'fStore', 'fStatus', 'fCat', 'fCust', 'fPay', 'fSla', 'fHour', 'fDow'].forEach(id => document.getElementById(id).value = 'all');
    document.getElementById('customWrap').style.display = 'none';
    rebuildDeps(); applyFilters();
  }
  function applyFilters() { S.ctx = null; buildCtx(); render(); }

  function updateMeta(ctx) {
    const f = ctx.f;
    const chips = [];
    if (f.city !== 'all') chips.push({ k: 'City', v: DB.cities[+f.city].name, clear: 'city' });
    if (f.zone !== 'all') chips.push({ k: 'Zone', v: DB.cities[+f.city].zones[+f.zone], clear: 'zone' });
    if (f.store !== 'all') chips.push({ k: 'Store', v: DB.stores[+f.store].code, clear: 'store' });
    if (f.status !== 'all') chips.push({ k: 'Status', v: DB.statuses[+f.status], clear: 'status' });
    if (f.cat !== 'all') chips.push({ k: 'Category', v: DB.cats[+f.cat].name, clear: 'cat' });
    if (f.cust !== 'all') chips.push({ k: 'Customer', v: f.cust === 'new' ? 'New' : 'Repeat', clear: 'cust' });
    if (f.pay !== 'all') chips.push({ k: 'Payment', v: DB.payMethods[+f.pay], clear: 'pay' });
    if (f.sla !== 'all') chips.push({ k: 'SLA', v: { le10: '≤10 min', le15: '≤15 min', met: 'Within 20', breach: 'Breached' }[f.sla], clear: 'sla' });
    if (f.hour !== 'all') chips.push({ k: 'Hour', v: f.hour + ':00', clear: 'hour' });
    if (f.dow !== 'all') chips.push({ k: 'Day', v: DOWS_L[+f.dow], clear: 'dow' });
    document.getElementById('fbMeta').innerHTML =
      '<span>📅 <b>' + rangeLabel(ctx.from, ctx.to) + '</b> (' + ctx.len + ' day' + (ctx.len > 1 ? 's' : '') + ')</span>' +
      '<span>📦 <b>' + fmtN(ctx.k.n) + '</b> orders matched</span>' +
      (ctx.hasPrev ? '<span>vs <b>' + rangeLabel(ctx.prevFrom, ctx.prevTo) + '</b></span>' : '<span>no previous-period baseline</span>') +
      '<span class="chips">' + chips.map(c => '<span class="chip"><b>' + c.k + '</b> ' + c.v + '<span class="x" data-clear="' + c.clear + '">✕</span></span>').join('') + '</span>';
    document.getElementById('fbMeta').querySelectorAll('.x').forEach(x => x.addEventListener('click', () => {
      const k = x.dataset.clear;
      S.f[k] = 'all';
      if (k === 'zone') S.f.zone = 'all';
      if (k === 'city') { S.f.zone = 'all'; S.f.store = 'all'; }
      if (k === 'zone') S.f.store = 'all';
      const map = { city: 'fCity', zone: 'fZone', store: 'fStore', status: 'fStatus', cat: 'fCat', cust: 'fCust', pay: 'fPay', sla: 'fSla', hour: 'fHour', dow: 'fDow' };
      if (map[k]) document.getElementById(map[k]).value = 'all';
      rebuildDeps(); applyFilters();
    }));
  }

  /* ------------------------------ drill-down ------------------------------- */
  function drillCity(ci) {
    S.f.city = String(ci); S.f.zone = 'all'; S.f.store = 'all';
    document.getElementById('fCity').value = String(ci);
    rebuildDeps(); applyFilters();
  }
  function drillStore(sid) {
    const st = DB.stores[sid];
    S.f.city = String(st.city); S.f.zone = 'all'; S.f.store = String(sid);
    document.getElementById('fCity').value = String(st.city);
    rebuildDeps();
    document.getElementById('fStore').value = String(sid);
    applyFilters();
  }
  function openStore(sid) {         // drawer detail without changing global filters
    const ctx = S.ctx;
    const st = DB.stores[sid];
    const a = ctx.byStore.get(sid) || newAgg();
    const d = der(a);
    const status = storeStatus(d, a, ctx);
    const orders = ctx.cur.filter(o => o.store === sid);
    const delayed = orders.filter(o => o.sla).sort((x, y) => y.total - x.total).slice(0, 40);
    const cancs = orders.filter(o => o.status === 1).slice(0, 15);
    const so = ctx.soL.filter(s => s.store === sid).slice(0, 12);
    const ridersN = DB.storeRiders[sid].length;
    const alerts = computeAlerts(ctx).filter(x => x.loc.sid === sid);
    const vc = status === 'Healthy' ? 'var(--green)' : status === 'Watch' ? 'var(--amber)' : 'var(--red)';
    drawer(
      '<h2>' + st.code + ' · ' + st.label + '</h2>' +
      '<div class="dsub">' + DB.cities[st.city].name + ' · ' + DB.cities[st.city].zones[st.zone] + ' zone · <span class="status-pill st-' + status.toLowerCase() + '">' + status + '</span></div>' +
      '<div class="d-kpis">' +
      dKpi('Orders', fmtN(a.n)) + dKpi('Revenue', fmtM(a.rev)) + dKpi('AOV', '₹' + fmtN(d.aov)) +
      dKpi('SLA', pct1(d.slaPct)) + dKpi('Avg delivery', fmtMin(d.avgTotal)) + dKpi('Cancel', pct1(d.cancelRate)) +
      dKpi('Picking', fmtMin(d.avgPick)) + dKpi('Rider wait', fmtMin(d.avgWait)) + dKpi('Complaints', fmtN(a.cmp)) +
      dKpi('Staff (P/P/S)', st.pickers + ' / ' + st.packers + ' / ' + st.staff) + dKpi('Riders', fmtN(ridersN)) + dKpi('Stock-outs', fmtN(ctx.soByStore.get(sid) || 0)) +
      '</div>' +
      (alerts.length ? '<h4 style="margin:14px 0 8px">⚠ Active alerts (' + alerts.length + ')</h4>' + alerts.slice(0, 3).map(al => '<div class="att-card sev-' + al.sev.toLowerCase() + '" style="margin-bottom:8px;padding:10px 12px"><div class="att-body"><div class="att-title">' + sevDot(al.sev) + ' ' + al.metric + ': ' + al.cur + ' <span class="muted small">target ' + al.target + '</span></div><div class="att-loc">' + al.cause + '</div></div></div>').join('') : '') +
      '<h4 style="margin:16px 0 8px">🚨 Delayed orders (' + orders.filter(o => o.sla).length + ')</h4>' +
      ordersTable(delayed, ctx, true) +
      (cancs.length ? '<h4 style="margin:16px 0 8px">✕ Recent cancellations</h4>' + ordersTable(cancs, ctx, true) : '') +
      (so.length ? '<h4 style="margin:16px 0 8px">📦 Stock-out events</h4><div class="tscroll sm"><table class="tbl"><thead><tr><th>Day</th><th>Category</th><th>SKU</th><th class="num">Hrs out</th><th class="num">Lost sales</th></tr></thead><tbody>' +
        so.map(s => '<tr><td>' + dayLabel(s.day) + '</td><td>' + DB.cats[s.cat].name + '</td><td class="muted">' + s.skuName + '</td><td class="num">' + s.hours + '</td><td class="num">' + fmtM(s.lostRev) + '</td></tr>').join('') + '</tbody></table></div>' : '') +
      '<div style="margin:14px 0"><button class="btn-reset" onclick="APP.drillStore(' + sid + ');APP.closeDrawer();APP.goto(\'stores\')">Open store in full dashboard →</button></div>',
      vc);
  }
  function dKpi(k, v) { return '<div class="d-kpi"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
  function sevDot(sev) { return '<span class="sev-dot" style="background:' + SEV[sev][1] + '"></span>'; }
  function storeStatus(d, a, ctx) {
    const soRate = a.n ? 100 * (ctx.soByStore.get(storeOfA(ctx, a)) || 0) / a.n : 0;
    if (d.slaPct < 82 || d.cancelRate > 10) return 'Critical';
    if (d.slaPct < 90 || d.cancelRate > 7 || d.avgPick > ctx.d.avgPick * 1.35) return 'Watch';
    return 'Healthy';
  }
  function storeOfA(ctx, a) { for (const [k, v] of ctx.byStore) if (v === a) return k; return -1; }

  function ordersTable(list, ctx, compact) {
    if (!list.length) return '<div class="empty">No orders in scope</div>';
    return '<div class="tscroll ' + (compact ? 'sm' : '') + '"><table class="tbl"><thead><tr>' +
      '<th>Order</th><th>Day</th><th>Store</th><th>Status</th><th class="num">Value</th><th class="num">O2D</th><th>Reason</th></tr></thead><tbody>' +
      list.map(o => {
        const st = DB.stores[o.store];
        return '<tr class="clickable" data-oid="' + o.id + '"><td style="color:var(--acc)">' + o.id + '</td>' +
          '<td class="muted">' + dayLabelShort(o.day) + ' ' + minOfDay(o.t) + '</td>' +
          '<td class="muted">' + st.code + '</td><td>' + statusPill(o) + '</td>' +
          '<td class="num">₹' + fmtN(o.val) + '</td>' +
          '<td class="num"' + (o.sla ? ' style="color:var(--red);font-weight:700"' : '') + '>' + (o.total >= 0 ? fmtMin(o.total) : '—') + '</td>' +
          '<td class="muted">' + (o.dR >= 0 ? DB.delayReasons[o.dR] : o.cr >= 0 ? DB.cancelReasons[o.cr] : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function statusPill(o) {
    const map = { 0: ['Delivered', 'st-healthy'], 1: ['Cancelled', 'st-critical'], 2: ['Returned', 'st-watch'], 3: ['Refunded', 'st-medium'] };
    const m = map[o.status];
    return '<span class="status-pill ' + m[1] + '">' + m[0] + '</span>';
  }

  /* ------------------------------ order modal ------------------------------ */
  function openOrder(oid) {
    const o = orderIdx.get(oid);
    if (!o) return;
    const st = DB.stores[o.store];
    const steps = [
      ['Order placed', o.t, 'Customer checkout · ' + DB.sources[o.src], null],
      ['Store accepted', o.acc, 'Auto-accept + manual confirm', o.acc >= 0 ? o.acc - o.t : null],
      ['Rider assigned', o.rAs, o.rAs >= 0 ? DB.riders[o.rider] ? DB.riders[o.rider].id : '—' : '', o.rAs >= 0 ? o.rAs - o.acc : null],
      ['Picking started', o.pkS, 'Picker begins basket collection', o.pkS >= 0 ? o.pkS - o.acc : null],
      ['Picking complete', o.pkE, o.items + ' items picked', o.pkE >= 0 ? o.pkE - o.pkS : null],
      ['Packing complete', o.pkF, 'Bag sealed & labelled', o.pkF >= 0 ? o.pkF - o.pkE : null],
      ['Rider at store', o.rAr, 'Waiting for handover', o.rAr >= 0 ? o.rAr - o.rAs : null],
      ['Dispatched', o.ds, 'Left dark store', o.ds >= 0 && o.rAr >= 0 ? o.ds - o.rAr : null],
      ['Delivered', o.del, o.dist + ' km run', o.del >= 0 && o.ds >= 0 ? o.del - o.ds : null]
    ];
    const body =
      '<div class="flex between"><div><h2 style="font-size:17px">' + o.id + '</h2>' +
      '<div class="muted small">' + dayLabel(o.day) + ' · ' + DB.cities[o.city].name + ' · ' + st.code + ' ' + st.label + '</div></div>' +
      '<button class="icon-btn" id="mClose">✕</button></div>' +
      '<div style="margin:12px 0;display:flex;gap:8px;flex-wrap:wrap">' + statusPill(o) +
      (o.sla ? '<span class="status-pill st-critical">SLA Breach · ' + fmtMin(o.total) + '</span>' : o.total >= 0 ? '<span class="status-pill st-healthy">Within SLA · ' + fmtMin(o.total) + '</span>' : '') +
      (o.dR >= 0 ? '<span class="status-pill st-high">⚠ ' + DB.delayReasons[o.dR] + '</span>' : '') +
      (o.cr >= 0 ? '<span class="status-pill st-critical">✕ ' + DB.cancelReasons[o.cr] + '</span>' : '') + '</div>' +
      '<div class="d-kpis" style="grid-template-columns:repeat(4,1fr)">' +
      dKpi('Items', o.items) + dKpi('Order value', '₹' + fmtN(o.val)) + dKpi('Discount', '₹' + fmtN(o.disc)) + dKpi('Net revenue', '₹' + fmtN(o.rev)) +
      dKpi('Payment', DB.payMethods[o.pay]) + dKpi('Category', DB.cats[o.cat].name.split(' ')[0]) + dKpi('Customer', (o.n ? '🆕 New' : '🔁 Repeat')) + dKpi('Refund', o.ref ? '₹' + fmtN(o.ref) : '—') +
      '</div>' +
      '<h4 style="margin:12px 0 4px">Journey timeline</h4><div class="otl">' +
      steps.map((s, i) => {
        const na = s[1] < 0;
        const t = na ? null : s[1];
        return '<div class="otl-row"><div class="otl-dot ' + (na ? 'na' : (i === 8 && o.sla ? 'late' : 'done')) + '">' + (na ? '·' : (i + 1)) + '</div>' +
          '<div><div class="otl-t">' + s[0] + '</div><div class="otl-s">' + (na ? 'not reached' : s[2]) + (s[3] != null && !na ? ' · <b style="color:' + (s[3] > 5 ? 'var(--red)' : 'var(--acc2)') + '">' + fmtMin(s[3]) + '</b>' : '') + '</div></div>' +
          '<div class="otl-time">' + (na ? '—' : '<b>' + absTime(t) + '</b>') + '</div></div>';
      }).join('') + '</div>' +
      (o.dR >= 0 ? '<div class="att-action">🔎 <b>Root cause (auto):</b> ' + DB.delayReasons[o.dR] + '</div>' : '');
    const veil = document.getElementById('modalVeil');
    document.getElementById('modal').innerHTML = body;
    veil.classList.add('open');
    document.getElementById('mClose').addEventListener('click', () => veil.classList.remove('open'));
    veil.addEventListener('click', (e) => { if (e.target === veil) veil.classList.remove('open'); });
  }
  let orderIdx = null;

  /* ---------------------------- drawer helpers ----------------------------- */
  function drawer(html, vcolor) {
    const el = document.getElementById('drawer');
    el.innerHTML = html + '';
    el.classList.add('open');
    document.getElementById('drawerVeil').classList.add('open');
    bindOrderRows(el);
    try { if (window.EXPORTS) window.EXPORTS.attach(el); } catch (e) { }
  }
  function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerVeil').classList.remove('open');
  }
  function bindOrderRows(root) {
    root.querySelectorAll('tr[data-oid]').forEach(tr => tr.addEventListener('click', () => openOrder(tr.dataset.oid)));
  }

  /* --------------------------------- clock --------------------------------- */
  let simMin = 14 * 60 + 37;   // simulated "now" on the latest day
  function tickClock() {
    simMin = (simMin + 1) % 1440;
    const d = MAXD;
    const el = document.getElementById('clockTxt');
    if (el) el.textContent = 'LIVE · ' + DOWS[DB.days[d].dow] + ' ' + DB.days[d].label + ' · ' + minOfDay(simMin) + ' IST';
  }

  /* --------------------------------- init ---------------------------------- */
  function init() {
    orderIdx = new Map();
    DB.orders.forEach(o => orderIdx.set(o.id, o));
    // expose helpers to pages
    window.APP = api;
    buildNav();
    buildFilterBar();
    buildCtx();
    document.getElementById('btnCollapse').addEventListener('click', toggleSidebar);
    document.getElementById('sbHandle').addEventListener('click', toggleSidebar);
    if (window.innerWidth < 980) document.getElementById('app').classList.add('sb-collapsed');
    syncHandle();
    document.getElementById('btnTheme').addEventListener('click', toggleTheme);
    document.getElementById('drawerVeil').addEventListener('click', closeDrawer);
    document.getElementById('drawer').insertAdjacentHTML('afterbegin', '<button class="icon-btn d-close" onclick="APP.closeDrawer()">✕</button>');
    document.body.addEventListener('click', (e) => {
      const tr = e.target.closest && e.target.closest('tr[data-oid]');
      if (tr) openOrder(tr.dataset.oid);
    });
    tickClock(); setInterval(tickClock, 60000);
    goto('exec');
  }
  function toggleSidebar() {
    document.getElementById('app').classList.toggle('sb-collapsed');
    syncHandle();
  }
  function syncHandle() {
    const collapsed = document.getElementById('app').classList.contains('sb-collapsed');
    const h = document.getElementById('sbHandle');
    h.textContent = collapsed ? '›' : '‹';
    h.title = collapsed ? 'Open sidebar' : 'Close sidebar';
  }
  function toggleTheme() {
    const h = document.documentElement;
    const next = (h.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    h.setAttribute('data-theme', next);
    document.getElementById('btnTheme').textContent = next === 'dark' ? '🌙' : '☀️';
    CH.applyDefaults();
    render();
  }

  /* helper shared across pages ---------------------------------------------- */
  function attentionCard(al, rank) {
    return '<div class="att-card sev-' + al.sev.toLowerCase() + '">' +
      '<div class="att-ico">' + (al.sev === 'Critical' ? '🔴' : al.sev === 'High' ? '🟠' : '🟡') + '</div>' +
      '<div class="att-body">' +
      '<div class="att-title">' + sevDot(al.sev) + ' ' + al.sev.toUpperCase() + ' — ' + al.metric + ' <span class="tag">' + al.loc.storeName + ' · ' + al.loc.cityName + '</span></div>' +
      '<div class="att-grid" style="margin-top:10px">' +
      '<div class="att-cell"><div class="k">Current</div><div class="v bad">' + al.cur + '</div></div>' +
      '<div class="att-cell"><div class="k">Target</div><div class="v good">' + al.target + '</div></div>' +
      '<div class="att-cell"><div class="k">Impact</div><div class="v warn">' + al.impact + '</div></div>' +
      '<div class="att-cell"><div class="k">Likely root cause</div><div class="v">' + al.cause + '</div></div>' +
      '</div>' +
      '<div class="att-action">💡 <b>Recommended:</b> ' + al.action + '</div>' +
      '</div></div>';
  }

  const api = {
    DB, S, der, agg: g, aggregate, groupAgg, newAgg, computeAlerts, buildInsights, storeStatus, buildCtx,
    fmtM, fmtN, fmtMin, pct1, fx, dayLabel, dayLabelShort, rangeLabel, minOfDay, absTime, prevLabel,
    goto, render, drillCity, drillStore, openStore, openOrder, closeDrawer, drawer, bindOrderRows,
    kpiHTML, kpiGrid, attentionCard, sevDot, ordersTable, statusPill, DOWS, DOWS_L, MAXD,
    init
  };
  return api;
})();
