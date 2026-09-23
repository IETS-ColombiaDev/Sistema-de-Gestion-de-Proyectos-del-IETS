/**
 * Entregas y evaluacion de calidad.
 *
 * El miembro del equipo registra el enlace de su entregable en el repositorio
 * institucional; el lider lo evalua contra una lista de chequeo propia del tipo
 * de entrega. Aqui viven las reglas de ese circuito: que enlace se acepta, como
 * se calcula el puntaje y que veredicto corresponde.
 *
 * Funciones puras: ni React ni base de datos.
 */

import type {
  Entrega,
  EstadoEntrega,
  EvaluacionEntrega,
  ItemChequeo,
  ListaChequeo,
  ResultadoItem,
  TipoEntrega,
} from './types'

// ---------------------------------------------------------------------------
// Enlace
// ---------------------------------------------------------------------------

/**
 * Dominios del repositorio institucional aceptados.
 *
 * Se restringe a proposito: el sistema guarda un enlace, no el archivo, y esa
 * decision solo se sostiene si el enlace apunta al repositorio corporativo,
 * donde la organizacion controla permisos, versiones y retencion. Un enlace a
 * una unidad personal cualquiera dejaria el entregable fuera de ese control y
 * con un unico dueno que puede borrarlo.
 */
const DOMINIOS_ACEPTADOS = [
  'sharepoint.com',
  'onedrive.live.com',
  '1drv.ms',
  'office.com',
  'officeapps.live.com',
]

export interface RevisionEnlace {
  valido: boolean
  motivo?: string
  /** Dominio reconocido, para mostrarlo junto al enlace. */
  dominio?: string
}

export function revisarEnlace(enlace: string): RevisionEnlace {
  const limpio = (enlace ?? '').trim()
  if (!limpio) return { valido: false, motivo: 'Falta el enlace del entregable.' }

  let url: URL
  try {
    url = new URL(limpio)
  } catch {
    return {
      valido: false,
      motivo: 'No es una direccion web valida. Copie el enlace desde "Compartir" en OneDrive.',
    }
  }

  // Sin https el enlace viaja en claro; un entregable institucional no deberia.
  if (url.protocol !== 'https:') {
    return { valido: false, motivo: 'El enlace debe usar https.' }
  }

  const anfitrion = url.hostname.toLowerCase()
  const dominio = DOMINIOS_ACEPTADOS.find(
    (d) => anfitrion === d || anfitrion.endsWith(`.${d}`),
  )
  if (!dominio) {
    return {
      valido: false,
      motivo:
        'Solo se aceptan enlaces del repositorio institucional (OneDrive o SharePoint). El archivo no se copia al sistema: se referencia donde la entidad lo custodia.',
    }
  }

  return { valido: true, dominio }
}

// ---------------------------------------------------------------------------
// Puntaje y veredicto
// ---------------------------------------------------------------------------

export interface Calificacion {
  /** 0..100 sobre los items YA revisados. */
  puntaje: number
  revisados: number
  total: number
  cumplidos: number
  /** Items obligatorios marcados como incumplidos. */
  obligatoriosIncumplidos: string[]
  /** Falso mientras queden items sin revisar. */
  completa: boolean
}

/**
 * Califica una lista de chequeo.
 *
 * Un item sin revisar NO cuenta como incumplido: son dos cosas distintas y
 * mezclarlas produciria un puntaje que baja solo porque el evaluador todavia
 * no ha llegado a esa linea. Por eso el denominador son los items revisados, y
 * la evaluacion se declara incompleta hasta que no quede ninguno en blanco.
 */
export function calificar(items: ItemChequeo[], resultados: ResultadoItem[]): Calificacion {
  const porItem = new Map(resultados.map((r) => [r.itemId, r]))
  let revisados = 0
  let cumplidos = 0
  const obligatoriosIncumplidos: string[] = []

  for (const item of items) {
    const r = porItem.get(item.id)
    if (!r || r.cumple == null) continue
    revisados += 1
    if (r.cumple) cumplidos += 1
    else if (item.obligatorio) obligatoriosIncumplidos.push(item.id)
  }

  return {
    puntaje: revisados === 0 ? 0 : Math.round((cumplidos / revisados) * 100),
    revisados,
    total: items.length,
    cumplidos,
    obligatoriosIncumplidos,
    completa: items.length > 0 && revisados === items.length,
  }
}

/** Umbral de aprobacion. Se declara aqui, no repartido por la interfaz. */
export const UMBRAL_APROBACION = 80

/**
 * Veredicto que corresponde a una calificacion.
 *
 * Se deriva, no se elige: si el evaluador pudiera aprobar una lista con dos
 * obligatorios incumplidos, la lista dejaria de significar algo. El comentario
 * es donde el lider pone su criterio; el veredicto lo fija la evidencia.
 */
export function veredictoDe(c: Calificacion): EvaluacionEntrega['veredicto'] {
  if (c.obligatoriosIncumplidos.length > 0) return 'Devuelta'
  if (c.puntaje < UMBRAL_APROBACION) return 'Devuelta'
  if (c.puntaje < 100) return 'Aprobada con observaciones'
  return 'Aprobada'
}

/** El estado de la entrega sigue al veredicto; sin evaluacion, queda entregada. */
export function estadoDeEntrega(evaluacion: EvaluacionEntrega | null): EstadoEntrega {
  return evaluacion ? evaluacion.veredicto : 'Entregada'
}

// ---------------------------------------------------------------------------
// Listas de chequeo
// ---------------------------------------------------------------------------

/** La lista activa para un tipo de entrega, si el catalogo tiene alguna. */
export function listaPara(
  tipo: TipoEntrega,
  listas: ListaChequeo[],
): ListaChequeo | null {
  return listas.find((l) => l.activa && !l.eliminado && l.tipo === tipo) ?? null
}

// ---------------------------------------------------------------------------
// Lectura agregada
// ---------------------------------------------------------------------------

export interface ResumenEntregas {
  total: number
  /** Entregadas que todavia nadie ha evaluado. */
  pendientesDeEvaluar: number
  aprobadas: number
  conObservaciones: number
  devueltas: number
  /** Promedio de puntaje de lo evaluado; null si no hay nada evaluado. */
  puntajeMedio: number | null
  /** Ultima version de cada entregable, que es lo que vale hoy. */
  vigentes: Entrega[]
}

/**
 * Resume las entregas de un proyecto.
 *
 * Solo la ULTIMA version de cada entregable cuenta para los totales: una
 * entrega devuelta y vuelta a entregar no son dos problemas, son uno que ya se
 * atendio. Las versiones anteriores siguen guardadas y visibles en el
 * historial, pero no inflan el recuento.
 */
export function resumirEntregas(entregas: Entrega[]): ResumenEntregas {
  const vivas = entregas.filter((e) => !e.eliminado)
  const reemplazadas = new Set(vivas.map((e) => e.reemplazaA).filter(Boolean) as string[])
  const vigentes = vivas
    .filter((e) => !reemplazadas.has(e.id))
    .sort((a, b) => b.fechaEntrega.localeCompare(a.fechaEntrega))

  const evaluadas = vigentes.filter((e) => e.evaluacion != null)
  const suma = evaluadas.reduce((s, e) => s + (e.evaluacion?.puntaje ?? 0), 0)

  return {
    total: vigentes.length,
    pendientesDeEvaluar: vigentes.filter((e) => e.evaluacion == null).length,
    aprobadas: vigentes.filter((e) => e.estado === 'Aprobada').length,
    conObservaciones: vigentes.filter((e) => e.estado === 'Aprobada con observaciones').length,
    devueltas: vigentes.filter((e) => e.estado === 'Devuelta').length,
    puntajeMedio: evaluadas.length === 0 ? null : Math.round(suma / evaluadas.length),
    vigentes,
  }
}

/** Historial de versiones de un entregable, de la mas nueva a la mas vieja. */
export function versionesDe(entrega: Entrega, entregas: Entrega[]): Entrega[] {
  const porId = new Map(entregas.map((e) => [e.id, e]))
  const cadena: Entrega[] = [entrega]
  let actual: Entrega | undefined = entrega
  // Tope de seguridad: si un dato corrupto encadenara un ciclo, el recorrido
  // no puede colgar la interfaz.
  let guarda = 0
  while (actual?.reemplazaA && guarda < 50) {
    const previa: Entrega | undefined = porId.get(actual.reemplazaA)
    if (!previa) break
    cadena.push(previa)
    actual = previa
    guarda += 1
  }
  return cadena
}
