/**
 * Pruebas del motor de valor ganado.
 *
 * Las cifras esperadas estan calculadas a mano en cada bloque: si el motor y la
 * cuenta de servilleta no coinciden, el que esta mal es el motor.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  analizarCostos,
  calcularEvm,
  cascadaCierre,

  evmPorFase,
} from '../evm'
import {
  pareto,
  periodosEntre,
  proveedorInterno,
  registrarProveedorCostos,
  restaurarProveedorInterno,
  vistaCostos,
  type ProveedorCostos,
} from '../costos'
import { resumirProyecto } from '../reglas'
import * as b from './ayuda'
import { PARAMETROS } from './ayuda'
import type { DatosProyecto, Snapshot } from '../types'

beforeEach(() => {
  restaurarProveedorInterno()
})

/**
 * Proyecto de referencia construido para que la aritmetica salga redonda.
 *
 * Cuatro actividades de cinco dias habiles cada una, asi cada una pesa
 * exactamente el 25 % del proyecto. Las semanas son de febrero y octubre de
 * 2026 a proposito: son semanas sin festivo, de modo que el conteo de dias
 * habiles no altera los pesos. (Enero no sirve: el dia de Reyes se traslada al
 * lunes 12 y dejaria una semana de cuatro dias.)
 *
 *   A1  02-feb a 06-feb   avance 100 %   ya vencida
 *   A2  09-feb a 13-feb   avance 100 %   ya vencida
 *   A3  16-feb a 20-feb   avance  50 %   ya vencida
 *   A4  05-oct a 09-oct   avance   0 %   futura
 *
 * Corte: 2026-06-30 -> las tres primeras vencidas, la cuarta no ha iniciado.
 *   avance ponderado = (100 + 100 + 50 + 0) / 4 = 62,5 %
 *   avance esperado   = (100 + 100 + 100 + 0) / 4 = 75 %
 * Presupuesto 1.000.000; costo real 700.000.
 *   VP = 750.000   VG = 625.000   CR = 700.000
 *   indice cronograma = 625/750 = 0,8333
 *   indice costo      = 625/700 = 0,8929
 *   proyeccion cierre = 1.000.000 / 0,89 = 1.123.595,5
 */
function proyectoDeReferencia(over: Partial<DatosProyecto> = {}): DatosProyecto {
  return b.datos({
    proyecto: b.proyecto({ presupuestoTotal: 1_000_000, fechaCorte: '2026-06-30' }),
    actividades: [
      b.actividad({ fechaInicio: '2026-02-02', fechaFin: '2026-02-06', avance: 100 }),
      b.actividad({ fechaInicio: '2026-02-09', fechaFin: '2026-02-13', avance: 100 }),
      b.actividad({ fechaInicio: '2026-02-16', fechaFin: '2026-02-20', avance: 50 }),
      b.actividad({ fechaInicio: '2026-10-05', fechaFin: '2026-10-09', avance: 0 }),
    ],
    presupuesto: [
      b.presupuesto({ periodo: '2026-01', programado: 300_000, ejecutado: 350_000 }),
      b.presupuesto({ periodo: '2026-02', programado: 300_000, ejecutado: 350_000 }),
    ],
    ...over,
  })
}

const analizar = (datos = proyectoDeReferencia(), instantaneas: Snapshot[] = []) => {
  const resumen = resumirProyecto(datos, PARAMETROS)
  return { resumen, ...analizarCostos(datos, resumen, instantaneas) }
}

// ---------------------------------------------------------------------------
describe('las tres magnitudes', () => {
  it('convierte avance y presupuesto en dinero comparable', () => {
    const { resumen, evm } = analizar()
    expect(resumen.avancePonderado).toBe(62.5)
    expect(resumen.avanceEsperado).toBe(75)

    expect(evm.presupuestoTotal).toBe(1_000_000)
    expect(evm.valorPlaneado).toBe(750_000)
    expect(evm.valorGanado).toBe(625_000)
    expect(evm.costoReal).toBe(700_000)
  })

  it('cuando no hay presupuesto en la ficha usa el programado y lo advierte', () => {
    const { evm } = analizar(
      proyectoDeReferencia({ proyecto: b.proyecto({ fechaCorte: '2026-06-30' }) }),
    )
    expect(evm.presupuestoTotal).toBe(600_000) // programado acumulado
    expect(evm.salvedades.join(' ')).toContain('no tiene presupuesto total')
  })
})

// ---------------------------------------------------------------------------
describe('variaciones e indices', () => {
  it('la variacion de cronograma es valor ganado menos planeado', () => {
    const { evm } = analizar()
    expect(evm.variacionCronograma).toBe(-125_000) // 625 − 750
    expect(evm.indiceCronograma).toBe(0.83)
  })

  it('la variacion de costo es valor ganado menos costo real', () => {
    const { evm } = analizar()
    expect(evm.variacionCosto).toBe(-75_000) // 625 − 700
    expect(evm.indiceCosto).toBe(0.89)
  })

  it('un proyecto al dia y en costo da indices en 1', () => {
    const datos = b.datos({
      proyecto: b.proyecto({ presupuestoTotal: 1_000_000, fechaCorte: '2026-06-30' }),
      actividades: [b.actividad({ fechaInicio: '2026-02-02', fechaFin: '2026-02-06', avance: 100 })],
      presupuesto: [b.presupuesto({ programado: 1_000_000, ejecutado: 1_000_000 })],
    })
    const { evm } = analizar(datos)
    expect(evm.indiceCronograma).toBe(1)
    expect(evm.indiceCosto).toBe(1)
    expect(evm.variacionAlCierre).toBe(0)
    expect(evm.diagnostico.cuadrante).toBe('en-linea')
  })

  it('sin costo real no inventa un indice de costo', () => {
    const datos = proyectoDeReferencia({ presupuesto: [] })
    const { evm } = analizar(datos)
    expect(evm.costoReal).toBe(0)
    expect(evm.indiceCosto).toBeNull()
    expect(evm.proyeccionCierre).toBeNull()
    expect(evm.salvedades.join(' ')).toContain('No hay costo real')
  })

  it('sin cronograma no inventa un indice de cronograma', () => {
    const { evm } = analizar(proyectoDeReferencia({ actividades: [] }))
    expect(evm.valorPlaneado).toBe(0)
    expect(evm.indiceCronograma).toBeNull()
    expect(evm.diagnostico.cuadrante).toBe('sin-datos')
  })
})

// ---------------------------------------------------------------------------
describe('proyeccion al cierre', () => {
  it('extrapola el desempeno de costo actual', () => {
    const { evm } = analizar()
    // 1.000.000 / 0,89 = 1.123.595,5 -> redondeado
    expect(evm.proyeccionCierre).toBe(1_123_596)
    expect(evm.variacionAlCierre).toBe(-123_596)
    expect(evm.faltaPorGastar).toBe(423_596)
  })

  it('la proyeccion optimista supone que lo que falta cuesta lo presupuestado', () => {
    const { evm } = analizar()
    // 700.000 + (1.000.000 − 625.000) = 1.075.000
    expect(evm.proyeccionOptimista).toBe(1_075_000)
    expect(evm.proyeccionOptimista!).toBeLessThan(evm.proyeccionCierre!)
  })

  it('la eficiencia requerida mide si el presupuesto es todavia alcanzable', () => {
    const { evm } = analizar()
    // (1.000.000 − 625.000) / (1.000.000 − 700.000) = 375/300 = 1,25
    expect(evm.eficienciaRequerida).toBe(1.25)
  })

  it('con el presupuesto agotado advierte que hace falta mas', () => {
    const datos = proyectoDeReferencia({
      presupuesto: [b.presupuesto({ programado: 1_000_000, ejecutado: 1_100_000 })],
    })
    const { evm } = analizar(datos)
    expect(evm.eficienciaRequerida).toBeNull()
    expect(evm.salvedades.join(' ')).toContain('presupuesto adicional')
  })

  it('un desempeno de costo favorable proyecta ahorro', () => {
    const datos = proyectoDeReferencia({
      presupuesto: [b.presupuesto({ programado: 600_000, ejecutado: 500_000 })],
    })
    const { evm } = analizar(datos)
    expect(evm.indiceCosto!).toBeGreaterThan(1)
    expect(evm.variacionAlCierre!).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
describe('diagnostico: el cuadrante y su decision', () => {
  const conIndices = (avance: number, ejecutado: number) =>
    analizar(
      proyectoDeReferencia({
        actividades: [
          b.actividad({ fechaInicio: '2026-02-02', fechaFin: '2026-02-06', avance }),
        ],
        presupuesto: [b.presupuesto({ programado: 1_000_000, ejecutado })],
      }),
    ).evm

  it('atrasado con el gasto acompanando el trabajo', () => {
    // avance 60 %, esperado 100 % -> cronograma 0,60 ; costo 600/600 = 1,00
    const evm = conIndices(60, 600_000)
    expect(evm.diagnostico.cuadrante).toBe('atrasado')
    expect(evm.diagnostico.decision).toContain('reforzar capacidad')
  })

  it('al dia en cronograma y por encima en costo', () => {
    // avance 100 %, esperado 100 % -> cronograma 1,00 ; costo 1000/1300 = 0,77
    const evm = conIndices(100, 1_300_000)
    expect(evm.diagnostico.cuadrante).toBe('sobrecosto')
    expect(evm.diagnostico.severidad).toBe('serio')
  })

  it('atrasado y sobre costo es el cuadrante critico', () => {
    const evm = conIndices(50, 900_000)
    expect(evm.diagnostico.cuadrante).toBe('critico')
    expect(evm.diagnostico.severidad).toBe('critico')
  })

  it('cuando recuperar el presupuesto es inalcanzable, lo dice', () => {
    // avance 30 %, costo real 800.000 -> eficiencia requerida = 700/200 = 3,5
    const evm = conIndices(30, 800_000)
    expect(evm.eficienciaRequerida!).toBeGreaterThan(1.1)
    expect(evm.diagnostico.decision).toContain('no es alcanzable')
    expect(evm.diagnostico.decision).toContain('replanificar alcance')
  })

  it('el veredicto nombra la cifra del sobrecosto', () => {
    const { evm } = analizar()
    expect(evm.diagnostico.veredicto).toMatch(/\$/)
  })
})

// ---------------------------------------------------------------------------
describe('curva S', () => {
  it('cubre todo el horizonte del proyecto, mes a mes', () => {
    const { curva } = analizar()
    // 2026-01 a 2026-12
    expect(curva.puntos).toHaveLength(12)
    expect(curva.puntos[0].periodo).toBe('2026-01')
    expect(curva.puntos[11].periodo).toBe('2026-12')
  })

  it('el valor planeado crece de forma monotona y cierra en el presupuesto', () => {
    const { curva, evm } = analizar()
    for (let i = 1; i < curva.puntos.length; i++) {
      expect(curva.puntos[i].planeado).toBeGreaterThanOrEqual(curva.puntos[i - 1].planeado)
    }
    expect(curva.puntos.at(-1)!.planeado).toBe(evm.presupuestoTotal)
  })

  it('el costo real no se extiende al futuro', () => {
    const { curva } = analizar()
    for (const p of curva.puntos) {
      if (p.futuro) expect(p.real).toBeNull()
      else expect(p.real).not.toBeNull()
    }
  })

  it('la proyeccion arranca en el corte y termina en la proyeccion de cierre', () => {
    const { curva, evm } = analizar()
    const corte = curva.puntos.find((p) => p.esCorte)!
    expect(corte.proyectado).toBe(evm.costoReal)
    expect(curva.puntos.at(-1)!.proyectado).toBe(evm.proyeccionCierre)
  })

  it('sin instantaneas el valor ganado es un unico punto y lo declara', () => {
    const { curva } = analizar()
    expect(curva.ganadoEsPuntual).toBe(true)
    expect(curva.puntos.filter((p) => p.ganado != null)).toHaveLength(1)
  })

  it('con instantaneas reconstruye la trayectoria del valor ganado', () => {
    const instantanea = (fechaCorte: string, avancePonderado: number): Snapshot => ({
      id: fechaCorte,
      proyectoId: 'p1',
      fechaCorte,
      creadoEn: `${fechaCorte}T00:00:00.000Z`,
      creadoPor: 'test',
      indicadores: [],
      avancePonderado,
      avanceEsperado: 0,
      avanceSimple: 0,
      desviacion: 0,
      actividadesPorEstado: {},
      riesgosPorNivel: {},
    })
    const { curva } = analizar(proyectoDeReferencia(), [
      instantanea('2026-02-28', 25),
      instantanea('2026-04-30', 50),
    ])
    expect(curva.ganadoEsPuntual).toBe(false)
    expect(curva.instantaneasUsadas).toBe(2)
    const conGanado = curva.puntos.filter((p) => p.ganado != null)
    expect(conGanado).toHaveLength(3) // dos instantaneas + el corte vigente
    expect(curva.puntos.find((p) => p.periodo === '2026-02')!.ganado).toBe(250_000)
  })
})

// ---------------------------------------------------------------------------
describe('cascada de cierre', () => {
  it('parte la brecha en desviacion incurrida y proyectada', () => {
    const { cascada, evm } = analizar()
    expect(cascada).toHaveLength(4)
    const [base, incurrida, proyectada, cierre] = cascada
    expect(base.valor).toBe(evm.presupuestoTotal)
    expect(base.esTotal).toBe(true)
    // Positivo encarece: el costo real supera al valor ganado en 75.000.
    expect(incurrida.valor).toBe(75_000)
    expect(proyectada.valor).toBeGreaterThan(0)
    expect(cierre.valor).toBe(evm.proyeccionCierre)
  })

  it('la descomposicion reconstruye la proyeccion de forma exacta', () => {
    const { cascada } = analizar()
    const [base, incurrida, proyectada, cierre] = cascada
    expect(base.valor + incurrida.valor + proyectada.valor).toBe(cierre.valor)
  })

  it('con desempeno favorable los pasos abaratan el cierre', () => {
    const { cascada } = analizar(
      proyectoDeReferencia({
        presupuesto: [b.presupuesto({ programado: 600_000, ejecutado: 500_000 })],
      }),
    )
    const [base, incurrida, proyectada, cierre] = cascada
    expect(incurrida.valor).toBeLessThan(0)
    expect(base.valor + incurrida.valor + proyectada.valor).toBe(cierre.valor)
    expect(cierre.valor).toBeLessThan(base.valor)
  })

  it('sin proyeccion no dibuja cascada', () => {
    expect(cascadaCierre(analizar(proyectoDeReferencia({ presupuesto: [] })).evm)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
describe('valor ganado por fase', () => {
  it('reparte el presupuesto segun el peso por duracion', () => {
    const datos = proyectoDeReferencia({
      actividades: [
        b.actividad({ faseId: 'f1', fechaInicio: '2026-02-02', fechaFin: '2026-02-06', avance: 100 }),
        b.actividad({ faseId: 'f2', fechaInicio: '2026-02-09', fechaFin: '2026-02-13', avance: 0 }),
      ],
    })
    const { porFase } = analizar(datos)
    const f1 = porFase.find((f) => f.faseId === 'f1')!
    const f2 = porFase.find((f) => f.faseId === 'f2')!
    expect(f1.peso).toBe(50)
    expect(f2.peso).toBe(50)
    expect(f1.valorGanado).toBe(500_000)
    expect(f2.valorGanado).toBe(0)
    expect(f2.variacionCronograma).toBe(-500_000)
    expect(f2.indiceCronograma).toBe(0)
  })

  it('la suma del valor ganado por fase reconstruye el del proyecto', () => {
    const { porFase, evm } = analizar()
    const suma = porFase.reduce((s, f) => s + f.valorGanado, 0)
    expect(suma).toBeCloseTo(evm.valorGanado, -2)
  })

  it('sin actividades no devuelve fases', () => {
    const resumen = resumirProyecto(proyectoDeReferencia({ actividades: [] }), PARAMETROS)
    expect(evmPorFase(resumen, analizar().evm)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
describe('capa de costos', () => {
  it('acumula la serie por periodo', () => {
    const datos = proyectoDeReferencia()
    const vista = vistaCostos(datos, 1_000_000)
    expect(vista.periodos).toHaveLength(2)
    expect(vista.periodos[1].ejecutadoAcum).toBe(700_000)
    expect(vista.ejecutadoTotal).toBe(700_000)
    expect(vista.origen).toBe('interno')
  })

  it('calcula el ritmo de gasto y la cobertura restante', () => {
    const datos = proyectoDeReferencia()
    const vista = vistaCostos(datos, 1_000_000)
    expect(vista.ritmoMensual).toBe(350_000)
    // (1.000.000 − 700.000) / 350.000 = 0,857 -> 0,9 meses
    expect(vista.mesesDeCobertura).toBe(0.9)
  })

  it('sin gasto no divide por cero al estimar la cobertura', () => {
    const vista = vistaCostos(proyectoDeReferencia({ presupuesto: [] }), 1_000_000)
    expect(vista.ritmoMensual).toBe(0)
    expect(vista.mesesDeCobertura).toBeNull()
  })

  it('desagrega por rubro y por fuente, de mayor a menor', () => {
    const datos = proyectoDeReferencia({
      presupuesto: [
        b.presupuesto({ rubro: 'Tecnologia', fuente: 'Convenio', programado: 100, ejecutado: 100 }),
        b.presupuesto({ rubro: 'Talento humano', fuente: 'Convenio', programado: 900, ejecutado: 900 }),
      ],
    })
    const vista = vistaCostos(datos, 1000)
    expect(vista.porRubro[0].clave).toBe('Talento humano')
    expect(vista.porRubro[0].ejecutado).toBe(900)
    expect(vista.porFuente).toHaveLength(1)
    expect(vista.porFuente[0].ejecutado).toBe(1000)
  })

  it('estima el costo del equipo y declara los perfiles sin tarifa', () => {
    const datos = proyectoDeReferencia({
      equipo: [
        b.miembro({ costoHora: 100, dedicacionHorasMes: 10, mesesVinculacion: 2 }),
        b.miembro({ costoHora: undefined }),
      ],
    })
    const vista = vistaCostos(datos, 1_000_000)
    expect(vista.equipo.estimado).toBe(2000)
    expect(vista.equipo.perfilesSinTarifa).toBe(1)
    expect(vista.equipo.totalPerfiles).toBe(2)
  })

  it('excluye del costo los registros dados de baja', () => {
    const datos = proyectoDeReferencia({
      presupuesto: [
        b.presupuesto({ programado: 100, ejecutado: 100 }),
        b.presupuesto({ programado: 999, ejecutado: 999, eliminado: true }),
      ],
    })
    expect(vistaCostos(datos, 1000).ejecutadoTotal).toBe(100)
  })
})

// ---------------------------------------------------------------------------
describe('sustitucion del proveedor de costos', () => {
  it('un proveedor externo reemplaza la fuente sin tocar los tableros', () => {
    const externo: ProveedorCostos = {
      origen: 'externo',
      nombre: 'Herramienta institucional de costos',
      sincronizadoEn: '2026-06-30T12:00:00.000Z',
      porPeriodo: () => [
        { periodo: '2026-05', programado: 0, ejecutado: 400_000, comprometido: 50_000 },
        { periodo: '2026-06', programado: 0, ejecutado: 100_000, comprometido: 25_000 },
      ],
      porRubro: () => [
        { clave: 'Contratos', programado: 0, ejecutado: 500_000, comprometido: 75_000 },
      ],
      porFuente: () => [],
    }
    registrarProveedorCostos(externo)

    const datos = proyectoDeReferencia()
    const vista = vistaCostos(datos, 1_000_000)
    expect(vista.origen).toBe('externo')
    expect(vista.nombreFuente).toContain('institucional')
    expect(vista.ejecutadoTotal).toBe(500_000) // del externo, no del libro interno
    expect(vista.comprometidoTotal).toBe(75_000)

    // Y el valor ganado se recalcula contra la fuente nueva, sin cambios de codigo.
    const resumen = resumirProyecto(datos, PARAMETROS)
    const evm = calcularEvm(datos, resumen, vista)
    expect(evm.costoReal).toBe(500_000)
    expect(evm.indiceCosto).toBe(1.25) // 625.000 / 500.000
    expect(evm.salvedades.join(' ')).not.toContain('no distingue lo comprometido')
  })

  it('el proveedor interno sigue siendo el predeterminado', () => {
    expect(proveedorInterno.origen).toBe('interno')
    expect(vistaCostos(proyectoDeReferencia(), 1_000_000).origen).toBe('interno')
  })
})

// ---------------------------------------------------------------------------
describe('concentracion del gasto', () => {
  it('ordena y marca el nucleo que explica el 80 %', () => {
    const lineas = pareto([
      { clave: 'A', programado: 0, ejecutado: 700, comprometido: 0 },
      { clave: 'B', programado: 0, ejecutado: 200, comprometido: 0 },
      { clave: 'C', programado: 0, ejecutado: 60, comprometido: 0 },
      { clave: 'D', programado: 0, ejecutado: 40, comprometido: 0 },
    ])
    expect(lineas.map((l) => l.clave)).toEqual(['A', 'B', 'C', 'D'])
    expect(lineas[0].participacion).toBe(70)
    expect(lineas[1].acumulada).toBe(90)
    // A y B cruzan el 80 %: ambas estan en el nucleo, las demas no.
    expect(lineas.filter((l) => l.enElNucleo).map((l) => l.clave)).toEqual(['A', 'B'])
  })

  it('sin gasto no divide por cero', () => {
    const lineas = pareto([{ clave: 'A', programado: 100, ejecutado: 0, comprometido: 0 }])
    expect(lineas[0].participacion).toBe(0)
    expect(lineas[0].enElNucleo).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('periodos', () => {
  it('enumera los meses del intervalo, inclusive', () => {
    expect(periodosEntre('2026-01-15', '2026-04-02')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ])
  })

  it('un intervalo dentro del mismo mes devuelve un periodo', () => {
    expect(periodosEntre('2026-03-01', '2026-03-31')).toEqual(['2026-03'])
  })
})
