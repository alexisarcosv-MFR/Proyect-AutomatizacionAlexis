// Portal de Proyectos · API (Cloudflare Pages Functions + D1)
// Rutas:
//   GET    /api/health                 estado, usuario y si Claude está activo
//   GET    /api/items[?rev=]           todos los datos (304 si no cambiaron)
//   PUT    /api/items/:kind/:id        crear o actualizar un elemento
//   DELETE /api/items/:kind/:id        borrar un elemento
//   POST   /api/bulk                   restaurar respaldo { items:[...] }
//   POST   /api/claude                 consulta a Claude (requiere ANTHROPIC_API_KEY)
//
// Variables de entorno (Cloudflare → Pages → Settings → Variables):
//   DB                 enlace (binding) a la base D1               (obligatorio)
//   ALLOWED_EMAILS     correos autorizados, separados por coma     (recomendado, junto a Cloudflare Access)
//   ANTHROPIC_API_KEY  clave de la API de Claude, como secreto     (opcional)
//   CLAUDE_MODEL       modelo de Claude (por defecto claude-sonnet-5-5)

const KINDS = ['client', 'project', 'activity', 'task', 'meeting', 'diagram', 'config', 'ics'];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS clientes (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, alias TEXT, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS proyectos (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, cliente_id TEXT, tipo TEXT, estado TEXT, avance INTEGER, inicio TEXT, cierre TEXT, alias TEXT, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS actividades (id TEXT PRIMARY KEY, num INTEGER, fecha_apertura TEXT, fecha_cierre TEXT, horario TEXT, servicio TEXT, solicitante TEXT, responsable TEXT, tecnologia TEXT, fabricante TEXT, estado TEXT, cliente TEXT, cliente_id TEXT, proyecto_id TEXT, proyecto TEXT, titulo TEXT, horas REAL, contacto TEXT, observaciones TEXT, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ix_act_proyecto ON actividades(proyecto_id)`,
  `CREATE INDEX IF NOT EXISTS ix_act_fecha ON actividades(fecha_apertura)`,
  `CREATE TABLE IF NOT EXISTS items (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (kind, id))`,
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE VIEW IF NOT EXISTS v_horas_proyecto AS SELECT p.id, p.nombre AS proyecto, c.nombre AS cliente, p.tipo, p.estado, COUNT(a.id) AS actividades, ROUND(SUM(COALESCE(a.horas,0)),1) AS horas, ROUND(SUM(CASE WHEN a.horario='Fuera de horario' THEN COALESCE(a.horas,0) ELSE 0 END),1) AS horas_fuera_horario, MAX(COALESCE(NULLIF(a.fecha_cierre,''), a.fecha_apertura)) AS ultima_actividad FROM proyectos p LEFT JOIN clientes c ON c.id = p.cliente_id LEFT JOIN actividades a ON a.proyecto_id = p.id GROUP BY p.id`,
  `CREATE VIEW IF NOT EXISTS v_horas_mes AS SELECT substr(fecha_apertura,1,7) AS mes, responsable, COUNT(*) AS actividades, ROUND(SUM(COALESCE(horas,0)),1) AS horas FROM actividades GROUP BY mes, responsable`,
];

let ready = false;
async function migrate(db) {
  if (ready) return;
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  ready = true;
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

const str = v => (v == null ? '' : String(v)).slice(0, 4000);
const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
const aliases = a => (Array.isArray(a) ? a.join('; ') : str(a));

function upsert(db, kind, obj, now) {
  const data = JSON.stringify({ ...obj, kind: undefined });
  const id = str(obj.id);
  if (kind === 'client')
    return db.prepare(`INSERT INTO clientes (id,nombre,alias,data,updated_at) VALUES (?1,?2,?3,?4,?5)
      ON CONFLICT(id) DO UPDATE SET nombre=?2, alias=?3, data=?4, updated_at=?5`)
      .bind(id, str(obj.name) || id, aliases(obj.aliases), data, now);
  if (kind === 'project')
    return db.prepare(`INSERT INTO proyectos (id,nombre,cliente_id,tipo,estado,avance,inicio,cierre,alias,data,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
      ON CONFLICT(id) DO UPDATE SET nombre=?2, cliente_id=?3, tipo=?4, estado=?5, avance=?6, inicio=?7, cierre=?8, alias=?9, data=?10, updated_at=?11`)
      .bind(id, str(obj.name) || id, str(obj.clientId), str(obj.tipo), str(obj.status), num(obj.progress), str(obj.start), str(obj.end), aliases(obj.aliases), data, now);
  if (kind === 'activity')
    return db.prepare(`INSERT INTO actividades (id,num,fecha_apertura,fecha_cierre,horario,servicio,solicitante,responsable,tecnologia,fabricante,estado,cliente,cliente_id,proyecto_id,proyecto,titulo,horas,contacto,observaciones,data,updated_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)
      ON CONFLICT(id) DO UPDATE SET num=?2, fecha_apertura=?3, fecha_cierre=?4, horario=?5, servicio=?6, solicitante=?7, responsable=?8, tecnologia=?9, fabricante=?10, estado=?11, cliente=?12, cliente_id=?13, proyecto_id=?14, proyecto=?15, titulo=?16, horas=?17, contacto=?18, observaciones=?19, data=?20, updated_at=?21`)
      .bind(id, num(obj.num), str(obj.fechaApertura), str(obj.fechaCierre), str(obj.horario), str(obj.servicio), str(obj.solicitante), str(obj.responsable), str(obj.tecnologia), str(obj.fabricante), str(obj.estado), str(obj.cliente), str(obj.clientId), str(obj.projectId), str(obj.proyecto), str(obj.titulo), num(obj.horas), str(obj.contacto), str(obj.observaciones), data, now);
  return db.prepare(`INSERT INTO items (kind,id,data,updated_at) VALUES (?1,?2,?3,?4)
    ON CONFLICT(kind,id) DO UPDATE SET data=?3, updated_at=?4`).bind(kind, id, data, now);
}
function remove(db, kind, id) {
  const t = { client: 'clientes', project: 'proyectos', activity: 'actividades' }[kind];
  return t ? db.prepare(`DELETE FROM ${t} WHERE id=?1`).bind(id) : db.prepare(`DELETE FROM items WHERE kind=?1 AND id=?2`).bind(kind, id);
}
const bump = (db, now) => db.prepare(`INSERT INTO meta (k,v) VALUES ('rev',?1) ON CONFLICT(k) DO UPDATE SET v=?1`).bind(now + '-' + Math.random().toString(36).slice(2, 8));
async function getRev(db) { const r = await db.prepare(`SELECT v FROM meta WHERE k='rev'`).first(); return r ? r.v : '0'; }

function whoIs(request, env) {
  const email = (request.headers.get('cf-access-authenticated-user-email') || '').toLowerCase();
  const allowed = (env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return { ok: true, email, protected: false };
  return { ok: allowed.includes(email), email, protected: true };
}

async function askClaude(env, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env.CLAUDE_MODEL || 'claude-sonnet-5-5', max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (r.status === 429) return json({ error: 'rate_limited' }, 429);
  if (!r.ok) return json({ error: 'claude_error', status: r.status }, 502);
  const d = await r.json();
  return json({ text: (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('') });
}

export async function onRequest({ request, env, params }) {
  const parts = Array.isArray(params.route) ? params.route : [params.route].filter(Boolean);
  const [res, kind, rawId] = parts;
  const method = request.method;
  const user = whoIs(request, env);

  if (res === 'health') {
    return json({ app: 'portal-proyectos', version: 2, db: !!env.DB, ai: !!env.ANTHROPIC_API_KEY, user: user.email, protected: user.protected, allowed: user.ok });
  }
  if (!user.ok) return json({ error: 'forbidden' }, 403);
  if (!env.DB) return json({ error: 'Falta enlazar la base D1 con el nombre DB' }, 500);
  const db = env.DB;
  await migrate(db);
  const now = new Date().toISOString();

  if (res === 'items' && method === 'GET' && !kind) {
    const rev = await getRev(db);
    const since = new URL(request.url).searchParams.get('rev');
    if (since && since === rev) return new Response(null, { status: 304, headers: { 'cache-control': 'no-store' } });
    const [c, p, a, i] = await db.batch([
      db.prepare(`SELECT data FROM clientes`), db.prepare(`SELECT data FROM proyectos`),
      db.prepare(`SELECT data FROM actividades`), db.prepare(`SELECT kind, data FROM items`),
    ]);
    const out = [];
    const add = (rows, k) => rows.results.forEach(r => { try { out.push({ ...JSON.parse(r.data), kind: k || r.kind }); } catch (e) {} });
    add(c, 'client'); add(p, 'project'); add(a, 'activity'); add(i);
    return json({ rev, items: out });
  }

  if (res === 'items' && kind && rawId) {
    if (!KINDS.includes(kind)) return json({ error: 'tipo no válido' }, 400);
    const id = decodeURIComponent(rawId);
    if (method === 'PUT') {
      let obj; try { obj = await request.json(); } catch (e) { return json({ error: 'JSON no válido' }, 400); }
      if (!obj || typeof obj !== 'object') return json({ error: 'cuerpo no válido' }, 400);
      obj.id = id; delete obj.kind;
      if (JSON.stringify(obj).length > 900000) return json({ error: 'elemento demasiado grande' }, 413);
      await db.batch([upsert(db, kind, obj, now), bump(db, now)]);
      return json({ ok: true });
    }
    if (method === 'DELETE') { await db.batch([remove(db, kind, id), bump(db, now)]); return json({ ok: true }); }
  }

  if (res === 'bulk' && method === 'POST') {
    let body; try { body = await request.json(); } catch (e) { return json({ error: 'JSON no válido' }, 400); }
    const items = (body && Array.isArray(body.items) ? body.items : []).filter(o => o && KINDS.includes(o.kind) && o.id);
    for (let i = 0; i < items.length; i += 80) {
      const chunk = items.slice(i, i + 80).map(o => { const { kind, ...rest } = o; return upsert(db, kind, rest, now); });
      await db.batch(chunk);
    }
    await bump(db, now).run();
    return json({ ok: true, count: items.length });
  }

  if (res === 'claude' && method === 'POST') {
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'Claude no está configurado' }, 501);
    let body; try { body = await request.json(); } catch (e) { return json({ error: 'JSON no válido' }, 400); }
    const prompt = String((body && body.prompt) || '').slice(0, 150000);
    if (!prompt) return json({ error: 'falta prompt' }, 400);
    return askClaude(env, prompt);
  }

  return json({ error: 'ruta no encontrada' }, 404);
}
