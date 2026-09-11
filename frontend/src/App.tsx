import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { ToastProvider } from '@/components/Toast'
import { Cargando } from '@/components/EstadoVista'
import LimiteError from '@/components/LimiteError'
import LayoutGlobal from '@/app/LayoutGlobal'
import LayoutProyecto from '@/app/LayoutProyecto'
import { ProyectoProvider } from '@/app/ProyectoContext'
import { sembrarDatos } from '@/data/seed'
import { backendSolicitado } from '@/data/backend'
import Login from '@/modules/Login'

const Portafolio = lazy(() => import('@/modules/portafolio/Portafolio'))
const ListaProyectos = lazy(() => import('@/modules/proyectos/ListaProyectos'))
const Ficha = lazy(() => import('@/modules/proyectos/Ficha'))
const Equipo = lazy(() => import('@/modules/equipo/Equipo'))
const Cronograma = lazy(() => import('@/modules/cronograma/Cronograma'))
const Gantt = lazy(() => import('@/modules/gantt/Gantt'))
const Hitos = lazy(() => import('@/modules/hitos/Hitos'))
const Raci = lazy(() => import('@/modules/raci/Raci'))
const Riesgos = lazy(() => import('@/modules/riesgos/Riesgos'))
const Recursos = lazy(() => import('@/modules/recursos/Recursos'))
const Productos = lazy(() => import('@/modules/productos/Productos'))
const Satisfaccion = lazy(() => import('@/modules/satisfaccion/Satisfaccion'))
const Presupuesto = lazy(() => import('@/modules/presupuesto/Presupuesto'))
const Indicadores = lazy(() => import('@/modules/indicadores/Indicadores'))
const Costos = lazy(() => import('@/modules/costos/Costos'))
const Tablero = lazy(() => import('@/modules/tablero/Tablero'))
const DashboardEjecutivo = lazy(() => import('@/modules/dashboard/DashboardEjecutivo'))
const AuditoriaProyecto = lazy(() => import('@/modules/auditoria/AuditoriaProyecto'))
const AuditoriaGlobal = lazy(() => import('@/modules/auditoria/AuditoriaGlobal'))
const Importacion = lazy(() => import('@/modules/importacion/Importacion'))
const Catalogos = lazy(() => import('@/modules/catalogos/Catalogos'))
const CatalogoIndicadores = lazy(() => import('@/modules/catalogos/CatalogoIndicadores'))
const Usuarios = lazy(() => import('@/modules/catalogos/Usuarios'))

function RutaPrivada({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <Cargando texto="Verificando la sesion…" />
  if (!usuario) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Rutas() {
  return (
    <Suspense fallback={<div className="hg-contenido"><Cargando /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <RutaPrivada>
              <LayoutGlobal />
            </RutaPrivada>
          }
        >
          <Route path="/portafolio" element={<Portafolio />} />
          <Route path="/proyectos" element={<ListaProyectos />} />
          <Route path="/auditoria" element={<AuditoriaGlobal />} />
          <Route path="/admin/catalogos" element={<Catalogos />} />
          <Route path="/admin/indicadores" element={<CatalogoIndicadores />} />
          <Route path="/admin/usuarios" element={<Usuarios />} />
        </Route>

        <Route
          path="/proyectos/:proyectoId"
          element={
            <RutaPrivada>
              <ProyectoProvider>
                <LayoutProyecto />
              </ProyectoProvider>
            </RutaPrivada>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardEjecutivo />} />
          <Route path="tablero" element={<Tablero />} />
          <Route path="ficha" element={<Ficha />} />
          <Route path="equipo" element={<Equipo />} />
          <Route path="cronograma" element={<Cronograma />} />
          <Route path="gantt" element={<Gantt />} />
          <Route path="hitos" element={<Hitos />} />
          <Route path="raci" element={<Raci />} />
          <Route path="riesgos" element={<Riesgos />} />
          <Route path="recursos" element={<Recursos />} />
          <Route path="productos" element={<Productos />} />
          <Route path="satisfaccion" element={<Satisfaccion />} />
          <Route path="presupuesto" element={<Presupuesto />} />
          <Route path="indicadores" element={<Indicadores />} />
          <Route path="costos" element={<Costos />} />
          <Route path="auditoria" element={<AuditoriaProyecto />} />
          <Route path="importacion" element={<Importacion />} />
        </Route>

        <Route path="/" element={<Navigate to="/portafolio" replace />} />
        <Route path="*" element={<Navigate to="/portafolio" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const [listo, setListo] = useState(backendSolicitado() !== 'local')

  // En el entorno local se garantiza que existan catalogos y datos de ejemplo.
  useEffect(() => {
    if (listo) return
    void sembrarDatos().finally(() => setListo(true))
  }, [listo])

  if (!listo) {
    return (
      <div className="hg-contenido">
        <Cargando texto="Preparando el entorno local…" />
      </div>
    )
  }

  return (
    <LimiteError ambito="la aplicacion">
      {/* Se activan las banderas de la version 7 del enrutador: evita las
          advertencias de consola y deja el codigo listo para la actualizacion. */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <AuthProvider>
            <Rutas />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </LimiteError>
  )
}
