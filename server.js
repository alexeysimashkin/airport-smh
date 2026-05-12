const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('@neondatabase/serverless');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`CREATE TABLE IF NOT EXISTS flights (id TEXT PRIMARY KEY, data JSONB NOT NULL)`).catch(e => console.log(e));

async function load() {
  try { const r = await pool.query('SELECT data FROM flights'); return r.rows.map(x => x.data); }
  catch(e) { return []; }
}

async function save(flights) {
  try {
    await pool.query('DELETE FROM flights');
    for (const f of flights) await pool.query('INSERT INTO flights (id, data) VALUES ($1, $2)', [f.id, JSON.stringify(f)]);
  } catch(e) {}
}

app.get('/api/flights', async (req, res) => {
  const flights = await load();
  res.json(flights);
});

app.post('/api/flights', async (req, res) => {
  const flights = await load();
  const f = {
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
  flights.push(f);
  await save(flights);
  res.status(201).json(f);
});

app.put('/api/flights/:id', async (req, res) => {
  const flights = await load();
  const i = flights.findIndex(f => f.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Не найден' });
  flights[i] = { ...flights[i], ...req.body, id: flights[i].id };
  await save(flights);
  res.json(flights[i]);
});

app.delete('/api/flights/:id', async (req, res) => {
  let flights = await load();
  flights = flights.filter(f => f.id !== req.params.id);
  await save(flights);
  res.status(204).send();
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('OK'));
module.exports = app;
