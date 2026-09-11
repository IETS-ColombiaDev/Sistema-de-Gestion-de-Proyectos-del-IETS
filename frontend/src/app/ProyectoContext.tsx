/**
 * Contexto de proyecto: carga los datos, ejecuta el motor de calculo y expone
 * el resumen, los indicadores y las alertas a todos los modulos.
 *
 * El calculo es derivado y se recompone en memoria a partir de los datos fuente
 * (principio: un tablero nunca se corrige, se corrige el dato). El "recalculo"
 * explicito que ofrece la interfaz sirve para levantar la marca de datos
 * desactualizados y para dejar una instantanea por fecha de corte.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useParams } from 'react-router-dom'
import { construirAlertas } from '@/domain/alertas'
import { calcularIndicadores } from '@/domain/indicadores'
import { resumirProyecto, type ResumenProyecto } from '@/domain/reglas'
import { analizarCostos, type AnalisisCostos } from '@/domain/evm'
import {
  cargarDatosProyecto,
  guardarSnapshot,
  limpiarRecalculoPendiente,
  listarSnapshots,
  obtenerCatalogoIndicadores,
  obtenerListas,
  obtenerParametros,
  registrarEventoSimple,
} from '@/data/repo'
import { moneda } from '@/lib/formato'
import type {
  Alerta,
  DatosProyecto,
  DefinicionIndicador,
  ListaControlada,
  Parametros,
  ResultadoIndicador,
  Snapshot,
} from '@/domain/types'

interface EstadoProyecto {
  proyectoId: string
  datos: DatosProyecto | null
  resumen: ResumenProyecto | null
  indicadores: ResultadoIndicador[]
  catalogoIndicadores: DefinicionIndicador[]
  alertas: Alerta[]
  parametros: Parametros | null
  listas: ListaControlada[]
  /** Instantaneas por fecha de corte: la serie historica real del proyecto. */
  instantaneas: Snapshot[]
  /**
   * Valor ganado y costos. Se calcula una sola vez aqui para que el dashboard,
   * el tablero y el modulo de costos no puedan mostrar cifras distintas.
   */
  analisis: AnalisisCostos | null
  cargando: boolean
  error: string | null
  recargar: () => Promise<void>
  recalcular: () => Promise<void>
}

const Ctx = createContext<EstadoProyecto | null>(null)

export function ProyectoProvider({ children }: { children: ReactNode }) {
  const { proyectoId = '' } = useParams()
  const [datos, setDatos] = useState<DatosProyecto | null>(null)
  const [parametros, setParametros] = useState<Parametros | null>(null)
  const [listas, setListas] = useState<ListaControlada[]>([])
  const [catalogoIndicadores, setCatalogo] = useState<DefinicionIndicador[]>([])
  const [instantaneas, setInstantaneas] = useState<Snapshot[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    if (!proyectoId) return
    setCargando(true)
    setError(null)
    try {
      const [d, p, l, c, s] = await Promise.all([
        cargarDatosProyecto(proyectoId),
        obtenerParametros(),
        obtenerListas(),
        obtenerCatalogoIndicadores(),
        listarSnapshots(proyectoId),
      ])
      if (!d) {
        setError('El proyecto no existe o fue eliminado.')
        setDatos(null)
      } else {
        setDatos(d)
      }
      setParametros(p)
      setListas(l)
      setCatalogo(c)
      setInstantaneas(s)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [proyectoId])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const resumen = useMemo(
    () => (datos && parametros ? resumirProyecto(datos, parametros) : null),
    [datos, parametros],
  )

  const indicadores = useMemo(
    () =>
      datos && resumen
        ? calcularIndicadores(datos, resumen, catalogoIndicadores.length ? catalogoIndicadores : undefined)
        : [],
    [datos, resumen, catalogoIndicadores],
  )

  const alertas = useMemo(
    () => (datos && resumen ? construirAlertas(datos, resumen) : []),
    [datos, resumen],
  )

  const analisis = useMemo(
    () =>
      datos && resumen
        ? analizarCostos(datos, resumen, instantaneas, {
            moneda: (n) => moneda(n, datos.proyecto.moneda),
          })
        : null,
    [datos, resumen, instantaneas],
  )

  const recalcular = useCallback(async () => {
    if (!datos || !resumen) return
    const p = datos.proyecto
    await guardarSnapshot({
      id: p.fechaCorte,
      proyectoId: p.id,
      fechaCorte: p.fechaCorte,
      creadoEn: new Date().toISOString(),
      creadoPor: p.actualizadoPor,
      indicadores,
      avancePonderado: resumen.avancePonderado,
      avanceEsperado: resumen.avanceEsperado,
      avanceSimple: resumen.avanceSimple,
      desviacion: resumen.desviacion.puntos,
      actividadesPorEstado: Object.fromEntries(
        resumen.distribucion.map((d) => [d.estado || 'Sin estado', d.conteo]),
      ),
      riesgosPorNivel: resumen.riesgos.reduce<Record<string, number>>((acc, r) => {
        if (r.nivel) acc[r.nivel] = (acc[r.nivel] ?? 0) + 1
        return acc
      }, {}),
    })
    await limpiarRecalculoPendiente(p.id)
    await registrarEventoSimple(
      'calcular',
      'proyecto',
      p.nombre,
      p.id,
      `Recalculo de indicadores a la fecha de corte ${p.fechaCorte}`,
    )
    await recargar()
  }, [datos, resumen, indicadores, recargar])

  const valor = useMemo<EstadoProyecto>(
    () => ({
      proyectoId,
      datos,
      resumen,
      indicadores,
      catalogoIndicadores,
      alertas,
      parametros,
      listas,
      instantaneas,
      analisis,
      cargando,
      error,
      recargar,
      recalcular,
    }),
    [
      proyectoId,
      datos,
      resumen,
      indicadores,
      catalogoIndicadores,
      alertas,
      parametros,
      listas,
      instantaneas,
      analisis,
      cargando,
      error,
      recargar,
      recalcular,
    ],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useProyecto(): EstadoProyecto {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useProyecto debe usarse dentro de ProyectoProvider.')
  return ctx
}
