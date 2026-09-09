/**
 * Modal (guia 6.3): overlay semitransparente, contenedor blanco, radio 12px,
 * cabecera con titulo, cuerpo y pie con separadores.
 * Cierra con Escape y con clic en el overlay; atrapa el foco mientras esta abierto.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import Button from '../Button'
import { IconCerrar } from '../icons'

interface Props {
  abierto: boolean
  titulo: string
  subtitulo?: ReactNode
  children: ReactNode
  pie?: ReactNode
  onCerrar: () => void
  tamano?: 'md' | 'lg' | 'xl'
}

export default function Modal({
  abierto,
  titulo,
  subtitulo,
  children,
  pie,
  onCerrar,
  tamano = 'md',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const focos = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focos.length === 0) return
      const primero = focos[0]
      const ultimo = focos[focos.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // El primer control del modal recibe el foco al abrir.
    window.setTimeout(() => {
      ref.current
        ?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select, textarea, button',
        )
        ?.focus()
    }, 30)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="hg-overlay no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        ref={ref}
        className={`hg-modal${tamano !== 'md' ? ` hg-modal--${tamano}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <header className="hg-modal__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="hg-modal__titulo">{titulo}</h2>
            {subtitulo && <div className="hg-modal__sub">{subtitulo}</div>}
          </div>
          <Button
            variante="ghost"
            soloIcono
            onClick={onCerrar}
            aria-label="Cerrar"
            icono={<IconCerrar size={18} />}
          />
        </header>
        <div className="hg-modal__body">{children}</div>
        {pie && <footer className="hg-modal__pie">{pie}</footer>}
      </div>
    </div>
  )
}

/** Confirmacion reutilizable, con comentario obligatorio opcional (HG-126). */
export function ModalConfirmacion({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  variante = 'danger',
  onConfirmar,
  onCerrar,
  comentario,
  onComentario,
  exigeComentario = false,
}: {
  abierto: boolean
  titulo: string
  mensaje: ReactNode
  textoConfirmar?: string
  variante?: 'danger' | 'primary' | 'success'
  onConfirmar: () => void
  onCerrar: () => void
  comentario?: string
  onComentario?: (v: string) => void
  exigeComentario?: boolean
}) {
  const faltaComentario = exigeComentario && !(comentario ?? '').trim()
  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        <>
          <Button variante="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variante={variante} onClick={onConfirmar} disabled={faltaComentario}>
            {textoConfirmar}
          </Button>
        </>
      }
    >
      <div className="hg-pila">
        <p className="hg-t-sm">{mensaje}</p>
        {exigeComentario && onComentario && (
          <div className="hg-campo">
            <label className="hg-campo__label" htmlFor="hg-comentario-confirmacion">
              Justificacion <span className="hg-campo__req">*</span>
            </label>
            <textarea
              id="hg-comentario-confirmacion"
              className="hg-textarea"
              value={comentario ?? ''}
              onChange={(e) => onComentario(e.target.value)}
              placeholder="Explique el motivo del cambio. Queda registrado en la auditoria."
            />
            <span className="hg-campo__ayuda">
              Este cambio es sensible: la justificacion se guarda en el registro de auditoria.
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
