/**
 * Adaptador Firestore — ADR-02.
 *
 * Se activa con VITE_BACKEND=firebase y las credenciales del entorno. Ningun
 * secreto vive en el repositorio: todo llega por variables de entorno del
 * despliegue (nota de confidencialidad del backlog).
 *
 * Las rutas planas de tipo 'catalogos_listas' se mapean a la coleccion
 * 'catalogos' con subcoleccion, para conservar el modelo de la seccion 4.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import type { Adaptador, DocumentoBase } from './adapter'

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null
let storage: FirebaseStorage | null = null

export function configuracionFirebase() {
  const env = import.meta.env
  return {
    apiKey: env.VITE_FIREBASE_API_KEY as string,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: env.VITE_FIREBASE_APP_ID as string,
  }
}

export function firebaseConfigurado(): boolean {
  const c = configuracionFirebase()
  return Boolean(c.apiKey && c.projectId && c.appId)
}

export function inicializarFirebase() {
  if (app) return { app, db: db!, auth: auth!, storage: storage! }
  if (!firebaseConfigurado()) {
    throw new Error(
      'Firebase no esta configurado. Defina las variables VITE_FIREBASE_* o use VITE_BACKEND=local.',
    )
  }
  app = initializeApp(configuracionFirebase())
  db = getFirestore(app)
  auth = getAuth(app)
  storage = getStorage(app)
  return { app, db, auth, storage }
}

/** 'catalogos_listas' -> ['catalogos', 'sistema', 'listas'] */
function segmentos(coleccion: string): string[] {
  if (coleccion.startsWith('catalogos_')) {
    return ['catalogos', 'sistema', coleccion.slice('catalogos_'.length)]
  }
  return coleccion.split('/')
}

function ref(coleccion: string) {
  const { db: firestore } = inicializarFirebase()
  const s = segmentos(coleccion)
  return collection(firestore, s[0], ...s.slice(1))
}

function refDoc(coleccion: string, id: string) {
  const { db: firestore } = inicializarFirebase()
  const s = [...segmentos(coleccion), id]
  return doc(firestore, s[0], ...s.slice(1))
}

export const firebaseAdapter: Adaptador = {
  nombre: 'firebase',

  async listar<T extends DocumentoBase>(coleccion: string): Promise<T[]> {
    const snap = await getDocs(ref(coleccion))
    return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T)
  },

  async obtener<T extends DocumentoBase>(coleccion: string, id: string): Promise<T | null> {
    const snap = await getDoc(refDoc(coleccion, id))
    return snap.exists() ? ({ ...(snap.data() as object), id: snap.id } as T) : null
  },

  async guardar<T extends DocumentoBase>(coleccion: string, documento: T): Promise<T> {
    await setDoc(refDoc(coleccion, documento.id), documento as Record<string, unknown>)
    return documento
  },

  async guardarLote<T extends DocumentoBase>(coleccion: string, docs: T[]): Promise<T[]> {
    const { db: firestore } = inicializarFirebase()
    // Firestore acepta hasta 500 escrituras por lote.
    for (let i = 0; i < docs.length; i += 450) {
      const lote = writeBatch(firestore)
      for (const d of docs.slice(i, i + 450)) {
        lote.set(refDoc(coleccion, d.id), d as Record<string, unknown>)
      }
      await lote.commit()
    }
    return docs
  },

  async eliminarDefinitivo(coleccion: string, id: string): Promise<void> {
    await deleteDoc(refDoc(coleccion, id))
  },

  async vaciar(coleccion: string): Promise<void> {
    const snap = await getDocs(ref(coleccion))
    const { db: firestore } = inicializarFirebase()
    const lote = writeBatch(firestore)
    snap.docs.forEach((d) => lote.delete(d.ref))
    await lote.commit()
  },

  suscribir<T extends DocumentoBase>(coleccion: string, cb: (docs: T[]) => void): () => void {
    return onSnapshot(ref(coleccion), (snap) => {
      cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T))
    })
  },
}
