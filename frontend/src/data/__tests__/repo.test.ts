/**
 * Pruebas de la capa de persistencia: CRUD completo, baja logica y auditoria.
 *
 * Se ejecutan contra el adaptador en memoria, que implementa el mismo contrato
 * que IndexedDB y Firestore. Lo que se verifica aqui —que toda escritura deja
 * traza y que nada se borra fisicamente— es independiente del backend.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { crearAdaptadorMemoria } from '../localAdapter'
import { fijarAdaptador } from '../backend'
import { rutas } from '../adapter'
import {
  cargarDatosProyecto,
  consultarAuditoria,
  eliminarEntidad,
  fijarSesionRepo,
  guardarEntidad,
  guardarLoteEntidades,
  guardarLista,
  guardarParametros,
  guardarUsuario,
  historialEntidad,
  limpiarRecalculoPendiente,
  listarProyectos,
  listarSnapshots,
  listarVigentes,
  obtenerCatalogoIndicadores,
  obtenerListas,
  obtenerParametros,
  obtenerProyecto,
  registrarEventoSimple,
  restaurarEntidad,
  guardarSnapshot,
} from '../repo'
import { calcularCambios, exigeComentario } from '../auditoria'
import type { Actividad, Proyecto, Riesgo } from '@/domain/types'

const BASE_PROYECTO: Partial<Proyecto> = {
  codigo: 'TEST-001',
  nombre: 'Proyecto de prueba',
  tecnologiaObjeto: '',
  alcance: '',
  objetivoGeneral: '',
  objetivosEspecificos: [],
  marcoMetodologico: '',
  productosComprometidos: [],
  entidadEjecutora: 'IETS',
  financiador: '',
  liderUid: 'u1',
  liderNombre: 'Lider',
  fechaInicio: '2026-01-01',
  fechaEntregaFinal: '2026-12-31',
  fechaCorte: '2026-06-30',
  estado: 'activo',
  fases: [{ id: 'f1', orden: 1, nombre: 'Planeacion', activa: true }],
  modoCalculo: 'saneado',
  accesos: {},
  moneda: 'COP',
}

async function crearProyecto(): Promise<Proyecto> {
  return guardarEntidad<Proyecto>(rutas.proyectos(), BASE_PROYECTO, {
    proyectoId: null,
    entidad: 'proyecto',
    etiqueta: 'TEST-001',
    tipoCambio: 'Otro',
  })
}

beforeEach(() => {
  fijarAdaptador(crearAdaptadorMemoria())
  fijarSesionRepo('u1', 'Usuaria de prueba')
})

// ---------------------------------------------------------------------------
describe('CRUD de entidades', () => {
  it('crea y lee un proyecto con sus metadatos', async () => {
    const p = await crearProyecto()
    expect(p.id).toBeTruthy()
    expect(p.creadoPor).toBe('u1')
    expect(p.creadoEn).toBeTruthy()
    expect(p.actualizadoEn).toBeTruthy()

    const leido = await obtenerProyecto(p.id)
    expect(leido?.codigo).toBe('TEST-001')
    expect(await listarProyectos()).toHaveLength(1)
  })

  it('actualiza sin perder los metadatos de creacion', async () => {
    const p = await crearProyecto()
    const actualizado = await guardarEntidad<Proyecto>(
      rutas.proyectos(),
      { id: p.id, nombre: 'Nombre corregido' },
      { proyectoId: p.id, entidad: 'proyecto', etiqueta: 'TEST-001', tipoCambio: 'Otro' },
    )
    expect(actualizado.nombre).toBe('Nombre corregido')
    expect(actualizado.codigo).toBe('TEST-001') // no se pierden los campos ausentes
    expect(actualizado.creadoEn).toBe(p.creadoEn)
  })

  it('una actualizacion sin cambios reales no reescribe ni audita', async () => {
    const p = await crearProyecto()
    const antes = (await consultarAuditoria()).length
    await guardarEntidad<Proyecto>(
      rutas.proyectos(),
      { id: p.id, nombre: p.nombre },
      { proyectoId: p.id, entidad: 'proyecto', etiqueta: 'TEST-001', tipoCambio: 'Otro' },
    )
    expect((await consultarAuditoria()).length).toBe(antes)
  })

  it('la baja es logica: el documento permanece y desaparece de las consultas', async () => {
    const p = await crearProyecto()
    const act = await guardarEntidad<Actividad>(
      rutas.actividades(p.id),
      {
        proyectoId: p.id,
        numero: 1,
        orden: 1,
        faseId: 'f1',
        nombre: 'Actividad 1',
        responsableId: null,
        responsableNombre: '',
        apoyoIds: [],
        fechaInicio: '2026-02-02',
        fechaFin: '2026-02-06',
        avance: 0,
        predecesoras: [],
      },
      { proyectoId: p.id, entidad: 'actividad', etiqueta: 'Actividad 1', tipoCambio: 'Actividad' },
    )

    expect(await listarVigentes<Actividad>(rutas.actividades(p.id))).toHaveLength(1)

    await eliminarEntidad<Actividad>(rutas.actividades(p.id), act.id, {
      proyectoId: p.id,
      entidad: 'actividad',
      etiqueta: 'Actividad 1',
      tipoCambio: 'Actividad',
      comentario: 'Duplicada',
    })

    expect(await listarVigentes<Actividad>(rutas.actividades(p.id))).toHaveLength(0)

    // El documento sigue ahi, marcado.
    const datos = await cargarDatosProyecto(p.id)
    expect(datos?.actividades).toHaveLength(0)

    await restaurarEntidad<Actividad>(rutas.actividades(p.id), act.id, {
      proyectoId: p.id,
      entidad: 'actividad',
      etiqueta: 'Actividad 1',
      tipoCambio: 'Actividad',
    })
    expect(await listarVigentes<Actividad>(rutas.actividades(p.id))).toHaveLength(1)
  })

  it('cargarDatosProyecto devuelve null para un proyecto inexistente', async () => {
    expect(await cargarDatosProyecto('no-existe')).toBeNull()
  })

  it('cargarDatosProyecto devuelve null para un proyecto dado de baja', async () => {
    const p = await crearProyecto()
    await eliminarEntidad<Proyecto>(rutas.proyectos(), p.id, {
      proyectoId: p.id,
      entidad: 'proyecto',
      etiqueta: 'TEST-001',
      tipoCambio: 'Decision',
    })
    expect(await cargarDatosProyecto(p.id)).toBeNull()
    expect(await listarProyectos()).toHaveLength(0)
  })

  it('ordena las colecciones al cargar el agregado del proyecto', async () => {
    const p = await crearProyecto()
    for (const [orden, nombre] of [
      [3, 'Tercera'],
      [1, 'Primera'],
      [2, 'Segunda'],
    ] as const) {
      await guardarEntidad<Actividad>(
        rutas.actividades(p.id),
        {
          proyectoId: p.id,
          numero: orden,
          orden,
          faseId: 'f1',
          nombre,
          responsableId: null,
          responsableNombre: '',
          apoyoIds: [],
          fechaInicio: '2026-02-02',
          fechaFin: '2026-02-06',
          avance: 0,
          predecesoras: [],
        },
        { proyectoId: p.id, entidad: 'actividad', etiqueta: nombre, tipoCambio: 'Actividad' },
      )
    }
    const datos = await cargarDatosProyecto(p.id)
    expect(datos?.actividades.map((a) => a.nombre)).toEqual(['Primera', 'Segunda', 'Tercera'])
  })
})

// ---------------------------------------------------------------------------
describe('auditoria automatica', () => {
  it('registra un evento por campo modificado, con valor anterior y nuevo', async () => {
    const p = await crearProyecto()
    await guardarEntidad<Proyecto>(
      rutas.proyectos(),
      { id: p.id, nombre: 'Nuevo nombre', financiador: 'Entidad X' },
      {
        proyectoId: p.id,
        entidad: 'proyecto',
        etiqueta: 'TEST-001',
        tipoCambio: 'Otro',
        comentario: 'Correccion de la ficha',
      },
    )

    const eventos = await consultarAuditoria({ proyectoId: p.id, entidad: 'proyecto' })
    const porNombre = eventos.find((e) => e.campo === 'nombre')
    expect(porNombre?.valorAnterior).toBe('Proyecto de prueba')
    expect(porNombre?.valorNuevo).toBe('Nuevo nombre')
    expect(porNombre?.accion).toBe('actualizar')
    expect(porNombre?.usuarioNombre).toBe('Usuaria de prueba')
    expect(porNombre?.comentario).toBe('Correccion de la ficha')

    expect(eventos.some((e) => e.campo === 'financiador')).toBe(true)
  })

  it('el historial de una entidad es consultable y esta ordenado del mas reciente al mas antiguo', async () => {
    const p = await crearProyecto()
    await guardarEntidad<Proyecto>(
      rutas.proyectos(),
      { id: p.id, nombre: 'v2' },
      { proyectoId: p.id, entidad: 'proyecto', etiqueta: 'TEST-001', tipoCambio: 'Otro' },
    )
    const h = await historialEntidad('proyecto', p.id)
    expect(h.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < h.length; i++) {
      expect(h[i - 1].fechaHora >= h[i].fechaHora).toBe(true)
    }
  })

  it('la baja logica queda registrada como accion "eliminar"', async () => {
    const p = await crearProyecto()
    await eliminarEntidad<Proyecto>(rutas.proyectos(), p.id, {
      proyectoId: p.id,
      entidad: 'proyecto',
      etiqueta: 'TEST-001',
      tipoCambio: 'Decision',
      comentario: 'Cancelado por la entidad',
    })
    const eventos = await consultarAuditoria({ entidadId: p.id })
    const baja = eventos.find((e) => e.accion === 'eliminar')
    expect(baja?.valorNuevo).toBe('true')
    expect(baja?.comentario).toBe('Cancelado por la entidad')
  })

  it('filtra por usuario, tipo de cambio, entidad, rango de fechas y texto libre', async () => {
    const p = await crearProyecto()
    fijarSesionRepo('u2', 'Otra usuaria')
    await guardarEntidad<Proyecto>(
      rutas.proyectos(),
      { id: p.id, financiador: 'Cooperacion internacional' },
      { proyectoId: p.id, entidad: 'proyecto', etiqueta: 'TEST-001', tipoCambio: 'Decision' },
    )

    expect((await consultarAuditoria({ usuarioUid: 'u2' })).length).toBeGreaterThan(0)
    expect((await consultarAuditoria({ usuarioUid: 'u9' })).length).toBe(0)
    expect((await consultarAuditoria({ tipoCambio: 'Decision' })).length).toBeGreaterThan(0)
    expect((await consultarAuditoria({ entidad: 'proyecto' })).length).toBeGreaterThan(0)
    expect((await consultarAuditoria({ texto: 'cooperacion' })).length).toBeGreaterThan(0)
    expect((await consultarAuditoria({ desde: '2099-01-01' })).length).toBe(0)
  })

  it('registra eventos sin entidad de negocio: accesos, calculos y exportaciones', async () => {
    await registrarEventoSimple('acceso', 'sesion', 'usuaria@iets.org.co', null, 'Ingreso local')
    await registrarEventoSimple('exportar', 'proyecto', 'TEST-001', 'p1', 'Excel completo')
    const eventos = await consultarAuditoria()
    expect(eventos.some((e) => e.accion === 'acceso')).toBe(true)
    expect(eventos.some((e) => e.accion === 'exportar')).toBe(true)
  })

  it('el diff ignora los metadatos de la propia escritura', () => {
    const cambios = calcularCambios(
      { nombre: 'A', actualizadoEn: 'x', actualizadoPor: 'u1', creadoEn: 'y' },
      { nombre: 'A', actualizadoEn: 'z', actualizadoPor: 'u2', creadoEn: 'y' },
    )
    expect(cambios).toHaveLength(0)
  })

  it('identifica los campos que exigen justificacion', () => {
    expect(exigeComentario('hito', ['fechaProgramada'])).toBe(true)
    expect(exigeComentario('producto', ['conforme'])).toBe(true)
    expect(exigeComentario('actividad', ['avance'])).toBe(false)
    expect(exigeComentario('desconocida', ['estado'])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('escritura en lote (edicion masiva de avance)', () => {
  it('guarda varios cambios y audita cada uno', async () => {
    const p = await crearProyecto()
    const ids: string[] = []
    for (let i = 1; i <= 3; i++) {
      const a = await guardarEntidad<Actividad>(
        rutas.actividades(p.id),
        {
          proyectoId: p.id,
          numero: i,
          orden: i,
          faseId: 'f1',
          nombre: `Actividad ${i}`,
          responsableId: null,
          responsableNombre: '',
          apoyoIds: [],
          fechaInicio: '2026-02-02',
          fechaFin: '2026-02-06',
          avance: 0,
          predecesoras: [],
        },
        { proyectoId: p.id, entidad: 'actividad', etiqueta: `Actividad ${i}`, tipoCambio: 'Actividad' },
      )
      ids.push(a.id)
    }

    await guardarLoteEntidades<Actividad>(
      rutas.actividades(p.id),
      ids.map((id, i) => ({ id, avance: (i + 1) * 25 })),
      {
        proyectoId: p.id,
        entidad: 'actividad',
        tipoCambio: 'Actividad',
        etiquetaDe: (a) => `Actividad ${a.id}`,
      },
    )

    const acts = await listarVigentes<Actividad>(rutas.actividades(p.id))
    expect(acts.map((a) => a.avance).sort((x, y) => x - y)).toEqual([25, 50, 75])

    const eventos = await consultarAuditoria({ proyectoId: p.id, entidad: 'actividad' })
    expect(eventos.filter((e) => e.campo === 'avance')).toHaveLength(3)
  })

  it('omite del lote los registros que no cambian', async () => {
    const p = await crearProyecto()
    const a = await guardarEntidad<Actividad>(
      rutas.actividades(p.id),
      {
        proyectoId: p.id,
        numero: 1,
        orden: 1,
        faseId: 'f1',
        nombre: 'A',
        responsableId: null,
        responsableNombre: '',
        apoyoIds: [],
        fechaInicio: '2026-02-02',
        fechaFin: '2026-02-06',
        avance: 40,
        predecesoras: [],
      },
      { proyectoId: p.id, entidad: 'actividad', etiqueta: 'A', tipoCambio: 'Actividad' },
    )
    const antes = (await consultarAuditoria()).length
    await guardarLoteEntidades<Actividad>(
      rutas.actividades(p.id),
      [{ id: a.id, avance: 40 }],
      { proyectoId: p.id, entidad: 'actividad', tipoCambio: 'Actividad', etiquetaDe: () => 'A' },
    )
    expect((await consultarAuditoria()).length).toBe(antes)
  })
})

// ---------------------------------------------------------------------------
describe('marca de recalculo pendiente', () => {
  it('toda escritura de negocio marca el proyecto y el recalculo la limpia', async () => {
    const p = await crearProyecto()
    await limpiarRecalculoPendiente(p.id)
    expect((await obtenerProyecto(p.id))?.recalculoPendiente).toBe(false)

    await guardarEntidad<Riesgo>(
      rutas.riesgos(p.id),
      {
        proyectoId: p.id,
        codigo: 'R-001',
        categoria: 'Tecnico',
        descripcion: 'Riesgo',
        probabilidad: 3,
        impacto: 3,
        planRespuesta: '',
        responsableNombre: '',
        estado: 'Identificado',
        fechaIdentificacion: '2026-01-01',
        historial: [],
      },
      { proyectoId: p.id, entidad: 'riesgo', etiqueta: 'R-001', tipoCambio: 'Riesgo' },
    )
    expect((await obtenerProyecto(p.id))?.recalculoPendiente).toBe(true)

    await limpiarRecalculoPendiente(p.id)
    const limpio = await obtenerProyecto(p.id)
    expect(limpio?.recalculoPendiente).toBe(false)
    expect(limpio?.recalculadoEn).toBeTruthy()
  })

  it('una escritura marcada como no invalidante no ensucia el calculo', async () => {
    const p = await crearProyecto()
    await limpiarRecalculoPendiente(p.id)
    await guardarEntidad<Proyecto>(
      rutas.proyectos(),
      { id: p.id, accesos: { u2: 'gestor' } },
      {
        proyectoId: p.id,
        entidad: 'proyecto',
        etiqueta: 'TEST-001',
        tipoCambio: 'Decision',
        invalidaCalculo: false,
      },
    )
    expect((await obtenerProyecto(p.id))?.recalculoPendiente).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('catalogos', () => {
  it('siembra los parametros por defecto en la primera lectura', async () => {
    const p = await obtenerParametros()
    expect(p.ventanaAlertaDias).toBe(14)
    expect(p.umbralAtencion).toBe(10)
    expect(p.festivos.length).toBeGreaterThan(50)
    expect('id' in p).toBe(false) // no filtra el id del documento
  })

  it('guarda parametros y audita el cambio', async () => {
    const p = await obtenerParametros()
    await guardarParametros({ ...p, ventanaAlertaDias: 30 }, 'Ajuste institucional')
    expect((await obtenerParametros()).ventanaAlertaDias).toBe(30)
    const eventos = await consultarAuditoria({ entidad: 'parametros' })
    expect(eventos.some((e) => e.campo === 'ventanaAlertaDias' && e.valorNuevo === '30')).toBe(true)
  })

  it('siembra las listas controladas y conserva las no editables', async () => {
    const listas = await obtenerListas()
    expect(listas.length).toBeGreaterThan(10)
    const estadoActividad = listas.find((l) => l.id === 'estadoActividad')
    expect(estadoActividad?.editable).toBe(false)
    expect(estadoActividad?.valores.map((v) => v.valor)).toEqual([
      'Pendiente',
      'En curso',
      'Completada',
      'Retrasada',
    ])
  })

  it('guarda una lista editada y la audita', async () => {
    const listas = await obtenerListas()
    const categoria = listas.find((l) => l.id === 'categoriaRiesgo')!
    await guardarLista(
      { ...categoria, valores: [...categoria.valores, { valor: 'Reputacional', activo: true, orden: 99 }] },
      'Nueva categoria institucional',
    )
    const despues = await obtenerListas()
    expect(despues.find((l) => l.id === 'categoriaRiesgo')!.valores.some((v) => v.valor === 'Reputacional')).toBe(
      true,
    )
    expect((await consultarAuditoria({ entidad: 'lista' })).length).toBeGreaterThan(0)
  })

  it('siembra el catalogo de indicadores con los diez institucionales', async () => {
    const catalogo = await obtenerCatalogoIndicadores()
    expect(catalogo).toHaveLength(10)
    expect(catalogo.map((d) => d.codigo)).toContain('RIES-002')
  })
})

// ---------------------------------------------------------------------------
describe('usuarios y snapshots', () => {
  it('guarda un usuario y lo audita solo cuando cambia algo', async () => {
    const base = {
      uid: 'u9',
      correo: 'prueba@iets.org.co',
      nombre: 'Persona de prueba',
      rolGlobal: 'gestor' as const,
      activo: true,
      creadoEn: new Date().toISOString(),
    }
    await guardarUsuario(base)
    const antes = (await consultarAuditoria({ entidad: 'usuario' })).length
    await guardarUsuario(base)
    expect((await consultarAuditoria({ entidad: 'usuario' })).length).toBe(antes)

    await guardarUsuario({ ...base, rolGlobal: 'lider' })
    const eventos = await consultarAuditoria({ entidad: 'usuario' })
    expect(eventos.some((e) => e.campo === 'rolGlobal' && e.valorNuevo === 'lider')).toBe(true)
  })

  it('guarda instantaneas por fecha de corte y las devuelve ordenadas', async () => {
    const p = await crearProyecto()
    for (const fechaCorte of ['2026-06-30', '2026-03-31']) {
      await guardarSnapshot({
        id: fechaCorte,
        proyectoId: p.id,
        fechaCorte,
        creadoEn: new Date().toISOString(),
        creadoPor: 'u1',
        indicadores: [],
        avancePonderado: 50,
        avanceEsperado: 60,
        avanceSimple: 55,
        desviacion: -10,
        actividadesPorEstado: {},
        riesgosPorNivel: {},
      })
    }
    const snaps = await listarSnapshots(p.id)
    expect(snaps.map((s) => s.fechaCorte)).toEqual(['2026-03-31', '2026-06-30'])
  })
})

// ---------------------------------------------------------------------------
describe('forma de los eventos de alta', () => {
  it('un alta produce un solo evento resumido, no uno por campo', async () => {
    const p = await crearProyecto()
    const eventos = await consultarAuditoria({ entidadId: p.id })
    const altas = eventos.filter((e) => e.accion === 'crear')
    expect(altas).toHaveLength(1)
    expect(altas[0].campo).toBeNull()
    expect(altas[0].valorNuevo).toContain('Registro creado con')
  })

  it('una actualizacion si produce un evento por campo modificado', async () => {
    const p = await crearProyecto()
    await guardarEntidad<Proyecto>(
      rutas.proyectos(),
      { id: p.id, nombre: 'A', financiador: 'B', alcance: 'C' },
      { proyectoId: p.id, entidad: 'proyecto', etiqueta: 'TEST-001', tipoCambio: 'Otro' },
    )
    const actualizaciones = (await consultarAuditoria({ entidadId: p.id })).filter(
      (e) => e.accion === 'actualizar',
    )
    expect(actualizaciones).toHaveLength(3)
    expect(actualizaciones.every((e) => e.campo !== null)).toBe(true)
  })
})
