-- Portal de Proyectos · esquema de base de datos (Cloudflare D1 / SQLite)
-- La API crea estas tablas sola la primera vez que se usa. Este archivo es
-- la referencia y sirve para crearlas a mano desde la consola de D1.

CREATE TABLE IF NOT EXISTS clientes (
  id          TEXT PRIMARY KEY,          -- CLI-001
  nombre      TEXT NOT NULL,
  alias       TEXT,                      -- otros nombres, separados por ;
  data        TEXT NOT NULL,             -- registro completo en JSON
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proyectos (
  id          TEXT PRIMARY KEY,          -- PRY-001
  nombre      TEXT NOT NULL,
  cliente_id  TEXT,                      -- clientes.id
  tipo        TEXT,                      -- Proyecto | Soporte
  estado      TEXT,                      -- Planificación | En curso | En riesgo | Cerrado
  avance      INTEGER,
  inicio      TEXT,
  cierre      TEXT,
  alias       TEXT,                      -- nombres usados en Excel, separados por ;
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actividades (
  id              TEXT PRIMARY KEY,      -- A1, A2…
  num             INTEGER,               -- ID visible
  fecha_apertura  TEXT,
  fecha_cierre    TEXT,
  horario         TEXT,                  -- Horario laboral | Fuera de horario
  servicio        TEXT,
  solicitante     TEXT,
  responsable     TEXT,
  tecnologia      TEXT,
  fabricante      TEXT,
  estado          TEXT,                  -- En curso | Terminado
  cliente         TEXT,
  cliente_id      TEXT,                  -- clientes.id
  proyecto_id     TEXT,                  -- proyectos.id
  proyecto        TEXT,
  titulo          TEXT,                  -- actividad / detalle
  horas           REAL,                  -- horas dedicadas
  contacto        TEXT,
  observaciones   TEXT,
  data            TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_act_proyecto ON actividades(proyecto_id);
CREATE INDEX IF NOT EXISTS ix_act_fecha    ON actividades(fecha_apertura);

-- Pendientes, reuniones, diagramas, calendario y ajustes
CREATE TABLE IF NOT EXISTS items (
  kind        TEXT NOT NULL,
  id          TEXT NOT NULL,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

-- Vistas para reportes (consultables desde la consola de D1)
CREATE VIEW IF NOT EXISTS v_horas_proyecto AS
  SELECT p.id, p.nombre AS proyecto, c.nombre AS cliente, p.tipo, p.estado,
         COUNT(a.id) AS actividades,
         ROUND(SUM(COALESCE(a.horas,0)),1) AS horas,
         ROUND(SUM(CASE WHEN a.horario='Fuera de horario' THEN COALESCE(a.horas,0) ELSE 0 END),1) AS horas_fuera_horario,
         MAX(COALESCE(NULLIF(a.fecha_cierre,''), a.fecha_apertura)) AS ultima_actividad
  FROM proyectos p
  LEFT JOIN clientes c ON c.id = p.cliente_id
  LEFT JOIN actividades a ON a.proyecto_id = p.id
  GROUP BY p.id;

CREATE VIEW IF NOT EXISTS v_horas_mes AS
  SELECT substr(fecha_apertura,1,7) AS mes, responsable,
         COUNT(*) AS actividades, ROUND(SUM(COALESCE(horas,0)),1) AS horas
  FROM actividades GROUP BY mes, responsable;
