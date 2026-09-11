/**
 * Consolidacion de portafolio — EP-23, con valor ganado.
 *
 * Carga todos los proyectos visibles, ejecuta el motor sobre cada uno y agrega
 * el resultado. La agregacion no es un promedio de porcentajes: se suman las
 * magnitudes en dinero y se dividen los totales. Promediar indices de
 * proyectos de tamano distinto da una cifra que no significa nada —un proyecto
 * de 20 millones pesaria igual que uno de 500— y es el error mas comun en un
 * tablero de portafolio.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { calcularIndicadores } from '@/domain/indicadores'
import { resumirProyecto, type ResumenProyecto } from '@/domain/reglas'
import { analizarCostos, type AnalisisCostos } from '@/domain/evm'
import { cargarDatosProyecto, listarProyectos, listarSnapshots, obtenerParametros } from '@/data/repo'
import { proyectosVisibles } from '@/auth/permisos'
import { useAuth } from '@/auth/AuthContext'
import { moneda } from '@/lib/formato'
import type {
  DatosProyecto,
  Parametros,
  Proyecto,
  ResultadoIndicador,
  Snapshot,
} from '@/domain/types'

export interface FilaPortafolio {
  proyecto: Proyecto
  datos: DatosProyecto
  resumen: ResumenProyecto
  indicadores: ResultadoIndicador[]
  analisis: AnalisisCostos
  instantaneas: Snapshot[]
  /** Serie del avance ponderado para el sparkline de tendencia. */
  tendencia: number[]
  alertasCriticas: number
}

export interface TotalesPortafolio {
  proyectos: number
  activos: number
  cerrados: number
  borradores: number
  /** Avance ponderado por dinero, no promedio de porcentajes. */
  avanceMedio: number
  riesgosCriticos: number
  actividadesRetrasadas: number
  hitosVencidos: number
  presupuestoTotal: number
  valorPlaneado: number
  valorGanado: number
  costoReal: number
  /** Indices consolidados, calculados sobre los totales en dinero. */
  indiceCronograma: number | null
  indiceCosto: number | null
  proyeccionCierre: number
  variacionAlCierre: number
  /** Proyectos cuya proyeccion excede su presupuesto aprobado. */
  proyectosEnSobrecosto: number
  /** Suma de los sobrecostos proyectados: el dinero que hay que decidir. */
  sobrecostoProyectado: number
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

      const cargados = await Promise.all(
        visibles.map(async (p) => {
          const [datos, instantaneas] = await Promise.all([
            cargarDatosProyecto(p.id),
            listarSnapshots(p.id),
          ])
          return { datos, instantaneas }
        }),
      )

      setFilas(
        cargados
          .filter((x): x is { datos: DatosProyecto; instantaneas: Snapshot[] } => x.datos !== null)
          .map(({ datos, instantaneas }) => {
            const resumen = resumirProyecto(datos, params)
            const analisis = analizarCostos(datos, resumen, instantaneas, {
              moneda: (n) => moneda(n, datos.proyecto.moneda),
            })
            return {
              proyecto: datos.proyecto,
              datos,
              resumen,
              indicadores: calcularIndicadores(datos, resumen),
              analisis,
              instantaneas,
              tendencia: instantaneas.map((s) => s.avancePonderado),
              alertasCriticas:
                resumen.retrasadas.length +
                resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado').length +
                resumen.hitos.filter((h) => h.vencido).length,
            }
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

  const totales = useMemo<TotalesPortafolio>(() => {
    const activos = filas.filter((f) => f.proyecto.estado === 'activo')

    // Agregacion en dinero: cada proyecto pesa lo que vale.
    const presupuestoTotal = activos.reduce((s, f) => s + f.analisis.evm.presupuestoTotal, 0)
    const valorPlaneado = activos.reduce((s, f) => s + f.analisis.evm.valorPlaneado, 0)
    const valorGanado = activos.reduce((s, f) => s + f.analisis.evm.valorGanado, 0)
    const costoReal = activos.reduce((s, f) => s + f.analisis.evm.costoReal, 0)

    const r2 = (n: number) => Math.round(n * 100) / 100
    const proyeccionCierre = activos.reduce(
      (s, f) => s + (f.analisis.evm.proyeccionCierre ?? f.analisis.evm.presupuestoTotal),
      0,
    )
    const enSobrecosto = activos.filter(
      (f) => (f.analisis.evm.variacionAlCierre ?? 0) < 0,
    )

    return {
      proyectos: filas.length,
      activos: activos.length,
      cerrados: filas.filter((f) => f.proyecto.estado === 'cerrado').length,
      borradores: filas.filter((f) => f.proyecto.estado === 'borrador').length,
      avanceMedio: presupuestoTotal > 0 ? r2((valorGanado / presupuestoTotal) * 100) : 0,
      riesgosCriticos: filas.reduce(
        (s, f) =>
          s + f.resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado').length,
        0,
      ),
      actividadesRetrasadas: filas.reduce((s, f) => s + f.resumen.retrasadas.length, 0),
      hitosVencidos: filas.reduce((s, f) => s + f.resumen.hitos.filter((h) => h.vencido).length, 0),
      presupuestoTotal,
      valorPlaneado,
      valorGanado,
      costoReal,
      indiceCronograma: valorPlaneado > 0 ? r2(valorGanado / valorPlaneado) : null,
      indiceCosto: costoReal > 0 ? r2(valorGanado / costoReal) : null,
      proyeccionCierre,
      variacionAlCierre: presupuestoTotal - proyeccionCierre,
      proyectosEnSobrecosto: enSobrecosto.length,
      sobrecostoProyectado: enSobrecosto.reduce(
        (s, f) => s + Math.abs(f.analisis.evm.variacionAlCierre ?? 0),
        0,
      ),
    }
  }, [filas])

  return { filas, totales, parametros, cargando, error, recargar: cargar }
}
