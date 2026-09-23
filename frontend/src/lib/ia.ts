/**
 * Asistente de IA: sugerencias de riesgos, hitos y lectura de portafolio.
 *
 * Tres decisiones que conviene tener presentes al leer este archivo:
 *
 * 1. La clave del proveedor NO esta aqui ni puede estarlo. El navegador es un
 *    entorno publico: cualquier credencial incluida en el bundle es legible
 *    por quien abra las herramientas de desarrollo. La llamada va contra una
 *    Cloud Function (`sugerirConIA`) que guarda la clave en el gestor de
 *    secretos de la plataforma.
 *
 * 2. Lo que vuelve son SUGERENCIAS, no datos. Nada se escribe hasta que una
 *    persona lo acepta. Un riesgo que entra al proyecto sin que nadie lo haya
 *    revisado seria un dato sin responsable.
 *
 * 3. Sin IA configurada el sistema funciona igual. La ausencia se declara con
 *    un mensaje propio en vez de devolver una lista vacia, que se leeria como
 *    "no hay nada que sugerir" y es una afirmacion distinta.
 */

import type { DatosProyecto } from '@/domain/types'
import type { ResumenProyecto } from '@/domain/reglas'

export interface SugerenciaIA {
  titulo: string
  detalle: string
  extra?: Record<string, string>
}

export type EstadoIA =
  | { estado: 'inactiva' }
  | { estado: 'consultando' }
  | { estado: 'listo'; sugerencias: SugerenciaIA[]; modelo: string }
  | { estado: 'no-configurada' }
  | { estado: 'error'; mensaje: string }

export type TipoSugerencia = 'riesgos' | 'hitos' | 'portafolio'

/** El backend local no tiene funciones: la IA solo existe con Firebase. */
export function iaDisponible(): boolean {
  return import.meta.env.VITE_BACKEND === 'firebase'
}

async function invocar(
  tipo: TipoSugerencia,
  contexto: string,
): Promise<{ sugerencias: SugerenciaIA[]; modelo: string }> {
  const { getFunctions, httpsCallable } = await import('firebase/functions')
  const { inicializarFirebase } = await import('@/data/firebaseAdapter')
  const fn = httpsCallable<
    { tipo: string; contexto: string },
    { sugerencias: SugerenciaIA[]; modelo: string }
  >(getFunctions(inicializarFirebase().app), 'sugerirConIA')
  const r = await fn({ tipo, contexto })
  return r.data
}

/**
 * Pide sugerencias y traduce cualquier fallo a un estado que la interfaz sepa
 * mostrar. Nunca lanza: una caida del asistente no puede tumbar la pantalla
 * desde la que se pidio.
 */
export async function pedirSugerencias(
  tipo: TipoSugerencia,
  contexto: string,
): Promise<EstadoIA> {
  if (!iaDisponible()) return { estado: 'no-configurada' }
  try {
    const { sugerencias, modelo } = await invocar(tipo, contexto)
    return { estado: 'listo', sugerencias, modelo }
  } catch (error) {
    const codigo = (error as { code?: string })?.code ?? ''
    if (codigo.includes('failed-precondition')) return { estado: 'no-configurada' }
    const mensaje =
      (error as { message?: string })?.message ?? 'No fue posible consultar el asistente.'
    return { estado: 'error', mensaje }
  }
}

// ---------------------------------------------------------------------------
// Contextos
// ---------------------------------------------------------------------------

/**
 * Que se le manda al modelo.
 *
 * Se envian datos ESTRUCTURALES del proyecto —fases, fechas, estados,
 * categorias—, nunca el contenido de los entregables ni datos de personas mas
 * alla del rol. El asistente necesita saber de que trata el proyecto y como va;
 * no necesita saber quien es quien.
 */
export function contextoRiesgos(datos: DatosProyecto, resumen: ResumenProyecto): string {
  const p = datos.proyecto
  return [
    `Proyecto: ${p.nombre}`,
    `Objeto: ${p.tecnologiaObjeto ?? '—'}`,
    `Alcance: ${p.alcance ?? '—'}`,
    `Vigencia: ${p.fechaInicio} a ${p.fechaEntregaFinal}. Fecha de corte: ${p.fechaCorte}.`,
    `Avance real ${resumen.avancePonderado.toFixed(1)} % frente a ${resumen.avanceEsperado.toFixed(1)} % esperado.`,
    `Actividades: ${resumen.actividades.length}, de las cuales ${resumen.retrasadas.length} retrasadas.`,
    `Fases: ${resumen.porFase.map((f: { nombre: string; avance: number }) => `${f.nombre} (${f.avance.toFixed(0)} %)`).join(', ')}`,
    `Riesgos ya registrados: ${
      datos.riesgos.filter((r) => !r.eliminado).map((r) => r.descripcion).join(' | ') || 'ninguno'
    }`,
  ].join('\n')
}

export function contextoHitos(datos: DatosProyecto, resumen: ResumenProyecto): string {
  const p = datos.proyecto
  return [
    `Proyecto: ${p.nombre}`,
    `Objeto: ${p.tecnologiaObjeto ?? '—'}`,
    `Vigencia: ${p.fechaInicio} a ${p.fechaEntregaFinal}. Fecha de corte: ${p.fechaCorte}.`,
    `Fases y fechas: ${resumen.porFase.map((f) => f.nombre).join(', ')}`,
    `Actividades con entregable: ${
      resumen.actividades
        .filter((a) => a.entregable)
        .map((a) => `${a.nombre} (${a.fechaFin ?? 'sin fecha'})`)
        .join(' | ') || 'ninguna'
    }`,
    `Hitos ya registrados: ${
      datos.hitos.filter((h) => !h.eliminado).map((h) => `${h.descripcion} (${h.fechaProgramada ?? 'sin fecha'})`).join(' | ') ||
      'ninguno'
    }`,
  ].join('\n')
}

export function contextoPortafolio(
  filas: {
    codigo: string
    nombre: string
    avance: number
    indiceCronograma: number | null
    indiceCosto: number | null
    variacionAlCierre: number | null
    alertasCriticas: number
  }[],
): string {
  return [
    'Cartera de proyectos, con sus indices de valor ganado a la fecha de corte:',
    ...filas.map(
      (f) =>
        `${f.codigo} — ${f.nombre}: avance ${f.avance.toFixed(1)} %, ` +
        `indice de cronograma ${f.indiceCronograma?.toFixed(2) ?? 'sin datos'}, ` +
        `indice de costo ${f.indiceCosto?.toFixed(2) ?? 'sin datos'}, ` +
        `variacion al cierre ${f.variacionAlCierre?.toFixed(0) ?? 'sin datos'}, ` +
        `${f.alertasCriticas} alerta(s) critica(s).`,
    ),
  ].join('\n')
}
