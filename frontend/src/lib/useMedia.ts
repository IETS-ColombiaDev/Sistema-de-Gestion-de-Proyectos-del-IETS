import { useEffect, useState } from 'react'

/**
 * Suscripcion a una media query. Se usa para las decisiones de layout que no
 * pueden resolverse solo con CSS, como el ancho de la columna de etiquetas del
 * Gantt o la densidad de una vista.
 */
export function useMedia(consulta: string): boolean {
  const [coincide, setCoincide] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(consulta).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(consulta)
    const alCambiar = (e: MediaQueryListEvent) => setCoincide(e.matches)
    setCoincide(mql.matches)
    mql.addEventListener('change', alCambiar)
    return () => mql.removeEventListener('change', alCambiar)
  }, [consulta])

  return coincide
}

export const esMovil = '(max-width: 640px)'
export const esTableta = '(max-width: 1023px)'
