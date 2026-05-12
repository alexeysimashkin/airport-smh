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
    id,
    flightNumber: f.flightNumber,
    destination: f.destination,
    iataCode: f.iataCode,
    airline: f.airline,
    scheduledTime: f.time,
    scheduledDeparture: dateStr + 'T' + f.time + ':00',
    expectedDeparture: null,
    checkInStart: null,
    checkInEnd: null,
    checkInCounters: '',
    boardingStart: null,
    boardingEnd: null,
    boardingGate: '',
    status: 'scheduled'
  };
}

async function ensureDailyFlights() {
  const all = await loadFlights();
  const existingIds = new Set(all.map(f => f.id));
  const toAdd = [];
  
  const today = getTodayStr();
  for (const f of DAILY_FLIGHTS) {
    const id = f.flightNumber + '-' + today;
    if (!existingIds.has(id)) toAdd.push(makeFlight(f, today));
  }
  
  const tomorrow = getTomorrowStr();
  for (const f of DAILY_FLIGHTS) {
    const id = f.flightNumber + '-' + tomorrow;
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
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + 4 * 3600000);
}

function getFlightDay(f) {
  const dep = f.scheduledDeparture || '';
  const today = getTodayStr();
  const tomorrow = getTomorrowStr();
  if (dep.startsWith(tomorrow)) return 'tomorrow';
  return 'today';
}

function enrich(flight) {
  return { ...flight, flightDay: getFlightDay(flight), computedStatus: flight.status, statusText: flight.status === 'cancelled' ? 'Отменён' : flight.status === 'departed' ? 'Вылетел' : 'По расписанию' };
}

async function cleanupDeparted() {
  const flights = await loadFlights();
  const today = getTodayStr();
  const cleaned = flights.filter(f => {
    if (f.status === 'departed' && f.scheduledDeparture) {
      return f.scheduledDeparture >= today;
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
  flights.sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
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
    scheduledTime: req.body.scheduledTime || '',
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
