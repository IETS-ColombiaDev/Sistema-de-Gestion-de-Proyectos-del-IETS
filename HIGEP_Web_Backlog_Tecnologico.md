# HIGEP Web — Backlog Tecnológico por Fases
## Sistema de Gestión de Proyectos del IETS

**Migración de la Herramienta Institucional para la Gestión de Proyectos (HIGEP V2, Excel) a aplicación web**

| Campo | Valor |
|---|---|
| Producto | HIGEP Web — Sistema de Gestión de Proyectos del IETS |
| Origen funcional | HIGEP V2 (libro Excel, 17 hojas), su versión de ejemplo diligenciada e Instructivo de uso v1.0 |
| Base de las reglas | Fórmulas, validaciones y formatos condicionales extraídos directamente de los libros, no del instructivo |
| Stack objetivo | React (SPA) · Firebase (Firestore, Auth, Functions, Hosting, Storage) · Google Sign-In restringido al dominio institucional |
| Alcance del documento | Backlog completo de inicio a fin: descubrimiento, fundaciones, módulos funcionales, migración de datos, calidad, despliegue y evolución |
| Versión del backlog | 1.1 — reglas verificadas contra el archivo fuente |
| Estado | Propuesta para priorización |

> **Nota de confidencialidad:** este documento no contiene datos personales, credenciales, claves, cadenas de conexión, identificadores de proyecto reales ni datos diligenciados de los libros de trabajo. De los archivos se documenta únicamente su estructura y su lógica de cálculo; ningún nombre, correo, cifra presupuestal o contenido del proyecto de ejemplo fue transcrito. Los ejemplos son estructurales. Todo secreto (claves de API, cuentas de servicio, configuraciones de proyecto Firebase) se gestiona exclusivamente por variables de entorno y por el gestor de secretos de la plataforma, nunca en el repositorio ni en documentación.

---

## 1. Objetivo del producto

Llevar HIGEP de un libro Excel monousuario a una aplicación web institucional, multiusuario y multiproyecto, que conserve íntegramente el marco metodológico vigente (planeación, gobierno y control, seguimiento, medición y visualización) y que además resuelva las limitaciones estructurales del archivo actual: concurrencia, trazabilidad automática, control de versiones, integridad referencial, seguridad por rol y consolidación de portafolio.

### 1.1. Problemas del estado actual que el sistema debe resolver

| # | Problema en Excel | Cómo lo resuelve HIGEP Web |
|---|---|---|
| P1 | Un archivo por proyecto; no hay vista de portafolio | Modelo multiproyecto con consolidación institucional |
| P2 | Riesgo de sobrescritura de fórmulas y listas | Cálculos en el servidor/cliente; el usuario nunca edita lógica |
| P3 | Trazabilidad manual (Registro de actualizaciones) | Auditoría automática de cada cambio de campo |
| P4 | Sin control de acceso ni de permisos | Autenticación institucional + roles y reglas de seguridad |
| P5 | Concurrencia por bloqueo de archivo | Escritura concurrente con transacciones |
| P6 | Versiones divergentes del archivo | Fuente única de verdad |
| P7 | Fecha de corte y avance actualizados manualmente | Fecha de corte parametrizable + recálculo automático |
| P8 | Dashboards estáticos que requieren recálculo del libro | Tableros reactivos sobre datos en vivo |

### 1.2. Objetivos medibles del proyecto de desarrollo

- Cobertura funcional del 100 % de las 17 hojas del instructivo (o justificación documentada de exclusión).
- Paridad de resultados con el Excel: diferencia ≤ 0,5 pp en avance ponderado, avance esperado y todos los indicadores, sobre un proyecto de referencia migrado.
- Tiempo de carga del Dashboard ejecutivo por debajo de 2,5 s con un proyecto de 300 actividades.
- 0 accesos posibles desde cuentas ajenas al dominio institucional (verificado por prueba de seguridad).
- Auditoría del 100 % de las escrituras sobre entidades de negocio.

---

## 2. Principios de diseño y decisiones de arquitectura

| ID | Decisión | Justificación | Consecuencia |
|---|---|---|---|
| ADR-01 | SPA en React con enrutamiento por proyecto | Interacción intensiva (Gantt, matrices, tableros) | Requiere manejo cuidadoso de estado del servidor |
| ADR-02 | Firestore como base de datos principal | Tiempo real, reglas de seguridad declarativas, escalado gestionado | Modelo desnormalizado; consultas por índice |
| ADR-03 | Cálculos derivados en Cloud Functions, no en el cliente | Evita divergencias entre usuarios y manipulación desde el navegador | Latencia de recálculo asincrónico; requiere estados de "recalculando" |
| ADR-04 | Autenticación exclusiva con Google, dominio institucional | Reutiliza el directorio corporativo, sin gestión de contraseñas | Dependencia del proveedor de identidad |
| ADR-05 | Roles como *custom claims* en el token, con espejo en base de datos | Reglas de seguridad simples y verificables | Requiere refrescar el token al cambiar de rol |
| ADR-06 | Auditoría inmutable append-only | Reemplaza el Registro de actualizaciones manual | Crecimiento de almacenamiento; requiere política de retención |
| ADR-07 | Catálogo de parámetros y listas en base de datos, no en código | Reproduce la hoja "Parámetros y listas" y permite mantenimiento sin despliegue | Requiere pantalla de administración y control de cambios |
| ADR-08 | Motor de indicadores basado en fórmulas declarativas del catálogo | Permite agregar indicadores sin reescribir código | Mayor complejidad inicial del motor |
| ADR-09 | Soft delete en todas las entidades | Preserva trazabilidad y permite reversión | Todas las consultas filtran por estado de eliminación |
| ADR-10 | Exportación a Excel/PDF como función de servidor | Continuidad con el flujo institucional de entregables | Costo de mantenimiento de plantillas |

### 2.1. Principios funcionales heredados del instructivo (no negociables)

1. Cada dato se registra en el módulo que le corresponde; no se duplica información entre módulos.
2. Los campos calculados nunca son editables por el usuario final.
3. Existe una única fecha de corte coherente para todo el proyecto.
4. Todo cambio relevante queda trazado.
5. Las listas controladas gobiernan los valores permitidos; no se admiten valores libres donde existe lista.
6. Un tablero nunca se corrige directamente: se corrige el dato fuente.

---

## 3. Arquitectura objetivo

### 3.1. Componentes

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Cliente | React + TypeScript, enrutador SPA, librería de estado del servidor | Interfaz, validación de formularios, visualizaciones |
| Autenticación | Firebase Auth con proveedor Google | Identidad institucional, sesión, claims de rol |
| Datos | Cloud Firestore | Persistencia de proyectos y entidades asociadas |
| Lógica de servidor | Cloud Functions | Recálculos, indicadores, auditoría, importación, exportación, funciones de bloqueo de acceso |
| Archivos | Cloud Storage | Evidencias de hitos y productos, adjuntos, exportables generados |
| Distribución | Firebase Hosting | Entrega del SPA con dominios propios y entornos separados |
| Observabilidad | Registro de la plataforma + monitoreo de errores del cliente | Diagnóstico y alertas |

### 3.2. Entornos

| Entorno | Propósito | Datos | Acceso |
|---|---|---|---|
| Local | Desarrollo | Emuladores con datos sintéticos | Equipo de desarrollo |
| Desarrollo | Integración continua | Sintéticos | Equipo de desarrollo |
| Pruebas | Validación funcional y UAT | Anonimizados o sintéticos | Equipo funcional + líderes de proyecto |
| Producción | Operación institucional | Reales | Usuarios autorizados |

Regla: los datos de producción no se copian a entornos inferiores sin anonimización previa.

---

## 4. Modelo de datos (Firestore)

Modelo lógico de referencia. Los nombres son propuestas y se confirman en la Fase 1.

```
usuarios/{uid}
proyectos/{proyectoId}
  ├── equipo/{miembroId}
  ├── actividades/{actividadId}
  ├── hitos/{hitoId}
  ├── raci/{asignacionId}
  ├── riesgos/{riesgoId}
  ├── recursos/{recursoId}
  ├── productos/{productoId}
  ├── satisfaccion/{medicionId}
  ├── presupuesto/{registroId}
  ├── indicadores/{indicadorId}        (resultados calculados)
  ├── snapshots/{fechaCorte}           (histórico para series de tiempo)
  └── auditoria/{eventoId}             (append-only)
catalogos/
  ├── indicadores/{codigo}             (PRY-Oxxx, GEST-xxx)
  ├── listas/{listaId}                 (estados, disponibilidad, escalas)
  └── parametros/{parametroId}         (ventana de alertas, umbrales)
```

### 4.1. Entidades principales — campos de referencia

| Entidad | Campos de captura | Campos calculados |
|---|---|---|
| Proyecto (Ficha) | código, nombre, tecnología u objeto de evaluación, alcance, objetivo general, objetivos específicos, marco metodológico, productos, entidad ejecutora, financiador/contratante, líder, fecha de inicio, fecha de entrega final, fecha de corte | estado global, avance ponderado, días restantes |
| Miembro del equipo | rol/perfil, dedicación (unidad por definir: % o horas-mes), meses de vinculación, estado de vinculación, identificador de usuario institucional | costo estimado de dedicación (si aplica) |
| Actividad | fase, nombre, entregable/producto asociado, responsable, apoyo, fecha inicio, fecha fin, % avance | duración en días hábiles, estado (Pendiente / En curso / Completada / Retrasada), avance esperado, barra Gantt |
| Hito | descripción, criterio de cumplimiento, fecha programada, estado, fecha real, actividades condicionadas, evidencia | cumplimiento, desviación en días, marca de ruta crítica |
| Asignación RACI | actividad, persona/rol, letra (R/A/C/I) | conteo de A por actividad, alerta de integridad |
| Riesgo | categoría, descripción, probabilidad (1–5), impacto (1–5), plan de mitigación/respuesta, responsable, estado | severidad, nivel (Bajo/Medio/Alto/Crítico) |
| Recurso | tipo, descripción, cantidad/detalle, fases requeridas, disponibilidad | alerta de recursos por gestionar |
| Producto | entregable, fecha de entrega, fecha de evaluación, evaluado, conforme, observaciones, responsable | índice de productos conformes |
| Medición de satisfacción | periodo, grupo/parte interesada, encuestados, satisfechos, instrumento/fuente, responsable | índice de satisfacción |
| Registro presupuestal | periodo, programado, ejecutado, observaciones, responsable | desviación en valor, desviación en porcentaje |
| Evento de auditoría | fecha/hora, usuario, tipo, entidad afectada, campo, valor anterior, valor nuevo, comentario | — |

### 4.2. Listas controladas (catálogo)

| Lista | Valores |
|---|---|
| Estado de actividad | Pendiente · En curso · Completada · Retrasada |
| Estado de hito | Pendiente · En curso · Cumplido · Cumplido con retraso · No cumplido |
| Estado de riesgo | Identificado · En mitigación · Materializado · Cerrado |
| Nivel de riesgo | Bajo (1–4) · Medio (5–9) · Alto (10–14) · Crítico (15–25) |
| Disponibilidad de recurso | Por gestionar · Disponible · Reservado · No disponible |
| Estado de indicador | Cumple · Atención · Crítico |
| Escala de probabilidad e impacto | 1 · 2 · 3 · 4 · 5 (enteros) |
| Rol RACI | R · A · C · I |
| Estado de vinculación | Por definir · Contactado · Confirmado · Contratado · No disponible |
| Tipo de cambio (auditoría) | Actividad · Hito · Riesgo · Recurso · Decisión · Otro |
| Tipo de recurso | Humano · Tecnológico · Información · Logístico |
| Categoría de indicador | Eficacia · Eficiencia · Calidad · Efectividad · Gestión · Riesgo |
| Sentido del indicador | Mayor es mejor · Menor es mejor |
| Fases del proyecto | Definidas por proyecto; el archivo trae una lista de referencia de ocho fases más "Transversal" |

Advertencia heredada: el archivo actual contiene **dos taxonomías de fase distintas** — la lista del catálogo y los rótulos escritos a mano en el bloque de avance por fase del tablero, que no coinciden entre sí. En la aplicación la lista de fases es única por proyecto y el tablero la consume, nunca la reescribe.

---

## 5. Reglas de negocio del motor de cálculo

Las reglas siguientes fueron extraídas directamente de las fórmulas del libro HIGEP V2 y de su versión de ejemplo, no del instructivo. Donde el libro y el instructivo difieren, se indica. Las reglas marcadas como **saneada** corrigen un defecto verificado del archivo; su adopción es una decisión funcional que debe tomarse en la Fase 0 (ver épica EP-30 y Anexo C).

### 5.1. Reglas de cronograma y avance

| ID | Regla | Definición en el libro | Definición propuesta para HIGEP Web |
|---|---|---|---|
| RN-01 | Estado de la actividad | `SI(avance ≥ 100%, "Completada"; SI(corte > fin, "Retrasada"; SI(corte ≥ inicio, "En curso"; "Pendiente")))`. La versión de ejemplo antepone una guarda: si la actividad está vacía, el estado queda en blanco | Idéntica, con la guarda de fila vacía obligatoria. El orden de evaluación se conserva: "Completada" prevalece sobre "Retrasada" |
| RN-02 | Duración de la actividad | `fin − inicio − 2`. Pese al rótulo "Días Hábiles" de la columna, es una resta de días calendario menos 2, no un conteo de días laborables | **Saneada:** días hábiles reales entre inicio y fin, excluyendo sábados, domingos y festivos de Colombia. Se conserva la fórmula heredada como modo de compatibilidad para la prueba de paridad |
| RN-03 | Avance simple | `PROMEDIO(% avance del rango de actividades)` | Promedio del % de avance de las actividades no vacías. Se excluyen filas vacías del promedio |
| RN-04 | Avance global ponderado por duración | `SUMAPRODUCTO(duración; avance) / SUMA(duración)` | Igual, con la duración de RN-02 saneada y excluyendo filas vacías del denominador |
| RN-05 | Avance esperado a la fecha de corte | `[ Σ (corte ≥ fin) × duración + Σ (corte ≥ inicio) × (corte < fin) × (corte − inicio + 1) ] / Σ duración`. El numerador mezcla dos unidades: para actividades terminadas usa `fin − inicio − 2` y para actividades en curso usa días calendario transcurridos `+1` | **Saneada:** ambos términos en la misma unidad de duración. Actividades vencidas aportan su duración completa; actividades en curso aportan la fracción de duración transcurrida a la fecha de corte |
| RN-06 | Desviación del avance | `avance ponderado − avance esperado`. Alertas con umbrales fijos en la fórmula: "ATENCIÓN" bajo −10 puntos, "Precaución" bajo −5 puntos | Igual, con los dos umbrales tomados de parámetros configurables en lugar de estar embebidos |
| RN-07 | Actividades retrasadas | `CONTAR.SI(estado; "Retrasada")` sobre el rango de actividades | Igual, sobre las actividades vigentes del proyecto |
| RN-08 | Distribución por estado | Conteo por cada uno de los cuatro estados y porcentaje sobre el total, donde el total es `CONTARA(columna Actividad)` | Igual |
| RN-09 | Avance por fase | `CONTAR.SI(fase; nombre de fase)` y `SUMAR.SI(fase; nombre; avance) / número de actividades de la fase` | Igual, pero la lista de fases proviene del catálogo del proyecto, no de rótulos escritos a mano en el tablero |
| RN-10 | Proximidad de la entrega final | `FECHA(2026;12;15) − fecha de corte`, con alerta cuando el resultado es ≤ 21 días o negativo | **Saneada:** usa la fecha de entrega final registrada en la Ficha y la ventana de alertas del catálogo de parámetros |
| RN-11 | Barra de Gantt | Formato condicional semanal: la celda se colorea cuando `inicio ≤ inicio_de_semana + 6` y `fin ≥ inicio_de_semana`; el color depende del estado. Una regla adicional resalta la columna que contiene la fecha de corte | Render por rango de fechas con la misma lógica de solape, sin ventana fija de semanas y con resolución configurable (semana o mes) |

### 5.2. Reglas de riesgos, RACI, hitos y recursos

| ID | Regla | Definición en el libro | Definición propuesta para HIGEP Web |
|---|---|---|---|
| RN-12 | Severidad del riesgo | `SI(O(probabilidad=""; impacto=""); ""; probabilidad × impacto)` | Igual. Probabilidad e impacto son enteros de 1 a 5, validados |
| RN-13 | Nivel del riesgo | `≤4 "Bajo"; ≤9 "Medio"; ≤14 "Alto"; en otro caso "Crítico"` | Igual, sin cambios |
| RN-14 | Integridad RACI | `CONTAR.SI(columnas de actores; "A")` por actividad; el formato condicional resalta el valor distinto de 1 | Igual en la regla, corrigiendo el resalte: la alerta se aplica sobre el conteo, no sobre la columna contigua |
| RN-15 | Actores de la RACI | Ocho columnas fijas con nombres de rol escritos en el encabezado; las actividades se transcriben a mano y no están enlazadas al cronograma | **Saneada:** los actores provienen del equipo del proyecto y las actividades del cronograma; sin transcripción manual ni límite de ocho actores |
| RN-16 | Estado del hito | Lista de cinco valores: Pendiente, En curso, Cumplido, Cumplido con retraso, No cumplido | Igual, unificando el vocabulario en todos los módulos |
| RN-17 | Holgura y ruta crítica | Sección enteramente manual: la holgura es el texto "0 días" precargado y no hay cálculo de dependencias | **Saneada:** holgura calculada a partir de las dependencias declaradas entre actividades, o el módulo se marca explícitamente como registro manual |
| RN-18 | Disponibilidad de recursos | `CONTAR.SI(disponibilidad; "Por gestionar") + CONTAR.SI(disponibilidad; "En gestión")` y `CONTAR.SI(disponibilidad; "No disponible")` | **Saneada:** conteo sobre la lista controlada única (Por gestionar, Disponible, Reservado, No disponible) |
| RN-19 | Conformación del equipo | `CONTAR.SI(estado de vinculación; "Por definir")` | Igual. Estados: Por definir, Contactado, Confirmado, Contratado, No disponible |
| RN-20 | Dedicación del equipo | El libro registra la dedicación como porcentaje; el instructivo la describe como horas/mes | Decisión pendiente en Fase 0: se adopta una sola unidad y se documenta |

### 5.3. Reglas de medición

| ID | Regla | Definición en el libro | Definición propuesta para HIGEP Web |
|---|---|---|---|
| RN-21 | Índice de satisfacción por medición | `satisfechos / encuestados` por fila | Igual, con validación de que satisfechos ≤ encuestados |
| RN-22 | Desviación presupuestal por registro | `ejecutado − programado` en valor y `(ejecutado − programado) / programado` en porcentaje | Igual |
| RN-23 | Conformidad de producto | Los campos Evaluado y Conforme son texto libre precargado en "No"; las fórmulas comparan contra el literal "Sí", sensible a tilde y mayúscula | **Saneada:** campos booleanos, sin dependencia de la ortografía del texto |
| RN-24 | Estado del indicador, sentido "mayor es mejor" | `SI(resultado ≥ meta; "Cumple"; SI(resultado ≥ meta × 0,9; "Atención"; "Crítico"))` | Igual, con el factor 0,9 configurable por indicador |
| RN-25 | Estado del indicador, sentido "menor es mejor" | `SI(resultado ≤ meta; "Cumple"; SI(resultado ≤ meta × 2; "Atención"; "Crítico"))` | Igual, con el factor 2 configurable por indicador |
| RN-26 | Fecha de corte única | Las fórmulas leen la celda C10 de la hoja Cronograma. La hoja de parámetros contiene además un campo "Fecha de corte" que ninguna fórmula utiliza, y en la plantilla los dos valores difieren en un año | **Saneada:** una sola fecha de corte por proyecto, sin duplicado |
| RN-27 | Rango de avance | Validación de datos entre 0 y 1 (0 % a 100 %), sin admitir celda vacía | Igual |
| RN-28 | Coherencia de fechas | El libro no valida que fin ≥ inicio ni que las fechas caigan dentro de la vigencia del proyecto | **Saneada:** validación bloqueante para fin < inicio y advertencia cuando la actividad sale de la vigencia |

### 5.4. Catálogo de indicadores institucionales

El libro contiene **diez** indicadores, dos más que los ocho listados en el instructivo: RIES-001 y RIES-002 existen en el catálogo y se calculan en la hoja Indicadores, pero no aparecen en la tabla del instructivo. El backlog los incluye.

| Código | Indicador | Categoría | Meta | Sentido | Fórmula real en el libro |
|---|---|---|---|---|---|
| PRY-O001 | Cumplimiento del cronograma | Eficacia | 95 % | Mayor es mejor | Actividades con fin ≤ corte y estado "Completada" ÷ actividades con fin ≤ corte |
| PRY-O002 | Cumplimiento de entregables | Eficacia | 95 % | Mayor es mejor | Hitos con fecha programada ≤ corte, estado "Cumplido" y fecha real ≤ programada ÷ hitos con fecha programada ≤ corte |
| PRY-O003 | Índice de Productos Conformes | Calidad | 90 % | Mayor es mejor | Productos evaluados y conformes ÷ productos evaluados |
| PRY-O004 | Desviación presupuestal | Eficiencia | ±5 % | Menor es mejor | `ABS(SUMA(desviación % de cada registro))` — **defecto:** suma porcentajes de filas distintas. Ver D-05 |
| PRY-O005 | Índice de Satisfacción | Efectividad | 90 % | Mayor es mejor | Σ satisfechos ÷ Σ encuestados |
| GEST-001 | Avance global del proyecto | Gestión | 100 % | Mayor es mejor | Toma el avance ponderado del tablero (RN-04) |
| GEST-002 | Actividades retrasadas | Gestión | ≤ 5 % | Menor es mejor | Actividades retrasadas ÷ total de actividades |
| GEST-003 | Cumplimiento de hitos | Gestión | 95 % | Mayor es mejor | Hitos "Cumplido" ÷ hitos registrados. **Nota:** no cuenta "Cumplido con retraso" |
| RIES-001 | Riesgos críticos abiertos | Riesgo | 0 | Menor es mejor | Riesgos de nivel "Crítico" con estado distinto de "Cerrado" |
| RIES-002 | Riesgos materializados | Riesgo | 0 | Menor es mejor | Riesgos con estado "Materializado" |

Cada indicador del catálogo define además objetivo, fuente, frecuencia, responsable y grado de automatización; el modelo de datos debe conservar esos siete atributos.

### 5.5. Límites de capacidad del archivo actual

Las fórmulas del libro operan sobre rangos fijos. Estos topes son un motivo central de la migración y desaparecen en la aplicación.

| Módulo | Rango de la fórmula | Capacidad máxima |
|---|---|---|
| Cronograma | filas 14 a 38 (validación hasta 39) | 25 actividades |
| Gantt | columnas L a AF, semanas fijas de agosto a diciembre | 21 semanas |
| Hitos | validación en filas 14 a 23; indicadores leen hasta la 59 | 10 hitos validados, 46 leídos |
| Ruta crítica | filas 38 a 47 | 10 actividades críticas |
| Matriz RACI | filas 17 a 42, actores en columnas E a L | 26 actividades, 8 actores |
| Matriz de riesgos | filas 13 a 23 | 11 riesgos |
| Recursos e insumos | filas 13 a 16 | 4 recursos, uno por tipo |
| Registro de productos | filas 10 a 19 | 10 productos |
| Registro de satisfacción | filas 8 a 37 | 30 mediciones |
| Control presupuestal | filas 8 a 37 | 30 registros |
| Registro de actualizaciones | hasta la fila 1006 | ~995 cambios |

---

## 6. Roles y permisos

| Rol | Descripción | Capacidades |
|---|---|---|
| Administrador del sistema | Administra catálogos, parámetros, usuarios y roles | Todo, en todos los proyectos |
| Líder de proyecto | Responsable del proyecto | Crear/editar todo el contenido de sus proyectos; cerrar el proyecto |
| Gestor de proyecto | Apoyo operativo | Registrar avance, riesgos, recursos, productos; sin cerrar proyecto ni editar ficha |
| Miembro del equipo | Ejecuta actividades | Actualizar avance de sus actividades asignadas y adjuntar evidencias |
| Directivo / consulta | Lectura gerencial | Ver dashboards y tableros del portafolio; sin edición |
| Auditor | Verificación | Lectura total, incluida la auditoría; sin edición |

Principios: privilegio mínimo, permisos verificados en el servidor (nunca solo en la interfaz), y toda comprobación de rol expresada en reglas de seguridad de la base de datos.

---

## 7. Convenciones del backlog

- **Formato de historia:** *Como \<rol\>, quiero \<capacidad\>, para \<beneficio\>.*
- **Estimación:** puntos de historia (1, 2, 3, 5, 8, 13). Mayor a 13 se descompone.
- **Prioridad:** M = imprescindible, S = deseable, C = opcional, W = fuera del alcance inicial.
- **Sprints:** 2 semanas.
- **Identificadores:** `HG-###` correlativo, agrupado por épica `EP-##`.

### 7.1. Definición de Preparado (DoR)

1. Historia con criterios de aceptación verificables.
2. Reglas de negocio asociadas identificadas.
3. Diseño de interfaz aprobado cuando la historia tiene pantalla nueva.
4. Dependencias resueltas o explícitamente aceptadas.
5. Estimada por el equipo.

### 7.2. Definición de Terminado (DoD)

1. Código revisado por par y fusionado a la rama principal.
2. Pruebas unitarias de reglas de negocio y pruebas de integración de la historia.
3. Reglas de seguridad actualizadas y con prueba automatizada.
4. Eventos de auditoría emitidos para las escrituras nuevas.
5. Accesible por teclado y con contraste conforme a WCAG 2.1 AA.
6. Sin errores de consola ni advertencias de tipos.
7. Desplegada en el entorno de pruebas y validada funcionalmente.
8. Documentación de usuario actualizada cuando cambia el flujo.

---

# 8. Backlog por fases

## FASE 0 — Descubrimiento y encuadre
**Objetivo:** cerrar decisiones funcionales y técnicas antes de escribir código de producto.
**Duración estimada:** 2 semanas · **Sprint:** 0

### EP-01 · Análisis funcional del instrumento actual

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-001 | Inventario campo a campo de las 17 hojas de HIGEP V2 | Matriz que clasifica cada campo en: captura, calculado, lista controlada o decorativo; incluye tipo de dato y obligatoriedad | M | 5 |
| HG-002 | Extracción y documentación de todas las fórmulas del libro | Cada fórmula traducida a pseudocódigo y asociada a una regla RN-xx. **Ejecutado:** ver secciones 5.1 a 5.3 | M | 8 |
| HG-003 | Inventario de validaciones de datos y formatos condicionales | Listado de reglas de validación con su hoja, rango y comportamiento esperado. **Ejecutado:** ver secciones 5.1 a 5.5 y Anexo C | M | 3 |
| HG-004 | Mapeo hoja Excel → módulo web | Tabla de correspondencia aprobada por el área funcional | M | 2 |
| HG-005 | Identificación de brechas y funciones no migrables tal cual | Documento de decisiones con alternativa propuesta para cada brecha | M | 3 |
| HG-006 | Definición del proyecto de referencia para pruebas de paridad | Proyecto seleccionado y datos exportados en formato neutro y anonimizado | M | 2 |

### EP-02 · Definición de producto

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-007 | Definición del modelo de roles y matriz de permisos | Matriz rol × acción × entidad aprobada | M | 3 |
| HG-008 | Modelo de datos lógico y diccionario de datos | Diagrama de entidades y diccionario revisados técnica y funcionalmente | M | 5 |
| HG-009 | Definición de política de retención y de datos personales | Documento con base legal del tratamiento, retención y minimización de datos del equipo | M | 3 |
| HG-010 | Arquitectura de información y flujos de navegación | Mapa de navegación y flujos principales validados | M | 3 |
| HG-011 | Prototipo navegable de baja fidelidad de los módulos núcleo | Prototipo revisado con al menos 3 usuarios funcionales; hallazgos documentados | S | 5 |
| HG-012 | Definición de criterios de aceptación de paridad numérica | Umbral de tolerancia acordado, método de comparación definido y distinción explícita entre modo compatibilidad y modo saneado | M | 3 |

### EP-30 · Saneamiento de reglas heredadas

Cada historia de esta épica es una **decisión funcional**, no una tarea de desarrollo: define si HIGEP Web reproduce el comportamiento actual del archivo o corrige el defecto. La decisión la toma el área dueña del instrumento y queda documentada. El detalle de cada hallazgo está en el Anexo C.

| ID | Decisión requerida | Hallazgo | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|---|
| HG-198 | Definición de la duración de la actividad | D-01 | Se decide entre días hábiles reales o la resta heredada; la decisión queda escrita y afecta a RN-02, RN-04 y RN-05 | M | 3 |
| HG-199 | Corrección del avance esperado | D-02 | Se aprueba la fórmula con unidades homogéneas y se documenta el efecto sobre la serie histórica | M | 3 |
| HG-200 | Origen de la fecha de entrega final y de la ventana de alertas | D-03 | Se confirma que ambos valores salen de la Ficha y del catálogo de parámetros, no de constantes | M | 2 |
| HG-201 | Fuente única de la fecha de corte | D-04 | Se elimina el duplicado; una sola fecha alimenta todos los cálculos | M | 2 |
| HG-202 | Método de cálculo de la desviación presupuestal | D-05 | Se aprueba el cálculo agregado (Σ ejecutado ÷ Σ programado − 1) en reemplazo de la suma de porcentajes por fila | M | 3 |
| HG-203 | Tratamiento de los hitos "Cumplido con retraso" | D-06 | Se define si cuentan para GEST-003 y con qué ponderación | M | 2 |
| HG-204 | Unificación del vocabulario de estados de hito | D-07 | Una sola lista de estados en todos los módulos y tableros | M | 2 |
| HG-205 | Unificación de la taxonomía de fases | D-08 | Lista única de fases por proyecto, consumida por cronograma, recursos y tablero | M | 3 |
| HG-206 | Vocabulario único de disponibilidad de recursos | D-09 | Se elimina el estado sin respaldo en la lista controlada | M | 2 |
| HG-207 | Unidad de dedicación del equipo | D-10 | Se adopta porcentaje u horas/mes y se ajusta el instructivo | M | 2 |
| HG-208 | Alcance de la ruta crítica | D-11 | Se decide entre cálculo automático por dependencias o registro manual declarado como tal | M | 3 |
| HG-209 | Vinculación de la matriz RACI al cronograma | D-12 | Se confirma que las actividades y los actores no se transcriben a mano | M | 2 |

**Entregables de fase:** matriz de campos, catálogo de fórmulas, modelo de datos, matriz de permisos, prototipo, documento de decisiones de saneamiento.
**Criterio de salida:** el área funcional confirma que el alcance descrito reproduce el marco metodológico vigente y firma las doce decisiones de saneamiento.

---

## FASE 1 — Fundaciones técnicas
**Objetivo:** dejar lista la plataforma, la identidad y el sistema de diseño.
**Duración estimada:** 3 semanas · **Sprints:** 1–2

### EP-03 · Plataforma y entorno de desarrollo

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-013 | Repositorio, estándar de ramas y convención de commits | Repositorio con plantilla de PR, guía de contribución y ramas protegidas | M | 2 |
| HG-014 | Proyecto React con TypeScript, linting y formateo | El proyecto compila sin advertencias; linters en modo bloqueante | M | 3 |
| HG-015 | Configuración de entornos separados (desarrollo, pruebas, producción) | Tres entornos aislados, con configuración por variables de entorno y sin secretos versionados | M | 5 |
| HG-016 | Integración continua: build, lint, pruebas y análisis de dependencias | La CI bloquea la fusión ante fallo de cualquiera de las etapas | M | 5 |
| HG-017 | Despliegue continuo a pruebas y despliegue manual aprobado a producción | Despliegue reproducible y reversible documentado | M | 5 |
| HG-018 | Emuladores locales de base de datos, autenticación y funciones | Un desarrollador nuevo levanta el entorno completo siguiendo el README | M | 3 |
| HG-019 | Monitoreo de errores del cliente y del servidor | Errores no capturados llegan al panel de monitoreo con trazabilidad de versión | S | 3 |

### EP-04 · Autenticación institucional segura

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-020 | Inicio de sesión con Google | El usuario ingresa con su cuenta institucional sin crear contraseña; la sesión persiste según política definida | M | 5 |
| HG-021 | Restricción por dominio institucional en el cliente | El botón de acceso solicita explícitamente el dominio institucional como sugerencia de cuenta | M | 2 |
| HG-022 | Restricción por dominio verificada en el servidor | Una función de bloqueo previa al registro rechaza cualquier identidad cuyo correo no pertenezca al dominio institucional y esté verificado; la validación no depende del cliente | M | 8 |
| HG-023 | Restricción por dominio en reglas de base de datos | Ninguna lectura o escritura es posible sin token válido del dominio autorizado; probado con caso negativo automatizado | M | 5 |
| HG-024 | Protección contra clientes no autorizados (atestación de app) | Las peticiones desde clientes no registrados son rechazadas | S | 5 |
| HG-025 | Provisión de usuario en el primer acceso | Al primer ingreso se crea el perfil con rol mínimo por defecto y queda pendiente de asignación por el administrador | M | 3 |
| HG-026 | Roles como *claims* verificados en el token | El cambio de rol se refleja tras refrescar el token; el rol nunca se lee desde el cliente para autorizar | M | 8 |
| HG-027 | Cierre de sesión, expiración e invalidación de sesión | La sesión expira según política; el cierre revoca el acceso a datos de inmediato | M | 3 |
| HG-028 | Revocación de acceso por desvinculación | Un usuario desactivado pierde acceso en el siguiente refresco de token, en menos de 60 minutos | M | 5 |
| HG-029 | Pantalla de acceso denegado con mensaje institucional | Un intento con cuenta no institucional recibe un mensaje claro, sin revelar detalle técnico | M | 2 |

### EP-05 · Sistema de diseño y armazón de la aplicación

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-030 | Tokens de diseño institucionales (color, tipografía, espaciado) | Paleta y tipografía institucionales aplicadas de forma centralizada | M | 3 |
| HG-031 | Biblioteca de componentes base (formularios, tablas, modales, alertas) | Componentes documentados y reutilizables, con estados de carga, vacío y error | M | 8 |
| HG-032 | Armazón: barra lateral, cabecera, selector de proyecto y migas de pan | Navegación consistente en todas las rutas | M | 5 |
| HG-033 | Manejo global de estados de carga, vacío y error | Ninguna pantalla queda en blanco sin retroalimentación | M | 3 |
| HG-034 | Accesibilidad base: foco, contraste, etiquetas y navegación por teclado | Auditoría automática sin errores críticos | M | 5 |
| HG-035 | Diseño adaptable a tableta y escritorio | Los módulos núcleo son usables desde 1024 px; el Gantt tiene modo compacto | S | 5 |

**Criterio de salida:** un usuario del dominio institucional inicia sesión, ve el armazón vacío y ningún otro tipo de cuenta puede autenticarse ni leer datos.

---

## FASE 2 — Núcleo del proyecto
**Objetivo:** crear, caracterizar y parametrizar proyectos.
**Duración estimada:** 3 semanas · **Sprints:** 3–4

### EP-06 · Administración de catálogos y parámetros (hoja *Parámetros y listas*)

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-036 | Modelo y siembra inicial de listas controladas | Las listas del instructivo quedan cargadas y versionadas | M | 5 |
| HG-037 | Pantalla de administración de listas | Solo el administrador puede editar; los valores en uso no pueden eliminarse, solo desactivarse | M | 5 |
| HG-038 | Parámetros globales: ventana de alertas y umbrales de desviación | Los cálculos consumen el parámetro vigente; el cambio queda auditado | M | 3 |
| HG-039 | Calendario de días no laborables | Festivos nacionales cargados y editables; alimentan el cálculo de días hábiles | M | 5 |
| HG-040 | Control de cambios en catálogos | Todo cambio de lista o parámetro genera evento de auditoría con valor anterior y nuevo | M | 3 |

### EP-07 · Ficha del proyecto

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-041 | Crear proyecto con datos mínimos | Código y nombre obligatorios; el código es único en el sistema | M | 5 |
| HG-042 | Ficha completa: alcance, objetivos, marco metodológico, productos, entidad, financiador, líder y fechas | Todos los campos del instructivo disponibles y persistidos | M | 8 |
| HG-043 | Objetivos específicos como lista estructurada | Se agregan, editan, reordenan y eliminan; cada uno admite indicador verificable | M | 5 |
| HG-044 | Registro de productos comprometidos (entregables) | Los entregables definidos aquí alimentan el módulo de productos e indicadores | M | 5 |
| HG-045 | Fecha de corte del proyecto | Campo único por proyecto, sin duplicado en catálogos (corrige D-04), editable por líder y gestor; su cambio dispara recálculo de todo el proyecto | M | 5 |
| HG-046 | Validación de coherencia de fechas del proyecto | No se permite fecha de fin anterior a la de inicio; advertencia si la fecha de corte está fuera de la vigencia | M | 3 |
| HG-047 | Estados del ciclo de vida del proyecto (borrador, activo, cerrado) | Un proyecto cerrado pasa a solo lectura salvo para el administrador | M | 5 |
| HG-048 | Listado de proyectos con búsqueda y filtros | Muestra solo los proyectos a los que el usuario tiene acceso; filtra por estado, líder y vigencia | M | 5 |
| HG-049 | Duplicar proyecto como plantilla | Copia estructura (actividades, hitos, RACI, riesgos) sin datos de ejecución | C | 8 |

### EP-08 · Grupo desarrollador

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-050 | Registro de miembros con rol/perfil, dedicación y meses de vinculación | Campos del instructivo disponibles; los datos personales se limitan a lo necesario | M | 5 |
| HG-051 | Vinculación de un miembro a un usuario institucional | La asociación se hace por selección de usuario existente, no por texto libre | M | 5 |
| HG-052 | Perfiles sin nombre asignado (designación pendiente) | Se permite registrar el perfil y la dedicación con estado "por designar" | M | 3 |
| HG-053 | Estado de vinculación y su historial | El cambio de estado queda auditado con fecha | M | 3 |
| HG-054 | Cálculo de dedicación total del equipo | Suma de horas-mes por periodo, visible en el módulo y en el dashboard | S | 5 |

**Criterio de salida:** se crea un proyecto completo con su ficha y su equipo, y la fecha de corte gobierna el resto del sistema.

---

## FASE 3 — Planeación: cronograma, Gantt e hitos
**Objetivo:** replicar la hoja operativa central de HIGEP.
**Duración estimada:** 4 semanas · **Sprints:** 5–6

### EP-09 · Cronograma

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-055 | Alta, edición y baja lógica de actividades | Campos: fase, actividad, responsable, apoyo, inicio, fin, % avance | M | 8 |
| HG-056 | Estructura jerárquica por fases y agrupación de actividades | Las actividades se agrupan por fase; se puede colapsar y expandir | M | 8 |
| HG-057 | Cálculo automático de la duración | Implementa RN-02 según la decisión de HG-198; si se adopta días hábiles reales, excluye fines de semana y festivos del calendario configurado | M | 5 |
| HG-058 | Cálculo automático del estado de la actividad | Implementa RN-01 con guarda de fila vacía (D-14); el estado no es editable; muestra el porqué del estado al pasar el cursor | M | 8 |
| HG-059 | Registro del % de avance con validación de rango | Implementa RN-16; rechaza valores fuera de 0–100 % | M | 3 |
| HG-060 | Bloqueo de campos calculados en la interfaz y en el servidor | Un intento de escritura directa sobre un campo calculado es rechazado por las reglas de seguridad | M | 5 |
| HG-061 | Edición masiva de avance desde la vista de tabla | Permite actualizar varias actividades y guardar en una sola transacción | S | 8 |
| HG-062 | Filtros por fase, responsable y estado | Reproduce los filtros de la hoja original; el filtro se conserva al navegar | M | 5 |
| HG-063 | Reordenamiento y numeración estable de actividades | El identificador de la actividad no cambia al reordenar | S | 5 |
| HG-064 | Dependencias entre actividades (predecesoras) | Permite declarar predecesoras y advierte sobre incoherencias de fechas | C | 13 |

### EP-10 · Diagrama de Gantt

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-065 | Visualización Gantt por actividad y fase | Barras proporcionales a la duración, con escala mensual y semanal | M | 13 |
| HG-066 | Línea de fecha de corte sobre el diagrama | Marca visible y sincronizada con la fecha de corte del proyecto | M | 3 |
| HG-067 | Codificación por color según estado de la actividad | Colores consistentes con la paleta institucional y diferenciables sin depender solo del color | M | 5 |
| HG-068 | Barra de avance dentro de la barra de actividad | El relleno refleja el % de avance registrado | M | 5 |
| HG-069 | Zoom, desplazamiento horizontal y salto a "hoy" | Interacción fluida con 300 actividades | S | 8 |
| HG-070 | Exportación del Gantt a imagen o PDF | El exportable conserva leyenda, fecha de corte y nombre del proyecto | S | 8 |
| HG-071 | Rendimiento del Gantt con proyectos grandes | Renderizado por virtualización; menos de 2,5 s con 300 actividades | M | 8 |

### EP-11 · Hitos y ruta crítica

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-072 | Registro de hitos con criterio de cumplimiento | Campos: hito, criterio, fecha programada, estado, fecha real | M | 5 |
| HG-073 | Vinculación de hitos con actividades del cronograma | Un hito puede asociarse a una o varias actividades; se advierte si las fechas no son coherentes | M | 5 |
| HG-074 | Marcado de hitos condicionantes | Se identifican los hitos que habilitan actividades posteriores y se destacan en el tablero | M | 5 |
| HG-075 | Cálculo de cumplimiento y desviación en días | Comparación entre fecha programada y fecha real | M | 5 |
| HG-076 | Adjunto de evidencia del hito | Archivos con control de tipo y tamaño; acceso restringido por permisos del proyecto | S | 8 |
| HG-077 | Visualización de hitos sobre el Gantt | Los hitos aparecen como marcadores en la línea de tiempo | S | 5 |

**Criterio de salida:** el cronograma, sus estados automáticos y el Gantt reproducen fielmente los resultados del libro de referencia.

---

## FASE 4 — Gobierno y control
**Objetivo:** responsabilidades, riesgos y recursos.
**Duración estimada:** 3 semanas · **Sprints:** 7–8

### EP-12 · Matriz RACI

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-078 | Matriz actividad × persona/rol editable | Asignación de R, A, C, I por celda; los actores provienen del equipo del proyecto | M | 13 |
| HG-079 | Control de unicidad de la A | Implementa RN-14; señala en rojo la propia celda de conteo de las actividades con cero o más de una A (corrige D-13) | M | 5 |
| HG-080 | Panel de integridad RACI | Lista de incumplimientos con enlace directo a la actividad afectada | M | 5 |
| HG-081 | Vista por persona | Muestra todas las actividades donde una persona es R, A, C o I | S | 5 |
| HG-082 | Exportación de la matriz RACI | Exportable a Excel conservando la estructura de matriz | S | 5 |

### EP-13 · Matriz de riesgos

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-083 | Registro de riesgos con categoría y descripción | Categorías desde lista controlada | M | 5 |
| HG-084 | Valoración con escalas 1–5 y cálculo de severidad | Implementa RN-08; severidad no editable | M | 5 |
| HG-085 | Clasificación automática por nivel | Implementa RN-09 con los cortes exactos del instructivo | M | 3 |
| HG-086 | Plan de mitigación, responsable y estado del riesgo | Estados desde lista controlada; el cambio queda auditado | M | 5 |
| HG-087 | Mapa de calor probabilidad × impacto | Matriz 5×5 con conteo de riesgos por celda y acceso al detalle | S | 8 |
| HG-088 | Alertas por riesgo crítico | Los riesgos críticos se destacan en el tablero y en el dashboard ejecutivo | M | 5 |
| HG-089 | Historial de valoración del riesgo | Permite ver cómo evolucionaron probabilidad, impacto y estado en el tiempo | S | 8 |
| HG-090 | Validación de completitud de riesgos activos | Un riesgo activo sin probabilidad o impacto genera advertencia de integridad | M | 3 |

### EP-14 · Recursos e insumos

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-091 | Registro de recursos por tipo (humano, tecnológico, información, logístico) | Tipos desde lista controlada | M | 5 |
| HG-092 | Cantidad, detalle y fases en que se requiere el recurso | Selección múltiple de fases del cronograma | M | 5 |
| HG-093 | Gestión de disponibilidad | Estados: Por gestionar, Disponible, Reservado, No disponible | M | 3 |
| HG-094 | Alerta de recursos por gestionar | Conteo visible en tablero y dashboard, con enlace al detalle | M | 3 |
| HG-095 | Vista de recursos por fase | Permite anticipar necesidades por fase próxima | S | 5 |

**Criterio de salida:** el proyecto puede gobernarse: responsabilidades unívocas, riesgos valorados y recursos con disponibilidad conocida.

---

## FASE 5 — Medición
**Objetivo:** capturar datos fuente y calcular indicadores institucionales.
**Duración estimada:** 4 semanas · **Sprints:** 9–10

### EP-15 · Registro de productos

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-096 | Registro de entrega y evaluación de productos | Fechas de entrega y evaluación, marcas booleanas de evaluado y conforme (corrige D-15), observaciones y responsable | M | 5 |
| HG-097 | Regla de conformidad con evidencia | No se permite declarar conforme un producto sin evidencia de evaluación registrada | M | 5 |
| HG-098 | Adjunto de evidencia del producto | Control de tipo y tamaño; acceso restringido | S | 5 |
| HG-099 | Cálculo del Índice de Productos Conformes | Implementa RN-11 y alimenta PRY-O003 | M | 5 |
| HG-100 | Trazabilidad producto ↔ hito ↔ actividad | Un producto puede vincularse a su hito y actividades de origen | S | 5 |

### EP-16 · Registro de satisfacción

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-101 | Registro de mediciones por periodo y parte interesada | Campos: periodo, grupo, encuestados, satisfechos, instrumento/fuente, responsable | M | 5 |
| HG-102 | Cálculo del índice de satisfacción | Implementa RN-12; controla división por cero | M | 3 |
| HG-103 | Serie histórica de satisfacción | Gráfico de evolución por periodo y por grupo | S | 5 |
| HG-104 | Validación de coherencia | Los satisfechos no pueden superar a los encuestados | M | 2 |

### EP-17 · Control presupuestal

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-105 | Registro de presupuesto programado y ejecutado por rubro y periodo | Valores numéricos con formato de moneda local | M | 5 |
| HG-106 | Cálculo de desviación presupuestal | Implementa RN-22 por registro y el agregado del proyecto según la decisión de HG-202; alimenta PRY-O004 | M | 5 |
| HG-107 | Restricción de edición al rol autorizado | Solo líder y administrador editan; los demás solo consultan | M | 3 |
| HG-108 | Indicación de fuente financiera del dato | Campo obligatorio de fuente para cada registro, conforme a la regla de integridad | M | 3 |
| HG-109 | Curva de ejecución programada frente a ejecutada | Gráfico acumulado por periodo | S | 8 |

### EP-18 · Motor de indicadores

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-110 | Catálogo de indicadores administrable | Cada indicador define nombre, categoría, fórmula, fuente, frecuencia, meta, rangos y responsable | M | 8 |
| HG-111 | Motor de cálculo de indicadores | Calcula los diez indicadores del catálogo (incluidos RIES-001 y RIES-002) a partir de los datos fuente, sin intervención manual | M | 13 |
| HG-112 | Semáforo de estado del indicador | Implementa RN-15 con los estados Cumple, Atención y Crítico | M | 5 |
| HG-113 | Recálculo automático ante cambio de dato fuente o de fecha de corte | El resultado se actualiza en menos de 30 s tras el cambio; se muestra la marca de último cálculo | M | 8 |
| HG-114 | Manejo de indicadores sin datos suficientes | Se muestra "sin datos" en lugar de cero, con explicación del insumo faltante | M | 5 |
| HG-115 | Histórico de indicadores por fecha de corte | Cada corte genera una instantánea consultable | S | 8 |
| HG-116 | Ficha técnica del indicador | Muestra definición, fórmula, fuente, frecuencia, meta y responsable | S | 5 |

**Criterio de salida:** todos los indicadores del catálogo se calculan automáticamente y coinciden con el libro de referencia dentro de la tolerancia definida.

---

## FASE 6 — Seguimiento y trazabilidad
**Objetivo:** sustituir el tablero operativo y el registro manual de actualizaciones.
**Duración estimada:** 3 semanas · **Sprints:** 11–12

### EP-19 · Tablero de seguimiento

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-117 | Vista consolidada de avance del proyecto | Muestra avance ponderado, avance simple y avance esperado (RN-03, RN-04, RN-05), este último con unidades homogéneas según HG-199 | M | 8 |
| HG-118 | Cálculo y presentación de la desviación del avance | Implementa RN-06 con los dos umbrales tomados de parámetros configurables | M | 5 |
| HG-119 | Panel de actividades retrasadas | Implementa RN-07; lista accionable con enlace a cada actividad | M | 5 |
| HG-119b | Panel de avance por fase | Implementa RN-09 sobre la lista única de fases del proyecto (corrige D-08) | M | 5 |
| HG-120 | Panel de riesgos críticos | Alerta cuando existen riesgos de severidad crítica | M | 3 |
| HG-121 | Alerta de proximidad de entrega final | Implementa RN-10 con la fecha de la Ficha y la ventana de alertas del catálogo (corrige D-03) | M | 5 |
| HG-122 | Panel de hitos próximos y vencidos | Ordenado por fecha, con estado y responsable | M | 5 |
| HG-123 | Centro de alertas unificado | Reúne todas las alertas activas del proyecto con severidad y enlace de resolución | S | 8 |

### EP-20 · Auditoría y trazabilidad

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-124 | Registro automático de eventos de auditoría | Toda escritura genera evento con fecha, usuario, tipo, entidad, campo, valor anterior y nuevo | M | 13 |
| HG-125 | Inmutabilidad del registro de auditoría | Ningún rol puede editar ni borrar eventos; verificado por prueba de reglas | M | 5 |
| HG-126 | Comentario de justificación en cambios sensibles | Cambios de fechas aprobadas, cierre de riesgos y conformidad de productos exigen comentario | M | 5 |
| HG-127 | Consulta de auditoría con filtros | Filtros por fecha, usuario, tipo de cambio y entidad afectada | M | 8 |
| HG-128 | Historial por entidad | Desde cualquier actividad, riesgo, hito o producto se accede a su historial completo | M | 8 |
| HG-129 | Exportación del registro de auditoría | Exportable a Excel para efectos de control interno | S | 5 |
| HG-130 | Política de retención y archivado de auditoría | Eventos antiguos se archivan según la política definida en Fase 0, sin pérdida de trazabilidad | S | 8 |

**Criterio de salida:** el Registro de actualizaciones manual queda reemplazado por trazabilidad automática y consultable.

---

## FASE 7 — Dashboards y lectura gerencial
**Objetivo:** visualización consolidada para decisión.
**Duración estimada:** 3 semanas · **Sprints:** 13–14

### EP-21 · Dashboard ejecutivo

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-131 | Encabezado con fecha de corte y estado general | La fecha de corte es lo primero visible, conforme al instructivo | M | 3 |
| HG-132 | Tarjetas de avance ponderado, esperado y desviación | Con indicación visual de brecha y umbral | M | 5 |
| HG-133 | Panel de actividades por estado | Conteo y distribución de Pendiente, En curso, Completada, Retrasada | M | 5 |
| HG-134 | Panel de riesgos por nivel | Distribución por Bajo, Medio, Alto y Crítico | M | 5 |
| HG-135 | Panel de recursos por disponibilidad | Destaca los recursos por gestionar | M | 3 |
| HG-136 | Panel de hitos y entregables | Cumplidos, pendientes y vencidos | M | 5 |
| HG-137 | Resumen de indicadores por categoría | Eficacia, eficiencia, calidad, efectividad y gestión | M | 5 |
| HG-138 | Estado de "datos desactualizados" | Si hay un recálculo pendiente, el tablero lo advierte en lugar de mostrar cifras viejas como vigentes | M | 5 |

### EP-22 · Dashboard de indicadores

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-139 | Vista por categorías de indicador | Agrupa por eficacia, eficiencia, calidad, efectividad, gestión y riesgo | M | 8 |
| HG-140 | Comparación resultado frente a meta | Visualización clara de brecha y estado | M | 5 |
| HG-141 | Evolución del indicador en el tiempo | Serie basada en las instantáneas por fecha de corte | S | 8 |
| HG-142 | Detalle de trazabilidad del indicador | Desde el resultado se navega a los datos fuente que lo componen | S | 8 |
| HG-143 | Bloqueo de edición manual de resultados | No existe ruta, en interfaz ni en base de datos, para alterar un resultado sin corregir el dato fuente | M | 3 |

### EP-23 · Portafolio y reportería

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-144 | Vista de portafolio institucional | Consolida todos los proyectos activos con avance, alertas y riesgos críticos | M | 13 |
| HG-145 | Filtros de portafolio por líder, vigencia, estado y financiador | Los filtros son combinables y se pueden guardar como vista | S | 8 |
| HG-146 | Exportación de reporte ejecutivo del proyecto | Genera un documento con la estructura institucional y la marca de fecha de corte | M | 13 |
| HG-147 | Exportación del proyecto completo a Excel | Reproduce las hojas equivalentes para continuidad y respaldo | S | 13 |
| HG-148 | Programación de envío periódico del reporte | Envío automático al líder y a la dirección, según periodicidad configurable | C | 13 |

**Criterio de salida:** la dirección puede leer el estado de un proyecto y del portafolio sin abrir ningún archivo.

---

## FASE 8 — Migración desde el instrumento Excel
**Objetivo:** cargar los proyectos existentes sin pérdida de información.
**Duración estimada:** 2 semanas · **Sprints:** 15

### EP-24 · Importación y validación

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-149 | Plantilla oficial de importación | Plantilla publicada con las columnas esperadas por módulo y sus reglas | M | 5 |
| HG-150 | Importador de libro HIGEP V2 | Lee las hojas de captura del libro y las convierte al modelo de datos | M | 13 |
| HG-151 | Validación previa con informe de hallazgos | Antes de escribir, se muestra el detalle de filas válidas, con advertencia y con error | M | 8 |
| HG-152 | Importación transaccional y reversible | Una importación fallida no deja datos parciales; toda importación puede revertirse | M | 8 |
| HG-153 | Registro de auditoría de la importación | Queda constancia de quién importó, cuándo, qué archivo y cuántos registros | M | 3 |
| HG-154 | Prueba de paridad numérica con el libro origen | Diferencias dentro de la tolerancia acordada en todos los indicadores y avances | M | 8 |
| HG-155 | Migración de los proyectos vigentes | Todos los proyectos activos cargados y validados por su líder | M | 8 |

**Criterio de salida:** cada líder de proyecto confirma por escrito que los datos migrados coinciden con su libro.

---

## FASE 9 — Calidad, seguridad y desempeño
**Objetivo:** endurecer el sistema antes de producción.
**Duración estimada:** 3 semanas · **Sprints:** 16–17

### EP-25 · Estrategia de pruebas

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-156 | Pruebas unitarias del motor de cálculo | Cobertura de todas las reglas RN-01 a RN-18, con casos límite (proyecto sin actividades, fechas iguales, avance 0 y 100 %) | M | 13 |
| HG-157 | Pruebas automatizadas de reglas de seguridad | Casos positivos y negativos por rol y por entidad; incluye intento de acceso desde fuera del dominio | M | 13 |
| HG-158 | Pruebas de integración por módulo | Cada módulo probado contra emuladores | M | 13 |
| HG-159 | Pruebas de extremo a extremo de los flujos críticos | Ingreso, creación de proyecto, actualización semanal, consulta de dashboard y cierre | M | 13 |
| HG-160 | Pruebas de regresión de paridad con el Excel | Suite ejecutable sobre el proyecto de referencia en cada versión, en dos modos: compatibilidad (coincide con el archivo dentro de la tolerancia) y saneado (cada diferencia queda explicada por un hallazgo del Anexo C) | M | 13 |
| HG-161 | Pruebas de aceptación con usuarios (UAT) | Guion de pruebas por rol, con registro de hallazgos y cierre de cada uno | M | 8 |

### EP-26 · Seguridad

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-162 | Revisión completa de reglas de seguridad de la base de datos | Ningún camino de lectura o escritura queda sin regla explícita; principio de denegación por defecto | M | 8 |
| HG-163 | Reglas de seguridad del almacenamiento de archivos | Solo miembros del proyecto acceden a sus evidencias; validación de tipo y tamaño | M | 5 |
| HG-164 | Validación de entrada en servidor para toda escritura | Ninguna escritura confía en la validación del cliente | M | 8 |
| HG-165 | Encabezados de seguridad y política de contenido | Encabezados de seguridad configurados en el alojamiento | M | 5 |
| HG-166 | Revisión de dependencias y actualización de vulnerabilidades | La CI falla ante vulnerabilidades altas o críticas sin excepción documentada | M | 5 |
| HG-167 | Prueba de intrusión básica y corrección de hallazgos | Informe con hallazgos cerrados o con plan de tratamiento aceptado | M | 13 |
| HG-168 | Minimización y protección de datos personales | Solo se almacenan los datos del equipo necesarios; documentado en la política de tratamiento | M | 5 |
| HG-169 | Respaldo y prueba de restauración | Respaldo automático diario; restauración probada en entorno aislado | M | 8 |
| HG-170 | Control de acceso a la consola de la plataforma | Acceso administrativo limitado, nominal y con doble factor | M | 3 |

### EP-27 · Desempeño y confiabilidad

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-171 | Índices de consulta y optimización de lecturas | Todas las consultas del sistema tienen índice; sin lecturas completas de colección | M | 8 |
| HG-172 | Paginación y virtualización en listados grandes | Listados de 1000 registros sin degradación perceptible | M | 8 |
| HG-173 | Pruebas de carga con volumen objetivo | 50 usuarios concurrentes y 30 proyectos sin degradación de la experiencia | S | 8 |
| HG-174 | Control de costo de operación | Panel de consumo revisado; alertas de umbral configuradas | S | 5 |
| HG-175 | Manejo de fallos de red y reintentos | La aplicación informa el estado de conexión y reintenta escrituras fallidas sin duplicar datos | M | 8 |

---

## FASE 10 — Despliegue y adopción
**Objetivo:** puesta en producción controlada y apropiación institucional.
**Duración estimada:** 2 semanas · **Sprints:** 18

### EP-28 · Puesta en producción

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-176 | Dominio institucional y certificado | La aplicación responde en la ruta institucional definida, con conexión cifrada | M | 5 |
| HG-177 | Lista de verificación de salida a producción | Todos los puntos verificados y firmados antes del despliegue | M | 3 |
| HG-178 | Plan de reversión | Procedimiento probado para volver a la versión anterior en menos de 30 minutos | M | 5 |
| HG-179 | Despliegue piloto con un grupo reducido de proyectos | Piloto de 2 semanas con seguimiento de incidencias | M | 8 |
| HG-180 | Despliegue general | Todos los proyectos vigentes operando en la aplicación | M | 5 |
| HG-181 | Congelamiento del uso del libro Excel como fuente oficial | Comunicación institucional y archivo de los libros como respaldo histórico | M | 3 |

### EP-29 · Documentación y capacitación

| ID | Historia / tarea | Criterios de aceptación | Prio | Pts |
|---|---|---|---|---|
| HG-182 | Instructivo de uso de HIGEP Web | Documento equivalente al instructivo actual, adaptado a la aplicación | M | 8 |
| HG-183 | Ayuda contextual dentro de la aplicación | Cada módulo incluye una explicación breve de qué registrar y qué se calcula | M | 8 |
| HG-184 | Manual técnico y de administración | Cubre arquitectura, despliegue, catálogos, roles y operación | M | 8 |
| HG-185 | Sesiones de capacitación por rol | Al menos una sesión por rol, con material y grabación disponible | M | 5 |
| HG-186 | Mesa de ayuda y canal de reporte de incidencias | Canal definido, con tiempos de respuesta acordados | M | 3 |
| HG-187 | Guía rápida de la rutina semanal | Documento de una página con el procedimiento de actualización semanal | M | 3 |

---

## FASE 11 — Evolución posterior
**Objetivo:** capacidades que superan al instrumento original. No hacen parte de la primera versión.

| ID | Historia | Prio | Pts |
|---|---|---|---|
| HG-188 | Notificaciones por correo de alertas críticas y vencimientos | S | 13 |
| HG-189 | Comentarios y menciones en actividades, riesgos y productos | C | 13 |
| HG-190 | Aplicación adaptada a móvil para registro de avance | C | 13 |
| HG-191 | Interoperabilidad con el repositorio institucional de productos | C | 13 |
| HG-192 | Línea base del cronograma y comparación con la ejecución | S | 13 |
| HG-193 | Cálculo formal de ruta crítica a partir de dependencias | C | 13 |
| HG-194 | Planificación de capacidad del equipo entre proyectos | C | 13 |
| HG-195 | Tablero público de transparencia con datos agregados | W | 13 |
| HG-196 | Interfaz de programación para consumo por otros sistemas institucionales | C | 13 |
| HG-197 | Flujo de aprobación formal de cambios al cronograma | S | 13 |

---

## 9. Resumen de esfuerzo por fase

| Fase | Épicas | Historias | Puntos aprox. | Duración |
|---|---|---|---|---|
| 0 · Descubrimiento | 3 | 24 | 72 | 2 semanas |
| 1 · Fundaciones | 3 | 23 | 105 | 3 semanas |
| 2 · Núcleo | 3 | 19 | 89 | 3 semanas |
| 3 · Planeación | 3 | 23 | 148 | 4 semanas |
| 4 · Gobierno y control | 3 | 18 | 91 | 3 semanas |
| 5 · Medición | 4 | 21 | 116 | 4 semanas |
| 6 · Seguimiento | 2 | 14 | 88 | 3 semanas |
| 7 · Dashboards | 3 | 18 | 133 | 3 semanas |
| 8 · Migración | 1 | 7 | 53 | 2 semanas |
| 9 · Calidad y seguridad | 3 | 20 | 172 | 3 semanas |
| 10 · Despliegue y adopción | 2 | 12 | 64 | 2 semanas |
| **Total v1.0** | **30** | **199** | **≈1.130** | **≈32 semanas** |
| 11 · Evolución | 1 | 10 | 130 | Posterior |

La duración supone un equipo de 2 desarrolladores, 1 analista funcional a medio tiempo, 1 diseñador a medio tiempo y 1 líder de producto del área. Con un equipo menor, la ruta mínima viable son las fases 0–3, 6 y 10, con las demás en despliegues incrementales.

### 9.1. Producto mínimo viable propuesto

Fases 0, 1, 2, 3 y el tablero básico de la Fase 6, más la migración de un proyecto piloto. Entrega en aproximadamente 14 semanas un sistema que ya sustituye la operación semanal del cronograma, que es el uso más frecuente del instrumento.

---

## 10. Riesgos del proyecto de desarrollo

| ID | Riesgo | Prob. | Impacto | Nivel | Respuesta |
|---|---|---|---|---|---|
| RD-01 | Los cálculos del sistema no coinciden con los del Excel y se pierde confianza | 4 | 5 | Crítico | Suite de paridad automatizada desde la Fase 3; validación con el líder de cada proyecto migrado |
| RD-02 | Resistencia al cambio y regreso al uso del archivo | 4 | 4 | Alto | Piloto acompañado, capacitación por rol, congelamiento formal del libro como fuente oficial |
| RD-03 | Complejidad subestimada del Gantt interactivo | 3 | 4 | Medio | Prueba de concepto temprana; alcance inicial de solo lectura con edición en tabla |
| RD-04 | Cambios de alcance durante la construcción | 4 | 3 | Medio | Alcance congelado por fase; nuevos requerimientos al backlog de evolución |
| RD-05 | Dependencia de un único desarrollador con conocimiento del motor de cálculo | 3 | 4 | Medio | Revisión por pares obligatoria, documentación de reglas y pruebas exhaustivas |
| RD-06 | Datos personales del equipo tratados sin base documentada | 2 | 5 | Medio | Política de tratamiento definida en Fase 0; minimización de campos |
| RD-07 | Costos de operación superiores a lo previsto | 2 | 3 | Bajo | Índices y paginación desde el diseño; alertas de consumo |
| RD-08 | Retraso en la definición de roles y permisos institucionales | 3 | 3 | Medio | Decisión con fecha límite en Fase 0; modelo por defecto si no hay definición |
| RD-09 | Migración incompleta por libros con estructura alterada | 3 | 4 | Medio | Validación previa con informe de hallazgos; corrección en origen antes de importar |
| RD-10 | Indisponibilidad del servicio de identidad institucional | 2 | 4 | Medio | Procedimiento de contingencia documentado y comunicado |
| RD-11 | Se replican en la aplicación los defectos de cálculo del archivo por reproducir la paridad a ciegas | 4 | 4 | Alto | Épica EP-30: cada defecto se decide explícitamente antes de construir; la suite de paridad distingue diferencias esperadas de errores |
| RD-12 | Las cifras cambian tras el saneamiento y se cuestiona la validez de los reportes históricos | 3 | 4 | Medio | Comunicar el efecto de cada corrección con antes y después sobre el proyecto de referencia; conservar el modo de compatibilidad para la comparación |

---

## 11. Anexo A — Mapeo hoja Excel → módulo web

| # | Hoja HIGEP V2 | Módulo web | Épica | Observación de la auditoría |
|---|---|---|---|---|
| 1 | Ficha | Ficha del proyecto | EP-07 | La fecha de entrega final registrada aquí no la usa ninguna fórmula (D-03) |
| 2 | Grupo desarrollador | Equipo del proyecto | EP-08 | Dedicación en porcentaje, no en horas/mes (D-10) |
| 3 | Cronograma y Gantt | Cronograma + Gantt | EP-09, EP-10 | Hoja operativa central; concentra D-01, D-04 y D-14 |
| 4 | Hitos y ruta crítica | Hitos | EP-11 | La ruta crítica es manual (D-11); rangos inconsistentes (D-16) |
| 5 | Matriz RACI | Matriz RACI | EP-12 | Actividades transcritas a mano (D-12); alerta desalineada (D-13) |
| 6 | Matriz de riesgos | Riesgos | EP-13 | Es el módulo mejor construido del libro; se migra sin cambios de regla |
| 7 | Recursos e insumos | Recursos | EP-14 | Cuatro filas fijas y sin validación de disponibilidad (D-09) |
| 8 | Tablero de seguimiento | Tablero de seguimiento | EP-19 | Concentra D-02, D-03, D-07 y D-08 |
| 9 | Registro de actualizaciones | Auditoría automática | EP-20 | Manual por diseño; la nota del archivo advierte que automatizarlo exigiría macros |
| 10 | Catálogo de indicadores | Catálogo de indicadores | EP-18 | Contiene diez indicadores, no ocho (D-17) |
| 11 | Indicadores | Motor y resultados de indicadores | EP-18 | Contiene D-05 y D-06 |
| 12 | Registro de productos | Productos | EP-15 | Conformidad como texto libre (D-15) |
| 13 | Registro de satisfacción | Satisfacción | EP-16 | Cálculo correcto; se migra sin cambios de regla |
| 14 | Control presupuestal | Presupuesto | EP-17 | El cálculo por fila es correcto; el agregado del indicador no (D-05) |
| 15 | Parámetros y listas | Administración de catálogos | EP-06 | Hoja oculta; sus listas no alimentan las validaciones, que están escritas como literales (D-04, D-08) |
| 16 | Dashboard ejecutivo | Dashboard ejecutivo | EP-21 | Cuenta estados de hito inexistentes (D-07) |
| 17 | Dashboard indicadores | Dashboard de indicadores | EP-22 | Depende íntegramente de la hoja Indicadores |

---

## 12. Anexo B — Rutina semanal en la aplicación

Equivalente al procedimiento de actualización semanal del instructivo, ya sin manipulación de fórmulas.

1. Ingresar con la cuenta institucional y seleccionar el proyecto.
2. Actualizar la fecha de corte del proyecto.
3. Registrar el % de avance real de las actividades activas (los estados se recalculan solos).
4. Revisar hitos y actualizar fechas reales o estados cuando corresponda.
5. Actualizar probabilidad, impacto y estado de los riesgos con información nueva.
6. Actualizar la disponibilidad de recursos.
7. Consultar el tablero de seguimiento y el centro de alertas.
8. Consultar los dashboards ejecutivo y de indicadores.
9. Documentar decisiones derivadas del seguimiento en los comentarios de las entidades afectadas.

El paso de registrar manualmente los cambios en el Registro de actualizaciones desaparece: la trazabilidad es automática.

---

## 13. Glosario

| Término | Definición |
|---|---|
| Avance esperado | Porcentaje que debería estar ejecutado a la fecha de corte según la programación |
| Avance ponderado | Avance físico calculado dando a cada actividad un peso proporcional a su duración |
| Fecha de corte | Fecha de referencia única que gobierna todos los cálculos de seguimiento |
| Hito condicionante | Punto de control cuyo incumplimiento bloquea actividades posteriores |
| Nivel de riesgo | Clasificación cualitativa derivada de la severidad |
| Ruta crítica | Secuencia de actividades cuyo retraso desplaza la fecha de finalización del proyecto |
| Severidad | Producto de probabilidad por impacto en la valoración del riesgo |
| Ventana de alertas | Número de días de anticipación con que el sistema advierte una entrega próxima |

---

---

## 14. Anexo C — Hallazgos de la auditoría del archivo fuente

Resultado de comparar el instructivo con las fórmulas, validaciones y formatos condicionales efectivamente presentes en el libro. Cada hallazgo tiene una decisión asociada en la épica EP-30.

| ID | Hallazgo | Módulo | Efecto | Decisión |
|---|---|---|---|---|
| D-01 | La columna rotulada "Días Hábiles" calcula `fin − inicio − 2`, es decir días calendario menos dos, sin excluir fines de semana ni festivos | Cronograma | El peso de cada actividad en el avance ponderado está distorsionado; en actividades largas la subestimación crece de forma proporcional a la duración | HG-198 |
| D-02 | El avance esperado mezcla unidades: para actividades vencidas usa `fin − inicio − 2` y para actividades en curso usa días calendario transcurridos más uno | Tablero | El avance esperado queda inflado y, con él, la desviación y su semáforo | HG-199 |
| D-03 | La fecha de entrega final está escrita como constante dentro de dos fórmulas del tablero, pese a existir el campo en la Ficha; la ventana de alertas usa 21 días fijos aunque el parámetro configurado es 14 | Tablero / Parámetros | Cambiar la fecha en la Ficha o el parámetro no altera las alertas; en otro proyecto la alerta queda sencillamente equivocada | HG-200 |
| D-04 | Existen dos fechas de corte: la celda del cronograma, que alimenta todas las fórmulas, y un campo homónimo en la hoja de parámetros que ninguna fórmula lee. En la plantilla los dos valores difieren en un año | Cronograma / Parámetros | El usuario puede actualizar la fecha equivocada y creer que el tablero se recalculó | HG-201 |
| D-05 | La desviación presupuestal suma los porcentajes de desviación de filas distintas y toma el valor absoluto del total | Indicadores | El resultado no es una desviación: con varios periodos registrados el indicador crece sin significado y el semáforo pierde sentido | HG-202 |
| D-06 | El indicador de cumplimiento de hitos cuenta solo el estado "Cumplido"; el estado "Cumplido con retraso" existe en la lista pero no suma en ninguna parte | Hitos / Indicadores | Los hitos cumplidos tarde se contabilizan igual que los incumplidos | HG-203 |
| D-07 | Coexisten tres vocabularios de estado de hito: la lista de validación con cinco valores, los conteos del tablero con tres, y el dashboard ejecutivo que cuenta dos estados que no existen en ninguna lista | Hitos / Tablero / Dashboard | Los contadores del dashboard devuelven cero de forma permanente | HG-204 |
| D-08 | La lista de fases del catálogo y los rótulos de fase escritos a mano en el bloque de avance por fase del tablero son taxonomías distintas | Parámetros / Tablero | El avance por fase no encuentra coincidencias y queda vacío | HG-205 |
| D-09 | El conteo de recursos por gestionar incluye un estado que no existe en la lista de disponibilidad; además la columna de disponibilidad no tiene validación de datos | Recursos / Tablero | Basta un valor escrito distinto para que el recurso desaparezca de las alertas | HG-206 |
| D-10 | El libro registra la dedicación del equipo en porcentaje; el instructivo la describe en horas/mes | Grupo desarrollador | Dos lecturas distintas del mismo dato entre proyectos | HG-207 |
| D-11 | La sección de ruta crítica es enteramente manual: la holgura viene precargada como el texto "0 días" y no hay cálculo de dependencias | Hitos y ruta crítica | La ruta crítica no es una ruta crítica calculada, sino una lista escrita a mano | HG-208 |
| D-12 | La matriz RACI tiene ocho columnas de actor con nombres fijos y las actividades se transcriben a mano, sin enlace al cronograma | Matriz RACI | Duplicación de información, contra el propio principio de uso del instructivo; el desfase entre ambas hojas es inevitable | HG-209 |
| D-13 | El formato condicional que alerta sobre el número de "A" se aplica sobre la columna contigua a la del conteo | Matriz RACI | La alerta de integridad resalta la casilla equivocada | Incluido en HG-079 |
| D-14 | En la plantilla, las filas de actividad vacías producen estado "Pendiente" y una duración de −2 días. La versión de ejemplo sí incluye la guarda de fila vacía, la plantilla no | Cronograma | El denominador del avance ponderado se reduce y los conteos por estado quedan inflados | Incluido en HG-058 |
| D-15 | Los campos Evaluado y Conforme son texto libre y las fórmulas comparan contra el literal "Sí" | Registro de productos | Un "Si" sin tilde o un "SÍ" en mayúsculas anula el registro en el indicador | Incluido en HG-096 |
| D-16 | Los rangos de lectura no coinciden entre hojas: el tablero lee diez hitos y la hoja de indicadores lee cuarenta y seis; la validación de estado de hito cubre solo los diez primeros | Hitos / Tablero / Indicadores | Dos módulos informan cifras distintas sobre el mismo conjunto de hitos | Resuelto por diseño en el modelo de datos |
| D-17 | El instructivo lista ocho indicadores; el catálogo y la hoja de medición contienen diez, con RIES-001 y RIES-002 ausentes del documento | Catálogo de indicadores | La documentación institucional describe de forma incompleta el instrumento | Actualizar el instructivo (HG-182) |
| D-18 | Toda la lógica opera sobre rangos fijos con topes bajos (25 actividades, 11 riesgos, 10 productos, 4 recursos, 21 semanas de Gantt) | Todos | Un proyecto que supere el tope no falla de forma visible: simplemente deja de contar los registros excedentes | Resuelto por diseño (sección 5.5) |

### 14.1. Lectura de conjunto

Los hallazgos no son errores de digitación: son consecuencia previsible de construir lógica de negocio en fórmulas de hoja de cálculo, donde el vocabulario se repite en literales dispersos y no hay forma de verificar que todos coincidan. Esa es la razón de fondo de la migración, más allá de la concurrencia y del control de acceso.

Dos implicaciones para el proyecto:

1. **La paridad numérica no puede ser el único criterio de aceptación.** Reproducir exactamente el archivo significaría reproducir D-01 a D-05. Por eso la prueba de paridad se ejecuta en dos modos: compatibilidad, que replica el comportamiento heredado y debe coincidir dentro de la tolerancia, y saneado, que aplica las correcciones aprobadas y cuya diferencia se explica hallazgo por hallazgo.
2. **El instructivo debe actualizarse junto con el sistema.** Al menos los puntos D-03, D-06, D-10 y D-17 describen hoy un comportamiento que el archivo no tiene.

---

**Fin del documento.**
