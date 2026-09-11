/**
 * Graficos de decision gerencial.
 *
 * Cada uno responde una pregunta que un directivo hace en voz alta, y esta
 * construido para que la respuesta se lea sin instrucciones:
 *
 *   CurvaS              ¿como venimos y donde vamos a cerrar?
 *   Cascada             ¿de donde sale el sobrecosto y que parte es accionable?
 *   Cuadrante           ¿cual de mis proyectos esta en problemas y cuanto dinero hay en juego?
 *   BarrasDivergentes   ¿que fase destruye valor y cual lo aporta?
 *   Pareto              ¿donde miro primero si hay que recortar?
 *   Bullet              ¿este indicador cumple, y por cuanto?
 *   Sparkline           ¿la tendencia acompana o contradice la cifra?
 *
 * Reglas comunes: marcas delgadas, rejilla en hairline solido, sin doble eje,
 * etiquetas directas solo en el extremo que importa, area de contacto de 24 px
 * o mas, y una vista de tabla equivalente para cada figura.
 */

import { useId, useState, type ReactNode } from 'react'
import { DIVERGENTE, SERIE_EVM, TINTA, tintaSobre, tonoDivergente } from './paleta'
import { SECUENCIAL_INDIGO } from './paleta'

// ---------------------------------------------------------------------------
// Utilidades compartidas
// ---------------------------------------------------------------------------

const MARGEN = { arriba: 16, derecha: 18, abajo: 30, izquierda: 62 }

/**
 * Factor de escala del texto dentro del SVG.
 *
 * El grafico se dibuja en un lienzo de ancho fijo y se escala por CSS al ancho
 * disponible. En un telefono ese factor ronda 0,55, de modo que un texto de
 * 10 unidades acaba en 5,5 px: ilegible. En modo compacto el texto se dibuja
 * mas grande para que en pantalla siga midiendo lo mismo.
 */
const ESCALA_COMPACTA = 1.85

function Globo({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, calc(-100% - 12px))',
        background: '#0F172A',
        color: '#fff',
        borderRadius: 'var(--r-base)',
        padding: '8px 11px',
        fontSize: 'var(--fs-xs)',
        lineHeight: 1.5,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: 'var(--sh-lg)',
        zIndex: 30,
      }}
    >
      {children}
    </div>
  )
}

/** Escala de valores "bonita": redondea el techo al siguiente paso legible. */
function techoLegible(maximo: number): number {
  if (maximo <= 0) return 1
  const magnitud = 10 ** Math.floor(Math.log10(maximo))
  const normalizado = maximo / magnitud
  const paso = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10
  return paso * magnitud
}

// ---------------------------------------------------------------------------
// Curva S de valor ganado
// ---------------------------------------------------------------------------

export interface PuntoCurvaS {
  periodo: string
  planeado: number
  ganado: number | null
  real: number | null
  proyectado: number | null
  esCorte: boolean
  futuro: boolean
}

/**
 * Las tres magnitudes del valor ganado en el tiempo, mas la extrapolacion.
 *
 * Es el grafico mas denso en decision de toda la gestion de proyectos: en una
 * sola lectura se ve si el trabajo va al ritmo del plan (planeado frente a
 * ganado), si cuesta lo que deberia (ganado frente a real) y con que cifra se
 * va a cerrar (la extrapolacion). La banda posterior al corte se sombrea para
 * que nadie confunda registro con pronostico.
 */
export function CurvaS({
  puntos,
  formato,
  presupuesto,
  alto = 300,
  compacto = false,
}: {
  puntos: PuntoCurvaS[]
  formato: (n: number) => string
  /** Linea de referencia del presupuesto aprobado. */
  presupuesto?: number
  alto?: number
  /** Pantalla estrecha: texto mas grande y menos marcas en los ejes. */
  compacto?: boolean
}) {
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null)
  const esc = compacto ? ESCALA_COMPACTA : 1
  const fs = (base: number) => Math.round(base * esc)

  if (puntos.length < 2) {
    return <p className="hg-t-sm hg-t-sec">Se necesitan al menos dos periodos para trazar la curva.</p>
  }

  const valores = puntos.flatMap((p) =>
    [p.planeado, p.ganado, p.real, p.proyectado].filter((v): v is number => v != null),
  )
  const maxY = techoLegible(Math.max(...valores, presupuesto ?? 0))
  const W = 760
  const H = alto
  // En modo compacto los margenes crecen con el texto: si no, las etiquetas del
  // eje se salen del lienzo.
  const M = compacto
    ? { arriba: 26, derecha: 24, abajo: 46, izquierda: 96 }
    : MARGEN
  const anchoUtil = W - M.izquierda - M.derecha
  const altoUtil = H - M.arriba - M.abajo

  const px = (i: number) => M.izquierda + (i / (puntos.length - 1)) * anchoUtil
  const py = (v: number) => M.arriba + altoUtil - (v / maxY) * altoUtil

  const iCorte = puntos.findIndex((p) => p.esCorte)
  const marcasY = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY)

  const trazo = (clave: 'planeado' | 'ganado' | 'real' | 'proyectado') =>
    puntos
      .map((p, i) => ({ i, v: p[clave] }))
      .filter((p): p is { i: number; v: number } => p.v != null)

  const linea = (datos: { i: number; v: number }[]) =>
    datos.map((p, k) => `${k === 0 ? 'M' : 'L'}${px(p.i)},${py(p.v)}`).join(' ')

  const series = [
    { clave: 'planeado' as const, nombre: 'Valor planeado', color: SERIE_EVM.planeado, discontinua: false },
    { clave: 'ganado' as const, nombre: 'Valor ganado', color: SERIE_EVM.ganado, discontinua: false },
    { clave: 'real' as const, nombre: 'Costo real', color: SERIE_EVM.real, discontinua: false },
    { clave: 'proyectado' as const, nombre: 'Proyeccion de cierre', color: SERIE_EVM.proyectado, discontinua: true },
  ]

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Curva de valor planeado, valor ganado y costo real en el tiempo, con la proyeccion de cierre"
        onMouseLeave={() => setHover(null)}
      >
        {/* Banda de pronostico: todo lo posterior al corte */}
        {iCorte >= 0 && iCorte < puntos.length - 1 && (
          <rect
            x={px(iCorte)}
            y={M.arriba}
            width={anchoUtil - (px(iCorte) - M.izquierda)}
            height={altoUtil}
            fill="#F8FAFC"
          />
        )}

        {/* Rejilla: hairline solido, un tono por encima de la superficie */}
        {marcasY.map((v) => (
          <g key={v}>
            <line
              x1={M.izquierda}
              x2={W - M.derecha}
              y1={py(v)}
              y2={py(v)}
              stroke={TINTA.rejilla}
              strokeWidth={1}
            />
            <text x={M.izquierda - 8} y={py(v) + 4} textAnchor="end" fontSize={fs(10)} fill={TINTA.tenue}>
              {formato(v)}
            </text>
          </g>
        ))}

        {/* Presupuesto aprobado: el techo contra el que se juzga todo */}
        {presupuesto != null && presupuesto > 0 && presupuesto <= maxY && (
          <g>
            <line
              x1={M.izquierda}
              x2={W - M.derecha}
              y1={py(presupuesto)}
              y2={py(presupuesto)}
              stroke={TINTA.primaria}
              strokeWidth={1.5}
            />
            {!compacto && (
              <text
                x={W - M.derecha}
                y={py(presupuesto) - 6}
                textAnchor="end"
                fontSize={10}
                fontWeight={700}
                fill={TINTA.primaria}
              >
                Presupuesto aprobado
              </text>
            )}
          </g>
        )}

        {/* Eje temporal */}
        {puntos.map((p, i) => {
          const paso = Math.ceil(puntos.length / (compacto ? 4 : 9))
          if (i % paso !== 0 && i !== puntos.length - 1) return null
          return (
            <text key={p.periodo} x={px(i)} y={H - 10} textAnchor="middle" fontSize={fs(10)} fill={TINTA.tenue}>
              {p.periodo.slice(2)}
            </text>
          )
        })}

        {/* Linea de fecha de corte */}
        {iCorte >= 0 && (
          <g>
            <line
              x1={px(iCorte)}
              x2={px(iCorte)}
              y1={M.arriba}
              y2={M.arriba + altoUtil}
              stroke="#4F46E5"
              strokeWidth={2}
            />
            <text
              x={px(iCorte)}
              y={M.arriba - 4}
              textAnchor="middle"
              fontSize={fs(10)}
              fontWeight={700}
              fill="#4F46E5"
            >
              corte
            </text>
          </g>
        )}

        {/* Series. La proyeccion se dibuja al final para que quede visible. */}
        {series.map((s) => {
          const datos = trazo(s.clave)
          if (datos.length === 0) return null
          return (
            <path
              key={s.clave}
              d={linea(datos)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.discontinua ? '7 5' : undefined}
              opacity={s.discontinua ? 0.9 : 1}
            />
          )
        })}

        {/* Marcadores del valor ganado: son pocos y son el dato que menos abunda */}
        {trazo('ganado').map((p) => (
          <circle
            key={p.i}
            cx={px(p.i)}
            cy={py(p.v)}
            r={4}
            fill={SERIE_EVM.ganado}
            stroke={TINTA.superficie}
            strokeWidth={2}
          />
        ))}

        {/* Etiqueta directa solo en el extremo de la proyeccion: el numero que importa */}
        {(() => {
          const fin = trazo('proyectado').at(-1)
          if (!fin) return null
          return (
            <text
              x={px(fin.i)}
              y={py(fin.v) - 10}
              textAnchor="end"
              fontSize={fs(11)}
              fontWeight={700}
              fill={SERIE_EVM.proyectado}
            >
              {formato(fin.v)}
            </text>
          )
        })()}

        {/* Cruz de exploracion y zonas de contacto anchas */}
        {hover && (
          <line
            x1={px(hover.i)}
            x2={px(hover.i)}
            y1={M.arriba}
            y2={M.arriba + altoUtil}
            stroke={TINTA.eje}
            strokeWidth={1}
          />
        )}
        {puntos.map((_, i) => (
          <rect
            key={i}
            x={px(i) - anchoUtil / puntos.length / 2}
            y={M.arriba}
            width={Math.max(24, anchoUtil / puntos.length)}
            height={altoUtil}
            fill="transparent"
            onMouseEnter={(e) => {
              const caja = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
              setHover({ i, x: (px(i) / W) * caja.width })
            }}
          />
        ))}
      </svg>

      {hover && (
        <Globo x={hover.x} y={M.arriba}>
          <strong>{puntos[hover.i].periodo}</strong>
          {puntos[hover.i].futuro && <span className="hg-t-ter"> · pronostico</span>}
          {series.map((s) => {
            const v = puntos[hover.i][s.clave]
            if (v == null) return null
            return (
              <div key={s.clave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: s.color,
                    flex: 'none',
                    opacity: s.discontinua ? 0.7 : 1,
                  }}
                />
                {s.nombre}: {formato(v)}
              </div>
            )
          })}
        </Globo>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cascada
// ---------------------------------------------------------------------------

export interface PasoCascadaVista {
  etiqueta: string
  valor: number
  esTotal: boolean
  explicacion?: string
}

/**
 * De una cifra base a otra, mostrando cada causa como un escalon.
 *
 * Responde "¿de donde sale la diferencia?", que es la pregunta previa a
 * cualquier decision de presupuesto. Los escalones usan el par divergente: lo
 * que encarece en rosa, lo que abarata en teal, y los totales en gris neutro,
 * porque un total no tiene polaridad.
 */
export function Cascada({
  pasos,
  formato,
  alto = 260,
  compacto = false,
}: {
  pasos: PasoCascadaVista[]
  formato: (n: number) => string
  alto?: number
  compacto?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const fs = (base: number) => Math.round(base * (compacto ? ESCALA_COMPACTA : 1))

  if (pasos.length === 0) {
    return <p className="hg-t-sm hg-t-sec">Sin datos suficientes para descomponer la variacion.</p>
  }

  // Posicion acumulada de cada escalon.
  let acumulado = 0
  const barras = pasos.map((paso) => {
    if (paso.esTotal) {
      acumulado = paso.valor
      return { paso, desde: 0, hasta: paso.valor }
    }
    const desde = acumulado
    acumulado += paso.valor
    return { paso, desde, hasta: acumulado }
  })

  const maxY = techoLegible(Math.max(...barras.flatMap((b) => [b.desde, b.hasta])))
  const W = 700
  const H = alto
  const anchoUtil = W - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = H - MARGEN.arriba - 46
  const anchoBarra = Math.min(96, (anchoUtil / barras.length) * 0.62)
  const cx = (i: number) => MARGEN.izquierda + (i + 0.5) * (anchoUtil / barras.length)
  const py = (v: number) => MARGEN.arriba + altoUtil - (v / maxY) * altoUtil

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Descomposicion: ${pasos.map((p) => `${p.etiqueta} ${formato(p.valor)}`).join('; ')}`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={MARGEN.izquierda}
            x2={W - MARGEN.derecha}
            y1={py(f * maxY)}
            y2={py(f * maxY)}
            stroke={TINTA.rejilla}
            strokeWidth={1}
          />
        ))}

        {barras.map((b, i) => {
          const color = b.paso.esTotal
            ? SECUENCIAL_INDIGO[5]
            : tonoDivergente(b.paso.valor, 'positivoEsMalo')
          const y = py(Math.max(b.desde, b.hasta))
          const altura = Math.max(2, Math.abs(py(b.desde) - py(b.hasta)))
          const cae = !b.paso.esTotal && b.paso.valor !== 0

          return (
            <g key={b.paso.etiqueta}>
              {/* Conector con el escalon anterior */}
              {i > 0 && !b.paso.esTotal && (
                <line
                  x1={cx(i - 1) + anchoBarra / 2}
                  x2={cx(i) - anchoBarra / 2}
                  y1={py(b.desde)}
                  y2={py(b.desde)}
                  stroke={TINTA.eje}
                  strokeWidth={1}
                />
              )}
              <rect
                x={cx(i) - anchoBarra / 2}
                y={y}
                width={anchoBarra}
                height={altura}
                rx={4}
                fill={color}
                opacity={hover == null || hover === i ? 1 : 0.55}
                onMouseEnter={() => setHover(i)}
              />
              {/* Etiqueta del importe, fuera de la barra cuando no cabe dentro */}
              <text
                x={cx(i)}
                y={altura > 26 ? y + 17 : y - 7}
                textAnchor="middle"
                fontSize={fs(11)}
                fontWeight={700}
                fill={altura > 26 ? tintaSobre(color) : TINTA.primaria}
              >
                {cae && b.paso.valor > 0 ? '+' : ''}
                {formato(b.paso.valor)}
              </text>
              <text
                x={cx(i)}
                y={MARGEN.arriba + altoUtil + 18}
                textAnchor="middle"
                fontSize={fs(10)}
                fill={TINTA.secundaria}
              >
                {b.paso.etiqueta.split(' ').slice(0, 2).join(' ')}
              </text>
              <text
                x={cx(i)}
                y={MARGEN.arriba + altoUtil + 31}
                textAnchor="middle"
                fontSize={fs(10)}
                fill={TINTA.secundaria}
              >
                {b.paso.etiqueta.split(' ').slice(2).join(' ')}
              </text>
            </g>
          )
        })}
      </svg>

      {hover != null && pasos[hover].explicacion && (
        <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-xs)' }}>
          <strong>{pasos[hover].etiqueta}:</strong> {pasos[hover].explicacion}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cuadrante de desempeno
// ---------------------------------------------------------------------------

export interface PuntoCuadrante {
  id: string
  etiqueta: string
  /** Eje horizontal: indice de cronograma. 1 es estar al dia. */
  x: number
  /** Eje vertical: indice de costo. 1 es gastar lo que vale el trabajo. */
  y: number
  /** Tamano de la burbuja: dinero en juego. */
  magnitud: number
  detalle?: string
}

/**
 * Cronograma frente a costo, con el dinero en juego como tamano.
 *
 * Es el grafico de portafolio: en una mirada se ve cual proyecto esta en
 * problemas y —lo que decide la prioridad— cuanto presupuesto hay detras. Un
 * proyecto pequeno muy desviado no es lo mismo que uno grande apenas desviado.
 *
 * Los dos ejes son indices sin unidad, de modo que no hay doble eje: es un
 * plano, no dos escalas superpuestas. El significado lo lleva la POSICION y el
 * rotulo de cada cuadrante; el color solo refuerza, porque el verde y el rojo
 * no se distinguen con daltonismo.
 */
export function Cuadrante({
  puntos,
  onPunto,
  alto = 340,
  etiquetaX = 'Indice de cronograma',
  etiquetaY = 'Indice de costo',
  compacto = false,
}: {
  puntos: PuntoCuadrante[]
  onPunto?: (id: string) => void
  alto?: number
  etiquetaX?: string
  etiquetaY?: string
  compacto?: boolean
}) {
  const [hover, setHover] = useState<{ p: PuntoCuadrante; x: number; y: number } | null>(null)
  const idGrad = useId()
  const fs = (base: number) => Math.round(base * (compacto ? ESCALA_COMPACTA : 1))

  if (puntos.length === 0) {
    return <p className="hg-t-sm hg-t-sec">Sin proyectos con indices calculables.</p>
  }

  // La escala se centra en 1 y cubre simetricamente la dispersion observada.
  const desvio = Math.max(
    0.3,
    ...puntos.flatMap((p) => [Math.abs(p.x - 1), Math.abs(p.y - 1)]),
  )
  const min = Math.max(0, 1 - desvio * 1.15)
  const max = 1 + desvio * 1.15

  const W = 620
  const H = alto
  const M = compacto
    ? { arriba: 30, derecha: 30, abajo: 78, izquierda: 84 }
    : { arriba: 22, derecha: 26, abajo: 52, izquierda: 58 }
  const anchoUtil = W - M.izquierda - M.derecha
  const altoUtil = H - M.arriba - M.abajo

  const px = (v: number) => M.izquierda + ((v - min) / (max - min)) * anchoUtil
  const py = (v: number) => M.arriba + altoUtil - ((v - min) / (max - min)) * altoUtil

  const maxMagnitud = Math.max(...puntos.map((p) => p.magnitud), 1)
  // Radio proporcional a la raiz del importe: el area representa el dinero,
  // que es como el ojo compara burbujas.
  const radio = (m: number) => 7 + Math.sqrt(m / maxMagnitud) * 17

  const x1 = px(1)
  const y1 = py(1)

  // Los rotulos van pegados a las esquinas del plano. En el centro de cada
  // cuadrante colisionarian con las burbujas, que es exactamente donde el ojo
  // va primero.
  const SANGRIA = 8
  const cuadrantes = [
    {
      nombre: 'Adelantado y con holgura',
      x: px(max) - SANGRIA,
      y: M.arriba + 13,
      ancla: 'end' as const,
      tono: '#F0FDF4',
    },
    {
      nombre: 'Atrasado, en costo',
      x: M.izquierda + SANGRIA,
      y: M.arriba + 13,
      ancla: 'start' as const,
      tono: '#FFFBEB',
    },
    {
      nombre: 'Al dia, sobre costo',
      x: px(max) - SANGRIA,
      y: M.arriba + altoUtil - 8,
      ancla: 'end' as const,
      tono: '#FFF7ED',
    },
    {
      nombre: 'Atrasado y sobre costo',
      x: M.izquierda + SANGRIA,
      y: M.arriba + altoUtil - 8,
      ancla: 'start' as const,
      tono: '#FEF2F2',
    },
  ]

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Dispersion de ${puntos.length} proyectos por indice de cronograma e indice de costo`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={`plano-${idGrad}`}>
            <rect x={M.izquierda} y={M.arriba} width={anchoUtil} height={altoUtil} />
          </clipPath>
        </defs>

        {/* Fondos de cuadrante, muy tenues: orientan sin competir */}
        <g clipPath={`url(#plano-${idGrad})`}>
          <rect x={x1} y={M.arriba} width={px(max) - x1} height={y1 - M.arriba} fill={cuadrantes[0].tono} />
          <rect x={M.izquierda} y={M.arriba} width={x1 - M.izquierda} height={y1 - M.arriba} fill={cuadrantes[1].tono} />
          <rect x={x1} y={y1} width={px(max) - x1} height={py(min) - y1} fill={cuadrantes[2].tono} />
          <rect x={M.izquierda} y={y1} width={x1 - M.izquierda} height={py(min) - y1} fill={cuadrantes[3].tono} />
        </g>

        {/* Ejes de referencia en 1: la frontera entre cumplir y no cumplir */}
        <line x1={x1} x2={x1} y1={M.arriba} y2={M.arriba + altoUtil} stroke={TINTA.eje} strokeWidth={1.5} />
        <line x1={M.izquierda} x2={W - M.derecha} y1={y1} y2={y1} stroke={TINTA.eje} strokeWidth={1.5} />

        {/* Rotulos de cuadrante: el canal que no depende del color */}
        {cuadrantes.map((c) => (
          <text
            key={c.nombre}
            x={c.x}
            y={c.y}
            textAnchor={c.ancla}
            fontSize={fs(10)}
            fontWeight={600}
            fill={TINTA.tenue}
          >
            {c.nombre}
          </text>
        ))}

        {/* Escalas */}
        {[min, 1, max].map((v) => (
          <g key={`x${v}`}>
            <text x={px(v)} y={M.arriba + altoUtil + 16} textAnchor="middle" fontSize={fs(10)} fill={TINTA.tenue}>
              {v.toFixed(2)}
            </text>
            <text x={M.izquierda - 8} y={py(v) + 4} textAnchor="end" fontSize={fs(10)} fill={TINTA.tenue}>
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        <text
          x={M.izquierda + anchoUtil / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={fs(10)}
          fontWeight={600}
          fill={TINTA.secundaria}
        >
          {etiquetaX} →
        </text>
        <text
          x={14}
          y={M.arriba + altoUtil / 2}
          textAnchor="middle"
          fontSize={fs(10)}
          fontWeight={600}
          fill={TINTA.secundaria}
          transform={`rotate(-90 14 ${M.arriba + altoUtil / 2})`}
        >
          {etiquetaY} →
        </text>

        {/* Burbujas: las grandes primero, para que las pequenas queden encima */}
        {[...puntos]
          .sort((a, b) => b.magnitud - a.magnitud)
          .map((p) => {
            const r = radio(p.magnitud)
            // Se acota el centro para que ni la burbuja ni su etiqueta —que va
            // debajo— salgan del plano. Sin esto, un proyecto en el extremo
            // queda con el nombre cortado por el borde de la tarjeta.
            const cx = Math.min(
              W - M.derecha - r,
              Math.max(M.izquierda + r, px(Math.min(max, Math.max(min, p.x)))),
            )
            const cy = Math.min(
              M.arriba + altoUtil - r - 14,
              Math.max(M.arriba + r, py(Math.min(max, Math.max(min, p.y)))),
            )
            const enProblemas = p.x < 0.95 || p.y < 0.95
            const color = enProblemas
              ? p.x < 0.95 && p.y < 0.95
                ? DIVERGENTE.desfavorable
                : '#CA8A04'
              : DIVERGENTE.favorable
            return (
              <g key={p.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  fillOpacity={0.62}
                  stroke={TINTA.superficie}
                  strokeWidth={2}
                />
                {/* Area de contacto de 24 px como minimo */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={Math.max(14, r)}
                  fill="transparent"
                  style={{ cursor: onPunto ? 'pointer' : 'default' }}
                  onMouseEnter={(e) => {
                    const caja = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                    setHover({ p, x: (cx / W) * caja.width, y: (cy / H) * caja.height })
                  }}
                  onClick={onPunto ? () => onPunto(p.id) : undefined}
                />
                <text
                  x={cx}
                  y={cy + r + 12}
                  textAnchor="middle"
                  fontSize={fs(10)}
                  fontWeight={600}
                  fill={TINTA.primaria}
                >
                  {p.etiqueta}
                </text>
              </g>
            )
          })}
      </svg>

      {hover && (
        <Globo x={hover.x} y={hover.y}>
          <strong>{hover.p.etiqueta}</strong>
          <div>Cronograma: {hover.p.x.toFixed(2)}</div>
          <div>Costo: {hover.p.y.toFixed(2)}</div>
          {hover.p.detalle && <div>{hover.p.detalle}</div>}
        </Globo>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barras divergentes
// ---------------------------------------------------------------------------

export interface BarraDivergente {
  etiqueta: string
  valor: number
  detalle?: string
}

/**
 * Desviaciones a ambos lados de un cero, ordenadas por magnitud.
 *
 * Responde "¿que aporta y que resta?" sin que el lector tenga que comparar
 * numeros con signo en una tabla. El cero es la referencia visual, y el par
 * divergente hace el resto.
 */
export function BarrasDivergentes({
  datos,
  formato,
  sentido = 'positivoEsBueno',
  altoBarra = 20,
}: {
  datos: BarraDivergente[]
  formato: (n: number) => string
  sentido?: 'positivoEsBueno' | 'positivoEsMalo'
  altoBarra?: number
}) {
  const [hover, setHover] = useState<number | null>(null)

  if (datos.length === 0) return <p className="hg-t-sm hg-t-sec">Sin datos para comparar.</p>

  const extremo = Math.max(...datos.map((d) => Math.abs(d.valor)), 1)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {datos.map((d, i) => {
          const proporcion = Math.abs(d.valor) / extremo
          const color = tonoDivergente(d.valor, sentido)
          return (
            <div
              key={d.etiqueta}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(96px, 30%) 1fr auto',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <span
                className="hg-t-xs"
                style={{
                  color: TINTA.secundaria,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={d.etiqueta}
              >
                {d.etiqueta}
              </span>

              <div style={{ position: 'relative', height: altoBarra }}>
                {/* Eje cero */}
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: -2,
                    bottom: -2,
                    width: 1,
                    background: TINTA.eje,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    height: '100%',
                    width: `${(proporcion * 100) / 2}%`,
                    left: d.valor >= 0 ? '50%' : undefined,
                    right: d.valor < 0 ? '50%' : undefined,
                    background: color,
                    borderRadius: d.valor >= 0 ? '0 4px 4px 0' : '4px 0 0 4px',
                    opacity: hover == null || hover === i ? 1 : 0.55,
                    transition: 'width var(--t-slow), opacity var(--t-fast)',
                  }}
                />
              </div>

              <span
                className="hg-t-xs hg-t-num hg-t-bold"
                style={{ minWidth: 78, textAlign: 'right', color }}
              >
                {d.valor > 0 ? '+' : ''}
                {formato(d.valor)}
              </span>
            </div>
          )
        })}
      </div>
      {hover != null && datos[hover].detalle && (
        <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-xs)' }}>
          {datos[hover].detalle}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pareto
// ---------------------------------------------------------------------------

export interface LineaParetoVista {
  clave: string
  participacion: number
  acumulada: number
  enElNucleo: boolean
  importe: number
}

/**
 * Concentracion: que pocas lineas explican la mayor parte del gasto.
 *
 * Responde "¿donde miro primero si hay que recortar?". Las barras son la
 * participacion de cada linea y el trazo es la acumulada: ambas en porcentaje
 * sobre un unico eje, de modo que no hay doble escala. El importe en dinero
 * viaja en la etiqueta y en la vista de tabla, donde se lee exacto.
 */
export function Pareto({
  lineas,
  formato,
  alto = 260,
  compacto = false,
}: {
  lineas: LineaParetoVista[]
  formato: (n: number) => string
  alto?: number
  compacto?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const fs = (base: number) => Math.round(base * (compacto ? ESCALA_COMPACTA : 1))

  if (lineas.length === 0) return <p className="hg-t-sm hg-t-sec">Sin gasto registrado.</p>

  const W = 700
  const H = alto
  const M = compacto
    ? { arriba: 20, derecha: 22, abajo: 84, izquierda: 74 }
    : { arriba: 16, derecha: 18, abajo: 52, izquierda: 46 }
  const anchoUtil = W - M.izquierda - M.derecha
  const altoUtil = H - M.arriba - M.abajo
  const anchoBanda = anchoUtil / lineas.length
  const anchoBarra = Math.min(64, anchoBanda * 0.6)
  const cx = (i: number) => M.izquierda + (i + 0.5) * anchoBanda
  const py = (pct: number) => M.arriba + altoUtil - (pct / 100) * altoUtil

  const nucleo = lineas.filter((l) => l.enElNucleo).length

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Concentracion del gasto: ${nucleo} de ${lineas.length} lineas explican el 80 % del total`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={M.izquierda}
              x2={W - M.derecha}
              y1={py(pct)}
              y2={py(pct)}
              stroke={TINTA.rejilla}
              strokeWidth={1}
            />
            <text x={M.izquierda - 8} y={py(pct) + 4} textAnchor="end" fontSize={fs(10)} fill={TINTA.tenue}>
              {pct} %
            </text>
          </g>
        ))}

        {/* Umbral del 80 %: la frontera del nucleo */}
        <line
          x1={M.izquierda}
          x2={W - M.derecha}
          y1={py(80)}
          y2={py(80)}
          stroke={TINTA.primaria}
          strokeWidth={1.5}
        />
        <text x={W - M.derecha} y={py(80) - 6} textAnchor="end" fontSize={fs(10)} fontWeight={700} fill={TINTA.primaria}>
          80 % del gasto
        </text>

        {/* Barras de participacion */}
        {lineas.map((l, i) => {
          const altura = Math.max(2, (l.participacion / 100) * altoUtil)
          const color = l.enElNucleo ? SECUENCIAL_INDIGO[5] : SECUENCIAL_INDIGO[3]
          return (
            <g key={l.clave}>
              <rect
                x={cx(i) - anchoBarra / 2}
                y={M.arriba + altoUtil - altura}
                width={anchoBarra}
                height={altura}
                rx={4}
                fill={color}
                opacity={hover == null || hover === i ? 1 : 0.6}
              />
              <rect
                x={cx(i) - anchoBanda / 2}
                y={M.arriba}
                width={Math.max(24, anchoBanda)}
                height={altoUtil}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              <text
                x={cx(i)}
                y={M.arriba + altoUtil + 16}
                textAnchor="middle"
                fontSize={fs(9)}
                fill={TINTA.secundaria}
              >
                {l.clave.length > 14 ? `${l.clave.slice(0, 13)}…` : l.clave}
              </text>
              <text
                x={cx(i)}
                y={M.arriba + altoUtil + 29}
                textAnchor="middle"
                fontSize={fs(9)}
                fontWeight={700}
                fill={TINTA.tenue}
              >
                {l.participacion.toFixed(0)} %
              </text>
            </g>
          )
        })}

        {/* Acumulada, en el mismo eje porcentual */}
        <path
          d={lineas.map((l, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${py(l.acumulada)}`).join(' ')}
          fill="none"
          stroke={TINTA.primaria}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {lineas.map((l, i) => (
          <circle
            key={l.clave}
            cx={cx(i)}
            cy={py(l.acumulada)}
            r={3.5}
            fill={TINTA.primaria}
            stroke={TINTA.superficie}
            strokeWidth={2}
          />
        ))}
      </svg>

      {hover != null && (
        <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-xs)' }}>
          <strong>{lineas[hover].clave}</strong>: {formato(lineas[hover].importe)} ·{' '}
          {lineas[hover].participacion.toFixed(1)} % del gasto · acumulado{' '}
          {lineas[hover].acumulada.toFixed(1)} %
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bullet
// ---------------------------------------------------------------------------

/**
 * Indicador contra su meta, con bandas de tolerancia.
 *
 * Sustituye al termometro simple: las bandas dicen no solo si cumple, sino a
 * que distancia esta de dejar de cumplir, que es la informacion que permite
 * anticipar en lugar de reaccionar.
 */
export function Bullet({
  valor,
  meta,
  maximo,
  color,
  sentido = 'mayorEsMejor',
  formato,
  alto = 22,
}: {
  valor: number | null
  meta: number
  maximo?: number
  color: string
  sentido?: 'mayorEsMejor' | 'menorEsMejor'
  formato?: (n: number) => string
  alto?: number
}) {
  const max = maximo ?? Math.max(meta * 1.35, (valor ?? 0) * 1.15, 1)
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100))
  const fmt = formato ?? ((n: number) => n.toFixed(1))

  // Bandas: aceptable, tolerable, deficiente. La direccion depende del sentido.
  const bandas =
    sentido === 'mayorEsMejor'
      ? [
          { hasta: pct(meta * 0.9), tono: '#FEE2E2' },
          { hasta: pct(meta), tono: '#FEF3C7' },
          { hasta: 100, tono: '#DCFCE7' },
        ]
      : [
          { hasta: pct(meta), tono: '#DCFCE7' },
          { hasta: pct(meta * 2), tono: '#FEF3C7' },
          { hasta: 100, tono: '#FEE2E2' },
        ]

  return (
    <div
      style={{ position: 'relative', height: alto, borderRadius: 4, overflow: 'hidden' }}
      role="img"
      aria-label={
        valor == null
          ? `Sin datos. Meta ${fmt(meta)}.`
          : `Resultado ${fmt(valor)} frente a la meta ${fmt(meta)}.`
      }
    >
      {/* Bandas de tolerancia, de fondo */}
      {bandas.map((b, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: i === 0 ? 0 : `${bandas[i - 1].hasta}%`,
            width: `${b.hasta - (i === 0 ? 0 : bandas[i - 1].hasta)}%`,
            top: 0,
            bottom: 0,
            background: b.tono,
          }}
        />
      ))}

      {/* Barra del resultado, delgada y centrada sobre las bandas */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: alto * 0.28,
          height: alto * 0.44,
          width: `${valor == null ? 0 : pct(valor)}%`,
          background: valor == null ? '#CBD5E1' : color,
          borderRadius: '0 3px 3px 0',
          transition: 'width var(--t-slow)',
        }}
      />

      {/* Marca de la meta */}
      <span
        aria-hidden="true"
        title={`Meta: ${fmt(meta)}`}
        style={{
          position: 'absolute',
          left: `calc(${pct(meta)}% - 1.5px)`,
          top: 1,
          bottom: 1,
          width: 3,
          background: TINTA.primaria,
          borderRadius: 2,
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

/**
 * Tendencia en el espacio de una celda de tabla.
 *
 * Una cifra sin tendencia se malinterpreta: 53 % subiendo y 53 % bajando piden
 * decisiones opuestas. El sparkline pone esa diferencia al lado del numero.
 */
export function Sparkline({
  valores,
  color = SECUENCIAL_INDIGO[5],
  ancho = 84,
  alto = 24,
  referencia,
  etiquetaAria,
}: {
  valores: number[]
  color?: string
  ancho?: number
  alto?: number
  /** Linea de referencia horizontal, por ejemplo la meta. */
  referencia?: number
  etiquetaAria?: string
}) {
  const limpio = valores.filter((v) => Number.isFinite(v))
  if (limpio.length < 2) {
    return (
      <span className="hg-t-xs hg-t-ter" title="Se necesitan al menos dos puntos">
        —
      </span>
    )
  }

  const min = Math.min(...limpio, referencia ?? Infinity)
  const max = Math.max(...limpio, referencia ?? -Infinity)
  const rango = max - min || 1
  const px = (i: number) => (i / (limpio.length - 1)) * (ancho - 4) + 2
  const py = (v: number) => alto - 3 - ((v - min) / rango) * (alto - 6)

  const ultimo = limpio.at(-1)!
  const primero = limpio[0]
  const sube = ultimo >= primero

  return (
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={
        etiquetaAria ??
        `Tendencia de ${limpio.length} periodos, ${sube ? 'ascendente' : 'descendente'}, de ${primero.toFixed(1)} a ${ultimo.toFixed(1)}`
      }
      style={{ display: 'block', overflow: 'visible' }}
    >
      {referencia != null && (
        <line x1={2} x2={ancho - 2} y1={py(referencia)} y2={py(referencia)} stroke={TINTA.rejilla} strokeWidth={1} />
      )}
      <path
        d={limpio.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(v)}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Solo el ultimo punto se marca: es el que se lee junto a la cifra */}
      <circle cx={px(limpio.length - 1)} cy={py(ultimo)} r={2.6} fill={color} stroke={TINTA.superficie} strokeWidth={1.5} />
    </svg>
  )
}
