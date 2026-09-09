/**
 * Campos de formulario (guia 6.2): label semibold, borde 2px, foco azul,
 * estado de error explicito y texto de ayuda.
 */

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useId } from 'react'

interface Envoltura {
  label?: string
  ayuda?: string
  error?: string | null
  requerido?: boolean
  anchoCompleto?: boolean
  children: (id: string, invalido: boolean) => ReactNode
}

export function Campo({ label, ayuda, error, requerido, anchoCompleto, children }: Envoltura) {
  const id = useId()
  const invalido = Boolean(error)
  return (
    <div className={`hg-campo${anchoCompleto ? ' hg-col-span' : ''}`}>
      {label && (
        <label className="hg-campo__label" htmlFor={id}>
          {label}
          {requerido && (
            <span className="hg-campo__req" aria-hidden="true" title="Campo obligatorio">
              *
            </span>
          )}
        </label>
      )}
      {children(id, invalido)}
      {error ? (
        <span className="hg-campo__error" role="alert">
          {error}
        </span>
      ) : (
        ayuda && <span className="hg-campo__ayuda">{ayuda}</span>
      )}
    </div>
  )
}

type PropsInput = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string
  ayuda?: string
  error?: string | null
  requerido?: boolean
  anchoCompleto?: boolean
  compacto?: boolean
}

export function Input({
  label,
  ayuda,
  error,
  requerido,
  anchoCompleto,
  compacto,
  className = '',
  ...rest
}: PropsInput) {
  return (
    <Campo
      label={label}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      anchoCompleto={anchoCompleto}
    >
      {(id, invalido) => (
        <input
          id={id}
          className={`hg-input${compacto ? ' hg-input--sm' : ''}${invalido ? ' hg-input--error' : ''} ${className}`}
          aria-invalid={invalido || undefined}
          required={requerido}
          {...rest}
        />
      )}
    </Campo>
  )
}

type PropsSelect = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  ayuda?: string
  error?: string | null
  requerido?: boolean
  anchoCompleto?: boolean
  compacto?: boolean
  opciones?: readonly string[] | { valor: string; etiqueta: string }[]
  placeholder?: string
}

export function Select({
  label,
  ayuda,
  error,
  requerido,
  anchoCompleto,
  compacto,
  opciones,
  placeholder,
  className = '',
  children,
  ...rest
}: PropsSelect) {
  const items = (opciones ?? []).map((o) =>
    typeof o === 'string' ? { valor: o, etiqueta: o } : o,
  )
  return (
    <Campo
      label={label}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      anchoCompleto={anchoCompleto}
    >
      {(id, invalido) => (
        <select
          id={id}
          className={`hg-select${compacto ? ' hg-input--sm' : ''}${invalido ? ' hg-select--error' : ''} ${className}`}
          aria-invalid={invalido || undefined}
          required={requerido}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {items.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
          {children}
        </select>
      )}
    </Campo>
  )
}

type PropsTextarea = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  ayuda?: string
  error?: string | null
  requerido?: boolean
  anchoCompleto?: boolean
}

export function Textarea({
  label,
  ayuda,
  error,
  requerido,
  anchoCompleto,
  className = '',
  ...rest
}: PropsTextarea) {
  return (
    <Campo
      label={label}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      anchoCompleto={anchoCompleto}
    >
      {(id, invalido) => (
        <textarea
          id={id}
          className={`hg-textarea${invalido ? ' hg-textarea--error' : ''} ${className}`}
          aria-invalid={invalido || undefined}
          required={requerido}
          {...rest}
        />
      )}
    </Campo>
  )
}

export function Checkbox({
  label,
  disabled,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`hg-check${disabled ? ' hg-check--disabled' : ''}`}>
      <input type="checkbox" disabled={disabled} {...rest} />
      <span>{label}</span>
    </label>
  )
}
