/**
 * Armazon de un proyecto. La cabecera muestra siempre la fecha de corte
 * (HG-131: es lo primero visible, conforme al instructivo) y el banner de
 * contexto cuando el proyecto esta cerrado o el rol es de solo lectura.
 */

import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import LimiteError from '@/components/LimiteError'
import Button from '@/components/Button'
import { Cargando, ErrorVista } from '@/components/EstadoVista'
import { IconCalendario, IconImprimir, IconRefrescar } from '@/components/icons'
import { formatearFecha } from '@/domain/fechas'
import { useProyecto } from './ProyectoContext'
import { navProyecto } from './navegacion'
import { useAuth } from '@/auth/AuthContext'
import { ETIQUETAS_ROL, puedeEnProyecto, rolEnProyecto } from '@/auth/permisos'

export default function LayoutProyecto() {
  const [abierta, setAbierta] = useState(false)
  const { datos, resumen, alertas, cargando, error, recalcular, proyectoId } = useProyecto()
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const { pathname } = useLocation()

  const contadores = useMemo<Record<string, number>>(() => {
    if (!resumen) return {} as Record<string, number>
    return {
      alertas: alertas.filter((a) => a.severidad === 'critica' || a.severidad === 'alta').length,
      retrasadas: resumen.retrasadas.length,
      riesgos: resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado').length,
      recursos: resumen.recursos.porGestionar,
      raci: resumen.raci.filter((r) => !r.conforme).length,
      hitos: resumen.hitos.filter((h) => h.vencido).length,
    }
  }, [resumen, alertas])

  const proyecto = datos?.proyecto ?? null
  const rol = rolEnProyecto(usuario, proyecto)
  const soloLectura = proyecto?.estado === 'cerrado' || !puedeEnProyecto(usuario, proyecto, 'cronograma.editar')

  const tituloModulo = useMemo(() => {
    const item = navProyecto(proyectoId)
      .flatMap((g) => g.items)
      .find((i) => pathname.startsWith(i.ruta))
    return item?.etiqueta ?? proyecto?.nombre ?? 'Proyecto'
  }, [pathname, proyectoId, proyecto])

  return (
    <div className="hg-shell">
      <a href="#contenido-principal" className="hg-salto no-print">
        Ir al contenido principal
      </a>
      <Sidebar
        grupos={navProyecto(proyectoId)}
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        proyecto={proyecto}
        contadores={contadores}
        pie={
          <Button
            variante="ghost"
            tamano="sm"
            bloque
            onClick={() => navegar('/proyectos')}
            style={{ justifyContent: 'flex-start' }}
          >
            ← Todos los proyectos
          </Button>
        }
      />

      <div className="hg-main">
        <Header
          titulo={tituloModulo}
          subtitulo={
            proyecto ? (
              <>
                {proyecto.codigo} · {proyecto.nombre}
              </>
            ) : undefined
          }
          onMenu={() => setAbierta(true)}
          acciones={
            proyecto && (
              <>
                <span
                  className="hg-badge hg-solo-escritorio"
                  style={{ background: 'var(--c-bg-active)', color: 'var(--c-purple)' }}
                  title="Fecha de corte del proyecto: gobierna todos los calculos de seguimiento."
                >
                  <IconCalendario size={13} />
                  Corte {formatearFecha(proyecto.fechaCorte)}
                </span>
                <Button
                  variante="ghost"
                  soloIcono
                  aria-label="Imprimir o guardar en PDF"
                  title="Imprimir o guardar en PDF"
                  onClick={() => window.print()}
                  icono={<IconImprimir size={17} />}
                />
                {puedeEnProyecto(usuario, proyecto, 'indicadores.recalcular') && (
                  <Button
                    variante={proyecto.recalculoPendiente ? 'primary' : 'secondary'}
                    tamano="sm"
                    onClick={() => void recalcular()}
                    icono={<IconRefrescar size={15} />}
                    title="Recalcula los indicadores y guarda una instantanea de la fecha de corte."
                  >
                    <span className="hg-solo-escritorio">Recalcular</span>
                  </Button>
                )}
              </>
            )
          }
        />

        <main className="hg-contenido" id="contenido-principal" tabIndex={-1}>
          {proyecto && (proyecto.estado === 'cerrado' || soloLectura) && (
            <div className="hg-banner no-print" style={{ marginBottom: 'var(--sp-md)' }} role="status">
              <strong>Modo solo lectura.</strong>
              {proyecto.estado === 'cerrado'
                ? ' El proyecto esta cerrado: su contenido se conserva para consulta y auditoria.'
                : ` Su rol (${rol ? ETIQUETAS_ROL[rol] : 'sin acceso'}) no permite editar este proyecto.`}
            </div>
          )}

          {cargando && !datos ? (
            <Cargando />
          ) : error ? (
            <ErrorVista
              titulo="No fue posible abrir el proyecto"
              detalle={error}
              accion={
                <Button variante="primary" onClick={() => navegar('/proyectos')}>
                  Volver al listado
                </Button>
              }
            />
          ) : (
            <LimiteError ambito={`el modulo ${tituloModulo}`}>
              <Outlet />
            </LimiteError>
          )}
        </main>
      </div>
    </div>
  )
}
