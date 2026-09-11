/**
 * Portafolio institucional — EP-23, con lectura de valor ganado.
 *
 * Responde la pregunta que el archivo Excel no podia responder: no "como va
 * cada proyecto" sino "cual de todos exige mi atencion esta semana, y cuanto
 * dinero hay detras". El orden de los bloques es el de esa pregunta:
 *
 *   1. Cuanto dinero esta comprometido y cuanto se proyecta de mas.
 *   2. Que proyecto esta en que cuadrante, con el tamano del que hay en juego.
 *   3. El consolidado en el tiempo.
 *   4. La tabla ranqueada, para quien tenga que actuar.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Card from '@/components/Card'
import KPICard from '@/components/Dashboard/KPICard'
import Table, { type Columna } from '@/components/ui/Table'
import Badge from '@/components/Badge'
import Progreso from '@/components/Progreso'
import Button from '@/components/Button'
import Alert from '@/components/Alert'
import Tabs from '@/components/Tabs'
import { Cargando, ErrorVista, Vacio } from '@/components/EstadoVista'
import FiltroBarra, { useFiltros, type DefinicionFiltro } from '@/components/FiltroBarra'
import { Pista } from '@/components/Ayuda'
import {
  BarrasDivergentes,
  Cuadrante,
  CurvaS,
  DIVERGENTE,
  ESTADO,
  Figura,
  Pareto,
  SERIE_EVM,
  Sparkline,
  tonoDivergente,
} from '@/components/charts'
import { pareto } from '@/domain/costos'
import { esMovil, useMedia } from '@/lib/useMedia'
import { periodosEntre } from '@/domain/costos'
import { IconExportar, IconFicha, IconMas } from '@/components/icons'
import { usePortafolio, type FilaPortafolio } from '@/app/usePortafolio'
import { formatearFecha } from '@/domain/fechas'
import { conSigno, moneda, monedaCorta, porcentaje } from '@/lib/formato'
import { exportarExcel } from '@/lib/exportar'
import { useAuth } from '@/auth/AuthContext'
import { puede } from '@/auth/permisos'
import { ESTADOS_PROYECTO } from '@/domain/types'

type Vista = 'desempeno' | 'consolidado' | 'listado'

export default function Portafolio() {
  const { filas, totales, cargando, error, recargar } = usePortafolio()
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const [vista, setVista] = useState<Vista>('desempeno')
  // Pantalla estrecha: los graficos agrandan su texto y simplifican los ejes.
  const compacto = useMedia(esMovil)
  const [orden, setOrden] = useState<{ clave: string; dir: 'asc' | 'desc' } | null>(null)

  const fmt = (n: number) => monedaCorta(n)
  const fmtExacto = (n: number) => moneda(n)

  // --- Filtros: un solo recorte para todo el tablero ---
  const definiciones = useMemo<DefinicionFiltro[]>(
    () => [
      { clave: 'q', etiqueta: 'Buscar', tipo: 'texto', placeholder: 'Codigo, nombre u objeto', ancho: '200px' },
      { clave: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ESTADOS_PROYECTO },
      {
        clave: 'lider',
        etiqueta: 'Lider',
        tipo: 'select',
        opciones: [...new Set(filas.map((f) => f.proyecto.liderNombre).filter(Boolean))].sort(),
      },
      {
        clave: 'financiador',
        etiqueta: 'Financiador',
        tipo: 'select',
        ancho: '170px',
        opciones: [...new Set(filas.map((f) => f.proyecto.financiador).filter(Boolean))].sort(),
      },
      {
        clave: 'salud',
        etiqueta: 'Desempeno',
        tipo: 'select',
        ancho: '170px',
        placeholder: 'Cualquiera',
        opciones: [
          { valor: 'sobrecosto', etiqueta: 'Con sobrecosto proyectado' },
          { valor: 'atrasado', etiqueta: 'Atrasados' },
          { valor: 'critico', etiqueta: 'Atrasados y sobre costo' },
          { valor: 'sano', etiqueta: 'En linea' },
        ],
        pista: 'Filtra por el cuadrante de desempeno: la combinacion de indice de cronograma e indice de costo.',
      },
      {
        clave: 'entrega',
        etiqueta: 'Entrega hasta',
        tipo: 'fecha',
        ancho: '150px',
        pista: 'Deja solo los proyectos cuya entrega final cae en o antes de esa fecha.',
      },
    ],
    [filas],
  )
  const { valores, set, limpiar, activos } = useFiltros(definiciones, 'pf')

  const visibles = useMemo(
    () =>
      filas.filter((f) => {
        const p = f.proyecto
        const evm = f.analisis.evm
        if (valores.estado && p.estado !== valores.estado) return false
        if (valores.lider && p.liderNombre !== valores.lider) return false
        if (valores.financiador && p.financiador !== valores.financiador) return false
        if (valores.entrega && p.fechaEntregaFinal > valores.entrega) return false
        if (valores.q) {
          const t = valores.q.toLowerCase()
          if (!`${p.codigo} ${p.nombre} ${p.tecnologiaObjeto}`.toLowerCase().includes(t)) return false
        }
        if (valores.salud) {
          const ic = evm.indiceCronograma
          const icr = evm.indiceCosto
          const atrasado = ic != null && ic < 0.95
          const sobre = icr != null && icr < 0.95
          if (valores.salud === 'sobrecosto' && (evm.variacionAlCierre ?? 0) >= 0) return false
          if (valores.salud === 'atrasado' && !atrasado) return false
          if (valores.salud === 'critico' && !(atrasado && sobre)) return false
          if (valores.salud === 'sano' && (atrasado || sobre)) return false
        }
        return true
      }),
    [filas, valores],
  )

  // --- Cuadrante de desempeno ---
  const puntosCuadrante = useMemo(
    () =>
      visibles
        .filter((f) => f.analisis.evm.indiceCronograma != null && f.analisis.evm.indiceCosto != null)
        .map((f) => ({
          id: f.proyecto.id,
          etiqueta: f.proyecto.codigo,
          x: f.analisis.evm.indiceCronograma!,
          y: f.analisis.evm.indiceCosto!,
          magnitud: f.analisis.evm.presupuestoTotal,
          detalle: `Presupuesto ${fmt(f.analisis.evm.presupuestoTotal)} · proyeccion ${
            f.analisis.evm.proyeccionCierre == null ? '—' : fmt(f.analisis.evm.proyeccionCierre)
          }`,
        })),
    [visibles],
  )

  // --- Consolidado en el tiempo: se suman las curvas de los proyectos activos ---
  const curvaConsolidada = useMemo(() => {
    const activos = visibles.filter((f) => f.proyecto.estado === 'activo')
    if (activos.length === 0) return []

    const desde = activos.reduce(
      (min, f) => (f.proyecto.fechaInicio < min ? f.proyecto.fechaInicio : min),
      activos[0].proyecto.fechaInicio,
    )
    const hasta = activos.reduce(
      (max, f) => (f.proyecto.fechaEntregaFinal > max ? f.proyecto.fechaEntregaFinal : max),
      activos[0].proyecto.fechaEntregaFinal,
    )
    const periodoCorte = activos[0].proyecto.fechaCorte.slice(0, 7)

    return periodosEntre(desde, hasta).map((periodo) => {
      let planeado = 0
      let ganado = 0
      let real = 0
      let proyectado = 0
      let hayGanado = false
      let hayReal = false
      let hayProyectado = false

      for (const f of activos) {
        const punto = f.analisis.curva.puntos.find((p) => p.periodo === periodo)
        if (!punto) {
          // Fuera del horizonte del proyecto: aporta su valor final si ya
          // termino, o nada si aun no empieza.
          if (periodo > f.proyecto.fechaEntregaFinal.slice(0, 7)) {
            planeado += f.analisis.evm.presupuestoTotal
          }
          continue
        }
        planeado += punto.planeado
        if (punto.ganado != null) {
          ganado += punto.ganado
          hayGanado = true
        }
        if (punto.real != null) {
          real += punto.real
          hayReal = true
        }
        if (punto.proyectado != null) {
          proyectado += punto.proyectado
          hayProyectado = true
        }
      }

      return {
        periodo,
        planeado,
        ganado: hayGanado ? ganado : null,
        real: hayReal ? real : null,
        proyectado: hayProyectado ? proyectado : null,
        esCorte: periodo === periodoCorte,
        futuro: periodo > periodoCorte,
      }
    })
  }, [visibles])

  // --- Concentracion del presupuesto por proyecto ---
  const concentracion = useMemo(
    () =>
      pareto(
        visibles.map((f) => ({
          clave: f.proyecto.codigo,
          ejecutado: f.analisis.evm.costoReal,
          programado: f.analisis.evm.presupuestoTotal,
          comprometido: 0,
        })),
      ),
    [visibles],
  )

  // --- Desviacion al cierre por proyecto: el dinero que hay que decidir ---
  const desviaciones = useMemo(
    () =>
      visibles
        .filter((f) => f.analisis.evm.variacionAlCierre != null)
        .map((f) => ({
          etiqueta: f.proyecto.codigo,
          valor: f.analisis.evm.variacionAlCierre!,
          detalle: `${f.proyecto.nombre}: presupuesto ${fmt(f.analisis.evm.presupuestoTotal)}, proyeccion ${fmt(f.analisis.evm.proyeccionCierre ?? 0)}.`,
        }))
        .sort((a, b) => a.valor - b.valor),
    [visibles],
  )

  const columnas: Columna<FilaPortafolio>[] = [
    {
      clave: 'codigo',
      titulo: 'Proyecto',
      ordenable: true,
      valorOrden: (f) => f.proyecto.codigo,
      render: (f) => (
        <div style={{ minWidth: 210 }}>
          <Link to={`/proyectos/${f.proyecto.id}/dashboard`} style={{ fontWeight: 600 }}>
            {f.proyecto.codigo}
          </Link>
          <div className="hg-t-xs hg-t-sec">{f.proyecto.nombre}</div>
        </div>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      ancho: '104px',
      ordenable: true,
      valorOrden: (f) => f.proyecto.estado,
      render: (f) => (
        <Badge
          fg={f.proyecto.estado === 'activo' ? '#047857' : f.proyecto.estado === 'cerrado' ? '#64748B' : '#92400E'}
          bg={f.proyecto.estado === 'activo' ? '#D1FAE5' : f.proyecto.estado === 'cerrado' ? '#F1F5F9' : '#FEF3C7'}
          punto
        >
          {f.proyecto.estado}
        </Badge>
      ),
    },
    {
      clave: 'avance',
      titulo: 'Avance y tendencia',
      ancho: '200px',
      ordenable: true,
      valorOrden: (f) => f.resumen.avancePonderado,
      render: (f) => (
        <div>
          <Progreso valor={f.resumen.avancePonderado} meta={f.resumen.avanceEsperado} etiqueta />
          <div className="hg-fila" style={{ gap: 6, marginTop: 2 }}>
            <span className="hg-t-xs hg-t-sec">esp. {porcentaje(f.resumen.avanceEsperado)}</span>
            {f.tendencia.length > 1 && (
              <Sparkline
                valores={f.tendencia}
                ancho={64}
                alto={18}
                etiquetaAria={`Tendencia del avance de ${f.proyecto.codigo}`}
              />
            )}
          </div>
        </div>
      ),
    },
    {
      clave: 'indiceCronograma',
      titulo: 'Cronograma',
      alineacion: 'derecha',
      ancho: '110px',
      ordenable: true,
      valorOrden: (f) => f.analisis.evm.indiceCronograma ?? 0,
      render: (f) => {
        const ic = f.analisis.evm.indiceCronograma
        if (ic == null) return <span className="hg-t-ter">—</span>
        return (
          <span
            className="hg-t-num hg-t-bold"
            style={{ color: ic >= 0.95 ? ESTADO.bueno : ic >= 0.9 ? ESTADO.advertencia : ESTADO.critico }}
            title="Valor ganado dividido por valor planeado"
          >
            {ic.toFixed(2)}
          </span>
        )
      },
    },
    {
      clave: 'indiceCosto',
      titulo: 'Costo',
      alineacion: 'derecha',
      ancho: '96px',
      ordenable: true,
      valorOrden: (f) => f.analisis.evm.indiceCosto ?? 0,
      render: (f) => {
        const icr = f.analisis.evm.indiceCosto
        if (icr == null) return <span className="hg-t-ter">—</span>
        return (
          <span
            className="hg-t-num hg-t-bold"
            style={{ color: icr >= 0.95 ? ESTADO.bueno : icr >= 0.9 ? ESTADO.advertencia : ESTADO.critico }}
            title="Valor ganado dividido por costo real"
          >
            {icr.toFixed(2)}
          </span>
        )
      },
    },
    {
      clave: 'presupuesto',
      titulo: 'Presupuesto',
      alineacion: 'derecha',
      ancho: '130px',
      ordenable: true,
      valorOrden: (f) => f.analisis.evm.presupuestoTotal,
      render: (f) => (
        <div>
          <span className="hg-t-num hg-t-sm">{fmt(f.analisis.evm.presupuestoTotal)}</span>
          <div className="hg-t-xs hg-t-sec">
            consumo {porcentaje(f.analisis.evm.consumoPresupuesto)}
          </div>
        </div>
      ),
    },
    {
      clave: 'variacionAlCierre',
      titulo: 'Al cierre',
      alineacion: 'derecha',
      ancho: '132px',
      ordenable: true,
      valorOrden: (f) => f.analisis.evm.variacionAlCierre ?? 0,
      render: (f) => {
        const vac = f.analisis.evm.variacionAlCierre
        if (vac == null) return <span className="hg-t-ter">—</span>
        return (
          <div>
            <span className="hg-t-num hg-t-bold" style={{ color: tonoDivergente(vac) }}>
              {vac > 0 ? '+' : ''}
              {fmt(vac)}
            </span>
            <div className="hg-t-xs hg-t-sec">
              proy. {fmt(f.analisis.evm.proyeccionCierre ?? 0)}
            </div>
          </div>
        )
      },
    },
    {
      clave: 'alertas',
      titulo: 'Alertas',
      alineacion: 'centro',
      ancho: '104px',
      ordenable: true,
      valorOrden: (f) => f.alertasCriticas,
      render: (f) => {
        const riesgos = f.resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado').length
        return (
          <div className="hg-fila" style={{ gap: 4, justifyContent: 'center' }}>
            {f.resumen.retrasadas.length > 0 && (
              <Badge fg="#B91C1C" bg="#FEE2E2" titulo={`${f.resumen.retrasadas.length} actividades retrasadas`}>
                {f.resumen.retrasadas.length}A
              </Badge>
            )}
            {riesgos > 0 && (
              <Badge fg="#7F1D1D" bg="#FEE2E2" titulo={`${riesgos} riesgos criticos abiertos`}>
                {riesgos}R
              </Badge>
            )}
            {f.alertasCriticas === 0 && <span className="hg-t-ter">—</span>}
          </div>
        )
      },
    },
    {
      clave: 'entrega',
      titulo: 'Entrega final',
      ancho: '128px',
      ordenable: true,
      valorOrden: (f) => f.proyecto.fechaEntregaFinal,
      render: (f) => (
        <div className="hg-t-sm">
          {formatearFecha(f.proyecto.fechaEntregaFinal)}
          <div
            className="hg-t-xs"
            style={{ color: f.resumen.entrega.activa ? ESTADO.critico : 'var(--c-text-3)' }}
          >
            {f.resumen.diasRestantes >= 0
              ? `${f.resumen.diasRestantes} dias`
              : `vencido hace ${Math.abs(f.resumen.diasRestantes)} d`}
          </div>
        </div>
      ),
    },
  ]

  const ordenadas = useMemo(() => {
    if (!orden) return visibles
    const col = columnas.find((c) => c.clave === orden.clave)
    if (!col?.valorOrden) return visibles
    return [...visibles].sort((a, b) => {
      const va = col.valorOrden!(a)
      const vb = col.valorOrden!(b)
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'es', { numeric: true })
      return orden.dir === 'asc' ? cmp : -cmp
    })
  }, [visibles, orden, columnas])

  const exportar = () =>
    exportarExcel(
      [
        {
          nombre: 'Portafolio',
          filas: visibles.map((f) => ({
            Codigo: f.proyecto.codigo,
            Nombre: f.proyecto.nombre,
            Estado: f.proyecto.estado,
            Lider: f.proyecto.liderNombre,
            Financiador: f.proyecto.financiador,
            'Fecha de corte': f.proyecto.fechaCorte,
            'Entrega final': f.proyecto.fechaEntregaFinal,
            'Presupuesto aprobado': f.analisis.evm.presupuestoTotal,
            'Valor planeado': f.analisis.evm.valorPlaneado,
            'Valor ganado': f.analisis.evm.valorGanado,
            'Costo real': f.analisis.evm.costoReal,
            'Indice de cronograma': f.analisis.evm.indiceCronograma,
            'Indice de costo': f.analisis.evm.indiceCosto,
            'Proyeccion al cierre': f.analisis.evm.proyeccionCierre,
            'Variacion al cierre': f.analisis.evm.variacionAlCierre,
            'Eficiencia requerida': f.analisis.evm.eficienciaRequerida,
            Diagnostico: f.analisis.evm.diagnostico.titulo,
            Decision: f.analisis.evm.diagnostico.decision,
            'Actividades retrasadas': f.resumen.retrasadas.length,
            'Riesgos criticos abiertos': f.resumen.riesgos.filter(
              (r) => r.nivel === 'Critico' && r.estado !== 'Cerrado',
            ).length,
            'Hitos vencidos': f.resumen.hitos.filter((h) => h.vencido).length,
          })),
        },
      ],
      'portafolio-higep',
    )

  if (cargando) return <Cargando />
  if (error)
    return (
      <ErrorVista
        titulo="No fue posible cargar el portafolio"
        detalle={error}
        accion={<Button onClick={() => void recargar()}>Reintentar</Button>}
      />
    )

  return (
    <div className="hg-pila">
      <FiltroBarra
        definiciones={definiciones}
        valores={valores}
        onCambio={set}
        onLimpiar={limpiar}
        activos={activos}
        resumen={`${visibles.length} de ${filas.length} proyectos`}
        acciones={
          <>
            <Button variante="secondary" tamano="sm" icono={<IconExportar size={15} />} onClick={exportar}>
              Exportar
            </Button>
            {puede(usuario?.rolGlobal ?? null, 'proyecto.crear') && (
              <Button
                variante="primary"
                tamano="sm"
                icono={<IconMas size={15} />}
                onClick={() => navegar('/proyectos?nuevo=1')}
              >
                Nuevo proyecto
              </Button>
            )}
          </>
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* El dinero en juego                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Presupuesto en ejecucion"
          valor={fmt(totales.presupuestoTotal)}
          pie={`${totales.activos} proyecto(s) activo(s) de ${totales.proyectos}`}
          acento={SERIE_EVM.planeado}
          pista="Suma del presupuesto aprobado de los proyectos activos que pasan el filtro."
        />
        <KPICard
          etiqueta="Avance en dinero"
          valor={porcentaje(totales.avanceMedio)}
          pie={`Valor ganado ${fmt(totales.valorGanado)} · costo real ${fmt(totales.costoReal)}`}
          acento={SERIE_EVM.ganado}
          pista="Valor ganado consolidado sobre presupuesto consolidado. No es el promedio de los porcentajes: cada proyecto pesa lo que vale."
        />
        <KPICard
          etiqueta="Indices consolidados"
          valor={`${totales.indiceCronograma?.toFixed(2) ?? '—'} / ${totales.indiceCosto?.toFixed(2) ?? '—'}`}
          color={
            totales.indiceCosto != null && totales.indiceCosto < 0.95 ? ESTADO.critico : ESTADO.bueno
          }
          pie="Cronograma / costo, sobre los totales en dinero"
          acento={SERIE_EVM.real}
          pista="Los dos indices del portafolio, calculados sobre las magnitudes agregadas en dinero."
        />
        <KPICard
          etiqueta="Sobrecosto proyectado"
          valor={totales.sobrecostoProyectado === 0 ? 'Ninguno' : fmt(totales.sobrecostoProyectado)}
          color={totales.sobrecostoProyectado > 0 ? ESTADO.critico : ESTADO.bueno}
          pie={
            totales.proyectosEnSobrecosto === 0
              ? 'Todos los proyectos cierran dentro del presupuesto'
              : `${totales.proyectosEnSobrecosto} proyecto(s) exceden su presupuesto`
          }
          acento={totales.sobrecostoProyectado > 0 ? DIVERGENTE.desfavorable : DIVERGENTE.favorable}
          pista="Suma de las diferencias negativas entre presupuesto aprobado y proyeccion de cierre. Es el dinero que hay que decidir: aprobarlo, o recortar alcance."
        />
      </div>

      {totales.sobrecostoProyectado > 0 && (
        <Alert
          tipo="error"
          critico
          titulo={`${totales.proyectosEnSobrecosto} proyecto(s) proyectan cerrar por encima de su presupuesto`}
          mensaje={`El sobrecosto proyectado del portafolio suma ${fmtExacto(totales.sobrecostoProyectado)}. Cada proyecto lleva su propia decision en el dashboard ejecutivo.`}
          acciones={
            <Button variante="danger" tamano="sm" onClick={() => set('salud', 'sobrecosto')}>
              Ver solo esos proyectos
            </Button>
          }
        />
      )}

      <Tabs
        opciones={[
          { valor: 'desempeno', etiqueta: 'Desempeno' },
          { valor: 'consolidado', etiqueta: 'Consolidado' },
          { valor: 'listado', etiqueta: 'Listado', conteo: visibles.length },
        ]}
        activa={vista}
        onCambiar={(x) => setVista(x as Vista)}
        etiquetaAria="Secciones del portafolio"
      />

      {/* ================================================================ */}
      {vista === 'desempeno' && (
        <div className="hg-pila">
          <Card
            titulo="Cuadrante de desempeno"
            subtitulo="Cronograma frente a costo. El tamano de cada burbuja es el presupuesto aprobado: lo que hay en juego."
          >
            {puntosCuadrante.length === 0 ? (
              <Vacio
                titulo="Sin proyectos con indices calculables"
                texto="El cuadrante necesita presupuesto aprobado y costo real registrado. Complete la ficha y el control presupuestal."
              />
            ) : (
              <Figura
                descripcion="Haga clic en una burbuja para abrir el dashboard del proyecto."
                tabla={
                  <Table
                    anchoMinimo="700px"
                    columnas={[
                      { clave: 'etiqueta', titulo: 'Proyecto', render: (p: (typeof puntosCuadrante)[number]) => p.etiqueta },
                      { clave: 'x', titulo: 'Indice de cronograma', alineacion: 'derecha', render: (p) => p.x.toFixed(2) },
                      { clave: 'y', titulo: 'Indice de costo', alineacion: 'derecha', render: (p) => p.y.toFixed(2) },
                      {
                        clave: 'magnitud',
                        titulo: 'Presupuesto',
                        alineacion: 'derecha',
                        render: (p) => fmtExacto(p.magnitud),
                      },
                    ]}
                    filas={puntosCuadrante}
                    claveDe={(p) => p.id}
                  />
                }
              >
                <Cuadrante
                  puntos={puntosCuadrante}
                  onPunto={(id) => navegar(`/proyectos/${id}/dashboard`)}
                  compacto={compacto}
                />
              </Figura>
            )}
          </Card>

          <div className="hg-grid hg-grid--2">
            <Card
              titulo="Desviacion proyectada al cierre"
              subtitulo="Diferencia entre el presupuesto aprobado y la proyeccion de cada proyecto."
            >
              {desviaciones.length === 0 ? (
                <Vacio titulo="Sin proyecciones calculables" texto="Se requiere costo real registrado." />
              ) : (
                <Figura
                  leyenda={[
                    { etiqueta: 'Cierra por debajo del presupuesto', color: DIVERGENTE.favorable },
                    { etiqueta: 'Cierra por encima', color: DIVERGENTE.desfavorable },
                  ]}
                  tabla={
                    <Table
                      columnas={[
                        { clave: 'etiqueta', titulo: 'Proyecto', render: (d: (typeof desviaciones)[number]) => d.etiqueta },
                        {
                          clave: 'valor',
                          titulo: 'Variacion al cierre',
                          alineacion: 'derecha',
                          render: (d) => fmtExacto(d.valor),
                        },
                      ]}
                      filas={desviaciones}
                      claveDe={(d) => d.etiqueta}
                    />
                  }
                >
                  <BarrasDivergentes datos={desviaciones} formato={fmt} />
                </Figura>
              )}
            </Card>

            <Card
              titulo="Concentracion del gasto"
              subtitulo="Que proyectos explican la mayor parte del dinero ya ejecutado."
            >
              {concentracion.length === 0 ? (
                <Vacio titulo="Sin gasto registrado" texto="Registre el control presupuestal de los proyectos." />
              ) : (
                <Figura
                  descripcion="Barras: participacion en el gasto. Trazo: participacion acumulada."
                  tabla={
                    <Table
                      columnas={[
                        { clave: 'clave', titulo: 'Proyecto', render: (l: (typeof concentracion)[number]) => l.clave },
                        {
                          clave: 'ejecutado',
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
                      filas={concentracion}
                      claveDe={(l) => l.clave}
                    />
                  }
                >
                  <Pareto
                    lineas={concentracion.map((l) => ({ ...l, importe: l.ejecutado }))}
                    formato={fmtExacto}
                    compacto={compacto}
                  />
                </Figura>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {vista === 'consolidado' && (
        <div className="hg-pila">
          <Card
            titulo="Valor ganado consolidado"
            subtitulo="Suma de las curvas de los proyectos activos que pasan el filtro."
          >
            {curvaConsolidada.length < 2 ? (
              <Vacio
                titulo="Sin horizonte suficiente"
                texto="Se necesitan al menos dos periodos y un proyecto activo para trazar el consolidado."
              />
            ) : (
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
                      { clave: 'periodo', titulo: 'Periodo', render: (p: (typeof curvaConsolidada)[number]) => p.periodo },
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
                    ]}
                    filas={curvaConsolidada}
                    claveDe={(p) => p.periodo}
                  />
                }
              >
                <CurvaS
                  puntos={curvaConsolidada}
                  formato={fmt}
                  presupuesto={totales.presupuestoTotal}
                  alto={320}
                  compacto={compacto}
                />
              </Figura>
            )}
          </Card>

          <div className="hg-grid hg-grid--3">
            <KPICard
              etiqueta="Valor planeado"
              valor={fmt(totales.valorPlaneado)}
              pie="Lo que el conjunto de cronogramas preveia a la fecha de corte"
              acento={SERIE_EVM.planeado}
            />
            <KPICard
              etiqueta="Valor ganado"
              valor={fmt(totales.valorGanado)}
              pie={
                <span
                  style={{
                    color: tonoDivergente(totales.valorGanado - totales.valorPlaneado),
                    fontWeight: 600,
                  }}
                >
                  {conSigno((totales.valorGanado - totales.valorPlaneado) / 1_000_000, 1, ' M')} frente al
                  planeado
                </span>
              }
              acento={SERIE_EVM.ganado}
            />
            <KPICard
              etiqueta="Costo real"
              valor={fmt(totales.costoReal)}
              pie={
                <span
                  style={{
                    color: tonoDivergente(totales.valorGanado - totales.costoReal),
                    fontWeight: 600,
                  }}
                >
                  {conSigno((totales.valorGanado - totales.costoReal) / 1_000_000, 1, ' M')} frente al valor
                  ganado
                </span>
              }
              acento={SERIE_EVM.real}
            />
            <KPICard
              etiqueta="Proyeccion consolidada"
              valor={fmt(totales.proyeccionCierre)}
              pie={`Presupuesto ${fmt(totales.presupuestoTotal)}`}
              acento={DIVERGENTE.neutro}
            />
            <KPICard
              etiqueta="Variacion al cierre"
              valor={conSigno(totales.variacionAlCierre / 1_000_000, 1, ' M')}
              color={totales.variacionAlCierre >= 0 ? ESTADO.bueno : ESTADO.critico}
              pie="Presupuesto menos proyeccion, en millones"
              acento={totales.variacionAlCierre >= 0 ? DIVERGENTE.favorable : DIVERGENTE.desfavorable}
            />
            <KPICard
              etiqueta="Operacion"
              valor={`${totales.actividadesRetrasadas} / ${totales.hitosVencidos}`}
              pie="Actividades retrasadas / hitos vencidos"
              color={totales.actividadesRetrasadas > 0 ? ESTADO.advertencia : undefined}
              acento={ESTADO.advertencia}
            />
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {vista === 'listado' && (
        <Card
          titulo="Proyectos del portafolio"
          subtitulo="Ordenable por cualquier columna. Los indices por debajo de 0,95 marcan desviacion."
        >
          {visibles.length === 0 ? (
            <Vacio
              titulo="Ningun proyecto coincide con los filtros"
              texto="Ajuste los criterios o limpie los filtros para ver el portafolio completo."
              icono={<IconFicha size={24} />}
              accion={
                <Button variante="secondary" onClick={limpiar}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <Table
              anchoMinimo="1180px"
              columnas={columnas}
              filas={ordenadas}
              claveDe={(f) => f.proyecto.id}
              orden={orden}
              onOrden={(clave) =>
                setOrden((o) =>
                  o?.clave === clave ? { clave, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { clave, dir: 'desc' },
                )
              }
              claseFila={(f) =>
                (f.analisis.evm.variacionAlCierre ?? 0) < 0 || f.alertasCriticas > 4
                  ? 'hg-fila--critica'
                  : ''
              }
            />
          )}
          <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-sm)' }}>
            <strong>Cronograma</strong> y <strong>Costo</strong> son los indices de valor ganado.{' '}
            <strong>Al cierre</strong> es la diferencia entre el presupuesto aprobado y la proyeccion:
            negativa significa que el proyecto va a cerrar por encima de lo aprobado.
            <Pista texto="Los indices no son porcentajes de avance: son razones. 0,80 en costo significa que cada peso de trabajo esta costando 1,25 pesos." />
          </p>
        </Card>
      )}
    </div>
  )
}
