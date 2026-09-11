/**
 * Usuarios y roles — HG-007 / HG-033.
 *
 * En produccion la identidad la provee el directorio institucional por Google
 * (ADR-04) y el rol viaja como custom claim (ADR-05); esta pantalla administra
 * el espejo en base de datos, que es lo que consultan las reglas de seguridad y
 * la interfaz. Tambien concede acceso por proyecto.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Cargando, ErrorVista, Vacio } from '@/components/EstadoVista'
import { Nota, Pista } from '@/components/Ayuda'
import { useToast } from '@/components/Toast'
import { IconEditar, IconExportar, IconMas, IconUsuario } from '@/components/icons'
import { useAuth, DOMINIO_INSTITUCIONAL, correoInstitucional } from '@/auth/AuthContext'
import {
  DESCRIPCION_ROL,
  ETIQUETAS_ROL,
  MATRIZ_PERMISOS,
  ACCIONES,
  puede,
  type Accion,
} from '@/auth/permisos'
import { guardarEntidad, guardarUsuario, listarProyectos, listarUsuarios } from '@/data/repo'
import { rutas, nuevoId } from '@/data/adapter'
import { exportarExcel } from '@/lib/exportar'
import { fechaHora, iniciales } from '@/lib/formato'
import { ROLES, type Proyecto, type Rol, type Usuario } from '@/domain/types'

const COLOR_ROL: Record<Rol, { fg: string; bg: string }> = {
  administrador: { fg: '#4F46E5', bg: '#EEF2FF' },
  lider: { fg: '#0E7490', bg: '#CFFAFE' },
  gestor: { fg: '#047857', bg: '#D1FAE5' },
  miembro: { fg: '#64748B', bg: '#F1F5F9' },
  directivo: { fg: '#B45309', bg: '#FEF3C7' },
  auditor: { fg: '#BE185D', bg: '#FCE7F3' },
}

export default function Usuarios() {
  const { usuario, refrescarUsuarios } = useAuth()
  const toast = useToast()
  const editable = puede(usuario?.rolGlobal ?? null, 'usuarios.administrar')

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [filtroRol, setFiltroRol] = useState('')

  const [edicion, setEdicion] = useState<Partial<Usuario> | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [accesos, setAccesos] = useState<Usuario | null>(null)
  const [aDesactivar, setADesactivar] = useState<Usuario | null>(null)
  const [verMatriz, setVerMatriz] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [u, p] = await Promise.all([listarUsuarios(), listarProyectos()])
      setUsuarios(u.sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setProyectos(p)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(
    () =>
      usuarios.filter((u) => {
        if (filtroRol && u.rolGlobal !== filtroRol) return false
        if (texto && !`${u.nombre} ${u.correo}`.toLowerCase().includes(texto.toLowerCase())) return false
        return true
      }),
    [usuarios, filtroRol, texto],
  )

  if (!editable) {
    return (
      <ErrorVista
        titulo="Sin permiso para administrar usuarios"
        detalle="La administracion de usuarios y roles esta reservada al administrador del sistema."
      />
    )
  }

  if (cargando) return <Cargando />
  if (error) return <ErrorVista titulo="No fue posible cargar los usuarios" detalle={error} />

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.nombre?.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!edicion.correo?.trim()) e.correo = 'El correo institucional es obligatorio.'
    else if (!correoInstitucional(edicion.correo.trim())) {
      e.correo = `El correo debe pertenecer al dominio @${DOMINIO_INSTITUCIONAL}.`
    } else if (
      esNuevo &&
      usuarios.some((u) => u.correo.toLowerCase() === edicion.correo!.trim().toLowerCase())
    ) {
      e.correo = 'Ya existe un usuario con ese correo.'
    }
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      const registro: Usuario = {
        uid: edicion.uid ?? nuevoId('u'),
        correo: edicion.correo!.trim().toLowerCase(),
        nombre: edicion.nombre!.trim(),
        rolGlobal: (edicion.rolGlobal ?? 'miembro') as Rol,
        rolesPorProyecto: edicion.rolesPorProyecto ?? {},
        activo: edicion.activo ?? true,
        creadoEn: edicion.creadoEn ?? new Date().toISOString(),
        ultimoAcceso: edicion.ultimoAcceso,
      }
      await guardarUsuario(registro, esNuevo ? 'Alta de usuario' : 'Edicion de usuario')
      toast.exito(esNuevo ? 'Usuario creado.' : 'Usuario actualizado.')
      setEdicion(null)
      await cargar()
      await refrescarUsuarios()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstado = async () => {
    if (!aDesactivar) return
    setGuardando(true)
    try {
      await guardarUsuario(
        { ...aDesactivar, activo: !aDesactivar.activo },
        aDesactivar.activo ? 'Desactivacion de cuenta' : 'Reactivacion de cuenta',
      )
      toast.exito(aDesactivar.activo ? 'Cuenta desactivada.' : 'Cuenta reactivada.')
      setADesactivar(null)
      await cargar()
      await refrescarUsuarios()
    } finally {
      setGuardando(false)
    }
  }

  /** Concede o revoca acceso de un usuario a un proyecto, con su rol. */
  const cambiarAcceso = async (proyecto: Proyecto, uid: string, rol: Rol | '') => {
    setGuardando(true)
    try {
      const nuevos = { ...(proyecto.accesos ?? {}) }
      if (rol) nuevos[uid] = rol
      else delete nuevos[uid]
      await guardarEntidad<Proyecto>(
        rutas.proyectos(),
        { id: proyecto.id, accesos: nuevos },
        {
          proyectoId: proyecto.id,
          entidad: 'proyecto',
          etiqueta: `${proyecto.codigo} · accesos`,
          tipoCambio: 'Decision',
          comentario: rol
            ? `Acceso concedido a ${uid} con rol ${rol}`
            : `Acceso revocado a ${uid}`,
          invalidaCalculo: false,
        },
      )
      const refrescados = await listarProyectos()
      setProyectos(refrescados)
      toast.exito(rol ? 'Acceso concedido.' : 'Acceso revocado.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const columnas: Columna<Usuario>[] = [
    {
      clave: 'nombre',
      titulo: 'Usuario',
      ordenable: true,
      render: (u) => (
        <div className="hg-fila" style={{ flexWrap: 'nowrap', minWidth: 240 }}>
          <span className="hg-avatar hg-avatar--sm" aria-hidden="true">
            {iniciales(u.nombre)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="hg-t-sm hg-t-bold">{u.nombre}</div>
            <div className="hg-t-xs hg-t-sec">{u.correo}</div>
          </div>
        </div>
      ),
    },
    {
      clave: 'rolGlobal',
      titulo: 'Rol global',
      ordenable: true,
      render: (u) => (
        <Badge fg={COLOR_ROL[u.rolGlobal].fg} bg={COLOR_ROL[u.rolGlobal].bg} punto titulo={DESCRIPCION_ROL[u.rolGlobal]}>
          {ETIQUETAS_ROL[u.rolGlobal]}
        </Badge>
      ),
    },
    {
      clave: 'proyectos',
      titulo: 'Proyectos con acceso',
      render: (u) => {
        const propios = proyectos.filter((p) => p.accesos?.[u.uid])
        if (u.rolGlobal === 'administrador') {
          return <span className="hg-t-xs hg-t-sec">Todos (rol administrador)</span>
        }
        if (u.rolGlobal === 'directivo' || u.rolGlobal === 'auditor') {
          return <span className="hg-t-xs hg-t-sec">Todos, solo lectura</span>
        }
        return propios.length === 0 ? (
          <span className="hg-t-ter">Ninguno</span>
        ) : (
          <div className="hg-fila" style={{ gap: 4 }}>
            {propios.map((p) => (
              <Badge key={p.id} fg="#4F46E5" bg="#EEF2FF" titulo={`${p.nombre} · rol ${p.accesos[u.uid]}`}>
                {p.codigo}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      clave: 'activo',
      titulo: 'Estado',
      ordenable: true,
      valorOrden: (u) => (u.activo ? 1 : 0),
      render: (u) =>
        u.activo ? (
          <Badge fg="#047857" bg="#D1FAE5" punto>
            Activo
          </Badge>
        ) : (
          <Badge fg="#B91C1C" bg="#FEE2E2" punto>
            Desactivado
          </Badge>
        ),
    },
    {
      clave: 'ultimoAcceso',
      titulo: 'Ultimo acceso',
      ordenable: true,
      render: (u) => <span className="hg-t-xs">{u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : 'Nunca'}</span>,
    },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (u) => (
        <div className="hg-fila hg-fila--fin no-print" style={{ flexWrap: 'nowrap' }}>
          <Button variante="ghost" tamano="sm" onClick={() => setAccesos(u)}>
            Accesos
          </Button>
          <Button
            variante="ghost"
            tamano="sm"
            soloIcono
            aria-label={`Editar ${u.nombre}`}
            icono={<IconEditar size={15} />}
            onClick={() => {
              setEdicion(structuredClone(u))
              setEsNuevo(false)
              setErrores({})
            }}
          />
          <Button
            variante="ghost"
            tamano="sm"
            onClick={() => setADesactivar(u)}
            disabled={u.uid === usuario?.uid}
            title={u.uid === usuario?.uid ? 'No puede desactivar su propia cuenta' : undefined}
          >
            {u.activo ? 'Desactivar' : 'Reactivar'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="hg-pila">
      <Nota regla="ADR-05">
        En produccion el rol viaja como <em>custom claim</em> en el token y las reglas de seguridad de la base
        de datos lo verifican en el servidor. Esta pantalla mantiene el espejo consultable y administrable.
      </Nota>

      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Usuarios registrados" valor={usuarios.length} acento="#6366F1" />
        <KPICard etiqueta="Activos" valor={usuarios.filter((u) => u.activo).length} acento="#15803D" />
        <KPICard
          etiqueta="Administradores"
          valor={usuarios.filter((u) => u.rolGlobal === 'administrador').length}
          pie="Privilegio maximo: mantener al minimo"
          acento="#CA8A04"
        />
        <KPICard
          etiqueta="Sin acceso a proyectos"
          valor={
            usuarios.filter(
              (u) =>
                !['administrador', 'directivo', 'auditor'].includes(u.rolGlobal) &&
                !proyectos.some((p) => p.accesos?.[u.uid]),
            ).length
          }
          pie="Cuentas que aun no ven ningun proyecto"
          acento="#EF4444"
        />
      </div>

      {usuarios.filter((u) => u.rolGlobal === 'administrador' && u.activo).length <= 1 && (
        <Alert
          tipo="warning"
          titulo="Un solo administrador activo"
          mensaje="Conviene designar al menos un segundo administrador para no depender de una sola cuenta en la operacion del sistema."
        />
      )}

      <Card
        titulo="Usuarios y roles"
        subtitulo={`${visibles.length} de ${usuarios.length} usuario(s)`}
        acciones={
          <>
            <Button variante="ghost" tamano="sm" onClick={() => setVerMatriz(true)}>
              Ver matriz de permisos
            </Button>
            <Button
              variante="secondary"
              tamano="sm"
              icono={<IconExportar size={15} />}
              onClick={() =>
                exportarExcel(
                  [
                    {
                      nombre: 'Usuarios',
                      filas: usuarios.map((u) => ({
                        Nombre: u.nombre,
                        Correo: u.correo,
                        'Rol global': ETIQUETAS_ROL[u.rolGlobal],
                        Activo: u.activo ? 'Si' : 'No',
                        'Proyectos con acceso': proyectos
                          .filter((p) => p.accesos?.[u.uid])
                          .map((p) => `${p.codigo} (${p.accesos[u.uid]})`)
                          .join('; '),
                        'Ultimo acceso': u.ultimoAcceso ?? '',
                      })),
                    },
                  ],
                  'usuarios-higep',
                )
              }
            >
              Exportar
            </Button>
            <Button
              variante="primary"
              tamano="sm"
              icono={<IconMas size={15} />}
              onClick={() => {
                setEdicion({ nombre: '', correo: '', rolGlobal: 'miembro', activo: true })
                setEsNuevo(true)
                setErrores({})
              }}
            >
              Nuevo usuario
            </Button>
          </>
        }
      >
        <div className="hg-barra-filtros" style={{ marginBottom: 'var(--sp-md)' }}>
          <Input
            label="Buscar"
            placeholder="Nombre o correo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <Select
            label="Rol"
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            placeholder="Todos"
            opciones={ROLES.map((r) => ({ valor: r, etiqueta: ETIQUETAS_ROL[r] }))}
          />
          {(texto || filtroRol) && (
            <Button
              variante="ghost"
              onClick={() => {
                setTexto('')
                setFiltroRol('')
              }}
            >
              Limpiar
            </Button>
          )}
        </div>

        {visibles.length === 0 ? (
          <Vacio
            titulo="No hay usuarios que coincidan"
            texto="Ajuste los filtros o registre un usuario nuevo."
            icono={<IconUsuario size={24} />}
          />
        ) : (
          <Table
            columnas={columnas}
            filas={visibles}
            claveDe={(u) => u.uid}
            claseFila={(u) => (u.activo ? '' : 'hg-fila--critica')}
          />
        )}
      </Card>

      {/* Alta y edicion */}
      <Modal
        abierto={edicion !== null}
        titulo={esNuevo ? 'Nuevo usuario' : `Editar ${edicion?.nombre ?? ''}`}
        subtitulo={`Solo se admiten cuentas del dominio @${DOMINIO_INSTITUCIONAL}.`}
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" cargando={guardando} onClick={() => void guardar()}>
              Guardar usuario
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-grid hg-grid--form">
            <Input
              label="Nombre completo"
              requerido
              anchoCompleto
              value={edicion.nombre ?? ''}
              error={errores.nombre}
              onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
            />
            <Input
              label="Correo institucional"
              type="email"
              requerido
              anchoCompleto
              value={edicion.correo ?? ''}
              error={errores.correo}
              ayuda={`Debe terminar en @${DOMINIO_INSTITUCIONAL}.`}
              onChange={(e) => setEdicion({ ...edicion, correo: e.target.value })}
            />
            <Select
              label="Rol global"
              requerido
              value={edicion.rolGlobal ?? 'miembro'}
              opciones={ROLES.map((r) => ({ valor: r, etiqueta: ETIQUETAS_ROL[r] }))}
              ayuda={DESCRIPCION_ROL[(edicion.rolGlobal ?? 'miembro') as Rol]}
              onChange={(e) => setEdicion({ ...edicion, rolGlobal: e.target.value as Rol })}
            />
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Checkbox
                label="Cuenta activa"
                checked={edicion.activo ?? true}
                onChange={(e) => setEdicion({ ...edicion, activo: e.target.checked })}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Accesos por proyecto */}
      <Modal
        abierto={accesos !== null}
        tamano="lg"
        titulo={`Accesos de ${accesos?.nombre ?? ''}`}
        subtitulo="El rol asignado en un proyecto prevalece sobre el rol global dentro de ese proyecto."
        onCerrar={() => setAccesos(null)}
        pie={
          <Button variante="secondary" onClick={() => setAccesos(null)}>
            Cerrar
          </Button>
        }
      >
        {accesos && (
          <div className="hg-pila">
            {accesos.rolGlobal === 'administrador' && (
              <Alert
                tipo="info"
                titulo="Acceso total por rol"
                mensaje="Un administrador del sistema accede a todos los proyectos; no requiere acceso individual."
              />
            )}
            {(accesos.rolGlobal === 'directivo' || accesos.rolGlobal === 'auditor') && (
              <Alert
                tipo="info"
                titulo="Lectura institucional"
                mensaje="Este rol consulta todo el portafolio en solo lectura. El acceso por proyecto solo se necesita para conceder edicion."
              />
            )}

            {proyectos.length === 0 ? (
              <Vacio titulo="No hay proyectos en el sistema" texto="Cree un proyecto para poder conceder accesos." />
            ) : (
              <Table
                columnas={[
                  {
                    clave: 'codigo',
                    titulo: 'Proyecto',
                    render: (p: Proyecto) => (
                      <div style={{ minWidth: 200 }}>
                        <span className="hg-t-sm hg-t-bold">{p.codigo}</span>
                        <div className="hg-t-xs hg-t-sec">{p.nombre}</div>
                      </div>
                    ),
                  },
                  {
                    clave: 'rol',
                    titulo: 'Rol en el proyecto',
                    render: (p) => (
                      <select
                        className="hg-select hg-input--sm"
                        style={{ minWidth: 190 }}
                        value={p.accesos?.[accesos.uid] ?? ''}
                        disabled={guardando}
                        aria-label={`Rol de ${accesos.nombre} en ${p.codigo}`}
                        onChange={(e) => void cambiarAcceso(p, accesos.uid, e.target.value as Rol | '')}
                      >
                        <option value="">Sin acceso</option>
                        {(['lider', 'gestor', 'miembro'] as Rol[]).map((r) => (
                          <option key={r} value={r}>
                            {ETIQUETAS_ROL[r]}
                          </option>
                        ))}
                      </select>
                    ),
                  },
                  {
                    clave: 'estado',
                    titulo: 'Estado del proyecto',
                    render: (p) => <span className="hg-t-xs hg-t-sec">{p.estado}</span>,
                  },
                ]}
                filas={proyectos}
                claveDe={(p) => p.id}
              />
            )}
          </div>
        )}
      </Modal>

      {/* Matriz de permisos */}
      <Modal
        abierto={verMatriz}
        tamano="xl"
        titulo="Matriz de permisos por rol"
        subtitulo="Esta matriz gobierna la interfaz; su espejo normativo esta en las reglas de seguridad, que son las que deciden en el servidor."
        onCerrar={() => setVerMatriz(false)}
        pie={
          <Button variante="secondary" onClick={() => setVerMatriz(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="hg-tabla-wrap scroll-discreto">
          <table className="hg-tabla">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 3, minWidth: 230 }}>Accion</th>
                {ROLES.map((r) => (
                  <th key={r} className="hg-centro" style={{ minWidth: 86 }} title={DESCRIPCION_ROL[r]}>
                    {ETIQUETAS_ROL[r].split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCIONES.map((accion: Accion) => (
                <tr key={accion}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: '#fff',
                      zIndex: 1,
                      borderRight: '1px solid var(--c-border)',
                    }}
                  >
                    <span className="hg-t-mono hg-t-xs">{accion}</span>
                  </td>
                  {ROLES.map((rol) => {
                    const permisos = MATRIZ_PERMISOS[rol]
                    const tiene = permisos === 'todo' || permisos.includes(accion)
                    return (
                      <td key={rol} className="hg-centro">
                        {tiene ? (
                          <span style={{ color: '#047857', fontWeight: 700 }} title="Permitido">
                            ✓
                          </span>
                        ) : (
                          <span className="hg-t-ter" title="No permitido">
                            —
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hg-t-xs hg-t-sec" style={{ marginTop: 'var(--sp-sm)' }}>
          Un proyecto cerrado queda en solo lectura para todos los roles salvo el administrador, con
          independencia de esta matriz.
          <Pista texto="La restriccion de proyecto cerrado se aplica en puedeEnProyecto() y en las reglas de seguridad." />
        </p>
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aDesactivar)}
        titulo={aDesactivar?.activo ? 'Desactivar la cuenta' : 'Reactivar la cuenta'}
        mensaje={
          aDesactivar?.activo ? (
            <>
              <strong>{aDesactivar?.nombre}</strong> no podra ingresar al sistema. Su historial de auditoria se
              conserva integro.
            </>
          ) : (
            <>
              <strong>{aDesactivar?.nombre}</strong> podra volver a ingresar con su cuenta institucional.
            </>
          )
        }
        textoConfirmar={aDesactivar?.activo ? 'Desactivar' : 'Reactivar'}
        variante={aDesactivar?.activo ? 'danger' : 'primary'}
        onConfirmar={() => void cambiarEstado()}
        onCerrar={() => setADesactivar(null)}
      />
    </div>
  )
}
