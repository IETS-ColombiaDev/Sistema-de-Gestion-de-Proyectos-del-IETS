# Valor ganado, costos y tableros de decisión

## Por qué existe esta capa

Un tablero que dice *"avance 53 %, ejecutado $265 M"* no permite decidir nada. Las dos cifras
son ciertas y ninguna responde la pregunta de un comité directivo:

> Con el trabajo que llevo hecho, ¿lo que he gastado es razonable, y con qué cifra voy a cerrar?

El **valor ganado** responde esa pregunta poniendo las tres magnitudes en la misma unidad —dinero—
para que sean comparables entre sí:

| Magnitud | Sigla | Qué es |
|---|---|---|
| Valor planeado | PV | Lo que el cronograma decía que estaría hecho a la fecha de corte |
| Valor ganado | EV | Lo que efectivamente está hecho, valorado en dinero |
| Costo real | AC | Lo que se ha gastado para lograrlo |

De ahí salen las dos únicas preguntas que importan, y su proyección:

```
¿voy a tiempo?    EV − PV    y su índice  EV/PV
¿voy en costo?    EV − AC    y su índice  EV/AC
¿en cuánto cierro?           BAC / (EV/AC)
```

`frontend/src/domain/evm.ts` · pruebas en `frontend/src/domain/__tests__/evm.test.ts`

---

## Del cálculo al veredicto

El motor no se detiene en los índices: los traduce a un **cuadrante**, una frase y una decisión.
Eso es lo que distingue un tablero que informa de uno que permite actuar.

| Cuadrante | Situación | Decisión que pone sobre la mesa |
|---|---|---|
| **En línea** | Índices ≥ 0,95 | Mantener el plan; el seguimiento vuelve a periodicidad normal |
| **Atrasado** | Cronograma < 0,95, costo ≥ 0,95 | El problema es de ritmo, no de precio: reforzar capacidad en la ruta crítica o mover la fecha. Reforzar tiene costo, y el índice de costo se deteriorará |
| **Sobrecosto** | Cronograma ≥ 0,95, costo < 0,95 | Revisar los rubros que concentran el gasto: recorte de alcance, renegociación, o presupuesto adicional por la cifra proyectada |
| **Crítico** | Ambos < 0,95 | Replanificar alcance, cronograma y presupuesto en conjunto. Ajustar uno solo de los tres no cierra la brecha |

El sistema añade una prueba de realismo: la **eficiencia requerida** (TCPI) mide qué desempeño
habría que sostener en el trabajo restante para cerrar dentro del presupuesto. Por encima de ~1,10
el tablero lo dice sin rodeos: *"no es alcanzable; la decisión es replanificar o aprobar presupuesto
adicional, no apretar la ejecución"*. Ese matiz evita la reunión en la que se pide esfuerzo sobre
dinero ya gastado.

---

## Honestidad del cálculo

Tres decisiones deliberadas sobre lo que el sistema **no** hace:

**La trayectoria del valor ganado no se estima, se registra.** El histórico proviene de las
instantáneas guardadas en cada fecha de corte. Sin instantáneas, la curva muestra un único punto y
lo declara. Reconstruir hacia atrás una trayectoria que nadie midió sería inventar datos con
apariencia de registro.

**El costo real no se reparte por fase.** El libro presupuestal se lleva por rubro y periodo. Un
índice de costo por fase repartido a prorrata parecería información sin serlo. Por eso el desglose
por fase muestra índice de *cronograma*, no de costo, y dice por qué.

**Las salvedades se muestran, no se esconden.** Si falta presupuesto en la ficha, si no hay costo
registrado, si el presupuesto ya se agotó, o si el libro no distingue lo comprometido de lo causado,
el tablero lo enumera antes de que alguien decida sobre esas cifras.

---

## La conexión con la herramienta de costos

Hoy el costo real sale del módulo de Control presupuestal. Mañana saldrá de la herramienta
institucional de costos. Para que ese cambio sea una **sustitución y no una reescritura**, todo el
sistema lee el costo a través de un único contrato.

`frontend/src/domain/costos.ts`

```ts
export interface ProveedorCostos {
  readonly origen: 'interno' | 'externo'
  readonly nombre: string
  readonly sincronizadoEn?: string
  porPeriodo(datos: DatosProyecto): CostoPeriodo[]
  porRubro(datos: DatosProyecto): CostoDesagregado[]
  porFuente(datos: DatosProyecto): CostoDesagregado[]
}
```

Conectar la herramienta institucional es **una llamada**, al iniciar la aplicación:

```ts
registrarProveedorCostos(proveedorInstitucional)
```

A partir de ahí todos los tableros leen de la fuente nueva. Ninguna pantalla, ningún cálculo y
ninguna prueba cambian: hay un test que lo demuestra sustituyendo el proveedor y verificando que el
índice de costo se recalcula contra la fuente externa
(`evm.test.ts` → *"un proveedor externo reemplaza la fuente sin tocar los tableros"*).

### Qué gana el sistema cuando llegue

La pestaña **Costos y valor ganado → Fuente del costo** declara en pantalla el estado de cada
concepto, para que nadie decida sobre una cifra creyendo que incluye algo que no incluye:

| Concepto | Hoy | Con la herramienta de costos |
|---|---|---|
| Ejecutado (causado) | Del libro del sistema | Del libro contable institucional, con la periodicidad de cierre real |
| Programado | Registrado por periodo y rubro | Del presupuesto aprobado en el sistema financiero |
| **Comprometido** | No disponible | Órdenes y contratos firmados y no pagados; la proyección los incorporará |
| **Costo por fase** | No disponible | Permitirá índice de costo por fase, no solo de cronograma |
| **Costo por actividad** | No disponible | Habilitará valor ganado a nivel de actividad |

El campo `comprometido` ya existe en el contrato y hoy vale cero: cuando la fuente externa lo
entregue, el tablero de compromiso empieza a significar algo sin cambiar una línea de interfaz.

### Contraste con el costo del equipo

Mientras tanto, el sistema ofrece un control cruzado propio: el **costo teórico del equipo**
(tarifa hora × dedicación × meses) frente al costo real del libro. Una diferencia grande suele
significar que la dedicación registrada no corresponde a la real, o que hay costos fuera de nómina
que el equipo no está viendo. Cuando faltan tarifas, el tablero lo dice y marca la comparación como
no comparable en lugar de mostrar una brecha falsa.

---

## Los gráficos y la pregunta que responde cada uno

`frontend/src/components/charts/avanzados.tsx` y `reparto.tsx`

| Gráfico | Pregunta |
|---|---|
| **Curva S** | ¿Cómo venimos y dónde vamos a cerrar? Las tres magnitudes y la proyección |
| **Cascada** | ¿De dónde sale el sobrecosto y qué parte es accionable? Separa lo incurrido de lo proyectado |
| **Cuadrante** | ¿Cuál de mis proyectos está en problemas y cuánto dinero hay en juego? |
| **Barras divergentes** | ¿Qué fase o proyecto aporta valor y cuál lo resta? |
| **Pareto** | ¿Dónde miro primero si hay que recortar? |
| **Dona** | ¿Cómo se reparte el total entre pocas categorías? |
| **Barras agrupadas** | ¿Lo real frente a lo previsto, categoría por categoría? |
| **Línea de hitos** | ¿Qué puntos de control vienen y cuáles se pasaron? |
| **Carga por persona** | ¿Quién carga el trabajo y cómo le va? |
| **Matriz persona × fase** | ¿Dónde está cada quien, y hay fases sin nadie? |
| **Bullet** | ¿Este indicador cumple, y a qué distancia está de dejar de cumplir? |
| **Sparkline** | ¿La tendencia acompaña o contradice la cifra? |
| **Línea de desviación** | ¿La brecha contra el plan se cierra o se abre? |
| **Vencimientos por semana** | ¿Qué se viene encima y con cuánto margen? |
| **Medidores por indicador** | ¿Cuál está más lejos de su meta, cada uno en su escala? |

### Reglas de visualización que el sistema respeta

- **Nunca doble eje.** Dos escalas superpuestas inventan una correlación que no está en los datos.
  El Pareto pone barras y acumulada en el **mismo** eje porcentual; el importe en dinero viaja en la
  etiqueta y en la tabla. El cuadrante es un plano de dos índices sin unidad, no dos escalas.
- **El color sigue a la entidad, no a su posición.** Filtrar no repinta las series que quedan.
- **Paletas verificadas para daltonismo**, no estimadas a ojo: la serie de valor ganado
  (indigo–cian–magenta) y el par divergente (teal–rosa) superan el umbral de separación en
  deuteranopia, protanopia y tritanopia **en todos sus pares**. Ambos conjuntos están juntos por
  debajo del umbral, y por eso hay una restricción escrita: **no comparten gráfico**, porque son
  trabajos distintos —identidad de serie y polaridad.
- **El verde y el rojo nunca son el único canal.** El semáforo institucional falla la separación por
  daltonismo, así que siempre va con etiqueta; en el cuadrante el significado lo lleva la posición y
  el rótulo de cada zona.
- **La tinta no lleva color de serie.** Las magnitudes de identidad (presupuesto, valor ganado,
  costo real) se imprimen en tinta normal con una franja de acento del color de su serie; el color
  de estado se reserva para lo que *es* un estado.
- **Cada figura tiene su tabla gemela**, alcanzable con un botón, para lector de pantalla, impresión
  y para quien prefiera las cifras exactas.
- **El lienzo se mide y se dibuja 1:1.** Un SVG con `viewBox` fijo y `width: 100%` deja que el ancho
  del contenedor decida la altura y el tamaño del texto: se midieron gráficos de 184 px junto a otros
  de 417 px en la misma pantalla, y una misma etiqueta valiendo 14 px en una tarjeta y 7 px en otra.
  Ahora el contenedor se mide y una unidad del SVG es un píxel real, de modo que la altura es la que
  pide el tablero y el texto mide lo que dice el número. Las alturas salen de un token compartido
  (`ALTO.sm` · `md` · `lg`) para que los gráficos de una fila lean parejos.
- **En lienzo angosto se quitan marcas, no se encoge el texto.** Cuántos rótulos caben en un eje es
  una división entre el ancho medido y el ancho del rótulo, no una suposición por punto de quiebre.
  El piso de legibilidad es 11 px y no se cruza.
- **Cada indicador contra su propia meta.** Normalizar indicadores de unidades y sentidos distintos
  a una escala común parece comparable y no lo es: en uno de "menor es mejor" el cociente se dispara
  al acercarse a cero —la desviación presupuestal, con 0,4 % frente a una meta de 5 %, daba +1090
  puntos— y ese solo valor aplasta a los demás. Cada indicador se muestra en una barra con su propia
  escala, su meta marcada y sus bandas; el orden de la lista lleva la comparación.
- **Un recuento no admite decimales.** Cuando la magnitud es un conteo —actividades, personas,
  riesgos— las marcas del eje van de uno en uno: un eje que dice "0,25 actividades" describe algo que
  no puede ocurrir.

---

## Filtros

Una sola fila por encima de todo lo que acota, nunca un filtro por tarjeta: si cada gráfico se
filtrara por separado, dos tarjetas contiguas podrían mostrar cortes distintos de los datos sin que
el lector pueda notarlo.

El estado vive en la URL, de modo que una vista filtrada se comparte, se marca y se recupera al
volver atrás. Para un comité eso es la diferencia entre *"mira este tablero"* y *"abre el tablero y
filtra por estos cuatro criterios"*.

| Tablero | Filtros |
|---|---|
| Portafolio | Búsqueda · estado · líder · financiador · **desempeño** (cuadrante) · entrega hasta |
| Dashboard ejecutivo | Fase · rubro · fuente financiera · severidad de alerta |
| Tablero de seguimiento | Fase · estado · responsable · severidad de alerta |
| Indicadores | Categoría · estado · cumplimiento |
| Costos y valor ganado | Rubro · fuente financiera · rango de periodos |

Cuando una cifra **no** obedece al filtro, el tablero lo dice. En el Tablero de seguimiento, el
avance ponderado, el esperado y la desviación son cifras del proyecto —recalcularlas sobre una fase
cambiaría lo que significan, y los umbrales que las semaforizan son umbrales de proyecto—, así que
el filtro no las toca y una línea sobre la fila lo advierte. Una fila que parece filtrada sin estarlo
es peor que una fila que declara su alcance.

El filtro de **desempeño** del portafolio es el que cierra el circuito de decisión: la alerta
*"3 proyectos proyectan cerrar por encima de su presupuesto"* trae un botón que aplica ese filtro y
deja el tablero mostrando solo esos tres.

---

## Agregación del portafolio

Los indicadores del portafolio se calculan **sobre los totales en dinero**, no promediando los
porcentajes de cada proyecto. Promediar índices de proyectos de tamaño distinto da una cifra sin
significado —uno de 20 millones pesaría igual que uno de 500— y es el error más común en un tablero
de portafolio.

```
avance del portafolio  =  Σ valor ganado  /  Σ presupuesto
índice de costo        =  Σ valor ganado  /  Σ costo real
sobrecosto proyectado  =  Σ |variación al cierre| de los proyectos con variación negativa
```

Ese último número —el sobrecosto proyectado del conjunto— es el que la dirección necesita: es el
dinero que hay que decidir, aprobarlo o recortar alcance.

---

## Las personas: quiénes son y dónde están

Un tablero de equipo que muestra "Metodóloga" en vez de una persona no responde quién conforma el
grupo: los perfiles se repiten y no se distinguen entre sí. Persona y perfil son dos datos, y los dos
se muestran — el nombre identifica, el perfil dice qué rol ocupa.

**En el proyecto**, el Dashboard ejecutivo → *Equipo* responde las dos preguntas por separado:

- *Quiénes conforman el equipo* — la nómina completa: persona, perfil, vinculación, dedicación, la
  actividad **en la que está ahora** con su fase y estado, cuántas lleva a cargo y cuántas apoya.
  Un perfil sin designar se lista igual que los demás: es capacidad planeada que todavía no existe, y
  esconderlo la haría parecer disponible.
- *Dónde está el equipo* — una matriz de personas contra fases. La carga por persona dice **cuánto**
  lleva cada quien; no dice **dónde** está. Un equipo puede verse parejo en número de actividades y
  tener cuatro personas amontonadas en una fase y ninguna en la siguiente. La celda vacía se deja en
  blanco en vez de escribir un cero, porque lo que se lee ahí es el patrón de ocupación y una rejilla
  sembrada de ceros lo esconde.

**En el portafolio**, la pestaña *Personas* responde la pregunta que ninguna ficha de proyecto puede
responder: **la misma persona está en tres proyectos a la vez**. Ese es el origen de los cuellos de
botella — cada proyecto se ve holgado por separado y la persona está saturada al sumarlos. La tabla
consolida a cada quien en una fila con los proyectos en los que participa, su dedicación sumada, las
actividades a cargo y las retrasadas.

Tres precisiones que el tablero declara:

- **La identidad se resuelve por usuario institucional** cuando existe, y por nombre normalizado
  cuando no. Se dice así porque dos homónimos se fusionarían: la vinculación a usuario es la que da
  certeza, y por eso el modelo la pide (HG-051).
- **La dedicación es la declarada, no la ejecutada.** El sistema no registra horas trabajadas. Sirve
  para ver compromiso planeado —que es la decisión de asignación—, no para liquidar tiempo.
- **La jornada de referencia (160 h/mes) es un punto de lectura, no una regla de negocio.** Marca a
  quien queda comprometido por encima de una jornada al sumar sus proyectos; la jornada real la fija
  la vinculación de cada quien.
