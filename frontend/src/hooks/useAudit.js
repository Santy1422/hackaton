import { useApi } from './useForecast'

/** Audit trail de una semana — alimenta el DrillDown. */
export const useAudit = (scenario, week) =>
  useApi(`/audit/week/${scenario}/${week}`, [scenario, week])
