import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
  const { request, env } = context;
  const db = neon(env.DATABASE_URL);

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  if (request.method === 'GET') {
    try {
      const r = await db(`SELECT data FROM airlines`);
      return new Response(JSON.stringify(r.map(x => x.data)), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    } catch (e) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const airline = {
      id: Date.now().toString(),
      name: body.name || '',
      logo: body.logo || '',
    };
    await db(
      `INSERT INTO airlines (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
      [airline.id, JSON.stringify(airline)]
    );
    return new Response(JSON.stringify(airline), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
}
