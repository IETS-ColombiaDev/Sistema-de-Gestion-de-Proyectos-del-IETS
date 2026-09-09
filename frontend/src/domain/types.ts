/**
 * Modelo de datos de HIGEP Web.
 * Corresponde a la seccion 4 del backlog tecnologico.
 * Convencion: las fechas se persisten como ISO 'YYYY-MM-DD' (sin hora, sin zona)
 * para que la fecha de corte sea estable entre husos horarios.
 */

export type ISODate = string // 'YYYY-MM-DD'
export type ISODateTime = string // ISO 8601 completo

// ---------------------------------------------------------------------------
// Roles y usuarios (seccion 6)
// ---------------------------------------------------------------------------

export const ROLES = [
  'administrador',
  'lider',
  'gestor',
  'miembro',
  'directivo',
  'auditor',
] as const
export type Rol = (typeof ROLES)[number]

export interface Usuario {
  uid: string
  correo: string
  nombre: string
  rolGlobal: Rol
  /** Rol por proyecto; prevalece sobre el global dentro de ese proyecto. */
  rolesPorProyecto?: Record<string, Rol>
  activo: boolean
  fotoUrl?: string
  creadoEn: ISODateTime
  ultimoAcceso?: ISODateTime
}

// ---------------------------------------------------------------------------
// Listas controladas (seccion 4.2)
// ---------------------------------------------------------------------------

export const ESTADOS_ACTIVIDAD = ['Pendiente', 'En curso', 'Completada', 'Retrasada'] as const
export type EstadoActividad = (typeof ESTADOS_ACTIVIDAD)[number] | ''

export const ESTADOS_HITO = [
  'Pendiente',
  'En curso',
  'Cumplido',
  'Cumplido con retraso',
  'No cumplido',
] as const
export type EstadoHito = (typeof ESTADOS_HITO)[number]

export const ESTADOS_RIESGO = ['Identificado', 'En mitigacion', 'Materializado', 'Cerrado'] as const
export type EstadoRiesgo = (typeof ESTADOS_RIESGO)[number]

export const NIVELES_RIESGO = ['Bajo', 'Medio', 'Alto', 'Critico'] as const
export type NivelRiesgo = (typeof NIVELES_RIESGO)[number]

export const DISPONIBILIDAD_RECURSO = [
  'Por gestionar',
  'Disponible',
  'Reservado',
  'No disponible',
] as const
export type DisponibilidadRecurso = (typeof DISPONIBILIDAD_RECURSO)[number]

export const ESTADOS_INDICADOR = ['Cumple', 'Atencion', 'Critico', 'Sin datos'] as const
export type EstadoIndicador = (typeof ESTADOS_INDICADOR)[number]

export const ROLES_RACI = ['R', 'A', 'C', 'I'] as const
export type LetraRaci = (typeof ROLES_RACI)[number]

export const ESTADOS_VINCULACION = [
  'Por definir',
  'Contactado',
  'Confirmado',
  'Contratado',
  'No disponible',
] as const
export type EstadoVinculacion = (typeof ESTADOS_VINCULACION)[number]

export const TIPOS_RECURSO = ['Humano', 'Tecnologico', 'Informacion', 'Logistico'] as const
export type TipoRecurso = (typeof TIPOS_RECURSO)[number]

export const CATEGORIAS_INDICADOR = [
  'Eficacia',
  'Eficiencia',
  'Calidad',
  'Efectividad',
  'Gestion',
  'Riesgo',
] as const
export type CategoriaIndicador = (typeof CATEGORIAS_INDICADOR)[number]

export const SENTIDOS_INDICADOR = ['Mayor es mejor', 'Menor es mejor'] as const
export type SentidoIndicador = (typeof SENTIDOS_INDICADOR)[number]

export const TIPOS_CAMBIO = [
  'Actividad',
  'Hito',
  'Riesgo',
  'Recurso',
  'Decision',
  'Otro',
] as const
export type TipoCambio = (typeof TIPOS_CAMBIO)[number]

export const CATEGORIAS_RIESGO = [
  'Tecnico',
  'Cronograma',
  'Presupuestal',
  'Talento humano',
  'Externo',
  'Normativo',
  'Calidad',
  'Operativo',
] as const
export type CategoriaRiesgo = string

export const ESTADOS_PROYECTO = ['borrador', 'activo', 'cerrado'] as const
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number]

/** Modo del motor de calculo — EP-30 / Anexo C. */
export const MODOS_CALCULO = ['saneado', 'compatibilidad'] as const
export type ModoCalculo = (typeof MODOS_CALCULO)[number]

// ---------------------------------------------------------------------------
// Base comun: soft delete (ADR-09) + auditoria
// ---------------------------------------------------------------------------

export interface EntidadBase {
  id: string
  creadoEn: ISODateTime
  creadoPor: string
  actualizadoEn: ISODateTime
  actualizadoPor: string
  /** ADR-09: soft delete. Todas las consultas filtran por eliminado !== true. */
  eliminado?: boolean
  eliminadoEn?: ISODateTime
  eliminadoPor?: string
}

// ---------------------------------------------------------------------------
// Proyecto (Ficha) — EP-07
// ---------------------------------------------------------------------------

export interface ObjetivoEspecifico {
  id: string
  orden: number
  texto: string
  indicadorVerificable?: string
}

export interface ProductoComprometido {
  id: string
  orden: number
  nombre: string
  descripcion?: string
}

export interface Fase {
  id: string
  orden: number
  nombre: string
  activa: boolean
}

export interface Proyecto extends EntidadBase {
  codigo: string
  nombre: string
  tecnologiaObjeto: string
  alcance: string
  objetivoGeneral: string
  objetivosEspecificos: ObjetivoEspecifico[]
  marcoMetodologico: string
  productosComprometidos: ProductoComprometido[]
  entidadEjecutora: string
  financiador: string
  liderUid: string | null
  liderNombre: string
  fechaInicio: ISODate
  fechaEntregaFinal: ISODate
  /** RN-26 / D-04: fecha de corte UNICA del proyecto. No existe duplicado en catalogos. */
  fechaCorte: ISODate
  estado: EstadoProyecto
  /** Lista unica de fases del proyecto (RN-09 / D-08). El tablero la consume, no la reescribe. */
  fases: Fase[]
  modoCalculo: ModoCalculo
  /** Marca de ultimo recalculo de indicadores (HG-138). */
  recalculadoEn?: ISODateTime
  recalculoPendiente?: boolean
  /** Miembros con acceso: uid -> rol dentro del proyecto. */
  accesos: Record<string, Rol>
  presupuestoTotal?: number
  moneda: string
  notas?: string
}

// ---------------------------------------------------------------------------
// Equipo — EP-08
// ---------------------------------------------------------------------------

export interface MiembroEquipo extends EntidadBase {
  proyectoId: string
  perfil: string
  nombre: string
  /** HG-052: perfil sin nombre asignado. */
  porDesignar: boolean
  /** HG-051: vinculacion a usuario institucional por seleccion, no texto libre. */
  usuarioUid: string | null
  correo?: string
  /** RN-20 / D-10: unidad unica decidida en Fase 0 = horas/mes. */
  dedicacionHorasMes: number
  mesesVinculacion: number
  estadoVinculacion: EstadoVinculacion
  costoHora?: number
  observaciones?: string
}

// ---------------------------------------------------------------------------
// Cronograma — EP-09
// ---------------------------------------------------------------------------

export interface Actividad extends EntidadBase {
  proyectoId: string
  /** Numero estable; no cambia al reordenar (HG-063). */
  numero: number
  orden: number
  faseId: string
  nombre: string
  entregable?: string
  responsableId: string | null
  responsableNombre: string
  apoyoIds: string[]
  fechaInicio: ISODate | null
  fechaFin: ISODate | null
  /** 0..100 (RN-27, validado). */
  avance: number
  /** HG-064: predecesoras declaradas. */
  predecesoras: string[]
  observaciones?: string
}

/** Resultado del motor sobre una actividad. Nunca editable (principio 2). */
export interface ActividadCalculada extends Actividad {
  vacia: boolean
  duracion: number
  duracionCalendario: number
  estado: EstadoActividad
  razonEstado: string
  avanceEsperado: number
  desviacion: number
  holgura: number | null
  esCritica: boolean
}

// ---------------------------------------------------------------------------
// Hitos — EP-11
// ---------------------------------------------------------------------------

export interface Hito extends EntidadBase {
  proyectoId: string
  orden: number
  descripcion: string
  criterioCumplimiento: string
  fechaProgramada: ISODate | null
  fechaReal: ISODate | null
  estado: EstadoHito
  /** HG-074: hito que habilita actividades posteriores. */
  condicionante: boolean
  actividadesIds: string[]
  responsableId?: string | null
  responsableNombre?: string
  evidencias: Adjunto[]
  observaciones?: string
}

export interface HitoCalculado extends Hito {
  cumplido: boolean
  desviacionDias: number | null
  vencido: boolean
  diasParaVencer: number | null
  enRutaCritica: boolean
}

export interface Adjunto {
  id: string
  nombre: string
  tipoMime: string
  tamanoBytes: number
  url: string
  subidoPor: string
  subidoEn: ISODateTime
}

// ---------------------------------------------------------------------------
// RACI — EP-12
// ---------------------------------------------------------------------------

export interface AsignacionRaci extends EntidadBase {
  proyectoId: string
  actividadId: string
  miembroId: string
  letra: LetraRaci
}

export interface IntegridadRaci {
  actividadId: string
  actividadNombre: string
  conteoA: number
  conteoR: number
  conforme: boolean
  problema: string
}

// ---------------------------------------------------------------------------
// Riesgos — EP-13
// ---------------------------------------------------------------------------

export interface Riesgo extends EntidadBase {
  proyectoId: string
  codigo: string
  categoria: CategoriaRiesgo
  descripcion: string
  /** Enteros 1..5 validados (RN-12). */
  probabilidad: number | null
  impacto: number | null
  planRespuesta: string
  responsableId?: string | null
  responsableNombre: string
  estado: EstadoRiesgo
  fechaIdentificacion: ISODate
  /** HG-089: historial de valoracion. */
  historial: ValoracionRiesgo[]
  observaciones?: string
}

export interface ValoracionRiesgo {
  fecha: ISODateTime
  probabilidad: number | null
  impacto: number | null
  estado: EstadoRiesgo
  usuario: string
}

export interface RiesgoCalculado extends Riesgo {
  severidad: number | null
  nivel: NivelRiesgo | null
  incompleto: boolean
}

// ---------------------------------------------------------------------------
// Recursos — EP-14
// ---------------------------------------------------------------------------

export interface Recurso extends EntidadBase {
  proyectoId: string
  tipo: TipoRecurso
  descripcion: string
  cantidad: string
  fasesIds: string[]
  disponibilidad: DisponibilidadRecurso
  responsableNombre?: string
  observaciones?: string
}

// ---------------------------------------------------------------------------
// Productos — EP-15
// ---------------------------------------------------------------------------

export interface Producto extends EntidadBase {
  proyectoId: string
  entregable: string
  productoComprometidoId?: string | null
  hitoId?: string | null
  actividadesIds: string[]
  fechaEntrega: ISODate | null
  fechaEvaluacion: ISODate | null
  /** RN-23 / D-15: booleanos, no texto libre. */
  evaluado: boolean
  conforme: boolean
  observaciones?: string
  responsableNombre: string
  evidencias: Adjunto[]
}

// ---------------------------------------------------------------------------
// Satisfaccion — EP-16
// ---------------------------------------------------------------------------

export interface MedicionSatisfaccion extends EntidadBase {
  proyectoId: string
  periodo: string // 'YYYY-MM'
  grupo: string
  encuestados: number
  satisfechos: number
  instrumento: string
  responsableNombre: string
  observaciones?: string
}

// ---------------------------------------------------------------------------
// Presupuesto — EP-17
// ---------------------------------------------------------------------------

export interface RegistroPresupuestal extends EntidadBase {
  proyectoId: string
  periodo: string // 'YYYY-MM'
  rubro: string
  /** HG-108: fuente financiera obligatoria. */
  fuente: string
  programado: number
  ejecutado: number
  observaciones?: string
  responsableNombre: string
}

// ---------------------------------------------------------------------------
// Indicadores — EP-18
// ---------------------------------------------------------------------------

export interface DefinicionIndicador {
  codigo: string
  nombre: string
  categoria: CategoriaIndicador
  objetivo: string
  formulaDescripcion: string
  /** Clave de la funcion de calculo registrada en el motor. */
  formulaClave: string
  fuente: string
  frecuencia: string
  responsable: string
  automatizacion: 'Automatico' | 'Semiautomatico' | 'Manual'
  meta: number
  /** Formato de presentacion. */
  unidad: 'porcentaje' | 'numero'
  sentido: SentidoIndicador
  /** RN-24: factor de tolerancia para "Atencion" (mayor es mejor). Por defecto 0.9. */
  factorAtencionMayor: number
  /** RN-25: factor de tolerancia para "Atencion" (menor es mejor). Por defecto 2. */
  factorAtencionMenor: number
  activo: boolean
}

export interface ResultadoIndicador {
  codigo: string
  valor: number | null
  estado: EstadoIndicador
  /** HG-114: explicacion del insumo faltante cuando valor es null. */
  motivoSinDatos?: string
  numerador?: number
  denominador?: number
  detalle: string
  calculadoEn: ISODateTime
  fechaCorte: ISODate
}

/** HG-115: instantanea por fecha de corte. */
export interface Snapshot {
  id: string // fechaCorte
  proyectoId: string
  fechaCorte: ISODate
  creadoEn: ISODateTime
  creadoPor: string
  indicadores: ResultadoIndicador[]
  avancePonderado: number
  avanceEsperado: number
  avanceSimple: number
  desviacion: number
  actividadesPorEstado: Record<string, number>
  riesgosPorNivel: Record<string, number>
}

// ---------------------------------------------------------------------------
// Auditoria — EP-20 (append-only, ADR-06)
// ---------------------------------------------------------------------------

export interface EventoAuditoria {
  id: string
  proyectoId: string | null
  fechaHora: ISODateTime
  usuarioUid: string
  usuarioNombre: string
  accion: 'crear' | 'actualizar' | 'eliminar' | 'restaurar' | 'calcular' | 'importar' | 'exportar' | 'acceso'
  tipoCambio: TipoCambio
  entidad: string
  entidadId: string
  entidadEtiqueta: string
  campo: string | null
  valorAnterior: string | null
  valorNuevo: string | null
  /** HG-126: justificacion obligatoria en cambios sensibles. */
  comentario?: string
}

// ---------------------------------------------------------------------------
// Catalogos globales — EP-06
// ---------------------------------------------------------------------------

export interface ListaControlada {
  id: string
  nombre: string
  descripcion: string
  editable: boolean
  valores: ValorLista[]
}

export interface ValorLista {
  valor: string
  activo: boolean
  orden: number
}

export interface Parametros {
  /** RN-10 / D-03: ventana de alertas de entrega proxima, en dias. */
  ventanaAlertaDias: number
  /** RN-06 / D-03: umbrales de desviacion del avance, en puntos porcentuales. */
  umbralAtencion: number
  umbralPrecaucion: number
  /** HG-039: dias no laborables que alimentan el calculo de dias habiles. */
  festivos: ISODate[]
  /** Politica de retencion de auditoria (HG-130), en meses. */
  retencionAuditoriaMeses: number
  /** Tamano maximo de adjunto en MB. */
  maxAdjuntoMB: number
  tiposAdjuntoPermitidos: string[]
  actualizadoEn: ISODateTime
  actualizadoPor: string
}

// ---------------------------------------------------------------------------
// Alertas — HG-123 centro de alertas unificado
// ---------------------------------------------------------------------------

export type SeveridadAlerta = 'critica' | 'alta' | 'media' | 'informativa'

export interface Alerta {
  id: string
  severidad: SeveridadAlerta
  titulo: string
  mensaje: string
  modulo: string
  ruta: string
  regla: string
}

// ---------------------------------------------------------------------------
// Agregado del proyecto: todo lo necesario para calcular
// ---------------------------------------------------------------------------

export interface DatosProyecto {
  proyecto: Proyecto
  equipo: MiembroEquipo[]
  actividades: Actividad[]
  hitos: Hito[]
  raci: AsignacionRaci[]
  riesgos: Riesgo[]
  recursos: Recurso[]
  productos: Producto[]
  satisfaccion: MedicionSatisfaccion[]
  presupuesto: RegistroPresupuestal[]
}
