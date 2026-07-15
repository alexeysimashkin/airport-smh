const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('@neondatabase/serverless');

const app = express();

// ============ РЕЖИМ ОБСЛУЖИВАНИЯ ============
// Поставь true чтобы включить заглушку, false чтобы выключить
const MAINTENANCE_MODE = false;

app.use((req, res, next) => {
  if (MAINTENANCE_MODE && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, 'public', 'maintenance.html'));
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`CREATE TABLE IF NOT EXISTS departures (id TEXT PRIMARY KEY, data JSONB NOT NULL)`).catch(e => console.log(e));
pool.query(`CREATE TABLE IF NOT EXISTS arrivals (id TEXT PRIMARY KEY, data JSONB NOT NULL)`).catch(e => console.log(e));
pool.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`).catch(e => console.log(e));

const DAILY_FLIGHTS = [
  "AS-1210|Москва|SVO|ASO Airlines|00:00",
  "AS-9482|Баку|GYD|ASO Airlines|00:05",
  "FV-6234|Санкт-Петербург|PSH|Россия|00:40",
  "UT-478|Сургут|SGC|Utair|01:30",
  "AS-9987|Дубай|DXB|ASO Airlines|02:30",
  "NS-250|Екатеринбург|PSH|Noris|03:35",
  "PC-5723|Анталья|AYT|Pegasus Airlines|04:15",
  "SU-796|Анталья|AYT|Аэрофлот|05:45",
  "AS-620|Краснодар|KRR|ASO Airlines|06:45",
  "6N-1308|Тюмень|TUM|Severavia|06:55",
  "6N-572|Санкт-Петербург|LED|Severavia|07:00",
  "AS-144|Тобольск|RMZ|ASO Airlines|07:30",
  "AS-2959|Сочи|AER|ASO Airlines|08:05",
  "NS-383|Краснодар|KRR|Noris|08:45",
  "FV-6062|Москва|SVO|Россия|10:00",
  "AS-622|Краснодар|KRR|ASO Airlines|10:20",
  "6N-712|Москва|VKO|Severavia|11:40",
  "SU-1211|Москва|SVO|Аэрофлот|12:10",
  "AS-478|Сургут|SGC|ASO Airlines|12:15",
  "AS-1084|Геленджик|GDZ|ASO Airlines|13:00",
  "5N-532|Санкт-Петербург|LED|Smartavia|13:15",
  "6N-1305|Тюмень|TUM|Severavia|13:15",
  "SU-1603|Москва|SVO|Аэрофлот|13:25",
  "UT-282|Екатеринбург|SVX|Utair|13:55",
  "S7-5032|Новосибирск|OVB|S7 Airlines|15:10",
  "AS-130|Нижневартовск|NJC|ASO Airlines|15:15",
  "FV-6204|Сочи|AER|Россия|15:50",
  "AS-2957|Сочи|AER|ASO Airlines|16:00",
  "AS-1478|Сургут|SGC|ASO Airlines|16:45",
  "NS-152|Уфа|BHK|Noris|17:15",
  "AS-856|Калининград|KGD|ASO Airlines|17:30",
  "SU-1213|Москва|SVO|Аэрофлот|17:35",
  "S7-1074|Москва|DME|S7 Airlines|18:00",
  "6N-332|Сочи|AER|Severavia|18:05",
  "5N-582|Санкт-Петербург|PSH|Smartavia|19:15",
  "AS-1130|Нижневартовск|NJC|ASO Airlines|20:00",
  "SU-1215|Москва|SVO|Аэрофлот|20:40",
  "AS-9005|Батуми|BUS|ASO Airlines|20:45",
  "NS-318|Тюмень|TUM|Noris|21:35",
  "DP-572|Санкт-Петербург|LED|Победа|21:35",
  "FV-6078|Москва|SVO|Россия|21:50",
  "DP-422|Москва|VKO|Победа|22:30",
  "UT-358|Москва|VKO|Utair|23:10",
  "AS-3841|Новосибирск|OVB|ASO Airlines|23:15",
  "SM-451|Тюмень|TUM|SamAero|23:15",
  "S7-5034|Новосибирск|OVB|S7 Airlines|23:30"
];

function parseFlight(str) {
  const [flightNumber, destination, iataCode, airline, time] = str.split('|');
  return { flightNumber, destination, iataCode, airline, time };
}

function getTodayStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const samara = new Date(utc + 4 * 3600000);
  return samara.toISOString().slice(0, 10);
}

function getTomorrowStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const samara = new Date(utc + 4 * 3600000);
  samara.setDate(samara.getDate() + 1);
  return samara.toISOString().slice(0, 10);
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

async function loadFlights(table) {
  try { const r = await pool.query(`SELECT data FROM ${table}`); return r.rows.map(x => x.data); }
  catch(e) { return []; }
}

async function saveOne(f, table) {
  await pool.query(`INSERT INTO ${table} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`, [f.id, JSON.stringify(f)]);
}

async function deleteOne(id, table) {
  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

async function ensureDailyFlights() {
  const flights = await loadFlights('departures');
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
  if (toAdd.length > 0) for (const f of toAdd) await saveOne(f, 'departures');
}

function getLocalNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (4 * 3600000));
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
  const dep = f.expectedDeparture ? new Date(f.expectedDeparture) : f.scheduledDeparture ? new Date(f.scheduledDeparture) : null;
  if (!dep || isNaN(dep.getTime())) return 'today';
  const now = getLocalNow();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  if (dep >= tomorrowStart) return 'tomorrow';
  return 'today';
}

app.get('/api/airport-status', async (req, res) => {
  try { const r = await pool.query(`SELECT value FROM settings WHERE key = 'airport_status'`); res.json({ status: r.rows[0]?.value || 'open' }); }
  catch(e) { res.json({ status: 'open' }); }
});

app.post('/api/airport-status', async (req, res) => {
  await pool.query(`INSERT INTO settings (key, value) VALUES ('airport_status', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [req.body.status]);
  res.json({ status: req.body.status });
});

app.get('/api/urgent', async (req, res) => {
  try { const r = await pool.query(`SELECT value FROM settings WHERE key = 'urgent_info'`); res.json({ text: r.rows[0]?.value || '' }); }
  catch(e) { res.json({ text: '' }); }
});

app.post('/api/urgent', async (req, res) => {
  await pool.query(`INSERT INTO settings (key, value) VALUES ('urgent_info', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [req.body.text]);
  res.json({ text: req.body.text });
});

app.delete('/api/urgent', async (req, res) => {
  await pool.query(`DELETE FROM settings WHERE key = 'urgent_info'`);
  res.json({ text: '' });
});

app.get('/api/flights', async (req, res) => {
  await ensureDailyFlights();
  const type = req.query.type || 'departure';
  const table = type === 'departure' ? 'departures' : 'arrivals';
  let flights = await loadFlights(table);
  const showDep = req.query.showDeparted === 'true';
  const today = getLocalNow().toISOString().slice(0, 10);
  const cleaned = flights.filter(f => {
    if ((f.status === 'departed' || f.status === 'early_departed' || f.status === 'arrived') && f.scheduledDeparture) return f.scheduledDeparture.slice(0, 10) >= today;
    return true;
  });
  if (cleaned.length !== flights.length) {
    for (const f of flights) { if (!cleaned.includes(f)) await deleteOne(f.id, table); }
    flights = cleaned;
  }
  if (!showDep) {
    if (type === 'departure') flights = flights.filter(f => f.status !== 'departed' && f.status !== 'early_departed');
    else flights = flights.filter(f => f.status !== 'arrived');
  }
  flights = flights.map(f => ({ ...f, computedStatus: computeStatus(f), statusText: getStatusText(f), flightDay: getFlightDay(f) }));
  flights.sort((a, b) => { const ta = a.expectedDeparture || a.scheduledDeparture || ''; const tb = b.expectedDeparture || b.scheduledDeparture || ''; return ta.localeCompare(tb); });
  res.json(flights);
});

app.post('/api/flights', async (req, res) => {
  const type = req.query.type || 'departure';
  const table = type === 'departure' ? 'departures' : 'arrivals';
  const f = { id: Date.now().toString(), flightNumber: req.body.flightNumber || '', destination: req.body.destination || '', iataCode: req.body.iataCode || '', airline: req.body.airline || '', scheduledTime: req.body.scheduledTime || '', scheduledDeparture: req.body.scheduledDeparture || null, expectedDeparture: req.body.expectedDeparture || null, checkInStart: req.body.checkInStart || null, checkInEnd: req.body.checkInEnd || null, checkInCounters: req.body.checkInCounters || '', boardingStart: req.body.boardingStart || null, boardingEnd: req.body.boardingEnd || null, boardingGate: req.body.boardingGate || '', baggageBelt: req.body.baggageBelt || '', status: req.body.status || 'scheduled' };
  await saveOne(f, table);
  res.status(201).json(f);
});

app.put('/api/flights/:id', async (req, res) => {
  const type = req.query.type || 'departure';
  const table = type === 'departure' ? 'departures' : 'arrivals';
  const flights = await loadFlights(table);
  const i = flights.findIndex(f => f.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Не найден' });
  flights[i] = { ...flights[i], ...req.body, id: flights[i].id };
  await saveOne(flights[i], table);
  res.json(flights[i]);
});

app.delete('/api/flights/:id', async (req, res) => {
  const type = req.query.type || 'departure';
  const table = type === 'departure' ? 'departures' : 'arrivals';
  await deleteOne(req.params.id, table);
  res.status(204).send();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Симашкино OK'));
module.exports = app;
