const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JSONBLOB_URL = 'https://jsonblob.com/019e0dc6-5e5c-7396-812a-955fe1d5906a';

global.flightsCache = global.flightsCache || [];

async function loadFlights() {
  try {
    const res = await fetch(JSONBLOB_URL);
    const data = await res.json();
    if (Array.isArray(data)) {
      global.flightsCache = data;
      return data;
    }
  } catch (e) {
    console.log('Ошибка загрузки');
  }
  return global.flightsCache;
}

async function saveFlights(flights) {
  global.flightsCache = flights;
  try {
    await fetch(JSONBLOB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flights)
    });
  } catch (e) {
    console.log('Ошибка сохранения');
  }
}

function getSamaraNow() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (4 * 3600000));
}

function getTodayStart() {
  const now = getSamaraNow();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
}

function getTomorrowStart() {
  const today = getTodayStart();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0);
}

function getTomorrowEnd() {
  const tomorrow = getTomorrowStart();
  return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1, 0, 0, -1);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const [datePart, timePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0);
}

function formatTime(date) {
  if (!date) return '';
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isAfter(d1, d2) { return d1 && d2 && d1.getTime() > d2.getTime(); }
function isSameOrAfter(d1, d2) { return d1 && d2 && d1.getTime() >= d2.getTime(); }
function isSameOrBefore(d1, d2) { return d1 && d2 && d1.getTime() <= d2.getTime(); }
function isBefore(d1, d2) { return d1 && d2 && d1.getTime() < d2.getTime(); }

function computeFlightStatus(flight) {
  if (flight.status === 'cancelled') return 'cancelled';
  if (flight.status === 'departed') return 'departed';

  const now = getSamaraNow();
  const checkInStart = parseDate(flight.checkInStart);
  const checkInEnd = parseDate(flight.checkInEnd);
  const boardingStart = parseDate(flight.boardingStart);
  const boardingEnd = parseDate(flight.boardingEnd);

  if (boardingEnd && isAfter(now, boardingEnd)) return 'boarding_completed';
  if (boardingStart && boardingEnd && isSameOrAfter(now, boardingStart) && isSameOrBefore(now, boardingEnd)) return 'boarding';
  if (checkInEnd && isAfter(now, checkInEnd)) {
    if (!boardingStart || isBefore(now, boardingStart)) return 'checkin_completed';
  }
  if (checkInStart && checkInEnd && isSameOrAfter(now, checkInStart) && isSameOrBefore(now, checkInEnd)) return 'checkin';

  const schedDep = parseDate(flight.scheduledDeparture);
  const expectedDep = parseDate(flight.expectedDeparture);
  if (expectedDep && schedDep && expectedDep > schedDep && isBefore(now, expectedDep)) return 'delayed';

  return 'scheduled';
}

function getStatusText(flight) {
  if (flight.status === 'cancelled') return 'Отменён';
  if (flight.status === 'departed') return 'Вылетел';

  const status = computeFlightStatus(flight);
  const expectedDep = parseDate(flight.expectedDeparture);
  const schedDep = parseDate(flight.scheduledDeparture);
  const delayed = expectedDep && schedDep && expectedDep.getTime() > schedDep.getTime();
  const time = expectedDep ? formatTime(expectedDep) : '';

  if (delayed) {
    if (status === 'checkin') return `Задержан до ${time}\nРегистрация`;
    if (status === 'checkin_completed') return `Задержан до ${time}\nРегистрация закончена`;
    if (status === 'boarding') return `Задержан до ${time}\nПосадка`;
    if (status === 'boarding_completed') return `Задержан до ${time}\nПосадка закончена`;
    return `Задержан до ${time}`;
  }
  if (status === 'checkin') return 'Регистрация';
  if (status === 'checkin_completed') return 'Регистрация закончена';
  if (status === 'boarding') return 'Посадка';
  if (status === 'boarding_completed') return 'Посадка закончена';
  return 'По расписанию';
}

function getFlightDay(flight) {
  const schedDep = parseDate(flight.scheduledDeparture);
  const expectedDep = parseDate(flight.expectedDeparture);
  const depTime = expectedDep || schedDep;
  if (!depTime) return 'today';
  if (flight.status === 'departed') return 'departed';

  const todayStart = getTodayStart();
  const tomorrowStart = getTomorrowStart();
  const tomorrowEnd = getTomorrowEnd();

  if (depTime >= todayStart && depTime < tomorrowStart) return 'today';
  if (depTime >= tomorrowStart && depTime <= tomorrowEnd) return 'tomorrow';
  if (schedDep && expectedDep && schedDep >= todayStart && schedDep < tomorrowStart && expectedDep >= tomorrowStart) return 'both';
  if (depTime >= todayStart) return 'today';
  return 'tomorrow';
}

app.get('/api/flights', async (req, res) => {
  const flights = await loadFlights();
  const showDeparted = req.query.showDeparted === 'true';
  const sorted = [...flights].sort((a, b) => {
    const ta = parseDate(a.expectedDeparture || a.scheduledDeparture);
    const tb = parseDate(b.expectedDeparture || b.scheduledDeparture);
    return (ta && tb) ? ta - tb : 0;
  });
  const enriched = sorted
    .filter(f => f.status !== 'departed' || showDeparted)
    .map(f => ({ ...f, computedStatus: computeFlightStatus(f), statusText: getStatusText(f), flightDay: getFlightDay(f) }));
  res.json(enriched);
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
  const i = flights.findIndex(f => f.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Не найден' });
  flights[i] = { ...flights[i], ...req.body, id: flights[i].id };
  await saveFlights(flights);
  res.json(flights[i]);
});

app.delete('/api/flights/:id', async (req, res) => {
  let flights = await loadFlights();
  flights = flights.filter(f => f.id !== req.params.id);
  await saveFlights(flights);
  res.status(204).send();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('OK'));
module.exports = app;
