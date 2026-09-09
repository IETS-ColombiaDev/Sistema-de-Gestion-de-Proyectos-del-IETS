/**
 * Cabecera (guia seccion 5): 64px, sticky, blanco con transparencia y blur,
 * borde inferior claro. Muestra los metadatos de usuario desde 768px.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { ETIQUETAS_ROL } from '@/auth/permisos'
import Button from './Button'
import { IconMenu, IconSalir, IconUsuario } from './icons'
import { ROLES, type Rol } from '@/domain/types'

interface Props {
  titulo: string
  subtitulo?: ReactNode
  acciones?: ReactNode
  onMenu: () => void
}

export default function Header({ titulo, subtitulo, acciones, onMenu }: Props) {
  const { usuario, salir, rolSuplantado, suplantarRol, usuarios } = useAuth()
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navegar = useNavigate()

  // Los desplegables cierran con clic fuera (guia seccion 7).
  useEffect(() => {
    if (!menu) return
    const alClicar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false)
    }
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false)
    }
    document.addEventListener('mousedown', alClicar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alClicar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [menu])

  const iniciales = (usuario?.nombre ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  const esAdministradorReal =
    usuarios.find((u) => u.uid === usuario?.uid)?.rolGlobal === 'administrador'

  return (
    <header className="hg-header no-print">
      <Button
        variante="ghost"
        soloIcono
        className="hg-hamburguesa"
        onClick={onMenu}
        aria-label="Abrir menu de navegacion"
        icono={<IconMenu size={20} />}
      />

      <div style={{ minWidth: 0 }}>
        <h1 className="hg-header__titulo">{titulo}</h1>
        {subtitulo && <div className="hg-header__sub">{subtitulo}</div>}
      </div>

      <div className="hg-header__acciones">
        {acciones}

        <div className="hg-menu" ref={ref}>
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label="Menu de usuario"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--c-border)',
              background: '#fff',
              borderRadius: 'var(--r-full)',
              padding: '3px 10px 3px 3px',
              cursor: 'pointer',
            }}
          >
            <span className="hg-avatar" aria-hidden="true">
              {iniciales}
            </span>
            <span className="hg-solo-escritorio" style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                {usuario?.nombre}
              </span>
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--c-text-2)' }}>
                {usuario ? ETIQUETAS_ROL[usuario.rolGlobal] : ''}
              </span>
            </span>
          </button>

          {menu && (
            <div className="hg-menu__panel" role="menu">
              <div className="hg-menu__titulo">Sesion</div>
              <div style={{ padding: '2px 10px 8px' }}>
                <div className="hg-t-sm hg-t-bold">{usuario?.nombre}</div>
                <div className="hg-t-xs hg-t-sec">{usuario?.correo}</div>
              </div>

              {esAdministradorReal && (
                <>
                  <div className="hg-menu__sep" />
                  <div className="hg-menu__titulo">Ver la aplicacion como</div>
                  {(['(sin suplantar)', ...ROLES] as const).map((r) => {
                    const valor = r === '(sin suplantar)' ? null : (r as Rol)
                    const activo = rolSuplantado === valor
                    return (
                      <button
                        key={r}
                        type="button"
                        role="menuitem"
                        className="hg-menu__item"
                        onClick={() => {
                          suplantarRol(valor)
                          setMenu(false)
                        }}
                        style={activo ? { background: 'var(--c-bg-active)', fontWeight: 600 } : undefined}
                      >
                        <IconUsuario size={15} />
                        {valor ? ETIQUETAS_ROL[valor] : 'Mi rol real'}
                      </button>
                    )
                  })}
                </>
              )}

              <div className="hg-menu__sep" />
              <button
                type="button"
                role="menuitem"
                className="hg-menu__item"
                onClick={async () => {
                  setMenu(false)
                  await salir()
                  navegar('/login')
                }}
              >
                <IconSalir size={15} />
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
