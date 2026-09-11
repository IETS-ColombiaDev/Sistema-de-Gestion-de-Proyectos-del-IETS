# HIGEP Web — Sistema de Gestión de Proyectos del IETS

Migración de la **Herramienta Institucional para la Gestión de Proyectos** (HIGEP V2, libro
Excel de 17 hojas) a una aplicación web institucional, multiusuario y multiproyecto.

Conserva íntegro el marco metodológico vigente —planeación, gobierno y control, seguimiento,
medición y visualización— y resuelve las limitaciones estructurales del archivo: concurrencia,
trazabilidad automática, integridad referencial, seguridad por rol y consolidación de portafolio.

---

## Qué resuelve

| Problema en Excel | Cómo lo resuelve HIGEP Web |
|---|---|
| Un archivo por proyecto, sin vista de portafolio | Modelo multiproyecto con consolidación institucional |
| Riesgo de sobrescribir fórmulas y listas | El usuario nunca edita lógica; los campos calculados no son editables |
| Trazabilidad manual en una hoja de registro | Auditoría automática de cada cambio de campo, append-only |
| Sin control de acceso | Autenticación institucional + seis roles con permisos verificados en el servidor |
| Concurrencia por bloqueo de archivo | Escritura concurrente con transacciones |
| Topes bajos por rangos fijos (25 actividades, 11 riesgos, 4 recursos…) | Sin topes |
| Fecha de corte y avance actualizados a mano | Fecha de corte única y parametrizable, con recálculo automático |

Además corrige **dieciocho defectos verificados** del archivo fuente (Anexo C del backlog). El
motor opera en dos modos —`saneado` y `compatibilidad`— y el módulo *Importar y exportar* incluye
una **prueba de paridad** que compara ambos y explica cada diferencia, hallazgo por hallazgo. Esa
es la respuesta al riesgo RD-11: el saneamiento nunca se confunde con un error de cálculo.

Y va más allá del instrumento original: incorpora un **motor de valor ganado** que convierte
"avance 53 %, ejecutado $265 M" en un veredicto y una decisión —*"recuperar el presupuesto exigiría
una eficiencia de 2,14 en el trabajo restante, que no es alcanzable; la decisión es replanificar
alcance o aprobar presupuesto adicional"*—, con una capa de costos preparada para conectarse a la
herramienta institucional mediante un solo contrato. Ver [`docs/VALOR_GANADO.md`](docs/VALOR_GANADO.md).

---

## Puesta en marcha

Requiere Node.js 20 o superior.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Arranca con el **backend local** (IndexedDB en el navegador) y siembra datos sintéticos: catálogos,
seis usuarios —uno por rol— y dos proyectos completos. No requiere infraestructura ni credenciales.

En la pantalla de ingreso se elige el perfil con el que se quiere entrar; así se puede verificar la
experiencia real de cada rol. En producción ese paso lo reemplaza el ingreso con Google restringido
al dominio institucional.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Compilación de producción en `frontend/dist` |
| `npm run preview` | Sirve la compilación de producción |
| `npm test` | Suite de pruebas del motor de cálculo y de la persistencia |
| `npm run lint` | Verificación de tipos |

### Datos de prueba

En **Catálogos y parámetros → Datos de prueba** (rol administrador):

- **Cargar datos de prueba** — siembra catálogos, usuarios y dos proyectos si el sistema está vacío;
  no sobrescribe información existente.
- **Eliminar todo y reiniciar** — borra proyectos, catálogos, usuarios y auditoría, y vuelve a
  sembrar. Irreversible; para entornos de desarrollo o demostración.

Los datos son **sintéticos**: reproducen la estructura del instrumento (28 actividades, 12 hitos,
13 riesgos, 9 recursos, 8 productos, 7 mediciones, 9 registros presupuestales), no el contenido de
ningún proyecto real.

---

## Arquitectura

```
frontend/src/
├── domain/          Motor de cálculo. Funciones puras, sin React ni base de datos.
│   ├── types.ts         Modelo de datos y listas controladas
│   ├── fechas.ts        Aritmética en UTC, días hábiles, festivos de Colombia
│   ├── reglas.ts        RN-01 a RN-28, en los dos modos de cálculo
│   ├── indicadores.ts   Catálogo declarativo y motor de los diez indicadores
│   ├── evm.ts           Valor ganado: índices, proyección, veredicto y decisión
│   ├── costos.ts        Contrato ProveedorCostos — punto de conexión externo
│   ├── alertas.ts       Centro de alertas unificado
│   └── catalogos.ts     Listas y parámetros por defecto
├── data/            Persistencia tras un solo contrato
│   ├── adapter.ts       Contrato de persistencia
│   ├── localAdapter.ts  IndexedDB y adaptador en memoria (pruebas)
│   ├── firebaseAdapter.ts  Firestore
│   ├── repo.ts          Única puerta de escritura: metadatos, baja lógica, auditoría
│   └── auditoria.ts     Diferencias campo a campo y campos sensibles
├── auth/            Sesión y matriz de permisos rol × acción
├── components/      Sistema de diseño (un botón, un campo, una tabla)
│   ├── charts/          Gráficos en SVG, sin librería de terceros
│   │   ├── paleta.ts        Paletas verificadas para daltonismo
│   │   ├── avanzados.tsx    Curva S, cascada, cuadrante, Pareto, bullet, sparkline
│   │   ├── reparto.tsx      Dona, barras agrupadas, línea de hitos, carga por persona
│   │   └── index.tsx        Figura con leyenda y su tabla gemela
│   ├── FiltroBarra.tsx  Filtros de tablero, con estado en la URL
│   └── ui/              Modal, tabla, formulario, avisos
├── lib/             useLienzo.ts — medida del lienzo y escala de alturas
│                    useMedia.ts — puntos de quiebre compartidos
├── modules/         Los módulos funcionales, incluido costos/
└── styles/          theme.ts — fuente única de los design tokens
```

**El motor de cálculo no depende de nada.** No importa React, no importa Firebase y no lee del
navegador: recibe datos y parámetros, y devuelve resultados. Por eso se puede probar entero en
milisegundos y por eso la misma regla produce el mismo número en el cliente, en el servidor y en la
suite de pruebas.

**La capa de datos vive tras un contrato.** La aplicación habla con `Adaptador`, nunca con
Firestore ni con IndexedDB. Cambiar de backend es cambiar una variable de entorno.

**El costo también vive tras un contrato.** Ningún tablero lee el libro presupuestal directamente:
todos pasan por `ProveedorCostos`. Conectar la herramienta institucional de costos es registrar otro
proveedor —una línea al arrancar la aplicación— sin tocar pantallas, cálculos ni pruebas. Ver
[`docs/VALOR_GANADO.md`](docs/VALOR_GANADO.md).

**Los gráficos no traen librería.** Son SVG propio: sin dependencia externa que auditar ni que
actualizar, con la paleta verificada por script y una tabla equivalente detrás de cada figura. El
lienzo se mide y se dibuja a escala 1:1, de modo que la altura de un gráfico es una decisión de
diseño y no una consecuencia del ancho de su tarjeta.

### Decisiones de arquitectura

Las diez decisiones (ADR-01 a ADR-10) están en el backlog. Las que más se notan en el código:

- **ADR-03** — Los cálculos derivados no son editables. No existe ruta, ni en la interfaz ni en las
  reglas de seguridad, para escribir un resultado: un tablero no se corrige, se corrige el dato.
- **ADR-06** — La auditoría es append-only. Ningún rol, incluido el administrador, puede editarla.
- **ADR-07** — Las listas y los parámetros viven en la base de datos. Cambiar un umbral no exige un
  despliegue.
- **ADR-08** — El catálogo de indicadores es declarativo: cada indicador apunta a una fórmula
  registrada y verificada.
- **ADR-09** — Baja lógica en todas las entidades. Nada se borra físicamente.

---

## Cobertura funcional

Los 19 módulos de las 17 hojas del instrumento, más lo que el archivo no podía dar:

**Institucional** — Portafolio consolidado · Listado de proyectos · Auditoría del sistema
**Administración** — Catálogos y parámetros · Catálogo de indicadores · Usuarios y roles
**Definición** — Ficha del proyecto · Grupo desarrollador
**Planeación** — Cronograma · Diagrama de Gantt · Hitos y ruta crítica
**Gobierno y control** — Matriz RACI · Matriz de riesgos · Recursos e insumos
**Medición** — Registro de productos · Satisfacción · Control presupuestal · Indicadores
**Lectura gerencial** — Dashboard ejecutivo · Tablero de seguimiento · Costos y valor ganado
**Trazabilidad** — Auditoría del proyecto · Importar, exportar y prueba de paridad

El detalle épica por épica está en [`docs/TRAZABILIDAD.md`](docs/TRAZABILIDAD.md).

---

## Despliegue en Firebase

Ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) para el procedimiento completo. En resumen:

```bash
cp frontend/.env.example frontend/.env.local   # completar con las credenciales del proyecto
# VITE_BACKEND=firebase

cd frontend && npm run build && cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
```

Ningún secreto vive en el repositorio. Las credenciales llegan por variables de entorno del
despliegue y por el gestor de secretos de la plataforma.

---

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/TRAZABILIDAD.md`](docs/TRAZABILIDAD.md) | Épica → módulo → archivo → prueba, y estado de cada hallazgo del Anexo C |
| [`docs/REGLAS.md`](docs/REGLAS.md) | Las 28 reglas de negocio, su implementación y su prueba |
| [`docs/VALOR_GANADO.md`](docs/VALOR_GANADO.md) | Motor de valor ganado, tableros de decisión y conexión con la herramienta de costos |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Entornos, secretos, reglas de seguridad, puesta en producción |
| [`docs/MANUAL.md`](docs/MANUAL.md) | Rutina semanal por rol |
| `HIGEP_Web_Backlog_Tecnologico.md` | Backlog de origen |
| `linea-grafica-y-ux-ui.md` | Guía de línea gráfica y UX/UI |

---

## Confidencialidad

Este repositorio no contiene datos personales, credenciales, claves, cadenas de conexión,
identificadores de proyecto reales ni datos diligenciados de los libros de trabajo. Los datos de
demostración son sintéticos y estructurales.
