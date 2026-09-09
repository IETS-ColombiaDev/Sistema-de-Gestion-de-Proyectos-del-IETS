import { colors } from '@/styles/theme'

interface Props {
  valor: number
  /** Marca de referencia, tipicamente el avance esperado. */
  meta?: number
  color?: string
  alto?: number
  etiqueta?: boolean
}

export default function Progreso({ valor, meta, color, alto = 8, etiqueta }: Props) {
  const v = Math.max(0, Math.min(100, valor))
  const tono =
    color ??
    (meta != null
      ? v >= meta
        ? colors.status.success
        : v >= meta - 10
          ? colors.status.warning
          : colors.status.error
      : colors.primary.purple)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 90 }}>
      <div
        className="hg-progreso"
        style={{ height: alto, flex: 1 }}
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        title={meta != null ? `Avance ${v} % · esperado ${meta} %` : `Avance ${v} %`}
      >
        <div className="hg-progreso__relleno" style={{ width: `${v}%`, background: tono }} />
        {meta != null && meta > 0 && meta < 100 && (
          <span className="hg-progreso__meta" style={{ left: `calc(${Math.min(100, meta)}% - 1px)` }} />
        )}
      </div>
      {etiqueta && (
        <span className="hg-t-xs hg-t-num hg-t-bold" style={{ width: 42, textAlign: 'right' }}>
          {v.toFixed(0)} %
        </span>
      )}
    </div>
  )
}
