# Trazabilidad: backlog → implementación

Este documento responde dos preguntas de control: **qué del backlog está construido y dónde**, y
**qué se decidió sobre cada defecto del archivo fuente**.

---

## 1. Épicas y su implementación

| Épica | Módulo | Implementación | Estado |
|---|---|---|---|
| EP-01 · Análisis del instrumento | — | Reglas extraídas y codificadas en `domain/reglas.ts`; hallazgos en la sección 3 de este documento | Ejecutado |
| EP-02 · Definición de producto | — | Modelo en `domain/types.ts`, roles en `auth/permisos.ts`, navegación en `app/navegacion.tsx` | Ejecutado |
| EP-03 · Plataforma y entorno | — | `frontend/` (Vite + React + TypeScript), `firebase.json`, emuladores configurados | Construido |
| EP-04 · Autenticación institucional | Ingreso | `auth/AuthContext.tsx`, `functions/src/index.ts` → `bloqueoDeAcceso` | Construido (Google pendiente de credenciales) |
| EP-05 · Sistema de diseño y armazón | — | `styles/theme.ts`, `styles/components.css`, `components/`, `app/Layout*.tsx` | Construido |
| EP-06 · Catálogos y parámetros | Catálogos y parámetros | `modules/catalogos/Catalogos.tsx`, `domain/catalogos.ts` | Construido |
| EP-07 · Ficha del proyecto | Ficha del proyecto | `modules/proyectos/Ficha.tsx`, `modules/proyectos/ListaProyectos.tsx` | Construido |
| EP-08 · Grupo desarrollador | Grupo desarrollador | `modules/equipo/Equipo.tsx` | Construido |
| EP-09 · Cronograma | Cronograma | `modules/cronograma/Cronograma.tsx` | Construido |
| EP-10 · Diagrama de Gantt | Diagrama de Gantt | `modules/gantt/Gantt.tsx` | Construido |
| EP-11 · Hitos y ruta crítica | Hitos y ruta crítica | `modules/hitos/Hitos.tsx`, CPM en `reglas.aplicarRutaCritica` | Construido |
| EP-12 · Matriz RACI | Matriz RACI | `modules/raci/Raci.tsx`, `reglas.integridadRaci` | Construido |
| EP-13 · Matriz de riesgos | Matriz de riesgos | `modules/riesgos/Riesgos.tsx`, mapa de calor en `charts/MapaCalor` | Construido |
| EP-14 · Recursos e insumos | Recursos e insumos | `modules/recursos/Recursos.tsx` | Construido |
| EP-15 · Registro de productos | Registro de productos | `modules/productos/Productos.tsx` | Construido |
| EP-16 · Registro de satisfacción | Satisfacción | `modules/satisfaccion/Satisfaccion.tsx` | Construido |
| EP-17 · Control presupuestal | Control presupuestal | `modules/presupuesto/Presupuesto.tsx` | Construido |
| EP-18 · Motor de indicadores | Indicadores · Catálogo de indicadores | `domain/indicadores.ts`, `modules/indicadores/`, `modules/catalogos/CatalogoIndicadores.tsx` | Construido |
| EP-19 · Tablero de seguimiento | Tablero de seguimiento | `modules/tablero/Tablero.tsx`, `domain/alertas.ts` | Construido |
| EP-20 · Auditoría y trazabilidad | Auditoría | `data/auditoria.ts`, `data/repo.ts`, `modules/auditoria/` | Construido |
| EP-21 · Dashboard ejecutivo | Dashboard ejecutivo | `modules/dashboard/DashboardEjecutivo.tsx` | Construido |
| EP-22 · Dashboard de indicadores | Indicadores | `modules/indicadores/Indicadores.tsx` (categorías, tabla, histórico) | Construido |
| EP-23 · Portafolio y reportería | Portafolio | `modules/portafolio/Portafolio.tsx`, `app/usePortafolio.ts`, `lib/exportar.ts` | Construido |
| EP-24 · Importación y validación | Importar y exportar | `modules/importacion/Importacion.tsx` | Construido |
| EP-25 · Estrategia de pruebas | — | 146 pruebas en `domain/__tests__/`, `data/__tests__/`, `auth/__tests__/` | Construido |
| EP-26 · Seguridad | — | `firestore.rules`, `storage.rules`, cabeceras y CSP en `firebase.json` | Construido |
| EP-27 · Desempeño | — | División de código por módulo, memoización del motor, virtualización del Gantt por rango | Construido |
| EP-28 · Puesta en producción | — | `docs/DESPLIEGUE.md`, `firebase.json`, funciones programadas | Documentado |
| EP-29 · Documentación | — | `README.md` y `docs/` | Construido |
| EP-30 · Saneamiento de reglas | Importar y exportar → Paridad | Modo doble en `reglas.ts` e `indicadores.ts`; comparador en la pestaña de paridad | Construido |

---

## 2. Historias con decisión explícita

Estas historias del backlog pedían **decidir**, no solo construir. Lo decidido:

| Historia | Decisión adoptada | Dónde |
|---|---|---|
| HG-198 (D-01) | Duración en **días hábiles reales**, excluyendo fines de semana y festivos. Se conserva la fórmula heredada como modo de compatibilidad | `reglas.duracionActividad` |
| HG-199 (D-02) | Avance esperado con **numerador y denominador en la misma unidad**: la actividad vencida aporta su duración completa; la que está en curso, la fracción de duración transcurrida | `reglas.avanceEsperado` |
| HG-200 (D-03) | La alerta de entrega usa la **fecha de la Ficha** y la **ventana del catálogo**; nada embebido en fórmulas | `reglas.proximidadEntrega` |
| HG-201 (D-04) | **Una sola fecha de corte** por proyecto, en la Ficha. El catálogo de parámetros no la duplica | `types.Proyecto.fechaCorte` |
| HG-202 (D-05) | Desviación presupuestal sobre **los totales** del proyecto, no como suma de porcentajes de filas | `indicadores.FORMULAS.desviacionPresupuestal` |
| HG-203 (D-06) | "Cumplido con retraso" **cuenta como cumplido** en GEST-003 | `indicadores.FORMULAS.cumplimientoHitos` |
| HG-204 (D-07) | **Vocabulario único** de cinco estados de hito en todos los módulos | `types.ESTADOS_HITO` |
| HG-205 (D-08) | El avance por fase consume la **lista única de fases del proyecto** | `reglas.avancePorFase` |
| HG-206 (D-09) | Disponibilidad de recurso desde **lista controlada única**, con validación | `types.DISPONIBILIDAD_RECURSO` |
| HG-207 (D-10) | Dedicación del equipo en **horas/mes**, unidad única del sistema | `types.MiembroEquipo.dedicacionHorasMes` |
| HG-208 (D-11) | Holgura y ruta crítica **calculadas** por el método CPM sobre las dependencias declaradas | `reglas.aplicarRutaCritica` |
| HG-209 (D-12) | Actividades y actores de la RACI **provienen del cronograma y del equipo**; sin transcripción ni límite de ocho actores | `modules/raci/Raci.tsx` |

---

## 3. Estado de los hallazgos del Anexo C

| ID | Hallazgo | Estado | Cómo se resolvió |
|---|---|---|---|
| D-01 | "Días hábiles" era `fin − inicio − 2` | **Saneado** | Días hábiles reales; modo compatibilidad disponible |
| D-02 | Avance esperado mezclaba unidades | **Saneado** | Ambos términos en duración hábil |
| D-03 | Fecha de entrega y ventana embebidas en fórmulas | **Saneado** | Fecha de la Ficha + parámetro del catálogo |
| D-04 | Dos fechas de corte | **Saneado** | Una sola, en la Ficha |
| D-05 | Desviación presupuestal sumaba porcentajes de filas | **Saneado** | Cálculo sobre totales |
| D-06 | "Cumplido con retraso" no sumaba | **Saneado** | Cuenta como cumplido |
| D-07 | Tres vocabularios de estado de hito | **Saneado** | Lista única de cinco valores, no editable |
| D-08 | Dos taxonomías de fase | **Saneado** | Lista única por proyecto, administrada en la Ficha |
| D-09 | Conteo de recursos con un estado inexistente | **Saneado** | Lista controlada única |
| D-10 | Dedicación en porcentaje o en horas/mes | **Decidido** | Horas/mes |
| D-11 | Ruta crítica manual | **Saneado** | Calculada por CPM |
| D-12 | RACI transcrita a mano, ocho actores | **Saneado** | Del cronograma y del equipo, sin límite |
| D-13 | Alerta de integridad en la columna equivocada | **Corregido** | La alerta se aplica sobre la propia celda de conteo |
| D-14 | Filas vacías producían estado y duración −2 | **Corregido** | Guarda de fila vacía obligatoria |
| D-15 | Conformidad como texto libre | **Corregido** | Campos booleanos |
| D-16 | Rangos de lectura distintos entre hojas | **Resuelto por diseño** | Una sola colección por entidad |
| D-17 | El instructivo lista ocho indicadores; el libro tiene diez | **Incluidos los diez** | RIES-001 y RIES-002 en el catálogo |
| D-18 | Topes por rangos fijos | **Resuelto por diseño** | Sin topes |

Cada corrección que **cambia una cifra** (D-01, D-02, D-05, D-06) es medible en la pestaña
**Importar y exportar → Paridad de cálculos**: se ejecuta el motor en los dos modos sobre los
mismos datos y se explica cada diferencia con su hallazgo asociado.

---

## 4. Cobertura de pruebas

146 pruebas automatizadas:

| Suite | Qué verifica |
|---|---|
| `domain/__tests__/fechas.test.ts` | Aritmética en UTC, días hábiles, festivos de Colombia con Ley Emiliani |
| `domain/__tests__/reglas.test.ts` | RN-01 a RN-28, en los dos modos, incluidos los casos límite de cada hallazgo |
| `domain/__tests__/indicadores.test.ts` | Los diez indicadores, el semáforo, "sin datos" y las diferencias entre modos |
| `data/__tests__/repo.test.ts` | CRUD, baja lógica, restauración, auditoría campo a campo, lotes, catálogos |
| `auth/__tests__/permisos.test.ts` | Matriz rol × acción, proyecto cerrado, visibilidad del portafolio |

Lo que estas pruebas fijan como contrato:

- Una actividad sin nombre o sin fechas **no participa** en ningún agregado.
- El avance esperado **nunca excede 100 %**.
- El modo compatibilidad **infla** el avance esperado frente al saneado (efecto de D-02).
- La desviación presupuestal heredada **crece sin significado** al acumular periodos (efecto de D-05).
- Un indicador sin insumos devuelve **"sin datos"**, nunca cero.
- Una escritura sin cambios reales **no genera** evento de auditoría.
- Un alta genera **un** evento resumido; una actualización, **uno por campo**.
- Un ciclo en las dependencias **no cuelga** el cálculo: deja la holgura sin calcular y lo advierte.

---

## 5. Fuera del alcance de esta entrega

| Punto | Motivo |
|---|---|
| Ingreso con Google en producción | Requiere el proyecto Firebase y sus credenciales. El código está construido (`AuthContext` + `bloqueoDeAcceso`); se activa con `VITE_BACKEND=firebase` |
| Adjuntos en Cloud Storage | El modelo (`Adjunto`), las reglas de Storage y los controles de tipo y tamaño están definidos; falta conectar la carga a un bucket real |
| Envío periódico del reporte (HG-148) | Marcado como opcional (prioridad C) en el backlog |
| Exportación a PDF con plantilla del servidor | Se resuelve con la impresión del navegador y hoja de estilos de impresión; la plantilla de servidor es evolución posterior |
