// Iconos SVG (estilo Lucide, stroke 1.5, currentColor). Sin emojis.
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const Svg = ({ size, children, ...p }) => (
  <svg {...base} {...(size ? { width: size, height: size } : {})} {...p}>
    {children}
  </svg>
)

export const IconBuilding = (p) => (
  <Svg {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
    <path d="M19 21V11a1 1 0 0 0-1-1h-3" />
    <path d="M9 7h2M9 11h2M9 15h2" />
  </Svg>
)

export const IconTrending = (p) => (
  <Svg {...p}>
    <path d="M3 17l6-6 4 4 7-7" />
    <path d="M14 7h5v5" />
  </Svg>
)

export const IconLayers = (p) => (
  <Svg {...p}>
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </Svg>
)

export const IconHardHat = (p) => (
  <Svg {...p}>
    <path d="M2 18h20" />
    <path d="M4 18v-2a8 8 0 0 1 16 0v2" />
    <path d="M10 6a2 2 0 0 1 4 0v4" />
    <path d="M8 10V7M16 10V7" />
  </Svg>
)

export const IconShield = (p) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)

export const IconRain = (p) => (
  <Svg {...p}>
    <path d="M7 16a4 4 0 0 1-.8-7.9 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 16" />
    <path d="M8 19v2M12 19v2M16 19v2" />
  </Svg>
)

export const IconDrought = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="11" r="3.2" />
    <path d="M12 2v2M19 11h2M3 11h2M17 6l1.4-1.4M5.6 4.6 7 6" />
    <path d="M9 18h6l-1 4h-4l-1-4Z" />
  </Svg>
)

export const IconWind = (p) => (
  <Svg {...p}>
    <path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5" />
    <path d="M3 16h13a2.5 2.5 0 1 1-2.5 2.5" />
    <path d="M3 12h7" />
  </Svg>
)

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
)

export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

export const IconArrowUp = (p) => (
  <Svg {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
)

export const IconArrowDown = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </Svg>
)

export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
)

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const IconFileSearch = (p) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7" />
    <path d="M14 2v6h6" />
    <circle cx="16" cy="16" r="3" />
    <path d="m20.5 20.5-1.4-1.4" />
  </Svg>
)

export const IconWallet = (p) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z" />
    <path d="M16 13h.01" />
  </Svg>
)

export const IconBox = (p) => (
  <Svg {...p}>
    <path d="m21 8-9-5-9 5v8l9 5 9-5V8Z" />
    <path d="m3 8 9 5 9-5M12 13v8" />
  </Svg>
)

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)

export const IconChevronRight = (p) => (
  <Svg {...p}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
)

// Mapa rol → icono (para el shell del dashboard).
// eslint-disable-next-line react-refresh/only-export-components
export const ROLE_ICON = {
  pe_board: IconShield,
  cfo: IconTrending,
  opco_md: IconLayers,
  project_lead: IconHardHat,
}

// Mapa escenario → icono.
// eslint-disable-next-line react-refresh/only-export-components
export const SCENARIO_ICON = {
  base: IconSun,
  wet_qtr: IconRain,
  dry_qtr: IconDrought,
}
