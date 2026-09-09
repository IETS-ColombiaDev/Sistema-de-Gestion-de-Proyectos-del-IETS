/**
 * Listado de proyectos — HG-041, HG-047, HG-048, HG-049.
 * Muestra solo los proyectos a los que el usuario tiene acceso.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import Table, { type Columna } from '@/components/ui/Table'
import Modal, { ModalConfirmacion } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Cargando, ErrorVista, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { IconFicha, IconMas } from '@/components/icons'
import { useAuth } from '@/auth/AuthContext'
import { proyectosVisibles, puede, puedeEnProyecto } from '@/auth/permisos'
import { FASES_REFERENCIA } from '@/domain/catalogos'
import { formatearFecha, hoyISO, sumarDias } from '@/domain/fechas'
import { nuevoId, rutas } from '@/data/adapter'
import { obtenerAdaptador } from '@/data/backend'
import {
  eliminarEntidad,
  guardarEntidad,
  listarProyectos,
  listarVigentes,
  registrarEventoSimple,
} from '@/data/repo'
import { ESTADOS_PROYECTO, type Actividad, type Fase, type Hito, type Proyecto, type Riesgo } from '@/domain/types'

interface Borrador {
  codigo: string
  nombre: string
  tecnologiaObjeto: string
  entidadEjecutora: string
  financiador: string
  fechaInicio: string
  fechaEntregaFinal: string
}

const BORRADOR_INICIAL: Borrador = {
  codigo: '',
  nombre: '',
  tecnologiaObjeto: '',
  entidadEjecutora: 'Instituto de Evaluacion Tecnologica en Salud',
  financiador: '',
  fechaInicio: hoyISO(),
  fechaEntregaFinal: sumarDias(hoyISO(), 180),
}

export default function ListaProyectos() {
  const { usuario } = useAuth()
  const toast = useToast()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()

  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('')

  const [abierto, setAbierto] = useState(params.get('nuevo') === '1')
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_INICIAL)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const [aCerrar, setACerrar] = useState<Proyecto | null>(null)
  const [aEliminar, setAEliminar] = useState<Proyecto | null>(null)
  const [aDuplicar, setADuplicar] = useState<Proyecto | null>(null)
  const [codigoCopia, setCodigoCopia] = useState('')
  const [comentario, setComentario] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setProyectos(await listarProyectos())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const propios = proyectosVisibles(usuario, proyectos)
    return propios
      .filter((p) => {
        if (estado && p.estado !== estado) return false
        if (texto) {
          const t = texto.toLowerCase()
          if (!`${p.codigo} ${p.nombre} ${p.liderNombre}`.toLowerCase().includes(t)) return false
        }
        return true
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [proyectos, usuario, estado, texto])

  const validar = (b: Borrador): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!b.codigo.trim()) e.codigo = 'El codigo es obligatorio.'
    else if (proyectos.some((p) => p.codigo.toLowerCase() === b.codigo.trim().toLowerCase())) {
      e.codigo = 'Ya existe un proyecto con ese codigo. El codigo es unico en el sistema.'
    }
    if (!b.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (b.fechaEntregaFinal < b.fechaInicio) {
      e.fechaEntregaFinal = 'La fecha de entrega no puede ser anterior a la de inicio.'
    }
    return e
  }

  const crear = async () => {
    const e = validar(borrador)
    setErrores(e)
    if (Object.keys(e).length > 0) return
    setGuardando(true)
    try {
      const fases: Fase[] = FASES_REFERENCIA.map((nombre, i) => ({
        id: `f${i + 1}`,
        orden: i + 1,
        nombre,
        activa: true,
      }))
      const proyecto = await guardarEntidad<Proyecto>(
        rutas.proyectos(),
        {
          codigo: borrador.codigo.trim(),
          nombre: borrador.nombre.trim(),
          tecnologiaObjeto: borrador.tecnologiaObjeto,
          alcance: '',
          objetivoGeneral: '',
          objetivosEspecificos: [],
          marcoMetodologico: '',
          productosComprometidos: [],
          entidadEjecutora: borrador.entidadEjecutora,
          financiador: borrador.financiador,
          liderUid: usuario?.uid ?? null,
          liderNombre: usuario?.nombre ?? '',
          fechaInicio: borrador.fechaInicio,
          fechaEntregaFinal: borrador.fechaEntregaFinal,
          fechaCorte: hoyISO(),
          estado: 'borrador',
          fases,
          modoCalculo: 'saneado',
          accesos: usuario ? { [usuario.uid]: 'lider' } : {},
          moneda: 'COP',
        },
        {
          proyectoId: null,
          entidad: 'proyecto',
          etiqueta: `${borrador.codigo} · ${borrador.nombre}`,
          tipoCambio: 'Otro',
        },
      )
      toast.exito('Proyecto creado. Complete la ficha para activarlo.')
      setAbierto(false)
      setBorrador(BORRADOR_INICIAL)
      setParams({})
      navegar(`/proyectos/${proyecto.id}/ficha`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  /** HG-049: copia la estructura sin datos de ejecucion. */
  const duplicar = async () => {
    if (!aDuplicar) return
    if (!codigoCopia.trim()) return
    setGuardando(true)
    try {
      const ad = await obtenerAdaptador()
      const nuevo = await guardarEntidad<Proyecto>(
        rutas.proyectos(),
        {
          ...aDuplicar,
          id: undefined,
          codigo: codigoCopia.trim(),
          nombre: `${aDuplicar.nombre} (copia)`,
          estado: 'borrador',
          fechaCorte: hoyISO(),
          recalculoPendiente: true,
          recalculadoEn: undefined,
        },
        {
          proyectoId: null,
          entidad: 'proyecto',
          etiqueta: `${codigoCopia} · copia de ${aDuplicar.codigo}`,
          tipoCambio: 'Otro',
        },
      )

      const [acts, hitos, riesgos] = await Promise.all([
        listarVigentes<Actividad>(rutas.actividades(aDuplicar.id)),
        listarVigentes<Hito>(rutas.hitos(aDuplicar.id)),
        listarVigentes<Riesgo>(rutas.riesgos(aDuplicar.id)),
      ])

      const mapaAct = new Map<string, string>()
      const nuevasActs = acts.map((a) => {
        const id = nuevoId('act')
        mapaAct.set(a.id, id)
        return { ...a, id, proyectoId: nuevo.id, avance: 0 }
      })
      nuevasActs.forEach((a) => {
        a.predecesoras = a.predecesoras.map((p) => mapaAct.get(p) ?? '').filter(Boolean)
      })
      await ad.guardarLote(rutas.actividades(nuevo.id), nuevasActs as never[])

      await ad.guardarLote(
        rutas.hitos(nuevo.id),
        hitos.map((h) => ({
          ...h,
          id: nuevoId('hit'),
          proyectoId: nuevo.id,
          estado: 'Pendiente' as const,
          fechaReal: null,
          evidencias: [],
          actividadesIds: h.actividadesIds.map((x) => mapaAct.get(x) ?? '').filter(Boolean),
        })) as never[],
      )

      await ad.guardarLote(
        rutas.riesgos(nuevo.id),
        riesgos.map((r) => ({
          ...r,
          id: nuevoId('rsg'),
          proyectoId: nuevo.id,
          estado: 'Identificado' as const,
          historial: [],
        })) as never[],
      )

      await registrarEventoSimple(
        'crear',
        'proyecto',
        nuevo.codigo,
        nuevo.id,
        `Duplicado desde ${aDuplicar.codigo}: ${nuevasActs.length} actividades, ${hitos.length} hitos, ${riesgos.length} riesgos, sin datos de ejecucion.`,
      )

      toast.exito('Proyecto duplicado como plantilla.')
      setADuplicar(null)
      setCodigoCopia('')
      await cargar()
      navegar(`/proyectos/${nuevo.id}/ficha`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const cerrarProyecto = async () => {
    if (!aCerrar) return
    await guardarEntidad<Proyecto>(
      rutas.proyectos(),
      { id: aCerrar.id, estado: 'cerrado' },
      {
        proyectoId: aCerrar.id,
        entidad: 'proyecto',
        etiqueta: `${aCerrar.codigo} · ${aCerrar.nombre}`,
        tipoCambio: 'Decision',
        comentario,
      },
    )
    toast.exito('Proyecto cerrado. Queda en solo lectura.')
    setACerrar(null)
    setComentario('')
    await cargar()
  }

  const eliminarProyecto = async () => {
    if (!aEliminar) return
    await eliminarEntidad<Proyecto>(rutas.proyectos(), aEliminar.id, {
      proyectoId: aEliminar.id,
      entidad: 'proyecto',
      etiqueta: `${aEliminar.codigo} · ${aEliminar.nombre}`,
      tipoCambio: 'Decision',
      comentario,
    })
    toast.exito('Proyecto dado de baja. La informacion se conserva para auditoria.')
    setAEliminar(null)
    setComentario('')
    await cargar()
  }

  const columnas: Columna<Proyecto>[] = [
    {
      clave: 'codigo',
      titulo: 'Codigo',
      ordenable: true,
      render: (p) => (
        <Link to={`/proyectos/${p.id}/dashboard`} style={{ fontWeight: 600 }}>
          {p.codigo}
        </Link>
      ),
    },
    {
      clave: 'nombre',
      titulo: 'Nombre',
      ordenable: true,
      render: (p) => (
        <div style={{ minWidth: 240 }}>
          <div className="hg-t-sm">{p.nombre}</div>
          <div className="hg-t-xs hg-t-sec">{p.tecnologiaObjeto}</div>
        </div>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      ordenable: true,
      render: (p) => (
        <Badge
          fg={p.estado === 'activo' ? '#047857' : p.estado === 'cerrado' ? '#64748B' : '#92400E'}
          bg={p.estado === 'activo' ? '#D1FAE5' : p.estado === 'cerrado' ? '#F1F5F9' : '#FEF3C7'}
          punto
        >
          {p.estado}
        </Badge>
      ),
    },
    { clave: 'liderNombre', titulo: 'Lider', ordenable: true, render: (p) => p.liderNombre || '—' },
    {
      clave: 'vigencia',
      titulo: 'Vigencia',
      ordenable: true,
      valorOrden: (p) => p.fechaInicio,
      render: (p) => (
        <span className="hg-t-sm">
          {formatearFecha(p.fechaInicio)} — {formatearFecha(p.fechaEntregaFinal)}
        </span>
      ),
    },
    {
      clave: 'fechaCorte',
      titulo: 'Fecha de corte',
      ordenable: true,
      render: (p) => <span className="hg-t-sm">{formatearFecha(p.fechaCorte)}</span>,
    },
    {
      clave: 'acciones',
      titulo: '',
      alineacion: 'derecha',
      render: (p) => (
        <div className="hg-fila hg-fila--fin no-print">
          {puedeEnProyecto(usuario, p, 'proyecto.duplicar') && (
            <Button
              variante="ghost"
              tamano="sm"
              onClick={() => {
                setADuplicar(p)
                setCodigoCopia(`${p.codigo}-COPIA`)
              }}
            >
              Duplicar
            </Button>
          )}
          {p.estado !== 'cerrado' && puedeEnProyecto(usuario, p, 'proyecto.cerrar') && (
            <Button variante="ghost" tamano="sm" onClick={() => setACerrar(p)}>
              Cerrar
            </Button>
          )}
          {puede(usuario?.rolGlobal ?? null, 'proyecto.eliminar') && (
            <Button variante="ghost" tamano="sm" onClick={() => setAEliminar(p)}>
              Dar de baja
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (cargando) return <Cargando />
  if (error) return <ErrorVista titulo="No fue posible cargar los proyectos" detalle={error} />

  return (
    <div className="hg-pila">
      <Card
        titulo="Proyectos"
        subtitulo={`${visibles.length} proyecto(s) con acceso`}
        acciones={
          puede(usuario?.rolGlobal ?? null, 'proyecto.crear') && (
            <Button variante="primary" icono={<IconMas size={16} />} onClick={() => setAbierto(true)}>
              Nuevo proyecto
            </Button>
          )
        }
      >
        <div className="hg-barra-filtros" style={{ marginBottom: 'var(--sp-md)' }}>
          <Input
            label="Buscar"
            placeholder="Codigo, nombre o lider"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <Select
            label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            placeholder="Todos"
            opciones={ESTADOS_PROYECTO}
          />
        </div>

        {visibles.length === 0 ? (
          <Vacio
            titulo="No hay proyectos para mostrar"
            texto="Cree el primer proyecto o solicite acceso a un proyecto existente al administrador del sistema."
            icono={<IconFicha size={24} />}
            accion={
              puede(usuario?.rolGlobal ?? null, 'proyecto.crear') && (
                <Button variante="primary" onClick={() => setAbierto(true)}>
                  Crear proyecto
                </Button>
              )
            }
          />
        ) : (
          <Table columnas={columnas} filas={visibles} claveDe={(p) => p.id} />
        )}
      </Card>

      <Modal
        abierto={abierto}
        titulo="Nuevo proyecto"
        subtitulo="Codigo y nombre son obligatorios. El resto de la ficha se completa despues."
        onCerrar={() => {
          setAbierto(false)
          setParams({})
        }}
        pie={
          <>
            <Button variante="secondary" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void crear()} cargando={guardando}>
              Crear proyecto
            </Button>
          </>
        }
      >
        <div className="hg-grid hg-grid--form">
          <Input
            label="Codigo"
            requerido
            value={borrador.codigo}
            error={errores.codigo}
            ayuda="Identificador unico en el sistema."
            onChange={(e) => setBorrador({ ...borrador, codigo: e.target.value })}
          />
          <Input
            label="Nombre del proyecto"
            requerido
            anchoCompleto
            value={borrador.nombre}
            error={errores.nombre}
            onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          />
          <Textarea
            label="Tecnologia u objeto de evaluacion"
            anchoCompleto
            value={borrador.tecnologiaObjeto}
            onChange={(e) => setBorrador({ ...borrador, tecnologiaObjeto: e.target.value })}
          />
          <Input
            label="Entidad ejecutora"
            value={borrador.entidadEjecutora}
            onChange={(e) => setBorrador({ ...borrador, entidadEjecutora: e.target.value })}
          />
          <Input
            label="Financiador o contratante"
            value={borrador.financiador}
            onChange={(e) => setBorrador({ ...borrador, financiador: e.target.value })}
          />
          <Input
            label="Fecha de inicio"
            type="date"
            requerido
            value={borrador.fechaInicio}
            onChange={(e) => setBorrador({ ...borrador, fechaInicio: e.target.value })}
          />
          <Input
            label="Fecha de entrega final"
            type="date"
            requerido
            error={errores.fechaEntregaFinal}
            value={borrador.fechaEntregaFinal}
            onChange={(e) => setBorrador({ ...borrador, fechaEntregaFinal: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        abierto={Boolean(aDuplicar)}
        titulo="Duplicar proyecto como plantilla"
        subtitulo="Se copian actividades, hitos y riesgos. No se copian avances, fechas reales ni datos de ejecucion."
        onCerrar={() => setADuplicar(null)}
        pie={
          <>
            <Button variante="secondary" onClick={() => setADuplicar(null)}>
              Cancelar
            </Button>
            <Button variante="primary" onClick={() => void duplicar()} cargando={guardando}>
              Duplicar
            </Button>
          </>
        }
      >
        <Input
          label="Codigo del proyecto nuevo"
          requerido
          value={codigoCopia}
          onChange={(e) => setCodigoCopia(e.target.value)}
          ayuda={`Se creara a partir de ${aDuplicar?.codigo ?? ''}.`}
        />
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(aCerrar)}
        titulo="Cerrar el proyecto"
        mensaje={
          <>
            El proyecto <strong>{aCerrar?.codigo}</strong> pasara a solo lectura. Su contenido se conserva
            integro para consulta y auditoria; solo el administrador podra reabrirlo.
          </>
        }
        textoConfirmar="Cerrar proyecto"
        variante="primary"
        exigeComentario
        comentario={comentario}
        onComentario={setComentario}
        onConfirmar={() => void cerrarProyecto()}
        onCerrar={() => {
          setACerrar(null)
          setComentario('')
        }}
      />

      <ModalConfirmacion
        abierto={Boolean(aEliminar)}
        titulo="Dar de baja el proyecto"
        mensaje={
          <>
            El proyecto <strong>{aEliminar?.codigo}</strong> dejara de aparecer en los listados. Es una baja
            logica: la informacion y su auditoria se conservan y la accion es reversible.
          </>
        }
        textoConfirmar="Dar de baja"
        exigeComentario
        comentario={comentario}
        onComentario={setComentario}
        onConfirmar={() => void eliminarProyecto()}
        onCerrar={() => {
          setAEliminar(null)
          setComentario('')
        }}
      />
    </div>
  )
}
