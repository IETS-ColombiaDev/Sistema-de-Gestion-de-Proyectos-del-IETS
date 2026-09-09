/**
 * Tablero de seguimiento — EP-19.
 * Sustituye la hoja operativa del libro y concentra las correcciones de
 * D-02 (unidades del avance esperado), D-03 (fecha de entrega y ventana de
 * alertas parametrizadas) y D-08 (avance por fase sobre la lista unica).
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Badge, { BadgeEstado } from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Progreso from '@/components/Progreso'
import Table from '@/components/ui/Table'
import Tabs from '@/components/Tabs'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { BarraApilada, BarrasHorizontales, Figura } from '@/components/charts'
import { ESTADO } from '@/components/charts/paleta'
import { estadoColors } from '@/styles/theme'
import { IconAlerta, IconCheck, IconFlechaDer } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { formatearFecha } from '@/domain/fechas'
import { conSigno, porcentaje } from '@/lib/formato'
import type { Alerta as TipoAlerta, SeveridadAlerta } from '@/domain/types'

const COLOR_SEVERIDAD: Record<SeveridadAlerta, { fg: string; bg: string; etiqueta: string }> = {
  critica: { fg: '#B91C1C', bg: '#FEE2E2', etiqueta: 'Critica' },
  alta: { fg: '#C2410C', bg: '#FFEDD5', etiqueta: 'Alta' },
  media: { fg: '#92400E', bg: '#FEF3C7', etiqueta: 'Media' },
  informativa: { fg: '#1D4ED8', bg: '#DBEAFE', etiqueta: 'Informativa' },
}

export default function Tablero() {
  const { datos, resumen, alertas, cargando } = useProyecto()
  const [severidad, setSeveridad] = useState<SeveridadAlerta | 'todas'>('todas')

  if (cargando || !datos || !resumen) return <Cargando />
  const proyecto = datos.proyecto

  const alertasVisibles =
    severidad === 'todas' ? alertas : alertas.filter((a) => a.severidad === severidad)

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

      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Avance ponderado"
          valor={porcentaje(resumen.avancePonderado)}
          pie="Ponderado por duracion de cada actividad"
          acento="#6366F1"
        />
        <KPICard
          etiqueta="Avance esperado"
          valor={porcentaje(resumen.avanceEsperado)}
          pie="Lo que la programacion preveia a la fecha de corte"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Desviacion"
          valor={conSigno(resumen.desviacion.puntos, 1, ' pp')}
          color={colorDesviacion}
          pie={`Umbrales: ${resumen.ctx.parametros.umbralPrecaucion} pp precaucion · ${resumen.ctx.parametros.umbralAtencion} pp atencion`}
          acento={colorDesviacion}
        />
        <KPICard
          etiqueta="Avance simple"
          valor={porcentaje(resumen.avanceSimple)}
          pie="Promedio sin ponderar, solo de referencia"
          acento="#94A3B8"
        />
      </div>

      <div className="hg-grid hg-grid--2">
        <Card titulo="Actividades por estado" subtitulo="Distribucion sobre las actividades vigentes.">
          <Figura
            tabla={
              <Table
                columnas={[
                  { clave: 'estado', titulo: 'Estado', render: (d: (typeof resumen.distribucion)[number]) => d.estado || 'Sin estado' },
                  { clave: 'conteo', titulo: 'Actividades', alineacion: 'derecha', render: (d) => d.conteo },
                  { clave: 'porcentaje', titulo: '%', alineacion: 'derecha', render: (d) => porcentaje(d.porcentaje) },
                ]}
                filas={resumen.distribucion}
                claveDe={(d) => d.estado || 'vacio'}
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

        <Card
          titulo="Avance por fase"
          subtitulo="Sobre la lista unica de fases del proyecto: el tablero la consume, no la reescribe."
        >
          {resumen.porFase.length === 0 ? (
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
                    { clave: 'nombre', titulo: 'Fase', render: (f: (typeof resumen.porFase)[number]) => f.nombre },
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
                  detalle: `${f.actividades} actividad(es) · ${f.completadas} completada(s) · ${f.retrasadas} retrasada(s)`,
                }))}
              />
            </Figura>
          )}
        </Card>
      </div>

      <Card
        titulo="Centro de alertas"
        subtitulo="Todo lo que requiere atencion, en un solo lugar, con su regla de origen y su ruta de resolucion."
        acciones={
          <Tabs
            opciones={[
              { valor: 'todas', etiqueta: 'Todas', conteo: alertas.length },
              { valor: 'critica', etiqueta: 'Criticas', conteo: alertas.filter((a) => a.severidad === 'critica').length },
              { valor: 'alta', etiqueta: 'Altas', conteo: alertas.filter((a) => a.severidad === 'alta').length },
              { valor: 'media', etiqueta: 'Medias', conteo: alertas.filter((a) => a.severidad === 'media').length },
            ]}
            activa={severidad}
            onCambiar={(v) => setSeveridad(v as SeveridadAlerta | 'todas')}
            etiquetaAria="Filtrar alertas por severidad"
          />
        }
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
          subtitulo={`${resumen.retrasadas.length} actividad(es) con fecha fin superada y avance inferior al 100 %.`}
        >
          {resumen.retrasadas.length === 0 ? (
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
              filas={resumen.retrasadas.slice(0, 10)}
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
