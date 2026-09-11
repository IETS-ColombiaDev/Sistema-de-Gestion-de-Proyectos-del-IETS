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
