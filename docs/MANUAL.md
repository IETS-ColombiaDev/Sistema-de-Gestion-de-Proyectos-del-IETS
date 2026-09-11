# Manual de uso

## Rutina semanal

Equivalente al procedimiento de actualización del instructivo, ya sin manipulación de fórmulas.
El paso de anotar los cambios en una hoja de registro **desaparece**: la trazabilidad es automática.

1. **Ingresar** con la cuenta institucional y seleccionar el proyecto.
2. **Actualizar la fecha de corte** en la Ficha. Es lo primero, porque gobierna todo lo demás. El
   sistema pide justificación y recalcula el proyecto completo.
3. **Registrar el avance** de las actividades activas en el Cronograma. Se puede editar varias
   celdas y guardar todo en una sola operación: los estados se recalculan solos.
4. **Revisar los hitos**: actualizar fechas reales y estados cuando corresponda.
5. **Actualizar los riesgos** con información nueva: probabilidad, impacto y estado. La severidad y
   el nivel se calculan.
6. **Actualizar la disponibilidad de recursos.**
7. **Consultar el Tablero de seguimiento** y su centro de alertas. Cada alerta trae su regla de
   origen y un enlace directo al módulo donde se resuelve.
8. **Consultar el Dashboard ejecutivo y los Indicadores.**
9. **Documentar las decisiones** en las observaciones de las entidades afectadas.

---

## Lo que el sistema no permite, y por qué

| No permite | Motivo |
|---|---|
| Editar un campo calculado | Se corrige el dato fuente, no el resultado. Un tablero nunca se corrige directamente. |
| Escribir un resultado de indicador | Misma razón. No existe ruta, ni en la interfaz ni en la base de datos. |
| Borrar un registro definitivamente | La baja es lógica: preserva la trazabilidad y es reversible. |
| Editar o borrar la auditoría | El registro es append-only para todos los roles, administrador incluido. |
| Cambiar fechas o conformidad sin justificar | Son cambios sensibles: la justificación queda en la auditoría. |
| Declarar un producto conforme sin evaluación | La conformidad sin evaluación no significa nada. |
| Editar un proyecto cerrado | Queda en consulta. Solo el administrador puede reabrirlo. |
| Guardar una actividad con fin anterior al inicio | Validación bloqueante. |
| Un valor fuera de la lista controlada | Las listas gobiernan lo que se admite. |

---

## Los roles

| Rol | Qué puede hacer |
|---|---|
| **Administrador del sistema** | Todo, en todos los proyectos. Administra catálogos, parámetros, usuarios y roles. |
| **Líder de proyecto** | Crea y edita todo el contenido de sus proyectos, incluido el presupuesto, y puede cerrarlos. |
| **Gestor de proyecto** | Registra avance, hitos, riesgos, recursos, productos y satisfacción. No edita la ficha, el presupuesto ni cierra el proyecto. |
| **Miembro del equipo** | Actualiza el avance de las actividades donde es responsable y adjunta evidencias. |
| **Directivo / consulta** | Lectura del portafolio y de los tableros. Sin edición. |
| **Auditor** | Lectura total, incluida la auditoría. Sin edición. |

El rol asignado **dentro de un proyecto** prevalece sobre el rol global para ese proyecto. Los
accesos por proyecto se conceden en **Usuarios y roles → Accesos**.

El administrador puede usar **Ver la aplicación como** (menú de usuario) para verificar la
experiencia de otro rol sin cambiar de cuenta. Mientras la suplantación está activa, un banner
ámbar lo indica.

---

## Cómo leer las cifras del tablero

**Avance ponderado** — Avance físico real, donde cada actividad pesa según su duración. Es la cifra
que se reporta.

**Avance esperado** — Lo que la programación preveía a la fecha de corte. Las actividades vencidas
cuentan completas; las que están en curso, la fracción transcurrida.

**Desviación** — La resta de las dos anteriores, en puntos porcentuales. Negativa significa retraso.
Los umbrales de precaución y atención se administran en el catálogo de parámetros.

**Avance simple** — Promedio sin ponderar. Solo de referencia: no debe usarse para reportar.

Cada métrica tiene un icono de ayuda que explica su cálculo. Los gráficos ofrecen **Ver tabla**: los
mismos datos en forma tabular, para lectores de pantalla, para impresión y para quien prefiera las
cifras exactas.

---

## Cómo leer el bloque de valor ganado

Arriba del Dashboard ejecutivo hay un bloque con un título, una frase y una decisión. No es un
resumen decorativo: es la lectura conjunta de cronograma y costo, y dice qué está sobre la mesa.

**Índice de cronograma** — Del trabajo que debería estar hecho, cuánto está hecho. Por debajo de
0,95 el proyecto va atrasado.

**Índice de costo** — Por cada peso gastado, cuánto trabajo se obtuvo. Por debajo de 0,95 el trabajo
está saliendo más caro de lo previsto.

**Proyección al cierre** — Con qué cifra se cierra si el desempeño observado continúa. La
**variación al cierre** es la diferencia contra el presupuesto: negativa significa que se cierra por
encima.

**Eficiencia requerida** — Qué desempeño habría que sostener en lo que falta para cerrar dentro del
presupuesto. Por encima de 1,10 el tablero lo declara no alcanzable, y entonces la conversación deja
de ser sobre esfuerzo y pasa a ser sobre alcance o presupuesto adicional.

Dos advertencias de lectura:

- **Un índice puede decir "sin datos".** Sin presupuesto en la Ficha no hay valor ganado, y sin
  control presupuestal registrado no hay índice de costo. El sistema nunca muestra cero en su lugar.
- **La trayectoria de la curva S viene de las instantáneas guardadas.** Si no se han guardado cortes
  anteriores, la curva muestra un punto y lo dice. Guardar una instantánea en cada corte es lo que
  construye el histórico; nadie puede reconstruirlo después.

El tablero enumera sus propias **salvedades** —presupuesto ausente, presupuesto agotado, falta de
instantáneas, compromisos no disponibles en el libro— antes de que alguien decida sobre esas cifras.

---

## Ver quién está en qué

En el **Dashboard ejecutivo → Equipo** hay dos lecturas distintas y complementarias:

*Quiénes conforman el equipo* es la nómina: cada persona con su perfil, su vinculación, su dedicación
y **la actividad en la que está ahora**, con la fase y el estado de esa actividad. Los perfiles sin
designar aparecen en la lista marcados como tales.

*Dónde está el equipo* pone a las personas contra las fases. Sirve para una pregunta que la lista no
responde: si el equipo está amontonado en una fase y ausente de la siguiente. El punto rojo en una
casilla indica que ahí hay trabajo retrasado.

En el **Portafolio → Personas** se ve lo que ninguna ficha de proyecto muestra: quién participa en
varios proyectos a la vez y cuánta dedicación suma entre todos. Si alguien pasa de una jornada al
sumar sus frentes, la cifra se resalta. La dedicación es la **declarada** en cada ficha, no horas
trabajadas: el sistema no registra tiempo ejecutado.

---

## Filtros

Cada tablero tiene **una sola fila de filtros** arriba, y acota todo lo que hay debajo: si se filtra
por una fase, todas las tarjetas y todos los gráficos muestran esa fase. No hay filtros por tarjeta,
justamente para que dos gráficos contiguos nunca puedan mostrar cortes distintos de los datos.

Los filtros quedan **en la dirección web**. Eso significa que una vista filtrada se puede copiar y
enviar: quien la abra ve exactamente el mismo tablero, sin instrucciones. El botón *Limpiar* vuelve
a la vista completa.

En el **Tablero de seguimiento** el filtro acota las actividades, el avance por fase, los retrasos y
los vencimientos. Las cuatro cifras de la cabecera —avance ponderado, esperado, desviación y avance
simple— son del proyecto completo y no cambian con el filtro; cuando hay uno activo, el tablero lo
dice sobre la fila.

En **Indicadores**, el filtro de *cumplimiento* deja a la vista solo los que no alcanzan su meta.
Cada indicador se muestra en su propia barra, con su meta marcada: no se comparan entre sí en una
escala común, porque unos se miden en porcentaje y otros en número, y en unos conviene el valor alto
y en otros el bajo.

En el Portafolio, el filtro de **desempeño** usa los cuadrantes del valor ganado. Las alertas del
tipo *"3 proyectos proyectan cerrar por encima de su presupuesto"* traen un botón que aplica ese
filtro y deja el tablero mostrando únicamente esos proyectos.

---

## Importar desde el libro Excel

**Importar y exportar → Importar.** El importador reconoce hojas cuyo nombre contenga *Cronograma*,
*Hitos* o *Riesgos*, y tolera varias formas de escribir lo mismo: fechas como `dd/mm/aaaa`, ISO o
número de serie de Excel; avances como `0,45`, `45` o `45%`.

Valida **antes** de escribir y muestra un informe con dos niveles:

- **Error** — bloquea la importación. Se corrige en el archivo de origen.
- **Advertencia** — la importación puede continuar. El registro entra con lo que se pudo
  interpretar y queda señalado.

Nada se escribe hasta que se confirma.

---

## Exportar

| Qué | Dónde | Resultado |
|---|---|---|
| Proyecto completo | Importar y exportar → Exportar | Excel de once hojas, con los campos calculados a la fecha de corte |
| Reporte ejecutivo | Dashboard ejecutivo → Reporte ejecutivo | Documento imprimible o PDF, con la marca de la fecha de corte |
| Cualquier listado | Botón *Exportar* del módulo | Excel del contenido y los filtros vigentes |
| Auditoría | Auditoría → Exportar | Excel para control interno |
| Paridad de cálculos | Importar y exportar → Paridad | Excel de la comparación entre modos |

En el reporte ejecutivo, la navegación y los controles no se imprimen: la hoja de estilos de
impresión los oculta.

---

## Accesibilidad

- Toda la aplicación se opera con teclado. `Tab` recorre los controles y el foco es siempre visible.
- El primer `Tab` de cada página ofrece **Ir al contenido principal**.
- Los modales atrapan el foco mientras están abiertos y cierran con `Escape`.
- Las alertas críticas se anuncian a los lectores de pantalla.
- La identidad en los gráficos nunca depende solo del color: hay leyenda, etiquetas directas,
  trama diagonal en el estado "Retrasada" y vista de tabla equivalente.
- La paleta de datos está verificada para daltonismo (deuteranopia, protanopia y tritanopia) en
  todos los pares de series, no solo en los adyacentes.
