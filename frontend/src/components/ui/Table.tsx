/**
 * Tabla del sistema (guia 6.6): cabecera con fondo de marca y texto blanco,
 * hover sutil, columnas numericas con cifras tabulares.
 * Es la unica variante de tabla de la aplicacion.
 */

import type { ReactNode } from 'react'
import { IconFlechaAbajo, IconFlechaArriba } from '../icons'

export interface Columna<T> {
  clave: string
  titulo: ReactNode
  render: (fila: T, indice: number) => ReactNode
  ancho?: string
  alineacion?: 'izquierda' | 'centro' | 'derecha'
  ordenable?: boolean
  /** Valor usado al ordenar; por defecto se intenta con fila[clave]. */
  valorOrden?: (fila: T) => string | number
  oculta?: boolean
}

interface Props<T> {
  columnas: Columna<T>[]
  filas: T[]
  claveDe: (fila: T) => string
  vacio?: ReactNode
  claseFila?: (fila: T) => string
  onFilaClick?: (fila: T) => void
  orden?: { clave: string; dir: 'asc' | 'desc' } | null
  onOrden?: (clave: string) => void
  pieResumen?: ReactNode
}

export default function Table<T>({
  columnas,
  filas,
  claveDe,
  vacio,
  claseFila,
  onFilaClick,
  orden,
  onOrden,
  pieResumen,
}: Props<T>) {
  const visibles = columnas.filter((c) => !c.oculta)
  const alineacionClase = (c: Columna<T>) =>
    c.alineacion === 'derecha' ? 'hg-num' : c.alineacion === 'centro' ? 'hg-centro' : ''

  return (
    <div className="hg-tabla-wrap">
      <table className="hg-tabla">
        <thead>
          <tr>
            {visibles.map((c) => (
              <th
                key={c.clave}
                style={c.ancho ? { width: c.ancho } : undefined}
                className={[alineacionClase(c), c.ordenable && onOrden ? 'hg-th--orden' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={c.ordenable && onOrden ? () => onOrden(c.clave) : undefined}
                aria-sort={
                  orden?.clave === c.clave
                    ? orden.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {c.titulo}
                  {orden?.clave === c.clave &&
                    (orden.dir === 'asc' ? (
                      <IconFlechaArriba size={12} />
                    ) : (
                      <IconFlechaAbajo size={12} />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr className="hg-tabla__vacia">
              <td colSpan={visibles.length}>{vacio ?? 'Sin registros.'}</td>
            </tr>
          ) : (
            filas.map((fila, i) => (
              <tr
                key={claveDe(fila)}
                className={claseFila?.(fila)}
                onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
                style={onFilaClick ? { cursor: 'pointer' } : undefined}
              >
                {visibles.map((c) => (
                  <td key={c.clave} className={alineacionClase(c)}>
                    {c.render(fila, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {pieResumen && (
          <tfoot>
            <tr style={{ background: 'var(--c-bg-hover)', fontWeight: 600 }}>{pieResumen}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Ordenamiento en cliente reutilizable por las tablas de los modulos. */
export function ordenar<T>(
  filas: T[],
  columnas: Columna<T>[],
  orden: { clave: string; dir: 'asc' | 'desc' } | null,
): T[] {
  if (!orden) return filas
  const col = columnas.find((c) => c.clave === orden.clave)
  if (!col) return filas
  const valor = (f: T) =>
    col.valorOrden ? col.valorOrden(f) : ((f as Record<string, unknown>)[col.clave] as string | number)
  return [...filas].sort((a, b) => {
    const va = valor(a) ?? ''
    const vb = valor(b) ?? ''
    const cmp =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'es', { numeric: true })
    return orden.dir === 'asc' ? cmp : -cmp
  })
}
