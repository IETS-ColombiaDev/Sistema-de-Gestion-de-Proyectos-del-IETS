/**
 * Barra lateral (guia seccion 5): 280px, fondo blanco, borde derecho claro,
 * item activo con fondo `backgrounds.active` y texto morado.
 * En movil se comporta como drawer con overlay oscuro.
 */

import { NavLink } from 'react-router-dom'
import type { GrupoNav } from '@/app/navegacion'
import { puedeEnProyecto } from '@/auth/permisos'
import { useAuth } from '@/auth/AuthContext'
import type { Proyecto } from '@/domain/types'

interface Props {
  grupos: GrupoNav[]
  abierta: boolean
  onCerrar: () => void
  proyecto?: Proyecto | null
  contadores?: Record<string, number>
  pie?: React.ReactNode
}

export default function Sidebar({ grupos, abierta, onCerrar, proyecto, contadores = {}, pie }: Props) {
  const { usuario } = useAuth()

  return (
    <>
      {abierta && <div className="hg-overlay-movil no-print" onClick={onCerrar} aria-hidden="true" />}
      <aside
        className={`hg-sidebar no-print${abierta ? ' hg-sidebar--abierta' : ''}`}
        aria-label="Navegacion principal"
      >
        <div className="hg-sidebar__marca">
          <span className="hg-sidebar__logo" aria-hidden="true">
            HG
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="hg-sidebar__nombre">HIGEP Web</div>
            <div className="hg-sidebar__organismo">Sistema de Gestion de Proyectos</div>
          </div>
        </div>

        <nav className="hg-sidebar__nav scroll-discreto">
          {grupos.map((grupo) => {
            const visibles = grupo.items.filter(
              (i) => !i.permiso || puedeEnProyecto(usuario, proyecto ?? null, i.permiso),
            )
            if (visibles.length === 0) return null
            return (
              <div key={grupo.titulo}>
                <div className="hg-nav__grupo">{grupo.titulo}</div>
                {visibles.map((item) => {
                  const conteo = item.contador ? contadores[item.contador] : undefined
                  return (
                    <NavLink
                      key={item.ruta}
                      to={item.ruta}
                      onClick={onCerrar}
                      className={({ isActive }) =>
                        `hg-nav__item${isActive ? ' hg-nav__item--activo' : ''}`
                      }
                    >
                      <span className="hg-nav__icono">{item.icono}</span>
                      <span className="hg-nav__texto">{item.etiqueta}</span>
                      {conteo != null && conteo > 0 && (
                        <span
                          className="hg-badge hg-badge--alerta hg-badge--conteo"
                          aria-label={`${conteo} elementos que requieren atencion`}
                        >
                          {conteo > 99 ? '99+' : conteo}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {pie && <div className="hg-sidebar__pie">{pie}</div>}
      </aside>
    </>
  )
}
