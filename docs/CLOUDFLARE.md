# Publicar el portal en Cloudflare

El portal queda en tu propia cuenta de Cloudflare (plan gratis), con una base de datos D1, acceso con contraseña y publicación automática cada vez que se actualiza este repositorio en GitHub.

```
GitHub (código)  ──push──▶  Cloudflare Pages  ──▶  https://portal-proyectos.pages.dev
                                   │
                                   ├── /portal/index.html      (la aplicación)
                                   ├── /functions/api/…        (API)
                                   └── D1 "portal-proyectos"   (base de datos)
                         Ingreso con contraseña (sesión de 30 días)
```

## 1. Crear la base de datos D1
1. Entra a **dash.cloudflare.com** (crea la cuenta si no tienes, es gratis).
2. Menú **Storage & databases → D1 SQL database → Create database**.
3. Nombre: `portal-proyectos` → **Create**.
   *(Las tablas se crean solas la primera vez que abres el portal. `schema.sql` es la referencia.)*

## 2. Crear el proyecto en Cloudflare Pages conectado a GitHub
1. **Workers & Pages → Create → Pages → Connect to Git**.
2. Autoriza GitHub y elige el repositorio **Proyect-AutomatizacionAlexis**.
3. Configuración de compilación:
   - **Framework preset:** None
   - **Build command:** *(vacío)*
   - **Build output directory:** `portal`
   - **Root directory:** *(vacío / raíz del repo)*
4. **Save and Deploy**. Quedará en una dirección tipo `https://portal-proyectos.pages.dev`.

## 3. Conectar la base de datos y las variables
En el proyecto de Pages → **Settings**:
1. **Bindings → Add → D1 database**: Variable name `DB`, base `portal-proyectos`.
2. **Variables and Secrets → Add**:
   - `PORTAL_PASSWORD` como **Secret** (tipo *Encrypt*): la contraseña con la que vas a entrar. Mínimo 12 caracteres.
   - *(Opcional)* `ANTHROPIC_API_KEY` como **Secret** para activar Claude dentro del portal (se cobra por uso en console.anthropic.com).
3. **Deployments → … → Retry deployment** para que tome los cambios.

## 4. (Opcional) Doble protección con Cloudflare Access
Si además quieres un código por correo, agrega `ALLOWED_EMAILS` y configura Access:
1. **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Dominio: `portal-proyectos.pages.dev` (y también `*.portal-proyectos.pages.dev` para las vistas previas).
3. Política **Allow** → *Include* → **Emails** → tu correo.
4. Método de ingreso: **One-time PIN** (te llega un código al correo).

Sin `PORTAL_PASSWORD` ni `ALLOWED_EMAILS` el portal no muestra datos. Tras 8 intentos fallidos de contraseña desde la misma IP, el ingreso se bloquea 15 minutos. Cambiar la contraseña cierra todas las sesiones abiertas.

## 5. Cargar tus datos
1. Abre la dirección del portal e ingresa con tu contraseña.
2. **⚙ Ajustes → Restaurar respaldo** y elige el archivo `Respaldo_Portal_….json`.
   El respaldo se descarga desde la versión de claude.ai en **⚙ Ajustes → Descargar respaldo**.

## Uso diario
- **PC y celular:** la misma dirección en cualquier navegador. En el celular: menú del navegador → *Agregar a pantalla de inicio*.
- **Sincronización:** los cambios se guardan en D1 al instante y los otros dispositivos se actualizan cada 20 segundos o al volver a la pestaña. Sin conexión, los cambios quedan en cola y se suben al volver.
- **Respaldo:** D1 guarda historial de 30 días (Time Travel). Además, descarga un respaldo JSON cada cierto tiempo.
- **Consultas SQL:** en la consola de D1 puedes consultar `v_horas_proyecto` y `v_horas_mes`.

## Diferencias con la versión de claude.ai
| Función | claude.ai | Cloudflare |
|---|---|---|
| Proyectos, actividades, horas, diagramas, Excel, Word, Visio | ✔ | ✔ |
| Claude (minutas, análisis, reportes) | ✔ incluido | ✔ con `ANTHROPIC_API_KEY` |
| Outlook, Fireflies y OneDrive (conectores) | ✔ | ✖ (usa importación .ics y archivos) |
| Acceso sin cuenta de Claude | ✖ | ✔ |

## Desarrollo local
```bash
cp wrangler.toml.example wrangler.toml   # ajusta database_id
npx wrangler pages dev portal
```
