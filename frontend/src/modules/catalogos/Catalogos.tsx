/**
 * Administracion de catalogos y parametros — EP-06.
 *
 * Reproduce la hoja "Parametros y listas" del libro, con dos diferencias
 * sustantivas: los valores gobiernan efectivamente las validaciones de la
 * aplicacion (en el libro eran literales dispersos, D-04 y D-08) y todo cambio
 * genera evento de auditoria con valor anterior y nuevo (HG-040).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Tabs from '@/components/Tabs'
import Table from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Checkbox, Input, Textarea } from '@/components/ui/Field'
import { Cargando, ErrorVista, Vacio } from '@/components/EstadoVista'
import { Nota, Pista } from '@/components/Ayuda'
import { useToast } from '@/components/Toast'
import {
  IconCalendario,
  IconCandado,
  IconCatalogo,
  IconEliminar,
  IconMas,
  IconRefrescar,
} from '@/components/icons'
import { useAuth } from '@/auth/AuthContext'
import { puede } from '@/auth/permisos'
import {
  guardarLista,
  guardarParametros,
  listarProyectos,
  obtenerListas,
  obtenerParametros,
} from '@/data/repo'
import { reiniciarDatos, sembrarDatos } from '@/data/seed'
import { festivosColombia, formatearFecha, hoyISO } from '@/domain/fechas'
import { numero } from '@/lib/formato'
import type { ListaControlada, Parametros } from '@/domain/types'

type Pestana = 'parametros' | 'listas' | 'festivos' | 'datos'

export default function Catalogos() {
  const { usuario } = useAuth()
  const toast = useToast()
  const editable = puede(usuario?.rolGlobal ?? null, 'catalogos.editar')

  const [pestana, setPestana] = useState<Pestana>('parametros')
  const [parametros, setParametros] = useState<Parametros | null>(null)
  const [listas, setListas] = useState<ListaControlada[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [listaEnEdicion, setListaEnEdicion] = useState<ListaControlada | null>(null)
  const [valorNuevo, setValorNuevo] = useState('')
  const [anioFestivos, setAnioFestivos] = useState(new Date().getFullYear())
  const [festivoNuevo, setFestivoNuevo] = useState('')
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  const [comentario, setComentario] = useState('')
  const [proyectosCount, setProyectosCount] = useState(0)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [p, l, proys] = await Promise.all([obtenerParametros(), obtenerListas(), listarProyectos()])
      setParametros(p)
      setListas(l)
      setProyectosCount(proys.length)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const festivosDelAnio = useMemo(
    () => (parametros?.festivos ?? []).filter((f) => f.startsWith(String(anioFestivos))).sort(),
    [parametros, anioFestivos],
  )

  if (!editable) {
    return (
      <ErrorVista
        titulo="Sin permiso para administrar catalogos"
        detalle="La administracion de listas controladas y parametros globales esta reservada al administrador del sistema."
      />
    )
  }

  if (cargando || !parametros) return <Cargando />
  if (error) return <ErrorVista titulo="No fue posible cargar los catalogos" detalle={error} />

  const guardarParams = async (nuevos: Parametros, mensaje: string) => {
    setGuardando(true)
    try {
      await guardarParametros(nuevos, comentario || mensaje)
      setParametros(nuevos)
      toast.exito('Parametros guardados. Los calculos usan el valor vigente.')
      setComentario('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const guardarListaEditada = async () => {
    if (!listaEnEdicion) return
    setGuardando(true)
    try {
      await guardarLista(listaEnEdicion, 'Edicion de lista controlada')
      setListas((prev) => prev.map((l) => (l.id === listaEnEdicion.id ? listaEnEdicion : l)))
      toast.exito('Lista actualizada.')
      setListaEnEdicion(null)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const sembrar = async () => {
    setGuardando(true)
    try {
      const r = await sembrarDatos(false)
      if (r) toast.exito(`Datos de prueba cargados: ${r.actividades} actividades en el proyecto de referencia.`)
      else toast.info('Ya existen proyectos. Use "Reiniciar entorno" si desea regenerar los datos de prueba.')
      await cargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const reiniciar = async () => {
    setGuardando(true)
    setConfirmarReinicio(false)
    try {
      await reiniciarDatos()
      toast.exito('Entorno reiniciado con datos de prueba.')
      await cargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="hg-pila">
      <Nota regla="ADR-07">
        Las listas y los parametros viven en la base de datos, no en el codigo: se mantienen sin desplegar
        una version nueva, y cada cambio queda auditado.
      </Nota>

      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Listas controladas" valor={listas.length} acento="#6366F1" />
        <KPICard
          etiqueta="Dias no laborables"
          valor={numero(parametros.festivos.length)}
          pie="Alimentan el conteo de dias habiles"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Ventana de alerta"
          valor={`${parametros.ventanaAlertaDias} dias`}
          pie="Anticipacion de la alerta de entrega"
          acento="#CA8A04"
        />
        <KPICard etiqueta="Proyectos en el sistema" valor={proyectosCount} acento="#15803D" />
      </div>

      <Card
        titulo="Catalogos y parametros del sistema"
        acciones={
          <Tabs
            opciones={[
              { valor: 'parametros', etiqueta: 'Parametros' },
              { valor: 'listas', etiqueta: 'Listas', conteo: listas.length },
              { valor: 'festivos', etiqueta: 'Dias no laborables' },
              { valor: 'datos', etiqueta: 'Datos de prueba' },
            ]}
            activa={pestana}
            onCambiar={(v) => setPestana(v as Pestana)}
            etiquetaAria="Secciones de administracion"
          />
        }
      >
        {pestana === 'parametros' && (
          <div className="hg-pila">
            <div className="hg-grid hg-grid--form">
              <Input
                label="Ventana de alerta de entrega (dias)"
                type="number"
                min={1}
                max={180}
                value={parametros.ventanaAlertaDias}
                ayuda="Con cuantos dias de anticipacion el sistema advierte una entrega proxima."
                onChange={(e) =>
                  setParametros({ ...parametros, ventanaAlertaDias: Math.max(1, Number(e.target.value)) })
                }
              />
              <Input
                label="Umbral de precaucion (puntos)"
                type="number"
                min={1}
                max={100}
                value={parametros.umbralPrecaucion}
                ayuda="Desviacion negativa de avance a partir de la cual se advierte precaucion."
                onChange={(e) =>
                  setParametros({ ...parametros, umbralPrecaucion: Math.max(1, Number(e.target.value)) })
                }
              />
              <Input
                label="Umbral de atencion (puntos)"
                type="number"
                min={1}
                max={100}
                value={parametros.umbralAtencion}
                ayuda="Desviacion negativa de avance que activa la alerta de atencion."
                onChange={(e) =>
                  setParametros({ ...parametros, umbralAtencion: Math.max(1, Number(e.target.value)) })
                }
              />
              <Input
                label="Retencion de auditoria (meses)"
                type="number"
                min={12}
                max={240}
                value={parametros.retencionAuditoriaMeses}
                ayuda="Periodo durante el cual los eventos permanecen en consulta directa."
                onChange={(e) =>
                  setParametros({ ...parametros, retencionAuditoriaMeses: Math.max(12, Number(e.target.value)) })
                }
              />
              <Input
                label="Tamano maximo de adjunto (MB)"
                type="number"
                min={1}
                max={200}
                value={parametros.maxAdjuntoMB}
                onChange={(e) => setParametros({ ...parametros, maxAdjuntoMB: Math.max(1, Number(e.target.value)) })}
              />
            </div>

            {parametros.umbralAtencion <= parametros.umbralPrecaucion && (
              <Alert
                tipo="warning"
                titulo="Umbrales incoherentes"
                mensaje="El umbral de atencion debe ser mayor que el de precaucion: la atencion es la situacion mas grave."
              />
            )}

            <Textarea
              label="Justificacion del cambio"
              rows={2}
              value={comentario}
              ayuda="Opcional pero recomendada: queda en el registro de auditoria junto al valor anterior y el nuevo."
              onChange={(e) => setComentario(e.target.value)}
            />

            <div className="hg-fila hg-fila--fin">
              <Button variante="secondary" onClick={() => void cargar()}>
                Descartar cambios
              </Button>
              <Button
                variante="primary"
                cargando={guardando}
                disabled={parametros.umbralAtencion <= parametros.umbralPrecaucion}
                onClick={() => void guardarParams(parametros, 'Actualizacion de parametros globales')}
              >
                Guardar parametros
              </Button>
            </div>
          </div>
        )}

        {pestana === 'listas' && (
          <div className="hg-pila">
            <p className="hg-t-sm hg-t-sec">
              Un valor en uso no se elimina: se desactiva, para que los registros historicos conserven su
              significado. Las listas del motor de calculo no son editables.
            </p>
            <Table
              columnas={[
                {
                  clave: 'nombre',
                  titulo: 'Lista',
                  ordenable: true,
                  render: (l: ListaControlada) => (
                    <div style={{ minWidth: 220 }}>
                      <span className="hg-t-sm hg-t-bold">{l.nombre}</span>
                      {!l.editable && (
                        <Badge fg="#64748B" bg="#F1F5F9" titulo="Gobernada por el motor de calculo">
                          sistema
                        </Badge>
                      )}
                      <div className="hg-t-xs hg-t-sec">{l.descripcion}</div>
                    </div>
                  ),
                },
                {
                  clave: 'valores',
                  titulo: 'Valores',
                  render: (l) => (
                    <div className="hg-fila" style={{ gap: 4 }}>
                      {l.valores.map((v) => (
                        <Badge
                          key={v.valor}
                          fg={v.activo ? '#4F46E5' : '#94A3B8'}
                          bg={v.activo ? '#EEF2FF' : '#F1F5F9'}
                          titulo={v.activo ? 'Activo' : 'Desactivado'}
                        >
                          {v.valor}
                        </Badge>
                      ))}
                    </div>
                  ),
                },
                {
                  clave: 'total',
                  titulo: 'Activos',
                  alineacion: 'derecha',
                  render: (l) => `${l.valores.filter((v) => v.activo).length} / ${l.valores.length}`,
                },
                {
                  clave: 'acciones',
                  titulo: '',
                  alineacion: 'derecha',
                  render: (l) => (
                    <Button
                      variante={l.editable ? 'secondary' : 'ghost'}
                      tamano="sm"
                      icono={l.editable ? undefined : <IconCandado size={14} />}
                      onClick={() => {
                        setListaEnEdicion(structuredClone(l))
                        setValorNuevo('')
                      }}
                    >
                      {l.editable ? 'Editar' : 'Ver'}
                    </Button>
                  ),
                },
              ]}
              filas={listas}
              claveDe={(l) => l.id}
            />
          </div>
        )}

        {pestana === 'festivos' && (
          <div className="hg-pila">
            <Nota regla="HG-039">
              Los dias no laborables alimentan el conteo de dias habiles de la duracion de las actividades. Los
              festivos de Colombia se calculan con la Ley Emiliani, de modo que el sistema no caduca; aqui puede
              agregar dias institucionales adicionales.
            </Nota>

            <div className="hg-barra-filtros">
              <Input
                label="Ano"
                type="number"
                min={2000}
                max={2100}
                value={anioFestivos}
                onChange={(e) => setAnioFestivos(Number(e.target.value))}
                style={{ maxWidth: 130 }}
              />
              <Button
                variante="secondary"
                icono={<IconRefrescar size={15} />}
                onClick={() => {
                  const calculados = festivosColombia(anioFestivos)
                  const faltantes = calculados.filter((f) => !parametros.festivos.includes(f))
                  if (faltantes.length === 0) {
                    toast.info(`Los festivos de ${anioFestivos} ya estan cargados.`)
                    return
                  }
                  void guardarParams(
                    { ...parametros, festivos: [...parametros.festivos, ...faltantes].sort() },
                    `Carga de ${faltantes.length} festivos de ${anioFestivos}`,
                  )
                }}
              >
                Cargar festivos de {anioFestivos}
              </Button>
              <Input
                label="Agregar un dia no laborable"
                type="date"
                value={festivoNuevo}
                onChange={(e) => setFestivoNuevo(e.target.value)}
              />
              <Button
                variante="primary"
                disabled={!festivoNuevo || parametros.festivos.includes(festivoNuevo)}
                icono={<IconMas size={15} />}
                onClick={() => {
                  void guardarParams(
                    { ...parametros, festivos: [...parametros.festivos, festivoNuevo].sort() },
                    `Alta del dia no laborable ${festivoNuevo}`,
                  )
                  setFestivoNuevo('')
                }}
              >
                Agregar
              </Button>
            </div>

            {festivosDelAnio.length === 0 ? (
              <Vacio
                titulo={`No hay dias no laborables cargados para ${anioFestivos}`}
                texto="Use el boton de carga automatica para traer los festivos nacionales del ano."
                icono={<IconCalendario size={24} />}
              />
            ) : (
              <Table
                columnas={[
                  {
                    clave: 'fecha',
                    titulo: 'Fecha',
                    render: (f: string) => <span className="hg-t-sm">{formatearFecha(f, 'largo')}</span>,
                  },
                  {
                    clave: 'dia',
                    titulo: 'Dia de la semana',
                    render: (f) =>
                      new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: 'UTC' }).format(
                        new Date(`${f}T00:00:00Z`),
                      ),
                  },
                  {
                    clave: 'acciones',
                    titulo: '',
                    alineacion: 'derecha',
                    render: (f) => (
                      <Button
                        variante="ghost"
                        tamano="sm"
                        soloIcono
                        aria-label={`Quitar ${f}`}
                        icono={<IconEliminar size={15} />}
                        onClick={() =>
                          void guardarParams(
                            { ...parametros, festivos: parametros.festivos.filter((x) => x !== f) },
                            `Baja del dia no laborable ${f}`,
                          )
                        }
                      />
                    ),
                  },
                ]}
                filas={festivosDelAnio}
                claveDe={(f) => f}
              />
            )}
          </div>
        )}

        {pestana === 'datos' && (
          <div className="hg-pila">
            <Nota>
              Herramientas del entorno de trabajo. Los datos de prueba son sinteticos: reproducen la estructura
              del instrumento HIGEP V2 (28 actividades, 12 hitos, 13 riesgos, 9 recursos) y cinco cortes
              historicos por proyecto, no el contenido de ningun proyecto real.
            </Nota>

            <div className="hg-grid hg-grid--2">
              <div
                style={{
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-base)',
                  padding: 'var(--sp-md)',
                }}
              >
                <h3 className="hg-t-bold" style={{ fontSize: 'var(--fs-md)' }}>
                  Cargar datos de prueba
                </h3>
                <p className="hg-t-sm hg-t-sec" style={{ margin: '6px 0 var(--sp-md)' }}>
                  Crea catalogos, usuarios de los seis roles y cuatro proyectos con perfiles de desempeno distintos, si el sistema esta
                  vacio. No sobrescribe informacion existente.
                </p>
                <Button variante="primary" cargando={guardando} onClick={() => void sembrar()} icono={<IconMas size={15} />}>
                  Cargar datos de prueba
                </Button>
              </div>

              <div
                style={{
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  borderRadius: 'var(--r-base)',
                  padding: 'var(--sp-md)',
                }}
              >
                <h3 className="hg-t-bold" style={{ fontSize: 'var(--fs-md)', color: '#B91C1C' }}>
                  Reiniciar el entorno
                  <Pista texto="Borra proyectos, catalogos, usuarios y auditoria, y vuelve a sembrar los datos de prueba. Solo debe usarse en entornos de desarrollo o demostracion." />
                </h3>
                <p className="hg-t-sm" style={{ margin: '6px 0 var(--sp-md)', color: '#7F1D1D' }}>
                  Elimina <strong>toda</strong> la informacion, incluida la auditoria, y regenera los datos de
                  prueba. Accion irreversible.
                </p>
                <Button variante="danger" cargando={guardando} onClick={() => setConfirmarReinicio(true)} icono={<IconEliminar size={15} />}>
                  Eliminar todo y reiniciar
                </Button>
              </div>
            </div>

            <Table
              columnas={[
                { clave: 'k', titulo: 'Elemento', render: (r: { k: string; v: string }) => r.k },
                { clave: 'v', titulo: 'Valor', render: (r) => r.v },
              ]}
              filas={[
                { k: 'Fecha de hoy en el sistema', v: formatearFecha(hoyISO(), 'largo') },
                { k: 'Proyectos registrados', v: String(proyectosCount) },
                { k: 'Listas controladas', v: String(listas.length) },
                { k: 'Dias no laborables cargados', v: String(parametros.festivos.length) },
                {
                  k: 'Ultima actualizacion de parametros',
                  v: `${formatearFecha(parametros.actualizadoEn.slice(0, 10))} por ${parametros.actualizadoPor}`,
                },
              ]}
              claveDe={(r) => r.k}
            />
          </div>
        )}
      </Card>

      <Modal
        abierto={listaEnEdicion !== null}
        tamano="lg"
        titulo={listaEnEdicion?.nombre ?? ''}
        subtitulo={listaEnEdicion?.descripcion}
        onCerrar={() => setListaEnEdicion(null)}
        pie={
          listaEnEdicion?.editable ? (
            <>
              <Button variante="secondary" onClick={() => setListaEnEdicion(null)}>
                Cancelar
              </Button>
              <Button variante="primary" cargando={guardando} onClick={() => void guardarListaEditada()}>
                Guardar lista
              </Button>
            </>
          ) : (
            <Button variante="secondary" onClick={() => setListaEnEdicion(null)}>
              Cerrar
            </Button>
          )
        }
      >
        {listaEnEdicion && (
          <div className="hg-pila">
            {!listaEnEdicion.editable && (
              <Alert
                tipo="info"
                titulo="Lista gobernada por el motor de calculo"
                mensaje="Sus valores estan referenciados por las reglas de negocio. Modificarlos rompería los calculos, por eso es de solo lectura."
              />
            )}

            <div className="hg-pila" style={{ gap: 6 }}>
              {listaEnEdicion.valores
                .slice()
                .sort((a, b) => a.orden - b.orden)
                .map((v, i) => (
                  <div
                    key={v.valor}
                    className="hg-fila"
                    style={{
                      border: '1px solid var(--c-border)',
                      borderRadius: 'var(--r-base)',
                      padding: '6px var(--sp-sm)',
                      flexWrap: 'nowrap',
                    }}
                  >
                    <span className="hg-t-ter hg-t-num" style={{ width: 22 }}>
                      {i + 1}
                    </span>
                    <input
                      className="hg-input hg-input--sm"
                      style={{ flex: 1, minWidth: 120 }}
                      value={v.valor}
                      disabled={!listaEnEdicion.editable}
                      aria-label={`Valor ${i + 1}`}
                      onChange={(e) =>
                        setListaEnEdicion({
                          ...listaEnEdicion,
                          valores: listaEnEdicion.valores.map((x) =>
                            x.valor === v.valor ? { ...x, valor: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Checkbox
                      label="Activo"
                      checked={v.activo}
                      disabled={!listaEnEdicion.editable}
                      onChange={(e) =>
                        setListaEnEdicion({
                          ...listaEnEdicion,
                          valores: listaEnEdicion.valores.map((x) =>
                            x.valor === v.valor ? { ...x, activo: e.target.checked } : x,
                          ),
                        })
                      }
                    />
                    {listaEnEdicion.editable && (
                      <Button
                        variante="ghost"
                        tamano="sm"
                        soloIcono
                        aria-label={`Quitar ${v.valor}`}
                        title="Quitar el valor. Si ya se uso en registros, preferible desactivarlo."
                        icono={<IconEliminar size={15} />}
                        onClick={() =>
                          setListaEnEdicion({
                            ...listaEnEdicion,
                            valores: listaEnEdicion.valores
                              .filter((x) => x.valor !== v.valor)
                              .map((x, k) => ({ ...x, orden: k + 1 })),
                          })
                        }
                      />
                    )}
                  </div>
                ))}
            </div>

            {listaEnEdicion.editable && (
              <div className="hg-fila">
                <input
                  className="hg-input hg-input--sm"
                  style={{ flex: 1 }}
                  placeholder="Valor nuevo"
                  aria-label="Valor nuevo"
                  value={valorNuevo}
                  onChange={(e) => setValorNuevo(e.target.value)}
                />
                <Button
                  variante="secondary"
                  tamano="sm"
                  disabled={
                    !valorNuevo.trim() ||
                    listaEnEdicion.valores.some((v) => v.valor.toLowerCase() === valorNuevo.trim().toLowerCase())
                  }
                  onClick={() => {
                    setListaEnEdicion({
                      ...listaEnEdicion,
                      valores: [
                        ...listaEnEdicion.valores,
                        { valor: valorNuevo.trim(), activo: true, orden: listaEnEdicion.valores.length + 1 },
                      ],
                    })
                    setValorNuevo('')
                  }}
                >
                  Agregar valor
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={confirmarReinicio}
        titulo="Eliminar toda la informacion"
        mensaje={
          <>
            Se eliminaran <strong>todos</strong> los proyectos, catalogos, usuarios y el registro de auditoria,
            y se volveran a sembrar los datos de prueba. Esta accion no se puede deshacer y solo debe ejecutarse
            en entornos de desarrollo o demostracion.
          </>
        }
        textoConfirmar="Si, eliminar todo"
        onConfirmar={() => void reiniciar()}
        onCerrar={() => setConfirmarReinicio(false)}
      />

      <p className="hg-t-xs hg-t-ter" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <IconCatalogo size={13} />
        Los cambios de catalogo se aplican de inmediato a las validaciones y a los calculos de todos los
        proyectos.
      </p>
    </div>
  )
}
