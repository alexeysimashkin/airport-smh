const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('@neondatabase/serverless');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  CREATE TABLE IF NOT EXISTS flights (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )
`).catch(e => console.log(e));

const DAILY_FLIGHTS = [
  { flightNumber: "AS-2819", destination: "Москва", iataCode: "SVO", airline: "ASO Airlines", time: "00:00" },
  { flightNumber: "AS-987", destination: "Дубай", iataCode: "DXB", airline: "ASO Airlines", time: "02:30" },
  { flightNumber: "NS-250", destination: "Екатеринбург", iataCode: "SVX", airline: "Noris", time: "03:35" },
  { flightNumber: "AS-6232", destination: "Санкт-Петербург", iataCode: "LED", airline: "ASO Airlines", time: "04:00" },
  { flightNumber: "NS-912", destination: "Самарканд", iataCode: "SKD", airline: "Noris", time: "05:50" },
  { flightNumber: "AS-4633", destination: "Минск", iataCode: "MSQ", airline: "ASO Airlines", time: "06:30" },
  { flightNumber: "AS-144", destination: "Тобольск", iataCode: "RMZ", airline: "ASO Airlines", time: "07:00" },
  { flightNumber: "AS-2712", destination: "Москва", iataCode: "SVO", airline: "ASO Airlines", time: "07:25" },
  { flightNumber: "AS-6234", destination: "Санкт-Петербург", iataCode: "LED", airline: "ASO Airlines", time: "08:05" },
  { flightNumber: "NS-383", destination: "Краснодар", iataCode: "KRR", airline: "Noris", time: "08:45" },
  { flightNumber: "AS-622", destination: "Краснодар", iataCode: "KRR", airline: "ASO Airlines", time: "10:20" },
  { flightNumber: "AS-2615", destination: "Москва", iataCode: "SVO", airline: "ASO Airlines", time: "11:00" },
  { flightNumber: "AS-478", destination: "Сургут", iataCode: "SGC", airline: "ASO Airlines", time: "12:15" },
  { flightNumber: "AS-1309", destination: "Тюмень", iataCode: "TUM", airline: "ASO Airlines", time: "12:30" },
  { flightNumber: "AS-1084", destination: "Геленджик", iataCode: "GDZ", airline: "ASO Airlines", time: "13:00" },
  { flightNumber: "AS-9202", destination: "Стамбул", iataCode: "IST", airline: "ASO Airlines", time: "14:15" },
  { flightNumber: "AS-147", destination: "Советский", iataCode: "OVS", airline: "ASO Airlines", time: "14:35" },
  { flightNumber: "AS-6236", destination: "Санкт-Петербург", iataCode: "LED", airline: "ASO Airlines", time: "14:55" },
  { flightNumber: "AS-130", destination: "Нижневартовск", iataCode: "NJC", airline: "ASO Airlines", time: "15:15" },
  { flightNumber: "NS-548", destination: "Москва", iataCode: "VKO", airline: "Noris", time: "15:20" },
  { flightNumber: "AS-4635", destination: "Минск", iataCode: "MSQ", airline: "ASO Airlines", time: "15:30" },
  { flightNumber: "AS-2957", destination: "Сочи", iataCode: "AER", airline: "ASO Airlines", time: "16:00" },
  { flightNumber: "AS-1478", destination: "Сургут", iataCode: "SGC", airline: "ASO Airlines", time: "16:45" },
  { flightNumber: "AS-2726", destination: "Москва", iataCode: "SVO", airline: "ASO Airlines", time: "17:15" },
  { flightNumber: "NS-152", destination: "Уфа", iataCode: "UFA", airline: "Noris", time: "17:15" },
  { flightNumber: "AS-856", destination: "Калининград", iataCode: "KGD", airline: "ASO Airlines", time: "17:30" },
  { flightNumber: "AS-6238", destination: "Санкт-Петербург", iataCode: "LED", airline: "ASO Airlines", time: "18:45" },
  { flightNumber: "AS-2114", destination: "Екатеринбург", iataCode: "SVX", airline: "ASO Airlines", time: "19:00" },
  { flightNumber: "AS-1130", destination: "Нижневартовск", iataCode: "NJC", airline: "ASO Airlines", time: "19:30" },
  { flightNumber: "AS-6240", destination: "Санкт-Петербург", iataCode: "LED", airline: "ASO Airlines", time: "20:20" },
  { flightNumber: "NS-318", destination: "Тюмень", iataCode: "TUM", airline: "Noris", time: "21:35" },
  { flightNumber: "AS-6242", destination: "Санкт-Петербург", iataCode: "LED", airline: "ASO Airlines", time: "22:15" },
  { flightNumber: "AS-4637", destination: "Минск", iataCode: "MSQ", airline: "ASO Airlines", time: "22:20" },
  { flightNumber: "AS-3841", destination: "Новосибирск", iataCode: "OVB", airline: "ASO Airlines", time: "23:15" },
  { flightNumber: "AS-9098", destination: "Пекин", iataCode: "PEK", airline: "ASO Airlines", time: "23:40" },
  { flightNumber: "AS-6244", destination: "Санкт-Петербург", iataCode: "LED", airline: "ASO Airlines", time: "23:55" }
];

function makeFlight(f, date) {
  const [h, m] = f.time.split(':').map(Number);
  // Используем локальное время сервера. Сервер в UTC, но мы передаём строку как есть.
  const depStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
  const dep = new Date(depStr);
  const ci = new Date(dep.getTime() - 3 * 3600000);
  const ce = new Date(dep.getTime() - 40 * 60000);
  const dateStr = date.toISOString().slice(0, 10);
  const id = f.flightNumber + '-' + dateStr;
  return {
    id,
    flightNumber: f.flightNumber,
    destination: f.destination,
    iataCode: f.iataCode,
    airline: f.airline,
    scheduledDeparture: dep.toISOString(),
    expectedDeparture: null,
    checkInStart: ci.toISOString(),
    checkInEnd: ce.toISOString(),
    checkInCounters: '',
    boardingStart: null,
    boardingEnd: null,
    boardingGate: '',
    status: 'scheduled'
  };
}

async function ensureDailyFlights() {
  const all = await loadFlights();
  const today = getTodayStart();
  const tomorrow = getTomorrowStart();
  const existingIds = new Set(all.map(f => f.id));
  const toAdd = [];
  
  const todayStr = today.toISOString().slice(0, 10);
  for (const f of DAILY_FLIGHTS) {
    const id = f.flightNumber + '-' + todayStr;
    if (!existingIds.has(id)) toAdd.push(makeFlight(f, today));
  }
  
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  for (const f of DAILY_FLIGHTS) {
    const id = f.flightNumber + '-' + tomorrowStr;
    if (!existingIds.has(id)) toAdd.push(makeFlight(f, tomorrow));
  }
  
  if (toAdd.length > 0) await saveFlights([...all, ...toAdd]);
}

async function loadFlights() {
  try {
    const r = await pool.query('SELECT data FROM flights');
    return r.rows.map(row => row.data);
  } catch(e) { return []; }
}

async function saveFlights(flights) {
  try {
    await pool.query('DELETE FROM flights');
    for (const f of flights) {
      await pool.query('INSERT INTO flights (id, data) VALUES ($1, $2)', [f.id, JSON.stringify(f)]);
    }
  } catch(e) {}
}

function getSamaraNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Samara' }));
}

function getTodayStart() {
  const now = getSamaraNow();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
}

function getTomorrowStart() {
  const t = getTodayStart();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 0);
}

function getFlightDay(f) {
  const dep = f.expectedDeparture ? new Date(f.expectedDeparture) : new Date(f.scheduledDeparture);
  if (!dep || isNaN(dep.getTime())) return 'today';
  if (dep >= getTomorrowStart()) return 'tomorrow';
  return 'today';
}

function computeStatus(flight) {
  if (flight.status === 'cancelled') return 'cancelled';
  if (flight.status === 'departed') return 'departed';
  const now = getSamaraNow();
  const ci = flight.checkInStart ? new Date(flight.checkInStart) : null;
  const ce = flight.checkInEnd ? new Date(flight.checkInEnd) : null;
  const bs = flight.boardingStart ? new Date(flight.boardingStart) : null;
  const be = flight.boardingEnd ? new Date(flight.boardingEnd) : null;
  if (be && now > be) return 'boarding_completed';
  if (bs && be && now >= bs && now <= be) return 'boarding';
  if (ce && now > ce && (!bs || now < bs)) return 'checkin_completed';
  if (ci && ce && now >= ci && now <= ce) return 'checkin';
  const sched = flight.scheduledDeparture ? new Date(flight.scheduledDeparture) : null;
  const exp = flight.expectedDeparture ? new Date(flight.expectedDeparture) : null;
  if (exp && sched && exp > sched && now < exp) return 'delayed';
  return 'scheduled';
}

function getStatusText(flight) {
  if (flight.status === 'cancelled') return 'Отменён';
  if (flight.status === 'departed') return 'Вылетел';
  const s = computeStatus(flight);
  const exp = flight.expectedDeparture ? new Date(flight.expectedDeparture) : null;
  const time = exp ? `${String(exp.getHours()).padStart(2,'0')}:${String(exp.getMinutes()).padStart(2,'0')}` : '';
  if (s === 'delayed') return `Задержан до ${time}`;
  if (s === 'checkin') return 'Регистрация';
  if (s === 'checkin_completed') return 'Регистрация закончена';
  if (s === 'boarding') return 'Посадка';
  if (s === 'boarding_completed') return 'Посадка закончена';
  return 'По расписанию';
}

function enrich(flight) {
  return { ...flight, flightDay: getFlightDay(flight), computedStatus: computeStatus(flight), statusText: getStatusText(flight) };
}

async function cleanupDeparted() {
  const flights = await loadFlights();
  const todayStart = getTodayStart();
  const cleaned = flights.filter(f => {
    if (f.status === 'departed' && f.scheduledDeparture) {
      return new Date(f.scheduledDeparture) >= todayStart;
    }
    return true;
  });
  if (cleaned.length !== flights.length) await saveFlights(cleaned);
  return cleaned;
}

app.get('/api/flights', async (req, res) => {
  await ensureDailyFlights();
  let flights = (await cleanupDeparted()).map(enrich);
  const showDeparted = req.query.showDeparted === 'true';
  if (!showDeparted) flights = flights.filter(f => f.status !== 'departed');
  flights.sort((a, b) => {
    const ta = a.expectedDeparture ? new Date(a.expectedDeparture).getTime() : new Date(a.scheduledDeparture).getTime();
    const tb = b.expectedDeparture ? new Date(b.expectedDeparture).getTime() : new Date(b.scheduledDeparture).getTime();
    return ta - tb;
  });
  res.json(flights);
});

app.post('/api/flights', async (req, res) => {
  let flights = await loadFlights();
  const flight = {
    id: Date.now().toString(),
    flightNumber: req.body.flightNumber || '',
    destination: req.body.destination || '',
    iataCode: req.body.iataCode || '',
    airline: req.body.airline || '',
    scheduledDeparture: req.body.scheduledDeparture || null,
    expectedDeparture: req.body.expectedDeparture || null,
    checkInStart: req.body.checkInStart || null,
    checkInEnd: req.body.checkInEnd || null,
    checkInCounters: req.body.checkInCounters || '',
    boardingStart: req.body.boardingStart || null,
    boardingEnd: req.body.boardingEnd || null,
    boardingGate: req.body.boardingGate || '',
    status: req.body.status || 'scheduled'
  };
  flights.push(flight);
  await saveFlights(flights);
  res.status(201).json(enrich(flight));
});

app.put('/api/flights/:id', async (req, res) => {
  const flights = await loadFlights();
  const i = flights.findIndex(f => f.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Не найден' });
  flights[i] = { ...flights[i], ...req.body, id: flights[i].id };
  await saveFlights(flights);
  res.json(enrich(flights[i]));
});

app.delete('/api/flights/:id', async (req, res) => {
  let flights = await loadFlights();
  flights = flights.filter(f => f.id !== req.params.id);
  await saveFlights(flights);
  res.status(204).send();
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('OK'));
module.exports = app;
