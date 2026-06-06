import { useEffect, useState } from 'react'
import { apiGet } from '../api'

/** Hook genérico de fetch a la API. */
export function useApi(path, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    setLoading(true)
    setError(null)
    apiGet(path)
      .then((d) => on && setData(d))
      .catch((e) => on && setError(e.message))
      .finally(() => on && setLoading(false))
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading }
}

export const useForecast = (scenario) =>
  useApi(`/forecast/${scenario}`, [scenario])

export const useForecastOpco = (scenario, opco) =>
  useApi(`/forecast/${scenario}/${opco}`, [scenario, opco])

export const useCovenant = (scenario) =>
  useApi(`/covenant/${scenario}`, [scenario])

export const useStats = () => useApi('/stats', [])
