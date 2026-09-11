/**
 * Tablero de seguimiento — EP-19.
 * Sustituye la hoja operativa del libro y concentra las correcciones de
 * D-02 (unidades del avance esperado), D-03 (fecha de entrega y ventana de
 * alertas parametrizadas) y D-08 (avance por fase sobre la lista unica).
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Badge, { BadgeEstado } from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Progreso from '@/components/Progreso'
import Table from '@/components/ui/Table'
import { Cargando, Vacio } from '@/components/EstadoVista'
import {
  ALTO,
  BarraApilada,
  BarrasAgrupadas,
  BarrasHorizontales,
  Figura,
  LineaHitos,
  LineasTemporales,
} from '@/components/charts'
import FiltroBarra, { useFiltros, type DefinicionFiltro } from '@/components/FiltroBarra'
import { CATEGORICOS } from '@/components/charts/paleta'
import { ESTADO } from '@/components/charts/paleta'
import { estadoColors } from '@/styles/theme'
import { IconAlerta, IconCheck, IconFlechaDer } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { formatearFecha } from '@/domain/fechas'
import { conSigno, porcentaje } from '@/lib/formato'
import type { Alerta as TipoAlerta, SeveridadAlerta } from '@/domain/types'
import { ESTADOS_ACTIVIDAD } from '@/domain/types'

const COLOR_SEVERIDAD: Record<SeveridadAlerta, { fg: string; bg: string; etiqueta: string }> = {
  critica: { fg: '#B91C1C', bg: '#FEE2E2', etiqueta: 'Critica' },
  alta: { fg: '#C2410C', bg: '#FFEDD5', etiqueta: 'Alta' },
  media: { fg: '#92400E', bg: '#FEF3C7', etiqueta: 'Media' },
  informativa: { fg: '#1D4ED8', bg: '#DBEAFE', etiqueta: 'Informativa' },
}

export default function Tablero() {
  const { datos, resumen, alertas, instantaneas, cargando } = useProyecto()

  /**
   * Una sola fila de filtros para todo el tablero.
   *
   * La severidad vivia antes como pestanas dentro de la tarjeta de alertas.
   * Moverla aqui evita la incoherencia de tener un filtro de tarjeta junto a
   * uno de tablero: con los dos, dos zonas de la misma pantalla podian estar
   * mostrando cortes distintos sin que se notara.
   */
  const definiciones = useMemo<DefinicionFiltro[]>(
    () => [
      {
        clave: 'fase',
        etiqueta: 'Fase',
        tipo: 'select',
        placeholder: 'Todas',
        opciones: (resumen?.porFase ?? []).map((f) => ({ valor: f.faseId, etiqueta: f.nombre })),
        pista: 'Acota las actividades, el avance por fase y los retrasos a una sola fase.',
      },
      {
        clave: 'estado',
        etiqueta: 'Estado',
        tipo: 'select',
        placeholder: 'Todos',
        opciones: ESTADOS_ACTIVIDAD as readonly string[],
      },
      {
        clave: 'responsable',
        etiqueta: 'Responsable',
        tipo: 'select',
        placeholder: 'Todos',
        opciones: [
          ...new Set(
            (resumen?.actividades ?? [])
              .map((a) => a.responsableNombre)
              .filter((n): n is string => Boolean(n)),
          ),
        ].sort(),
        pista: 'Quien responde por la actividad segun el cronograma.',
      },
      {
        clave: 'severidad',
        etiqueta: 'Severidad de alerta',
        tipo: 'select',
        placeholder: 'Todas',
        opciones: [
          { valor: 'critica', etiqueta: 'Critica' },
          { valor: 'alta', etiqueta: 'Alta' },
          { valor: 'media', etiqueta: 'Media' },
          { valor: 'informativa', etiqueta: 'Informativa' },
        ],
      },
    ],
    [resumen],
  )
  const { valores, set, limpiar, activos } = useFiltros(definiciones, 'tb')

  /** Actividades tras el filtro; de aqui salen todos los recuentos del tablero. */
  const actividades = useMemo(() => {
    let base = (resumen?.actividades ?? []).filter((a) => !a.vacia)
    if (valores.fase) base = base.filter((a) => a.faseId === valores.fase)
    if (valores.estado) base = base.filter((a) => a.estado === valores.estado)
    if (valores.responsable) base = base.filter((a) => a.responsableNombre === valores.responsable)
    return base
  }, [resumen, valores.fase, valores.estado, valores.responsable])

  /**
   * La distribucion se RECALCULA sobre las actividades filtradas.
   *
   * Filtrar el recuento ya agregado daria porcentajes sobre un total que no
   * corresponde a lo que se esta viendo: 12 de 28 seguiria diciendo 43 % aunque
   * en pantalla solo haya 12 actividades.
   */
  const distribucion = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const a of actividades) conteo.set(a.estado, (conteo.get(a.estado) ?? 0) + 1)
    const total = actividades.length || 1
    return [...conteo.entries()]
      .map(([estado, n]) => ({ estado, conteo: n, porcentaje: (n / total) * 100 }))
      .sort((a, b) => b.conteo - a.conteo)
  }, [actividades])

  const porFase = useMemo(() => {
    const base = resumen?.porFase ?? []
    return valores.fase ? base.filter((f) => f.faseId === valores.fase) : base
  }, [resumen, valores.fase])

  /**
   * Tendencia de la brecha, punto a punto.
   *
   * Sale de las instantaneas guardadas, nunca de una reconstruccion: si no hay
   * al menos dos cortes, el tablero lo dice en vez de trazar una linea que
   * nadie midio.
   */
  const tendencia = useMemo(() => {
    const ordenadas = [...instantaneas].sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte))
    if (ordenadas.length < 2) return null
    /**
     * Se grafica la DESVIACION, no las dos curvas.
     *
     * Real y esperado corren entre 0 y 100 %, mientras que la brecha entre
     * ambas vive en el orden de un punto porcentual. Superpuestas, las dos
     * lineas se pisan y la pregunta de la tarjeta queda sin responder. La
     * diferencia, en su propia escala y con el cero como referencia, la
     * responde de un vistazo: por encima del cero se va adelantado, por debajo
     * se va atrasado, y la pendiente dice si la brecha se cierra o se abre.
     * Las dos series originales siguen disponibles en la vista de tabla.
     */
    return [
      {
        nombre: 'Desviacion',
        color: CATEGORICOS[0],
        puntos: ordenadas.map((i) => ({ x: i.fechaCorte, y: i.desviacion })),
      },
    ]
  }, [instantaneas])

  /**
   * Vencimientos de las proximas ocho semanas, separando lo que ya esta en
   * curso de lo que ni siquiera ha empezado. Responde la pregunta operativa que
   * el avance acumulado no responde: que se viene encima y con cuanto margen.
   */
  const vencimientos = useMemo(() => {
    if (!datos) return []
    const corte = new Date(`${datos.proyecto.fechaCorte}T00:00:00Z`).getTime()
    const semana = 7 * 86_400_000
    const cubos = Array.from({ length: 8 }, (_, i) => ({
      etiqueta: `S+${i + 1}`,
      valores: [0, 0],
    }))
    for (const a of actividades) {
      if (!a.fechaFin || a.avance >= 100) continue
      const fin = new Date(`${a.fechaFin}T00:00:00Z`).getTime()
      const indice = Math.floor((fin - corte) / semana)
      if (indice < 0 || indice > 7) continue
      cubos[indice].valores[a.avance > 0 ? 0 : 1] += 1
    }
    return cubos.filter((c) => c.valores[0] + c.valores[1] > 0)
  }, [actividades, datos])

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

  if (cargando || !datos || !resumen) return <Cargando />
  const proyecto = datos.proyecto

  const severidad = (valores.severidad || 'todas') as SeveridadAlerta | 'todas'
  const alertasVisibles =
    severidad === 'todas' ? alertas : alertas.filter((a) => a.severidad === severidad)
  const retrasadas = actividades.filter((a) => a.estado === 'Retrasada')

  const colorDesviacion =
    resumen.desviacion.nivel === 'ATENCION'
      ? ESTADO.critico
      : resumen.desviacion.nivel === 'Precaucion'
        ? ESTADO.advertencia
        : ESTADO.bueno

  const hitosProximos = resumen.hitos
    .filter((h) => !h.cumplido)
    .sort((a, b) => (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? ''))
    .slice(0, 8)

  return (
    <div className="hg-pila">
      {/* Encabezado de corte: lo primero visible, conforme al instructivo */}
      <Card>
        <div className="hg-fila" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="hg-etiqueta">Fecha de corte</span>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {formatearFecha(proyecto.fechaCorte, 'largo')}
            </div>
            <span className="hg-t-sm hg-t-sec">
              Vigencia {formatearFecha(proyecto.fechaInicio)} — {formatearFecha(proyecto.fechaEntregaFinal)}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="hg-etiqueta">Dias para la entrega final</span>
            <div
              style={{
                fontSize: 'var(--fs-2xl)',
                fontWeight: 700,
                color: resumen.entrega.activa ? ESTADO.critico : 'var(--c-text)',
              }}
            >
              {resumen.diasRestantes}
            </div>
            <span className="hg-t-xs hg-t-sec">
              Ventana de alerta: {resumen.ctx.parametros.ventanaAlertaDias} dias
            </span>
          </div>
        </div>
      </Card>

      <FiltroBarra
        definiciones={definiciones}
        valores={valores}
        onCambio={set}
        onLimpiar={limpiar}
        activos={activos}
        resumen={`${actividades.length} actividad(es) · ${porFase.length} fase(s) · ${alertasVisibles.length} alerta(s)`}
      />

      {resumen.entrega.activa && (
        <Alert
          tipo={resumen.entrega.vencida ? 'error' : 'warning'}
          critico
          titulo={resumen.entrega.vencida ? 'Entrega final vencida' : 'Entrega final proxima'}
          mensaje={resumen.entrega.mensaje}
        />
      )}

      {resumen.desviacion.nivel !== 'En linea' && (
        <Alert
          tipo={resumen.desviacion.nivel === 'ATENCION' ? 'error' : 'warning'}
          critico
          titulo={
            resumen.desviacion.nivel === 'ATENCION'
              ? 'ATENCION: desviacion de avance significativa'
              : 'Precaucion: el avance va por debajo de lo programado'
          }
          mensaje={resumen.desviacion.mensaje}
        />
      )}

      {/* El avance ponderado, el esperado y la desviacion son cifras DEL
          PROYECTO: recalcularlas sobre una fase cambiaria lo que significan, y
          los umbrales que las semaforizan son umbrales de proyecto. Por eso el
          filtro no las toca. Lo que si corresponde es decirlo, en vez de dejar
          una fila que parece filtrada y no lo esta. */}
      {activos.length > 0 && (
        <p className="hg-t-xs hg-t-sec" style={{ margin: 0 }}>
          Las cuatro cifras siguientes son del proyecto completo y no cambian con el filtro. El recorte
          aplica a los tableros de mas abajo.
        </p>
      )}

      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Avance ponderado"
          valor={porcentaje(resumen.avancePonderado)}
          pie="Ponderado por duracion de cada actividad"
          acento="#6366F1"
          pista="Suma de (duracion x avance) de cada actividad, dividida por la suma de duraciones. Una actividad larga pesa mas que una corta. Las actividades sin nombre o sin fechas quedan fuera del calculo."
        />
        <KPICard
          etiqueta="Avance esperado"
          valor={porcentaje(resumen.avanceEsperado)}
          pie="Lo que la programacion preveia a la fecha de corte"
          acento="#0891B2"
          pista="Las actividades ya vencidas aportan el 100 % de su duracion; las que estan en curso aportan la fraccion de duracion transcurrida. Ambos terminos en dias habiles, en la misma unidad."
        />
        <KPICard
          etiqueta="Desviacion"
          valor={conSigno(resumen.desviacion.puntos, 1, ' pp')}
          color={colorDesviacion}
          pie={`Umbrales: ${resumen.ctx.parametros.umbralPrecaucion} pp precaucion · ${resumen.ctx.parametros.umbralAtencion} pp atencion`}
          acento={colorDesviacion}
          pista="Avance ponderado menos avance esperado, en puntos porcentuales. Los dos umbrales que definen precaucion y atencion se administran en el catalogo de parametros."
        />
        <KPICard
          etiqueta="Avance simple"
          valor={porcentaje(resumen.avanceSimple)}
          pie="Promedio sin ponderar, solo de referencia"
          acento="#94A3B8"
          pista="Promedio aritmetico del porcentaje de avance de las actividades vigentes. No pondera por duracion, asi que no debe usarse para reportar el avance del proyecto."
        />
      </div>

      <div className="hg-grid hg-grid--2">
        <Card titulo="Actividades por estado" subtitulo="Distribucion sobre las actividades vigentes.">
          <Figura
            tabla={
              <Table
                columnas={[
                  { clave: 'estado', titulo: 'Estado', render: (d: (typeof distribucion)[number]) => d.estado || 'Sin estado' },
                  { clave: 'conteo', titulo: 'Actividades', alineacion: 'derecha', render: (d) => d.conteo },
                  { clave: 'porcentaje', titulo: '%', alineacion: 'derecha', render: (d) => porcentaje(d.porcentaje) },
                ]}
                filas={distribucion}
                claveDe={(d) => d.estado || 'vacio'}
              />
            }
          >
            <BarraApilada
              segmentos={distribucion.map((d) => ({
                etiqueta: d.estado || 'Sin estado',
                valor: d.conteo,
                color:
                  estadoColors.actividad[d.estado as keyof typeof estadoColors.actividad]?.bar ??
                  '#CBD5E1',
              }))}
            />
          </Figura>
        </Card>

        <Card
          titulo="Avance por fase"
          subtitulo="Sobre la lista unica de fases del proyecto: el tablero la consume, no la reescribe."
        >
          {porFase.length === 0 ? (
            <Vacio titulo="Sin fases con actividades" texto="Registre actividades y asigneles fase en el cronograma." />
          ) : (
            <Figura
              leyenda={[
                { etiqueta: 'Avance real', color: '#6366F1' },
                { etiqueta: 'Avance esperado (marca)', color: '#0F172A' },
              ]}
              tabla={
                <Table
                  columnas={[
                    { clave: 'nombre', titulo: 'Fase', render: (f: (typeof porFase)[number]) => f.nombre },
                    { clave: 'actividades', titulo: 'Actividades', alineacion: 'derecha', render: (f) => f.actividades },
                    { clave: 'avance', titulo: 'Avance', alineacion: 'derecha', render: (f) => porcentaje(f.avance) },
                    {
                      clave: 'avanceEsperado',
                      titulo: 'Esperado',
                      alineacion: 'derecha',
                      render: (f) => porcentaje(f.avanceEsperado),
                    },
                    { clave: 'retrasadas', titulo: 'Retrasadas', alineacion: 'derecha', render: (f) => f.retrasadas },
                  ]}
                  filas={porFase}
                  claveDe={(f) => f.faseId}
                />
              }
            >
              <BarrasHorizontales
                datos={porFase.map((f) => ({
                  etiqueta: f.nombre,
                  valor: f.avance,
                  referencia: f.avanceEsperado,
                  color: '#6366F1',
                  detalle: `${f.actividades} actividad(es) · ${f.completadas} completada(s) · ${f.retrasadas} retrasada(s)`,
                }))}
              />
            </Figura>
          )}
        </Card>
      </div>

      <div className="hg-grid hg-grid--2">
        <Card
          titulo="¿La brecha se cierra o se abre?"
          subtitulo="Diferencia entre el avance real y el esperado en cada corte guardado, en puntos porcentuales. Sobre el cero, adelantado; bajo el cero, atrasado."
        >
          {tendencia == null ? (
            <Vacio
              titulo="Aun no hay trayectoria"
              texto="La tendencia se construye con las instantaneas guardadas en cada fecha de corte. Con menos de dos cortes no hay serie que trazar, y reconstruirla hacia atras seria inventar datos que nadie midio."
            />
          ) : (
            <Figura
              tabla={
                <Table
                  columnas={[
                    {
                      clave: 'fecha',
                      titulo: 'Corte',
                      render: (i: (typeof instantaneas)[number]) => formatearFecha(i.fechaCorte),
                    },
                    { clave: 'real', titulo: 'Real', alineacion: 'derecha', render: (i) => porcentaje(i.avancePonderado) },
                    { clave: 'esperado', titulo: 'Esperado', alineacion: 'derecha', render: (i) => porcentaje(i.avanceEsperado) },
                    {
                      clave: 'desviacion',
                      titulo: 'Desviacion',
                      alineacion: 'derecha',
                      render: (i) => conSigno(i.desviacion, 1, ' pp'),
                    },
                  ]}
                  filas={[...instantaneas].sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte))}
                  claveDe={(i) => i.id}
                />
              }
            >
              <LineasTemporales
                series={tendencia}
                formatoValor={(v) => conSigno(v, 1, ' pp')}
                alto={ALTO.md}
              />
            </Figura>
          )}
        </Card>

        <Card
          titulo="Que vence en las proximas ocho semanas"
          subtitulo="Actividades sin terminar, por semana de vencimiento. Lo que no ha empezado con la fecha encima es el riesgo real."
        >
          {vencimientos.length === 0 ? (
            <Vacio
              titulo="Sin vencimientos proximos"
              texto="Ninguna actividad pendiente vence en las ocho semanas siguientes a la fecha de corte."
              icono={<IconCheck size={24} />}
            />
          ) : (
            <Figura
              leyenda={[
                { etiqueta: 'En curso', color: CATEGORICOS[0] },
                { etiqueta: 'Sin iniciar', color: CATEGORICOS[3] },
              ]}
              tabla={
                <Table
                  columnas={[
                    {
                      clave: 'etiqueta',
                      titulo: 'Semana',
                      render: (g: (typeof vencimientos)[number]) => g.etiqueta,
                    },
                    { clave: 'curso', titulo: 'En curso', alineacion: 'derecha', render: (g) => g.valores[0] },
                    { clave: 'sin', titulo: 'Sin iniciar', alineacion: 'derecha', render: (g) => g.valores[1] },
                  ]}
                  filas={vencimientos}
                  claveDe={(g) => g.etiqueta}
                />
              }
            >
              <BarrasAgrupadas
                grupos={vencimientos}
                series={[
                  { nombre: 'En curso', color: CATEGORICOS[0] },
                  { nombre: 'Sin iniciar', color: CATEGORICOS[3] },
                ]}
                formato={(n) => `${n}`}
                sufijo=" act."
                alto={ALTO.md}
              />
            </Figura>
          )}
        </Card>
      </div>

      <Card
        titulo="Hitos en el tiempo"
        subtitulo="Puntos de control del proyecto sobre la linea de vigencia, con la fecha de corte marcada."
      >
        {hitosLinea.length === 0 ? (
          <Vacio titulo="Sin hitos programados" texto="Registre hitos con fecha en el modulo de Hitos y ruta critica." />
        ) : (
          <Figura
            tabla={
              <Table
                columnas={[
                  {
                    clave: 'descripcion',
                    titulo: 'Hito',
                    render: (h: (typeof hitosLinea)[number]) => h.descripcion,
                  },
                  { clave: 'fecha', titulo: 'Programado', render: (h) => formatearFecha(h.fecha) },
                  { clave: 'estado', titulo: 'Estado', render: (h) => <BadgeEstado familia="hito" valor={h.estado} /> },
                  {
                    clave: 'desviacionDias',
                    titulo: 'Desviacion',
                    alineacion: 'derecha',
                    render: (h) => (h.desviacionDias == null ? '—' : `${h.desviacionDias} d`),
                  },
                ]}
                filas={hitosLinea}
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
        )}
      </Card>

      <Card
        titulo="Centro de alertas"
        subtitulo="Todo lo que requiere atencion, en un solo lugar, con su regla de origen y su ruta de resolucion."
      >
        {alertasVisibles.length === 0 ? (
          <Vacio
            titulo={severidad === 'todas' ? 'Sin alertas activas' : 'Sin alertas de esa severidad'}
            texto="El proyecto no presenta desviaciones que requieran atencion a la fecha de corte."
            icono={<IconCheck size={24} />}
          />
        ) : (
          <div className="hg-pila" style={{ gap: 'var(--sp-xs)' }}>
            {alertasVisibles.map((a: TipoAlerta) => {
              const c = COLOR_SEVERIDAD[a.severidad]
              return (
                <div
                  key={a.id}
                  className="hg-alert"
                  style={{ borderLeftColor: c.fg }}
                  role={a.severidad === 'critica' ? 'alert' : undefined}
                >
                  <span className="hg-alert__icono" style={{ background: c.bg, color: c.fg }}>
                    <IconAlerta size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hg-fila" style={{ gap: 'var(--sp-xs)' }}>
                      <span className="hg-alert__titulo">{a.titulo}</span>
                      <Badge fg={c.fg} bg={c.bg}>
                        {c.etiqueta}
                      </Badge>
                      <Badge fg="#64748B" bg="#F1F5F9" titulo="Modulo de origen">
                        {a.modulo}
                      </Badge>
                      <Badge fg="#94A3B8" bg="#F8FAFC" titulo="Regla de negocio que genera la alerta">
                        {a.regla}
                      </Badge>
                    </div>
                    <div className="hg-alert__mensaje">{a.mensaje}</div>
                  </div>
                  <Link to={a.ruta} className="hg-btn hg-btn--ghost hg-btn--sm no-print" style={{ flex: 'none' }}>
                    Resolver <IconFlechaDer size={14} />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="hg-grid hg-grid--2">
        <Card
          titulo="Actividades retrasadas"
          subtitulo={`${retrasadas.length} actividad(es) con fecha fin superada y avance inferior al 100 %.`}
        >
          {retrasadas.length === 0 ? (
            <Vacio titulo="Ninguna actividad retrasada" texto="Todas las actividades vencidas estan completadas." icono={<IconCheck size={24} />} />
          ) : (
            <Table
              columnas={[
                { clave: 'numero', titulo: '#', alineacion: 'derecha', render: (a) => a.numero },
                {
                  clave: 'nombre',
                  titulo: 'Actividad',
                  render: (a) => (
                    <div>
                      <span className="hg-t-sm">{a.nombre}</span>
                      <div className="hg-t-xs hg-t-sec">{a.responsableNombre || 'Sin responsable'}</div>
                    </div>
                  ),
                },
                { clave: 'fechaFin', titulo: 'Fin', render: (a) => formatearFecha(a.fechaFin) },
                {
                  clave: 'avance',
                  titulo: 'Avance',
                  render: (a) => <Progreso valor={a.avance} meta={a.avanceEsperado} etiqueta />,
                },
                {
                  clave: 'ir',
                  titulo: '',
                  alineacion: 'derecha',
                  render: () => (
                    <Link to={`/proyectos/${proyecto.id}/cronograma?estado=Retrasada`} className="hg-t-xs">
                      Actualizar
                    </Link>
                  ),
                },
              ]}
              filas={retrasadas.slice(0, 10)}
              claveDe={(a) => a.id}
            />
          )}
        </Card>

        <Card titulo="Hitos proximos y vencidos" subtitulo="Ordenados por fecha programada.">
          {hitosProximos.length === 0 ? (
            <Vacio titulo="No hay hitos pendientes" texto="Todos los hitos registrados estan cumplidos." icono={<IconCheck size={24} />} />
          ) : (
            <Table
              columnas={[
                {
                  clave: 'descripcion',
                  titulo: 'Hito',
                  render: (h) => (
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
                {
                  clave: 'dias',
                  titulo: 'Dias',
                  alineacion: 'derecha',
                  render: (h) =>
                    h.diasParaVencer == null ? (
                      '—'
                    ) : (
                      <span style={{ color: h.diasParaVencer < 0 ? '#B91C1C' : undefined, fontWeight: 600 }}>
                        {h.diasParaVencer}
                      </span>
                    ),
                },
                { clave: 'estado', titulo: 'Estado', render: (h) => <BadgeEstado familia="hito" valor={h.estado} /> },
              ]}
              filas={hitosProximos}
              claveDe={(h) => h.id}
              claseFila={(h) => (h.vencido ? 'hg-fila--critica' : '')}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
