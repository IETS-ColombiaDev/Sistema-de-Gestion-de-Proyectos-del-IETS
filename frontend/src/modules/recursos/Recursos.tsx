/**
 * Recursos e insumos — EP-14.
 * El libro tenia cuatro filas fijas, una por tipo, y la columna de
 * disponibilidad sin validacion (D-09). Aqui la disponibilidad es una lista
 * controlada unica y no hay limite de registros.
 */

import { useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge, { BadgeEstado } from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Tabs from '@/components/Tabs'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { BarraApilada, Figura, RELLENO_RECURSO } from '@/components/charts'
import { IconEditar, IconEliminar, IconMas, IconRecurso } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { eliminarEntidad, guardarEntidad } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { DISPONIBILIDAD_RECURSO, TIPOS_RECURSO, type Recurso } from '@/domain/types'

const VACIO: Partial<Recurso> = {
  tipo: 'Humano',
  descripcion: '',
  cantidad: '',
  fasesIds: [],
  disponibilidad: 'Por gestionar',
}

export default function Recursos() {
  const { datos, resumen, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'recursos.editar')

  const [vista, setVista] = useState<'lista' | 'fase'>('lista')
  const [edicion, setEdicion] = useState<Partial<Recurso> | null>(null)
  const [aEliminar, setAEliminar] = useState<Recurso | null>(null)
  const [comentario, setComentario] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroDisp, setFiltroDisp] = useState('')

  const recursos = useMemo(() => {
    const base = datos?.recursos ?? []
    return base.filter((r) => {
      if (filtroTipo && r.tipo !== filtroTipo) return false
      if (filtroDisp && r.disponibilidad !== filtroDisp) return false
      return true
    })
  }, [datos, filtroTipo, filtroDisp])

  if (cargando || !datos || !resumen || !proyecto) return <Cargando />

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.descripcion?.trim()) e.descripcion = 'Describa el recurso o insumo.'
    if (!edicion.cantidad?.trim()) e.cantidad = 'Indique la cantidad o el detalle.'
    if ((edicion.fasesIds ?? []).length === 0) e.fasesIds = 'Seleccione al menos una fase.'
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      await guardarEntidad<Recurso>(
        rutas.recursos(proyecto.id),
        { ...edicion, proyectoId: proyecto.id },
        {
          proyectoId: proyecto.id,
          entidad: 'recurso',
          etiqueta: `${edicion.tipo} · ${edicion.descripcion}`,
          tipoCambio: 'Recurso',
          comentario: comentario || undefined,
        },
      )
      toast.exito('Recurso guardado.')
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
    await eliminarEntidad<Recurso>(rutas.recursos(proyecto.id), aEliminar.id, {
      proyectoId: proyecto.id,
      entidad: 'recurso',
      etiqueta: aEliminar.descripcion,
      tipoCambio: 'Recurso',
      comentario,
    })
    toast.exito('Recurso dado de baja.')
    setAEliminar(null)
    setComentario('')
    await recargar()
  }

  const columnas: Columna<Recurso>[] = [
    {
      clave: 'tipo',
      titulo: 'Tipo',
      ordenable: true,
      render: (r) => (
        <Badge fg="#4F46E5" bg="#EEF2FF">
          {r.tipo}
        </Badge>
      ),
    },
    {
      clave: 'descripcion',
      titulo: 'Recurso o insumo',
      ordenable: true,
      render: (r) => (
        <div style={{ minWidth: 260 }}>
          <span className="hg-t-sm">{r.descripcion}</span>
          {r.observaciones && <div className="hg-t-xs hg-t-sec">{r.observaciones}</div>}
        </div>
      ),
    },
    { clave: 'cantidad', titulo: 'Cantidad / detalle', render: (r) => <span className="hg-t-sm">{r.cantidad}</span> },
    {
      clave: 'fases',
      titulo: 'Fases requeridas',
      render: (r) => (
        <div className="hg-fila" style={{ gap: 4 }}>
          {r.fasesIds.length === 0 ? (
            <span className="hg-t-ter">—</span>
          ) : (
            r.fasesIds.map((id) => (
              <Badge key={id} fg="#0E7490" bg="#CFFAFE">
                {proyecto.fases.find((f) => f.id === id)?.nombre ?? id}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      clave: 'disponibilidad',
      titulo: 'Disponibilidad',
      ordenable: true,
      render: (r) => <BadgeEstado familia="recurso" valor={r.disponibilidad} />,
    },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (r) =>
        editable && (
          <div className="hg-fila hg-fila--fin no-print" style={{ flexWrap: 'nowrap' }}>
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label={`Editar ${r.descripcion}`}
              icono={<IconEditar size={15} />}
              onClick={() => {
                setEdicion(structuredClone(r))
                setErrores({})
              }}
            />
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label={`Dar de baja ${r.descripcion}`}
              icono={<IconEliminar size={15} />}
              onClick={() => setAEliminar(r)}
            />
          </div>
        ),
    },
  ]

  const rr = resumen.recursos

  return (
    <div className="hg-pila">
      {rr.noDisponibles > 0 && (
        <Alert
          tipo="error"
          critico
          titulo={`${rr.noDisponibles} recurso(s) marcado(s) como no disponible(s)`}
          mensaje="Requieren una alternativa o un ajuste del alcance antes de la fase en que se necesitan."
        />
      )}

      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Recursos registrados" valor={rr.total} acento="#6366F1" />
        <KPICard
          etiqueta="Por gestionar"
          valor={rr.porGestionar}
          color={rr.porGestionar > 0 ? '#F59E0B' : undefined}
          pie="Declarados como necesarios y aun no asegurados"
          onClick={() => setFiltroDisp('Por gestionar')}
          acento="#CA8A04"
        />
        <KPICard etiqueta="Disponibles o reservados" valor={rr.disponibles + rr.reservados} color="#10B981" acento="#15803D" />
        <KPICard
          etiqueta="No disponibles"
          valor={rr.noDisponibles}
          color={rr.noDisponibles > 0 ? '#EF4444' : undefined}
          onClick={() => setFiltroDisp('No disponible')}
          acento="#EF4444"
        />
      </div>

      <Card titulo="Disponibilidad del conjunto">
        <Figura
          descripcion="Composicion de los recursos por estado de disponibilidad."
          tabla={
            <Table
              columnas={[
                { clave: 'e', titulo: 'Disponibilidad', render: (r: { e: string; n: number }) => r.e },
                { clave: 'n', titulo: 'Recursos', alineacion: 'derecha', render: (r) => r.n },
              ]}
              filas={DISPONIBILIDAD_RECURSO.map((e) => ({
                e,
                n: datos.recursos.filter((r) => r.disponibilidad === e).length,
              }))}
              claveDe={(r) => r.e}
            />
          }
        >
          <BarraApilada
            segmentos={DISPONIBILIDAD_RECURSO.map((e) => ({
              etiqueta: e,
              valor: datos.recursos.filter((r) => r.disponibilidad === e).length,
              color: RELLENO_RECURSO[e],
            }))}
          />
        </Figura>
      </Card>

      <Card
        titulo="Recursos e insumos"
        subtitulo="La disponibilidad se elige de una lista controlada: un valor escrito a mano no puede sacar un recurso de las alertas."
        acciones={
          <>
            <Tabs
              opciones={[
                { valor: 'lista', etiqueta: 'Listado' },
                { valor: 'fase', etiqueta: 'Por fase' },
              ]}
              activa={vista}
              onCambiar={(v) => setVista(v as 'lista' | 'fase')}
              etiquetaAria="Vista de recursos"
            />
            {editable && (
              <Button
                variante="primary"
                tamano="sm"
                icono={<IconMas size={15} />}
                onClick={() => {
                  setEdicion({ ...VACIO })
                  setErrores({})
                }}
              >
                Nuevo recurso
              </Button>
            )}
          </>
        }
      >
        {vista === 'lista' ? (
          <>
            <div className="hg-barra-filtros" style={{ marginBottom: 'var(--sp-md)' }}>
              <Select
                label="Tipo"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                placeholder="Todos"
                opciones={TIPOS_RECURSO}
              />
              <Select
                label="Disponibilidad"
                value={filtroDisp}
                onChange={(e) => setFiltroDisp(e.target.value)}
                placeholder="Todas"
                opciones={DISPONIBILIDAD_RECURSO}
              />
              {(filtroTipo || filtroDisp) && (
                <Button
                  variante="ghost"
                  onClick={() => {
                    setFiltroTipo('')
                    setFiltroDisp('')
                  }}
                >
                  Limpiar
                </Button>
              )}
            </div>

            {recursos.length === 0 ? (
              <Vacio
                titulo="No hay recursos que coincidan"
                texto="Registre los recursos humanos, tecnologicos, de informacion y logisticos que el proyecto necesita, y en que fases."
                icono={<IconRecurso size={24} />}
                accion={
                  editable && (
                    <Button variante="primary" onClick={() => setEdicion({ ...VACIO })}>
                      Nuevo recurso
                    </Button>
                  )
                }
              />
            ) : (
              <Table
                columnas={columnas}
                filas={recursos}
                claveDe={(r) => r.id}
                claseFila={(r) => (r.disponibilidad === 'No disponible' ? 'hg-fila--critica' : '')}
              />
            )}
          </>
        ) : (
          <div className="hg-pila">
            {proyecto.fases
              .filter((f) => f.activa)
              .map((fase) => {
                const propios = datos.recursos.filter((r) => r.fasesIds.includes(fase.id))
                if (propios.length === 0) return null
                const pendientes = propios.filter(
                  (r) => r.disponibilidad === 'Por gestionar' || r.disponibilidad === 'No disponible',
                ).length
                return (
                  <div
                    key={fase.id}
                    style={{ border: '1px solid var(--c-border)', borderRadius: 'var(--r-base)', padding: 'var(--sp-sm)' }}
                  >
                    <div className="hg-fila" style={{ marginBottom: 'var(--sp-xs)' }}>
                      <strong className="hg-t-sm">{fase.nombre}</strong>
                      <span className="hg-t-xs hg-t-sec">{propios.length} recurso(s)</span>
                      {pendientes > 0 && (
                        <Badge fg="#92400E" bg="#FEF3C7">
                          {pendientes} sin asegurar
                        </Badge>
                      )}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 'var(--sp-lg)' }}>
                      {propios.map((r) => (
                        <li key={r.id} className="hg-t-sm" style={{ marginBottom: 3 }}>
                          <span className="hg-t-ter">[{r.tipo}]</span> {r.descripcion} —{' '}
                          <BadgeEstado familia="recurso" valor={r.disponibilidad} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
          </div>
        )}
      </Card>

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.id ? 'Editar recurso' : 'Nuevo recurso'}
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar recurso
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-grid hg-grid--form">
            <Select
              label="Tipo de recurso"
              requerido
              value={edicion.tipo ?? 'Humano'}
              opciones={TIPOS_RECURSO}
              onChange={(e) => setEdicion({ ...edicion, tipo: e.target.value as Recurso['tipo'] })}
            />
            <Select
              label="Disponibilidad"
              requerido
              value={edicion.disponibilidad ?? 'Por gestionar'}
              opciones={DISPONIBILIDAD_RECURSO}
              ayuda="Alimenta la alerta de recursos por gestionar."
              onChange={(e) =>
                setEdicion({ ...edicion, disponibilidad: e.target.value as Recurso['disponibilidad'] })
              }
            />
            <Textarea
              label="Descripcion"
              requerido
              anchoCompleto
              rows={2}
              value={edicion.descripcion ?? ''}
              error={errores.descripcion}
              onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })}
            />
            <Input
              label="Cantidad o detalle"
              requerido
              value={edicion.cantidad ?? ''}
              error={errores.cantidad}
              ayuda="Por ejemplo: 2 licencias, 1 perfil de 40 horas/mes."
              onChange={(e) => setEdicion({ ...edicion, cantidad: e.target.value })}
            />
            <Input
              label="Responsable de gestionarlo"
              value={edicion.responsableNombre ?? ''}
              onChange={(e) => setEdicion({ ...edicion, responsableNombre: e.target.value })}
            />

            <div className="hg-campo hg-col-span">
              <span className="hg-campo__label">
                Fases en que se requiere <span className="hg-campo__req">*</span>
              </span>
              {errores.fasesIds && <span className="hg-campo__error">{errores.fasesIds}</span>}
              <div className="hg-fila" style={{ marginTop: 4 }}>
                {proyecto.fases
                  .filter((f) => f.activa)
                  .map((f) => (
                    <label key={f.id} className="hg-check">
                      <input
                        type="checkbox"
                        checked={(edicion.fasesIds ?? []).includes(f.id)}
                        onChange={(e) => {
                          const s = new Set(edicion.fasesIds ?? [])
                          if (e.target.checked) s.add(f.id)
                          else s.delete(f.id)
                          setEdicion({ ...edicion, fasesIds: [...s] })
                        }}
                      />
                      <span className="hg-t-sm">{f.nombre}</span>
                    </label>
                  ))}
              </div>
            </div>

            <Textarea
              label="Observaciones"
              anchoCompleto
              rows={2}
              value={edicion.observaciones ?? ''}
              onChange={(e) => setEdicion({ ...edicion, observaciones: e.target.value })}
            />
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aEliminar)}
        titulo="Dar de baja el recurso"
        mensaje={`El recurso "${aEliminar?.descripcion ?? ''}" saldra de las alertas y del conteo de disponibilidad.`}
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
