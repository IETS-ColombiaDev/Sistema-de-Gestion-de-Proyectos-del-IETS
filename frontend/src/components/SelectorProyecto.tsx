/**
 * Selector de proyecto.
 *
 * Antes no existia: para cambiar de proyecto habia que volver al listado y
 * entrar de nuevo, tres pasos para una accion que se hace decenas de veces al
 * dia. Aqui el proyecto actual esta siempre a la vista —con su codigo, que es
 * como la gente lo nombra— y el cambio es un clic.
 *
 * Al cambiar se conserva la SECCION en la que se esta: quien compara el
 * cronograma de dos proyectos quiere seguir en el cronograma, no volver al
 * dashboard cada vez.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Badge from './Badge'
import { Input } from './ui/Field'
import { IconFlechaAbajo } from './icons'
import { listarProyectos } from '@/data/repo'
import { proyectosVisibles } from '@/auth/permisos'
import { useAuth } from '@/auth/AuthContext'
import type { Proyecto } from '@/domain/types'

const COLOR_ESTADO: Record<string, { fg: string; bg: string }> = {
  activo: { fg: '#047857', bg: '#D1FAE5' },
  borrador: { fg: '#92400E', bg: '#FEF3C7' },
  cerrado: { fg: '#475569', bg: '#F1F5F9' },
}

export default function SelectorProyecto({ actual }: { actual: Proyecto | null }) {
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState(false)
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  // La lista se carga al abrir, no al montar: es una peticion que la mayoria de
  // las visitas no necesita.
  useEffect(() => {
    if (!abierto || proyectos.length > 0) return
    void listarProyectos().then((todos) => setProyectos(proyectosVisibles(usuario, todos)))
  }, [abierto, proyectos.length, usuario])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  /** La seccion actual, para conservarla al saltar de proyecto. */
  const seccion = useMemo(() => {
    const m = pathname.match(/^\/proyectos\/[^/]+\/(.+)$/)
    return m?.[1] ?? 'dashboard'
  }, [pathname])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return proyectos
      .filter((p) => !q || p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [proyectos, busqueda])

  if (!actual) return null

  return (
    <div className="hg-selproy" ref={caja}>
      <button
        type="button"
        className="hg-selproy__boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        title={actual.nombre}
      >
        <span className="hg-selproy__actual">
          <span className="hg-selproy__codigo">{actual.codigo}</span>
          <span className="hg-selproy__nombre">{actual.nombre}</span>
        </span>
        <IconFlechaAbajo size={14} />
      </button>

      {abierto && (
        <div className="hg-selproy__menu" role="listbox" aria-label="Cambiar de proyecto">
          <div className="hg-selproy__buscar">
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar proyecto"
              aria-label="Buscar proyecto"
              compacto
              autoFocus
            />
          </div>
          <div className="hg-selproy__lista scroll-discreto">
            {visibles.length === 0 ? (
              <p className="hg-t-sm hg-t-sec" style={{ padding: 'var(--sp-sm)' }}>
                {proyectos.length === 0 ? 'Cargando…' : `Sin coincidencias para “${busqueda}”.`}
              </p>
            ) : (
              visibles.map((p) => {
                const c = COLOR_ESTADO[p.estado] ?? COLOR_ESTADO.cerrado
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={p.id === actual.id}
                    className={`hg-selproy__item${p.id === actual.id ? ' hg-selproy__item--on' : ''}`}
                    onClick={() => {
                      setAbierto(false)
                      setBusqueda('')
                      navegar(`/proyectos/${p.id}/${seccion}`)
                    }}
                  >
                    <span className="hg-selproy__texto">
                      <span className="hg-t-sm hg-t-bold">{p.codigo}</span>
                      <span className="hg-t-xs hg-t-ter">{p.nombre}</span>
                    </span>
                    <Badge fg={c.fg} bg={c.bg}>
                      {p.estado}
                    </Badge>
                  </button>
                )
              })
            )}
          </div>
          <button
            type="button"
            className="hg-selproy__pie"
            onClick={() => {
              setAbierto(false)
              navegar('/proyectos')
            }}
          >
            Ver todos los proyectos →
          </button>
        </div>
      )}
    </div>
  )
}
