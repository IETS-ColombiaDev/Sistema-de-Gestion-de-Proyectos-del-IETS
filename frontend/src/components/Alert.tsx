/**
 * Alerta (guia 6.4): tarjeta blanca, borde izquierdo 4px semantico,
 * icono en circulo con fondo suave, jerarquia titulo + mensaje.
 */

import type { ReactNode } from 'react'
import { colors } from '@/styles/theme'
import { IconAdvertencia, IconCheck, IconError, IconInfo } from './icons'

export type TipoAlerta = 'success' | 'warning' | 'error' | 'info'

const CONFIG: Record<TipoAlerta, { color: string; fondo: string; Icono: typeof IconInfo }> = {
  success: { color: colors.status.success, fondo: colors.status.successSoft, Icono: IconCheck },
  warning: { color: colors.status.warning, fondo: colors.status.warningSoft, Icono: IconAdvertencia },
  error: { color: colors.status.error, fondo: colors.status.errorSoft, Icono: IconError },
  info: { color: colors.status.info, fondo: colors.status.infoSoft, Icono: IconInfo },
}

interface Props {
  tipo?: TipoAlerta
  titulo: string
  mensaje?: ReactNode
  acciones?: ReactNode
  /** Mensajes criticos o dinamicos se anuncian a lectores de pantalla. */
  critico?: boolean
}

export default function Alert({ tipo = 'info', titulo, mensaje, acciones, critico }: Props) {
  const { color, fondo, Icono } = CONFIG[tipo]
  return (
    <div
      className={`hg-alert hg-alert--${tipo}`}
      role={critico ? 'alert' : 'status'}
      aria-live={critico ? 'assertive' : 'polite'}
    >
      <span className="hg-alert__icono" style={{ background: fondo, color }}>
        <Icono size={15} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="hg-alert__titulo">{titulo}</div>
        {mensaje && <div className="hg-alert__mensaje">{mensaje}</div>}
        {acciones && <div className="hg-alert__acciones">{acciones}</div>}
      </div>
    </div>
  )
}
