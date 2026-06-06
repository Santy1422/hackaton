import { Component } from 'react'

/**
 * Atrapa errores de render para que un fallo en una vista no deje la pantalla
 * en blanco. Muestra un fallback con la marca y opción de recargar.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Deja rastro en consola para depurar; en prod iría a un logger.
    console.error('Render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="errb">
        <span className="tb-mark" />
        <h1>Something went wrong</h1>
        <p>
          The view hit an unexpected error. Your data is safe — reload to try again.
        </p>
        <pre className="errb-msg">{String(this.state.error?.message || this.state.error)}</pre>
        <button className="onb-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
