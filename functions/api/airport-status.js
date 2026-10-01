import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
  const { request, env } = context;
  const db = neon(env.DATABASE_URL);

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (request.method === 'GET') {
    try {
      const r = await db(`SELECT value FROM settings WHERE key = 'airport_status'`);
      const status = r[0]?.value || 'open';
      return new Response(JSON.stringify({ status }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    } catch (e) {
      return new Response(JSON.stringify({ status: 'open' }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
  }

  if (request.method === 'POST') {
    const body = await request.json();
    await db(
      `INSERT INTO settings (key, value) VALUES ('airport_status', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [body.status]
    );
    return new Response(JSON.stringify({ status: body.status }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
}
