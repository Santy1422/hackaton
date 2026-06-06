import { useMemo } from 'react'
import { useApi } from '../hooks/useForecast'
import { mergeWeeks } from './format'

/**
 * One scenario's 13 weeks in the design shape: real forecast drivers merged
 * with real weather (workable days / risk). Covenant status/headroom NO se
 * calcula aquí — viene de /covenant (single source of truth).
 */
export function useScenarioWeeks(scenario) {
  const fc = useApi(`/forecast/${scenario}`, [scenario])
  const wx = useApi('/weather', [])

  const weeks = useMemo(
    () => mergeWeeks(fc.data?.weeks || [], wx.data?.weeks || []),
    [fc.data, wx.data]
  )

  return {
    weeks,
    totals: fc.data?.totals,
    weather: wx.data?.weeks || [],
    loading: fc.loading || wx.loading,
    error: fc.error || wx.error,
  }
}

/** Lista real de operating companies (data-driven, /api/opcos). */
export function useOpcos() {
  const { data, loading, error } = useApi('/opcos', [])
  return { opcos: data?.opcos || [], loading, error }
}
