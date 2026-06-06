import { useMemo } from 'react'
import { useApi } from '../hooks/useForecast'
import { mergeWeeks, statusFromWeeks } from './format'

/**
 * One scenario's 13 weeks in the design shape: real forecast drivers merged
 * with real weather (workable days / risk). Single source of truth per view.
 */
export function useScenarioWeeks(scenario) {
  const fc = useApi(`/forecast/${scenario}`, [scenario])
  const wx = useApi('/weather', [])

  const weeks = useMemo(
    () => mergeWeeks(fc.data?.weeks || [], wx.data?.weeks || []),
    [fc.data, wx.data]
  )
  const status = useMemo(() => statusFromWeeks(weeks), [weeks])

  return {
    weeks,
    totals: fc.data?.totals,
    status,
    weather: wx.data?.weeks || [],
    loading: fc.loading || wx.loading,
    error: fc.error || wx.error,
  }
}
