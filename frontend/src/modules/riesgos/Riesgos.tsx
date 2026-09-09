/**
 * Matriz de riesgos — EP-13.
 * Es el modulo mejor construido del libro original: sus reglas se migran sin
 * cambios (RN-12 severidad = probabilidad x impacto, RN-13 cortes 4/9/14).
 * Se agrega mapa de calor, historial de valoracion y control de integridad.
 */

import { useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge, { BadgeEstado } from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { Figura, MapaCalor } from '@/components/charts'
import { IconEditar, IconEliminar, IconExportar, IconMas, IconRiesgo } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { mapaCalorRiesgos, nivelRiesgo, severidadRiesgo, validarRiesgo } from '@/domain/reglas'
import { valoresActivos } from '@/domain/catalogos'
import { eliminarEntidad, guardarEntidad } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { exportarExcel } from '@/lib/exportar'
import { fechaHora } from '@/lib/formato'
import { formatearFecha, hoyISO } from '@/domain/fechas'
import { ESTADOS_RIESGO, type Riesgo, type RiesgoCalculado } from '@/domain/types'

const VACIO: Partial<Riesgo> = {
  codigo: '',
  categoria: '',
  descripcion: '',
  probabilidad: null,
  impacto: null,
  planRespuesta: '',
  responsableNombre: '',
  estado: 'Identificado',
  historial: [],
}

export default function Riesgos() {
  const { datos, resumen, listas, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'riesgos.editar')

  const [edicion, setEdicion] = useState<Partial<Riesgo> | null>(null)
  const [aEliminar, setAEliminar] = useState<RiesgoCalculado | null>(null)
  const [historial, setHistorial] = useState<RiesgoCalculado | null>(null)
  const [comentario, setComentario] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const categorias = useMemo(() => valoresActivos(listas, 'categoriaRiesgo'), [listas])

  const riesgos = useMemo(() => {
    const base = resumen?.riesgos ?? []
    return base.filter((r) => {
      if (filtroNivel && r.nivel !== filtroNivel) return false
      if (filtroEstado && r.estado !== filtroEstado) return false
      return true
    })
  }, [resumen, filtroNivel, filtroEstado])

  if (cargando || !datos || !resumen || !proyecto) return <Cargando />

  const severidadPrevia = severidadRiesgo(edicion?.probabilidad ?? null, edicion?.impacto ?? null)
  const nivelPrevio = nivelRiesgo(severidadPrevia)

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.descripcion?.trim()) e.descripcion = 'La descripcion del riesgo es obligatoria.'
    if (!edicion.categoria) e.categoria = 'Seleccione una categoria.'
    for (const p of validarRiesgo({ probabilidad: edicion.probabilidad ?? null, impacto: edicion.impacto ?? null })) {
      e[p.campo] = p.mensaje
    }
    if (edicion.estado !== 'Identificado' && (!edicion.planRespuesta?.trim())) {
      e.planRespuesta = 'Un riesgo en gestion requiere plan de respuesta.'
    }
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      const anterior = datos.riesgos.find((r) => r.id === edicion.id)
      const cambioValoracion =
        !anterior ||
        anterior.probabilidad !== edicion.probabilidad ||
        anterior.impacto !== edicion.impacto ||
        anterior.estado !== edicion.estado

      const historialNuevo = cambioValoracion
        ? [
            ...(edicion.historial ?? []),
            {
              fecha: new Date().toISOString(),
              probabilidad: edicion.probabilidad ?? null,
              impacto: edicion.impacto ?? null,
              estado: edicion.estado as Riesgo['estado'],
              usuario: usuario?.nombre ?? 'sistema',
            },
          ]
        : (edicion.historial ?? [])

      const consecutivo = datos.riesgos.length + 1
      await guardarEntidad<Riesgo>(
        rutas.riesgos(proyecto.id),
        {
          ...edicion,
          proyectoId: proyecto.id,
          codigo: edicion.codigo?.trim() || `R-${String(consecutivo).padStart(3, '0')}`,
          fechaIdentificacion: edicion.fechaIdentificacion ?? hoyISO(),
          historial: historialNuevo,
        },
        {
          proyectoId: proyecto.id,
          entidad: 'riesgo',
          etiqueta: `${edicion.codigo ?? ''} · ${edicion.descripcion ?? ''}`,
          tipoCambio: 'Riesgo',
          comentario: comentario || undefined,
        },
      )
      toast.exito('Riesgo guardado.')
      setEdicion(null)
      setComentario('')
      await recargar()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!aEliminar) return
    await eliminarEntidad<Riesgo>(rutas.riesgos(proyecto.id), aEliminar.id, {
      proyectoId: proyecto.id,
      entidad: 'riesgo',
      etiqueta: `${aEliminar.codigo} · ${aEliminar.descripcion}`,
      tipoCambio: 'Riesgo',
      comentario,
    })
    toast.exito('Riesgo dado de baja.')
    setAEliminar(null)
    setComentario('')
    await recargar()
  }

  const columnas: Columna<RiesgoCalculado>[] = [
    { clave: 'codigo', titulo: 'Codigo', ordenable: true, render: (r) => <span className="hg-t-mono">{r.codigo}</span> },
    {
      clave: 'descripcion',
      titulo: 'Riesgo',
      ordenable: true,
      render: (r) => (
        <div style={{ minWidth: 280 }}>
          <span className="hg-t-sm">{r.descripcion}</span>
          <div className="hg-t-xs hg-t-sec">{r.categoria}</div>
          {r.incompleto && (
            <Badge fg="#92400E" bg="#FEF3C7" titulo="Riesgo activo sin valoracion completa">
              sin valorar
            </Badge>
          )}
        </div>
      ),
    },
    {
      clave: 'probabilidad',
      titulo: 'Prob.',
      alineacion: 'centro',
      ordenable: true,
      render: (r) => r.probabilidad ?? '—',
    },
    { clave: 'impacto', titulo: 'Impacto', alineacion: 'centro', ordenable: true, render: (r) => r.impacto ?? '—' },
    {
      clave: 'severidad',
      titulo: 'Severidad',
      alineacion: 'centro',
      ordenable: true,
      valorOrden: (r) => r.severidad ?? 0,
      render: (r) => <span className="hg-t-num hg-t-bold">{r.severidad ?? '—'}</span>,
    },
    {
      clave: 'nivel',
      titulo: 'Nivel',
      ordenable: true,
      valorOrden: (r) => r.severidad ?? 0,
      render: (r) => (r.nivel ? <BadgeEstado familia="riesgo" valor={r.nivel} /> : <span className="hg-t-ter">—</span>),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      ordenable: true,
      render: (r) => (
        <Badge
          fg={r.estado === 'Cerrado' ? '#047857' : r.estado === 'Materializado' ? '#B91C1C' : '#1D4ED8'}
          bg={r.estado === 'Cerrado' ? '#D1FAE5' : r.estado === 'Materializado' ? '#FEE2E2' : '#DBEAFE'}
          punto
        >
          {r.estado}
        </Badge>
      ),
    },
    { clave: 'responsableNombre', titulo: 'Responsable', ordenable: true, render: (r) => r.responsableNombre || '—' },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (r) => (
        <div className="hg-fila hg-fila--fin no-print" style={{ flexWrap: 'nowrap' }}>
          <Button variante="ghost" tamano="sm" onClick={() => setHistorial(r)}>
            Historial
          </Button>
          {editable && (
            <>
              <Button
                variante="ghost"
                tamano="sm"
                soloIcono
                aria-label={`Editar ${r.codigo}`}
                icono={<IconEditar size={15} />}
                onClick={() => {
                  setEdicion(structuredClone(r) as Partial<Riesgo>)
                  setErrores({})
                }}
              />
              <Button
                variante="ghost"
                tamano="sm"
                soloIcono
                aria-label={`Dar de baja ${r.codigo}`}
                icono={<IconEliminar size={15} />}
                onClick={() => setAEliminar(r)}
              />
            </>
          )}
        </div>
      ),
    },
  ]

  const criticos = resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado')
  const materializados = resumen.riesgos.filter((r) => r.estado === 'Materializado')
  const abiertos = resumen.riesgos.filter((r) => r.estado !== 'Cerrado')

  return (
    <div className="hg-pila">
      {criticos.length > 0 && (
        <Alert
          tipo="error"
          critico
          titulo={`${criticos.length} riesgo(s) critico(s) abierto(s)`}
          mensaje={criticos.map((r) => `${r.codigo}: ${r.descripcion}`).join(' · ')}
        />
      )}

      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Riesgos abiertos" valor={abiertos.length} pie={`${resumen.riesgos.length} registrados`} acento="#6366F1" />
        <KPICard
          etiqueta="Criticos abiertos"
          valor={criticos.length}
          color={criticos.length > 0 ? '#EF4444' : undefined}
          pie="Indicador RIES-001 · meta 0"
          acento="#EF4444"
        />
        <KPICard
          etiqueta="Materializados"
          valor={materializados.length}
          color={materializados.length > 0 ? '#EA580C' : undefined}
          pie="Indicador RIES-002 · meta 0"
          acento="#EA580C"
        />
        <KPICard
          etiqueta="Severidad promedio"
          valor={
            abiertos.filter((r) => r.severidad != null).length === 0
              ? '—'
              : (
                  abiertos.reduce((s, r) => s + (r.severidad ?? 0), 0) /
                  abiertos.filter((r) => r.severidad != null).length
                ).toFixed(1)
          }
          pie="Probabilidad x impacto de los riesgos abiertos"
          acento="#CA8A04"
        />
      </div>

      <div className="hg-grid hg-grid--2">
        <Card
          titulo="Mapa de calor"
          subtitulo="Probabilidad (vertical) por impacto (horizontal). Solo riesgos abiertos."
        >
          <Figura
            descripcion="Cada celda muestra el numero de riesgos con esa combinacion."
            tabla={
              <Table
                columnas={[
                  { clave: 'nivel', titulo: 'Nivel', render: (r: { nivel: string; n: number }) => r.nivel },
                  { clave: 'n', titulo: 'Riesgos', alineacion: 'derecha', render: (r) => r.n },
                ]}
                filas={(['Bajo', 'Medio', 'Alto', 'Critico'] as const).map((nivel) => ({
                  nivel,
                  n: abiertos.filter((r) => r.nivel === nivel).length,
                }))}
                claveDe={(r) => r.nivel}
              />
            }
          >
            <MapaCalor
              matriz={mapaCalorRiesgos(resumen.riesgos)}
              onCelda={(p, i) => {
                const nivel = nivelRiesgo(p * i)
                setFiltroNivel(nivel ?? '')
                setFiltroEstado('')
              }}
            />
          </Figura>
          <div className="hg-fila" style={{ marginTop: 'var(--sp-sm)' }}>
            {(['Bajo', 'Medio', 'Alto', 'Critico'] as const).map((n) => (
              <BadgeEstado key={n} familia="riesgo" valor={n} />
            ))}
          </div>
        </Card>

        <Card titulo="Distribucion por categoria">
          <Table
            columnas={[
              { clave: 'categoria', titulo: 'Categoria', render: (r: { categoria: string; total: number; criticos: number }) => r.categoria },
              { clave: 'total', titulo: 'Riesgos', alineacion: 'derecha', render: (r) => r.total },
              {
                clave: 'criticos',
                titulo: 'Criticos',
                alineacion: 'derecha',
                render: (r) =>
                  r.criticos > 0 ? (
                    <span style={{ color: '#B91C1C', fontWeight: 700 }}>{r.criticos}</span>
                  ) : (
                    <span className="hg-t-ter">0</span>
                  ),
              },
            ]}
            filas={[...new Set(resumen.riesgos.map((r) => r.categoria))].sort().map((categoria) => ({
              categoria,
              total: resumen.riesgos.filter((r) => r.categoria === categoria).length,
              criticos: resumen.riesgos.filter(
                (r) => r.categoria === categoria && r.nivel === 'Critico' && r.estado !== 'Cerrado',
              ).length,
            }))}
            claveDe={(r) => r.categoria}
            vacio="Aun no hay riesgos registrados."
          />
        </Card>
      </div>

      <Card
        titulo="Registro de riesgos"
        subtitulo="La severidad y el nivel son campos calculados: no se capturan ni se editan."
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
                      nombre: 'Riesgos',
                      filas: resumen.riesgos.map((r) => ({
                        Codigo: r.codigo,
                        Categoria: r.categoria,
                        Descripcion: r.descripcion,
                        Probabilidad: r.probabilidad,
                        Impacto: r.impacto,
                        Severidad: r.severidad,
                        Nivel: r.nivel,
                        Estado: r.estado,
                        'Plan de respuesta': r.planRespuesta,
                        Responsable: r.responsableNombre,
                        'Fecha de identificacion': r.fechaIdentificacion,
                      })),
                    },
                  ],
                  `riesgos-${proyecto.codigo}`,
                )
              }
            >
              Exportar
            </Button>
            {editable && (
              <Button
                variante="primary"
                tamano="sm"
                icono={<IconMas size={15} />}
                onClick={() => {
                  setEdicion({ ...VACIO, categoria: categorias[0] ?? '' })
                  setErrores({})
                }}
              >
                Nuevo riesgo
              </Button>
            )}
          </>
        }
      >
        <div className="hg-barra-filtros" style={{ marginBottom: 'var(--sp-md)' }}>
          <Select
            label="Nivel"
            value={filtroNivel}
            onChange={(e) => setFiltroNivel(e.target.value)}
            placeholder="Todos"
            opciones={['Bajo', 'Medio', 'Alto', 'Critico']}
          />
          <Select
            label="Estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            placeholder="Todos"
            opciones={ESTADOS_RIESGO}
          />
          {(filtroNivel || filtroEstado) && (
            <Button
              variante="ghost"
              onClick={() => {
                setFiltroNivel('')
                setFiltroEstado('')
              }}
            >
              Limpiar
            </Button>
          )}
        </div>

        {riesgos.length === 0 ? (
          <Vacio
            titulo="No hay riesgos que coincidan"
            texto="Identifique los riesgos del proyecto y valorelos en escalas de 1 a 5. La severidad y el nivel se calculan solos."
            icono={<IconRiesgo size={24} />}
            accion={
              editable && (
                <Button variante="primary" onClick={() => setEdicion({ ...VACIO, categoria: categorias[0] ?? '' })}>
                  Nuevo riesgo
                </Button>
              )
            }
          />
        ) : (
          <Table
            columnas={columnas}
            filas={[...riesgos].sort((a, b) => (b.severidad ?? 0) - (a.severidad ?? 0))}
            claveDe={(r) => r.id}
            claseFila={(r) => (r.nivel === 'Critico' && r.estado !== 'Cerrado' ? 'hg-fila--critica' : '')}
          />
        )}
      </Card>

      <Modal
        abierto={edicion !== null}
        tamano="lg"
        titulo={edicion?.id ? 'Editar riesgo' : 'Nuevo riesgo'}
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar riesgo
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-pila">
            <div className="hg-grid hg-grid--form">
              <Input
                label="Codigo"
                value={edicion.codigo ?? ''}
                ayuda="Se genera automaticamente si se deja vacio."
                onChange={(e) => setEdicion({ ...edicion, codigo: e.target.value })}
              />
              <Select
                label="Categoria"
                requerido
                value={edicion.categoria ?? ''}
                error={errores.categoria}
                placeholder="Seleccione…"
                opciones={categorias}
                onChange={(e) => setEdicion({ ...edicion, categoria: e.target.value })}
              />
              <Textarea
                label="Descripcion del riesgo"
                requerido
                anchoCompleto
                rows={2}
                value={edicion.descripcion ?? ''}
                error={errores.descripcion}
                onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })}
              />
              <Select
                label="Probabilidad (1 a 5)"
                value={edicion.probabilidad?.toString() ?? ''}
                error={errores.probabilidad}
                placeholder="Sin valorar"
                opciones={['1', '2', '3', '4', '5']}
                onChange={(e) =>
                  setEdicion({ ...edicion, probabilidad: e.target.value ? Number(e.target.value) : null })
                }
              />
              <Select
                label="Impacto (1 a 5)"
                value={edicion.impacto?.toString() ?? ''}
                error={errores.impacto}
                placeholder="Sin valorar"
                opciones={['1', '2', '3', '4', '5']}
                onChange={(e) => setEdicion({ ...edicion, impacto: e.target.value ? Number(e.target.value) : null })}
              />
              <Select
                label="Estado"
                value={edicion.estado ?? 'Identificado'}
                opciones={ESTADOS_RIESGO}
                onChange={(e) => setEdicion({ ...edicion, estado: e.target.value as Riesgo['estado'] })}
              />
              <Input
                label="Responsable"
                value={edicion.responsableNombre ?? ''}
                onChange={(e) => setEdicion({ ...edicion, responsableNombre: e.target.value })}
              />
              <Textarea
                label="Plan de mitigacion o respuesta"
                anchoCompleto
                rows={3}
                value={edicion.planRespuesta ?? ''}
                error={errores.planRespuesta}
                onChange={(e) => setEdicion({ ...edicion, planRespuesta: e.target.value })}
              />
            </div>

            <div
              className="hg-fila"
              style={{
                padding: 'var(--sp-sm) var(--sp-md)',
                background: 'var(--c-bg-hover)',
                borderRadius: 'var(--r-base)',
              }}
            >
              <span className="hg-etiqueta">Calculado</span>
              <span className="hg-t-sm">
                Severidad: <strong className="hg-t-num">{severidadPrevia ?? '—'}</strong>
              </span>
              {nivelPrevio && <BadgeEstado familia="riesgo" valor={nivelPrevio} />}
              <span className="hg-t-xs hg-t-sec">Cortes: ≤4 Bajo · ≤9 Medio · ≤14 Alto · resto Critico</span>
            </div>

            {edicion.id && (
              <Textarea
                label="Justificacion del cambio"
                rows={2}
                value={comentario}
                ayuda="El cierre de un riesgo exige justificacion. Queda en la auditoria."
                onChange={(e) => setComentario(e.target.value)}
              />
            )}
          </div>
        )}
      </Modal>

      <Modal
        abierto={historial !== null}
        titulo="Historial de valoracion"
        subtitulo={historial ? `${historial.codigo} · ${historial.descripcion}` : undefined}
        onCerrar={() => setHistorial(null)}
      >
        {historial && (
          <Table
            columnas={[
              { clave: 'fecha', titulo: 'Fecha', render: (h) => fechaHora(h.fecha) },
              { clave: 'probabilidad', titulo: 'Prob.', alineacion: 'centro', render: (h) => h.probabilidad ?? '—' },
              { clave: 'impacto', titulo: 'Impacto', alineacion: 'centro', render: (h) => h.impacto ?? '—' },
              {
                clave: 'severidad',
                titulo: 'Severidad',
                alineacion: 'centro',
                render: (h) => severidadRiesgo(h.probabilidad, h.impacto) ?? '—',
              },
              { clave: 'estado', titulo: 'Estado', render: (h) => h.estado },
              { clave: 'usuario', titulo: 'Registro', render: (h) => h.usuario },
            ]}
            filas={[...(historial.historial ?? [])].reverse()}
            claveDe={(h) => h.fecha}
            vacio="Sin cambios de valoracion registrados."
          />
        )}
        <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-sm)' }}>
          Identificado el {formatearFecha(historial?.fechaIdentificacion ?? null)}.
        </p>
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aEliminar)}
        titulo="Dar de baja el riesgo"
        mensaje={
          <>
            El riesgo <strong>{aEliminar?.codigo}</strong> dejara de contar en los indicadores. Si el riesgo se
            gestiono y ya no aplica, lo correcto suele ser cerrarlo, no darlo de baja.
          </>
        }
        textoConfirmar="Dar de baja"
        exigeComentario
        comentario={comentario}
        onComentario={setComentario}
        onConfirmar={() => void eliminar()}
        onCerrar={() => {
          setAEliminar(null)
          setComentario('')
        }}
      />
    </div>
  )
}
