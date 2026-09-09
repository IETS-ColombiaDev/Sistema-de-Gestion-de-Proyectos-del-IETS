/**
 * Sesion y contexto de identidad — EP-04.
 *
 * Dos proveedores:
 *  - 'google'  : Firebase Auth con Google, restringido al dominio institucional
 *                (ADR-04). El bloqueo definitivo lo hace la funcion de servidor
 *                beforeSignIn; aqui se valida antes para dar mensaje claro.
 *  - 'local'   : seleccion de un usuario sembrado, para desarrollo y demostracion.
 *
 * El rol viaja como custom claim en produccion (ADR-05) y se espeja en la
 * coleccion de usuarios para poder listarlo y administrarlo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { backendSolicitado } from '@/data/backend'
import { fijarSesionRepo, guardarUsuario, listarUsuarios, registrarEventoSimple } from '@/data/repo'
import type { Rol, Usuario } from '@/domain/types'

const CLAVE_SESION = 'higep.sesion.uid'

export const DOMINIO_INSTITUCIONAL =
  (import.meta.env.VITE_ALLOWED_DOMAIN as string) || 'iets.org.co'

export function correoInstitucional(correo: string): boolean {
  return correo.toLowerCase().endsWith(`@${DOMINIO_INSTITUCIONAL.toLowerCase()}`)
}

interface EstadoAuth {
  usuario: Usuario | null
  usuarios: Usuario[]
  cargando: boolean
  error: string | null
  proveedor: 'google' | 'local'
  /** Rol suplantado por un administrador para verificar la experiencia de otro rol. */
  rolSuplantado: Rol | null
  entrarConGoogle: () => Promise<void>
  entrarComo: (uid: string) => Promise<void>
  salir: () => Promise<void>
  suplantarRol: (rol: Rol | null) => void
  refrescarUsuarios: () => Promise<void>
}

const Ctx = createContext<EstadoAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rolSuplantado, setRolSuplantado] = useState<Rol | null>(null)

  const proveedor: 'google' | 'local' = backendSolicitado() === 'firebase' ? 'google' : 'local'

  const refrescarUsuarios = useCallback(async () => {
    setUsuarios(await listarUsuarios())
  }, [])

  // Restauracion de sesion
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const lista = await listarUsuarios()
        if (!vivo) return
        setUsuarios(lista)

        if (proveedor === 'google') {
          const { inicializarFirebase } = await import('@/data/firebaseAdapter')
          const { onAuthStateChanged } = await import('firebase/auth')
          const { auth } = inicializarFirebase()
          onAuthStateChanged(auth, async (fbUser) => {
            if (!fbUser) {
              setUsuario(null)
              setCargando(false)
              return
            }
            const registrado = lista.find((u) => u.uid === fbUser.uid)
            const perfil: Usuario = registrado ?? {
              uid: fbUser.uid,
              correo: fbUser.email ?? '',
              nombre: fbUser.displayName ?? fbUser.email ?? 'Usuario',
              rolGlobal: 'miembro',
              activo: true,
              fotoUrl: fbUser.photoURL ?? undefined,
              creadoEn: new Date().toISOString(),
            }
            if (!registrado) await guardarUsuario(perfil)
            fijarSesionRepo(perfil.uid, perfil.nombre)
            setUsuario(perfil)
            setCargando(false)
          })
          return
        }

        const guardado = localStorage.getItem(CLAVE_SESION)
        const encontrado = guardado ? lista.find((u) => u.uid === guardado) : null
        if (encontrado) {
          fijarSesionRepo(encontrado.uid, encontrado.nombre)
          setUsuario(encontrado)
        }
        setCargando(false)
      } catch (e) {
        if (!vivo) return
        setError((e as Error).message)
        setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [proveedor])

  const entrarConGoogle = useCallback(async () => {
    setError(null)
    try {
      const { inicializarFirebase } = await import('@/data/firebaseAdapter')
      const { GoogleAuthProvider, signInWithPopup, signOut } = await import('firebase/auth')
      const { auth } = inicializarFirebase()
      const proveedorGoogle = new GoogleAuthProvider()
      proveedorGoogle.setCustomParameters({ hd: DOMINIO_INSTITUCIONAL })
      const cred = await signInWithPopup(auth, proveedorGoogle)
      const correo = cred.user.email ?? ''
      if (!correoInstitucional(correo)) {
        await signOut(auth)
        setError(
          `Acceso restringido a cuentas @${DOMINIO_INSTITUCIONAL}. La cuenta ${correo} no pertenece al dominio institucional.`,
        )
        return
      }
      await registrarEventoSimple('acceso', 'sesion', correo, null, 'Ingreso con Google')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const entrarComo = useCallback(
    async (uid: string) => {
      setError(null)
      const encontrado = usuarios.find((u) => u.uid === uid)
      if (!encontrado) {
        setError('El usuario seleccionado no existe.')
        return
      }
      if (!encontrado.activo) {
        setError('La cuenta esta desactivada.')
        return
      }
      localStorage.setItem(CLAVE_SESION, uid)
      fijarSesionRepo(encontrado.uid, encontrado.nombre)
      setUsuario(encontrado)
      setRolSuplantado(null)
      await guardarUsuario({ ...encontrado, ultimoAcceso: new Date().toISOString() })
      await registrarEventoSimple('acceso', 'sesion', encontrado.correo, null, 'Ingreso local')
    },
    [usuarios],
  )

  const salir = useCallback(async () => {
    if (proveedor === 'google') {
      const { inicializarFirebase } = await import('@/data/firebaseAdapter')
      const { signOut } = await import('firebase/auth')
      const { auth } = inicializarFirebase()
      await signOut(auth)
    }
    localStorage.removeItem(CLAVE_SESION)
    fijarSesionRepo('sistema', 'Sistema')
    setUsuario(null)
    setRolSuplantado(null)
  }, [proveedor])

  const valor = useMemo<EstadoAuth>(() => {
    const efectivo =
      usuario && rolSuplantado ? { ...usuario, rolGlobal: rolSuplantado } : usuario
    return {
      usuario: efectivo,
      usuarios,
      cargando,
      error,
      proveedor,
      rolSuplantado,
      entrarConGoogle,
      entrarComo,
      salir,
      suplantarRol: setRolSuplantado,
      refrescarUsuarios,
    }
  }, [
    usuario,
    usuarios,
    cargando,
    error,
    proveedor,
    rolSuplantado,
    entrarConGoogle,
    entrarComo,
    salir,
    refrescarUsuarios,
  ])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAuth(): EstadoAuth {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return ctx
}
