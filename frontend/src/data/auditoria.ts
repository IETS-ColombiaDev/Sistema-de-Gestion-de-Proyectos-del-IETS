/**
 * Auditoria automatica — EP-20 / ADR-06.
 *
 * Sustituye la hoja "Registro de actualizaciones", que era manual por diseno.
 * Toda escritura de negocio produce uno o varios eventos campo a campo, con
 * valor anterior y valor nuevo. El registro es append-only: no hay ruta de
 * edicion ni de borrado, ni en la interfaz ni en las reglas de seguridad.
 */

import { nuevoId } from './adapter'
import type { EventoAuditoria, TipoCambio } from '@/domain/types'

/** Campos que no se auditan por ser metadatos de la propia escritura. */
const IGNORADOS = new Set([
  'id',
  'creadoEn',
  'creadoPor',
  'actualizadoEn',
  'actualizadoPor',
  'proyectoId',
  'historial',
])

/** Cambios sensibles que exigen justificacion escrita (HG-126). */
export const CAMPOS_SENSIBLES: Record<string, string[]> = {
  proyecto: ['fechaEntregaFinal', 'fechaInicio', 'estado', 'modoCalculo'],
  actividad: ['fechaFin', 'fechaInicio'],
  hito: ['fechaProgramada', 'fechaReal', 'estado'],
  riesgo: ['estado'],
  producto: ['conforme', 'evaluado'],
}

export function exigeComentario(entidad: string, campos: string[]): boolean {
  const sensibles = CAMPOS_SENSIBLES[entidad]
  if (!sensibles) return false
  return campos.some((c) => sensibles.includes(c))
}

function serializar(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) {
    if (v.length === 0) return '(vacio)'
    return v
      .map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x)))
      .join(', ')
  }
  return JSON.stringify(v)
}

export interface CambioCampo {
  campo: string
  anterior: string | null
  nuevo: string | null
}

/** Diferencia superficial entre dos versiones de un documento. */
export function calcularCambios(
  anterior: Record<string, unknown> | null,
  nuevo: Record<string, unknown>,
): CambioCampo[] {
  const cambios: CambioCampo[] = []
  const claves = new Set([...Object.keys(anterior ?? {}), ...Object.keys(nuevo)])
  for (const campo of claves) {
    if (IGNORADOS.has(campo)) continue
    const a = serializar(anterior?.[campo])
    const b = serializar(nuevo[campo])
    if (a !== b) cambios.push({ campo, anterior: a, nuevo: b })
  }
  return cambios
}

export interface ContextoAuditoria {
  usuarioUid: string
  usuarioNombre: string
  proyectoId: string | null
  entidad: string
  entidadId: string
  entidadEtiqueta: string
  tipoCambio: TipoCambio
  comentario?: string
}

export function construirEventos(
  ctx: ContextoAuditoria,
  accion: EventoAuditoria['accion'],
  cambios: CambioCampo[],
): EventoAuditoria[] {
  const fechaHora = new Date().toISOString()
  const base = {
    proyectoId: ctx.proyectoId,
    fechaHora,
    usuarioUid: ctx.usuarioUid,
    usuarioNombre: ctx.usuarioNombre,
    accion,
    tipoCambio: ctx.tipoCambio,
    entidad: ctx.entidad,
    entidadId: ctx.entidadId,
    entidadEtiqueta: ctx.entidadEtiqueta,
    comentario: ctx.comentario,
  }

  if (cambios.length === 0) {
    return [
      {
        ...base,
        id: nuevoId('aud'),
        campo: null,
        valorAnterior: null,
        valorNuevo: null,
      },
    ]
  }

  return cambios.map((c) => ({
    ...base,
    id: nuevoId('aud'),
    campo: c.campo,
    valorAnterior: c.anterior,
    valorNuevo: c.nuevo,
  }))
}

/** Etiquetas legibles de campo para la consulta de auditoria. */
export const ETIQUETAS_CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  codigo: 'Codigo',
  avance: '% de avance',
  fechaInicio: 'Fecha de inicio',
  fechaFin: 'Fecha de fin',
  fechaCorte: 'Fecha de corte',
  fechaProgramada: 'Fecha programada',
  fechaReal: 'Fecha real',
  fechaEntregaFinal: 'Fecha de entrega final',
  estado: 'Estado',
  probabilidad: 'Probabilidad',
  impacto: 'Impacto',
  disponibilidad: 'Disponibilidad',
  estadoVinculacion: 'Estado de vinculacion',
  conforme: 'Conforme',
  evaluado: 'Evaluado',
  programado: 'Programado',
  ejecutado: 'Ejecutado',
  encuestados: 'Encuestados',
  satisfechos: 'Satisfechos',
  responsableNombre: 'Responsable',
  faseId: 'Fase',
  letra: 'Letra RACI',
  eliminado: 'Eliminado',
  modoCalculo: 'Modo de calculo',
  predecesoras: 'Predecesoras',
}

export function etiquetaCampo(campo: string | null): string {
  if (!campo) return '—'
  return ETIQUETAS_CAMPO[campo] ?? campo
}
