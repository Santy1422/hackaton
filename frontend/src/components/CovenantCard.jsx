import { eurK, COLORS } from '../altis/format'

/** Semi-circular covenant headroom gauge (SVG). Threshold viene del backend;
 *  la escala del arco se deriva del piso real (no hay números mágicos). */
function CovenantArc({ headroom, status, threshold, size = 180 }) {
  // headroom = cumulative − threshold; el arco va del piso (0%) a 3× su magnitud.
  const max = Math.abs(threshold || 0) * 3
  const span = max - threshold || 1
  const pct = Math.max(0, Math.min(1, (headroom - threshold) / span))
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2
  const arc = (ang) => [cx + r * Math.cos(ang), cy - r * Math.sin(ang)]
  const a0 = Math.PI
  const a = a0 + (0 - a0) * pct
  const [sx, sy] = arc(a0)
  const [ex, ey] = arc(0)
  const [px, py] = arc(a)
  const color = status === 'BREACH' ? COLORS.copper : status === 'WATCH' ? COLORS.amber : COLORS.green
  return (
    <svg viewBox={`0 0 ${size} ${size / 1.7}`} width="100%" style={{ maxWidth: 200 }}>
      <path d={`M${sx} ${sy} A${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" stroke={COLORS.grid} strokeWidth="9" strokeLinecap="round" />
      <path d={`M${sx} ${sy} A${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${px} ${py}`} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
    </svg>
  )
}

export default function CovenantCard({ headroom, status, threshold, big }) {
  const s = (status || 'SAFE').toLowerCase()
  return (
    <div className={'cov ' + s}>
      <CovenantArc headroom={headroom} status={status} threshold={threshold} size={big ? 220 : 180} />
      <div className="cov-v">
        {eurK(headroom)}
        <span>headroom above {eurK(threshold)} floor</span>
      </div>
      <div className={'cov-badge ' + s}>{status}</div>
    </div>
  )
}
