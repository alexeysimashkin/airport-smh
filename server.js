const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GIST_ID = 'e80f32bcd39d132f85d0ecb4f4494033';
const GIST_FILE = 'samara-flights.json';
const GITHUB_TOKEN = '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';
const RAW_URL = `https://gist.githubusercontent.com/alexeysimashkin/${GIST_ID}/raw/${GIST_FILE}`;

async function loadFlights() {
  try {
    const r = await fetch(RAW_URL + '?t=' + Date.now());
    const text = await r.text();
    if (!text || text === 'null') return [];
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch(e) {
    return [];
  }
}

async function saveFlights(flights) {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        files: {
          [GIST_FILE]: { content: JSON.stringify(flights) }
        }
      })
    });
    if (!res.ok) console.log('Ошибка сохранения:', res.status);
  } catch(e) {
    console.log('Ошибка:', e.message);
  }
}

app.get('/api/flights', async (req, res) => {
  const flights = await loadFlights();
  res.json(flights);
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
  res.status(201).json(flight);
});

app.put('/api/flights/:id', async (req, res) => {
  const flights = await loadFlights();
  const i = flights.findIndex(f => String(f.id) === String(req.params.id));
  if (i === -1) return res.status(404).json({ error: 'Не найден' });
  flights[i] = { ...flights[i], ...req.body, id: flights[i].id };
  await saveFlights(flights);
  res.json(flights[i]);
});

app.delete('/api/flights/:id', async (req, res) => {
  let flights = await loadFlights();
  flights = flights.filter(f => String(f.id) !== String(req.params.id));
  await saveFlights(flights);
  res.status(204).send();
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('OK'));
module.exports = app;
