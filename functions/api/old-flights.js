import { neon } from '@neondatabase/serverless';

function getLocalNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (4 * 3600000));
}

function getTodayStr() {
  return getLocalNow().toISOString().slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = neon(env.DATABASE_URL);

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  if (request.method === 'DELETE') {
    const today = getTodayStr();
    const r = await db(`SELECT id, data FROM departures`);
    const flights = r.map(x => ({ id: x.id, ...x.data }));

    const toDelete = flights.filter(f => {
      if (f.scheduledDeparture && f.scheduledDeparture.slice(0, 10) >= today) return false;
      if (f.status === 'departed' || f.status === 'early_departed') return false;
      return true;
    });

    for (const f of toDelete) {
      await db(`DELETE FROM departures WHERE id = $1`, [f.id]);
    }

    return new Response(JSON.stringify({
      deleted: toDelete.length,
      kept: flights.length - toDelete.length,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
}
