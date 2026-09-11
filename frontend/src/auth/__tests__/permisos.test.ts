/**
 * Pruebas de la matriz de permisos — seccion 6 del backlog.
 * Verifican el principio de privilegio minimo y la regla de proyecto cerrado.
 */

import { describe, expect, it } from 'vitest'
import {
  MATRIZ_PERMISOS,
  proyectosVisibles,
  puede,
  puedeEnProyecto,
  rolEnProyecto,
} from '../permisos'
import type { Proyecto, Rol, Usuario } from '@/domain/types'

const usuario = (over: Partial<Usuario> = {}): Usuario => ({
  uid: 'u1',
  correo: 'u1@iets.org.co',
  nombre: 'Usuaria',
  rolGlobal: 'miembro',
  activo: true,
  creadoEn: '2026-01-01T00:00:00.000Z',
  ...over,
})

const proyecto = (over: Partial<Proyecto> = {}): Proyecto =>
  ({
    id: 'p1',
    codigo: 'TEST-001',
    nombre: 'Proyecto',
    estado: 'activo',
    accesos: {},
    fases: [],
    liderUid: null,
    creadoEn: '',
    creadoPor: '',
    actualizadoEn: '',
    actualizadoPor: '',
    ...over,
  }) as Proyecto

describe('privilegio minimo', () => {
  it('el administrador puede todo', () => {
    expect(MATRIZ_PERMISOS.administrador).toBe('todo')
    expect(puede('administrador', 'usuarios.administrar')).toBe(true)
    expect(puede('administrador', 'catalogos.editar')).toBe(true)
  })

  it('los roles de lectura no pueden escribir', () => {
    for (const rol of ['directivo', 'auditor'] as Rol[]) {
      expect(puede(rol, 'cronograma.editar')).toBe(false)
      expect(puede(rol, 'proyecto.editarFicha')).toBe(false)
      expect(puede(rol, 'riesgos.editar')).toBe(false)
      expect(puede(rol, 'proyecto.ver')).toBe(true)
    }
  })

  it('solo el auditor y el administrador ven la auditoria completa; el directivo no', () => {
    expect(puede('auditor', 'auditoria.ver')).toBe(true)
    expect(puede('directivo', 'auditoria.ver')).toBe(false)
  })

  it('el gestor no cierra el proyecto ni edita la ficha', () => {
    expect(puede('gestor', 'proyecto.cerrar')).toBe(false)
    expect(puede('gestor', 'proyecto.editarFicha')).toBe(false)
    expect(puede('gestor', 'cronograma.editar')).toBe(true)
  })

  it('el gestor no edita el presupuesto', () => {
    expect(puede('gestor', 'presupuesto.editar')).toBe(false)
    expect(puede('lider', 'presupuesto.editar')).toBe(true)
  })

  it('el miembro solo actualiza el avance de sus actividades y sube evidencias', () => {
    expect(puede('miembro', 'cronograma.editarAvancePropio')).toBe(true)
    expect(puede('miembro', 'evidencias.subir')).toBe(true)
    expect(puede('miembro', 'cronograma.editar')).toBe(false)
    expect(puede('miembro', 'riesgos.editar')).toBe(false)
  })

  it('nadie fuera del administrador administra usuarios o catalogos', () => {
    for (const rol of ['lider', 'gestor', 'miembro', 'directivo', 'auditor'] as Rol[]) {
      expect(puede(rol, 'usuarios.administrar')).toBe(false)
      expect(puede(rol, 'catalogos.editar')).toBe(false)
    }
  })

  it('sin rol no hay permiso', () => {
    expect(puede(null, 'proyecto.ver')).toBe(false)
  })
})

describe('rol efectivo dentro de un proyecto', () => {
  it('el rol del proyecto prevalece sobre el global', () => {
    const u = usuario({ uid: 'u1', rolGlobal: 'miembro' })
    const p = proyecto({ accesos: { u1: 'lider' } })
    expect(rolEnProyecto(u, p)).toBe('lider')
    expect(puedeEnProyecto(u, p, 'proyecto.editarFicha')).toBe(true)
  })

  it('el administrador conserva su rol en cualquier proyecto', () => {
    expect(rolEnProyecto(usuario({ rolGlobal: 'administrador' }), proyecto())).toBe('administrador')
  })

  it('sin acceso explicito, un miembro no tiene rol en el proyecto', () => {
    expect(rolEnProyecto(usuario({ rolGlobal: 'miembro' }), proyecto())).toBeNull()
    expect(puedeEnProyecto(usuario({ rolGlobal: 'miembro' }), proyecto(), 'proyecto.ver')).toBe(false)
  })

  it('los roles de lectura institucional conservan alcance sin acceso explicito', () => {
    expect(rolEnProyecto(usuario({ rolGlobal: 'directivo' }), proyecto())).toBe('directivo')
    expect(puedeEnProyecto(usuario({ rolGlobal: 'auditor' }), proyecto(), 'proyecto.ver')).toBe(true)
  })
})

describe('proyecto cerrado (HG-047)', () => {
  const cerrado = proyecto({ estado: 'cerrado', accesos: { u1: 'lider' } })

  it('queda en solo lectura para el lider', () => {
    const u = usuario({ uid: 'u1', rolGlobal: 'lider' })
    expect(puedeEnProyecto(u, cerrado, 'proyecto.ver')).toBe(true)
    expect(puedeEnProyecto(u, cerrado, 'datos.exportar')).toBe(true)
    expect(puedeEnProyecto(u, cerrado, 'cronograma.editar')).toBe(false)
    expect(puedeEnProyecto(u, cerrado, 'riesgos.editar')).toBe(false)
  })

  it('el administrador sigue pudiendo editarlo', () => {
    const admin = usuario({ uid: 'u0', rolGlobal: 'administrador' })
    expect(puedeEnProyecto(admin, cerrado, 'cronograma.editar')).toBe(true)
  })
})

describe('visibilidad del portafolio (HG-048)', () => {
  const proyectos = [
    proyecto({ id: 'p1', accesos: { u1: 'gestor' } }),
    proyecto({ id: 'p2', accesos: {} }),
    proyecto({ id: 'p3', liderUid: 'u1', accesos: {} }),
  ]

  it('el administrador y los roles de lectura ven todo', () => {
    for (const rol of ['administrador', 'directivo', 'auditor'] as Rol[]) {
      expect(proyectosVisibles(usuario({ rolGlobal: rol }), proyectos)).toHaveLength(3)
    }
  })

  it('un gestor solo ve los proyectos donde tiene acceso o es lider', () => {
    const visibles = proyectosVisibles(usuario({ uid: 'u1', rolGlobal: 'gestor' }), proyectos)
    expect(visibles.map((p) => p.id).sort()).toEqual(['p1', 'p3'])
  })

  it('sin sesion no se ve nada', () => {
    expect(proyectosVisibles(null, proyectos)).toHaveLength(0)
  })
})
