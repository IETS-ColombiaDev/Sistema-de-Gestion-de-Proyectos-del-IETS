/**
 * Constructores de datos para las pruebas del motor.
 * Mantienen las pruebas legibles: cada test declara solo lo que le importa.
 */

import { PARAMETROS_POR_DEFECTO } from '../catalogos'
import { festivosRango } from '../fechas'
import type {
  Actividad,
  DatosProyecto,
  Hito,
  MedicionSatisfaccion,
  MiembroEquipo,
  Parametros,
  Producto,
  Proyecto,
  Recurso,
  RegistroPresupuestal,
  Riesgo,
} from '../types'

const META = {
  creadoEn: '2026-01-01T00:00:00.000Z',
  creadoPor: 'test',
  actualizadoEn: '2026-01-01T00:00:00.000Z',
  actualizadoPor: 'test',
  eliminado: false,
}

export const PARAMETROS: Parametros = {
  ...PARAMETROS_POR_DEFECTO,
  festivos: festivosRango(2025, 2028),
}

export function proyecto(over: Partial<Proyecto> = {}): Proyecto {
  return {
    id: 'p1',
    ...META,
    codigo: 'TEST-001',
    nombre: 'Proyecto de prueba',
    tecnologiaObjeto: '',
    alcance: '',
    objetivoGeneral: '',
    objetivosEspecificos: [],
    marcoMetodologico: '',
    productosComprometidos: [],
    entidadEjecutora: '',
    financiador: '',
    liderUid: null,
    liderNombre: '',
    fechaInicio: '2026-01-01',
    fechaEntregaFinal: '2026-12-31',
    fechaCorte: '2026-06-30',
    estado: 'activo',
    fases: [
      { id: 'f1', orden: 1, nombre: 'Planeacion', activa: true },
      { id: 'f2', orden: 2, nombre: 'Ejecucion', activa: true },
    ],
    modoCalculo: 'saneado',
    accesos: {},
    moneda: 'COP',
    ...over,
  }
}

let n = 0
export function actividad(over: Partial<Actividad> = {}): Actividad {
  n += 1
  return {
    id: `a${n}`,
    ...META,
    proyectoId: 'p1',
    numero: n,
    orden: n,
    faseId: 'f1',
    nombre: `Actividad ${n}`,
    responsableId: null,
    responsableNombre: '',
    apoyoIds: [],
    fechaInicio: '2026-01-05',
    fechaFin: '2026-01-09',
    avance: 0,
    predecesoras: [],
    ...over,
  }
}

export function hito(over: Partial<Hito> = {}): Hito {
  return {
    id: `h${Math.random().toString(36).slice(2, 8)}`,
    ...META,
    proyectoId: 'p1',
    orden: 1,
    descripcion: 'Hito',
    criterioCumplimiento: 'Criterio',
    fechaProgramada: '2026-03-31',
    fechaReal: null,
    estado: 'Pendiente',
    condicionante: false,
    actividadesIds: [],
    evidencias: [],
    ...over,
  }
}

export function riesgo(over: Partial<Riesgo> = {}): Riesgo {
  return {
    id: `r${Math.random().toString(36).slice(2, 8)}`,
    ...META,
    proyectoId: 'p1',
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
    ...over,
  }
}

export function recurso(over: Partial<Recurso> = {}): Recurso {
  return {
    id: `rc${Math.random().toString(36).slice(2, 8)}`,
    ...META,
    proyectoId: 'p1',
    tipo: 'Humano',
    descripcion: 'Recurso',
    cantidad: '1',
    fasesIds: ['f1'],
    disponibilidad: 'Por gestionar',
    ...over,
  }
}

export function producto(over: Partial<Producto> = {}): Producto {
  return {
    id: `pd${Math.random().toString(36).slice(2, 8)}`,
    ...META,
    proyectoId: 'p1',
    entregable: 'Producto',
    actividadesIds: [],
    fechaEntrega: '2026-02-01',
    fechaEvaluacion: '2026-02-10',
    evaluado: true,
    conforme: true,
    responsableNombre: '',
    evidencias: [],
    ...over,
  }
}

export function medicion(over: Partial<MedicionSatisfaccion> = {}): MedicionSatisfaccion {
  return {
    id: `s${Math.random().toString(36).slice(2, 8)}`,
    ...META,
    proyectoId: 'p1',
    periodo: '2026-03',
    grupo: 'Equipo',
    encuestados: 10,
    satisfechos: 9,
    instrumento: 'Encuesta en linea',
    responsableNombre: '',
    ...over,
  }
}

export function presupuesto(over: Partial<RegistroPresupuestal> = {}): RegistroPresupuestal {
  return {
    id: `pr${Math.random().toString(36).slice(2, 8)}`,
    ...META,
    proyectoId: 'p1',
    periodo: '2026-03',
    rubro: 'Talento humano',
    fuente: 'Recursos propios',
    programado: 1000,
    ejecutado: 1000,
    responsableNombre: '',
    ...over,
  }
}

export function miembro(over: Partial<MiembroEquipo> = {}): MiembroEquipo {
  return {
    id: `m${Math.random().toString(36).slice(2, 8)}`,
    ...META,
    proyectoId: 'p1',
    perfil: 'Analista',
    nombre: 'Persona',
    porDesignar: false,
    usuarioUid: null,
    dedicacionHorasMes: 80,
    mesesVinculacion: 6,
    estadoVinculacion: 'Contratado',
    ...over,
  }
}

export function datos(over: Partial<DatosProyecto> = {}): DatosProyecto {
  return {
    proyecto: proyecto(),
    equipo: [],
    actividades: [],
    hitos: [],
    raci: [],
    riesgos: [],
    recursos: [],
    productos: [],
    satisfaccion: [],
    presupuesto: [],
    ...over,
  }
}
