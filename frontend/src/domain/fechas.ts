/**
 * Utilidades de fecha. Todo el sistema trabaja con cadenas 'YYYY-MM-DD'
 * y aritmetica en UTC para que la fecha de corte no se desplace por huso horario.
 *
 * Incluye el calculo de festivos de Colombia (Ley 51 de 1983 "Ley Emiliani"),
 * que alimenta el conteo de dias habiles de RN-02 saneada (HG-039).
 */

import type { ISODate } from './types'

const MS_DIA = 86_400_000

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

export function esISODate(v: unknown): v is ISODate {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/** Convierte 'YYYY-MM-DD' a Date en UTC (medianoche). */
export function aFecha(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Convierte un Date a 'YYYY-MM-DD' leyendo sus componentes UTC. */
export function aISO(fecha: Date): ISODate {
  const y = fecha.getUTCFullYear()
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  const d = String(fecha.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Fecha de hoy segun el reloj local, expresada como ISO date. */
export function hoyISO(): ISODate {
  const ahora = new Date()
  return aISO(new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())))
}

export function sumarDias(iso: ISODate, dias: number): ISODate {
  return aISO(new Date(aFecha(iso).getTime() + dias * MS_DIA))
}

export function sumarMeses(iso: ISODate, meses: number): ISODate {
  const f = aFecha(iso)
  const dia = f.getUTCDate()
  const base = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + meses, 1))
  const ultimoDia = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
  ).getUTCDate()
  base.setUTCDate(Math.min(dia, ultimoDia))
  return aISO(base)
}

/** Diferencia en dias calendario: b - a. */
export function diffDias(a: ISODate, b: ISODate): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / MS_DIA)
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b
}
export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b
}

export function inicioMes(iso: ISODate): ISODate {
  return iso.slice(0, 8) + '01'
}

export function finMes(iso: ISODate): ISODate {
  const f = aFecha(iso)
  return aISO(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)))
}

/** Lunes de la semana que contiene la fecha. */
export function inicioSemana(iso: ISODate): ISODate {
  const f = aFecha(iso)
  const dow = f.getUTCDay() // 0 domingo .. 6 sabado
  const retroceso = dow === 0 ? 6 : dow - 1
  return sumarDias(iso, -retroceso)
}

export function esFinDeSemana(iso: ISODate): boolean {
  const dow = aFecha(iso).getUTCDay()
  return dow === 0 || dow === 6
}

// ---------------------------------------------------------------------------
// Festivos de Colombia — Ley 51 de 1983
// ---------------------------------------------------------------------------

/** Domingo de Pascua por el algoritmo de Butcher (Gregoriano). */
export function domingoPascua(anio: number): ISODate {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return aISO(new Date(Date.UTC(anio, mes - 1, dia)))
}

/** Traslada la fecha al lunes siguiente si no cae en lunes (Ley Emiliani). */
function trasladarALunes(iso: ISODate): ISODate {
  const dow = aFecha(iso).getUTCDay()
  if (dow === 1) return iso
  const avance = dow === 0 ? 1 : 8 - dow
  return sumarDias(iso, avance)
}

/**
 * Festivos nacionales de Colombia para un ano dado.
 * Se calculan, no se transcriben, de modo que el sistema no caduca.
 */
export function festivosColombia(anio: number): ISODate[] {
  const fijos: ISODate[] = [
    `${anio}-01-01`, // Ano nuevo
    `${anio}-05-01`, // Dia del trabajo
    `${anio}-07-20`, // Independencia
    `${anio}-08-07`, // Batalla de Boyaca
    `${anio}-12-08`, // Inmaculada Concepcion
    `${anio}-12-25`, // Navidad
  ]

  const trasladables: ISODate[] = [
    `${anio}-01-06`, // Reyes Magos
    `${anio}-03-19`, // San Jose
    `${anio}-06-29`, // San Pedro y San Pablo
    `${anio}-08-15`, // Asuncion
    `${anio}-10-12`, // Dia de la Raza
    `${anio}-11-01`, // Todos los Santos
    `${anio}-11-11`, // Independencia de Cartagena
  ].map(trasladarALunes)

  const pascua = domingoPascua(anio)
  const pascuales: ISODate[] = [
    sumarDias(pascua, -3), // Jueves Santo
    sumarDias(pascua, -2), // Viernes Santo
    trasladarALunes(sumarDias(pascua, 43)), // Ascension (+40, trasladado)
    trasladarALunes(sumarDias(pascua, 64)), // Corpus Christi (+60, trasladado)
    trasladarALunes(sumarDias(pascua, 71)), // Sagrado Corazon (+68, trasladado)
  ]

  return [...fijos, ...trasladables, ...pascuales].sort()
}

/** Festivos para un rango de anos, util para sembrar el catalogo (HG-039). */
export function festivosRango(desde: number, hasta: number): ISODate[] {
  const out: ISODate[] = []
  for (let a = desde; a <= hasta; a++) out.push(...festivosColombia(a))
  return out.sort()
}

// ---------------------------------------------------------------------------
// Dias habiles — RN-02 saneada
// ---------------------------------------------------------------------------

export interface CalendarioHabil {
  esHabil(iso: ISODate): boolean
  /** Dias habiles en el intervalo cerrado [inicio, fin]. 0 si fin < inicio. */
  diasHabiles(inicio: ISODate, fin: ISODate): number
}

/**
 * Construye un calendario habil con un set de festivos.
 * Se memoiza el set para que el conteo sobre 300 actividades sea O(dias).
 */
export function crearCalendario(festivos: ISODate[] = []): CalendarioHabil {
  const set = new Set(festivos)
  const cacheAnios = new Set<number>()

  const asegurarAnio = (anio: number) => {
    if (cacheAnios.has(anio)) return
    cacheAnios.add(anio)
    // Si el catalogo no trae festivos de ese ano, se calculan para no dejar huecos.
    const yaTiene = festivos.some((f) => f.startsWith(String(anio)))
    if (!yaTiene) festivosColombia(anio).forEach((f) => set.add(f))
  }

  const esHabil = (iso: ISODate): boolean => {
    asegurarAnio(Number(iso.slice(0, 4)))
    return !esFinDeSemana(iso) && !set.has(iso)
  }

  const diasHabiles = (inicio: ISODate, fin: ISODate): number => {
    if (!esISODate(inicio) || !esISODate(fin)) return 0
    if (fin < inicio) return 0
    let total = 0
    let cursor = inicio
    // Cota de seguridad: 30 anos de proyecto.
    let guardas = 0
    while (cursor <= fin && guardas++ < 11_000) {
      if (esHabil(cursor)) total++
      cursor = sumarDias(cursor, 1)
    }
    return total
  }

  return { esHabil, diasHabiles }
}

// ---------------------------------------------------------------------------
// Formato para interfaz
// ---------------------------------------------------------------------------

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function formatearFecha(iso: ISODate | null | undefined, estilo: 'corto' | 'largo' | 'numerico' = 'corto'): string {
  if (!iso || !esISODate(iso)) return '—'
  const f = aFecha(iso)
  const d = f.getUTCDate()
  const m = f.getUTCMonth()
  const y = f.getUTCFullYear()
  if (estilo === 'numerico') return `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`
  if (estilo === 'largo') return `${d} de ${MESES_LARGOS[m]} de ${y}`
  return `${String(d).padStart(2, '0')} ${MESES_CORTOS[m]} ${y}`
}

export function formatearPeriodo(periodo: string): string {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return periodo
  const [y, m] = periodo.split('-').map(Number)
  return `${MESES_LARGOS[m - 1]} ${y}`
}

export function etiquetaMesCorto(iso: ISODate): string {
  const f = aFecha(iso)
  return `${MESES_CORTOS[f.getUTCMonth()]} ${String(f.getUTCFullYear()).slice(2)}`
}
