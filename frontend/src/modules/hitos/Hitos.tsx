/**
 * Hitos y ruta critica — EP-11.
 *
 * Dos cambios sustantivos frente al libro:
 *  - vocabulario unico de cinco estados en todos los modulos (corrige D-07);
 *  - la ruta critica se calcula a partir de las dependencias declaradas en el
 *    cronograma, no se transcribe a mano (corrige D-11).
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge, { BadgeEstado } from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { IconEditar, IconEliminar, IconHito, IconMas } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { formatearFecha } from '@/domain/fechas'
import { eliminarEntidad, guardarEntidad } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { ESTADOS_HITO, type Hito, type HitoCalculado } from '@/domain/types'

const VACIO: Partial<Hito> = {
  descripcion: '',
  criterioCumplimiento: '',
  fechaProgramada: null,
  fechaReal: null,
  estado: 'Pendiente',
  condicionante: false,
  actividadesIds: [],
  evidencias: [],
}

export default function Hitos() {
  const { datos, resumen, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'hitos.editar')

  const [edicion, setEdicion] = useState<Partial<Hito> | null>(null)
  const [aEliminar, setAEliminar] = useState<HitoCalculado | null>(null)
  const [comentario, setComentario] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const criticas = useMemo(
    () => (resumen?.actividades ?? []).filter((a) => a.esCritica && !a.vacia),
    [resumen],
  )

  if (cargando || !datos || !resumen || !proyecto) return <Cargando />

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.descripcion?.trim()) e.descripcion = 'La descripcion del hito es obligatoria.'
    if (!edicion.criterioCumplimiento?.trim())
      e.criterioCumplimiento = 'Sin criterio de cumplimiento no se puede verificar el hito.'
    if (!edicion.fechaProgramada) e.fechaProgramada = 'Indique la fecha programada.'
    const exigeReal = edicion.estado === 'Cumplido' || edicion.estado === 'Cumplido con retraso'
    if (exigeReal && !edicion.fechaReal) {
      e.fechaReal = 'Un hito cumplido requiere la fecha real de cumplimiento.'
    }
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      const maxOrden = Math.max(0, ...datos.hitos.map((h) => h.orden || 0))
      await guardarEntidad<Hito>(
        rutas.hitos(proyecto.id),
        {
          ...edicion,
          proyectoId: proyecto.id,
          orden: edicion.orden ?? maxOrden + 1,
        },
        {
          proyectoId: proyecto.id,
          entidad: 'hito',
          etiqueta: edicion.descripcion ?? '',
          tipoCambio: 'Hito',
          comentario: comentario || undefined,
        },
      )
      toast.exito('Hito guardado.')
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
    await eliminarEntidad<Hito>(rutas.hitos(proyecto.id), aEliminar.id, {
      proyectoId: proyecto.id,
      entidad: 'hito',
      etiqueta: aEliminar.descripcion,
      tipoCambio: 'Hito',
      comentario,
    })
    toast.exito('Hito dado de baja.')
    setAEliminar(null)
    setComentario('')
    await recargar()
  }

  const columnas: Columna<HitoCalculado>[] = [
    { clave: 'orden', titulo: '#', alineacion: 'derecha', ordenable: true, render: (h) => h.orden },
    {
      clave: 'descripcion',
      titulo: 'Hito',
      ordenable: true,
      render: (h) => (
        <div style={{ minWidth: 240 }}>
          <span className="hg-t-sm hg-t-bold">{h.descripcion}</span>
          {h.condicionante && (
            <Badge fg="#B45309" bg="#FEF3C7" titulo="Su incumplimiento bloquea actividades posteriores">
              condicionante
            </Badge>
          )}
          {h.enRutaCritica && (
            <Badge fg="#B91C1C" bg="#FEE2E2" titulo="Vinculado a actividades de la ruta critica">
              ruta critica
            </Badge>
          )}
          <div className="hg-t-xs hg-t-sec">{h.criterioCumplimiento}</div>
        </div>
      ),
    },
    {
      clave: 'fechaProgramada',
      titulo: 'Programada',
      ordenable: true,
      render: (h) => <span className="hg-t-sm">{formatearFecha(h.fechaProgramada)}</span>,
    },
    {
      clave: 'fechaReal',
      titulo: 'Real',
      ordenable: true,
      render: (h) => <span className="hg-t-sm">{formatearFecha(h.fechaReal)}</span>,
    },
    {
      clave: 'desviacionDias',
      titulo: 'Desviacion',
      alineacion: 'derecha',
      ordenable: true,
      valorOrden: (h) => h.desviacionDias ?? 0,
      render: (h) =>
        h.desviacionDias == null ? (
          <span className="hg-t-ter">—</span>
        ) : (
          <span
            className="hg-t-num hg-t-bold"
            style={{ color: h.desviacionDias > 0 ? '#B91C1C' : '#047857' }}
            title={h.desviacionDias > 0 ? 'Cumplido despues de lo programado' : 'Cumplido a tiempo o antes'}
          >
            {h.desviacionDias > 0 ? `+${h.desviacionDias}` : h.desviacionDias} d
          </span>
        ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      ordenable: true,
      render: (h) => (
        <div>
          <BadgeEstado familia="hito" valor={h.estado} />
          {h.vencido && (
            <div className="hg-t-xs" style={{ color: '#B91C1C', marginTop: 2 }}>
              vencido hace {Math.abs(h.diasParaVencer ?? 0)} d
            </div>
          )}
        </div>
      ),
    },
    {
      clave: 'actividades',
      titulo: 'Actividades',
      render: (h) => (
        <span className="hg-t-xs hg-t-sec">
          {h.actividadesIds.length === 0
            ? '—'
            : h.actividadesIds
                .map((id) => datos.actividades.find((a) => a.id === id)?.numero ?? '?')
                .join(', ')}
        </span>
      ),
    },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (h) =>
        editable && (
          <div className="hg-fila hg-fila--fin no-print" style={{ flexWrap: 'nowrap' }}>
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label={`Editar ${h.descripcion}`}
              icono={<IconEditar size={15} />}
              onClick={() => {
                setEdicion(structuredClone(h) as Partial<Hito>)
                setErrores({})
              }}
            />
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label={`Dar de baja ${h.descripcion}`}
              icono={<IconEliminar size={15} />}
              onClick={() => setAEliminar(h)}
            />
          </div>
        ),
    },
  ]

  const cumplidos = resumen.hitos.filter((h) => h.cumplido).length
  const vencidos = resumen.hitos.filter((h) => h.vencido).length
  const conRetraso = resumen.hitos.filter((h) => h.estado === 'Cumplido con retraso').length

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Hitos registrados" valor={resumen.hitos.length} acento="#6366F1" />
        <KPICard
          etiqueta="Cumplidos"
          valor={cumplidos}
          pie={`${conRetraso} cumplido(s) con retraso`}
          color="#10B981"
          acento="#15803D"
        />
        <KPICard
          etiqueta="Vencidos"
          valor={vencidos}
          color={vencidos > 0 ? '#EF4444' : undefined}
          pie="Fecha programada superada sin cumplir"
          acento="#EF4444"
        />
        <KPICard
          etiqueta="Actividades en ruta critica"
          valor={criticas.length}
          pie="Calculadas sobre las dependencias declaradas"
          acento="#0891B2"
        />
      </div>

      <Card
        titulo="Hitos del proyecto"
        subtitulo="Un hito cumplido con retraso cuenta como cumplido en el indicador GEST-003 cuando el proyecto opera en modo saneado."
        acciones={
          editable && (
            <Button
              variante="primary"
              tamano="sm"
              icono={<IconMas size={15} />}
              onClick={() => {
                setEdicion({ ...VACIO })
                setErrores({})
              }}
            >
              Nuevo hito
            </Button>
          )
        }
      >
        {resumen.hitos.length === 0 ? (
          <Vacio
            titulo="Aun no hay hitos registrados"
            texto="Los hitos son los puntos de control del proyecto: definen que se entrega, cuando y con que criterio se acepta."
            icono={<IconHito size={24} />}
            accion={
              editable && (
                <Button variante="primary" onClick={() => setEdicion({ ...VACIO })}>
                  Nuevo hito
                </Button>
              )
            }
          />
        ) : (
          <Table
            columnas={columnas}
            filas={[...resumen.hitos].sort((a, b) =>
              (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? ''),
            )}
            claveDe={(h) => h.id}
            claseFila={(h) => (h.vencido ? 'hg-fila--critica' : '')}
          />
        )}
      </Card>

      <Card
        titulo="Ruta critica"
        subtitulo="Secuencia de actividades cuya holgura es cero: cualquier retraso desplaza la fecha de finalizacion."
      >
        {resumen.ciclos.length > 0 ? (
          <Alert
            tipo="warning"
            titulo="No es posible calcular la ruta critica"
            mensaje="Hay dependencias circulares en el cronograma. Corrijalas para habilitar el calculo de holgura."
          />
        ) : criticas.length === 0 ? (
          <Vacio
            titulo="No hay ruta critica calculada"
            texto="La ruta critica se deriva de las dependencias entre actividades. Declare predecesoras en el cronograma para calcularla."
            accion={
              <Button variante="secondary">
                <Link to={`/proyectos/${proyecto.id}/cronograma`}>Ir al cronograma</Link>
              </Button>
            }
          />
        ) : (
          <Table
            columnas={[
              { clave: 'numero', titulo: '#', alineacion: 'derecha', render: (a) => a.numero },
              { clave: 'nombre', titulo: 'Actividad', render: (a) => a.nombre },
              {
                clave: 'fechaInicio',
                titulo: 'Inicio',
                render: (a) => formatearFecha(a.fechaInicio),
              },
              { clave: 'fechaFin', titulo: 'Fin', render: (a) => formatearFecha(a.fechaFin) },
              {
                clave: 'duracion',
                titulo: 'Dias',
                alineacion: 'derecha',
                render: (a) => a.duracion,
              },
              {
                clave: 'holgura',
                titulo: 'Holgura',
                alineacion: 'derecha',
                render: (a) => (a.holgura == null ? '—' : `${a.holgura} d`),
              },
              {
                clave: 'estado',
                titulo: 'Estado',
                render: (a) => <BadgeEstado familia="actividad" valor={a.estado} titulo={a.razonEstado} />,
              },
            ]}
            filas={criticas}
            claveDe={(a) => a.id}
          />
        )}
      </Card>

      <Modal
        abierto={edicion !== null}
        tamano="lg"
        titulo={edicion?.id ? 'Editar hito' : 'Nuevo hito'}
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar hito
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-grid hg-grid--form">
            <Input
              label="Descripcion del hito"
              requerido
              anchoCompleto
              value={edicion.descripcion ?? ''}
              error={errores.descripcion}
              onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })}
            />
            <Textarea
              label="Criterio de cumplimiento"
              requerido
              anchoCompleto
              rows={2}
              value={edicion.criterioCumplimiento ?? ''}
              error={errores.criterioCumplimiento}
              ayuda="Que evidencia concreta permite declarar cumplido el hito."
              onChange={(e) => setEdicion({ ...edicion, criterioCumplimiento: e.target.value })}
            />
            <Input
              label="Fecha programada"
              type="date"
              requerido
              value={edicion.fechaProgramada ?? ''}
              error={errores.fechaProgramada}
              onChange={(e) => setEdicion({ ...edicion, fechaProgramada: e.target.value || null })}
            />
            <Input
              label="Fecha real de cumplimiento"
              type="date"
              value={edicion.fechaReal ?? ''}
              error={errores.fechaReal}
              onChange={(e) => setEdicion({ ...edicion, fechaReal: e.target.value || null })}
            />
            <Select
              label="Estado"
              value={edicion.estado ?? 'Pendiente'}
              opciones={ESTADOS_HITO}
              onChange={(e) => setEdicion({ ...edicion, estado: e.target.value as Hito['estado'] })}
            />
            <Input
              label="Responsable"
              value={edicion.responsableNombre ?? ''}
              onChange={(e) => setEdicion({ ...edicion, responsableNombre: e.target.value })}
            />

            <div className="hg-col-span">
              <Checkbox
                label="Hito condicionante (su incumplimiento bloquea actividades posteriores)"
                checked={edicion.condicionante ?? false}
                onChange={(e) => setEdicion({ ...edicion, condicionante: e.target.checked })}
              />
            </div>

            <div className="hg-campo hg-col-span">
              <span className="hg-campo__label">Actividades asociadas</span>
              <span className="hg-campo__ayuda">
                Vincula el hito con el cronograma; permite advertir incoherencias de fecha.
              </span>
              <div
                className="scroll-discreto"
                style={{
                  maxHeight: 170,
                  overflowY: 'auto',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-base)',
                  padding: 'var(--sp-xs)',
                  marginTop: 4,
                }}
              >
                {datos.actividades
                  .filter((a) => a.nombre?.trim())
                  .map((a) => (
                    <label key={a.id} className="hg-check" style={{ display: 'flex', padding: '3px 0' }}>
                      <input
                        type="checkbox"
                        checked={(edicion.actividadesIds ?? []).includes(a.id)}
                        onChange={(e) => {
                          const s = new Set(edicion.actividadesIds ?? [])
                          if (e.target.checked) s.add(a.id)
                          else s.delete(a.id)
                          setEdicion({ ...edicion, actividadesIds: [...s] })
                        }}
                      />
                      <span className="hg-t-sm">
                        <span className="hg-t-ter">{a.numero}.</span> {a.nombre}
                        <span className="hg-t-xs hg-t-ter"> · fin {formatearFecha(a.fechaFin)}</span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>

            {edicion.fechaProgramada &&
              (edicion.actividadesIds ?? []).some((id) => {
                const a = datos.actividades.find((x) => x.id === id)
                return a?.fechaFin && a.fechaFin > (edicion.fechaProgramada as string)
              }) && (
                <div className="hg-col-span">
                  <Alert
                    tipo="warning"
                    titulo="Fechas incoherentes"
                    mensaje="Alguna actividad asociada termina despues de la fecha programada del hito."
                  />
                </div>
              )}

            <Textarea
              label="Observaciones"
              anchoCompleto
              rows={2}
              value={edicion.observaciones ?? ''}
              onChange={(e) => setEdicion({ ...edicion, observaciones: e.target.value })}
            />

            {edicion.id && (
              <Textarea
                label="Justificacion del cambio"
                anchoCompleto
                rows={2}
                value={comentario}
                ayuda="Los cambios de fecha o de estado de un hito quedan trazados con su justificacion."
                onChange={(e) => setComentario(e.target.value)}
              />
            )}
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aEliminar)}
        titulo="Dar de baja el hito"
        mensaje={
          <>
            El hito <strong>{aEliminar?.descripcion}</strong> dejara de contar en los indicadores de
            cumplimiento. La baja es logica y queda trazada.
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
