/**
 * Modulo de importacion y exportacion de proyectos — EP-24 (HG-149 a HG-155).
 * Permite exportar todos los datos del proyecto a un libro Excel estructurado o CSV,
 * y cargar/migrar datos desde plantillas de captura compatibles con HIGEP V2.
 */

import { useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Table, { type Columna } from '@/components/ui/Table'
import { ModalConfirmacion } from '@/components/ui/Modal'
import { Cargando } from '@/components/EstadoVista'
import { useToast } from '@/components/Toast'
import {
  IconArchivo,
  IconCheck,
  IconExportar,
  IconImportar,
} from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { exportarCSV, exportarExcel, hojaAFilas, leerLibro, type Hoja } from '@/lib/exportar'
import { guardarEntidad, registrarEventoSimple } from '@/data/repo'
import { rutas } from '@/data/adapter'
import type { Actividad, Riesgo } from '@/domain/types'

interface HallazgoImportacion {
  modulo: string
  hoja: string
  filasDetectadas: number
  estado: 'valido' | 'advertencia' | 'no_encontrado'
  detalle: string
  datosExtraidos?: Record<string, unknown>[]
}

export default function Importacion() {
  const { datos, resumen, cargando, proyectoId, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()

  const [archivo, setArchivo] = useState<File | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [hallazgos, setHallazgos] = useState<HallazgoImportacion[]>([])
  const [confirmarImportacion, setConfirmarImportacion] = useState(false)
  const [importando, setImportando] = useState(false)

  const proyecto = datos?.proyecto
  const puedeExportar = puedeEnProyecto(usuario, proyecto ?? null, 'datos.exportar')
  const puedeImportar = puedeEnProyecto(usuario, proyecto ?? null, 'datos.importar')

  // ---------------------------------------------------------------------------
  // EXPORTACION COMPLETA A EXCEL
  // ---------------------------------------------------------------------------

  const exportarTodoExcel = () => {
    if (!datos || !proyecto) return

    const hojas: Hoja[] = [
      {
        nombre: 'Ficha del Proyecto',
        filas: [
          {
            Codigo: proyecto.codigo,
            Nombre: proyecto.nombre,
            Estado: proyecto.estado,
            Lider: proyecto.liderNombre,
            FechaInicio: proyecto.fechaInicio,
            FechaEntregaFinal: proyecto.fechaEntregaFinal,
            FechaCorte: proyecto.fechaCorte,
            EntidadEjecutora: proyecto.entidadEjecutora,
            Financiador: proyecto.financiador,
            ObjetivoGeneral: proyecto.objetivoGeneral,
            Alcance: proyecto.alcance,
            AvancePonderado: resumen?.avancePonderado ? `${resumen.avancePonderado.toFixed(1)}%` : '0%',
          },
        ],
      },
      {
        nombre: 'Cronograma',
        filas: datos.actividades.map((a) => ({
          Numero: a.numero,
          Orden: a.orden,
          FaseId: a.faseId,
          Actividad: a.nombre,
          Responsable: a.responsableNombre,
          FechaInicio: a.fechaInicio || '',
          FechaFin: a.fechaFin || '',
          AvancePorcentaje: a.avance,
          Entregable: a.entregable || '',
        })),
      },
      {
        nombre: 'Hitos',
        filas: datos.hitos.map((h) => ({
          Orden: h.orden,
          Descripcion: h.descripcion,
          CriterioCumplimiento: h.criterioCumplimiento,
          FechaProgramada: h.fechaProgramada || '',
          FechaReal: h.fechaReal || '',
          Estado: h.estado,
        })),
      },
      {
        nombre: 'Equipo',
        filas: datos.equipo.map((m) => ({
          Nombre: m.nombre,
          Perfil: m.perfil,
          DedicacionHorasMes: m.dedicacionHorasMes,
          MesesVinculacion: m.mesesVinculacion,
          EstadoVinculacion: m.estadoVinculacion,
        })),
      },
      {
        nombre: 'Riesgos',
        filas: datos.riesgos.map((r) => ({
          Codigo: r.codigo,
          Categoria: r.categoria,
          Descripcion: r.descripcion,
          Probabilidad: r.probabilidad,
          Impacto: r.impacto,
          Severidad: (r.probabilidad || 1) * (r.impacto || 1),
          PlanRespuesta: r.planRespuesta,
          Responsable: r.responsableNombre,
          Estado: r.estado,
        })),
      },
      {
        nombre: 'Recursos',
        filas: datos.recursos.map((rec) => ({
          Tipo: rec.tipo,
          Descripcion: rec.descripcion,
          Cantidad: rec.cantidad,
          Disponibilidad: rec.disponibilidad,
        })),
      },
      {
        nombre: 'Productos',
        filas: datos.productos.map((p) => ({
          Entregable: p.entregable,
          FechaEntrega: p.fechaEntrega || '',
          Evaluado: p.evaluado ? 'SI' : 'NO',
          Conforme: p.conforme ? 'SI' : 'NO',
          Responsable: p.responsableNombre,
        })),
      },
      {
        nombre: 'Presupuesto',
        filas: datos.presupuesto.map((pr) => ({
          Periodo: pr.periodo,
          Rubro: pr.rubro,
          Fuente: pr.fuente,
          Programado: pr.programado,
          Ejecutado: pr.ejecutado,
          Desviacion: pr.programado - pr.ejecutado,
          Observaciones: pr.observaciones || '',
        })),
      },
      {
        nombre: 'Satisfaccion',
        filas: datos.satisfaccion.map((s) => ({
          Periodo: s.periodo,
          Grupo: s.grupo,
          Encuestados: s.encuestados,
          Satisfechos: s.satisfechos,
          PorcentajeSatisfaccion: s.encuestados > 0 ? `${((s.satisfechos / s.encuestados) * 100).toFixed(1)}%` : '0%',
        })),
      },
    ]

    try {
      exportarExcel(hojas, `HIGEP-${proyecto.codigo}-completo`)
      void registrarEventoSimple(
        'exportar',
        'proyecto',
        `Exportacion Excel completa del proyecto ${proyecto.codigo}`,
        proyectoId,
      )
      toast.exito('Se genero el archivo Excel con todas las hojas del proyecto.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  // ---------------------------------------------------------------------------
  // DESCARGAR PLANTILLA
  // ---------------------------------------------------------------------------

  const descargarPlantilla = () => {
    const hojas: Hoja[] = [
      {
        nombre: 'Cronograma',
        filas: [
          {
            Fase: 'Alistamiento',
            Actividad: 'Reunion de inicio y definicion metodologica',
            Responsable: 'Lider de proyecto',
            FechaInicio: '2026-03-01',
            FechaFin: '2026-03-15',
            AvancePorcentaje: 100,
            Entregable: 'Acta de inicio',
          },
          {
            Fase: 'Planeacion',
            Actividad: 'Protocolo de busqueda sistematica',
            Responsable: 'Lider metodologico',
            FechaInicio: '2026-03-16',
            FechaFin: '2026-04-15',
            AvancePorcentaje: 60,
            Entregable: 'Protocolo aprobado',
          },
        ],
      },
      {
        nombre: 'Hitos',
        filas: [
          {
            Descripcion: 'Entrega de informe preliminar',
            CriterioCumplimiento: 'Informe radicado ante comite directivo',
            FechaProgramada: '2026-05-30',
            FechaReal: '',
            Estado: 'Pendiente',
          },
        ],
      },
      {
        nombre: 'Riesgos',
        filas: [
          {
            Codigo: 'RSK-01',
            Categoria: 'Tecnico',
            Descripcion: 'Demora en acceso a bases de datos clinicas',
            Probabilidad: 3,
            Impacto: 4,
            PlanRespuesta: 'Gestion anticipada de acuerdos de confidencialidad',
            Responsable: 'Lider del proyecto',
            Estado: 'Identificado',
          },
        ],
      },
    ]

    exportarExcel(hojas, 'Plantilla-Importacion-HIGEP-V2')
    toast.info('Plantilla oficial descargada exitosamente.')
  }

  // ---------------------------------------------------------------------------
  // PROCESAMIENTO E IMPORTACION DE ARCHIVO
  // ---------------------------------------------------------------------------

  const procesarArchivo = async (file: File) => {
    setArchivo(file)
    setAnalizando(true)
    setHallazgos([])

    try {
      const libro = await leerLibro(file)
      const nombresHojas = libro.SheetNames
      const reporte: HallazgoImportacion[] = []

      // 1. Cronograma / Actividades
      const hojaCronograma = nombresHojas.find(
        (h) =>
          h.toLowerCase().includes('cronograma') ||
          h.toLowerCase().includes('actividad') ||
          h.toLowerCase().includes('plan'),
      )

      if (hojaCronograma) {
        const filas = hojaAFilas(libro, hojaCronograma)
        reporte.push({
          modulo: 'Cronograma de actividades',
          hoja: hojaCronograma,
          filasDetectadas: filas.length,
          estado: filas.length > 0 ? 'valido' : 'advertencia',
          detalle: `${filas.length} actividades leidas para migracion.`,
          datosExtraidos: filas,
        })
      } else {
        reporte.push({
          modulo: 'Cronograma de actividades',
          hoja: 'No encontrada',
          filasDetectadas: 0,
          estado: 'no_encontrado',
          detalle: 'No se identifico hoja con nombre "Cronograma" o "Actividades".',
        })
      }

      // 2. Hitos
      const hojaHitos = nombresHojas.find((h) => h.toLowerCase().includes('hito'))
      if (hojaHitos) {
        const filas = hojaAFilas(libro, hojaHitos)
        reporte.push({
          modulo: 'Hitos y entregables clave',
          hoja: hojaHitos,
          filasDetectadas: filas.length,
          estado: filas.length > 0 ? 'valido' : 'advertencia',
          detalle: `${filas.length} hitos identificados.`,
          datosExtraidos: filas,
        })
      }

      // 3. Riesgos
      const hojaRiesgos = nombresHojas.find((h) => h.toLowerCase().includes('riesgo'))
      if (hojaRiesgos) {
        const filas = hojaAFilas(libro, hojaRiesgos)
        reporte.push({
          modulo: 'Matriz de riesgos',
          hoja: hojaRiesgos,
          filasDetectadas: filas.length,
          estado: filas.length > 0 ? 'valido' : 'advertencia',
          detalle: `${filas.length} riesgos leidos.`,
          datosExtraidos: filas,
        })
      }

      setHallazgos(reporte)
      toast.info('Archivo analizado. Revise el informe antes de continuar.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setAnalizando(false)
    }
  }

  const ejecutarImportacion = async () => {
    if (!proyectoId || hallazgos.length === 0) return
    setImportando(true)

    try {
      let actividadesGuardadas = 0
      let riesgosGuardados = 0

      for (const h of hallazgos) {
        if (!h.datosExtraidos || h.datosExtraidos.length === 0) continue

        if (h.modulo.includes('Cronograma')) {
          const nuevasActividades: Partial<Actividad>[] = h.datosExtraidos.map((f, i) => ({
            proyectoId,
            numero: i + 1,
            orden: i + 1,
            faseId: String(f.FaseId || f.faseId || f.Fase || 'fase-1'),
            nombre: String(f.Actividad || f.actividad || f.Nombre || `Actividad ${i + 1}`),
            responsableId: null,
            responsableNombre: String(f.Responsable || f.responsable || 'Por asignar'),
            apoyoIds: [],
            fechaInicio: String(f.FechaInicio || f.fechaInicio || proyecto?.fechaInicio || '2026-01-01').slice(0, 10),
            fechaFin: String(f.FechaFin || f.fechaFin || proyecto?.fechaEntregaFinal || '2026-12-31').slice(0, 10),
            avance: Math.min(100, Math.max(0, Number(f.AvancePorcentaje || f.avance || 0))),
            entregable: String(f.Entregable || f.entregable || ''),
            predecesoras: [],
          }))

          for (const act of nuevasActividades) {
            await guardarEntidad<Actividad>(
              rutas.actividades(proyectoId),
              act,
              {
                proyectoId,
                entidad: 'actividad',
                etiqueta: act.nombre || 'Nueva actividad',
                tipoCambio: 'Actividad',
                comentario: `Importado desde archivo ${archivo?.name ?? ''}`,
              },
            )
            actividadesGuardadas++
          }
        }

        if (h.modulo.includes('Riesgos')) {
          const nuevosRiesgos: Partial<Riesgo>[] = h.datosExtraidos.map((f, i) => ({
            proyectoId,
            codigo: String(f.Codigo || f.codigo || `RSK-${i + 1}`),
            categoria: String(f.Categoria || f.categoria || 'Tecnico'),
            descripcion: String(f.Descripcion || f.descripcion || 'Riesgo importado'),
            probabilidad: Math.min(5, Math.max(1, Number(f.Probabilidad || f.probabilidad || 3))),
            impacto: Math.min(5, Math.max(1, Number(f.Impacto || f.impacto || 3))),
            planRespuesta: String(f.PlanRespuesta || f.planRespuesta || 'Por definir'),
            responsableNombre: String(f.Responsable || f.responsable || 'Lider de proyecto'),
            estado: 'Identificado',
            fechaIdentificacion: new Date().toISOString().slice(0, 10),
            historial: [],
          }))

          for (const r of nuevosRiesgos) {
            await guardarEntidad<Riesgo>(
              rutas.riesgos(proyectoId),
              r,
              {
                proyectoId,
                entidad: 'riesgo',
                etiqueta: r.codigo || 'Riesgo',
                tipoCambio: 'Riesgo',
                comentario: `Importado desde archivo ${archivo?.name ?? ''}`,
              },
            )
            riesgosGuardados++
          }
        }
      }

      await registrarEventoSimple(
        'importar',
        'proyecto',
        `Importacion de datos: ${actividadesGuardadas} actividades y ${riesgosGuardados} riesgos desde ${archivo?.name}`,
        proyectoId,
      )

      toast.exito(
        `Se importaron ${actividadesGuardadas} actividades y ${riesgosGuardados} riesgos exitosamente.`,
      )

      setConfirmarImportacion(false)
      setArchivo(null)
      setHallazgos([])
      await recargar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setImportando(false)
    }
  }

  if (cargando || !datos || !proyecto) return <Cargando />

  const columnasHallazgos: Columna<HallazgoImportacion>[] = [
    { clave: 'modulo', titulo: 'Modulo objetivo', render: (h) => <span className="hg-t-negrita">{h.modulo}</span> },
    { clave: 'hoja', titulo: 'Hoja en el libro', render: (h) => <code>{h.hoja}</code> },
    { clave: 'filas', titulo: 'Filas', render: (h) => <span>{h.filasDetectadas}</span> },
    {
      clave: 'estado',
      titulo: 'Diagnostico',
      render: (h) => (
        <Badge
          fg={h.estado === 'valido' ? '#15803D' : h.estado === 'advertencia' ? '#B45309' : '#B91C1C'}
          bg={h.estado === 'valido' ? '#DCFCE7' : h.estado === 'advertencia' ? '#FEF3C7' : '#FEE2E2'}
        >
          {h.estado === 'valido' ? 'Lista para migrar' : h.estado === 'advertencia' ? 'Incompleta' : 'No encontrada'}
        </Badge>
      ),
    },
    { clave: 'detalle', titulo: 'Detalle', render: (h) => <span className="hg-t-sm">{h.detalle}</span> },
  ]

  return (
    <div className="hg-pila">
      <div className="hg-grid hg-grid--kpi">
        <KPICard
          etiqueta="Actividades actuales"
          valor={datos.actividades.length}
          pie="Registradas en el cronograma"
          acento="#6366F1"
        />
        <KPICard
          etiqueta="Hitos de entrega"
          valor={datos.hitos.length}
          pie="Monitoreados en ruta critica"
          acento="#0891B2"
        />
        <KPICard
          etiqueta="Riesgos tipificados"
          valor={datos.riesgos.length}
          pie="Evaluados con severidad"
          acento="#CA8A04"
        />
        <KPICard
          etiqueta="Registros presupuestales"
          valor={datos.presupuesto.length}
          pie="Periodos de ejecucion"
          acento="#15803D"
        />
      </div>

      {/* SECCION DE EXPORTACION */}
      <Card
        titulo="Exportacion de datos del proyecto"
        subtitulo="Descargue la totalidad de la informacion del proyecto en formato Excel (XLSX) con pestanas estandarizadas o como plantilla de trabajo."
        acciones={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variante="secondary" onClick={descargarPlantilla}>
              <IconArchivo /> Plantilla oficial HIGEP V2
            </Button>
            <Button variante="primary" onClick={exportarTodoExcel} disabled={!puedeExportar}>
              <IconExportar /> Exportar todo a Excel
            </Button>
          </div>
        }
      >
        <div className="hg-grid hg-grid--3col" style={{ marginTop: '8px' }}>
          <div
            style={{
              padding: '16px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              background: '#F8FAFC',
            }}
          >
            <div className="hg-t-negrita" style={{ marginBottom: '4px' }}>Cronograma y Gantt</div>
            <p className="hg-t-xs hg-t-muted" style={{ marginBottom: '12px' }}>
              Exportar tabla de actividades con fechas, duracion, porcentaje de avance y responsable.
            </p>
            <Button
              tamano="sm"
              variante="ghost"
              onClick={() =>
                exportarCSV(
                  datos.actividades.map((a) => ({
                    Numero: a.numero,
                    Orden: a.orden,
                    Actividad: a.nombre,
                    Responsable: a.responsableNombre,
                    Inicio: a.fechaInicio || '',
                    Fin: a.fechaFin || '',
                    Avance: a.avance,
                  })),
                  `cronograma-${proyecto.codigo}`,
                )
              }
            >
              Exportar CSV
            </Button>
          </div>

          <div
            style={{
              padding: '16px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              background: '#F8FAFC',
            }}
          >
            <div className="hg-t-negrita" style={{ marginBottom: '4px' }}>Matriz de Riesgos</div>
            <p className="hg-t-xs hg-t-muted" style={{ marginBottom: '12px' }}>
              Exportar riesgos identificados, calificacion de probabilidad, impacto, severidad y respuesta.
            </p>
            <Button
              tamano="sm"
              variante="ghost"
              onClick={() =>
                exportarCSV(
                  datos.riesgos.map((r) => ({
                    Codigo: r.codigo,
                    Categoria: r.categoria,
                    Descripcion: r.descripcion,
                    Probabilidad: r.probabilidad,
                    Impacto: r.impacto,
                    Severidad: (r.probabilidad || 1) * (r.impacto || 1),
                    Estado: r.estado,
                  })),
                  `riesgos-${proyecto.codigo}`,
                )
              }
            >
              Exportar CSV
            </Button>
          </div>

          <div
            style={{
              padding: '16px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              background: '#F8FAFC',
            }}
          >
            <div className="hg-t-negrita" style={{ marginBottom: '4px' }}>Presupuesto y Gastos</div>
            <p className="hg-t-xs hg-t-muted" style={{ marginBottom: '12px' }}>
              Exportar ejecucion presupuestal, programado contra ejecutado y desviaciones financieras.
            </p>
            <Button
              tamano="sm"
              variante="ghost"
              onClick={() =>
                exportarCSV(
                  datos.presupuesto.map((p) => ({
                    Periodo: p.periodo,
                    Programado: p.programado,
                    Ejecutado: p.ejecutado,
                    Desviacion: p.programado - p.ejecutado,
                  })),
                  `presupuesto-${proyecto.codigo}`,
                )
              }
            >
              Exportar CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* SECCION DE IMPORTACION */}
      <Card
        titulo="Importacion desde libro HIGEP V2 (EP-24)"
        subtitulo="Cargue un libro de Excel oficial para importar cronogramas y matrices de riesgo hacia este proyecto."
      >
        {!puedeImportar && (
          <Alert
            tipo="warning"
            titulo="Permiso insuficiente"
            mensaje="Su rol actual no posee permisos para escribir o importar datos en este proyecto."
          />
        )}

        <div
          style={{
            border: '2px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '32px 20px',
            textAlign: 'center',
            background: '#F8FAFC',
            marginTop: '12px',
          }}
        >
          <IconArchivo size={36} style={{ color: '#6366F1', margin: '0 auto 12px auto' }} />
          <h3 className="hg-t-lg hg-t-negrita" style={{ margin: '0 0 6px 0' }}>
            Seleccione el archivo Excel (.xlsx / .xls)
          </h3>
          <p className="hg-t-sm hg-t-muted" style={{ margin: '0 0 16px 0' }}>
            El sistema inspeccionara las hojas de captura y validara la estructura sin alterar datos de inmediato.
          </p>

          <input
            type="file"
            id="input-archivo-excel"
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void procesarArchivo(f)
            }}
          />

          <Button
            variante="primary"
            onClick={() => document.getElementById('input-archivo-excel')?.click()}
            disabled={!puedeImportar || analizando}
          >
            <IconImportar /> {analizando ? 'Analizando libro...' : 'Examinar archivo'}
          </Button>

          {archivo && (
            <div className="hg-t-sm" style={{ marginTop: '12px', color: '#4F46E5', fontWeight: 600 }}>
              Archivo cargado: {archivo.name} ({Math.round(archivo.size / 1024)} KB)
            </div>
          )}
        </div>

        {/* INFORME DE PREVALIDACION */}
        {hallazgos.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 className="hg-t-base hg-t-negrita" style={{ margin: 0 }}>
                  Informe de validacion previa (HG-151)
                </h4>
                <span className="hg-t-xs hg-t-muted">
                  Revise las entidades encontradas antes de consolidar la importacion en la base de datos.
                </span>
              </div>

              <Button
                variante="primary"
                onClick={() => setConfirmarImportacion(true)}
                disabled={!hallazgos.some((h) => h.filasDetectadas > 0)}
              >
                <IconCheck /> Proceder con la importacion
              </Button>
            </div>

            <Table<HallazgoImportacion>
              columnas={columnasHallazgos}
              filas={hallazgos}
              claveDe={(h) => h.modulo}
            />
          </div>
        )}
      </Card>

      {/* CONFIRMACION DE IMPORTACION */}
      {confirmarImportacion && (
        <ModalConfirmacion
          titulo="Confirmar consolidacion de datos"
          mensaje={`Se incorporaran los registros detectados al proyecto "${proyecto.nombre}". El evento quedara registrado en el log de auditoria y se recalcularan todos los indicadores del proyecto. ¿Desea continuar?`}
          textoConfirmar={importando ? 'Importando...' : 'Si, incorporar datos'}
          abierto={true}
          variante="primary"
          onConfirmar={() => void ejecutarImportacion()}
          onCerrar={() => setConfirmarImportacion(false)}
        />
      )}
    </div>
  )
}
