/**
 * Selector de actividades.
 *
 * Una lista plana de veintiocho casillas obliga a leerlas todas para encontrar
 * una. Aqui las actividades se agrupan por fase —que es como esta organizado el
 * cronograma y como la gente las recuerda—, se pueden buscar por nombre o por
 * numero, y cada fila muestra su estado y su fecha de fin, que es lo que
 * permite decidir sin abrir el cronograma en otra pestana.
 */

import { useMemo, useState } from 'react'
import Badge from './Badge'
import Button from './Button'
import { Input } from './ui/Field'
import { IconCheck } from './icons'
import { formatearFecha } from '@/domain/fechas'
import { estadoColors } from '@/styles/theme'

export interface ActividadElegible {
  id: string
  numero: number
  nombre: string
  faseId: string
  estado: string
  fechaFin: string | null
}

export default function SelectorActividades({
  actividades,
  fases,
  seleccion,
  onCambio,
  etiquetaAria = 'Actividades vinculadas',
  soloLectura,
}: {
  actividades: ActividadElegible[]
  /** Lista unica de fases del proyecto; el selector la consume, no la reescribe. */
  fases: { faseId: string; nombre: string }[]
  seleccion: string[]
  onCambio: (ids: string[]) => void
  etiquetaAria?: string
  soloLectura?: boolean
}) {
  const [busqueda, setBusqueda] = useState('')

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const coincide = (a: ActividadElegible) =>
      !q || a.nombre.toLowerCase().includes(q) || String(a.numero) === q
    return fases
      .map((f) => ({
        fase: f,
        items: actividades.filter((a) => a.faseId === f.faseId && coincide(a)),
      }))
      .filter((g) => g.items.length > 0)
  }, [actividades, fases, busqueda])

  const alternar = (id: string) => {
    const s = new Set(seleccion)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    onCambio([...s])
  }

  const visibles = grupos.flatMap((g) => g.items.map((a) => a.id))
  const todasVisiblesMarcadas =
    visibles.length > 0 && visibles.every((id) => seleccion.includes(id))

  return (
    <div className="hg-selact">
      <div className="hg-selact__barra">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o numero"
          aria-label="Buscar actividad"
          compacto
        />
        {!soloLectura && visibles.length > 0 && (
          <Button
            variante="ghost"
            tamano="sm"
            onClick={() =>
              onCambio(
                todasVisiblesMarcadas
                  ? seleccion.filter((id) => !visibles.includes(id))
                  : [...new Set([...seleccion, ...visibles])],
              )
            }
          >
            {todasVisiblesMarcadas ? 'Quitar' : 'Marcar'} lo visible
          </Button>
        )}
        <span className="hg-t-xs hg-t-sec hg-selact__conteo">
          {seleccion.length} seleccionada(s)
        </span>
      </div>

      <div className="hg-selact__lista" role="group" aria-label={etiquetaAria}>
        {grupos.length === 0 ? (
          <p className="hg-t-sm hg-t-sec" style={{ padding: 'var(--sp-sm)' }}>
            Ninguna actividad coincide con “{busqueda}”.
          </p>
        ) : (
          grupos.map((g) => (
            <section key={g.fase.faseId}>
              <h4 className="hg-selact__fase">
                {g.fase.nombre}
                <span className="hg-t-ter"> · {g.items.length}</span>
              </h4>
              {g.items.map((a) => {
                const marcada = seleccion.includes(a.id)
                const c = estadoColors.actividad[a.estado as keyof typeof estadoColors.actividad]
                return (
                  <label
                    key={a.id}
                    className={`hg-selact__item${marcada ? ' hg-selact__item--on' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      disabled={soloLectura}
                      onChange={() => alternar(a.id)}
                    />
                    <span className="hg-selact__texto">
                      <span className="hg-t-sm">
                        <span className="hg-t-ter">{a.numero}.</span> {a.nombre}
                      </span>
                      <span className="hg-t-xs hg-t-ter">
                        fin {formatearFecha(a.fechaFin)}
                      </span>
                    </span>
                    {a.estado && (
                      <Badge fg={c?.fg ?? '#64748B'} bg={c?.bg ?? '#F1F5F9'}>
                        {a.estado}
                      </Badge>
                    )}
                    {marcada && <IconCheck size={14} />}
                  </label>
                )
              })}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
