/**
 * Motor de indicadores — EP-18 / seccion 5.4 del backlog.
 *
 * El catalogo es declarativo (ADR-08): cada indicador apunta a una clave de
 * formula registrada aqui. Agregar un indicador nuevo que combine insumos ya
 * disponibles no exige reescribir el motor, solo registrar su formula.
 *
 * Los diez indicadores institucionales estan incluidos, RIES-001 y RIES-002
 * entre ellos (D-17: el instructivo solo documenta ocho).
 */

import { estadoIndicador, esProductoConforme, type ResumenProyecto } from './reglas'
import type {
  DatosProyecto,
  DefinicionIndicador,
  ResultadoIndicador,
} from './types'

// ---------------------------------------------------------------------------
// Catalogo institucional
// ---------------------------------------------------------------------------

export const CATALOGO_INDICADORES: DefinicionIndicador[] = [
  {
    codigo: 'PRY-O001',
    nombre: 'Cumplimiento del cronograma',
    categoria: 'Eficacia',
    objetivo: 'Medir la proporcion de actividades programadas que se completaron a tiempo.',
    formulaDescripcion:
      'Actividades con fecha fin <= fecha de corte y estado "Completada" / actividades con fecha fin <= fecha de corte',
    formulaClave: 'cumplimientoCronograma',
    fuente: 'Modulo Cronograma',
    frecuencia: 'Semanal',
    responsable: 'Lider de proyecto',
    automatizacion: 'Automatico',
    meta: 95,
    unidad: 'porcentaje',
    sentido: 'Mayor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'PRY-O002',
    nombre: 'Cumplimiento de entregables',
    categoria: 'Eficacia',
    objetivo: 'Verificar que los hitos comprometidos se cumplan en la fecha programada.',
    formulaDescripcion:
      'Hitos con fecha programada <= corte, estado "Cumplido" y fecha real <= programada / hitos con fecha programada <= corte',
    formulaClave: 'cumplimientoEntregables',
    fuente: 'Modulo Hitos',
    frecuencia: 'Mensual',
    responsable: 'Lider de proyecto',
    automatizacion: 'Automatico',
    meta: 95,
    unidad: 'porcentaje',
    sentido: 'Mayor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'PRY-O003',
    nombre: 'Indice de Productos Conformes',
    categoria: 'Calidad',
    objetivo: 'Medir la calidad de los productos entregados frente a los criterios de aceptacion.',
    formulaDescripcion: 'Productos evaluados y conformes / productos evaluados',
    formulaClave: 'productosConformes',
    fuente: 'Modulo Productos',
    frecuencia: 'Mensual',
    responsable: 'Gestor de proyecto',
    automatizacion: 'Automatico',
    meta: 90,
    unidad: 'porcentaje',
    sentido: 'Mayor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'PRY-O004',
    nombre: 'Desviacion presupuestal',
    categoria: 'Eficiencia',
    objetivo: 'Controlar la diferencia entre lo programado y lo ejecutado.',
    formulaDescripcion:
      'Saneado: |Σ ejecutado − Σ programado| / Σ programado. Compatibilidad: |Σ desviaciones porcentuales de cada registro| (D-05)',
    formulaClave: 'desviacionPresupuestal',
    fuente: 'Modulo Presupuesto',
    frecuencia: 'Mensual',
    responsable: 'Lider de proyecto',
    automatizacion: 'Automatico',
    meta: 5,
    unidad: 'porcentaje',
    sentido: 'Menor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'PRY-O005',
    nombre: 'Indice de Satisfaccion',
    categoria: 'Efectividad',
    objetivo: 'Medir la percepcion de las partes interesadas sobre los resultados del proyecto.',
    formulaDescripcion: 'Σ satisfechos / Σ encuestados',
    formulaClave: 'satisfaccion',
    fuente: 'Modulo Satisfaccion',
    frecuencia: 'Trimestral',
    responsable: 'Gestor de proyecto',
    automatizacion: 'Automatico',
    meta: 90,
    unidad: 'porcentaje',
    sentido: 'Mayor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'GEST-001',
    nombre: 'Avance global del proyecto',
    categoria: 'Gestion',
    objetivo: 'Reportar el avance fisico ponderado por duracion.',
    formulaDescripcion: 'Avance ponderado por duracion (RN-04)',
    formulaClave: 'avanceGlobal',
    fuente: 'Modulo Cronograma',
    frecuencia: 'Semanal',
    responsable: 'Lider de proyecto',
    automatizacion: 'Automatico',
    meta: 100,
    unidad: 'porcentaje',
    sentido: 'Mayor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'GEST-002',
    nombre: 'Actividades retrasadas',
    categoria: 'Gestion',
    objetivo: 'Detectar desviaciones de cronograma en curso.',
    formulaDescripcion: 'Actividades en estado "Retrasada" / total de actividades vigentes',
    formulaClave: 'actividadesRetrasadas',
    fuente: 'Modulo Cronograma',
    frecuencia: 'Semanal',
    responsable: 'Gestor de proyecto',
    automatizacion: 'Automatico',
    meta: 5,
    unidad: 'porcentaje',
    sentido: 'Menor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'GEST-003',
    nombre: 'Cumplimiento de hitos',
    categoria: 'Gestion',
    objetivo: 'Medir la proporcion de hitos alcanzados sobre los registrados.',
    formulaDescripcion:
      'Saneado: hitos "Cumplido" + "Cumplido con retraso" / hitos registrados (D-06). Compatibilidad: solo "Cumplido"',
    formulaClave: 'cumplimientoHitos',
    fuente: 'Modulo Hitos',
    frecuencia: 'Mensual',
    responsable: 'Lider de proyecto',
    automatizacion: 'Automatico',
    meta: 95,
    unidad: 'porcentaje',
    sentido: 'Mayor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'RIES-001',
    nombre: 'Riesgos criticos abiertos',
    categoria: 'Riesgo',
    objetivo: 'Mantener en cero los riesgos de nivel critico sin cerrar.',
    formulaDescripcion: 'Conteo de riesgos de nivel "Critico" con estado distinto de "Cerrado"',
    formulaClave: 'riesgosCriticosAbiertos',
    fuente: 'Modulo Riesgos',
    frecuencia: 'Semanal',
    responsable: 'Lider de proyecto',
    automatizacion: 'Automatico',
    meta: 0,
    unidad: 'numero',
    sentido: 'Menor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
  {
    codigo: 'RIES-002',
    nombre: 'Riesgos materializados',
    categoria: 'Riesgo',
    objetivo: 'Registrar los riesgos que efectivamente ocurrieron.',
    formulaDescripcion: 'Conteo de riesgos con estado "Materializado"',
    formulaClave: 'riesgosMaterializados',
    fuente: 'Modulo Riesgos',
    frecuencia: 'Semanal',
    responsable: 'Lider de proyecto',
    automatizacion: 'Automatico',
    meta: 0,
    unidad: 'numero',
    sentido: 'Menor es mejor',
    factorAtencionMayor: 0.9,
    factorAtencionMenor: 2,
    activo: true,
  },
]

// ---------------------------------------------------------------------------
// Registro de formulas
// ---------------------------------------------------------------------------

/** Lo que una formula devuelve antes de aplicar el semaforo. */
export interface SalidaFormula {
  valor: number | null
  numerador?: number
  denominador?: number
  detalle: string
  motivoSinDatos?: string
}

export type Formula = (datos: DatosProyecto, resumen: ResumenProyecto) => SalidaFormula

const pct = (n: number, d: number): number => (d === 0 ? 0 : (n / d) * 100)
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export const FORMULAS: Record<string, Formula> = {
  cumplimientoCronograma: (_datos, resumen) => {
    const corte = resumen.ctx.fechaCorte
    const vencidas = resumen.actividades.filter(
      (a) => !a.vacia && a.fechaFin != null && a.fechaFin <= corte,
    )
    if (vencidas.length === 0) {
      return {
        valor: null,
        detalle: 'Ninguna actividad tiene fecha fin anterior o igual a la fecha de corte.',
        motivoSinDatos:
          'Aun no hay actividades cuya fecha fin haya llegado. El indicador se activa con la primera actividad vencida.',
      }
    }
    const completadas = vencidas.filter((a) => a.estado === 'Completada').length
    return {
      valor: r2(pct(completadas, vencidas.length)),
      numerador: completadas,
      denominador: vencidas.length,
      detalle: `${completadas} de ${vencidas.length} actividades con fecha fin cumplida estan completadas.`,
    }
  },

  cumplimientoEntregables: (_datos, resumen) => {
    const corte = resumen.ctx.fechaCorte
    const programados = resumen.hitos.filter(
      (h) => h.fechaProgramada != null && h.fechaProgramada <= corte,
    )
    if (programados.length === 0) {
      return {
        valor: null,
        detalle: 'No hay hitos con fecha programada anterior o igual a la fecha de corte.',
        motivoSinDatos:
          'Falta registrar hitos con fecha programada dentro del periodo evaluado.',
      }
    }
    const aTiempo = programados.filter(
      (h) =>
        h.estado === 'Cumplido' &&
        h.fechaReal != null &&
        h.fechaProgramada != null &&
        h.fechaReal <= h.fechaProgramada,
    ).length
    return {
      valor: r2(pct(aTiempo, programados.length)),
      numerador: aTiempo,
      denominador: programados.length,
      detalle: `${aTiempo} de ${programados.length} hitos exigibles se cumplieron en la fecha programada o antes.`,
    }
  },

  productosConformes: (datos) => {
    const productos = datos.productos.filter((p) => !p.eliminado)
    const evaluados = productos.filter((p) => p.evaluado)
    if (evaluados.length === 0) {
      return {
        valor: null,
        detalle: 'No hay productos evaluados.',
        motivoSinDatos:
          'Falta marcar productos como evaluados en el modulo de Productos; sin evaluacion no hay conformidad que medir.',
      }
    }
    const conformes = evaluados.filter(esProductoConforme).length
    return {
      valor: r2(pct(conformes, evaluados.length)),
      numerador: conformes,
      denominador: evaluados.length,
      detalle: `${conformes} de ${evaluados.length} productos evaluados resultaron conformes.`,
    }
  },

  /**
   * Saneado (HG-202): una desviacion agregada real, calculada sobre los totales.
   * Compatibilidad: reproduce D-05, la suma de porcentajes de filas distintas.
   */
  desviacionPresupuestal: (datos, resumen) => {
    const registros = datos.presupuesto.filter((p) => !p.eliminado)
    if (registros.length === 0) {
      return {
        valor: null,
        detalle: 'Sin registros presupuestales.',
        motivoSinDatos: 'Falta registrar al menos un periodo en el modulo de Presupuesto.',
      }
    }

    if (resumen.ctx.modo === 'compatibilidad') {
      const suma = registros.reduce((s, r) => {
        const prog = Number(r.programado) || 0
        if (prog === 0) return s
        return s + ((Number(r.ejecutado) || 0) - prog) / prog
      }, 0)
      return {
        valor: r2(Math.abs(suma) * 100),
        detalle:
          'Modo compatibilidad: suma de las desviaciones porcentuales de cada registro (reproduce el defecto D-05).',
      }
    }

    const programado = registros.reduce((s, r) => s + (Number(r.programado) || 0), 0)
    const ejecutado = registros.reduce((s, r) => s + (Number(r.ejecutado) || 0), 0)
    if (programado === 0) {
      return {
        valor: null,
        detalle: 'El presupuesto programado acumulado es cero.',
        motivoSinDatos: 'No se puede calcular una desviacion relativa sin presupuesto programado.',
      }
    }
    return {
      valor: r2(Math.abs(pct(ejecutado - programado, programado))),
      numerador: ejecutado - programado,
      denominador: programado,
      detalle: `Ejecutado ${ejecutado.toLocaleString('es-CO')} frente a programado ${programado.toLocaleString('es-CO')}.`,
    }
  },

  satisfaccion: (datos) => {
    const mediciones = datos.satisfaccion.filter((m) => !m.eliminado)
    const encuestados = mediciones.reduce((s, m) => s + (Number(m.encuestados) || 0), 0)
    if (encuestados === 0) {
      return {
        valor: null,
        detalle: 'No hay encuestados registrados.',
        motivoSinDatos: 'Falta registrar mediciones de satisfaccion con al menos un encuestado.',
      }
    }
    const satisfechos = mediciones.reduce((s, m) => s + (Number(m.satisfechos) || 0), 0)
    return {
      valor: r2(pct(satisfechos, encuestados)),
      numerador: satisfechos,
      denominador: encuestados,
      detalle: `${satisfechos} de ${encuestados} encuestados manifestaron satisfaccion.`,
    }
  },

  avanceGlobal: (_datos, resumen) => {
    const vigentes = resumen.actividades.filter((a) => !a.vacia)
    if (vigentes.length === 0) {
      return {
        valor: null,
        detalle: 'El cronograma no tiene actividades vigentes.',
        motivoSinDatos: 'Falta cargar el cronograma del proyecto.',
      }
    }
    return {
      valor: resumen.avancePonderado,
      detalle: `Avance ponderado por duracion sobre ${vigentes.length} actividades; el esperado a la fecha de corte es ${resumen.avanceEsperado} %.`,
    }
  },

  actividadesRetrasadas: (_datos, resumen) => {
    const vigentes = resumen.actividades.filter((a) => !a.vacia)
    if (vigentes.length === 0) {
      return {
        valor: null,
        detalle: 'El cronograma no tiene actividades vigentes.',
        motivoSinDatos: 'Falta cargar el cronograma del proyecto.',
      }
    }
    const retrasadas = resumen.retrasadas.length
    return {
      valor: r2(pct(retrasadas, vigentes.length)),
      numerador: retrasadas,
      denominador: vigentes.length,
      detalle: `${retrasadas} de ${vigentes.length} actividades estan retrasadas a la fecha de corte.`,
    }
  },

  /** Saneado: "Cumplido con retraso" cuenta como cumplido (corrige D-06). */
  cumplimientoHitos: (_datos, resumen) => {
    const hitos = resumen.hitos
    if (hitos.length === 0) {
      return {
        valor: null,
        detalle: 'No hay hitos registrados.',
        motivoSinDatos: 'Falta registrar hitos en el modulo correspondiente.',
      }
    }
    const compat = resumen.ctx.modo === 'compatibilidad'
    const cumplidos = hitos.filter((h) =>
      compat ? h.estado === 'Cumplido' : h.cumplido,
    ).length
    return {
      valor: r2(pct(cumplidos, hitos.length)),
      numerador: cumplidos,
      denominador: hitos.length,
      detalle: compat
        ? `${cumplidos} de ${hitos.length} hitos en estado "Cumplido" (modo compatibilidad: no cuenta "Cumplido con retraso").`
        : `${cumplidos} de ${hitos.length} hitos cumplidos, incluidos los cumplidos con retraso.`,
    }
  },

  riesgosCriticosAbiertos: (_datos, resumen) => {
    const criticos = resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado')
    return {
      valor: criticos.length,
      numerador: criticos.length,
      detalle:
        criticos.length === 0
          ? 'No hay riesgos criticos abiertos.'
          : `${criticos.length} riesgo(s) de nivel critico sin cerrar.`,
    }
  },

  riesgosMaterializados: (_datos, resumen) => {
    const materializados = resumen.riesgos.filter((r) => r.estado === 'Materializado')
    return {
      valor: materializados.length,
      numerador: materializados.length,
      detalle:
        materializados.length === 0
          ? 'Ningun riesgo se ha materializado.'
          : `${materializados.length} riesgo(s) materializado(s).`,
    }
  },
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

export function calcularIndicador(
  def: DefinicionIndicador,
  datos: DatosProyecto,
  resumen: ResumenProyecto,
): ResultadoIndicador {
  const formula = FORMULAS[def.formulaClave]
  const ahora = new Date().toISOString()

  if (!formula) {
    return {
      codigo: def.codigo,
      valor: null,
      estado: 'Sin datos',
      motivoSinDatos: `No hay formula registrada para la clave "${def.formulaClave}".`,
      detalle: 'Indicador declarado en el catalogo sin implementacion asociada.',
      calculadoEn: ahora,
      fechaCorte: resumen.ctx.fechaCorte,
    }
  }

  let salida: SalidaFormula
  try {
    salida = formula(datos, resumen)
  } catch (error) {
    return {
      codigo: def.codigo,
      valor: null,
      estado: 'Sin datos',
      motivoSinDatos: `Error al calcular: ${(error as Error).message}`,
      detalle: 'El calculo fallo; se revisan los datos fuente.',
      calculadoEn: ahora,
      fechaCorte: resumen.ctx.fechaCorte,
    }
  }

  return {
    codigo: def.codigo,
    valor: salida.valor,
    // HG-114: "sin datos" nunca se presenta como cero.
    estado: estadoIndicador(
      salida.valor,
      def.meta,
      def.sentido,
      def.factorAtencionMayor,
      def.factorAtencionMenor,
    ),
    motivoSinDatos: salida.motivoSinDatos,
    numerador: salida.numerador,
    denominador: salida.denominador,
    detalle: salida.detalle,
    calculadoEn: ahora,
    fechaCorte: resumen.ctx.fechaCorte,
  }
}

export function calcularIndicadores(
  datos: DatosProyecto,
  resumen: ResumenProyecto,
  catalogo: DefinicionIndicador[] = CATALOGO_INDICADORES,
): ResultadoIndicador[] {
  return catalogo.filter((d) => d.activo).map((def) => calcularIndicador(def, datos, resumen))
}

export function definicionPorCodigo(
  codigo: string,
  catalogo: DefinicionIndicador[] = CATALOGO_INDICADORES,
): DefinicionIndicador | undefined {
  return catalogo.find((d) => d.codigo === codigo)
}

/** Formato de presentacion del valor segun la unidad declarada. */
export function formatearValorIndicador(
  valor: number | null,
  unidad: DefinicionIndicador['unidad'],
): string {
  if (valor == null) return 'Sin datos'
  return unidad === 'porcentaje' ? `${valor.toFixed(1)} %` : String(valor)
}
