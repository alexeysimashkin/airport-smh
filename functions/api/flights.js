// functions/api/flights.js
import { neon } from '@neondatabase/serverless';

// ===== Время (Самара, UTC+4) =====
function getLocalNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (4 * 3600000));
}

function getTodayStr() {
  return getLocalNow().toISOString().slice(0, 10);
}

function getTomorrowStr() {
  const d = getLocalNow();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ===== Список ежедневных рейсов =====
const DAILY_FLIGHTS = [
  "AS-9482|Баку|GYD|ASO Airlines|00:40",
  "UT-478|Сургут|SGC|Utair|01:30",
  "AS-9987|Дубай|DXB|ASO Airlines|02:30",
  "NS-601|Сочи|AER|Noris|03:00",
  "6N-344|Тобольск|RMZ|Severavia|03:05",
  "PC-5723|Анталья|AYT|Pegasus Airlines|04:15",
  "AS-620|Краснодар|KRR|ASO Airlines|06:45",
  "6N-572|Санкт-Петербург|LED|Severavia|07:00",
  "AS-2959|Сочи|AER|ASO Airlines|08:05",
  "6N-645|Екатеринбург|HBS|Severavia|09:00",
  "AS-9830|Пекин|PEK|ASO Airlines|10:20",
  "NS-383|Краснодар|KRR|Noris|10:30",
  "AS-478|Сургут|SGC|ASO Airlines|12:15",
  "AS-1084|Геленджик|GDZ|ASO Airlines|13:00",
  "AS-1212|Москва|SVO|ASO Airlines|13:10",
  "6N-1305|Тюмень|TUM|Severavia|13:15",
  "5N-532|Санкт-Петербург|LED|Smartavia|13:15",
  "UT-282|Екатеринбург|HBS|Utair|13:55",
  "6N-573|Санкт-Петербург|PSH|Severavia|14:10",
  "6N-3140|Сухум|SUI|Severavia|14:15",
  "AS-9204|Анталья|AYT|ASO Airlines|14:20",
  "S7-5032|Новосибирск|OVB|S7 Airlines|15:10",
  "AS-130|Нижневартовск|NJC|ASO Airlines|15:15",
  "AS-6201|Санкт-Петербург|PSH|ASO Airlines|15:30",
  "AS-2957|Сочи|AER|ASO Airlines|16:00",
  "AS-1478|Сургут|SGC|ASO Airlines|16:45",
  "AS-1214|Москва|SVO|ASO Airlines|17:00",
  "6N-3088|Астана|NQZ|Severavia|17:10",
  "6N-3090|Алматы|ALA|Severavia|17:20",
  "AS-856|Калининград|KGD|ASO Airlines|17:30",
  "AS-6354|Санкт-Петербург|PSH|ASO Airlines|17:35",
  "S7-1074|Москва|DME|S7 Airlines|18:00",
  "6N-332|Сочи|AER|Severavia|18:05",
  "AS-9201|Доха|DOH|ASO Airlines|18:15",
  "AS-1210|Москва|SVO|ASO Airlines|18:30",
  "AS-3011|Владивосток|VVO|ASO Airlines|19:20",
  "NS-418|Сургут|SGC|Noris|19:35",
  "AS-9189|Гоа|GOX|ASO Airlines|19:50",
  "AS-1130|Нижневартовск|NJC|ASO Airlines|20:00",
  "AS-9350|Мале|MLE|ASO Airlines|20:10",
  "SU-1215|Москва|SVO|Аэрофлот|20:40",
  "6N-647|Екатеринбург|HBS|Severavia|20:50",
  "AS-1216|Москва|SVO|ASO Airlines|21:00",
  "AS-9479|Самарканд|SKD|ASO Airlines|21:10",
  "DP-572|Санкт-Петербург|LED|Победа|21:35",
  "SU-1607|Москва|SVO|Аэрофлот|21:50",
  "AS-2915|Челябинск|CEK|ASO Airlines|22:00",
  "AS-3841|Новосибирск|OVB|ASO Airlines|23:05",
  "UT-358|Москва|VKO|Utair|23:10",
  "AS-9344|Хургада|HRG|ASO Airlines|23:10",
  "S7-5034|Новосибирск|OVB|S7 Airlines|23:30",
  "AS-9352|Наманган|NMA|ASO Airlines|23:35",
  "6N-6388|Стамбул|IST|Severavia|23:40",
];

function parseFlight(str) {
  const [flightNumber, destination, iataCode, airline, time] = str.split('|');
  return { flightNumber, destination, iataCode, airline, time };
}

function makeFlight(f, dateStr) {
  const id = f.flightNumber + '-' + dateStr;
  return {
    id, flightNumber: f.flightNumber, destination: f.destination,
    iataCode: f.iataCode, airline: f.airline, scheduledTime: f.time,
    scheduledDeparture: dateStr + 'T' + f.time + ':00',
    expectedDeparture: null, checkInStart: null, checkInEnd: null,
    checkInCounters: '', boardingStart: null, boardingEnd: null,
    boardingGate: '', status: 'scheduled'
  };
}

async function loadFlights(db, table) {
  try {
    const r = await db(`SELECT data FROM ${table}`);
    return r.map(x => x.data);
  } catch (e) { return []; }
}

async function saveOne(db, f, table) {
  await db(`INSERT INTO ${table} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
    [f.id, JSON.stringify(f)]);
}

async function deleteOne(db, id, table) {
  await db(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

async function ensureDailyFlights(db) {
  const flights = await loadFlights(db, 'departures');
  const today = getTodayStr();
  const tomorrow = getTomorrowStr();
  const existingIds = new Set(flights.map(f => f.id));
  const toAdd = [];
  for (const str of DAILY_FLIGHTS) {
    const f = parseFlight(str);
    const idToday = f.flightNumber + '-' + today;
    if (!existingIds.has(idToday)) toAdd.push(makeFlight(f, today));
    const idTomorrow = f.flightNumber + '-' + tomorrow;
    if (!existingIds.has(idTomorrow)) toAdd.push(makeFlight(f, tomorrow));
  }
  for (const f of toAdd) await saveOne(db, f, 'departures');
}

function computeStatus(f) {
  if (f.status === 'cancelled') return 'cancelled';
  if (f.status === 'departed') return 'departed';
  if (f.status === 'early_departed') return 'early_departed';
  if (f.status === 'suspended') return 'suspended';
  if (f.status === 'feeding') return 'feeding';
  const now = getLocalNow();
  const ci = f.checkInStart ? new Date(f.checkInStart) : null;
  const ce = f.checkInEnd ? new Date(f.checkInEnd) : null;
  const bs = f.boardingStart ? new Date(f.boardingStart) : null;
  const be = f.boardingEnd ? new Date(f.boardingEnd) : null;
  const sched = f.scheduledDeparture ? new Date(f.scheduledDeparture) : null;
  const exp = f.expectedDeparture ? new Date(f.expectedDeparture) : null;
  const isEarly = exp && sched && exp < sched && now < sched;
  if (isEarly) {
    if (be && now > be) return 'boarding_completed';
    if (bs && be && now >= bs && now <= be) return 'boarding';
    if (ce && now > ce && (!bs || now < bs)) return 'checkin_completed';
    if (ci && ce && now >= ci && now <= ce) return 'checkin';
    return 'early';
  }
  if (be && now > be) return 'boarding_completed';
  if (bs && be && now >= bs && now <= be) return 'boarding';
  if (ce && now > ce && (!bs || now < bs)) return 'checkin_completed';
  if (ci && ce && now >= ci && now <= ce) return 'checkin';
  if (exp && sched && exp > sched && now < exp) return 'delayed';
  return 'scheduled';
}

function getStatusText(f) {
  if (f.status === 'cancelled') return 'Отменён';
  if (f.status === 'departed') return 'Вылетел';
  if (f.status === 'early_departed') return 'Вылетел';
  if (f.status === 'suspended') return 'Приостановлено';
  if (f.status === 'feeding') return 'Предоставление\nпитания';
  const s = computeStatus(f);
  const exp = f.expectedDeparture ? new Date(f.expectedDeparture) : null;
  const time = exp ? `${String(exp.getHours()).padStart(2,'0')}:${String(exp.getMinutes()).padStart(2,'0')}` : '';
  if (s === 'early') return `Вылет раньше\n(ожидается в ${time})`;
  if (s === 'delayed') return `Задержан до ${time}`;
  if (s === 'checkin') return 'Регистрация';
  if (s === 'checkin_completed') return 'Регистрация закончена';
  if (s === 'boarding') return 'Посадка';
  if (s === 'boarding_completed') return 'Посадка закончена';
  return 'По расписанию';
}

function getFlightDay(f) {
  const dep = f.expectedDeparture ? new Date(f.expectedDeparture)
    : f.scheduledDeparture ? new Date(f.scheduledDeparture) : null;
  if (!dep || isNaN(dep.getTime())) return 'today';
  const now = getLocalNow();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  if (dep >= tomorrowStart) return 'tomorrow';
  return 'today';
}

// ===== Обработчик =====
export async function onRequest(context) {
  const { request, env } = context;
  const db = neon(env.DATABASE_URL);

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'departure';
  const table = type === 'departure' ? 'departures' : 'arrivals';

  if (request.method === 'GET') {
    await ensureDailyFlights(db);
    let flights = await loadFlights(db, table);

    const showDep = url.searchParams.get('showDeparted') === 'true';
    const today = getLocalNow().toISOString().slice(0, 10);

    const cleaned = flights.filter(f => {
      if ((f.status === 'departed' || f.status === 'early_departed' || f.status === 'arrived') && f.scheduledDeparture)
        return f.scheduledDeparture.slice(0, 10) >= today;
      return true;
    });
    if (cleaned.length !== flights.length) {
      for (const f of flights) if (!cleaned.includes(f)) await deleteOne(db, f.id, table);
      flights = cleaned;
    }

    if (!showDep) {
      if (type === 'departure') flights = flights.filter(f => f.status !== 'departed' && f.status !== 'early_departed');
      else flights = flights.filter(f => f.status !== 'arrived');
    }

    flights = flights.map(f => ({
      ...f,
      computedStatus: computeStatus(f),
      statusText: getStatusText(f),
      flightDay: getFlightDay(f),
    }));

    flights.sort((a, b) => {
      const ta = a.expectedDeparture || a.scheduledDeparture || '';
      const tb = b.expectedDeparture || b.scheduledDeparture || '';
      return ta.localeCompare(tb);
    });

    return new Response(JSON.stringify(flights), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const f = {
      id: Date.now().toString(),
      flightNumber: body.flightNumber || '',
      destination: body.destination || '',
      iataCode: body.iataCode || '',
      airline: body.airline || '',
      scheduledTime: body.scheduledTime || '',
      scheduledDeparture: body.scheduledDeparture || null,
      expectedDeparture: body.expectedDeparture || null,
      checkInStart: body.checkInStart || null,
      checkInEnd: body.checkInEnd || null,
      checkInCounters: body.checkInCounters || '',
      boardingStart: body.boardingStart || null,
      boardingEnd: body.boardingEnd || null,
      boardingGate: body.boardingGate || '',
      baggageBelt: body.baggageBelt || '',
      status: body.status || 'scheduled',
    };
    await saveOne(db, f, table);
    return new Response(JSON.stringify(f), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
}
