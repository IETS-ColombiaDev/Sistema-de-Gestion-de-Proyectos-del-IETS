/**
 * Importacion, exportacion y prueba de paridad — EP-24 / HG-146 / HG-147 / HG-165.
 *
 * La importacion valida antes de escribir: produce un informe de hallazgos y
 * solo carga cuando no hay errores bloqueantes (HG-149 a HG-152). La prueba de
 * paridad ejecuta el motor en los dos modos y explica cada diferencia, para que
 * el saneamiento no se confunda con un error de calculo (RD-11).
 */

import { useMemo, useRef, useState } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import KPICard from '@/components/Dashboard/KPICard'
import Alert from '@/components/Alert'
import Tabs from '@/components/Tabs'
import Table from '@/components/ui/Table'
import { Cargando, Vacio } from '@/components/EstadoVista'
import { Nota, Pista } from '@/components/Ayuda'
import { useToast } from '@/components/Toast'
import { IconArchivo, IconExportar, IconImportar, IconRefrescar } from '@/components/icons'
import { useProyecto } from '@/app/ProyectoContext'
import { useAuth } from '@/auth/AuthContext'
import { puedeEnProyecto } from '@/auth/permisos'
import { guardarLoteEntidades, registrarEventoSimple } from '@/data/repo'
import { rutas, nuevoId } from '@/data/adapter'
import { exportarExcel, hojaAFilas, leerLibro } from '@/lib/exportar'
import { calcularIndicadores } from '@/domain/indicadores'
import { resumirProyecto } from '@/domain/reglas'
import { formatearFecha } from '@/domain/fechas'
import { conSigno, porcentaje } from '@/lib/formato'
import type { Actividad, Hito, Riesgo } from '@/domain/types'

type Pestana = 'importar' | 'exportar' | 'paridad'

interface Hallazgo {
  fila: number
  campo: string
  mensaje: string
  severidad: 'error' | 'advertencia'
}

interface Preparado {
  actividades: Partial<Actividad>[]
  hitos: Partial<Hito>[]
  riesgos: Partial<Riesgo>[]
  hallazgos: Hallazgo[]
  hojasLeidas: string[]
  hojasIgnoradas: string[]
}

/** Normaliza encabezados: sin tildes, sin espacios, minusculas. */
const norm = (s: string): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

function buscarCampo(fila: Record<string, unknown>, ...alias: string[]): unknown {
  const claves = Object.keys(fila)
  for (const a of alias) {
    const k = claves.find((c) => norm(c) === norm(a) || norm(c).includes(norm(a)))
    if (k != null && fila[k] !== null && fila[k] !== '') return fila[k]
  }
  return null
}

/** Convierte a 'YYYY-MM-DD' desde texto, numero de serie de Excel o Date. */
function aFechaISO(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s: string = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }
  const n = Number(s)
  if (Number.isFinite(n) && n > 20000 && n < 60000) {
    // Serie de Excel: dias desde 1899-12-30.
    return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10)
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/** Acepta 0,45 · 45 · "45%" y devuelve 0..100. */
function aPorcentaje(v: unknown): number {
  if (v == null || v === '') return 0
  const s = String(v).replace('%', '').replace(',', '.').trim()
  const n = Number(s)
  if (!Number.isFinite(n)) return 0
  if (n > 0 && n <= 1) return Math.round(n * 100)
  return Math.max(0, Math.min(100, Math.round(n)))
}

export default function Importacion() {
  const { datos, resumen, parametros, cargando, recargar } = useProyecto()
  const { usuario } = useAuth()
  const toast = useToast()
  const archivoRef = useRef<HTMLInputElement>(null)

  const proyecto = datos?.proyecto
  const puedeImportar = puedeEnProyecto(usuario, proyecto ?? null, 'datos.importar')

  const [pestana, setPestana] = useState<Pestana>('importar')
  const [preparado, setPreparado] = useState<Preparado | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [procesando, setProcesando] = useState(false)

  /** Comparacion saneado vs compatibilidad sobre el mismo conjunto de datos. */
  const paridad = useMemo(() => {
    if (!datos || !parametros) return null
    const saneado = resumirProyecto({ ...datos, proyecto: { ...datos.proyecto, modoCalculo: 'saneado' } }, parametros)
    const compat = resumirProyecto(
      { ...datos, proyecto: { ...datos.proyecto, modoCalculo: 'compatibilidad' } },
      parametros,
    )
    const indSaneado = calcularIndicadores(datos, saneado)
    const indCompat = calcularIndicadores(datos, compat)
    return { saneado, compat, indSaneado, indCompat }
  }, [datos, parametros])

  if (cargando || !datos || !resumen || !proyecto) return <Cargando />

  const leerArchivo = async (archivo: File) => {
    setProcesando(true)
    setNombreArchivo(archivo.name)
    try {
      const libro = await leerLibro(archivo)
      const hallazgos: Hallazgo[] = []
      const hojasLeidas: string[] = []
      const hojasIgnoradas: string[] = []

      const nombreHoja = (...alias: string[]) =>
        libro.SheetNames.find((n) => alias.some((a) => norm(n).includes(norm(a))))

      // --- Cronograma ---
      const actividades: Partial<Actividad>[] = []
      const hojaCron = nombreHoja('cronograma', 'gantt', 'actividades')
      if (hojaCron) {
        hojasLeidas.push(hojaCron)
        const filas = hojaAFilas(libro, hojaCron)
        filas.forEach((f, i) => {
          const nombre = String(buscarCampo(f, 'actividad', 'nombre', 'descripcion') ?? '').trim()
          if (!nombre) return
          const inicio = aFechaISO(buscarCampo(f, 'inicio', 'fecha inicio'))
          const fin = aFechaISO(buscarCampo(f, 'fin', 'fecha fin', 'termino'))
          const faseTexto = String(buscarCampo(f, 'fase', 'etapa') ?? '').trim()
          const avance = aPorcentaje(buscarCampo(f, 'avance', '% avance', 'porcentaje'))
          const numeroFila = i + 2

          if (!inicio || !fin) {
            hallazgos.push({
              fila: numeroFila,
              campo: 'fechas',
              mensaje: `"${nombre}": falta fecha de inicio o de fin. La actividad se importara sin fechas y quedara fuera de los calculos hasta completarse.`,
              severidad: 'advertencia',
            })
          } else if (fin < inicio) {
            hallazgos.push({
              fila: numeroFila,
              campo: 'fechaFin',
              mensaje: `"${nombre}": la fecha de fin (${fin}) es anterior a la de inicio (${inicio}).`,
              severidad: 'error',
            })
          } else if (inicio < proyecto.fechaInicio || fin > proyecto.fechaEntregaFinal) {
            hallazgos.push({
              fila: numeroFila,
              campo: 'fechas',
              mensaje: `"${nombre}": las fechas quedan fuera de la vigencia del proyecto (${proyecto.fechaInicio} a ${proyecto.fechaEntregaFinal}).`,
              severidad: 'advertencia',
            })
          }

          const fase = proyecto.fases.find((x) => norm(x.nombre) === norm(faseTexto))
          if (faseTexto && !fase) {
            hallazgos.push({
              fila: numeroFila,
              campo: 'fase',
              mensaje: `"${nombre}": la fase "${faseTexto}" no existe en el proyecto. Se asignara a "${proyecto.fases[0]?.nombre ?? 'sin fase'}"; revise la lista de fases en la ficha.`,
              severidad: 'advertencia',
            })
          }

          actividades.push({
            id: nuevoId('act'),
            proyectoId: proyecto.id,
            numero: actividades.length + 1,
            orden: actividades.length + 1,
            faseId: fase?.id ?? proyecto.fases[0]?.id ?? '',
            nombre,
            entregable: String(buscarCampo(f, 'entregable', 'producto') ?? '') || undefined,
            responsableId: null,
            responsableNombre: String(buscarCampo(f, 'responsable') ?? '').trim(),
            apoyoIds: [],
            fechaInicio: inicio,
            fechaFin: fin,
            avance,
            predecesoras: [],
          })
        })
      }

      // --- Hitos ---
      const hitos: Partial<Hito>[] = []
      const hojaHitos = nombreHoja('hitos', 'ruta critica')
      if (hojaHitos) {
        hojasLeidas.push(hojaHitos)
        const filas = hojaAFilas(libro, hojaHitos)
        filas.forEach((f, i) => {
          const descripcion = String(buscarCampo(f, 'hito', 'descripcion', 'nombre') ?? '').trim()
          if (!descripcion) return
          const programada = aFechaISO(buscarCampo(f, 'programada', 'fecha programada', 'fecha'))
          const estadoTexto = String(buscarCampo(f, 'estado') ?? '').trim()
          const estados = ['Pendiente', 'En curso', 'Cumplido', 'Cumplido con retraso', 'No cumplido']
          const estado = estados.find((e) => norm(e) === norm(estadoTexto)) ?? 'Pendiente'
          if (estadoTexto && !estados.some((e) => norm(e) === norm(estadoTexto))) {
            hallazgos.push({
              fila: i + 2,
              campo: 'estado',
              mensaje: `"${descripcion}": el estado "${estadoTexto}" no pertenece al vocabulario de cinco valores. Se importara como "Pendiente".`,
              severidad: 'advertencia',
            })
          }
          hitos.push({
            id: nuevoId('hit'),
            proyectoId: proyecto.id,
            orden: hitos.length + 1,
            descripcion,
            criterioCumplimiento: String(buscarCampo(f, 'criterio') ?? '').trim(),
            fechaProgramada: programada,
            fechaReal: aFechaISO(buscarCampo(f, 'real', 'fecha real')),
            estado: estado as Hito['estado'],
            condicionante: norm(String(buscarCampo(f, 'condicionante') ?? '')) === 'si',
            actividadesIds: [],
            evidencias: [],
          })
        })
      }

      // --- Riesgos ---
      const riesgos: Partial<Riesgo>[] = []
      const hojaRiesgos = nombreHoja('riesgos', 'matriz de riesgos')
      if (hojaRiesgos) {
        hojasLeidas.push(hojaRiesgos)
        const filas = hojaAFilas(libro, hojaRiesgos)
        filas.forEach((f, i) => {
          const descripcion = String(buscarCampo(f, 'riesgo', 'descripcion') ?? '').trim()
          if (!descripcion) return
          const p = Number(buscarCampo(f, 'probabilidad'))
          const im = Number(buscarCampo(f, 'impacto'))
          const valida = (v: number) => Number.isInteger(v) && v >= 1 && v <= 5
          if (!valida(p) || !valida(im)) {
            hallazgos.push({
              fila: i + 2,
              campo: 'valoracion',
              mensaje: `"${descripcion}": probabilidad o impacto fuera de la escala 1 a 5. Se importara sin valorar y aparecera en el panel de integridad.`,
              severidad: 'advertencia',
            })
          }
          riesgos.push({
            id: nuevoId('rsg'),
            proyectoId: proyecto.id,
            codigo: String(buscarCampo(f, 'codigo') ?? `R-${String(riesgos.length + 1).padStart(3, '0')}`),
            categoria: String(buscarCampo(f, 'categoria') ?? 'Otro').trim(),
            descripcion,
            probabilidad: valida(p) ? p : null,
            impacto: valida(im) ? im : null,
            planRespuesta: String(buscarCampo(f, 'plan', 'mitigacion', 'respuesta') ?? '').trim(),
            responsableNombre: String(buscarCampo(f, 'responsable') ?? '').trim(),
            estado: 'Identificado',
            fechaIdentificacion: proyecto.fechaCorte,
            historial: [],
          })
        })
      }

      libro.SheetNames.forEach((n) => {
        if (!hojasLeidas.includes(n)) hojasIgnoradas.push(n)
      })

      if (hojasLeidas.length === 0) {
        hallazgos.push({
          fila: 0,
          campo: 'archivo',
          mensaje:
            'No se reconocio ninguna hoja. El importador busca hojas cuyo nombre contenga "Cronograma", "Hitos" o "Riesgos". Descargue la plantilla para ver la estructura esperada.',
          severidad: 'error',
        })
      }

      setPreparado({ actividades, hitos, riesgos, hallazgos, hojasLeidas, hojasIgnoradas })
    } catch (e) {
      toast.error(`No fue posible leer el archivo: ${(e as Error).message}`)
      setPreparado(null)
    } finally {
      setProcesando(false)
    }
  }

  const confirmarImportacion = async () => {
    if (!preparado) return
    setProcesando(true)
    try {
      if (preparado.actividades.length > 0) {
        await guardarLoteEntidades<Actividad>(
          rutas.actividades(proyecto.id),
          preparado.actividades as (Partial<Actividad> & { id: string })[],
          {
            proyectoId: proyecto.id,
            entidad: 'actividad',
            tipoCambio: 'Actividad',
            comentario: `Importacion desde ${nombreArchivo}`,
            etiquetaDe: (a) => a.nombre ?? 'Actividad importada',
          },
        )
      }
      if (preparado.hitos.length > 0) {
        await guardarLoteEntidades<Hito>(
          rutas.hitos(proyecto.id),
          preparado.hitos as (Partial<Hito> & { id: string })[],
          {
            proyectoId: proyecto.id,
            entidad: 'hito',
            tipoCambio: 'Hito',
            comentario: `Importacion desde ${nombreArchivo}`,
            etiquetaDe: (h) => h.descripcion ?? 'Hito importado',
          },
        )
      }
      if (preparado.riesgos.length > 0) {
        await guardarLoteEntidades<Riesgo>(
          rutas.riesgos(proyecto.id),
          preparado.riesgos as (Partial<Riesgo> & { id: string })[],
          {
            proyectoId: proyecto.id,
            entidad: 'riesgo',
            tipoCambio: 'Riesgo',
            comentario: `Importacion desde ${nombreArchivo}`,
            etiquetaDe: (r) => r.descripcion ?? 'Riesgo importado',
          },
        )
      }

      await registrarEventoSimple(
        'importar',
        'proyecto',
        proyecto.nombre,
        proyecto.id,
        `Importacion desde ${nombreArchivo}: ${preparado.actividades.length} actividades, ${preparado.hitos.length} hitos, ${preparado.riesgos.length} riesgos.`,
      )

      toast.exito(
        `Importacion completada: ${preparado.actividades.length} actividades, ${preparado.hitos.length} hitos y ${preparado.riesgos.length} riesgos.`,
      )
      setPreparado(null)
      setNombreArchivo('')
      if (archivoRef.current) archivoRef.current.value = ''
      await recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setProcesando(false)
    }
  }

  const descargarPlantilla = () =>
    exportarExcel(
      [
        {
          nombre: 'Cronograma',
          filas: [
            {
              Fase: proyecto.fases[0]?.nombre ?? 'Planeacion',
              Actividad: 'Nombre de la actividad',
              Entregable: 'Producto asociado (opcional)',
              Responsable: 'Nombre del responsable',
              Inicio: proyecto.fechaInicio,
              Fin: proyecto.fechaEntregaFinal,
              'Avance (%)': 0,
            },
          ],
        },
        {
          nombre: 'Hitos',
          filas: [
            {
              Hito: 'Descripcion del hito',
              Criterio: 'Criterio de cumplimiento verificable',
              'Fecha programada': proyecto.fechaEntregaFinal,
              'Fecha real': '',
              Estado: 'Pendiente',
              Condicionante: 'No',
            },
          ],
        },
        {
          nombre: 'Riesgos',
          filas: [
            {
              Codigo: 'R-001',
              Categoria: 'Cronograma',
              Riesgo: 'Descripcion del riesgo',
              Probabilidad: 3,
              Impacto: 4,
              Plan: 'Plan de mitigacion o respuesta',
              Responsable: 'Nombre del responsable',
            },
          ],
        },
      ],
      'plantilla-importacion-higep',
    )

  const exportarProyecto = () => {
    exportarExcel(
      [
        {
          nombre: 'Ficha',
          filas: [
            { Campo: 'Codigo', Valor: proyecto.codigo },
            { Campo: 'Nombre', Valor: proyecto.nombre },
            { Campo: 'Tecnologia u objeto', Valor: proyecto.tecnologiaObjeto },
            { Campo: 'Alcance', Valor: proyecto.alcance },
            { Campo: 'Objetivo general', Valor: proyecto.objetivoGeneral },
            { Campo: 'Marco metodologico', Valor: proyecto.marcoMetodologico },
            { Campo: 'Entidad ejecutora', Valor: proyecto.entidadEjecutora },
            { Campo: 'Financiador', Valor: proyecto.financiador },
            { Campo: 'Lider', Valor: proyecto.liderNombre },
            { Campo: 'Fecha de inicio', Valor: proyecto.fechaInicio },
            { Campo: 'Fecha de entrega final', Valor: proyecto.fechaEntregaFinal },
            { Campo: 'Fecha de corte', Valor: proyecto.fechaCorte },
            { Campo: 'Estado', Valor: proyecto.estado },
            { Campo: 'Modo de calculo', Valor: proyecto.modoCalculo },
            { Campo: 'Avance ponderado (%)', Valor: resumen.avancePonderado },
            { Campo: 'Avance esperado (%)', Valor: resumen.avanceEsperado },
            { Campo: 'Desviacion (pp)', Valor: resumen.desviacion.puntos },
          ],
        },
        {
          nombre: 'Objetivos especificos',
          filas: proyecto.objetivosEspecificos.map((o) => ({
            Orden: o.orden,
            Objetivo: o.texto,
            'Indicador verificable': o.indicadorVerificable ?? '',
          })),
        },
        {
          nombre: 'Equipo',
          filas: datos.equipo.map((m) => ({
            Perfil: m.perfil,
            Nombre: m.porDesignar ? '(por designar)' : m.nombre,
            'Dedicacion (h/mes)': m.dedicacionHorasMes,
            'Meses de vinculacion': m.mesesVinculacion,
            'Estado de vinculacion': m.estadoVinculacion,
          })),
        },
        {
          nombre: 'Cronograma',
          filas: resumen.actividades.map((a) => ({
            '#': a.numero,
            Fase: proyecto.fases.find((f) => f.id === a.faseId)?.nombre ?? '',
            Actividad: a.nombre,
            Entregable: a.entregable ?? '',
            Responsable: a.responsableNombre,
            Inicio: a.fechaInicio,
            Fin: a.fechaFin,
            'Duracion (dias)': a.duracion,
            'Avance (%)': a.avance,
            'Avance esperado (%)': a.avanceEsperado,
            Estado: a.estado,
            'Holgura (dias)': a.holgura,
            'Ruta critica': a.esCritica ? 'Si' : 'No',
          })),
        },
        {
          nombre: 'Hitos',
          filas: resumen.hitos.map((h) => ({
            '#': h.orden,
            Hito: h.descripcion,
            Criterio: h.criterioCumplimiento,
            'Fecha programada': h.fechaProgramada,
            'Fecha real': h.fechaReal,
            Estado: h.estado,
            'Desviacion (dias)': h.desviacionDias,
            Condicionante: h.condicionante ? 'Si' : 'No',
          })),
        },
        {
          nombre: 'RACI',
          filas: resumen.raci.map((r) => ({
            Actividad: r.actividadNombre,
            'Conteo A': r.conteoA,
            'Conteo R': r.conteoR,
            Conforme: r.conforme ? 'Si' : 'No',
            Problema: r.problema,
          })),
        },
        {
          nombre: 'Riesgos',
          filas: resumen.riesgos.map((r) => ({
            Codigo: r.codigo,
            Categoria: r.categoria,
            Riesgo: r.descripcion,
            Probabilidad: r.probabilidad,
            Impacto: r.impacto,
            Severidad: r.severidad,
            Nivel: r.nivel,
            Estado: r.estado,
            Plan: r.planRespuesta,
            Responsable: r.responsableNombre,
          })),
        },
        {
          nombre: 'Recursos',
          filas: datos.recursos.map((r) => ({
            Tipo: r.tipo,
            Recurso: r.descripcion,
            Cantidad: r.cantidad,
            Fases: r.fasesIds.map((id) => proyecto.fases.find((f) => f.id === id)?.nombre ?? id).join('; '),
            Disponibilidad: r.disponibilidad,
          })),
        },
        {
          nombre: 'Productos',
          filas: datos.productos.map((p) => ({
            Entregable: p.entregable,
            'Fecha de entrega': p.fechaEntrega,
            'Fecha de evaluacion': p.fechaEvaluacion,
            Evaluado: p.evaluado ? 'Si' : 'No',
            Conforme: p.conforme ? 'Si' : 'No',
            Observaciones: p.observaciones ?? '',
          })),
        },
        {
          nombre: 'Satisfaccion',
          filas: datos.satisfaccion.map((m) => ({
            Periodo: m.periodo,
            Grupo: m.grupo,
            Encuestados: m.encuestados,
            Satisfechos: m.satisfechos,
            'Indice (%)': m.encuestados === 0 ? '' : ((m.satisfechos / m.encuestados) * 100).toFixed(1),
            Instrumento: m.instrumento,
          })),
        },
        {
          nombre: 'Presupuesto',
          filas: datos.presupuesto.map((r) => ({
            Periodo: r.periodo,
            Rubro: r.rubro,
            Fuente: r.fuente,
            Programado: r.programado,
            Ejecutado: r.ejecutado,
            Desviacion: r.ejecutado - r.programado,
          })),
        },
        {
          nombre: 'Indicadores',
          filas: calcularIndicadores(datos, resumen).map((r) => ({
            Codigo: r.codigo,
            Resultado: r.valor ?? 'Sin datos',
            Estado: r.estado,
            Detalle: r.detalle,
            'Fecha de corte': r.fechaCorte,
          })),
        },
      ],
      `proyecto-${proyecto.codigo}`,
    )
    void registrarEventoSimple(
      'exportar',
      'proyecto',
      proyecto.nombre,
      proyecto.id,
      'Exportacion completa del proyecto a Excel',
    )
  }

  const errores = preparado?.hallazgos.filter((h) => h.severidad === 'error') ?? []
  const advertencias = preparado?.hallazgos.filter((h) => h.severidad === 'advertencia') ?? []

  return (
    <div className="hg-pila">
      <Card
        titulo="Importar y exportar"
        subtitulo="Migracion desde el instrumento Excel, respaldo del proyecto y prueba de paridad de calculos."
        acciones={
          <Tabs
            opciones={[
              { valor: 'importar', etiqueta: 'Importar' },
              { valor: 'exportar', etiqueta: 'Exportar' },
              { valor: 'paridad', etiqueta: 'Paridad de calculos' },
            ]}
            activa={pestana}
            onCambiar={(v) => setPestana(v as Pestana)}
            etiquetaAria="Secciones de importacion y exportacion"
          />
        }
      >
        {pestana === 'importar' && (
          <div className="hg-pila">
            <Nota regla="EP-24">
              La importacion valida antes de escribir. Si el informe muestra errores bloqueantes, corrijalos en
              el archivo de origen y vuelva a cargarlo: no se escribe nada hasta que usted lo confirme.
            </Nota>

            {!puedeImportar && (
              <Alert
                tipo="warning"
                titulo="Sin permiso para importar"
                mensaje="La carga masiva esta reservada al lider del proyecto y al administrador. Puede descargar la plantilla y exportar."
              />
            )}

            <div className="hg-fila">
              <Button variante="secondary" icono={<IconArchivo size={15} />} onClick={descargarPlantilla}>
                Descargar plantilla
              </Button>
              <Pista texto="La plantilla trae las tres hojas que el importador reconoce, con los encabezados esperados y una fila de ejemplo." />
              <span className="hg-sep" />
              <label
                className={`hg-btn hg-btn--primary hg-btn--md${!puedeImportar || procesando ? ' hg-btn--bloque' : ''}`}
                style={{
                  cursor: puedeImportar && !procesando ? 'pointer' : 'not-allowed',
                  opacity: puedeImportar && !procesando ? 1 : 0.55,
                  width: 'auto',
                }}
              >
                <IconImportar size={16} />
                Seleccionar archivo Excel
                <input
                  ref={archivoRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  disabled={!puedeImportar || procesando}
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void leerArchivo(f)
                  }}
                />
              </label>
            </div>

            {procesando && <Cargando texto="Analizando el archivo…" />}

            {preparado && !procesando && (
              <>
                <div className="hg-grid hg-grid--kpi">
                  <KPICard etiqueta="Actividades detectadas" valor={preparado.actividades.length} acento="#6366F1" />
                  <KPICard etiqueta="Hitos detectados" valor={preparado.hitos.length} acento="#0891B2" />
                  <KPICard etiqueta="Riesgos detectados" valor={preparado.riesgos.length} acento="#CA8A04" />
                  <KPICard
                    etiqueta="Hallazgos"
                    valor={preparado.hallazgos.length}
                    color={errores.length > 0 ? '#EF4444' : advertencias.length > 0 ? '#F59E0B' : '#10B981'}
                    pie={`${errores.length} error(es) · ${advertencias.length} advertencia(s)`}
                    acento={errores.length > 0 ? '#EF4444' : '#15803D'}
                  />
                </div>

                <div className="hg-fila">
                  <Badge fg="#4F46E5" bg="#EEF2FF">
                    Archivo: {nombreArchivo}
                  </Badge>
                  {preparado.hojasLeidas.map((h) => (
                    <Badge key={h} fg="#047857" bg="#D1FAE5" titulo="Hoja reconocida e interpretada">
                      {h}
                    </Badge>
                  ))}
                  {preparado.hojasIgnoradas.map((h) => (
                    <Badge key={h} fg="#94A3B8" bg="#F1F5F9" titulo="Hoja no reconocida por el importador">
                      {h}
                    </Badge>
                  ))}
                </div>

                {errores.length > 0 && (
                  <Alert
                    tipo="error"
                    critico
                    titulo={`${errores.length} error(es) bloqueante(s)`}
                    mensaje="Corrija el archivo de origen y vuelva a cargarlo. La importacion no puede continuar."
                  />
                )}

                {preparado.hallazgos.length > 0 && (
                  <Table
                    columnas={[
                      {
                        clave: 'severidad',
                        titulo: 'Severidad',
                        render: (h: Hallazgo) =>
                          h.severidad === 'error' ? (
                            <Badge fg="#B91C1C" bg="#FEE2E2" punto>
                              Error
                            </Badge>
                          ) : (
                            <Badge fg="#92400E" bg="#FEF3C7" punto>
                              Advertencia
                            </Badge>
                          ),
                      },
                      {
                        clave: 'fila',
                        titulo: 'Fila',
                        alineacion: 'derecha',
                        render: (h) => (h.fila === 0 ? '—' : h.fila),
                      },
                      { clave: 'campo', titulo: 'Campo', render: (h) => h.campo },
                      { clave: 'mensaje', titulo: 'Hallazgo', render: (h) => <span className="hg-t-sm">{h.mensaje}</span> },
                    ]}
                    filas={preparado.hallazgos}
                    claveDe={(h) => `${h.fila}-${h.campo}-${h.mensaje.slice(0, 20)}`}
                  />
                )}

                <div className="hg-fila hg-fila--fin">
                  <Button
                    variante="secondary"
                    onClick={() => {
                      setPreparado(null)
                      setNombreArchivo('')
                      if (archivoRef.current) archivoRef.current.value = ''
                    }}
                  >
                    Descartar
                  </Button>
                  <Button
                    variante="primary"
                    cargando={procesando}
                    disabled={errores.length > 0 || !puedeImportar}
                    onClick={() => void confirmarImportacion()}
                  >
                    Importar {preparado.actividades.length + preparado.hitos.length + preparado.riesgos.length}{' '}
                    registro(s)
                  </Button>
                </div>
              </>
            )}

            {!preparado && !procesando && (
              <Vacio
                titulo="Ningun archivo cargado"
                texto="Seleccione un libro de Excel con hojas de Cronograma, Hitos o Riesgos. El sistema lee la estructura, valida y muestra un informe antes de escribir."
                icono={<IconImportar size={24} />}
              />
            )}
          </div>
        )}

        {pestana === 'exportar' && (
          <div className="hg-pila">
            <Nota regla="HG-147">
              La exportacion reproduce las hojas equivalentes del instrumento original, para continuidad
              operativa y respaldo. Los campos calculados salen con su valor a la fecha de corte vigente.
            </Nota>

            <div className="hg-grid hg-grid--2">
              <div style={{ border: '1px solid var(--c-border)', borderRadius: 'var(--r-base)', padding: 'var(--sp-md)' }}>
                <h3 style={{ fontSize: 'var(--fs-md)' }}>Proyecto completo a Excel</h3>
                <p className="hg-t-sm hg-t-sec" style={{ margin: '6px 0 var(--sp-md)' }}>
                  Once hojas: ficha, objetivos, equipo, cronograma, hitos, RACI, riesgos, recursos, productos,
                  satisfaccion, presupuesto e indicadores.
                </p>
                <Button variante="primary" icono={<IconExportar size={15} />} onClick={exportarProyecto}>
                  Exportar a Excel
                </Button>
              </div>

              <div style={{ border: '1px solid var(--c-border)', borderRadius: 'var(--r-base)', padding: 'var(--sp-md)' }}>
                <h3 style={{ fontSize: 'var(--fs-md)' }}>Reporte ejecutivo</h3>
                <p className="hg-t-sm hg-t-sec" style={{ margin: '6px 0 var(--sp-md)' }}>
                  Genera el documento imprimible desde el dashboard ejecutivo, con la marca de la fecha de
                  corte. Use la funcion de impresion del navegador para guardarlo como PDF.
                </p>
                <Button variante="secondary" onClick={() => window.print()}>
                  Imprimir o guardar en PDF
                </Button>
              </div>
            </div>

            <Table
              columnas={[
                { clave: 'hoja', titulo: 'Hoja exportada', render: (r: { hoja: string; n: number }) => r.hoja },
                { clave: 'n', titulo: 'Registros', alineacion: 'derecha', render: (r) => r.n },
              ]}
              filas={[
                { hoja: 'Ficha', n: 17 },
                { hoja: 'Objetivos especificos', n: proyecto.objetivosEspecificos.length },
                { hoja: 'Equipo', n: datos.equipo.length },
                { hoja: 'Cronograma', n: resumen.actividades.length },
                { hoja: 'Hitos', n: resumen.hitos.length },
                { hoja: 'RACI', n: resumen.raci.length },
                { hoja: 'Riesgos', n: resumen.riesgos.length },
                { hoja: 'Recursos', n: datos.recursos.length },
                { hoja: 'Productos', n: datos.productos.length },
                { hoja: 'Satisfaccion', n: datos.satisfaccion.length },
                { hoja: 'Presupuesto', n: datos.presupuesto.length },
              ]}
              claveDe={(r) => r.hoja}
            />
          </div>
        )}

        {pestana === 'paridad' && paridad && (
          <div className="hg-pila">
            <Nota regla="RD-11">
              La prueba se ejecuta en dos modos sobre los mismos datos. El modo compatibilidad replica el libro
              Excel, defectos incluidos; el modo saneado aplica las correcciones aprobadas. La diferencia entre
              ambos no es un error: es el efecto medible de cada correccion.
            </Nota>

            <div className="hg-grid hg-grid--kpi">
              <KPICard
                etiqueta="Modo vigente del proyecto"
                valor={proyecto.modoCalculo}
                pie="Se cambia en la ficha del proyecto"
                acento="#6366F1"
              />
              <KPICard
                etiqueta="Diferencia en avance esperado"
                valor={conSigno(paridad.saneado.avanceEsperado - paridad.compat.avanceEsperado, 1, ' pp')}
                pie="Efecto de corregir D-02"
                acento="#0891B2"
              />
              <KPICard
                etiqueta="Diferencia en avance ponderado"
                valor={conSigno(paridad.saneado.avancePonderado - paridad.compat.avancePonderado, 1, ' pp')}
                pie="Efecto de corregir D-01"
                acento="#CA8A04"
              />
              <KPICard
                etiqueta="Fecha de corte de la prueba"
                valor={formatearFecha(proyecto.fechaCorte)}
                acento="#15803D"
              />
            </div>

            <Table
              columnas={[
                { clave: 'medida', titulo: 'Medida', render: (r: { medida: string; compat: string; saneado: string; hallazgo: string; explicacion: string }) => <span className="hg-t-sm hg-t-bold">{r.medida}</span> },
                { clave: 'compat', titulo: 'Compatibilidad', alineacion: 'derecha', render: (r) => <span className="hg-t-num">{r.compat}</span> },
                { clave: 'saneado', titulo: 'Saneado', alineacion: 'derecha', render: (r) => <span className="hg-t-num hg-t-bold">{r.saneado}</span> },
                {
                  clave: 'hallazgo',
                  titulo: 'Hallazgo',
                  render: (r) =>
                    r.hallazgo ? (
                      <Badge fg="#92400E" bg="#FEF3C7" titulo="Hallazgo de la auditoria del archivo fuente">
                        {r.hallazgo}
                      </Badge>
                    ) : (
                      <span className="hg-t-ter">—</span>
                    ),
                },
                { clave: 'explicacion', titulo: 'Por que difieren', render: (r) => <span className="hg-t-xs hg-t-sec">{r.explicacion}</span> },
              ]}
              filas={[
                {
                  medida: 'Avance ponderado',
                  compat: porcentaje(paridad.compat.avancePonderado),
                  saneado: porcentaje(paridad.saneado.avancePonderado),
                  hallazgo: 'D-01',
                  explicacion:
                    'La duracion pasa de "fin − inicio − 2" a dias habiles reales, lo que cambia el peso de cada actividad.',
                },
                {
                  medida: 'Avance esperado',
                  compat: porcentaje(paridad.compat.avanceEsperado),
                  saneado: porcentaje(paridad.saneado.avanceEsperado),
                  hallazgo: 'D-02',
                  explicacion:
                    'El numerador deja de mezclar dias habiles con dias calendario: ambos terminos quedan en la misma unidad.',
                },
                {
                  medida: 'Desviacion del avance',
                  compat: conSigno(paridad.compat.desviacion.puntos, 1, ' pp'),
                  saneado: conSigno(paridad.saneado.desviacion.puntos, 1, ' pp'),
                  hallazgo: 'D-01, D-02',
                  explicacion: 'Es la resta de las dos medidas anteriores, de modo que arrastra ambas correcciones.',
                },
                {
                  medida: 'Avance simple',
                  compat: porcentaje(paridad.compat.avanceSimple),
                  saneado: porcentaje(paridad.saneado.avanceSimple),
                  hallazgo: '',
                  explicacion: 'No depende de la duracion: coincide en los dos modos.',
                },
                {
                  medida: 'Actividades retrasadas',
                  compat: String(paridad.compat.retrasadas.length),
                  saneado: String(paridad.saneado.retrasadas.length),
                  hallazgo: '',
                  explicacion: 'El estado depende de fechas y avance, no de la duracion: coincide.',
                },
                ...paridad.indSaneado.map((s) => {
                  const c = paridad.indCompat.find((x) => x.codigo === s.codigo)
                  const iguales = String(c?.valor ?? '') === String(s.valor ?? '')
                  return {
                    medida: `Indicador ${s.codigo}`,
                    compat: c?.valor == null ? 'Sin datos' : String(c.valor),
                    saneado: s.valor == null ? 'Sin datos' : String(s.valor),
                    hallazgo:
                      s.codigo === 'PRY-O004' ? 'D-05' : s.codigo === 'GEST-003' ? 'D-06' : iguales ? '' : 'D-01',
                    explicacion: iguales
                      ? 'Sin diferencia entre modos.'
                      : s.codigo === 'PRY-O004'
                        ? 'La desviacion presupuestal pasa de sumar porcentajes de filas distintas a calcularse sobre los totales.'
                        : s.codigo === 'GEST-003'
                          ? 'Los hitos "Cumplido con retraso" ya cuentan como cumplidos.'
                          : 'Depende del avance ponderado, que cambia con la duracion saneada.',
                  }
                }),
              ]}
              claveDe={(r) => r.medida}
            />

            <div className="hg-fila">
              <Button variante="secondary" icono={<IconRefrescar size={15} />} onClick={() => void recargar()}>
                Recalcular la comparacion
              </Button>
              <Button
                variante="secondary"
                icono={<IconExportar size={15} />}
                onClick={() =>
                  exportarExcel(
                    [
                      {
                        nombre: 'Paridad',
                        filas: [
                          {
                            Medida: 'Avance ponderado',
                            Compatibilidad: paridad.compat.avancePonderado,
                            Saneado: paridad.saneado.avancePonderado,
                            Hallazgo: 'D-01',
                          },
                          {
                            Medida: 'Avance esperado',
                            Compatibilidad: paridad.compat.avanceEsperado,
                            Saneado: paridad.saneado.avanceEsperado,
                            Hallazgo: 'D-02',
                          },
                          {
                            Medida: 'Desviacion',
                            Compatibilidad: paridad.compat.desviacion.puntos,
                            Saneado: paridad.saneado.desviacion.puntos,
                            Hallazgo: 'D-01, D-02',
                          },
                          ...paridad.indSaneado.map((s) => ({
                            Medida: s.codigo,
                            Compatibilidad: paridad.indCompat.find((x) => x.codigo === s.codigo)?.valor ?? '',
                            Saneado: s.valor ?? '',
                            Hallazgo: s.codigo === 'PRY-O004' ? 'D-05' : s.codigo === 'GEST-003' ? 'D-06' : '',
                          })),
                        ],
                      },
                    ],
                    `paridad-${proyecto.codigo}`,
                  )
                }
              >
                Exportar la comparacion
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
