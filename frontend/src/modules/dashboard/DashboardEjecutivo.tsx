/**
 * Dashboard ejecutivo — EP-21.
 * Lectura gerencial de un proyecto. La fecha de corte encabeza la vista y,
 * si hay un recalculo pendiente, se advierte en lugar de presentar cifras
 * viejas como vigentes (HG-138).
 */

import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge, { BadgeEstado } from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Progreso from '@/components/Progreso'
import Table from '@/components/ui/Table'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { BarraApilada, BarraMeta, BarrasHorizontales, Figura } from '@/components/charts'
import { ESTADO } from '@/components/charts/paleta'
import { estadoColors } from '@/styles/theme'
import { IconCheck, IconImprimir, IconRefrescar } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { definicionPorCodigo, formatearValorIndicador } from '@/domain/indicadores'
import { formatearFecha } from '@/domain/fechas'
import { conSigno, monedaCorta, porcentaje } from '@/lib/formato'
import { CATEGORIAS_INDICADOR, DISPONIBILIDAD_RECURSO, NIVELES_RIESGO } from '@/domain/types'

export default function DashboardEjecutivo() {
  const { datos, resumen, indicadores, catalogoIndicadores, alertas, cargando, recalcular } = useProyecto()

  if (cargando || !datos || !resumen) return <Cargando />
  const proyecto = datos.proyecto

  const criticas = alertas.filter((a) => a.severidad === 'critica')
  const colorDesviacion =
    resumen.desviacion.nivel === 'ATENCION'
      ? ESTADO.critico
      : resumen.desviacion.nivel === 'Precaucion'
        ? ESTADO.advertencia
        : ESTADO.bueno

  const presupuesto = datos.presupuesto.reduce(
    (acc, r) => ({
      programado: acc.programado + (r.programado || 0),
      ejecutado: acc.ejecutado + (r.ejecutado || 0),
    }),
    { programado: 0, ejecutado: 0 },
  )

  const hitos = {
    cumplidos: resumen.hitos.filter((h) => h.cumplido).length,
    vencidos: resumen.hitos.filter((h) => h.vencido).length,
    pendientes: resumen.hitos.filter((h) => !h.cumplido && !h.vencido).length,
  }

  return (
    <div className="hg-pila print-full">
      {/* Encabezado */}
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
                fg={proyecto.modoCalculo === 'saneado' ? '#0E7490' : '#92400E'}
                bg={proyecto.modoCalculo === 'saneado' ? '#CFFAFE' : '#FEF3C7'}
                titulo={
                  proyecto.modoCalculo === 'saneado'
                    ? 'Las reglas de calculo aplican las correcciones aprobadas.'
                    : 'Las reglas de calculo replican el libro Excel, defectos incluidos.'
                }
              >
                modo {proyecto.modoCalculo}
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
            <div className="no-print" style={{ marginTop: 'var(--sp-xs)' }}>
              <Button variante="secondary" tamano="sm" icono={<IconImprimir size={15} />} onClick={() => window.print()}>
                Reporte ejecutivo
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {proyecto.recalculoPendiente && (
        <Alert
          tipo="warning"
          critico
          titulo="Datos desactualizados"
          mensaje="Hay cambios registrados despues del ultimo recalculo. Las cifras se derivan de los datos actuales, pero no se ha guardado instantanea para esta fecha de corte."
          acciones={
            <Button variante="primary" tamano="sm" icono={<IconRefrescar size={15} />} onClick={() => void recalcular()}>
              Recalcular ahora
            </Button>
          }
        />
      )}

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

      {/* Avance */}
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Avance ponderado"
          valor={porcentaje(resumen.avancePonderado)}
          pie={
            <Progreso valor={resumen.avancePonderado} meta={resumen.avanceEsperado} />
          }
          acento="#6366F1"
        />
        <KPICard etiqueta="Avance esperado" valor={porcentaje(resumen.avanceEsperado)} pie="A la fecha de corte" acento="#0891B2" />
        <KPICard
          etiqueta="Desviacion"
          valor={conSigno(resumen.desviacion.puntos, 1, ' pp')}
          color={colorDesviacion}
          pie={resumen.desviacion.nivel}
          acento={colorDesviacion}
        />
        <KPICard
          etiqueta="Ejecucion presupuestal"
          valor={
            presupuesto.programado === 0
              ? 'Sin datos'
              : porcentaje((presupuesto.ejecutado / presupuesto.programado) * 100)
          }
          pie={`${monedaCorta(presupuesto.ejecutado)} de ${monedaCorta(presupuesto.programado)}`}
          acento="#15803D"
        />
      </div>

      <div className="hg-grid hg-grid--2">
        <Card titulo="Actividades por estado">
          <Figura
            tabla={
              <Table
                columnas={[
                  { clave: 'estado', titulo: 'Estado', render: (d: (typeof resumen.distribucion)[number]) => d.estado || 'Sin estado' },
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
                color: estadoColors.riesgo[nivel].fg,
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
                color: estadoColors.recurso[d].fg,
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
            <KPICard etiqueta="Cumplidos" valor={hitos.cumplidos} color="#10B981" />
            <KPICard etiqueta="Pendientes" valor={hitos.pendientes} />
            <KPICard
              etiqueta="Vencidos"
              valor={hitos.vencidos}
              color={hitos.vencidos > 0 ? '#EF4444' : undefined}
            />
          </div>
          <div style={{ marginTop: 'var(--sp-md)' }}>
            <Table
              columnas={[
                { clave: 'descripcion', titulo: 'Proximos hitos', render: (h) => <span className="hg-t-sm">{h.descripcion}</span> },
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

      <Card titulo="Avance por fase" subtitulo="Barra: avance real · marca vertical: avance esperado a la fecha de corte.">
        {resumen.porFase.length === 0 ? (
          <Vacio titulo="Sin fases con actividades" texto="Asigne fase a las actividades del cronograma." />
        ) : (
          <Figura
            leyenda={[
              { etiqueta: 'Avance real', color: '#6366F1' },
              { etiqueta: 'Avance esperado (marca)', color: '#0F172A' },
            ]}
            tabla={
              <Table
                columnas={[
                  { clave: 'nombre', titulo: 'Fase', render: (f: (typeof resumen.porFase)[number]) => f.nombre },
                  { clave: 'avance', titulo: 'Avance', alineacion: 'derecha', render: (f) => porcentaje(f.avance) },
                  { clave: 'esp', titulo: 'Esperado', alineacion: 'derecha', render: (f) => porcentaje(f.avanceEsperado) },
                ]}
                filas={resumen.porFase}
                claveDe={(f) => f.faseId}
              />
            }
          >
            <BarrasHorizontales
              datos={resumen.porFase.map((f) => ({
                etiqueta: f.nombre,
                valor: f.avance,
                referencia: f.avanceEsperado,
                color: '#6366F1',
                detalle: `${f.actividades} actividad(es), ${f.retrasadas} retrasada(s)`,
              }))}
            />
          </Figura>
        )}
      </Card>

      <Card
        titulo="Indicadores por categoria"
        subtitulo="Resultado frente a la meta institucional. La marca vertical senala la meta."
        acciones={
          <Link to={`/proyectos/${proyecto.id}/indicadores`} className="hg-btn hg-btn--secondary hg-btn--sm no-print">
            Ver el detalle
          </Link>
        }
      >
        <div className="hg-pila" style={{ gap: 'var(--sp-lg)' }}>
          {CATEGORIAS_INDICADOR.map((cat) => {
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
                          <span className="hg-t-xs hg-t-sec">
                            meta {def.meta}
                            {def.unidad === 'porcentaje' ? ' %' : ''}
                          </span>
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <BarraMeta
                            valor={res.valor}
                            meta={def.meta}
                            color={c.fg}
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

      {alertas.length === 0 && (
        <Card>
          <Vacio
            titulo="El proyecto no presenta alertas"
            texto="A la fecha de corte no hay desviaciones de avance, riesgos criticos abiertos, hitos vencidos ni recursos sin asegurar."
            icono={<IconCheck size={24} />}
          />
        </Card>
      )}
    </div>
  )
}
