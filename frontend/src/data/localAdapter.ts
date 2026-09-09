/**
 * Adaptador local sobre IndexedDB.
 *
 * Permite operar el sistema completo sin infraestructura: es el backend por
 * defecto en desarrollo, en la demostracion funcional y en las pruebas de
 * aceptacion con datos sinteticos. La estructura de claves imita la de
 * Firestore para que la migracion sea un cambio de adaptador, no de modelo.
 */

import type { Adaptador, DocumentoBase } from './adapter'

const DB_NOMBRE = 'higep-web'
const DB_VERSION = 1
const STORE = 'documentos'

interface Fila {
  clave: string // `${coleccion}::${id}`
  coleccion: string
  id: string
  datos: unknown
}

let dbPromesa: Promise<IDBDatabase> | null = null

function abrir(): Promise<IDBDatabase> {
  if (dbPromesa) return dbPromesa
  dbPromesa = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'clave' })
        store.createIndex('porColeccion', 'coleccion', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir la base local.'))
  })
  return dbPromesa
}

function tx(db: IDBDatabase, modo: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, modo).objectStore(STORE)
}

function promesa<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Error en IndexedDB.'))
  })
}

type Oyente = (docs: DocumentoBase[]) => void
const oyentes = new Map<string, Set<Oyente>>()

async function notificar(coleccion: string) {
  const set = oyentes.get(coleccion)
  if (!set || set.size === 0) return
  const docs = await localAdapter.listar(coleccion)
  set.forEach((cb) => cb(docs))
}

export const localAdapter: Adaptador = {
  nombre: 'local',

  async listar<T extends DocumentoBase>(coleccion: string): Promise<T[]> {
    const db = await abrir()
    const idx = tx(db, 'readonly').index('porColeccion')
    const filas = await promesa<Fila[]>(idx.getAll(IDBKeyRange.only(coleccion)) as IDBRequest<Fila[]>)
    return filas.map((f) => f.datos as T)
  },

  async obtener<T extends DocumentoBase>(coleccion: string, id: string): Promise<T | null> {
    const db = await abrir()
    const fila = await promesa<Fila | undefined>(
      tx(db, 'readonly').get(`${coleccion}::${id}`) as IDBRequest<Fila | undefined>,
    )
    return (fila?.datos as T) ?? null
  },

  async guardar<T extends DocumentoBase>(coleccion: string, doc: T): Promise<T> {
    const db = await abrir()
    const store = tx(db, 'readwrite')
    await promesa(
      store.put({ clave: `${coleccion}::${doc.id}`, coleccion, id: doc.id, datos: doc } as Fila),
    )
    void notificar(coleccion)
    return doc
  },

  async guardarLote<T extends DocumentoBase>(coleccion: string, docs: T[]): Promise<T[]> {
    if (docs.length === 0) return docs
    const db = await abrir()
    const transaccion = db.transaction(STORE, 'readwrite')
    const store = transaccion.objectStore(STORE)
    for (const doc of docs) {
      store.put({ clave: `${coleccion}::${doc.id}`, coleccion, id: doc.id, datos: doc } as Fila)
    }
    await new Promise<void>((resolve, reject) => {
      transaccion.oncomplete = () => resolve()
      transaccion.onerror = () => reject(transaccion.error ?? new Error('Fallo el lote.'))
      transaccion.onabort = () => reject(transaccion.error ?? new Error('Lote abortado.'))
    })
    void notificar(coleccion)
    return docs
  },

  async eliminarDefinitivo(coleccion: string, id: string): Promise<void> {
    const db = await abrir()
    await promesa(tx(db, 'readwrite').delete(`${coleccion}::${id}`))
    void notificar(coleccion)
  },

  async vaciar(coleccion: string): Promise<void> {
    const db = await abrir()
    const store = tx(db, 'readwrite')
    const idx = store.index('porColeccion')
    const filas = await promesa<Fila[]>(idx.getAll(IDBKeyRange.only(coleccion)) as IDBRequest<Fila[]>)
    for (const f of filas) store.delete(f.clave)
    void notificar(coleccion)
  },

  suscribir<T extends DocumentoBase>(coleccion: string, cb: (docs: T[]) => void): () => void {
    const set = oyentes.get(coleccion) ?? new Set<Oyente>()
    set.add(cb as Oyente)
    oyentes.set(coleccion, set)
    void this.listar<T>(coleccion).then(cb)
    return () => {
      set.delete(cb as Oyente)
    }
  },
}

/** Adaptador en memoria: usado por las pruebas del motor y por el modo efimero. */
export function crearAdaptadorMemoria(): Adaptador {
  const almacen = new Map<string, Map<string, DocumentoBase>>()
  const col = (c: string) => {
    if (!almacen.has(c)) almacen.set(c, new Map())
    return almacen.get(c)!
  }
  return {
    nombre: 'local',
    async listar<T extends DocumentoBase>(c: string) {
      return [...col(c).values()] as T[]
    },
    async obtener<T extends DocumentoBase>(c: string, id: string): Promise<T | null> {
      return (col(c).get(id) as T | undefined) ?? null
    },
    async guardar<T extends DocumentoBase>(c: string, doc: T) {
      col(c).set(doc.id, doc)
      return doc
    },
    async guardarLote<T extends DocumentoBase>(c: string, docs: T[]) {
      docs.forEach((d) => col(c).set(d.id, d))
      return docs
    },
    async eliminarDefinitivo(c: string, id: string) {
      col(c).delete(id)
    },
    async vaciar(c: string) {
      col(c).clear()
    },
  }
}
