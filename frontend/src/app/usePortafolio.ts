/**
 * Consolidacion de portafolio — EP-23.
 * Carga todos los proyectos visibles y ejecuta el motor sobre cada uno para
 * producir una lectura institucional comparable.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { calcularIndicadores } from '@/domain/indicadores'
import { resumirProyecto, type ResumenProyecto } from '@/domain/reglas'
import { cargarDatosProyecto, listarProyectos, obtenerParametros } from '@/data/repo'
import { proyectosVisibles } from '@/auth/permisos'
import { useAuth } from '@/auth/AuthContext'
import type { DatosProyecto, Parametros, Proyecto, ResultadoIndicador } from '@/domain/types'

export interface FilaPortafolio {
  proyecto: Proyecto
  datos: DatosProyecto
  resumen: ResumenProyecto
  indicadores: ResultadoIndicador[]
  alertasCriticas: number
}

export function usePortafolio() {
  const { usuario } = useAuth()
  const [filas, setFilas] = useState<FilaPortafolio[]>([])
  const [parametros, setParametros] = useState<Parametros | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [todos, params] = await Promise.all([listarProyectos(), obtenerParametros()])
      setParametros(params)
      const visibles = proyectosVisibles(usuario, todos)
      const datos = await Promise.all(visibles.map((p) => cargarDatosProyecto(p.id)))

      setFilas(
        datos
          .filter((d): d is DatosProyecto => d !== null)
          .map((d) => {
            const resumen = resumirProyecto(d, params)
            const indicadores = calcularIndicadores(d, resumen)
            const alertasCriticas =
              resumen.retrasadas.length +
              resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado').length +
              resumen.hitos.filter((h) => h.vencido).length
            return { proyecto: d.proyecto, datos: d, resumen, indicadores, alertasCriticas }
          })
          .sort((a, b) => a.proyecto.codigo.localeCompare(b.proyecto.codigo)),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [usuario])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const totales = useMemo(() => {
    const activos = filas.filter((f) => f.proyecto.estado === 'activo')
    const denom = activos.reduce((s, f) => s + f.resumen.actividades.filter((a) => !a.vacia).length, 0)
    const avanceMedio =
      denom === 0
        ? 0
        : activos.reduce(
            (s, f) => s + f.resumen.avancePonderado * f.resumen.actividades.filter((a) => !a.vacia).length,
            0,
          ) / denom
    return {
      proyectos: filas.length,
      activos: activos.length,
      cerrados: filas.filter((f) => f.proyecto.estado === 'cerrado').length,
      borradores: filas.filter((f) => f.proyecto.estado === 'borrador').length,
      avanceMedio: Math.round(avanceMedio * 10) / 10,
      riesgosCriticos: filas.reduce(
        (s, f) => s + f.resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado').length,
        0,
      ),
      actividadesRetrasadas: filas.reduce((s, f) => s + f.resumen.retrasadas.length, 0),
      hitosVencidos: filas.reduce((s, f) => s + f.resumen.hitos.filter((h) => h.vencido).length, 0),
      presupuestoProgramado: filas.reduce(
        (s, f) => s + f.datos.presupuesto.reduce((x, r) => x + (r.programado || 0), 0),
        0,
      ),
      presupuestoEjecutado: filas.reduce(
        (s, f) => s + f.datos.presupuesto.reduce((x, r) => x + (r.ejecutado || 0), 0),
        0,
      ),
    }
  }, [filas])

  return { filas, totales, parametros, cargando, error, recargar: cargar }
}
