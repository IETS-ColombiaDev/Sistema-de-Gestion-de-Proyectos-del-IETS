/**
 * Tarjeta de metrica (guia 6.5): etiqueta en mayusculas discreta, valor grande,
 * hover con translateY(-2px) y sombra md.
 */

import type { ReactNode } from 'react'

interface Props {
  etiqueta: string
  valor: ReactNode
  pie?: ReactNode
  color?: string
  /** Franja de acento a la izquierda para agrupar visualmente. */
  acento?: string
  onClick?: () => void
  titulo?: string
}

export default function KPICard({ etiqueta, valor, pie, color, acento, onClick, titulo }: Props) {
  const contenido = (
    <>
      <span className="hg-kpi__label">{etiqueta}</span>
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
