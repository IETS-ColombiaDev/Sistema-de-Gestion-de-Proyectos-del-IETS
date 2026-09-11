/**
 * Auditoria del sistema — consulta transversal a todos los proyectos.
 * Disponible para administrador y auditor (HG-127).
 */

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import KPICard from '@/components/Dashboard/KPICard'
import Table from '@/components/ui/Table'
import { Input, Select } from '@/components/ui/Field'
import { Cargando, ErrorVista, Vacio } from '@/components/EstadoVista'
import { IconAuditoria, IconExportar } from '@/components/icons'
import { consultarAuditoria, listarProyectos } from '@/data/repo'
import { etiquetaCampo } from '@/data/auditoria'
import { exportarExcel } from '@/lib/exportar'
import { fechaHora } from '@/lib/formato'
import { useAuth } from '@/auth/AuthContext'
import { puede } from '@/auth/permisos'
import { TIPOS_CAMBIO, type EventoAuditoria, type Proyecto } from '@/domain/types'
import { COLUMNAS_AUDITORIA } from './AuditoriaProyecto'

export default function AuditoriaGlobal() {
  const { usuario } = useAuth()
  const [eventos, setEventos] = useState<EventoAuditoria[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [tipo, setTipo] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [desde, setDesde] = useState('')
  const [pagina, setPagina] = useState(1)
  const porPagina = 60

  useEffect(() => {
    void (async () => {
      const [e, p] = await Promise.all([consultarAuditoria(), listarProyectos()])
      setEventos(e)
      setProyectos(p)
      setCargando(false)
    })()
  }, [])

  const filtrados = useMemo(() => {
    const t = texto.toLowerCase().trim()
    return eventos.filter((e) => {
      if (tipo && e.tipoCambio !== tipo) return false
      if (proyectoId && e.proyectoId !== proyectoId) return false
      if (desde && e.fechaHora.slice(0, 10) < desde) return false
      if (t) {
        const heno = `${e.entidadEtiqueta} ${e.campo ?? ''} ${e.valorNuevo ?? ''} ${e.usuarioNombre}`.toLowerCase()
        if (!heno.includes(t)) return false
      }
      return true
    })
  }, [eventos, texto, tipo, proyectoId, desde])

  if (!puede(usuario?.rolGlobal ?? null, 'auditoria.ver')) {
    return (
      <ErrorVista
        titulo="Sin permiso para consultar la auditoria"
        detalle="La consulta del registro de auditoria esta restringida a los roles de administrador, auditor, lider y gestor."
      />
    )
  }

  if (cargando) return <Cargando />

  const pagina1 = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina)
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina))

  const columnas = [
    ...COLUMNAS_AUDITORIA.slice(0, 2),
    {
      clave: 'proyecto',
      titulo: 'Proyecto',
      ancho: '120px',
      render: (e: EventoAuditoria) => (
        <span className="hg-t-sm">
          {proyectos.find((p) => p.id === e.proyectoId)?.codigo ?? (e.proyectoId ? e.proyectoId : 'Sistema')}
        </span>
      ),
    },
    ...COLUMNAS_AUDITORIA.slice(2),
  ]

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Eventos en el sistema" valor={eventos.length} acento="#6366F1" />
        <KPICard etiqueta="Proyectos con actividad" valor={new Set(eventos.map((e) => e.proyectoId).filter(Boolean)).size} acento="#0891B2" />
        <KPICard etiqueta="Usuarios" valor={new Set(eventos.map((e) => e.usuarioUid)).size} acento="#CA8A04" />
        <KPICard
          etiqueta="Eventos de configuracion"
          valor={eventos.filter((e) => e.proyectoId === null).length}
          pie="Catalogos, parametros, usuarios y accesos"
          acento="#15803D"
        />
      </div>

      <Card
        titulo="Auditoria del sistema"
        subtitulo={`${filtrados.length} evento(s). El registro es inmutable y abarca todos los proyectos.`}
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
                      Proyecto: proyectos.find((p) => p.id === e.proyectoId)?.codigo ?? 'Sistema',
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
                'auditoria-sistema',
              )
            }
          >
            Exportar
          </Button>
        }
      >
        <div className="hg-barra-filtros" style={{ marginBottom: 'var(--sp-md)' }}>
          <Input
            label="Buscar"
            placeholder="Entidad, valor o usuario"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setPagina(1)
            }}
            style={{ minWidth: 220 }}
          />
          <Select
            label="Proyecto"
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            placeholder="Todos"
            opciones={proyectos.map((p) => ({ valor: p.id, etiqueta: `${p.codigo} · ${p.nombre}` }))}
          />
          <Select
            label="Tipo de cambio"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            placeholder="Todos"
            opciones={TIPOS_CAMBIO}
          />
          <Input label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        {filtrados.length === 0 ? (
          <Vacio titulo="Sin eventos que coincidan" texto="Ajuste los filtros de la consulta." icono={<IconAuditoria size={24} />} />
        ) : (
          <>
            <Table
              columnas={columnas}
              filas={pagina1}
              claveDe={(e) => e.id}
              anchoMinimo="1140px"
            />
            {totalPaginas > 1 && (
              <div className="hg-fila" style={{ justifyContent: 'center', marginTop: 'var(--sp-md)' }}>
                <Button variante="secondary" tamano="sm" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Button>
                <span className="hg-t-sm hg-t-sec">
                  Pagina {pagina} de {totalPaginas} · {fechaHora(pagina1[0]?.fechaHora ?? '')}
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
