/**
 * Graficos del sistema. SVG propio, sin librerias externas, para que la paleta
 * y las reglas de marca no dependan de los valores por defecto de un tercero.
 *
 * Todos cumplen: marcas delgadas, extremos redondeados de 4px anclados a la
 * linea base, separacion de 2px entre rellenos contiguos, rejilla recesiva,
 * etiquetas directas cuando hay pocas series, leyenda siempre presente a partir
 * de dos series, tooltip al pasar el cursor y vista de tabla equivalente.
 */

import { Fragment, useId, useMemo, useState, type ReactNode } from 'react'
import { ESTADO, TINTA, colorSerie, tintaSobre } from './paleta'
import type {
  BarraDivergente,
  LineaParetoVista,
  PasoCascadaVista,
  PuntoCuadrante,
  PuntoCurvaS,
} from './avanzados'
import { IconTablero } from '../icons'

// ---------------------------------------------------------------------------
// Envoltura comun: titulo, leyenda, alternancia grafico/tabla
// ---------------------------------------------------------------------------

export function Figura({
  titulo,
  descripcion,
  leyenda,
  tabla,
  children,
  acciones,
}: {
  titulo?: string
  descripcion?: string
  leyenda?: { etiqueta: string; color: string; discontinua?: boolean }[]
  tabla?: ReactNode
  children: ReactNode
  acciones?: ReactNode
}) {
  const [verTabla, setVerTabla] = useState(false)
  const idTabla = useId()

  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      {(titulo || acciones || tabla) && (
        <figcaption
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--sp-xs)',
            marginBottom: 'var(--sp-xs)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            {titulo && <div className="hg-t-bold hg-t-sm">{titulo}</div>}
            {descripcion && <div className="hg-t-xs hg-t-sec">{descripcion}</div>}
          </div>
          {tabla && (
            <button
              type="button"
              className="hg-btn hg-btn--ghost hg-btn--sm no-print"
              style={{ marginLeft: 'auto' }}
              aria-expanded={verTabla}
              aria-controls={idTabla}
              onClick={() => setVerTabla((v) => !v)}
            >
              <IconTablero size={13} />
              {verTabla ? 'Ver grafico' : 'Ver tabla'}
            </button>
          )}
          {acciones}
        </figcaption>
      )}

      {verTabla && tabla ? <div id={idTabla}>{tabla}</div> : children}

      {leyenda && leyenda.length > 1 && !verTabla && (
        <ul
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-sm)',
            listStyle: 'none',
            margin: 'var(--sp-sm) 0 0',
            padding: 0,
          }}
        >
          {leyenda.map((l) => (
            <li
              key={l.etiqueta}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: TINTA.secundaria }}
            >
              {/* La muestra reproduce el trazo real: una serie discontinua se
                  representa discontinua, no con un cuadro macizo del mismo
                  color, que la haria indistinguible de la serie solida. */}
              {l.discontinua ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 0,
                    borderTop: `2px dashed ${l.color}`,
                    flex: 'none',
                  }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flex: 'none' }}
                />
              )}
              {l.etiqueta}
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, calc(-100% - 10px))',
        background: '#0F172A',
        color: '#fff',
        borderRadius: 'var(--r-base)',
        padding: '7px 10px',
        fontSize: 'var(--fs-xs)',
        lineHeight: 1.45,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: 'var(--sh-lg)',
        zIndex: 20,
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barras horizontales — magnitud por categoria
// ---------------------------------------------------------------------------

export interface DatoBarra {
  etiqueta: string
  valor: number
  color?: string
  /** Marca de referencia sobre la misma barra (por ejemplo, el avance esperado). */
  referencia?: number
  detalle?: string
}

export function BarrasHorizontales({
  datos,
  maximo,
  sufijo = ' %',
  altoBarra = 22,
  etiquetaReferencia = 'esperado',
}: {
  datos: DatoBarra[]
  maximo?: number
  sufijo?: string
  altoBarra?: number
  etiquetaReferencia?: string
}) {
  const max = maximo ?? Math.max(100, ...datos.map((d) => d.valor))
  const [activo, setActivo] = useState<number | null>(null)

  if (datos.length === 0) return <p className="hg-t-sm hg-t-sec">Sin datos para graficar.</p>

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {datos.map((d, i) => {
          const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (d.valor / max) * 100))
          const color = d.color ?? colorSerie(i)
          return (
            <div
              key={d.etiqueta}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 34%) 1fr auto', gap: 10, alignItems: 'center' }}
            >
              <span
                className="hg-t-xs"
                style={{ color: TINTA.secundaria, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={d.etiqueta}
              >
                {d.etiqueta}
              </span>

              <div
                style={{
                  position: 'relative',
                  height: altoBarra,
                  background: '#F1F5F9',
                  borderRadius: 4,
                  overflow: 'visible',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: color,
                    borderRadius: '4px',
                    transition: 'width var(--t-slow)',
                    opacity: activo == null || activo === i ? 1 : 0.55,
                  }}
                />
                {d.referencia != null && d.referencia > 0 && (
                  <span
                    title={`${etiquetaReferencia}: ${d.referencia.toFixed(1)}${sufijo}`}
                    style={{
                      position: 'absolute',
                      top: -3,
                      bottom: -3,
                      left: `calc(${Math.min(100, (d.referencia / max) * 100)}% - 1px)`,
                      width: 2,
                      background: TINTA.primaria,
                      opacity: 0.5,
                    }}
                  />
                )}
              </div>

              {/* Etiqueta directa: obligatoria por el contraste del ambar de la paleta. */}
              <span className="hg-t-xs hg-t-num hg-t-bold" style={{ minWidth: 46, textAlign: 'right' }}>
                {d.valor.toFixed(d.valor % 1 === 0 ? 0 : 1)}
                {sufijo}
              </span>
            </div>
          )
        })}
      </div>
      {activo != null && datos[activo].detalle && (
        <div className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-xs)' }}>
          {datos[activo].detalle}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barra apilada — composicion de un total
// ---------------------------------------------------------------------------

export interface Segmento {
  etiqueta: string
  valor: number
  color: string
}

export function BarraApilada({ segmentos, total }: { segmentos: Segmento[]; total?: number }) {
  const suma = total ?? segmentos.reduce((s, x) => s + x.valor, 0)
  const [activo, setActivo] = useState<number | null>(null)

  if (suma === 0) return <p className="hg-t-sm hg-t-sec">Sin registros.</p>

  return (
    <div>
      <div
        style={{ display: 'flex', height: 30, borderRadius: 5, overflow: 'hidden', gap: 2, background: '#F1F5F9' }}
        role="img"
        aria-label={segmentos.map((s) => `${s.etiqueta}: ${s.valor}`).join('; ')}
      >
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s, i) => (
            <div
              key={s.etiqueta}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              title={`${s.etiqueta}: ${s.valor} (${((s.valor / suma) * 100).toFixed(1)} %)`}
              style={{
                width: `${(s.valor / suma) * 100}%`,
                background: s.color,
                transition: 'opacity var(--t-fast)',
                opacity: activo == null || activo === i ? 1 : 0.6,
                display: 'grid',
                placeItems: 'center',
                color: tintaSobre(s.color),
                fontSize: 'var(--fs-xs)',
                fontWeight: 700,
                minWidth: 2,
              }}
            >
              {(s.valor / suma) * 100 >= 9 ? s.valor : ''}
            </div>
          ))}
      </div>
      <ul
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--sp-sm)',
          listStyle: 'none',
          margin: '10px 0 0',
          padding: 0,
        }}
      >
        {segmentos.map((s) => (
          <li key={s.etiqueta} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)' }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span style={{ color: TINTA.secundaria }}>{s.etiqueta}</span>
            <strong className="hg-t-num">{s.valor}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Serie temporal — lineas con retícula y tooltip
// ---------------------------------------------------------------------------

export interface SerieTemporal {
  nombre: string
  puntos: { x: string; y: number | null }[]
  color?: string
  /** Trazo discontinuo para lo programado frente a lo ejecutado. */
  discontinua?: boolean
}

export function LineasTemporales({
  series,
  sufijo = '',
  alto = 220,
  formatoValor,
}: {
  series: SerieTemporal[]
  sufijo?: string
  alto?: number
  formatoValor?: (v: number) => string
}) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)

  const etiquetasX = useMemo(() => {
    const set: string[] = []
    for (const s of series) for (const p of s.puntos) if (!set.includes(p.x)) set.push(p.x)
    return set.sort()
  }, [series])

  const valores = series.flatMap((s) => s.puntos.map((p) => p.y).filter((v): v is number => v != null))
  if (etiquetasX.length === 0 || valores.length === 0) {
    return <p className="hg-t-sm hg-t-sec">Sin datos suficientes para la serie.</p>
  }

  const maxY = Math.max(...valores)
  const minY = Math.min(0, ...valores)
  const rango = maxY - minY || 1
  const W = 700
  const H = alto
  const M = { top: 12, right: 16, bottom: 26, left: 46 }
  const anchoUtil = W - M.left - M.right
  const altoUtil = H - M.top - M.bottom

  const px = (i: number) =>
    M.left + (etiquetasX.length === 1 ? anchoUtil / 2 : (i / (etiquetasX.length - 1)) * anchoUtil)
  const py = (v: number) => M.top + altoUtil - ((v - minY) / rango) * altoUtil

  const marcasY = [0, 0.25, 0.5, 0.75, 1].map((f) => minY + f * rango)
  const fmt = formatoValor ?? ((v: number) => `${v.toFixed(v % 1 === 0 ? 0 : 1)}${sufijo}`)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Serie temporal de ${series.map((s) => s.nombre).join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        {/* Rejilla recesiva */}
        {marcasY.map((v, i) => (
          <g key={i}>
            <line x1={M.left} x2={W - M.right} y1={py(v)} y2={py(v)} stroke={TINTA.rejilla} strokeWidth={1} />
            <text x={M.left - 8} y={py(v) + 4} textAnchor="end" fontSize={10} fill={TINTA.tenue}>
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* Eje X */}
        {etiquetasX.map((x, i) => {
          const paso = Math.ceil(etiquetasX.length / 8)
          if (i % paso !== 0 && i !== etiquetasX.length - 1) return null
          return (
            <text key={x} x={px(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={TINTA.tenue}>
              {x}
            </text>
          )
        })}

        {/* Series.
            Las lineas discontinuas se dibujan al final: cuando dos series casi
            coinciden —lo programado y lo ejecutado, por ejemplo— la de
            referencia debe quedar visible por encima, no tapada. El indice de
            color se conserva para que el color siga a la serie y no a su orden
            de pintado. */}
        {series
          .map((s, si) => ({ s, si }))
          .sort((a, b) => Number(a.s.discontinua ?? false) - Number(b.s.discontinua ?? false))
          .map(({ s, si }) => {
          const color = s.color ?? colorSerie(si)
          const puntos = etiquetasX
            .map((x, i) => {
              const p = s.puntos.find((q) => q.x === x)
              return p && p.y != null ? { i, v: p.y } : null
            })
            .filter((p): p is { i: number; v: number } => p !== null)
          if (puntos.length === 0) return null
          const d = puntos.map((p, k) => `${k === 0 ? 'M' : 'L'}${px(p.i)},${py(p.v)}`).join(' ')
          return (
            <g key={s.nombre}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.discontinua ? '6 4' : undefined}
              />
              {puntos.map((p) => (
                <circle
                  key={p.i}
                  cx={px(p.i)}
                  cy={py(p.v)}
                  r={4}
                  fill={color}
                  stroke={TINTA.superficie}
                  strokeWidth={2}
                />
              ))}
            </g>
          )
        })}

        {/* Cruz de exploracion */}
        {hover && (
          <line
            x1={px(hover.i)}
            x2={px(hover.i)}
            y1={M.top}
            y2={M.top + altoUtil}
            stroke={TINTA.eje}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {etiquetasX.map((_, i) => (
          <rect
            key={i}
            x={px(i) - anchoUtil / Math.max(1, etiquetasX.length) / 2}
            y={M.top}
            width={Math.max(12, anchoUtil / Math.max(1, etiquetasX.length))}
            height={altoUtil}
            fill="transparent"
            onMouseEnter={(e) => {
              const caja = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
              setHover({ i, x: (px(i) / W) * caja.width, y: M.top })
            }}
          />
        ))}
      </svg>

      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <strong>{etiquetasX[hover.i]}</strong>
          {series.map((s, si) => {
            const p = s.puntos.find((q) => q.x === etiquetasX[hover.i])
            if (!p || p.y == null) return null
            return (
              <div key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: s.color ?? colorSerie(si),
                    flex: 'none',
                  }}
                />
                {s.nombre}: {fmt(p.y)}
              </div>
            )
          })}
        </Tooltip>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mapa de calor 5x5 — probabilidad x impacto
// ---------------------------------------------------------------------------

export function MapaCalor({
  matriz,
  onCelda,
}: {
  matriz: number[][]
  onCelda?: (probabilidad: number, impacto: number) => void
}) {
  const nivelDe = (p: number, i: number) => {
    const s = p * i
    if (s <= 4) return ESTADO.bueno
    if (s <= 9) return ESTADO.advertencia
    if (s <= 14) return ESTADO.serio
    return ESTADO.critico
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: 2, minWidth: 0 }}>
      {matriz.map((fila, r) => {
        const probabilidad = 5 - r
        return (
          <Fragment key={`fila-${r}`}>
            <div
              className="hg-t-xs hg-t-num"
              style={{ display: 'grid', placeItems: 'center', color: TINTA.tenue, paddingRight: 6 }}
            >
              {probabilidad}
            </div>
            {fila.map((conteo, c) => {
              const impacto = c + 1
              const color = nivelDe(probabilidad, impacto)
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={onCelda ? () => onCelda(probabilidad, impacto) : undefined}
                  title={`Probabilidad ${probabilidad} × impacto ${impacto} = severidad ${probabilidad * impacto} · ${conteo} riesgo(s)`}
                  style={{
                    aspectRatio: '1.4',
                    border: 'none',
                    borderRadius: 4,
                    background: conteo > 0 ? color : `${color}22`,
                    color: conteo > 0 ? '#fff' : TINTA.tenue,
                    fontWeight: 700,
                    fontSize: 'var(--fs-sm)',
                    cursor: onCelda ? 'pointer' : 'default',
                    display: 'grid',
                    placeItems: 'center',
                    transition: 'transform var(--t-fast)',
                  }}
                >
                  {conteo > 0 ? conteo : ''}
                </button>
              )
            })}
          </Fragment>
        )
      })}
      <div />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="hg-t-xs hg-t-num" style={{ textAlign: 'center', color: TINTA.tenue, paddingTop: 4 }}>
          {i}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Termometro de indicador — resultado frente a meta
// ---------------------------------------------------------------------------

export function BarraMeta({
  valor,
  meta,
  maximo,
  color,
  sufijo = ' %',
}: {
  valor: number | null
  meta: number
  maximo?: number
  color: string
  sufijo?: string
}) {
  const max = maximo ?? Math.max(100, meta * 1.2, (valor ?? 0) * 1.1)
  const v = valor == null ? 0 : Math.max(0, Math.min(max, valor))
  return (
    <div style={{ position: 'relative', height: 14, background: '#F1F5F9', borderRadius: 4 }}>
      <div
        style={{
          width: `${(v / max) * 100}%`,
          height: '100%',
          background: valor == null ? '#E2E8F0' : color,
          borderRadius: 4,
          transition: 'width var(--t-slow)',
        }}
      />
      <span
        title={`Meta: ${meta}${sufijo}`}
        style={{
          position: 'absolute',
          top: -4,
          bottom: -4,
          left: `calc(${Math.min(100, (meta / max) * 100)}% - 1px)`,
          width: 2,
          background: TINTA.primaria,
          opacity: 0.65,
        }}
      />
    </div>
  )
}

export {
  CATEGORICOS,
  DIVERGENTE,
  ESTADO,
  RELLENO_RECURSO,
  RELLENO_RIESGO,
  SECUENCIAL_INDIGO,
  SERIE_EVM,
  TINTA,
  colorSerie,
  tintaSobre,
  tonoDivergente,
  tonoSecuencial,
} from './paleta'

export {
  BarrasDivergentes,
  Bullet,
  Cascada,
  Cuadrante,
  CurvaS,
  Pareto,
  Sparkline,
} from './avanzados'
export type {
  BarraDivergente,
  LineaParetoVista,
  PasoCascadaVista,
  PuntoCuadrante,
  PuntoCurvaS,
}
