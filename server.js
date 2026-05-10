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

// Самарское время
function getSamaraNow() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (4 * 3600000));
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
  return {
    ...flight,
    computedStatus: computeStatus(flight),
    statusText: getStatusText(flight)
  };
}

app.get('/api/flights', async (req, res) => {
  const flights = (await loadFlights()).map(enrich);
  const showDeparted = req.query.showDeparted === 'true';
  const filtered = flights.filter(f => f.status !== 'departed' || showDeparted);
  res.json(filtered);
});

app.post('/api/flights', async (req, res) => {
  const flights = await loadFlights();
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
