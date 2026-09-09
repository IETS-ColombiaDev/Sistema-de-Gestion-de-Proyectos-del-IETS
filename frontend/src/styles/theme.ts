/**
 * Fuente de verdad de los design tokens (linea-grafica-y-ux-ui.md).
 * Todo hex de la aplicacion sale de aqui. Si cambia el tema, se actualiza la guia.
 * Los tokens se exponen ademas como variables CSS en globals.css para uso en hojas de estilo.
 */

export const colors = {
  primary: {
    purple: '#6366F1',
    purpleDark: '#4F46E5',
    purpleLight: '#818CF8',
    blue: '#3B82F6',
    aquamarine: '#06B6D4',
  },
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    tertiary: '#94A3B8',
    inverse: '#FFFFFF',
  },
  backgrounds: {
    app: '#F8FAFC',
    card: '#FFFFFF',
    sidebar: '#FFFFFF',
    hover: '#F1F5F9',
    active: '#EEF2FF',
    overlay: 'rgba(15, 23, 42, 0.45)',
  },
  borders: {
    light: '#E2E8F0',
    medium: '#CBD5E1',
    dark: '#94A3B8',
  },
  status: {
    success: '#10B981',
    successSoft: '#D1FAE5',
    warning: '#F59E0B',
    warningSoft: '#FEF3C7',
    error: '#EF4444',
    errorSoft: '#FEE2E2',
    info: '#3B82F6',
    infoSoft: '#DBEAFE',
  },
  /** Banner de contexto: modo solo lectura, suplantacion de rol, entorno de prueba. */
  contextBanner: {
    bg: '#FEF3C7',
    border: '#FDE68A',
    text: '#92400E',
  },
  /** Paleta de datos para graficos — derivada del tema, no se introducen colores externos. */
  accent: {
    indigo: '#6366F1',
    blue: '#3B82F6',
    cyan: '#06B6D4',
    emerald: '#10B981',
    amber: '#F59E0B',
    rose: '#EF4444',
    violet: '#818CF8',
    slate: '#94A3B8',
  },
} as const

export const gradients = {
  /** Gradiente de acento purple -> blue, 135deg. Marca, avatares sin imagen, acentos leves. */
  brand: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)',
} as const

export const fonts = {
  primary:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  sizes: {
    xs: '11px',
    sm: '13px',
    base: '15px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const

export const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '40px',
  '4xl': '64px',
} as const

export const borderRadius = {
  sm: '4px',
  base: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const

export const shadows = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
  base: '0 1px 3px rgba(15, 23, 42, 0.10), 0 1px 2px rgba(15, 23, 42, 0.06)',
  md: '0 4px 10px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.06)',
  lg: '0 10px 25px rgba(15, 23, 42, 0.12)',
  xl: '0 20px 40px rgba(15, 23, 42, 0.16)',
} as const

export const transitions = {
  fast: '150ms ease-in-out',
  base: '200ms ease-in-out',
  slow: '300ms ease-in-out',
} as const

export const layout = {
  sidebarWidth: '280px',
  headerHeight: '64px',
  contentGutter: '24px',
  breakpoints: { md: 768, lg: 1024, xl: 1280 },
} as const

/** Colores semanticos por estado de negocio — unicos en toda la aplicacion. */
export const estadoColors = {
  actividad: {
    Pendiente: { fg: '#64748B', bg: '#F1F5F9', bar: '#94A3B8' },
    'En curso': { fg: '#1D4ED8', bg: '#DBEAFE', bar: '#3B82F6' },
    Completada: { fg: '#047857', bg: '#D1FAE5', bar: '#10B981' },
    Retrasada: { fg: '#B91C1C', bg: '#FEE2E2', bar: '#EF4444' },
  },
  hito: {
    Pendiente: { fg: '#64748B', bg: '#F1F5F9' },
    'En curso': { fg: '#1D4ED8', bg: '#DBEAFE' },
    Cumplido: { fg: '#047857', bg: '#D1FAE5' },
    'Cumplido con retraso': { fg: '#92400E', bg: '#FEF3C7' },
    'No cumplido': { fg: '#B91C1C', bg: '#FEE2E2' },
  },
  riesgo: {
    Bajo: { fg: '#047857', bg: '#D1FAE5' },
    Medio: { fg: '#92400E', bg: '#FEF3C7' },
    Alto: { fg: '#C2410C', bg: '#FFEDD5' },
    Critico: { fg: '#B91C1C', bg: '#FEE2E2' },
  },
  indicador: {
    Cumple: { fg: '#047857', bg: '#D1FAE5' },
    'Atencion': { fg: '#92400E', bg: '#FEF3C7' },
    'Critico': { fg: '#B91C1C', bg: '#FEE2E2' },
    'Sin datos': { fg: '#64748B', bg: '#F1F5F9' },
  },
  recurso: {
    'Por gestionar': { fg: '#92400E', bg: '#FEF3C7' },
    Disponible: { fg: '#047857', bg: '#D1FAE5' },
    Reservado: { fg: '#1D4ED8', bg: '#DBEAFE' },
    'No disponible': { fg: '#B91C1C', bg: '#FEE2E2' },
  },
} as const

export const theme = {
  colors,
  gradients,
  fonts,
  spacing,
  borderRadius,
  shadows,
  transitions,
  layout,
  estadoColors,
} as const

export type Theme = typeof theme
export default theme
