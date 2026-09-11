/**
 * Pruebas del motor de reglas — RN-01 a RN-28.
 * Cada bloque cita la regla que verifica y, cuando aplica, el hallazgo del
 * Anexo C cuya correccion se comprueba.
 */

import { describe, expect, it } from 'vitest'
import {
  actividadesRetrasadas,
  asignacionesPorCelda,
  avanceEsperado,
  avancePonderado,
  avancePorFase,
  avanceSimple,
  calcularActividades,
  calcularHitos,
  calcularRiesgos,
  crearContexto,
  desviacionAvance,
  desviacionPresupuestal,
  detectarCiclos,
  distribucionPorEstado,
  duracionActividad,
  esProductoConforme,
  estadoActividad,
  estadoIndicador,
  indiceSatisfaccion,
  integridadRaci,
  mapaCalorRiesgos,
  nivelRiesgo,
  proximidadEntrega,
  resumenEquipo,
  resumenRecursos,
  resumirProyecto,
  severidadRiesgo,
  solapaPeriodo,
  validarAvance,
  validarFechasActividad,
  validarRiesgo,
  validarSatisfaccion,
} from '../reglas'
import * as b from './ayuda'
import { PARAMETROS } from './ayuda'

const ctx = (modo: 'saneado' | 'compatibilidad' = 'saneado', corte = '2026-06-30') =>
  crearContexto(corte, '2026-12-31', modo, PARAMETROS)

// ---------------------------------------------------------------------------
describe('RN-01 · estado de la actividad', () => {
  it('marca Completada cuando el avance llega a 100, incluso si la fecha fin paso', () => {
    const r = estadoActividad(
      { nombre: 'A', fechaInicio: '2026-01-01', fechaFin: '2026-02-01', avance: 100 },
      '2026-06-30',
    )
    expect(r.estado).toBe('Completada')
  })

  it('marca Retrasada cuando el corte supera la fecha fin sin llegar a 100', () => {
    const r = estadoActividad(
      { nombre: 'A', fechaInicio: '2026-01-01', fechaFin: '2026-02-01', avance: 60 },
      '2026-06-30',
    )
    expect(r.estado).toBe('Retrasada')
    expect(r.razon).toContain('supera la fecha fin')
  })

  it('marca En curso cuando el corte esta dentro de la ventana', () => {
    expect(
      estadoActividad(
        { nombre: 'A', fechaInicio: '2026-06-01', fechaFin: '2026-07-31', avance: 40 },
        '2026-06-30',
      ).estado,
    ).toBe('En curso')
  })

  it('marca Pendiente cuando la actividad aun no inicia', () => {
    expect(
      estadoActividad(
        { nombre: 'A', fechaInicio: '2026-08-01', fechaFin: '2026-09-01', avance: 0 },
        '2026-06-30',
      ).estado,
    ).toBe('Pendiente')
  })

  it('D-14: una fila vacia no produce estado y queda fuera de los calculos', () => {
    const sinNombre = estadoActividad(
      { nombre: '  ', fechaInicio: '2026-01-01', fechaFin: '2026-02-01', avance: 0 },
      '2026-06-30',
    )
    expect(sinNombre.vacia).toBe(true)
    expect(sinNombre.estado).toBe('')

    const sinFechas = estadoActividad(
      { nombre: 'A', fechaInicio: null, fechaFin: null, avance: 0 },
      '2026-06-30',
    )
    expect(sinFechas.vacia).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('RN-02 · duracion (D-01)', () => {
  it('modo saneado cuenta dias habiles reales', () => {
    // lunes 2026-09-07 a viernes 2026-09-11
    expect(duracionActividad('2026-09-07', '2026-09-11', ctx('saneado'))).toBe(5)
    // incluyendo dos fines de semana: 10 habiles
    expect(duracionActividad('2026-09-07', '2026-09-18', ctx('saneado'))).toBe(10)
  })

  it('modo compatibilidad replica fin − inicio − 2', () => {
    expect(duracionActividad('2026-09-07', '2026-09-11', ctx('compatibilidad'))).toBe(2)
    expect(duracionActividad('2026-09-07', '2026-09-18', ctx('compatibilidad'))).toBe(9)
  })

  it('nunca devuelve menos de 1 dia en modo saneado', () => {
    // sabado a domingo: cero habiles, pero se acota a 1 para no romper el denominador
    expect(duracionActividad('2026-09-12', '2026-09-13', ctx('saneado'))).toBe(1)
  })

  it('devuelve 0 si faltan fechas o el rango esta invertido', () => {
    expect(duracionActividad(null, '2026-09-11', ctx())).toBe(0)
    expect(duracionActividad('2026-09-11', '2026-09-07', ctx())).toBe(0)
  })
})

// ---------------------------------------------------------------------------
describe('RN-03 / RN-04 · avance simple y ponderado', () => {
  const acts = [
    b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }), // 5 habiles
    b.actividad({ fechaInicio: '2026-02-02', fechaFin: '2026-02-27', avance: 50 }), // 20 habiles
    b.actividad({ nombre: '', fechaInicio: null, fechaFin: null, avance: 0 }), // vacia
  ]

  it('el avance simple promedia solo las actividades no vacias', () => {
    const calc = calcularActividades(acts, ctx())
    expect(avanceSimple(calc)).toBe(75)
  })

  it('el avance ponderado pesa por duracion', () => {
    const calc = calcularActividades(acts, ctx())
    // (5*100 + 20*50) / 25 = 60
    expect(avancePonderado(calc)).toBe(60)
  })

  it('devuelve 0 y no NaN cuando no hay actividades vigentes', () => {
    const calc = calcularActividades([acts[2]], ctx())
    expect(avancePonderado(calc)).toBe(0)
    expect(avanceSimple(calc)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
describe('RN-05 · avance esperado (D-02)', () => {
  it('una actividad ya vencida aporta el 100 % de su duracion', () => {
    const acts = calcularActividades(
      [b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 0 })],
      ctx(),
    )
    expect(avanceEsperado(acts, ctx())).toBe(100)
  })

  it('una actividad futura no aporta nada', () => {
    const acts = calcularActividades(
      [b.actividad({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30', avance: 0 })],
      ctx(),
    )
    expect(avanceEsperado(acts, ctx())).toBe(0)
  })

  it('una actividad en curso aporta la fraccion transcurrida en la misma unidad', () => {
    // 2026-06-01 (lunes) a 2026-06-30. Corte 2026-06-15.
    const c = ctx('saneado', '2026-06-15')
    const acts = calcularActividades(
      [b.actividad({ fechaInicio: '2026-06-01', fechaFin: '2026-06-30', avance: 0 })],
      c,
    )
    const esperado = avanceEsperado(acts, c)
    expect(esperado).toBeGreaterThan(0)
    expect(esperado).toBeLessThan(100)
    // La fraccion es dias habiles transcurridos sobre duracion habil: nunca supera 100.
    expect(acts[0].avanceEsperado).toBeLessThanOrEqual(100)
  })

  it('el modo compatibilidad infla el esperado al mezclar unidades', () => {
    const acts = [b.actividad({ fechaInicio: '2026-06-01', fechaFin: '2026-07-31', avance: 0 })]
    const cSan = ctx('saneado', '2026-06-30')
    const cCom = ctx('compatibilidad', '2026-06-30')
    const san = avanceEsperado(calcularActividades(acts, cSan), cSan)
    const com = avanceEsperado(calcularActividades(acts, cCom), cCom)
    expect(com).toBeGreaterThan(san)
  })

  it('el esperado nunca excede el 100 %', () => {
    const c = ctx('saneado', '2026-12-31')
    const acts = calcularActividades(
      [
        b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-03-31', avance: 0 }),
        b.actividad({ fechaInicio: '2026-04-01', fechaFin: '2026-06-30', avance: 0 }),
      ],
      c,
    )
    expect(avanceEsperado(acts, c)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
describe('RN-06 · desviacion y umbrales configurables (D-03)', () => {
  it('clasifica segun los umbrales de parametros, no segun literales', () => {
    expect(desviacionAvance(90, 92, PARAMETROS).nivel).toBe('En linea')
    expect(desviacionAvance(85, 92, PARAMETROS).nivel).toBe('Precaucion')
    expect(desviacionAvance(75, 92, PARAMETROS).nivel).toBe('ATENCION')
  })

  it('respeta umbrales personalizados', () => {
    const estrictos = { ...PARAMETROS, umbralPrecaucion: 1, umbralAtencion: 2 }
    expect(desviacionAvance(97, 100, estrictos).nivel).toBe('ATENCION')
  })

  it('un avance por encima de lo programado queda en linea', () => {
    const d = desviacionAvance(95, 80, PARAMETROS)
    expect(d.nivel).toBe('En linea')
    expect(d.puntos).toBe(15)
  })
})

// ---------------------------------------------------------------------------
describe('RN-07 / RN-08 · retrasadas y distribucion', () => {
  const acts = calcularActividades(
    [
      b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }),
      b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 30 }),
      b.actividad({ fechaInicio: '2026-06-01', fechaFin: '2026-07-31', avance: 20 }),
      b.actividad({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30', avance: 0 }),
      b.actividad({ nombre: '', fechaInicio: null, fechaFin: null }),
    ],
    ctx(),
  )

  it('cuenta las retrasadas', () => {
    expect(actividadesRetrasadas(acts)).toHaveLength(1)
  })

  it('la distribucion suma 100 % sobre las vigentes y excluye las vacias', () => {
    const d = distribucionPorEstado(acts)
    expect(d.reduce((s, x) => s + x.conteo, 0)).toBe(4)
    expect(d.reduce((s, x) => s + x.porcentaje, 0)).toBeCloseTo(100, 5)
  })
})

// ---------------------------------------------------------------------------
describe('RN-09 · avance por fase (D-08)', () => {
  it('agrupa por la lista de fases del proyecto, no por rotulos escritos', () => {
    const acts = calcularActividades(
      [
        b.actividad({ faseId: 'f1', fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }),
        b.actividad({ faseId: 'f2', fechaInicio: '2026-02-02', fechaFin: '2026-02-06', avance: 0 }),
      ],
      ctx(),
    )
    const porFase = avancePorFase(acts, b.proyecto().fases)
    expect(porFase).toHaveLength(2)
    expect(porFase[0].avance).toBe(100)
    expect(porFase[1].avance).toBe(0)
  })

  it('una fase sin actividades no rompe el calculo', () => {
    const porFase = avancePorFase([], b.proyecto().fases)
    expect(porFase.every((f) => f.avance === 0 && f.actividades === 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('RN-10 · proximidad de entrega (D-03)', () => {
  it('usa la fecha de la ficha y la ventana del catalogo', () => {
    const c = crearContexto('2026-12-25', '2026-12-31', 'saneado', PARAMETROS)
    const a = proximidadEntrega(c)
    expect(a.activa).toBe(true)
    expect(a.diasRestantes).toBe(6)
  })

  it('detecta la entrega vencida', () => {
    const c = crearContexto('2027-01-10', '2026-12-31', 'saneado', PARAMETROS)
    const a = proximidadEntrega(c)
    expect(a.vencida).toBe(true)
    expect(a.diasRestantes).toBeLessThan(0)
  })

  it('no alerta fuera de la ventana', () => {
    const c = crearContexto('2026-01-01', '2026-12-31', 'saneado', PARAMETROS)
    expect(proximidadEntrega(c).activa).toBe(false)
  })

  it('respeta una ventana personalizada', () => {
    const c = crearContexto('2026-12-01', '2026-12-31', 'saneado', { ...PARAMETROS, ventanaAlertaDias: 60 })
    expect(proximidadEntrega(c).activa).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('RN-11 · solape para el Gantt', () => {
  it('detecta el solape en ambos sentidos', () => {
    expect(solapaPeriodo('2026-01-05', '2026-01-09', '2026-01-01', '2026-01-07')).toBe(true)
    expect(solapaPeriodo('2026-01-05', '2026-01-09', '2026-01-08', '2026-01-14')).toBe(true)
    expect(solapaPeriodo('2026-01-05', '2026-01-09', '2026-01-10', '2026-01-16')).toBe(false)
    expect(solapaPeriodo(null, '2026-01-09', '2026-01-01', '2026-01-07')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('RN-12 / RN-13 · severidad y nivel de riesgo', () => {
  it('la severidad es el producto y es nula si falta un factor', () => {
    expect(severidadRiesgo(4, 5)).toBe(20)
    expect(severidadRiesgo(null, 5)).toBeNull()
    expect(severidadRiesgo(4, null)).toBeNull()
  })

  it('aplica los cortes exactos del instructivo', () => {
    expect(nivelRiesgo(1)).toBe('Bajo')
    expect(nivelRiesgo(4)).toBe('Bajo')
    expect(nivelRiesgo(5)).toBe('Medio')
    expect(nivelRiesgo(9)).toBe('Medio')
    expect(nivelRiesgo(10)).toBe('Alto')
    expect(nivelRiesgo(14)).toBe('Alto')
    expect(nivelRiesgo(15)).toBe('Critico')
    expect(nivelRiesgo(25)).toBe('Critico')
    expect(nivelRiesgo(null)).toBeNull()
  })

  it('marca como incompleto un riesgo activo sin valorar (HG-090)', () => {
    const [abierto, cerrado] = calcularRiesgos([
      b.riesgo({ probabilidad: null, impacto: 3, estado: 'Identificado' }),
      b.riesgo({ probabilidad: null, impacto: null, estado: 'Cerrado' }),
    ])
    expect(abierto.incompleto).toBe(true)
    expect(cerrado.incompleto).toBe(false)
  })

  it('el mapa de calor ubica el riesgo en su celda y excluye los cerrados', () => {
    const m = mapaCalorRiesgos(
      calcularRiesgos([
        b.riesgo({ probabilidad: 5, impacto: 5 }),
        b.riesgo({ probabilidad: 1, impacto: 1 }),
        b.riesgo({ probabilidad: 5, impacto: 5, estado: 'Cerrado' }),
      ]),
    )
    expect(m[0][4]).toBe(1) // probabilidad 5, impacto 5
    expect(m[4][0]).toBe(1) // probabilidad 1, impacto 1
    expect(m.flat().reduce((s, x) => s + x, 0)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
describe('RN-14 · integridad RACI (D-13)', () => {
  const a1 = b.actividad({ nombre: 'A1' })
  const a2 = b.actividad({ nombre: 'A2' })

  const asig = (actividadId: string, miembroId: string, letra: 'R' | 'A' | 'C' | 'I') => ({
    id: `${actividadId}-${miembroId}-${letra}`,
    creadoEn: '',
    creadoPor: '',
    actualizadoEn: '',
    actualizadoPor: '',
    proyectoId: 'p1',
    actividadId,
    miembroId,
    letra,
  })

  it('acepta exactamente una A con al menos una R', () => {
    const r = integridadRaci([a1], [asig(a1.id, 'm1', 'A'), asig(a1.id, 'm2', 'R')])
    expect(r[0].conforme).toBe(true)
    expect(r[0].problema).toBe('')
  })

  it('senala la ausencia de A', () => {
    const r = integridadRaci([a1], [asig(a1.id, 'm2', 'R')])
    expect(r[0].conforme).toBe(false)
    expect(r[0].problema).toContain('Sin responsable final')
  })

  it('senala la duplicidad de A', () => {
    const r = integridadRaci([a1], [asig(a1.id, 'm1', 'A'), asig(a1.id, 'm2', 'A'), asig(a1.id, 'm3', 'R')])
    expect(r[0].conteoA).toBe(2)
    expect(r[0].problema).toContain('2 responsables finales')
  })

  it('senala la ausencia de R', () => {
    const r = integridadRaci([a2], [asig(a2.id, 'm1', 'A')])
    expect(r[0].problema).toContain('Sin ejecutor')
  })

  it('ignora las asignaciones dadas de baja', () => {
    const r = integridadRaci([a1], [{ ...asig(a1.id, 'm1', 'A'), eliminado: true }])
    expect(r[0].conteoA).toBe(0)
  })

  it('una celda sostiene una sola letra: prevalece la ultima actualizada', () => {
    // Dos asignaciones para el mismo par actividad x persona: la matriz muestra
    // una sola letra, y el panel de integridad debe contar lo mismo que la matriz.
    const vieja = { ...asig(a1.id, 'm1', 'R'), actualizadoEn: '2026-01-01T00:00:00.000Z' }
    const nueva = { ...asig(a1.id, 'm1', 'A'), actualizadoEn: '2026-06-01T00:00:00.000Z' }
    const celdas = asignacionesPorCelda([vieja, nueva])
    expect(celdas.size).toBe(1)
    expect(celdas.get(`${a1.id}::m1`)?.letra).toBe('A')

    const r = integridadRaci([a1], [vieja, nueva])
    expect(r[0].conteoA).toBe(1)
    expect(r[0].conteoR).toBe(0)
    expect(r[0].conforme).toBe(false) // hay A pero no queda ningun R
  })

  it('separa correctamente las celdas de personas distintas', () => {
    const celdas = asignacionesPorCelda([asig(a1.id, 'm1', 'A'), asig(a1.id, 'm2', 'R')])
    expect(celdas.size).toBe(2)
    expect(integridadRaci([a1], [asig(a1.id, 'm1', 'A'), asig(a1.id, 'm2', 'R')])[0].conforme).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('RN-16 · hitos (D-06, D-07)', () => {
  it('cuenta como cumplido tanto Cumplido como Cumplido con retraso', () => {
    const [a, c] = calcularHitos(
      [b.hito({ estado: 'Cumplido' }), b.hito({ estado: 'Cumplido con retraso' })],
      ctx(),
    )
    expect(a.cumplido).toBe(true)
    expect(c.cumplido).toBe(true)
  })

  it('calcula la desviacion en dias entre programada y real', () => {
    const [h] = calcularHitos(
      [b.hito({ fechaProgramada: '2026-03-31', fechaReal: '2026-04-07', estado: 'Cumplido con retraso' })],
      ctx(),
    )
    expect(h.desviacionDias).toBe(7)
  })

  it('marca vencido el hito pendiente cuya fecha ya paso', () => {
    const [h] = calcularHitos([b.hito({ fechaProgramada: '2026-03-31', estado: 'Pendiente' })], ctx())
    expect(h.vencido).toBe(true)
    expect(h.diasParaVencer).toBeLessThan(0)
  })

  it('no marca vencido un hito ya cumplido ni uno declarado no cumplido', () => {
    const [cumplido, noCumplido] = calcularHitos(
      [
        b.hito({ fechaProgramada: '2026-01-31', estado: 'Cumplido', fechaReal: '2026-01-30' }),
        b.hito({ fechaProgramada: '2026-01-31', estado: 'No cumplido' }),
      ],
      ctx(),
    )
    expect(cumplido.vencido).toBe(false)
    expect(noCumplido.vencido).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('RN-17 · holgura y ruta critica (D-11)', () => {
  it('calcula holgura cero en una cadena secuencial', () => {
    const a1 = b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09' })
    const a2 = b.actividad({ fechaInicio: '2026-01-12', fechaFin: '2026-01-16', predecesoras: [a1.id] })
    const calc = calcularActividades([a1, a2], ctx())
    expect(calc.every((a) => a.holgura === 0)).toBe(true)
    expect(calc.every((a) => a.esCritica)).toBe(true)
  })

  it('da holgura positiva a una rama corta en paralelo', () => {
    const inicio = b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09' })
    const larga = b.actividad({ fechaInicio: '2026-01-12', fechaFin: '2026-02-20', predecesoras: [inicio.id] })
    const corta = b.actividad({ fechaInicio: '2026-01-12', fechaFin: '2026-01-16', predecesoras: [inicio.id] })
    const calc = calcularActividades([inicio, larga, corta], ctx())
    const h = (id: string) => calc.find((a) => a.id === id)!.holgura
    expect(h(larga.id)).toBe(0)
    expect(h(corta.id)).toBeGreaterThan(0)
    expect(calc.find((a) => a.id === corta.id)!.esCritica).toBe(false)
  })

  it('no cuelga ni marca ruta critica cuando hay un ciclo', () => {
    const a1 = b.actividad()
    const a2 = b.actividad({ predecesoras: [a1.id] })
    a1.predecesoras = [a2.id]
    const calc = calcularActividades([a1, a2], ctx())
    expect(calc.every((a) => a.holgura === null)).toBe(true)
    expect(detectarCiclos([a1, a2]).length).toBeGreaterThan(0)
  })

  it('no reporta ciclos en un grafo acíclico', () => {
    const a1 = b.actividad()
    const a2 = b.actividad({ predecesoras: [a1.id] })
    expect(detectarCiclos([a1, a2])).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
describe('RN-18 / RN-19 · recursos y equipo (D-09)', () => {
  it('cuenta la disponibilidad sobre la lista controlada unica', () => {
    const r = resumenRecursos([
      b.recurso({ disponibilidad: 'Por gestionar' }),
      b.recurso({ disponibilidad: 'Por gestionar' }),
      b.recurso({ disponibilidad: 'Disponible' }),
      b.recurso({ disponibilidad: 'No disponible' }),
      b.recurso({ disponibilidad: 'Reservado', eliminado: true }),
    ])
    expect(r.porGestionar).toBe(2)
    expect(r.disponibles).toBe(1)
    expect(r.noDisponibles).toBe(1)
    expect(r.total).toBe(4) // excluye la baja logica
  })

  it('suma la dedicacion del equipo en horas/mes', () => {
    const e = resumenEquipo([
      b.miembro({ dedicacionHorasMes: 80, estadoVinculacion: 'Contratado' }),
      b.miembro({ dedicacionHorasMes: 40, estadoVinculacion: 'Por definir' }),
    ])
    expect(e.dedicacionTotalHorasMes).toBe(120)
    expect(e.porDefinir).toBe(1)
    expect(e.contratados).toBe(1)
  })
})

// ---------------------------------------------------------------------------
describe('RN-21 / RN-22 / RN-23 · medicion', () => {
  it('el indice de satisfaccion controla la division por cero', () => {
    expect(indiceSatisfaccion({ encuestados: 10, satisfechos: 9 })).toBe(90)
    expect(indiceSatisfaccion({ encuestados: 0, satisfechos: 0 })).toBeNull()
  })

  it('la desviacion presupuestal se calcula en valor y en porcentaje', () => {
    expect(desviacionPresupuestal({ programado: 1000, ejecutado: 1100 })).toEqual({
      valor: 100,
      porcentaje: 10,
    })
    expect(desviacionPresupuestal({ programado: 0, ejecutado: 500 }).porcentaje).toBeNull()
  })

  it('D-15: la conformidad es booleana y exige evaluacion', () => {
    expect(esProductoConforme(b.producto({ evaluado: true, conforme: true }))).toBe(true)
    expect(esProductoConforme(b.producto({ evaluado: false, conforme: true }))).toBe(false)
    expect(esProductoConforme(b.producto({ evaluado: true, conforme: false }))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('RN-24 / RN-25 · semaforo del indicador', () => {
  it('mayor es mejor', () => {
    expect(estadoIndicador(96, 95, 'Mayor es mejor')).toBe('Cumple')
    expect(estadoIndicador(95, 95, 'Mayor es mejor')).toBe('Cumple')
    expect(estadoIndicador(90, 95, 'Mayor es mejor')).toBe('Atencion') // >= 95*0,9 = 85,5
    expect(estadoIndicador(80, 95, 'Mayor es mejor')).toBe('Critico')
  })

  it('menor es mejor', () => {
    expect(estadoIndicador(4, 5, 'Menor es mejor')).toBe('Cumple')
    expect(estadoIndicador(9, 5, 'Menor es mejor')).toBe('Atencion') // <= 5*2
    expect(estadoIndicador(11, 5, 'Menor es mejor')).toBe('Critico')
  })

  it('con meta cero admite una sola unidad de holgura', () => {
    // 0 x factor = 0, asi que la banda multiplicativa colapsa: un caso es
    // atencion, dos ya es critico.
    expect(estadoIndicador(0, 0, 'Menor es mejor')).toBe('Cumple')
    expect(estadoIndicador(1, 0, 'Menor es mejor')).toBe('Atencion')
    expect(estadoIndicador(2, 0, 'Menor es mejor')).toBe('Critico')
  })

  it('respeta factores personalizados', () => {
    expect(estadoIndicador(94, 95, 'Mayor es mejor', 0.99)).toBe('Critico')
  })

  it('sin valor devuelve Sin datos, nunca cero', () => {
    expect(estadoIndicador(null, 95, 'Mayor es mejor')).toBe('Sin datos')
    expect(estadoIndicador(Number.NaN, 95, 'Mayor es mejor')).toBe('Sin datos')
  })
})

// ---------------------------------------------------------------------------
describe('RN-27 / RN-28 · validaciones de captura', () => {
  it('el avance debe estar entre 0 y 100', () => {
    expect(validarAvance(50)).toBeNull()
    expect(validarAvance(-1)?.bloqueante).toBe(true)
    expect(validarAvance(101)?.bloqueante).toBe(true)
    expect(validarAvance('abc')?.bloqueante).toBe(true)
  })

  it('bloquea fin anterior a inicio y advierte al salir de la vigencia', () => {
    const vigencia = { inicio: '2026-01-01', fin: '2026-12-31' }
    const invertida = validarFechasActividad('2026-05-01', '2026-04-01', vigencia)
    expect(invertida.some((p) => p.bloqueante)).toBe(true)

    const fuera = validarFechasActividad('2025-12-01', '2026-02-01', vigencia)
    expect(fuera.some((p) => !p.bloqueante)).toBe(true)
    expect(fuera.some((p) => p.bloqueante)).toBe(false)

    expect(validarFechasActividad(null, null, vigencia)[0].bloqueante).toBe(true)
  })

  it('probabilidad e impacto son enteros de 1 a 5', () => {
    expect(validarRiesgo({ probabilidad: 3, impacto: 5 })).toHaveLength(0)
    expect(validarRiesgo({ probabilidad: 0, impacto: 6 })).toHaveLength(2)
    expect(validarRiesgo({ probabilidad: 2.5, impacto: 3 })).toHaveLength(1)
    expect(validarRiesgo({ probabilidad: null, impacto: null })).toHaveLength(0)
  })

  it('los satisfechos no superan a los encuestados', () => {
    expect(validarSatisfaccion({ encuestados: 10, satisfechos: 10 })).toHaveLength(0)
    expect(validarSatisfaccion({ encuestados: 10, satisfechos: 11 })).toHaveLength(1)
    expect(validarSatisfaccion({ encuestados: -1, satisfechos: 0 })).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
describe('resumen consolidado del proyecto', () => {
  it('produce todas las medidas del tablero sin lanzar con datos vacios', () => {
    const r = resumirProyecto(b.datos(), PARAMETROS)
    expect(r.avancePonderado).toBe(0)
    expect(r.avanceEsperado).toBe(0)
    expect(r.distribucion).toHaveLength(4)
    expect(r.retrasadas).toHaveLength(0)
    expect(r.entrega.mensaje).toBeTruthy()
    expect(r.desviacion.nivel).toBe('En linea')
  })

  it('integra actividades, hitos, riesgos, recursos y equipo', () => {
    const a1 = b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 })
    const a2 = b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 0 })
    const r = resumirProyecto(
      b.datos({
        actividades: [a1, a2],
        hitos: [b.hito({ fechaProgramada: '2026-02-01', estado: 'Pendiente' })],
        riesgos: [b.riesgo({ probabilidad: 5, impacto: 5 })],
        recursos: [b.recurso({ disponibilidad: 'Por gestionar' })],
        equipo: [b.miembro({ estadoVinculacion: 'Por definir' })],
      }),
      PARAMETROS,
    )
    expect(r.avancePonderado).toBe(50)
    expect(r.retrasadas).toHaveLength(1)
    expect(r.hitos[0].vencido).toBe(true)
    expect(r.riesgos[0].nivel).toBe('Critico')
    expect(r.recursos.porGestionar).toBe(1)
    expect(r.equipo.porDefinir).toBe(1)
  })

  it('excluye del calculo las entidades dadas de baja', () => {
    const r = resumirProyecto(
      b.datos({
        actividades: [
          b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 100 }),
          b.actividad({ fechaInicio: '2026-01-05', fechaFin: '2026-01-09', avance: 0, eliminado: true }),
        ],
      }),
      PARAMETROS,
    )
    expect(r.avancePonderado).toBe(100)
  })
})
