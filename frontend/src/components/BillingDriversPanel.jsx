import { useApi } from '../hooks/useForecast'
import { eur } from '../altis/format'
import { Panel, Skeleton } from './primitives'

/**
 * Conecta /api/insights/billing-drivers: el hallazgo empírico de que el clima NO
 * mueve el billing (R²≈0.014) — lo mueve la concentración de proyectos grandes.
 * Refuerza la honestidad de la señal de clima ante el jurado.
 */
export default function BillingDriversPanel() {
  const { data, loading, error } = useApi('/insights/billing-drivers', [])

  if (error) return null // panel opcional: si falla, no estorba la vista
  if (loading) return <Panel title="Why billing moves"><Skeleton height={120} /></Panel>
  if (!data) return null

  const wc = data.weather_correlation || {}
  const cats = data.project_categories || {}
  const rec = cats.recurring_contracts
  const lrg = cats.large_projects
  const churn = (data.projects_churned || []).slice(0, 4)

  return (
    <Panel title="Why billing moves" hint="empirical — not assumed">
      <p className="panel-sub">{data.finding?.headline}</p>

      <div className="bd-grid">
        <div className="bd-stat">
          <div className="bd-k">Weather → billing</div>
          <div className="bd-v">R² {wc.r_squared ?? '—'}</div>
          <div className="bd-sub">{wc.verdict} · {wc.sample_months}m</div>
        </div>
        {rec && (
          <div className="bd-stat">
            <div className="bd-k">Recurring (10xxx)</div>
            <div className="bd-v pos">{rec.trend}</div>
            <div className="bd-sub">{rec.insight}</div>
          </div>
        )}
        {lrg && (
          <div className="bd-stat">
            <div className="bd-k">Large projects (58/59xxx)</div>
            <div className="bd-v neg">{lrg.trend}</div>
            <div className="bd-sub">{lrg.insight}</div>
          </div>
        )}
      </div>

      {churn.length > 0 && (
        <table className="bd-table">
          <thead>
            <tr><th>Project</th><th>2023</th><th>2024</th><th>Δ</th><th>Status</th></tr>
          </thead>
          <tbody>
            {churn.map((p) => (
              <tr key={p.project}>
                <td>{p.project}</td>
                <td>{eur(p.revenue_2023)}</td>
                <td>{eur(p.revenue_2024)}</td>
                <td className="neg">{eur(p.drop_eur)}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
