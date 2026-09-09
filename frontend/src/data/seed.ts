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
import { CATALOGO_INDICADORES } from '@/domain/indicadores'
import { hoyISO, sumarDias, sumarMeses } from '@/domain/fechas'
import type {
  Actividad,
  AsignacionRaci,
  Fase,
  Hito,
  MedicionSatisfaccion,
  MiembroEquipo,
  Producto,
  Proyecto,
  Recurso,
  RegistroPresupuestal,
  Riesgo,
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
    nombre: 'Administradora del sistema',
    rolGlobal: 'administrador',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-lider',
    correo: 'lider.proyecto@iets.org.co',
    nombre: 'Lider de proyecto',
    rolGlobal: 'lider',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-gestor',
    correo: 'gestor.proyecto@iets.org.co',
    nombre: 'Gestora de proyecto',
    rolGlobal: 'gestor',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-miembro',
    correo: 'analista.uno@iets.org.co',
    nombre: 'Analista de evaluacion',
    rolGlobal: 'miembro',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-directivo',
    correo: 'direccion.general@iets.org.co',
    nombre: 'Direccion general',
    rolGlobal: 'directivo',
    activo: true,
    creadoEn: AHORA,
  },
  {
    uid: 'u-auditor',
    correo: 'control.interno@iets.org.co',
    nombre: 'Control interno',
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
  { fase: 1, nombre: 'Declaracion y analisis de conflictos de interes', responsable: 'Gestora de proyecto', offsetInicio: 8, duracion: 8, avance: 100, predecesoras: [0] },
  { fase: 2, nombre: 'Definicion de la pregunta de evaluacion', responsable: 'Analista de evaluacion', offsetInicio: 16, duracion: 12, avance: 100, entregable: 'Protocolo preliminar', predecesoras: [1] },
  { fase: 2, nombre: 'Elaboracion del protocolo de evaluacion', responsable: 'Analista de evaluacion', apoyo: ['Gestora de proyecto'], offsetInicio: 26, duracion: 18, avance: 100, entregable: 'Protocolo de evaluacion', predecesoras: [3] },
  { fase: 2, nombre: 'Socializacion del protocolo con partes interesadas', responsable: 'Gestora de proyecto', offsetInicio: 44, duracion: 10, avance: 100, predecesoras: [4] },
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
  { fase: 6, nombre: 'Consulta publica del informe preliminar', responsable: 'Gestora de proyecto', offsetInicio: 184, duracion: 20, avance: 0, entregable: 'Acta de consulta publica', predecesoras: [17] },
  { fase: 6, nombre: 'Sesion con panel de expertos', responsable: 'Lider de proyecto', offsetInicio: 190, duracion: 6, avance: 0, predecesoras: [17] },
  { fase: 6, nombre: 'Consolidacion de comentarios recibidos', responsable: 'Gestora de proyecto', offsetInicio: 202, duracion: 10, avance: 0, predecesoras: [18, 19] },
  { fase: 7, nombre: 'Incorporacion de ajustes al informe', responsable: 'Analista de evaluacion', offsetInicio: 210, duracion: 16, avance: 0, predecesoras: [20] },
  { fase: 7, nombre: 'Segunda revision metodologica', responsable: 'Metodologa', offsetInicio: 224, duracion: 10, avance: 0, predecesoras: [21] },
  { fase: 7, nombre: 'Aprobacion tecnica del informe final', responsable: 'Lider de proyecto', offsetInicio: 232, duracion: 8, avance: 0, entregable: 'Informe final aprobado', predecesoras: [22] },
  { fase: 8, nombre: 'Diagramacion y publicacion', responsable: 'Editora', offsetInicio: 240, duracion: 12, avance: 0, predecesoras: [23] },
  { fase: 8, nombre: 'Entrega formal al contratante', responsable: 'Lider de proyecto', offsetInicio: 250, duracion: 6, avance: 0, entregable: 'Acta de entrega', predecesoras: [24] },
  { fase: 8, nombre: 'Cierre administrativo y financiero', responsable: 'Gestora de proyecto', offsetInicio: 254, duracion: 10, avance: 0, predecesoras: [25] },
  { fase: 9, nombre: 'Seguimiento y control del proyecto', responsable: 'Gestora de proyecto', offsetInicio: 0, duracion: 264, avance: 62 },
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
  const equipo: MiembroEquipo[] = [
    { perfil: 'Lider de proyecto', nombre: 'Lider de proyecto', usuarioUid: 'u-lider', dedicacionHorasMes: 60, mesesVinculacion: 13, estadoVinculacion: 'Contratado', porDesignar: false },
    { perfil: 'Gestor de proyecto', nombre: 'Gestora de proyecto', usuarioUid: 'u-gestor', dedicacionHorasMes: 120, mesesVinculacion: 13, estadoVinculacion: 'Contratado', porDesignar: false },
    { perfil: 'Analista de evaluacion', nombre: 'Analista de evaluacion', usuarioUid: 'u-miembro', dedicacionHorasMes: 160, mesesVinculacion: 11, estadoVinculacion: 'Contratado', porDesignar: false },
    { perfil: 'Metodologa', nombre: 'Metodologa', usuarioUid: null, dedicacionHorasMes: 80, mesesVinculacion: 9, estadoVinculacion: 'Contratado', porDesignar: false },
    { perfil: 'Economista de la salud', nombre: 'Economista de la salud', usuarioUid: null, dedicacionHorasMes: 100, mesesVinculacion: 7, estadoVinculacion: 'Confirmado', porDesignar: false },
    { perfil: 'Especialista en informacion', nombre: 'Especialista en informacion', usuarioUid: null, dedicacionHorasMes: 40, mesesVinculacion: 4, estadoVinculacion: 'Contratado', porDesignar: false },
    { perfil: 'Analista junior', nombre: 'Analista junior', usuarioUid: null, dedicacionHorasMes: 160, mesesVinculacion: 6, estadoVinculacion: 'Contactado', porDesignar: false },
    { perfil: 'Editora', nombre: '', usuarioUid: null, dedicacionHorasMes: 30, mesesVinculacion: 3, estadoVinculacion: 'Por definir', porDesignar: true },
  ].map((m, i) => ({
    id: `eq${i + 1}`,
    proyectoId,
    ...meta('u-lider'),
    ...m,
  })) as MiembroEquipo[]
  await ad.guardarLote(rutas.equipo(proyectoId), equipo as unknown as DocumentoBase[])

  const idPorNombre = new Map(equipo.map((m) => [m.nombre || m.perfil, m.id]))

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
    responsableId: idPorNombre.get(p.responsable) ?? null,
    responsableNombre: p.responsable,
    apoyoIds: (p.apoyo ?? []).map((a) => idPorNombre.get(a) ?? '').filter(Boolean),
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
    responsableNombre: 'Lider de proyecto',
    evidencias: [],
  })) as Hito[]
  await ad.guardarLote(rutas.hitos(proyectoId), hitos as unknown as DocumentoBase[])

  // --- RACI: A unica por actividad, R por responsable ---
  const raci: AsignacionRaci[] = []
  const idLider = idPorNombre.get('Lider de proyecto')!
  const idGestor = idPorNombre.get('Gestora de proyecto')!
  actividades.forEach((act, i) => {
    if (act.responsableId) {
      raci.push({ id: nuevoId('raci'), proyectoId, ...meta('u-lider'), actividadId: act.id, miembroId: act.responsableId, letra: 'R' })
    }
    // Una sola A: el lider, salvo en dos actividades que se dejan sin A para
    // ejercitar el panel de integridad RN-14.
    if (i !== 11 && i !== 19) {
      raci.push({ id: nuevoId('raci'), proyectoId, ...meta('u-lider'), actividadId: act.id, miembroId: idLider, letra: 'A' })
    }
    if (i % 3 === 0) {
      raci.push({ id: nuevoId('raci'), proyectoId, ...meta('u-lider'), actividadId: act.id, miembroId: idGestor, letra: 'C' })
    }
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
    responsableNombre: 'Lider de proyecto',
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
    responsableNombre: 'Gestora de proyecto',
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
    responsableNombre: 'Lider de proyecto',
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
    responsableNombre: 'Gestora de proyecto',
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
    responsableNombre: 'Lider de proyecto',
  })) as RegistroPresupuestal[]
  await ad.guardarLote(rutas.presupuesto(proyectoId), presupuesto as unknown as DocumentoBase[])

  // --- Segundo proyecto, para que el portafolio tenga sentido ---
  const p2Id = 'pry-guia'
  const inicio2 = sumarDias(hoy, -60)
  const proyecto2: Proyecto = {
    ...proyecto,
    id: p2Id,
    codigo: 'GPC-2026-002',
    nombre: 'Guia de practica clinica — condicion de referencia',
    tecnologiaObjeto: 'Guia de practica clinica basada en evidencia',
    alcance: 'Elaboracion de recomendaciones clinicas basadas en evidencia para la condicion de referencia.',
    objetivoGeneral: 'Formular recomendaciones clinicas basadas en la mejor evidencia disponible.',
    objetivosEspecificos: [
      { id: 'oe1', orden: 1, texto: 'Priorizar las preguntas clinicas con el grupo desarrollador.' },
      { id: 'oe2', orden: 2, texto: 'Formular recomendaciones graduadas segun la certeza de la evidencia.' },
    ],
    productosComprometidos: [{ id: 'pc1', orden: 1, nombre: 'Guia de practica clinica' }],
    fechaInicio: inicio2,
    fechaEntregaFinal: sumarDias(inicio2, 300),
    fechaCorte: hoy,
    estado: 'activo',
    presupuestoTotal: 320_000_000,
    accesos: { 'u-lider': 'lider', 'u-gestor': 'gestor' },
    recalculoPendiente: true,
  }
  await ad.guardar(rutas.proyectos(), proyecto2 as unknown as DocumentoBase)

  const actividades2: Actividad[] = PLANTILLA.slice(0, 12).map((p, i) => ({
    id: `p2act${String(i + 1).padStart(3, '0')}`,
    proyectoId: p2Id,
    ...meta('u-gestor'),
    numero: i + 1,
    orden: i + 1,
    faseId: `f${p.fase}`,
    nombre: p.nombre,
    responsableId: null,
    responsableNombre: p.responsable,
    apoyoIds: [],
    fechaInicio: sumarDias(inicio2, Math.round(p.offsetInicio * 0.6)),
    fechaFin: sumarDias(inicio2, Math.round((p.offsetInicio + p.duracion) * 0.6)),
    avance: Math.max(0, p.avance - 25),
    predecesoras: [],
  }))
  await ad.guardarLote(rutas.actividades(p2Id), actividades2 as unknown as DocumentoBase[])

  const riesgos2: Riesgo[] = riesgos.slice(0, 5).map((r, i) => ({
    ...r,
    id: `p2rsg${i + 1}`,
    proyectoId: p2Id,
  }))
  await ad.guardarLote(rutas.riesgos(p2Id), riesgos2 as unknown as DocumentoBase[])

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
