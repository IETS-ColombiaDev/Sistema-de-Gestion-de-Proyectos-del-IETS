/**
 * Ayuda contextual. Dos piezas complementarias:
 *  - <Pista>  : icono de informacion con tooltip accesible, para explicar un
 *               campo o una cifra sin ocupar espacio permanente.
 *  - <Nota>   : bloque breve de contexto al inicio de un modulo, con el "para
 *               que sirve esta pantalla" y la regla de negocio que la gobierna.
 *
 * El tooltip se abre con el cursor y con el foco de teclado, y su contenido
 * tambien viaja en aria-describedby para lectores de pantalla.
 */

import { useId, useState, type ReactNode } from 'react'
import { IconInfo } from './icons'

export function Pista({ texto, etiqueta = 'Mas informacion' }: { texto: string; etiqueta?: string }) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label={etiqueta}
        aria-describedby={visible ? id : undefined}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={(e) => {
          e.preventDefault()
          setVisible((v) => !v)
        }}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 0,
          cursor: 'help',
          color: 'var(--c-text-3)',
          display: 'inline-flex',
          lineHeight: 1,
        }}
      >
        <IconInfo size={14} />
      </button>
      {visible && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0F172A',
            color: '#fff',
            padding: '8px 10px',
            borderRadius: 'var(--r-base)',
            fontSize: 'var(--fs-xs)',
            lineHeight: 1.45,
            width: 'max-content',
            maxWidth: 'min(280px, 70vw)',
            zIndex: 300,
            boxShadow: 'var(--sh-lg)',
            fontWeight: 400,
            textTransform: 'none',
            letterSpacing: 0,
            pointerEvents: 'none',
            whiteSpace: 'normal',
          }}
        >
          {texto}
        </span>
      )}
    </span>
  )
}

export function Nota({ children, regla }: { children: ReactNode; regla?: string }) {
  return (
    <div
      className="hg-fila"
      style={{
        gap: 'var(--sp-xs)',
        padding: 'var(--sp-sm) var(--sp-md)',
        background: 'var(--c-bg-active)',
        border: '1px solid #E0E7FF',
        borderRadius: 'var(--r-base)',
        color: '#3730A3',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ flex: 'none', marginTop: 2 }}>
        <IconInfo size={15} />
      </span>
      <span className="hg-t-sm" style={{ flex: 1, minWidth: 0 }}>
        {children}
        {regla && (
          <span
            className="hg-t-xs"
            style={{
              display: 'inline-block',
              marginLeft: 6,
              padding: '1px 7px',
              borderRadius: 'var(--r-full)',
              background: '#fff',
              color: '#4F46E5',
              fontWeight: 600,
            }}
          >
            {regla}
          </span>
        )}
      </span>
    </div>
  )
}
