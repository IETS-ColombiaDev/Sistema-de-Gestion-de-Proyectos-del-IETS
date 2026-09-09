import type { ReactNode } from 'react'
import { estadoColors } from '@/styles/theme'

interface Props {
  children: ReactNode
  /** Colores explicitos; si se omiten se usa el neutro del tema. */
  fg?: string
  bg?: string
  punto?: boolean
  titulo?: string
}

export default function Badge({ children, fg = '#64748B', bg = '#F1F5F9', punto, titulo }: Props) {
  return (
    <span className="hg-badge" style={{ color: fg, background: bg }} title={titulo}>
      {punto && <span className="hg-badge__punto" />}
      {children}
    </span>
  )
}

type Familia = keyof typeof estadoColors

/** Badge que toma su color del vocabulario de estados del tema. */
export function BadgeEstado({
  familia,
  valor,
  titulo,
}: {
  familia: Familia
  valor: string
  titulo?: string
}) {
  const mapa = estadoColors[familia] as Record<string, { fg: string; bg: string }>
  const c = mapa[valor] ?? { fg: '#64748B', bg: '#F1F5F9' }
  if (!valor) return <span className="hg-t-ter">—</span>
  return (
    <Badge fg={c.fg} bg={c.bg} punto titulo={titulo}>
      {valor}
    </Badge>
  )
}
