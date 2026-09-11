/**
 * Catalogo de indicadores — HG-110 / HG-116.
 *
 * El catalogo es declarativo: cada indicador apunta a una clave de formula
 * registrada en el motor. El administrador puede ajustar meta, sentido, umbrales
 * y metadatos sin desplegar codigo; la formula, en cambio, se elige entre las
 * implementadas, porque es codigo verificado y probado.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Table, { type Columna } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, ErrorVista } from '@/components/EstadoVista'
import { Nota, Pista } from '@/components/Ayuda'
import { useToast } from '@/components/Toast'
import { IconEditar, IconExportar, IconIndicador, IconMas } from '@/components/icons'
import { useAuth } from '@/auth/AuthContext'
import { puede } from '@/auth/permisos'
import { guardarDefinicionIndicador, obtenerCatalogoIndicadores } from '@/data/repo'
import { FORMULAS } from '@/domain/indicadores'
import { exportarExcel } from '@/lib/exportar'
import {
  CATEGORIAS_INDICADOR,
  SENTIDOS_INDICADOR,
  type DefinicionIndicador,
} from '@/domain/types'

const VACIO: DefinicionIndicador = {
  codigo: '',
  nombre: '',
  categoria: 'Gestion',
  objetivo: '',
  formulaDescripcion: '',
  formulaClave: '',
  fuente: '',
  frecuencia: 'Mensual',
  responsable: '',
  automatizacion: 'Automatico',
  meta: 100,
  unidad: 'porcentaje',
  sentido: 'Mayor es mejor',
  factorAtencionMayor: 0.9,
  factorAtencionMenor: 2,
  activo: true,
}

export default function CatalogoIndicadores() {
  const { usuario } = useAuth()
  const toast = useToast()
  const editable = puede(usuario?.rolGlobal ?? null, 'catalogos.editar')

  const [catalogo, setCatalogo] = useState<DefinicionIndicador[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [edicion, setEdicion] = useState<DefinicionIndicador | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setCatalogo(await obtenerCatalogoIndicadores())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const clavesFormula = useMemo(() => Object.keys(FORMULAS).sort(), [])

  if (!editable) {
    return (
      <ErrorVista
        titulo="Sin permiso para administrar el catalogo de indicadores"
        detalle="Solo el administrador del sistema puede modificar metas, umbrales y metadatos de los indicadores institucionales."
      />
    )
  }

  if (cargando) return <Cargando />
  if (error) return <ErrorVista titulo="No fue posible cargar el catalogo" detalle={error} />

  const guardar = async () => {
    if (!edicion) return
    const e: Record<string, string> = {}
    if (!edicion.codigo.trim()) e.codigo = 'El codigo es obligatorio.'
    else if (esNuevo && catalogo.some((d) => d.codigo === edicion.codigo.trim())) {
      e.codigo = 'Ya existe un indicador con ese codigo.'
    }
    if (!edicion.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!edicion.formulaClave) e.formulaClave = 'Seleccione la formula que calcula el indicador.'
    if (!Number.isFinite(edicion.meta)) e.meta = 'La meta debe ser numerica.'
    if (edicion.factorAtencionMayor <= 0 || edicion.factorAtencionMayor > 1) {
      e.factorAtencionMayor = 'Debe estar entre 0 y 1 (por ejemplo 0,9).'
    }
    if (edicion.factorAtencionMenor < 1) {
      e.factorAtencionMenor = 'Debe ser mayor o igual a 1 (por ejemplo 2).'
    }
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setGuardando(true)
    try {
      await guardarDefinicionIndicador(
        { ...edicion, codigo: edicion.codigo.trim() },
        esNuevo ? 'Alta de indicador en el catalogo' : 'Edicion de indicador del catalogo',
      )
      toast.exito('Indicador guardado. Los proyectos lo recalculan en su siguiente lectura.')
      setEdicion(null)
      await cargar()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const columnas: Columna<DefinicionIndicador>[] = [
    {
      clave: 'codigo',
      titulo: 'Codigo',
      ordenable: true,
      render: (d) => <span className="hg-t-mono hg-t-sm">{d.codigo}</span>,
    },
    {
      clave: 'nombre',
      titulo: 'Indicador',
      ordenable: true,
      render: (d) => (
        <div style={{ minWidth: 220 }}>
          <span className="hg-t-sm hg-t-bold">{d.nombre}</span>
          {!d.activo && (
            <Badge fg="#94A3B8" bg="#F1F5F9" titulo="No se calcula ni se muestra en los tableros">
              inactivo
            </Badge>
          )}
          <div className="hg-t-xs hg-t-sec">{d.objetivo}</div>
        </div>
      ),
    },
    { clave: 'categoria', titulo: 'Categoria', ordenable: true, render: (d) => d.categoria },
    {
      clave: 'meta',
      titulo: 'Meta',
      alineacion: 'derecha',
      ordenable: true,
      render: (d) => (
        <span className="hg-t-num">
          {d.meta}
          {d.unidad === 'porcentaje' ? ' %' : ''}
        </span>
      ),
    },
    { clave: 'sentido', titulo: 'Sentido', ordenable: true, render: (d) => <span className="hg-t-xs">{d.sentido}</span> },
    {
      clave: 'formulaClave',
      titulo: 'Formula',
      render: (d) => (
        <span className="hg-t-xs hg-t-mono" title={d.formulaDescripcion}>
          {d.formulaClave}
          {!FORMULAS[d.formulaClave] && (
            <Badge fg="#B91C1C" bg="#FEE2E2" titulo="No hay implementacion registrada para esta clave">
              sin implementar
            </Badge>
          )}
        </span>
      ),
    },
    { clave: 'frecuencia', titulo: 'Frecuencia', render: (d) => <span className="hg-t-xs">{d.frecuencia}</span> },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (d) => (
        <Button
          variante="ghost"
          tamano="sm"
          soloIcono
          aria-label={`Editar ${d.codigo}`}
          icono={<IconEditar size={15} />}
          onClick={() => {
            setEdicion(structuredClone(d))
            setEsNuevo(false)
            setErrores({})
          }}
        />
      ),
    },
  ]

  const sinImplementacion = catalogo.filter((d) => d.activo && !FORMULAS[d.formulaClave])

  return (
    <div className="hg-pila">
      <Nota regla="ADR-08">
        El motor calcula por formula declarativa: agregar un indicador que combine insumos ya disponibles no
        exige reescribir el motor, basta registrar su definicion aqui y apuntarla a una de las formulas
        implementadas.
      </Nota>

      {sinImplementacion.length > 0 && (
        <Alert
          tipo="warning"
          titulo={`${sinImplementacion.length} indicador(es) activo(s) sin formula implementada`}
          mensaje={`Se mostraran como "sin datos" hasta que se registre su formula: ${sinImplementacion.map((d) => d.codigo).join(', ')}.`}
        />
      )}

      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Indicadores en el catalogo" valor={catalogo.length} acento="#6366F1" />
        <KPICard etiqueta="Activos" valor={catalogo.filter((d) => d.activo).length} acento="#15803D" />
        <KPICard
          etiqueta="Formulas implementadas"
          valor={clavesFormula.length}
          pie="Disponibles para asociar a un indicador"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Categorias en uso"
          valor={new Set(catalogo.map((d) => d.categoria)).size}
          pie={`de ${CATEGORIAS_INDICADOR.length} posibles`}
          acento="#CA8A04"
        />
      </div>

      <Card
        titulo="Catalogo de indicadores institucionales"
        subtitulo="Cada indicador conserva sus siete atributos: objetivo, formula, fuente, frecuencia, responsable, meta y grado de automatizacion."
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
                      nombre: 'Catalogo indicadores',
                      filas: catalogo.map((d) => ({
                        Codigo: d.codigo,
                        Indicador: d.nombre,
                        Categoria: d.categoria,
                        Objetivo: d.objetivo,
                        Formula: d.formulaDescripcion,
                        'Clave de formula': d.formulaClave,
                        Fuente: d.fuente,
                        Frecuencia: d.frecuencia,
                        Responsable: d.responsable,
                        Automatizacion: d.automatizacion,
                        Meta: d.meta,
                        Unidad: d.unidad,
                        Sentido: d.sentido,
                        Activo: d.activo ? 'Si' : 'No',
                      })),
                    },
                  ],
                  'catalogo-indicadores',
                )
              }
            >
              Exportar
            </Button>
            <Button
              variante="primary"
              tamano="sm"
              icono={<IconMas size={15} />}
              onClick={() => {
                setEdicion({ ...VACIO, formulaClave: clavesFormula[0] ?? '' })
                setEsNuevo(true)
                setErrores({})
              }}
            >
              Nuevo indicador
            </Button>
          </>
        }
      >
        <Table columnas={columnas} filas={catalogo} claveDe={(d) => d.codigo} />
      </Card>

      <Modal
        abierto={edicion !== null}
        tamano="lg"
        titulo={esNuevo ? 'Nuevo indicador' : `Editar ${edicion?.codigo ?? ''}`}
        subtitulo="Los cambios afectan el calculo en todos los proyectos."
        onCerrar={() => setEdicion(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
            <Button variante="primary" cargando={guardando} onClick={() => void guardar()}>
              Guardar indicador
            </Button>
          </>
        }
      >
        {edicion && (
          <div className="hg-grid hg-grid--form">
            <Input
              label="Codigo"
              requerido
              disabled={!esNuevo}
              value={edicion.codigo}
              error={errores.codigo}
              ayuda={esNuevo ? 'Por ejemplo PRY-O006. No se puede cambiar despues.' : 'El codigo es la identidad del indicador y no cambia.'}
              onChange={(e) => setEdicion({ ...edicion, codigo: e.target.value })}
            />
            <Select
              label="Categoria"
              requerido
              value={edicion.categoria}
              opciones={CATEGORIAS_INDICADOR}
              onChange={(e) => setEdicion({ ...edicion, categoria: e.target.value as DefinicionIndicador['categoria'] })}
            />
            <Input
              label="Nombre"
              requerido
              anchoCompleto
              value={edicion.nombre}
              error={errores.nombre}
              onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
            />
            <Textarea
              label="Objetivo del indicador"
              anchoCompleto
              rows={2}
              value={edicion.objetivo}
              ayuda="Que decision o pregunta apoya este indicador."
              onChange={(e) => setEdicion({ ...edicion, objetivo: e.target.value })}
            />
            <Select
              label="Formula implementada"
              requerido
              value={edicion.formulaClave}
              error={errores.formulaClave}
              placeholder="Seleccione…"
              opciones={clavesFormula}
              ayuda="Lista de calculos verificados y con prueba automatizada en el motor."
              onChange={(e) => setEdicion({ ...edicion, formulaClave: e.target.value })}
            />
            <Select
              label="Grado de automatizacion"
              value={edicion.automatizacion}
              opciones={['Automatico', 'Semiautomatico', 'Manual']}
              onChange={(e) =>
                setEdicion({ ...edicion, automatizacion: e.target.value as DefinicionIndicador['automatizacion'] })
              }
            />
            <Textarea
              label="Descripcion de la formula"
              anchoCompleto
              rows={2}
              value={edicion.formulaDescripcion}
              ayuda="Redaccion legible para la ficha tecnica que ve el usuario."
              onChange={(e) => setEdicion({ ...edicion, formulaDescripcion: e.target.value })}
            />
            <Input
              label="Fuente del dato"
              value={edicion.fuente}
              ayuda="Modulo del sistema que provee el insumo."
              onChange={(e) => setEdicion({ ...edicion, fuente: e.target.value })}
            />
            <Input
              label="Frecuencia de medicion"
              value={edicion.frecuencia}
              onChange={(e) => setEdicion({ ...edicion, frecuencia: e.target.value })}
            />
            <Input
              label="Responsable"
              value={edicion.responsable}
              onChange={(e) => setEdicion({ ...edicion, responsable: e.target.value })}
            />
            <Input
              label="Meta"
              type="number"
              step="any"
              requerido
              value={edicion.meta}
              error={errores.meta}
              onChange={(e) => setEdicion({ ...edicion, meta: Number(e.target.value) })}
            />
            <Select
              label="Unidad"
              value={edicion.unidad}
              opciones={[
                { valor: 'porcentaje', etiqueta: 'Porcentaje' },
                { valor: 'numero', etiqueta: 'Numero absoluto' },
              ]}
              onChange={(e) => setEdicion({ ...edicion, unidad: e.target.value as DefinicionIndicador['unidad'] })}
            />
            <Select
              label="Sentido"
              value={edicion.sentido}
              opciones={SENTIDOS_INDICADOR}
              ayuda="Determina si un valor alto o bajo es favorable."
              onChange={(e) => setEdicion({ ...edicion, sentido: e.target.value as DefinicionIndicador['sentido'] })}
            />
            <Input
              label="Factor de atencion (mayor es mejor)"
              type="number"
              step="0.05"
              min={0.1}
              max={1}
              value={edicion.factorAtencionMayor}
              error={errores.factorAtencionMayor}
              ayuda="Resultado >= meta x factor se marca Atencion en vez de Critico. El libro usaba 0,9 fijo."
              onChange={(e) => setEdicion({ ...edicion, factorAtencionMayor: Number(e.target.value) })}
            />
            <Input
              label="Factor de atencion (menor es mejor)"
              type="number"
              step="0.5"
              min={1}
              value={edicion.factorAtencionMenor}
              error={errores.factorAtencionMenor}
              ayuda="Resultado <= meta x factor se marca Atencion. El libro usaba 2 fijo."
              onChange={(e) => setEdicion({ ...edicion, factorAtencionMenor: Number(e.target.value) })}
            />

            <div className="hg-col-span">
              <Checkbox
                label="Indicador activo (se calcula y se muestra en los tableros)"
                checked={edicion.activo}
                onChange={(e) => setEdicion({ ...edicion, activo: e.target.checked })}
              />
            </div>

            <div
              className="hg-col-span hg-fila"
              style={{ background: 'var(--c-bg-hover)', borderRadius: 'var(--r-base)', padding: 'var(--sp-sm)' }}
            >
              <IconIndicador size={15} />
              <span className="hg-t-xs hg-t-sec">
                Semaforo resultante:{' '}
                {edicion.sentido === 'Mayor es mejor'
                  ? `Cumple si >= ${edicion.meta}; Atencion si >= ${(edicion.meta * edicion.factorAtencionMayor).toFixed(2)}; Critico por debajo.`
                  : `Cumple si <= ${edicion.meta}; Atencion si <= ${(edicion.meta === 0 ? edicion.factorAtencionMenor : edicion.meta * edicion.factorAtencionMenor).toFixed(2)}; Critico por encima.`}
              </span>
              <Pista texto="El semaforo se recalcula en el momento de la lectura; no se guarda un estado congelado." />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
