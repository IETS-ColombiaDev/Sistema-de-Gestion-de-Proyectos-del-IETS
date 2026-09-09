/**
 * Registro de productos — EP-15.
 * "Evaluado" y "Conforme" son booleanos, no texto libre: la conformidad ya no
 * depende de escribir "Si" con tilde (corrige D-15). Un producto no puede
 * declararse conforme sin evaluacion registrada (HG-097).
 */

import { useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { IconCheck, IconEditar, IconEliminar, IconMas, IconProducto } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { esProductoConforme } from '@/domain/reglas'
import { formatearFecha } from '@/domain/fechas'
import { eliminarEntidad, guardarEntidad } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { porcentaje } from '@/lib/formato'
import type { Producto } from '@/domain/types'

const VACIO: Partial<Producto> = {
  entregable: '',
  productoComprometidoId: null,
  hitoId: null,
  actividadesIds: [],
  fechaEntrega: null,
  fechaEvaluacion: null,
  evaluado: false,
  conforme: false,
  responsableNombre: '',
  evidencias: [],
}

export default function Productos() {
  const { datos, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'productos.editar')

  const [edicion, setEdicion] = useState<Partial<Producto> | null>(null)
  const [aEliminar, setAEliminar] = useState<Producto | null>(null)
  const [comentario, setComentario] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const productos = datos?.productos ?? []

  const indice = useMemo(() => {
    const evaluados = productos.filter((p) => p.evaluado)
    if (evaluados.length === 0) return null
    return (evaluados.filter(esProductoConforme).length / evaluados.length) * 100
  }, [productos])

  if (cargando || !datos || !proyecto) return <Cargando />

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.entregable?.trim()) e.entregable = 'Indique el entregable.'
    if (edicion.conforme && !edicion.evaluado) {
      e.conforme = 'No se puede declarar conforme un producto sin evaluacion registrada.'
    }
    if (edicion.evaluado && !edicion.fechaEvaluacion) {
      e.fechaEvaluacion = 'Un producto evaluado requiere fecha de evaluacion.'
    }
    if (
      edicion.fechaEntrega &&
      edicion.fechaEvaluacion &&
      edicion.fechaEvaluacion < edicion.fechaEntrega
    ) {
      e.fechaEvaluacion = 'La evaluacion no puede ser anterior a la entrega.'
    }
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      await guardarEntidad<Producto>(
        rutas.productos(proyecto.id),
        { ...edicion, proyectoId: proyecto.id },
        {
          proyectoId: proyecto.id,
          entidad: 'producto',
          etiqueta: edicion.entregable ?? '',
          tipoCambio: 'Otro',
          comentario: comentario || undefined,
        },
      )
      toast.exito('Producto guardado.')
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
    await eliminarEntidad<Producto>(rutas.productos(proyecto.id), aEliminar.id, {
      proyectoId: proyecto.id,
      entidad: 'producto',
      etiqueta: aEliminar.entregable,
      tipoCambio: 'Otro',
      comentario,
    })
    toast.exito('Producto dado de baja.')
    setAEliminar(null)
    setComentario('')
    await recargar()
  }

  const columnas: Columna<Producto>[] = [
    {
      clave: 'entregable',
      titulo: 'Entregable',
      ordenable: true,
      render: (p) => (
        <div style={{ minWidth: 240 }}>
          <span className="hg-t-sm hg-t-bold">{p.entregable}</span>
          {p.hitoId && (
            <div className="hg-t-xs hg-t-sec">
              Hito: {datos.hitos.find((h) => h.id === p.hitoId)?.descripcion ?? '—'}
            </div>
          )}
          {p.observaciones && <div className="hg-t-xs hg-t-ter">{p.observaciones}</div>}
        </div>
      ),
    },
    {
      clave: 'fechaEntrega',
      titulo: 'Entrega',
      ordenable: true,
      render: (p) => <span className="hg-t-sm">{formatearFecha(p.fechaEntrega)}</span>,
    },
    {
      clave: 'fechaEvaluacion',
      titulo: 'Evaluacion',
      ordenable: true,
      render: (p) => <span className="hg-t-sm">{formatearFecha(p.fechaEvaluacion)}</span>,
    },
    {
      clave: 'evaluado',
      titulo: 'Evaluado',
      alineacion: 'centro',
      ordenable: true,
      valorOrden: (p) => (p.evaluado ? 1 : 0),
      render: (p) =>
        p.evaluado ? (
          <Badge fg="#047857" bg="#D1FAE5" punto>
            Si
          </Badge>
        ) : (
          <Badge fg="#64748B" bg="#F1F5F9">
            No
          </Badge>
        ),
    },
    {
      clave: 'conforme',
      titulo: 'Conforme',
      alineacion: 'centro',
      ordenable: true,
      valorOrden: (p) => (p.conforme ? 1 : 0),
      render: (p) =>
        !p.evaluado ? (
          <span className="hg-t-ter" title="Aun no evaluado">
            —
          </span>
        ) : p.conforme ? (
          <Badge fg="#047857" bg="#D1FAE5" punto>
            Conforme
          </Badge>
        ) : (
          <Badge fg="#B91C1C" bg="#FEE2E2" punto>
            No conforme
          </Badge>
        ),
    },
    { clave: 'responsableNombre', titulo: 'Responsable', ordenable: true, render: (p) => p.responsableNombre || '—' },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (p) =>
        editable && (
          <div className="hg-fila hg-fila--fin no-print" style={{ flexWrap: 'nowrap' }}>
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label={`Editar ${p.entregable}`}
              icono={<IconEditar size={15} />}
              onClick={() => {
                setEdicion(structuredClone(p))
                setErrores({})
              }}
            />
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label={`Dar de baja ${p.entregable}`}
              icono={<IconEliminar size={15} />}
              onClick={() => setAEliminar(p)}
            />
          </div>
        ),
    },
  ]

  const evaluados = productos.filter((p) => p.evaluado)
  const conformes = evaluados.filter(esProductoConforme)

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Productos registrados" valor={productos.length} acento="#6366F1" />
        <KPICard
          etiqueta="Evaluados"
          valor={evaluados.length}
          pie={`${productos.length - evaluados.length} sin evaluar`}
          acento="#0891B2"
        />
        <KPICard etiqueta="Conformes" valor={conformes.length} color="#10B981" acento="#15803D" />
        <KPICard
          etiqueta="Indice de productos conformes"
          valor={indice == null ? 'Sin datos' : porcentaje(indice)}
          color={indice == null ? '#64748B' : indice >= 90 ? '#10B981' : indice >= 81 ? '#F59E0B' : '#EF4444'}
          pie="Indicador PRY-O003 · meta 90 %"
          acento="#CA8A04"
        />
      </div>

      <Card
        titulo="Registro de productos"
        subtitulo="Un producto solo puede declararse conforme si tiene evaluacion registrada."
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
              Nuevo producto
            </Button>
          )
        }
      >
        {productos.length === 0 ? (
          <Vacio
            titulo="Aun no hay productos registrados"
            texto="Registre aqui los entregables efectivamente producidos, su evaluacion y su conformidad. Los productos comprometidos se definen en la ficha del proyecto."
            icono={<IconProducto size={24} />}
            accion={
              editable && (
                <Button variante="primary" onClick={() => setEdicion({ ...VACIO })}>
                  Nuevo producto
                </Button>
              )
            }
          />
        ) : (
          <Table
            columnas={columnas}
            filas={productos}
            claveDe={(p) => p.id}
            claseFila={(p) => (p.evaluado && !p.conforme ? 'hg-fila--critica' : '')}
          />
        )}
      </Card>

      <Modal
        abierto={edicion !== null}
        tamano="lg"
        titulo={edicion?.id ? 'Editar producto' : 'Nuevo producto'}
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar producto
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-grid hg-grid--form">
            <Input
              label="Entregable"
              requerido
              anchoCompleto
              value={edicion.entregable ?? ''}
              error={errores.entregable}
              onChange={(e) => setEdicion({ ...edicion, entregable: e.target.value })}
            />
            <Select
              label="Producto comprometido"
              value={edicion.productoComprometidoId ?? ''}
              placeholder="Sin vincular"
              ayuda="Definido en la ficha del proyecto."
              opciones={proyecto.productosComprometidos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
              onChange={(e) => setEdicion({ ...edicion, productoComprometidoId: e.target.value || null })}
            />
            <Select
              label="Hito asociado"
              value={edicion.hitoId ?? ''}
              placeholder="Sin vincular"
              opciones={datos.hitos.map((h) => ({ valor: h.id, etiqueta: h.descripcion }))}
              onChange={(e) => setEdicion({ ...edicion, hitoId: e.target.value || null })}
            />
            <Input
              label="Fecha de entrega"
              type="date"
              value={edicion.fechaEntrega ?? ''}
              onChange={(e) => setEdicion({ ...edicion, fechaEntrega: e.target.value || null })}
            />
            <Input
              label="Fecha de evaluacion"
              type="date"
              value={edicion.fechaEvaluacion ?? ''}
              error={errores.fechaEvaluacion}
              onChange={(e) => setEdicion({ ...edicion, fechaEvaluacion: e.target.value || null })}
            />
            <Input
              label="Responsable"
              value={edicion.responsableNombre ?? ''}
              onChange={(e) => setEdicion({ ...edicion, responsableNombre: e.target.value })}
            />

            <div className="hg-col-span hg-fila" style={{ gap: 'var(--sp-lg)' }}>
              <Checkbox
                label="Producto evaluado"
                checked={edicion.evaluado ?? false}
                onChange={(e) =>
                  setEdicion({
                    ...edicion,
                    evaluado: e.target.checked,
                    conforme: e.target.checked ? edicion.conforme : false,
                  })
                }
              />
              <Checkbox
                label="Producto conforme"
                disabled={!edicion.evaluado}
                checked={edicion.conforme ?? false}
                onChange={(e) => setEdicion({ ...edicion, conforme: e.target.checked })}
              />
              {edicion.evaluado && edicion.conforme && (
                <span className="hg-fila hg-t-xs" style={{ color: '#047857', gap: 4 }}>
                  <IconCheck size={14} /> Cuenta en el indice de productos conformes
                </span>
              )}
            </div>
            {errores.conforme && (
              <span className="hg-campo__error hg-col-span" role="alert">
                {errores.conforme}
              </span>
            )}

            <Textarea
              label="Observaciones de la evaluacion"
              anchoCompleto
              rows={3}
              value={edicion.observaciones ?? ''}
              ayuda="Si el producto no es conforme, deje constancia de lo que debe corregirse."
              onChange={(e) => setEdicion({ ...edicion, observaciones: e.target.value })}
            />

            {edicion.id && (
              <Textarea
                label="Justificacion del cambio"
                anchoCompleto
                rows={2}
                value={comentario}
                ayuda="Los cambios de conformidad son sensibles y quedan trazados."
                onChange={(e) => setComentario(e.target.value)}
              />
            )}
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aEliminar)}
        titulo="Dar de baja el producto"
        mensaje={`El producto "${aEliminar?.entregable ?? ''}" dejara de contar en el indice de productos conformes.`}
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
