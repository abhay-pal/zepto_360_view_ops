/* ============================================================================
 * pages3.js — Customer Experience · Cancellations & Refunds ·
 * Workforce & Capacity · Peak Hour Analysis
 * ==========================================================================*/
(function () {
  'use strict';
  const A = window.APP, DB = A.DB;
  const { fmtM, fmtN, fmtMin, pct1, fx } = A;
  const el = (id) => document.getElementById(id);

  /* ===================== 9. CUSTOMER EXPERIENCE =========================== */
  PAGES.customers = function (ctx) {
    const k = ctx.k, d = ctx.d;
    const uniq = k.cus.size;
    const newC = k.newC;
    // order frequency buckets from the filtered period
    const byC = new Map();
    ctx.cur.forEach(o => byC.set(o.cus, (byC.get(o.cus) || 0) + 1));
    const buckets = [0, 0, 0, 0];
    byC.forEach(n => { if (n === 1) buckets[0]++; else if (n <= 3) buckets[1]++; else if (n <= 7) buckets[2]++; else buckets[3]++; });
    // complaint rate by O2D bucket — do operations drive CX?
    const o2dB = [['≤12m', 0, 12], ['12–16m', 12, 16], ['16–20m', 16, 20], ['20–25m', 20, 25], ['25m+', 25, 1e9]];
    const bData = o2dB.map(([lbl, lo, hi]) => {
      let n = 0, c = 0;
      ctx.cur.forEach(o => { if (o.total >= lo && o.total < hi) { n++; if (o.cmp >= 0) c++; } });
      return n ? fx(100 * c / n, 1) : 0;
    });
    // complaint trend
    const lab = [], cT = [];
    for (let day = ctx.from; day <= ctx.to; day++) { lab.push(DB.days[day].label); cT.push(ctx.cmpByDay.get(day) || 0); }
    // by store (top 8)
    const stC = [...ctx.cmpByStore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    // bubble: store avg delivery vs complaint rate
    const bubbles = [];
    ctx.byStore.forEach((a, sid) => {
      if (a.del + a.ref >= 15) { const dd = A.der(a); bubbles.push({ x: fx(dd.avgTotal, 1), y: fx(dd.compRate, 1), r: Math.max(3, Math.sqrt(a.n) / 2), sid }); }
    });

    el('page-customers').innerHTML =
      A.kpiGrid([
        A.kpiHTML({ label: 'Total Customers (period)', cur: uniq, fmt: fmtN, color: 'var(--acc)' }),
        A.kpiHTML({ label: 'New Customers', cur: newC, fmt: fmtN, color: 'var(--green)' }),
        A.kpiHTML({ label: 'Repeat Order Rate', cur: d.repeatRate, prev: ctx.hasPrev ? ctx.pd.repeatRate : null, fmt: pct1, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Orders / Customer', cur: uniq ? k.n / uniq : 0, fmt: v => fx(v, 1), color: 'var(--vio)' }),
        A.kpiHTML({ label: 'Complaints', cur: ctx.cmpL.length, prev: null, fmt: fmtN, invert: true, color: 'var(--amber)' }),
        A.kpiHTML({ label: 'Complaint Rate', cur: d.compRate, prev: ctx.hasPrev ? ctx.pd.compRate : null, fmt: pct1, invert: true, target: 2.5, ach: 100 * 2.5 / Math.max(.01, d.compRate), color: d.compRate <= 2.5 ? 'var(--green)' : 'var(--red)' }),
        A.kpiHTML({ label: 'Refund Rate', cur: d.refundRate, fmt: pct1, invert: true, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Cancellation Rate', cur: d.cancelRate, fmt: pct1, invert: true, color: 'var(--red)' })
      ]) +
      '<div class="grid g3">' +
      '<div class="panel"><h3>Complaints by category</h3><div class="psub">what customers report</div><div class="chart-wrap" style="height:250px"><canvas id="cxCat"></canvas></div></div>' +
      '<div class="panel"><h3>Complaint trend</h3><div class="psub">per day in period</div><div class="chart-wrap" style="height:250px"><canvas id="cxTrend"></canvas></div></div>' +
      '<div class="panel"><h3>Complaints by store — top 8</h3><div class="psub">click bars to open store drawer</div><div class="chart-wrap" style="height:250px"><canvas id="cxStore"></canvas></div></div>' +
      '</div>' +
      '<div class="grid g2">' +
      '<div class="panel"><h3>Complaint rate vs delivery time</h3><div class="psub">proof that slow operations damage customer experience</div><div class="chart-wrap" style="height:250px"><canvas id="cxVs"></canvas></div></div>' +
      '<div class="panel"><h3>Store map: delivery time vs complaint rate</h3><div class="psub">bubble = store order volume · top-right quadrant = worst</div><div class="chart-wrap" style="height:250px"><canvas id="cxBubble"></canvas></div></div>' +
      '</div>' +
      '<div class="grid g32">' +
      '<div class="panel"><h3>Customer frequency mix</h3><div class="psub">orders per customer inside the selected period</div><div class="chart-wrap" style="height:230px"><canvas id="cxFreq"></canvas></div></div>' +
      '<div class="panel"><h3>Latest complaints</h3><div class="psub">synthetic tickets</div><div class="tscroll sm"><table class="tbl"><thead><tr><th>ID</th><th>Day</th><th>Category</th><th>Store</th><th class="num">O2D</th></tr></thead><tbody>' +
      ctx.cmpL.slice().sort((a, b) => b.day - a.day).slice(0, 12).map(c => '<tr><td style="color:var(--acc)">' + c.id + '</td><td class="muted">' + A.dayLabelShort(c.day) + '</td><td>' + DB.complaintCats[c.cat] + '</td><td class="muted">' + DB.stores[c.store].code + '</td><td class="num">' + c.total.toFixed(0) + 'm</td></tr>').join('') +
      '</tbody></table></div></div></div>';

    const catIds = DB.complaintCats.map((_, i) => i);
    CH.dough('cxCat', DB.complaintCats, catIds.map(i => ctx.cmpByCat.get(i) || 0), { center: [fmtN(ctx.cmpL.length), 'tickets'] });
    CH.line('cxTrend', lab, [{ label: 'Complaints', data: cT, fill: true, borderColor: '#fbbf24' }], { legend: false });
    const cxS = CH.bar('cxStore', stC.map(([sid]) => DB.stores[sid].code), [{ label: 'Complaints', data: stC.map(([, v]) => v), backgroundColor: '#fb923c' }], { legend: false });
    if (cxS) el('cxStore').parentNode.style.cursor = 'pointer';
    el('cxStore').onclick = (e) => {
      const pts = cxS.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
      if (pts.length) A.openStore(stC[pts[0].index][0]);
    };
    CH.bar('cxVs', o2dB.map(b => b[0]), [{ label: 'Complaint rate %', data: bData, backgroundColor: bData.map(v => v > 8 ? '#ff5d7e' : v > 4 ? '#fbbf24' : '#2fd48a') }], { legend: false, yFmt: v => v + '%' });
    CH.mk('cxBubble', {
      data: { datasets: [{ label: 'Stores', data: bubbles, backgroundColor: 'rgba(169,77,245,.45)', borderColor: '#a94df5' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => { const b = c.raw; return DB.stores[b.sid].code + ': ' + b.x + ' min, ' + b.y + '% complaints'; } } }
        },
        scales: { x: { title: { display: true, text: 'Avg delivery (min)' }, grid: { color: CH.tokens().line } }, y: { title: { display: true, text: 'Complaint rate %' }, grid: { color: CH.tokens().line } } }
      }
    });
    CH.dough('cxFreq', ['1 order', '2–3 orders', '4–7 orders', '8+ orders'], buckets, { colors: ['#a94df5', '#ff4d9e', '#c084fc', '#fbbf24'], center: [fmtN(byC.size), 'customers'] });
  };

  /* ================= 10. CANCELLATIONS & REFUNDS ========================== */
  PAGES.cancels = function (ctx) {
    const k = ctx.k, d = ctx.d;
    const reasons = new Array(DB.cancelReasons.length).fill(0);
    const reasonGMV = new Array(DB.cancelReasons.length).fill(0);
    ctx.cur.forEach(o => { if (o.cr >= 0) { reasons[o.cr]++; reasonGMV[o.cr] += o.val; } });
    const refundByCat = new Array(10).fill(0);
    ctx.cur.forEach(o => { refundByCat[o.cat] += o.ref; });
    const lossGMV = ctx.cur.reduce((a, o) => a + (o.status === 1 ? o.val : 0), 0);
    const stages = ['Payment / checkout', 'Customer (pre-accept)', 'Stock-out (picking)', 'Store delay (packing)', 'Rider unavailable', 'In-transit delay', 'System'];
    const stageIdx = [4, 0, 1, 2, 3, 5, 6];
    const stageVals = stageIdx.map(i => reasons[i]);
    const lab = [], cRate = [], rAmt = [];
    for (let day = ctx.from; day <= ctx.to; day++) {
      const a = ctx.byDay.get(day); lab.push(DB.days[day].label);
      cRate.push(a ? fx(A.der(a).cancelRate, 1) : null);
      rAmt.push(a ? a.refAmt / 1000 : 0);
    }
    const cancByHour = new Array(24).fill(0);
    ctx.cur.forEach(o => { if (o.status === 1) cancByHour[o.h]++; });

    el('page-cancels').innerHTML =
      A.kpiGrid([
        A.kpiHTML({ label: 'Cancelled Orders', cur: k.canc, prev: ctx.hasPrev ? ctx.pk.canc : null, fmt: fmtN, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Cancellation Rate', cur: d.cancelRate, prev: ctx.hasPrev ? ctx.pd.cancelRate : null, fmt: pct1, invert: true, target: 6, ach: 100 * 6 / Math.max(.01, d.cancelRate), color: d.cancelRate <= 7 ? 'var(--green)' : 'var(--red)' }),
        A.kpiHTML({ label: 'Cancelled GMV (lost)', cur: lossGMV, fmt: fmtM, invert: true, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Refund Amount', cur: k.refAmt, prev: ctx.hasPrev ? ctx.pk.refAmt : null, fmt: fmtM, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Refund Rate', cur: d.refundRate, prev: ctx.hasPrev ? ctx.pd.refundRate : null, fmt: pct1, invert: true, color: 'var(--amber)' }),
        A.kpiHTML({ label: 'Total Revenue Lost', cur: lossGMV + k.refAmt, fmt: fmtM, invert: true, color: 'var(--red)' })
      ]) +
      '<div class="grid g32">' +
      '<div class="panel"><h3>Cancellation funnel — where orders die</h3><div class="psub">pipeline stage at which the cancellation happened</div>' +
      '<div class="funnel">' + stages.map((s, i) => {
        const v = stageVals[i], pv = k.n ? 100 * v / k.n : 0;
        return '<div class="fun-row"><div class="fl">' + s + '</div>' +
          '<div class="fun-bar"><i style="width:' + Math.max(1.2, Math.min(100, pv * 12)) + '%;background:' + ['#a94df5', '#e879f9', '#fb923c', '#fbbf24', '#c084fc', '#ff5d7e', '#8f7ab8'][i] + '"><span>' + fmtN(v) + '</span></i></div>' +
          '<div class="fun-cv">' + pct1(100 * v / Math.max(1, k.canc)) + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="panel"><h3>Root-cause split</h3><div class="psub">share of cancellations</div><div class="chart-wrap" style="height:300px"><canvas id="cnWhy"></canvas></div></div>' +
      '</div>' +
      '<div class="grid g3">' +
      '<div class="panel"><h3>Cancellation rate trend</h3><div class="chart-wrap" style="height:220px"><canvas id="cnTrend"></canvas></div></div>' +
      '<div class="panel"><h3>Cancellations by hour</h3><div class="chart-wrap" style="height:220px"><canvas id="cnHour"></canvas></div></div>' +
      '<div class="panel"><h3>Refund amount trend (₹K/day)</h3><div class="chart-wrap" style="height:220px"><canvas id="cnRef"></canvas></div></div>' +
      '</div>' +
      '<div class="grid g2">' +
      '<div class="panel"><h3>GMV lost per cancellation reason</h3><div class="chart-wrap" style="height:260px"><canvas id="cnGmv"></canvas></div></div>' +
      '<div class="panel"><h3>Refunds by category</h3><div class="chart-wrap" style="height:260px"><canvas id="cnRefCat"></canvas></div></div>' +
      '</div>';

    CH.dough('cnWhy', DB.cancelReasons, reasons, { center: [pct1(d.cancelRate), 'cancel rate'] });
    CH.line('cnTrend', lab, [{ label: 'Cancel %', data: cRate, fill: true, borderColor: '#ff5d7e' }], { yFmt: v => v + '%', legend: false });
    CH.bar('cnHour', Array.from({ length: 24 }, (_, h) => h), [{ label: 'Cancels', data: cancByHour, backgroundColor: cancByHour.map((v, h) => h >= 18 && h <= 22 ? '#ff5d7e' : '#a94df5') }], { legend: false });
    CH.line('cnRef', lab, [{ label: 'Refunds ₹K', data: rAmt.map(v => fx(v, 1)), fill: true, borderColor: '#c084fc' }], { legend: false, yFmt: v => '₹' + v + 'K' });
    CH.bar('cnGmv', DB.cancelReasons, [{ label: 'GMV ₹K', data: reasonGMV.map(v => fx(v / 1000, 1)), backgroundColor: '#fb923c' }], { legend: false, h: true, yFmt: v => '₹' + v + 'K' });
    CH.bar('cnRefCat', DB.cats.map(c => c.name.split(' ')[0]), [{ label: 'Refunds ₹K', data: refundByCat.map(v => fx(v / 1000, 1)), backgroundColor: '#fbbf24' }], { legend: false, xRot: 25, yFmt: v => '₹' + v + 'K' });
  };

  /* ===================== 11. WORKFORCE & CAPACITY ========================= */
  PAGES.workforce = function (ctx) {
    const storeSet = DB.stores.filter(s =>
      (ctx.f.city === 'all' || s.city === +ctx.f.city) &&
      (ctx.f.zone === 'all' || (s.city === +ctx.f.city && s.zone === +ctx.f.zone)) &&
      (ctx.f.store === 'all' || s.id === +ctx.f.store));
    const nPickers = storeSet.reduce((a, s) => a + s.pickers, 0);
    const nPackers = storeSet.reduce((a, s) => a + s.packers, 0);
    const nStaff = storeSet.reduce((a, s) => a + s.staff, 0);
    const nRiders = storeSet.reduce((a, s) => a + DB.storeRiders[s.id].length, 0);
    const nEmp = nPickers + nPackers + nStaff;
    const k = ctx.k;
    const perDay = k.n / ctx.len;
    // capacity: pickers can clear ~11 orders/hr while on shift; stores run 2 shifts (6:00–23:00) — night at 35%
    const capPhr = h => {
      const shiftF = (h >= 6 && h <= 23) ? (h >= 14 && h <= 16 ? 0.8 : 1.0) : 0.35;
      return storeSet.reduce((a, s) => a + s.pickers * 11 * 0.85 * shiftF, 0);
    };
    const demand = new Array(24).fill(0), dDel = new Array(24).fill(0);
    ctx.cur.forEach(o => demand[o.h]++);
    const demPerHr = demand.map(v => v / ctx.len);
    const hrs = Array.from({ length: 24 }, (_, h) => h);
    const utilHrs = hrs.map(h => { const c = capPhr(h); return c > 0 ? 100 * demPerHr[h] / c : 0; });
    const peakH = hrs.reduce((b, h) => demPerHr[h] > demPerHr[b] ? h : b, 0);
    const peakUtil = 100 * demPerHr[peakH] / Math.max(.01, capPhr(peakH));
    // understaffed stores: peak demand fraction vs capacity
    const sPeak = new Map();
    ctx.cur.forEach(o => { if ((o.h >= 18 && o.h <= 21) || (o.h >= 8 && o.h <= 10)) sPeak.set(o.store, (sPeak.get(o.store) || 0) + 1); });
    const under = storeSet.map(s => {
      const a = ctx.byStore.get(s.id);
      if (!a || a.n < 20) return null;
      const peakOrders = sPeak.get(s.id) || 0;
      const peakPerHr = peakOrders / ctx.len / 6;      // six peak hours
      const cap = s.pickers * 11 * 0.85;
      const d = A.der(a);
      return { s, a, d, peakPerHr, cap, load: 100 * peakPerHr / cap };
    }).filter(Boolean).sort((x, y) => y.load - x.load);

    el('page-workforce').innerHTML =
      A.kpiGrid([
        A.kpiHTML({ label: 'Store Employees', cur: nEmp, fmt: fmtN, color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Pickers', cur: nPickers, fmt: fmtN, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Packers', cur: nPackers, fmt: fmtN, color: 'var(--vio)' }),
        A.kpiHTML({ label: 'Delivery Riders', cur: nRiders, fmt: fmtN, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Orders / Employee', cur: nEmp ? k.n / nEmp : 0, fmt: v => fx(v, 0), color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Orders / Picker / Day', cur: nPickers ? perDay / nPickers : 0, fmt: v => fx(v, 1), target: 6, ach: nPickers ? 100 * (perDay / nPickers) / 6 : 0, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Peak Capacity Utilization', cur: peakUtil, fmt: pct1, target: 78, ach: peakUtil / 78 * 100, color: peakUtil > 90 ? 'var(--red)' : peakUtil > 70 ? 'var(--amber)' : 'var(--green)' }),
        A.kpiHTML({ label: 'Peak Hour (' + peakH + ':00)', cur: demPerHr[peakH], fmt: v => fx(v, 1) + ' o/h', color: 'var(--vio)' })
      ]) +
      '<div class="panel"><h3>Order demand vs operational capacity — hourly</h3><div class="psub">capacity = pickers × 11 orders/hr × shift coverage · red segments = demand exceeds capacity</div>' +
      '<div class="chart-wrap" style="height:290px"><canvas id="wfCap"></canvas></div></div>' +
      '<div class="grid">' +
      '<div class="panel"><h3>Understaffed stores &amp; slots</h3><div class="psub">stores whose 8–10 AM / 6–9 PM demand runs hottest vs picker capacity · click to drill</div>' +
      '<div class="tscroll"><table class="tbl"><thead><tr><th>Store</th><th>City</th><th class="num">Pickers</th><th class="num">Packers</th><th class="num">Peak load</th><th class="num">Peak o/h</th><th class="num">Cap o/h</th><th class="num">SLA</th><th>Verdict</th></tr></thead><tbody>' +
      under.slice(0, 20).map(u => {
        const verdict = u.load > 100 ? ['st-critical', 'OVERLOADED'] : u.load > 85 ? ['st-high', 'UNDERSTAFFED'] : u.load > 65 ? ['st-watch', 'TIGHT'] : ['st-healthy', 'OK'];
        return '<tr class="clickable" data-sid="' + u.s.id + '"><td><b style="color:var(--acc)">' + u.s.code + '</b> · ' + u.s.label + '</td>' +
          '<td class="muted">' + DB.cities[u.s.city].name + '</td><td class="num">' + u.s.pickers + '</td><td class="num">' + u.s.packers + '</td>' +
          '<td class="num"><div class="flex"><div class="meter" style="width:70px"><i style="width:' + Math.min(100, u.load) + '%;background:' + (u.load > 90 ? 'var(--red)' : u.load > 70 ? 'var(--amber)' : 'var(--green)') + '"></i></div>' + fx(u.load, 0) + '%</div></td>' +
          '<td class="num">' + fx(u.peakPerHr, 1) + '</td><td class="num">' + fx(u.cap, 1) + '</td><td class="num">' + pct1(u.d.slaPct) + '</td>' +
          '<td><span class="status-pill ' + verdict[0] + '">' + verdict[1] + '</span></td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="panel"><h3>Productivity by city — orders per picker day</h3><div class="chart-wrap" style="height:240px"><canvas id="wfCity"></canvas></div></div>' +
      '</div>';

    el('page-workforce').querySelectorAll('tr[data-sid]').forEach(tr => tr.addEventListener('click', () => A.openStore(+tr.dataset.sid)));

    const hourLbl = hrs.map(h => h + ':00');
    CH.mk('wfCap', {
      data: {
        labels: hourLbl,
        datasets: [
          { type: 'bar', label: 'Demand (orders/hr)', data: demPerHr.map(v => fx(v, 1)), backgroundColor: hrs.map(h => utilHrs[h] > 100 ? '#ff5d7e' : utilHrs[h] > 78 ? '#fbbf24' : '#a94df5'), borderRadius: 5 },
          { type: 'line', label: 'Capacity (orders/hr)', data: hrs.map(h => fx(capPhr(h), 0)), borderColor: '#ff4d9e', pointRadius: 3, tension: .2 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: CH.tokens().line } } } }
    });
    const cProd = DB.cities.map((c, ci) => {
      const a = ctx.byCity.get(ci); if (!a) return null;
      const pk = DB.stores.filter(s => s.city === ci).reduce((z, s) => z + s.pickers, 0) || 1;
      return { n: c.name, v: (a.n / ctx.len) / pk };
    }).filter(Boolean);
    CH.bar('wfCity', cProd.map(x => x.n), [{ label: 'Orders / picker / day', data: cProd.map(x => fx(x.v, 1)), backgroundColor: '#c084fc' }], { legend: false });
  };

  /* ====================== 12. PEAK HOUR ANALYSIS ========================== */
  let peakMetric = 'orders';
  PAGES.peak = function (ctx) {
    const cells = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ n: 0, totS: 0, totN: 0, slaB: 0 })));
    ctx.cur.forEach(o => {
      const c = cells[o.dow][o.h]; c.n++;
      if (o.total >= 0) { c.totS += o.total; c.totN++; if (o.sla) c.slaB++; }
    });
    const METRICS = {
      orders: { lbl: 'Orders', get: c => c.n, fmt: v => fmtN(v), stops: CH.HEAT_BLUE },
      delivery: { lbl: 'Avg delivery (min)', get: c => c.totN ? c.totS / c.totN : null, fmt: v => fx(v, 1) + 'm', stops: CH.HEAT_RED },
      breaches: { lbl: 'SLA breaches', get: c => c.slaB, fmt: v => fmtN(v), stops: CH.HEAT_RED },
      breachPct: { lbl: 'Breach %', get: c => c.totN ? 100 * c.slaB / c.totN : null, fmt: v => fx(v, 0) + '%', stops: CH.HEAT_RED }
    };
    const M = METRICS[peakMetric];
    const scale = ctx.len > 7 ? Math.max(1, Math.round(ctx.len / 7)) : 1; // normalize roughly per week day
    const mCells = cells.map(row => row.map(c => {
      const v = M.get(c);
      return { v: v == null ? null : (peakMetric === 'orders' || peakMetric === 'breaches' ? v / scale : v), tip: (peakMetric === 'orders' ? fmtN(v) + ' orders in period' : M.fmt(v)) };
    }));

    // auto peak detection
    const flat = [];
    cells.forEach((row, dw) => row.forEach((c, h) => flat.push({ dw, h, n: c.n, b: c.slaB, tb: c.totN })));
    flat.sort((a, b) => b.n - a.n);
    const topPeaks = flat.slice(0, 6);
    const breacher = flat.slice().sort((a, b) => (b.tb ? b.b / b.tb : 0) - (a.tb ? a.b / a.tb : 0))[0];
    const eveningShare = (() => { let t = 0, e = 0; cells.forEach(r => r.forEach((c, h) => { t += c.n; if (h >= 18 && h <= 22) e += c.n; })); return t ? 100 * e / t : 0; })();
    const wknd = [0, 0]; let wd = [0, 0], we = [0, 0];
    cells.forEach((r, dw) => r.forEach(c => { if (dw === 0 || dw === 6) we[0] += c.n; else wd[0] += c.n; }));
    const wkUplift = wd[0] && we[0] ? (100 * (we[0] / 2) / (wd[0] / 5) - 100) : 0;

    el('page-peak').innerHTML =
      '<div class="panel"><div class="flex between" style="flex-wrap:wrap;gap:10px"><div>' +
      '<h3>Day × Hour demand heatmap</h3><div class="psub">auto-scaled per weekday · hover cells for exact values' + (scale > 1 ? ' · cells show weekly average per weekday' : '') + '</div></div>' +
      '<div class="pill-select" id="pkM">' + Object.keys(METRICS).map(k => '<button data-m="' + k + '" class="' + (peakMetric === k ? 'on' : '') + '">' + METRICS[k].lbl + '</button>').join('') + '</div></div>' +
      '<div style="overflow-x:auto">' + CH.heatmap({ rows: A.DOWS_L, cols: Array.from({ length: 24 }, (_, h) => h), cells: mCells, stops: M.stops, fmt: M.fmt }) + '</div></div>' +
      '<div class="grid g3">' +
      '<div class="panel"><h3>🔥 Detected peak windows</h3><div class="psub">highest-demand day-hour cells this period</div>' +
      topPeaks.map(p => '<div class="flex between" style="padding:7px 2px;border-bottom:1px solid var(--line-soft)"><span><b>' + A.DOWS_L[p.dw] + '</b> · ' + p.h + ':00–' + (p.h + 1) + ':00</span><span class="muted">≈ ' + fx(p.n / scale, 1) + ' orders' + (p.tb ? ' · ' + fx(100 * p.b / p.tb, 0) + '% late' : '') + '</span></div>').join('') + '</div>' +
      '<div class="panel"><h3>⚠ Lateness hotspot</h3><div class="psub">day-hour cell with the worst SLA profile</div>' +
      (breacher && breacher.tb ? '<div style="font-size:24px;font-weight:800;color:var(--red)">' + fx(100 * breacher.b / breacher.tb, 0) + '% late</div><div class="muted" style="margin-top:4px">' + A.DOWS_L[breacher.dw] + ' ' + breacher.h + ':00–' + (breacher.h + 1) + ':00 · ' + fmtN(breacher.b) + ' breaches across period</div><div class="att-action" style="margin-top:12px">💡 Pre-position riders before <b>' + A.DOWS_L[breacher.dw] + ' ' + breacher.h + ':00</b> and pre-pick fast movers in ' + (breacher.h >= 12 ? 'the lunch hour' : 'the early morning') + '.</div>' : '<div class="empty">Not enough data</div>') + '</div>' +
      '<div class="panel"><h3>📊 Pattern summary</h3><div class="psub">auto-derived from heatmap</div>' +
      '<div class="stat-strip" style="grid-template-columns:1fr">' +
      '<div class="stat-box"><div class="v">' + fx(eveningShare, 0) + '%</div><div class="k">of orders in 18–22 window</div></div>' +
      '<div class="stat-box"><div class="v">' + (wkUplift >= 0 ? '+' : '') + fx(wkUplift, 0) + '%</div><div class="k">weekend vs weekday uplift</div></div>' +
      '<div class="stat-box"><div class="v">' + A.DOWS[flat[0] ? flat[0].dw : 0] + ' ' + (flat[0] ? flat[0].h : 0) + ':00</div><div class="k">busiest single slot</div></div>' +
      '</div></div>' +
      '</div>';

    el('pkM').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { peakMetric = b.dataset.m; A.render(); }));
  };
})();
