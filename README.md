# ⚡ Zepto Ops 360° — Operations Director Command Center (Demo)

A portfolio/demo project: a fully client-side, executive-grade **Operations Control Tower**
for quick-commerce operations, in the style of a premium Power BI command center.

> **100% synthetic data.** The ~118,000 order-level records and all supporting datasets are
> **generated locally in the browser** with a seeded random generator (identical on every load).
> This is *not* real Zepto internal data. No real customer names, phone numbers or addresses exist
> anywhere in the project.

## ▶ How to run

No backend, no build step:

1. Open `index.html` directly in any modern browser, **or**
2. Serve the folder: `python3 -m http.server 8000` → http://localhost:8000

Everything is local — the app works fully offline (`file://` safe).

## 📁 Files

| File | Purpose |
|---|---|
| `index.html` | App shell — sidebar, filter bar, 16 page containers |
| `style.css` | Executive dark/light theme |
| `data.js` | Deterministic synthetic-data engine (orders, stores, riders, SKUs, stock-outs, complaints…) |
| `charts.js` | Theme-aware Chart.js wrapper + HTML heatmap builder |
| `script.js` | App core: state, global filters, aggregation engine, alert/insight engines, drill-downs |
| `export.js` | Export engine: CSV exports + zero-library multi-sheet .xlsx writer |
| `pages1.js` | Executive Overview · Live Operations · City Control Tower · Store Performance |
| `pages2.js` | SLA & Delivery · Delay Root Causes · Rider Performance · Inventory & Stock-outs |
| `pages3.js` | Customer Experience · Cancellations & Refunds · Workforce & Capacity · Peak Hours |
| `pages4.js` | Financial Efficiency · Exceptions Center · Director Insights · Action Center |
| `pages5.js` | Download Center (per-dataset CSV/Excel + full multi-sheet workbook) |
| `chart.umd.min.js` | Chart.js v4 (vendored locally for offline use) |
| `tools/bundle.js` | Builds `zepto-ops-360-standalone.html` (fully self-contained single file) |

## 🧭 What's inside (16 views)

- **Executive Overview** — "What needs my attention today?" panel + 23 executive KPIs
  (current vs previous period, targets, achievement) + trends
- **Live Operations** — simulated control-tower snapshot, order pipeline funnel, hourly demand
- **City Control Tower** — city cards that cross-filter the whole dashboard
- **Store Performance** — 72 dark stores, ranked table, Healthy/Watch/Critical, drill-down drawer
- **SLA & Delivery** — stage-wise journey analytics (avg/median/P90/P95), SLA buckets & trends
- **Delay Root Causes** — Pareto of 14 delay reasons, impact quantification, City→Store→Order drill
- **Rider Performance** — supply vs demand by hour, utilization, ranking, distribution
- **Inventory & Stock-outs** — availability, lost sales, SKU offenders, store×category heatmap
- **Customer Experience** — complaints anatomy, "ops → CX" correlation
- **Cancellations & Refunds** — cancellation funnel, root causes, refund costs
- **Workforce & Capacity** — pickers/packers/riders vs demand, understaffed stores
- **Peak Hour Analysis** — Day × Hour heatmaps (orders / delivery time / breaches / breach %)
- **Financial Efficiency** — GMV→contribution waterfall, cost per order, city P&L
- **Exceptions Center** — rule engine flagging SLA/cancellation/stock-out/rider/capacity breaches
- **Director Insights** — auto-generated narrative analysis with computed numbers
- **Action Center** — prioritized problem → root cause → impact → action → owner cards

## 🎛 Global filters

Date presets (Today → Last 3 Months + custom range), City, Zone, Dark Store, Order Status,
Product Category, Customer Type, Payment Method, Delivery SLA bucket, Hour, Day of Week — plus
one-click **Reset**. All pages, alerts, insights and actions recompute instantly.

## 🔢 Data realism modelled in

- Diwali/Holi/NYE demand spikes, weekend uplift, monsoon rain days (Jun–Sep)
- Morning (8–11) and evening (18–22) demand peaks; evening traffic slowdown
- Store performance tiers, chronically rider-short stores, understaffed days
- Rider rostering with shifts; riders wait at stores when packing lags
- Stock-out events per store×category×day feeding OOS cancellations and lost-sales estimates
- Delay root causes assigned from whichever pipeline stage actually blew its budget

Generated with a fixed seed — the same "company" appears on every load.
