/**
 * Centro de alertas unificado — HG-123.
 * Reune en una sola lista todo lo que el tablero y los dashboards senalan por
 * separado, con severidad, regla de origen y ruta de resolucion.
 */

import type { ResumenProyecto } from './reglas'
import type { Alerta, DatosProyecto } from './types'

export function construirAlertas(datos: DatosProyecto, resumen: ResumenProyecto): Alerta[] {
  const p = datos.proyecto
  const base = `/proyectos/${p.id}`
  const alertas: Alerta[] = []

  // --- Entrega final (RN-10) ---
  if (resumen.entrega.activa) {
    alertas.push({
      id: 'entrega-final',
      severidad: resumen.entrega.vencida ? 'critica' : 'alta',
      titulo: resumen.entrega.vencida ? 'Entrega final vencida' : 'Entrega final proxima',
      mensaje: resumen.entrega.mensaje,
      modulo: 'Ficha',
      ruta: `${base}/ficha`,
      regla: 'RN-10',
    })
  }

  // --- Desviacion del avance (RN-06) ---
  if (resumen.desviacion.nivel !== 'En linea') {
    alertas.push({
      id: 'desviacion-avance',
      severidad: resumen.desviacion.nivel === 'ATENCION' ? 'critica' : 'alta',
      titulo:
        resumen.desviacion.nivel === 'ATENCION'
          ? 'Desviacion de avance en nivel de atencion'
          : 'Desviacion de avance en precaucion',
      mensaje: resumen.desviacion.mensaje,
      modulo: 'Tablero',
      ruta: `${base}/tablero`,
      regla: 'RN-06',
    })
  }

  // --- Actividades retrasadas (RN-07) ---
  if (resumen.retrasadas.length > 0) {
    alertas.push({
      id: 'actividades-retrasadas',
      severidad: resumen.retrasadas.length > 5 ? 'critica' : 'alta',
      titulo: `${resumen.retrasadas.length} actividad(es) retrasada(s)`,
      mensaje: `Su fecha fin quedo atras de la fecha de corte sin llegar al 100 % de avance. Primeras: ${resumen.retrasadas
        .slice(0, 3)
        .map((a) => a.nombre)
        .join('; ')}.`,
      modulo: 'Cronograma',
      ruta: `${base}/cronograma?estado=Retrasada`,
      regla: 'RN-07',
    })
  }

  // --- Riesgos criticos abiertos (RIES-001) ---
  const criticos = resumen.riesgos.filter((r) => r.nivel === 'Critico' && r.estado !== 'Cerrado')
  if (criticos.length > 0) {
    alertas.push({
      id: 'riesgos-criticos',
      severidad: 'critica',
      titulo: `${criticos.length} riesgo(s) critico(s) abierto(s)`,
      mensaje: criticos.map((r) => `${r.codigo}: ${r.descripcion}`).slice(0, 3).join(' · '),
      modulo: 'Riesgos',
      ruta: `${base}/riesgos`,
      regla: 'RN-13',
    })
  }

  // --- Riesgos materializados (RIES-002) ---
  const materializados = resumen.riesgos.filter((r) => r.estado === 'Materializado')
  if (materializados.length > 0) {
    alertas.push({
      id: 'riesgos-materializados',
      severidad: 'alta',
      titulo: `${materializados.length} riesgo(s) materializado(s)`,
      mensaje: 'Requieren plan de respuesta activo y seguimiento en el comite.',
      modulo: 'Riesgos',
      ruta: `${base}/riesgos`,
      regla: 'RIES-002',
    })
  }

  // --- Riesgos activos sin valoracion (HG-090) ---
  const incompletos = resumen.riesgos.filter((r) => r.incompleto)
  if (incompletos.length > 0) {
    alertas.push({
      id: 'riesgos-incompletos',
      severidad: 'media',
      titulo: `${incompletos.length} riesgo(s) activo(s) sin valorar`,
      mensaje: 'Un riesgo activo sin probabilidad o impacto no entra en la severidad ni en el mapa de calor.',
      modulo: 'Riesgos',
      ruta: `${base}/riesgos`,
      regla: 'HG-090',
    })
  }

  // --- Hitos vencidos y proximos (HG-122) ---
  const hitosVencidos = resumen.hitos.filter((h) => h.vencido)
  if (hitosVencidos.length > 0) {
    alertas.push({
      id: 'hitos-vencidos',
      severidad: 'critica',
      titulo: `${hitosVencidos.length} hito(s) vencido(s)`,
      mensaje: hitosVencidos.map((h) => h.descripcion).slice(0, 3).join(' · '),
      modulo: 'Hitos',
      ruta: `${base}/hitos`,
      regla: 'RN-16',
    })
  }
  const ventana = resumen.ctx.parametros.ventanaAlertaDias
  const hitosProximos = resumen.hitos.filter(
    (h) => !h.cumplido && h.diasParaVencer != null && h.diasParaVencer >= 0 && h.diasParaVencer <= ventana,
  )
  if (hitosProximos.length > 0) {
    alertas.push({
      id: 'hitos-proximos',
      severidad: 'media',
      titulo: `${hitosProximos.length} hito(s) en los proximos ${ventana} dias`,
      mensaje: hitosProximos
        .map((h) => `${h.descripcion} (${h.fechaProgramada})`)
        .slice(0, 3)
        .join(' · '),
      modulo: 'Hitos',
      ruta: `${base}/hitos`,
      regla: 'HG-122',
    })
  }

  // --- Hitos condicionantes incumplidos (HG-074) ---
  const condicionantesEnRiesgo = resumen.hitos.filter(
    (h) => h.condicionante && (h.vencido || h.estado === 'No cumplido'),
  )
  if (condicionantesEnRiesgo.length > 0) {
    alertas.push({
      id: 'hitos-condicionantes',
      severidad: 'critica',
      titulo: `${condicionantesEnRiesgo.length} hito(s) condicionante(s) sin cumplir`,
      mensaje: 'Su incumplimiento bloquea actividades posteriores del cronograma.',
      modulo: 'Hitos',
      ruta: `${base}/hitos`,
      regla: 'HG-074',
    })
  }

  // --- Recursos por gestionar (RN-18) ---
  if (resumen.recursos.porGestionar > 0) {
    alertas.push({
      id: 'recursos-por-gestionar',
      severidad: 'media',
      titulo: `${resumen.recursos.porGestionar} recurso(s) por gestionar`,
      mensaje: 'Recursos declarados como necesarios que aun no estan asegurados.',
      modulo: 'Recursos',
      ruta: `${base}/recursos`,
      regla: 'RN-18',
    })
  }
  if (resumen.recursos.noDisponibles > 0) {
    alertas.push({
      id: 'recursos-no-disponibles',
      severidad: 'alta',
      titulo: `${resumen.recursos.noDisponibles} recurso(s) no disponible(s)`,
      mensaje: 'Requieren una alternativa o un ajuste del alcance.',
      modulo: 'Recursos',
      ruta: `${base}/recursos`,
      regla: 'RN-18',
    })
  }

  // --- Integridad RACI (RN-14) ---
  const raciNoConforme = resumen.raci.filter((r) => !r.conforme)
  if (raciNoConforme.length > 0) {
    alertas.push({
      id: 'raci-integridad',
      severidad: 'media',
      titulo: `${raciNoConforme.length} actividad(es) con RACI incompleta`,
      mensaje: 'Cada actividad debe tener exactamente un responsable final (A) y al menos un ejecutor (R).',
      modulo: 'RACI',
      ruta: `${base}/raci`,
      regla: 'RN-14',
    })
  }

  // --- Equipo por definir (RN-19) ---
  if (resumen.equipo.porDefinir > 0) {
    alertas.push({
      id: 'equipo-por-definir',
      severidad: 'media',
      titulo: `${resumen.equipo.porDefinir} perfil(es) del equipo por definir`,
      mensaje: 'Perfiles registrados sin persona designada.',
      modulo: 'Equipo',
      ruta: `${base}/equipo`,
      regla: 'RN-19',
    })
  }

  // --- Ciclos en dependencias (HG-064) ---
  if (resumen.ciclos.length > 0) {
    alertas.push({
      id: 'ciclos-dependencias',
      severidad: 'alta',
      titulo: 'Dependencias circulares en el cronograma',
      mensaje: `Se detectaron ${resumen.ciclos.length} ciclo(s). Mientras existan, la holgura y la ruta critica no se calculan.`,
      modulo: 'Cronograma',
      ruta: `${base}/cronograma`,
      regla: 'RN-17',
    })
  }

  // --- Actividades incompletas (D-14) ---
  const vacias = resumen.actividades.filter((a) => a.vacia)
  if (vacias.length > 0) {
    alertas.push({
      id: 'actividades-incompletas',
      severidad: 'informativa',
      titulo: `${vacias.length} actividad(es) sin datos minimos`,
      mensaje: 'Actividades sin nombre o sin fechas: quedan fuera de los calculos hasta completarse.',
      modulo: 'Cronograma',
      ruta: `${base}/cronograma`,
      regla: 'D-14',
    })
  }

  // --- Recalculo pendiente (HG-138) ---
  if (p.recalculoPendiente) {
    alertas.push({
      id: 'recalculo-pendiente',
      severidad: 'informativa',
      titulo: 'Datos pendientes de recalculo',
      mensaje: 'Los indicadores mostrados no reflejan los ultimos cambios. Ejecute el recalculo del proyecto.',
      modulo: 'Indicadores',
      ruta: `${base}/indicadores`,
      regla: 'HG-138',
    })
  }

  const peso: Record<Alerta['severidad'], number> = {
    critica: 0,
    alta: 1,
    media: 2,
    informativa: 3,
  }
  return alertas.sort((a, b) => peso[a.severidad] - peso[b.severidad])
}
