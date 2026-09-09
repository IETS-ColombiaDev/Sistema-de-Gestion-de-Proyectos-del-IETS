/**
 * Catalogo de indicadores institucionales — EP-18 / seccion 5.4 del backlog.
 * Permite al administrador del sistema consultar, activar/desactivar y ajustar
 * las definiciones de los indicadores que alimentan los dashboards de proyectos.
 */

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Table, { type Columna } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, ErrorVista } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import {
  IconEditar,
  IconMas,
} from '@/components/icons'
import { useAuth } from '@/auth/AuthContext'
import { puede } from '@/auth/permisos'
import { guardarDefinicionIndicador, obtenerCatalogoIndicadores } from '@/data/repo'
import {
  CATEGORIAS_INDICADOR,
  SENTIDOS_INDICADOR,
  type CategoriaIndicador,
  type DefinicionIndicador,
  type SentidoIndicador,
} from '@/domain/types'

const VACIO: DefinicionIndicador = {
  codigo: '',
  nombre: '',
  categoria: 'Eficacia',
  objetivo: '',
  formulaDescripcion: '',
  formulaClave: '',
  fuente: 'Sistema HIGEP',
  frecuencia: 'Mensual',
  responsable: 'Lider de proyecto',
  automatizacion: 'Automatico',
  meta: 90,
  unidad: 'porcentaje',
  sentido: 'Mayor es mejor',
  factorAtencionMayor: 0.9,
  factorAtencionMenor: 2.0,
  activo: true,
}

export default function CatalogoIndicadores() {
  const { usuario } = useAuth()
  const toast = useToast()

  const [indicadores, setIndicadores] = useState<DefinicionIndicador[]>([])
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState<string>('')
  const [soloActivos, setSoloActivos] = useState(false)

  const [edicion, setEdicion] = useState<DefinicionIndicador | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [detalle, setDetalle] = useState<DefinicionIndicador | null>(null)

  const editable = puede(usuario?.rolGlobal ?? null, 'catalogos.editar')

  const cargar = async () => {
    setCargando(true)
    try {
      const data = await obtenerCatalogoIndicadores()
      setIndicadores(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  const filtrados = useMemo(() => {
    const t = texto.toLowerCase().trim()
    return indicadores.filter((ind) => {
      if (categoria && ind.categoria !== categoria) return false
      if (soloActivos && !ind.activo) return false
      if (t) {
        const heno = `${ind.codigo} ${ind.nombre} ${ind.objetivo} ${ind.categoria}`.toLowerCase()
        if (!heno.includes(t)) return false
      }
      return true
    })
  }, [indicadores, texto, categoria, soloActivos])

  const guardar = async () => {
    if (!edicion) return
    if (!edicion.codigo.trim() || !edicion.nombre.trim()) {
      toast.aviso('Codigo y nombre del indicador son requeridos.')
      return
    }

    setGuardando(true)
    try {
      await guardarDefinicionIndicador(
        edicion,
        comentario.trim() || `${esNuevo ? 'Creo' : 'Actualizo'} definicion de ${edicion.codigo}`,
      )
      toast.exito(`Se guardo exitosamente "${edicion.codigo}".`)
      setEdicion(null)
      setComentario('')
      await cargar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  const alternarActivo = async (ind: DefinicionIndicador) => {
    const actualizado: DefinicionIndicador = { ...ind, activo: !ind.activo }
    try {
      await guardarDefinicionIndicador(
        actualizado,
        `${ind.activo ? 'Desactivo' : 'Activo'} indicador ${ind.codigo}`,
      )
      setIndicadores((prev) => prev.map((i) => (i.codigo === ind.codigo ? actualizado : i)))
      toast.exito(`El indicador ${ind.codigo} fue actualizado.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  if (!editable) {
    return (
      <ErrorVista
        titulo="Acceso restringido"
        detalle="Solo los administradores pueden consultar y ajustar el catalogo institucional de indicadores."
      />
    )
  }

  if (cargando) return <Cargando />

  const columnas: Columna<DefinicionIndicador>[] = [
    {
      clave: 'codigo',
      titulo: 'Codigo',
      ancho: '120px',
      render: (i) => <span className="hg-badge-codigo">{i.codigo}</span>,
    },
    {
      clave: 'nombre',
      titulo: 'Nombre / Objetivo',
      render: (i) => (
        <div>
          <div className="hg-t-negrita" style={{ cursor: 'pointer', color: '#4F46E5' }} onClick={() => setDetalle(i)}>
            {i.nombre}
          </div>
          <div className="hg-t-xs hg-t-muted" style={{ maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {i.objetivo}
          </div>
        </div>
      ),
    },
    {
      clave: 'categoria',
      titulo: 'Categoria',
      ancho: '130px',
      render: (i) => (
        <Badge fg="#4338CA" bg="#EEF2FF">
          {i.categoria}
        </Badge>
      ),
    },
    {
      clave: 'meta',
      titulo: 'Meta',
      ancho: '100px',
      render: (i) => (
        <span className="hg-t-negrita">
          {i.meta} {i.unidad === 'porcentaje' ? '%' : ''}
        </span>
      ),
    },
    {
      clave: 'sentido',
      titulo: 'Sentido',
      ancho: '140px',
      render: (i) => (
        <span className="hg-t-xs">
          {i.sentido === 'Mayor es mejor' ? '▲ Mayor es mejor' : '▼ Menor es mejor'}
        </span>
      ),
    },
    {
      clave: 'automatizacion',
      titulo: 'Tipo',
      ancho: '130px',
      render: (i) => (
        <Badge
          fg={i.automatizacion === 'Automatico' ? '#15803D' : '#B45309'}
          bg={i.automatizacion === 'Automatico' ? '#DCFCE7' : '#FEF3C7'}
        >
          {i.automatizacion}
        </Badge>
      ),
    },
    {
      clave: 'activo',
      titulo: 'Estado',
      ancho: '100px',
      render: (i) => (
        <Badge
          fg={i.activo ? '#15803D' : '#64748B'}
          bg={i.activo ? '#DCFCE7' : '#F1F5F9'}
        >
          {i.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: '160px',
      render: (i) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            tamano="sm"
            variante="ghost"
            onClick={() => {
              setEdicion({ ...i })
              setEsNuevo(false)
            }}
          >
            <IconEditar size={14} />
          </Button>
          <Button
            tamano="sm"
            variante={i.activo ? 'ghost' : 'secondary'}
            onClick={() => void alternarActivo(i)}
          >
            {i.activo ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Indicadores en catalogo"
          valor={indicadores.length}
          pie={`${indicadores.filter((i) => i.activo).length} activos`}
          acento="#6366F1"
        />
        <KPICard
          etiqueta="Automaticos (motor)"
          valor={indicadores.filter((i) => i.automatizacion === 'Automatico').length}
          pie="Calculados sin intervencion manual"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Categorias"
          valor={new Set(indicadores.map((i) => i.categoria)).size}
          pie="Eficacia, Calidad, Gestion, etc."
          acento="#CA8A04"
        />
        <KPICard
          etiqueta="Con formula activa"
          valor={indicadores.filter((i) => Boolean(i.formulaClave)).length}
          pie="Vinculados al motor matematico"
          acento="#15803D"
        />
      </div>

      <Card
        titulo="Catalogo institucional de medicion"
        subtitulo="Definicion formal de metas, fuentes de datos y formulas de semaforizacion para proyectos IETS."
        acciones={
          <Button
            variante="primary"
            onClick={() => {
              setEdicion({ ...VACIO })
              setEsNuevo(true)
            }}
          >
            <IconMas /> Nuevo indicador
          </Button>
        }
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: '1', minWidth: '240px' }}>
            <Input
              placeholder="Buscar por codigo, nombre o descripcion..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>

          <Select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="">Todas las categorias</option>
            {CATEGORIAS_INDICADOR.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="hg-t-sm">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
            />
            Solo activos
          </label>
        </div>

        <Table<DefinicionIndicador>
          columnas={columnas}
          filas={filtrados}
          claveDe={(i) => i.codigo}
          vacio="No se encontraron indicadores con los filtros actuales."
        />
      </Card>

      {/* Modal de Detalle */}
      {detalle && (
        <Modal
          titulo={`${detalle.codigo} · ${detalle.nombre}`}
          abierto={true}
          onCerrar={() => setDetalle(null)}
          pie={
            <>
              <Button
                variante="primary"
                onClick={() => {
                  setEdicion({ ...detalle })
                  setEsNuevo(false)
                  setDetalle(null)
                }}
              >
                <IconEditar /> Modificar
              </Button>
              <Button variante="ghost" onClick={() => setDetalle(null)}>
                Cerrar
              </Button>
            </>
          }
        >
          <div className="hg-pila" style={{ gap: '14px' }}>
            <div>
              <span className="hg-t-muted hg-t-sm">Objetivo:</span>
              <p className="hg-t-base">{detalle.objetivo}</p>
            </div>
            <div>
              <span className="hg-t-muted hg-t-sm">Formula / Logica:</span>
              <div
                style={{
                  background: '#F1F5F9',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                }}
              >
                {detalle.formulaDescripcion}
              </div>
            </div>
            <div className="hg-grid hg-grid--2col">
              <div>
                <span className="hg-t-muted hg-t-sm">Fuente:</span>
                <p className="hg-t-negrita">{detalle.fuente}</p>
              </div>
              <div>
                <span className="hg-t-muted hg-t-sm">Frecuencia de medicion:</span>
                <p className="hg-t-negrita">{detalle.frecuencia}</p>
              </div>
              <div>
                <span className="hg-t-muted hg-t-sm">Responsable:</span>
                <p className="hg-t-negrita">{detalle.responsable}</p>
              </div>
              <div>
                <span className="hg-t-muted hg-t-sm">Automatizacion:</span>
                <p className="hg-t-negrita">{detalle.automatizacion}</p>
              </div>
              <div>
                <span className="hg-t-muted hg-t-sm">Meta institucional:</span>
                <p className="hg-t-negrita">
                  {detalle.meta} {detalle.unidad === 'porcentaje' ? '%' : ''} ({detalle.sentido})
                </p>
              </div>
              <div>
                <span className="hg-t-muted hg-t-sm">Tolerancia para Atencion:</span>
                <p className="hg-t-negrita">
                  Factor: {detalle.sentido === 'Mayor es mejor' ? detalle.factorAtencionMayor : detalle.factorAtencionMenor}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Edicion / Creacion */}
      {edicion && (
        <Modal
          titulo={esNuevo ? 'Nuevo indicador institucional' : `Editar ${edicion.codigo}`}
          abierto={true}
          onCerrar={() => setEdicion(null)}
          pie={
            <>
              <Button variante="ghost" onClick={() => setEdicion(null)}>
                Cancelar
              </Button>
              <Button
                variante="primary"
                onClick={() => void guardar()}
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Guardar y registrar auditoria'}
              </Button>
            </>
          }
        >
          <div className="hg-pila" style={{ gap: '14px' }}>
            <div className="hg-grid hg-grid--2col">
              <Input
                label="Codigo unico"
                value={edicion.codigo}
                onChange={(e) => setEdicion({ ...edicion, codigo: e.target.value.toUpperCase() })}
                disabled={!esNuevo}
                placeholder="PRY-O001, GEST-001..."
              />
              <Select
                label="Categoria"
                value={edicion.categoria}
                onChange={(e) => setEdicion({ ...edicion, categoria: e.target.value as CategoriaIndicador })}
              >
                {CATEGORIAS_INDICADOR.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Nombre del indicador"
              value={edicion.nombre}
              onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
            />

            <Textarea
              label="Objetivo institucional"
              value={edicion.objetivo}
              onChange={(e) => setEdicion({ ...edicion, objetivo: e.target.value })}
              rows={2}
            />

            <Textarea
              label="Descripcion de la formula"
              value={edicion.formulaDescripcion}
              onChange={(e) => setEdicion({ ...edicion, formulaDescripcion: e.target.value })}
              rows={2}
            />

            <div className="hg-grid hg-grid--2col">
              <Input
                label="Meta"
                type="number"
                value={edicion.meta}
                onChange={(e) => setEdicion({ ...edicion, meta: Number(e.target.value) })}
              />
              <Select
                label="Unidad"
                value={edicion.unidad}
                onChange={(e) => setEdicion({ ...edicion, unidad: e.target.value as 'porcentaje' | 'numero' })}
              >
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="numero">Numero absoluto</option>
              </Select>
            </div>

            <div className="hg-grid hg-grid--2col">
              <Select
                label="Sentido del indicador"
                value={edicion.sentido}
                onChange={(e) => setEdicion({ ...edicion, sentido: e.target.value as SentidoIndicador })}
              >
                {SENTIDOS_INDICADOR.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select
                label="Automatizacion"
                value={edicion.automatizacion}
                onChange={(e) =>
                  setEdicion({
                    ...edicion,
                    automatizacion: e.target.value as 'Automatico' | 'Semiautomatico' | 'Manual',
                  })
                }
              >
                <option value="Automatico">Automatico (calculo del motor)</option>
                <option value="Semiautomatico">Semiautomatico</option>
                <option value="Manual">Manual</option>
              </Select>
            </div>

            <div className="hg-grid hg-grid--2col">
              <Input
                label="Fuente"
                value={edicion.fuente}
                onChange={(e) => setEdicion({ ...edicion, fuente: e.target.value })}
              />
              <Input
                label="Frecuencia"
                value={edicion.frecuencia}
                onChange={(e) => setEdicion({ ...edicion, frecuencia: e.target.value })}
              />
            </div>

            <Input
              label="Comentario de auditoria"
              placeholder="Justifique el motivo de la creacion o ajuste..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
