/** Formato de presentacion. Moneda local y cifras tabulares en toda la aplicacion. */

export function moneda(valor: number | null | undefined, codigo = 'COP'): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: codigo,
    maximumFractionDigits: 0,
  }).format(valor)
}

export function monedaCorta(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  const abs = Math.abs(valor)
  const signo = valor < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${signo}$ ${(abs / 1_000_000_000).toFixed(1)} mm`
  if (abs >= 1_000_000) return `${signo}$ ${(abs / 1_000_000).toFixed(1)} M`
  if (abs >= 1_000) return `${signo}$ ${(abs / 1_000).toFixed(0)} k`
  return `${signo}$ ${abs.toFixed(0)}`
}

export function numero(valor: number | null | undefined, decimales = 0): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

export function porcentaje(valor: number | null | undefined, decimales = 1): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return `${valor.toFixed(decimales)} %`
}

export function conSigno(valor: number, decimales = 1, sufijo = ''): string {
  const s = valor > 0 ? '+' : ''
  return `${s}${valor.toFixed(decimales)}${sufijo}`
}

export function iniciales(nombre: string): string {
  return (nombre || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function truncar(texto: string, largo = 60): string {
  if (!texto) return ''
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto
}

export function fechaHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}
