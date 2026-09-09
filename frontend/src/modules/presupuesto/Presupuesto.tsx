/**
 * Control presupuestal — EP-17.
 *
 * El calculo por fila del libro era correcto (RN-22); el agregado del indicador
 * no lo era (D-05: sumaba porcentajes de filas distintas). En modo saneado la
 * desviacion del proyecto se calcula sobre los totales.
 * La fuente financiera es obligatoria en cada registro (HG-108).
 */

import { useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { Figura, LineasTemporales } from '@/components/charts'
import { IconEditar, IconEliminar, IconMas, IconPresupuesto } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { desviacionPresupuestal } from '@/domain/reglas'
import { valoresActivos } from '@/domain/catalogos'
import { formatearPeriodo, hoyISO } from '@/domain/fechas'
import { eliminarEntidad, guardarEntidad } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { conSigno, moneda, monedaCorta } from '@/lib/formato'
import type { RegistroPresupuestal } from '@/domain/types'

const VACIO: Partial<RegistroPresupuestal> = {
  periodo: hoyISO().slice(0, 7),
  rubro: '',
  fuente: '',
  programado: 0,
  ejecutado: 0,
  responsableNombre: '',
}

export default function Presupuesto() {
  const { datos, listas, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'presupuesto.editar')

  const [edicion, setEdicion] = useState<Partial<RegistroPresupuestal> | null>(null)
  const [aEliminar, setAEliminar] = useState<RegistroPresupuestal | null>(null)
  const [comentario, setComentario] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const registros = datos?.presupuesto ?? []
  const rubros = useMemo(() => valoresActivos(listas, 'rubroPresupuestal'), [listas])
  const fuentes = useMemo(() => valoresActivos(listas, 'fuenteFinanciera'), [listas])

  const totales = useMemo(() => {
    const programado = registros.reduce((s, r) => s + (r.programado || 0), 0)
    const ejecutado = registros.reduce((s, r) => s + (r.ejecutado || 0), 0)
    return {
      programado,
      ejecutado,
      desviacionValor: ejecutado - programado,
      desviacionPct: programado === 0 ? null : ((ejecutado - programado) / programado) * 100,
    }
  }, [registros])

  const seriesAcumuladas = useMemo(() => {
    const periodos = [...new Set(registros.map((r) => r.periodo))].sort()
    let accProg = 0
    let accEjec = 0
    const prog: { x: string; y: number }[] = []
    const ejec: { x: string; y: number }[] = []
    for (const p of periodos) {
      accProg += registros.filter((r) => r.periodo === p).reduce((s, r) => s + (r.programado || 0), 0)
      accEjec += registros.filter((r) => r.periodo === p).reduce((s, r) => s + (r.ejecutado || 0), 0)
      prog.push({ x: p.slice(2), y: accProg })
      ejec.push({ x: p.slice(2), y: accEjec })
    }
    return [
      { nombre: 'Programado acumulado', puntos: prog, color: '#6366F1', discontinua: true },
      { nombre: 'Ejecutado acumulado', puntos: ejec, color: '#0891B2' },
    ]
  }, [registros])

  if (cargando || !datos || !proyecto) return <Cargando />

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.periodo) e.periodo = 'Indique el periodo.'
    if (!edicion.rubro?.trim()) e.rubro = 'Seleccione el rubro.'
    if (!edicion.fuente?.trim()) e.fuente = 'La fuente financiera es obligatoria.'
    if ((edicion.programado ?? 0) < 0 || (edicion.ejecutado ?? 0) < 0) {
      e.programado = 'Los valores no pueden ser negativos.'
    }
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      await guardarEntidad<RegistroPresupuestal>(
        rutas.presupuesto(proyecto.id),
        {
          ...edicion,
          proyectoId: proyecto.id,
          programado: Number(edicion.programado) || 0,
          ejecutado: Number(edicion.ejecutado) || 0,
        },
        {
          proyectoId: proyecto.id,
          entidad: 'presupuesto',
          etiqueta: `${edicion.periodo} · ${edicion.rubro}`,
          tipoCambio: 'Otro',
          comentario: comentario || undefined,
        },
      )
      toast.exito('Registro presupuestal guardado.')
      setEdicion(null)
      setComentario('')
      await recargar()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!aEliminar) return
    await eliminarEntidad<RegistroPresupuestal>(rutas.presupuesto(proyecto.id), aEliminar.id, {
      proyectoId: proyecto.id,
      entidad: 'presupuesto',
      etiqueta: `${aEliminar.periodo} · ${aEliminar.rubro}`,
      tipoCambio: 'Otro',
      comentario,
    })
    toast.exito('Registro dado de baja.')
    setAEliminar(null)
    setComentario('')
    await recargar()
  }

  const columnas: Columna<RegistroPresupuestal>[] = [
    {
      clave: 'periodo',
      titulo: 'Periodo',
      ordenable: true,
      render: (r) => <span className="hg-t-sm">{formatearPeriodo(r.periodo)}</span>,
    },
    { clave: 'rubro', titulo: 'Rubro', ordenable: true, render: (r) => r.rubro },
    {
      clave: 'fuente',
      titulo: 'Fuente',
      ordenable: true,
      render: (r) => (
        <Badge fg="#0E7490" bg="#CFFAFE">
          {r.fuente}
        </Badge>
      ),
    },
    {
      clave: 'programado',
      titulo: 'Programado',
      alineacion: 'derecha',
      ordenable: true,
      render: (r) => <span className="hg-t-num">{moneda(r.programado, proyecto.moneda)}</span>,
    },
    {
      clave: 'ejecutado',
      titulo: 'Ejecutado',
      alineacion: 'derecha',
      ordenable: true,
      render: (r) => <span className="hg-t-num">{moneda(r.ejecutado, proyecto.moneda)}</span>,
    },
    {
      clave: 'desvValor',
      titulo: 'Desviacion',
      alineacion: 'derecha',
      ordenable: true,
      valorOrden: (r) => desviacionPresupuestal(r).valor,
      render: (r) => {
        const d = desviacionPresupuestal(r)
        return (
          <span className="hg-t-num" style={{ color: d.valor > 0 ? '#B91C1C' : '#047857' }}>
            {d.valor > 0 ? '+' : ''}
            {moneda(d.valor, proyecto.moneda)}
          </span>
        )
      },
    },
    {
      clave: 'desvPct',
      titulo: '%',
      alineacion: 'derecha',
      ordenable: true,
      valorOrden: (r) => desviacionPresupuestal(r).porcentaje ?? 0,
      render: (r) => {
        const d = desviacionPresupuestal(r)
        if (d.porcentaje == null) return <span className="hg-t-ter">—</span>
        return (
          <span
            className="hg-t-num hg-t-bold"
            style={{ color: Math.abs(d.porcentaje) <= 5 ? '#047857' : Math.abs(d.porcentaje) <= 10 ? '#92400E' : '#B91C1C' }}
          >
            {conSigno(d.porcentaje, 1, ' %')}
          </span>
        )
      },
    },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (r) =>
        editable && (
          <div className="hg-fila hg-fila--fin no-print" style={{ flexWrap: 'nowrap' }}>
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label="Editar registro"
              icono={<IconEditar size={15} />}
              onClick={() => {
                setEdicion(structuredClone(r))
                setErrores({})
              }}
            />
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label="Dar de baja registro"
              icono={<IconEliminar size={15} />}
              onClick={() => setAEliminar(r)}
            />
          </div>
        ),
    },
  ]

  const previa = edicion
    ? desviacionPresupuestal({
        programado: Number(edicion.programado) || 0,
        ejecutado: Number(edicion.ejecutado) || 0,
      })
    : null

  return (
    <div className="hg-pila">
      {!editable && (
        <Alert
          tipo="info"
          titulo="Consulta del control presupuestal"
          mensaje="Solo el lider del proyecto y el administrador registran o modifican valores presupuestales."
        />
      )}

      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Programado acumulado"
          valor={monedaCorta(totales.programado)}
          pie={moneda(totales.programado, proyecto.moneda)}
          acento="#6366F1"
        />
        <KPICard
          etiqueta="Ejecutado acumulado"
          valor={monedaCorta(totales.ejecutado)}
          pie={moneda(totales.ejecutado, proyecto.moneda)}
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Desviacion"
          valor={totales.desviacionPct == null ? '—' : conSigno(totales.desviacionPct, 1, ' %')}
          color={
            totales.desviacionPct == null
              ? undefined
              : Math.abs(totales.desviacionPct) <= 5
                ? '#10B981'
                : Math.abs(totales.desviacionPct) <= 10
                  ? '#F59E0B'
                  : '#EF4444'
          }
          pie={`Indicador PRY-O004 · meta ±5 % · ${monedaCorta(totales.desviacionValor)}`}
          acento="#CA8A04"
        />
        <KPICard
          etiqueta="Ejecucion sobre presupuesto total"
          valor={
            proyecto.presupuestoTotal
              ? `${((totales.ejecutado / proyecto.presupuestoTotal) * 100).toFixed(1)} %`
              : '—'
          }
          pie={
            proyecto.presupuestoTotal
              ? `Total: ${monedaCorta(proyecto.presupuestoTotal)}`
              : 'Sin presupuesto total registrado en la ficha'
          }
          acento="#15803D"
        />
      </div>

      {registros.length > 0 && (
        <Card titulo="Curva de ejecucion" subtitulo="Acumulado programado frente a acumulado ejecutado.">
          <Figura
            leyenda={[
              { etiqueta: 'Programado acumulado', color: '#6366F1' },
              { etiqueta: 'Ejecutado acumulado', color: '#0891B2' },
            ]}
            tabla={
              <Table
                columnas={columnas.filter((c) => c.clave !== 'acciones')}
                filas={registros}
                claveDe={(r) => r.id}
              />
            }
          >
            <LineasTemporales series={seriesAcumuladas} formatoValor={(v) => monedaCorta(v)} alto={240} />
          </Figura>
        </Card>
      )}

      <Card
        titulo="Registros presupuestales"
        subtitulo={
          proyecto.modoCalculo === 'saneado'
            ? 'La desviacion agregada se calcula sobre los totales del proyecto.'
            : 'Modo compatibilidad: el indicador agregado reproduce la suma de porcentajes del libro (D-05).'
        }
        acciones={
          editable && (
            <Button
              variante="primary"
              tamano="sm"
              icono={<IconMas size={15} />}
              onClick={() => {
                setEdicion({ ...VACIO, rubro: rubros[0] ?? '', fuente: fuentes[0] ?? '' })
                setErrores({})
              }}
            >
              Nuevo registro
            </Button>
          )
        }
      >
        {registros.length === 0 ? (
          <Vacio
            titulo="Aun no hay registros presupuestales"
            texto="Registre por periodo y rubro el valor programado y el ejecutado. La desviacion se calcula sola."
            icono={<IconPresupuesto size={24} />}
            accion={
              editable && (
                <Button
                  variante="primary"
                  onClick={() => setEdicion({ ...VACIO, rubro: rubros[0] ?? '', fuente: fuentes[0] ?? '' })}
                >
                  Nuevo registro
                </Button>
              )
            }
          />
        ) : (
          <Table
            columnas={columnas}
            filas={registros}
            claveDe={(r) => r.id}
            pieResumen={
              <>
                <td colSpan={3}>Totales</td>
                <td className="hg-num">{moneda(totales.programado, proyecto.moneda)}</td>
                <td className="hg-num">{moneda(totales.ejecutado, proyecto.moneda)}</td>
                <td className="hg-num">{moneda(totales.desviacionValor, proyecto.moneda)}</td>
                <td className="hg-num">
                  {totales.desviacionPct == null ? '—' : conSigno(totales.desviacionPct, 1, ' %')}
                </td>
                <td />
              </>
            }
          />
        )}
      </Card>

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.id ? 'Editar registro presupuestal' : 'Nuevo registro presupuestal'}
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar registro
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-grid hg-grid--form">
            <Input
              label="Periodo"
              type="month"
              requerido
              value={edicion.periodo ?? ''}
              error={errores.periodo}
              onChange={(e) => setEdicion({ ...edicion, periodo: e.target.value })}
            />
            <Select
              label="Rubro"
              requerido
              value={edicion.rubro ?? ''}
              error={errores.rubro}
              placeholder="Seleccione…"
              opciones={rubros}
              onChange={(e) => setEdicion({ ...edicion, rubro: e.target.value })}
            />
            <Select
              label="Fuente financiera"
              requerido
              value={edicion.fuente ?? ''}
              error={errores.fuente}
              placeholder="Seleccione…"
              ayuda="Campo obligatorio: todo registro debe declarar el origen de los recursos."
              opciones={fuentes}
              onChange={(e) => setEdicion({ ...edicion, fuente: e.target.value })}
            />
            <Input
              label="Responsable"
              value={edicion.responsableNombre ?? ''}
              onChange={(e) => setEdicion({ ...edicion, responsableNombre: e.target.value })}
            />
            <Input
              label={`Programado (${proyecto.moneda})`}
              type="number"
              min={0}
              step={1000}
              requerido
              value={edicion.programado ?? 0}
              error={errores.programado}
              onChange={(e) => setEdicion({ ...edicion, programado: Number(e.target.value) })}
            />
            <Input
              label={`Ejecutado (${proyecto.moneda})`}
              type="number"
              min={0}
              step={1000}
              requerido
              value={edicion.ejecutado ?? 0}
              onChange={(e) => setEdicion({ ...edicion, ejecutado: Number(e.target.value) })}
            />
            <Textarea
              label="Observaciones"
              anchoCompleto
              rows={2}
              value={edicion.observaciones ?? ''}
              onChange={(e) => setEdicion({ ...edicion, observaciones: e.target.value })}
            />
            {previa && (
              <div
                className="hg-col-span hg-fila"
                style={{ background: 'var(--c-bg-hover)', borderRadius: 'var(--r-base)', padding: 'var(--sp-sm)' }}
              >
                <span className="hg-etiqueta">Calculado</span>
                <span className="hg-t-sm">
                  Desviacion: <strong>{moneda(previa.valor, proyecto.moneda)}</strong>
                  {previa.porcentaje != null && <> · <strong>{conSigno(previa.porcentaje, 1, ' %')}</strong></>}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aEliminar)}
        titulo="Dar de baja el registro"
        mensaje="El registro dejara de contar en la desviacion presupuestal y en la curva de ejecucion."
        textoConfirmar="Dar de baja"
        exigeComentario
        comentario={comentario}
        onComentario={setComentario}
        onConfirmar={() => void eliminar()}
        onCerrar={() => {
          setAEliminar(null)
          setComentario('')
        }}
      />
    </div>
  )
}
