/**
 * Ingreso — EP-04.
 * Con Firebase: unico boton de Google, restringido al dominio institucional.
 * En modo local: seleccion de perfil sembrado, para ejercitar cada rol.
 */

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Button from '@/components/Button'
import Alert from '@/components/Alert'
import { DOMINIO_INSTITUCIONAL, useAuth } from '@/auth/AuthContext'
import { DESCRIPCION_ROL, ETIQUETAS_ROL } from '@/auth/permisos'
import { sembrarDatos } from '@/data/seed'
import { IconCandado, IconFlechaDer } from '@/components/icons'
import { gradients } from '@/styles/theme'

export default function Login() {
  const { usuario, usuarios, cargando, error, proveedor, entrarConGoogle, entrarComo, refrescarUsuarios } =
    useAuth()
  const [sembrando, setSembrando] = useState(false)

  useEffect(() => {
    if (proveedor !== 'local' || cargando || usuarios.length > 0) return
    setSembrando(true)
    void sembrarDatos()
      .then(() => refrescarUsuarios())
      .finally(() => setSembrando(false))
  }, [proveedor, cargando, usuarios.length, refrescarUsuarios])

  if (usuario) return <Navigate to="/portafolio" replace />

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--sp-lg)',
        background:
          'radial-gradient(1100px 520px at 15% -10%, #EEF2FF 0%, transparent 60%), var(--c-bg-app)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-xl)' }}>
          <div
            aria-hidden="true"
            style={{
              width: 60,
              height: 60,
              borderRadius: 'var(--r-lg)',
              background: gradients.brand,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 22,
              margin: '0 auto var(--sp-md)',
              boxShadow: 'var(--sh-md)',
            }}
          >
            HG
          </div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            HIGEP Web
          </h1>
          <p
            style={{
              fontSize: 'var(--fs-xs)',
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              color: 'var(--c-text-3)',
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            Sistema de Gestion de Proyectos del IETS
          </p>
        </div>

        <div className="hg-card hg-pila">
          {error && <Alert tipo="error" titulo="No fue posible ingresar" mensaje={error} critico />}

          {proveedor === 'google' ? (
            <>
              <p className="hg-t-sm hg-t-sec">
                El acceso se realiza con la cuenta institucional. Solo se admiten cuentas del dominio{' '}
                <strong>@{DOMINIO_INSTITUCIONAL}</strong>.
              </p>
              <Button variante="primary" tamano="lg" bloque onClick={() => void entrarConGoogle()}>
                Ingresar con la cuenta institucional
              </Button>
            </>
          ) : (
            <>
              <div>
                <h2 style={{ fontSize: 'var(--fs-md)' }}>Seleccione un perfil</h2>
                <p className="hg-t-sm hg-t-sec" style={{ marginTop: 4 }}>
                  Entorno local con datos sinteticos. En produccion este paso lo reemplaza el ingreso
                  con Google restringido a @{DOMINIO_INSTITUCIONAL}.
                </p>
              </div>

              {sembrando || cargando ? (
                <p className="hg-t-sm hg-t-sec">Preparando datos de demostracion…</p>
              ) : (
                <div className="hg-pila" style={{ gap: 6 }}>
                  {usuarios.map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => void entrarComo(u.uid)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-sm)',
                        width: '100%',
                        textAlign: 'left',
                        border: '1px solid var(--c-border)',
                        background: '#fff',
                        borderRadius: 'var(--r-base)',
                        padding: '10px var(--sp-sm)',
                        cursor: 'pointer',
                        transition: 'all var(--t-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--c-purple)'
                        e.currentTarget.style.background = 'var(--c-bg-active)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--c-border)'
                        e.currentTarget.style.background = '#fff'
                      }}
                    >
                      <span className="hg-avatar" aria-hidden="true">
                        {u.nombre
                          .split(' ')
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                          {ETIQUETAS_ROL[u.rolGlobal]}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--fs-xs)',
                            color: 'var(--c-text-2)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={DESCRIPCION_ROL[u.rolGlobal]}
                        >
                          {DESCRIPCION_ROL[u.rolGlobal]}
                        </span>
                      </span>
                      <IconFlechaDer size={16} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <p
          className="hg-t-xs hg-t-ter"
          style={{ textAlign: 'center', marginTop: 'var(--sp-md)', display: 'flex', gap: 6, justifyContent: 'center' }}
        >
          <IconCandado size={13} />
          Acceso auditado. Toda accion queda registrada con usuario y fecha.
        </p>
      </div>
    </div>
  )
}
