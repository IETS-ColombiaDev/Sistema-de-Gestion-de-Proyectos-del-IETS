/**
 * Dashboard ejecutivo — EP-21, ampliado con valor ganado.
 *
 * Este tablero no informa: decide. Su estructura sigue el orden en que un
 * comite necesita la informacion:
 *
 *   1. El veredicto en una frase, con la decision que hay sobre la mesa.
 *   2. Las cuatro cifras que lo sustentan.
 *   3. La curva de valor ganado: como venimos y donde vamos a cerrar.
 *   4. De donde sale el sobrecosto y que parte es accionable.
 *   5. En que fase esta el problema.
 *   6. El detalle operativo, para quien tenga que actuar.
 *
 * Todo se acota con la barra de filtros superior: un solo recorte para todos
 * los graficos.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge, { BadgeEstado } from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Table from '@/components/ui/Table'
import Tabs from '@/components/Tabs'
import { Cargando, Vacio } from '@/components/EstadoVista'
import FiltroBarra, { useFiltros, type DefinicionFiltro } from '@/components/FiltroBarra'
import { Pista } from '@/components/Ayuda'
import {
  MatrizAsignacion,
  ALTO,
  BarrasAgrupadas,
  BarrasDivergentes,
  Bullet,
  CargaPersonas,
  Cascada,
  CurvaS,
  DIVERGENTE,
  Dona,
  ESTADO,
  Figura,
  LineaHitos,
  Pareto,
  RELLENO_RECURSO,
  RELLENO_RIESGO,
  SERIE_EVM,
  Sparkline,
  colorSerie,
  tonoDivergente,
} from '@/components/charts'
import type { FilaAsignacion } from '@/components/charts'
import { pareto } from '@/domain/costos'
import { estadoColors } from '@/styles/theme'
import { IconFlechaDer,
  IconAdvertencia,
  IconCheck,
  IconError,
  IconImprimir,
  IconInfo,
  IconRefrescar,
} from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { definicionPorCodigo, formatearValorIndicador } from '@/domain/indicadores'
import { formatearFecha } from '@/domain/fechas'
import { iniciales, conSigno, moneda, monedaCorta, porcentaje } from '@/lib/formato'
import {
  CATEGORIAS_INDICADOR,
  DISPONIBILIDAD_RECURSO,
  NIVELES_RIESGO,
  type CategoriaIndicador,
} from '@/domain/types'
import type { Diagnostico } from '@/domain/evm'

const COLOR_VEREDICTO: Record<Diagnostico['severidad'], { fg: string; bg: string; Icono: typeof IconCheck }> = {
  bueno: { fg: ESTADO.bueno, bg: '#DCFCE7', Icono: IconCheck },
  atencion: { fg: ESTADO.advertencia, bg: '#FEF3C7', Icono: IconAdvertencia },
  serio: { fg: ESTADO.serio, bg: '#FFEDD5', Icono: IconAdvertencia },
  critico: { fg: ESTADO.critico, bg: '#FEE2E2', Icono: IconError },
  neutro: { fg: '#64748B', bg: '#F1F5F9', Icono: IconInfo },
}

type Vista = 'valor' | 'operacion' | 'equipo' | 'hitos' | 'indicadores'

export default function DashboardEjecutivo() {
  const { datos, resumen, analisis, indicadores, catalogoIndicadores, alertas, instantaneas, cargando, recalcular } =
    useProyecto()
  const [vista, setVista] = useState<Vista>('valor')

  const proyecto = datos?.proyecto
  const fmt = (n: number) => monedaCorta(n)
  const fmtExacto = (n: number) => moneda(n, proyecto?.moneda ?? 'COP')

  // --- Filtros: un solo recorte para todo el tablero ---
  const definiciones = useMemo<DefinicionFiltro[]>(
    () => [
      {
        clave: 'fase',
        etiqueta: 'Fase',
        tipo: 'select',
        placeholder: 'Todas',
        opciones: (proyecto?.fases ?? []).map((f) => ({ valor: f.id, etiqueta: f.nombre })),
        pista: 'Acota el avance por fase, la desviacion de valor y el detalle de actividades.',
      },
      {
        clave: 'rubro',
        etiqueta: 'Rubro',
        tipo: 'select',
        placeholder: 'Todos',
        opciones: [...new Set((datos?.presupuesto ?? []).map((r) => r.rubro))].sort(),
        pista: 'Acota la concentracion del gasto. El valor ganado se calcula siempre sobre el proyecto completo.',
      },
      {
        clave: 'fuente',
        etiqueta: 'Fuente financiera',
        tipo: 'select',
        placeholder: 'Todas',
        ancho: '170px',
        opciones: [...new Set((datos?.presupuesto ?? []).map((r) => r.fuente))].sort(),
      },
      {
        clave: 'severidad',
        etiqueta: 'Severidad de alerta',
        tipo: 'select',
        placeholder: 'Todas',
        ancho: '170px',
        opciones: [
          { valor: 'critica', etiqueta: 'Critica' },
          { valor: 'alta', etiqueta: 'Alta' },
          { valor: 'media', etiqueta: 'Media' },
        ],
      },
    ],
    [proyecto, datos],
  )
  const { valores, set, limpiar, activos } = useFiltros(definiciones, 'de')

  const fases = useMemo(() => {
    const base = analisis?.porFase ?? []
    return valores.fase ? base.filter((f) => f.faseId === valores.fase) : base
  }, [analisis, valores.fase])

  const gastoFiltrado = useMemo(() => {
    let registros = (datos?.presupuesto ?? []).filter((r) => !r.eliminado)
    if (valores.rubro) registros = registros.filter((r) => r.rubro === valores.rubro)
    if (valores.fuente) registros = registros.filter((r) => r.fuente === valores.fuente)
    const porRubro = new Map<string, number>()
    for (const r of registros) {
      porRubro.set(r.rubro, (porRubro.get(r.rubro) ?? 0) + (Number(r.ejecutado) || 0))
    }
    return pareto(
      [...porRubro.entries()].map(([clave, ejecutado]) => ({
        clave,
        ejecutado,
        programado: 0,
        comprometido: 0,
      })),
    )
  }, [datos, valores.rubro, valores.fuente])

  const alertasFiltradas = useMemo(
    () => (valores.severidad ? alertas.filter((a) => a.severidad === valores.severidad) : alertas),
    [alertas, valores.severidad],
  )

  // Serie historica del avance, para los sparklines de tendencia.
  const tendenciaAvance = useMemo(
    () => instantaneas.map((s) => s.avancePonderado),
    [instantaneas],
  )

  /**
   * Carga de trabajo por persona: actividades donde figura como responsable,
   * desagregadas por estado. Es lo que permite ver si el trabajo esta repartido
   * o concentrado, que el avance del proyecto por si solo no dice.
   */
  /**
   * Quienes conforman el equipo, con lo que cada uno tiene entre manos.
   *
   * `resumen.equipo` da los totales, pero no dice quien es quien. Esta es la
   * nomina: la persona, el rol que ocupa, su vinculacion y la actividad en la
   * que esta ahora. Un perfil sin designar se lista igual, porque es capacidad
   * planeada que todavia no existe y esconderlo la haria parecer disponible.
   */
  const nomina = useMemo(() => {
    if (!datos || !resumen) return []
    const fases = new Map(resumen.porFase.map((f) => [f.faseId, f.nombre]))
    return datos.equipo
      .filter((m) => !m.eliminado)
      .map((m) => {
        const suyas = resumen.actividades.filter(
          (a) => !a.vacia && (a.responsableId === m.id || a.responsableNombre === (m.nombre || m.perfil)),
        )
        const enCurso = suyas.filter((a) => a.estado === 'En curso')
        const retrasadas = suyas.filter((a) => a.estado === 'Retrasada')
        const apoyo = resumen.actividades.filter((a) => !a.vacia && a.apoyoIds.includes(m.id))
        // "Donde esta" es la actividad en curso; si no hay ninguna, lo que
        // tiene retrasado; si tampoco, se dice que no tiene trabajo en marcha
        // en vez de dejar la celda muda.
        const ubicacion = enCurso[0] ?? retrasadas[0] ?? null
        return {
          id: m.id,
          nombre: m.porDesignar ? '— por designar —' : m.nombre || m.perfil,
          perfil: m.perfil,
          porDesignar: m.porDesignar,
          vinculacion: m.estadoVinculacion,
          dedicacion: m.dedicacionHorasMes,
          meses: m.mesesVinculacion,
          correo: m.correo ?? '',
          actividades: suyas.length,
          apoyos: apoyo.length,
          retrasadas: retrasadas.length,
          enQue: ubicacion ? ubicacion.nombre : null,
          enQueEstado: ubicacion ? ubicacion.estado : null,
          fase: ubicacion ? (fases.get(ubicacion.faseId) ?? '—') : null,
        }
      })
      .sort((a, b) => b.actividades - a.actividades || a.nombre.localeCompare(b.nombre))
  }, [datos, resumen])

  /** Personas contra fases: donde esta repartido el equipo. */
  const matrizEquipo = useMemo(() => {
    if (!datos || !resumen) return { columnas: [] as string[], filas: [] as FilaAsignacion[] }
    // La lista de fases es la del proyecto, consumida del resumen: el tablero
    // no mantiene una copia propia (D-08).
    const fases = resumen.porFase
    const columnas = fases.map((f) => f.nombre)
    const filas = datos.equipo
      .filter((m) => !m.eliminado)
      .map((m) => {
        const suyas = resumen.actividades.filter(
          (a) => !a.vacia && (a.responsableId === m.id || a.responsableNombre === (m.nombre || m.perfil)),
        )
        const celdas = fases.map((f) => {
          const enFase = suyas.filter((a) => a.faseId === f.faseId)
          return {
            total: enFase.length,
            retrasadas: enFase.filter((a) => a.estado === 'Retrasada').length,
          }
        })
        return {
          id: m.id,
          nombre: m.porDesignar ? '— por designar —' : m.nombre || m.perfil,
          perfil: m.perfil,
          celdas,
          total: suyas.length,
        }
      })
      .filter((f) => f.total > 0)
      .sort((a, b) => b.total - a.total)
    return { columnas, filas }
  }, [datos, resumen])

  const cargaEquipo = useMemo(() => {
    if (!datos || !resumen) return []
    const actividades = resumen.actividades.filter(
      (a) => !a.vacia && (!valores.fase || a.faseId === valores.fase),
    )
    const raciPorMiembro = new Map<string, number>()
    for (const asignacion of datos.raci) {
      if (asignacion.eliminado) continue
      raciPorMiembro.set(asignacion.miembroId, (raciPorMiembro.get(asignacion.miembroId) ?? 0) + 1)
    }

    return datos.equipo
      .map((m) => {
        const propias = actividades.filter(
          (a) => a.responsableId === m.id || a.responsableNombre === (m.nombre || m.perfil),
        )
        const porEstado = (estado: string) => propias.filter((a) => a.estado === estado).length
        const retrasadas = porEstado('Retrasada')
        return {
          id: m.id,
          nombre: m.porDesignar ? `${m.perfil} (por designar)` : m.nombre || m.perfil,
          perfil: m.perfil,
          secundaria: `${m.dedicacionHorasMes} h/mes · ${raciPorMiembro.get(m.id) ?? 0} asignacion(es) RACI`,
          aviso: m.porDesignar
            ? 'Perfil sin persona designada'
            : retrasadas > 0
              ? `${retrasadas} actividad(es) retrasada(s)`
              : undefined,
          segmentos: [
            { etiqueta: 'Completada', valor: porEstado('Completada'), color: estadoColors.actividad.Completada.bar },
            { etiqueta: 'En curso', valor: porEstado('En curso'), color: estadoColors.actividad['En curso'].bar },
            { etiqueta: 'Pendiente', valor: porEstado('Pendiente'), color: estadoColors.actividad.Pendiente.bar },
            { etiqueta: 'Retrasada', valor: retrasadas, color: estadoColors.actividad.Retrasada.bar },
          ],
        }
      })
      .sort(
        (a, b) =>
          b.segmentos.reduce((s, x) => s + x.valor, 0) - a.segmentos.reduce((s, x) => s + x.valor, 0),
      )
  }, [datos, resumen, valores.fase])

  /** Hitos con fecha, para la linea de tiempo. */
  const hitosLinea = useMemo(
    () =>
      (resumen?.hitos ?? [])
        .filter((h) => h.fechaProgramada)
        .map((h) => ({
          id: h.id,
          descripcion: h.descripcion,
          fecha: h.fechaProgramada as string,
          estado: h.estado,
          color: estadoColors.hito[h.estado]?.fg ?? '#64748B',
          cumplido: h.cumplido,
          vencido: h.vencido,
          condicionante: h.condicionante,
          desviacionDias: h.desviacionDias,
        })),
    [resumen],
  )

  if (cargando || !datos || !resumen || !analisis || !proyecto) return <Cargando />

  const { evm, curva, cascada, costos } = analisis
  const v = COLOR_VEREDICTO[evm.diagnostico.severidad]
  const criticas = alertas.filter((a) => a.severidad === 'critica')

  const hitos = {
    cumplidos: resumen.hitos.filter((h) => h.cumplido).length,
    vencidos: resumen.hitos.filter((h) => h.vencido).length,
    pendientes: resumen.hitos.filter((h) => !h.cumplido && !h.vencido).length,
  }

  return (
    <div className="hg-pila print-full">
      {/* ---------------------------------------------------------------- */}
      {/* Encabezado                                                        */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <div className="hg-fila" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="hg-fila" style={{ gap: 'var(--sp-xs)' }}>
              <Badge fg="#4F46E5" bg="#EEF2FF">
                {proyecto.codigo}
              </Badge>
              <Badge
                fg={proyecto.estado === 'activo' ? '#047857' : proyecto.estado === 'cerrado' ? '#64748B' : '#92400E'}
                bg={proyecto.estado === 'activo' ? '#D1FAE5' : proyecto.estado === 'cerrado' ? '#F1F5F9' : '#FEF3C7'}
                punto
              >
                {proyecto.estado}
              </Badge>
              <Badge
                fg={costos.origen === 'externo' ? '#0E7490' : '#64748B'}
                bg={costos.origen === 'externo' ? '#CFFAFE' : '#F1F5F9'}
                titulo={`Fuente del costo real: ${costos.nombreFuente}`}
              >
                costo: {costos.origen}
              </Badge>
            </div>
            <h2 style={{ fontSize: 'var(--fs-xl)', marginTop: 6 }}>{proyecto.nombre}</h2>
            <p className="hg-t-sm hg-t-sec" style={{ marginTop: 4 }}>
              Lider: {proyecto.liderNombre || '—'} · Financiador: {proyecto.financiador || '—'}
            </p>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <span className="hg-etiqueta">Fecha de corte</span>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700 }}>
              {formatearFecha(proyecto.fechaCorte, 'largo')}
            </div>
            <span className="hg-t-xs hg-t-sec">
              Entrega final: {formatearFecha(proyecto.fechaEntregaFinal)} ({resumen.diasRestantes} dias)
            </span>
            <div className="hg-fila hg-fila--fin no-print" style={{ marginTop: 'var(--sp-xs)' }}>
              <Button variante="secondary" tamano="sm" icono={<IconImprimir size={15} />} onClick={() => window.print()}>
                Reporte ejecutivo
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <FiltroBarra
        definiciones={definiciones}
        valores={valores}
        onCambio={set}
        onLimpiar={limpiar}
        activos={activos}
        resumen={`${fases.length} fase(s) · ${gastoFiltrado.length} rubro(s) · ${alertasFiltradas.length} alerta(s)`}
      />

      {proyecto.recalculoPendiente && (
        <Alert
          tipo="warning"
          critico
          titulo="Datos desactualizados"
          mensaje="Hay cambios posteriores al ultimo recalculo. Las cifras se derivan de los datos actuales, pero no se ha guardado instantanea para esta fecha de corte, asi que la curva de valor ganado no incorpora este punto a su historia."
          acciones={
            <Button variante="primary" tamano="sm" icono={<IconRefrescar size={15} />} onClick={() => void recalcular()}>
              Recalcular y guardar instantanea
            </Button>
          }
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 1 · El veredicto                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="hg-veredicto" style={{ borderLeftColor: v.fg }} role="status">
        <span className="hg-veredicto__icono" style={{ background: v.bg, color: v.fg }}>
          <v.Icono size={20} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="hg-fila" style={{ gap: 'var(--sp-xs)' }}>
            <span className="hg-etiqueta">Lectura a la fecha de corte</span>
            <Pista texto="El veredicto se deriva de comparar el trabajo hecho con lo programado y con lo gastado. No es una opinion: es la lectura del valor ganado." />
          </div>
          <h3 className="hg-veredicto__titulo" style={{ color: v.fg }}>
            {evm.diagnostico.titulo}
          </h3>
          <p className="hg-veredicto__texto">{evm.diagnostico.veredicto}</p>
          <div className="hg-veredicto__decision">
            <strong>Decision sobre la mesa: </strong>
            {evm.diagnostico.decision}
          </div>
          {evm.salvedades.length > 0 && (
            <ul className="hg-t-xs hg-t-sec" style={{ margin: 'var(--sp-sm) 0 0', paddingLeft: 'var(--sp-lg)' }}>
              {evm.salvedades.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {criticas.length > 0 && (
        <Alert
          tipo="error"
          critico
          titulo={`${criticas.length} alerta(s) critica(s)`}
          mensaje={criticas.map((a) => a.titulo).join(' · ')}
          acciones={
            <Link to={`/proyectos/${proyecto.id}/tablero`} className="hg-btn hg-btn--danger hg-btn--sm">
              Ver el centro de alertas
            </Link>
          }
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 2 · Las cuatro cifras                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Avance del trabajo"
          valor={porcentaje(resumen.avancePonderado)}
          color={resumen.avancePonderado >= resumen.avanceEsperado ? ESTADO.bueno : ESTADO.advertencia}
          pie={
            <span className="hg-fila" style={{ gap: 6 }}>
              <span>esperado {porcentaje(resumen.avanceEsperado)}</span>
              {tendenciaAvance.length > 1 && (
                <Sparkline valores={tendenciaAvance} etiquetaAria="Tendencia del avance ponderado" />
              )}
            </span>
          }
          acento={SERIE_EVM.ganado}
          pista="Avance ponderado por duracion. La tendencia sale de las instantaneas guardadas en cada fecha de corte."
        />
        <KPICard
          etiqueta="Indice de cronograma"
          valor={evm.indiceCronograma?.toFixed(2) ?? 'Sin datos'}
          color={
            evm.indiceCronograma == null
              ? undefined
              : evm.indiceCronograma >= 0.95
                ? ESTADO.bueno
                : evm.indiceCronograma >= 0.9
                  ? ESTADO.advertencia
                  : ESTADO.critico
          }
          pie={`Valor ganado ${fmt(evm.valorGanado)} de ${fmt(evm.valorPlaneado)} planeado`}
          acento={SERIE_EVM.planeado}
          pista="Valor ganado dividido por valor planeado. 1,00 es estar al dia. 0,80 significa que se ha hecho el 80 % del trabajo que a esta fecha deberia estar hecho."
        />
        <KPICard
          etiqueta="Indice de costo"
          valor={evm.indiceCosto?.toFixed(2) ?? 'Sin datos'}
          color={
            evm.indiceCosto == null
              ? undefined
              : evm.indiceCosto >= 0.95
                ? ESTADO.bueno
                : evm.indiceCosto >= 0.9
                  ? ESTADO.advertencia
                  : ESTADO.critico
          }
          pie={`Costo real ${fmt(evm.costoReal)} · consumo ${porcentaje(evm.consumoPresupuesto)}`}
          acento={SERIE_EVM.real}
          pista="Valor ganado dividido por costo real. 1,00 es gastar exactamente lo que vale el trabajo hecho. 0,80 significa que cada peso de trabajo esta costando 1,25."
        />
        <KPICard
          etiqueta="Proyeccion al cierre"
          valor={evm.proyeccionCierre == null ? 'Sin datos' : fmt(evm.proyeccionCierre)}
          color={
            evm.variacionAlCierre == null
              ? undefined
              : evm.variacionAlCierre >= 0
                ? ESTADO.bueno
                : ESTADO.critico
          }
          pie={
            evm.variacionAlCierre == null
              ? `Presupuesto ${fmt(evm.presupuestoTotal)}`
              : `${conSigno(evm.variacionAlCierre / 1_000_000, 1, ' M')} frente al presupuesto de ${fmt(evm.presupuestoTotal)}`
          }
          acento={evm.variacionAlCierre != null && evm.variacionAlCierre < 0 ? DIVERGENTE.desfavorable : DIVERGENTE.favorable}
          pista="Costo estimado al terminar si el desempeno de costo actual se mantiene: presupuesto dividido por el indice de costo."
        />
      </div>

      <Tabs
        opciones={[
          { valor: 'valor', etiqueta: 'Valor y costo' },
          { valor: 'operacion', etiqueta: 'Operacion', conteo: resumen.retrasadas.length },
          { valor: 'equipo', etiqueta: 'Equipo', conteo: resumen.equipo.porDefinir },
          { valor: 'hitos', etiqueta: 'Hitos', conteo: resumen.hitos.filter((h) => h.vencido).length },
          {
            valor: 'indicadores',
            etiqueta: 'Indicadores',
            conteo: indicadores.filter((i) => i.estado === 'Critico').length,
          },
        ]}
        activa={vista}
        onCambiar={(x) => setVista(x as Vista)}
        etiquetaAria="Secciones del dashboard"
      />

      {/* ================================================================ */}
      {/* Valor y costo                                                     */}
      {/* ================================================================ */}
      {vista === 'valor' && (
        <div className="hg-pila">
          <Card
            titulo="Curva de valor ganado"
            subtitulo="Lo planeado, lo hecho y lo gastado en la misma escala de dinero, con la proyeccion de cierre."
          >
            <Figura
              leyenda={[
                { etiqueta: 'Valor planeado', color: SERIE_EVM.planeado },
                { etiqueta: 'Valor ganado', color: SERIE_EVM.ganado },
                { etiqueta: 'Costo real', color: SERIE_EVM.real },
                { etiqueta: 'Proyeccion de cierre', color: SERIE_EVM.proyectado, discontinua: true },
              ]}
              tabla={
                <Table
                  anchoMinimo="720px"
                  columnas={[
                    { clave: 'periodo', titulo: 'Periodo', render: (p: (typeof curva.puntos)[number]) => p.periodo },
                    {
                      clave: 'planeado',
                      titulo: 'Valor planeado',
                      alineacion: 'derecha',
                      render: (p) => fmtExacto(p.planeado),
                    },
                    {
                      clave: 'ganado',
                      titulo: 'Valor ganado',
                      alineacion: 'derecha',
                      render: (p) => (p.ganado == null ? '—' : fmtExacto(p.ganado)),
                    },
                    {
                      clave: 'real',
                      titulo: 'Costo real',
                      alineacion: 'derecha',
                      render: (p) => (p.real == null ? '—' : fmtExacto(p.real)),
                    },
                    {
                      clave: 'proyectado',
                      titulo: 'Proyeccion',
                      alineacion: 'derecha',
                      render: (p) => (p.proyectado == null ? '—' : fmtExacto(p.proyectado)),
                    },
                  ]}
                  filas={curva.puntos}
                  claveDe={(p) => p.periodo}
                />
              }
            >
              <CurvaS
                puntos={curva.puntos}
                formato={fmt}
                presupuesto={evm.presupuestoTotal}
                alto={ALTO.lg}
              />
            </Figura>

            {curva.ganadoEsPuntual && (
              <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-sm)' }}>
                El valor ganado aparece como un unico punto porque aun no hay instantaneas guardadas. Cada
                recalculo en una fecha de corte agrega un punto a la serie: la trayectoria no se estima, se
                registra.
              </p>
            )}
            {curva.instantaneasUsadas > 0 && (
              <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-sm)' }}>
                Trayectoria reconstruida con {curva.instantaneasUsadas} instantanea(s) historica(s) mas el corte
                vigente.
              </p>
            )}
          </Card>

          <div className="hg-grid hg-grid--2">
            <Card
              titulo="De donde sale la diferencia"
              subtitulo="Del presupuesto aprobado a la proyeccion de cierre, paso por paso."
            >
              <Figura
                leyenda={[
                  { etiqueta: 'Encarece el cierre', color: DIVERGENTE.desfavorable },
                  { etiqueta: 'Abarata el cierre', color: DIVERGENTE.favorable },
                ]}
                tabla={
                  <Table
                    columnas={[
                      { clave: 'etiqueta', titulo: 'Concepto', render: (p: (typeof cascada)[number]) => p.etiqueta },
                      {
                        clave: 'valor',
                        titulo: 'Importe',
                        alineacion: 'derecha',
                        render: (p) => fmtExacto(p.valor),
                      },
                      {
                        clave: 'explicacion',
                        titulo: 'Que significa',
                        render: (p) => <span className="hg-t-xs hg-t-sec">{p.explicacion}</span>,
                      },
                    ]}
                    filas={cascada}
                    claveDe={(p) => p.etiqueta}
                  />
                }
              >
                <Cascada pasos={cascada} formato={fmt} />
              </Figura>
              {evm.eficienciaRequerida != null && (
                <div
                  className="hg-fila"
                  style={{
                    marginTop: 'var(--sp-md)',
                    padding: 'var(--sp-sm) var(--sp-md)',
                    borderRadius: 'var(--r-base)',
                    background: evm.eficienciaRequerida > 1.1 ? '#FEF2F2' : 'var(--c-bg-hover)',
                    color: evm.eficienciaRequerida > 1.1 ? '#7F1D1D' : 'var(--c-text-2)',
                  }}
                >
                  <span className="hg-t-sm">
                    Para cerrar dentro del presupuesto habria que sostener una eficiencia de{' '}
                    <strong>{evm.eficienciaRequerida.toFixed(2)}</strong> en el trabajo restante
                    {evm.eficienciaRequerida > 1.1
                      ? ', lo que en la practica no es alcanzable.'
                      : ', lo que es exigente pero posible.'}
                  </span>
                  <Pista texto="Compara el trabajo que falta con el presupuesto que queda. Por encima de 1,10 la experiencia dice que no se recupera apretando la ejecucion." />
                </div>
              )}
            </Card>

            <Card
              titulo="Concentracion del gasto"
              subtitulo="Que rubros explican la mayor parte del dinero ejecutado."
            >
              {gastoFiltrado.length === 0 ? (
                <Vacio
                  titulo="Sin gasto registrado"
                  texto="Registre el control presupuestal del periodo para ver donde se concentra el dinero."
                />
              ) : (
                <Figura
                  descripcion="Barras: participacion de cada rubro. Trazo: participacion acumulada."
                  tabla={
                    <Table
                      columnas={[
                        { clave: 'clave', titulo: 'Rubro', render: (l: (typeof gastoFiltrado)[number]) => l.clave },
                        {
                          clave: 'importe',
                          titulo: 'Ejecutado',
                          alineacion: 'derecha',
                          render: (l) => fmtExacto(l.ejecutado),
                        },
                        {
                          clave: 'participacion',
                          titulo: 'Participacion',
                          alineacion: 'derecha',
                          render: (l) => porcentaje(l.participacion),
                        },
                        {
                          clave: 'acumulada',
                          titulo: 'Acumulada',
                          alineacion: 'derecha',
                          render: (l) => porcentaje(l.acumulada),
                        },
                      ]}
                      filas={gastoFiltrado}
                      claveDe={(l) => l.clave}
                    />
                  }
                >
                  <Pareto
                    lineas={gastoFiltrado.map((l) => ({ ...l, importe: l.ejecutado }))}
                    formato={fmtExacto}
                  />
                </Figura>
              )}
            </Card>
          </div>

          <div className="hg-grid hg-grid--kpi">
            <KPICard
              etiqueta="Ritmo de gasto"
              valor={fmt(costos.ritmoMensual)}
              pie="Promedio de los ultimos periodos con movimiento"
              pista="Promedio del gasto de los tres ultimos periodos con movimiento. Tres suaviza un mes atipico sin diluir un cambio real de tendencia."
            />
            <KPICard
              etiqueta="Cobertura restante"
              valor={costos.mesesDeCobertura == null ? '—' : `${costos.mesesDeCobertura} meses`}
              color={
                costos.mesesDeCobertura != null && costos.mesesDeCobertura < 2
                  ? ESTADO.critico
                  : undefined
              }
              pie="Al ritmo actual, con lo que queda"
              pista="Presupuesto disponible dividido por el ritmo de gasto. Es el horizonte antes de quedarse sin recursos."
            />
            <KPICard
              etiqueta="Comprometido"
              valor={fmt(costos.comprometidoTotal)}
              pie={
                costos.origen === 'interno'
                  ? 'El libro interno no lo distingue aun'
                  : `Segun ${costos.nombreFuente}`
              }
              pista="Ordenes y contratos firmados y no causados. El libro presupuestal interno no separa este concepto; la herramienta de costos si lo hara."
            />
          </div>

          <Card
            titulo="Donde esta el problema"
            subtitulo="Desviacion de valor por fase: cuanto trabajo falta frente a lo que la programacion esperaba, en dinero."
          >
            {fases.length === 0 ? (
              <Vacio titulo="Sin fases con actividades" texto="Asigne fase a las actividades del cronograma." />
            ) : (
              <Figura
                leyenda={[
                  { etiqueta: 'Adelanta valor', color: DIVERGENTE.favorable },
                  { etiqueta: 'Atrasa valor', color: DIVERGENTE.desfavorable },
                ]}
                tabla={
                  <Table
                    anchoMinimo="820px"
                    columnas={[
                      { clave: 'nombre', titulo: 'Fase', render: (f: (typeof fases)[number]) => f.nombre },
                      { clave: 'peso', titulo: 'Peso', alineacion: 'derecha', render: (f) => porcentaje(f.peso) },
                      {
                        clave: 'valorPlaneado',
                        titulo: 'Valor planeado',
                        alineacion: 'derecha',
                        render: (f) => fmtExacto(f.valorPlaneado),
                      },
                      {
                        clave: 'valorGanado',
                        titulo: 'Valor ganado',
                        alineacion: 'derecha',
                        render: (f) => fmtExacto(f.valorGanado),
                      },
                      {
                        clave: 'variacionCronograma',
                        titulo: 'Desviacion',
                        alineacion: 'derecha',
                        render: (f) => (
                          <span style={{ color: tonoDivergente(f.variacionCronograma), fontWeight: 600 }}>
                            {conSigno(f.variacionCronograma / 1_000_000, 1, ' M')}
                          </span>
                        ),
                      },
                      {
                        clave: 'indiceCronograma',
                        titulo: 'Indice',
                        alineacion: 'derecha',
                        render: (f) => f.indiceCronograma?.toFixed(2) ?? '—',
                      },
                      { clave: 'retrasadas', titulo: 'Retrasadas', alineacion: 'derecha', render: (f) => f.retrasadas },
                    ]}
                    filas={fases}
                    claveDe={(f) => f.faseId}
                  />
                }
              >
                <BarrasDivergentes
                  datos={[...fases]
                    .sort((a, b) => a.variacionCronograma - b.variacionCronograma)
                    .map((f) => ({
                      etiqueta: f.nombre,
                      valor: f.variacionCronograma,
                      detalle: `${f.nombre}: ${f.actividades} actividad(es), peso ${porcentaje(f.peso)} del proyecto, avance ${porcentaje(f.avance)} frente a ${porcentaje(f.avanceEsperado)} esperado.`,
                    }))}
                  formato={fmt}
                />
              </Figura>
            )}
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {/* Operacion                                                         */}
      {/* ================================================================ */}
      {vista === 'operacion' && (
        <div className="hg-pila">
          <div className="hg-grid hg-grid--2">
            <Card
              titulo="Reparto de actividades"
              subtitulo="Como se distribuyen las actividades vigentes entre los cuatro estados."
            >
              <Figura
                tabla={
                  <Table
                    columnas={[
                      {
                        clave: 'estado',
                        titulo: 'Estado',
                        render: (d: (typeof resumen.distribucion)[number]) => d.estado || 'Sin estado',
                      },
                      { clave: 'conteo', titulo: 'Actividades', alineacion: 'derecha', render: (d) => d.conteo },
                      { clave: 'pct', titulo: '%', alineacion: 'derecha', render: (d) => porcentaje(d.porcentaje) },
                    ]}
                    filas={resumen.distribucion}
                    claveDe={(d) => d.estado || 'v'}
                  />
                }
              >
                <Dona
                  porciones={resumen.distribucion.map((d) => ({
                    etiqueta: d.estado || 'Sin estado',
                    valor: d.conteo,
                    color: d.estado ? estadoColors.actividad[d.estado].bar : '#CBD5E1',
                  }))}
                  etiquetaCentro="actividades"
                />
              </Figura>
            </Card>

            <Card titulo="Riesgos abiertos por nivel" subtitulo="Severidad de los riesgos que siguen vivos.">
              <Figura
                tabla={
                  <Table
                    columnas={[
                      { clave: 'nivel', titulo: 'Nivel', render: (r: { nivel: string; n: number }) => r.nivel },
                      { clave: 'n', titulo: 'Riesgos', alineacion: 'derecha', render: (r) => r.n },
                    ]}
                    filas={NIVELES_RIESGO.map((nivel) => ({
                      nivel,
                      n: resumen.riesgos.filter((r) => r.nivel === nivel && r.estado !== 'Cerrado').length,
                    }))}
                    claveDe={(r) => r.nivel}
                  />
                }
              >
                <Dona
                  porciones={NIVELES_RIESGO.map((nivel) => ({
                    etiqueta: nivel,
                    valor: resumen.riesgos.filter((r) => r.nivel === nivel && r.estado !== 'Cerrado').length,
                    color: RELLENO_RIESGO[nivel],
                  }))}
                  etiquetaCentro="riesgos abiertos"
                />
              </Figura>
            </Card>
          </div>

          <Card
            titulo="Avance real frente a lo programado, fase por fase"
            subtitulo="Dos barras por fase sobre la misma linea base: la diferencia de altura es la desviacion."
          >
            {fases.length === 0 ? (
              <Vacio titulo="Sin fases con actividades" texto="Asigne fase a las actividades del cronograma." />
            ) : (
              <Figura
                leyenda={[
                  { etiqueta: 'Avance real', color: colorSerie(0) },
                  { etiqueta: 'Avance esperado', color: colorSerie(1) },
                ]}
                tabla={
                  <Table
                    anchoMinimo="700px"
                    columnas={[
                      { clave: 'nombre', titulo: 'Fase', render: (f: (typeof fases)[number]) => f.nombre },
                      { clave: 'actividades', titulo: 'Actividades', alineacion: 'derecha', render: (f) => f.actividades },
                      { clave: 'avance', titulo: 'Real', alineacion: 'derecha', render: (f) => porcentaje(f.avance) },
                      {
                        clave: 'avanceEsperado',
                        titulo: 'Esperado',
                        alineacion: 'derecha',
                        render: (f) => porcentaje(f.avanceEsperado),
                      },
                      { clave: 'retrasadas', titulo: 'Retrasadas', alineacion: 'derecha', render: (f) => f.retrasadas },
                    ]}
                    filas={fases}
                    claveDe={(f) => f.faseId}
                  />
                }
              >
                <BarrasAgrupadas
                  grupos={fases.map((f) => ({
                    etiqueta: f.nombre,
                    valores: [f.avance, f.avanceEsperado],
                    detalle: `${f.actividades} actividad(es) · ${f.retrasadas} retrasada(s)`,
                  }))}
                  series={[
                    { nombre: 'Avance real', color: colorSerie(0) },
                    { nombre: 'Avance esperado', color: colorSerie(1) },
                  ]}
                  formato={(n) => `${n.toFixed(0)} %`}
                  sufijo=" %"
                />
              </Figura>
            )}
          </Card>

          <div className="hg-grid hg-grid--2">
            <Card titulo="Recursos por disponibilidad" subtitulo="Lo que esta asegurado y lo que falta gestionar.">
              <Figura
                tabla={
                  <Table
                    columnas={[
                      { clave: 'd', titulo: 'Disponibilidad', render: (r: { d: string; n: number }) => r.d },
                      { clave: 'n', titulo: 'Recursos', alineacion: 'derecha', render: (r) => r.n },
                    ]}
                    filas={DISPONIBILIDAD_RECURSO.map((d) => ({
                      d,
                      n: datos.recursos.filter((r) => r.disponibilidad === d).length,
                    }))}
                    claveDe={(r) => r.d}
                  />
                }
              >
                <Dona
                  porciones={DISPONIBILIDAD_RECURSO.map((d) => ({
                    etiqueta: d,
                    valor: datos.recursos.filter((r) => r.disponibilidad === d).length,
                    color: RELLENO_RECURSO[d],
                  }))}
                  etiquetaCentro="recursos"
                />
              </Figura>
              {resumen.recursos.porGestionar > 0 && (
                <p className="hg-t-xs" style={{ marginTop: 'var(--sp-sm)', color: '#92400E' }}>
                  {resumen.recursos.porGestionar} recurso(s) por gestionar requieren accion antes de la fase en
                  que se necesitan.
                </p>
              )}
            </Card>

            <Card
              titulo="Alertas activas"
              subtitulo="Cada alerta lleva su regla de origen y la ruta donde se resuelve."
            >
              {alertasFiltradas.length === 0 ? (
                <Vacio
                  titulo={
                    activos.includes('severidad') ? 'Sin alertas de esa severidad' : 'El proyecto no presenta alertas'
                  }
                  texto="A la fecha de corte no hay desviaciones que requieran atencion."
                  icono={<IconCheck size={24} />}
                />
              ) : (
                <div className="hg-pila" style={{ gap: 'var(--sp-xs)' }}>
                  {alertasFiltradas.slice(0, 6).map((a) => (
                    <div
                      key={a.id}
                      className="hg-fila"
                      style={{
                        gap: 'var(--sp-xs)',
                        padding: 'var(--sp-xs) var(--sp-sm)',
                        borderRadius: 'var(--r-base)',
                        borderLeft: `3px solid ${
                          a.severidad === 'critica'
                            ? ESTADO.critico
                            : a.severidad === 'alta'
                              ? ESTADO.serio
                              : ESTADO.advertencia
                        }`,
                        background: 'var(--c-bg-hover)',
                        alignItems: 'flex-start',
                        flexWrap: 'nowrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="hg-t-sm hg-t-bold">{a.titulo}</div>
                        <div className="hg-t-xs hg-t-sec">
                          {a.modulo} · {a.regla}
                        </div>
                      </div>
                      <Link to={a.ruta} className="hg-t-xs" style={{ flex: 'none' }}>
                        Resolver
                      </Link>
                    </div>
                  ))}
                  {alertasFiltradas.length > 6 && (
                    <Link to={`/proyectos/${proyecto.id}/tablero`} className="hg-t-xs">
                      Ver las {alertasFiltradas.length} alertas en el centro de alertas
                    </Link>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Equipo                                                            */}
      {/* ================================================================ */}
      {vista === 'equipo' && (
        <div className="hg-pila">
          <div className="hg-grid hg-grid--kpi">
            <KPICard
              etiqueta="Integrantes"
              valor={resumen.equipo.total}
              pie={`${resumen.equipo.contratados} contratado(s)`}
              acento={colorSerie(0)}
            />
            <KPICard
              etiqueta="Perfiles por designar"
              valor={resumen.equipo.porDefinir}
              color={resumen.equipo.porDefinir > 0 ? ESTADO.advertencia : ESTADO.bueno}
              pie="Registrados sin persona asignada"
              acento={ESTADO.advertencia}
              pista="Un perfil sin persona designada es capacidad planeada que todavia no existe."
            />
            <KPICard
              etiqueta="Dedicacion del equipo"
              valor={`${resumen.equipo.dedicacionTotalHorasMes} h/mes`}
              pie="Suma de la dedicacion declarada"
              acento={colorSerie(1)}
            />
            <KPICard
              etiqueta="Actividades sin responsable"
              valor={
                resumen.actividades.filter((a) => !a.vacia && !a.responsableNombre.trim()).length
              }
              color={
                resumen.actividades.filter((a) => !a.vacia && !a.responsableNombre.trim()).length > 0
                  ? ESTADO.critico
                  : ESTADO.bueno
              }
              pie="Trabajo que no tiene a quien preguntarle"
              acento={ESTADO.critico}
            />
          </div>

          <Card
            titulo="Quienes conforman el equipo"
            subtitulo={`${nomina.length} persona(s) registradas en el grupo desarrollador, con la actividad en la que estan ahora.`}
            acciones={
              <Link to={`/proyectos/${proyecto.id}/equipo`} className="hg-btn hg-btn--ghost hg-btn--sm no-print">
                Administrar equipo <IconFlechaDer size={14} />
              </Link>
            }
          >
            {nomina.length === 0 ? (
              <Vacio
                titulo="Sin grupo desarrollador"
                texto="Registre los perfiles del equipo en el modulo Grupo desarrollador."
              />
            ) : (
              <Table
                anchoMinimo="880px"
                columnas={[
                  {
                    clave: 'nombre',
                    titulo: 'Persona',
                    render: (m: (typeof nomina)[number]) => (
                      <div className="hg-fila" style={{ gap: 'var(--sp-xs)' }}>
                        <span className="hg-avatar hg-avatar--sm" aria-hidden="true">
                          {m.porDesignar ? '?' : iniciales(m.nombre)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="hg-t-sm">{m.nombre}</div>
                          {m.correo && <div className="hg-t-xs hg-t-ter">{m.correo}</div>}
                        </div>
                      </div>
                    ),
                  },
                  { clave: 'perfil', titulo: 'Perfil', render: (m) => m.perfil },
                  {
                    clave: 'vinculacion',
                    titulo: 'Vinculacion',
                    render: (m) => <BadgeEstado familia="recurso" valor={m.vinculacion} />,
                  },
                  {
                    clave: 'dedicacion',
                    titulo: 'Dedicacion',
                    alineacion: 'derecha',
                    render: (m) => `${m.dedicacion} h/mes`,
                  },
                  {
                    clave: 'enQue',
                    titulo: 'En que esta',
                    render: (m) =>
                      m.enQue == null ? (
                        <span className="hg-t-xs hg-t-ter">Sin actividad en marcha</span>
                      ) : (
                        <div style={{ minWidth: 0 }}>
                          <div className="hg-t-sm">{m.enQue}</div>
                          <div className="hg-t-xs hg-t-ter">
                            {m.fase} · {m.enQueEstado}
                          </div>
                        </div>
                      ),
                  },
                  {
                    clave: 'actividades',
                    titulo: 'A cargo',
                    alineacion: 'derecha',
                    render: (m) => (
                      <span className="hg-t-num">
                        {m.actividades}
                        {m.apoyos > 0 && <span className="hg-t-xs hg-t-ter"> +{m.apoyos} apoyo</span>}
                      </span>
                    ),
                  },
                  {
                    clave: 'retrasadas',
                    titulo: 'Retrasadas',
                    alineacion: 'derecha',
                    render: (m) =>
                      m.retrasadas > 0 ? (
                        <strong className="hg-t-num" style={{ color: ESTADO.critico }}>
                          {m.retrasadas}
                        </strong>
                      ) : (
                        <span className="hg-t-ter">—</span>
                      ),
                  },
                ]}
                filas={nomina}
                claveDe={(m) => m.id}
              />
            )}
          </Card>

          <Card
            titulo="Donde esta el equipo"
            subtitulo="Personas contra fases del proyecto. Deja ver si el equipo esta amontonado en una fase y ausente en la siguiente."
          >
            {matrizEquipo.filas.length === 0 ? (
              <Vacio
                titulo="Sin asignaciones por fase"
                texto="Ninguna actividad tiene responsable del grupo desarrollador."
              />
            ) : (
              <Figura
                tabla={
                  <Table
                    anchoMinimo="720px"
                    columnas={[
                      {
                        clave: 'nombre',
                        titulo: 'Persona',
                        render: (f: (typeof matrizEquipo.filas)[number]) => f.nombre,
                      },
                      ...matrizEquipo.columnas.map((c, i) => ({
                        clave: c,
                        titulo: c,
                        alineacion: 'derecha' as const,
                        render: (f: (typeof matrizEquipo.filas)[number]) => f.celdas[i]?.total ?? 0,
                      })),
                      {
                        clave: 'total',
                        titulo: 'Total',
                        alineacion: 'derecha',
                        render: (f) => f.total,
                      },
                    ]}
                    filas={matrizEquipo.filas}
                    claveDe={(f) => f.id}
                  />
                }
              >
                <MatrizAsignacion filas={matrizEquipo.filas} columnas={matrizEquipo.columnas} />
              </Figura>
            )}
          </Card>

          <Card
            titulo="Carga de trabajo por persona"
            subtitulo="Actividades donde figura como responsable, desagregadas por estado."
          >
            <Figura
              leyenda={(['Completada', 'En curso', 'Pendiente', 'Retrasada'] as const).map((e) => ({
                etiqueta: e,
                color: estadoColors.actividad[e].bar,
              }))}
              tabla={
                <Table
                  anchoMinimo="720px"
                  columnas={[
                    { clave: 'nombre', titulo: 'Persona', render: (p: (typeof cargaEquipo)[number]) => p.nombre },
                    { clave: 'perfil', titulo: 'Perfil', render: (p) => p.perfil },
                    {
                      clave: 'total',
                      titulo: 'Actividades',
                      alineacion: 'derecha',
                      render: (p) => p.segmentos.reduce((s, x) => s + x.valor, 0),
                    },
                    ...(['Completada', 'En curso', 'Pendiente', 'Retrasada'] as const).map((e) => ({
                      clave: e,
                      titulo: e,
                      alineacion: 'derecha' as const,
                      render: (p: (typeof cargaEquipo)[number]) =>
                        p.segmentos.find((s) => s.etiqueta === e)?.valor ?? 0,
                    })),
                  ]}
                  filas={cargaEquipo}
                  claveDe={(p) => p.id}
                />
              }
            >
              <CargaPersonas personas={cargaEquipo} />
            </Figura>
            <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-md)' }}>
              El avance del proyecto no dice si la carga esta repartida. Dos proyectos con el mismo avance, uno
              con el trabajo concentrado en una persona y otro distribuido, tienen riesgos distintos.
            </p>
          </Card>

          <div className="hg-grid hg-grid--2">
            <Card titulo="Estado de vinculacion" subtitulo="Situacion contractual del grupo desarrollador.">
              <Figura
                tabla={
                  <Table
                    columnas={[
                      { clave: 'estado', titulo: 'Estado', render: (r: { estado: string; n: number }) => r.estado },
                      { clave: 'n', titulo: 'Personas', alineacion: 'derecha', render: (r) => r.n },
                    ]}
                    filas={Object.entries(resumen.equipo.porEstado).map(([estado, n]) => ({ estado, n }))}
                    claveDe={(r) => r.estado}
                  />
                }
              >
                <Dona
                  porciones={Object.entries(resumen.equipo.porEstado).map(([estado, n], i) => ({
                    etiqueta: estado,
                    valor: n,
                    color: colorSerie(i),
                  }))}
                  etiquetaCentro="integrantes"
                />
              </Figura>
            </Card>

            <Card
              titulo="Integridad de responsabilidades"
              subtitulo="Actividades sin un responsable final unico (A) o sin ejecutor (R)."
            >
              {resumen.raci.filter((r) => !r.conforme).length === 0 ? (
                <Vacio
                  titulo="Matriz RACI completa"
                  texto="Todas las actividades tienen exactamente un responsable final y al menos un ejecutor."
                  icono={<IconCheck size={24} />}
                />
              ) : (
                <Table
                  columnas={[
                    {
                      clave: 'actividadNombre',
                      titulo: 'Actividad',
                      render: (r: (typeof resumen.raci)[number]) => (
                        <span className="hg-t-sm">{r.actividadNombre}</span>
                      ),
                    },
                    { clave: 'conteoA', titulo: 'A', alineacion: 'centro', render: (r) => r.conteoA },
                    { clave: 'conteoR', titulo: 'R', alineacion: 'centro', render: (r) => r.conteoR },
                    {
                      clave: 'problema',
                      titulo: 'Problema',
                      render: (r) => (
                        <span className="hg-t-xs" style={{ color: ESTADO.critico }}>
                          {r.problema}
                        </span>
                      ),
                    },
                  ]}
                  filas={resumen.raci.filter((r) => !r.conforme).slice(0, 8)}
                  claveDe={(r) => r.actividadId}
                />
              )}
              <div className="hg-fila" style={{ marginTop: 'var(--sp-sm)' }}>
                <Link to={`/proyectos/${proyecto.id}/raci`} className="hg-btn hg-btn--secondary hg-btn--sm">
                  Ir a la matriz RACI
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Hitos                                                             */}
      {/* ================================================================ */}
      {vista === 'hitos' && (
        <div className="hg-pila">
          <div className="hg-grid hg-grid--kpi">
            <KPICard etiqueta="Hitos registrados" valor={resumen.hitos.length} acento={colorSerie(0)} />
            <KPICard
              etiqueta="Cumplidos"
              valor={hitos.cumplidos}
              color={ESTADO.bueno}
              pie={`${resumen.hitos.filter((h) => h.estado === 'Cumplido con retraso').length} con retraso`}
              acento={ESTADO.bueno}
            />
            <KPICard
              etiqueta="Vencidos"
              valor={hitos.vencidos}
              color={hitos.vencidos > 0 ? ESTADO.critico : ESTADO.bueno}
              pie="Fecha programada superada sin cumplir"
              acento={ESTADO.critico}
            />
            <KPICard
              etiqueta="Condicionantes en riesgo"
              valor={
                resumen.hitos.filter((h) => h.condicionante && (h.vencido || h.estado === 'No cumplido')).length
              }
              color={
                resumen.hitos.filter((h) => h.condicionante && (h.vencido || h.estado === 'No cumplido'))
                  .length > 0
                  ? ESTADO.critico
                  : ESTADO.bueno
              }
              pie="Su incumplimiento bloquea actividades posteriores"
              acento={ESTADO.serio}
              pista="Un hito condicionante no cumplido detiene el trabajo que depende de el: su retraso se propaga."
            />
          </div>

          <Card
            titulo="Linea de tiempo de hitos"
            subtitulo="Los puntos de control sobre la vigencia del proyecto. La marca morada es la fecha de corte."
          >
            <Figura
              leyenda={(['Cumplido', 'Cumplido con retraso', 'En curso', 'Pendiente', 'No cumplido'] as const).map(
                (e) => ({ etiqueta: e, color: estadoColors.hito[e].fg }),
              )}
              tabla={
                <Table
                  anchoMinimo="760px"
                  columnas={[
                    {
                      clave: 'descripcion',
                      titulo: 'Hito',
                      render: (h: (typeof resumen.hitos)[number]) => (
                        <div>
                          <span className="hg-t-sm">{h.descripcion}</span>
                          {h.condicionante && (
                            <Badge fg="#B45309" bg="#FEF3C7">
                              condicionante
                            </Badge>
                          )}
                        </div>
                      ),
                    },
                    {
                      clave: 'fechaProgramada',
                      titulo: 'Programado',
                      render: (h) => formatearFecha(h.fechaProgramada),
                    },
                    { clave: 'fechaReal', titulo: 'Real', render: (h) => formatearFecha(h.fechaReal) },
                    {
                      clave: 'desviacionDias',
                      titulo: 'Desviacion',
                      alineacion: 'derecha',
                      render: (h) =>
                        h.desviacionDias == null ? '—' : `${h.desviacionDias > 0 ? '+' : ''}${h.desviacionDias} d`,
                    },
                    { clave: 'estado', titulo: 'Estado', render: (h) => <BadgeEstado familia="hito" valor={h.estado} /> },
                  ]}
                  filas={[...resumen.hitos].sort((a, b) =>
                    (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? ''),
                  )}
                  claveDe={(h) => h.id}
                />
              }
            >
              <LineaHitos
                hitos={hitosLinea}
                fechaCorte={proyecto.fechaCorte}
                desde={proyecto.fechaInicio}
                hasta={proyecto.fechaEntregaFinal}
                formatoFecha={(f) => formatearFecha(f)}
              />
            </Figura>
          </Card>

          <div className="hg-grid hg-grid--2">
            <Card titulo="Reparto por estado" subtitulo="Situacion de los hitos del proyecto.">
              <Figura
                tabla={
                  <Table
                    columnas={[
                      { clave: 'estado', titulo: 'Estado', render: (r: { estado: string; n: number }) => r.estado },
                      { clave: 'n', titulo: 'Hitos', alineacion: 'derecha', render: (r) => r.n },
                    ]}
                    filas={(['Cumplido', 'Cumplido con retraso', 'En curso', 'Pendiente', 'No cumplido'] as const).map(
                      (estado) => ({ estado, n: resumen.hitos.filter((h) => h.estado === estado).length }),
                    )}
                    claveDe={(r) => r.estado}
                  />
                }
              >
                <Dona
                  porciones={(
                    ['Cumplido', 'Cumplido con retraso', 'En curso', 'Pendiente', 'No cumplido'] as const
                  ).map((estado) => ({
                    etiqueta: estado,
                    valor: resumen.hitos.filter((h) => h.estado === estado).length,
                    color: estadoColors.hito[estado].fg,
                  }))}
                  etiquetaCentro="hitos"
                />
              </Figura>
            </Card>

            <Card titulo="Proximos y vencidos" subtitulo="Ordenados por fecha programada.">
              <Table
                columnas={[
                  {
                    clave: 'descripcion',
                    titulo: 'Hito',
                    render: (h: (typeof resumen.hitos)[number]) => (
                      <span className="hg-t-sm">{h.descripcion}</span>
                    ),
                  },
                  { clave: 'fecha', titulo: 'Programado', render: (h) => formatearFecha(h.fechaProgramada) },
                  {
                    clave: 'dias',
                    titulo: 'Dias',
                    alineacion: 'derecha',
                    render: (h) =>
                      h.diasParaVencer == null ? (
                        '—'
                      ) : (
                        <span style={{ color: h.diasParaVencer < 0 ? ESTADO.critico : undefined, fontWeight: 600 }}>
                          {h.diasParaVencer}
                        </span>
                      ),
                  },
                  { clave: 'estado', titulo: 'Estado', render: (h) => <BadgeEstado familia="hito" valor={h.estado} /> },
                ]}
                filas={resumen.hitos
                  .filter((h) => !h.cumplido)
                  .sort((a, b) => (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? ''))
                  .slice(0, 8)}
                claveDe={(h) => h.id}
                claseFila={(h) => (h.vencido ? 'hg-fila--critica' : '')}
                vacio="Todos los hitos estan cumplidos."
              />
            </Card>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Indicadores                                                       */}
      {/* ================================================================ */}
      {vista === 'indicadores' && (
        <Card
          titulo="Indicadores institucionales"
          subtitulo="Resultado frente a la meta, con las bandas de tolerancia del catalogo."
          acciones={
            <Link to={`/proyectos/${proyecto.id}/indicadores`} className="hg-btn hg-btn--secondary hg-btn--sm no-print">
              Ver el detalle
            </Link>
          }
        >
          <div className="hg-pila" style={{ gap: 'var(--sp-lg)' }}>
            {CATEGORIAS_INDICADOR.map((cat: CategoriaIndicador) => {
              const items = indicadores
                .map((r) => ({ res: r, def: definicionPorCodigo(r.codigo, catalogoIndicadores) }))
                .filter((x) => x.def?.categoria === cat)
              if (items.length === 0) return null
              return (
                <div key={cat}>
                  <div className="hg-etiqueta" style={{ marginBottom: 6 }}>
                    {cat}
                  </div>
                  <div className="hg-grid hg-grid--3">
                    {items.map(({ res, def }) => {
                      if (!def) return null
                      const c = estadoColors.indicador[res.estado]
                      const serie = instantaneas
                        .map((s) => s.indicadores.find((i) => i.codigo === def.codigo)?.valor)
                        .filter((v): v is number => v != null)
                      return (
                        <div
                          key={def.codigo}
                          style={{
                            border: '1px solid var(--c-border)',
                            borderRadius: 'var(--r-base)',
                            padding: 'var(--sp-sm)',
                            borderLeft: `3px solid ${c.fg}`,
                          }}
                        >
                          <div className="hg-fila" style={{ justifyContent: 'space-between' }}>
                            <span className="hg-t-xs hg-t-mono hg-t-ter">{def.codigo}</span>
                            <BadgeEstado familia="indicador" valor={res.estado} />
                          </div>
                          <div className="hg-t-sm" style={{ margin: '4px 0' }}>
                            {def.nombre}
                          </div>
                          <div className="hg-fila" style={{ justifyContent: 'space-between' }}>
                            <strong style={{ color: c.fg, fontSize: 'var(--fs-lg)' }}>
                              {formatearValorIndicador(res.valor, def.unidad)}
                            </strong>
                            <span className="hg-fila" style={{ gap: 6 }}>
                              {serie.length > 1 && (
                                <Sparkline
                                  valores={serie}
                                  color={c.fg}
                                  referencia={def.meta}
                                  etiquetaAria={`Tendencia de ${def.nombre}`}
                                />
                              )}
                              <span className="hg-t-xs hg-t-sec">
                                meta {def.meta}
                                {def.unidad === 'porcentaje' ? ' %' : ''}
                              </span>
                            </span>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <Bullet
                              valor={res.valor}
                              meta={def.meta}
                              color={c.fg}
                              sentido={def.sentido === 'Mayor es mejor' ? 'mayorEsMejor' : 'menorEsMejor'}
                              maximo={def.unidad === 'numero' ? Math.max(5, (res.valor ?? 0) + 2) : undefined}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
