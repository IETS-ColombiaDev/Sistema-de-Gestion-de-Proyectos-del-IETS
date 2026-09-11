/**
 * Limite de error de React.
 *
 * Sin esto, cualquier excepcion durante el render deja la pantalla en blanco y
 * el usuario sin salida. Aqui se contiene el fallo, se muestra que ocurrio y se
 * ofrecen dos rutas de recuperacion: reintentar el render o volver al inicio.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import Button from './Button'
import Card from './Card'
import { IconError, IconRefrescar } from './icons'

interface Props {
  children: ReactNode
  /** Etiqueta del modulo, para orientar el diagnostico. */
  ambito?: string
}

interface Estado {
  error: Error | null
  detalle: string
}

export default class LimiteError extends Component<Props, Estado> {
  state: Estado = { error: null, detalle: '' }

  static getDerivedStateFromError(error: Error): Partial<Estado> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // En produccion este punto es donde se envia el error al monitoreo del cliente.
    console.error(`[HIGEP] Error no controlado${this.props.ambito ? ` en ${this.props.ambito}` : ''}:`, error, info)
    this.setState({ detalle: info.componentStack ?? '' })
  }

  private reintentar = () => this.setState({ error: null, detalle: '' })

  render(): ReactNode {
    const { error, detalle } = this.state
    if (!error) return this.props.children

    return (
      <div className="hg-contenido">
        <Card>
          <div className="hg-vacio" role="alert">
            <span className="hg-vacio__icono" style={{ background: '#FEE2E2', color: '#EF4444' }}>
              <IconError size={24} />
            </span>
            <span className="hg-vacio__titulo">No fue posible mostrar esta pantalla</span>
            <span className="hg-vacio__texto">
              Se produjo un error inesperado
              {this.props.ambito ? ` en ${this.props.ambito}` : ''}. Sus datos no se perdieron: ninguna
              escritura queda a medias, porque el sistema guarda cada cambio de forma completa o no lo guarda.
            </span>
            <p
              className="hg-t-xs hg-t-mono"
              style={{
                marginTop: 'var(--sp-sm)',
                padding: 'var(--sp-sm)',
                background: 'var(--c-bg-hover)',
                borderRadius: 'var(--r-base)',
                maxWidth: '100%',
                overflowX: 'auto',
                textAlign: 'left',
                color: 'var(--c-text-2)',
              }}
            >
              {error.message}
            </p>
            <div className="hg-fila" style={{ marginTop: 'var(--sp-md)', justifyContent: 'center' }}>
              <Button variante="secondary" icono={<IconRefrescar size={15} />} onClick={this.reintentar}>
                Reintentar
              </Button>
              <Button
                variante="primary"
                onClick={() => {
                  window.location.href = '/portafolio'
                }}
              >
                Volver al portafolio
              </Button>
            </div>
            {import.meta.env.DEV && detalle && (
              <details style={{ marginTop: 'var(--sp-md)', textAlign: 'left', maxWidth: '100%' }}>
                <summary className="hg-t-xs hg-t-sec" style={{ cursor: 'pointer' }}>
                  Detalle tecnico (solo en desarrollo)
                </summary>
                <pre
                  className="hg-t-xs hg-t-mono"
                  style={{ overflowX: 'auto', color: 'var(--c-text-2)', whiteSpace: 'pre-wrap' }}
                >
                  {detalle}
                </pre>
              </details>
            )}
          </div>
        </Card>
      </div>
    )
  }
}
