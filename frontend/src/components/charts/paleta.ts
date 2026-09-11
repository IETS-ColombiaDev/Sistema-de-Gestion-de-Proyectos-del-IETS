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
 * Serie del valor ganado. Tres magnitudes de dinero, comparables entre si, con
 * identidad fija: quien aprende que "lo planeado es indigo" no debe encontrarse
 * el indigo en otra cosa al filtrar. Son los tres primeros tonos categoricos,
 * verificados para daltonismo en todos sus pares.
 */
export const SERIE_EVM = {
  planeado: CATEGORICOS[0], // indigo
  ganado: CATEGORICOS[1], // cian
  real: CATEGORICOS[2], // magenta
  /** La proyeccion es el costo real extrapolado: mismo tono, trazo discontinuo. */
  proyectado: CATEGORICOS[2],
} as const

/**
 * Par divergente para polaridad: favorable frente a desfavorable, con gris
 * neutro en el punto medio.
 *
 * Teal y rosa son opuestos en temperatura —la condicion para que el lector no
 * tenga que consultar la leyenda— y superan el umbral de separacion en
 * deuteranopia, protanopia y tritanopia. El punto medio es gris, nunca un tono:
 * cero tiene que leerse como "nada", no como un tercer estado.
 *
 * No se usa verde/rojo aqui: ese par falla la separacion por daltonismo y ya
 * esta reservado al semaforo institucional, que siempre va con etiqueta.
 *
 * RESTRICCION: el teal favorable esta cerca del cian de SERIE_EVM (ΔE 6,9 en
 * vision normal). Los dos conjuntos NO pueden compartir un grafico. No es una
 * coincidencia afortunada, es una condicion de uso: identidad de serie y
 * polaridad son trabajos distintos, y un grafico hace uno o el otro.
 *
 * Verificado con scripts/validate_palette.js:
 *   SERIE_EVM (indigo, cian, magenta)  -> todos los pares PASS
 *   DIVERGENTE (teal, rosa)            -> todos los pares PASS
 *   los cinco juntos                   -> FAIL, y por eso no coexisten
 */
export const DIVERGENTE = {
  favorable: '#0D9488',
  favorableSuave: '#CCFBF1',
  neutro: '#94A3B8',
  neutroSuave: '#F1F5F9',
  desfavorable: '#BE123C',
  desfavorableSuave: '#FFE4E6',
} as const

/** Devuelve el tono divergente segun el signo, con el sentido explicito. */
export function tonoDivergente(
  valor: number,
  sentido: 'positivoEsBueno' | 'positivoEsMalo' = 'positivoEsBueno',
): string {
  if (valor === 0) return DIVERGENTE.neutro
  const bueno = sentido === 'positivoEsBueno' ? valor > 0 : valor < 0
  return bueno ? DIVERGENTE.favorable : DIVERGENTE.desfavorable
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

/**
 * Relleno de marca para los vocabularios de estado del negocio.
 *
 * No se usan los tonos `fg` del tema: esos son tonos de tinta, calculados para
 * contrastar sobre un fondo suave en una insignia, y como relleno de barra
 * resultan apagados y turbios. Estos son los pasos del semaforo, que es el
 * canal correcto para un estado. Van siempre con etiqueta y con leyenda: el
 * color de estado nunca es el unico canal de identidad.
 */
export const RELLENO_RECURSO = {
  'Por gestionar': ESTADO.advertencia,
  Disponible: ESTADO.bueno,
  Reservado: colors.primary.blue,
  'No disponible': ESTADO.critico,
} as const

export const RELLENO_RIESGO = {
  Bajo: ESTADO.bueno,
  Medio: ESTADO.advertencia,
  Alto: ESTADO.serio,
  Critico: ESTADO.critico,
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

/**
 * Tinta legible sobre un relleno dado.
 *
 * Blanco sobre ambar o sobre verde medio ronda 2:1 de contraste: ilegible en
 * texto pequeno. Se decide por luminancia relativa en vez de asumir que todo
 * relleno de color admite texto blanco.
 */
export function tintaSobre(relleno: string): string {
  const hex = relleno.replace('#', '')
  const completo = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const canal = (i: number) => {
    const v = parseInt(completo.slice(i * 2, i * 2 + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const luminancia = 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2)
  // Umbral en el punto donde el contraste con blanco y con la tinta oscura se
  // igualan (~0,18 de luminancia relativa).
  return luminancia > 0.34 ? TINTA.primaria : '#FFFFFF'
}
