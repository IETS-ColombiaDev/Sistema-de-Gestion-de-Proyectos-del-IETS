/**
 * Ficha del proyecto — EP-07.
 * Contiene la fecha de corte, que es UNICA por proyecto (RN-26, corrige D-04)
 * y gobierna todos los calculos de seguimiento del sistema.
 */

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import Alert from '@/components/Alert'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { IconCalendario, IconEliminar, IconMas } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { diffDias, formatearFecha } from '@/domain/fechas'
import { guardarEntidad } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { nuevoId } from '@/data/adapter'
import {
  ESTADOS_PROYECTO,
  MODOS_CALCULO,
  type Fase,
  type ObjetivoEspecifico,
  type ProductoComprometido,
  type Proyecto,
} from '@/domain/types'

export default function Ficha() {
  const { datos, resumen, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'proyecto.editarFicha')
  const puedeCorte = puedeEnProyecto(usuario, proyecto ?? null, 'proyecto.cambiarFechaCorte')

  const [borrador, setBorrador] = useState<Proyecto | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmarCorte, setConfirmarCorte] = useState<string | null>(null)
  const [comentario, setComentario] = useState('')
  const [modalFases, setModalFases] = useState(false)
  const [nombreFase, setNombreFase] = useState('')

  useEffect(() => {
    if (proyecto) setBorrador(structuredClone(proyecto))
  }, [proyecto])

  const errores = useMemo(() => {
    const e: Record<string, string> = {}
    if (!borrador) return e
    if (!borrador.nombre?.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!borrador.codigo?.trim()) e.codigo = 'El codigo es obligatorio.'
    if (borrador.fechaEntregaFinal < borrador.fechaInicio) {
      e.fechaEntregaFinal = 'La fecha de entrega final no puede ser anterior a la de inicio.'
    }
    return e
  }, [borrador])

  const corteFueraDeVigencia =
    borrador != null &&
    (borrador.fechaCorte < borrador.fechaInicio || borrador.fechaCorte > borrador.fechaEntregaFinal)

  if (cargando || !borrador || !proyecto) return <Cargando />

  const set = <K extends keyof Proyecto>(campo: K, valor: Proyecto[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b))

  const guardar = async (comentarioCambio?: string) => {
    if (Object.keys(errores).length > 0) {
      toast.error('Corrija los errores antes de guardar.')
      return
    }
    setGuardando(true)
    try {
      await guardarEntidad<Proyecto>(rutas.proyectos(), borrador, {
        proyectoId: proyecto.id,
        entidad: 'proyecto',
        etiqueta: `${borrador.codigo} · ${borrador.nombre}`,
        tipoCambio: 'Otro',
        comentario: comentarioCambio,
      })
      toast.exito('Ficha guardada. Los calculos del proyecto se actualizaron.')
      await recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  // --- Objetivos especificos (HG-043) ---
  const objetivos = borrador.objetivosEspecificos ?? []
  const moverObjetivo = (i: number, delta: number) => {
    const copia = [...objetivos]
    const j = i + delta
    if (j < 0 || j >= copia.length) return
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    set(
      'objetivosEspecificos',
      copia.map((o, k) => ({ ...o, orden: k + 1 })),
    )
  }

  // --- Productos comprometidos (HG-044) ---
  const productos = borrador.productosComprometidos ?? []

  return (
    <div className="hg-pila">
      {corteFueraDeVigencia && (
        <Alert
          tipo="warning"
          titulo="La fecha de corte esta fuera de la vigencia del proyecto"
          mensaje={`El corte (${formatearFecha(borrador.fechaCorte)}) no cae entre el inicio y la entrega final. Los calculos se ejecutan igual, pero el resultado puede no ser representativo.`}
        />
      )}

      <Card
        titulo="Identificacion"
        subtitulo="Datos que identifican el proyecto en el portafolio institucional."
        acciones={
          editable && (
            <Button variante="primary" onClick={() => void guardar()} cargando={guardando}>
              Guardar ficha
            </Button>
          )
        }
      >
        <div className="hg-grid hg-grid--form">
          <Input
            label="Codigo"
            requerido
            disabled={!editable}
            value={borrador.codigo}
            error={errores.codigo}
            onChange={(e) => set('codigo', e.target.value)}
          />
          <Select
            label="Estado del proyecto"
            disabled={!editable}
            value={borrador.estado}
            opciones={ESTADOS_PROYECTO}
            ayuda="Un proyecto cerrado pasa a solo lectura."
            onChange={(e) => set('estado', e.target.value as Proyecto['estado'])}
          />
          <Input
            label="Nombre del proyecto"
            requerido
            anchoCompleto
            disabled={!editable}
            value={borrador.nombre}
            error={errores.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
          <Textarea
            label="Tecnologia u objeto de evaluacion"
            anchoCompleto
            disabled={!editable}
            value={borrador.tecnologiaObjeto}
            onChange={(e) => set('tecnologiaObjeto', e.target.value)}
          />
          <Input
            label="Entidad ejecutora"
            disabled={!editable}
            value={borrador.entidadEjecutora}
            onChange={(e) => set('entidadEjecutora', e.target.value)}
          />
          <Input
            label="Financiador o contratante"
            disabled={!editable}
            value={borrador.financiador}
            onChange={(e) => set('financiador', e.target.value)}
          />
          <Input
            label="Lider del proyecto"
            disabled={!editable}
            value={borrador.liderNombre}
            onChange={(e) => set('liderNombre', e.target.value)}
          />
          <Input
            label="Presupuesto total"
            type="number"
            min={0}
            disabled={!editable}
            value={borrador.presupuestoTotal ?? ''}
            ayuda="Valor en la moneda del proyecto."
            onChange={(e) => set('presupuestoTotal', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </Card>

      <Card
        titulo="Fechas y fecha de corte"
        subtitulo="La fecha de corte es unica en el proyecto y gobierna todos los calculos de seguimiento."
      >
        <div className="hg-grid hg-grid--form">
          <Input
            label="Fecha de inicio"
            type="date"
            requerido
            disabled={!editable}
            value={borrador.fechaInicio}
            onChange={(e) => set('fechaInicio', e.target.value)}
          />
          <Input
            label="Fecha de entrega final"
            type="date"
            requerido
            disabled={!editable}
            value={borrador.fechaEntregaFinal}
            error={errores.fechaEntregaFinal}
            ayuda="Alimenta la alerta de proximidad de entrega. No es una constante escrita en las formulas."
            onChange={(e) => set('fechaEntregaFinal', e.target.value)}
          />
          <Input
            label="Fecha de corte"
            type="date"
            requerido
            disabled={!puedeCorte}
            value={borrador.fechaCorte}
            ayuda="Al cambiarla se recalcula todo el proyecto: estados, avance esperado, indicadores y alertas."
            onChange={(e) => setConfirmarCorte(e.target.value)}
          />
        </div>

        <div
          className="hg-fila"
          style={{
            marginTop: 'var(--sp-md)',
            padding: 'var(--sp-sm) var(--sp-md)',
            background: 'var(--c-bg-active)',
            borderRadius: 'var(--r-base)',
            color: 'var(--c-purple)',
          }}
        >
          <IconCalendario size={16} />
          <strong className="hg-t-sm">Corte vigente: {formatearFecha(proyecto.fechaCorte, 'largo')}</strong>
          <span className="hg-t-xs" style={{ color: 'var(--c-text-2)' }}>
            {resumen ? `Dia ${diffDias(proyecto.fechaInicio, proyecto.fechaCorte)} de ${diffDias(proyecto.fechaInicio, proyecto.fechaEntregaFinal)} de la vigencia` : ''}
          </span>
        </div>
      </Card>

      <Card
        titulo="Alcance y metodologia"
        subtitulo="Contenido sustantivo del proyecto conforme al instructivo."
      >
        <div className="hg-grid" style={{ gap: 'var(--sp-md)' }}>
          <Textarea
            label="Alcance"
            rows={3}
            disabled={!editable}
            value={borrador.alcance}
            onChange={(e) => set('alcance', e.target.value)}
          />
          <Textarea
            label="Objetivo general"
            rows={3}
            disabled={!editable}
            value={borrador.objetivoGeneral}
            onChange={(e) => set('objetivoGeneral', e.target.value)}
          />
          <Textarea
            label="Marco metodologico"
            rows={3}
            disabled={!editable}
            value={borrador.marcoMetodologico}
            onChange={(e) => set('marcoMetodologico', e.target.value)}
          />
        </div>
      </Card>

      <Card
        titulo="Objetivos especificos"
        subtitulo="Lista estructurada. Cada objetivo admite un indicador verificable."
        acciones={
          editable && (
            <Button
              variante="secondary"
              tamano="sm"
              icono={<IconMas size={15} />}
              onClick={() =>
                set('objetivosEspecificos', [
                  ...objetivos,
                  { id: nuevoId('oe'), orden: objetivos.length + 1, texto: '', indicadorVerificable: '' },
                ])
              }
            >
              Agregar objetivo
            </Button>
          )
        }
      >
        {objetivos.length === 0 ? (
          <p className="hg-t-sm hg-t-sec">Aun no se registran objetivos especificos.</p>
        ) : (
          <div className="hg-pila" style={{ gap: 'var(--sp-sm)' }}>
            {objetivos.map((o: ObjetivoEspecifico, i) => (
              <div
                key={o.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 'var(--sp-sm)',
                  alignItems: 'start',
                  padding: 'var(--sp-sm)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-base)',
                }}
              >
                <Badge fg="#4F46E5" bg="#EEF2FF">
                  OE-{i + 1}
                </Badge>
                <div className="hg-grid hg-grid--form" style={{ gap: 'var(--sp-xs)' }}>
                  <Textarea
                    label="Objetivo"
                    rows={2}
                    anchoCompleto
                    disabled={!editable}
                    value={o.texto}
                    onChange={(e) =>
                      set(
                        'objetivosEspecificos',
                        objetivos.map((x) => (x.id === o.id ? { ...x, texto: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    label="Indicador verificable"
                    anchoCompleto
                    disabled={!editable}
                    value={o.indicadorVerificable ?? ''}
                    onChange={(e) =>
                      set(
                        'objetivosEspecificos',
                        objetivos.map((x) =>
                          x.id === o.id ? { ...x, indicadorVerificable: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
                {editable && (
                  <div className="hg-pila" style={{ gap: 2 }}>
                    <Button variante="ghost" tamano="sm" soloIcono aria-label="Subir" onClick={() => moverObjetivo(i, -1)}>
                      ↑
                    </Button>
                    <Button variante="ghost" tamano="sm" soloIcono aria-label="Bajar" onClick={() => moverObjetivo(i, 1)}>
                      ↓
                    </Button>
                    <Button
                      variante="ghost"
                      tamano="sm"
                      soloIcono
                      aria-label="Eliminar objetivo"
                      icono={<IconEliminar size={15} />}
                      onClick={() =>
                        set(
                          'objetivosEspecificos',
                          objetivos.filter((x) => x.id !== o.id).map((x, k) => ({ ...x, orden: k + 1 })),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        titulo="Productos comprometidos"
        subtitulo="Los entregables definidos aqui alimentan el modulo de productos y el indicador PRY-O003."
        acciones={
          editable && (
            <Button
              variante="secondary"
              tamano="sm"
              icono={<IconMas size={15} />}
              onClick={() =>
                set('productosComprometidos', [
                  ...productos,
                  { id: nuevoId('pc'), orden: productos.length + 1, nombre: '', descripcion: '' },
                ])
              }
            >
              Agregar producto
            </Button>
          )
        }
      >
        {productos.length === 0 ? (
          <p className="hg-t-sm hg-t-sec">Aun no se registran productos comprometidos.</p>
        ) : (
          <div className="hg-pila" style={{ gap: 'var(--sp-sm)' }}>
            {productos.map((p: ProductoComprometido, i) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 'var(--sp-sm)',
                  alignItems: 'start',
                  padding: 'var(--sp-sm)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-base)',
                }}
              >
                <Badge fg="#0E7490" bg="#CFFAFE">
                  P-{i + 1}
                </Badge>
                <div className="hg-grid hg-grid--form" style={{ gap: 'var(--sp-xs)' }}>
                  <Input
                    label="Entregable"
                    disabled={!editable}
                    value={p.nombre}
                    onChange={(e) =>
                      set(
                        'productosComprometidos',
                        productos.map((x) => (x.id === p.id ? { ...x, nombre: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    label="Descripcion"
                    disabled={!editable}
                    value={p.descripcion ?? ''}
                    onChange={(e) =>
                      set(
                        'productosComprometidos',
                        productos.map((x) => (x.id === p.id ? { ...x, descripcion: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                {editable && (
                  <Button
                    variante="ghost"
                    tamano="sm"
                    soloIcono
                    aria-label="Eliminar producto"
                    icono={<IconEliminar size={15} />}
                    onClick={() =>
                      set(
                        'productosComprometidos',
                        productos.filter((x) => x.id !== p.id).map((x, k) => ({ ...x, orden: k + 1 })),
                      )
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        titulo="Fases del proyecto"
        subtitulo="Lista unica de fases. El cronograma y el tablero la consumen; ningun modulo la reescribe."
        acciones={
          editable && (
            <Button variante="secondary" tamano="sm" onClick={() => setModalFases(true)}>
              Administrar fases
            </Button>
          )
        }
      >
        <div className="hg-fila">
          {borrador.fases.map((f) => (
            <Badge key={f.id} fg={f.activa ? '#4F46E5' : '#94A3B8'} bg={f.activa ? '#EEF2FF' : '#F1F5F9'}>
              {f.orden}. {f.nombre}
              {!f.activa && ' (inactiva)'}
            </Badge>
          ))}
        </div>
      </Card>

      <Card
        titulo="Modo del motor de calculo"
        subtitulo="Determina si el sistema aplica las reglas saneadas o reproduce el comportamiento heredado del libro Excel."
      >
        <div className="hg-grid hg-grid--form">
          <Select
            label="Modo de calculo"
            disabled={!editable}
            value={borrador.modoCalculo}
            opciones={[
              { valor: 'saneado', etiqueta: 'Saneado (reglas corregidas)' },
              { valor: 'compatibilidad', etiqueta: 'Compatibilidad (replica el Excel)' },
            ].filter((o) => MODOS_CALCULO.includes(o.valor as never))}
            onChange={(e) => set('modoCalculo', e.target.value as Proyecto['modoCalculo'])}
          />
        </div>
        <Alert
          tipo="info"
          titulo={
            borrador.modoCalculo === 'saneado'
              ? 'Modo saneado: los calculos corrigen los defectos verificados del archivo fuente'
              : 'Modo compatibilidad: los calculos replican el archivo fuente, defectos incluidos'
          }
          mensaje={
            borrador.modoCalculo === 'saneado'
              ? 'La duracion se cuenta en dias habiles reales (D-01), el avance esperado usa unidades homogeneas (D-02), la desviacion presupuestal se calcula sobre totales (D-05) y los hitos cumplidos con retraso si cuentan (D-06).'
              : 'La duracion es fin − inicio − 2, el avance esperado mezcla dias habiles y calendario, la desviacion presupuestal suma porcentajes de filas distintas y los hitos cumplidos con retraso no cuentan. Este modo existe unicamente para la prueba de paridad con el libro de referencia.'
          }
        />
      </Card>

      <ModalConfirmacion
        abierto={confirmarCorte !== null}
        titulo="Cambiar la fecha de corte"
        mensaje={
          <>
            Se cambiara la fecha de corte de <strong>{formatearFecha(borrador.fechaCorte)}</strong> a{' '}
            <strong>{formatearFecha(confirmarCorte ?? '')}</strong>. Esto recalcula estados de actividad,
            avance esperado, desviacion, indicadores y alertas de todo el proyecto.
          </>
        }
        textoConfirmar="Cambiar y recalcular"
        variante="primary"
        exigeComentario
        comentario={comentario}
        onComentario={setComentario}
        onConfirmar={async () => {
          if (!confirmarCorte) return
          const actualizado = { ...borrador, fechaCorte: confirmarCorte }
          setBorrador(actualizado)
          setConfirmarCorte(null)
          setGuardando(true)
          try {
            await guardarEntidad<Proyecto>(rutas.proyectos(), actualizado, {
              proyectoId: proyecto.id,
              entidad: 'proyecto',
              etiqueta: `${actualizado.codigo} · ${actualizado.nombre}`,
              tipoCambio: 'Decision',
              comentario,
            })
            toast.exito('Fecha de corte actualizada. El proyecto se recalculo.')
            await recargar()
          } finally {
            setGuardando(false)
            setComentario('')
          }
        }}
        onCerrar={() => {
          setConfirmarCorte(null)
          setComentario('')
        }}
      />

      <Modal
        abierto={modalFases}
        titulo="Fases del proyecto"
        subtitulo="Una fase en uso no se elimina: se desactiva, para no romper las actividades ya registradas."
        onCerrar={() => setModalFases(false)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setModalFases(false)}>
              Cerrar
            </Button>
            <Button
              variante="primary"
              onClick={async () => {
                await guardar('Actualizacion de la lista de fases del proyecto')
                setModalFases(false)
              }}
            >
              Guardar fases
            </Button>
          </>
        }
      >
        <div className="hg-pila">
          {borrador.fases.map((f: Fase) => {
            const enUso = datos?.actividades.some((a) => a.faseId === f.id) ?? false
            return (
              <div
                key={f.id}
                className="hg-fila"
                style={{ borderBottom: '1px solid var(--c-border)', paddingBottom: 'var(--sp-xs)' }}
              >
                <span className="hg-t-num hg-t-ter" style={{ width: 24 }}>
                  {f.orden}
                </span>
                <input
                  className="hg-input hg-input--sm"
                  style={{ flex: 1, minWidth: 160 }}
                  value={f.nombre}
                  aria-label={`Nombre de la fase ${f.orden}`}
                  onChange={(e) =>
                    set(
                      'fases',
                      borrador.fases.map((x) => (x.id === f.id ? { ...x, nombre: e.target.value } : x)),
                    )
                  }
                />
                <Checkbox
                  label="Activa"
                  checked={f.activa}
                  onChange={(e) =>
                    set(
                      'fases',
                      borrador.fases.map((x) => (x.id === f.id ? { ...x, activa: e.target.checked } : x)),
                    )
                  }
                />
                {enUso ? (
                  <Badge fg="#92400E" bg="#FEF3C7" titulo="Tiene actividades asociadas">
                    en uso
                  </Badge>
                ) : (
                  <Button
                    variante="ghost"
                    tamano="sm"
                    soloIcono
                    aria-label={`Eliminar fase ${f.nombre}`}
                    icono={<IconEliminar size={15} />}
                    onClick={() =>
                      set(
                        'fases',
                        borrador.fases.filter((x) => x.id !== f.id).map((x, k) => ({ ...x, orden: k + 1 })),
                      )
                    }
                  />
                )}
              </div>
            )
          })}

          <div className="hg-fila">
            <input
              className="hg-input hg-input--sm"
              style={{ flex: 1 }}
              placeholder="Nombre de la fase nueva"
              aria-label="Nombre de la fase nueva"
              value={nombreFase}
              onChange={(e) => setNombreFase(e.target.value)}
            />
            <Button
              variante="secondary"
              tamano="sm"
              disabled={!nombreFase.trim()}
              onClick={() => {
                set('fases', [
                  ...borrador.fases,
                  { id: nuevoId('f'), orden: borrador.fases.length + 1, nombre: nombreFase.trim(), activa: true },
                ])
                setNombreFase('')
              }}
            >
              Agregar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
