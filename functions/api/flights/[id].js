import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = neon(env.DATABASE_URL);
  const id = params.id;

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'departure';
  const table = type === 'departure' ? 'departures' : 'arrivals';

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  if (request.method === 'PUT') {
    const body = await request.json();
    const r = await db(`SELECT data FROM ${table} WHERE id = $1`, [id]);
    if (r.length === 0) {
      return new Response(JSON.stringify({ error: 'Не найден' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
    const updated = { ...r[0].data, ...body, id: r[0].data.id };
    await db(
      `INSERT INTO ${table} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
      [updated.id, JSON.stringify(updated)]
    );
    return new Response(JSON.stringify(updated), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  if (request.method === 'DELETE') {
    await db(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return new Response(null, { status: 204, headers: cors });
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
}
