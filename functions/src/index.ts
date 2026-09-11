/**
 * Cloud Functions de HIGEP Web.
 *
 * Tres responsabilidades que no pueden vivir en el cliente:
 *
 *  1. `beforeSignIn` — bloqueo de acceso por dominio institucional (EP-04).
 *     Es el unico control que un usuario no puede eludir: la validacion del
 *     navegador da mensajes claros, esta impide el acceso.
 *
 *  2. `alEscribirEntidad` — sello de auditoria en el servidor (EP-20).
 *     El cliente ya emite su evento; esta funcion lo respalda con la hora del
 *     servidor y con la identidad del token, de modo que un cliente
 *     manipulado no pueda escribir una entidad sin dejar rastro.
 *
 *  3. `recalcularProyecto` — instantanea de indicadores por fecha de corte
 *     (ADR-03, HG-113). El calculo derivado se ejecuta en el servidor para que
 *     todos los usuarios lean exactamente la misma cifra.
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'

initializeApp()
const db = getFirestore()

const DOMINIO = process.env.ALLOWED_DOMAIN ?? 'iets.org.co'
const REGION = process.env.FUNCTIONS_REGION ?? 'us-central1'

// ---------------------------------------------------------------------------
// 1. Acceso restringido al dominio institucional
// ---------------------------------------------------------------------------

export const bloqueoDeAcceso = beforeUserSignedIn({ region: REGION }, async (evento) => {
  const usuario = evento.data
  if (!usuario) {
    throw new HttpsError('permission-denied', 'No fue posible verificar la identidad.')
  }
  const correo = usuario.email?.toLowerCase() ?? ''

  if (!correo.endsWith(`@${DOMINIO}`)) {
    logger.warn('Intento de acceso desde un dominio no autorizado', { correo })
    throw new HttpsError(
      'permission-denied',
      `El acceso esta restringido a las cuentas del dominio @${DOMINIO}.`,
    )
  }
  if (usuario.emailVerified === false) {
    throw new HttpsError('permission-denied', 'La cuenta institucional no esta verificada.')
  }

  // Espejo del rol: la coleccion usuarios es la fuente administrable; el token
  // lleva el rol para que las reglas de seguridad puedan decidir sin lecturas.
  const perfil = await db.collection('usuarios').doc(usuario.uid).get()

  if (perfil.exists && perfil.data()?.activo === false) {
    throw new HttpsError('permission-denied', 'La cuenta esta desactivada.')
  }

  const rol = perfil.exists ? (perfil.data()?.rolGlobal ?? 'miembro') : 'miembro'

  if (!perfil.exists) {
    // Primer ingreso: se registra con el rol de menor privilegio y el
    // administrador lo ajusta despues.
    await db.collection('usuarios').doc(usuario.uid).set({
      uid: usuario.uid,
      correo,
      nombre: usuario.displayName ?? correo,
      rolGlobal: 'miembro',
      activo: true,
      creadoEn: new Date().toISOString(),
      ultimoAcceso: new Date().toISOString(),
    })
  } else {
    await perfil.ref.update({ ultimoAcceso: new Date().toISOString() })
  }

  await db.collection('auditoria').add({
    proyectoId: null,
    fechaHora: new Date().toISOString(),
    usuarioUid: usuario.uid,
    usuarioNombre: usuario.displayName ?? correo,
    accion: 'acceso',
    tipoCambio: 'Otro',
    entidad: 'sesion',
    entidadId: correo,
    entidadEtiqueta: correo,
    campo: null,
    valorAnterior: null,
    valorNuevo: 'Ingreso con cuenta institucional',
    registradoPorServidor: true,
    selloServidor: FieldValue.serverTimestamp(),
  })

  return { customClaims: { rol } }
})

/** Sincroniza el custom claim cuando el administrador cambia el rol. */
export const alCambiarRol = onDocumentWritten(
  { document: 'usuarios/{uid}', region: REGION },
  async (evento) => {
    const antes = evento.data?.before.data()
    const despues = evento.data?.after.data()
    if (!despues) return
    if (antes?.rolGlobal === despues.rolGlobal && antes?.activo === despues.activo) return

    try {
      await getAuth().setCustomUserClaims(evento.params.uid, { rol: despues.rolGlobal })
      // El usuario debe refrescar su token para que el rol nuevo tenga efecto
      // (consecuencia asumida en ADR-05).
      await getAuth().revokeRefreshTokens(evento.params.uid)
      logger.info('Rol sincronizado en el token', {
        uid: evento.params.uid,
        rol: despues.rolGlobal,
      })
    } catch (error) {
      logger.error('No fue posible sincronizar el rol', { uid: evento.params.uid, error })
    }
  },
)

// ---------------------------------------------------------------------------
// 2. Sello de auditoria en el servidor
// ---------------------------------------------------------------------------

const ENTIDADES_AUDITADAS = [
  'equipo',
  'actividades',
  'hitos',
  'raci',
  'riesgos',
  'recursos',
  'productos',
  'satisfaccion',
  'presupuesto',
] as const

/** Campos que no se auditan por ser metadatos de la escritura. */
const IGNORADOS = new Set([
  'actualizadoEn',
  'actualizadoPor',
  'creadoEn',
  'creadoPor',
  'proyectoId',
  'historial',
])

function serializar(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export const alEscribirEntidad = onDocumentWritten(
  { document: 'proyectos/{proyectoId}/{coleccion}/{documentoId}', region: REGION },
  async (evento) => {
    const { proyectoId, coleccion, documentoId } = evento.params
    if (!ENTIDADES_AUDITADAS.includes(coleccion as never)) return

    const antes = evento.data?.before.data() ?? null
    const despues = evento.data?.after.data() ?? null
    if (!despues) return

    const accion = antes === null ? 'crear' : despues.eliminado && !antes.eliminado ? 'eliminar' : 'actualizar'

    const cambios: { campo: string; anterior: string | null; nuevo: string | null }[] = []
    const claves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues)])
    for (const campo of claves) {
      if (IGNORADOS.has(campo)) continue
      const a = serializar(antes?.[campo])
      const b = serializar(despues[campo])
      if (a !== b) cambios.push({ campo, anterior: a, nuevo: b })
    }
    if (cambios.length === 0) return

    // El evento del servidor lleva sello de hora propio y la marca de origen:
    // sirve para detectar escrituras que no dejaron evento del cliente.
    await db.collection('auditoria').add({
      proyectoId,
      fechaHora: new Date().toISOString(),
      selloServidor: FieldValue.serverTimestamp(),
      usuarioUid: despues.actualizadoPor ?? 'desconocido',
      usuarioNombre: despues.actualizadoPor ?? 'desconocido',
      accion,
      tipoCambio: 'Otro',
      entidad: coleccion,
      entidadId: documentoId,
      entidadEtiqueta: despues.nombre ?? despues.descripcion ?? despues.entregable ?? documentoId,
      campo: cambios.length === 1 ? cambios[0].campo : null,
      valorAnterior: cambios.length === 1 ? cambios[0].anterior : null,
      valorNuevo:
        cambios.length === 1
          ? cambios[0].nuevo
          : `${cambios.length} campos: ${cambios.map((c) => c.campo).join(', ')}`,
      registradoPorServidor: true,
    })

    // Marca de recalculo pendiente: el tablero advierte en lugar de mostrar
    // cifras viejas como vigentes (HG-138).
    await db.collection('proyectos').doc(proyectoId).update({ recalculoPendiente: true })
  },
)

// ---------------------------------------------------------------------------
// 3. Recalculo e instantanea por fecha de corte
// ---------------------------------------------------------------------------

interface Actividad {
  nombre?: string
  fechaInicio?: string | null
  fechaFin?: string | null
  avance?: number
  eliminado?: boolean
}

/** Dias habiles entre dos fechas ISO, excluyendo fines de semana y festivos. */
function diasHabiles(inicio: string, fin: string, festivos: Set<string>): number {
  if (fin < inicio) return 0
  let total = 0
  const cursor = new Date(`${inicio}T00:00:00Z`)
  const limite = new Date(`${fin}T00:00:00Z`)
  let guardas = 0
  while (cursor <= limite && guardas++ < 11_000) {
    const iso = cursor.toISOString().slice(0, 10)
    const dow = cursor.getUTCDay()
    if (dow !== 0 && dow !== 6 && !festivos.has(iso)) total++
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return total
}

/**
 * Recalcula el avance del proyecto y guarda la instantanea de la fecha de corte.
 * Se ejecuta a peticion del usuario y tambien de forma programada.
 */
async function recalcular(proyectoId: string, usuarioUid: string): Promise<{
  avancePonderado: number
  avanceEsperado: number
  fechaCorte: string
}> {
  const refProyecto = db.collection('proyectos').doc(proyectoId)
  const proyecto = (await refProyecto.get()).data()
  if (!proyecto) throw new HttpsError('not-found', 'El proyecto no existe.')

  const parametros = (await db.doc('catalogos/sistema/parametros/global').get()).data()
  const festivos = new Set<string>((parametros?.festivos as string[]) ?? [])
  const corte: string = proyecto.fechaCorte

  const snap = await refProyecto.collection('actividades').get()
  const vigentes = snap.docs
    .map((d) => d.data() as Actividad)
    .filter((a) => a.eliminado !== true && a.nombre?.trim() && a.fechaInicio && a.fechaFin)

  let denominador = 0
  let numeradorReal = 0
  let numeradorEsperado = 0

  for (const a of vigentes) {
    const duracion = Math.max(1, diasHabiles(a.fechaInicio!, a.fechaFin!, festivos))
    denominador += duracion
    numeradorReal += duracion * (Number(a.avance) || 0)

    if (corte >= a.fechaFin!) {
      numeradorEsperado += duracion
    } else if (corte >= a.fechaInicio!) {
      const transcurrido = diasHabiles(a.fechaInicio!, corte, festivos)
      numeradorEsperado += Math.min(duracion, transcurrido)
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100
  const avancePonderado = denominador === 0 ? 0 : r2(numeradorReal / denominador)
  const avanceEsperado = denominador === 0 ? 0 : r2((numeradorEsperado / denominador) * 100)

  await refProyecto.collection('snapshots').doc(corte).set({
    id: corte,
    proyectoId,
    fechaCorte: corte,
    creadoEn: new Date().toISOString(),
    creadoPor: usuarioUid,
    avancePonderado,
    avanceEsperado,
    desviacion: r2(avancePonderado - avanceEsperado),
    calculadoPorServidor: true,
  })

  await refProyecto.update({
    recalculoPendiente: false,
    recalculadoEn: new Date().toISOString(),
  })

  return { avancePonderado, avanceEsperado, fechaCorte: corte }
}

export const recalcularProyecto = onCall({ region: REGION }, async (peticion) => {
  if (!peticion.auth) throw new HttpsError('unauthenticated', 'Se requiere sesion.')
  const correo = peticion.auth.token.email ?? ''
  if (!correo.endsWith(`@${DOMINIO}`)) {
    throw new HttpsError('permission-denied', 'Cuenta ajena al dominio institucional.')
  }
  const proyectoId = String(peticion.data?.proyectoId ?? '')
  if (!proyectoId) throw new HttpsError('invalid-argument', 'Falta el identificador del proyecto.')

  const resultado = await recalcular(proyectoId, peticion.auth.uid)
  logger.info('Proyecto recalculado', { proyectoId, ...resultado })
  return resultado
})

/** Recalculo nocturno de todos los proyectos activos. */
export const recalculoDiario = onSchedule(
  { schedule: '0 5 * * *', timeZone: 'America/Bogota', region: REGION },
  async () => {
    const activos = await db.collection('proyectos').where('estado', '==', 'activo').get()
    for (const doc of activos.docs) {
      try {
        await recalcular(doc.id, 'sistema')
      } catch (error) {
        logger.error('Fallo el recalculo programado', { proyectoId: doc.id, error })
      }
    }
    logger.info('Recalculo diario finalizado', { proyectos: activos.size })
  },
)

/**
 * Archivado de auditoria segun la politica de retencion (HG-130).
 * Los eventos antiguos se mueven a una coleccion de archivo; no se destruyen,
 * de modo que la trazabilidad se conserva completa.
 */
export const archivarAuditoria = onSchedule(
  { schedule: '0 3 1 * *', timeZone: 'America/Bogota', region: REGION },
  async () => {
    const parametros = (await db.doc('catalogos/sistema/parametros/global').get()).data()
    const meses = Number(parametros?.retencionAuditoriaMeses ?? 60)
    const limite = new Date()
    limite.setMonth(limite.getMonth() - meses)
    const corte = limite.toISOString()

    const antiguos = await db
      .collection('auditoria')
      .where('fechaHora', '<', corte)
      .limit(400)
      .get()

    if (antiguos.empty) {
      logger.info('Sin eventos de auditoria por archivar')
      return
    }

    const lote = db.batch()
    for (const doc of antiguos.docs) {
      lote.set(db.collection('auditoria_archivo').doc(doc.id), {
        ...doc.data(),
        archivadoEn: new Date().toISOString(),
      })
      lote.delete(doc.ref)
    }
    await lote.commit()
    logger.info('Auditoria archivada', { eventos: antiguos.size, corte })
  },
)
