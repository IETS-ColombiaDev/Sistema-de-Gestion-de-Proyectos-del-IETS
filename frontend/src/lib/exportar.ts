/**
 * Exportacion a Excel y CSV — HG-129, HG-146, HG-147.
 * La generacion se hace en el cliente para el modo local; en produccion con
 * Firebase la misma estructura se genera en Cloud Functions (ADR-10) y esta
 * ruta queda como respaldo.
 */

import * as XLSX from 'xlsx'

export interface Hoja {
  nombre: string
  filas: Record<string, unknown>[]
}

function nombreArchivo(base: string, extension: string): string {
  const fecha = new Date().toISOString().slice(0, 10)
  const limpio = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${limpio}-${fecha}.${extension}`
}

export function exportarExcel(hojas: Hoja[], nombreBase: string): void {
  const libro = XLSX.utils.book_new()
  for (const hoja of hojas) {
    const datos = hoja.filas.length ? hoja.filas : [{ '': 'Sin registros' }]
    const ws = XLSX.utils.json_to_sheet(datos)
    // Ancho de columna proporcional al contenido, con tope razonable.
    const claves = Object.keys(datos[0] ?? {})
    ws['!cols'] = claves.map((c) => ({
      wch: Math.min(
        48,
        Math.max(12, c.length + 2, ...datos.map((f) => String(f[c] ?? '').length + 2)),
      ),
    }))
    XLSX.utils.book_append_sheet(libro, ws, hoja.nombre.slice(0, 31))
  }
  XLSX.writeFile(libro, nombreArchivo(nombreBase, 'xlsx'))
}

export function exportarCSV(filas: Record<string, unknown>[], nombreBase: string): void {
  const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ '': 'Sin registros' }])
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
  // BOM para que Excel en espanol reconozca UTF-8.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(nombreBase, 'csv')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Lectura de un libro cargado por el usuario (EP-24). */
export async function leerLibro(archivo: File): Promise<XLSX.WorkBook> {
  const buffer = await archivo.arrayBuffer()
  return XLSX.read(buffer, { type: 'array', cellDates: true })
}

export function hojaAFilas(libro: XLSX.WorkBook, nombreHoja: string): Record<string, unknown>[] {
  const hoja = libro.Sheets[nombreHoja]
  if (!hoja) return []
  return XLSX.utils.sheet_to_json(hoja, { defval: null, raw: false })
}
