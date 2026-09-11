# Reglas de negocio: definición, implementación y prueba

Las 28 reglas del backlog, con el sitio exacto donde viven y la prueba que las fija.
Todas se implementan como **funciones puras** en `frontend/src/domain/`: reciben datos y
parámetros, devuelven resultados. No leen del navegador ni de la base de datos.

Notación: **H** = definición heredada del libro Excel · **S** = definición saneada.

---

## Cronograma y avance

### RN-01 · Estado de la actividad
`reglas.estadoActividad`

Orden de evaluación conservado literalmente del libro: **"Completada" prevalece sobre "Retrasada"**.
Una actividad al 100 % con la fecha fin ya pasada es Completada, no Retrasada.

```
si el avance >= 100          -> Completada
si el corte > fin            -> Retrasada
si el corte >= inicio        -> En curso
en otro caso                 -> Pendiente
```

**Guarda de fila vacía (D-14):** sin nombre o sin fechas, la actividad no produce estado y queda
fuera de todos los agregados. La plantilla original no tenía esta guarda, lo que reducía el
denominador del avance ponderado e inflaba los conteos por estado.

Cada estado se acompaña de su razón, visible al pasar el cursor: el usuario nunca ve un estado sin
saber de dónde sale.

### RN-02 · Duración de la actividad
`reglas.duracionActividad` · hallazgo **D-01**

- **H:** `fin − inicio − 2`. Pese al rótulo "Días Hábiles", era una resta de días calendario
  menos dos.
- **S:** días hábiles reales en el intervalo cerrado, excluyendo sábados, domingos y los festivos
  del catálogo. Mínimo 1 para una actividad válida: una duración cero o negativa distorsionaría el
  denominador del avance ponderado.

Los festivos de Colombia se **calculan** (Ley 51 de 1983, con Pascua por el algoritmo de Butcher),
no se transcriben: el sistema no caduca. `fechas.festivosColombia` produce 18 festivos por año.

### RN-03 · Avance simple
`reglas.avanceSimple` — promedio del avance de las actividades no vacías. Solo de referencia: no
pondera por duración, así que no debe usarse para reportar el avance del proyecto.

### RN-04 · Avance global ponderado
`reglas.avancePonderado` — `Σ(duración × avance) / Σ duración`, sobre actividades no vacías con
duración positiva. Devuelve 0, nunca NaN, cuando no hay actividades vigentes.

### RN-05 · Avance esperado a la fecha de corte
`reglas.avanceEsperado` · hallazgo **D-02**

- **H:** el numerador mezclaba unidades — para las actividades terminadas usaba `fin − inicio − 2`
  y para las que estaban en curso, días calendario transcurridos más uno. El resultado quedaba
  inflado y con él la desviación y su semáforo.
- **S:** ambos términos en la misma unidad de duración. La actividad vencida aporta su duración
  completa; la que está en curso, la fracción de duración transcurrida. El resultado **nunca
  excede 100 %**.

### RN-06 · Desviación del avance
`reglas.desviacionAvance` · hallazgo **D-03**

`avance ponderado − avance esperado`, en puntos porcentuales. Los dos umbrales —precaución y
atención— provienen del catálogo de parámetros, no de literales embebidos en la fórmula.

### RN-07 · Actividades retrasadas
`reglas.actividadesRetrasadas` — sobre las actividades vigentes del proyecto.

### RN-08 · Distribución por estado
`reglas.distribucionPorEstado` — conteo y porcentaje por cada uno de los cuatro estados. El total
excluye las filas vacías, de modo que los porcentajes suman 100 %.

### RN-09 · Avance por fase
`reglas.avancePorFase` · hallazgo **D-08**

La lista de fases proviene del **catálogo del proyecto**, nunca de rótulos escritos a mano en el
tablero. En el archivo original las dos taxonomías no coincidían y el bloque quedaba vacío. El
avance de cada fase se pondera por duración, en coherencia con RN-04.

### RN-10 · Proximidad de la entrega final
`reglas.proximidadEntrega` · hallazgo **D-03**

- **H:** `FECHA(2026;12;15) − fecha de corte`, con la ventana fija en 21 días aunque el parámetro
  configurado fuera 14. Cambiar la fecha en la Ficha no alteraba la alerta.
- **S:** fecha de entrega de la Ficha y ventana del catálogo de parámetros.

### RN-11 · Solape para la barra de Gantt
`reglas.solapaPeriodo` — una actividad ocupa un periodo si `inicio <= fin del periodo` y
`fin >= inicio del periodo`. La misma lógica del formato condicional del libro, sin la ventana fija
de 21 semanas.

---

## Riesgos, RACI, hitos y recursos

### RN-12 · Severidad del riesgo
`reglas.severidadRiesgo` — `probabilidad × impacto`. Nula si falta cualquiera de los dos factores.
Ambos son enteros de 1 a 5, validados en la captura.

### RN-13 · Nivel del riesgo
`reglas.nivelRiesgo` — cortes exactos del instructivo: `≤4` Bajo · `≤9` Medio · `≤14` Alto ·
resto Crítico.

### RN-14 · Integridad RACI
`reglas.integridadRaci` · hallazgo **D-13**

Exactamente una **A** por actividad, y al menos una **R**. La alerta se aplica sobre la propia
celda de conteo; en el libro el formato condicional resaltaba la columna contigua.

Una celda de la matriz sostiene **una sola letra**: una persona no puede ser a la vez R y A de la
misma actividad. Si los datos traen más de una asignación para el mismo par (actividad, persona),
prevalece la última actualizada — la misma regla que aplica la interfaz, de modo que el panel de
integridad y la matriz nunca informan cosas distintas.

### RN-15 · Actores de la matriz
`modules/raci/Raci.tsx` · hallazgo **D-12**

Los actores provienen del equipo del proyecto y las actividades del cronograma. Sin transcripción
manual y sin el límite de ocho columnas.

### RN-16 · Estado del hito
`reglas.calcularHitos` · hallazgo **D-07**

Vocabulario único de cinco valores en todos los módulos: Pendiente · En curso · Cumplido ·
Cumplido con retraso · No cumplido. El libro tenía tres vocabularios distintos y el dashboard
contaba dos estados que no existían en ninguna lista, por lo que sus contadores devolvían cero de
forma permanente.

Se calculan además: cumplimiento, desviación en días entre programada y real, condición de vencido
y pertenencia a la ruta crítica.

### RN-17 · Holgura y ruta crítica
`reglas.aplicarRutaCritica` · hallazgo **D-11**

- **H:** sección enteramente manual. La holgura venía precargada como el texto "0 días" y no había
  cálculo de dependencias.
- **S:** método de la ruta crítica en días hábiles sobre las predecesoras declaradas. Pase hacia
  adelante para inicio y fin tempranos, pase hacia atrás para los tardíos, holgura como diferencia.
  Holgura cero significa ruta crítica.

Si el grafo tiene **ciclos**, se detectan (`reglas.detectarCiclos`) y esas actividades quedan sin
holgura en lugar de colgar el cálculo. La interfaz lo advierte y señala cuántos ciclos hay.

### RN-18 · Disponibilidad de recursos
`reglas.resumenRecursos` · hallazgo **D-09**

Conteo sobre la lista controlada única: Por gestionar · Disponible · Reservado · No disponible. El
libro contaba un estado inexistente ("En gestión") y la columna no tenía validación: bastaba un
valor escrito distinto para que el recurso desapareciera de las alertas.

### RN-19 · Conformación del equipo
`reglas.resumenEquipo` — conteo por estado de vinculación y suma de dedicación.

### RN-20 · Dedicación del equipo
`types.MiembroEquipo.dedicacionHorasMes` · hallazgo **D-10**

El libro la registraba en porcentaje; el instructivo la describía en horas/mes. Decisión adoptada:
**horas/mes**, unidad única del sistema.

---

## Medición

### RN-21 · Índice de satisfacción
`reglas.indiceSatisfaccion` — `satisfechos / encuestados`, con control de división por cero:
devuelve *sin dato*, no cero.

### RN-22 · Desviación presupuestal por registro
`reglas.desviacionPresupuestal` — `ejecutado − programado` en valor y en porcentaje. El porcentaje
es nulo cuando el programado es cero.

### RN-23 · Conformidad de producto
`reglas.esProductoConforme` · hallazgo **D-15**

- **H:** Evaluado y Conforme eran texto libre precargado en "No", y las fórmulas comparaban contra
  el literal "Sí". Un "Si" sin tilde anulaba el registro en el indicador.
- **S:** campos booleanos. Un producto no puede declararse conforme sin evaluación registrada.

### RN-24 / RN-25 · Estado del indicador
`reglas.estadoIndicador`

| Sentido | Cumple | Atención | Crítico |
|---|---|---|---|
| Mayor es mejor | `valor >= meta` | `valor >= meta × factor` (0,9 por defecto) | por debajo |
| Menor es mejor | `valor <= meta` | `valor <= meta × factor` (2 por defecto) | por encima |

Los dos factores son configurables **por indicador**; en el libro eran constantes.

Con **meta cero** la banda multiplicativa colapsa, así que se admite una sola unidad de holgura: un
caso es Atención, dos ya es Crítico. Es la lectura correcta para indicadores de conteo como
"riesgos críticos abiertos", cuya meta institucional es cero.

Sin valor, el estado es **"Sin datos"** y se explica el insumo que falta. Nunca cero.

### RN-26 · Fecha de corte única
`types.Proyecto.fechaCorte` · hallazgo **D-04**

El libro tenía dos: la celda del cronograma, que alimentaba todas las fórmulas, y un campo homónimo
en la hoja de parámetros que ninguna fórmula leía —y que en la plantilla difería en un año. El
usuario podía actualizar la equivocada y creer que el tablero se había recalculado.

Aquí hay **una sola**, en la Ficha del proyecto, y su cambio exige justificación y dispara el
recálculo de todo el proyecto.

### RN-27 · Rango de avance
`reglas.validarAvance` — entre 0 y 100, validado en la captura y en las reglas de seguridad.

### RN-28 · Coherencia de fechas
`reglas.validarFechasActividad` · hallazgo del libro: no validaba nada

- **Bloqueante:** fin anterior a inicio.
- **Advertencia:** la actividad sale de la vigencia del proyecto. Se advierte, no se bloquea:
  puede ser legítimo y es el líder quien decide.

---

## Catálogo de indicadores

Los **diez** indicadores institucionales. El instructivo documenta ocho: RIES-001 y RIES-002
existen en el libro y se calculan, pero no aparecen en su tabla (**D-17**).

| Código | Indicador | Categoría | Meta | Sentido |
|---|---|---|---|---|
| PRY-O001 | Cumplimiento del cronograma | Eficacia | 95 % | Mayor es mejor |
| PRY-O002 | Cumplimiento de entregables | Eficacia | 95 % | Mayor es mejor |
| PRY-O003 | Índice de Productos Conformes | Calidad | 90 % | Mayor es mejor |
| PRY-O004 | Desviación presupuestal | Eficiencia | ±5 % | Menor es mejor |
| PRY-O005 | Índice de Satisfacción | Efectividad | 90 % | Mayor es mejor |
| GEST-001 | Avance global del proyecto | Gestión | 100 % | Mayor es mejor |
| GEST-002 | Actividades retrasadas | Gestión | ≤5 % | Menor es mejor |
| GEST-003 | Cumplimiento de hitos | Gestión | 95 % | Mayor es mejor |
| RIES-001 | Riesgos críticos abiertos | Riesgo | 0 | Menor es mejor |
| RIES-002 | Riesgos materializados | Riesgo | 0 | Menor es mejor |

Dos indicadores cambian de valor con el saneamiento:

- **PRY-O004** — El libro sumaba las desviaciones porcentuales de filas distintas y tomaba el valor
  absoluto del total (**D-05**). Con varios periodos registrados el resultado crecía sin
  significado: tres periodos con 10 % de desviación daban 30 %. El modo saneado calcula la
  desviación sobre los totales, que es lo que la palabra significa.
- **GEST-003** — El libro contaba solo el estado "Cumplido" (**D-06**): los hitos cumplidos tarde
  se contabilizaban igual que los incumplidos. El modo saneado los cuenta como cumplidos.

El catálogo es **declarativo** (ADR-08): cada indicador apunta a una clave de fórmula registrada en
`indicadores.FORMULAS`. Agregar un indicador que combine insumos ya disponibles es registrar su
definición desde la pantalla de administración; la fórmula se elige entre las implementadas, porque
es código verificado y con prueba automatizada.

---

## Los dos modos del motor

`types.ModoCalculo` — se fija por proyecto en la Ficha.

| Modo | Para qué |
|---|---|
| `saneado` | Operación institucional. Aplica las correcciones aprobadas. |
| `compatibilidad` | Prueba de paridad con el libro de referencia. Reproduce el comportamiento heredado, defectos incluidos. |

La razón de conservar el modo heredado es el riesgo **RD-11** del backlog: *"se replican en la
aplicación los defectos de cálculo del archivo por reproducir la paridad a ciegas"*. Reproducir el
archivo exactamente significaría reproducir D-01 a D-05. Por eso la prueba de paridad se ejecuta en
los dos modos y **explica cada diferencia con su hallazgo asociado**: así una cifra que cambia se
lee como el efecto medible de una corrección, no como un error del sistema nuevo.

Está en **Importar y exportar → Paridad de cálculos**, y es exportable a Excel para el acta de
validación con el líder de cada proyecto migrado.

---

## Las reglas del valor ganado

`domain/evm.ts` — no forman parte de RN-01..RN-28 porque no vienen del instrumento original: son la
capa que convierte sus resultados en una decisión. Están probadas en `domain/__tests__/evm.test.ts`.

| Magnitud | Cómo se calcula |
|---|---|
| Presupuesto base (BAC) | Presupuesto total de la Ficha; si no está, el programado del libro presupuestal |
| Valor planeado (PV) | BAC × avance planeado a la fecha de corte, con el reparto por duración en días hábiles de `avancePlaneadoEnFecha` |
| Valor ganado (EV) | BAC × avance real ponderado por duración |
| Costo real (AC) | Ejecutado acumulado hasta la fecha de corte, leído del `ProveedorCostos` vigente |
| Variación de cronograma | EV − PV · **Índice** EV / PV |
| Variación de costo | EV − AC · **Índice** EV / AC |
| Proyección al cierre (EAC) | AC + (BAC − EV) / índice de costo — supone que el desempeño observado continúa |
| Falta por gastar (ETC) | EAC − AC |
| Variación al cierre (VAC) | BAC − EAC · negativa = se cierra por encima del presupuesto |
| Eficiencia requerida (TCPI) | (BAC − EV) / (BAC − AC) — el desempeño que habría que sostener para cerrar dentro del presupuesto |

Reglas de presentación que el motor impone y la interfaz no puede saltarse:

- **Un índice sin denominador es "sin datos", no cero.** Sin presupuesto no hay valor ganado; sin
  costo registrado no hay índice de costo. El tablero lo dice y no dibuja la serie.
- **Umbral único de 0,95** para clasificar cronograma y costo como favorable o desfavorable. Es el
  mismo en los cinco cuadrantes y no se configura por tablero: si cambia, cambia en un solo lugar.
- **TCPI por encima de 1,10 se declara no alcanzable.** El veredicto deja de pedir eficiencia y pasa
  a pedir decisión: replanificar alcance o aprobar presupuesto adicional.
- **Cuando el presupuesto ya se agotó** (AC ≥ BAC) la eficiencia requerida no tiene sentido
  matemático; el motor lo marca como salvedad en lugar de imprimir un número absurdo.
- **Las salvedades viajan con el resultado**, no en una nota al pie: falta de presupuesto, ausencia
  de costo, presupuesto agotado, falta de instantáneas y ausencia de comprometido en el libro.
- **La cascada cuadra o es un defecto.** BAC + (AC − EV) + (ETC − (BAC − EV)) = EAC, con el signo
  positivo siempre significando *encarece*. Hay una prueba que lo verifica como identidad exacta.
- **El costo no se reparte por fase.** El desglose por fase muestra índice de cronograma y declara
  por qué no muestra índice de costo: el libro se lleva por rubro y periodo, no por fase.
