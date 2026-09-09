/**
 * Grupo desarrollador — EP-08.
 * La dedicacion se registra en horas/mes: unidad unica decidida en Fase 0
 * para cerrar la ambiguedad D-10 entre el libro (porcentaje) y el instructivo.
 * Los datos personales se limitan al minimo necesario (HG-009).
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
import { IconEditar, IconEliminar, IconEquipo, IconMas } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { eliminarEntidad, guardarEntidad, listarUsuarios } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { numero } from '@/lib/formato'
import { ESTADOS_VINCULACION, type MiembroEquipo, type Usuario } from '@/domain/types'

const VACIO: Partial<MiembroEquipo> = {
  perfil: '',
  nombre: '',
  porDesignar: false,
  usuarioUid: null,
  dedicacionHorasMes: 0,
  mesesVinculacion: 0,
  estadoVinculacion: 'Por definir',
}

const COLOR_VINCULACION: Record<string, { fg: string; bg: string }> = {
  'Por definir': { fg: '#92400E', bg: '#FEF3C7' },
  Contactado: { fg: '#1D4ED8', bg: '#DBEAFE' },
  Confirmado: { fg: '#0E7490', bg: '#CFFAFE' },
  Contratado: { fg: '#047857', bg: '#D1FAE5' },
  'No disponible': { fg: '#B91C1C', bg: '#FEE2E2' },
}

export default function Equipo() {
  const { datos, resumen, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'equipo.editar')

  const [edicion, setEdicion] = useState<Partial<MiembroEquipo> | null>(null)
  const [aEliminar, setAEliminar] = useState<MiembroEquipo | null>(null)
  const [comentario, setComentario] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])

  useMemo(() => {
    void listarUsuarios().then(setUsuarios)
  }, [])

  if (cargando || !datos || !resumen || !proyecto) return <Cargando />

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.perfil?.trim()) e.perfil = 'El perfil o rol es obligatorio.'
    if (!edicion.porDesignar && !edicion.nombre?.trim()) {
      e.nombre = 'Indique el nombre o marque el perfil como "por designar".'
    }
    if ((edicion.dedicacionHorasMes ?? 0) < 0) e.dedicacionHorasMes = 'No puede ser negativa.'
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      const u = usuarios.find((x) => x.uid === edicion.usuarioUid)
      await guardarEntidad<MiembroEquipo>(
        rutas.equipo(proyecto.id),
        {
          ...edicion,
          proyectoId: proyecto.id,
          nombre: edicion.porDesignar ? '' : (edicion.nombre ?? ''),
          correo: u?.correo,
          dedicacionHorasMes: Number(edicion.dedicacionHorasMes) || 0,
          mesesVinculacion: Number(edicion.mesesVinculacion) || 0,
        },
        {
          proyectoId: proyecto.id,
          entidad: 'miembro',
          etiqueta: `${edicion.perfil} · ${edicion.nombre || 'por designar'}`,
          tipoCambio: 'Otro',
          comentario: comentario || undefined,
        },
      )
      toast.exito('Miembro del equipo guardado.')
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
    await eliminarEntidad<MiembroEquipo>(rutas.equipo(proyecto.id), aEliminar.id, {
      proyectoId: proyecto.id,
      entidad: 'miembro',
      etiqueta: `${aEliminar.perfil} · ${aEliminar.nombre}`,
      tipoCambio: 'Otro',
      comentario,
    })
    toast.exito('Miembro dado de baja del equipo.')
    setAEliminar(null)
    setComentario('')
    await recargar()
  }

  const columnas: Columna<MiembroEquipo>[] = [
    {
      clave: 'perfil',
      titulo: 'Perfil / rol',
      ordenable: true,
      render: (m) => (
        <div>
          <span className="hg-t-bold hg-t-sm">{m.perfil}</span>
          {m.porDesignar && (
            <Badge fg="#92400E" bg="#FEF3C7" titulo="Perfil definido sin persona asignada">
              por designar
            </Badge>
          )}
        </div>
      ),
    },
    {
      clave: 'nombre',
      titulo: 'Persona',
      ordenable: true,
      render: (m) =>
        m.porDesignar ? (
          <span className="hg-t-ter">Sin designar</span>
        ) : (
          <div>
            <span className="hg-t-sm">{m.nombre}</span>
            {m.usuarioUid ? (
              <div className="hg-t-xs hg-t-sec">{m.correo}</div>
            ) : (
              <div className="hg-t-xs hg-t-ter">Sin cuenta institucional vinculada</div>
            )}
          </div>
        ),
    },
    {
      clave: 'dedicacionHorasMes',
      titulo: 'Dedicacion',
      alineacion: 'derecha',
      ordenable: true,
      render: (m) => <span className="hg-t-num">{numero(m.dedicacionHorasMes)} h/mes</span>,
    },
    {
      clave: 'mesesVinculacion',
      titulo: 'Meses',
      alineacion: 'derecha',
      ordenable: true,
      render: (m) => <span className="hg-t-num">{m.mesesVinculacion}</span>,
    },
    {
      clave: 'total',
      titulo: 'Horas totales',
      alineacion: 'derecha',
      ordenable: true,
      valorOrden: (m) => m.dedicacionHorasMes * m.mesesVinculacion,
      render: (m) => (
        <span className="hg-t-num hg-t-sec">{numero(m.dedicacionHorasMes * m.mesesVinculacion)}</span>
      ),
    },
    {
      clave: 'estadoVinculacion',
      titulo: 'Vinculacion',
      ordenable: true,
      render: (m) => {
        const c = COLOR_VINCULACION[m.estadoVinculacion] ?? { fg: '#64748B', bg: '#F1F5F9' }
        return (
          <Badge fg={c.fg} bg={c.bg} punto>
            {m.estadoVinculacion}
          </Badge>
        )
      },
    },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (m) =>
        editable && (
          <div className="hg-fila hg-fila--fin no-print" style={{ flexWrap: 'nowrap' }}>
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label={`Editar ${m.perfil}`}
              icono={<IconEditar size={15} />}
              onClick={() => {
                setEdicion(structuredClone(m))
                setErrores({})
              }}
            />
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label={`Dar de baja ${m.perfil}`}
              icono={<IconEliminar size={15} />}
              onClick={() => setAEliminar(m)}
            />
          </div>
        ),
    },
  ]

  const horasTotales = datos.equipo.reduce(
    (s, m) => s + m.dedicacionHorasMes * m.mesesVinculacion,
    0,
  )

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Integrantes" valor={resumen.equipo.total} acento="#6366F1" />
        <KPICard
          etiqueta="Perfiles por definir"
          valor={resumen.equipo.porDefinir}
          color={resumen.equipo.porDefinir > 0 ? '#F59E0B' : undefined}
          pie="Registrados sin persona designada"
          acento="#CA8A04"
        />
        <KPICard
          etiqueta="Dedicacion mensual"
          valor={`${numero(resumen.equipo.dedicacionTotalHorasMes)} h`}
          pie="Suma de horas/mes del equipo"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Horas totales comprometidas"
          valor={numero(horasTotales)}
          pie="Horas/mes x meses de vinculacion"
          acento="#15803D"
        />
      </div>

      <Card
        titulo="Grupo desarrollador"
        subtitulo="Los responsables del cronograma y los actores de la matriz RACI se toman de esta lista."
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
              Agregar integrante
            </Button>
          )
        }
      >
        {datos.equipo.length === 0 ? (
          <Vacio
            titulo="El equipo aun no tiene integrantes"
            texto="Registre los perfiles necesarios. Puede hacerlo antes de conocer los nombres, marcandolos como 'por designar'."
            icono={<IconEquipo size={24} />}
            accion={
              editable && (
                <Button variante="primary" onClick={() => setEdicion({ ...VACIO })}>
                  Agregar integrante
                </Button>
              )
            }
          />
        ) : (
          <Table columnas={columnas} filas={datos.equipo} claveDe={(m) => m.id} />
        )}
      </Card>

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.id ? 'Editar integrante' : 'Agregar integrante'}
        subtitulo="Se registran solo los datos necesarios para la gestion del proyecto."
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-grid hg-grid--form">
            <Input
              label="Perfil o rol"
              requerido
              anchoCompleto
              value={edicion.perfil ?? ''}
              error={errores.perfil}
              ayuda="Por ejemplo: metodologo, economista de la salud, especialista en informacion."
              onChange={(e) => setEdicion({ ...edicion, perfil: e.target.value })}
            />

            <div className="hg-col-span">
              <Checkbox
                label="Perfil aun por designar (sin persona asignada)"
                checked={edicion.porDesignar ?? false}
                onChange={(e) =>
                  setEdicion({
                    ...edicion,
                    porDesignar: e.target.checked,
                    nombre: e.target.checked ? '' : edicion.nombre,
                    usuarioUid: e.target.checked ? null : edicion.usuarioUid,
                    estadoVinculacion: e.target.checked ? 'Por definir' : edicion.estadoVinculacion,
                  })
                }
              />
            </div>

            {!edicion.porDesignar && (
              <>
                <Input
                  label="Nombre"
                  requerido
                  value={edicion.nombre ?? ''}
                  error={errores.nombre}
                  onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
                />
                <Select
                  label="Cuenta institucional"
                  value={edicion.usuarioUid ?? ''}
                  placeholder="Sin vincular"
                  ayuda="La vinculacion se hace por seleccion de un usuario existente, no por texto libre."
                  opciones={usuarios.map((u) => ({ valor: u.uid, etiqueta: `${u.nombre} · ${u.correo}` }))}
                  onChange={(e) => {
                    const u = usuarios.find((x) => x.uid === e.target.value)
                    setEdicion({
                      ...edicion,
                      usuarioUid: e.target.value || null,
                      nombre: u?.nombre ?? edicion.nombre,
                    })
                  }}
                />
              </>
            )}

            <Input
              label="Dedicacion (horas/mes)"
              type="number"
              min={0}
              max={240}
              value={edicion.dedicacionHorasMes ?? 0}
              error={errores.dedicacionHorasMes}
              ayuda="Unidad unica del sistema: horas al mes."
              onChange={(e) => setEdicion({ ...edicion, dedicacionHorasMes: Number(e.target.value) })}
            />
            <Input
              label="Meses de vinculacion"
              type="number"
              min={0}
              max={120}
              value={edicion.mesesVinculacion ?? 0}
              onChange={(e) => setEdicion({ ...edicion, mesesVinculacion: Number(e.target.value) })}
            />
            <Select
              label="Estado de vinculacion"
              value={edicion.estadoVinculacion ?? 'Por definir'}
              opciones={ESTADOS_VINCULACION}
              ayuda="Cada cambio de estado queda auditado con fecha."
              onChange={(e) =>
                setEdicion({ ...edicion, estadoVinculacion: e.target.value as MiembroEquipo['estadoVinculacion'] })
              }
            />
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
        titulo="Dar de baja al integrante"
        mensaje={
          <>
            <strong>{aEliminar?.perfil}</strong> saldra del equipo activo. Las actividades y asignaciones RACI
            existentes conservan la referencia historica.
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
