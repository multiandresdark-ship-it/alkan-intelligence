# Puesta en marcha de la consola de Randall

## Estado comprobado
- Repositorio: https://github.com/multiandresdark-ship-it/alkan-intelligence
- Aplicacion: `apps/randall-console`.
- Base elegida: alkanhunter (`qyesctuksvtblegkinrj`).
- Instalacion limpia, compilacion y 13 pruebas unitarias correctas.
- Diez comprobaciones de navegador con datos simulados; no equivalen a un piloto real.
- Migraciones de casos, permisos y recepcion de señales aplicadas.
- Publicada: https://randall-console.vercel.app/ . Vercel confirma el despliegue de produccion listo.
- Se verificaron el acceso publico, el inicio de sesion de una cuenta operativa ya asignada y la navegacion del espacio real.
- Apify conectado: se importaron 22 permisos reales como evidencia sin verificar; repetir la importacion no crea duplicados. La fecha original de esos registros es el 3 de septiembre de 2026. Aun faltan contactos confirmados y un piloto de calificacion.

## Publicar en Vercel
Importar el repositorio existente en el equipo de Vercel del propietario. Configurar:
- Root Directory: `apps/randall-console`.
- Framework Preset: Vite.
- Node.js: 24.x.
- Build Command: `npm run build`.
- Output Directory: `dist`.
- Install Command: `npm ci`.
- `VITE_SUPABASE_URL`: URL publica de alkanhunter.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publicable de alkanhunter.

La clave de servicio del motor nunca va en variables VITE ni en el navegador.
Despues de publicar, abrir la URL sin una sesion de Vercel y comprobar que aparece el acceso de ALKAN/Randall. Una pantalla de acceso publica no da acceso a los datos.

## Dar acceso a Randall
Usar la cuenta acordada de Supabase Auth y asociarla a su espacio cliente mediante `client_profiles`, siguiendo el modelo existente de alkanhunter. No adivinar el cliente ni conceder acceso a todos los espacios.
Iniciar sesion en la consola y confirmar que solo aparecen sus registros.

La cuenta operativa proporcionada ya estaba confirmada y asignada; se verifico su entrada a la consola. Si Randall usara una cuenta distinta, falta acordar su correo y espacio. La consola no crea usuarios ni envia invitaciones por su cuenta.

## Conectar el motor
La entrada desde Apify ya funciona en **Actor Connections**: seleccionar actor, ejecucion completada, vista previa e importar la pagina. El secreto existente `alkan leads` se consume solo en el servidor. Consultar [APIFY_CONNECTION.md](APIFY_CONNECTION.md) para configuracion y limites. No hace falta otra clave para importar ejecuciones existentes; esta version no inicia ni programa corridas.

El codigo de GitHub debe ejecutarse en un servidor o entorno de trabajo del motor. Publicar la consola en Vercel no inicia los recolectores.

1. Seleccionar un lead real ya existente y su cliente.
2. Preparar un archivo de entrada con los campos descritos en [MOTOR_CONTRACT.md](MOTOR_CONTRACT.md), incluida evidencia publica y la fecha de observacion.
3. Ejecutar desde la raiz del repositorio:

```sh
node engine/score-financing.ts input.json events.json
python engine/financing_bridge.py events.json
```

4. Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` unicamente en el entorno servidor del motor.
5. Enviar el evento revisado:

```sh
python engine/financing_bridge.py events.json --apply
```

6. Abrir el mismo lead en la consola y comparar fuentes, fecha, razones y puntuaciones.

El modo inicial es de validacion, sin escrituras. Los eventos no crean solicitudes de credito ni marcan aprobaciones o desembolsos.
Antes de programar recolecciones, confirmar el host del motor y verificar las fuentes SAM/WSDOT. La paginacion y los filtros de WSDOT siguen pendientes.

## Piloto con Randall
Acordar criterios de aceptacion, documentos necesarios y motivos de rechazo. Cargar el lote real que el socio apruebe.
Usar Follow-up Desk para registrar responsable operativo mediante notas, siguiente accion y fecha; completar la calificacion a partir de respuestas confirmadas.
Separar siempre monto solicitado, decision del socio y monto realmente desembolsado.

## Pruebas reproducibles
```sh
python -m unittest discover -s engine -p "test_*.py"
node --test engine/score-financing.test.ts
cd apps/randall-console
npm ci
npm test
npm run build
```
