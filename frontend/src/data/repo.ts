/**
 * Repositorio de dominio.
 *
 * Unica puerta de escritura del sistema. Garantiza, para toda entidad de negocio:
 *  1. metadatos de creacion y actualizacion,
 *  2. soft delete (ADR-09) en lugar de borrado fisico,
 *  3. un evento de auditoria por campo modificado (HG-124),
 *  4. la marca de recalculo pendiente del proyecto (HG-138).
 */

import { nuevoId, rutas, type Adaptador, type DocumentoBase } from './adapter'
import { obtenerAdaptador } from './backend'
import { calcularCambios, construirEventos, type ContextoAuditoria } from './auditoria'
import { CATALOGO_INDICADORES } from '@/domain/indicadores'
import { LISTAS_POR_DEFECTO, PARAMETROS_POR_DEFECTO } from '@/domain/catalogos'
import type {
  Actividad,
  AsignacionRaci,
  DatosProyecto,
  DefinicionIndicador,
  EntidadBase,
  EventoAuditoria,
  Hito,
  ListaControlada,
  MedicionSatisfaccion,
  MiembroEquipo,
  Parametros,
  Producto,
  Proyecto,
  Recurso,
  RegistroPresupuestal,
  Riesgo,
  Snapshot,
  TipoCambio,
  Usuario,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// Sesion activa: quien escribe
// ---------------------------------------------------------------------------

let sesion: { uid: string; nombre: string } = { uid: 'sistema', nombre: 'Sistema' }

export function fijarSesionRepo(uid: string, nombre: string): void {
  sesion = { uid, nombre }
}

const ahora = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// Nucleo generico
// ---------------------------------------------------------------------------

interface OpcionesEscritura {
  proyectoId: string | null
  entidad: string
  etiqueta: string
  tipoCambio: TipoCambio
  comentario?: string
  /** Marca el proyecto como pendiente de recalculo tras la escritura. */
  invalidaCalculo?: boolean
}

async function adaptador(): Promise<Adaptador> {
  return obtenerAdaptador()
}

async function registrarEventos(eventos: EventoAuditoria[]): Promise<void> {
  if (eventos.length === 0) return
  const ad = await adaptador()
  await ad.guardarLote(rutas.auditoria(), eventos as unknown as DocumentoBase[])
}

async function marcarRecalculoPendiente(proyectoId: string | null): Promise<void> {
  if (!proyectoId) return
  const ad = await adaptador()
  const p = await ad.obtener<Proyecto & DocumentoBase>(rutas.proyectos(), proyectoId)
  if (!p || p.recalculoPendiente) return
  await ad.guardar(rutas.proyectos(), { ...p, recalculoPendiente: true })
}

/**
 * Crea o actualiza una entidad. Devuelve el documento persistido.
 * Un cambio sin diferencias reales no genera evento de auditoria ni invalida el calculo.
 */
export async function guardarEntidad<T extends EntidadBase>(
  coleccion: string,
  entidad: Partial<T> & { id?: string },
  opciones: OpcionesEscritura,
): Promise<T> {
  const ad = await adaptador()
  const esNuevo = !entidad.id
  const id = entidad.id ?? nuevoId()
  const anterior = esNuevo
    ? null
    : await ad.obtener<T & DocumentoBase>(coleccion, id)

  const documento = {
    ...(anterior ?? {}),
    ...entidad,
    id,
    creadoEn: anterior?.creadoEn ?? ahora(),
    creadoPor: anterior?.creadoPor ?? sesion.uid,
    actualizadoEn: ahora(),
    actualizadoPor: sesion.uid,
  } as T & DocumentoBase

  const cambios = calcularCambios(
    anterior as unknown as Record<string, unknown> | null,
    documento as unknown as Record<string, unknown>,
  )
  if (!esNuevo && cambios.length === 0) return anterior as T

  await ad.guardar(coleccion, documento as unknown as DocumentoBase)

  const ctx: ContextoAuditoria = {
    usuarioUid: sesion.uid,
    usuarioNombre: sesion.nombre,
    proyectoId: opciones.proyectoId,
    entidad: opciones.entidad,
    entidadId: id,
    entidadEtiqueta: opciones.etiqueta,
    tipoCambio: opciones.tipoCambio,
    comentario: opciones.comentario,
  }
  await registrarEventos(construirEventos(ctx, esNuevo ? 'crear' : 'actualizar', cambios))

  if (opciones.invalidaCalculo !== false) await marcarRecalculoPendiente(opciones.proyectoId)
  return documento
}

/** Baja logica. El documento permanece para efectos de trazabilidad. */
export async function eliminarEntidad<T extends EntidadBase>(
  coleccion: string,
  id: string,
  opciones: OpcionesEscritura,
): Promise<void> {
  const ad = await adaptador()
  const anterior = await ad.obtener<T & DocumentoBase>(coleccion, id)
  if (!anterior) return
  const documento = {
    ...anterior,
    eliminado: true,
    eliminadoEn: ahora(),
    eliminadoPor: sesion.uid,
    actualizadoEn: ahora(),
    actualizadoPor: sesion.uid,
  }
  await ad.guardar(coleccion, documento as unknown as DocumentoBase)

  await registrarEventos(
    construirEventos(
      {
        usuarioUid: sesion.uid,
        usuarioNombre: sesion.nombre,
        proyectoId: opciones.proyectoId,
        entidad: opciones.entidad,
        entidadId: id,
        entidadEtiqueta: opciones.etiqueta,
        tipoCambio: opciones.tipoCambio,
        comentario: opciones.comentario,
      },
      'eliminar',
      [{ campo: 'eliminado', anterior: 'false', nuevo: 'true' }],
    ),
  )
  if (opciones.invalidaCalculo !== false) await marcarRecalculoPendiente(opciones.proyectoId)
}

export async function restaurarEntidad<T extends EntidadBase>(
  coleccion: string,
  id: string,
  opciones: OpcionesEscritura,
): Promise<void> {
  const ad = await adaptador()
  const anterior = await ad.obtener<T & DocumentoBase>(coleccion, id)
  if (!anterior) return
  await ad.guardar(coleccion, {
    ...anterior,
    eliminado: false,
    eliminadoEn: undefined,
    eliminadoPor: undefined,
    actualizadoEn: ahora(),
    actualizadoPor: sesion.uid,
  } as unknown as DocumentoBase)
  await registrarEventos(
    construirEventos(
      {
        usuarioUid: sesion.uid,
        usuarioNombre: sesion.nombre,
        proyectoId: opciones.proyectoId,
        entidad: opciones.entidad,
        entidadId: id,
        entidadEtiqueta: opciones.etiqueta,
        tipoCambio: opciones.tipoCambio,
      },
      'restaurar',
      [{ campo: 'eliminado', anterior: 'true', nuevo: 'false' }],
    ),
  )
}

/** Lectura filtrando bajas logicas (ADR-09). */
export async function listarVigentes<T extends EntidadBase>(coleccion: string): Promise<T[]> {
  const ad = await adaptador()
  const docs = await ad.listar<T & DocumentoBase>(coleccion)
  return docs.filter((d) => d.eliminado !== true) as T[]
}

export async function listarTodo<T extends EntidadBase>(coleccion: string): Promise<T[]> {
  const ad = await adaptador()
  return (await ad.listar<T & DocumentoBase>(coleccion)) as T[]
}

// ---------------------------------------------------------------------------
// Escrituras masivas (edicion en tabla — HG-061)
// ---------------------------------------------------------------------------

export async function guardarLoteEntidades<T extends EntidadBase>(
  coleccion: string,
  entidades: (Partial<T> & { id: string })[],
  opciones: Omit<OpcionesEscritura, 'etiqueta'> & { etiquetaDe: (e: Partial<T>) => string },
): Promise<void> {
  const ad = await adaptador()
  const documentos: (T & DocumentoBase)[] = []
  const eventos: EventoAuditoria[] = []

  for (const entidad of entidades) {
    const anterior = await ad.obtener<T & DocumentoBase>(coleccion, entidad.id)
    const documento = {
      ...(anterior ?? {}),
      ...entidad,
      creadoEn: anterior?.creadoEn ?? ahora(),
      creadoPor: anterior?.creadoPor ?? sesion.uid,
      actualizadoEn: ahora(),
      actualizadoPor: sesion.uid,
    } as T & DocumentoBase

    const cambios = calcularCambios(
      anterior as unknown as Record<string, unknown> | null,
      documento as unknown as Record<string, unknown>,
    )
    if (cambios.length === 0) continue

    documentos.push(documento)
    eventos.push(
      ...construirEventos(
        {
          usuarioUid: sesion.uid,
          usuarioNombre: sesion.nombre,
          proyectoId: opciones.proyectoId,
          entidad: opciones.entidad,
          entidadId: entidad.id,
          entidadEtiqueta: opciones.etiquetaDe(entidad),
          tipoCambio: opciones.tipoCambio,
          comentario: opciones.comentario,
        },
        anterior ? 'actualizar' : 'crear',
        cambios,
      ),
    )
  }

  if (documentos.length === 0) return
  await ad.guardarLote(coleccion, documentos as unknown as DocumentoBase[])
  await registrarEventos(eventos)
  await marcarRecalculoPendiente(opciones.proyectoId)
}

// ---------------------------------------------------------------------------
// Catalogos globales — EP-06
// ---------------------------------------------------------------------------

const DOC_PARAMETROS = 'global'

export async function obtenerParametros(): Promise<Parametros> {
  const ad = await adaptador()
  const doc = await ad.obtener<Parametros & DocumentoBase>(
    rutas.catalogoParametros(),
    DOC_PARAMETROS,
  )
  if (doc) {
    const { id: _omitido, ...resto } = doc
    void _omitido
    return resto as Parametros
  }
  await ad.guardar(rutas.catalogoParametros(), {
    ...PARAMETROS_POR_DEFECTO,
    id: DOC_PARAMETROS,
  } as unknown as DocumentoBase)
  return PARAMETROS_POR_DEFECTO
}

export async function guardarParametros(
  parametros: Parametros,
  comentario?: string,
): Promise<void> {
  const ad = await adaptador()
  const anterior = await obtenerParametros()
  const documento = {
    ...parametros,
    id: DOC_PARAMETROS,
    actualizadoEn: ahora(),
    actualizadoPor: sesion.uid,
  }
  await ad.guardar(rutas.catalogoParametros(), documento as unknown as DocumentoBase)
  await registrarEventos(
    construirEventos(
      {
        usuarioUid: sesion.uid,
        usuarioNombre: sesion.nombre,
        proyectoId: null,
        entidad: 'parametros',
        entidadId: DOC_PARAMETROS,
        entidadEtiqueta: 'Parametros globales',
        tipoCambio: 'Otro',
        comentario,
      },
      'actualizar',
      calcularCambios(
        anterior as unknown as Record<string, unknown>,
        parametros as unknown as Record<string, unknown>,
      ),
    ),
  )
}

export async function obtenerListas(): Promise<ListaControlada[]> {
  const ad = await adaptador()
  const docs = await ad.listar<ListaControlada & DocumentoBase>(rutas.catalogoListas())
  if (docs.length > 0) return docs
  await ad.guardarLote(rutas.catalogoListas(), LISTAS_POR_DEFECTO as unknown as DocumentoBase[])
  return LISTAS_POR_DEFECTO
}

export async function guardarLista(lista: ListaControlada, comentario?: string): Promise<void> {
  const ad = await adaptador()
  const anterior = await ad.obtener<ListaControlada & DocumentoBase>(
    rutas.catalogoListas(),
    lista.id,
  )
  await ad.guardar(rutas.catalogoListas(), lista as unknown as DocumentoBase)
  await registrarEventos(
    construirEventos(
      {
        usuarioUid: sesion.uid,
        usuarioNombre: sesion.nombre,
        proyectoId: null,
        entidad: 'lista',
        entidadId: lista.id,
        entidadEtiqueta: lista.nombre,
        tipoCambio: 'Otro',
        comentario,
      },
      anterior ? 'actualizar' : 'crear',
      calcularCambios(
        anterior as unknown as Record<string, unknown> | null,
        lista as unknown as Record<string, unknown>,
      ),
    ),
  )
}

export async function obtenerCatalogoIndicadores(): Promise<DefinicionIndicador[]> {
  const ad = await adaptador()
  const docs = await ad.listar<DefinicionIndicador & DocumentoBase>(rutas.catalogoIndicadores())
  if (docs.length > 0) return docs
  const sembrado = CATALOGO_INDICADORES.map((d) => ({ ...d, id: d.codigo }))
  await ad.guardarLote(rutas.catalogoIndicadores(), sembrado as unknown as DocumentoBase[])
  return CATALOGO_INDICADORES
}

export async function guardarDefinicionIndicador(
  definicion: DefinicionIndicador,
  comentario?: string,
): Promise<void> {
  const ad = await adaptador()
  const anterior = await ad.obtener<DefinicionIndicador & DocumentoBase>(
    rutas.catalogoIndicadores(),
    definicion.codigo,
  )
  await ad.guardar(rutas.catalogoIndicadores(), {
    ...definicion,
    id: definicion.codigo,
  } as unknown as DocumentoBase)
  await registrarEventos(
    construirEventos(
      {
        usuarioUid: sesion.uid,
        usuarioNombre: sesion.nombre,
        proyectoId: null,
        entidad: 'indicador',
        entidadId: definicion.codigo,
        entidadEtiqueta: `${definicion.codigo} · ${definicion.nombre}`,
        tipoCambio: 'Otro',
        comentario,
      },
      anterior ? 'actualizar' : 'crear',
      calcularCambios(
        anterior as unknown as Record<string, unknown> | null,
        definicion as unknown as Record<string, unknown>,
      ),
    ),
  )
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

export async function listarUsuarios(): Promise<Usuario[]> {
  const ad = await adaptador()
  return ad.listar<Usuario & DocumentoBase>(rutas.usuarios())
}

export async function guardarUsuario(usuario: Usuario, comentario?: string): Promise<void> {
  const ad = await adaptador()
  const anterior = await ad.obtener<Usuario & DocumentoBase>(rutas.usuarios(), usuario.uid)
  await ad.guardar(rutas.usuarios(), { ...usuario, id: usuario.uid } as unknown as DocumentoBase)
  const cambios = calcularCambios(
    anterior as unknown as Record<string, unknown> | null,
    usuario as unknown as Record<string, unknown>,
  )
  if (cambios.length === 0) return
  await registrarEventos(
    construirEventos(
      {
        usuarioUid: sesion.uid,
        usuarioNombre: sesion.nombre,
        proyectoId: null,
        entidad: 'usuario',
        entidadId: usuario.uid,
        entidadEtiqueta: usuario.nombre,
        tipoCambio: 'Otro',
        comentario,
      },
      anterior ? 'actualizar' : 'crear',
      cambios,
    ),
  )
}

// ---------------------------------------------------------------------------
// Proyecto: lectura agregada
// ---------------------------------------------------------------------------

export async function listarProyectos(): Promise<Proyecto[]> {
  return listarVigentes<Proyecto>(rutas.proyectos())
}

export async function obtenerProyecto(id: string): Promise<Proyecto | null> {
  const ad = await adaptador()
  return ad.obtener<Proyecto & DocumentoBase>(rutas.proyectos(), id)
}

/** Carga en paralelo todo lo que el motor de calculo necesita. */
export async function cargarDatosProyecto(proyectoId: string): Promise<DatosProyecto | null> {
  const proyecto = await obtenerProyecto(proyectoId)
  if (!proyecto || proyecto.eliminado) return null

  const [equipo, actividades, hitos, raci, riesgos, recursos, productos, satisfaccion, presupuesto] =
    await Promise.all([
      listarVigentes<MiembroEquipo>(rutas.equipo(proyectoId)),
      listarVigentes<Actividad>(rutas.actividades(proyectoId)),
      listarVigentes<Hito>(rutas.hitos(proyectoId)),
      listarVigentes<AsignacionRaci>(rutas.raci(proyectoId)),
      listarVigentes<Riesgo>(rutas.riesgos(proyectoId)),
      listarVigentes<Recurso>(rutas.recursos(proyectoId)),
      listarVigentes<Producto>(rutas.productos(proyectoId)),
      listarVigentes<MedicionSatisfaccion>(rutas.satisfaccion(proyectoId)),
      listarVigentes<RegistroPresupuestal>(rutas.presupuesto(proyectoId)),
    ])

  return {
    proyecto,
    equipo: equipo.sort((a, b) => a.perfil.localeCompare(b.perfil)),
    actividades: actividades.sort((a, b) => a.orden - b.orden),
    hitos: hitos.sort((a, b) => a.orden - b.orden),
    raci,
    riesgos: riesgos.sort((a, b) => a.codigo.localeCompare(b.codigo)),
    recursos,
    productos,
    satisfaccion: satisfaccion.sort((a, b) => a.periodo.localeCompare(b.periodo)),
    presupuesto: presupuesto.sort((a, b) => a.periodo.localeCompare(b.periodo)),
  }
}

// ---------------------------------------------------------------------------
// Auditoria: consulta
// ---------------------------------------------------------------------------

export interface FiltroAuditoria {
  proyectoId?: string | null
  desde?: string
  hasta?: string
  usuarioUid?: string
  tipoCambio?: string
  entidad?: string
  entidadId?: string
  texto?: string
}

export async function consultarAuditoria(filtro: FiltroAuditoria = {}): Promise<EventoAuditoria[]> {
  const ad = await adaptador()
  const todos = await ad.listar<EventoAuditoria & DocumentoBase>(rutas.auditoria())
  const texto = filtro.texto?.toLowerCase().trim()

  return todos
    .filter((e) => {
      if (filtro.proyectoId !== undefined && e.proyectoId !== filtro.proyectoId) return false
      if (filtro.desde && e.fechaHora.slice(0, 10) < filtro.desde) return false
      if (filtro.hasta && e.fechaHora.slice(0, 10) > filtro.hasta) return false
      if (filtro.usuarioUid && e.usuarioUid !== filtro.usuarioUid) return false
      if (filtro.tipoCambio && e.tipoCambio !== filtro.tipoCambio) return false
      if (filtro.entidad && e.entidad !== filtro.entidad) return false
      if (filtro.entidadId && e.entidadId !== filtro.entidadId) return false
      if (texto) {
        const heno = `${e.entidadEtiqueta} ${e.campo ?? ''} ${e.valorAnterior ?? ''} ${e.valorNuevo ?? ''} ${e.usuarioNombre} ${e.comentario ?? ''}`.toLowerCase()
        if (!heno.includes(texto)) return false
      }
      return true
    })
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora))
}

/** Historial completo de una entidad concreta (HG-128). */
export async function historialEntidad(
  entidad: string,
  entidadId: string,
): Promise<EventoAuditoria[]> {
  return consultarAuditoria({ entidad, entidadId })
}

/** Evento sin entidad de negocio asociada: accesos, exportaciones, recalculos. */
export async function registrarEventoSimple(
  accion: EventoAuditoria['accion'],
  entidad: string,
  etiqueta: string,
  proyectoId: string | null,
  detalle?: string,
): Promise<void> {
  await registrarEventos([
    {
      id: nuevoId('aud'),
      proyectoId,
      fechaHora: ahora(),
      usuarioUid: sesion.uid,
      usuarioNombre: sesion.nombre,
      accion,
      tipoCambio: 'Otro',
      entidad,
      entidadId: etiqueta,
      entidadEtiqueta: etiqueta,
      campo: null,
      valorAnterior: null,
      valorNuevo: detalle ?? null,
    },
  ])
}

// ---------------------------------------------------------------------------
// Snapshots por fecha de corte — HG-115
// ---------------------------------------------------------------------------

export async function guardarSnapshot(snapshot: Snapshot): Promise<void> {
  const ad = await adaptador()
  await ad.guardar(rutas.snapshots(snapshot.proyectoId), snapshot as unknown as DocumentoBase)
}

export async function listarSnapshots(proyectoId: string): Promise<Snapshot[]> {
  const ad = await adaptador()
  const docs = await ad.listar<Snapshot & DocumentoBase>(rutas.snapshots(proyectoId))
  return docs.sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte))
}

export async function limpiarRecalculoPendiente(proyectoId: string): Promise<void> {
  const ad = await adaptador()
  const p = await ad.obtener<Proyecto & DocumentoBase>(rutas.proyectos(), proyectoId)
  if (!p) return
  await ad.guardar(rutas.proyectos(), {
    ...p,
    recalculoPendiente: false,
    recalculadoEn: ahora(),
  })
}

export { rutas }
