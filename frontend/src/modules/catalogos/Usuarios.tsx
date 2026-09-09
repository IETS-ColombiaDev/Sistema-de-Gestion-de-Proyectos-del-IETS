/**
 * Administracion de usuarios y roles — Seccion 6 del backlog (HG-051 / EP-06).
 * Permite al administrador del sistema gestionar las cuentas de usuario,
 * asignar roles globales y controlar el acceso a la plataforma HIGEP Web.
 */

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Table, { type Columna } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Field'
import { Cargando, ErrorVista } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import {
  IconEditar,
  IconMas,
} from '@/components/icons'
import { useAuth } from '@/auth/AuthContext'
import { DESCRIPCION_ROL, ETIQUETAS_ROL, puede } from '@/auth/permisos'
import { guardarUsuario, listarUsuarios } from '@/data/repo'
import { ROLES, type Rol, type Usuario } from '@/domain/types'

const VACIO: Omit<Usuario, 'uid' | 'creadoEn'> = {
  correo: '',
  nombre: '',
  rolGlobal: 'miembro',
  activo: true,
}

export default function Usuarios() {
  const { usuario: usuarioActual } = useAuth()
  const toast = useToast()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [filtroRol, setFiltroRol] = useState<string>('')
  const [soloActivos, setSoloActivos] = useState(false)

  const [edicion, setEdicion] = useState<(Partial<Usuario> & { uid?: string }) | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)

  const editable = puede(usuarioActual?.rolGlobal ?? null, 'usuarios.administrar')

  const cargar = async () => {
    setCargando(true)
    try {
      const data = await listarUsuarios()
      setUsuarios(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  const filtrados = useMemo(() => {
    const t = texto.toLowerCase().trim()
    return usuarios.filter((u) => {
      if (filtroRol && u.rolGlobal !== filtroRol) return false
      if (soloActivos && !u.activo) return false
      if (t) {
        const heno = `${u.nombre} ${u.correo} ${u.rolGlobal}`.toLowerCase()
        if (!heno.includes(t)) return false
      }
      return true
    })
  }, [usuarios, texto, filtroRol, soloActivos])

  const guardar = async () => {
    if (!edicion) return
    if (!edicion.nombre?.trim() || !edicion.correo?.trim()) {
      toast.aviso('El nombre y el correo institucional son requeridos.')
      return
    }

    if (!edicion.correo.includes('@')) {
      toast.aviso('Ingrese una direccion de correo electronico valida.')
      return
    }

    setGuardando(true)
    try {
      const ahora = new Date().toISOString()
      const u: Usuario = {
        uid: edicion.uid ?? `u-${Date.now().toString(36)}`,
        nombre: edicion.nombre.trim(),
        correo: edicion.correo.trim().toLowerCase(),
        rolGlobal: (edicion.rolGlobal as Rol) ?? 'miembro',
        activo: edicion.activo ?? true,
        creadoEn: edicion.creadoEn ?? ahora,
        ultimoAcceso: edicion.ultimoAcceso,
        rolesPorProyecto: edicion.rolesPorProyecto,
      }

      await guardarUsuario(
        u,
        comentario.trim() || `${esNuevo ? 'Creo' : 'Actualizo'} al usuario ${u.nombre} (${u.rolGlobal})`,
      )
      toast.exito(`Se guardo exitosamente la cuenta de ${u.nombre}.`)
      setEdicion(null)
      setComentario('')
      await cargar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  const alternarActivo = async (u: Usuario) => {
    if (u.uid === usuarioActual?.uid) {
      toast.aviso('No puede desactivar su propia cuenta de usuario.')
      return
    }
    const actualizado: Usuario = { ...u, activo: !u.activo }
    try {
      await guardarUsuario(
        actualizado,
        `${u.activo ? 'Desactivo' : 'Activo'} la cuenta de ${u.nombre}`,
      )
      setUsuarios((prev) => prev.map((item) => (item.uid === u.uid ? actualizado : item)))
      toast.exito(`La cuenta de ${u.nombre} fue actualizada.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  if (!editable) {
    return (
      <ErrorVista
        titulo="Acceso restringido"
        detalle="Solo los administradores del sistema tienen facultades para gestionar usuarios y roles institucionales."
      />
    )
  }

  if (cargando) return <Cargando />

  const columnas: Columna<Usuario>[] = [
    {
      clave: 'nombre',
      titulo: 'Usuario',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            {u.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="hg-t-negrita">{u.nombre}</div>
            <div className="hg-t-xs hg-t-muted">{u.correo}</div>
          </div>
        </div>
      ),
    },
    {
      clave: 'rolGlobal',
      titulo: 'Rol institucional',
      ancho: '220px',
      render: (u) => (
        <div>
          <Badge
            fg={
              u.rolGlobal === 'administrador'
                ? '#B45309'
                : u.rolGlobal === 'lider'
                  ? '#4338CA'
                  : '#475569'
            }
            bg={
              u.rolGlobal === 'administrador'
                ? '#FEF3C7'
                : u.rolGlobal === 'lider'
                  ? '#EEF2FF'
                  : '#F1F5F9'
            }
          >
            {ETIQUETAS_ROL[u.rolGlobal] ?? u.rolGlobal}
          </Badge>
          <div className="hg-t-xs hg-t-muted" style={{ marginTop: '2px' }}>
            {DESCRIPCION_ROL[u.rolGlobal]}
          </div>
        </div>
      ),
    },
    {
      clave: 'activo',
      titulo: 'Estado',
      ancho: '120px',
      render: (u) => (
        <Badge
          fg={u.activo ? '#15803D' : '#64748B'}
          bg={u.activo ? '#DCFCE7' : '#F1F5F9'}
        >
          {u.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      clave: 'creadoEn',
      titulo: 'Alta',
      ancho: '130px',
      render: (u) => (
        <span className="hg-t-xs hg-t-muted">
          {u.creadoEn ? new Date(u.creadoEn).toLocaleDateString('es-CO') : '—'}
        </span>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: '160px',
      render: (u) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            tamano="sm"
            variante="ghost"
            onClick={() => {
              setEdicion({ ...u })
              setEsNuevo(false)
            }}
          >
            <IconEditar size={14} />
          </Button>
          <Button
            tamano="sm"
            variante={u.activo ? 'ghost' : 'secondary'}
            onClick={() => void alternarActivo(u)}
            disabled={u.uid === usuarioActual?.uid}
          >
            {u.activo ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Usuarios totales"
          valor={usuarios.length}
          pie={`${usuarios.filter((u) => u.activo).length} cuentas activas`}
          acento="#6366F1"
        />
        <KPICard
          etiqueta="Lideres de proyecto"
          valor={usuarios.filter((u) => u.rolGlobal === 'lider').length}
          pie="Responsables de evaluacion"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Administradores"
          valor={usuarios.filter((u) => u.rolGlobal === 'administrador').length}
          pie="Control total del sistema"
          acento="#CA8A04"
        />
        <KPICard
          etiqueta="Equipo y analistas"
          valor={usuarios.filter((u) => u.rolGlobal === 'miembro' || u.rolGlobal === 'gestor').length}
          pie="Ejecucion operativa y seguimiento"
          acento="#15803D"
        />
      </div>

      <Card
        titulo="Directorio de usuarios y perfiles"
        subtitulo="Administracion de cuentas autorizadas para interactuar con la plataforma y sus niveles de acceso."
        acciones={
          <Button
            variante="primary"
            onClick={() => {
              setEdicion({ ...VACIO })
              setEsNuevo(true)
            }}
          >
            <IconMas /> Registrar usuario
          </Button>
        }
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: '1', minWidth: '240px' }}>
            <Input
              placeholder="Buscar por nombre, correo o rol..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>

          <Select
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ETIQUETAS_ROL[r]}
              </option>
            ))}
          </Select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="hg-t-sm">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
            />
            Solo activos
          </label>
        </div>

        <Table<Usuario>
          columnas={columnas}
          filas={filtrados}
          claveDe={(u) => u.uid}
          vacio="No se encontraron usuarios que coincidan con la busqueda."
        />
      </Card>

      {/* Modal de Alta / Edicion */}
      {edicion && (
        <Modal
          titulo={esNuevo ? 'Registrar nuevo usuario' : `Editar cuenta de ${edicion.nombre}`}
          abierto={true}
          onCerrar={() => setEdicion(null)}
          pie={
            <>
              <Button variante="ghost" onClick={() => setEdicion(null)}>
                Cancelar
              </Button>
              <Button
                variante="primary"
                onClick={() => void guardar()}
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Guardar y auditar'}
              </Button>
            </>
          }
        >
          <div className="hg-pila" style={{ gap: '14px' }}>
            <Input
              label="Nombre completo"
              placeholder="Nombre y apellidos"
              value={edicion.nombre ?? ''}
              onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
            />

            <Input
              label="Correo electronico institucional"
              type="email"
              placeholder="usuario@iets.org.co"
              value={edicion.correo ?? ''}
              onChange={(e) => setEdicion({ ...edicion, correo: e.target.value })}
              ayuda="Debe coincidir con la cuenta institucional utilizada para iniciar sesion."
            />

            <Select
              label="Rol institucional (global)"
              value={edicion.rolGlobal ?? 'miembro'}
              onChange={(e) => setEdicion({ ...edicion, rolGlobal: e.target.value as Rol })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ETIQUETAS_ROL[r]}
                </option>
              ))}
            </Select>

            {edicion.rolGlobal && (
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  padding: '10px 14px',
                  borderRadius: '6px',
                }}
              >
                <span className="hg-t-xs hg-t-negrita" style={{ color: '#4F46E5' }}>
                  Alcance del rol:
                </span>
                <p className="hg-t-sm" style={{ margin: '4px 0 0 0' }}>
                  {DESCRIPCION_ROL[edicion.rolGlobal as Rol]}
                </p>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="hg-t-sm">
              <input
                type="checkbox"
                checked={edicion.activo ?? true}
                onChange={(e) => setEdicion({ ...edicion, activo: e.target.checked })}
              />
              Cuenta de usuario activa (habilita inicio de sesion)
            </label>

            <Input
              label="Justificacion de auditoria"
              placeholder="Motivo del alta o cambio de rol..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
