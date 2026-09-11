/**
 * Auditoria del proyecto — EP-20.
 * Sustituye la hoja "Registro de actualizaciones", que era manual por diseno y
 * cuya automatizacion en Excel habria exigido macros. Aqui la trazabilidad es
 * automatica, inmutable y consultable.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Table, { type Columna } from '@/components/ui/Table'
import { Input, Select } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { IconAuditoria, IconCandado, IconExportar } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { consultarAuditoria } from '@/data/repo'
import { etiquetaCampo } from '@/data/auditoria'
import { exportarExcel } from '@/lib/exportar'
import { fechaHora, truncar } from '@/lib/formato'
import { TIPOS_CAMBIO, type EventoAuditoria } from '@/domain/types'

const COLOR_ACCION: Record<string, { fg: string; bg: string }> = {
  crear: { fg: '#047857', bg: '#D1FAE5' },
  actualizar: { fg: '#1D4ED8', bg: '#DBEAFE' },
  eliminar: { fg: '#B91C1C', bg: '#FEE2E2' },
  restaurar: { fg: '#0E7490', bg: '#CFFAFE' },
  calcular: { fg: '#4F46E5', bg: '#EEF2FF' },
  importar: { fg: '#92400E', bg: '#FEF3C7' },
  exportar: { fg: '#64748B', bg: '#F1F5F9' },
  acceso: { fg: '#64748B', bg: '#F1F5F9' },
}

/**
 * Columnas del registro de auditoria.
 *
 * Seis columnas, no nueve: el evento se lee como una frase —quien, cuando, que
 * hizo, sobre que, en que campo, de que valor a que valor— y para eso el cambio
 * va junto, no partido en dos columnas que compiten por el ancho. La
 * justificacion acompana a la entidad, que es su contexto natural.
 */
export const COLUMNAS_AUDITORIA: Columna<EventoAuditoria>[] = [
  {
    clave: 'fechaHora',
    titulo: 'Fecha y hora',
    ordenable: true,
    ancho: '132px',
    render: (e) => <span className="hg-t-sm hg-t-num">{fechaHora(e.fechaHora)}</span>,
  },
  {
    clave: 'usuarioNombre',
    titulo: 'Usuario',
    ordenable: true,
    ancho: '150px',
    render: (e) => <span className="hg-t-sm">{e.usuarioNombre}</span>,
  },
  {
    clave: 'accion',
    titulo: 'Accion',
    ordenable: true,
    ancho: '116px',
    render: (e) => {
      const c = COLOR_ACCION[e.accion] ?? { fg: '#64748B', bg: '#F1F5F9' }
      return (
        <Badge fg={c.fg} bg={c.bg} punto titulo={`Tipo de cambio: ${e.tipoCambio}`}>
          {e.accion}
        </Badge>
      )
    },
  },
  {
    clave: 'entidadEtiqueta',
    titulo: 'Entidad afectada',
    ordenable: true,
    render: (e) => (
      <div>
        <span className="hg-t-sm">{truncar(e.entidadEtiqueta, 70)}</span>
        <div className="hg-t-xs hg-t-ter">
          {e.entidad} · {e.tipoCambio}
        </div>
        {e.comentario && (
          <div className="hg-t-xs" style={{ color: '#92400E', marginTop: 2 }} title={e.comentario}>
            Justificacion: {truncar(e.comentario, 110)}
          </div>
        )}
      </div>
    ),
  },
  {
    clave: 'campo',
    titulo: 'Campo',
    ordenable: true,
    ancho: '140px',
    render: (e) => <span className="hg-t-sm">{etiquetaCampo(e.campo)}</span>,
  },
  {
    clave: 'cambio',
    titulo: 'Cambio',
    etiquetaMovil: 'Cambio',
    render: (e) => {
      if (e.valorAnterior == null && e.valorNuevo == null) {
        return <span className="hg-t-ter">—</span>
      }
      // Un alta no tiene valor anterior: se muestra el resumen sin la flecha.
      if (e.valorAnterior == null) {
        return (
          <span className="hg-t-xs" title={e.valorNuevo ?? ''}>
            {truncar(e.valorNuevo ?? '', 90)}
          </span>
        )
      }
      return (
        <span className="hg-t-xs" style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="hg-t-sec" style={{ textDecoration: 'line-through' }} title={e.valorAnterior}>
            {truncar(e.valorAnterior, 40)}
          </span>
          <span aria-hidden="true" className="hg-t-ter">
            →
          </span>
          <strong title={e.valorNuevo ?? ''}>{truncar(e.valorNuevo ?? '(vacio)', 40)}</strong>
          <span className="sr-only">
            cambio de {e.valorAnterior} a {e.valorNuevo}
          </span>
        </span>
      )
    },
  },
]

export default function AuditoriaProyecto() {
  const { datos, cargando } = useProyecto()
  const proyecto = datos?.proyecto

  const [eventos, setEventos] = useState<EventoAuditoria[]>([])
  const [cargandoEventos, setCargandoEventos] = useState(true)
  const [texto, setTexto] = useState('')
  const [tipo, setTipo] = useState('')
  const [entidad, setEntidad] = useState('')
  const [usuarioFiltro, setUsuarioFiltro] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const porPagina = 50

  const cargar = useCallback(async () => {
    if (!proyecto) return
    setCargandoEventos(true)
    setEventos(await consultarAuditoria({ proyectoId: proyecto.id }))
    setCargandoEventos(false)
  }, [proyecto])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const filtrados = useMemo(() => {
    const t = texto.toLowerCase().trim()
    return eventos.filter((e) => {
      if (tipo && e.tipoCambio !== tipo) return false
      if (entidad && e.entidad !== entidad) return false
      if (usuarioFiltro && e.usuarioNombre !== usuarioFiltro) return false
      if (desde && e.fechaHora.slice(0, 10) < desde) return false
      if (hasta && e.fechaHora.slice(0, 10) > hasta) return false
      if (t) {
        const heno = `${e.entidadEtiqueta} ${e.campo ?? ''} ${e.valorAnterior ?? ''} ${e.valorNuevo ?? ''} ${e.usuarioNombre} ${e.comentario ?? ''}`.toLowerCase()
        if (!heno.includes(t)) return false
      }
      return true
    })
  }, [eventos, texto, tipo, entidad, usuarioFiltro, desde, hasta])

  const entidades = useMemo(() => [...new Set(eventos.map((e) => e.entidad))].sort(), [eventos])
  const usuarios = useMemo(() => [...new Set(eventos.map((e) => e.usuarioNombre))].sort(), [eventos])

  const pagina1 = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina)
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina))

  if (cargando || !datos || !proyecto) return <Cargando />

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Eventos registrados" valor={eventos.length} acento="#6366F1" />
        <KPICard
          etiqueta="Con justificacion"
          valor={eventos.filter((e) => e.comentario).length}
          pie="Cambios sensibles documentados"
          acento="#0891B2"
        />
        <KPICard etiqueta="Usuarios que han escrito" valor={usuarios.length} acento="#CA8A04" />
        <KPICard
          etiqueta="Ultimo evento"
          valor={eventos[0] ? fechaHora(eventos[0].fechaHora).split(',')[0] : '—'}
          pie={eventos[0]?.usuarioNombre ?? ''}
          acento="#15803D"
        />
      </div>

      <Card
        titulo="Registro de auditoria"
        subtitulo={`${filtrados.length} evento(s) · el registro es append-only: ningun rol puede editarlo ni borrarlo.`}
        acciones={
          <Button
            variante="secondary"
            tamano="sm"
            icono={<IconExportar size={15} />}
            onClick={() =>
              exportarExcel(
                [
                  {
                    nombre: 'Auditoria',
                    filas: filtrados.map((e) => ({
                      'Fecha y hora': e.fechaHora,
                      Usuario: e.usuarioNombre,
                      Accion: e.accion,
                      'Tipo de cambio': e.tipoCambio,
                      Entidad: e.entidad,
                      'Entidad afectada': e.entidadEtiqueta,
                      Campo: etiquetaCampo(e.campo),
                      'Valor anterior': e.valorAnterior,
                      'Valor nuevo': e.valorNuevo,
                      Justificacion: e.comentario ?? '',
                    })),
                  },
                ],
                `auditoria-${proyecto.codigo}`,
              )
            }
          >
            Exportar
          </Button>
        }
      >
        <div
          className="hg-fila"
          style={{
            marginBottom: 'var(--sp-md)',
            padding: 'var(--sp-xs) var(--sp-sm)',
            background: 'var(--c-bg-hover)',
            borderRadius: 'var(--r-base)',
            color: 'var(--c-text-2)',
          }}
        >
          <IconCandado size={14} />
          <span className="hg-t-xs">
            Registro inmutable. Se conserva segun la politica de retencion institucional.
          </span>
        </div>

        <div className="hg-barra-filtros" style={{ marginBottom: 'var(--sp-md)' }}>
          <Input
            label="Buscar"
            placeholder="Entidad, valor o justificacion"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setPagina(1)
            }}
            style={{ minWidth: 220 }}
          />
          <Select
            label="Tipo de cambio"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            placeholder="Todos"
            opciones={TIPOS_CAMBIO}
          />
          <Select
            label="Entidad"
            value={entidad}
            onChange={(e) => setEntidad(e.target.value)}
            placeholder="Todas"
            opciones={entidades}
          />
          <Select
            label="Usuario"
            value={usuarioFiltro}
            onChange={(e) => setUsuarioFiltro(e.target.value)}
            placeholder="Todos"
            opciones={usuarios}
          />
          <Input label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <Input label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          {(texto || tipo || entidad || usuarioFiltro || desde || hasta) && (
            <Button
              variante="ghost"
              onClick={() => {
                setTexto('')
                setTipo('')
                setEntidad('')
                setUsuarioFiltro('')
                setDesde('')
                setHasta('')
                setPagina(1)
              }}
            >
              Limpiar
            </Button>
          )}
        </div>

        {cargandoEventos ? (
          <Cargando texto="Consultando la auditoria…" />
        ) : filtrados.length === 0 ? (
          <Vacio
            titulo="Sin eventos que coincidan"
            texto="Ajuste los filtros. Todo cambio sobre entidades de negocio genera al menos un evento."
            icono={<IconAuditoria size={24} />}
          />
        ) : (
          <>
            <Table
              columnas={COLUMNAS_AUDITORIA}
              filas={pagina1}
              claveDe={(e) => e.id}
              anchoMinimo="1020px"
            />
            {totalPaginas > 1 && (
              <div className="hg-fila" style={{ justifyContent: 'center', marginTop: 'var(--sp-md)' }}>
                <Button variante="secondary" tamano="sm" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Button>
                <span className="hg-t-sm hg-t-sec">
                  Pagina {pagina} de {totalPaginas}
                </span>
                <Button
                  variante="secondary"
                  tamano="sm"
                  disabled={pagina === totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
