/**
 * Dashboard general institucional.
 *
 * Reune toda la cartera en una sola lectura y la desagrega por las dimensiones
 * que una direccion pregunta: por lider, por proyecto, por producto, por
 * actividad y por persona.
 *
 * No repite lo que ya hace el Portafolio —que responde "como va el desempeno"
 * con valor ganado— sino la pregunta previa: "que hay, de quien es y en que
 * estado esta". Por eso aqui manda el recuento y la composicion, no el indice.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Badge from '@/components/Badge'
import Tabs from '@/components/Tabs'
import Table from '@/components/ui/Table'
import KPICard from '@/components/Dashboard/KPICard'
import FiltroBarra, { useFiltros, type DefinicionFiltro } from '@/components/FiltroBarra'
import { Pista } from '@/components/Ayuda'
import { Cargando, ErrorVista, Vacio } from '@/components/EstadoVista'
import {
  ALTO,
  BarrasAgrupadas,
  CargaPersonas,
  Dona,
  Figura,
  MatrizAsignacion,
  type FilaAsignacion,
} from '@/components/charts'
import { ESTADO, colorSerie } from '@/components/charts/paleta'
import { usePortafolio } from '@/app/usePortafolio'
import { estadoColors } from '@/styles/theme'
import { iniciales, moneda, monedaCorta, porcentaje } from '@/lib/formato'
import { resumirEntregas } from '@/domain/entregas'
import { ESTADOS_ACTIVIDAD } from '@/domain/types'

type Vista = 'resumen' | 'lideres' | 'productos' | 'actividades' | 'personas'

export default function DashboardGeneral() {
  const { filas, cargando, error } = usePortafolio()
  const [vista, setVista] = useState<Vista>('resumen')

  const definiciones = useMemo<DefinicionFiltro[]>(
    () => [
      {
        clave: 'lider',
        etiqueta: 'Lider',
        tipo: 'select',
        placeholder: 'Todos',
        opciones: [...new Set(filas.map((f) => f.proyecto.liderNombre).filter(Boolean))].sort(),
      },
      {
        clave: 'estado',
        etiqueta: 'Estado del proyecto',
        tipo: 'select',
        placeholder: 'Todos',
        opciones: [...new Set(filas.map((f) => f.proyecto.estado))].sort(),
      },
      {
        clave: 'financiador',
        etiqueta: 'Financiador',
        tipo: 'select',
        placeholder: 'Todos',
        opciones: [...new Set(filas.map((f) => f.proyecto.financiador).filter(Boolean))].sort(),
      },
    ],
    [filas],
  )
  const { valores, set, limpiar, activos } = useFiltros(definiciones, 'gen')

  const visibles = useMemo(
    () =>
      filas.filter((f) => {
        if (valores.lider && f.proyecto.liderNombre !== valores.lider) return false
        if (valores.estado && f.proyecto.estado !== valores.estado) return false
        if (valores.financiador && f.proyecto.financiador !== valores.financiador) return false
        return true
      }),
    [filas, valores.lider, valores.estado, valores.financiador],
  )

  // ---------------------------------------------------------------------
  // Agregados
  // ---------------------------------------------------------------------

  /** Todo el trabajo de la cartera, con su proyecto de origen a cuestas. */
  const universo = useMemo(() => {
    const actividades = visibles.flatMap((f) =>
      f.resumen.actividades
        .filter((a) => !a.vacia)
        .map((a) => ({ ...a, proyecto: f.proyecto })),
    )
    const productos = visibles.flatMap((f) =>
      f.datos.productos.filter((p) => !p.eliminado).map((p) => ({ ...p, proyecto: f.proyecto })),
    )
    const entregas = visibles.flatMap((f) => resumirEntregas(f.datos.entregas).vigentes)
    return { actividades, productos, entregas }
  }, [visibles])

  const porLider = useMemo(() => {
    const mapa = new Map<
      string,
      {
        lider: string
        proyectos: typeof visibles
        presupuesto: number
        valorGanado: number
        actividades: number
        retrasadas: number
        alertas: number
      }
    >()
    for (const f of visibles) {
      const lider = f.proyecto.liderNombre || 'Sin lider asignado'
      const e = mapa.get(lider) ?? {
        lider,
        proyectos: [] as typeof visibles,
        presupuesto: 0,
        valorGanado: 0,
        actividades: 0,
        retrasadas: 0,
        alertas: 0,
      }
      e.proyectos.push(f)
      e.presupuesto += f.analisis.evm.presupuestoTotal ?? 0
      e.valorGanado += f.analisis.evm.valorGanado ?? 0
      e.actividades += f.resumen.actividades.filter((a) => !a.vacia).length
      e.retrasadas += f.resumen.retrasadas.length
      e.alertas += f.alertasCriticas
      mapa.set(lider, e)
    }
    return [...mapa.values()].sort((a, b) => b.presupuesto - a.presupuesto)
  }, [visibles])

  const porEstadoActividad = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const a of universo.actividades) conteo.set(a.estado, (conteo.get(a.estado) ?? 0) + 1)
    return ESTADOS_ACTIVIDAD.filter((e) => (conteo.get(e) ?? 0) > 0).map((e) => ({
      etiqueta: e,
      valor: conteo.get(e) ?? 0,
      color: estadoColors.actividad[e].bar,
    }))
  }, [universo])

  /** Actividades por fase y proyecto, para ver donde esta concentrado el trabajo. */
  const actividadesPorProyecto = useMemo(
    () =>
      visibles.map((f) => {
        const act = f.resumen.actividades.filter((a) => !a.vacia)
        return {
          etiqueta: f.proyecto.codigo,
          valores: [
            act.filter((a) => a.estado === 'Completa').length,
            act.filter((a) => a.estado === 'En curso').length,
            act.filter((a) => a.estado === 'Pendiente').length,
            act.filter((a) => a.estado === 'Retrasada').length,
          ],
        }
      }),
    [visibles],
  )

  /** Personas de toda la cartera, con el proyecto en el que trabajan. */
  const personas = useMemo(() => {
    const mapa = new Map<
      string,
      {
        clave: string
        nombre: string
        perfil: string
        proyectos: string[]
        dedicacion: number
        segmentos: { etiqueta: string; valor: number; color: string }[]
        retrasadas: number
        porDesignar: boolean
      }
    >()
    for (const f of visibles) {
      for (const m of f.datos.equipo) {
        if (m.eliminado) continue
        const nombre = m.porDesignar ? `${m.perfil} — por designar` : m.nombre || m.perfil
        const clave = m.usuarioUid ?? `n:${nombre.trim().toLowerCase()}`
        const suyas = f.resumen.actividades.filter(
          (a) => !a.vacia && (a.responsableId === m.id || a.responsableNombre === (m.nombre || m.perfil)),
        )
        const cuenta = (estado: string) => suyas.filter((a) => a.estado === estado).length
        const e = mapa.get(clave) ?? {
          clave,
          nombre,
          perfil: m.perfil,
          proyectos: [] as string[],
          dedicacion: 0,
          segmentos: (['Completa', 'En curso', 'Pendiente', 'Retrasada'] as const).map((x) => ({
            etiqueta: x,
            valor: 0,
            color: estadoColors.actividad[x].bar,
          })),
          retrasadas: 0,
          porDesignar: m.porDesignar,
        }
        e.proyectos.push(f.proyecto.codigo)
        e.dedicacion += m.dedicacionHorasMes
        e.segmentos = e.segmentos.map((s) => ({ ...s, valor: s.valor + cuenta(s.etiqueta) }))
        e.retrasadas += cuenta('Retrasada')
        mapa.set(clave, e)
      }
    }
    return [...mapa.values()].sort(
      (a, b) =>
        b.segmentos.reduce((s, x) => s + x.valor, 0) - a.segmentos.reduce((s, x) => s + x.valor, 0),
    )
  }, [visibles])

  /** Matriz persona x proyecto: quien trabaja en que, a escala de cartera. */
  const matrizCartera = useMemo<{ columnas: string[]; filas: FilaAsignacion[] }>(() => {
    const columnas = visibles.map((f) => f.proyecto.codigo)
    const mapa = new Map<string, FilaAsignacion & { indice: Map<string, { t: number; r: number }> }>()
    for (const f of visibles) {
      for (const m of f.datos.equipo) {
        if (m.eliminado) continue
        const nombre = m.porDesignar ? `${m.perfil} — por designar` : m.nombre || m.perfil
        const clave = m.usuarioUid ?? `n:${nombre.trim().toLowerCase()}`
        const suyas = f.resumen.actividades.filter(
          (a) => !a.vacia && (a.responsableId === m.id || a.responsableNombre === (m.nombre || m.perfil)),
        )
        if (suyas.length === 0) continue
        const e =
          mapa.get(clave) ??
          {
            id: clave,
            nombre,
            perfil: m.perfil,
            celdas: [],
            total: 0,
            indice: new Map<string, { t: number; r: number }>(),
          }
        e.indice.set(f.proyecto.codigo, {
          t: suyas.length,
          r: suyas.filter((a) => a.estado === 'Retrasada').length,
        })
        e.total += suyas.length
        mapa.set(clave, e)
      }
    }
    const filas = [...mapa.values()]
      .map((e) => ({
        id: e.id,
        nombre: e.nombre,
        perfil: e.perfil,
        total: e.total,
        celdas: columnas.map((c) => ({
          total: e.indice.get(c)?.t ?? 0,
          retrasadas: e.indice.get(c)?.r ?? 0,
        })),
      }))
      .sort((a, b) => b.total - a.total)
    return { columnas, filas }
  }, [visibles])

  if (cargando) return <Cargando />
  if (error) return <ErrorVista titulo="No fue posible cargar la cartera" detalle={error} />
  if (filas.length === 0) {
    return <Vacio titulo="Sin proyectos visibles" texto="No hay proyectos a los que tenga acceso." />
  }

  const productosConformes = universo.productos.filter((p) => p.evaluado && p.conforme).length
  const productosEvaluados = universo.productos.filter((p) => p.evaluado).length

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Proyectos"
          valor={`${visibles.length}`}
          pie={`${visibles.filter((f) => f.proyecto.estado === 'activo').length} activo(s) · ${porLider.length} lider(es)`}
          acento={colorSerie(0)}
          pista="Proyectos que quedan tras el filtro. Un proyecto cerrado sigue contando para el historico."
        />
        <KPICard
          etiqueta="Actividades"
          valor={`${universo.actividades.length}`}
          pie={`${universo.actividades.filter((a) => a.estado === 'Retrasada').length} retrasada(s)`}
          color={
            universo.actividades.some((a) => a.estado === 'Retrasada') ? ESTADO.advertencia : undefined
          }
          acento={colorSerie(1)}
          pista="Suma de las actividades vigentes de todos los proyectos filtrados. Las actividades sin nombre o sin fechas no cuentan."
        />
        <KPICard
          etiqueta="Productos"
          valor={`${universo.productos.length}`}
          pie={
            productosEvaluados === 0
              ? 'Ninguno evaluado todavia'
              : `${productosConformes} de ${productosEvaluados} conformes`
          }
          acento={colorSerie(2)}
          pista="Entregables registrados en el modulo de productos. La conformidad solo se cuenta sobre los que ya fueron evaluados."
        />
        <KPICard
          etiqueta="Personas"
          valor={`${personas.length}`}
          pie={`${personas.filter((p) => p.proyectos.length > 1).length} en mas de un proyecto`}
          acento={colorSerie(3)}
          pista="Personas distintas en toda la cartera. Quien participa en varios proyectos se cuenta una sola vez."
        />
      </div>

      <FiltroBarra
        definiciones={definiciones}
        valores={valores}
        onCambio={set}
        onLimpiar={limpiar}
        activos={activos}
        resumen={`${visibles.length} de ${filas.length} proyecto(s) · ${universo.actividades.length} actividad(es) · ${personas.length} persona(s)`}
      />

      <Tabs
        opciones={[
          { valor: 'resumen', etiqueta: 'Resumen' },
          { valor: 'lideres', etiqueta: 'Por lider', conteo: porLider.length },
          { valor: 'productos', etiqueta: 'Productos', conteo: universo.productos.length },
          { valor: 'actividades', etiqueta: 'Actividades', conteo: universo.actividades.length },
          { valor: 'personas', etiqueta: 'Personas', conteo: personas.length },
        ]}
        activa={vista}
        onCambiar={(v) => setVista(v as Vista)}
        etiquetaAria="Secciones del tablero general"
      />

      {/* ------------------------------------------------------------ */}
      {vista === 'resumen' && (
        <div className="hg-pila">
          <Card
            titulo="La cartera completa"
            subtitulo="Un proyecto por fila, con todo lo que cuelga de el."
          >
            <Table
              anchoMinimo="1040px"
              columnas={[
                {
                  clave: 'proyecto',
                  titulo: 'Proyecto',
                  render: (f: (typeof visibles)[number]) => (
                    <div style={{ minWidth: 0 }}>
                      <Link to={`/proyectos/${f.proyecto.id}/dashboard`} className="hg-t-sm hg-t-bold">
                        {f.proyecto.codigo}
                      </Link>
                      <div className="hg-t-xs hg-t-ter">{f.proyecto.nombre}</div>
                    </div>
                  ),
                },
                {
                  clave: 'lider',
                  titulo: 'Lider',
                  render: (f) => (
                    <div className="hg-fila" style={{ gap: 6 }}>
                      <span className="hg-avatar hg-avatar--sm" aria-hidden="true">
                        {iniciales(f.proyecto.liderNombre || '?')}
                      </span>
                      <span className="hg-t-sm">{f.proyecto.liderNombre || '—'}</span>
                    </div>
                  ),
                },
                {
                  clave: 'equipo',
                  titulo: 'Equipo',
                  alineacion: 'derecha',
                  render: (f) => f.datos.equipo.filter((m) => !m.eliminado).length,
                },
                {
                  clave: 'actividades',
                  titulo: 'Actividades',
                  alineacion: 'derecha',
                  render: (f) => {
                    const act = f.resumen.actividades.filter((a) => !a.vacia)
                    const r = act.filter((a) => a.estado === 'Retrasada').length
                    return (
                      <span className="hg-t-num">
                        {act.length}
                        {r > 0 && (
                          <span style={{ color: ESTADO.critico }}> · {r} retrasada(s)</span>
                        )}
                      </span>
                    )
                  },
                },
                {
                  clave: 'productos',
                  titulo: 'Productos',
                  alineacion: 'derecha',
                  pista: 'Entregables comprometidos en el registro de productos. Es distinto de las entregas: el producto es el compromiso, la entrega es el archivo que lo materializa.',
                  render: (f) => f.datos.productos.filter((p) => !p.eliminado).length,
                },
                {
                  clave: 'entregas',
                  titulo: 'Entregas',
                  alineacion: 'derecha',
                  pista: 'Ultima version de cada entregable registrado. Una entrega devuelta y vuelta a entregar cuenta una sola vez.',
                  render: (f) => {
                    const e = resumirEntregas(f.datos.entregas)
                    return e.total === 0 ? (
                      <span className="hg-t-ter">—</span>
                    ) : (
                      <span className="hg-t-num">
                        {e.total}
                        {e.pendientesDeEvaluar > 0 && (
                          <span style={{ color: ESTADO.advertencia }}> · {e.pendientesDeEvaluar} por evaluar</span>
                        )}
                      </span>
                    )
                  },
                },
                {
                  clave: 'avance',
                  titulo: 'Avance',
                  alineacion: 'derecha',
                  ordenable: true,
                  pista: 'Avance ponderado por duracion de cada actividad. No es el promedio simple: una actividad larga pesa mas que una corta.',
                  valorOrden: (f) => f.resumen.avancePonderado,
                  render: (f) => porcentaje(f.resumen.avancePonderado),
                },
                {
                  clave: 'presupuesto',
                  titulo: 'Presupuesto',
                  alineacion: 'derecha',
                  ordenable: true,
                  valorOrden: (f) => f.analisis.evm.presupuestoTotal ?? 0,
                  render: (f) => monedaCorta(f.analisis.evm.presupuestoTotal ?? 0),
                },
              ]}
              filas={visibles}
              claveDe={(f) => f.proyecto.id}
            />
          </Card>

          <div className="hg-grid hg-grid--2">
            <Card titulo="Estado del trabajo" subtitulo="Todas las actividades de la cartera, por estado.">
              <Figura
                tabla={
                  <Table
                    columnas={[
                      { clave: 'etiqueta', titulo: 'Estado', render: (d: (typeof porEstadoActividad)[number]) => d.etiqueta },
                      { clave: 'valor', titulo: 'Actividades', alineacion: 'derecha', render: (d) => d.valor },
                    ]}
                    filas={porEstadoActividad}
                    claveDe={(d) => d.etiqueta}
                  />
                }
              >
                <Dona porciones={porEstadoActividad} etiquetaCentro="actividades" />
              </Figura>
            </Card>

            <Card
              titulo="Composicion por proyecto"
              subtitulo="Cuantas actividades tiene cada proyecto y en que estado estan."
            >
              <Figura
                leyenda={(['Completa', 'En curso', 'Pendiente', 'Retrasada'] as const).map((e) => ({
                  etiqueta: e,
                  color: estadoColors.actividad[e].bar,
                }))}
                tabla={
                  <Table
                    columnas={[
                      { clave: 'etiqueta', titulo: 'Proyecto', render: (g: (typeof actividadesPorProyecto)[number]) => g.etiqueta },
                      ...(['Completa', 'En curso', 'Pendiente', 'Retrasada'] as const).map((e, i) => ({
                        clave: e,
                        titulo: e,
                        alineacion: 'derecha' as const,
                        render: (g: (typeof actividadesPorProyecto)[number]) => g.valores[i],
                      })),
                    ]}
                    filas={actividadesPorProyecto}
                    claveDe={(g) => g.etiqueta}
                  />
                }
              >
                <BarrasAgrupadas
                  grupos={actividadesPorProyecto}
                  series={(['Completa', 'En curso', 'Pendiente', 'Retrasada'] as const).map((e) => ({
                    nombre: e,
                    color: estadoColors.actividad[e].bar,
                  }))}
                  formato={(n) => `${n}`}
                  sufijo=" act."
                  alto={ALTO.md}
                />
              </Figura>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {vista === 'lideres' && (
        <Card
          titulo="Cartera por lider"
          subtitulo="Cuanto proyecto, cuanto presupuesto y cuanto trabajo atrasado responde cada quien."
        >
          <Table
            anchoMinimo="880px"
            columnas={[
              {
                clave: 'lider',
                titulo: 'Lider',
                render: (l: (typeof porLider)[number]) => (
                  <div className="hg-fila" style={{ gap: 'var(--sp-xs)' }}>
                    <span className="hg-avatar hg-avatar--sm" aria-hidden="true">
                      {iniciales(l.lider)}
                    </span>
                    <span className="hg-t-sm">{l.lider}</span>
                  </div>
                ),
              },
              {
                clave: 'proyectos',
                titulo: 'Proyectos',
                render: (l) => (
                  <div className="hg-fila" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {l.proyectos.map((f) => (
                      <Link
                        key={f.proyecto.id}
                        to={`/proyectos/${f.proyecto.id}/dashboard`}
                        className="hg-etiqueta-enlace"
                        title={f.proyecto.nombre}
                      >
                        {f.proyecto.codigo}
                      </Link>
                    ))}
                  </div>
                ),
              },
              {
                clave: 'presupuesto',
                titulo: 'Presupuesto',
                alineacion: 'derecha',
                ordenable: true,
                valorOrden: (l) => l.presupuesto,
                render: (l) => moneda(l.presupuesto),
              },
              {
                clave: 'avance',
                titulo: 'Avance en dinero',
                alineacion: 'derecha',
                pista: 'Valor ganado sobre presupuesto del conjunto. Se agrega en dinero y no promediando porcentajes: promediar daria el mismo peso a un proyecto de 20 millones que a uno de 500.',
                render: (l) => (
                  <span title="Valor ganado sobre presupuesto: agrega en dinero, no promediando porcentajes.">
                    {l.presupuesto === 0 ? '—' : porcentaje((l.valorGanado / l.presupuesto) * 100)}
                  </span>
                ),
              },
              { clave: 'actividades', titulo: 'Actividades', alineacion: 'derecha', render: (l) => l.actividades },
              {
                clave: 'retrasadas',
                titulo: 'Retrasadas',
                alineacion: 'derecha',
                render: (l) =>
                  l.retrasadas > 0 ? (
                    <strong className="hg-t-num" style={{ color: ESTADO.critico }}>{l.retrasadas}</strong>
                  ) : (
                    <span className="hg-t-ter">—</span>
                  ),
              },
              {
                clave: 'alertas',
                titulo: 'Alertas criticas',
                alineacion: 'derecha',
                render: (l) =>
                  l.alertas > 0 ? (
                    <Badge fg="#B91C1C" bg="#FEE2E2">{l.alertas}</Badge>
                  ) : (
                    <span className="hg-t-ter">—</span>
                  ),
              },
            ]}
            filas={porLider}
            claveDe={(l) => l.lider}
          />
          <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-sm)' }}>
            El <strong>avance en dinero</strong> se calcula como valor ganado sobre presupuesto del
            conjunto, no promediando los porcentajes de cada proyecto: promediar daria el mismo peso a
            un proyecto de 20 millones que a uno de 500.
            <Pista texto="Es el mismo criterio de agregacion que usa el portafolio." />
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------------ */}
      {vista === 'productos' && (
        <Card
          titulo="Productos de la cartera"
          subtitulo="Todos los entregables comprometidos, con su estado de evaluacion y el proyecto del que salen."
        >
          {universo.productos.length === 0 ? (
            <Vacio titulo="Sin productos registrados" texto="Ningun proyecto visible tiene productos en su registro." />
          ) : (
            <Table
              anchoMinimo="900px"
              columnas={[
                {
                  clave: 'entregable',
                  titulo: 'Producto',
                  render: (p: (typeof universo.productos)[number]) => (
                    <div style={{ minWidth: 0 }}>
                      <div className="hg-t-sm">{p.entregable}</div>
                      <div className="hg-t-xs hg-t-ter">{p.responsableNombre || 'Sin responsable'}</div>
                    </div>
                  ),
                },
                {
                  clave: 'proyecto',
                  titulo: 'Proyecto',
                  render: (p) => (
                    <Link to={`/proyectos/${p.proyecto.id}/productos`} className="hg-etiqueta-enlace">
                      {p.proyecto.codigo}
                    </Link>
                  ),
                },
                {
                  clave: 'fechaEntrega',
                  titulo: 'Entrega',
                  render: (p) => p.fechaEntrega ?? <span className="hg-t-ter">sin fecha</span>,
                },
                {
                  clave: 'evaluado',
                  titulo: 'Evaluacion',
                  render: (p) =>
                    !p.evaluado ? (
                      <Badge fg="#64748B" bg="#F1F5F9">Sin evaluar</Badge>
                    ) : p.conforme ? (
                      <Badge fg="#047857" bg="#D1FAE5" punto>Conforme</Badge>
                    ) : (
                      <Badge fg="#B91C1C" bg="#FEE2E2" punto>No conforme</Badge>
                    ),
                },
                {
                  clave: 'observaciones',
                  titulo: 'Observaciones',
                  render: (p) => (
                    <span className="hg-t-xs hg-t-sec">{p.observaciones || '—'}</span>
                  ),
                },
              ]}
              filas={universo.productos}
              claveDe={(p) => p.id}
              claseFila={(p) => (p.evaluado && !p.conforme ? 'hg-fila--critica' : '')}
            />
          )}
        </Card>
      )}

      {/* ------------------------------------------------------------ */}
      {vista === 'actividades' && (
        <Card
          titulo="Actividades de la cartera"
          subtitulo="Todo el trabajo de todos los proyectos, con su responsable y su estado."
        >
          <Table
            anchoMinimo="960px"
            columnas={[
              {
                clave: 'nombre',
                titulo: 'Actividad',
                render: (a: (typeof universo.actividades)[number]) => (
                  <div style={{ minWidth: 0 }}>
                    <div className="hg-t-sm">{a.nombre}</div>
                    <div className="hg-t-xs hg-t-ter">{a.entregable || 'Sin entregable declarado'}</div>
                  </div>
                ),
              },
              {
                clave: 'proyecto',
                titulo: 'Proyecto',
                render: (a) => (
                  <Link to={`/proyectos/${a.proyecto.id}/cronograma`} className="hg-etiqueta-enlace">
                    {a.proyecto.codigo}
                  </Link>
                ),
              },
              {
                clave: 'responsable',
                titulo: 'A cargo',
                render: (a) => a.responsableNombre || <span className="hg-t-ter">sin responsable</span>,
              },
              {
                clave: 'estado',
                titulo: 'Estado',
                render: (a) => (
                  <Badge
                    fg={estadoColors.actividad[a.estado as keyof typeof estadoColors.actividad]?.fg ?? '#64748B'}
                    bg={estadoColors.actividad[a.estado as keyof typeof estadoColors.actividad]?.bg ?? '#F1F5F9'}
                    punto
                  >
                    {a.estado || 'Sin estado'}
                  </Badge>
                ),
              },
              {
                clave: 'avance',
                titulo: 'Avance',
                alineacion: 'derecha',
                ordenable: true,
                valorOrden: (a) => a.avance,
                render: (a) => porcentaje(a.avance),
              },
              { clave: 'fechaFin', titulo: 'Fin', render: (a) => a.fechaFin ?? '—' },
            ]}
            filas={universo.actividades}
            claveDe={(a) => `${a.proyecto.id}-${a.id}`}
            claseFila={(a) => (a.estado === 'Retrasada' ? 'hg-fila--critica' : '')}
          />
        </Card>
      )}

      {/* ------------------------------------------------------------ */}
      {vista === 'personas' && (
        <div className="hg-pila">
          <Card
            titulo="Carga de todo el instituto"
            subtitulo="Cada persona con el trabajo que lleva sumando todos sus proyectos."
          >
            <Figura
              leyenda={(['Completa', 'En curso', 'Pendiente', 'Retrasada'] as const).map((e) => ({
                etiqueta: e,
                color: estadoColors.actividad[e].bar,
              }))}
              tabla={
                <Table
                  anchoMinimo="760px"
                  columnas={[
                    { clave: 'nombre', titulo: 'Persona', render: (p: (typeof personas)[number]) => p.nombre },
                    { clave: 'perfil', titulo: 'Perfil', render: (p) => p.perfil },
                    { clave: 'proyectos', titulo: 'Proyectos', render: (p) => p.proyectos.join(', ') },
                    {
                      clave: 'dedicacion',
                      titulo: 'Dedicacion',
                      alineacion: 'derecha',
                      render: (p) => `${p.dedicacion} h/mes`,
                    },
                    {
                      clave: 'total',
                      titulo: 'Actividades',
                      alineacion: 'derecha',
                      render: (p) => p.segmentos.reduce((s, x) => s + x.valor, 0),
                    },
                  ]}
                  filas={personas}
                  claveDe={(p) => p.clave}
                />
              }
            >
              <CargaPersonas
                personas={personas.map((p) => ({
                  id: p.clave,
                  nombre: p.nombre,
                  perfil: p.perfil,
                  segmentos: p.segmentos,
                  secundaria: `${p.dedicacion} h/mes · ${p.proyectos.length} proyecto(s)`,
                  aviso:
                    p.porDesignar
                      ? 'Perfil sin persona designada'
                      : p.retrasadas > 0
                        ? `${p.retrasadas} actividad(es) retrasada(s)`
                        : undefined,
                }))}
              />
            </Figura>
          </Card>

          <Card
            titulo="Quien trabaja en que proyecto"
            subtitulo="Personas contra proyectos. El punto marca que en esa casilla hay trabajo retrasado."
          >
            {matrizCartera.filas.length === 0 ? (
              <Vacio titulo="Sin asignaciones" texto="Ninguna actividad tiene responsable del grupo desarrollador." />
            ) : (
              <Figura
                tabla={
                  <Table
                    anchoMinimo="720px"
                    columnas={[
                      { clave: 'nombre', titulo: 'Persona', render: (f: FilaAsignacion) => f.nombre },
                      ...matrizCartera.columnas.map((c, i) => ({
                        clave: c,
                        titulo: c,
                        alineacion: 'derecha' as const,
                        render: (f: FilaAsignacion) => f.celdas[i]?.total ?? 0,
                      })),
                      { clave: 'total', titulo: 'Total', alineacion: 'derecha', render: (f: FilaAsignacion) => f.total },
                    ]}
                    filas={matrizCartera.filas}
                    claveDe={(f) => f.id}
                  />
                }
              >
                <MatrizAsignacion filas={matrizCartera.filas} columnas={matrizCartera.columnas} />
              </Figura>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
