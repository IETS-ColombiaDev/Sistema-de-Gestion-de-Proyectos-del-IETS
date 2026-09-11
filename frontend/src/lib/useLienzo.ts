import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Escala tipografica de los graficos, en pixeles reales.
 *
 * Antes el lienzo tenia un ancho fijo (700-760 unidades) y se estiraba con
 * `width: 100%`. Eso hacia que 1 unidad valiera 1.39 px en una tarjeta ancha y
 * 0.71 px en una de media columna: el mismo texto se leia a 14 px o a 7 px
 * segun donde cayera, y la altura del grafico la decidia el ancho del
 * contenedor, no el diseno. De ahi salian filas desparejas y el modo
 * `compacto`, que compensaba el sintoma agrandando la tipografia.
 *
 * Ahora el lienzo se mide y se dibuja 1:1: una unidad del SVG es un pixel de
 * pantalla. El tamano del texto es el que dice el numero, en cualquier ancho, y
 * la altura es exactamente la que pide el tablero.
 */
export const TIPO_MINIMA = 11

/** Tamano de fuente real, con piso de legibilidad. */
export function fuente(base: number): number {
  return Math.max(TIPO_MINIMA, base)
}

/**
 * Alturas de grafico del sistema. Los graficos de una misma fila comparten
 * token para que la fila lea pareja; un numero suelto rompe esa lectura.
 */
export const ALTO = {
  /** Tira de apoyo: sparkline, bullet. */
  tira: 64,
  /** Grafico secundario dentro de una tarjeta de media columna. */
  sm: 220,
  /** Grafico principal de una tarjeta. */
  md: 300,
  /** Grafico protagonista, a ancho completo. */
  lg: 380,
} as const

/**
 * Mide el contenedor y devuelve el lienzo en pixeles reales.
 *
 * El SVG se posiciona en absoluto sobre el contenedor, de modo que su tamano
 * nunca realimenta la altura medida: sin ese cuidado, medir la altura de un
 * elemento cuyo hijo la determina entra en un ciclo de redimension.
 *
 * @param alto Altura en pixeles. Si se omite, el grafico adopta la altura que
 *   le imponga el contenedor (una tarjeta estirada dentro de una fila), lo que
 *   permite que llene el espacio en vez de dejar un hueco.
 */
export function useLienzo(alto?: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 })

  useLayoutEffect(() => {
    const nodo = ref.current
    if (!nodo) return
    const medir = () => {
      const r = nodo.getBoundingClientRect()
      setMedida((previa) => {
        const ancho = Math.round(r.width)
        const altoMedido = Math.round(r.height)
        // Sin esta comparacion, cada medida programa un render que vuelve a
        // medir: el ResizeObserver no se detendria nunca.
        if (previa.ancho === ancho && previa.alto === altoMedido) return previa
        return { ancho, alto: altoMedido }
      })
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [])

  const W = medida.ancho
  const H = alto ?? medida.alto

  return {
    ref,
    W,
    H,
    /** Falso hasta la primera medida: dibujar antes daria un lienzo de 0 px. */
    listo: W > 0 && H > 0,
    /**
     * Lienzo angosto. La respuesta correcta es mostrar menos marcas, no
     * encoger el texto: una etiqueta de 7 px no se lee en ningun dispositivo.
     */
    denso: W > 0 && W < 520,
    /** Estilo del contenedor que se mide. */
    estilo: {
      position: 'relative' as const,
      width: '100%',
      ...(alto != null ? { height: alto } : { flex: 1, minHeight: ALTO.sm }),
    },
    /** Estilo del SVG: llena el contenedor sin influir en su tamano. */
    estiloSvg: {
      position: 'absolute' as const,
      inset: 0,
      display: 'block' as const,
      overflow: 'visible' as const,
    },
  }
}

/**
 * Mide solo el ancho. Para los graficos construidos con HTML —donde la altura
 * la da el contenido— que aun asi necesitan saber cuanto espacio real tienen
 * para repartir rotulos.
 */
export function useAncho() {
  const ref = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)

  useLayoutEffect(() => {
    const nodo = ref.current
    if (!nodo) return
    const medir = () => {
      const w = Math.round(nodo.getBoundingClientRect().width)
      setAncho((previo) => (previo === w ? previo : w))
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [])

  return { ref, ancho }
}
