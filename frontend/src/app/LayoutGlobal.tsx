import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import LimiteError from '@/components/LimiteError'
import { NAV_GLOBAL } from './navegacion'
import { backendSolicitado } from '@/data/backend'

export default function LayoutGlobal() {
  const [abierta, setAbierta] = useState(false)
  return (
    <div className="hg-shell">
      <a href="#contenido-principal" className="hg-salto no-print">
        Ir al contenido principal
      </a>
      <Sidebar
        grupos={NAV_GLOBAL}
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        pie={
          <>
            HIGEP Web v1.0 · backend {backendSolicitado()}
            <br />
            Instituto de Evaluacion Tecnologica en Salud
          </>
        }
      />
      <div className="hg-main">
        <Header titulo="Sistema de Gestion de Proyectos" onMenu={() => setAbierta(true)} />
        <main className="hg-contenido" id="contenido-principal" tabIndex={-1}>
          <LimiteError ambito="este modulo">
            <Outlet />
          </LimiteError>
        </main>
      </div>
    </div>
  )
}
