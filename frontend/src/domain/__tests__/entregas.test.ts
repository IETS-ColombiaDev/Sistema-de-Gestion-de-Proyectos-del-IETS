import { describe, expect, it } from 'vitest'
import {
  UMBRAL_APROBACION,
  calificar,
  estadoDeEntrega,
  listaPara,
  resumirEntregas,
  revisarEnlace,
  veredictoDe,
  versionesDe,
} from '../entregas'
import type { Entrega, ItemChequeo, ListaChequeo, ResultadoItem } from '../types'

const AHORA = '2026-09-23T10:00:00.000Z'

function item(id: string, obligatorio = false): ItemChequeo {
  return { id, texto: `Item ${id}`, obligatorio }
}

function entrega(over: Partial<Entrega> = {}): Entrega {
  return {
    id: 'e1',
    proyectoId: 'p1',
    actividadId: null,
    productoId: null,
    tipo: 'Entregable',
    titulo: 'Informe preliminar',
    enlace: 'https://iets-my.sharepoint.com/:w:/g/documento',
    entregadoPor: 'eq1',
    entregadoPorNombre: 'Juliana Bermudez',
    fechaEntrega: '2026-09-20',
    version: 1,
    reemplazaA: null,
    estado: 'Entregada',
    evaluacion: null,
    creadoEn: AHORA,
    creadoPor: 'u1',
    actualizadoEn: AHORA,
    actualizadoPor: 'u1',
    ...over,
  }
}

describe('enlace del entregable', () => {
  it('acepta un enlace del repositorio institucional', () => {
    const r = revisarEnlace('https://iets-my.sharepoint.com/:w:/g/personal/doc.docx')
    expect(r.valido).toBe(true)
    expect(r.dominio).toBe('sharepoint.com')
  })

  it('acepta el enlace corto de OneDrive', () => {
    expect(revisarEnlace('https://1drv.ms/w/s!Abc123').valido).toBe(true)
  })

  it('rechaza un repositorio que no es el institucional', () => {
    const r = revisarEnlace('https://drive.google.com/file/d/abc/view')
    expect(r.valido).toBe(false)
    expect(r.motivo).toContain('institucional')
  })

  it('rechaza http, porque el entregable viajaria en claro', () => {
    expect(revisarEnlace('http://iets-my.sharepoint.com/doc').valido).toBe(false)
  })

  it('rechaza texto que no es una direccion', () => {
    expect(revisarEnlace('el archivo esta en mi carpeta').valido).toBe(false)
    expect(revisarEnlace('  ').motivo).toContain('Falta el enlace')
  })
})

describe('calificacion de la lista de chequeo', () => {
  const items = [item('a'), item('b'), item('c', true)]

  it('un item sin revisar no cuenta como incumplido', () => {
    const resultados: ResultadoItem[] = [
      { itemId: 'a', cumple: true },
      { itemId: 'b', cumple: null },
      { itemId: 'c', cumple: null },
    ]
    const c = calificar(items, resultados)
    expect(c.revisados).toBe(1)
    expect(c.puntaje).toBe(100)
    expect(c.completa).toBe(false)
  })

  it('el puntaje se calcula sobre lo revisado', () => {
    const c = calificar(items, [
      { itemId: 'a', cumple: true },
      { itemId: 'b', cumple: false },
      { itemId: 'c', cumple: true },
    ])
    expect(c.puntaje).toBe(67)
    expect(c.completa).toBe(true)
    expect(c.obligatoriosIncumplidos).toHaveLength(0)
  })

  it('senala los obligatorios incumplidos', () => {
    const c = calificar(items, [
      { itemId: 'a', cumple: true },
      { itemId: 'b', cumple: true },
      { itemId: 'c', cumple: false },
    ])
    expect(c.obligatoriosIncumplidos).toEqual(['c'])
  })

  it('sin items revisados no divide por cero', () => {
    expect(calificar(items, []).puntaje).toBe(0)
  })
})

describe('veredicto', () => {
  const items = [item('a'), item('b'), item('c'), item('d'), item('e', true)]

  it('todo cumplido aprueba sin observaciones', () => {
    const c = calificar(items, items.map((i) => ({ itemId: i.id, cumple: true })))
    expect(veredictoDe(c)).toBe('Aprobada')
  })

  it('por encima del umbral pero incompleto aprueba con observaciones', () => {
    const c = calificar(items, [
      { itemId: 'a', cumple: true },
      { itemId: 'b', cumple: true },
      { itemId: 'c', cumple: true },
      { itemId: 'd', cumple: false },
      { itemId: 'e', cumple: true },
    ])
    expect(c.puntaje).toBe(80)
    expect(c.puntaje).toBeGreaterThanOrEqual(UMBRAL_APROBACION)
    expect(veredictoDe(c)).toBe('Aprobada con observaciones')
  })

  it('un obligatorio incumplido devuelve la entrega aunque el puntaje sea alto', () => {
    const c = calificar(items, [
      { itemId: 'a', cumple: true },
      { itemId: 'b', cumple: true },
      { itemId: 'c', cumple: true },
      { itemId: 'd', cumple: true },
      { itemId: 'e', cumple: false },
    ])
    expect(c.puntaje).toBe(80)
    expect(veredictoDe(c)).toBe('Devuelta')
  })

  it('por debajo del umbral devuelve', () => {
    const c = calificar(items, [
      { itemId: 'a', cumple: true },
      { itemId: 'b', cumple: false },
      { itemId: 'c', cumple: false },
      { itemId: 'd', cumple: false },
      { itemId: 'e', cumple: true },
    ])
    expect(veredictoDe(c)).toBe('Devuelta')
  })

  it('sin evaluacion la entrega solo esta entregada', () => {
    expect(estadoDeEntrega(null)).toBe('Entregada')
  })
})

describe('listas de chequeo del catalogo', () => {
  const listas: ListaChequeo[] = [
    {
      id: 'l1',
      tipo: 'Encuesta',
      nombre: 'Encuesta',
      items: [item('a')],
      activa: true,
      creadoEn: AHORA,
      creadoPor: 'u1',
      actualizadoEn: AHORA,
      actualizadoPor: 'u1',
    },
    {
      id: 'l2',
      tipo: 'Informe',
      nombre: 'Informe (retirada)',
      items: [item('b')],
      activa: false,
      creadoEn: AHORA,
      creadoPor: 'u1',
      actualizadoEn: AHORA,
      actualizadoPor: 'u1',
    },
  ]

  it('devuelve la lista activa del tipo', () => {
    expect(listaPara('Encuesta', listas)?.id).toBe('l1')
  })

  it('no devuelve una lista retirada', () => {
    expect(listaPara('Informe', listas)).toBeNull()
  })

  it('un tipo sin lista no rompe: devuelve null', () => {
    expect(listaPara('Otro', listas)).toBeNull()
  })
})

describe('resumen de entregas', () => {
  it('solo la ultima version cuenta para los totales', () => {
    const v1 = entrega({
      id: 'e1',
      version: 1,
      estado: 'Devuelta',
      evaluacion: {
        evaluadaPor: 'u-lider',
        evaluadaPorNombre: 'Marcela Ortiz',
        evaluadaEn: AHORA,
        listaId: 'l1',
        resultados: [],
        puntaje: 50,
        veredicto: 'Devuelta',
        comentario: 'Faltan tablas.',
      },
    })
    const v2 = entrega({
      id: 'e2',
      version: 2,
      reemplazaA: 'e1',
      fechaEntrega: '2026-09-22',
      estado: 'Aprobada',
      evaluacion: {
        evaluadaPor: 'u-lider',
        evaluadaPorNombre: 'Marcela Ortiz',
        evaluadaEn: AHORA,
        listaId: 'l1',
        resultados: [],
        puntaje: 100,
        veredicto: 'Aprobada',
        comentario: 'Corregido.',
      },
    })

    const r = resumirEntregas([v1, v2])
    expect(r.total).toBe(1)
    expect(r.aprobadas).toBe(1)
    expect(r.devueltas).toBe(0)
    expect(r.puntajeMedio).toBe(100)
  })

  it('cuenta lo que nadie ha evaluado todavia', () => {
    const r = resumirEntregas([entrega({ id: 'a' }), entrega({ id: 'b' })])
    expect(r.pendientesDeEvaluar).toBe(2)
    expect(r.puntajeMedio).toBeNull()
  })

  it('ignora las entregas dadas de baja', () => {
    expect(resumirEntregas([entrega({ eliminado: true })]).total).toBe(0)
  })

  it('reconstruye el historial de versiones', () => {
    const v1 = entrega({ id: 'e1', version: 1 })
    const v2 = entrega({ id: 'e2', version: 2, reemplazaA: 'e1' })
    const v3 = entrega({ id: 'e3', version: 3, reemplazaA: 'e2' })
    expect(versionesDe(v3, [v1, v2, v3]).map((e) => e.version)).toEqual([3, 2, 1])
  })

  it('un encadenamiento circular no cuelga el recorrido', () => {
    const a = entrega({ id: 'a', reemplazaA: 'b' })
    const b = entrega({ id: 'b', reemplazaA: 'a' })
    expect(versionesDe(a, [a, b]).length).toBeLessThan(60)
  })
})
