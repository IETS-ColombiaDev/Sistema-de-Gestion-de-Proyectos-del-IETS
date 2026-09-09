/**
 * Indicadores del proyecto — EP-18 / EP-22.
 *
 * Los diez indicadores institucionales (incluidos RIES-001 y RIES-002, ausentes
 * del instructivo por D-17) se calculan a partir de los datos fuente. No existe
 * ruta, ni en la interfaz ni en la base de datos, para escribir un resultado a
 * mano: un tablero no se corrige, se corrige el dato (HG-143).
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge, { BadgeEstado } from '@/components/Badge'
import Alert from '@/components/Alert'
import Tabs from '@/components/Tabs'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { BarraMeta, Figura, LineasTemporales } from '@/components/charts'
import { IconCandado, IconExportar, IconIndicador, IconRefrescar } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { definicionPorCodigo, formatearValorIndicador } from '@/domain/indicadores'
import { listarSnapshots } from '@/data/repo'
import { exportarExcel } from '@/lib/exportar'
import { fechaHora } from '@/lib/formato'
import { formatearFecha } from '@/domain/fechas'
import { estadoColors } from '@/styles/theme'
import {
  CATEGORIAS_INDICADOR,
  type CategoriaIndicador,
  type DefinicionIndicador,
  type ResultadoIndicador,
  type Snapshot,
} from '@/domain/types'

/** Modulo del que proviene cada indicador, para la navegacion de trazabilidad. */
const RUTA_FUENTE: Record<string, string> = {
  'PRY-O001': 'cronograma',
  'PRY-O002': 'hitos',
  'PRY-O003': 'productos',
  'PRY-O004': 'presupuesto',
  'PRY-O005': 'satisfaccion',
  'GEST-001': 'cronograma',
  'GEST-002': 'cronograma',
  'GEST-003': 'hitos',
  'RIES-001': 'riesgos',
  'RIES-002': 'riesgos',
}

export default function Indicadores() {
  const { datos, indicadores, catalogoIndicadores, cargando, recalcular } = useProyecto()
  const [vista, setVista] = useState<'tarjetas' | 'tabla' | 'historico'>('tarjetas')
  const [ficha, setFicha] = useState<{ def: DefinicionIndicador; res: ResultadoIndicador } | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  const proyecto = datos?.proyecto

  useEffect(() => {
    if (!proyecto) return
    void listarSnapshots(proyecto.id).then(setSnapshots)
  }, [proyecto])

  const porCategoria = useMemo(() => {
    return CATEGORIAS_INDICADOR.map((cat) => ({
      categoria: cat as CategoriaIndicador,
      items: indicadores
        .map((r) => ({ res: r, def: definicionPorCodigo(r.codigo, catalogoIndicadores) }))
        .filter((x): x is { res: ResultadoIndicador; def: DefinicionIndicador } => Boolean(x.def))
        .filter((x) => x.def.categoria === cat),
    })).filter((g) => g.items.length > 0)
  }, [indicadores, catalogoIndicadores])

  if (cargando || !datos || !proyecto) return <Cargando />

  const conDatos = indicadores.filter((i) => i.valor != null)
  const criticos = indicadores.filter((i) => i.estado === 'Critico')
  const sinDatos = indicadores.filter((i) => i.estado === 'Sin datos')

  const exportar = () =>
    exportarExcel(
      [
        {
          nombre: 'Indicadores',
          filas: indicadores.map((r) => {
            const d = definicionPorCodigo(r.codigo, catalogoIndicadores)
            return {
              Codigo: r.codigo,
              Indicador: d?.nombre ?? '',
              Categoria: d?.categoria ?? '',
              Meta: d?.meta ?? '',
              Sentido: d?.sentido ?? '',
              Resultado: r.valor ?? 'Sin datos',
              Estado: r.estado,
              Detalle: r.detalle,
              'Fecha de corte': r.fechaCorte,
              'Calculado en': r.calculadoEn,
            }
          }),
        },
      ],
      `indicadores-${proyecto.codigo}`,
    )

  return (
    <div className="hg-pila">
      {proyecto.recalculoPendiente && (
        <Alert
          tipo="warning"
          critico
          titulo="Datos pendientes de recalculo"
          mensaje="Se registraron cambios despues del ultimo calculo. Las cifras que ve corresponden a los datos actuales, pero no hay instantanea guardada para esta fecha de corte."
          acciones={
            <Button variante="primary" tamano="sm" icono={<IconRefrescar size={15} />} onClick={() => void recalcular()}>
              Recalcular y guardar instantanea
            </Button>
          }
        />
      )}

      {criticos.length > 0 && (
        <Alert
          tipo="error"
          critico
          titulo={`${criticos.length} indicador(es) en estado critico`}
          mensaje={criticos
            .map((c) => `${c.codigo}: ${definicionPorCodigo(c.codigo, catalogoIndicadores)?.nombre ?? ''}`)
            .join(' · ')}
        />
      )}

      <Card
        titulo="Indicadores institucionales"
        subtitulo={`${conDatos.length} de ${indicadores.length} con datos suficientes · fecha de corte ${formatearFecha(proyecto.fechaCorte)}`}
        acciones={
          <>
            <Tabs
              opciones={[
                { valor: 'tarjetas', etiqueta: 'Por categoria' },
                { valor: 'tabla', etiqueta: 'Tabla' },
                { valor: 'historico', etiqueta: 'Historico', conteo: snapshots.length },
              ]}
              activa={vista}
              onCambiar={(v) => setVista(v as typeof vista)}
              etiquetaAria="Vista de indicadores"
            />
            <Button variante="secondary" tamano="sm" icono={<IconExportar size={15} />} onClick={exportar}>
              Exportar
            </Button>
          </>
        }
      >
        <div
          className="hg-fila"
          style={{
            marginBottom: 'var(--sp-md)',
            padding: 'var(--sp-xs) var(--sp-sm)',
            background: 'var(--c-bg-hover)',
            borderRadius: 'var(--r-base)',
            color: 'var(--c-text-2)',
          }}
        >
          <IconCandado size={14} />
          <span className="hg-t-xs">
            Los resultados no son editables. Para corregir una cifra se corrige el dato fuente en su modulo.
          </span>
          {sinDatos.length > 0 && (
            <Badge fg="#64748B" bg="#F1F5F9">
              {sinDatos.length} sin datos
            </Badge>
          )}
        </div>

        {vista === 'tarjetas' && (
          <div className="hg-pila" style={{ gap: 'var(--sp-lg)' }}>
            {porCategoria.map((grupo) => (
              <div key={grupo.categoria}>
                <div className="hg-etiqueta" style={{ marginBottom: 'var(--sp-xs)' }}>
                  {grupo.categoria}
                </div>
                <div className="hg-grid hg-grid--3">
                  {grupo.items.map(({ def, res }) => {
                    const c = estadoColors.indicador[res.estado]
                    return (
                      <button
                        key={def.codigo}
                        type="button"
                        onClick={() => setFicha({ def, res })}
                        className="hg-kpi"
                        style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', borderLeft: `3px solid ${c.fg}` }}
                      >
                        <div className="hg-fila" style={{ justifyContent: 'space-between', width: '100%' }}>
                          <span className="hg-t-mono hg-t-xs hg-t-ter">{def.codigo}</span>
                          <BadgeEstado familia="indicador" valor={res.estado} />
                        </div>
                        <span className="hg-t-sm hg-t-bold" style={{ minHeight: 38 }}>
                          {def.nombre}
                        </span>
                        <span className="hg-kpi__valor" style={{ color: c.fg, fontSize: 'var(--fs-2xl)' }}>
                          {formatearValorIndicador(res.valor, def.unidad)}
                        </span>
                        <BarraMeta
                          valor={res.valor}
                          meta={def.meta}
                          color={c.fg}
                          sufijo={def.unidad === 'porcentaje' ? ' %' : ''}
                          maximo={def.unidad === 'numero' ? Math.max(5, (res.valor ?? 0) + 2) : undefined}
                        />
                        <span className="hg-t-xs hg-t-sec">
                          Meta {def.meta}
                          {def.unidad === 'porcentaje' ? ' %' : ''} · {def.sentido.toLowerCase()}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {vista === 'tabla' && (
          <Table
            columnas={[
              {
                clave: 'codigo',
                titulo: 'Codigo',
                ordenable: true,
                render: (x: { def: DefinicionIndicador; res: ResultadoIndicador }) => (
                  <span className="hg-t-mono">{x.def.codigo}</span>
                ),
              },
              { clave: 'nombre', titulo: 'Indicador', ordenable: true, render: (x) => x.def.nombre },
              { clave: 'categoria', titulo: 'Categoria', ordenable: true, render: (x) => x.def.categoria },
              {
                clave: 'meta',
                titulo: 'Meta',
                alineacion: 'derecha',
                render: (x) => `${x.def.meta}${x.def.unidad === 'porcentaje' ? ' %' : ''}`,
              },
              {
                clave: 'resultado',
                titulo: 'Resultado',
                alineacion: 'derecha',
                ordenable: true,
                valorOrden: (x) => x.res.valor ?? -1,
                render: (x) => (
                  <strong className="hg-t-num">{formatearValorIndicador(x.res.valor, x.def.unidad)}</strong>
                ),
              },
              {
                clave: 'estado',
                titulo: 'Estado',
                render: (x) => <BadgeEstado familia="indicador" valor={x.res.estado} />,
              },
              {
                clave: 'detalle',
                titulo: 'Como se obtuvo',
                render: (x) => (
                  <span className="hg-t-xs hg-t-sec">{x.res.motivoSinDatos ?? x.res.detalle}</span>
                ),
              },
              {
                clave: 'ir',
                titulo: '',
                alineacion: 'derecha',
                render: (x) => (
                  <Link
                    to={`/proyectos/${proyecto.id}/${RUTA_FUENTE[x.def.codigo] ?? 'tablero'}`}
                    className="hg-t-xs"
                  >
                    Ver datos fuente
                  </Link>
                ),
              },
            ]}
            filas={indicadores
              .map((res) => ({ res, def: definicionPorCodigo(res.codigo, catalogoIndicadores) }))
              .filter((x): x is { res: ResultadoIndicador; def: DefinicionIndicador } => Boolean(x.def))}
            claveDe={(x) => x.def.codigo}
          />
        )}

        {vista === 'historico' &&
          (snapshots.length === 0 ? (
            <Vacio
              titulo="Aun no hay instantaneas guardadas"
              texto="Cada recalculo guarda una instantanea de los indicadores para la fecha de corte vigente. Es lo que permite construir series historicas."
              icono={<IconIndicador size={24} />}
              accion={
                <Button variante="primary" icono={<IconRefrescar size={15} />} onClick={() => void recalcular()}>
                  Guardar instantanea de hoy
                </Button>
              }
            />
          ) : (
            <div className="hg-pila">
              <Figura
                titulo="Evolucion del avance por fecha de corte"
                leyenda={[
                  { etiqueta: 'Avance ponderado', color: '#6366F1' },
                  { etiqueta: 'Avance esperado', color: '#0891B2' },
                ]}
                tabla={
                  <Table
                    columnas={[
                      { clave: 'fechaCorte', titulo: 'Fecha de corte', render: (s: Snapshot) => s.fechaCorte },
                      {
                        clave: 'avancePonderado',
                        titulo: 'Ponderado',
                        alineacion: 'derecha',
                        render: (s) => `${s.avancePonderado} %`,
                      },
                      {
                        clave: 'avanceEsperado',
                        titulo: 'Esperado',
                        alineacion: 'derecha',
                        render: (s) => `${s.avanceEsperado} %`,
                      },
                      {
                        clave: 'desviacion',
                        titulo: 'Desviacion',
                        alineacion: 'derecha',
                        render: (s) => `${s.desviacion} pp`,
                      },
                    ]}
                    filas={snapshots}
                    claveDe={(s) => s.id}
                  />
                }
              >
                <LineasTemporales
                  series={[
                    {
                      nombre: 'Avance ponderado',
                      color: '#6366F1',
                      puntos: snapshots.map((s) => ({ x: s.fechaCorte.slice(5), y: s.avancePonderado })),
                    },
                    {
                      nombre: 'Avance esperado',
                      color: '#0891B2',
                      discontinua: true,
                      puntos: snapshots.map((s) => ({ x: s.fechaCorte.slice(5), y: s.avanceEsperado })),
                    },
                  ]}
                  sufijo=" %"
                />
              </Figura>

              <Table
                columnas={[
                  { clave: 'fechaCorte', titulo: 'Fecha de corte', render: (s: Snapshot) => formatearFecha(s.fechaCorte) },
                  { clave: 'creadoEn', titulo: 'Calculada', render: (s) => fechaHora(s.creadoEn) },
                  ...indicadores.map((i) => ({
                    clave: i.codigo,
                    titulo: i.codigo,
                    alineacion: 'derecha' as const,
                    render: (s: Snapshot) => {
                      const r = s.indicadores.find((x) => x.codigo === i.codigo)
                      const d = definicionPorCodigo(i.codigo, catalogoIndicadores)
                      return r && d ? formatearValorIndicador(r.valor, d.unidad) : '—'
                    },
                  })),
                ]}
                filas={[...snapshots].reverse()}
                claveDe={(s) => s.id}
              />
            </div>
          ))}
      </Card>

      <Modal
        abierto={ficha !== null}
        tamano="lg"
        titulo={ficha ? `${ficha.def.codigo} · ${ficha.def.nombre}` : ''}
        subtitulo="Ficha tecnica del indicador"
        onCerrar={() => setFicha(null)}
        pie={
          ficha && (
            <>
              <Button variante="secondary" onClick={() => setFicha(null)}>
                Cerrar
              </Button>
              <Button variante="primary">
                <Link
                  to={`/proyectos/${proyecto.id}/${RUTA_FUENTE[ficha.def.codigo] ?? 'tablero'}`}
                  style={{ color: '#fff' }}
                >
                  Ver datos fuente
                </Link>
              </Button>
            </>
          )
        }
      >
        {ficha && (
          <div className="hg-pila">
            <div
              className="hg-fila"
              style={{ padding: 'var(--sp-md)', background: 'var(--c-bg-hover)', borderRadius: 'var(--r-base)' }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="hg-etiqueta">Resultado a la fecha de corte</div>
                <div
                  className="hg-kpi__valor"
                  style={{ color: estadoColors.indicador[ficha.res.estado].fg, fontSize: 'var(--fs-3xl)' }}
                >
                  {formatearValorIndicador(ficha.res.valor, ficha.def.unidad)}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="hg-etiqueta">Meta</div>
                <div className="hg-kpi__valor" style={{ fontSize: 'var(--fs-xl)' }}>
                  {ficha.def.meta}
                  {ficha.def.unidad === 'porcentaje' ? ' %' : ''}
                </div>
              </div>
              <BadgeEstado familia="indicador" valor={ficha.res.estado} />
            </div>

            {ficha.res.motivoSinDatos && (
              <Alert tipo="info" titulo="Sin datos suficientes" mensaje={ficha.res.motivoSinDatos} />
            )}

            <Table
              columnas={[
                { clave: 'campo', titulo: 'Atributo', render: (r: { campo: string; valor: string }) => r.campo },
                { clave: 'valor', titulo: 'Definicion', render: (r) => r.valor },
              ]}
              filas={[
                { campo: 'Objetivo', valor: ficha.def.objetivo },
                { campo: 'Formula', valor: ficha.def.formulaDescripcion },
                { campo: 'Fuente', valor: ficha.def.fuente },
                { campo: 'Frecuencia', valor: ficha.def.frecuencia },
                { campo: 'Responsable', valor: ficha.def.responsable },
                { campo: 'Automatizacion', valor: ficha.def.automatizacion },
                { campo: 'Sentido', valor: ficha.def.sentido },
                {
                  campo: 'Umbral de atencion',
                  valor:
                    ficha.def.sentido === 'Mayor es mejor'
                      ? `Resultado >= meta x ${ficha.def.factorAtencionMayor}`
                      : `Resultado <= meta x ${ficha.def.factorAtencionMenor}`,
                },
                { campo: 'Como se obtuvo este resultado', valor: ficha.res.detalle },
                {
                  campo: 'Numerador / denominador',
                  valor:
                    ficha.res.numerador != null
                      ? `${ficha.res.numerador}${ficha.res.denominador != null ? ` de ${ficha.res.denominador}` : ''}`
                      : 'No aplica',
                },
                { campo: 'Ultimo calculo', valor: fechaHora(ficha.res.calculadoEn) },
              ]}
              claveDe={(r) => r.campo}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
