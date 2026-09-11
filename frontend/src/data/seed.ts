/**
 * Siembra del entorno de desarrollo y demostracion.
 *
 * Datos SINTETICOS: ningun nombre, correo, cifra presupuestal ni contenido
 * proviene de un proyecto real del instituto. Reproducen la ESTRUCTURA del
 * instrumento HIGEP V2 para poder ejercitar el motor de calculo y la prueba de
 * paridad, no su contenido.
 */

import { nuevoId, rutas, type DocumentoBase } from './adapter'
import { obtenerAdaptador } from './backend'
import { LISTAS_POR_DEFECTO, PARAMETROS_POR_DEFECTO } from '@/domain/catalogos'
import { CATALOGO_INDICADORES, calcularIndicadores } from '@/domain/indicadores'
import { resumirProyecto } from '@/domain/reglas'
import { diffDias, hoyISO, sumarDias, sumarMeses } from '@/domain/fechas'
import type {
  Actividad,
  AsignacionRaci,
  DatosProyecto,
  Fase,
  Hito,
  MedicionSatisfaccion,
  MiembroEquipo,
  Producto,
  Proyecto,
  Recurso,
  RegistroPresupuestal,
  Riesgo,
  Snapshot,
  Usuario,
} from '@/domain/types'

const CLAVE_SEMBRADO = 'higep.sembrado.v1'
const AHORA = new Date().toISOString()

const meta = (uid = 'sistema') => ({
  creadoEn: AHORA,
  creadoPor: uid,
  actualizadoEn: AHORA,
  actualizadoPor: uid,
  eliminado: false,
})

// ---------------------------------------------------------------------------
// Usuarios sinteticos
// ---------------------------------------------------------------------------

export const USUARIOS_DEMO: Usuario[] = [
  {
    uid: 'u-admin',
    correo: 'admin.sistema@iets.org.co',
    nombre: 'Laura Cifuentes',
    rolGlobal: 'administrador',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-lider',
    correo: 'lider.proyecto@iets.org.co',
    nombre: 'Marcela Ortiz',
    rolGlobal: 'lider',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-gestor',
    correo: 'gestor.proyecto@iets.org.co',
    nombre: 'Daniel Pineda',
    rolGlobal: 'gestor',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-miembro',
    correo: 'analista.uno@iets.org.co',
    nombre: 'Juliana Bermudez',
    rolGlobal: 'miembro',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-directivo',
    correo: 'direccion.general@iets.org.co',
    nombre: 'Ricardo Nieto',
    rolGlobal: 'directivo',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-auditor',
    correo: 'control.interno@iets.org.co',
    nombre: 'Patricia Amaya',
    rolGlobal: 'auditor',
    activo: true,
    creadoEn: AHORA,
  },
]

// ---------------------------------------------------------------------------
// Proyecto de referencia
// ---------------------------------------------------------------------------

const FASES: Fase[] = [
  'Alistamiento',
  'Planeacion',
  'Revision de literatura',
  'Analisis',
  'Elaboracion de documento',
  'Socializacion y consulta',
  'Ajustes',
  'Cierre',
  'Transversal',
].map((nombre, i) => ({ id: `f${i + 1}`, orden: i + 1, nombre, activa: true }))

interface PlantillaActividad {
  fase: number
  nombre: string
  responsable: string
  apoyo?: string[]
  offsetInicio: number
  duracion: number
  avance: number
  entregable?: string
  predecesoras?: number[]
}

/** 28 actividades: supera el tope de 25 filas del libro Excel (D-18). */
const PLANTILLA: PlantillaActividad[] = [
  { fase: 1, nombre: 'Conformacion del grupo desarrollador', responsable: 'Lider de proyecto', offsetInicio: 0, duracion: 10, avance: 100 },
  { fase: 1, nombre: 'Elaboracion del plan de trabajo', responsable: 'Lider de proyecto', offsetInicio: 5, duracion: 12, avance: 100, entregable: 'Plan de trabajo aprobado', predecesoras: [0] },
  { fase: 1, nombre: 'Declaracion y analisis de conflictos de interes', responsable: 'Gestor de proyecto', offsetInicio: 8, duracion: 8, avance: 100, predecesoras: [0] },
  { fase: 2, nombre: 'Definicion de la pregunta de evaluacion', responsable: 'Analista de evaluacion', offsetInicio: 16, duracion: 12, avance: 100, entregable: 'Protocolo preliminar', predecesoras: [1] },
  { fase: 2, nombre: 'Elaboracion del protocolo de evaluacion', responsable: 'Analista de evaluacion', apoyo: ['Gestor de proyecto'], offsetInicio: 26, duracion: 18, avance: 100, entregable: 'Protocolo de evaluacion', predecesoras: [3] },
  { fase: 2, nombre: 'Socializacion del protocolo con partes interesadas', responsable: 'Gestor de proyecto', offsetInicio: 44, duracion: 10, avance: 100, predecesoras: [4] },
  { fase: 3, nombre: 'Diseno de estrategias de busqueda', responsable: 'Especialista en informacion', offsetInicio: 52, duracion: 10, avance: 100, predecesoras: [4] },
  { fase: 3, nombre: 'Busqueda en bases de datos bibliograficas', responsable: 'Especialista en informacion', offsetInicio: 60, duracion: 14, avance: 100, predecesoras: [6] },
  { fase: 3, nombre: 'Tamizaje de titulos y resumenes', responsable: 'Analista de evaluacion', apoyo: ['Analista junior'], offsetInicio: 72, duracion: 16, avance: 100, predecesoras: [7] },
  { fase: 3, nombre: 'Lectura a texto completo y seleccion final', responsable: 'Analista de evaluacion', offsetInicio: 86, duracion: 16, avance: 95, predecesoras: [8] },
  { fase: 3, nombre: 'Evaluacion de calidad de la evidencia', responsable: 'Metodologa', offsetInicio: 100, duracion: 14, avance: 80, entregable: 'Tablas de evidencia', predecesoras: [9] },
  { fase: 4, nombre: 'Extraccion de datos de los estudios incluidos', responsable: 'Analista junior', offsetInicio: 110, duracion: 18, avance: 70, predecesoras: [9] },
  { fase: 4, nombre: 'Sintesis cualitativa de la evidencia', responsable: 'Metodologa', offsetInicio: 126, duracion: 16, avance: 45, predecesoras: [11] },
  { fase: 4, nombre: 'Analisis economico y de impacto presupuestal', responsable: 'Economista de la salud', offsetInicio: 130, duracion: 24, avance: 30, entregable: 'Modelo economico', predecesoras: [11] },
  { fase: 4, nombre: 'Analisis de sensibilidad del modelo', responsable: 'Economista de la salud', offsetInicio: 152, duracion: 12, avance: 0, predecesoras: [13] },
  { fase: 5, nombre: 'Redaccion del informe preliminar', responsable: 'Analista de evaluacion', apoyo: ['Metodologa'], offsetInicio: 150, duracion: 22, avance: 20, entregable: 'Informe preliminar', predecesoras: [12] },
  { fase: 5, nombre: 'Elaboracion del resumen ejecutivo', responsable: 'Lider de proyecto', offsetInicio: 168, duracion: 10, avance: 0, predecesoras: [15] },
  { fase: 5, nombre: 'Revision editorial y de estilo', responsable: 'Editora', offsetInicio: 176, duracion: 10, avance: 0, predecesoras: [16] },
  { fase: 6, nombre: 'Consulta publica del informe preliminar', responsable: 'Gestor de proyecto', offsetInicio: 184, duracion: 20, avance: 0, entregable: 'Acta de consulta publica', predecesoras: [17] },
  { fase: 6, nombre: 'Sesion con panel de expertos', responsable: 'Lider de proyecto', offsetInicio: 190, duracion: 6, avance: 0, predecesoras: [17] },
  { fase: 6, nombre: 'Consolidacion de comentarios recibidos', responsable: 'Gestor de proyecto', offsetInicio: 202, duracion: 10, avance: 0, predecesoras: [18, 19] },
  { fase: 7, nombre: 'Incorporacion de ajustes al informe', responsable: 'Analista de evaluacion', offsetInicio: 210, duracion: 16, avance: 0, predecesoras: [20] },
  { fase: 7, nombre: 'Segunda revision metodologica', responsable: 'Metodologa', offsetInicio: 224, duracion: 10, avance: 0, predecesoras: [21] },
  { fase: 7, nombre: 'Aprobacion tecnica del informe final', responsable: 'Lider de proyecto', offsetInicio: 232, duracion: 8, avance: 0, entregable: 'Informe final aprobado', predecesoras: [22] },
  { fase: 8, nombre: 'Diagramacion y publicacion', responsable: 'Editora', offsetInicio: 240, duracion: 12, avance: 0, predecesoras: [23] },
  { fase: 8, nombre: 'Entrega formal al contratante', responsable: 'Lider de proyecto', offsetInicio: 250, duracion: 6, avance: 0, entregable: 'Acta de entrega', predecesoras: [24] },
  { fase: 8, nombre: 'Cierre administrativo y financiero', responsable: 'Gestor de proyecto', offsetInicio: 254, duracion: 10, avance: 0, predecesoras: [25] },
  { fase: 9, nombre: 'Seguimiento y control del proyecto', responsable: 'Gestor de proyecto', offsetInicio: 0, duracion: 264, avance: 62 },
]

export interface ResultadoSiembra {
  proyectoId: string
  actividades: number
}

export async function sembrarDatos(forzar = false): Promise<ResultadoSiembra | null> {
  const ad = await obtenerAdaptador()

  if (!forzar) {
    const existentes = await ad.listar(rutas.proyectos())
    if (existentes.length > 0) return null
  }

  // --- Catalogos ---
  await ad.guardarLote(rutas.catalogoListas(), LISTAS_POR_DEFECTO as unknown as DocumentoBase[])
  await ad.guardar(rutas.catalogoParametros(), {
    ...PARAMETROS_POR_DEFECTO,
    id: 'global',
  } as unknown as DocumentoBase)
  await ad.guardarLote(
    rutas.catalogoIndicadores(),
    CATALOGO_INDICADORES.map((d) => ({ ...d, id: d.codigo })) as unknown as DocumentoBase[],
  )

  // --- Usuarios ---
  await ad.guardarLote(
    rutas.usuarios(),
    USUARIOS_DEMO.map((u) => ({ ...u, id: u.uid })) as unknown as DocumentoBase[],
  )

  // --- Proyecto ---
  const proyectoId = 'pry-referencia'
  const hoy = hoyISO()
  const inicio = sumarDias(hoy, -160)
  const fin = sumarDias(inicio, 380)

  const proyecto: Proyecto = {
    id: proyectoId,
    ...meta('u-lider'),
    codigo: 'ETES-2026-001',
    nombre: 'Evaluacion de tecnologia sanitaria — tecnologia de referencia',
    tecnologiaObjeto: 'Tecnologia sanitaria de referencia para pruebas del sistema',
    alcance:
      'Evaluacion de efectividad, seguridad e impacto economico de la tecnologia objeto, con revision sistematica de la evidencia y modelo de impacto presupuestal para el contexto colombiano.',
    objetivoGeneral:
      'Generar evidencia sobre efectividad, seguridad y costo-efectividad de la tecnologia objeto, para apoyar la toma de decisiones del Sistema General de Seguridad Social en Salud.',
    objetivosEspecificos: [
      { id: 'oe1', orden: 1, texto: 'Sintetizar la evidencia disponible sobre efectividad clinica.', indicadorVerificable: 'Tablas de evidencia con evaluacion de calidad' },
      { id: 'oe2', orden: 2, texto: 'Estimar el impacto presupuestal de la adopcion de la tecnologia.', indicadorVerificable: 'Modelo economico documentado y validado' },
      { id: 'oe3', orden: 3, texto: 'Consultar a las partes interesadas sobre los hallazgos preliminares.', indicadorVerificable: 'Acta de consulta publica y matriz de comentarios' },
    ],
    marcoMetodologico:
      'Manual metodologico institucional para la elaboracion de evaluaciones de tecnologias en salud, con revision sistematica de la literatura y evaluacion economica.',
    productosComprometidos: [
      { id: 'pc1', orden: 1, nombre: 'Protocolo de evaluacion', descripcion: 'Documento metodologico aprobado antes de la busqueda.' },
      { id: 'pc2', orden: 2, nombre: 'Informe preliminar', descripcion: 'Version sometida a consulta publica.' },
      { id: 'pc3', orden: 3, nombre: 'Informe final', descripcion: 'Version aprobada tecnicamente y publicada.' },
      { id: 'pc4', orden: 4, nombre: 'Resumen ejecutivo', descripcion: 'Sintesis para tomadores de decision.' },
    ],
    entidadEjecutora: 'Instituto de Evaluacion Tecnologica en Salud',
    financiador: 'Entidad contratante de referencia',
    liderUid: 'u-lider',
    liderNombre: 'Lider de proyecto',
    fechaInicio: inicio,
    fechaEntregaFinal: fin,
    fechaCorte: hoy,
    estado: 'activo',
    fases: FASES,
    modoCalculo: 'saneado',
    accesos: {
      'u-lider': 'lider',
      'u-gestor': 'gestor',
      'u-miembro': 'miembro',
    },
    presupuestoTotal: 480_000_000,
    moneda: 'COP',
    recalculoPendiente: false,
    recalculadoEn: AHORA,
  }
  await ad.guardar(rutas.proyectos(), proyecto as unknown as DocumentoBase)

  // --- Equipo ---
  // Las tarifas hora permiten contrastar el libro presupuestal con el costo
  // teorico de la dedicacion declarada. Son valores de referencia sinteticos.
  //
  // Los nombres son INVENTADOS y no corresponden a ninguna persona: el
  // repositorio no lleva datos personales. Aun asi hacen falta, porque un
  // tablero de equipo que muestra "Metodologa" en vez de una persona no
  // responde la pregunta de quien conforma el grupo: los perfiles se repiten y
  // no se distinguen entre si. El perfil se conserva como dato aparte y se
  // muestra junto al nombre.
  const equipo: MiembroEquipo[] = [
    { perfil: 'Lider de proyecto', nombre: 'Marcela Ortiz', usuarioUid: 'u-lider', dedicacionHorasMes: 60, mesesVinculacion: 13, estadoVinculacion: 'Contratado', porDesignar: false, costoHora: 95_000 },
    { perfil: 'Gestor de proyecto', nombre: 'Daniel Pineda', usuarioUid: 'u-gestor', dedicacionHorasMes: 120, mesesVinculacion: 13, estadoVinculacion: 'Contratado', porDesignar: false, costoHora: 62_000 },
    { perfil: 'Analista de evaluacion', nombre: 'Juliana Bermudez', usuarioUid: 'u-miembro', dedicacionHorasMes: 160, mesesVinculacion: 11, estadoVinculacion: 'Contratado', porDesignar: false, costoHora: 54_000 },
    { perfil: 'Metodologa', nombre: 'Carolina Vargas', usuarioUid: null, dedicacionHorasMes: 80, mesesVinculacion: 9, estadoVinculacion: 'Contratado', porDesignar: false, costoHora: 78_000 },
    { perfil: 'Economista de la salud', nombre: 'Andres Quintero', usuarioUid: null, dedicacionHorasMes: 100, mesesVinculacion: 7, estadoVinculacion: 'Confirmado', porDesignar: false, costoHora: 82_000 },
    { perfil: 'Especialista en informacion', nombre: 'Paola Serrano', usuarioUid: null, dedicacionHorasMes: 40, mesesVinculacion: 4, estadoVinculacion: 'Contratado', porDesignar: false, costoHora: 48_000 },
    { perfil: 'Analista junior', nombre: 'Sebastian Lozano', usuarioUid: null, dedicacionHorasMes: 160, mesesVinculacion: 6, estadoVinculacion: 'Contactado', porDesignar: false, costoHora: 32_000 },
    // La editora queda sin tarifa a proposito: el tablero debe declarar que el
    // costo teorico del equipo esta incompleto, no fingir que no lo esta.
    { perfil: 'Editora', nombre: '', usuarioUid: null, dedicacionHorasMes: 30, mesesVinculacion: 3, estadoVinculacion: 'Por definir', porDesignar: true },
  ].map((m, i) => ({
    id: `eq${i + 1}`,
    proyectoId,
    ...meta('u-lider'),
    ...m,
  })) as MiembroEquipo[]
  await ad.guardarLote(rutas.equipo(proyectoId), equipo as unknown as DocumentoBase[])

  // La plantilla de actividades referencia PERFILES, no nombres: el perfil es
  // lo estable —una persona puede cambiar, el rol no— y evita que renombrar a
  // alguien rompa el enlace de sus actividades.
  const idPorPerfil = new Map(equipo.map((m) => [m.perfil, m.id]))
  const nombrePorPerfil = new Map(equipo.map((m) => [m.perfil, m.nombre || m.perfil]))

  // --- Actividades ---
  const actividades: Actividad[] = PLANTILLA.map((p, i) => ({
    id: `act${String(i + 1).padStart(3, '0')}`,
    proyectoId,
    ...meta('u-gestor'),
    numero: i + 1,
    orden: i + 1,
    faseId: `f${p.fase}`,
    nombre: p.nombre,
    entregable: p.entregable,
    responsableId: idPorPerfil.get(p.responsable) ?? null,
    responsableNombre: nombrePorPerfil.get(p.responsable) ?? p.responsable,
    apoyoIds: (p.apoyo ?? []).map((a) => idPorPerfil.get(a) ?? '').filter(Boolean),
    fechaInicio: sumarDias(inicio, p.offsetInicio),
    fechaFin: sumarDias(inicio, p.offsetInicio + p.duracion),
    avance: p.avance,
    predecesoras: (p.predecesoras ?? []).map((k) => `act${String(k + 1).padStart(3, '0')}`),
  }))
  await ad.guardarLote(rutas.actividades(proyectoId), actividades as unknown as DocumentoBase[])

  // --- Hitos ---
  const hitos: Hito[] = [
    { descripcion: 'Plan de trabajo aprobado', criterio: 'Acta de aprobacion firmada por el contratante.', dias: 17, estado: 'Cumplido', real: 18, cond: true, acts: [1] },
    { descripcion: 'Protocolo de evaluacion aprobado', criterio: 'Protocolo publicado y socializado con partes interesadas.', dias: 54, estado: 'Cumplido', real: 56, cond: true, acts: [4, 5] },
    { descripcion: 'Busqueda de literatura finalizada', criterio: 'Bitacora de busqueda y numero de referencias recuperadas.', dias: 74, estado: 'Cumplido', real: 74, cond: false, acts: [7] },
    { descripcion: 'Seleccion de estudios cerrada', criterio: 'Diagrama de flujo de seleccion completo.', dias: 102, estado: 'Cumplido con retraso', real: 109, cond: true, acts: [9] },
    { descripcion: 'Tablas de evidencia completas', criterio: 'Evaluacion de calidad de todos los estudios incluidos.', dias: 114, estado: 'En curso', real: null, cond: false, acts: [10] },
    { descripcion: 'Modelo economico validado', criterio: 'Validacion interna y externa del modelo documentada.', dias: 154, estado: 'Pendiente', real: null, cond: true, acts: [13, 14] },
    { descripcion: 'Informe preliminar entregado', criterio: 'Documento remitido formalmente para consulta publica.', dias: 186, estado: 'Pendiente', real: null, cond: true, acts: [15, 17] },
    { descripcion: 'Consulta publica cerrada', criterio: 'Acta de cierre y matriz de comentarios consolidada.', dias: 212, estado: 'Pendiente', real: null, cond: false, acts: [18, 20] },
    { descripcion: 'Informe final aprobado', criterio: 'Aprobacion tecnica registrada en acta.', dias: 240, estado: 'Pendiente', real: null, cond: true, acts: [23] },
    { descripcion: 'Entrega formal al contratante', criterio: 'Acta de entrega y recibo a satisfaccion.', dias: 256, estado: 'Pendiente', real: null, cond: true, acts: [25] },
    { descripcion: 'Cierre administrativo', criterio: 'Liquidacion del contrato y archivo del expediente.', dias: 264, estado: 'Pendiente', real: null, cond: false, acts: [26] },
    { descripcion: 'Publicacion del informe', criterio: 'Documento disponible en el repositorio institucional.', dias: 252, estado: 'Pendiente', real: null, cond: false, acts: [24] },
  ].map((h, i) => ({
    id: `hit${String(i + 1).padStart(2, '0')}`,
    proyectoId,
    ...meta('u-lider'),
    orden: i + 1,
    descripcion: h.descripcion,
    criterioCumplimiento: h.criterio,
    fechaProgramada: sumarDias(inicio, h.dias),
    fechaReal: h.real == null ? null : sumarDias(inicio, h.real),
    estado: h.estado as Hito['estado'],
    condicionante: h.cond,
    actividadesIds: h.acts.map((k) => `act${String(k + 1).padStart(3, '0')}`),
    responsableNombre: nombrePorPerfil.get('Lider de proyecto') ?? 'Lider de proyecto',
    evidencias: [],
  })) as Hito[]
  await ad.guardarLote(rutas.hitos(proyectoId), hitos as unknown as DocumentoBase[])

  // --- Matriz RACI ---
  // Cada celda (actividad x persona) sostiene UNA letra. Por eso el ejecutor y
  // el responsable final nunca son la misma persona en la misma actividad:
  // cuando el lider es el responsable de ejecutar, la A recae en el gestor.
  const raci: AsignacionRaci[] = []
  const idLider = idPorPerfil.get('Lider de proyecto')!
  const idGestor = idPorPerfil.get('Gestor de proyecto')!
  const idMetodologa = idPorPerfil.get('Metodologa')!

  const asignar = (actividadId: string, miembroId: string, letra: AsignacionRaci['letra']) => {
    if (raci.some((r) => r.actividadId === actividadId && r.miembroId === miembroId)) return
    raci.push({
      id: nuevoId('raci'),
      proyectoId,
      ...meta('u-lider'),
      actividadId,
      miembroId,
      letra,
    })
  }

  actividades.forEach((act, i) => {
    const ejecutor = act.responsableId ?? idGestor
    asignar(act.id, ejecutor, 'R')

    // La A recae en el lider; si el lider ya es el ejecutor, pasa al gestor y,
    // si tambien coincide, a la metodologa.
    const candidatosA = [idLider, idGestor, idMetodologa]
    const responsableFinal = candidatosA.find((id) => id !== ejecutor)!

    // Dos actividades se dejan deliberadamente sin A para que el panel de
    // integridad RN-14 tenga casos que reportar en la demostracion.
    if (i !== 11 && i !== 19) asignar(act.id, responsableFinal, 'A')

    // Consultados e informados, para que la matriz no quede binaria.
    if (i % 3 === 0) asignar(act.id, idMetodologa, 'C')
    if (i % 4 === 0) asignar(act.id, idLider === ejecutor ? idGestor : idLider, 'I')
  })
  await ad.guardarLote(rutas.raci(proyectoId), raci as unknown as DocumentoBase[])

  // --- Riesgos (13: supera el tope de 11 filas del libro) ---
  const riesgos: Riesgo[] = [
    { cat: 'Cronograma', desc: 'Retraso en la seleccion de estudios por volumen de referencias recuperadas.', p: 4, i: 4, est: 'En mitigacion', plan: 'Refinar la estrategia de busqueda y sumar un segundo revisor al tamizaje.' },
    { cat: 'Tecnico', desc: 'Evidencia insuficiente o de baja calidad para responder la pregunta de evaluacion.', p: 3, i: 5, est: 'Identificado', plan: 'Declarar explicitamente las limitaciones y ampliar el analisis de sensibilidad.' },
    { cat: 'Talento humano', desc: 'Vacancia prolongada del perfil de editor.', p: 4, i: 3, est: 'Identificado', plan: 'Anticipar el proceso de contratacion y disponer de un proveedor alterno.' },
    { cat: 'Presupuestal', desc: 'Sobrecosto en licencias de bases de datos bibliograficas.', p: 2, i: 3, est: 'Cerrado', plan: 'Negociacion institucional de licencias corporativas.' },
    { cat: 'Externo', desc: 'Baja participacion de partes interesadas en la consulta publica.', p: 3, i: 3, est: 'Identificado', plan: 'Plan de convocatoria dirigida y ampliacion del plazo de consulta.' },
    { cat: 'Normativo', desc: 'Cambio regulatorio que modifica el alcance de la evaluacion.', p: 2, i: 5, est: 'Identificado', plan: 'Monitoreo normativo mensual y clausula de ajuste de alcance.' },
    { cat: 'Calidad', desc: 'Inconsistencias en la extraccion de datos entre revisores.', p: 3, i: 4, est: 'En mitigacion', plan: 'Formato estandarizado, doble extraccion y conciliacion documentada.' },
    { cat: 'Tecnico', desc: 'Errores en la parametrizacion del modelo economico.', p: 3, i: 5, est: 'En mitigacion', plan: 'Validacion cruzada del modelo por un economista externo al equipo.' },
    { cat: 'Operativo', desc: 'Perdida de informacion por manejo de archivos fuera del repositorio institucional.', p: 2, i: 4, est: 'Identificado', plan: 'Uso obligatorio del repositorio y respaldo automatico.' },
    { cat: 'Cronograma', desc: 'Demora en la aprobacion tecnica del informe final.', p: 3, i: 4, est: 'Identificado', plan: 'Agenda de revision acordada con anticipacion y revisiones parciales.' },
    { cat: 'Externo', desc: 'Cambio del interlocutor de la entidad contratante.', p: 2, i: 3, est: 'Identificado', plan: 'Documentar acuerdos en actas y mantener bitacora de decisiones.' },
    { cat: 'Talento humano', desc: 'Conflicto de interes sobreviniente de un integrante del panel de expertos.', p: 2, i: 4, est: 'Identificado', plan: 'Declaracion de intereses actualizada antes de cada sesion.' },
    { cat: 'Calidad', desc: 'Discrepancia entre la sintesis cualitativa y el modelo economico.', p: 4, i: 4, est: 'Materializado', plan: 'Sesion de conciliacion metodologica y trazabilidad de supuestos.' },
  ].map((r, i) => ({
    id: `rsg${String(i + 1).padStart(2, '0')}`,
    proyectoId,
    ...meta('u-gestor'),
    codigo: `R-${String(i + 1).padStart(3, '0')}`,
    categoria: r.cat,
    descripcion: r.desc,
    probabilidad: r.p,
    impacto: r.i,
    planRespuesta: r.plan,
    responsableNombre: nombrePorPerfil.get('Lider de proyecto') ?? 'Lider de proyecto',
    estado: r.est as Riesgo['estado'],
    fechaIdentificacion: sumarDias(inicio, 10 + i * 7),
    historial: [
      {
        fecha: AHORA,
        probabilidad: r.p,
        impacto: r.i,
        estado: r.est as Riesgo['estado'],
        usuario: 'u-gestor',
      },
    ],
  })) as Riesgo[]
  await ad.guardarLote(rutas.riesgos(proyectoId), riesgos as unknown as DocumentoBase[])

  // --- Recursos (9: supera el tope de 4 filas del libro) ---
  const recursos: Recurso[] = [
    { tipo: 'Humano', desc: 'Editor para revision de estilo del informe final', cant: '1 perfil, 30 horas/mes', fases: ['f5', 'f8'], disp: 'Por gestionar' },
    { tipo: 'Humano', desc: 'Panel de expertos clinicos externos', cant: '5 personas, 2 sesiones', fases: ['f6'], disp: 'Por gestionar' },
    { tipo: 'Tecnologico', desc: 'Licencia de software de gestion de referencias', cant: '6 licencias', fases: ['f3', 'f4'], disp: 'Disponible' },
    { tipo: 'Tecnologico', desc: 'Software de modelamiento economico', cant: '2 licencias', fases: ['f4'], disp: 'Reservado' },
    { tipo: 'Informacion', desc: 'Acceso a bases de datos bibliograficas', cant: 'Suscripcion institucional', fases: ['f3'], disp: 'Disponible' },
    { tipo: 'Informacion', desc: 'Bases de datos de suficiencia y costos del sistema de salud', cant: 'Solicitud formal', fases: ['f4'], disp: 'Por gestionar' },
    { tipo: 'Logistico', desc: 'Sala para sesiones del panel de expertos', cant: '2 jornadas', fases: ['f6'], disp: 'Disponible' },
    { tipo: 'Logistico', desc: 'Servicio de diagramacion e impresion', cant: '1 contrato', fases: ['f8'], disp: 'No disponible' },
    { tipo: 'Tecnologico', desc: 'Repositorio institucional de documentos del proyecto', cant: 'Espacio dedicado', fases: ['f9'], disp: 'Disponible' },
  ].map((r, i) => ({
    id: `rec${String(i + 1).padStart(2, '0')}`,
    proyectoId,
    ...meta('u-gestor'),
    tipo: r.tipo as Recurso['tipo'],
    descripcion: r.desc,
    cantidad: r.cant,
    fasesIds: r.fases,
    disponibilidad: r.disp as Recurso['disponibilidad'],
    responsableNombre: nombrePorPerfil.get('Gestor de proyecto') ?? 'Gestor de proyecto',
  })) as Recurso[]
  await ad.guardarLote(rutas.recursos(proyectoId), recursos as unknown as DocumentoBase[])

  // --- Productos ---
  const productos: Producto[] = [
    { ent: 'Plan de trabajo aprobado', pc: 'pc1', hito: 'hit01', entrega: 18, evalua: 22, evaluado: true, conforme: true, obs: 'Aprobado sin observaciones.' },
    { ent: 'Protocolo de evaluacion', pc: 'pc1', hito: 'hit02', entrega: 56, evalua: 62, evaluado: true, conforme: true, obs: 'Aprobado con ajustes menores de redaccion.' },
    { ent: 'Bitacora de busqueda bibliografica', pc: null, hito: 'hit03', entrega: 74, evalua: 80, evaluado: true, conforme: true, obs: '' },
    { ent: 'Diagrama de flujo de seleccion de estudios', pc: null, hito: 'hit04', entrega: 109, evalua: 115, evaluado: true, conforme: false, obs: 'Requiere justificar las exclusiones a texto completo.' },
    { ent: 'Tablas de evidencia', pc: null, hito: 'hit05', entrega: null, evalua: null, evaluado: false, conforme: false, obs: 'En elaboracion.' },
    { ent: 'Informe preliminar', pc: 'pc2', hito: 'hit07', entrega: null, evalua: null, evaluado: false, conforme: false, obs: 'Pendiente.' },
    { ent: 'Informe final', pc: 'pc3', hito: 'hit09', entrega: null, evalua: null, evaluado: false, conforme: false, obs: 'Pendiente.' },
    { ent: 'Resumen ejecutivo', pc: 'pc4', hito: 'hit09', entrega: null, evalua: null, evaluado: false, conforme: false, obs: 'Pendiente.' },
  ].map((p, i) => ({
    id: `prd${String(i + 1).padStart(2, '0')}`,
    proyectoId,
    ...meta('u-gestor'),
    entregable: p.ent,
    productoComprometidoId: p.pc,
    hitoId: p.hito,
    actividadesIds: [],
    fechaEntrega: p.entrega == null ? null : sumarDias(inicio, p.entrega),
    fechaEvaluacion: p.evalua == null ? null : sumarDias(inicio, p.evalua),
    evaluado: p.evaluado,
    conforme: p.conforme,
    observaciones: p.obs,
    responsableNombre: nombrePorPerfil.get('Lider de proyecto') ?? 'Lider de proyecto',
    evidencias: [],
  })) as Producto[]
  await ad.guardarLote(rutas.productos(proyectoId), productos as unknown as DocumentoBase[])

  // --- Satisfaccion ---
  const satisfaccion: MedicionSatisfaccion[] = [
    { p: -4, grupo: 'Equipo desarrollador', enc: 8, sat: 7 },
    { p: -3, grupo: 'Entidad contratante', enc: 5, sat: 4 },
    { p: -2, grupo: 'Equipo desarrollador', enc: 8, sat: 8 },
    { p: -2, grupo: 'Partes interesadas', enc: 22, sat: 18 },
    { p: -1, grupo: 'Entidad contratante', enc: 5, sat: 5 },
    { p: -1, grupo: 'Equipo desarrollador', enc: 8, sat: 7 },
    { p: 0, grupo: 'Partes interesadas', enc: 26, sat: 23 },
  ].map((m, i) => ({
    id: `sat${String(i + 1).padStart(2, '0')}`,
    proyectoId,
    ...meta('u-gestor'),
    periodo: sumarMeses(hoy, m.p).slice(0, 7),
    grupo: m.grupo,
    encuestados: m.enc,
    satisfechos: m.sat,
    instrumento: 'Encuesta en linea',
    responsableNombre: nombrePorPerfil.get('Gestor de proyecto') ?? 'Gestor de proyecto',
  })) as MedicionSatisfaccion[]
  await ad.guardarLote(rutas.satisfaccion(proyectoId), satisfaccion as unknown as DocumentoBase[])

  // --- Presupuesto ---
  const presupuesto: RegistroPresupuestal[] = [
    { p: -5, rubro: 'Talento humano', prog: 38_000_000, ejec: 36_500_000 },
    { p: -4, rubro: 'Talento humano', prog: 38_000_000, ejec: 38_000_000 },
    { p: -4, rubro: 'Tecnologia', prog: 12_000_000, ejec: 14_200_000 },
    { p: -3, rubro: 'Talento humano', prog: 38_000_000, ejec: 39_400_000 },
    { p: -2, rubro: 'Talento humano', prog: 38_000_000, ejec: 37_100_000 },
    { p: -2, rubro: 'Logistica', prog: 6_000_000, ejec: 5_200_000 },
    { p: -1, rubro: 'Talento humano', prog: 38_000_000, ejec: 40_800_000 },
    { p: -1, rubro: 'Servicios profesionales', prog: 18_000_000, ejec: 18_000_000 },
    { p: 0, rubro: 'Talento humano', prog: 38_000_000, ejec: 35_900_000 },
  ].map((r, i) => ({
    id: `pre${String(i + 1).padStart(2, '0')}`,
    proyectoId,
    ...meta('u-lider'),
    periodo: sumarMeses(hoy, r.p).slice(0, 7),
    rubro: r.rubro,
    fuente: 'Contrato interadministrativo',
    programado: r.prog,
    ejecutado: r.ejec,
    responsableNombre: nombrePorPerfil.get('Lider de proyecto') ?? 'Lider de proyecto',
  })) as RegistroPresupuestal[]
  await ad.guardarLote(rutas.presupuesto(proyectoId), presupuesto as unknown as DocumentoBase[])

  // -------------------------------------------------------------------------
  // Instantaneas historicas
  // -------------------------------------------------------------------------
  // Se generan ejecutando el motor real en fechas de corte pasadas, no
  // inventando una curva: la trayectoria del valor ganado que muestra el
  // tablero es la que el sistema habria registrado si se hubiera recalculado
  // en cada uno de esos cortes.
  const generarInstantaneas = async (
    datosProyecto: DatosProyecto,
    cortes: string[],
  ): Promise<void> => {
    const instantaneas: Snapshot[] = []
    for (const fechaCorte of cortes) {
      const enEseCorte: DatosProyecto = {
        ...datosProyecto,
        proyecto: { ...datosProyecto.proyecto, fechaCorte },
        // El avance registrado a una fecha pasada no puede superar lo que la
        // programacion preveia para entonces: una actividad no se completa
        // antes de empezar. Se acota con el avance planeado de esa fecha.
        actividades: datosProyecto.actividades.map((a) => {
          if (!a.fechaInicio || !a.fechaFin) return a
          if (fechaCorte < a.fechaInicio) return { ...a, avance: 0 }
          if (fechaCorte >= a.fechaFin) return a
          const total = Math.max(1, diffDias(a.fechaInicio, a.fechaFin))
          const transcurrido = Math.max(0, diffDias(a.fechaInicio, fechaCorte))
          const techo = Math.round((transcurrido / total) * 100)
          return { ...a, avance: Math.min(a.avance, techo) }
        }),
        presupuesto: datosProyecto.presupuesto.filter(
          (r) => r.periodo <= fechaCorte.slice(0, 7),
        ),
      }
      const resumenCorte = resumirProyecto(enEseCorte, PARAMETROS_POR_DEFECTO)
      instantaneas.push({
        id: fechaCorte,
        proyectoId: datosProyecto.proyecto.id,
        fechaCorte,
        creadoEn: new Date(`${fechaCorte}T09:00:00.000Z`).toISOString(),
        creadoPor: 'u-gestor',
        indicadores: calcularIndicadores(enEseCorte, resumenCorte),
        avancePonderado: resumenCorte.avancePonderado,
        avanceEsperado: resumenCorte.avanceEsperado,
        avanceSimple: resumenCorte.avanceSimple,
        desviacion: resumenCorte.desviacion.puntos,
        actividadesPorEstado: Object.fromEntries(
          resumenCorte.distribucion.map((d) => [d.estado || 'Sin estado', d.conteo]),
        ),
        riesgosPorNivel: resumenCorte.riesgos.reduce<Record<string, number>>((acc, r) => {
          if (r.nivel) acc[r.nivel] = (acc[r.nivel] ?? 0) + 1
          return acc
        }, {}),
      })
    }
    await ad.guardarLote(
      rutas.snapshots(datosProyecto.proyecto.id),
      instantaneas as unknown as DocumentoBase[],
    )
  }

  // Cortes mensuales de los ultimos cinco meses, ademas del vigente.
  const cortesPasados = [5, 4, 3, 2, 1].map((meses) => sumarMeses(hoy, -meses))

  await generarInstantaneas(
    {
      proyecto,
      equipo,
      actividades,
      hitos,
      raci,
      riesgos,
      recursos,
      productos,
      satisfaccion,
      presupuesto,
    },
    cortesPasados,
  )

  // -------------------------------------------------------------------------
  // Proyectos adicionales del portafolio
  // -------------------------------------------------------------------------
  // Tres perfiles de desempeno distintos, para que el cuadrante del portafolio
  // muestre lo que tiene que mostrar: que un proyecto sano, uno atrasado y uno
  // en problemas de costo piden decisiones diferentes.
  interface PerfilProyecto {
    id: string
    codigo: string
    nombre: string
    tecnologiaObjeto: string
    alcance: string
    financiador: string
    presupuestoTotal: number
    /** Meses transcurridos de la vigencia. */
    mesesTranscurridos: number
    /** Duracion total en dias. */
    duracionDias: number
    /** Cuanto del avance planeado se ha logrado, de 0 a 1. */
    cumplimientoAvance: number
    /** Cuanto se ha gastado frente al valor del trabajo hecho, de 0 a 1+. */
    factorGasto: number
    actividadesTomadas: number
    riesgosTomados: number
    estado: Proyecto['estado']
    /**
     * Equipo del proyecto, por perfil.
     *
     * Varios de estos perfiles corresponden a las MISMAS personas del proyecto
     * de referencia: en un instituto, la metodologa o la especialista en
     * informacion sirven a varias evaluaciones a la vez. Esa superposicion es
     * justamente lo que el tablero de personas del portafolio tiene que dejar
     * ver, porque es donde se forman los cuellos de botella: cada proyecto se
     * ve holgado por separado y la persona esta saturada al sumarlos.
     */
    integrantes: { perfil: string; dedicacionHorasMes: number; compartido?: boolean }[]
  }

  const perfiles: PerfilProyecto[] = [
    {
      id: 'pry-guia',
      codigo: 'GPC-2026-002',
      nombre: 'Guia de practica clinica — condicion de referencia',
      tecnologiaObjeto: 'Guia de practica clinica basada en evidencia',
      alcance:
        'Elaboracion de recomendaciones clinicas basadas en evidencia para la condicion de referencia.',
      financiador: 'Entidad contratante de referencia',
      presupuestoTotal: 320_000_000,
      mesesTranscurridos: 6,
      duracionDias: 300,
      cumplimientoAvance: 0.72,
      factorGasto: 1.18,
      actividadesTomadas: 16,
      integrantes: [
        { perfil: 'Lider de proyecto', dedicacionHorasMes: 40, compartido: true },
        { perfil: 'Metodologa', dedicacionHorasMes: 70, compartido: true },
        { perfil: 'Especialista en informacion', dedicacionHorasMes: 50, compartido: true },
        { perfil: 'Analista clinico', dedicacionHorasMes: 120 },
      ],
      riesgosTomados: 6,
      estado: 'activo',
    },
    {
      id: 'pry-consulta',
      codigo: 'CON-2026-003',
      nombre: 'Consulta ciudadana sobre priorizacion en salud',
      tecnologiaObjeto: 'Instrumento de consulta y analisis de preferencias',
      alcance:
        'Diseno, aplicacion y analisis de un instrumento de consulta a las partes interesadas del sistema.',
      financiador: 'Cooperacion tecnica',
      presupuestoTotal: 180_000_000,
      mesesTranscurridos: 4,
      duracionDias: 210,
      cumplimientoAvance: 1.02,
      factorGasto: 0.94,
      actividadesTomadas: 12,
      integrantes: [
        { perfil: 'Gestor de proyecto', dedicacionHorasMes: 50, compartido: true },
        { perfil: 'Economista de la salud', dedicacionHorasMes: 80, compartido: true },
        { perfil: 'Analista junior', dedicacionHorasMes: 60, compartido: true },
      ],
      riesgosTomados: 4,
      estado: 'activo',
    },
    {
      id: 'pry-registro',
      codigo: 'REG-2025-004',
      nombre: 'Registro nacional de tecnologias evaluadas',
      tecnologiaObjeto: 'Plataforma de registro y consulta publica',
      alcance:
        'Construccion del registro institucional de tecnologias evaluadas y su interfaz de consulta.',
      financiador: 'Recursos propios',
      presupuestoTotal: 540_000_000,
      mesesTranscurridos: 9,
      duracionDias: 330,
      cumplimientoAvance: 0.61,
      factorGasto: 1.34,
      actividadesTomadas: 20,
      integrantes: [
        { perfil: 'Metodologa', dedicacionHorasMes: 60, compartido: true },
        { perfil: 'Economista de la salud', dedicacionHorasMes: 70, compartido: true },
        { perfil: 'Especialista en informacion', dedicacionHorasMes: 40, compartido: true },
        { perfil: 'Coordinadora de registro', dedicacionHorasMes: 100 },
        { perfil: 'Analista de datos', dedicacionHorasMes: 0 },
      ],
      riesgosTomados: 9,
      estado: 'activo',
    },
  ]

  for (const perfil of perfiles) {
    const inicioP = sumarMeses(hoy, -perfil.mesesTranscurridos)
    const factorTiempo = perfil.duracionDias / 264

    const proyectoP: Proyecto = {
      ...proyecto,
      id: perfil.id,
      ...meta('u-lider'),
      codigo: perfil.codigo,
      nombre: perfil.nombre,
      tecnologiaObjeto: perfil.tecnologiaObjeto,
      alcance: perfil.alcance,
      objetivoGeneral: perfil.alcance,
      objetivosEspecificos: [
        { id: 'oe1', orden: 1, texto: 'Cumplir el alcance acordado con la entidad contratante.' },
      ],
      productosComprometidos: [{ id: 'pc1', orden: 1, nombre: 'Producto principal del proyecto' }],
      financiador: perfil.financiador,
      fechaInicio: inicioP,
      fechaEntregaFinal: sumarDias(inicioP, perfil.duracionDias),
      fechaCorte: hoy,
      estado: perfil.estado,
      presupuestoTotal: perfil.presupuestoTotal,
      accesos: { 'u-lider': 'lider', 'u-gestor': 'gestor' },
      recalculoPendiente: false,
      recalculadoEn: AHORA,
    }
    await ad.guardar(rutas.proyectos(), proyectoP as unknown as DocumentoBase)

    // --- Equipo del proyecto ---
    // Cuando el perfil se marca como compartido, la persona es la MISMA del
    // proyecto de referencia: mismo nombre y mismo usuario institucional. Asi
    // el tablero de personas del portafolio puede consolidarla en una sola
    // fila y sumar su dedicacion entre proyectos, que es la lectura que
    // interesa. Los perfiles no compartidos son personas propias de este
    // proyecto.
    const nombresPropios: Record<string, string> = {
      'Analista clinico': 'Mauricio Delgado',
      'Coordinadora de registro': 'Tatiana Gomez',
      'Analista de datos': 'Felipe Cardenas',
    }
    const equipoP: MiembroEquipo[] = perfil.integrantes.map((it, k) => {
      const referencia = equipo.find((m) => m.perfil === it.perfil)
      const compartido = Boolean(it.compartido && referencia)
      return {
        id: `${perfil.id}-eq${k + 1}`,
        proyectoId: perfil.id,
        ...meta('u-lider'),
        perfil: it.perfil,
        nombre: compartido ? referencia!.nombre : (nombresPropios[it.perfil] ?? ''),
        porDesignar: !compartido && !nombresPropios[it.perfil],
        usuarioUid: compartido ? referencia!.usuarioUid : null,
        dedicacionHorasMes: it.dedicacionHorasMes,
        mesesVinculacion: perfil.mesesTranscurridos,
        estadoVinculacion: 'Contratado',
        costoHora: compartido ? referencia!.costoHora : undefined,
      } as MiembroEquipo
    })
    await ad.guardarLote(rutas.equipo(perfil.id), equipoP as unknown as DocumentoBase[])
    const idPorPerfilP = new Map(equipoP.map((m) => [m.perfil, m]))

    // Actividades escaladas al horizonte del proyecto. El avance de cada una se
    // deriva del avance planeado a la fecha de corte por el factor de
    // cumplimiento del perfil: asi el indice de cronograma sale del dato, no de
    // un numero puesto a mano.
    const actividadesP: Actividad[] = PLANTILLA.slice(0, perfil.actividadesTomadas).map((pl, i) => {
      const inicioAct = sumarDias(inicioP, Math.round(pl.offsetInicio * factorTiempo))
      const finAct = sumarDias(inicioP, Math.round((pl.offsetInicio + pl.duracion) * factorTiempo))
      const planeado = hoy >= finAct ? 100 : hoy < inicioAct ? 0 : 55
      return {
        id: `${perfil.id}-act${String(i + 1).padStart(3, '0')}`,
        proyectoId: perfil.id,
        ...meta('u-gestor'),
        numero: i + 1,
        orden: i + 1,
        faseId: `f${pl.fase}`,
        nombre: pl.nombre,
        entregable: pl.entregable,
        responsableId: idPorPerfilP.get(pl.responsable)?.id ?? null,
        responsableNombre:
          idPorPerfilP.get(pl.responsable)?.nombre || pl.responsable,
        apoyoIds: [],
        fechaInicio: inicioAct,
        fechaFin: finAct,
        avance: Math.max(0, Math.min(100, Math.round(planeado * perfil.cumplimientoAvance))),
        predecesoras: [],
      }
    })
    await ad.guardarLote(rutas.actividades(perfil.id), actividadesP as unknown as DocumentoBase[])

    // Presupuesto mensual: el gasto se calibra con el factor del perfil sobre
    // el valor del trabajo efectivamente hecho.
    const resumenP = resumirProyecto(
      {
        proyecto: proyectoP,
        equipo: equipoP,
        actividades: actividadesP,
        hitos: [],
        raci: [],
        riesgos: [],
        recursos: [],
        productos: [],
        satisfaccion: [],
        presupuesto: [],
      },
      PARAMETROS_POR_DEFECTO,
    )
    const valorGanadoP = (perfil.presupuestoTotal * resumenP.avancePonderado) / 100
    const gastoTotalP = valorGanadoP * perfil.factorGasto
    const mesesGasto = Math.max(1, perfil.mesesTranscurridos)
    const presupuestoP: RegistroPresupuestal[] = Array.from({ length: mesesGasto }, (_, k) => ({
      id: `${perfil.id}-pre${k + 1}`,
      proyectoId: perfil.id,
      ...meta('u-lider'),
      periodo: sumarMeses(hoy, -(mesesGasto - 1 - k)).slice(0, 7),
      rubro: k % 3 === 0 ? 'Talento humano' : k % 3 === 1 ? 'Servicios profesionales' : 'Tecnologia',
      fuente: perfil.financiador === 'Recursos propios' ? 'Recursos propios' : 'Convenio',
      programado: Math.round(perfil.presupuestoTotal / (perfil.duracionDias / 30)),
      ejecutado: Math.round(gastoTotalP / mesesGasto),
      responsableNombre: nombrePorPerfil.get('Lider de proyecto') ?? 'Lider de proyecto',
    }))
    await ad.guardarLote(rutas.presupuesto(perfil.id), presupuestoP as unknown as DocumentoBase[])

    const riesgosP: Riesgo[] = riesgos.slice(0, perfil.riesgosTomados).map((r, i) => ({
      ...r,
      id: `${perfil.id}-rsg${i + 1}`,
      proyectoId: perfil.id,
    }))
    await ad.guardarLote(rutas.riesgos(perfil.id), riesgosP as unknown as DocumentoBase[])

    const hitosP: Hito[] = hitos.slice(0, 6).map((h, i) => ({
      ...h,
      id: `${perfil.id}-hit${i + 1}`,
      proyectoId: perfil.id,
      fechaProgramada: sumarDias(inicioP, Math.round((i + 1) * (perfil.duracionDias / 7))),
    }))
    await ad.guardarLote(rutas.hitos(perfil.id), hitosP as unknown as DocumentoBase[])

    await generarInstantaneas(
      {
        proyecto: proyectoP,
        equipo: equipoP,
        actividades: actividadesP,
        hitos: hitosP,
        raci: [],
        riesgos: riesgosP,
        recursos: [],
        productos: [],
        satisfaccion: [],
        presupuesto: presupuestoP,
      },
      cortesPasados.slice(-Math.min(cortesPasados.length, perfil.mesesTranscurridos)),
    )
  }

  localStorage.setItem(CLAVE_SEMBRADO, new Date().toISOString())
  return { proyectoId, actividades: actividades.length }
}

export async function reiniciarDatos(): Promise<void> {
  const ad = await obtenerAdaptador()
  const proyectos = await ad.listar(rutas.proyectos())
  for (const p of proyectos) {
    for (const sub of [
      'equipo',
      'actividades',
      'hitos',
      'raci',
      'riesgos',
      'recursos',
      'productos',
      'satisfaccion',
      'presupuesto',
      'snapshots',
    ]) {
      await ad.vaciar(rutas.sub(p.id, sub))
    }
  }
  await ad.vaciar(rutas.proyectos())
  await ad.vaciar(rutas.auditoria())
  await ad.vaciar(rutas.usuarios())
  await ad.vaciar(rutas.catalogoListas())
  await ad.vaciar(rutas.catalogoParametros())
  await ad.vaciar(rutas.catalogoIndicadores())
  localStorage.removeItem(CLAVE_SEMBRADO)
  await sembrarDatos(true)
}
