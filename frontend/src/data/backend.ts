/**
 * Seleccion del backend segun el entorno.
 * VITE_BACKEND=firebase exige credenciales completas; si faltan, se degrada al
 * adaptador local con una advertencia visible en consola, para que el entorno
 * de desarrollo nunca quede inoperante por una variable ausente.
 */

import type { Adaptador } from './adapter'
import { localAdapter } from './localAdapter'

let cache: Adaptador | null = null

export function backendSolicitado(): 'local' | 'firebase' {
  return (import.meta.env.VITE_BACKEND as 'local' | 'firebase') ?? 'local'
}

export async function obtenerAdaptador(): Promise<Adaptador> {
  if (cache) return cache
  if (backendSolicitado() === 'firebase') {
    const { firebaseAdapter, firebaseConfigurado } = await import('./firebaseAdapter')
    if (firebaseConfigurado()) {
      cache = firebaseAdapter
      return cache
    }
    console.warn(
      '[HIGEP] VITE_BACKEND=firebase pero faltan credenciales. Se usa el adaptador local.',
    )
  }
  cache = localAdapter
  return cache
}

/** Solo para pruebas: permite inyectar un adaptador en memoria. */
export function fijarAdaptador(adaptador: Adaptador | null): void {
  cache = adaptador
}
