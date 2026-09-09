/**
 * Registro de satisfaccion — EP-16.
 * El calculo del libro era correcto y se migra sin cambios (RN-21), con dos
 * agregados: control de division por cero y validacion de que los satisfechos
 * no superen a los encuestados.
 */

import { useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import KPICard from '@/components/Dashboard/KPICard'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { Figura, LineasTemporales } from '@/components/charts'
import { colorSerie } from '@/components/charts/paleta'
import { IconEditar, IconEliminar, IconMas, IconSatisfaccion } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { indiceSatisfaccion, validarSatisfaccion } from '@/domain/reglas'
import { valoresActivos } from '@/domain/catalogos'
import { formatearPeriodo, hoyISO } from '@/domain/fechas'
import { eliminarEntidad, guardarEntidad } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { numero, porcentaje } from '@/lib/formato'
import type { MedicionSatisfaccion } from '@/domain/types'

const VACIO: Partial<MedicionSatisfaccion> = {
  periodo: hoyISO().slice(0, 7),
  grupo: '',
  encuestados: 0,
  satisfechos: 0,
  instrumento: '',
  responsableNombre: '',
}

export default function Satisfaccion() {
  const { datos, listas, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'satisfaccion.editar')

  const [edicion, setEdicion] = useState<Partial<MedicionSatisfaccion> | null>(null)
  const [aEliminar, setAEliminar] = useState<MedicionSatisfaccion | null>(null)
  const [comentario, setComentario] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const mediciones = datos?.satisfaccion ?? []
  const instrumentos = useMemo(() => valoresActivos(listas, 'instrumentoSatisfaccion'), [listas])

  const grupos = useMemo(() => [...new Set(mediciones.map((m) => m.grupo))].sort(), [mediciones])

  const series = useMemo(
    () =>
      grupos.map((grupo, i) => ({
        nombre: grupo,
        color: colorSerie(i),
        puntos: [...new Set(mediciones.map((m) => m.periodo))].sort().map((periodo) => {
          const propias = mediciones.filter((m) => m.grupo === grupo && m.periodo === periodo)
          const enc = propias.reduce((s, m) => s + m.encuestados, 0)
          const sat = propias.reduce((s, m) => s + m.satisfechos, 0)
          return { x: periodo.slice(2), y: enc === 0 ? null : (sat / enc) * 100 }
        }),
      })),
    [grupos, mediciones],
  )

  const totalEncuestados = mediciones.reduce((s, m) => s + m.encuestados, 0)
  const totalSatisfechos = mediciones.reduce((s, m) => s + m.satisfechos, 0)
  const indiceGlobal = totalEncuestados === 0 ? null : (totalSatisfechos / totalEncuestados) * 100

  if (cargando || !datos || !proyecto) return <Cargando />

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.periodo) e.periodo = 'Indique el periodo de la medicion.'
    if (!edicion.grupo?.trim()) e.grupo = 'Indique el grupo o parte interesada.'
    if (!edicion.instrumento?.trim()) e.instrumento = 'Indique el instrumento o fuente.'
    for (const p of validarSatisfaccion({
      encuestados: Number(edicion.encuestados) || 0,
      satisfechos: Number(edicion.satisfechos) || 0,
    })) {
      e[p.campo] = p.mensaje
    }
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      await guardarEntidad<MedicionSatisfaccion>(
        rutas.satisfaccion(proyecto.id),
        {
          ...edicion,
          proyectoId: proyecto.id,
          encuestados: Number(edicion.encuestados) || 0,
          satisfechos: Number(edicion.satisfechos) || 0,
        },
        {
          proyectoId: proyecto.id,
          entidad: 'satisfaccion',
          etiqueta: `${edicion.periodo} · ${edicion.grupo}`,
          tipoCambio: 'Otro',
          comentario: comentario || undefined,
        },
      )
      toast.exito('Medicion guardada.')
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
    await eliminarEntidad<MedicionSatisfaccion>(rutas.satisfaccion(proyecto.id), aEliminar.id, {
      proyectoId: proyecto.id,
      entidad: 'satisfaccion',
      etiqueta: `${aEliminar.periodo} · ${aEliminar.grupo}`,
      tipoCambio: 'Otro',
      comentario,
    })
    toast.exito('Medicion dada de baja.')
    setAEliminar(null)
    setComentario('')
    await recargar()
  }

  const columnas: Columna<MedicionSatisfaccion>[] = [
    {
      clave: 'periodo',
      titulo: 'Periodo',
      ordenable: true,
      render: (m) => <span className="hg-t-sm">{formatearPeriodo(m.periodo)}</span>,
    },
    { clave: 'grupo', titulo: 'Grupo o parte interesada', ordenable: true, render: (m) => m.grupo },
    {
      clave: 'encuestados',
      titulo: 'Encuestados',
      alineacion: 'derecha',
      ordenable: true,
      render: (m) => numero(m.encuestados),
    },
    {
      clave: 'satisfechos',
      titulo: 'Satisfechos',
      alineacion: 'derecha',
      ordenable: true,
      render: (m) => numero(m.satisfechos),
    },
    {
      clave: 'indice',
      titulo: 'Indice',
      alineacion: 'derecha',
      ordenable: true,
      valorOrden: (m) => indiceSatisfaccion(m) ?? 0,
      render: (m) => {
        const i = indiceSatisfaccion(m)
        return i == null ? (
          <span className="hg-t-ter" title="Sin encuestados: no se puede calcular">
            Sin datos
          </span>
        ) : (
          <span
            className="hg-t-num hg-t-bold"
            style={{ color: i >= 90 ? '#047857' : i >= 81 ? '#92400E' : '#B91C1C' }}
          >
            {porcentaje(i)}
          </span>
        )
      },
    },
    { clave: 'instrumento', titulo: 'Instrumento', render: (m) => <span className="hg-t-sm">{m.instrumento}</span> },
    { clave: 'responsableNombre', titulo: 'Responsable', render: (m) => m.responsableNombre || '—' },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (m) =>
        editable && (
          <div className="hg-fila hg-fila--fin no-print" style={{ flexWrap: 'nowrap' }}>
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label="Editar medicion"
              icono={<IconEditar size={15} />}
              onClick={() => {
                setEdicion(structuredClone(m))
                setErrores({})
              }}
            />
            <Button
              variante="ghost"
              tamano="sm"
              soloIcono
              aria-label="Dar de baja medicion"
              icono={<IconEliminar size={15} />}
              onClick={() => setAEliminar(m)}
            />
          </div>
        ),
    },
  ]

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Indice de satisfaccion"
          valor={indiceGlobal == null ? 'Sin datos' : porcentaje(indiceGlobal)}
          color={
            indiceGlobal == null ? '#64748B' : indiceGlobal >= 90 ? '#10B981' : indiceGlobal >= 81 ? '#F59E0B' : '#EF4444'
          }
          pie="Indicador PRY-O005 · meta 90 %"
          acento="#6366F1"
        />
        <KPICard etiqueta="Mediciones" valor={mediciones.length} acento="#0891B2" />
        <KPICard etiqueta="Encuestados" valor={numero(totalEncuestados)} acento="#CA8A04" />
        <KPICard
          etiqueta="Grupos consultados"
          valor={grupos.length}
          pie={grupos.slice(0, 3).join(' · ')}
          acento="#15803D"
        />
      </div>

      {mediciones.length > 0 && (
        <Card titulo="Evolucion de la satisfaccion" subtitulo="Serie por periodo y por grupo consultado.">
          <Figura
            leyenda={series.map((s) => ({ etiqueta: s.nombre, color: s.color }))}
            tabla={
              <Table
                columnas={columnas.filter((c) => c.clave !== 'acciones')}
                filas={mediciones}
                claveDe={(m) => m.id}
              />
            }
          >
            <LineasTemporales series={series} sufijo=" %" />
          </Figura>
        </Card>
      )}

      <Card
        titulo="Mediciones de satisfaccion"
        subtitulo="El indice se calcula por medicion y de forma agregada; nunca se captura a mano."
        acciones={
          editable && (
            <Button
              variante="primary"
              tamano="sm"
              icono={<IconMas size={15} />}
              onClick={() => {
                setEdicion({ ...VACIO, instrumento: instrumentos[0] ?? '' })
                setErrores({})
              }}
            >
              Nueva medicion
            </Button>
          )
        }
      >
        {mediciones.length === 0 ? (
          <Vacio
            titulo="Aun no hay mediciones registradas"
            texto="Registre las mediciones de satisfaccion por periodo y parte interesada. El indice se calcula automaticamente."
            icono={<IconSatisfaccion size={24} />}
            accion={
              editable && (
                <Button variante="primary" onClick={() => setEdicion({ ...VACIO, instrumento: instrumentos[0] ?? '' })}>
                  Nueva medicion
                </Button>
              )
            }
          />
        ) : (
          <Table columnas={columnas} filas={mediciones} claveDe={(m) => m.id} />
        )}
      </Card>

      <Modal
        abierto={edicion !== null}
        titulo={edicion?.id ? 'Editar medicion' : 'Nueva medicion'}
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar medicion
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
            <Input
              label="Grupo o parte interesada"
              requerido
              value={edicion.grupo ?? ''}
              error={errores.grupo}
              ayuda="Por ejemplo: equipo desarrollador, entidad contratante, partes interesadas."
              onChange={(e) => setEdicion({ ...edicion, grupo: e.target.value })}
            />
            <Input
              label="Encuestados"
              type="number"
              min={0}
              requerido
              value={edicion.encuestados ?? 0}
              error={errores.encuestados}
              onChange={(e) => setEdicion({ ...edicion, encuestados: Number(e.target.value) })}
            />
            <Input
              label="Satisfechos"
              type="number"
              min={0}
              requerido
              value={edicion.satisfechos ?? 0}
              error={errores.satisfechos}
              ayuda="No puede superar el numero de encuestados."
              onChange={(e) => setEdicion({ ...edicion, satisfechos: Number(e.target.value) })}
            />
            <Select
              label="Instrumento o fuente"
              requerido
              value={edicion.instrumento ?? ''}
              error={errores.instrumento}
              placeholder="Seleccione…"
              opciones={instrumentos}
              onChange={(e) => setEdicion({ ...edicion, instrumento: e.target.value })}
            />
            <Input
              label="Responsable"
              value={edicion.responsableNombre ?? ''}
              onChange={(e) => setEdicion({ ...edicion, responsableNombre: e.target.value })}
            />
            <Textarea
              label="Observaciones"
              anchoCompleto
              rows={2}
              value={edicion.observaciones ?? ''}
              onChange={(e) => setEdicion({ ...edicion, observaciones: e.target.value })}
            />
            <div
              className="hg-col-span hg-fila"
              style={{ background: 'var(--c-bg-hover)', borderRadius: 'var(--r-base)', padding: 'var(--sp-sm)' }}
            >
              <span className="hg-etiqueta">Calculado</span>
              <span className="hg-t-sm">
                Indice:{' '}
                <strong>
                  {porcentaje(
                    indiceSatisfaccion({
                      encuestados: Number(edicion.encuestados) || 0,
                      satisfechos: Number(edicion.satisfechos) || 0,
                    }),
                  )}
                </strong>
              </span>
            </div>
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aEliminar)}
        titulo="Dar de baja la medicion"
        mensaje="La medicion dejara de contar en el indice de satisfaccion del proyecto."
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
