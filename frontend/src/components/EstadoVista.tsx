/**
 * Estados vacio, de carga y de error (guia checklist 6): mensaje claro,
 * texto secundario, siempre con una salida. Nunca un callejon sin salida.
 */

import type { ReactNode } from 'react'
import { IconVacio } from './icons'

export function Vacio({
  titulo,
  texto,
  accion,
  icono,
}: {
  titulo: string
  texto?: string
  accion?: ReactNode
  icono?: ReactNode
}) {
  return (
    <div className="hg-vacio">
      <span className="hg-vacio__icono">{icono ?? <IconVacio size={24} />}</span>
      <span className="hg-vacio__titulo">{titulo}</span>
      {texto && <span className="hg-vacio__texto">{texto}</span>}
      {accion && <div style={{ marginTop: 'var(--sp-xs)' }}>{accion}</div>}
    </div>
  )
}

export function Cargando({ texto = 'Cargando informacion…' }: { texto?: string }) {
  return (
    <div className="hg-pila" role="status" aria-live="polite">
      <span className="sr-only">{texto}</span>
      <div className="hg-grid hg-grid--kpi" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="hg-skeleton" style={{ height: 104 }} />
        ))}
      </div>
      <div className="hg-skeleton" aria-hidden="true" style={{ height: 260 }} />
    </div>
  )
}

export function LineaCargando({ alto = 20, ancho = '100%' }: { alto?: number; ancho?: string }) {
  return <div className="hg-skeleton" style={{ height: alto, width: ancho }} aria-hidden="true" />
}

export function ErrorVista({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="hg-vacio" role="alert">
      <span className="hg-vacio__icono" style={{ background: '#FEE2E2', color: '#EF4444' }}>
        !
      </span>
      <span className="hg-vacio__titulo">{titulo}</span>
      {detalle && <span className="hg-vacio__texto">{detalle}</span>}
      {accion && <div style={{ marginTop: 'var(--sp-xs)' }}>{accion}</div>}
    </div>
  )
}
