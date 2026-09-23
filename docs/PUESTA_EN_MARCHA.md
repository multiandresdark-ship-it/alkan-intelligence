# Puesta en marcha de la consola de Randall

## Estado comprobado
- Repositorio: https://github.com/multiandresdark-ship-it/alkan-intelligence
- Aplicacion: `apps/randall-console`.
- Base elegida: alkanhunter (`qyesctuksvtblegkinrj`).
- Instalacion limpia, compilacion y 13 pruebas unitarias correctas.
- Diez comprobaciones de navegador con datos simulados; no equivalen a un piloto real.
- Migraciones de casos, permisos y recepcion de señales aplicadas.
- Publicacion web pendiente de completar el inicio de sesion en Vercel.

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

Hace falta acordar el correo que usara Randall y el espacio cliente correcto. La consola no crea usuarios ni envia invitaciones por su cuenta.

## Conectar el motor
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
