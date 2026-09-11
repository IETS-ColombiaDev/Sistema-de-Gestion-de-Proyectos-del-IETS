/**
 * Barra de filtros de tablero.
 *
 * Una sola fila por encima de todo lo que acota, nunca un filtro por tarjeta:
 * si cada grafico se filtra por separado, dos tarjetas contiguas pueden estar
 * mostrando cortes distintos de los datos y el lector no tiene forma de
 * saberlo. Aqui todos los graficos del tablero se recomponen contra la misma
 * rebanada.
 *
 * El estado vive en la URL, de modo que una vista filtrada se puede compartir,
 * marcar y recuperar al volver atras: para un comite eso es la diferencia entre
 * "mira este tablero" y "abre el tablero y filtra por estos cuatro criterios".
 */

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from './Button'
import Badge from './Badge'
import { Pista } from './Ayuda'
import { IconFiltro } from './icons'

export interface OpcionFiltro {
  valor: string
  etiqueta: string
}

export interface DefinicionFiltro {
  clave: string
  etiqueta: string
  tipo: 'select' | 'texto' | 'fecha'
  opciones?: OpcionFiltro[] | readonly string[]
  /** Texto de la opcion vacia en un select. */
  placeholder?: string
  ancho?: string
  pista?: string
}

export type ValoresFiltro = Record<string, string>

/**
 * Estado de filtros persistido en la URL.
 *
 * `prefijo` evita que dos tableros distintos se pisen los parametros cuando
 * comparten ruta, y mantiene legible la direccion.
 */
export function useFiltros(definiciones: DefinicionFiltro[], prefijo = 'f') {
  const [params, setParams] = useSearchParams()

  const valores = useMemo<ValoresFiltro>(() => {
    const salida: ValoresFiltro = {}
    for (const d of definiciones) salida[d.clave] = params.get(`${prefijo}_${d.clave}`) ?? ''
    return salida
  }, [params, definiciones, prefijo])

  const set = useCallback(
    (clave: string, valor: string) => {
      const siguientes = new URLSearchParams(params)
      if (valor) siguientes.set(`${prefijo}_${clave}`, valor)
      else siguientes.delete(`${prefijo}_${clave}`)
      setParams(siguientes, { replace: true })
    },
    [params, setParams, prefijo],
  )

  const limpiar = useCallback(() => {
    const siguientes = new URLSearchParams(params)
    for (const d of definiciones) siguientes.delete(`${prefijo}_${d.clave}`)
    setParams(siguientes, { replace: true })
  }, [params, setParams, definiciones, prefijo])

  const activos = useMemo(
    () => definiciones.filter((d) => valores[d.clave]).map((d) => d.clave),
    [definiciones, valores],
  )

  return { valores, set, limpiar, activos }
}

export default function FiltroBarra({
  definiciones,
  valores,
  onCambio,
  onLimpiar,
  activos,
  resumen,
  acciones,
}: {
  definiciones: DefinicionFiltro[]
  valores: ValoresFiltro
  onCambio: (clave: string, valor: string) => void
  onLimpiar: () => void
  activos: string[]
  /** Cuantos registros quedan tras filtrar, para que el recorte sea visible. */
  resumen?: string
  acciones?: React.ReactNode
}) {
  const normalizar = (d: DefinicionFiltro): OpcionFiltro[] =>
    (d.opciones ?? []).map((o) => (typeof o === 'string' ? { valor: o, etiqueta: o } : o))

  return (
    <section
      className="hg-filtros no-print"
      aria-label="Filtros del tablero"
      role="search"
    >
      <div className="hg-filtros__marca">
        <IconFiltro size={15} />
        <span className="hg-t-xs hg-t-bold">Filtros</span>
        {activos.length > 0 && (
          <Badge fg="#4F46E5" bg="#EEF2FF" titulo="Filtros aplicados a todos los graficos del tablero">
            {activos.length}
          </Badge>
        )}
      </div>

      <div className="hg-filtros__campos">
        {definiciones.map((d) => (
          <div key={d.clave} className="hg-campo" style={{ minWidth: d.ancho ?? 150, flex: '1 1 150px' }}>
            <label className="hg-campo__label hg-t-xs" htmlFor={`filtro-${d.clave}`}>
              {d.etiqueta}
              {d.pista && <Pista texto={d.pista} etiqueta={`Sobre el filtro ${d.etiqueta}`} />}
            </label>
            {d.tipo === 'select' ? (
              <select
                id={`filtro-${d.clave}`}
                className="hg-select hg-input--sm"
                value={valores[d.clave] ?? ''}
                onChange={(e) => onCambio(d.clave, e.target.value)}
              >
                <option value="">{d.placeholder ?? 'Todos'}</option>
                {normalizar(d).map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`filtro-${d.clave}`}
                type={d.tipo === 'fecha' ? 'date' : 'search'}
                className="hg-input hg-input--sm"
                value={valores[d.clave] ?? ''}
                placeholder={d.placeholder}
                onChange={(e) => onCambio(d.clave, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="hg-filtros__pie">
        {resumen && <span className="hg-t-xs hg-t-sec">{resumen}</span>}
        {activos.length > 0 && (
          <Button variante="ghost" tamano="sm" onClick={onLimpiar}>
            Limpiar filtros
          </Button>
        )}
        {acciones}
      </div>
    </section>
  )
}
