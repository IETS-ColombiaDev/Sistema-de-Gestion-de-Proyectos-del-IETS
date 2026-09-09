interface Props<T extends string> {
  opciones: { valor: T; etiqueta: string; conteo?: number }[]
  activa: T
  onCambiar: (v: T) => void
  etiquetaAria?: string
}

export default function Tabs<T extends string>({ opciones, activa, onCambiar, etiquetaAria }: Props<T>) {
  return (
    <div className="hg-tabs" role="tablist" aria-label={etiquetaAria}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={activa === o.valor}
          className={`hg-tab${activa === o.valor ? ' hg-tab--activo' : ''}`}
          onClick={() => onCambiar(o.valor)}
        >
          {o.etiqueta}
          {o.conteo != null && (
            <span className="hg-t-xs hg-t-ter" style={{ marginLeft: 6 }}>
              {o.conteo}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
