/**
 * Tarjeta de metrica (guia 6.5): etiqueta en mayusculas discreta, valor grande,
 * hover con translateY(-2px) y sombra md.
 */

import type { ReactNode } from 'react'
import { Pista } from '../Ayuda'

interface Props {
  etiqueta: string
  valor: ReactNode
  pie?: ReactNode
  color?: string
  /** Franja de acento a la izquierda para agrupar visualmente. */
  acento?: string
  onClick?: () => void
  titulo?: string
  /**
   * Explicacion de como se obtiene la cifra. Se muestra en un tooltip que se
   * abre con el cursor y con el foco de teclado: una metrica sin definicion
   * invita a interpretarla mal.
   */
  pista?: string
}

export default function KPICard({
  etiqueta,
  valor,
  pie,
  color,
  acento,
  onClick,
  titulo,
  pista,
}: Props) {
  const contenido = (
    <>
      <span className="hg-kpi__label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {etiqueta}
        {pista && <Pista texto={pista} etiqueta={`Como se calcula: ${etiqueta}`} />}
      </span>
      <span className="hg-kpi__valor" style={color ? { color } : undefined}>
        {valor}
      </span>
      {pie && <span className="hg-kpi__pie">{pie}</span>}
    </>
  )

  const estilo = acento ? { borderLeft: `3px solid ${acento}` } : undefined

  if (onClick) {
    return (
      <button
        type="button"
        className="hg-kpi"
        style={{ ...estilo, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
        onClick={onClick}
        title={titulo}
      >
        {contenido}
      </button>
    )
  }
  return (
    <div className="hg-kpi" style={estilo} title={titulo}>
      {contenido}
    </div>
  )
}
