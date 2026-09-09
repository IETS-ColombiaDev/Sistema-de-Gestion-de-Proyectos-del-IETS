/**
 * Contrato de persistencia.
 *
 * La aplicacion nunca habla con Firestore ni con IndexedDB directamente: habla
 * con este contrato. Eso permite (a) desarrollar y demostrar el sistema sin
 * infraestructura, (b) migrar a Firestore cambiando una variable de entorno, y
 * (c) probar el motor de calculo con un adaptador en memoria.
 *
 * Una "coleccion" es una ruta con numero impar de segmentos, igual que en
 * Firestore: 'proyectos', 'proyectos/{id}/actividades', 'catalogos/listas'.
 */

export interface DocumentoBase {
  id: string
  [k: string]: unknown
}

export interface Adaptador {
  readonly nombre: 'local' | 'firebase'

  listar<T extends DocumentoBase>(coleccion: string): Promise<T[]>
  obtener<T extends DocumentoBase>(coleccion: string, id: string): Promise<T | null>
  guardar<T extends DocumentoBase>(coleccion: string, doc: T): Promise<T>
  /** Escritura de varios documentos como una sola unidad (transaccion cuando el backend la soporta). */
  guardarLote<T extends DocumentoBase>(coleccion: string, docs: T[]): Promise<T[]>
  eliminarDefinitivo(coleccion: string, id: string): Promise<void>
  /** Vacia una coleccion completa. Solo para siembra y reinicio del entorno local. */
  vaciar(coleccion: string): Promise<void>
  /** Suscripcion a cambios; devuelve la funcion para cancelarla. */
  suscribir?<T extends DocumentoBase>(coleccion: string, cb: (docs: T[]) => void): () => void
}

export function nuevoId(prefijo = ''): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
  return prefijo ? `${prefijo}_${aleatorio}` : aleatorio
}

export const rutas = {
  usuarios: () => 'usuarios',
  proyectos: () => 'proyectos',
  sub: (proyectoId: string, sub: string) => `proyectos/${proyectoId}/${sub}`,
  equipo: (p: string) => `proyectos/${p}/equipo`,
  actividades: (p: string) => `proyectos/${p}/actividades`,
  hitos: (p: string) => `proyectos/${p}/hitos`,
  raci: (p: string) => `proyectos/${p}/raci`,
  riesgos: (p: string) => `proyectos/${p}/riesgos`,
  recursos: (p: string) => `proyectos/${p}/recursos`,
  productos: (p: string) => `proyectos/${p}/productos`,
  satisfaccion: (p: string) => `proyectos/${p}/satisfaccion`,
  presupuesto: (p: string) => `proyectos/${p}/presupuesto`,
  snapshots: (p: string) => `proyectos/${p}/snapshots`,
  auditoria: () => 'auditoria',
  catalogoListas: () => 'catalogos_listas',
  catalogoIndicadores: () => 'catalogos_indicadores',
  catalogoParametros: () => 'catalogos_parametros',
} as const
