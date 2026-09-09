/**
 * Matriz de permisos rol x accion — seccion 6 del backlog (HG-007).
 *
 * Principio de privilegio minimo. Esta matriz gobierna la interfaz; su espejo
 * normativo esta en firestore.rules, que es lo que efectivamente decide en el
 * servidor. La interfaz nunca es la unica barrera.
 */

import type { Rol, Proyecto, Usuario } from '@/domain/types'

export const ACCIONES = [
  // Lectura
  'proyecto.ver',
  'auditoria.ver',
  'portafolio.ver',
  // Ficha y ciclo de vida
  'proyecto.crear',
  'proyecto.editarFicha',
  'proyecto.cambiarFechaCorte',
  'proyecto.cerrar',
  'proyecto.eliminar',
  'proyecto.duplicar',
  // Contenido
  'equipo.editar',
  'cronograma.editar',
  'cronograma.editarAvancePropio',
  'hitos.editar',
  'raci.editar',
  'riesgos.editar',
  'recursos.editar',
  'productos.editar',
  'satisfaccion.editar',
  'presupuesto.editar',
  'evidencias.subir',
  // Sistema
  'catalogos.editar',
  'usuarios.administrar',
  'indicadores.recalcular',
  'datos.importar',
  'datos.exportar',
] as const

export type Accion = (typeof ACCIONES)[number]

type Matriz = Record<Rol, Accion[] | 'todo'>

export const MATRIZ_PERMISOS: Matriz = {
  administrador: 'todo',

  lider: [
    'proyecto.ver',
    'auditoria.ver',
    'portafolio.ver',
    'proyecto.crear',
    'proyecto.editarFicha',
    'proyecto.cambiarFechaCorte',
    'proyecto.cerrar',
    'proyecto.duplicar',
    'equipo.editar',
    'cronograma.editar',
    'cronograma.editarAvancePropio',
    'hitos.editar',
    'raci.editar',
    'riesgos.editar',
    'recursos.editar',
    'productos.editar',
    'satisfaccion.editar',
    'presupuesto.editar',
    'evidencias.subir',
    'indicadores.recalcular',
    'datos.importar',
    'datos.exportar',
  ],

  gestor: [
    'proyecto.ver',
    'auditoria.ver',
    'portafolio.ver',
    'proyecto.cambiarFechaCorte',
    'equipo.editar',
    'cronograma.editar',
    'cronograma.editarAvancePropio',
    'hitos.editar',
    'raci.editar',
    'riesgos.editar',
    'recursos.editar',
    'productos.editar',
    'satisfaccion.editar',
    'evidencias.subir',
    'indicadores.recalcular',
    'datos.exportar',
  ],

  miembro: [
    'proyecto.ver',
    'cronograma.editarAvancePropio',
    'evidencias.subir',
  ],

  directivo: ['proyecto.ver', 'portafolio.ver', 'datos.exportar'],

  auditor: ['proyecto.ver', 'portafolio.ver', 'auditoria.ver', 'datos.exportar'],
}

/** Rol efectivo del usuario dentro de un proyecto: el del proyecto prevalece sobre el global. */
export function rolEnProyecto(usuario: Usuario | null, proyecto: Proyecto | null): Rol | null {
  if (!usuario) return null
  if (usuario.rolGlobal === 'administrador') return 'administrador'
  if (!proyecto) return usuario.rolGlobal
  const asignado = proyecto.accesos?.[usuario.uid] ?? usuario.rolesPorProyecto?.[proyecto.id]
  if (asignado) return asignado
  // Sin acceso explicito, los roles de lectura institucional conservan su alcance.
  if (usuario.rolGlobal === 'directivo' || usuario.rolGlobal === 'auditor') return usuario.rolGlobal
  return null
}

export function puede(rol: Rol | null, accion: Accion): boolean {
  if (!rol) return false
  const permisos = MATRIZ_PERMISOS[rol]
  if (permisos === 'todo') return true
  return permisos.includes(accion)
}

/**
 * Permiso efectivo sobre un proyecto concreto.
 * Un proyecto cerrado es de solo lectura salvo para el administrador (HG-047).
 */
export function puedeEnProyecto(
  usuario: Usuario | null,
  proyecto: Proyecto | null,
  accion: Accion,
): boolean {
  const rol = rolEnProyecto(usuario, proyecto)
  if (!puede(rol, accion)) return false
  const esLectura = accion.endsWith('.ver') || accion === 'datos.exportar'
  if (proyecto?.estado === 'cerrado' && !esLectura && rol !== 'administrador') return false
  return true
}

/** Proyectos que el usuario puede ver (HG-048). */
export function proyectosVisibles(usuario: Usuario | null, proyectos: Proyecto[]): Proyecto[] {
  if (!usuario) return []
  if (usuario.rolGlobal === 'administrador') return proyectos
  if (usuario.rolGlobal === 'directivo' || usuario.rolGlobal === 'auditor') return proyectos
  return proyectos.filter(
    (p) => p.accesos?.[usuario.uid] || p.liderUid === usuario.uid || usuario.rolesPorProyecto?.[p.id],
  )
}

export const ETIQUETAS_ROL: Record<Rol, string> = {
  administrador: 'Administrador del sistema',
  lider: 'Lider de proyecto',
  gestor: 'Gestor de proyecto',
  miembro: 'Miembro del equipo',
  directivo: 'Directivo / consulta',
  auditor: 'Auditor',
}

export const DESCRIPCION_ROL: Record<Rol, string> = {
  administrador: 'Administra catalogos, parametros, usuarios y roles en todos los proyectos.',
  lider: 'Responsable del proyecto: crea y edita todo su contenido y puede cerrarlo.',
  gestor: 'Apoyo operativo: registra avance, riesgos, recursos y productos.',
  miembro: 'Ejecuta actividades: actualiza el avance de las suyas y adjunta evidencias.',
  directivo: 'Lectura gerencial de tableros y portafolio, sin edicion.',
  auditor: 'Lectura total, incluida la auditoria, sin edicion.',
}
