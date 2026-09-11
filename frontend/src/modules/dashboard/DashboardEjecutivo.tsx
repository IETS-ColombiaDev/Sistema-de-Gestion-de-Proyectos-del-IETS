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
  BarraApilada,
  BarrasDivergentes,
  Bullet,
  Cascada,
  CurvaS,
  DIVERGENTE,
  ESTADO,
  Figura,
  Pareto,
  RELLENO_RECURSO,
  RELLENO_RIESGO,
  SERIE_EVM,
  Sparkline,
  tonoDivergente,
} from '@/components/charts'
import { pareto } from '@/domain/costos'
import { esMovil, useMedia } from '@/lib/useMedia'
import { estadoColors } from '@/styles/theme'
import {
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
import { conSigno, moneda, monedaCorta, porcentaje } from '@/lib/formato'
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

type Vista = 'valor' | 'operacion' | 'indicadores'

export default function DashboardEjecutivo() {
  const { datos, resumen, analisis, indicadores, catalogoIndicadores, alertas, instantaneas, cargando, recalcular } =
    useProyecto()
  const [vista, setVista] = useState<Vista>('valor')
  // Pantalla estrecha: los graficos agrandan su texto y simplifican los ejes.
  const compacto = useMedia(esMovil)

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
          { valor: 'operacion', etiqueta: 'Operacion' },
          { valor: 'indicadores', etiqueta: 'Indicadores', conteo: indicadores.filter((i) => i.estado === 'Critico').length },
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
                compacto={compacto}
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
                <Cascada pasos={cascada} formato={fmt} compacto={compacto} />
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
                    compacto={compacto}
                  />
                </Figura>
              )}
              <div className="hg-grid hg-grid--3" style={{ marginTop: 'var(--sp-md)' }}>
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
            </Card>
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
            <Card titulo="Actividades por estado">
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
                <BarraApilada
                  segmentos={resumen.distribucion.map((d) => ({
                    etiqueta: d.estado || 'Sin estado',
                    valor: d.conteo,
                    color: d.estado ? estadoColors.actividad[d.estado].bar : '#CBD5E1',
                  }))}
                />
              </Figura>
            </Card>

            <Card titulo="Riesgos por nivel" subtitulo="Solo riesgos abiertos.">
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
                <BarraApilada
                  segmentos={NIVELES_RIESGO.map((nivel) => ({
                    etiqueta: nivel,
                    valor: resumen.riesgos.filter((r) => r.nivel === nivel && r.estado !== 'Cerrado').length,
                    color: RELLENO_RIESGO[nivel],
                  }))}
                />
              </Figura>
            </Card>

            <Card titulo="Recursos por disponibilidad">
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
                <BarraApilada
                  segmentos={DISPONIBILIDAD_RECURSO.map((d) => ({
                    etiqueta: d,
                    valor: datos.recursos.filter((r) => r.disponibilidad === d).length,
                    color: RELLENO_RECURSO[d],
                  }))}
                />
              </Figura>
              {resumen.recursos.porGestionar > 0 && (
                <p className="hg-t-xs" style={{ marginTop: 'var(--sp-xs)', color: '#92400E' }}>
                  {resumen.recursos.porGestionar} recurso(s) por gestionar requieren accion.
                </p>
              )}
            </Card>

            <Card titulo="Hitos y entregables">
              <div className="hg-grid hg-grid--3">
                <KPICard etiqueta="Cumplidos" valor={hitos.cumplidos} color={ESTADO.bueno} />
                <KPICard etiqueta="Pendientes" valor={hitos.pendientes} />
                <KPICard
                  etiqueta="Vencidos"
                  valor={hitos.vencidos}
                  color={hitos.vencidos > 0 ? ESTADO.critico : undefined}
                />
              </div>
              <div style={{ marginTop: 'var(--sp-md)' }}>
                <Table
                  columnas={[
                    {
                      clave: 'descripcion',
                      titulo: 'Proximos hitos',
                      render: (h) => <span className="hg-t-sm">{h.descripcion}</span>,
                    },
                    { clave: 'fecha', titulo: 'Programado', render: (h) => formatearFecha(h.fechaProgramada) },
                    { clave: 'estado', titulo: 'Estado', render: (h) => <BadgeEstado familia="hito" valor={h.estado} /> },
                  ]}
                  filas={resumen.hitos
                    .filter((h) => !h.cumplido)
                    .sort((a, b) => (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? ''))
                    .slice(0, 4)}
                  claveDe={(h) => h.id}
                  vacio="Todos los hitos estan cumplidos."
                />
              </div>
            </Card>
          </div>

          <Card
            titulo="Alertas activas"
            subtitulo="Cada alerta lleva su regla de origen y la ruta donde se resuelve."
          >
            {alertasFiltradas.length === 0 ? (
              <Vacio
                titulo={activos.includes('severidad') ? 'Sin alertas de esa severidad' : 'El proyecto no presenta alertas'}
                texto="A la fecha de corte no hay desviaciones que requieran atencion."
                icono={<IconCheck size={24} />}
              />
            ) : (
              <Table
                anchoMinimo="760px"
                columnas={[
                  {
                    clave: 'severidad',
                    titulo: 'Severidad',
                    ancho: '116px',
                    render: (a) => (
                      <Badge
                        fg={
                          a.severidad === 'critica'
                            ? '#B91C1C'
                            : a.severidad === 'alta'
                              ? '#C2410C'
                              : a.severidad === 'media'
                                ? '#92400E'
                                : '#1D4ED8'
                        }
                        bg={
                          a.severidad === 'critica'
                            ? '#FEE2E2'
                            : a.severidad === 'alta'
                              ? '#FFEDD5'
                              : a.severidad === 'media'
                                ? '#FEF3C7'
                                : '#DBEAFE'
                        }
                        punto
                      >
                        {a.severidad}
                      </Badge>
                    ),
                  },
                  {
                    clave: 'titulo',
                    titulo: 'Alerta',
                    render: (a) => (
                      <div>
                        <span className="hg-t-sm hg-t-bold">{a.titulo}</span>
                        <div className="hg-t-xs hg-t-sec">{a.mensaje}</div>
                      </div>
                    ),
                  },
                  { clave: 'modulo', titulo: 'Modulo', ancho: '120px', render: (a) => a.modulo },
                  {
                    clave: 'regla',
                    titulo: 'Regla',
                    ancho: '90px',
                    render: (a) => (
                      <Badge fg="#94A3B8" bg="#F8FAFC" titulo="Regla de negocio que genera la alerta">
                        {a.regla}
                      </Badge>
                    ),
                  },
                  {
                    clave: 'ir',
                    titulo: '',
                    alineacion: 'derecha',
                    render: (a) => (
                      <Link to={a.ruta} className="hg-t-xs">
                        Resolver
                      </Link>
                    ),
                  },
                ]}
                filas={alertasFiltradas}
                claveDe={(a) => a.id}
              />
            )}
          </Card>
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
