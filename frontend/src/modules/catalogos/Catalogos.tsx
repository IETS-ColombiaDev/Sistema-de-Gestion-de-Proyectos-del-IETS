/**
 * Administracion de catalogos y parametros — EP-06 (HG-036 a HG-040).
 * Permite al administrador del sistema gestionar las listas controladas,
 * parametros de calculo y el calendario de dias no laborables (festivos).
 */

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Field'
import { Cargando, ErrorVista } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import {
  IconCalendario,
  IconCatalogo,
  IconCheck,
  IconEditar,
  IconEliminar,
  IconMas,
} from '@/components/icons'
import { useAuth } from '@/auth/AuthContext'
import { puede } from '@/auth/permisos'
import {
  guardarLista,
  guardarParametros,
  obtenerListas,
  obtenerParametros,
} from '@/data/repo'
import type { ListaControlada, Parametros, ValorLista } from '@/domain/types'

type TabActiva = 'listas' | 'parametros' | 'festivos'

export default function Catalogos() {
  const { usuario } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState<TabActiva>('listas')
  const [listas, setListas] = useState<ListaControlada[]>([])
  const [parametros, setParametros] = useState<Parametros | null>(null)
  const [cargando, setCargando] = useState(true)

  // Sub-seleccion de lista para ver y editar sus valores
  const [listaSeleccionadaId, setListaSeleccionadaId] = useState<string>('')
  const [nuevoValorTexto, setNuevoValorTexto] = useState('')

  // Modal para editar parametros
  const [editandoParametros, setEditandoParametros] = useState<Parametros | null>(null)
  const [comentarioParametros, setComentarioParametros] = useState('')
  const [guardandoParametros, setGuardandoParametros] = useState(false)

  // Agregar festivo
  const [nuevoFestivo, setNuevoFestivo] = useState('')
  const [filtroAnioFestivo, setFiltroAnioFestivo] = useState(String(new Date().getFullYear()))
  const [festivoAEliminar, setFestivoAEliminar] = useState<string | null>(null)

  const editable = puede(usuario?.rolGlobal ?? null, 'catalogos.editar')

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const [l, p] = await Promise.all([obtenerListas(), obtenerParametros()])
      setListas(l)
      setParametros(p)
      if (l.length > 0 && !listaSeleccionadaId) {
        setListaSeleccionadaId(l[0].id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargarDatos()
  }, [])

  const listaActual = useMemo(
    () => listas.find((l) => l.id === listaSeleccionadaId) ?? listas[0] ?? null,
    [listas, listaSeleccionadaId],
  )

  const festivosFiltrados = useMemo(() => {
    if (!parametros?.festivos) return []
    return parametros.festivos
      .filter((f) => (filtroAnioFestivo ? f.startsWith(filtroAnioFestivo) : true))
      .sort()
  }, [parametros, filtroAnioFestivo])

  const aniosFestivos = useMemo(() => {
    if (!parametros?.festivos) return []
    const setAnios = new Set(parametros.festivos.map((f) => f.slice(0, 4)))
    const anioActual = String(new Date().getFullYear())
    setAnios.add(anioActual)
    setAnios.add(String(Number(anioActual) + 1))
    return Array.from(setAnios).sort()
  }, [parametros])

  if (!editable) {
    return (
      <ErrorVista
        titulo="Acceso restringido"
        detalle="Solo los administradores del sistema pueden gestionar catalogos y parametros institucionales."
      />
    )
  }

  if (cargando || !parametros) return <Cargando />

  // ---------------------------------------------------------------------------
  // Manejadores de Listas Controladas
  // ---------------------------------------------------------------------------

  const alternarActivoValor = async (valor: ValorLista) => {
    if (!listaActual) return
    const nuevosValores = listaActual.valores.map((v) =>
      v.valor === valor.valor ? { ...v, activo: !v.activo } : v,
    )
    const actualizada: ListaControlada = { ...listaActual, valores: nuevosValores }
    try {
      await guardarLista(
        actualizada,
        `${valor.activo ? 'Desactivo' : 'Activo'} el valor "${valor.valor}" en lista ${listaActual.nombre}`,
      )
      setListas((prev) => prev.map((l) => (l.id === actualizada.id ? actualizada : l)))
      toast.exito(`El valor "${valor.valor}" fue actualizado.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const agregarValor = async () => {
    if (!listaActual || !nuevoValorTexto.trim()) return
    const texto = nuevoValorTexto.trim()
    if (listaActual.valores.some((v) => v.valor.toLowerCase() === texto.toLowerCase())) {
      toast.aviso('Ya existe un elemento con este nombre en la lista.')
      return
    }
    const nuevoItem: ValorLista = {
      valor: texto,
      activo: true,
      orden: (listaActual.valores.length ? Math.max(...listaActual.valores.map((v) => v.orden)) : 0) + 1,
    }
    const actualizada: ListaControlada = {
      ...listaActual,
      valores: [...listaActual.valores, nuevoItem],
    }
    try {
      await guardarLista(
        actualizada,
        `Agrego el valor "${texto}" a la lista ${listaActual.nombre}`,
      )
      setListas((prev) => prev.map((l) => (l.id === actualizada.id ? actualizada : l)))
      setNuevoValorTexto('')
      toast.exito(`Se anadio "${texto}" a la lista.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  // ---------------------------------------------------------------------------
  // Manejadores de Parametros Globales
  // ---------------------------------------------------------------------------

  const guardarCambiosParametros = async () => {
    if (!editandoParametros) return
    setGuardandoParametros(true)
    try {
      await guardarParametros(
        editandoParametros,
        comentarioParametros.trim() || 'Actualizacion de parametros globales',
      )
      setParametros(editandoParametros)
      setEditandoParametros(null)
      setComentarioParametros('')
      toast.exito('Los nuevos parametros rigen de inmediato en el sistema.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardandoParametros(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Manejadores de Dias Festivos
  // ---------------------------------------------------------------------------

  const agregarFestivo = async () => {
    if (!nuevoFestivo || !parametros) return
    if (parametros.festivos.includes(nuevoFestivo)) {
      toast.aviso('Este dia no laborable ya figura en el calendario.')
      return
    }
    const nuevosFestivos = [...parametros.festivos, nuevoFestivo].sort()
    const parametrosActualizados: Parametros = {
      ...parametros,
      festivos: nuevosFestivos,
    }
    try {
      await guardarParametros(
        parametrosActualizados,
        `Agrego el festivo ${nuevoFestivo} al calendario`,
      )
      setParametros(parametrosActualizados)
      setNuevoFestivo('')
      toast.exito(`El dia ${nuevoFestivo} fue incorporado al calendario.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const confirmarEliminarFestivo = async () => {
    if (!festivoAEliminar || !parametros) return
    const nuevosFestivos = parametros.festivos.filter((f) => f !== festivoAEliminar)
    const parametrosActualizados: Parametros = {
      ...parametros,
      festivos: nuevosFestivos,
    }
    try {
      await guardarParametros(
        parametrosActualizados,
        `Elimino el festivo ${festivoAEliminar} del calendario`,
      )
      setParametros(parametrosActualizados)
      setFestivoAEliminar(null)
      toast.exito(`Se retiro el dia ${festivoAEliminar} del calendario.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const columnasValores: Columna<ValorLista>[] = [
    { clave: 'orden', titulo: '#', ancho: '60px', render: (v) => <span className="hg-t-muted">{v.orden}</span> },
    {
      clave: 'valor',
      titulo: 'Valor / Etiqueta',
      render: (v) => (
        <span className={v.activo ? 'hg-t-negrita' : 'hg-t-muted'}>{v.valor}</span>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      ancho: '120px',
      render: (v) => (
        <Badge
          fg={v.activo ? '#15803D' : '#64748B'}
          bg={v.activo ? '#DCFCE7' : '#F1F5F9'}
        >
          {v.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Accion',
      ancho: '140px',
      render: (v) => (
        <Button
          tamano="sm"
          variante={v.activo ? 'ghost' : 'secondary'}
          onClick={() => void alternarActivoValor(v)}
        >
          {v.activo ? 'Desactivar' : 'Activar'}
        </Button>
      ),
    },
  ]

  return (
    <div className="hg-pila">
      {/* KPIs de administracion */}
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Listas controladas"
          valor={listas.length}
          pie={`${listas.filter((l) => l.editable).length} editables por admin`}
          acento="#6366F1"
        />
        <KPICard
          etiqueta="Ventana de alerta"
          valor={`${parametros.ventanaAlertaDias} dias`}
          pie="Para actividades e hitos proximos"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Umbral de atencion"
          valor={`±${parametros.umbralAtencion}%`}
          pie={`Precaucion: ±${parametros.umbralPrecaucion}%`}
          acento="#CA8A04"
        />
        <KPICard
          etiqueta="Dias no laborables"
          valor={parametros.festivos.length}
          pie={`Festivos cargados (${filtroAnioFestivo || 'todos'})`}
          acento="#15803D"
        />
      </div>

      {/* Tabs */}
      <div className="hg-pestanas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'listas'}
          className={`hg-pestana ${tab === 'listas' ? 'hg-pestana--activa' : ''}`}
          onClick={() => setTab('listas')}
        >
          <IconCatalogo /> Listas controladas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'parametros'}
          className={`hg-pestana ${tab === 'parametros' ? 'hg-pestana--activa' : ''}`}
          onClick={() => setTab('parametros')}
        >
          <IconCheck /> Parametros del sistema
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'festivos'}
          className={`hg-pestana ${tab === 'festivos' ? 'hg-pestana--activa' : ''}`}
          onClick={() => setTab('festivos')}
        >
          <IconCalendario /> Calendario y festivos
        </button>
      </div>

      {/* CONTENIDO: LISTAS */}
      {tab === 'listas' && (
        <div className="hg-grid hg-grid--2col">
          {/* Columna izquierda: catalogo de listas */}
          <Card
            titulo="Vocabularios controlados"
            subtitulo="Seleccione una lista para ver y gestionar sus opciones admitidas."
          >
            <div className="hg-lista-seleccionable">
              {listas.map((l) => {
                const esActual = l.id === listaActual?.id
                return (
                  <div
                    key={l.id}
                    onClick={() => setListaSeleccionadaId(l.id)}
                    className={`hg-fila-seleccionable ${esActual ? 'hg-fila-seleccionable--activa' : ''}`}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      border: esActual ? '1px solid #6366F1' : '1px solid transparent',
                      background: esActual ? '#EEF2FF' : 'transparent',
                      marginBottom: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="hg-t-negrita" style={{ color: esActual ? '#4F46E5' : 'inherit' }}>
                        {l.nombre}
                      </span>
                      <Badge
                        fg={l.editable ? '#4338CA' : '#64748B'}
                        bg={l.editable ? '#E0E7FF' : '#F1F5F9'}
                      >
                        {l.editable ? 'Editable' : 'Sistema'}
                      </Badge>
                    </div>
                    <div className="hg-t-sm hg-t-muted" style={{ marginTop: '4px' }}>
                      {l.descripcion}
                    </div>
                    <div className="hg-t-xs hg-t-muted" style={{ marginTop: '4px' }}>
                      {l.valores.filter((v) => v.activo).length} activos de {l.valores.length} valores
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Columna derecha: valores de la lista seleccionada */}
          {listaActual && (
            <Card
              titulo={`Valores de: ${listaActual.nombre}`}
              subtitulo={
                listaActual.editable
                  ? 'Agregue nuevos valores o desactive los que ya no correspondan (HG-037).'
                  : 'Esta lista esta protegida por el motor de calculo y no admite nuevos literales.'
              }
              acciones={
                !listaActual.editable ? (
                  <Badge fg="#B45309" bg="#FEF3C7">Solo lectura (motor)</Badge>
                ) : null
              }
            >
              {!listaActual.editable && (
                <Alert
                  tipo="info"
                  titulo="Lista protegida del sistema"
                  mensaje="Los valores de esta lista forman parte de las formulas de calculo (ej. estados de actividad y riesgo). Modificarlos directamente invalidaria la logica de negocio."
                />
              )}

              {listaActual.editable && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <Input
                    placeholder="Nuevo elemento para la lista..."
                    value={nuevoValorTexto}
                    onChange={(e) => setNuevoValorTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void agregarValor()
                    }}
                  />
                  <Button
                    variante="primary"
                    onClick={() => void agregarValor()}
                    disabled={!nuevoValorTexto.trim()}
                  >
                    <IconMas /> Agregar
                  </Button>
                </div>
              )}

              <Table<ValorLista>
                columnas={columnasValores}
                filas={listaActual.valores}
                claveDe={(v) => v.valor}
                vacio="No hay valores definidos en esta lista."
              />
            </Card>
          )}
        </div>
      )}

      {/* CONTENIDO: PARAMETROS */}
      {tab === 'parametros' && (
        <Card
          titulo="Parametros globales de calculo"
          subtitulo="Valores de referencia utilizados por el motor de inferencia, reglas de negocio y semaforizacion."
          acciones={
            <Button
              variante="primary"
              onClick={() => setEditandoParametros({ ...parametros })}
            >
              <IconEditar /> Modificar parametros
            </Button>
          }
        >
          <div className="hg-grid hg-grid--2col" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="hg-campo-detalle">
                <span className="hg-t-muted hg-t-sm">Ventana de alertas (RN-10):</span>
                <p className="hg-t-lg hg-t-negrita">{parametros.ventanaAlertaDias} dias calendario</p>
                <span className="hg-t-xs hg-t-muted">
                  Plazo para considerar que una actividad o entrega final esta en cuenta regresiva proxima.
                </span>
              </div>

              <div className="hg-campo-detalle">
                <span className="hg-t-muted hg-t-sm">Umbral de atencion (RN-06):</span>
                <p className="hg-t-lg hg-t-negrita">±{parametros.umbralAtencion} %</p>
                <span className="hg-t-xs hg-t-muted">
                  Desviacion porcentual entre avance real y esperado para activar alerta naranja de atencion.
                </span>
              </div>

              <div className="hg-campo-detalle">
                <span className="hg-t-muted hg-t-sm">Umbral de precaucion (RN-06):</span>
                <p className="hg-t-lg hg-t-negrita">±{parametros.umbralPrecaucion} %</p>
                <span className="hg-t-xs hg-t-muted">
                  Desviacion inicial donde se dispara marca de precaucion amarilla.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="hg-campo-detalle">
                <span className="hg-t-muted hg-t-sm">Retencion de auditoria (HG-130):</span>
                <p className="hg-t-lg hg-t-negrita">{parametros.retencionAuditoriaMeses} meses ({Math.round(parametros.retencionAuditoriaMeses / 12)} anos)</p>
                <span className="hg-t-xs hg-t-muted">
                  Periodo durante el cual los eventos de auditoria son inalterables y accesibles.
                </span>
              </div>

              <div className="hg-campo-detalle">
                <span className="hg-t-muted hg-t-sm">Tamano maximo de adjunto:</span>
                <p className="hg-t-lg hg-t-negrita">{parametros.maxAdjuntoMB} MB</p>
                <span className="hg-t-xs hg-t-muted">
                  Limite por archivo para evidencias de entregables y productos.
                </span>
              </div>

              <div className="hg-campo-detalle">
                <span className="hg-t-muted hg-t-sm">Ultima actualizacion:</span>
                <p className="hg-t-base">
                  {parametros.actualizadoEn ? new Date(parametros.actualizadoEn).toLocaleString('es-CO') : 'Inicial'} · por{' '}
                  <span className="hg-t-negrita">{parametros.actualizadoPor}</span>
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* CONTENIDO: FESTIVOS */}
      {tab === 'festivos' && (
        <Card
          titulo="Calendario de dias no laborables (HG-039)"
          subtitulo="Determina los dias habiles reales para el calculo de duracion en cronograma y cumplimiento de hitos."
          acciones={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Select
                value={filtroAnioFestivo}
                onChange={(e) => setFiltroAnioFestivo(e.target.value)}
                style={{ width: '140px' }}
              >
                <option value="">Todos los anos</option>
                {aniosFestivos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          }
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', maxWidth: '400px' }}>
            <Input
              type="date"
              value={nuevoFestivo}
              onChange={(e) => setNuevoFestivo(e.target.value)}
            />
            <Button
              variante="primary"
              onClick={() => void agregarFestivo()}
              disabled={!nuevoFestivo}
            >
              <IconMas /> Registrar festivo
            </Button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            {festivosFiltrados.map((fecha) => (
              <div
                key={fecha}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#F8FAFC',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <div className="hg-t-negrita">{fecha}</div>
                  <div className="hg-t-xs hg-t-muted">
                    {new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-CO', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <Button
                  tamano="sm"
                  variante="ghost"
                  onClick={() => setFestivoAEliminar(fecha)}
                >
                  <IconEliminar size={14} />
                </Button>
              </div>
            ))}
          </div>

          {festivosFiltrados.length === 0 && (
            <p className="hg-t-muted" style={{ marginTop: '16px' }}>
              No hay festivos registrados para el ano seleccionado.
            </p>
          )}
        </Card>
      )}

      {/* Modal para editar parametros globales */}
      {editandoParametros && (
        <Modal
          titulo="Modificar parametros del sistema"
          abierto={true}
          onCerrar={() => setEditandoParametros(null)}
          pie={
            <>
              <Button variante="ghost" onClick={() => setEditandoParametros(null)}>
                Cancelar
              </Button>
              <Button
                variante="primary"
                onClick={() => void guardarCambiosParametros()}
                disabled={guardandoParametros}
              >
                {guardandoParametros ? 'Guardando...' : 'Guardar y auditar'}
              </Button>
            </>
          }
        >
          <div className="hg-pila" style={{ gap: '16px' }}>
            <Input
              label="Ventana de alertas (dias calendario)"
              type="number"
              min={1}
              max={60}
              value={editandoParametros.ventanaAlertaDias}
              onChange={(e) =>
                setEditandoParametros({
                  ...editandoParametros,
                  ventanaAlertaDias: Number(e.target.value),
                })
              }
              ayuda="Dias previos a la fecha fin para considerar una entrega como urgente."
            />

            <Input
              label="Umbral de atencion (%)"
              type="number"
              min={1}
              max={50}
              value={editandoParametros.umbralAtencion}
              onChange={(e) =>
                setEditandoParametros({
                  ...editandoParametros,
                  umbralAtencion: Number(e.target.value),
                })
              }
              ayuda="Desviacion del avance para nivel Critico/Atencion."
            />

            <Input
              label="Umbral de precaucion (%)"
              type="number"
              min={1}
              max={50}
              value={editandoParametros.umbralPrecaucion}
              onChange={(e) =>
                setEditandoParametros({
                  ...editandoParametros,
                  umbralPrecaucion: Number(e.target.value),
                })
              }
              ayuda="Desviacion inicial para advertencia."
            />

            <Input
              label="Retencion de auditoria (meses)"
              type="number"
              min={12}
              max={240}
              value={editandoParametros.retencionAuditoriaMeses}
              onChange={(e) =>
                setEditandoParametros({
                  ...editandoParametros,
                  retencionAuditoriaMeses: Number(e.target.value),
                })
              }
            />

            <Input
              label="Tamano maximo de adjunto (MB)"
              type="number"
              min={1}
              max={100}
              value={editandoParametros.maxAdjuntoMB}
              onChange={(e) =>
                setEditandoParametros({
                  ...editandoParametros,
                  maxAdjuntoMB: Number(e.target.value),
                })
              }
            />

            <Input
              label="Justificacion del cambio (obligatorio para auditoria)"
              placeholder="Describa el motivo de la modificacion..."
              value={comentarioParametros}
              onChange={(e) => setComentarioParametros(e.target.value)}
            />
          </div>
        </Modal>
      )}

      {/* Modal confirmacion eliminar festivo */}
      {festivoAEliminar && (
        <ModalConfirmacion
          titulo="Eliminar dia festivo"
          mensaje={`¿Esta seguro de retirar la fecha ${festivoAEliminar} del calendario de festivos? El calculo de duracion de actividades y fechas limite se ajustara en consecuencia.`}
          textoConfirmar="Si, eliminar"
          abierto={true}
          variante="danger"
          onConfirmar={() => void confirmarEliminarFestivo()}
          onCerrar={() => setFestivoAEliminar(null)}
        />
      )}
    </div>
  )
}
