/**
 * Cronograma — EP-09.
 * Hoja operativa central de HIGEP. Los campos calculados (duracion, estado,
 * avance esperado, holgura) no son editables ni en la interfaz ni en el
 * servidor: se derivan de las reglas RN-01 a RN-05 y RN-17.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge, { BadgeEstado } from '@/components/Badge'
import Alert from '@/components/Alert'
import Progreso from '@/components/Progreso'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import {
  IconCronograma,
  IconEditar,
  IconEliminar,
  IconExportar,
  IconFlechaAbajo,
  IconFlechaDer,
  IconMas,
} from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { formatearFecha } from '@/domain/fechas'
import { validarAvance, validarFechasActividad } from '@/domain/reglas'
import { eliminarEntidad, guardarEntidad, guardarLoteEntidades } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { exportarExcel } from '@/lib/exportar'
import { ESTADOS_ACTIVIDAD, type Actividad, type ActividadCalculada } from '@/domain/types'

const VACIA: Partial<Actividad> = {
  nombre: '',
  faseId: '',
  responsableNombre: '',
  responsableId: null,
  apoyoIds: [],
  fechaInicio: null,
  fechaFin: null,
  avance: 0,
  predecesoras: [],
  entregable: '',
}

export default function Cronograma() {
  const { datos, resumen, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'cronograma.editar')
  const puedeAvance =
    editable || puedeEnProyecto(usuario, proyecto ?? null, 'cronograma.editarAvancePropio')

  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())
  const [edicion, setEdicion] = useState<Partial<Actividad> | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [aEliminar, setAEliminar] = useState<ActividadCalculada | null>(null)
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [avancesEditados, setAvances] = useState<Record<string, number>>({})

  // Los filtros viven en la URL: se conservan al navegar (HG-062).
  const fFase = params.get('fase') ?? ''
  const fResponsable = params.get('responsable') ?? ''
  const fEstado = params.get('estado') ?? ''
  const fTexto = params.get('q') ?? ''

  const setFiltro = useCallback(
    (clave: string, valor: string) => {
      const p = new URLSearchParams(params)
      if (valor) p.set(clave, valor)
      else p.delete(clave)
      setParams(p, { replace: true })
    },
    [params, setParams],
  )

  useEffect(() => {
    setAvances({})
  }, [datos])

  const responsables = useMemo(
    () => [...new Set((datos?.actividades ?? []).map((a) => a.responsableNombre).filter(Boolean))].sort(),
    [datos],
  )

  const filtradas = useMemo(() => {
    const acts = resumen?.actividades ?? []
    return acts.filter((a) => {
      if (fFase && a.faseId !== fFase) return false
      if (fResponsable && a.responsableNombre !== fResponsable) return false
      if (fEstado && a.estado !== fEstado) return false
      if (fTexto && !`${a.nombre} ${a.entregable ?? ''}`.toLowerCase().includes(fTexto.toLowerCase()))
        return false
      return true
    })
  }, [resumen, fFase, fResponsable, fEstado, fTexto])

  const porFase = useMemo(() => {
    const fases = proyecto?.fases ?? []
    return fases
      .filter((f) => f.activa || filtradas.some((a) => a.faseId === f.id))
      .sort((a, b) => a.orden - b.orden)
      .map((fase) => ({
        fase,
        actividades: filtradas.filter((a) => a.faseId === fase.id).sort((a, b) => a.orden - b.orden),
      }))
      .filter((g) => g.actividades.length > 0)
  }, [proyecto, filtradas])

  const sinFase = filtradas.filter((a) => !(proyecto?.fases ?? []).some((f) => f.id === a.faseId))

  const hayAvancesPendientes = Object.keys(avancesEditados).length > 0

  if (cargando || !datos || !resumen || !proyecto) return <Cargando />

  const validar = (b: Partial<Actividad>): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!b.nombre?.trim()) e.nombre = 'El nombre de la actividad es obligatorio.'
    if (!b.faseId) e.faseId = 'Seleccione la fase a la que pertenece.'
    const problemasFecha = validarFechasActividad(b.fechaInicio ?? null, b.fechaFin ?? null, {
      inicio: proyecto.fechaInicio,
      fin: proyecto.fechaEntregaFinal,
    })
    const bloqueante = problemasFecha.find((p) => p.bloqueante)
    if (bloqueante) e[bloqueante.campo] = bloqueante.mensaje
    const pa = validarAvance(b.avance)
    if (pa) e.avance = pa.mensaje
    return e
  }

  const advertenciasFecha = edicion
    ? validarFechasActividad(edicion.fechaInicio ?? null, edicion.fechaFin ?? null, {
        inicio: proyecto.fechaInicio,
        fin: proyecto.fechaEntregaFinal,
      }).filter((p) => !p.bloqueante)
    : []

  const guardar = async () => {
    if (!edicion) return
    const e = validar(edicion)
    setErrores(e)
    if (Object.keys(e).length > 0) return
    setGuardando(true)
    try {
      const esNueva = !edicion.id
      const maxNumero = Math.max(0, ...datos.actividades.map((a) => a.numero || 0))
      await guardarEntidad<Actividad>(
        rutas.actividades(proyecto.id),
        {
          ...edicion,
          proyectoId: proyecto.id,
          numero: edicion.numero ?? maxNumero + 1,
          orden: edicion.orden ?? maxNumero + 1,
          avance: Number(edicion.avance) || 0,
        },
        {
          proyectoId: proyecto.id,
          entidad: 'actividad',
          etiqueta: edicion.nombre ?? '',
          tipoCambio: 'Actividad',
          comentario: comentario || undefined,
        },
      )
      toast.exito(esNueva ? 'Actividad creada.' : 'Actividad actualizada.')
      setEdicion(null)
      setComentario('')
      await recargar()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  /** HG-061: guarda todos los avances editados en una sola transaccion. */
  const guardarAvances = async () => {
    setGuardando(true)
    try {
      await guardarLoteEntidades<Actividad>(
        rutas.actividades(proyecto.id),
        Object.entries(avancesEditados).map(([id, avance]) => ({ id, avance })),
        {
          proyectoId: proyecto.id,
          entidad: 'actividad',
          tipoCambio: 'Actividad',
          etiquetaDe: (a) =>
            datos.actividades.find((x) => x.id === a.id)?.nombre ?? 'Actividad',
        },
      )
      toast.exito(
        `${Object.keys(avancesEditados).length} avance(s) registrado(s) en una sola transaccion.`,
      )
      setAvances({})
      await recargar()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!aEliminar) return
    await eliminarEntidad<Actividad>(rutas.actividades(proyecto.id), aEliminar.id, {
      proyectoId: proyecto.id,
      entidad: 'actividad',
      etiqueta: aEliminar.nombre,
      tipoCambio: 'Actividad',
      comentario,
    })
    toast.exito('Actividad dada de baja.')
    setAEliminar(null)
    setComentario('')
    await recargar()
  }

  const filaActividad = (a: ActividadCalculada) => {
    const avanceMostrado = avancesEditados[a.id] ?? a.avance
    const editado = avancesEditados[a.id] != null
    return (
      <tr key={a.id} className={a.estado === 'Retrasada' ? 'hg-fila--critica' : undefined}>
        <td className="hg-num hg-t-ter">{a.numero}</td>
        <td>
          <div style={{ minWidth: 240 }}>
            <span className="hg-t-sm">{a.nombre}</span>
            {a.esCritica && (
              <Badge fg="#B91C1C" bg="#FEE2E2" titulo="Actividad en la ruta critica: su retraso desplaza el fin del proyecto.">
                ruta critica
              </Badge>
            )}
            {a.entregable && <div className="hg-t-xs hg-t-sec">Entregable: {a.entregable}</div>}
            {a.predecesoras.length > 0 && (
              <div className="hg-t-xs hg-t-ter">
                Predecesoras:{' '}
                {a.predecesoras
                  .map((p) => datos.actividades.find((x) => x.id === p)?.numero ?? '?')
                  .join(', ')}
              </div>
            )}
          </div>
        </td>
        <td className="hg-t-sm">{a.responsableNombre || '—'}</td>
        <td className="hg-t-sm">{formatearFecha(a.fechaInicio)}</td>
        <td className="hg-t-sm">{formatearFecha(a.fechaFin)}</td>
        <td
          className="hg-num"
          title={
            proyecto.modoCalculo === 'saneado'
              ? 'Dias habiles reales, excluyendo fines de semana y festivos.'
              : 'Modo compatibilidad: fin − inicio − 2, como en el libro Excel.'
          }
        >
          {a.duracion || '—'}
        </td>
        <td style={{ minWidth: 150 }}>
          {puedeAvance ? (
            <div className="hg-fila" style={{ gap: 6, flexWrap: 'nowrap' }}>
              <input
                type="number"
                className="hg-input hg-input--sm"
                style={{
                  width: 68,
                  borderColor: editado ? 'var(--c-purple)' : undefined,
                  background: editado ? 'var(--c-bg-active)' : undefined,
                }}
                min={0}
                max={100}
                step={5}
                value={avanceMostrado}
                aria-label={`Avance de ${a.nombre}`}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value)))
                  setAvances((prev) => ({ ...prev, [a.id]: v }))
                }}
              />
              <Progreso valor={avanceMostrado} meta={a.avanceEsperado} />
            </div>
          ) : (
            <Progreso valor={a.avance} meta={a.avanceEsperado} etiqueta />
          )}
        </td>
        <td className="hg-num hg-t-ter" title="Avance que la programacion esperaba a la fecha de corte.">
          {a.avanceEsperado.toFixed(0)} %
        </td>
        <td>
          <BadgeEstado familia="actividad" valor={a.estado} titulo={a.razonEstado} />
        </td>
        <td className="hg-num" title="Holgura en dias habiles, calculada sobre las dependencias declaradas.">
          {a.holgura == null ? '—' : a.holgura}
        </td>
        <td className="no-print">
          {editable && (
            <div className="hg-fila" style={{ flexWrap: 'nowrap' }}>
              <Button
                variante="ghost"
                tamano="sm"
                soloIcono
                aria-label={`Editar ${a.nombre}`}
                icono={<IconEditar size={15} />}
                onClick={() => {
                  setEdicion(structuredClone(a) as Partial<Actividad>)
                  setErrores({})
                }}
              />
              <Button
                variante="ghost"
                tamano="sm"
                soloIcono
                aria-label={`Dar de baja ${a.nombre}`}
                icono={<IconEliminar size={15} />}
                onClick={() => setAEliminar(a)}
              />
            </div>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="hg-pila">
      {resumen.ciclos.length > 0 && (
        <Alert
          tipo="warning"
          critico
          titulo="Dependencias circulares detectadas"
          mensaje={`Hay ${resumen.ciclos.length} ciclo(s) entre predecesoras. Mientras existan, la holgura y la ruta critica no se calculan para esas actividades.`}
        />
      )}

      {hayAvancesPendientes && (
        <div className="hg-banner no-print" role="status">
          <strong>{Object.keys(avancesEditados).length} avance(s) sin guardar.</strong>
          Los estados se recalculan al guardar.
          <span className="hg-sep" />
          <Button variante="secondary" tamano="sm" onClick={() => setAvances({})}>
            Descartar
          </Button>
          <Button variante="primary" tamano="sm" onClick={() => void guardarAvances()} cargando={guardando}>
            Guardar avances
          </Button>
        </div>
      )}

      <Card
        titulo="Cronograma"
        subtitulo={`${filtradas.filter((a) => !a.vacia).length} actividad(es) · avance ponderado ${resumen.avancePonderado.toFixed(1)} % · esperado ${resumen.avanceEsperado.toFixed(1)} %`}
        acciones={
          <>
            <Button
              variante="secondary"
              tamano="sm"
              icono={<IconExportar size={15} />}
              onClick={() =>
                exportarExcel(
                  [
                    {
                      nombre: 'Cronograma',
                      filas: resumen.actividades.map((a) => ({
                        '#': a.numero,
                        Fase: proyecto.fases.find((f) => f.id === a.faseId)?.nombre ?? '',
                        Actividad: a.nombre,
                        Entregable: a.entregable ?? '',
                        Responsable: a.responsableNombre,
                        Inicio: a.fechaInicio,
                        Fin: a.fechaFin,
                        'Duracion (dias)': a.duracion,
                        'Avance (%)': a.avance,
                        'Avance esperado (%)': a.avanceEsperado,
                        Estado: a.estado,
                        'Holgura (dias)': a.holgura,
                        'Ruta critica': a.esCritica ? 'Si' : 'No',
                      })),
                    },
                  ],
                  `cronograma-${proyecto.codigo}`,
                )
              }
            >
              Exportar
            </Button>
            {editable && (
              <Button
                variante="primary"
                tamano="sm"
                icono={<IconMas size={15} />}
                onClick={() => {
                  setEdicion({ ...VACIA, faseId: proyecto.fases[0]?.id ?? '' })
                  setErrores({})
                }}
              >
                Nueva actividad
              </Button>
            )}
          </>
        }
      >
        <div className="hg-barra-filtros" style={{ marginBottom: 'var(--sp-md)' }}>
          <Input
            label="Buscar"
            placeholder="Nombre o entregable"
            value={fTexto}
            onChange={(e) => setFiltro('q', e.target.value)}
            style={{ minWidth: 200 }}
          />
          <Select
            label="Fase"
            value={fFase}
            onChange={(e) => setFiltro('fase', e.target.value)}
            placeholder="Todas"
            opciones={proyecto.fases.map((f) => ({ valor: f.id, etiqueta: f.nombre }))}
          />
          <Select
            label="Responsable"
            value={fResponsable}
            onChange={(e) => setFiltro('responsable', e.target.value)}
            placeholder="Todos"
            opciones={responsables}
          />
          <Select
            label="Estado"
            value={fEstado}
            onChange={(e) => setFiltro('estado', e.target.value)}
            placeholder="Todos"
            opciones={ESTADOS_ACTIVIDAD}
          />
          {(fFase || fResponsable || fEstado || fTexto) && (
            <Button variante="ghost" onClick={() => setParams({}, { replace: true })}>
              Limpiar
            </Button>
          )}
        </div>

        {filtradas.length === 0 ? (
          <Vacio
            titulo="No hay actividades que coincidan"
            texto="Ajuste los filtros o registre la primera actividad del cronograma."
            icono={<IconCronograma size={24} />}
            accion={
              editable && (
                <Button variante="primary" onClick={() => setEdicion({ ...VACIA, faseId: proyecto.fases[0]?.id ?? '' })}>
                  Nueva actividad
                </Button>
              )
            }
          />
        ) : (
          <div className="hg-tabla-wrap">
            <table className="hg-tabla">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Actividad</th>
                  <th>Responsable</th>
                  <th style={{ width: 108 }}>Inicio</th>
                  <th style={{ width: 108 }}>Fin</th>
                  <th className="hg-num" style={{ width: 70 }} title="Campo calculado">
                    Dias
                  </th>
                  <th style={{ width: 160 }}>Avance</th>
                  <th className="hg-num" style={{ width: 84 }} title="Campo calculado">
                    Esperado
                  </th>
                  <th style={{ width: 120 }} title="Campo calculado">
                    Estado
                  </th>
                  <th className="hg-num" style={{ width: 78 }} title="Campo calculado">
                    Holgura
                  </th>
                  <th className="no-print" style={{ width: 84 }} />
                </tr>
              </thead>
              <tbody>
                {porFase.map(({ fase, actividades }) => {
                  const colapsada = colapsadas.has(fase.id)
                  const avanceFase = resumen.porFase.find((p) => p.faseId === fase.id)
                  return (
                    <>
                      <tr
                        key={`fase-${fase.id}`}
                        className="hg-fila--grupo"
                        onClick={() =>
                          setColapsadas((prev) => {
                            const s = new Set(prev)
                            if (s.has(fase.id)) s.delete(fase.id)
                            else s.add(fase.id)
                            return s
                          })
                        }
                        style={{ cursor: 'pointer' }}
                      >
                        <td colSpan={5}>
                          <span className="hg-fila" style={{ gap: 6, flexWrap: 'nowrap' }}>
                            {colapsada ? <IconFlechaDer size={14} /> : <IconFlechaAbajo size={14} />}
                            {fase.nombre}
                            <span className="hg-t-xs hg-t-sec">
                              {actividades.length} actividad(es)
                            </span>
                          </span>
                        </td>
                        <td colSpan={2}>
                          {avanceFase && <Progreso valor={avanceFase.avance} meta={avanceFase.avanceEsperado} etiqueta />}
                        </td>
                        <td className="hg-num hg-t-ter">
                          {avanceFase ? `${avanceFase.avanceEsperado.toFixed(0)} %` : ''}
                        </td>
                        <td colSpan={3} />
                      </tr>
                      {!colapsada && actividades.map(filaActividad)}
                    </>
                  )
                })}
                {sinFase.length > 0 && (
                  <>
                    <tr className="hg-fila--grupo">
                      <td colSpan={11}>Sin fase asignada</td>
                    </tr>
                    {sinFase.map(filaActividad)}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        abierto={edicion !== null}
        tamano="lg"
        titulo={edicion?.id ? 'Editar actividad' : 'Nueva actividad'}
        subtitulo="Duracion, estado, avance esperado y holgura son campos calculados: no se capturan."
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar actividad
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-pila">
            {advertenciasFecha.map((p) => (
              <Alert key={p.mensaje} tipo="warning" titulo="Advertencia de coherencia" mensaje={p.mensaje} />
            ))}

            <div className="hg-grid hg-grid--form">
              <Input
                label="Nombre de la actividad"
                requerido
                anchoCompleto
                value={edicion.nombre ?? ''}
                error={errores.nombre}
                onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
              />
              <Select
                label="Fase"
                requerido
                value={edicion.faseId ?? ''}
                error={errores.faseId}
                placeholder="Seleccione…"
                opciones={proyecto.fases.filter((f) => f.activa).map((f) => ({ valor: f.id, etiqueta: f.nombre }))}
                onChange={(e) => setEdicion({ ...edicion, faseId: e.target.value })}
              />
              <Select
                label="Responsable"
                value={edicion.responsableId ?? ''}
                placeholder="Sin asignar"
                opciones={datos.equipo.map((m) => ({
                  valor: m.id,
                  etiqueta: m.porDesignar ? `${m.perfil} (por designar)` : `${m.nombre || m.perfil}`,
                }))}
                ayuda="Los responsables provienen del equipo del proyecto."
                onChange={(e) => {
                  const m = datos.equipo.find((x) => x.id === e.target.value)
                  setEdicion({
                    ...edicion,
                    responsableId: e.target.value || null,
                    responsableNombre: m ? m.nombre || m.perfil : '',
                  })
                }}
              />
              <Input
                label="Fecha de inicio"
                type="date"
                requerido
                value={edicion.fechaInicio ?? ''}
                error={errores.fechas}
                onChange={(e) => setEdicion({ ...edicion, fechaInicio: e.target.value || null })}
              />
              <Input
                label="Fecha de fin"
                type="date"
                requerido
                value={edicion.fechaFin ?? ''}
                error={errores.fechaFin}
                onChange={(e) => setEdicion({ ...edicion, fechaFin: e.target.value || null })}
              />
              <Input
                label="% de avance"
                type="number"
                min={0}
                max={100}
                step={5}
                value={edicion.avance ?? 0}
                error={errores.avance}
                ayuda="Entre 0 y 100. El estado se deriva de este valor y de la fecha de corte."
                onChange={(e) => setEdicion({ ...edicion, avance: Number(e.target.value) })}
              />
              <Input
                label="Entregable asociado"
                value={edicion.entregable ?? ''}
                onChange={(e) => setEdicion({ ...edicion, entregable: e.target.value })}
              />
              <Textarea
                label="Observaciones"
                anchoCompleto
                rows={2}
                value={edicion.observaciones ?? ''}
                onChange={(e) => setEdicion({ ...edicion, observaciones: e.target.value })}
              />
            </div>

            <div className="hg-campo">
              <span className="hg-campo__label">Actividades predecesoras</span>
              <span className="hg-campo__ayuda">
                Alimentan el calculo de holgura y de ruta critica. Una actividad no puede depender de si misma.
              </span>
              <div
                className="scroll-discreto"
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-base)',
                  padding: 'var(--sp-xs)',
                  marginTop: 4,
                }}
              >
                {datos.actividades
                  .filter((a) => a.id !== edicion.id && a.nombre?.trim())
                  .map((a) => (
                    <label key={a.id} className="hg-check" style={{ display: 'flex', padding: '3px 0' }}>
                      <input
                        type="checkbox"
                        checked={(edicion.predecesoras ?? []).includes(a.id)}
                        onChange={(e) => {
                          const actuales = new Set(edicion.predecesoras ?? [])
                          if (e.target.checked) actuales.add(a.id)
                          else actuales.delete(a.id)
                          setEdicion({ ...edicion, predecesoras: [...actuales] })
                        }}
                      />
                      <span className="hg-t-sm">
                        <span className="hg-t-ter">{a.numero}.</span> {a.nombre}
                      </span>
                    </label>
                  ))}
              </div>
            </div>

            {edicion.id && (
              <Textarea
                label="Justificacion del cambio"
                rows={2}
                value={comentario}
                ayuda="Obligatoria si modifica fechas. Queda registrada en la auditoria."
                onChange={(e) => setComentario(e.target.value)}
              />
            )}
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aEliminar)}
        titulo="Dar de baja la actividad"
        mensaje={
          <>
            La actividad <strong>{aEliminar?.nombre}</strong> dejara de contar en el avance, los estados y los
            indicadores. Es una baja logica y queda trazada.
          </>
        }
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
