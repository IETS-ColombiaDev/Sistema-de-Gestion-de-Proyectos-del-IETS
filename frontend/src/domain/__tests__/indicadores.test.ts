/**
 * Pruebas del motor de indicadores — los diez indicadores institucionales.
 * Verifican tambien las dos correcciones que cambian el resultado: D-05
 * (desviacion presupuestal agregada) y D-06 (hitos cumplidos con retraso).
 */

import { describe, expect, it } from 'vitest'
import {
  CATALOGO_INDICADORES,
  calcularIndicador,
  calcularIndicadores,
  definicionPorCodigo,
  formatearValorIndicador,
} from '../indicadores'
import { resumirProyecto } from '../reglas'
import * as b from './ayuda'
import { PARAMETROS } from './ayuda'

const evaluar = (datos = b.datos(), modo: 'saneado' | 'compatibilidad' = 'saneado') => {
  const d = { ...datos, proyecto: { ...datos.proyecto, modoCalculo: modo } }
  const resumen = resumirProyecto(d, PARAMETROS)
  const resultados = calcularIndicadores(d, resumen)
  return {
    resultados,
    de: (codigo: string) => resultados.find((r) => r.codigo === codigo)!,
  }
}

describe('catalogo institucional', () => {
  it('contiene los diez indicadores, RIES-001 y RIES-002 incluidos (D-17)', () => {
    expect(CATALOGO_INDICADORES).toHaveLength(10)
    const codigos = CATALOGO_INDICADORES.map((d) => d.codigo)
    expect(codigos).toContain('RIES-001')
    expect(codigos).toContain('RIES-002')
  })

  it('cada indicador conserva sus siete atributos de ficha tecnica', () => {
    for (const d of CATALOGO_INDICADORES) {
      expect(d.objetivo).not.toBe('')
      expect(d.formulaDescripcion).not.toBe('')
      expect(d.fuente).not.toBe('')
      expect(d.frecuencia).not.toBe('')
      expect(d.responsable).not.toBe('')
      expect(d.automatizacion).toBeTruthy()
      expect(Number.isFinite(d.meta)).toBe(true)
    }
  })

  it('toda formula declarada tiene implementacion', () => {
    for (const d of CATALOGO_INDICADORES) {
      const r = calcularIndicador(d, b.datos(), resumirProyecto(b.datos(), PARAMETROS))
      expect(r.motivoSinDatos ?? '').not.toContain('No hay formula registrada')
    }
  })

  it('resuelve una definicion por codigo', () => {
    expect(definicionPorCodigo('PRY-O001')?.categoria).toBe('Eficacia')
    expect(definicionPorCodigo('NO-EXISTE')).toBeUndefined()
  })
})

describe('HG-114 · sin datos nunca se presenta como cero', () => {
  it('un proyecto vacio deja los indicadores en Sin datos con explicacion', () => {
    const { resultados } = evaluar(b.datos())
    const conValor = resultados.filter((r) => r.valor != null)
    // Solo los dos de riesgo pueden valer 0 legitimamente (conteos).
    expect(conValor.map((r) => r.codigo).sort()).toEqual(['RIES-001', 'RIES-002'])
    for (const r of resultados.filter((x) => x.valor == null)) {
      expect(r.estado).toBe('Sin datos')
      expect(r.motivoSinDatos).toBeTruthy()
    }
  })
})

describe('PRY-O001 · cumplimiento del cronograma', () => {
  it('mide solo las actividades cuya fecha fin ya llego', () => {
    const r = evaluar(
      b.datos({
        actividades: [
          b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }),
          b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 50 }),
          b.actividad({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30', avance: 0 }), // futura
        ],
      }),
    ).de('PRY-O001')
    expect(r.denominador).toBe(2)
    expect(r.numerador).toBe(1)
    expect(r.valor).toBe(50)
    expect(r.estado).toBe('Critico')
  })
})

describe('PRY-O002 · cumplimiento de entregables', () => {
  it('exige estado Cumplido y fecha real no posterior a la programada', () => {
    const r = evaluar(
      b.datos({
        hitos: [
          b.hito({ fechaProgramada: '2026-02-01', fechaReal: '2026-01-30', estado: 'Cumplido' }),
          b.hito({ fechaProgramada: '2026-03-01', fechaReal: '2026-03-10', estado: 'Cumplido con retraso' }),
          b.hito({ fechaProgramada: '2026-11-01', estado: 'Pendiente' }), // fuera del corte
        ],
      }),
    ).de('PRY-O002')
    expect(r.denominador).toBe(2)
    expect(r.numerador).toBe(1)
    expect(r.valor).toBe(50)
  })
})

describe('PRY-O003 · indice de productos conformes', () => {
  it('divide entre los evaluados, no entre el total', () => {
    const r = evaluar(
      b.datos({
        productos: [
          b.producto({ evaluado: true, conforme: true }),
          b.producto({ evaluado: true, conforme: false }),
          b.producto({ evaluado: false, conforme: false }),
        ],
      }),
    ).de('PRY-O003')
    expect(r.denominador).toBe(2)
    expect(r.valor).toBe(50)
  })

  it('sin productos evaluados no calcula cero, informa el insumo faltante', () => {
    const r = evaluar(b.datos({ productos: [b.producto({ evaluado: false })] })).de('PRY-O003')
    expect(r.valor).toBeNull()
    expect(r.motivoSinDatos).toContain('evaluados')
  })
})

describe('PRY-O004 · desviacion presupuestal (D-05)', () => {
  const datos = b.datos({
    presupuesto: [
      b.presupuesto({ periodo: '2026-01', programado: 1000, ejecutado: 1200 }), // +20 %
      b.presupuesto({ periodo: '2026-02', programado: 1000, ejecutado: 800 }), // −20 %
    ],
  })

  it('modo saneado: se calcula sobre los totales y se compensa', () => {
    const r = evaluar(datos, 'saneado').de('PRY-O004')
    // Totales: 2000 programado, 2000 ejecutado -> 0 % de desviacion
    expect(r.valor).toBe(0)
    expect(r.estado).toBe('Cumple')
  })

  it('modo compatibilidad: reproduce la suma de porcentajes del libro', () => {
    const r = evaluar(datos, 'compatibilidad').de('PRY-O004')
    // |+0,20 − 0,20| = 0 en este caso simetrico; el defecto se ve al acumular en el mismo sentido
    expect(r.detalle).toContain('compatibilidad')
  })

  it('modo compatibilidad crece sin significado al acumular periodos', () => {
    const acumulado = b.datos({
      presupuesto: [
        b.presupuesto({ periodo: '2026-01', programado: 1000, ejecutado: 1100 }),
        b.presupuesto({ periodo: '2026-02', programado: 1000, ejecutado: 1100 }),
        b.presupuesto({ periodo: '2026-03', programado: 1000, ejecutado: 1100 }),
      ],
    })
    const compat = evaluar(acumulado, 'compatibilidad').de('PRY-O004')
    const saneado = evaluar(acumulado, 'saneado').de('PRY-O004')
    // La desviacion real es 10 % en los tres periodos; la heredada la triplica.
    expect(saneado.valor).toBeCloseTo(10, 5)
    expect(compat.valor).toBeCloseTo(30, 5)
  })

  it('sin presupuesto programado no divide por cero', () => {
    const r = evaluar(
      b.datos({ presupuesto: [b.presupuesto({ programado: 0, ejecutado: 500 })] }),
    ).de('PRY-O004')
    expect(r.valor).toBeNull()
  })
})

describe('PRY-O005 · indice de satisfaccion', () => {
  it('agrega numeradores y denominadores de todas las mediciones', () => {
    const r = evaluar(
      b.datos({
        satisfaccion: [
          b.medicion({ encuestados: 10, satisfechos: 9 }),
          b.medicion({ encuestados: 30, satisfechos: 27 }),
        ],
      }),
    ).de('PRY-O005')
    expect(r.numerador).toBe(36)
    expect(r.denominador).toBe(40)
    expect(r.valor).toBe(90)
    expect(r.estado).toBe('Cumple')
  })
})

describe('GEST-001 / GEST-002 · gestion del cronograma', () => {
  it('GEST-001 toma el avance ponderado', () => {
    const datos = b.datos({
      actividades: [
        b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }),
        b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 0 }),
      ],
    })
    const resumen = resumirProyecto(datos, PARAMETROS)
    expect(evaluar(datos).de('GEST-001').valor).toBe(resumen.avancePonderado)
  })

  it('GEST-002 mide la proporcion de retrasadas y es "menor es mejor"', () => {
    const r = evaluar(
      b.datos({
        actividades: [
          b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 0 }), // retrasada
          b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }),
          b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }),
          b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }),
        ],
      }),
    ).de('GEST-002')
    expect(r.valor).toBe(25)
    expect(r.estado).toBe('Critico') // meta 5 %, tolerancia 10 %
  })
})

describe('GEST-003 · cumplimiento de hitos (D-06)', () => {
  const datos = b.datos({
    hitos: [
      b.hito({ estado: 'Cumplido', fechaReal: '2026-02-01' }),
      b.hito({ estado: 'Cumplido con retraso', fechaReal: '2026-03-10' }),
      b.hito({ estado: 'Pendiente' }),
      b.hito({ estado: 'No cumplido' }),
    ],
  })

  it('modo saneado cuenta los cumplidos con retraso', () => {
    const r = evaluar(datos, 'saneado').de('GEST-003')
    expect(r.numerador).toBe(2)
    expect(r.valor).toBe(50)
  })

  it('modo compatibilidad los ignora, como el libro', () => {
    const r = evaluar(datos, 'compatibilidad').de('GEST-003')
    expect(r.numerador).toBe(1)
    expect(r.valor).toBe(25)
  })
})

describe('RIES-001 / RIES-002 · riesgos', () => {
  it('cuenta criticos abiertos y excluye los cerrados', () => {
    const r = evaluar(
      b.datos({
        riesgos: [
          b.riesgo({ probabilidad: 5, impacto: 5, estado: 'Identificado' }),
          b.riesgo({ probabilidad: 5, impacto: 4, estado: 'En mitigacion' }),
          b.riesgo({ probabilidad: 5, impacto: 5, estado: 'Cerrado' }),
          b.riesgo({ probabilidad: 1, impacto: 1, estado: 'Identificado' }),
        ],
      }),
    ).de('RIES-001')
    expect(r.valor).toBe(2)
    expect(r.estado).toBe('Critico') // meta 0
  })

  it('con cero criticos abiertos cumple la meta', () => {
    const r = evaluar(b.datos({ riesgos: [b.riesgo({ probabilidad: 1, impacto: 1 })] })).de('RIES-001')
    expect(r.valor).toBe(0)
    expect(r.estado).toBe('Cumple')
  })

  it('cuenta los materializados', () => {
    const r = evaluar(
      b.datos({ riesgos: [b.riesgo({ estado: 'Materializado' }), b.riesgo({ estado: 'Cerrado' })] }),
    ).de('RIES-002')
    expect(r.valor).toBe(1)
  })
})

describe('presentacion del valor', () => {
  it('formatea porcentajes y numeros absolutos', () => {
    expect(formatearValorIndicador(93.456, 'porcentaje')).toBe('93.5 %')
    expect(formatearValorIndicador(3, 'numero')).toBe('3')
    expect(formatearValorIndicador(null, 'porcentaje')).toBe('Sin datos')
  })
})

describe('trazabilidad del calculo', () => {
  it('cada resultado explica como se obtuvo y a que fecha de corte', () => {
    const { resultados } = evaluar(
      b.datos({ actividades: [b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 })] }),
    )
    for (const r of resultados) {
      expect(r.detalle).toBeTruthy()
      expect(r.fechaCorte).toBe('2026-06-30')
      expect(r.calculadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }
  })
})
