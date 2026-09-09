/**
 * Arquitectura de informacion (HG-010).
 * Un solo mapa de navegacion consumido por la barra lateral y por el enrutador,
 * para que no puedan divergir.
 */

import type { ReactNode } from 'react'
import type { Accion } from '@/auth/permisos'
import {
  IconAuditoria,
  IconCatalogo,
  IconCronograma,
  IconEquipo,
  IconFicha,
  IconGantt,
  IconHito,
  IconImportar,
  IconIndicador,
  IconPortafolio,
  IconPresupuesto,
  IconProducto,
  IconRaci,
  IconRecurso,
  IconRiesgo,
  IconSatisfaccion,
  IconTablero,
  IconUsuario,
} from '@/components/icons'

export interface ItemNav {
  ruta: string
  etiqueta: string
  icono: ReactNode
  permiso?: Accion
  /** Clave del conteo de alertas que se muestra como badge. */
  contador?: string
}

export interface GrupoNav {
  titulo: string
  items: ItemNav[]
}

/** Navegacion institucional, fuera del contexto de un proyecto. */
export const NAV_GLOBAL: GrupoNav[] = [
  {
    titulo: 'Institucional',
    items: [
      { ruta: '/portafolio', etiqueta: 'Portafolio', icono: <IconPortafolio />, permiso: 'portafolio.ver' },
      { ruta: '/proyectos', etiqueta: 'Proyectos', icono: <IconFicha /> },
      { ruta: '/auditoria', etiqueta: 'Auditoria del sistema', icono: <IconAuditoria />, permiso: 'auditoria.ver' },
    ],
  },
  {
    titulo: 'Administracion',
    items: [
      { ruta: '/admin/catalogos', etiqueta: 'Catalogos y parametros', icono: <IconCatalogo />, permiso: 'catalogos.editar' },
      { ruta: '/admin/indicadores', etiqueta: 'Catalogo de indicadores', icono: <IconIndicador />, permiso: 'catalogos.editar' },
      { ruta: '/admin/usuarios', etiqueta: 'Usuarios y roles', icono: <IconUsuario />, permiso: 'usuarios.administrar' },
    ],
  },
]

/** Navegacion dentro de un proyecto. El orden sigue el flujo del instructivo. */
export function navProyecto(proyectoId: string): GrupoNav[] {
  const b = `/proyectos/${proyectoId}`
  return [
    {
      titulo: 'Lectura gerencial',
      items: [
        { ruta: `${b}/dashboard`, etiqueta: 'Dashboard ejecutivo', icono: <IconTablero /> },
        { ruta: `${b}/tablero`, etiqueta: 'Tablero de seguimiento', icono: <IconGantt />, contador: 'alertas' },
        { ruta: `${b}/indicadores`, etiqueta: 'Indicadores', icono: <IconIndicador /> },
      ],
    },
    {
      titulo: 'Definicion',
      items: [
        { ruta: `${b}/ficha`, etiqueta: 'Ficha del proyecto', icono: <IconFicha /> },
        { ruta: `${b}/equipo`, etiqueta: 'Grupo desarrollador', icono: <IconEquipo /> },
      ],
    },
    {
      titulo: 'Planeacion',
      items: [
        { ruta: `${b}/cronograma`, etiqueta: 'Cronograma', icono: <IconCronograma />, contador: 'retrasadas' },
        { ruta: `${b}/gantt`, etiqueta: 'Diagrama de Gantt', icono: <IconGantt /> },
        { ruta: `${b}/hitos`, etiqueta: 'Hitos y ruta critica', icono: <IconHito />, contador: 'hitos' },
      ],
    },
    {
      titulo: 'Gobierno y control',
      items: [
        { ruta: `${b}/raci`, etiqueta: 'Matriz RACI', icono: <IconRaci />, contador: 'raci' },
        { ruta: `${b}/riesgos`, etiqueta: 'Matriz de riesgos', icono: <IconRiesgo />, contador: 'riesgos' },
        { ruta: `${b}/recursos`, etiqueta: 'Recursos e insumos', icono: <IconRecurso />, contador: 'recursos' },
      ],
    },
    {
      titulo: 'Medicion',
      items: [
        { ruta: `${b}/productos`, etiqueta: 'Registro de productos', icono: <IconProducto /> },
        { ruta: `${b}/satisfaccion`, etiqueta: 'Satisfaccion', icono: <IconSatisfaccion /> },
        { ruta: `${b}/presupuesto`, etiqueta: 'Control presupuestal', icono: <IconPresupuesto /> },
      ],
    },
    {
      titulo: 'Trazabilidad',
      items: [
        { ruta: `${b}/auditoria`, etiqueta: 'Auditoria del proyecto', icono: <IconAuditoria />, permiso: 'auditoria.ver' },
        { ruta: `${b}/importacion`, etiqueta: 'Importar y exportar', icono: <IconImportar />, permiso: 'datos.exportar' },
      ],
    },
  ]
}
