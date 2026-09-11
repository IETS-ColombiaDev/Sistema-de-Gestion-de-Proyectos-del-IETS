# Despliegue

## Entornos

| Entorno | Backend | Datos | Acceso |
|---|---|---|---|
| Local | IndexedDB del navegador | Sintéticos, sembrados al arrancar | Equipo de desarrollo |
| Desarrollo | Firebase (proyecto de desarrollo) | Sintéticos | Equipo de desarrollo |
| Pruebas | Firebase (proyecto de pruebas) | Anonimizados o sintéticos | Equipo funcional + líderes |
| Producción | Firebase (proyecto de producción) | Reales | Usuarios autorizados |

**Regla firme:** los datos de producción no se copian a entornos inferiores sin anonimización
previa.

---

## Configuración

Ningún secreto vive en el repositorio. Todo llega por variables de entorno del despliegue.

```bash
cp frontend/.env.example frontend/.env.local
```

| Variable | Valor | Notas |
|---|---|---|
| `VITE_BACKEND` | `local` \| `firebase` | Con `local` no se necesita nada más |
| `VITE_ALLOWED_DOMAIN` | `iets.org.co` | Dominio institucional admitido |
| `VITE_FIREBASE_API_KEY` | — | Del proyecto Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | — | |
| `VITE_FIREBASE_PROJECT_ID` | — | |
| `VITE_FIREBASE_STORAGE_BUCKET` | — | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | — | |
| `VITE_FIREBASE_APP_ID` | — | |

`.env.local` está fuera del control de versiones. En CI/CD, estas variables se inyectan desde el
gestor de secretos de la plataforma.

Si `VITE_BACKEND=firebase` y faltan credenciales, la aplicación **no queda inoperante**: se degrada
al adaptador local y lo advierte en consola. Esa degradación es deliberada para el entorno de
desarrollo; en producción la ausencia de credenciales debe fallar la canalización, no el navegador.

---

## Preparación del proyecto Firebase

1. **Crear el proyecto** y habilitar Firestore (modo producción), Authentication, Storage,
   Functions y Hosting.

2. **Habilitar Google como único proveedor** de Authentication. En *Authentication → Settings →
   Authorized domains*, dejar solo los dominios del despliegue.

3. **Restringir el dominio institucional.** La restricción real la aplica la función de bloqueo
   `bloqueoDeAcceso` (`functions/src/index.ts`), registrada como *blocking function* en
   `beforeSignIn`. La validación del cliente existe para dar un mensaje claro, no para impedir el
   acceso.

4. **Designar el primer administrador.** El primer ingreso crea el usuario con el rol de menor
   privilegio (`miembro`). Para elevarlo:

   ```bash
   # Con la cuenta de servicio del proyecto:
   node -e "
     const admin = require('firebase-admin');
     admin.initializeApp();
     admin.auth().getUserByEmail(process.argv[1]).then(async (u) => {
       await admin.auth().setCustomUserClaims(u.uid, { rol: 'administrador' });
       await admin.firestore().collection('usuarios').doc(u.uid).update({ rolGlobal: 'administrador' });
       console.log('Administrador designado:', u.email);
     });
   " correo@iets.org.co
   ```

   A partir de ahí los roles se administran desde **Usuarios y roles**. La función `alCambiarRol`
   sincroniza el custom claim y revoca los tokens de refresco, de modo que el rol nuevo toma efecto
   en el siguiente ingreso (consecuencia asumida en ADR-05).

---

## Puesta en producción

```bash
# 1. Verificación previa: nada se despliega con pruebas o tipos en rojo
cd frontend
npm ci
npm run lint          # verificación de tipos
npm test              # 146 pruebas
npm run build

# 2. Funciones
cd ../functions
npm ci
npm run build

# 3. Despliegue por partes, empezando por las barreras
cd ..
firebase use produccion
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting
```

El orden importa: las reglas de seguridad y los índices se despliegan **antes** que la aplicación,
para que ninguna versión del cliente quede activa contra reglas antiguas.

### Verificación posterior

| Comprobación | Resultado esperado |
|---|---|
| Ingreso con cuenta ajena al dominio | Rechazado por la función de bloqueo, con mensaje explícito |
| Ingreso con cuenta institucional | Acceso, y evento de auditoría con acción `acceso` |
| Lectura de un proyecto sin acceso concedido | Denegada por las reglas de Firestore |
| Escritura de un campo calculado desde la consola del navegador | Denegada por las reglas |
| Intento de editar un evento de auditoría | Denegado para todos los roles, administrador incluido |
| Escritura en un proyecto cerrado | Denegada salvo para el administrador |
| Dashboard con 300 actividades | Carga por debajo de 2,5 s |

---

## Reglas de seguridad

`firestore.rules` es la barrera real. La matriz de `auth/permisos.ts` es su espejo para la interfaz.
Lo que las reglas garantizan:

1. **Dominio institucional obligatorio** en toda colección, con correo verificado.
2. **Privilegio mínimo por rol**, tomado del custom claim del token.
3. **Los campos calculados no se escriben desde el cliente.**
4. **La auditoría es append-only**: se crea, nunca se actualiza ni se borra.
5. **Un proyecto cerrado es de solo lectura** salvo para el administrador.
6. **La baja es lógica:** el cliente marca `eliminado`; `delete` está denegado en todas las rutas.
7. **Cierre por defecto:** cualquier ruta no contemplada queda cerrada.
8. **El presupuesto solo lo escribe el líder** (HG-107).
9. **Un miembro solo puede tocar el avance de sus propias actividades**, y nada más de ellas.

Para probarlas antes de desplegar:

```bash
firebase emulators:start --only firestore,auth
# y ejecutar las pruebas de reglas contra el emulador
```

### Cabeceras HTTP

`firebase.json` define la política de seguridad de contenido, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff` y `Referrer-Policy`. Los activos versionados se cachean un año;
`index.html` no se cachea, para que un despliegue nuevo llegue de inmediato.

---

## Funciones de servidor

| Función | Disparador | Responsabilidad |
|---|---|---|
| `bloqueoDeAcceso` | `beforeSignIn` | Restricción de dominio, verificación de cuenta activa, alta del perfil, custom claim del rol, evento de acceso |
| `alCambiarRol` | Escritura en `usuarios/{uid}` | Sincroniza el custom claim y revoca los tokens de refresco |
| `alEscribirEntidad` | Escritura en subcolecciones de proyecto | Sello de auditoría con hora del servidor; marca de recálculo pendiente |
| `recalcularProyecto` | Llamada del cliente | Recalcula el avance y guarda la instantánea de la fecha de corte |
| `recalculoDiario` | 05:00 America/Bogota | Recalcula todos los proyectos activos |
| `archivarAuditoria` | Día 1 de cada mes, 03:00 | Archiva los eventos que superan la retención, sin destruirlos |

El sello del servidor cumple una función de control: si una entidad cambia sin que exista evento
del cliente, el evento del servidor lo delata. Es el respaldo de la trazabilidad frente a un
cliente manipulado.

---

## Migración de un proyecto existente

1. Crear el proyecto en el sistema con su código y su ficha.
2. Definir la lista de fases en la Ficha (el importador la usa para clasificar).
3. Descargar la plantilla desde **Importar y exportar → Importar**.
4. Volcar el contenido del libro a la plantilla.
5. Cargar el archivo. El sistema **valida antes de escribir** y produce un informe de hallazgos.
6. Corregir los errores bloqueantes en el origen y volver a cargar. Las advertencias se pueden
   aceptar; los errores no.
7. Confirmar la importación.
8. Ejecutar **Paridad de cálculos** y comparar contra el libro. Cada diferencia debe corresponder a
   un hallazgo del Anexo C. Si aparece una diferencia sin hallazgo asociado, es un defecto y debe
   investigarse antes de dar el proyecto por migrado.
9. Exportar la comparación y anexarla al acta de validación con el líder del proyecto.

---

## Copias y recuperación

- **Firestore:** exportaciones programadas a Cloud Storage con retención según la política
  institucional.
- **Auditoría:** los eventos archivados quedan en `auditoria_archivo`, no se destruyen. El
  registro completo se puede reconstruir uniendo ambas colecciones.
- **Storage:** versionado del bucket activado; las evidencias no se borran, se reemplazan.
- **Recuperación:** al restaurar Firestore, ejecutar `recalculoDiario` manualmente para regenerar
  las instantáneas de indicadores.
