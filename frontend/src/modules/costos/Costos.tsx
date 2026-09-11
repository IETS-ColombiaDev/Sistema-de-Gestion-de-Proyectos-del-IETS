/**
 * Costos y valor ganado — modulo de profundidad.
 *
 * El dashboard ejecutivo responde "¿como vamos y que decidimos?". Este modulo
 * responde el nivel siguiente: "¿en que se esta gastando, a que ritmo, y cuadra
 * con lo que deberia costar el equipo que tenemos?".
 *
 * Es tambien el punto donde se hara visible la integracion con la herramienta
 * institucional de costos: la seccion "Fuente del costo" declara de donde
 * viene cada cifra, y cuando el proveedor externo este registrado, lo dira sin
 * que ninguna otra pantalla cambie.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Tabs from '@/components/Tabs'
import Table from '@/components/ui/Table'
import { Cargando, Vacio } from '@/components/EstadoVista'
import FiltroBarra, { useFiltros, type DefinicionFiltro } from '@/components/FiltroBarra'
import { Nota, Pista } from '@/components/Ayuda'
import {
  BarrasDivergentes,
  BarrasHorizontales,
  Cascada,
  CurvaS,
  DIVERGENTE,
  ESTADO,
  Figura,
  LineasTemporales,
  Pareto,
  SECUENCIAL_INDIGO,
  SERIE_EVM,
  colorSerie,
  tonoDivergente,
} from '@/components/charts'
import { pareto } from '@/domain/costos'
import { esMovil, useMedia } from '@/lib/useMedia'
import { IconCandado, IconExportar, IconPresupuesto, IconRefrescar } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { formatearFecha, formatearPeriodo } from '@/domain/fechas'
import { conSigno, moneda, monedaCorta, numero, porcentaje } from '@/lib/formato'
import { exportarExcel } from '@/lib/exportar'

type Vista = 'valor' | 'desglose' | 'equipo' | 'fuente'

export default function Costos() {
  const { datos, resumen, analisis, cargando, recalcular } = useProyecto()
  const [vista, setVista] = useState<Vista>('valor')
  // Pantalla estrecha: los graficos agrandan su texto y simplifican los ejes.
  const compacto = useMedia(esMovil)

  const proyecto = datos?.proyecto
  const fmt = (n: number) => monedaCorta(n)
  const fmtExacto = (n: number) => moneda(n, proyecto?.moneda ?? 'COP')

  const definiciones = useMemo<DefinicionFiltro[]>(
    () => [
      {
        clave: 'rubro',
        etiqueta: 'Rubro',
        tipo: 'select',
        opciones: [...new Set((datos?.presupuesto ?? []).map((r) => r.rubro))].sort(),
      },
      {
        clave: 'fuente',
        etiqueta: 'Fuente financiera',
        tipo: 'select',
        ancho: '170px',
        opciones: [...new Set((datos?.presupuesto ?? []).map((r) => r.fuente))].sort(),
      },
      { clave: 'desde', etiqueta: 'Desde', tipo: 'fecha', ancho: '145px' },
      { clave: 'hasta', etiqueta: 'Hasta', tipo: 'fecha', ancho: '145px' },
    ],
    [datos],
  )
  const { valores, set, limpiar, activos } = useFiltros(definiciones, 'co')

  /** Registros que pasan el filtro. Acotan el desglose, no el valor ganado. */
  const registros = useMemo(() => {
    let salida = (datos?.presupuesto ?? []).filter((r) => !r.eliminado)
    if (valores.rubro) salida = salida.filter((r) => r.rubro === valores.rubro)
    if (valores.fuente) salida = salida.filter((r) => r.fuente === valores.fuente)
    if (valores.desde) salida = salida.filter((r) => r.periodo >= valores.desde.slice(0, 7))
    if (valores.hasta) salida = salida.filter((r) => r.periodo <= valores.hasta.slice(0, 7))
    return salida
  }, [datos, valores])

  type LineaAgrupada = { clave: string; programado: number; ejecutado: number }

  /** Fila del cuadro de capacidades de la fuente de costo. */
  interface FilaCapacidad {
    concepto: string
    disponible: boolean
    hoy: string
    conIntegracion: string
  }

  const agrupado = useMemo(() => {
    const acumular = (clave: (r: (typeof registros)[number]) => string): LineaAgrupada[] => {
      const mapa = new Map<string, LineaAgrupada>()
      for (const r of registros) {
        const k = clave(r) || '(sin clasificar)'
        const acc = mapa.get(k) ?? { clave: k, programado: 0, ejecutado: 0 }
        acc.programado += Number(r.programado) || 0
        acc.ejecutado += Number(r.ejecutado) || 0
        mapa.set(k, acc)
      }
      return [...mapa.values()].sort((a, b) => b.ejecutado - a.ejecutado)
    }
    return { porRubro: acumular((r) => r.rubro), porFuente: acumular((r) => r.fuente) }
  }, [registros])

  const serieMensual = useMemo(() => {
    const periodos = [...new Set(registros.map((r) => r.periodo))].sort()
    let accProg = 0
    let accEjec = 0
    return periodos.map((periodo) => {
      const delPeriodo = registros.filter((r) => r.periodo === periodo)
      const prog = delPeriodo.reduce((s, r) => s + (Number(r.programado) || 0), 0)
      const ejec = delPeriodo.reduce((s, r) => s + (Number(r.ejecutado) || 0), 0)
      accProg += prog
      accEjec += ejec
      return { periodo, prog, ejec, accProg, accEjec }
    })
  }, [registros])

  const totalesFiltrados = useMemo(
    () => ({
      programado: registros.reduce((s, r) => s + (Number(r.programado) || 0), 0),
      ejecutado: registros.reduce((s, r) => s + (Number(r.ejecutado) || 0), 0),
    }),
    [registros],
  )

  if (cargando || !datos || !resumen || !analisis || !proyecto) return <Cargando />

  const { evm, curva, cascada, costos, porFase } = analisis
  const desviacion = totalesFiltrados.ejecutado - totalesFiltrados.programado

  const exportar = () =>
    exportarExcel(
      [
        {
          nombre: 'Valor ganado',
          filas: [
            { Concepto: 'Presupuesto aprobado (BAC)', Valor: evm.presupuestoTotal },
            { Concepto: 'Valor planeado (PV)', Valor: evm.valorPlaneado },
            { Concepto: 'Valor ganado (EV)', Valor: evm.valorGanado },
            { Concepto: 'Costo real (AC)', Valor: evm.costoReal },
            { Concepto: 'Variacion de cronograma (SV)', Valor: evm.variacionCronograma },
            { Concepto: 'Variacion de costo (CV)', Valor: evm.variacionCosto },
            { Concepto: 'Indice de cronograma (SPI)', Valor: evm.indiceCronograma },
            { Concepto: 'Indice de costo (CPI)', Valor: evm.indiceCosto },
            { Concepto: 'Proyeccion al cierre (EAC)', Valor: evm.proyeccionCierre },
            { Concepto: 'Proyeccion optimista', Valor: evm.proyeccionOptimista },
            { Concepto: 'Falta por gastar (ETC)', Valor: evm.faltaPorGastar },
            { Concepto: 'Variacion al cierre (VAC)', Valor: evm.variacionAlCierre },
            { Concepto: 'Eficiencia requerida (TCPI)', Valor: evm.eficienciaRequerida },
            { Concepto: 'Diagnostico', Valor: evm.diagnostico.titulo },
            { Concepto: 'Decision', Valor: evm.diagnostico.decision },
          ],
        },
        {
          nombre: 'Curva',
          filas: curva.puntos.map((p) => ({
            Periodo: p.periodo,
            'Valor planeado': p.planeado,
            'Valor ganado': p.ganado,
            'Costo real': p.real,
            Proyeccion: p.proyectado,
          })),
        },
        {
          nombre: 'Por rubro',
          filas: agrupado.porRubro.map((r) => ({
            Rubro: r.clave,
            Programado: r.programado,
            Ejecutado: r.ejecutado,
            Desviacion: r.ejecutado - r.programado,
          })),
        },
        {
          nombre: 'Por fuente',
          filas: agrupado.porFuente.map((r) => ({
            Fuente: r.clave,
            Programado: r.programado,
            Ejecutado: r.ejecutado,
          })),
        },
        {
          nombre: 'Por fase',
          filas: porFase.map((f) => ({
            Fase: f.nombre,
            'Peso (%)': f.peso,
            'Valor planeado': f.valorPlaneado,
            'Valor ganado': f.valorGanado,
            'Variacion de cronograma': f.variacionCronograma,
            'Indice de cronograma': f.indiceCronograma,
          })),
        },
      ],
      `costos-${proyecto.codigo}`,
    )

  return (
    <div className="hg-pila">
      <Nota regla="ADR-03">
        El valor ganado se calcula sobre el proyecto completo: es una medida del conjunto y filtrarla por
        rubro no tendria sentido. Los filtros acotan el desglose del gasto y el detalle por periodo.
      </Nota>

      <FiltroBarra
        definiciones={definiciones}
        valores={valores}
        onCambio={set}
        onLimpiar={limpiar}
        activos={activos}
        resumen={`${registros.length} registro(s) · ejecutado ${fmt(totalesFiltrados.ejecutado)}`}
        acciones={
          <Button variante="secondary" tamano="sm" icono={<IconExportar size={15} />} onClick={exportar}>
            Exportar
          </Button>
        }
      />

      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Presupuesto aprobado"
          valor={fmt(evm.presupuestoTotal)}
          pie={`Consumido ${porcentaje(evm.consumoPresupuesto)}`}
          acento={SERIE_EVM.planeado}
          pista="Presupuesto al cierre registrado en la ficha del proyecto. Es el techo contra el que se juzga todo lo demas."
        />
        {/* El valor ganado y el costo real son magnitudes de identidad, no
            estados: la cifra va en tinta normal y la franja de acento lleva el
            color de su serie en la curva. Tintar el numero con el semaforo lo
            haria leer como una alarma y, peor, romperia la correspondencia con
            la leyenda del grafico de abajo. La polaridad viaja en el pie. */}
        <KPICard
          etiqueta="Valor ganado"
          valor={fmt(evm.valorGanado)}
          pie={
            <span style={{ color: tonoDivergente(evm.variacionCronograma), fontWeight: 600 }}>
              {conSigno(evm.variacionCronograma / 1_000_000, 1, ' M')} frente a lo planeado
            </span>
          }
          acento={SERIE_EVM.ganado}
          pista="Valor del trabajo efectivamente hecho: presupuesto por el avance ponderado. La franja de color corresponde a su serie en la curva."
        />
        <KPICard
          etiqueta="Costo real"
          valor={fmt(evm.costoReal)}
          pie={
            <span style={{ color: tonoDivergente(evm.variacionCosto), fontWeight: 600 }}>
              {conSigno(evm.variacionCosto / 1_000_000, 1, ' M')} frente al valor ganado
            </span>
          }
          acento={SERIE_EVM.real}
          pista="Lo efectivamente causado segun la fuente de costo vigente. La franja de color corresponde a su serie en la curva."
        />
        <KPICard
          etiqueta="Proyeccion al cierre"
          valor={evm.proyeccionCierre == null ? 'Sin datos' : fmt(evm.proyeccionCierre)}
          color={
            evm.variacionAlCierre == null ? undefined : evm.variacionAlCierre >= 0 ? ESTADO.bueno : ESTADO.critico
          }
          pie={
            evm.proyeccionOptimista == null
              ? undefined
              : `Optimista ${fmt(evm.proyeccionOptimista)} · falta ${fmt(evm.faltaPorGastar ?? 0)}`
          }
          acento={
            evm.variacionAlCierre != null && evm.variacionAlCierre < 0
              ? DIVERGENTE.desfavorable
              : DIVERGENTE.favorable
          }
          pista="Presupuesto dividido por el indice de costo. La optimista supone que el trabajo restante cuesta exactamente lo presupuestado."
        />
      </div>

      <Tabs
        opciones={[
          { valor: 'valor', etiqueta: 'Valor ganado' },
          { valor: 'desglose', etiqueta: 'Desglose del gasto' },
          { valor: 'equipo', etiqueta: 'Costo del equipo' },
          { valor: 'fuente', etiqueta: 'Fuente del costo' },
        ]}
        activa={vista}
        onCambiar={(x) => setVista(x as Vista)}
        etiquetaAria="Secciones de costos"
      />

      {/* ================================================================ */}
      {vista === 'valor' && (
        <div className="hg-pila">
          <Card titulo="Curva de valor ganado" subtitulo="Las tres magnitudes y la proyeccion, en la misma escala.">
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
                    { clave: 'planeado', titulo: 'Planeado', alineacion: 'derecha', render: (p) => fmtExacto(p.planeado) },
                    {
                      clave: 'ganado',
                      titulo: 'Ganado',
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
                alto={320}
                compacto={compacto}
              />
            </Figura>
          </Card>

          <div className="hg-grid hg-grid--2">
            <Card titulo="Del presupuesto a la proyeccion" subtitulo="Que parte del sobrecosto es historia y que parte es accionable.">
              {cascada.length === 0 ? (
                <Vacio
                  titulo="Sin proyeccion calculable"
                  texto="Se requiere costo real registrado para descomponer la variacion."
                />
              ) : (
                <Figura
                  leyenda={[
                    { etiqueta: 'Encarece el cierre', color: DIVERGENTE.desfavorable },
                    { etiqueta: 'Abarata el cierre', color: DIVERGENTE.favorable },
                  ]}
                  tabla={
                    <Table
                      columnas={[
                        { clave: 'etiqueta', titulo: 'Concepto', render: (p: (typeof cascada)[number]) => p.etiqueta },
                        { clave: 'valor', titulo: 'Importe', alineacion: 'derecha', render: (p) => fmtExacto(p.valor) },
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
              )}
            </Card>

            <Card
              titulo="Indicadores de valor ganado"
              subtitulo="La nomenclatura internacional, para trazabilidad con la literatura."
            >
              <Table
                columnas={[
                  {
                    clave: 'concepto',
                    titulo: 'Indicador',
                    render: (r: { concepto: string; sigla: string; valor: string; lectura: string }) => (
                      <div>
                        <span className="hg-t-sm">{r.concepto}</span>
                        <span className="hg-t-xs hg-t-mono hg-t-ter"> ({r.sigla})</span>
                      </div>
                    ),
                  },
                  {
                    clave: 'valor',
                    titulo: 'Valor',
                    alineacion: 'derecha',
                    render: (r) => <span className="hg-t-num hg-t-bold">{r.valor}</span>,
                  },
                  {
                    clave: 'lectura',
                    titulo: 'Como se lee',
                    render: (r) => <span className="hg-t-xs hg-t-sec">{r.lectura}</span>,
                  },
                ]}
                filas={[
                  {
                    concepto: 'Presupuesto al cierre',
                    sigla: 'BAC',
                    valor: fmtExacto(evm.presupuestoTotal),
                    lectura: 'El techo aprobado.',
                  },
                  {
                    concepto: 'Valor planeado',
                    sigla: 'PV',
                    valor: fmtExacto(evm.valorPlaneado),
                    lectura: 'Lo que el cronograma decia que estaria hecho a hoy.',
                  },
                  {
                    concepto: 'Valor ganado',
                    sigla: 'EV',
                    valor: fmtExacto(evm.valorGanado),
                    lectura: 'Lo que efectivamente esta hecho, valorado en dinero.',
                  },
                  {
                    concepto: 'Costo real',
                    sigla: 'AC',
                    valor: fmtExacto(evm.costoReal),
                    lectura: 'Lo gastado para lograrlo.',
                  },
                  {
                    concepto: 'Variacion de cronograma',
                    sigla: 'SV',
                    valor: fmtExacto(evm.variacionCronograma),
                    lectura: 'Negativa: hay menos trabajo hecho del previsto.',
                  },
                  {
                    concepto: 'Variacion de costo',
                    sigla: 'CV',
                    valor: fmtExacto(evm.variacionCosto),
                    lectura: 'Negativa: lo hecho costo mas de lo que vale.',
                  },
                  {
                    concepto: 'Indice de cronograma',
                    sigla: 'SPI',
                    valor: evm.indiceCronograma?.toFixed(3) ?? 'Sin datos',
                    lectura: '1,000 es estar al dia.',
                  },
                  {
                    concepto: 'Indice de costo',
                    sigla: 'CPI',
                    valor: evm.indiceCosto?.toFixed(3) ?? 'Sin datos',
                    lectura: '1,000 es gastar lo que vale el trabajo hecho.',
                  },
                  {
                    concepto: 'Proyeccion al cierre',
                    sigla: 'EAC',
                    valor: evm.proyeccionCierre == null ? 'Sin datos' : fmtExacto(evm.proyeccionCierre),
                    lectura: 'Si el desempeno de costo se mantiene.',
                  },
                  {
                    concepto: 'Falta por gastar',
                    sigla: 'ETC',
                    valor: evm.faltaPorGastar == null ? 'Sin datos' : fmtExacto(evm.faltaPorGastar),
                    lectura: 'Proyeccion menos lo ya gastado.',
                  },
                  {
                    concepto: 'Variacion al cierre',
                    sigla: 'VAC',
                    valor: evm.variacionAlCierre == null ? 'Sin datos' : fmtExacto(evm.variacionAlCierre),
                    lectura: 'Negativa: el proyecto cierra por encima del presupuesto.',
                  },
                  {
                    concepto: 'Eficiencia requerida',
                    sigla: 'TCPI',
                    valor: evm.eficienciaRequerida?.toFixed(3) ?? 'No aplica',
                    lectura: 'La que habria que sostener para cerrar en presupuesto. Sobre 1,10 no es alcanzable.',
                  },
                ]}
                claveDe={(r) => r.sigla}
                anchoMinimo="760px"
              />
            </Card>
          </div>

          <Card
            titulo="Valor ganado por fase"
            subtitulo="Donde esta el problema. El presupuesto se reparte por peso de duracion."
          >
            {porFase.length === 0 ? (
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
                      { clave: 'nombre', titulo: 'Fase', render: (f: (typeof porFase)[number]) => f.nombre },
                      { clave: 'peso', titulo: 'Peso', alineacion: 'derecha', render: (f) => porcentaje(f.peso) },
                      {
                        clave: 'valorPlaneado',
                        titulo: 'Planeado',
                        alineacion: 'derecha',
                        render: (f) => fmtExacto(f.valorPlaneado),
                      },
                      {
                        clave: 'valorGanado',
                        titulo: 'Ganado',
                        alineacion: 'derecha',
                        render: (f) => fmtExacto(f.valorGanado),
                      },
                      {
                        clave: 'indiceCronograma',
                        titulo: 'Indice',
                        alineacion: 'derecha',
                        render: (f) => f.indiceCronograma?.toFixed(2) ?? '—',
                      },
                    ]}
                    filas={porFase}
                    claveDe={(f) => f.faseId}
                  />
                }
              >
                <BarrasDivergentes
                  datos={[...porFase]
                    .sort((a, b) => a.variacionCronograma - b.variacionCronograma)
                    .map((f) => ({
                      etiqueta: f.nombre,
                      valor: f.variacionCronograma,
                      detalle: `Peso ${porcentaje(f.peso)} del proyecto · avance ${porcentaje(f.avance)} frente a ${porcentaje(f.avanceEsperado)} esperado.`,
                    }))}
                  formato={fmt}
                />
              </Figura>
            )}
            <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-sm)' }}>
              No se reparte el costo real por fase: el libro presupuestal se lleva por rubro y periodo, no por
              fase. Un indice de costo por fase repartido a prorrata pareceria informacion sin serlo. Cuando la
              herramienta de costos entregue la fase como dimension, esta vista la incorpora.
            </p>
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {vista === 'desglose' && (
        <div className="hg-pila">
          <div className="hg-grid hg-grid--kpi">
            <KPICard etiqueta="Programado (filtrado)" valor={fmt(totalesFiltrados.programado)} acento={SECUENCIAL_INDIGO[5]} />
            <KPICard etiqueta="Ejecutado (filtrado)" valor={fmt(totalesFiltrados.ejecutado)} acento={SERIE_EVM.real} />
            <KPICard
              etiqueta="Desviacion"
              valor={conSigno(desviacion / 1_000_000, 1, ' M')}
              color={Math.abs(desviacion) / Math.max(1, totalesFiltrados.programado) <= 0.05 ? ESTADO.bueno : ESTADO.critico}
              pie={
                totalesFiltrados.programado > 0
                  ? porcentaje((desviacion / totalesFiltrados.programado) * 100)
                  : 'Sin programado'
              }
              acento={tonoDivergente(-desviacion)}
            />
            <KPICard
              etiqueta="Cobertura restante"
              valor={costos.mesesDeCobertura == null ? '—' : `${costos.mesesDeCobertura} meses`}
              color={costos.mesesDeCobertura != null && costos.mesesDeCobertura < 2 ? ESTADO.critico : undefined}
              pie={`Ritmo ${fmt(costos.ritmoMensual)} al mes`}
              acento={ESTADO.advertencia}
              pista="Presupuesto disponible dividido por el ritmo de gasto de los ultimos periodos con movimiento."
            />
          </div>

          {registros.length === 0 ? (
            <Card>
              <Vacio
                titulo="Sin registros que coincidan"
                texto="Ajuste los filtros o registre el control presupuestal del periodo."
                icono={<IconPresupuesto size={24} />}
                accion={
                  <Button variante="primary">
                    <Link to={`/proyectos/${proyecto.id}/presupuesto`} style={{ color: '#fff' }}>
                      Ir al control presupuestal
                    </Link>
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <Card titulo="Ejecucion mensual" subtitulo="Programado y ejecutado acumulados, periodo por periodo.">
                <Figura
                  leyenda={[
                    { etiqueta: 'Programado acumulado', color: SECUENCIAL_INDIGO[5], discontinua: true },
                    { etiqueta: 'Ejecutado acumulado', color: SERIE_EVM.real },
                  ]}
                  tabla={
                    <Table
                      anchoMinimo="700px"
                      columnas={[
                        {
                          clave: 'periodo',
                          titulo: 'Periodo',
                          render: (r: (typeof serieMensual)[number]) => formatearPeriodo(r.periodo),
                        },
                        { clave: 'prog', titulo: 'Programado', alineacion: 'derecha', render: (r) => fmtExacto(r.prog) },
                        { clave: 'ejec', titulo: 'Ejecutado', alineacion: 'derecha', render: (r) => fmtExacto(r.ejec) },
                        {
                          clave: 'desv',
                          titulo: 'Desviacion',
                          alineacion: 'derecha',
                          render: (r) => (
                            <span style={{ color: tonoDivergente(r.prog - r.ejec) }}>
                              {fmtExacto(r.ejec - r.prog)}
                            </span>
                          ),
                        },
                        { clave: 'accEjec', titulo: 'Acumulado', alineacion: 'derecha', render: (r) => fmtExacto(r.accEjec) },
                      ]}
                      filas={serieMensual}
                      claveDe={(r) => r.periodo}
                    />
                  }
                >
                  <LineasTemporales
                    series={[
                      {
                        nombre: 'Programado acumulado',
                        color: SECUENCIAL_INDIGO[5],
                        discontinua: true,
                        puntos: serieMensual.map((r) => ({ x: r.periodo.slice(2), y: r.accProg })),
                      },
                      {
                        nombre: 'Ejecutado acumulado',
                        color: SERIE_EVM.real,
                        puntos: serieMensual.map((r) => ({ x: r.periodo.slice(2), y: r.accEjec })),
                      },
                    ]}
                    formatoValor={fmt}
                    alto={250}
                  />
                </Figura>
              </Card>

              <div className="hg-grid hg-grid--2">
                <Card titulo="Concentracion por rubro" subtitulo="Donde mirar primero si hay que recortar.">
                  <Figura
                    descripcion="Barras: participacion. Trazo: acumulada."
                    tabla={
                      <Table
                        columnas={[
                          { clave: 'clave', titulo: 'Rubro', render: (l: LineaAgrupada) => l.clave },
                          {
                            clave: 'ejecutado',
                            titulo: 'Ejecutado',
                            alineacion: 'derecha',
                            render: (l: LineaAgrupada) => fmtExacto(l.ejecutado),
                          },
                        ]}
                        filas={agrupado.porRubro}
                        claveDe={(l) => l.clave}
                      />
                    }
                  >
                    <Pareto
                      lineas={pareto(
                        agrupado.porRubro.map((r) => ({ ...r, comprometido: 0 })),
                      ).map((l) => ({ ...l, importe: l.ejecutado }))}
                      formato={fmtExacto}
                    compacto={compacto}
                    />
                  </Figura>
                </Card>

                <Card titulo="Desviacion por rubro" subtitulo="Ejecutado frente a programado en cada linea.">
                  <Figura
                    leyenda={[
                      { etiqueta: 'Por debajo de lo programado', color: DIVERGENTE.favorable },
                      { etiqueta: 'Por encima', color: DIVERGENTE.desfavorable },
                    ]}
                    tabla={
                      <Table
                        columnas={[
                          { clave: 'clave', titulo: 'Rubro', render: (l: LineaAgrupada) => l.clave },
                          {
                            clave: 'programado',
                            titulo: 'Programado',
                            alineacion: 'derecha',
                            render: (l: LineaAgrupada) => fmtExacto(l.programado),
                          },
                          {
                            clave: 'ejecutado',
                            titulo: 'Ejecutado',
                            alineacion: 'derecha',
                            render: (l: LineaAgrupada) => fmtExacto(l.ejecutado),
                          },
                        ]}
                        filas={agrupado.porRubro}
                        claveDe={(l) => l.clave}
                      />
                    }
                  >
                    <BarrasDivergentes
                      datos={agrupado.porRubro
                        .map((r) => ({
                          etiqueta: r.clave,
                          valor: r.programado - r.ejecutado,
                          detalle: `Programado ${fmtExacto(r.programado)} · ejecutado ${fmtExacto(r.ejecutado)}.`,
                        }))
                        .sort((a, b) => a.valor - b.valor)}
                      formato={fmt}
                    />
                  </Figura>
                </Card>
              </div>

              <Card titulo="Gasto por fuente financiera" subtitulo="Origen de los recursos efectivamente causados.">
                <Figura
                  tabla={
                    <Table
                      columnas={[
                        { clave: 'clave', titulo: 'Fuente', render: (l: LineaAgrupada) => l.clave },
                        {
                          clave: 'programado',
                          titulo: 'Programado',
                          alineacion: 'derecha',
                          render: (l: LineaAgrupada) => fmtExacto(l.programado),
                        },
                        {
                          clave: 'ejecutado',
                          titulo: 'Ejecutado',
                          alineacion: 'derecha',
                          render: (l: LineaAgrupada) => fmtExacto(l.ejecutado),
                        },
                      ]}
                      filas={agrupado.porFuente}
                      claveDe={(l) => l.clave}
                    />
                  }
                >
                  <BarrasHorizontales
                    datos={agrupado.porFuente.map((f, i) => ({
                      etiqueta: f.clave,
                      valor: f.ejecutado,
                      color: colorSerie(i),
                      detalle: `Programado ${fmtExacto(f.programado)}.`,
                    }))}
                    maximo={Math.max(...agrupado.porFuente.map((f) => f.ejecutado), 1)}
                    sufijo=""
                  />
                </Figura>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {vista === 'equipo' && (
        <div className="hg-pila">
          <Nota>
            El costo teorico del equipo se calcula con la dedicacion declarada y la tarifa hora de cada perfil.
            No sustituye al libro presupuestal: lo contrasta. Una diferencia grande entre ambos suele significar
            que la dedicacion registrada no corresponde a la real, o que hay costos fuera de nomina que el
            equipo no esta viendo.
          </Nota>

          <div className="hg-grid hg-grid--kpi">
            <KPICard
              etiqueta="Costo teorico del equipo"
              valor={fmt(costos.equipo.estimado)}
              pie={`${costos.equipo.totalPerfiles - costos.equipo.perfilesSinTarifa} de ${costos.equipo.totalPerfiles} perfiles con tarifa`}
              acento={colorSerie(0)}
              pista="Suma de tarifa hora por dedicacion mensual por meses de vinculacion, de los perfiles que tienen tarifa registrada."
            />
            <KPICard
              etiqueta="Costo real registrado"
              valor={fmt(evm.costoReal)}
              pie="Segun el control presupuestal"
              acento={SERIE_EVM.real}
            />
            {/* Sin tarifas registradas no hay comparacion posible: mostrar el
                costo real completo como "diferencia" fingiria una brecha del
                100 % cuando lo que falta es el dato de referencia. */}
            <KPICard
              etiqueta="Diferencia"
              valor={
                costos.equipo.estimado === 0
                  ? 'No comparable'
                  : conSigno((evm.costoReal - costos.equipo.estimado) / 1_000_000, 1, ' M')
              }
              pie={
                costos.equipo.estimado === 0
                  ? 'Falta registrar tarifas hora en el equipo'
                  : 'Costo real menos costo teorico del equipo'
              }
              color={
                costos.equipo.estimado === 0
                  ? undefined
                  : Math.abs(evm.costoReal - costos.equipo.estimado) / costos.equipo.estimado > 0.3
                    ? ESTADO.advertencia
                    : ESTADO.bueno
              }
              acento={ESTADO.advertencia}
              pista="Solo tiene sentido cuando el equipo tiene tarifas registradas: es un contraste entre lo que el libro dice que se gasto y lo que la dedicacion declarada implicaria."
            />
            <KPICard
              etiqueta="Dedicacion total"
              valor={`${numero(resumen.equipo.dedicacionTotalHorasMes)} h/mes`}
              pie={`${resumen.equipo.total} integrante(s)`}
              acento={colorSerie(1)}
            />
          </div>

          {costos.equipo.perfilesSinTarifa > 0 && (
            <Alert
              tipo="warning"
              titulo={`${costos.equipo.perfilesSinTarifa} perfil(es) sin tarifa hora`}
              mensaje="El costo teorico del equipo esta incompleto: no incluye esos perfiles. Registre su tarifa en el modulo de equipo para que la comparacion sea valida."
              acciones={
                <Link to={`/proyectos/${proyecto.id}/equipo`} className="hg-btn hg-btn--secondary hg-btn--sm">
                  Ir al equipo
                </Link>
              }
            />
          )}

          <Card titulo="Costo por perfil" subtitulo="Tarifa hora por dedicacion por meses de vinculacion.">
            {datos.equipo.length === 0 ? (
              <Vacio titulo="Sin integrantes registrados" texto="Registre el grupo desarrollador del proyecto." />
            ) : (
              <Table
                anchoMinimo="880px"
                columnas={[
                  {
                    clave: 'perfil',
                    titulo: 'Perfil',
                    render: (m) => (
                      <div>
                        <span className="hg-t-sm hg-t-bold">{m.perfil}</span>
                        <div className="hg-t-xs hg-t-sec">{m.porDesignar ? '(por designar)' : m.nombre}</div>
                      </div>
                    ),
                  },
                  {
                    clave: 'costoHora',
                    titulo: 'Tarifa hora',
                    alineacion: 'derecha',
                    render: (m) =>
                      m.costoHora ? (
                        fmtExacto(m.costoHora)
                      ) : (
                        <Badge fg="#92400E" bg="#FEF3C7" titulo="Sin tarifa: no entra en el costo teorico">
                          sin tarifa
                        </Badge>
                      ),
                  },
                  {
                    clave: 'dedicacionHorasMes',
                    titulo: 'Horas/mes',
                    alineacion: 'derecha',
                    render: (m) => numero(m.dedicacionHorasMes),
                  },
                  {
                    clave: 'mesesVinculacion',
                    titulo: 'Meses',
                    alineacion: 'derecha',
                    render: (m) => m.mesesVinculacion,
                  },
                  {
                    clave: 'total',
                    titulo: 'Costo teorico',
                    alineacion: 'derecha',
                    render: (m) =>
                      m.costoHora ? (
                        <strong className="hg-t-num">
                          {fmtExacto((m.costoHora ?? 0) * m.dedicacionHorasMes * m.mesesVinculacion)}
                        </strong>
                      ) : (
                        <span className="hg-t-ter">—</span>
                      ),
                  },
                  {
                    clave: 'participacion',
                    titulo: 'Participacion',
                    alineacion: 'derecha',
                    render: (m) => {
                      const propio = (m.costoHora ?? 0) * m.dedicacionHorasMes * m.mesesVinculacion
                      return costos.equipo.estimado > 0 && propio > 0
                        ? porcentaje((propio / costos.equipo.estimado) * 100)
                        : '—'
                    },
                  },
                ]}
                filas={[...datos.equipo].sort(
                  (a, b) =>
                    (b.costoHora ?? 0) * b.dedicacionHorasMes * b.mesesVinculacion -
                    (a.costoHora ?? 0) * a.dedicacionHorasMes * a.mesesVinculacion,
                )}
                claveDe={(m) => m.id}
              />
            )}
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {vista === 'fuente' && (
        <div className="hg-pila">
          <Card titulo="Fuente del costo real" subtitulo="De donde viene cada cifra de gasto que muestra el sistema.">
            <div
              className="hg-fila"
              style={{
                padding: 'var(--sp-md)',
                borderRadius: 'var(--r-base)',
                background: costos.origen === 'externo' ? '#CFFAFE' : 'var(--c-bg-hover)',
                color: costos.origen === 'externo' ? '#0E7490' : 'var(--c-text-2)',
                alignItems: 'flex-start',
              }}
            >
              <IconCandado size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong className="hg-t-sm">{costos.nombreFuente}</strong>
                <div className="hg-t-xs" style={{ marginTop: 2 }}>
                  {costos.origen === 'interno'
                    ? 'Proveedor interno: las cifras salen del modulo de Control presupuestal de este sistema, que lleva el propio equipo del proyecto.'
                    : `Proveedor externo${costos.sincronizadoEn ? `, sincronizado el ${formatearFecha(costos.sincronizadoEn.slice(0, 10), 'largo')}` : ''}.`}
                </div>
              </div>
              <Badge
                fg={costos.origen === 'externo' ? '#0E7490' : '#64748B'}
                bg="#fff"
              >
                {costos.origen}
              </Badge>
            </div>

            <div style={{ marginTop: 'var(--sp-lg)' }}>
              <Table
                anchoMinimo="760px"
                columnas={[
                  { clave: 'concepto', titulo: 'Concepto', render: (r: FilaCapacidad) => r.concepto },
                  {
                    clave: 'estado',
                    titulo: 'Hoy',
                    render: (r: FilaCapacidad) => (
                      <span className="hg-fila" style={{ gap: 6 }}>
                        <Badge
                          fg={r.disponible ? '#047857' : '#92400E'}
                          bg={r.disponible ? '#D1FAE5' : '#FEF3C7'}
                          punto
                        >
                          {r.disponible ? 'disponible' : 'no disponible'}
                        </Badge>
                        <span className="hg-t-xs hg-t-sec">{r.hoy}</span>
                      </span>
                    ),
                  },
                  {
                    clave: 'conIntegracion',
                    titulo: 'Con la herramienta de costos',
                    render: (r: FilaCapacidad) => (
                      <span className="hg-t-xs hg-t-sec">{r.conIntegracion}</span>
                    ),
                  },
                ]}
                filas={([
                  {
                    concepto: 'Ejecutado (causado)',
                    disponible: true,
                    hoy: 'Del libro presupuestal del sistema.',
                    conIntegracion: 'Del libro contable institucional, con la periodicidad de cierre real.',
                  },
                  {
                    concepto: 'Programado',
                    disponible: true,
                    hoy: 'Registrado por periodo y rubro.',
                    conIntegracion: 'Del presupuesto aprobado en el sistema financiero.',
                  },
                  {
                    concepto: 'Comprometido',
                    disponible: false,
                    hoy: 'El libro del sistema no separa lo comprometido de lo causado.',
                    conIntegracion:
                      'Ordenes y contratos firmados y no pagados. La proyeccion al cierre los incorporara.',
                  },
                  {
                    concepto: 'Costo por fase',
                    disponible: false,
                    hoy: 'El gasto se lleva por rubro y periodo, no por fase.',
                    conIntegracion:
                      'Permitira calcular indice de costo por fase, no solo indice de cronograma.',
                  },
                  {
                    concepto: 'Costo por actividad',
                    disponible: false,
                    hoy: 'No se imputa gasto a la actividad.',
                    conIntegracion: 'Habilitara valor ganado a nivel de actividad y no solo de proyecto.',
                  },
                ] satisfies FilaCapacidad[])}
                claveDe={(r) => r.concepto}
              />
            </div>

            <Nota regla="costos.ts">
              El sistema lee el costo a traves de un solo contrato, <code>ProveedorCostos</code>. Conectar la
              herramienta institucional es registrar una implementacion de ese contrato con{' '}
              <code>registrarProveedorCostos()</code>: ninguna pantalla, ningun calculo y ninguna prueba de este
              modulo cambia. Los conceptos marcados como no disponibles dejaran de estarlo sin tocar la interfaz.
            </Nota>
          </Card>

          <Card titulo="Salvedades del calculo" subtitulo="Lo que hay que saber antes de decidir sobre estas cifras.">
            {evm.salvedades.length === 0 ? (
              <Vacio
                titulo="Sin salvedades"
                texto="Los insumos del valor ganado estan completos: presupuesto aprobado, cronograma y costo real registrado."
              />
            ) : (
              <ul className="hg-pila" style={{ gap: 'var(--sp-xs)', margin: 0, paddingLeft: 'var(--sp-lg)' }}>
                {evm.salvedades.map((s) => (
                  <li key={s} className="hg-t-sm hg-t-sec">
                    {s}
                  </li>
                ))}
              </ul>
            )}
            <div className="hg-fila" style={{ marginTop: 'var(--sp-md)' }}>
              <Button variante="secondary" icono={<IconRefrescar size={15} />} onClick={() => void recalcular()}>
                Recalcular y guardar instantanea
              </Button>
              <Pista texto="Cada recalculo guarda un punto en la serie historica del valor ganado. Sin instantaneas, la curva no tiene trayectoria." />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
