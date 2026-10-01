/* ============================================================================
 * pages1.js — Executive Overview · Live Operations · City Control Tower ·
 * Store Performance
 * ==========================================================================*/
(function () {
  'use strict';
  const A = window.APP, DB = A.DB;
  const { fmtM, fmtN, fmtMin, pct1, fx } = A;
  const el = (id) => document.getElementById(id);

  function daySeries(ctx, metric) {
    const labels = [], data = [];
    for (let d = ctx.from; d <= ctx.to; d++) {
      const a = ctx.byDay.get(d);
      labels.push(ctx.len > 60 ? DB.days[d].label : DB.days[d].label.replace(' ', '\u00a0'));
      data.push(a ? metric(A.der(a), a) : 0);
    }
    return { labels, data };
  }

  /* ========================= 1. EXECUTIVE OVERVIEW ======================== */
  PAGES.exec = function (ctx) {
    const k = ctx.k, d = ctx.d, pk = ctx.pk, pd = ctx.pd, has = ctx.hasPrev;
    const prev = (v) => has ? v : null;
    const perDay = k.n / ctx.len, pPerDay = has ? pk.n / ctx.len : null;
    const perHour = perDay / 24, pPerHour = has ? pPerDay / 24 : null;
    const ridersAct = k.riders.size, pRidersAct = null;
    const alerts = A.computeAlerts(ctx).slice(0, 5);

    const grp = (title) => '<div class="sec-title">' + title + '</div>';
    el('page-exec').innerHTML =
      /* ---------- attention section ---------- */
      '<div class="sec-title" style="margin-top:0">⚡ What needs my attention today?<span style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted2)">auto-generated from the active filters · top 5 issues</span></div>' +
      '<div class="grid g2" style="margin-top:0">' +
      (alerts.length ? alerts.map((al, i) => A.attentionCard(al, i + 1)).join('') : '<div class="panel"><div class="empty">✅ No operational exceptions in the selected scope. Network is healthy.</div></div>') +
      '</div>' +

      grp('📦 Volume &amp; Revenue') +
      A.kpiGrid([
        A.kpiHTML({ label: 'Total Orders', cur: k.n, prev: prev(pPerDay != null ? pk.n : null), ach: has ? 100 * k.n / (pk.n * 1.03) : null, target: has ? pk.n * 1.03 : null, color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Delivered Orders', cur: k.del, prev: prev(pk.del), color: 'var(--green)' }),
        A.kpiHTML({ label: 'Gross Order Value', cur: k.gmv, prev: prev(pk.gmv), fmt: fmtM, color: 'var(--vio)' }),
        A.kpiHTML({ label: 'Net Revenue', cur: k.rev, prev: prev(pk.rev), fmt: fmtM, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Avg Order Value', cur: d.aov, prev: prev(pd.aov), fmt: v => '₹' + fmtN(v), target: 430, tFmt: v => '₹' + v, ach: 100 * d.aov / 430, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Orders / Day', cur: perDay, prev: pPerDay, fmt: v => fmtN(v), color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Orders / Hour', cur: perHour, prev: pPerHour, fmt: v => fx(v, 1), color: 'var(--acc2)' })
      ]) +

      grp('🚀 Service Level &amp; Speed') +
      A.kpiGrid([
        A.kpiHTML({ label: 'Delivery Success %', cur: d.delivSuccess, prev: prev(pd.delivSuccess), fmt: pct1, target: 97, ach: 100 * d.delivSuccess / 97, color: 'var(--green)' }),
        A.kpiHTML({ label: 'SLA Compliance %', cur: d.slaPct, prev: prev(pd.slaPct), fmt: pct1, target: 90, ach: 100 * d.slaPct / 90, color: d.slaPct >= 90 ? 'var(--green)' : 'var(--red)', warn: d.slaPct < 90 ? 'Below 90% SLA threshold' : null }),
        A.kpiHTML({ label: 'Cancellation %', cur: d.cancelRate, prev: prev(pd.cancelRate), fmt: pct1, invert: true, target: 6, ach: 100 * 6 / Math.max(.01, d.cancelRate), color: d.cancelRate <= 7 ? 'var(--green)' : 'var(--red)' }),
        A.kpiHTML({ label: 'Avg Delivery (Order→Door)', cur: d.avgTotal, prev: prev(pd.avgTotal), fmt: fmtMin, invert: true, target: 15, ach: 100 * 15 / Math.max(.01, d.avgTotal), color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Delivered ≤ 10 min', cur: d.le10p, prev: prev(pd.le10p), fmt: pct1, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Delivered ≤ 15 min', cur: d.le15p, prev: prev(pd.le15p), fmt: pct1, color: 'var(--vio)' })
      ]) +

      grp('🏪 Store Pipeline Performance') +
      A.kpiGrid([
        A.kpiHTML({ label: 'Avg Picking Time', cur: d.avgPick, prev: prev(pd.avgPick), fmt: fmtMin, invert: true, target: 2.8, ach: 100 * 2.8 / Math.max(.01, d.avgPick), color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Avg Packing Time', cur: d.avgPack, prev: prev(pd.avgPack), fmt: fmtMin, invert: true, target: 1.4, ach: 100 * 1.4 / Math.max(.01, d.avgPack), color: 'var(--vio)' }),
        A.kpiHTML({ label: 'Avg Rider Assignment', cur: d.avgAsg, prev: prev(pd.avgAsg), fmt: fmtMin, invert: true, target: 2.2, ach: 100 * 2.2 / Math.max(.01, d.avgAsg), color: 'var(--amber)' }),
        A.kpiHTML({ label: 'Avg Rider Waiting', cur: d.avgWait, prev: prev(pd.avgWait), fmt: fmtMin, invert: true, target: 2.0, ach: 100 * 2.0 / Math.max(.01, d.avgWait), color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Active Dark Stores', cur: k.stores.size, color: 'var(--green)' }),
        A.kpiHTML({ label: 'Active Riders', cur: ridersAct, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Orders / Rider', cur: ridersAct ? (k.del + k.ref) / ridersAct : 0, fmt: v => fx(v, 1), color: 'var(--acc)' })
      ]) +

      grp('🙂 Customers &amp; Quality') +
      A.kpiGrid([
        A.kpiHTML({ label: 'Customer Complaints', cur: ctx.cmpL.length, fmt: fmtN, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Complaint Rate', cur: d.compRate, prev: prev(pd.compRate), fmt: pct1, invert: true, target: 2.5, ach: 100 * 2.5 / Math.max(.01, d.compRate), color: 'var(--amber)' }),
        A.kpiHTML({ label: 'Refund Rate', cur: d.refundRate, prev: prev(pd.refundRate), fmt: pct1, invert: true, target: 3, ach: 100 * 3 / Math.max(.01, d.refundRate), color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Stock-out Rate', cur: ctx.soRate, fmt: pct1, invert: true, target: 1.5, ach: 100 * 1.5 / Math.max(.01, ctx.soRate), color: 'var(--red)' }),
        A.kpiHTML({ label: 'Repeat Order Rate', cur: d.repeatRate, prev: prev(pd.repeatRate), fmt: pct1, color: 'var(--green)' })
      ]) +

      grp('📈 Trends') +
      '<div class="grid g23">' +
      '<div class="panel"><h3>Daily Orders &amp; Net Revenue</h3><div class="psub">click a point range → use global date filters for drill-down</div><div class="chart-wrap" style="height:265px"><canvas id="xvOrders"></canvas></div></div>' +
      '<div class="panel"><h3>Order Mix</h3><div class="psub">status distribution in period</div><div class="chart-wrap" style="height:265px"><canvas id="xvMix"></canvas></div></div>' +
      '</div>' +
      '<div class="grid g2">' +
      '<div class="panel"><h3>SLA Compliance Trend</h3><div class="psub">% of delivered orders within ' + DB.slaMin + ' min · target 90%</div><div class="chart-wrap" style="height:230px"><canvas id="xvSla"></canvas></div></div>' +
      '<div class="panel"><h3>Avg Order-to-Delivery Time</h3><div class="psub">minutes · lower is better</div><div class="chart-wrap" style="height:230px"><canvas id="xvTot"></canvas></div></div>' +
      '</div>';

    const s1 = daySeries(ctx, (dd, a) => a.n), s1r = daySeries(ctx, (dd, a) => a.rev / 1000);
    CH.line('xvOrders', s1.labels, [
      { label: 'Orders', data: s1.data, fill: true, borderColor: '#a94df5' },
      { label: 'Net revenue (₹K)', data: s1r.data, yAxisID: 'y2', borderColor: '#ff4d9e' }
    ], { y2: true, y2Fmt: v => '₹' + v + 'K' });
    CH.dough('xvMix', ['Delivered', 'Cancelled', 'Returned', 'Refunded'], [k.del, k.canc, k.ret, k.ref],
      { colors: ['#2fd48a', '#ff5d7e', '#fbbf24', '#c084fc'], center: [fmtN(k.n), 'orders'] });
    const s2 = daySeries(ctx, dd => dd.slaPct);
    CH.line('xvSla', s2.labels, [{ label: 'SLA %', data: s2.data, fill: true, borderColor: '#ff4d9e' }], { yFmt: v => v + '%' });
    const s3 = daySeries(ctx, dd => dd.avgTotal);
    CH.line('xvTot', s3.labels, [{ label: 'Avg min', data: s3.data.map(v => fx(v, 1)), fill: true, borderColor: '#fbbf24' }], { yFmt: v => v + 'm' });
  };

  /* ========================== 2. LIVE OPERATIONS ========================== */
  PAGES.live = function (ctx) {
    const day = ctx.latestDay;
    const NOW = day * 1440 + 14 * 60 + 37;
    const T = ctx.cur.filter(o => o.day === day && o.t <= NOW);
    const placed = T.length;
    const inPick = T.filter(o => o.pkS >= 0 && o.pkS <= NOW && (o.pkE < 0 || o.pkE > NOW)).length;
    const inPack = T.filter(o => o.pkE > 0 && o.pkE <= NOW && (o.pkF < 0 || o.pkF > NOW)).length;
    const waitRider = T.filter(o => o.pkF > 0 && o.pkF <= NOW && (o.ds < 0 || o.ds > NOW)).length;
    const ofd = T.filter(o => o.ds > 0 && o.ds <= NOW && (o.del < 0 || o.del > NOW)).length;
    const delayedOpen = T.filter(o => o.t < NOW - 20 && (o.del < 0 || o.del > NOW) && o.status !== 1).length;
    const breachDone = T.filter(o => o.sla && o.del <= NOW).length;
    const breachNow = breachDone + delayedOpen;
    const canc = T.filter(o => o.status === 1).length;
    const delDone = T.filter(o => o.del > 0 && o.del <= NOW).length;

    const stage = (fn) => T.filter(fn).length;
    const funnel = [
      ['Orders received', placed, '#a94df5'],
      ['Accepted by store', stage(o => o.acc >= 0 && o.acc <= NOW), '#e879f9'],
      ['Rider assigned', stage(o => o.rAs >= 0 && o.rAs <= NOW), '#ff4d9e'],
      ['Picking complete', stage(o => o.pkE >= 0 && o.pkE <= NOW), '#c084fc'],
      ['Packed', stage(o => o.pkF >= 0 && o.pkF <= NOW), '#a3e635'],
      ['Dispatched', stage(o => o.ds >= 0 && o.ds <= NOW), '#fbbf24'],
      ['Delivered', delDone, '#2fd48a']
    ];
    // bottleneck: stage with largest current in-flight backlog
    const backlogs = [['Picking', inPick], ['Packing', inPack], ['Awaiting rider dispatch', waitRider], ['Out for delivery', ofd]];
    backlogs.sort((a, b) => b[1] - a[1]);
    const bn = backlogs[0];

    const hourly = [], labels = [];
    const todayHour = new Array(24).fill(0);
    T.forEach(o => todayHour[o.h]++);
    // 7-day same-hour baseline ending `day`
    const m = A.S.f;
    const base = new Array(24).fill(0);
    DB.orders.forEach(o => {
      if (o.day >= day - 7 && o.day < day) {
        if (m.city !== 'all' && o.city !== +m.city) return;
        if (m.store !== 'all' && o.store !== +m.store) return;
        base[o.h]++;
      }
    });
    for (let h = 0; h < 24; h++) { labels.push(h + ':00'); hourly.push(todayHour[h]); }

    const delayedList = T.filter(o => o.t < NOW - 15 && (o.del < 0 || o.del > NOW) && o.status !== 1)
      .sort((a, b) => a.t - b.t).slice(0, 30);

    el('page-live').innerHTML =
      '<div class="panel"><div class="flex between" style="flex-wrap:wrap;gap:10px">' +
      '<div><h3>🛰 Live Operations Snapshot</h3><div class="psub">Simulated control-tower view · ' + A.dayLabel(day) + ' · pipeline state at 14:37 IST · synthetic data</div></div>' +
      '<div class="flex"><span class="tb-clock"><span class="dot-live"></span>MONITORING</span></div></div>' +
      '<div class="stat-strip">' +
      sb(placed, 'Orders today', 'info') +
      sb(inPick, 'Currently picking', '') +
      sb(inPack, 'Packing', '') +
      sb(waitRider, 'Waiting for rider', waitRider > 6 ? 'warn' : '') +
      sb(ofd, 'Out for delivery', '') +
      sb(delayedOpen, 'Delayed (open >20m)', delayedOpen > 8 ? 'bad' : 'warn') +
      sb(breachNow, 'SLA breaches', breachNow > 12 ? 'bad' : 'warn') +
      sb(canc, 'Cancelled today', '') +
      '</div></div>' +

      '<div class="grid g32">' +
      '<div class="panel"><h3>Operational Funnel</h3><div class="psub">where today\'s orders stand right now · biggest live backlog: <b style="color:var(--amber)">' + bn[0] + ' (' + bn[1] + ')</b></div>' +
      '<div class="funnel">' + funnel.map((f2) => {
        const pv = placed ? 100 * f2[1] / placed : 0;
        return '<div class="fun-row"><div class="fl">' + f2[0] + '</div>' +
          '<div class="fun-bar" title="' + f2[0] + ': ' + fmtN(f2[1]) + ' (' + fx(pv, 0) + '%)"><i style="width:' + Math.max(1.5, pv) + '%;background:' + f2[2] + '"><span>' + fx(pv, 0) + '%</span></i></div>' +
          '<div class="fun-cv">' + fmtN(f2[1]) + '</div></div>';
      }).join('') +
      '<div class="fun-drop">' + fmtN(placed - delDone) + ' still in pipeline or dropped (incl. ' + canc + ' cancellations)</div></div></div>' +
      '<div class="panel"><h3>Today vs 7-day hourly baseline</h3><div class="psub">orders per hour</div><div class="chart-wrap" style="height:300px"><canvas id="lvHr"></canvas></div></div>' +
      '</div>' +

      '<div class="grid g2">' +
      '<div class="panel"><h3>🚨 Orders delayed right now</h3><div class="psub">open orders past 15 min — click a row for the full journey</div>' +
      (delayedList.length ? A.ordersTable(delayedList, ctx, true) : '<div class="empty">✅ No stuck orders. Pipeline is flowing.</div>') + '</div>' +
      '<div class="panel"><h3>Live stage health</h3><div class="psub">which stage is orders\' bottleneck today vs network average</div><div class="chart-wrap" style="height:300px"><canvas id="lvStage"></canvas></div></div>' +
      '</div>';

    function sb(v, k, cls) { return '<div class="stat-box ' + cls + '">' + (cls === 'bad' || cls === 'warn' ? '<span class="blink"></span>' : '') + '<div class="v">' + fmtN(v) + '</div><div class="k">' + k + '</div></div>'; }

    CH.line('lvHr', labels, [
      { label: 'Today', data: hourly, fill: true, borderColor: '#a94df5' },
      { label: '7-day avg', data: base.map(v => fx(v / 7, 1)), borderColor: '#8f7ab8', borderDash: [5, 4] }
    ]);
    const dd = A.der(A.aggregate(T, false)), nd = ctx.d;
    CH.bar('lvStage', ['Accept', 'Assign', 'Pick', 'Pack', 'Wait', 'Ride'], [
      { label: 'Today (min)', data: [dd.avgAcc, dd.avgAsg, dd.avgPick, dd.avgPack, dd.avgWait, dd.avgRide].map(v => fx(v, 1)), backgroundColor: '#a94df5' },
      { label: 'Network avg', data: [nd.avgAcc, nd.avgAsg, nd.avgPick, nd.avgPack, nd.avgWait, nd.avgRide].map(v => fx(v, 1)), backgroundColor: '#5a4a86' }
    ]);
  };

  /* ========================= 3. CITY CONTROL TOWER ======================== */
  PAGES.tower = function (ctx) {
    const selCity = ctx.f.city === 'all' ? -1 : +ctx.f.city;
    const cards = DB.cities.map((c, ci) => {
      const a = ctx.byCity.get(ci) || A.newAgg(), d = A.der(a);
      const storesN = DB.stores.filter(s => s.city === ci).length;
      const ridersN = DB.storeRiders.reduce((n, arr, sid) => n + (DB.stores[sid].city === ci ? arr.length : 0), 0);
      const status = d.slaPct >= 91 && d.cancelRate <= 6.5 ? 'Healthy' : d.slaPct >= 86 ? 'Watch' : 'Critical';
      if (a.n === 0) return '';
      const shar = ctx.k.n ? 100 * a.n / ctx.k.n : 0;
      return '<div class="tower-card' + (selCity === ci ? ' sel' : '') + '" data-city="' + ci + '">' +
        '<div class="tc-head"><div class="tc-city">' + c.name + '</div><span class="status-pill st-' + status.toLowerCase() + '">' + status + '</span></div>' +
        '<div class="tc-kpis">' +
        tck('Orders', fmtN(a.n)) + tck('Revenue', fmtM(a.rev)) + tck('SLA', pct1(d.slaPct)) +
        tck('Avg delivery', fmtMin(d.avgTotal)) + tck('Cancel', pct1(d.cancelRate)) + tck('Complaints', fmtN(a.cmp)) +
        tck('Stores', storesN) + tck('Riders', fmtN(ridersN)) + tck('AOV', '₹' + fmtN(d.aov)) +
        '</div>' +
        '<div class="tc-bar"><i style="width:' + fx(shar, 1) + '%;background:var(--acc)" title="' + fx(shar, 1) + '% of network orders"></i><i style="width:' + fx(100 * a.slaB / Math.max(1, a.totN) * 3, 1) + '%;background:var(--red)" title="SLA breaches"></i></div>' +
        '<div class="small muted" style="margin-top:6px">' + fx(shar, 1) + '% of network volume · click to filter the whole dashboard</div>' +
        '</div>';
    }).join('');

    const cityRows = DB.cities.map((c, ci) => ({ c, ci, a: ctx.byCity.get(ci) || A.newAgg() })).filter(x => x.a.n > 0);

    el('page-tower').innerHTML =
      '<div class="panel"><h3>🇮🇳 City Control Tower</h3><div class="psub">network-wide city health · click a city card to cross-filter every page (India → City → Store → Order)</div>' +
      '<div class="tower-grid">' + cards + '</div></div>' +
      '<div class="grid g2">' +
      '<div class="panel"><h3>SLA compliance by city</h3><div class="psub">green ≥ 90% target · red below</div><div class="chart-wrap" style="height:270px"><canvas id="twSla"></canvas></div></div>' +
      '<div class="panel"><h3>Order volume vs avg delivery time</h3><div class="psub">cities pushing volume vs speed</div><div class="chart-wrap" style="height:270px"><canvas id="twVol"></canvas></div></div>' +
      '</div>' +
      '<div class="grid" style="grid-template-columns:1fr">' +
      '<div class="panel"><h3>Zone drill-down' + (selCity >= 0 ? ' · ' + DB.cities[selCity].name : '') + '</h3><div class="psub">select a city card to see its zones and stores</div>' +
      zoneTable(ctx, selCity) + '</div></div>';

    el('page-tower').querySelectorAll('.tower-card').forEach(card => card.addEventListener('click', () => {
      const ci = +card.dataset.city;
      if (+ctx.f.city === ci) { A.S.f.city = 'all'; el('fCity').value = 'all'; }
      else { A.S.f.city = String(ci); el('fCity').value = String(ci); }
      A.S.f.zone = 'all'; A.S.f.store = 'all';
      A.S.ctx = null;
      A.render();          // rebuilds the aggregation context + page
    }));
    el('page-tower').querySelectorAll('tr[data-city]').forEach(tr => tr.addEventListener('click', () => A.drillCity(+tr.dataset.city)));
    el('page-tower').querySelectorAll('tr[data-sid]').forEach(tr => tr.addEventListener('click', () => A.openStore(+tr.dataset.sid)));

    CH.bar('twSla', cityRows.map(x => x.c.name), [{
      label: 'SLA %', data: cityRows.map(x => fx(A.der(x.a).slaPct, 1)),
      backgroundColor: cityRows.map(x => A.der(x.a).slaPct >= 90 ? '#2fd48a' : '#ff5d7e')
    }], { yFmt: v => v + '%', legend: false });

    CH.bar('twVol', cityRows.map(x => x.c.name), [
      { label: 'Orders', data: cityRows.map(x => x.a.n), backgroundColor: '#a94df5' },
      { label: 'Avg delivery (min)', data: cityRows.map(x => fx(A.der(x.a).avgTotal, 1)), backgroundColor: '#fbbf24', yAxisID: 'y2' }
    ], { y2: true, y2Fmt: v => v + 'm' });
  };
  function tck(k, v) { return '<div class="tc-k"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
  function zoneTable(ctx, selCity) {
    let rows = [];
    if (selCity >= 0) {
      const c = DB.cities[selCity];
      c.zones.forEach((z, zi) => {
        const a = ctx.byZone.get(selCity + '|' + zi);
        if (a && a.n > 0) rows.push({ t: z + ' zone', ci: selCity, a });
      });
      if (!rows.length) return '<div class="empty">No zone data in scope</div>';
      rows.sort((x, y) => y.a.n - x.a.n);
      return '<div class="tscroll"><table class="tbl"><thead><tr><th>Zone</th><th class="num">Orders</th><th class="num">Revenue</th><th class="num">SLA</th><th class="num">Avg delivery</th><th class="num">Cancel</th></tr></thead><tbody>' +
        rows.map(r => { const d = A.der(r.a); return '<tr><td><b>' + r.t + '</b></td><td class="num">' + fmtN(r.a.n) + '</td><td class="num">' + fmtM(r.a.rev) + '</td><td class="num" style="color:' + (d.slaPct >= 90 ? 'var(--green)' : 'var(--red)') + '">' + pct1(d.slaPct) + '</td><td class="num">' + fmtMin(d.avgTotal) + '</td><td class="num">' + pct1(d.cancelRate) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' +
        '<div class="sec-title">Stores in ' + DB.cities[selCity].name + ' (click to open)</div>' +
        '<div class="tscroll sm"><table class="tbl"><thead><tr><th>Store</th><th>Zone</th><th class="num">Orders</th><th class="num">SLA</th><th class="num">Avg delivery</th><th>Status</th></tr></thead><tbody>' +
        DB.stores.filter(s => s.city === selCity).map(s => {
          const a = ctx.byStore.get(s.id); if (!a) return '';
          const d = A.der(a);
          const st = A.storeStatus(d, a, ctx);
          return '<tr class="clickable" data-sid="' + s.id + '"><td style="color:var(--acc)">' + s.code + ' · ' + s.label + '</td><td class="muted">' + DB.cities[selCity].zones[s.zone] + '</td><td class="num">' + fmtN(a.n) + '</td><td class="num">' + pct1(d.slaPct) + '</td><td class="num">' + fmtMin(d.avgTotal) + '</td><td><span class="status-pill st-' + st.toLowerCase() + '">' + st + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    // all-cities summary table
    rows = DB.cities.map((c, ci) => ({ c, ci, a: ctx.byCity.get(ci) || A.newAgg() })).filter(x => x.a.n > 0);
    return '<div class="tscroll"><table class="tbl"><thead><tr><th>City</th><th class="num">Orders</th><th class="num">Revenue</th><th class="num">AOV</th><th class="num">SLA</th><th class="num">Avg delivery</th><th class="num">Cancel</th><th class="num">Complaints</th><th>Status</th></tr></thead><tbody>' +
      rows.sort((x, y) => y.a.n - x.a.n).map(r => {
        const d = A.der(r.a);
        const st = d.slaPct >= 91 && d.cancelRate <= 6.5 ? 'Healthy' : d.slaPct >= 86 ? 'Watch' : 'Critical';
        return '<tr class="clickable" data-city="' + r.ci + '"><td><b style="color:var(--acc)">' + r.c.name + '</b></td><td class="num">' + fmtN(r.a.n) + '</td><td class="num">' + fmtM(r.a.rev) + '</td><td class="num">₹' + fmtN(d.aov) + '</td><td class="num" style="color:' + (d.slaPct >= 90 ? 'var(--green)' : 'var(--red)') + '">' + pct1(d.slaPct) + '</td><td class="num">' + fmtMin(d.avgTotal) + '</td><td class="num">' + pct1(d.cancelRate) + '</td><td class="num">' + fmtN(r.a.cmp) + '</td><td><span class="status-pill st-' + st.toLowerCase() + '">' + st + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ========================= 4. STORE PERFORMANCE ========================= */
  let storeSort = 'orders';
  PAGES.stores = function (ctx) {
    const rows = [];
    ctx.byStore.forEach((a, sid) => { if (a.n > 0) rows.push({ sid, a, d: A.der(a) }); });
    const sorters = {
      orders: (x, y) => y.a.n - x.a.n,
      revenue: (x, y) => y.a.rev - x.a.rev,
      sla: (x, y) => x.d.slaPct - y.d.slaPct,
      cancel: (x, y) => y.d.cancelRate - x.d.cancelRate,
      delivery: (x, y) => y.d.avgTotal - x.d.avgTotal
    };
    rows.sort(sorters[storeSort] || sorters.orders);
    const nStores = rows.length || 1;
    const aggAll = ctx.k, dAll = ctx.d;
    const totEmp = rows.reduce((z, r) => z + DB.stores[r.sid].pickers + DB.stores[r.sid].packers + DB.stores[r.sid].staff, 0) || 1;

    el('page-stores').innerHTML =
      '<div class="sec-title" style="margin-top:0">🏪 Dark Store League Table — ' + nStores + ' stores in scope</div>' +
      A.kpiGrid([
        A.kpiHTML({ label: 'Orders / Store', cur: aggAll.n / nStores, fmt: v => fx(v, 0), color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Revenue / Store', cur: aggAll.rev / nStores, fmt: fmtM, color: 'var(--vio)' }),
        A.kpiHTML({ label: 'Avg Delivery Time', cur: dAll.avgTotal, fmt: fmtMin, invert: true, target: 15, ach: 100 * 15 / Math.max(.01, dAll.avgTotal), color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Avg Picking', cur: dAll.avgPick, fmt: fmtMin, invert: true, color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Avg Packing', cur: dAll.avgPack, fmt: fmtMin, invert: true, color: 'var(--vio)' }),
        A.kpiHTML({ label: 'Cancellation', cur: dAll.cancelRate, fmt: pct1, invert: true, color: 'var(--amber)' }),
        A.kpiHTML({ label: 'SLA Compliance', cur: dAll.slaPct, fmt: pct1, target: 90, ach: dAll.slaPct / 90 * 100, color: 'var(--green)' }),
        A.kpiHTML({ label: 'Orders / Employee', cur: totEmp ? aggAll.n / totEmp : 0, fmt: v => fx(v, 1), color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Orders / Store / Hr', cur: aggAll.n / nStores / (ctx.len * 24), fmt: v => fx(v, 2), color: 'var(--acc2)' })
      ]) +
      '<div class="grid g32">' +
      '<div class="panel"><h3>Store health distribution</h3><div class="psub">Healthy: SLA≥90 & cancel≤7 · Watch: SLA≥82 · else Critical</div><div class="chart-wrap" style="height:250px"><canvas id="stHealth"></canvas></div></div>' +
      '<div class="panel"><h3>Top 10 stores by volume · vs their SLA</h3><div class="psub">volume leadership ≠ service quality</div><div class="chart-wrap" style="height:250px"><canvas id="stTop"></canvas></div></div>' +
      '</div>' +
      '<div class="panel"><div class="flex between" style="flex-wrap:wrap;gap:10px;margin-bottom:10px">' +
      '<div><h3>Ranked store performance</h3><div class="psub">click a store row to open its full drill-down drawer (City → Zone → Store → Orders)</div></div>' +
      '<div class="pill-select" id="stSort">' +
      ['orders', 'revenue', 'sla', 'cancel', 'delivery'].map(s => '<button data-s="' + s + '" class="' + (storeSort === s ? 'on' : '') + '">' + { orders: 'Orders', revenue: 'Revenue', sla: 'Worst SLA', cancel: 'Cancel %', delivery: 'Slowest' }[s] + '</button>').join('') +
      '</div></div>' +
      '<div class="tscroll"><table class="tbl"><thead><tr>' +
      '<th>#</th><th>Store</th><th>City</th><th class="num">Orders</th><th class="num">Revenue</th><th class="num">AOV</th><th class="num">Pick</th><th class="num">Delivery</th><th class="num">SLA %</th><th class="num">Cancel %</th><th class="num">Stock-out %</th><th class="num">Complaint %</th><th>Status</th></tr></thead><tbody>' +
      rows.map((r, i) => {
        const s = DB.stores[r.sid], d = r.d;
        const so = ctx.soByStore.get(r.sid) || 0, soR = 100 * so / Math.max(1, ctx.len);
        const cmpR = d.compRate;
        const st = A.storeStatus(d, r.a, ctx);
        return '<tr class="clickable" data-sid="' + r.sid + '">' +
          '<td><span class="rank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span></td>' +
          '<td><b style="color:var(--acc)">' + s.code + '</b> · ' + s.label + '</td>' +
          '<td class="muted">' + DB.cities[s.city].name + ' · ' + DB.cities[s.city].zones[s.zone] + '</td>' +
          '<td class="num">' + fmtN(r.a.n) + '</td><td class="num">' + fmtM(r.a.rev) + '</td><td class="num">₹' + fmtN(d.aov) + '</td>' +
          '<td class="num"' + (d.avgPick > dAll.avgPick * 1.3 ? ' style="color:var(--amber);font-weight:700"' : '') + '>' + fx(d.avgPick, 1) + '</td>' +
          '<td class="num">' + fx(d.avgTotal, 1) + '</td>' +
          '<td class="num"><div class="flex" style="gap:8px"><div class="meter"><i style="width:' + Math.min(100, d.slaPct) + '%;background:' + (d.slaPct >= 90 ? 'var(--green)' : d.slaPct >= 82 ? 'var(--amber)' : 'var(--red)') + '"></i></div>' + pct1(d.slaPct) + '</div></td>' +
          '<td class="num"' + (d.cancelRate > 7 ? ' style="color:var(--red);font-weight:700"' : '') + '>' + pct1(d.cancelRate) + '</td>' +
          '<td class="num"' + (soR > 3 ? ' style="color:var(--red)"' : '') + '>' + pct1(isFinite(soR) ? soR : 0) + '</td>' +
          '<td class="num">' + pct1(cmpR) + '</td>' +
          '<td><span class="status-pill st-' + st.toLowerCase() + '">' + st + '</span></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    el('stSort').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { storeSort = b.dataset.s; A.render(); }));
    el('page-stores').querySelectorAll('tr[data-sid]').forEach(tr => tr.addEventListener('click', () => A.openStore(+tr.dataset.sid)));

    const hc = { Healthy: 0, Watch: 0, Critical: 0 };
    rows.forEach(r => { hc[A.storeStatus(r.d, r.a, ctx)]++; });
    CH.dough('stHealth', Object.keys(hc), Object.values(hc), { colors: ['#2fd48a', '#fbbf24', '#ff5d7e'], center: [nStores, 'stores'] });
    const top = rows.slice(0, 10);
    CH.bar('stTop', top.map(r => DB.stores[r.sid].code), [
      { label: 'Orders', data: top.map(r => r.a.n), backgroundColor: '#a94df5' },
      { label: 'SLA %', data: top.map(r => fx(r.d.slaPct, 1)), backgroundColor: '#ff4d9e', yAxisID: 'y2' }
    ], { y2: true, y2Fmt: v => v + '%', xRot: 35 });
  };
})();
