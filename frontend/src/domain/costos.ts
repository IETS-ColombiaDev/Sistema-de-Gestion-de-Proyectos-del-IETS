/**
 * Capa de costos.
 *
 * HOY el costo real del proyecto sale del modulo de Control presupuestal, que
 * es el libro mayor que lleva el equipo. MANANA saldra de la herramienta
 * institucional de costos. Para que ese cambio sea una sustitucion y no una
 * reescritura, todo el sistema lee el costo a traves de un solo contrato
 * —`ProveedorCostos`— igual que lee los datos a traves de `Adaptador`.
 *
 * El punto de conexion es `registrarProveedorCostos()`. Mientras no se
 * registre ninguno, opera el proveedor interno sobre los registros
 * presupuestales. Nada mas en la aplicacion sabe de donde viene el dinero.
 */

import { sumarMeses } from './fechas'
import type { DatosProyecto, ISODate, MiembroEquipo, RegistroPresupuestal } from './types'

// ---------------------------------------------------------------------------
// Contrato
// ---------------------------------------------------------------------------

/** Costo de un periodo mensual. Los importes son del periodo, no acumulados. */
export interface CostoPeriodo {
  /** 'YYYY-MM' */
  periodo: string
  /** Lo que se planeo gastar en el periodo. */
  programado: number
  /** Lo que efectivamente se causo en el periodo. */
  ejecutado: number
  /**
   * Lo comprometido y aun no causado: ordenes, contratos firmados.
   * El libro presupuestal actual no lo distingue; la herramienta de costos si.
   * Cuando llegue, deja de ser cero y el tablero de compromiso empieza a
   * significar algo sin cambiar una linea de la interfaz.
   */
  comprometido: number
}

export interface CostoDesagregado {
  clave: string
  programado: number
  ejecutado: number
  comprometido: number
}

export interface ProveedorCostos {
  readonly origen: 'interno' | 'externo'
  /** Nombre visible de la fuente, para que el usuario sepa qué está leyendo. */
  readonly nombre: string
  /** Marca de la ultima sincronizacion, si el proveedor es externo. */
  readonly sincronizadoEn?: string
  porPeriodo(datos: DatosProyecto): CostoPeriodo[]
  porRubro(datos: DatosProyecto): CostoDesagregado[]
  porFuente(datos: DatosProyecto): CostoDesagregado[]
}

// ---------------------------------------------------------------------------
// Proveedor interno: el libro presupuestal del propio sistema
// ---------------------------------------------------------------------------

function agrupar(
  registros: RegistroPresupuestal[],
  clave: (r: RegistroPresupuestal) => string,
): CostoDesagregado[] {
  const mapa = new Map<string, CostoDesagregado>()
  for (const r of registros) {
    const k = clave(r) || '(sin clasificar)'
    const acumulado = mapa.get(k) ?? { clave: k, programado: 0, ejecutado: 0, comprometido: 0 }
    acumulado.programado += Number(r.programado) || 0
    acumulado.ejecutado += Number(r.ejecutado) || 0
    mapa.set(k, acumulado)
  }
  return [...mapa.values()].sort((a, b) => b.ejecutado - a.ejecutado)
}

export const proveedorInterno: ProveedorCostos = {
  origen: 'interno',
  nombre: 'Control presupuestal del sistema',

  porPeriodo(datos) {
    const vigentes = datos.presupuesto.filter((r) => !r.eliminado)
    const mapa = new Map<string, CostoPeriodo>()
    for (const r of vigentes) {
      const p = mapa.get(r.periodo) ?? {
        periodo: r.periodo,
        programado: 0,
        ejecutado: 0,
        comprometido: 0,
      }
      p.programado += Number(r.programado) || 0
      p.ejecutado += Number(r.ejecutado) || 0
      mapa.set(r.periodo, p)
    }
    return [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))
  },

  porRubro(datos) {
    return agrupar(
      datos.presupuesto.filter((r) => !r.eliminado),
      (r) => r.rubro,
    )
  },

  porFuente(datos) {
    return agrupar(
      datos.presupuesto.filter((r) => !r.eliminado),
      (r) => r.fuente,
    )
  },
}

// ---------------------------------------------------------------------------
// Registro del proveedor
// ---------------------------------------------------------------------------

let proveedorActivo: ProveedorCostos = proveedorInterno

/**
 * Punto de conexion con la herramienta institucional de costos.
 *
 * Se llama una vez al iniciar la aplicacion, cuando la integracion exista.
 * A partir de ahi todos los tableros leen de la fuente externa sin que ningun
 * modulo cambie: el contrato es el mismo.
 */
export function registrarProveedorCostos(proveedor: ProveedorCostos): void {
  proveedorActivo = proveedor
}

export function proveedorCostos(): ProveedorCostos {
  return proveedorActivo
}

/** Solo para pruebas: restaura el proveedor interno. */
export function restaurarProveedorInterno(): void {
  proveedorActivo = proveedorInterno
}

// ---------------------------------------------------------------------------
// Vista normalizada que consumen los tableros
// ---------------------------------------------------------------------------

export interface SerieAcumulada {
  periodo: string
  programado: number
  ejecutado: number
  comprometido: number
  programadoAcum: number
  ejecutadoAcum: number
  comprometidoAcum: number
}

export interface CostoEquipo {
  /** Costo teorico de la dedicacion declarada: horas/mes x costo hora x meses. */
  estimado: number
  /** Perfiles sin costo hora registrado: el estimado no los incluye. */
  perfilesSinTarifa: number
  totalPerfiles: number
}

export interface VistaCostos {
  origen: ProveedorCostos['origen']
  nombreFuente: string
  sincronizadoEn?: string
  periodos: SerieAcumulada[]
  porRubro: CostoDesagregado[]
  porFuente: CostoDesagregado[]
  programadoTotal: number
  ejecutadoTotal: number
  comprometidoTotal: number
  /** Ritmo de gasto de los ultimos periodos con movimiento, por mes. */
  ritmoMensual: number
  /** Meses de operacion que alcanzan con lo que queda, al ritmo actual. */
  mesesDeCobertura: number | null
  equipo: CostoEquipo
}

function costoEquipo(equipo: MiembroEquipo[]): CostoEquipo {
  const vigentes = equipo.filter((m) => !m.eliminado)
  const conTarifa = vigentes.filter((m) => (m.costoHora ?? 0) > 0)
  return {
    estimado: conTarifa.reduce(
      (s, m) => s + (m.costoHora ?? 0) * (m.dedicacionHorasMes || 0) * (m.mesesVinculacion || 0),
      0,
    ),
    perfilesSinTarifa: vigentes.length - conTarifa.length,
    totalPerfiles: vigentes.length,
  }
}

/**
 * Normaliza lo que entrega el proveedor en la forma que consumen los tableros:
 * serie acumulada, desagregados, totales, ritmo de gasto y cobertura.
 */
export function vistaCostos(datos: DatosProyecto, presupuestoTotal?: number): VistaCostos {
  const proveedor = proveedorCostos()
  const crudos = proveedor.porPeriodo(datos)

  let accProg = 0
  let accEjec = 0
  let accComp = 0
  const periodos: SerieAcumulada[] = crudos.map((c) => {
    accProg += c.programado
    accEjec += c.ejecutado
    accComp += c.comprometido
    return {
      ...c,
      programadoAcum: accProg,
      ejecutadoAcum: accEjec,
      comprometidoAcum: accComp,
    }
  })

  // Ritmo: promedio de los ultimos tres periodos con gasto. Tres es el minimo
  // que suaviza un mes atipico sin diluir un cambio real de tendencia.
  const conGasto = periodos.filter((p) => p.ejecutado > 0)
  const ultimos = conGasto.slice(-3)
  const ritmoMensual =
    ultimos.length === 0 ? 0 : ultimos.reduce((s, p) => s + p.ejecutado, 0) / ultimos.length

  const techo = presupuestoTotal && presupuestoTotal > 0 ? presupuestoTotal : accProg
  const disponible = techo - accEjec
  const mesesDeCobertura =
    ritmoMensual <= 0 ? null : Math.max(0, Math.round((disponible / ritmoMensual) * 10) / 10)

  return {
    origen: proveedor.origen,
    nombreFuente: proveedor.nombre,
    sincronizadoEn: proveedor.sincronizadoEn,
    periodos,
    porRubro: proveedor.porRubro(datos),
    porFuente: proveedor.porFuente(datos),
    programadoTotal: accProg,
    ejecutadoTotal: accEjec,
    comprometidoTotal: accComp,
    ritmoMensual: Math.round(ritmoMensual),
    mesesDeCobertura,
    equipo: costoEquipo(datos.equipo),
  }
}

/**
 * Concentracion del gasto: que pocas lineas explican la mayor parte del dinero.
 * Es la pregunta de "donde miro primero" cuando hay que recortar.
 */
export interface LineaPareto extends CostoDesagregado {
  participacion: number
  acumulada: number
  /** Pertenece al conjunto que explica el 80 % del gasto. */
  enElNucleo: boolean
}

export function pareto(lineas: CostoDesagregado[]): LineaPareto[] {
  const total = lineas.reduce((s, l) => s + l.ejecutado, 0)
  if (total <= 0) {
    return lineas.map((l) => ({ ...l, participacion: 0, acumulada: 0, enElNucleo: false }))
  }
  let acc = 0
  let nucleoCerrado = false
  return [...lineas]
    .sort((a, b) => b.ejecutado - a.ejecutado)
    .map((l) => {
      const participacion = (l.ejecutado / total) * 100
      acc += participacion
      // La linea que cruza el 80 % entra en el nucleo; las siguientes, no.
      const enElNucleo = !nucleoCerrado
      if (acc >= 80) nucleoCerrado = true
      return {
        ...l,
        participacion: Math.round(participacion * 10) / 10,
        acumulada: Math.round(Math.min(100, acc) * 10) / 10,
        enElNucleo,
      }
    })
}

/** Periodos mensuales entre dos fechas, inclusive. */
export function periodosEntre(desde: ISODate, hasta: ISODate): string[] {
  const salida: string[] = []
  let cursor = desde.slice(0, 8) + '01'
  let guardas = 0
  while (cursor.slice(0, 7) <= hasta.slice(0, 7) && guardas++ < 400) {
    salida.push(cursor.slice(0, 7))
    cursor = sumarMeses(cursor, 1)
  }
  return salida
}
