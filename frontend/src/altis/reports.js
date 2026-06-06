/* ============================================================================
   Weekly & monthly cash-flow reports, downloaded as a self-explaining PDF.
   Pulls REAL data (forecast + covenant + weather, all 3 scenarios) and renders
   summary · covenant · 13-week detail · drivers · scenario comparison ·
   methodology + audit trail. Uses html2pdf.
   ============================================================================ */
import html2pdf from 'html2pdf.js'
import { apiGet, apiPost } from '../api'
import {
  DRIVERS,
  DRIVER_COLORS,
  SCENARIOS,
  SCENARIO_KEYS,
  eur,
  eurK,
  signed,
  mergeWeeks,
  sumKey,
} from './format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthLabelFromDate(ds) {
  const d = new Date(ds)
  if (isNaN(d)) return null
  return MONTHS[d.getMonth()] + ' ' + d.getFullYear()
}

function reportStyles() {
  return `
  #rpt { width: 794px; background:#fff; color:#1C2530; font-family:'Archivo',system-ui,sans-serif; font-variant-numeric:tabular-nums; }
  #rpt * { box-sizing:border-box; }
  #rpt .mono { font-family:'Spline Sans Mono',ui-monospace,monospace; }
  #rpt .pos { color:#2F6B57; } #rpt .neg { color:#C0552E; }
  #rpt .pg { padding:0 46px; }
  #rpt .band { background:#1C2530; color:#fff; padding:30px 46px 26px; display:flex; justify-content:space-between; align-items:flex-end; }
  #rpt .band .mk { display:flex; align-items:center; gap:12px; }
  #rpt .band .roof { width:28px; height:28px; background:#C0552E; clip-path:polygon(50% 0,100% 48%,84% 48%,84% 100%,16% 100%,16% 48%,0 48%); }
  #rpt .band .bn { font-weight:800; font-size:16px; letter-spacing:.02em; } #rpt .band .bn span { color:#8ea1b3; font-weight:500; }
  #rpt .band h1 { font-size:23px; font-weight:800; margin:12px 0 3px; }
  #rpt .band .meta { font-family:'Spline Sans Mono',monospace; font-size:10.5px; color:#8ea1b3; letter-spacing:.04em; }
  #rpt .band .rt { text-align:right; }
  #rpt .band .rt .lab { font-family:'Spline Sans Mono',monospace; font-size:9.5px; letter-spacing:.12em; color:#8ea1b3; }
  #rpt .band .rt .scn { font-size:18px; font-weight:700; margin-top:3px; }
  #rpt h2 { font-size:15px; font-weight:800; margin:26px 0 4px; padding-bottom:7px; border-bottom:2px solid #1C2530; display:flex; align-items:baseline; justify-content:space-between; }
  #rpt h2 .h2x { font-family:'Spline Sans Mono',monospace; font-size:9.5px; font-weight:500; letter-spacing:.1em; color:#8A95A0; }
  #rpt p.lead { font-size:12px; line-height:1.6; color:#41505d; margin:10px 0; }
  #rpt p.lead b { color:#1C2530; }
  #rpt .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:12px 0; }
  #rpt .kpi { border:1px solid #E6E0D4; border-left:4px solid #1C2530; border-radius:9px; padding:11px 13px; }
  #rpt .kpi.g { border-left-color:#2F6B57; } #rpt .kpi.c { border-left-color:#C0552E; } #rpt .kpi.a { border-left-color:#C8893A; }
  #rpt .kpi .l { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#5D6B78; }
  #rpt .kpi .v { font-family:'Spline Sans Mono',monospace; font-size:19px; font-weight:600; margin-top:5px; }
  #rpt .kpi .s { font-size:9.5px; color:#8A95A0; margin-top:2px; }
  #rpt .cov { display:flex; gap:16px; align-items:center; border:1px solid #E6E0D4; border-radius:11px; padding:16px; margin:12px 0; }
  #rpt .cov .badge { font-weight:800; font-size:13px; letter-spacing:.1em; padding:9px 16px; border-radius:8px; color:#fff; }
  #rpt .cov .badge.safe { background:#2F6B57; } #rpt .cov .badge.watch { background:#C8893A; } #rpt .cov .badge.breach { background:#C0552E; }
  #rpt .cov .txt { font-size:11.5px; line-height:1.55; color:#41505d; } #rpt .cov .txt b { color:#1C2530; }
  #rpt table { width:100%; border-collapse:collapse; font-size:10.5px; margin:10px 0; }
  #rpt th { text-align:right; font-family:'Spline Sans Mono',monospace; font-size:8.5px; letter-spacing:.04em; text-transform:uppercase; color:#8A95A0; font-weight:500; padding:0 8px 7px; border-bottom:1px solid #E6E0D4; }
  #rpt th:first-child, #rpt td:first-child { text-align:left; }
  #rpt td { text-align:right; padding:6px 8px; border-bottom:1px solid #F0ECE3; font-family:'Spline Sans Mono',monospace; }
  #rpt tr.tot td { border-top:2px solid #1C2530; border-bottom:0; font-weight:700; padding-top:8px; }
  #rpt .wbadge { display:inline-block; padding:1px 7px; border-radius:999px; font-size:8.5px; font-weight:600; }
  #rpt .wbadge.high { background:#F7E2DA; color:#C0552E; } #rpt .wbadge.medium { background:#F6ECD9; color:#C8893A; } #rpt .wbadge.low { background:#E2EDE7; color:#2F6B57; }
  #rpt .drv { display:grid; grid-template-columns:150px 90px 1fr; gap:12px; align-items:center; padding:9px 0; border-bottom:1px solid #F0ECE3; }
  #rpt .drv .dn { font-size:12px; font-weight:700; display:flex; align-items:center; gap:7px; } #rpt .drv .dn i { width:9px; height:9px; border-radius:3px; }
  #rpt .drv .dv { font-family:'Spline Sans Mono',monospace; font-size:14px; font-weight:600; text-align:right; }
  #rpt .drv .dd { font-size:10.5px; color:#5D6B78; line-height:1.45; }
  #rpt .scn-tbl td .pill { font-family:'Archivo'; font-weight:700; font-size:9.5px; padding:2px 8px; border-radius:999px; }
  #rpt .foot { margin-top:24px; border-top:1px solid #E6E0D4; padding:14px 0 30px; font-family:'Spline Sans Mono',monospace; font-size:9px; color:#8A95A0; line-height:1.6; } #rpt .foot b { color:#5D6B78; }
  #rpt .bars { display:flex; align-items:stretch; gap:3px; height:96px; margin:12px 0 6px; padding-top:4px; }
  #rpt .barcol { flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; }
  #rpt .barlbl { font-family:'Spline Sans Mono',monospace; font-size:7.5px; color:#8A95A0; margin-top:3px; }
  `
}

function buildReport(kind, scenario, packs, narrative = {}, meta = {}) {
  const cur = packs[scenario]
  const W = cur.weeks
  const sLabel = SCENARIOS[scenario].label
  const opcoLabel = meta.opcoCount ? `${meta.opcoCount} OPCOS` : 'CONSOLIDATED'
  const systemsLabel = meta.systems?.length ? meta.systems.join(' · ') : 'your accounting systems'
  const glLabel = meta.glMapped != null ? `${meta.glMapped} GL accounts mapped` : 'GL accounts mapped'
  const genDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const isWeekly = kind === 'weekly'
  const w13 = W[W.length - 1] || {}
  const totalNet = sumKey(W, 'net_cashflow')
  const lowWeek = W.reduce((m, w) => (w.cumulative_cf < m.cumulative_cf ? w : m), W[0] || {})
  const status = cur.status
  const finalHeadroom = cur.finalHeadroom
  const threshold = cur.threshold
  const floor = eurK(threshold)
  const statusClass = status.toLowerCase()
  const first = W[0]?.week_start
  const last = w13.week_start
  const range = first && last ? `${first} – ${last}` : `13-WEEK HORIZON`

  // Prosa redactada por Claude (sobre datos reales) con fallback determinista.
  const execText =
    narrative.executive_summary ||
    `Over the next 13 weeks the portfolio is projected to ${totalNet >= 0 ? 'generate' : 'consume'} ${signed(totalNet)} of net cash, ending at ${eur(w13.cumulative_cf)}. Materials and subcontractors are paid ahead of collections, so cash dips to a financed low of ${eur(lowWeek.cumulative_cf)} in week ${lowWeek.week} before recovering. Worst-case covenant headroom is ${eur(finalHeadroom)} — status ${status}.`
  const scnText =
    narrative.scenario_commentary ||
    'Weather changes when the firm bills and collects, not what it has already committed to pay. A wet quarter delays and shrinks collections; a dry quarter pulls them forward.'
  const covText = narrative.covenant_commentary || ''
  const risks = Array.isArray(narrative.risks) ? narrative.risks : []
  const reco = narrative.recommendation || ''
  const aiTag = narrative.source && !String(narrative.source).startsWith('fallback') ? ' · NARRATED BY CLAUDE' : ''

  const band = `<div class="band">
    <div>
      <div class="mk"><span class="roof"></span><span class="bn">ALTIS <span>FORECAST</span></span></div>
      <h1>${isWeekly ? 'Weekly Cash-Flow Report' : 'Monthly Cash-Flow Report'}</h1>
      <div class="meta">13-WEEK HORIZON · ${String(range).toUpperCase()} · CONSOLIDATED · ${opcoLabel}</div>
    </div>
    <div class="rt"><div class="lab">SCENARIO</div><div class="scn">${sLabel}</div><div class="meta" style="margin-top:8px">GENERATED ${genDate.toUpperCase()}</div></div>
  </div>`

  const summary = `<div class="pg">
    <h2>Executive summary <span class="h2x">WHAT THIS REPORT SAYS${aiTag}</span></h2>
    <p class="lead">${execText}</p>
    <div class="kpis">
      <div class="kpi"><div class="l">Ending cash · W13</div><div class="v">${eurK(w13.cumulative_cf)}</div><div class="s">cumulative 13-week</div></div>
      <div class="kpi g"><div class="l">Net · 13 weeks</div><div class="v ${totalNet >= 0 ? 'pos' : 'neg'}">${eurK(totalNet)}</div><div class="s">all drivers</div></div>
      <div class="kpi ${statusClass === 'safe' ? 'g' : statusClass === 'watch' ? 'a' : 'c'}"><div class="l">Covenant headroom</div><div class="v">${eurK(finalHeadroom)}</div><div class="s">worst case vs ${floor}</div></div>
      <div class="kpi ${statusClass === 'safe' ? 'g' : statusClass === 'watch' ? 'a' : 'c'}"><div class="l">Status</div><div class="v">${status}</div><div class="s">low in week ${lowWeek.week}</div></div>
    </div>
  </div>`

  const covenant = `<div class="pg">
    <h2>Covenant headroom <span class="h2x">DEFENSIBLE TO THE BANK</span></h2>
    <div class="cov">
      <div class="badge ${statusClass}">${status}</div>
      <div class="txt">The covenant requires cumulative cash to stay above <b>${eur(threshold)}</b> at all times across the 13-week horizon. The forecast low of <b>${eur(lowWeek.cumulative_cf)}</b> in <b>week ${lowWeek.week}</b> leaves <b class="${finalHeadroom < 0 ? 'neg' : 'pos'}">${eur(finalHeadroom)}</b> of headroom. ${status === 'BREACH' ? 'This <b>breaches</b> the covenant — the board should expect a waiver conversation or a draw on the revolver to bridge the trough.' : status === 'WATCH' ? 'This is <b>close to the floor</b> — flagged for monitoring; a single slipped milestone or a wet fortnight would tip it.' : 'This sits <b>comfortably clear</b> of the floor under current assumptions.'}</div>
    </div>
    ${covText ? `<p class="lead">${covText}</p>` : ''}
  </div>`

  let detail
  if (isWeekly) {
    detail = `<div class="pg">
      <h2>13-week detail <span class="h2x">WEEK BY WEEK · €</span></h2>
      <table>
        <thead><tr><th>Week</th><th>Collections</th><th>Materials</th><th>Subcon</th><th>Net</th><th>Cumulative</th><th>Wkbl</th><th style="text-align:right">Weather</th></tr></thead>
        <tbody>
          ${W.map((w) => `<tr>
            <td>W${w.week} · ${w.week_start || ''}</td>
            <td class="pos">${eurK(w.d4_customer_collection)}</td>
            <td class="neg">${eurK(w.d2_materials_outflow)}</td>
            <td class="neg">${eurK(w.d3_subcon_payment)}</td>
            <td class="${w.net_cashflow >= 0 ? 'pos' : 'neg'}">${eurK(w.net_cashflow)}</td>
            <td><b>${eurK(w.cumulative_cf)}</b></td>
            <td>${w.workable_days}</td>
            <td style="text-align:right"><span class="wbadge ${w.weather_risk}">${w.weather_risk}</span></td>
          </tr>`).join('')}
          <tr class="tot"><td>Total · 13w</td><td class="pos">${eurK(sumKey(W, 'd4_customer_collection'))}</td><td class="neg">${eurK(sumKey(W, 'd2_materials_outflow'))}</td><td class="neg">${eurK(sumKey(W, 'd3_subcon_payment'))}</td><td class="${totalNet >= 0 ? 'pos' : 'neg'}">${eurK(totalNet)}</td><td>${eurK(w13.cumulative_cf)}</td><td colspan="2"></td></tr>
        </tbody>
      </table>
    </div>`
  } else {
    const groups = {}
    W.forEach((w) => {
      const k = monthLabelFromDate(w.week_start) || `Period ${Math.ceil(w.week / 4)}`
      ;(groups[k] = groups[k] || { label: k, weeks: [] }).weeks.push(w)
    })
    const rows = Object.values(groups).map((g) => ({
      ...g,
      col: g.weeks.reduce((s, w) => s + w.d4_customer_collection, 0),
      mat: g.weeks.reduce((s, w) => s + w.d2_materials_outflow, 0),
      sub: g.weeks.reduce((s, w) => s + w.d3_subcon_payment, 0),
      net: g.weeks.reduce((s, w) => s + w.net_cashflow, 0),
      endCash: g.weeks[g.weeks.length - 1].cumulative_cf,
      wkbl: (g.weeks.reduce((s, w) => s + w.workable_days, 0) / g.weeks.length).toFixed(1),
    }))
    detail = `<div class="pg">
      <h2>Monthly roll-up <span class="h2x">${rows.length} PERIODS · €</span></h2>
      <table>
        <thead><tr><th>Month</th><th>Weeks</th><th>Collections</th><th>Materials</th><th>Subcon</th><th>Net</th><th>End cash</th><th>Avg wkbl</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <td><b>${r.label}</b></td><td>${r.weeks.length}</td>
            <td class="pos">${eurK(r.col)}</td><td class="neg">${eurK(r.mat)}</td><td class="neg">${eurK(r.sub)}</td>
            <td class="${r.net >= 0 ? 'pos' : 'neg'}">${eurK(r.net)}</td><td><b>${eurK(r.endCash)}</b></td><td>${r.wkbl}/5</td>
          </tr>`).join('')}
          <tr class="tot"><td>Total</td><td>${W.length}</td><td class="pos">${eurK(sumKey(W, 'd4_customer_collection'))}</td><td class="neg">${eurK(sumKey(W, 'd2_materials_outflow'))}</td><td class="neg">${eurK(sumKey(W, 'd3_subcon_payment'))}</td><td class="${totalNet >= 0 ? 'pos' : 'neg'}">${eurK(totalNet)}</td><td>${eurK(w13.cumulative_cf)}</td><td></td></tr>
        </tbody>
      </table>
    </div>`
  }

  const maxAbs = Math.max(1, ...W.map((w) => Math.abs(w.net_cashflow)))
  const bars = `<div class="pg">
    <p class="lead" style="margin-bottom:2px"><b>Net cash by week</b> — the financed trough is visible as the run of red columns before collections turn the line positive.</p>
    <div class="bars">${W.map((w) => {
      const h = Math.round((Math.abs(w.net_cashflow) / maxAbs) * 44)
      const up = w.net_cashflow >= 0
      return `<div class="barcol"><div style="height:48px;display:flex;align-items:flex-end;justify-content:center">${up ? `<div style="width:62%;height:${h}px;background:#2F6B57;border-radius:2px 2px 0 0"></div>` : ''}</div><div style="height:48px;display:flex;align-items:flex-start;justify-content:center">${!up ? `<div style="width:62%;height:${h}px;background:#C0552E;border-radius:0 0 2px 2px"></div>` : ''}</div><div class="barlbl">W${w.week}</div></div>`
    }).join('')}</div>
  </div>`

  const drivers = `<div class="pg">
    <h2>Cash drivers <span class="h2x">FIVE INDEPENDENT STREAMS · 13W TOTAL</span></h2>
    ${DRIVERS.map((d) => {
      const v = sumKey(W, d.key)
      return `<div class="drv"><div class="dn"><i style="background:${DRIVER_COLORS[d.key]}"></i>${d.label}</div><div class="dv ${d.kind === 'in' ? 'pos' : 'neg'}">${eurK(v)}</div><div class="dd">${d.desc}</div></div>`
    }).join('')}
  </div>`

  const scnRows = SCENARIO_KEYS.map((k) => {
    const p = packs[k]
    if (!p) return ''
    const lw = p.weeks.reduce((m, w) => (w.cumulative_cf < m.cumulative_cf ? w : m), p.weeks[0] || {})
    const sc = p.status.toLowerCase()
    const bg = sc === 'safe' ? '#E2EDE7' : sc === 'watch' ? '#F6ECD9' : '#F7E2DA'
    const fg = sc === 'safe' ? '#2F6B57' : sc === 'watch' ? '#C8893A' : '#C0552E'
    return `<tr${k === scenario ? ' style="background:#FBF9F4"' : ''}>
      <td><b>${SCENARIOS[k].label}</b>${k === scenario ? ' ·' : ''}</td>
      <td>${eurK(p.weeks[p.weeks.length - 1]?.cumulative_cf)}</td>
      <td class="${lw.cumulative_cf < 0 ? 'neg' : ''}">${eurK(lw.cumulative_cf)} · W${lw.week}</td>
      <td class="${p.finalHeadroom < 0 ? 'neg' : 'pos'}">${eurK(p.finalHeadroom)}</td>
      <td style="text-align:right"><span class="pill" style="background:${bg};color:${fg}">${p.status}</span></td>
    </tr>`
  }).join('')
  const scenarios = `<div class="pg">
    <h2>Scenario comparison <span class="h2x">BASE · WET QUARTER · DRY QUARTER</span></h2>
    <p class="lead">${scnText}</p>
    <table class="scn-tbl">
      <thead><tr><th>Scenario</th><th>Ending cash</th><th>Low point</th><th>Headroom</th><th style="text-align:right">Status</th></tr></thead>
      <tbody>${scnRows}</tbody>
    </table>
  </div>`

  const outlook =
    risks.length || reco
      ? `<div class="pg">
    <h2>Risks &amp; recommendation <span class="h2x">${aiTag ? 'CLAUDE' : 'TREASURY'} ASSESSMENT</span></h2>
    ${risks.length ? `<ul style="margin:8px 0 4px 18px">${risks.map((r) => `<li class="lead" style="margin:4px 0">${r}</li>`).join('')}</ul>` : ''}
    ${reco ? `<p class="lead"><b>Recommendation —</b> ${reco}</p>` : ''}
  </div>`
      : ''

  const foot = `<div class="pg"><div class="foot">
    <b>METHODOLOGY</b> — Drivers: M1 milestone billing (seasonal index × run-rate × scenario, gated by workable days) · M2 materials (OLS lag on billing) · M3 subcontractors (≈20% on net terms) · M4 collections (billing shifted by DSO) · M5 weather (rain&gt;15mm / freeze / wind&gt;Bft6 defer cash).<br/>
    <b>DATA FOUNDATION</b> — Transactions reconciled from ${systemsLabel} into one schema; ${glLabel} (controller-reviewed). Single source of truth: <b>forecast_13w</b>. Every figure traces back to its drivers, assumptions and source rows via the dashboard audit trail.<br/>
    <b>NOTE</b> — Anonymised demo data, hackathon use only. Generated ${genDate}.
  </div></div>`

  return `<div id="rpt">${band}${summary}${covenant}${detail}${bars}${drivers}<div class="html2pdf__page-break"></div>${scenarios}${outlook}${foot}</div>`
}

let BUSY = false

/** Fetch real data for all scenarios, build the report, download as PDF. */
export async function generateReport(kind, scenario) {
  if (BUSY) return
  BUSY = true
  try {
    const weather = (await apiGet('/weather').catch(() => ({ weeks: [] }))).weeks || []
    const packs = {}
    await Promise.all(
      SCENARIO_KEYS.map(async (k) => {
        try {
          // forecast = drivers/weeks · covenant = status/headroom/threshold (autoridad)
          const [fc, cov] = await Promise.all([apiGet(`/forecast/${k}`), apiGet(`/covenant/${k}`)])
          packs[k] = {
            weeks: mergeWeeks(fc.weeks || [], weather),
            status: cov.summary?.status,
            finalHeadroom: cov.summary?.final_headroom,
            threshold: cov.covenant_threshold,
          }
        } catch {
          /* skip a scenario that fails */
        }
      })
    )
    if (!packs[scenario]) throw new Error('No forecast data available')

    // Narrativa redactada por Claude sobre datos reales de la DB (best-effort).
    let narrative = {}
    try {
      const res = await apiPost('/reports/narrative', { scenario, kind })
      narrative = res?.narrative || {}
    } catch {
      /* sin narrativa → buildReport usa el fallback templado */
    }

    // Metadata real (sistemas, opcos, GL) — sin hardcode en el documento.
    const [sources, opcos] = await Promise.all([
      apiGet('/sources').catch(() => null),
      apiGet('/opcos').catch(() => null),
    ])
    const meta = {
      opcoCount: opcos?.opcos?.length,
      systems: sources?.systems?.map((s) => s.system) || [],
      glMapped: sources?.gl_accounts_mapped,
    }

    const style = document.createElement('style')
    style.textContent = reportStyles()
    document.head.appendChild(style)
    const holder = document.createElement('div')
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;'
    holder.innerHTML = buildReport(kind, scenario, packs, narrative, meta)
    document.body.appendChild(holder)
    const fname = `Altis-${kind === 'weekly' ? 'Weekly' : 'Monthly'}-CashFlow-${SCENARIOS[scenario].label.replace(/\s/g, '')}.pdf`

    await html2pdf()
      .set({
        margin: 0,
        filename: fname,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(holder.firstChild)
      .save()
    holder.remove()
    style.remove()
  } finally {
    BUSY = false
  }
}

