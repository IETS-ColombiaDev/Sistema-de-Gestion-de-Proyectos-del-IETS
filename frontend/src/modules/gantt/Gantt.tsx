/**
 * Diagrama de Gantt — EP-10.
 *
 * Reemplaza el formato condicional de 21 semanas fijas del libro (D-18) por un
 * render por rango de fechas con resolucion configurable. La regla de solape es
 * la misma de RN-11: una actividad ocupa un periodo si inicio <= fin del periodo
 * y fin >= inicio del periodo.
 *
 * El color codifica el estado, pero nunca es el unico canal: cada barra lleva
 * el porcentaje y un patron distinto para "Retrasada".
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import Tabs from '@/components/Tabs'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { IconGantt, IconImprimir } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import {
  aFecha,
  diffDias,
  etiquetaMesCorto,
  finMes,
  formatearFecha,
  inicioMes,
  inicioSemana,
  maxISO,
  minISO,
  sumarDias,
} from '@/domain/fechas'
import { estadoColors } from '@/styles/theme'
import type { ActividadCalculada, ISODate } from '@/domain/types'

type Resolucion = 'semana' | 'mes'

interface Periodo {
  inicio: ISODate
  fin: ISODate
  etiqueta: string
  grupo: string
}

const ANCHO_ETIQUETAS = 300

export default function Gantt() {
  const { datos, resumen, cargando } = useProyecto()
  const [resolucion, setResolucion] = useState<Resolucion>('semana')
  const [zoom, setZoom] = useState(1)
  const contenedor = useRef<HTMLDivElement>(null)

  const proyecto = datos?.proyecto

  const rango = useMemo(() => {
    const acts = (resumen?.actividades ?? []).filter((a) => !a.vacia)
    if (!proyecto) return null
    let inicio = proyecto.fechaInicio
    let fin = proyecto.fechaEntregaFinal
    for (const a of acts) {
      if (a.fechaInicio) inicio = minISO(inicio, a.fechaInicio)
      if (a.fechaFin) fin = maxISO(fin, a.fechaFin)
    }
    inicio = minISO(inicio, proyecto.fechaCorte)
    fin = maxISO(fin, proyecto.fechaCorte)
    return { inicio, fin }
  }, [resumen, proyecto])

  const periodos = useMemo<Periodo[]>(() => {
    if (!rango) return []
    const out: Periodo[] = []
    if (resolucion === 'semana') {
      let cursor = inicioSemana(rango.inicio)
      let guardas = 0
      while (cursor <= rango.fin && guardas++ < 600) {
        const fin = sumarDias(cursor, 6)
        out.push({
          inicio: cursor,
          fin,
          etiqueta: String(aFecha(cursor).getUTCDate()).padStart(2, '0'),
          grupo: etiquetaMesCorto(cursor),
        })
        cursor = sumarDias(cursor, 7)
      }
    } else {
      let cursor = inicioMes(rango.inicio)
      let guardas = 0
      while (cursor <= rango.fin && guardas++ < 200) {
        const fin = finMes(cursor)
        out.push({
          inicio: cursor,
          fin,
          etiqueta: etiquetaMesCorto(cursor).split(' ')[0],
          grupo: String(aFecha(cursor).getUTCFullYear()),
        })
        cursor = sumarDias(fin, 1)
      }
    }
    return out
  }, [rango, resolucion])

  const anchoPeriodo = (resolucion === 'semana' ? 34 : 76) * zoom

  const filas = useMemo(() => {
    if (!proyecto || !resumen) return []
    const out: (
      | { tipo: 'fase'; id: string; nombre: string; avance: number }
      | { tipo: 'actividad'; act: ActividadCalculada }
    )[] = []
    for (const fase of [...proyecto.fases].sort((a, b) => a.orden - b.orden)) {
      const propias = resumen.actividades
        .filter((a) => !a.vacia && a.faseId === fase.id)
        .sort((a, b) => a.orden - b.orden)
      if (propias.length === 0) continue
      const av = resumen.porFase.find((p) => p.faseId === fase.id)
      out.push({ tipo: 'fase', id: fase.id, nombre: fase.nombre, avance: av?.avance ?? 0 })
      propias.forEach((act) => out.push({ tipo: 'actividad', act }))
    }
    return out
  }, [proyecto, resumen])

  // Salto a la fecha de corte al abrir el diagrama.
  useEffect(() => {
    if (!contenedor.current || !rango || periodos.length === 0 || !proyecto) return
    const i = periodos.findIndex((p) => proyecto.fechaCorte >= p.inicio && proyecto.fechaCorte <= p.fin)
    if (i >= 0) {
      contenedor.current.scrollLeft = Math.max(0, i * anchoPeriodo - 240)
    }
  }, [periodos, rango, proyecto, anchoPeriodo])

  if (cargando || !datos || !resumen || !proyecto || !rango) return <Cargando />

  if (filas.length === 0) {
    return (
      <Card titulo="Diagrama de Gantt">
        <Vacio
          titulo="No hay actividades para diagramar"
          texto="El Gantt se construye a partir del cronograma. Registre actividades con fecha de inicio y fin."
          icono={<IconGantt size={24} />}
        />
      </Card>
    )
  }

  const anchoTotal = periodos.length * anchoPeriodo
  const posicionDe = (fecha: ISODate): number => {
    const totalDias = diffDias(periodos[0].inicio, periodos[periodos.length - 1].fin) + 1
    const dias = diffDias(periodos[0].inicio, fecha)
    return (dias / totalDias) * anchoTotal
  }

  const irACorte = () => {
    if (!contenedor.current) return
    contenedor.current.scrollTo({ left: Math.max(0, posicionDe(proyecto.fechaCorte) - 240), behavior: 'smooth' })
  }

  // Agrupacion de encabezados (mes sobre semanas, ano sobre meses).
  const grupos: { nombre: string; ancho: number }[] = []
  for (const p of periodos) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.nombre === p.grupo) ultimo.ancho += anchoPeriodo
    else grupos.push({ nombre: p.grupo, ancho: anchoPeriodo })
  }

  const hitosVisibles = resumen.hitos.filter((h) => h.fechaProgramada)

  return (
    <div className="hg-pila">
      <Card
        titulo="Diagrama de Gantt"
        subtitulo={`${filas.filter((f) => f.tipo === 'actividad').length} actividades · ${formatearFecha(rango.inicio)} a ${formatearFecha(rango.fin)}`}
        acciones={
          <>
            <Tabs
              opciones={[
                { valor: 'semana', etiqueta: 'Semana' },
                { valor: 'mes', etiqueta: 'Mes' },
              ]}
              activa={resolucion}
              onCambiar={(v) => setResolucion(v as Resolucion)}
              etiquetaAria="Resolucion de la linea de tiempo"
            />
            <Button variante="secondary" tamano="sm" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} aria-label="Alejar">
              −
            </Button>
            <Button variante="secondary" tamano="sm" onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))} aria-label="Acercar">
              +
            </Button>
            <Button variante="secondary" tamano="sm" onClick={irACorte}>
              Ir a la fecha de corte
            </Button>
            <Button
              variante="secondary"
              tamano="sm"
              icono={<IconImprimir size={15} />}
              onClick={() => window.print()}
            >
              Exportar
            </Button>
          </>
        }
      >
        <div
          ref={contenedor}
          className="scroll-discreto"
          style={{
            overflowX: 'auto',
            overflowY: 'visible',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-lg)',
            background: '#fff',
          }}
        >
          <div style={{ minWidth: ANCHO_ETIQUETAS + anchoTotal, position: 'relative' }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 4 }}>
              <div
                style={{
                  width: ANCHO_ETIQUETAS,
                  flex: 'none',
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  background: 'var(--c-blue)',
                  color: '#fff',
                  borderRight: '1px solid rgba(255,255,255,.25)',
                  padding: '8px var(--sp-sm)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: 52,
                }}
              >
                Actividad
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', height: 26 }}>
                  {grupos.map((g, i) => (
                    <div
                      key={`${g.nombre}-${i}`}
                      style={{
                        width: g.ancho,
                        flex: 'none',
                        background: 'var(--c-blue)',
                        color: '#fff',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 600,
                        display: 'grid',
                        placeItems: 'center',
                        borderRight: '1px solid rgba(255,255,255,.25)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {g.nombre}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', height: 26 }}>
                  {periodos.map((p) => {
                    const esCorte = proyecto.fechaCorte >= p.inicio && proyecto.fechaCorte <= p.fin
                    return (
                      <div
                        key={p.inicio}
                        title={`${formatearFecha(p.inicio)} — ${formatearFecha(p.fin)}`}
                        style={{
                          width: anchoPeriodo,
                          flex: 'none',
                          background: esCorte ? '#4F46E5' : '#60A5FA',
                          color: '#fff',
                          fontSize: 10,
                          display: 'grid',
                          placeItems: 'center',
                          borderRight: '1px solid rgba(255,255,255,.25)',
                          fontWeight: esCorte ? 700 : 400,
                        }}
                      >
                        {p.etiqueta}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Linea de fecha de corte */}
            <div
              aria-hidden="true"
              title={`Fecha de corte: ${formatearFecha(proyecto.fechaCorte)}`}
              style={{
                position: 'absolute',
                top: 52,
                bottom: 0,
                left: ANCHO_ETIQUETAS + posicionDe(proyecto.fechaCorte),
                width: 2,
                background: '#4F46E5',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            />

            {/* Filas */}
            {filas.map((fila, idx) => {
              if (fila.tipo === 'fase') {
                return (
                  <div key={`fase-${fila.id}`} style={{ display: 'flex', background: 'var(--c-bg-active)' }}>
                    <div
                      style={{
                        width: ANCHO_ETIQUETAS,
                        flex: 'none',
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        background: 'var(--c-bg-active)',
                        borderRight: '1px solid var(--c-border)',
                        borderTop: '1px solid var(--c-border)',
                        padding: '7px var(--sp-sm)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        color: 'var(--c-purple)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fila.nombre}
                      </span>
                      <span className="hg-t-num hg-t-xs">{fila.avance.toFixed(0)} %</span>
                    </div>
                    <div style={{ flex: 1, borderTop: '1px solid var(--c-border)', minHeight: 32 }} />
                  </div>
                )
              }

              const a = fila.act
              const colores = a.estado ? estadoColors.actividad[a.estado] : estadoColors.actividad.Pendiente
              const x = posicionDe(a.fechaInicio as ISODate)
              const ancho = Math.max(
                6,
                posicionDe(sumarDias(a.fechaFin as ISODate, 1)) - x,
              )

              return (
                <div key={a.id} style={{ display: 'flex', background: idx % 2 ? '#fff' : '#FCFDFE' }}>
                  <div
                    style={{
                      width: ANCHO_ETIQUETAS,
                      flex: 'none',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      background: 'inherit',
                      borderRight: '1px solid var(--c-border)',
                      borderTop: '1px solid var(--c-border)',
                      padding: '6px var(--sp-sm) 6px var(--sp-lg)',
                      fontSize: 'var(--fs-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 34,
                    }}
                  >
                    <span className="hg-t-ter hg-t-xs" style={{ width: 22, flex: 'none' }}>
                      {a.numero}
                    </span>
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                      title={`${a.nombre} — ${a.razonEstado}`}
                    >
                      {a.nombre}
                    </span>
                    {a.esCritica && (
                      <span
                        aria-label="Ruta critica"
                        title="Ruta critica"
                        style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flex: 'none' }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      position: 'relative',
                      borderTop: '1px solid var(--c-border)',
                      minHeight: 34,
                      backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${anchoPeriodo - 1}px, var(--c-border) ${anchoPeriodo - 1}px, var(--c-border) ${anchoPeriodo}px)`,
                    }}
                  >
                    <div
                      title={`${a.nombre}
${formatearFecha(a.fechaInicio)} — ${formatearFecha(a.fechaFin)}
Duracion: ${a.duracion} dias · Avance: ${a.avance} % (esperado ${a.avanceEsperado.toFixed(0)} %)
Estado: ${a.estado} — ${a.razonEstado}`}
                      style={{
                        position: 'absolute',
                        left: x,
                        top: 8,
                        width: ancho,
                        height: 18,
                        borderRadius: 4,
                        background: colores.bg,
                        border: `1px solid ${colores.bar}`,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        // Trama diagonal como segundo canal para "Retrasada".
                        backgroundImage:
                          a.estado === 'Retrasada'
                            ? 'repeating-linear-gradient(135deg, rgba(239,68,68,.22) 0 4px, transparent 4px 8px)'
                            : undefined,
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(0, Math.min(100, a.avance))}%`,
                          height: '100%',
                          background: colores.bar,
                          borderRadius: 3,
                        }}
                      />
                      <span
                        className="hg-t-num"
                        style={{
                          position: 'absolute',
                          right: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          color: a.avance > 55 ? '#fff' : colores.fg,
                        }}
                      >
                        {a.avance}%
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Hitos sobre la linea de tiempo */}
            <div style={{ display: 'flex', borderTop: '2px solid var(--c-border)' }}>
              <div
                style={{
                  width: ANCHO_ETIQUETAS,
                  flex: 'none',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  background: '#fff',
                  borderRight: '1px solid var(--c-border)',
                  padding: '10px var(--sp-sm)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: 'var(--c-text-3)',
                }}
              >
                Hitos
              </div>
              <div style={{ flex: 1, position: 'relative', minHeight: 44 }}>
                {hitosVisibles.map((h) => {
                  const color = h.cumplido ? '#10B981' : h.vencido ? '#EF4444' : '#6366F1'
                  return (
                    <div
                      key={h.id}
                      title={`${h.descripcion}
Programado: ${formatearFecha(h.fechaProgramada)}${h.fechaReal ? `
Real: ${formatearFecha(h.fechaReal)}` : ''}
Estado: ${h.estado}`}
                      style={{
                        position: 'absolute',
                        left: posicionDe(h.fechaProgramada as ISODate) - 7,
                        top: 14,
                        width: 14,
                        height: 14,
                        background: color,
                        transform: 'rotate(45deg)',
                        border: '2px solid #fff',
                        boxShadow: 'var(--sh-sm)',
                        borderRadius: 2,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Leyenda: la identidad nunca depende solo del color */}
        <div className="hg-fila" style={{ marginTop: 'var(--sp-md)', gap: 'var(--sp-md)' }}>
          {(['Pendiente', 'En curso', 'Completada', 'Retrasada'] as const).map((e) => (
            <span key={e} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)' }}>
              <span
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 12,
                  borderRadius: 3,
                  background: estadoColors.actividad[e].bg,
                  border: `1px solid ${estadoColors.actividad[e].bar}`,
                  backgroundImage:
                    e === 'Retrasada'
                      ? 'repeating-linear-gradient(135deg, rgba(239,68,68,.28) 0 4px, transparent 4px 8px)'
                      : undefined,
                }}
              />
              {e}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)' }}>
            <span aria-hidden="true" style={{ width: 2, height: 14, background: '#4F46E5' }} />
            Fecha de corte ({formatearFecha(proyecto.fechaCorte)})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)' }}>
            <span
              aria-hidden="true"
              style={{ width: 10, height: 10, background: '#6366F1', transform: 'rotate(45deg)' }}
            />
            Hito
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
            Ruta critica
          </span>
          <Badge fg="#64748B" bg="#F1F5F9" titulo="Cada barra muestra ademas su porcentaje de avance">
            el porcentaje se lee en la barra
          </Badge>
        </div>
      </Card>
    </div>
  )
}
