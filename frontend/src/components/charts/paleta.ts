/**
 * Paleta de datos.
 *
 * Derivada de los tokens del tema y VALIDADA para daltonismo: los cinco tonos
 * categoricos superan el umbral de separacion en deuteranopia, protanopia y
 * tritanopia para todos los pares, no solo los adyacentes.
 *
 *   #6366F1 indigo  (primary.purple del tema)
 *   #0891B2 cian    (paso oscuro de primary.aquamarine)
 *   #DB2777 magenta
 *   #CA8A04 ambar oscuro   -> contraste 2,86:1 sobre fondo claro:
 *                             SIEMPRE acompanado de etiqueta directa y vista de tabla
 *   #15803D verde oscuro
 *
 * Reglas que esta paleta respeta:
 *  - Los tonos categoricos se asignan en orden fijo; nunca se ciclan ni se generan.
 *  - Los colores de estado (exito, advertencia, error) estan reservados para el
 *    semaforo institucional y no se reutilizan como "serie 4".
 *  - El color sigue a la entidad, no a su posicion: filtrar series no repinta
 *    las que quedan.
 */

import { colors } from '@/styles/theme'

/** Orden fijo de asignacion categorica. Maximo cinco series; la sexta se agrupa en "Otros". */
export const CATEGORICOS = ['#6366F1', '#0891B2', '#DB2777', '#CA8A04', '#15803D'] as const

export const COLOR_OTROS = '#94A3B8'

/** Devuelve el color de una serie por su posicion estable en la leyenda. */
export function colorSerie(indice: number): string {
  return indice < CATEGORICOS.length ? CATEGORICOS[indice] : COLOR_OTROS
}

/**
 * Rampa secuencial de un solo tono, claro a oscuro. Para magnitud, nunca arcoiris.
 */
export const SECUENCIAL_INDIGO = [
  '#EEF2FF',
  '#E0E7FF',
  '#C7D2FE',
  '#A5B4FC',
  '#818CF8',
  '#6366F1',
  '#4F46E5',
] as const

export function tonoSecuencial(valor: number, maximo: number): string {
  if (maximo <= 0 || valor <= 0) return SECUENCIAL_INDIGO[0]
  const i = Math.min(
    SECUENCIAL_INDIGO.length - 1,
    Math.max(1, Math.round((valor / maximo) * (SECUENCIAL_INDIGO.length - 1))),
  )
  return SECUENCIAL_INDIGO[i]
}

/** Semaforo institucional. Reservado: nunca se usa para identidad de serie. */
export const ESTADO = {
  bueno: colors.status.success,
  advertencia: colors.status.warning,
  serio: '#EA580C',
  critico: colors.status.error,
  neutro: colors.text.tertiary,
} as const

/** Tinta: valores, etiquetas y leyendas nunca llevan el color de la serie. */
export const TINTA = {
  primaria: colors.text.primary,
  secundaria: colors.text.secondary,
  tenue: colors.text.tertiary,
  rejilla: colors.borders.light,
  eje: colors.borders.medium,
  superficie: colors.backgrounds.card,
} as const
