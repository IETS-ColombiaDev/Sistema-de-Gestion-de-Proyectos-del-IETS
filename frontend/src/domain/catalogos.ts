/**
 * Catalogos y parametros por defecto — EP-06.
 * Reproducen la hoja "Parametros y listas", pero como datos administrables
 * (ADR-07): las validaciones de la aplicacion leen de aqui, no de literales.
 */

import { festivosRango } from './fechas'
import {
  type TipoEntrega,
  CATEGORIAS_INDICADOR,
  CATEGORIAS_RIESGO,
  DISPONIBILIDAD_RECURSO,
  ESTADOS_ACTIVIDAD,
  ESTADOS_HITO,
  ESTADOS_INDICADOR,
  ESTADOS_RIESGO,
  ESTADOS_VINCULACION,
  NIVELES_RIESGO,
  ROLES_RACI,
  SENTIDOS_INDICADOR,
  TIPOS_CAMBIO,
  TIPOS_RECURSO,
  type ListaControlada,
  type Parametros,
} from './types'

const lista = (
  id: string,
  nombre: string,
  descripcion: string,
  valores: readonly string[],
  editable = true,
): ListaControlada => ({
  id,
  nombre,
  descripcion,
  editable,
  valores: valores.map((valor, i) => ({ valor, activo: true, orden: i + 1 })),
})

/** Fases de referencia del archivo fuente: ocho fases mas "Transversal". */
export const FASES_REFERENCIA = [
  'Alistamiento',
  'Planeacion',
  'Revision de literatura',
  'Analisis',
  'Elaboracion de documento',
  'Socializacion y consulta',
  'Ajustes',
  'Cierre',
  'Transversal',
] as const

export const LISTAS_POR_DEFECTO: ListaControlada[] = [
  lista(
    'estadoActividad',
    'Estado de actividad',
    'Calculado por RN-01. No editable: cambiarlo rompe el motor de calculo.',
    ESTADOS_ACTIVIDAD,
    false,
  ),
  lista(
    'estadoHito',
    'Estado de hito',
    'Vocabulario unico de cinco valores en todos los modulos (corrige D-07).',
    ESTADOS_HITO,
    false,
  ),
  lista('estadoRiesgo', 'Estado de riesgo', 'Ciclo de vida del riesgo.', ESTADOS_RIESGO, false),
  lista(
    'nivelRiesgo',
    'Nivel de riesgo',
    'Derivado de la severidad por RN-13. No editable.',
    NIVELES_RIESGO,
    false,
  ),
  lista(
    'disponibilidadRecurso',
    'Disponibilidad de recurso',
    'Lista unica que gobierna el conteo de recursos por gestionar (corrige D-09).',
    DISPONIBILIDAD_RECURSO,
    false,
  ),
  lista(
    'estadoIndicador',
    'Estado de indicador',
    'Semaforo calculado por RN-24 y RN-25.',
    ESTADOS_INDICADOR,
    false,
  ),
  lista('rolRaci', 'Rol RACI', 'Letras admitidas en la matriz de responsabilidades.', ROLES_RACI, false),
  lista(
    'estadoVinculacion',
    'Tipo de vinculacion',
    'Situacion contractual de cada miembro del equipo.',
    ESTADOS_VINCULACION,
    false,
  ),
  lista('tipoCambio', 'Tipo de cambio', 'Clasificacion de eventos de auditoria.', TIPOS_CAMBIO, false),
  lista('tipoRecurso', 'Tipo de recurso', 'Naturaleza del recurso o insumo.', TIPOS_RECURSO, false),
  lista(
    'categoriaIndicador',
    'Categoria de indicador',
    'Agrupacion del catalogo de indicadores.',
    CATEGORIAS_INDICADOR,
    false,
  ),
  lista(
    'sentidoIndicador',
    'Sentido del indicador',
    'Determina si un valor alto o bajo es favorable.',
    SENTIDOS_INDICADOR,
    false,
  ),
  lista(
    'categoriaRiesgo',
    'Categoria de riesgo',
    'Taxonomia institucional de riesgos. Editable por el administrador.',
    CATEGORIAS_RIESGO,
    true,
  ),
  lista(
    'fasesReferencia',
    'Fases de referencia',
    'Plantilla de fases para proyectos nuevos. Cada proyecto mantiene su propia lista.',
    FASES_REFERENCIA,
    true,
  ),
  lista(
    'instrumentoSatisfaccion',
    'Instrumento de satisfaccion',
    'Fuentes admitidas para la medicion de satisfaccion.',
    ['Encuesta en linea', 'Entrevista', 'Acta de reunion', 'Formulario institucional', 'Otro'],
    true,
  ),
  lista(
    'fuenteFinanciera',
    'Fuente financiera',
    'Origen de los recursos de cada registro presupuestal (HG-108).',
    ['Recursos propios', 'Convenio', 'Contrato interadministrativo', 'Cooperacion', 'Otro'],
    true,
  ),
  lista(
    'rubroPresupuestal',
    'Rubro presupuestal',
    'Clasificacion del gasto en el control presupuestal.',
    ['Talento humano', 'Servicios profesionales', 'Tecnologia', 'Logistica', 'Publicaciones', 'Otro'],
    true,
  ),
]

const anioActual = new Date().getFullYear()

export const PARAMETROS_POR_DEFECTO: Parametros = {
  // RN-10 / D-03: el valor configurado en la hoja de parametros era 14 dias.
  ventanaAlertaDias: 14,
  // RN-06: los umbrales que el libro tenia embebidos en la formula.
  umbralAtencion: 10,
  umbralPrecaucion: 5,
  festivos: festivosRango(anioActual - 1, anioActual + 4),
  retencionAuditoriaMeses: 60,
  maxAdjuntoMB: 20,
  tiposAdjuntoPermitidos: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'text/csv',
  ],
  actualizadoEn: new Date().toISOString(),
  actualizadoPor: 'sistema',
}

export function valoresActivos(listas: ListaControlada[], id: string): string[] {
  const l = listas.find((x) => x.id === id)
  if (!l) return []
  return l.valores.filter((v) => v.activo).sort((a, b) => a.orden - b.orden).map((v) => v.valor)
}

/**
 * Listas de chequeo por defecto para evaluar entregas.
 *
 * Son el punto de partida, no una regla fija: viven en el catalogo y el
 * administrador las edita sin desplegar (ADR-07). Los items marcados como
 * obligatorios son los que, incumplidos, devuelven la entrega sin importar el
 * puntaje: son condiciones, no puntos.
 */
export const LISTAS_CHEQUEO_POR_DEFECTO: {
  tipo: TipoEntrega
  nombre: string
  items: { texto: string; obligatorio: boolean; ayuda?: string }[]
}[] = [
  {
    tipo: 'Entregable',
    nombre: 'Entregable general',
    items: [
      { texto: 'Corresponde al alcance acordado en la actividad', obligatorio: true },
      { texto: 'El enlace abre y el contenido es el que anuncia', obligatorio: true },
      { texto: 'Incluye fecha, version y autor', obligatorio: false },
      { texto: 'Cita las fuentes utilizadas', obligatorio: false },
      { texto: 'Sin errores de forma que impidan su uso', obligatorio: false },
      { texto: 'Listo para ser usado por el destinatario sin retrabajo', obligatorio: false },
    ],
  },
  {
    tipo: 'Informe',
    nombre: 'Informe tecnico',
    items: [
      { texto: 'Responde la pregunta que motivo el informe', obligatorio: true },
      { texto: 'El enlace abre y el contenido es el que anuncia', obligatorio: true },
      { texto: 'Metodologia descrita y reproducible', obligatorio: true },
      { texto: 'Resultados separados de la interpretacion', obligatorio: false },
      { texto: 'Conclusiones sostenidas por los resultados mostrados', obligatorio: false },
      { texto: 'Limitaciones declaradas', obligatorio: false, ayuda: 'Un informe sin limitaciones declaradas suele ser un informe que no las busco.' },
      { texto: 'Referencias completas y verificables', obligatorio: false },
      { texto: 'Resumen ejecutivo comprensible sin leer el cuerpo', obligatorio: false },
    ],
  },
  {
    tipo: 'Encuesta',
    nombre: 'Instrumento de encuesta',
    items: [
      { texto: 'Cada pregunta se relaciona con un objetivo declarado', obligatorio: true },
      { texto: 'El enlace abre y el contenido es el que anuncia', obligatorio: true },
      { texto: 'Sin preguntas que induzcan la respuesta', obligatorio: true },
      { texto: 'Sin preguntas dobles en un mismo enunciado', obligatorio: false },
      { texto: 'Escalas de respuesta consistentes en todo el instrumento', obligatorio: false },
      { texto: 'Consentimiento informado y manejo de datos declarados', obligatorio: true, ayuda: 'Requisito de tratamiento de datos personales.' },
      { texto: 'Tiempo estimado de diligenciamiento informado', obligatorio: false },
      { texto: 'Probada con al menos un caso antes de enviar', obligatorio: false },
    ],
  },
  {
    tipo: 'Base de datos',
    nombre: 'Base de datos o conjunto de datos',
    items: [
      { texto: 'Diccionario de variables incluido', obligatorio: true },
      { texto: 'El enlace abre y el contenido es el que anuncia', obligatorio: true },
      { texto: 'Sin datos personales identificables', obligatorio: true, ayuda: 'Si los hubo, debe estar anonimizada y declararlo.' },
      { texto: 'Valores faltantes codificados de forma explicita', obligatorio: false },
      { texto: 'Una observacion por fila y una variable por columna', obligatorio: false },
      { texto: 'Fuente y fecha de corte de los datos declaradas', obligatorio: false },
    ],
  },
  {
    tipo: 'Presentacion',
    nombre: 'Presentacion',
    items: [
      { texto: 'El mensaje principal se entiende sin narracion', obligatorio: true },
      { texto: 'El enlace abre y el contenido es el que anuncia', obligatorio: true },
      { texto: 'Las cifras mostradas coinciden con la fuente', obligatorio: true },
      { texto: 'Los graficos son legibles en proyeccion', obligatorio: false },
      { texto: 'Duracion acorde al espacio asignado', obligatorio: false },
    ],
  },
  {
    tipo: 'Otro',
    nombre: 'Revision minima',
    items: [
      { texto: 'Corresponde al alcance acordado', obligatorio: true },
      { texto: 'El enlace abre y el contenido es el que anuncia', obligatorio: true },
      { texto: 'Completo y utilizable por el destinatario', obligatorio: false },
    ],
  },
]
