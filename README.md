# Proyecto Automatización · Alexis

Portal personal para gestionar proyectos de redes/TI: proyectos con carpetas, reuniones con minutas hechas por Claude, pendientes, agenda con Outlook, diagramas de red con interfaces y tráfico, y reportes de avance.

**Portal en uso:** https://claude.ai/artifact/WPQaY9QWcZR7p1y9Mknktx
(se abre desde claude.ai en el PC o en la app de Claude del celular; los datos se sincronizan en la nube)

## Qué hay en este repositorio

| Carpeta | Contenido |
|---|---|
| `portal/index.html` | Código completo del portal (una sola página: HTML + CSS + JavaScript) |
| `docs/datos-ejemplo.json` | Datos de ejemplo (proyectos, pendientes, reuniones y un diagrama) |

## Secciones del portal

- **Inicio:** indicadores, avance por proyecto, próximas reuniones, pendientes urgentes y "Pregúntale a Claude".
- **Proyectos:** ficha por proyecto con estado, avance, carpetas estándar (01_Gestion … 06_Entregables), pendientes y reuniones.
- **Reuniones:** importa una reunión desde Fireflies (o pega/sube un .txt/.vtt) y Claude arma la minuta: resumen, acuerdos, riesgos y pendientes con responsable y plazo.
- **Pendientes:** lista filtrable por proyecto y estado; cada pendiente guarda su origen (reunión o manual).
- **Agenda:** semana con reuniones del portal, vencimientos y eventos de Outlook; puede crear el evento también en Outlook.
- **Diagramas:** equipos (hostname, modelo, IP), enlaces con interfaz A/B, velocidad, medio, VLAN, % de uso y sentido; tráfico animado, trazado de ruta entre equipos y tabla de interfaces copiable. Claude puede agregar equipos y enlaces desde una descripción.
- **Reportes:** reporte semanal automático; con Claude, redactado para jefatura.

## Cómo funciona por dentro

- **Datos:** colección `items` en la base de datos del artifact. Cada documento tiene `kind` = `project`, `task`, `meeting` o `diagram`.
- **IA:** capacidad `sample` del artifact (Claude).
- **Calendario:** conector Microsoft 365 (`outlook_calendar_search`, `outlook_create_event`).
- **Transcripciones:** conector Fireflies (`fireflies_get_transcripts`, `fireflies_get_transcript`).
- **Sin conexión:** si el archivo se abre fuera de claude.ai, funciona en modo local (datos solo en ese navegador) y la IA usa reglas simples.

## Transcripciones

Teams es institucional (sin acceso de administrador), por lo que las reuniones se transcriben con la **app de escritorio de Fireflies** (graba el audio del equipo, sin bot). Avisar siempre a los participantes que se está grabando.

## Próximos pasos

- [ ] Reemplazar los datos de ejemplo por proyectos reales
- [ ] Biblioteca de íconos exportados de Visio (SVG) en el editor de diagramas
- [ ] Zoom del diagrama en el celular
- [ ] Versión independiente (Next.js + Supabase + Vercel) si se necesita fuera de claude.ai
