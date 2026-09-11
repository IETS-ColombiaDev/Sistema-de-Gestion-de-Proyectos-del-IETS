/**
 * Motor de Valor Ganado (Earned Value Management).
 *
 * Es la pieza que convierte dos datos sueltos —"avance 53 %" y "ejecutado
 * $265 M"— en una decision. El avance por si solo no dice si el proyecto es
 * viable; el gasto por si solo tampoco. La pregunta gerencial real es:
 * *con el trabajo que llevo hecho, ¿lo que he gastado es razonable, y con que
 * cifra voy a cerrar?* Eso es exactamente lo que responde el valor ganado.
 *
 * Las tres magnitudes, todas en dinero y por tanto comparables entre si:
 *
 *   VP  Valor planeado    lo que el cronograma decia que estaria hecho
 *   VG  Valor ganado      lo que efectivamente esta hecho
 *   CR  Costo real        lo que se ha gastado para lograrlo
 *
 * De ahi salen las dos unicas preguntas que importan:
 *
 *   ¿voy a tiempo?   VG − VP  (y su indice VG/VP)
 *   ¿voy en costo?   VG − CR  (y su indice VG/CR)
 *
 * Y la proyeccion, que es lo que se lleva al comite: si el desempeno de costo
 * se mantiene, el proyecto cierra en VP_final / indice de costo. La diferencia
 * contra el presupuesto aprobado es el sobrecosto que hay que decidir hoy, no
 * el que se descubre al final.
 *
 * Nomenclatura en espanol por decision de producto: quien lee estos tableros
 * es la direccion del instituto, no un gerente de proyecto certificado. Los
 * acronimos ingleses (PV, EV, AC, SPI, CPI, EAC) se conservan en los
 * comentarios y en la ficha tecnica de cada indicador para trazabilidad con la
 * literatura.
 */

import { diffDias } from './fechas'
import { avancePlaneadoEnFecha, type ContextoCalculo, type ResumenProyecto } from './reglas'
import { periodosEntre, vistaCostos, type VistaCostos } from './costos'
import type { DatosProyecto, ISODate, Snapshot } from './types'

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
const r0 = (n: number): number => Math.round(n)

// ---------------------------------------------------------------------------
// Diagnostico
// ---------------------------------------------------------------------------

export type CuadranteEvm =
  | 'en-linea'
  | 'atrasado'
  | 'sobrecosto'
  | 'critico'
  | 'sin-datos'

export interface Diagnostico {
  cuadrante: CuadranteEvm
  titulo: string
  /** Frase que un directivo puede leer y actuar sobre ella. */
  veredicto: string
  /** La decision concreta que el tablero sugiere poner sobre la mesa. */
  decision: string
  severidad: 'bueno' | 'atencion' | 'serio' | 'critico' | 'neutro'
}

export interface Evm {
  /** Presupuesto aprobado al cierre (BAC). */
  presupuestoTotal: number
  /** Valor planeado a la fecha de corte (PV). */
  valorPlaneado: number
  /** Valor ganado a la fecha de corte (EV). */
  valorGanado: number
  /** Costo real acumulado (AC). */
  costoReal: number

  /** VG − VP. Positivo: adelantado. (SV) */
  variacionCronograma: number
  /** VG − CR. Positivo: por debajo de lo que costaria. (CV) */
  variacionCosto: number
  /** VG / VP. 1 es estar al dia. (SPI) */
  indiceCronograma: number | null
  /** VG / CR. 1 es gastar lo que vale el trabajo hecho. (CPI) */
  indiceCosto: number | null

  /** Proyeccion al cierre manteniendo el desempeno de costo actual. (EAC) */
  proyeccionCierre: number | null
  /** Lo que falta gastar segun la proyeccion. (ETC) */
  faltaPorGastar: number | null
  /** Presupuesto − proyeccion. Negativo: sobrecosto proyectado. (VAC) */
  variacionAlCierre: number | null
  /**
   * Proyeccion optimista: supone que de aqui al final se gasta exactamente lo
   * presupuestado y no se arrastra la ineficiencia. Es el mejor caso creible.
   */
  proyeccionOptimista: number | null
  /**
   * Eficiencia de costo que habria que sostener en el trabajo restante para
   * cerrar dentro del presupuesto. (TCPI) Por encima de ~1,1 es, en la
   * practica, inalcanzable: ahi la decision deja de ser "apretar" y pasa a ser
   * "replanificar o pedir mas presupuesto".
   */
  eficienciaRequerida: number | null

  /** Porcentaje del presupuesto ya gastado. */
  consumoPresupuesto: number
  /** Porcentaje de trabajo completado, en dinero. */
  avanceEnDinero: number

  diagnostico: Diagnostico
  /** Advertencias sobre la calidad del insumo, para no decidir sobre arena. */
  salvedades: string[]
}

/**
 * Umbrales de tolerancia de los indices.
 * 0,95 y 0,90 son los cortes de uso corriente en gestion de proyectos y
 * coinciden con la banda de "Atencion" del catalogo de indicadores.
 */
const TOLERANCIA = { atencion: 0.95, serio: 0.9 } as const

function diagnosticar(
  ic: number | null,
  icr: number | null,
  variacionAlCierre: number | null,
  eficienciaRequerida: number | null,
  moneda: (n: number) => string,
): Diagnostico {
  if (ic == null || icr == null) {
    return {
      cuadrante: 'sin-datos',
      titulo: 'Sin datos suficientes para el valor ganado',
      veredicto:
        'Falta presupuesto aprobado, registros de costo o cronograma para calcular valor planeado, valor ganado y costo real.',
      decision:
        'Completar el presupuesto total en la ficha y registrar el control presupuestal del periodo.',
      severidad: 'neutro',
    }
  }

  const aTiempo = ic >= TOLERANCIA.atencion
  const enCosto = icr >= TOLERANCIA.atencion
  const sobrecosto = variacionAlCierre != null && variacionAlCierre < 0
  const cifraSobrecosto = sobrecosto ? moneda(Math.abs(variacionAlCierre)) : ''
  const inalcanzable = eficienciaRequerida != null && eficienciaRequerida > 1.1

  if (aTiempo && enCosto) {
    return {
      cuadrante: 'en-linea',
      titulo: 'En linea, en tiempo y en costo',
      veredicto: `El trabajo hecho corresponde a lo programado y su costo es proporcional. Indice de cronograma ${ic.toFixed(2)}, indice de costo ${icr.toFixed(2)}.`,
      decision: 'Mantener el plan. El seguimiento puede volver a periodicidad normal.',
      severidad: 'bueno',
    }
  }

  if (!aTiempo && enCosto) {
    return {
      cuadrante: 'atrasado',
      titulo: 'Atrasado, pero el gasto acompana al trabajo',
      veredicto: `Se ha hecho menos de lo programado (indice de cronograma ${ic.toFixed(2)}), aunque lo hecho no ha costado mas de lo que vale (indice de costo ${icr.toFixed(2)}). El problema es de ritmo, no de precio.`,
      decision:
        'Decidir entre reforzar capacidad en la ruta critica o mover la fecha de entrega. Reforzar capacidad tiene costo: el indice de costo se deteriorara.',
      severidad: 'atencion',
    }
  }

  if (aTiempo && !enCosto) {
    return {
      cuadrante: 'sobrecosto',
      titulo: 'Al dia en cronograma, por encima en costo',
      veredicto: `El avance responde al plan, pero cada unidad de trabajo esta costando mas de lo previsto (indice de costo ${icr.toFixed(2)}).${sobrecosto ? ` De sostenerse, el cierre excede el presupuesto en ${cifraSobrecosto}.` : ''}`,
      decision: sobrecosto
        ? `Revisar los rubros que concentran el gasto y decidir: recorte de alcance, renegociacion, o presupuesto adicional por ${cifraSobrecosto}.`
        : 'Revisar los rubros que concentran el gasto antes de que la desviacion se vuelva estructural.',
      severidad: 'serio',
    }
  }

  return {
    cuadrante: 'critico',
    titulo: 'Atrasado y por encima del costo',
    veredicto: `Se ha hecho menos de lo programado y lo hecho ha costado mas de lo que vale (cronograma ${ic.toFixed(2)}, costo ${icr.toFixed(2)}).${sobrecosto ? ` La proyeccion al cierre excede el presupuesto en ${cifraSobrecosto}.` : ''}`,
    decision: inalcanzable
      ? `Recuperar el presupuesto exigiria una eficiencia de ${eficienciaRequerida!.toFixed(2)} en el trabajo restante, que no es alcanzable. La decision es replanificar alcance o aprobar presupuesto adicional, no apretar la ejecucion.`
      : 'Replanificar alcance, cronograma y presupuesto en conjunto. Ajustar solo uno de los tres no cierra la brecha.',
    severidad: 'critico',
  }
}

// ---------------------------------------------------------------------------
// Calculo puntual a la fecha de corte
// ---------------------------------------------------------------------------

export interface OpcionesEvm {
  /** Formateador de moneda para redactar el veredicto. */
  moneda?: (n: number) => string
}

export function calcularEvm(
  datos: DatosProyecto,
  resumen: ResumenProyecto,
  costos: VistaCostos,
  opciones: OpcionesEvm = {},
): Evm {
  const moneda = opciones.moneda ?? ((n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`)
  const salvedades: string[] = []

  // Presupuesto al cierre: el aprobado en la ficha; si no hay, el programado
  // acumulado del libro, que es lo mejor disponible.
  const presupuestoTotal =
    datos.proyecto.presupuestoTotal && datos.proyecto.presupuestoTotal > 0
      ? datos.proyecto.presupuestoTotal
      : costos.programadoTotal

  if (!datos.proyecto.presupuestoTotal || datos.proyecto.presupuestoTotal <= 0) {
    salvedades.push(
      'El proyecto no tiene presupuesto total en la ficha: se usa el programado acumulado del control presupuestal, que solo cubre los periodos ya registrados.',
    )
  }

  const valorPlaneado = r0((presupuestoTotal * resumen.avanceEsperado) / 100)
  const valorGanado = r0((presupuestoTotal * resumen.avancePonderado) / 100)
  const costoReal = r0(costos.ejecutadoTotal)

  if (costoReal === 0) {
    salvedades.push(
      'No hay costo real registrado: el indice de costo y la proyeccion al cierre no se pueden calcular.',
    )
  }
  if (costos.comprometidoTotal === 0 && costos.origen === 'interno') {
    salvedades.push(
      'El libro presupuestal no distingue lo comprometido de lo causado. La herramienta de costos lo hara: hasta entonces, la proyeccion no incluye compromisos pendientes de pago.',
    )
  }

  const indiceCronograma = valorPlaneado > 0 ? r2(valorGanado / valorPlaneado) : null
  const indiceCosto = costoReal > 0 ? r2(valorGanado / costoReal) : null

  const proyeccionCierre =
    indiceCosto != null && indiceCosto > 0 ? r0(presupuestoTotal / indiceCosto) : null
  const proyeccionOptimista =
    costoReal > 0 ? r0(costoReal + (presupuestoTotal - valorGanado)) : null
  const faltaPorGastar = proyeccionCierre == null ? null : r0(proyeccionCierre - costoReal)
  const variacionAlCierre = proyeccionCierre == null ? null : r0(presupuestoTotal - proyeccionCierre)

  const trabajoRestante = presupuestoTotal - valorGanado
  const presupuestoRestante = presupuestoTotal - costoReal
  const eficienciaRequerida =
    presupuestoRestante > 0 ? r2(trabajoRestante / presupuestoRestante) : null

  if (presupuestoRestante <= 0 && presupuestoTotal > 0) {
    salvedades.push(
      'El costo real ya alcanzo o supero el presupuesto aprobado: terminar el alcance restante requiere presupuesto adicional.',
    )
  }

  return {
    presupuestoTotal: r0(presupuestoTotal),
    valorPlaneado,
    valorGanado,
    costoReal,
    variacionCronograma: r0(valorGanado - valorPlaneado),
    variacionCosto: r0(valorGanado - costoReal),
    indiceCronograma,
    indiceCosto,
    proyeccionCierre,
    faltaPorGastar,
    variacionAlCierre,
    proyeccionOptimista,
    eficienciaRequerida,
    consumoPresupuesto: presupuestoTotal > 0 ? r2((costoReal / presupuestoTotal) * 100) : 0,
    avanceEnDinero: resumen.avancePonderado,
    diagnostico: diagnosticar(
      indiceCronograma,
      indiceCosto,
      variacionAlCierre,
      eficienciaRequerida,
      moneda,
    ),
    salvedades,
  }
}

// ---------------------------------------------------------------------------
// Curva S: las tres magnitudes en el tiempo, mas la proyeccion
// ---------------------------------------------------------------------------

export interface PuntoCurva {
  periodo: string
  /** Valor planeado acumulado al cierre del periodo. */
  planeado: number
  /** Valor ganado acumulado. Solo existe donde hay instantanea o en el corte. */
  ganado: number | null
  /** Costo real acumulado. */
  real: number | null
  /** Proyeccion desde el corte hasta el cierre. */
  proyectado: number | null
  /** El periodo contiene la fecha de corte. */
  esCorte: boolean
  /** El periodo es posterior al corte: territorio de proyeccion. */
  futuro: boolean
}

export interface CurvaS {
  puntos: PuntoCurva[]
  /** Instantaneas usadas para reconstruir el valor ganado historico. */
  instantaneasUsadas: number
  /**
   * El valor ganado historico solo existe donde hay instantanea guardada. Sin
   * instantaneas, la curva muestra un unico punto en la fecha de corte: no se
   * inventa una trayectoria que nadie registro.
   */
  ganadoEsPuntual: boolean
}

export function curvaS(
  datos: DatosProyecto,
  resumen: ResumenProyecto,
  costos: VistaCostos,
  evm: Evm,
  instantaneas: Snapshot[] = [],
): CurvaS {
  const p = datos.proyecto
  const ctx: ContextoCalculo = resumen.ctx
  const periodos = periodosEntre(p.fechaInicio, p.fechaEntregaFinal)
  const periodoCorte = p.fechaCorte.slice(0, 7)

  // Costo real acumulado por periodo, indexado.
  const realPorPeriodo = new Map(costos.periodos.map((c) => [c.periodo, c.ejecutadoAcum]))
  let ultimoReal = 0

  // Valor ganado historico: de las instantaneas, que son el registro real.
  const ordenadas = [...instantaneas].sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte))
  const ganadoPorPeriodo = new Map<string, number>()
  for (const s of ordenadas) {
    ganadoPorPeriodo.set(
      s.fechaCorte.slice(0, 7),
      r0((evm.presupuestoTotal * s.avancePonderado) / 100),
    )
  }
  // El corte vigente siempre aporta su punto, con el valor ganado de hoy.
  ganadoPorPeriodo.set(periodoCorte, evm.valorGanado)

  const finPeriodo = (periodo: string): ISODate => {
    const [anio, mes] = periodo.split('-').map(Number)
    return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10)
  }

  const diasRestantes = Math.max(1, diffDias(p.fechaCorte, p.fechaEntregaFinal))

  const puntos: PuntoCurva[] = periodos.map((periodo) => {
    const cierre = finPeriodo(periodo)
    const futuro = periodo > periodoCorte
    const esCorte = periodo === periodoCorte

    // Valor planeado: la misma regla del avance esperado, evaluada al cierre
    // del periodo. Existe para todo el horizonte, incluido el futuro.
    const pctPlaneado = avancePlaneadoEnFecha(resumen.actividades, cierre, ctx)
    const planeado = r0((evm.presupuestoTotal * pctPlaneado) / 100)

    if (realPorPeriodo.has(periodo)) ultimoReal = realPorPeriodo.get(periodo)!
    const real = futuro ? null : ultimoReal

    // Proyeccion: del corte al cierre, interpolando linealmente el costo real
    // hasta la proyeccion al cierre. Se ancla en el corte para que la curva
    // sea continua y se vea de donde arranca la extrapolacion.
    let proyectado: number | null = null
    if (evm.proyeccionCierre != null && (esCorte || futuro)) {
      const avanceTiempo = Math.min(
        1,
        Math.max(0, diffDias(p.fechaCorte, cierre) / diasRestantes),
      )
      proyectado = r0(evm.costoReal + (evm.proyeccionCierre - evm.costoReal) * avanceTiempo)
    }

    return {
      periodo,
      planeado,
      ganado: ganadoPorPeriodo.get(periodo) ?? null,
      real,
      proyectado,
      esCorte,
      futuro,
    }
  })

  return {
    puntos,
    instantaneasUsadas: ordenadas.length,
    ganadoEsPuntual: ordenadas.length === 0,
  }
}

// ---------------------------------------------------------------------------
// Cascada: de presupuesto aprobado a proyeccion de cierre
// ---------------------------------------------------------------------------

export interface PasoCascada {
  etiqueta: string
  /**
   * Efecto del paso sobre el costo proyectado.
   * Positivo encarece el cierre; negativo lo abarata. Un total no se suma:
   * se dibuja desde la linea base.
   */
  valor: number
  esTotal: boolean
  explicacion: string
}

/**
 * Descompone la diferencia entre el presupuesto aprobado y la proyeccion de
 * cierre en sus dos causas, que exigen decisiones distintas:
 *
 *  - la desviacion ya incurrida: lo hecho costo mas (o menos) de lo que vale.
 *    Es historia. No se recupera; solo se deja de repetir.
 *  - la desviacion proyectada sobre el trabajo que falta: el efecto de
 *    sostener la eficiencia actual hasta el cierre. Es la parte accionable.
 *
 * Sin esa separacion, un comite discute el sobrecosto total sin distinguir lo
 * que puede cambiar de lo que no, y acaba pidiendo esfuerzo sobre dinero ya
 * gastado.
 *
 * La descomposicion cierra de forma exacta, por construccion:
 *
 *   presupuesto + (costo real − valor ganado) + (falta por gastar − trabajo restante)
 *     = costo real + falta por gastar
 *     = proyeccion de cierre
 */
export function cascadaCierre(evm: Evm): PasoCascada[] {
  if (evm.proyeccionCierre == null || evm.faltaPorGastar == null) return []

  // Positivo = encarece. Es lo contrario del signo de la variacion de costo,
  // que se expresa desde la perspectiva del margen.
  const incurrida = r0(evm.costoReal - evm.valorGanado)
  const trabajoRestante = r0(evm.presupuestoTotal - evm.valorGanado)
  const proyectada = r0(evm.faltaPorGastar - trabajoRestante)

  return [
    {
      etiqueta: 'Presupuesto aprobado',
      valor: evm.presupuestoTotal,
      esTotal: true,
      explicacion: 'Presupuesto al cierre registrado en la ficha del proyecto.',
    },
    {
      etiqueta: 'Desviacion ya incurrida',
      valor: incurrida,
      esTotal: false,
      explicacion:
        incurrida > 0
          ? 'Lo hecho costo mas de lo que vale. Es historia: no se recupera, solo se deja de repetir.'
          : 'Lo hecho costo menos de lo que vale: holgura real ya ganada.',
    },
    {
      etiqueta: 'Desviacion proyectada',
      valor: proyectada,
      esTotal: false,
      explicacion:
        proyectada > 0
          ? 'Efecto de sostener la eficiencia de costo actual sobre el trabajo que falta. Es la parte accionable.'
          : 'El trabajo restante se proyecta por debajo de lo presupuestado.',
    },
    {
      etiqueta: 'Proyeccion de cierre',
      valor: evm.proyeccionCierre,
      esTotal: true,
      explicacion:
        'Costo estimado al terminar si el desempeno de costo se mantiene. Es la cifra que se lleva al comite.',
    },
  ]
}

// ---------------------------------------------------------------------------
// Valor ganado por fase: donde esta el problema
// ---------------------------------------------------------------------------

export interface EvmFase {
  faseId: string
  nombre: string
  actividades: number
  /** Peso de la fase en el proyecto, por duracion. */
  peso: number
  valorPlaneado: number
  valorGanado: number
  variacionCronograma: number
  indiceCronograma: number | null
  avance: number
  avanceEsperado: number
  retrasadas: number
}

/**
 * El valor ganado del proyecto dice que hay un problema; el desglose por fase
 * dice donde. Sin el, la unica accion posible es apretar todo por igual.
 *
 * No se reparte el costo real por fase: el libro presupuestal se lleva por
 * rubro y periodo, no por fase. Inventar ese reparto daria un indice de costo
 * por fase que parece informacion y no lo es. Cuando la herramienta de costos
 * entregue el costo con la fase como dimension, esta funcion la incorpora.
 */
export function evmPorFase(resumen: ResumenProyecto, evm: Evm): EvmFase[] {
  const vigentes = resumen.actividades.filter((a) => !a.vacia && a.duracion > 0)
  const duracionTotal = vigentes.reduce((s, a) => s + a.duracion, 0)
  if (duracionTotal === 0) return []

  return resumen.porFase.map((f) => {
    const propias = vigentes.filter((a) => a.faseId === f.faseId)
    const duracionFase = propias.reduce((s, a) => s + a.duracion, 0)
    const peso = duracionFase / duracionTotal
    const presupuestoFase = evm.presupuestoTotal * peso
    const vp = r0((presupuestoFase * f.avanceEsperado) / 100)
    const vg = r0((presupuestoFase * f.avance) / 100)
    return {
      faseId: f.faseId,
      nombre: f.nombre,
      actividades: f.actividades,
      peso: r2(peso * 100),
      valorPlaneado: vp,
      valorGanado: vg,
      variacionCronograma: r0(vg - vp),
      indiceCronograma: vp > 0 ? r2(vg / vp) : null,
      avance: f.avance,
      avanceEsperado: f.avanceEsperado,
      retrasadas: f.retrasadas,
    }
  })
}

// ---------------------------------------------------------------------------
// Fachada
// ---------------------------------------------------------------------------

export interface AnalisisCostos {
  costos: VistaCostos
  evm: Evm
  curva: CurvaS
  cascada: PasoCascada[]
  porFase: EvmFase[]
}

/** Analisis completo de un proyecto: una sola llamada para los tableros. */
export function analizarCostos(
  datos: DatosProyecto,
  resumen: ResumenProyecto,
  instantaneas: Snapshot[] = [],
  opciones: OpcionesEvm = {},
): AnalisisCostos {
  const costos = vistaCostos(datos, datos.proyecto.presupuestoTotal)
  const evm = calcularEvm(datos, resumen, costos, opciones)
  return {
    costos,
    evm,
    curva: curvaS(datos, resumen, costos, evm, instantaneas),
    cascada: cascadaCierre(evm),
    porFase: evmPorFase(resumen, evm),
  }
}
