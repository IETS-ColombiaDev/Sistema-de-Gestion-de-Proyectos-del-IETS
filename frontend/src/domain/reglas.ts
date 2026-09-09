/**
 * Motor de reglas de negocio — seccion 5 del backlog (RN-01 .. RN-28).
 *
 * Dos modos de calculo (EP-30 / Anexo C):
 *  - 'saneado'        : aplica las correcciones aprobadas (D-01, D-02, D-03, D-05, D-06...).
 *  - 'compatibilidad' : replica el comportamiento heredado del libro Excel,
 *                       para la suite de paridad.
 *
 * Funciones puras y sin dependencias de React o de la capa de datos: son la
 * unidad basica de prueba (HG-165 suite de paridad).
 */

import {
  aISO,
  aFecha,
  crearCalendario,
  diffDias,
  esISODate,
  maxISO,
  minISO,
  sumarDias,
  type CalendarioHabil,
} from './fechas'
import type {
  Actividad,
  ActividadCalculada,
  AsignacionRaci,
  DatosProyecto,
  DisponibilidadRecurso,
  EstadoActividad,
  EstadoIndicador,
  Hito,
  HitoCalculado,
  ISODate,
  IntegridadRaci,
  MedicionSatisfaccion,
  MiembroEquipo,
  ModoCalculo,
  NivelRiesgo,
  Parametros,
  Producto,
  Recurso,
  RegistroPresupuestal,
  Riesgo,
  RiesgoCalculado,
  SentidoIndicador,
} from './types'

// ---------------------------------------------------------------------------
// Contexto de calculo
// ---------------------------------------------------------------------------

export interface ContextoCalculo {
  fechaCorte: ISODate
  fechaEntregaFinal: ISODate
  modo: ModoCalculo
  parametros: Parametros
  calendario: CalendarioHabil
}

export function crearContexto(
  fechaCorte: ISODate,
  fechaEntregaFinal: ISODate,
  modo: ModoCalculo,
  parametros: Parametros,
): ContextoCalculo {
  return {
    fechaCorte,
    fechaEntregaFinal,
    modo,
    parametros,
    calendario: crearCalendario(parametros.festivos),
  }
}

const redondear = (n: number, dec = 2): number => {
  const f = 10 ** dec
  return Math.round((n + Number.EPSILON) * f) / f
}

// ---------------------------------------------------------------------------
// RN-01 · Estado de la actividad
// ---------------------------------------------------------------------------

/**
 * Orden de evaluacion heredado del libro, conservado literalmente:
 * "Completada" prevalece sobre "Retrasada".
 * Guarda de fila vacia obligatoria (D-14): una actividad sin nombre o sin
 * fechas no produce estado y queda fuera de todos los agregados.
 */
export function estadoActividad(
  act: Pick<Actividad, 'nombre' | 'fechaInicio' | 'fechaFin' | 'avance'>,
  fechaCorte: ISODate,
): { estado: EstadoActividad; razon: string; vacia: boolean } {
  const vacia =
    !act.nombre?.trim() || !esISODate(act.fechaInicio ?? '') || !esISODate(act.fechaFin ?? '')

  if (vacia) {
    return {
      estado: '',
      razon: 'Actividad incompleta: sin nombre o sin fechas. No participa en los calculos.',
      vacia: true,
    }
  }

  const inicio = act.fechaInicio as ISODate
  const fin = act.fechaFin as ISODate
  const avance = Number(act.avance) || 0

  if (avance >= 100) {
    return { estado: 'Completada', razon: 'El avance registrado alcanza el 100 %.', vacia: false }
  }
  if (fechaCorte > fin) {
    return {
      estado: 'Retrasada',
      razon: `La fecha de corte (${fechaCorte}) supera la fecha fin (${fin}) y el avance es ${avance} %.`,
      vacia: false,
    }
  }
  if (fechaCorte >= inicio) {
    return {
      estado: 'En curso',
      razon: `La fecha de corte esta dentro de la ventana de ejecucion (${inicio} a ${fin}).`,
      vacia: false,
    }
  }
  return {
    estado: 'Pendiente',
    razon: `La actividad inicia el ${inicio}, posterior a la fecha de corte.`,
    vacia: false,
  }
}

// ---------------------------------------------------------------------------
// RN-02 · Duracion de la actividad
// ---------------------------------------------------------------------------

/**
 * saneado        : dias habiles reales en [inicio, fin], sin sabados, domingos ni festivos.
 * compatibilidad : fin - inicio - 2 (el calculo real del libro, pese al rotulo "Dias Habiles").
 * En ambos casos el minimo es 1 dia para una actividad valida: una duracion
 * cero o negativa distorsionaria el denominador del avance ponderado.
 */
export function duracionActividad(
  inicio: ISODate | null,
  fin: ISODate | null,
  ctx: ContextoCalculo,
): number {
  if (!esISODate(inicio ?? '') || !esISODate(fin ?? '')) return 0
  const i = inicio as ISODate
  const f = fin as ISODate
  if (f < i) return 0

  if (ctx.modo === 'compatibilidad') {
    return diffDias(i, f) - 2
  }
  return Math.max(1, ctx.calendario.diasHabiles(i, f))
}

export function duracionCalendario(inicio: ISODate | null, fin: ISODate | null): number {
  if (!esISODate(inicio ?? '') || !esISODate(fin ?? '')) return 0
  return diffDias(inicio as ISODate, fin as ISODate) + 1
}

// ---------------------------------------------------------------------------
// Calculo de todas las actividades
// ---------------------------------------------------------------------------

export function calcularActividades(
  actividades: Actividad[],
  ctx: ContextoCalculo,
): ActividadCalculada[] {
  const base = actividades.map((act): ActividadCalculada => {
    const { estado, razon, vacia } = estadoActividad(act, ctx.fechaCorte)
    const duracion = duracionActividad(act.fechaInicio, act.fechaFin, ctx)
    const esperado = avanceEsperadoActividad(act, duracion, ctx)
    return {
      ...act,
      vacia,
      duracion,
      duracionCalendario: duracionCalendario(act.fechaInicio, act.fechaFin),
      estado,
      razonEstado: razon,
      avanceEsperado: redondear(esperado),
      desviacion: redondear((Number(act.avance) || 0) - esperado),
      holgura: null,
      esCritica: false,
    }
  })

  return aplicarRutaCritica(base, ctx)
}

/**
 * Fraccion de avance que la programacion esperaba de UNA actividad a la fecha
 * de corte, expresada en porcentaje. Es el insumo homogeneo de RN-05 saneada.
 */
function avanceEsperadoActividad(
  act: Actividad,
  duracion: number,
  ctx: ContextoCalculo,
): number {
  if (!esISODate(act.fechaInicio ?? '') || !esISODate(act.fechaFin ?? '')) return 0
  const inicio = act.fechaInicio as ISODate
  const fin = act.fechaFin as ISODate
  const corte = ctx.fechaCorte

  if (corte >= fin) return 100
  if (corte < inicio) return 0
  if (duracion <= 0) return 0

  const transcurrido =
    ctx.modo === 'compatibilidad'
      ? diffDias(inicio, corte) + 1
      : ctx.calendario.diasHabiles(inicio, corte)
  return Math.min(100, Math.max(0, (transcurrido / duracion) * 100))
}

// ---------------------------------------------------------------------------
// RN-03 · Avance simple
// ---------------------------------------------------------------------------

/** Promedio del % de avance de las actividades NO vacias. */
export function avanceSimple(acts: ActividadCalculada[]): number {
  const vigentes = acts.filter((a) => !a.vacia)
  if (vigentes.length === 0) return 0
  const suma = vigentes.reduce((s, a) => s + (Number(a.avance) || 0), 0)
  return redondear(suma / vigentes.length)
}

// ---------------------------------------------------------------------------
// RN-04 · Avance global ponderado por duracion
// ---------------------------------------------------------------------------

export function avancePonderado(acts: ActividadCalculada[]): number {
  const vigentes = acts.filter((a) => !a.vacia && a.duracion > 0)
  const denominador = vigentes.reduce((s, a) => s + a.duracion, 0)
  if (denominador === 0) return 0
  const numerador = vigentes.reduce((s, a) => s + a.duracion * (Number(a.avance) || 0), 0)
  return redondear(numerador / denominador)
}

// ---------------------------------------------------------------------------
// RN-05 · Avance esperado a la fecha de corte
// ---------------------------------------------------------------------------

/**
 * saneado: numerador y denominador en la MISMA unidad de duracion.
 *   - actividad vencida (corte >= fin)  -> aporta su duracion completa
 *   - actividad en curso                -> aporta la fraccion de duracion transcurrida
 * compatibilidad: reproduce la mezcla de unidades del libro (D-02).
 */
export function avanceEsperado(acts: ActividadCalculada[], ctx: ContextoCalculo): number {
  const vigentes = acts.filter((a) => !a.vacia && a.duracion > 0)
  const denominador = vigentes.reduce((s, a) => s + a.duracion, 0)
  if (denominador === 0) return 0

  let numerador = 0
  for (const a of vigentes) {
    const inicio = a.fechaInicio as ISODate
    const fin = a.fechaFin as ISODate

    if (ctx.fechaCorte >= fin) {
      numerador += a.duracion
    } else if (ctx.fechaCorte >= inicio) {
      numerador +=
        ctx.modo === 'compatibilidad'
          ? diffDias(inicio, ctx.fechaCorte) + 1 // dias calendario: la mezcla heredada
          : a.duracion * (a.avanceEsperado / 100)
    }
  }
  return redondear((numerador / denominador) * 100)
}

// ---------------------------------------------------------------------------
// RN-06 · Desviacion del avance y semaforo
// ---------------------------------------------------------------------------

export type NivelDesviacion = 'ATENCION' | 'Precaucion' | 'En linea'

export interface Desviacion {
  puntos: number
  nivel: NivelDesviacion
  mensaje: string
}

/** Los dos umbrales provienen de parametros configurables, no de literales (D-03). */
export function desviacionAvance(
  ponderado: number,
  esperado: number,
  parametros: Parametros,
): Desviacion {
  const puntos = redondear(ponderado - esperado)
  if (puntos < -Math.abs(parametros.umbralAtencion)) {
    return {
      puntos,
      nivel: 'ATENCION',
      mensaje: `El avance esta ${Math.abs(puntos)} puntos por debajo de lo programado (umbral de atencion: ${parametros.umbralAtencion}).`,
    }
  }
  if (puntos < -Math.abs(parametros.umbralPrecaucion)) {
    return {
      puntos,
      nivel: 'Precaucion',
      mensaje: `El avance esta ${Math.abs(puntos)} puntos por debajo de lo programado (umbral de precaucion: ${parametros.umbralPrecaucion}).`,
    }
  }
  return {
    puntos,
    nivel: 'En linea',
    mensaje:
      puntos >= 0
        ? `El avance supera lo programado en ${puntos} puntos.`
        : `Desviacion de ${puntos} puntos, dentro de la tolerancia.`,
  }
}

// ---------------------------------------------------------------------------
// RN-07 · Actividades retrasadas · RN-08 · Distribucion por estado
// ---------------------------------------------------------------------------

export function actividadesRetrasadas(acts: ActividadCalculada[]): ActividadCalculada[] {
  return acts.filter((a) => a.estado === 'Retrasada')
}

export interface DistribucionEstado {
  estado: EstadoActividad
  conteo: number
  porcentaje: number
}

export function distribucionPorEstado(acts: ActividadCalculada[]): DistribucionEstado[] {
  const vigentes = acts.filter((a) => !a.vacia)
  const total = vigentes.length
  const estados: EstadoActividad[] = ['Pendiente', 'En curso', 'Completada', 'Retrasada']
  return estados.map((estado) => {
    const conteo = vigentes.filter((a) => a.estado === estado).length
    return { estado, conteo, porcentaje: total === 0 ? 0 : redondear((conteo / total) * 100) }
  })
}

// ---------------------------------------------------------------------------
// RN-09 · Avance por fase
// ---------------------------------------------------------------------------

export interface AvanceFase {
  faseId: string
  nombre: string
  actividades: number
  avance: number
  avanceEsperado: number
  completadas: number
  retrasadas: number
}

/**
 * La lista de fases proviene del catalogo del proyecto (fuente unica), nunca de
 * rotulos escritos a mano en el tablero (D-08). Se ponderan por duracion, en
 * coherencia con RN-04.
 */
export function avancePorFase(
  acts: ActividadCalculada[],
  fases: { id: string; nombre: string; orden: number }[],
): AvanceFase[] {
  return [...fases]
    .sort((a, b) => a.orden - b.orden)
    .map((fase) => {
      const propias = acts.filter((a) => !a.vacia && a.faseId === fase.id)
      const denom = propias.reduce((s, a) => s + a.duracion, 0)
      const avance =
        denom === 0 ? 0 : propias.reduce((s, a) => s + a.duracion * a.avance, 0) / denom
      const esperado =
        denom === 0 ? 0 : propias.reduce((s, a) => s + a.duracion * a.avanceEsperado, 0) / denom
      return {
        faseId: fase.id,
        nombre: fase.nombre,
        actividades: propias.length,
        avance: redondear(avance),
        avanceEsperado: redondear(esperado),
        completadas: propias.filter((a) => a.estado === 'Completada').length,
        retrasadas: propias.filter((a) => a.estado === 'Retrasada').length,
      }
    })
}

// ---------------------------------------------------------------------------
// RN-10 · Proximidad de la entrega final
// ---------------------------------------------------------------------------

export interface AlertaEntrega {
  diasRestantes: number
  activa: boolean
  vencida: boolean
  mensaje: string
}

/** Usa la fecha de la Ficha y la ventana del catalogo de parametros (corrige D-03). */
export function proximidadEntrega(ctx: ContextoCalculo): AlertaEntrega {
  const dias = diffDias(ctx.fechaCorte, ctx.fechaEntregaFinal)
  const ventana = ctx.parametros.ventanaAlertaDias
  if (dias < 0) {
    return {
      diasRestantes: dias,
      activa: true,
      vencida: true,
      mensaje: `La fecha de entrega final se venció hace ${Math.abs(dias)} dias.`,
    }
  }
  if (dias <= ventana) {
    return {
      diasRestantes: dias,
      activa: true,
      vencida: false,
      mensaje: `Faltan ${dias} dias para la entrega final (ventana de alerta: ${ventana} dias).`,
    }
  }
  return {
    diasRestantes: dias,
    activa: false,
    vencida: false,
    mensaje: `Faltan ${dias} dias para la entrega final.`,
  }
}

// ---------------------------------------------------------------------------
// RN-11 · Solape para la barra de Gantt
// ---------------------------------------------------------------------------

/** Una actividad ocupa un periodo si inicio <= finPeriodo y fin >= inicioPeriodo. */
export function solapaPeriodo(
  inicioAct: ISODate | null,
  finAct: ISODate | null,
  inicioPeriodo: ISODate,
  finPeriodo: ISODate,
): boolean {
  if (!esISODate(inicioAct ?? '') || !esISODate(finAct ?? '')) return false
  return (inicioAct as ISODate) <= finPeriodo && (finAct as ISODate) >= inicioPeriodo
}

// ---------------------------------------------------------------------------
// RN-12 / RN-13 · Severidad y nivel del riesgo
// ---------------------------------------------------------------------------

export function severidadRiesgo(probabilidad: number | null, impacto: number | null): number | null {
  if (probabilidad == null || impacto == null) return null
  if (!Number.isFinite(probabilidad) || !Number.isFinite(impacto)) return null
  return probabilidad * impacto
}

/** Cortes exactos del instructivo: <=4 Bajo, <=9 Medio, <=14 Alto, resto Critico. */
export function nivelRiesgo(severidad: number | null): NivelRiesgo | null {
  if (severidad == null) return null
  if (severidad <= 4) return 'Bajo'
  if (severidad <= 9) return 'Medio'
  if (severidad <= 14) return 'Alto'
  return 'Critico'
}

export function calcularRiesgos(riesgos: Riesgo[]): RiesgoCalculado[] {
  return riesgos.map((r) => {
    const severidad = severidadRiesgo(r.probabilidad, r.impacto)
    const activo = r.estado !== 'Cerrado'
    return {
      ...r,
      severidad,
      nivel: nivelRiesgo(severidad),
      // HG-090: un riesgo activo sin valoracion completa es una brecha de integridad.
      incompleto: activo && (r.probabilidad == null || r.impacto == null),
    }
  })
}

/** Matriz 5x5 probabilidad x impacto para el mapa de calor (HG-087). */
export function mapaCalorRiesgos(riesgos: RiesgoCalculado[]): number[][] {
  const matriz: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0))
  for (const r of riesgos) {
    if (r.estado === 'Cerrado') continue
    if (r.probabilidad == null || r.impacto == null) continue
    const p = Math.min(5, Math.max(1, Math.round(r.probabilidad)))
    const i = Math.min(5, Math.max(1, Math.round(r.impacto)))
    matriz[5 - p][i - 1] += 1
  }
  return matriz
}

// ---------------------------------------------------------------------------
// RN-14 · Integridad RACI
// ---------------------------------------------------------------------------

/**
 * Exactamente una "A" por actividad. La alerta se aplica sobre el propio
 * conteo, no sobre la columna contigua (corrige D-13).
 */
export function integridadRaci(
  actividades: Actividad[],
  asignaciones: AsignacionRaci[],
): IntegridadRaci[] {
  return actividades
    .filter((a) => a.nombre?.trim())
    .map((act) => {
      const propias = asignaciones.filter((x) => x.actividadId === act.id && !x.eliminado)
      const conteoA = propias.filter((x) => x.letra === 'A').length
      const conteoR = propias.filter((x) => x.letra === 'R').length
      let problema = ''
      if (conteoA === 0) problema = 'Sin responsable final (A) asignado.'
      else if (conteoA > 1) problema = `Hay ${conteoA} responsables finales (A); debe haber exactamente uno.`
      else if (conteoR === 0) problema = 'Sin ejecutor (R) asignado.'
      return {
        actividadId: act.id,
        actividadNombre: act.nombre,
        conteoA,
        conteoR,
        conforme: conteoA === 1 && conteoR >= 1,
        problema,
      }
    })
}

// ---------------------------------------------------------------------------
// RN-16 · Hitos · D-06 · D-07 (vocabulario unico de cinco estados)
// ---------------------------------------------------------------------------

export function calcularHitos(
  hitos: Hito[],
  ctx: ContextoCalculo,
  idsCriticos: Set<string> = new Set(),
): HitoCalculado[] {
  return hitos.map((h) => {
    const desviacionDias =
      h.fechaReal && h.fechaProgramada ? diffDias(h.fechaProgramada, h.fechaReal) : null
    const cumplido = h.estado === 'Cumplido' || h.estado === 'Cumplido con retraso'
    const vencido =
      !cumplido &&
      h.estado !== 'No cumplido' &&
      !!h.fechaProgramada &&
      ctx.fechaCorte > h.fechaProgramada
    const diasParaVencer = h.fechaProgramada ? diffDias(ctx.fechaCorte, h.fechaProgramada) : null
    return {
      ...h,
      cumplido,
      desviacionDias,
      vencido,
      diasParaVencer,
      enRutaCritica: h.actividadesIds.some((id) => idsCriticos.has(id)),
    }
  })
}

// ---------------------------------------------------------------------------
// RN-17 · Holgura y ruta critica (CPM sobre las dependencias declaradas)
// ---------------------------------------------------------------------------

/**
 * Metodo de la ruta critica en dias habiles.
 * Cuando una actividad no declara predecesoras, su inicio temprano es su fecha
 * de inicio programada; el algoritmo no reprograma el cronograma, calcula la
 * holgura respecto de la programacion vigente.
 * Si el grafo tiene ciclos, se detectan y esas actividades quedan sin holgura
 * en lugar de colgar el calculo.
 */
export function aplicarRutaCritica(
  acts: ActividadCalculada[],
  ctx: ContextoCalculo,
): ActividadCalculada[] {
  const porId = new Map(acts.map((a) => [a.id, a]))
  const validas = acts.filter((a) => !a.vacia)
  if (validas.length === 0) return acts

  // --- Orden topologico (Kahn) sobre predecesoras vigentes ---
  const preds = new Map<string, string[]>()
  const sucs = new Map<string, string[]>()
  for (const a of validas) {
    const p = (a.predecesoras ?? []).filter((id) => porId.has(id) && !porId.get(id)!.vacia)
    preds.set(a.id, p)
    for (const id of p) sucs.set(id, [...(sucs.get(id) ?? []), a.id])
  }

  const gradoEntrada = new Map<string, number>()
  validas.forEach((a) => gradoEntrada.set(a.id, preds.get(a.id)!.length))
  const cola = validas.filter((a) => gradoEntrada.get(a.id) === 0).map((a) => a.id)
  const orden: string[] = []
  while (cola.length) {
    const id = cola.shift()!
    orden.push(id)
    for (const s of sucs.get(id) ?? []) {
      const g = (gradoEntrada.get(s) ?? 1) - 1
      gradoEntrada.set(s, g)
      if (g === 0) cola.push(s)
    }
  }
  const hayCiclo = orden.length !== validas.length

  // --- Pase hacia adelante: inicio y fin tempranos, en dias habiles absolutos ---
  const cal = ctx.calendario
  const origen = validas.reduce<ISODate>(
    (min, a) => minISO(min, a.fechaInicio as ISODate),
    validas[0].fechaInicio as ISODate,
  )
  // Indice habil de una fecha respecto del origen del proyecto.
  const indice = (iso: ISODate): number => cal.diasHabiles(origen, iso)

  const esTemprano = new Map<string, number>()
  const efTemprano = new Map<string, number>()

  for (const id of orden) {
    const a = porId.get(id)!
    const propioES = indice(a.fechaInicio as ISODate)
    const porPreds = (preds.get(id) ?? []).map((p) => (efTemprano.get(p) ?? 0) + 1)
    const es = Math.max(propioES, ...(porPreds.length ? porPreds : [propioES]))
    esTemprano.set(id, es)
    efTemprano.set(id, es + Math.max(1, a.duracion) - 1)
  }

  const finProyecto = Math.max(...validas.map((a) => efTemprano.get(a.id) ?? indice(a.fechaFin as ISODate)))

  // --- Pase hacia atras: inicio y fin tardios ---
  const lfTardio = new Map<string, number>()
  const lsTardio = new Map<string, number>()
  for (const id of [...orden].reverse()) {
    const a = porId.get(id)!
    const susSucs = sucs.get(id) ?? []
    const lf = susSucs.length
      ? Math.min(...susSucs.map((s) => (lsTardio.get(s) ?? finProyecto) - 1))
      : finProyecto
    lfTardio.set(id, lf)
    lsTardio.set(id, lf - Math.max(1, a.duracion) + 1)
  }

  return acts.map((a) => {
    if (a.vacia || hayCiclo || !orden.includes(a.id)) {
      return { ...a, holgura: null, esCritica: false }
    }
    const holgura = (lsTardio.get(a.id) ?? 0) - (esTemprano.get(a.id) ?? 0)
    return { ...a, holgura, esCritica: holgura <= 0 }
  })
}

/** Advertencia de ciclos en las dependencias, para mostrarla en la interfaz. */
export function detectarCiclos(acts: Actividad[]): string[][] {
  const porId = new Map(acts.map((a) => [a.id, a]))
  const estado = new Map<string, 0 | 1 | 2>()
  const ciclos: string[][] = []
  const pila: string[] = []

  const visitar = (id: string) => {
    const e = estado.get(id) ?? 0
    if (e === 1) {
      const desde = pila.indexOf(id)
      if (desde >= 0) ciclos.push(pila.slice(desde).concat(id))
      return
    }
    if (e === 2) return
    estado.set(id, 1)
    pila.push(id)
    for (const p of porId.get(id)?.predecesoras ?? []) {
      if (porId.has(p)) visitar(p)
    }
    pila.pop()
    estado.set(id, 2)
  }

  acts.forEach((a) => visitar(a.id))
  return ciclos
}

// ---------------------------------------------------------------------------
// RN-18 / RN-19 · Recursos y equipo
// ---------------------------------------------------------------------------

export interface ResumenRecursos {
  total: number
  porGestionar: number
  disponibles: number
  reservados: number
  noDisponibles: number
  porTipo: Record<string, number>
}

/** Conteo sobre la lista controlada unica; no admite valores fuera de ella (D-09). */
export function resumenRecursos(recursos: Recurso[]): ResumenRecursos {
  const vigentes = recursos.filter((r) => !r.eliminado)
  const cuenta = (d: DisponibilidadRecurso) =>
    vigentes.filter((r) => r.disponibilidad === d).length
  const porTipo: Record<string, number> = {}
  for (const r of vigentes) porTipo[r.tipo] = (porTipo[r.tipo] ?? 0) + 1
  return {
    total: vigentes.length,
    porGestionar: cuenta('Por gestionar'),
    disponibles: cuenta('Disponible'),
    reservados: cuenta('Reservado'),
    noDisponibles: cuenta('No disponible'),
    porTipo,
  }
}

export interface ResumenEquipo {
  total: number
  porDefinir: number
  contratados: number
  dedicacionTotalHorasMes: number
  porEstado: Record<string, number>
}

export function resumenEquipo(equipo: MiembroEquipo[]): ResumenEquipo {
  const vigentes = equipo.filter((m) => !m.eliminado)
  const porEstado: Record<string, number> = {}
  for (const m of vigentes) porEstado[m.estadoVinculacion] = (porEstado[m.estadoVinculacion] ?? 0) + 1
  return {
    total: vigentes.length,
    porDefinir: porEstado['Por definir'] ?? 0,
    contratados: porEstado['Contratado'] ?? 0,
    dedicacionTotalHorasMes: redondear(
      vigentes.reduce((s, m) => s + (Number(m.dedicacionHorasMes) || 0), 0),
    ),
    porEstado,
  }
}

// ---------------------------------------------------------------------------
// RN-21 · Satisfaccion · RN-22 · Presupuesto · RN-23 · Productos
// ---------------------------------------------------------------------------

/** Indice por medicion, con control de division por cero. */
export function indiceSatisfaccion(m: Pick<MedicionSatisfaccion, 'encuestados' | 'satisfechos'>): number | null {
  const enc = Number(m.encuestados) || 0
  if (enc <= 0) return null
  return redondear((Number(m.satisfechos) / enc) * 100)
}

export interface DesviacionPresupuestal {
  valor: number
  porcentaje: number | null
}

export function desviacionPresupuestal(
  r: Pick<RegistroPresupuestal, 'programado' | 'ejecutado'>,
): DesviacionPresupuestal {
  const prog = Number(r.programado) || 0
  const ejec = Number(r.ejecutado) || 0
  return {
    valor: redondear(ejec - prog),
    porcentaje: prog === 0 ? null : redondear(((ejec - prog) / prog) * 100),
  }
}

/** Campos booleanos: la conformidad no depende de la ortografia del texto (D-15). */
export function esProductoConforme(p: Producto): boolean {
  return p.evaluado === true && p.conforme === true
}

// ---------------------------------------------------------------------------
// RN-24 / RN-25 · Estado del indicador
// ---------------------------------------------------------------------------

export function estadoIndicador(
  valor: number | null,
  meta: number,
  sentido: SentidoIndicador,
  factorMayor = 0.9,
  factorMenor = 2,
): EstadoIndicador {
  if (valor == null || !Number.isFinite(valor)) return 'Sin datos'
  if (sentido === 'Mayor es mejor') {
    if (valor >= meta) return 'Cumple'
    if (valor >= meta * factorMayor) return 'Atencion'
    return 'Critico'
  }
  if (valor <= meta) return 'Cumple'
  // Con meta 0 la banda multiplicativa colapsa: se usa una tolerancia absoluta.
  const limiteAtencion = meta === 0 ? factorMenor : meta * factorMenor
  if (valor <= limiteAtencion) return 'Atencion'
  return 'Critico'
}

// ---------------------------------------------------------------------------
// RN-27 / RN-28 · Validaciones de captura
// ---------------------------------------------------------------------------

export interface ProblemaValidacion {
  campo: string
  mensaje: string
  bloqueante: boolean
}

export function validarAvance(avance: unknown): ProblemaValidacion | null {
  const n = Number(avance)
  if (!Number.isFinite(n)) {
    return { campo: 'avance', mensaje: 'El avance debe ser un numero.', bloqueante: true }
  }
  if (n < 0 || n > 100) {
    return { campo: 'avance', mensaje: 'El avance debe estar entre 0 % y 100 %.', bloqueante: true }
  }
  return null
}

/** Bloquea fin < inicio; advierte cuando la actividad sale de la vigencia del proyecto. */
export function validarFechasActividad(
  inicio: ISODate | null,
  fin: ISODate | null,
  vigencia: { inicio: ISODate; fin: ISODate },
): ProblemaValidacion[] {
  const out: ProblemaValidacion[] = []
  if (!inicio || !fin) {
    out.push({
      campo: 'fechas',
      mensaje: 'La actividad requiere fecha de inicio y fecha de fin.',
      bloqueante: true,
    })
    return out
  }
  if (fin < inicio) {
    out.push({
      campo: 'fechaFin',
      mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
      bloqueante: true,
    })
  }
  if (inicio < vigencia.inicio || fin > vigencia.fin) {
    out.push({
      campo: 'fechas',
      mensaje: `La actividad se sale de la vigencia del proyecto (${vigencia.inicio} a ${vigencia.fin}).`,
      bloqueante: false,
    })
  }
  return out
}

export function validarRiesgo(r: Pick<Riesgo, 'probabilidad' | 'impacto'>): ProblemaValidacion[] {
  const out: ProblemaValidacion[] = []
  for (const [campo, v] of [
    ['probabilidad', r.probabilidad],
    ['impacto', r.impacto],
  ] as const) {
    if (v == null) continue
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      out.push({ campo, mensaje: `La ${campo} debe ser un entero entre 1 y 5.`, bloqueante: true })
    }
  }
  return out
}

export function validarSatisfaccion(
  m: Pick<MedicionSatisfaccion, 'encuestados' | 'satisfechos'>,
): ProblemaValidacion[] {
  const out: ProblemaValidacion[] = []
  if (m.encuestados < 0 || m.satisfechos < 0) {
    out.push({ campo: 'encuestados', mensaje: 'Los conteos no pueden ser negativos.', bloqueante: true })
  }
  if (m.satisfechos > m.encuestados) {
    out.push({
      campo: 'satisfechos',
      mensaje: 'Los satisfechos no pueden superar a los encuestados.',
      bloqueante: true,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Resumen consolidado del proyecto (insumo del tablero y los dashboards)
// ---------------------------------------------------------------------------

export interface ResumenProyecto {
  ctx: ContextoCalculo
  actividades: ActividadCalculada[]
  hitos: HitoCalculado[]
  riesgos: RiesgoCalculado[]
  avanceSimple: number
  avancePonderado: number
  avanceEsperado: number
  desviacion: Desviacion
  distribucion: DistribucionEstado[]
  porFase: AvanceFase[]
  retrasadas: ActividadCalculada[]
  entrega: AlertaEntrega
  recursos: ResumenRecursos
  equipo: ResumenEquipo
  raci: IntegridadRaci[]
  ciclos: string[][]
  diasRestantes: number
}

export function resumirProyecto(datos: DatosProyecto, parametros: Parametros): ResumenProyecto {
  const { proyecto } = datos
  const ctx = crearContexto(
    proyecto.fechaCorte,
    proyecto.fechaEntregaFinal,
    proyecto.modoCalculo,
    parametros,
  )

  const actividades = calcularActividades(
    datos.actividades.filter((a) => !a.eliminado),
    ctx,
  )
  const idsCriticos = new Set(actividades.filter((a) => a.esCritica).map((a) => a.id))
  const hitos = calcularHitos(datos.hitos.filter((h) => !h.eliminado), ctx, idsCriticos)
  const riesgos = calcularRiesgos(datos.riesgos.filter((r) => !r.eliminado))

  const ponderado = avancePonderado(actividades)
  const esperado = avanceEsperado(actividades, ctx)

  return {
    ctx,
    actividades,
    hitos,
    riesgos,
    avanceSimple: avanceSimple(actividades),
    avancePonderado: ponderado,
    avanceEsperado: esperado,
    desviacion: desviacionAvance(ponderado, esperado, parametros),
    distribucion: distribucionPorEstado(actividades),
    porFase: avancePorFase(actividades, proyecto.fases.filter((f) => f.activa)),
    retrasadas: actividadesRetrasadas(actividades),
    entrega: proximidadEntrega(ctx),
    recursos: resumenRecursos(datos.recursos),
    equipo: resumenEquipo(datos.equipo),
    raci: integridadRaci(
      datos.actividades.filter((a) => !a.eliminado),
      datos.raci,
    ),
    ciclos: detectarCiclos(datos.actividades.filter((a) => !a.eliminado)),
    diasRestantes: diffDias(proyecto.fechaCorte, proyecto.fechaEntregaFinal),
  }
}

// Reexportes utiles para consumidores del motor.
export { aISO, aFecha, sumarDias, maxISO, minISO, diffDias, redondear }
