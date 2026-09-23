/**
 * Entregas y evaluacion de calidad.
 *
 * El circuito tiene dos actores y esta deliberadamente separado:
 *
 *   el miembro del equipo  registra el enlace de su entregable
 *   el lider del proyecto  lo evalua contra una lista de chequeo
 *
 * El autor no puede evaluarse a si mismo (ver la matriz de permisos): si
 * pudiera, la lista de chequeo seria un formalismo. Y el puntaje no se teclea,
 * sale de la lista (ADR-03): una calificacion escrita a mano deja de medir lo
 * que la lista pregunta.
 */

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge, { BadgeEstado } from '@/components/Badge'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import Tabs from '@/components/Tabs'
import KPICard from '@/components/Dashboard/KPICard'
import { Pista, Nota } from '@/components/Ayuda'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { IconArchivo, IconCheck, IconMas } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { guardarEntidad, obtenerListasChequeo, rutas } from '@/data/repo'
import {
  UMBRAL_APROBACION,
  calificar,
  listaPara,
  resumirEntregas,
  revisarEnlace,
  veredictoDe,
  versionesDe,
} from '@/domain/entregas'
import { TIPOS_ENTREGA, type Entrega, type ListaChequeo, type ResultadoItem, type TipoEntrega } from '@/domain/types'
import { formatearFecha } from '@/domain/fechas'
import { ESTADO } from '@/components/charts/paleta'
import { fechaHora } from '@/lib/formato'

const HOY = () => new Date().toISOString().slice(0, 10)

export default function Entregas() {
  const { datos, resumen, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const [listas, setListas] = useState<ListaChequeo[]>([])
  const [vista, setVista] = useState<'pendientes' | 'todas'>('pendientes')
  const [registrando, setRegistrando] = useState<{ reemplaza: Entrega | null } | null>(null)
  const [evaluando, setEvaluando] = useState<Entrega | null>(null)
  const [historial, setHistorial] = useState<Entrega | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    void obtenerListasChequeo().then(setListas)
  }, [])

  const proyecto = datos?.proyecto ?? null
  const puedeRegistrar = puedeEnProyecto(usuario, proyecto, 'entregas.registrar')
  const puedeEvaluar = puedeEnProyecto(usuario, proyecto, 'entregas.evaluar')

  const resumenEntregas = useMemo(
    () => resumirEntregas(datos?.entregas ?? []),
    [datos],
  )

  if (cargando || !datos || !resumen || !proyecto) return <Cargando />

  const visibles =
    vista === 'pendientes'
      ? resumenEntregas.vigentes.filter((e) => e.evaluacion == null || e.estado === 'Devuelta')
      : resumenEntregas.vigentes

  // -------------------------------------------------------------------------
  // Registrar una entrega
  // -------------------------------------------------------------------------
  const registrar = async (form: {
    titulo: string
    tipo: TipoEntrega
    enlace: string
    actividadId: string
    notaDelAutor: string
  }) => {
    const revision = revisarEnlace(form.enlace)
    if (!revision.valido) {
      toast.error(revision.motivo ?? 'El enlace no es valido.')
      return
    }
    const reemplaza = registrando?.reemplaza ?? null
    const miembro = datos.equipo.find(
      (m) => m.usuarioUid === usuario?.uid || m.nombre === usuario?.nombre,
    )
    setGuardando(true)
    try {
      await guardarEntidad<Entrega>(
        rutas.entregas(proyecto.id),
        {
          proyectoId: proyecto.id,
          actividadId: form.actividadId || null,
          productoId: null,
          tipo: form.tipo,
          titulo: form.titulo.trim(),
          enlace: form.enlace.trim(),
          entregadoPor: miembro?.id ?? usuario?.uid ?? '',
          entregadoPorNombre: miembro?.nombre || usuario?.nombre || 'Sin identificar',
          fechaEntrega: HOY(),
          version: (reemplaza?.version ?? 0) + 1,
          reemplazaA: reemplaza?.id ?? null,
          estado: 'Entregada',
          notaDelAutor: form.notaDelAutor.trim() || undefined,
          evaluacion: null,
        },
        { proyectoId: proyecto.id, entidad: 'entrega', etiqueta: form.titulo, tipoCambio: 'Entrega' },
      )
      toast.exito(
        reemplaza
          ? `Version ${(reemplaza.version ?? 0) + 1} registrada. La anterior queda en el historial.`
          : 'Entrega registrada. El lider la vera en su lista de pendientes.',
      )
      setRegistrando(null)
      await recargar()
    } finally {
      setGuardando(false)
    }
  }

  // -------------------------------------------------------------------------
  // Evaluar
  // -------------------------------------------------------------------------
  const evaluar = async (
    entrega: Entrega,
    lista: ListaChequeo,
    resultados: ResultadoItem[],
    comentario: string,
  ) => {
    const c = calificar(lista.items, resultados)
    const veredicto = veredictoDe(c)
    setGuardando(true)
    try {
      await guardarEntidad<Entrega>(
        rutas.entregas(proyecto.id),
        {
          id: entrega.id,
          estado: veredicto,
          evaluacion: {
            evaluadaPor: usuario?.uid ?? '',
            evaluadaPorNombre: usuario?.nombre ?? '',
            evaluadaEn: new Date().toISOString(),
            listaId: lista.id,
            resultados,
            puntaje: c.puntaje,
            veredicto,
            comentario: comentario.trim(),
          },
        },
        { proyectoId: proyecto.id, entidad: 'entrega', etiqueta: entrega.titulo, tipoCambio: 'Entrega' },
      )
      toast.exito(`Evaluacion guardada: ${veredicto.toLowerCase()} con ${c.puntaje} puntos.`)
      setEvaluando(null)
      await recargar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Entregas vigentes"
          valor={`${resumenEntregas.total}`}
          pie="Ultima version de cada entregable"
          acento="#6366F1"
          pista="Una entrega devuelta y vuelta a entregar cuenta una sola vez: es un problema que ya se atendio, no dos. Las versiones anteriores siguen en el historial."
        />
        <KPICard
          etiqueta="Por evaluar"
          valor={`${resumenEntregas.pendientesDeEvaluar}`}
          color={resumenEntregas.pendientesDeEvaluar > 0 ? ESTADO.advertencia : ESTADO.bueno}
          acento={ESTADO.advertencia}
          pie="Esperan revision del lider"
          pista="Entregas registradas que todavia nadie ha revisado contra la lista de chequeo."
        />
        <KPICard
          etiqueta="Devueltas"
          valor={`${resumenEntregas.devueltas}`}
          color={resumenEntregas.devueltas > 0 ? ESTADO.critico : ESTADO.bueno}
          acento={ESTADO.critico}
          pie="Requieren una version nueva"
          pista="Se devuelve cuando falla un item obligatorio o el puntaje queda por debajo del umbral."
        />
        <KPICard
          etiqueta="Puntaje medio"
          valor={resumenEntregas.puntajeMedio == null ? '—' : `${resumenEntregas.puntajeMedio}`}
          pie={
            resumenEntregas.puntajeMedio == null
              ? 'Aun no hay nada evaluado'
              : `Umbral de aprobacion: ${UMBRAL_APROBACION}`
          }
          acento="#0891B2"
          pista="Promedio del puntaje de las entregas evaluadas. El puntaje sale de la lista de chequeo; no se escribe a mano."
        />
      </div>

      <Card
        titulo="Entregas del proyecto"
        subtitulo="El miembro del equipo registra el enlace en OneDrive; el lider lo evalua contra la lista de chequeo del tipo de entrega."
        acciones={
          <>
            <Tabs
              opciones={[
                { valor: 'pendientes', etiqueta: 'Requieren accion', conteo: resumenEntregas.pendientesDeEvaluar + resumenEntregas.devueltas },
                { valor: 'todas', etiqueta: 'Todas', conteo: resumenEntregas.total },
              ]}
              activa={vista}
              onCambiar={(v) => setVista(v as typeof vista)}
              etiquetaAria="Filtrar entregas"
            />
            {puedeRegistrar && (
              <Button
                variante="primary"
                tamano="sm"
                icono={<IconMas size={15} />}
                onClick={() => setRegistrando({ reemplaza: null })}
              >
                Registrar entrega
              </Button>
            )}
          </>
        }
      >
        {visibles.length === 0 ? (
          <Vacio
            titulo={vista === 'pendientes' ? 'Nada pendiente' : 'Sin entregas registradas'}
            texto={
              vista === 'pendientes'
                ? 'Ninguna entrega espera evaluacion ni fue devuelta.'
                : 'Cuando un miembro del equipo registre el enlace de un entregable, aparecera aqui.'
            }
            icono={<IconCheck size={24} />}
          />
        ) : (
          <Table
            anchoMinimo="900px"
            columnas={[
              {
                clave: 'titulo',
                titulo: 'Entregable',
                render: (e: Entrega) => (
                  <div style={{ minWidth: 0 }}>
                    <div className="hg-fila" style={{ gap: 6 }}>
                      <span className="hg-t-sm hg-t-bold">{e.titulo}</span>
                      {e.version > 1 && (
                        <Badge fg="#4338CA" bg="#E0E7FF" titulo="Numero de version">
                          v{e.version}
                        </Badge>
                      )}
                    </div>
                    <div className="hg-t-xs hg-t-ter">
                      {e.tipo} · {e.entregadoPorNombre} · {formatearFecha(e.fechaEntrega)}
                    </div>
                  </div>
                ),
              },
              {
                clave: 'enlace',
                titulo: 'Enlace',
                render: (e: Entrega) => (
                  <a
                    href={e.enlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hg-btn hg-btn--ghost hg-btn--sm"
                    title="Abre el entregable en el repositorio institucional, en otra pestana"
                  >
                    <IconArchivo size={14} /> Abrir
                  </a>
                ),
              },
              {
                clave: 'estado',
                titulo: 'Estado',
                render: (e: Entrega) => <BadgeEstado familia="entrega" valor={e.estado} />,
              },
              {
                clave: 'puntaje',
                titulo: 'Puntaje',
                alineacion: 'derecha',
                pista: 'Porcentaje de items cumplidos de la lista de chequeo. Se calcula, no se escribe a mano.',
                render: (e: Entrega) =>
                  e.evaluacion == null ? (
                    <span className="hg-t-ter">—</span>
                  ) : (
                    <strong
                      className="hg-t-num"
                      style={{
                        color:
                          e.evaluacion.puntaje >= UMBRAL_APROBACION ? ESTADO.bueno : ESTADO.critico,
                      }}
                    >
                      {e.evaluacion.puntaje}
                    </strong>
                  ),
              },
              {
                clave: 'acciones',
                titulo: '',
                render: (e: Entrega) => (
                  <div className="hg-fila no-print" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    {e.version > 1 && (
                      <Button variante="ghost" tamano="sm" onClick={() => setHistorial(e)}>
                        Historial
                      </Button>
                    )}
                    {puedeEvaluar && (
                      <Button variante="secondary" tamano="sm" onClick={() => setEvaluando(e)}>
                        {e.evaluacion ? 'Ver evaluacion' : 'Evaluar'}
                      </Button>
                    )}
                    {puedeRegistrar && e.estado === 'Devuelta' && (
                      <Button
                        variante="primary"
                        tamano="sm"
                        onClick={() => setRegistrando({ reemplaza: e })}
                      >
                        Nueva version
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            filas={visibles}
            claveDe={(e) => e.id}
            claseFila={(e) => (e.estado === 'Devuelta' ? 'hg-fila--critica' : '')}
          />
        )}

        <Nota>
          El sistema guarda el <strong>enlace</strong>, no una copia del archivo. El entregable vive en
          el repositorio institucional, que es donde la entidad controla permisos, versiones y
          retencion; copiarlo aqui crearia una segunda version de la verdad.
        </Nota>
      </Card>

      {registrando && (
        <ModalRegistro
          reemplaza={registrando.reemplaza}
          actividades={resumen.actividades.filter((a) => !a.vacia)}
          guardando={guardando}
          onCerrar={() => setRegistrando(null)}
          onGuardar={registrar}
        />
      )}

      {evaluando && (
        <ModalEvaluacion
          entrega={evaluando}
          lista={listaPara(evaluando.tipo, listas)}
          soloLectura={!puedeEvaluar}
          guardando={guardando}
          onCerrar={() => setEvaluando(null)}
          onGuardar={(lista, resultados, comentario) =>
            evaluar(evaluando, lista, resultados, comentario)
          }
        />
      )}

      {historial && (
        <Modal
          abierto
          titulo={`Historial · ${historial.titulo}`}
          onCerrar={() => setHistorial(null)}
          tamano="md"
        >
          <ol className="hg-pila" style={{ gap: 'var(--sp-sm)', paddingLeft: 0, listStyle: 'none' }}>
            {versionesDe(historial, datos.entregas).map((v) => (
              <li key={v.id} className="hg-card hg-card--plano" style={{ padding: 'var(--sp-md)' }}>
                <div className="hg-fila" style={{ justifyContent: 'space-between' }}>
                  <span className="hg-t-sm hg-t-bold">Version {v.version}</span>
                  <BadgeEstado familia="entrega" valor={v.estado} />
                </div>
                <div className="hg-t-xs hg-t-sec">
                  Entregada el {formatearFecha(v.fechaEntrega)} por {v.entregadoPorNombre}
                </div>
                {v.evaluacion && (
                  <div className="hg-t-xs hg-t-sec" style={{ marginTop: 4 }}>
                    {v.evaluacion.puntaje} puntos · evaluada por {v.evaluacion.evaluadaPorNombre} el{' '}
                    {fechaHora(v.evaluacion.evaluadaEn)}
                    {v.evaluacion.comentario && <> · “{v.evaluacion.comentario}”</>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal: registrar entrega
// ---------------------------------------------------------------------------

function ModalRegistro({
  reemplaza,
  actividades,
  guardando,
  onCerrar,
  onGuardar,
}: {
  reemplaza: Entrega | null
  actividades: { id: string; numero: number; nombre: string }[]
  guardando: boolean
  onCerrar: () => void
  onGuardar: (f: {
    titulo: string
    tipo: TipoEntrega
    enlace: string
    actividadId: string
    notaDelAutor: string
  }) => void
}) {
  const [titulo, setTitulo] = useState(reemplaza?.titulo ?? '')
  const [tipo, setTipo] = useState<TipoEntrega>(reemplaza?.tipo ?? 'Entregable')
  const [enlace, setEnlace] = useState('')
  const [actividadId, setActividadId] = useState(reemplaza?.actividadId ?? '')
  const [nota, setNota] = useState('')

  // La revision del enlace se muestra mientras se escribe: decirle al usuario
  // que el enlace no sirve DESPUES de pulsar guardar es hacerle perder el paso.
  const revision = enlace.trim() ? revisarEnlace(enlace) : null
  const listo = titulo.trim().length > 2 && revision?.valido === true

  return (
    <Modal
      abierto
      titulo={reemplaza ? `Nueva version de “${reemplaza.titulo}”` : 'Registrar entrega'}
      onCerrar={onCerrar}
      tamano="md"
      pie={
        <>
          <Button variante="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variante="primary"
            disabled={!listo}
            cargando={guardando}
            onClick={() => onGuardar({ titulo, tipo, enlace, actividadId, notaDelAutor: nota })}
          >
            {reemplaza ? 'Registrar nueva version' : 'Registrar entrega'}
          </Button>
        </>
      }
    >
      {reemplaza?.evaluacion && (
        <Nota>
          La version anterior fue devuelta con {reemplaza.evaluacion.puntaje} puntos:{' '}
          “{reemplaza.evaluacion.comentario}”. La version anterior no se borra: queda en el historial
          para poder ver si el entregable mejoro.
        </Nota>
      )}

      <Input
        label="Titulo del entregable"
        requerido
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Informe preliminar de evaluacion"
      />

      <div className="hg-grid hg-grid--form">
        <Select
          label="Tipo de entrega"
          ayuda="Determina la lista de chequeo con la que se evalua. A una encuesta se le revisan cosas distintas que a un informe."
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoEntrega)}
        >
          {TIPOS_ENTREGA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>

        <Select
          label="Actividad del cronograma"
          ayuda="Opcional. Vincula la entrega con la actividad que la produce."
          value={actividadId}
          onChange={(e) => setActividadId(e.target.value)}
        >
          <option value="">Sin vincular</option>
          {actividades.map((a) => (
            <option key={a.id} value={a.id}>
              {a.numero}. {a.nombre}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Enlace en OneDrive o SharePoint"
        requerido
        ayuda="Use el boton Compartir del archivo y pegue aqui el enlace. Verifique que el destinatario tenga permiso de lectura."
        error={revision && !revision.valido ? revision.motivo : undefined}
        value={enlace}
        onChange={(e) => setEnlace(e.target.value)}
        placeholder="https://...sharepoint.com/..."
        inputMode="url"
      />
      {revision?.valido && (
        <p className="hg-t-xs" style={{ color: ESTADO.bueno, marginTop: -6 }}>
          Enlace del repositorio institucional reconocido ({revision.dominio}).
        </p>
      )}

      <Textarea
        label="Nota para quien evalua"
        ayuda="Opcional. Que mirar primero, que quedo fuera de alcance, que sigue pendiente."
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={3}
      />
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Modal: evaluar
// ---------------------------------------------------------------------------

function ModalEvaluacion({
  entrega,
  lista,
  soloLectura,
  guardando,
  onCerrar,
  onGuardar,
}: {
  entrega: Entrega
  lista: ListaChequeo | null
  soloLectura: boolean
  guardando: boolean
  onCerrar: () => void
  onGuardar: (lista: ListaChequeo, resultados: ResultadoItem[], comentario: string) => void
}) {
  const [resultados, setResultados] = useState<ResultadoItem[]>(
    entrega.evaluacion?.resultados ?? [],
  )
  const [comentario, setComentario] = useState(entrega.evaluacion?.comentario ?? '')

  if (!lista) {
    return (
      <Modal abierto titulo="Sin lista de chequeo" onCerrar={onCerrar} tamano="md">
        <Vacio
          titulo={`No hay lista activa para “${entrega.tipo}”`}
          texto="Un administrador puede crear o reactivar la lista en Catalogos y parametros. Sin lista no se puede evaluar: el puntaje sale de ella."
        />
      </Modal>
    )
  }

  const marcar = (itemId: string, cumple: boolean | null) =>
    setResultados((prev) => {
      const resto = prev.filter((r) => r.itemId !== itemId)
      const previo = prev.find((r) => r.itemId === itemId)
      return [...resto, { itemId, cumple, observacion: previo?.observacion }]
    })

  const observar = (itemId: string, observacion: string) =>
    setResultados((prev) => {
      const previo = prev.find((r) => r.itemId === itemId)
      return [
        ...prev.filter((r) => r.itemId !== itemId),
        { itemId, cumple: previo?.cumple ?? null, observacion },
      ]
    })

  const c = calificar(lista.items, resultados)
  const veredicto = veredictoDe(c)
  const colorVeredicto =
    veredicto === 'Aprobada' ? ESTADO.bueno : veredicto === 'Devuelta' ? ESTADO.critico : ESTADO.advertencia

  return (
    <Modal
      abierto
      titulo={`Evaluar · ${entrega.titulo}`}
      onCerrar={onCerrar}
      tamano="lg"
      pie={
        <>
          <Button variante="ghost" onClick={onCerrar}>
            {soloLectura ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!soloLectura && (
            <Button
              variante="primary"
              disabled={!c.completa}
              cargando={guardando}
              onClick={() => onGuardar(lista, resultados, comentario)}
              title={
                c.completa
                  ? undefined
                  : 'Revise todos los items antes de guardar: dejar uno en blanco no es lo mismo que darlo por incumplido.'
              }
            >
              Guardar evaluacion
            </Button>
          )}
        </>
      }
    >
      <div className="hg-fila" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-sm)' }}>
        <div className="hg-t-sm hg-t-sec">
          {entrega.tipo} · {entrega.entregadoPorNombre} · version {entrega.version}
          <a
            href={entrega.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="hg-btn hg-btn--ghost hg-btn--sm"
            style={{ marginLeft: 'var(--sp-xs)' }}
          >
            <IconArchivo size={14} /> Abrir entregable
          </a>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="hg-etiqueta">
            Puntaje
            <Pista texto="Se calcula sobre los items ya revisados: los items en blanco no cuentan como incumplidos. No es editable." />
          </span>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: colorVeredicto, lineHeight: 1.1 }}>
            {c.puntaje}
          </div>
          <span className="hg-t-xs hg-t-sec">
            {c.revisados} de {c.total} revisados
          </span>
        </div>
      </div>

      {entrega.notaDelAutor && (
        <Nota>Nota de quien entrega: “{entrega.notaDelAutor}”</Nota>
      )}

      <div className="hg-pila" style={{ gap: 6, marginTop: 'var(--sp-md)' }}>
        {lista.items.map((item) => {
          const r = resultados.find((x) => x.itemId === item.id)
          return (
            <div key={item.id} className="hg-chequeo">
              <div className="hg-chequeo__texto">
                <span className="hg-t-sm">
                  {item.texto}
                  {item.obligatorio && (
                    <Badge fg="#9A3412" bg="#FFEDD5" titulo="Si este item no se cumple, la entrega se devuelve aunque el puntaje sea alto">
                      obligatorio
                    </Badge>
                  )}
                  {item.ayuda && <Pista texto={item.ayuda} />}
                </span>
                {r?.cumple === false && !soloLectura && (
                  <Input
                    value={r.observacion ?? ''}
                    onChange={(e) => observar(item.id, e.target.value)}
                    placeholder="Que falta, en concreto"
                    aria-label={`Observacion para: ${item.texto}`}
                  />
                )}
                {r?.cumple === false && soloLectura && r.observacion && (
                  <span className="hg-t-xs hg-t-sec">{r.observacion}</span>
                )}
              </div>
              <div className="hg-chequeo__opciones no-print" role="group" aria-label={item.texto}>
                <button
                  type="button"
                  disabled={soloLectura}
                  aria-pressed={r?.cumple === true}
                  className={`hg-chequeo__boton${r?.cumple === true ? ' hg-chequeo__boton--si' : ''}`}
                  onClick={() => marcar(item.id, r?.cumple === true ? null : true)}
                >
                  Cumple
                </button>
                <button
                  type="button"
                  disabled={soloLectura}
                  aria-pressed={r?.cumple === false}
                  className={`hg-chequeo__boton${r?.cumple === false ? ' hg-chequeo__boton--no' : ''}`}
                  onClick={() => marcar(item.id, r?.cumple === false ? null : false)}
                >
                  No cumple
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="hg-veredicto"
        style={{ borderLeftColor: colorVeredicto, marginTop: 'var(--sp-md)' }}
      >
        <span className="hg-etiqueta">Veredicto</span>
        <div className="hg-t-bold" style={{ color: colorVeredicto }}>
          {c.completa ? veredicto : 'Evaluacion incompleta'}
        </div>
        <p className="hg-t-sm hg-t-sec" style={{ margin: 0 }}>
          {!c.completa
            ? `Faltan ${c.total - c.revisados} item(s) por revisar. Dejar uno en blanco no es lo mismo que darlo por incumplido.`
            : c.obligatoriosIncumplidos.length > 0
              ? `Se devuelve porque ${c.obligatoriosIncumplidos.length} item(s) obligatorio(s) no se cumplen, aunque el puntaje sea ${c.puntaje}.`
              : c.puntaje < UMBRAL_APROBACION
                ? `Se devuelve porque el puntaje (${c.puntaje}) esta por debajo del umbral de ${UMBRAL_APROBACION}.`
                : c.puntaje < 100
                  ? 'Se aprueba con observaciones: hay items sin cumplir, pero ninguno obligatorio.'
                  : 'Se aprueba sin observaciones: la lista se cumple por completo.'}
        </p>
      </div>

      <Textarea
        label="Comentario del evaluador"
        ayuda="El veredicto lo fija la lista de chequeo; aqui va su criterio, el contexto y que espera de la siguiente version."
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={3}
        disabled={soloLectura}
      />

      {entrega.evaluacion && (
        <p className="hg-t-xs hg-t-sec">
          Evaluada por {entrega.evaluacion.evaluadaPorNombre} el {fechaHora(entrega.evaluacion.evaluadaEn)}.
        </p>
      )}
    </Modal>
  )
}
