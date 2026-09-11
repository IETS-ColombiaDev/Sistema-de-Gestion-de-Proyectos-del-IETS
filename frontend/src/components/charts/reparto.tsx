/**
 * Graficos de reparto, comparacion, personas e hitos.
 *
 * Complementan los de valor ganado: aquellos responden "¿como vamos en dinero?"
 * y estos responden "¿como se reparte?", "¿quien lo esta haciendo?" y "¿que
 * viene ahora?". Un comite necesita las cuatro respuestas, no solo la primera.
 *
 *   Dona               ¿como se reparte el total?
 *   BarrasAgrupadas    ¿lo real frente a lo previsto, categoria por categoria?
 *   LineaHitos         ¿que puntos de control vienen y cuales se pasaron?
 *   CargaPersonas      ¿quien carga el trabajo y como le va?
 *
 * Reglas heredadas del sistema: marcas delgadas, separacion de 2 px entre
 * rellenos, rejilla en hairline solido, etiquetas directas selectivas, area de
 * contacto de 24 px o mas, y vista de tabla equivalente para cada figura.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { SECUENCIAL_INDIGO, TINTA, colorSerie, tintaSobre, tonoSecuencial } from './paleta'
import { fuente, useAncho, useLienzo } from '../../lib/useLienzo'


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

// ---------------------------------------------------------------------------
// Dona
// ---------------------------------------------------------------------------

export interface PorcionDona {
  etiqueta: string
  valor: number
  color: string
}

/**
 * Reparto de un total entre pocas categorias.
 *
 * Se usa solo cuando la pregunta es "¿que parte del total es cada cosa?" y hay
 * seis porciones o menos: mas alla de eso los sectores contiguos dejan de
 * distinguirse y una barra comunica mejor. Nunca para comparar valores
 * parecidos entre si —para eso esta la tabla, que va siempre al lado— y nunca
 * como sustituto de una serie temporal.
 *
 * El centro lleva el total, que es el dato que el lector busca primero y que un
 * anillo, por si solo, no da.
 */
export function Dona({
  porciones,
  total,
  etiquetaCentro,
  formato,
  tamano = 190,
  grosor = 26,
}: {
  porciones: PorcionDona[]
  /** Total a mostrar en el centro. Por defecto, la suma de las porciones. */
  total?: number
  etiquetaCentro?: string
  formato?: (n: number) => string
  tamano?: number
  grosor?: number
}) {
  const [activa, setActiva] = useState<number | null>(null)
  const fmt = formato ?? ((n: number) => n.toLocaleString('es-CO'))

  const visibles = useMemo(() => porciones.filter((p) => p.valor > 0), [porciones])
  const suma = visibles.reduce((s, p) => s + p.valor, 0)
  const totalMostrado = total ?? suma

  if (suma <= 0) {
    return <p className="hg-t-sm hg-t-sec">Sin datos para repartir.</p>
  }

  const radio = tamano / 2
  const radioInterno = radio - grosor
  const centro = radio
  // Separacion de 2 px entre porciones, expresada en grados sobre el radio medio.
  const separacion = (2 / ((radio + radioInterno) / 2)) * (180 / Math.PI)

  let anguloActual = -90
  const sectores = visibles.map((p, i) => {
    const barrido = (p.valor / suma) * 360
    const inicio = anguloActual + separacion / 2
    const fin = anguloActual + barrido - separacion / 2
    anguloActual += barrido

    const rad = (g: number) => (g * Math.PI) / 180
    const punto = (r: number, g: number) => `${centro + r * Math.cos(rad(g))},${centro + r * Math.sin(rad(g))}`
    const arcoLargo = barrido > 180 ? 1 : 0
    // Una porcion que ocupa todo el circulo no se puede dibujar con un solo
    // arco: se cierra con dos semicircunferencias.
    const d =
      barrido >= 359.5
        ? `M ${centro},${centro - radio} A ${radio},${radio} 0 1 1 ${centro - 0.01},${centro - radio}` +
          ` L ${centro - 0.01},${centro - radioInterno} A ${radioInterno},${radioInterno} 0 1 0 ${centro},${centro - radioInterno} Z`
        : `M ${punto(radio, inicio)} A ${radio},${radio} 0 ${arcoLargo} 1 ${punto(radio, fin)}` +
          ` L ${punto(radioInterno, fin)} A ${radioInterno},${radioInterno} 0 ${arcoLargo} 0 ${punto(radioInterno, inicio)} Z`

    return { ...p, d, indice: i, porcentaje: (p.valor / suma) * 100 }
  })

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-lg)',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'relative', flex: 'none' }}>
        <svg
          width={tamano}
          height={tamano}
          viewBox={`0 0 ${tamano} ${tamano}`}
          role="img"
          aria-label={`Reparto: ${visibles.map((p) => `${p.etiqueta} ${fmt(p.valor)}`).join('; ')}`}
          onMouseLeave={() => setActiva(null)}
        >
          {sectores.map((s) => (
            <path
              key={s.etiqueta}
              d={s.d}
              fill={s.color}
              opacity={activa == null || activa === s.indice ? 1 : 0.45}
              style={{ transition: 'opacity var(--t-fast)', cursor: 'default' }}
              onMouseEnter={() => setActiva(s.indice)}
            />
          ))}
        </svg>

        {/* El total vive en el centro: es lo primero que se busca. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: activa == null ? 'var(--fs-xl)' : 'var(--fs-lg)',
                fontWeight: 700,
                lineHeight: 1.1,
                color: activa == null ? TINTA.primaria : sectores[activa].color,
              }}
            >
              {activa == null ? fmt(totalMostrado) : fmt(sectores[activa].valor)}
            </div>
            <div className="hg-t-xs hg-t-sec" style={{ maxWidth: tamano - grosor * 2 - 8 }}>
              {activa == null
                ? (etiquetaCentro ?? 'total')
                : `${sectores[activa].porcentaje.toFixed(1)} %`}
            </div>
          </div>
        </div>
      </div>

      {/* La leyenda lleva el valor: la identidad nunca depende solo del color. */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 150, flex: '1 1 150px' }}>
        {sectores.map((s) => (
          <li
            key={s.etiqueta}
            onMouseEnter={() => setActiva(s.indice)}
            onMouseLeave={() => setActiva(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 6px',
              borderRadius: 'var(--r-sm)',
              background: activa === s.indice ? 'var(--c-bg-hover)' : 'transparent',
              fontSize: 'var(--fs-sm)',
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: 'none' }}
            />
            <span style={{ flex: 1, minWidth: 0, color: TINTA.secundaria }}>{s.etiqueta}</span>
            <strong className="hg-t-num">{fmt(s.valor)}</strong>
            <span className="hg-t-xs hg-t-ter hg-t-num" style={{ width: 46, textAlign: 'right' }}>
              {s.porcentaje.toFixed(1)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barras agrupadas
// ---------------------------------------------------------------------------

export interface GrupoBarras {
  etiqueta: string
  valores: number[]
  detalle?: string
}

/**
 * Dos o tres series comparadas categoria por categoria.
 *
 * Es la forma correcta de poner lo real junto a lo previsto: las barras
 * comparten eje y linea base, de modo que la diferencia se lee como diferencia
 * de altura y no hay dos escalas que inventen una relacion.
 */
export function BarrasAgrupadas({
  grupos,
  series,
  formato,
  alto,
  sufijo = '',
}: {
  grupos: GrupoBarras[]
  series: { nombre: string; color: string }[]
  formato: (n: number) => string
  alto?: number
  sufijo?: string
}) {
  const [hover, setHover] = useState<{ g: number; x: number } | null>(null)
  const { ref, W, H, listo, denso, estilo, estiloSvg } = useLienzo(alto)
  const fs = fuente

  if (grupos.length === 0) return <p className="hg-t-sm hg-t-sec">Sin datos para comparar.</p>

  const valoresTodos = grupos.flatMap((g) => g.valores)
  const maximo = Math.max(...valoresTodos, 1)

  /**
   * Marcas del eje.
   *
   * Cuando la magnitud es un recuento —actividades, personas, riesgos— los
   * cuartos no existen: un eje que dice "0,25 actividades" describe algo que no
   * puede ocurrir. Si todos los valores son enteros y el maximo es pequeno, las
   * marcas se ponen de uno en uno; si no, se reparten en cuartos como siempre.
   */
  const esRecuento = valoresTodos.every((v) => Number.isInteger(v))
  const marcasY = esRecuento && maximo <= 8
    ? Array.from({ length: maximo + 1 }, (_, i) => i)
    : [0, 0.25, 0.5, 0.75, 1].map((f) => f * maximo)
  const M = denso
    ? { arriba: 16, derecha: 14, abajo: 56, izquierda: 48 }
    : { arriba: 18, derecha: 16, abajo: 48, izquierda: 52 }
  const anchoUtil = W - M.izquierda - M.derecha
  const altoUtil = H - M.arriba - M.abajo
  const anchoBanda = anchoUtil / grupos.length
  // 2 px de separacion entre barras contiguas del mismo grupo.
  const anchoBarra = Math.min(38, (anchoBanda * 0.72) / series.length - 2)
  const py = (v: number) => M.arriba + altoUtil - (v / maximo) * altoUtil

  return (
    <div ref={ref} style={estilo}>
      {listo && (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={estiloSvg}
        role="img"
        aria-label={`Comparacion de ${series.map((s) => s.nombre).join(' y ')} en ${grupos.length} categorias`}
        onMouseLeave={() => setHover(null)}
      >
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
            <text
              x={M.izquierda - 8}
              y={py(v) + 4}
              textAnchor="end"
              fontSize={fs(10)}
              fill={TINTA.tenue}
            >
              {formato(v)}
            </text>
          </g>
        ))}

        {grupos.map((g, i) => {
          const centro = M.izquierda + (i + 0.5) * anchoBanda
          const anchoGrupo = anchoBarra * series.length + 2 * (series.length - 1)
          return (
            <g key={g.etiqueta}>
              {series.map((s, k) => {
                const v = g.valores[k] ?? 0
                const altura = Math.max(1, M.arriba + altoUtil - py(v))
                const x = centro - anchoGrupo / 2 + k * (anchoBarra + 2)
                return (
                  <rect
                    key={s.nombre}
                    x={x}
                    y={py(v)}
                    width={anchoBarra}
                    height={altura}
                    rx={3}
                    fill={s.color}
                    opacity={hover == null || hover.g === i ? 1 : 0.5}
                  />
                )
              })}
              {/* Zona de contacto por grupo, ancha y comoda */}
              <rect
                x={centro - anchoBanda / 2}
                y={M.arriba}
                width={Math.max(24, anchoBanda)}
                height={altoUtil}
                fill="transparent"
                onMouseEnter={(e) => {
                  const caja = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setHover({ g: i, x: (centro / W) * caja.width })
                }}
              />
              <text
                x={centro}
                y={M.arriba + altoUtil + fs(14)}
                textAnchor="middle"
                fontSize={fs(9)}
                fill={TINTA.secundaria}
              >
                {(() => {
                  // El rotulo se acorta segun el espacio real de la banda: con
                  // nueve categorias no caben dieciseis caracteres.
                  const tope = Math.max(
                    6,
                    Math.floor(anchoBanda / 5.6),
                  )
                  return g.etiqueta.length > tope ? `${g.etiqueta.slice(0, tope - 1)}…` : g.etiqueta
                })()}
              </text>
            </g>
          )
        })}
      </svg>
      )}

      {hover && (
        <Globo x={hover.x} y={M.arriba}>
          <strong>{grupos[hover.g].etiqueta}</strong>
          {series.map((s, k) => (
            <div key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flex: 'none' }} />
              {s.nombre}: {formato(grupos[hover.g].valores[k] ?? 0)}
              {sufijo}
            </div>
          ))}
          {grupos[hover.g].detalle && <div className="hg-t-ter">{grupos[hover.g].detalle}</div>}
        </Globo>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Linea de tiempo de hitos
// ---------------------------------------------------------------------------

export interface HitoLinea {
  id: string
  descripcion: string
  fecha: string
  estado: string
  color: string
  cumplido: boolean
  vencido: boolean
  condicionante: boolean
  desviacionDias: number | null
}

/**
 * Los puntos de control del proyecto sobre una linea de tiempo.
 *
 * Una tabla de hitos ordenada por fecha dice lo mismo, pero no deja ver el
 * agrupamiento: tres hitos en la misma quincena y despues dos meses vacios es
 * una informacion de planeacion que solo aparece cuando el eje es temporal.
 * La fecha de corte parte la linea entre lo que ya debio pasar y lo que viene.
 */
export function LineaHitos({
  hitos,
  fechaCorte,
  desde,
  hasta,
  formatoFecha,
}: {
  hitos: HitoLinea[]
  fechaCorte: string
  desde: string
  hasta: string
  formatoFecha: (f: string) => string
}) {
  const [activo, setActivo] = useState<string | null>(null)
  const { ref, ancho } = useAncho()

  if (hitos.length === 0) {
    return <p className="hg-t-sm hg-t-sec">Sin hitos con fecha programada.</p>
  }

  const aMs = (f: string) => new Date(`${f}T00:00:00Z`).getTime()
  const inicio = aMs(desde)
  const fin = Math.max(aMs(hasta), inicio + 86_400_000)
  const pos = (f: string) => ((aMs(f) - inicio) / (fin - inicio)) * 100

  const ordenados = [...hitos].sort((a, b) => a.fecha.localeCompare(b.fecha))

  /**
   * Reparto en carriles.
   *
   * Dos hitos proximos en el tiempo no caben en la misma fila sin que sus
   * rotulos se pisen. La separacion minima sale del ancho del rotulo sobre el
   * ancho MEDIDO del grafico, y se busca el primer carril donde el hito quepa
   * sin tocar al anterior. Antes ese denominador era un ancho supuesto por
   * contenedor; ahora es el real, de modo que los carriles son los que hacen
   * falta y no los que se estimaron.
   */
  const ANCHO_ROTULO = 112
  const SEPARACION_MINIMA = ((ANCHO_ROTULO + 8) / Math.max(ancho, 240)) * 100

  const carriles: number[] = []
  const conCarril = ordenados.map((h) => {
    const x = pos(h.fecha)
    let carril = carriles.findIndex((ultimo) => x - ultimo >= SEPARACION_MINIMA)
    if (carril === -1) {
      carril = carriles.length
      carriles.push(x)
    } else {
      carriles[carril] = x
    }
    return { ...h, x, carril }
  })
  const totalCarriles = Math.max(1, carriles.length)

  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: 8 }}>
      {/* Eje */}
      <div style={{ position: 'relative', height: 3, background: 'var(--c-border)', borderRadius: 2 }}>
        <span
          aria-hidden="true"
          title={`Fecha de corte: ${formatoFecha(fechaCorte)}`}
          style={{
            position: 'absolute',
            left: `${Math.min(100, Math.max(0, pos(fechaCorte)))}%`,
            top: -7,
            bottom: -7,
            width: 2,
            background: '#4F46E5',
          }}
        />
      </div>

      {/* Extremos del eje */}
      <div className="hg-fila" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span className="hg-t-xs hg-t-ter">{formatoFecha(desde)}</span>
        <span className="hg-t-xs" style={{ color: '#4F46E5', fontWeight: 600 }}>
          corte {formatoFecha(fechaCorte)}
        </span>
        <span className="hg-t-xs hg-t-ter">{formatoFecha(hasta)}</span>
      </div>

      {/* Carriles de hitos */}
      <div ref={ref} style={{ position: 'relative', height: totalCarriles * 44 + 8, marginTop: 6 }}>
        {conCarril.map((h) => (
          <div
            key={h.id}
            style={{
              position: 'absolute',
              left: `${Math.min(99, Math.max(1, h.x))}%`,
              top: h.carril * 44,
              transform: 'translateX(-50%)',
              width: ANCHO_ROTULO,
              textAlign: 'center',
              cursor: 'default',
            }}
            onMouseEnter={() => setActivo(h.id)}
            onMouseLeave={() => setActivo(null)}
          >
            {/* Conector al eje */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: -6,
                height: 6,
                width: 1,
                background: 'var(--c-border-medium)',
              }}
            />
            <span
              title={`${h.descripcion} · ${h.estado}`}
              style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: 16,
                height: 16,
                background: h.color,
                transform: 'rotate(45deg)',
                borderRadius: 3,
                border: '2px solid #fff',
                boxShadow: activo === h.id ? 'var(--sh-md)' : 'var(--sh-sm)',
                marginBottom: 4,
              }}
            />
            <div
              className="hg-t-xs"
              style={{
                lineHeight: 1.25,
                color: h.vencido ? '#B91C1C' : 'var(--c-text-2)',
                fontWeight: h.condicionante ? 600 : 400,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {h.descripcion}
            </div>
            <div className="hg-t-xs hg-t-ter">{formatoFecha(h.fecha)}</div>
          </div>
        ))}
      </div>

      {activo && (
        <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-xs)' }}>
          {(() => {
            const h = conCarril.find((x) => x.id === activo)!
            return (
              <>
                <strong>{h.descripcion}</strong> · {h.estado} · programado {formatoFecha(h.fecha)}
                {h.desviacionDias != null &&
                  ` · ${h.desviacionDias > 0 ? `cumplido ${h.desviacionDias} dia(s) tarde` : 'cumplido a tiempo'}`}
                {h.condicionante && ' · condicionante: su incumplimiento bloquea actividades posteriores'}
              </>
            )
          })()}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Carga por persona
// ---------------------------------------------------------------------------

export interface CargaPersona {
  id: string
  nombre: string
  perfil: string
  /** Segmentos apilados: actividades por estado, por ejemplo. */
  segmentos: { etiqueta: string; valor: number; color: string }[]
  /** Metrica secundaria, como la dedicacion declarada. */
  secundaria?: string
  /** Señal de alerta: RACI incompleta, sobrecarga, perfil sin designar. */
  aviso?: string
}

/**
 * Quien esta cargando el trabajo y en que estado esta ese trabajo.
 *
 * El avance del proyecto no dice si la carga esta repartida. Dos proyectos con
 * el mismo avance, uno con el trabajo concentrado en una persona y otro
 * distribuido, tienen riesgos distintos y piden decisiones distintas. Esta
 * vista hace visible esa diferencia.
 */
export function CargaPersonas({
  personas,
  maximo,
  etiquetaUnidad = 'actividades',
}: {
  personas: CargaPersona[]
  maximo?: number
  etiquetaUnidad?: string
}) {
  const [activa, setActiva] = useState<string | null>(null)

  if (personas.length === 0) {
    return <p className="hg-t-sm hg-t-sec">Sin personas con trabajo asignado.</p>
  }

  const totalDe = (p: CargaPersona) => p.segmentos.reduce((s, x) => s + x.valor, 0)
  const tope = maximo ?? Math.max(...personas.map(totalDe), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {personas.map((p) => {
        const total = totalDe(p)
        const iniciales = (p.nombre || p.perfil)
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((x) => x[0]?.toUpperCase())
          .join('')
        return (
          <div
            key={p.id}
            onMouseEnter={() => setActiva(p.id)}
            onMouseLeave={() => setActiva(null)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(110px, 24%) 1fr auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <span className="hg-avatar hg-avatar--sm" aria-hidden="true">
              {iniciales}
            </span>

            <div style={{ minWidth: 0 }}>
              <div
                className="hg-t-sm"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={`${p.nombre || p.perfil} · ${p.perfil}`}
              >
                {p.nombre || p.perfil}
              </div>
              {/* El perfil se muestra SIEMPRE: sin el no se distingue a la
                  persona del rol que ocupa, y dos personas pueden compartir
                  perfil. La metrica secundaria va detras, no en su lugar. */}
              <div
                className="hg-t-xs hg-t-ter"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {p.perfil}
                {p.secundaria ? ` · ${p.secundaria}` : ''}
              </div>
            </div>

            {/* Barra apilada por estado, con 2 px de separacion entre rellenos */}
            <div
              style={{
                display: 'flex',
                gap: 2,
                height: 20,
                background: 'var(--c-bg-hover)',
                borderRadius: 4,
                overflow: 'hidden',
                width: `${Math.max(4, (total / tope) * 100)}%`,
                minWidth: total > 0 ? 24 : 4,
                opacity: activa == null || activa === p.id ? 1 : 0.55,
                transition: 'opacity var(--t-fast)',
              }}
            >
              {p.segmentos
                .filter((s) => s.valor > 0)
                .map((s) => (
                  <span
                    key={s.etiqueta}
                    title={`${s.etiqueta}: ${s.valor}`}
                    style={{
                      width: `${(s.valor / Math.max(1, total)) * 100}%`,
                      background: s.color,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: tintaSobre(s.color),
                    }}
                  >
                    {(s.valor / Math.max(1, total)) * 100 >= 22 ? s.valor : ''}
                  </span>
                ))}
            </div>

            <span className="hg-fila" style={{ gap: 6, justifyContent: 'flex-end', minWidth: 88 }}>
              {p.aviso && (
                <span
                  className="hg-badge"
                  style={{ background: '#FEF3C7', color: '#92400E' }}
                  title={p.aviso}
                >
                  !
                </span>
              )}
              <strong className="hg-t-num hg-t-sm">{total}</strong>
              <span className="hg-t-xs hg-t-ter">{etiquetaUnidad}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export { SECUENCIAL_INDIGO, colorSerie }

// ---------------------------------------------------------------------------
// Matriz de asignacion: quien esta en que
// ---------------------------------------------------------------------------

export interface CeldaAsignacion {
  /** Actividades de esa persona en esa columna. */
  total: number
  /** Cuantas de ellas estan retrasadas. */
  retrasadas: number
}

export interface FilaAsignacion {
  id: string
  nombre: string
  perfil: string
  celdas: CeldaAsignacion[]
  /** Total de la fila, para ordenar y para el cierre. */
  total: number
}

/**
 * Quien trabaja en que, de un vistazo.
 *
 * La carga por persona dice CUANTO lleva cada quien; no dice DONDE esta. Un
 * equipo puede estar parejo en numero de actividades y, aun asi, tener a cuatro
 * personas amontonadas en una fase y ninguna en la siguiente. Eso solo se ve
 * poniendo a las personas contra las fases.
 *
 * La celda vacia se deja en blanco en vez de escribir un cero: lo que se lee
 * aqui es el PATRON de ocupacion, y una rejilla sembrada de ceros lo esconde.
 * La intensidad sigue una rampa de un solo tono —es una magnitud, no una
 * identidad— y el retraso se marca con un punto, porque el color del semaforo
 * no se mezcla con la rampa.
 */
export function MatrizAsignacion({
  filas,
  columnas,
  onCelda,
  etiquetaUnidad = 'actividad(es)',
}: {
  filas: FilaAsignacion[]
  columnas: string[]
  onCelda?: (filaId: string, columna: number) => void
  etiquetaUnidad?: string
}) {
  const [activa, setActiva] = useState<string | null>(null)

  if (filas.length === 0 || columnas.length === 0) {
    return <p className="hg-t-sm hg-t-sec">Sin asignaciones que mostrar.</p>
  }

  const maximo = Math.max(1, ...filas.flatMap((f) => f.celdas.map((c) => c.total)))

  return (
    <div className="hg-matriz" style={{ overflowX: 'auto' }}>
      <table className="hg-matriz__tabla">
        <caption className="hg-t-xs hg-t-sec" style={{ captionSide: 'bottom', textAlign: 'left', paddingTop: 8 }}>
          Intensidad segun el numero de {etiquetaUnidad}. El punto marca que hay trabajo retrasado en
          esa casilla.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="hg-matriz__esquina">
              Persona
            </th>
            {columnas.map((c) => (
              <th key={c} scope="col" className="hg-matriz__cabecera">
                <span title={c}>{c}</span>
              </th>
            ))}
            <th scope="col" className="hg-matriz__total">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={f.id}
              onMouseEnter={() => setActiva(f.id)}
              onMouseLeave={() => setActiva(null)}
              style={{ opacity: activa == null || activa === f.id ? 1 : 0.6 }}
            >
              <th scope="row" className="hg-matriz__persona">
                <span className="hg-t-sm">{f.nombre}</span>
                <span className="hg-t-xs hg-t-ter">{f.perfil}</span>
              </th>
              {f.celdas.map((c, i) => {
                const fondo = c.total > 0 ? tonoSecuencial(c.total, maximo) : 'transparent'
                return (
                  <td key={i} className="hg-matriz__celda">
                    {c.total > 0 ? (
                      <button
                        type="button"
                        onClick={() => onCelda?.(f.id, i)}
                        disabled={!onCelda}
                        className="hg-matriz__marca"
                        style={{ background: fondo, color: tintaSobre(fondo) }}
                        title={`${f.nombre} · ${columnas[i]}: ${c.total} ${etiquetaUnidad}${
                          c.retrasadas > 0 ? ` · ${c.retrasadas} retrasada(s)` : ''
                        }`}
                      >
                        {c.total}
                        {c.retrasadas > 0 && (
                          <span className="hg-matriz__aviso" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <span className="hg-matriz__vacia" aria-label="sin asignaciones" />
                    )}
                  </td>
                )
              })}
              <td className="hg-matriz__total hg-t-num hg-t-bold">{f.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
