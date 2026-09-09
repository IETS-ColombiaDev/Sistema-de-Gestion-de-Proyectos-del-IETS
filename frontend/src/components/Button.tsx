/**
 * Boton unico del sistema (guia 6.1). Un solo componente, familia de variantes.
 * No coexiste con otro boton: nuevas pantallas usan este.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type VarianteBoton = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline'
export type TamanoBoton = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  tamano?: TamanoBoton
  icono?: ReactNode
  soloIcono?: boolean
  bloque?: boolean
  cargando?: boolean
}

export default function Button({
  variante = 'secondary',
  tamano = 'md',
  icono,
  soloIcono = false,
  bloque = false,
  cargando = false,
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  const clases = [
    'hg-btn',
    `hg-btn--${variante}`,
    `hg-btn--${tamano}`,
    soloIcono ? 'hg-btn--icono' : '',
    bloque ? 'hg-btn--bloque' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={clases} disabled={disabled || cargando} {...rest}>
      {cargando ? (
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'hg-spin 700ms linear infinite',
          }}
        />
      ) : (
        icono
      )}
      {!soloIcono && children}
    </button>
  )
}
