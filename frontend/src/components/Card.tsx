import type { ReactNode } from 'react'

interface Props {
  titulo?: ReactNode
  subtitulo?: ReactNode
  acciones?: ReactNode
  children: ReactNode
  plano?: boolean
  className?: string
  id?: string
}

export default function Card({
  titulo,
  subtitulo,
  acciones,
  children,
  plano,
  className = '',
  id,
}: Props) {
  return (
    <section id={id} className={`hg-card${plano ? ' hg-card--plano' : ''} ${className}`}>
      {(titulo || acciones) && (
        <header className="hg-card__head" style={plano ? { padding: 'var(--sp-lg) var(--sp-xl) 0' } : undefined}>
          <div style={{ minWidth: 0 }}>
            {titulo && <h2 className="hg-card__titulo">{titulo}</h2>}
            {subtitulo && <div className="hg-card__sub">{subtitulo}</div>}
          </div>
          {acciones && <div className="hg-fila no-print">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
