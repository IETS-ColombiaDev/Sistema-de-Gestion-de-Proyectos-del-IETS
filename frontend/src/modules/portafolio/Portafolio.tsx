/**
 * Vista de portafolio institucional — HG-144 / HG-145.
 * Responde la pregunta que el archivo Excel no podia responder: como esta el
 * conjunto de proyectos, sin abrir un solo archivo.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Card from '@/components/Card'
import KPICard from '@/components/Dashboard/KPICard'
import Table, { type Columna } from '@/components/ui/Table'
import Badge, { BadgeEstado } from '@/components/Badge'
import Progreso from '@/components/Progreso'
import Button from '@/components/Button'
import { Cargando, ErrorVista, Vacio } from '@/components/EstadoVista'
import { Input, Select } from '@/components/ui/Field'
import { BarrasHorizontales, Figura } from '@/components/charts'
import { ESTADO } from '@/components/charts/paleta'
import { IconExportar, IconFicha, IconMas } from '@/components/icons'
import { usePortafolio, type FilaPortafolio } from '@/app/usePortafolio'
import { formatearFecha } from '@/domain/fechas'
import { conSigno, monedaCorta, porcentaje } from '@/lib/formato'
import { exportarExcel } from '@/lib/exportar'
import { useAuth } from '@/auth/AuthContext'
import { puede } from '@/auth/permisos'
import { ESTADOS_PROYECTO } from '@/domain/types'

export default function Portafolio() {
  const { filas, totales, cargando, error, recargar } = usePortafolio()
  const { usuario } = useAuth()
  const navegar = useNavigate()

  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('')
  const [lider, setLider] = useState('')
  const [financiador, setFinanciador] = useState('')

  const lideres = useMemo(
    () => [...new Set(filas.map((f) => f.proyecto.liderNombre).filter(Boolean))].sort(),
    [filas],
  )
  const financiadores = useMemo(
    () => [...new Set(filas.map((f) => f.proyecto.financiador).filter(Boolean))].sort(),
    [filas],
  )

  const visibles = useMemo(
    () =>
      filas.filter((f) => {
        const p = f.proyecto
        if (estado && p.estado !== estado) return false
        if (lider && p.liderNombre !== lider) return false
        if (financiador && p.financiador !== financiador) return false
        if (texto) {
          const t = texto.toLowerCase()
          if (!`${p.codigo} ${p.nombre} ${p.tecnologiaObjeto}`.toLowerCase().includes(t)) return false
        }
        return true
      }),
    [filas, estado, lider, financiador, texto],
  )

  const columnas: Columna<FilaPortafolio>[] = [
    {
      clave: 'codigo',
      titulo: 'Proyecto',
      ordenable: true,
      valorOrden: (f) => f.proyecto.codigo,
      render: (f) => (
        <div style={{ minWidth: 220 }}>
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
      clave: 'lider',
      titulo: 'Lider',
      ordenable: true,
      valorOrden: (f) => f.proyecto.liderNombre,
      render: (f) => <span className="hg-t-sm">{f.proyecto.liderNombre || '—'}</span>,
    },
    {
      clave: 'avance',
      titulo: 'Avance vs. esperado',
      ancho: '190px',
      ordenable: true,
      valorOrden: (f) => f.resumen.avancePonderado,
      render: (f) => (
        <div>
          <Progreso valor={f.resumen.avancePonderado} meta={f.resumen.avanceEsperado} etiqueta />
          <div className="hg-t-xs hg-t-sec" style={{ marginTop: 2 }}>
            esperado {porcentaje(f.resumen.avanceEsperado)}
          </div>
        </div>
      ),
    },
    {
      clave: 'desviacion',
      titulo: 'Desviacion',
      alineacion: 'derecha',
      ordenable: true,
      valorOrden: (f) => f.resumen.desviacion.puntos,
      render: (f) => (
        <span
          className="hg-t-bold"
          style={{
            color:
              f.resumen.desviacion.nivel === 'ATENCION'
                ? ESTADO.critico
                : f.resumen.desviacion.nivel === 'Precaucion'
                  ? ESTADO.advertencia
                  : ESTADO.bueno,
          }}
          title={f.resumen.desviacion.mensaje}
        >
          {conSigno(f.resumen.desviacion.puntos, 1, ' pp')}
        </span>
      ),
    },
    {
      clave: 'retrasadas',
      titulo: 'Retrasadas',
      alineacion: 'centro',
      ordenable: true,
      valorOrden: (f) => f.resumen.retrasadas.length,
      render: (f) =>
        f.resumen.retrasadas.length > 0 ? (
          <Badge fg="#B91C1C" bg="#FEE2E2">
            {f.resumen.retrasadas.length}
          </Badge>
        ) : (
          <span className="hg-t-ter">0</span>
        ),
    },
    {
      clave: 'riesgos',
      titulo: 'Riesgos criticos',
      alineacion: 'centro',
      ordenable: true,
      valorOrden: (f) => f.resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado').length,
      render: (f) => {
        const n = f.resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado').length
        return n > 0 ? <BadgeEstado familia="riesgo" valor="Critico" titulo={`${n} riesgos criticos`} /> : <span className="hg-t-ter">—</span>
      },
    },
    {
      clave: 'entrega',
      titulo: 'Entrega final',
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
              : `vencido hace ${Math.abs(f.resumen.diasRestantes)} dias`}
          </div>
        </div>
      ),
    },
  ]

  const [orden, setOrden] = useState<{ clave: string; dir: 'asc' | 'desc' } | null>(null)

  if (cargando) return <Cargando />
  if (error)
    return (
      <ErrorVista
        titulo="No fue posible cargar el portafolio"
        detalle={error}
        accion={<Button onClick={() => void recargar()}>Reintentar</Button>}
      />
    )

  const ejecucion =
    totales.presupuestoProgramado > 0
      ? (totales.presupuestoEjecutado / totales.presupuestoProgramado) * 100
      : null

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Proyectos activos"
          valor={totales.activos}
          pie={`${totales.proyectos} en total · ${totales.cerrados} cerrados`}
          acento="#6366F1"
        />
        <KPICard
          etiqueta="Avance medio ponderado"
          valor={porcentaje(totales.avanceMedio)}
          pie="Ponderado por numero de actividades vigentes"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Riesgos criticos abiertos"
          valor={totales.riesgosCriticos}
          color={totales.riesgosCriticos > 0 ? ESTADO.critico : undefined}
          pie={`${totales.hitosVencidos} hitos vencidos`}
          acento={ESTADO.critico}
        />
        <KPICard
          etiqueta="Actividades retrasadas"
          valor={totales.actividadesRetrasadas}
          color={totales.actividadesRetrasadas > 0 ? ESTADO.advertencia : undefined}
          pie={ejecucion != null ? `Ejecucion presupuestal ${porcentaje(ejecucion)}` : 'Sin registros presupuestales'}
          acento={ESTADO.advertencia}
        />
      </div>

      <Card
        titulo="Proyectos del portafolio"
        subtitulo={`${visibles.length} de ${filas.length} proyectos`}
        acciones={
          <>
            <Button
              variante="secondary"
              tamano="sm"
              icono={<IconExportar size={15} />}
              onClick={() =>
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
                        'Avance ponderado (%)': f.resumen.avancePonderado,
                        'Avance esperado (%)': f.resumen.avanceEsperado,
                        'Desviacion (pp)': f.resumen.desviacion.puntos,
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
              }
            >
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
      >
        <div className="hg-barra-filtros" style={{ marginBottom: 'var(--sp-md)' }}>
          <Input
            label="Buscar"
            placeholder="Codigo, nombre u objeto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <Select
            label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            placeholder="Todos"
            opciones={ESTADOS_PROYECTO}
          />
          <Select
            label="Lider"
            value={lider}
            onChange={(e) => setLider(e.target.value)}
            placeholder="Todos"
            opciones={lideres}
          />
          <Select
            label="Financiador"
            value={financiador}
            onChange={(e) => setFinanciador(e.target.value)}
            placeholder="Todos"
            opciones={financiadores}
          />
          {(texto || estado || lider || financiador) && (
            <Button
              variante="ghost"
              onClick={() => {
                setTexto('')
                setEstado('')
                setLider('')
                setFinanciador('')
              }}
            >
              Limpiar
            </Button>
          )}
        </div>

        {visibles.length === 0 ? (
          <Vacio
            titulo="Ningun proyecto coincide con los filtros"
            texto="Ajuste los criterios de busqueda o limpie los filtros para ver el portafolio completo."
            icono={<IconFicha size={24} />}
            accion={
              <Button
                variante="secondary"
                onClick={() => {
                  setTexto('')
                  setEstado('')
                  setLider('')
                  setFinanciador('')
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <Table
            columnas={columnas}
            filas={visibles}
            claveDe={(f) => f.proyecto.id}
            orden={orden}
            onOrden={(clave) =>
              setOrden((o) =>
                o?.clave === clave ? { clave, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { clave, dir: 'asc' },
              )
            }
            claseFila={(f) => (f.alertasCriticas > 3 ? 'hg-fila--critica' : '')}
          />
        )}
      </Card>

      {visibles.length > 0 && (
        <div className="hg-grid hg-grid--2">
          <Card titulo="Avance por proyecto" subtitulo="Barra: avance ponderado · marca: avance esperado">
            <Figura
              leyenda={[
                { etiqueta: 'Avance ponderado', color: '#6366F1' },
                { etiqueta: 'Avance esperado (marca)', color: '#0F172A' },
              ]}
              tabla={
                <Table
                  columnas={[
                    { clave: 'p', titulo: 'Proyecto', render: (f: FilaPortafolio) => f.proyecto.codigo },
                    {
                      clave: 'a',
                      titulo: 'Avance',
                      alineacion: 'derecha',
                      render: (f: FilaPortafolio) => porcentaje(f.resumen.avancePonderado),
                    },
                    {
                      clave: 'e',
                      titulo: 'Esperado',
                      alineacion: 'derecha',
                      render: (f: FilaPortafolio) => porcentaje(f.resumen.avanceEsperado),
                    },
                  ]}
                  filas={visibles}
                  claveDe={(f) => f.proyecto.id}
                />
              }
            >
              <BarrasHorizontales
                datos={visibles.map((f) => ({
                  etiqueta: f.proyecto.codigo,
                  valor: f.resumen.avancePonderado,
                  referencia: f.resumen.avanceEsperado,
                  color: '#6366F1',
                  detalle: f.proyecto.nombre,
                }))}
              />
            </Figura>
          </Card>

          <Card titulo="Ejecucion presupuestal consolidada">
            <div className="hg-grid hg-grid--3">
              <KPICard etiqueta="Programado" valor={monedaCorta(totales.presupuestoProgramado)} />
              <KPICard etiqueta="Ejecutado" valor={monedaCorta(totales.presupuestoEjecutado)} />
              <KPICard
                etiqueta="Desviacion"
                valor={
                  totales.presupuestoProgramado > 0
                    ? conSigno(
                        ((totales.presupuestoEjecutado - totales.presupuestoProgramado) /
                          totales.presupuestoProgramado) *
                          100,
                        1,
                        ' %',
                      )
                    : '—'
                }
                color={
                  totales.presupuestoEjecutado > totales.presupuestoProgramado
                    ? ESTADO.advertencia
                    : ESTADO.bueno
                }
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
