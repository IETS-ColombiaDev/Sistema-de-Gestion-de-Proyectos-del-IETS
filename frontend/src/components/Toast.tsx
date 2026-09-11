/**
 * Notificaciones efimeras. Colores semanticos y texto breve (guia checklist 5).
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconCerrar } from './icons'

type TipoToast = 'success' | 'error' | 'warning' | 'info'

interface Aviso {
  id: number
  tipo: TipoToast
  texto: string
}

interface Api {
  exito: (texto: string) => void
  error: (texto: string) => void
  aviso: (texto: string) => void
  info: (texto: string) => void
}

const Ctx = createContext<Api | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const push = useCallback((tipo: TipoToast, texto: string) => {
    const id = Date.now() + Math.random()
    setAvisos((prev) => [...prev, { id, tipo, texto }])
    window.setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== id)), 5000)
  }, [])

  const api = useMemo<Api>(
    () => ({
      exito: (t) => push('success', t),
      error: (t) => push('error', t),
      aviso: (t) => push('warning', t),
      info: (t) => push('info', t),
    }),
    [push],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <div className="hg-toasts no-print" aria-live="polite" aria-atomic="false">
        {avisos.map((a) => (
          <div key={a.id} className={`hg-toast hg-toast--${a.tipo}`} role={a.tipo === 'error' ? 'alert' : 'status'}>
            <span style={{ flex: 1 }}>{a.texto}</span>
            <button
              type="button"
              onClick={() => setAvisos((prev) => prev.filter((x) => x.id !== a.id))}
              aria-label="Cerrar aviso"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--c-text-3)' }}
            >
              <IconCerrar size={14} />
            </button>
          </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

export function useToast(): Api {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider.')
  return ctx
}
