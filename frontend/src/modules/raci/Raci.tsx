/**
 * Matriz RACI — EP-12.
 *
 * Corrige dos defectos del libro:
 *  - D-12: las actividades y los actores ya no se transcriben a mano; provienen
 *    del cronograma y del equipo, sin limite de ocho columnas;
 *  - D-13: la alerta de integridad se aplica sobre la propia celda de conteo.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Tabs from '@/components/Tabs'
import Table from '@/components/ui/Table'
import { Select } from '@/components/ui/Field'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import { IconExportar, IconRaci } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { eliminarEntidad, guardarEntidad } from '@/data/repo'
import { rutas } from '@/data/adapter'
import { exportarExcel } from '@/lib/exportar'
import { ROLES_RACI, type AsignacionRaci, type LetraRaci } from '@/domain/types'

const COLOR_LETRA: Record<LetraRaci, { fg: string; bg: string; nombre: string }> = {
  R: { fg: '#4F46E5', bg: '#EEF2FF', nombre: 'Responsable de ejecutar' },
  A: { fg: '#B45309', bg: '#FEF3C7', nombre: 'Responsable final (rinde cuentas)' },
  C: { fg: '#0E7490', bg: '#CFFAFE', nombre: 'Consultado' },
  I: { fg: '#64748B', bg: '#F1F5F9', nombre: 'Informado' },
}

type Vista = 'matriz' | 'integridad' | 'persona'

export default function Raci() {
  const { datos, resumen, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const proyecto = datos?.proyecto
  const editable = puedeEnProyecto(usuario, proyecto ?? null, 'raci.editar')

  const [vista, setVista] = useState<Vista>('matriz')
  const [personaId, setPersonaId] = useState('')
  const [guardando, setGuardando] = useState(false)

  const asignaciones = useMemo(() => {
    const mapa = new Map<string, AsignacionRaci>()
    for (const a of datos?.raci ?? []) mapa.set(`${a.actividadId}::${a.miembroId}`, a)
    return mapa
  }, [datos])

  const actividades = useMemo(
    () => (resumen?.actividades ?? []).filter((a) => !a.vacia).sort((a, b) => a.orden - b.orden),
    [resumen],
  )

  if (cargando || !datos || !resumen || !proyecto) return <Cargando />

  const equipo = datos.equipo

  const cambiar = async (actividadId: string, miembroId: string, letra: LetraRaci | '') => {
    if (!editable) return
    setGuardando(true)
    const clave = `${actividadId}::${miembroId}`
    const existente = asignaciones.get(clave)
    const actividad = datos.actividades.find((a) => a.id === actividadId)
    const miembro = equipo.find((m) => m.id === miembroId)
    const etiqueta = `${actividad?.nombre ?? ''} · ${miembro?.nombre || miembro?.perfil || ''}`

    try {
      if (!letra) {
        if (existente) {
          await eliminarEntidad<AsignacionRaci>(rutas.raci(proyecto.id), existente.id, {
            proyectoId: proyecto.id,
            entidad: 'raci',
            etiqueta,
            tipoCambio: 'Otro',
          })
        }
      } else {
        await guardarEntidad<AsignacionRaci>(
          rutas.raci(proyecto.id),
          { ...(existente ?? {}), proyectoId: proyecto.id, actividadId, miembroId, letra, eliminado: false },
          { proyectoId: proyecto.id, entidad: 'raci', etiqueta, tipoCambio: 'Otro' },
        )
      }
      await recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const noConformes = resumen.raci.filter((r) => !r.conforme)

  const exportar = () =>
    exportarExcel(
      [
        {
          nombre: 'Matriz RACI',
          filas: actividades.map((a) => {
            const fila: Record<string, unknown> = { '#': a.numero, Actividad: a.nombre }
            for (const m of equipo) {
              fila[m.nombre || m.perfil] = asignaciones.get(`${a.id}::${m.id}`)?.letra ?? ''
            }
            fila['Conteo A'] = resumen.raci.find((r) => r.actividadId === a.id)?.conteoA ?? 0
            return fila
          }),
        },
        {
          nombre: 'Integridad',
          filas: resumen.raci.map((r) => ({
            Actividad: r.actividadNombre,
            'Conteo A': r.conteoA,
            'Conteo R': r.conteoR,
            Conforme: r.conforme ? 'Si' : 'No',
            Problema: r.problema,
          })),
        },
      ],
      `raci-${proyecto.codigo}`,
    )

  if (equipo.length === 0 || actividades.length === 0) {
    return (
      <Card titulo="Matriz RACI">
        <Vacio
          titulo="Faltan insumos para construir la matriz"
          texto="La matriz se arma con las actividades del cronograma y los integrantes del equipo. Registre ambos y vuelva aqui: no hay transcripcion manual."
          icono={<IconRaci size={24} />}
          accion={
            <div className="hg-fila">
              <Button variante="secondary">
                <Link to={`/proyectos/${proyecto.id}/equipo`}>Ir al equipo</Link>
              </Button>
              <Button variante="primary">
                <Link to={`/proyectos/${proyecto.id}/cronograma`} style={{ color: '#fff' }}>
                  Ir al cronograma
                </Link>
              </Button>
            </div>
          }
        />
      </Card>
    )
  }

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard etiqueta="Actividades en la matriz" valor={actividades.length} acento="#6366F1" />
        <KPICard etiqueta="Actores" valor={equipo.length} pie="Tomados del equipo del proyecto" acento="#0891B2" />
        <KPICard
          etiqueta="Actividades conformes"
          valor={resumen.raci.filter((r) => r.conforme).length}
          pie="Exactamente una A y al menos una R"
          color="#10B981"
          acento="#15803D"
        />
        <KPICard
          etiqueta="Incumplimientos"
          valor={noConformes.length}
          color={noConformes.length > 0 ? '#EF4444' : undefined}
          onClick={() => setVista('integridad')}
          titulo="Ver el panel de integridad"
          acento="#EF4444"
        />
      </div>

      <Card
        titulo="Matriz de responsabilidades"
        subtitulo="R ejecuta · A rinde cuentas (una sola por actividad) · C es consultado · I es informado."
        acciones={
          <>
            <Tabs
              opciones={[
                { valor: 'matriz', etiqueta: 'Matriz' },
                { valor: 'integridad', etiqueta: 'Integridad', conteo: noConformes.length },
                { valor: 'persona', etiqueta: 'Por persona' },
              ]}
              activa={vista}
              onCambiar={(v) => setVista(v as Vista)}
              etiquetaAria="Vista de la matriz RACI"
            />
            <Button variante="secondary" tamano="sm" icono={<IconExportar size={15} />} onClick={exportar}>
              Exportar
            </Button>
          </>
        }
      >
        {vista === 'matriz' && (
          <div className="hg-tabla-wrap scroll-discreto">
            <table className="hg-tabla">
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 3, minWidth: 260 }}>Actividad</th>
                  {equipo.map((m) => (
                    <th key={m.id} className="hg-centro" style={{ minWidth: 76 }} title={m.perfil}>
                      {(m.nombre || m.perfil).split(' ').slice(0, 2).join(' ')}
                    </th>
                  ))}
                  <th className="hg-centro" style={{ minWidth: 60 }} title="Conteo de responsables finales (A)">
                    A
                  </th>
                </tr>
              </thead>
              <tbody>
                {actividades.map((a) => {
                  const integridad = resumen.raci.find((r) => r.actividadId === a.id)
                  const conforme = integridad?.conforme ?? false
                  return (
                    <tr key={a.id}>
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          background: '#fff',
                          zIndex: 1,
                          borderRight: '1px solid var(--c-border)',
                        }}
                      >
                        <span className="hg-t-ter hg-t-xs">{a.numero}. </span>
                        <span className="hg-t-sm">{a.nombre}</span>
                      </td>
                      {equipo.map((m) => {
                        const letra = asignaciones.get(`${a.id}::${m.id}`)?.letra ?? ''
                        return (
                          <td key={m.id} className="hg-centro" style={{ padding: 3 }}>
                            {editable ? (
                              <select
                                className="hg-select hg-input--sm"
                                style={{
                                  width: 62,
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  background: letra ? COLOR_LETRA[letra as LetraRaci].bg : undefined,
                                  color: letra ? COLOR_LETRA[letra as LetraRaci].fg : undefined,
                                  paddingRight: 20,
                                }}
                                value={letra}
                                disabled={guardando}
                                aria-label={`Rol de ${m.nombre || m.perfil} en ${a.nombre}`}
                                onChange={(e) => void cambiar(a.id, m.id, e.target.value as LetraRaci | '')}
                              >
                                <option value="">—</option>
                                {ROLES_RACI.map((l) => (
                                  <option key={l} value={l}>
                                    {l}
                                  </option>
                                ))}
                              </select>
                            ) : letra ? (
                              <Badge
                                fg={COLOR_LETRA[letra as LetraRaci].fg}
                                bg={COLOR_LETRA[letra as LetraRaci].bg}
                                titulo={COLOR_LETRA[letra as LetraRaci].nombre}
                              >
                                {letra}
                              </Badge>
                            ) : (
                              <span className="hg-t-ter">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td
                        className="hg-centro hg-t-bold hg-t-num"
                        title={integridad?.problema || 'Integridad correcta'}
                        style={{
                          background: conforme ? '#D1FAE5' : '#FEE2E2',
                          color: conforme ? '#047857' : '#B91C1C',
                        }}
                      >
                        {integridad?.conteoA ?? 0}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {vista === 'integridad' &&
          (noConformes.length === 0 ? (
            <Vacio
              titulo="La matriz esta completa"
              texto="Todas las actividades tienen exactamente un responsable final (A) y al menos un ejecutor (R)."
            />
          ) : (
            <Table
              columnas={[
                {
                  clave: 'actividadNombre',
                  titulo: 'Actividad',
                  render: (r) => <span className="hg-t-sm">{r.actividadNombre}</span>,
                },
                { clave: 'conteoA', titulo: 'A', alineacion: 'centro', render: (r) => r.conteoA },
                { clave: 'conteoR', titulo: 'R', alineacion: 'centro', render: (r) => r.conteoR },
                {
                  clave: 'problema',
                  titulo: 'Problema de integridad',
                  render: (r) => <span className="hg-t-sm" style={{ color: '#B91C1C' }}>{r.problema}</span>,
                },
                {
                  clave: 'ir',
                  titulo: '',
                  alineacion: 'derecha',
                  render: (r) => (
                    <Button variante="ghost" tamano="sm" onClick={() => setVista('matriz')}>
                      Corregir en la matriz
                      <span className="sr-only"> {r.actividadNombre}</span>
                    </Button>
                  ),
                },
              ]}
              filas={noConformes}
              claveDe={(r) => r.actividadId}
            />
          ))}

        {vista === 'persona' && (
          <div className="hg-pila">
            <Select
              label="Integrante"
              value={personaId}
              placeholder="Seleccione…"
              opciones={equipo.map((m) => ({ valor: m.id, etiqueta: m.nombre || m.perfil }))}
              onChange={(e) => setPersonaId(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            {personaId && (
              <Table
                columnas={[
                  { clave: 'numero', titulo: '#', alineacion: 'derecha', render: (a) => a.numero },
                  { clave: 'nombre', titulo: 'Actividad', render: (a) => a.nombre },
                  {
                    clave: 'letra',
                    titulo: 'Rol',
                    alineacion: 'centro',
                    render: (a) => {
                      const l = asignaciones.get(`${a.id}::${personaId}`)?.letra
                      return l ? (
                        <Badge fg={COLOR_LETRA[l].fg} bg={COLOR_LETRA[l].bg} titulo={COLOR_LETRA[l].nombre}>
                          {l}
                        </Badge>
                      ) : (
                        '—'
                      )
                    },
                  },
                  {
                    clave: 'estado',
                    titulo: 'Estado',
                    render: (a) => a.estado,
                  },
                ]}
                filas={actividades.filter((a) => asignaciones.has(`${a.id}::${personaId}`))}
                claveDe={(a) => a.id}
                vacio="Esta persona no tiene asignaciones en la matriz."
              />
            )}
          </div>
        )}

        <div className="hg-fila" style={{ marginTop: 'var(--sp-md)' }}>
          {ROLES_RACI.map((l) => (
            <Badge key={l} fg={COLOR_LETRA[l].fg} bg={COLOR_LETRA[l].bg}>
              {l} · {COLOR_LETRA[l].nombre}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}
