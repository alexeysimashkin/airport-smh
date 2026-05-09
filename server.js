const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GIST_RAW_URL = 'https://gist.githubusercontent.com/alexeysimashkin/e80f32bcd39d132f85d0ecb4f4494033/raw/f7ed0907c45e5515319429e8c14aba6eb7b5d320/samara-flights.json';
const GITHUB_TOKEN = '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';
const GIST_ID = 'e80f32bcd39d132f85d0ecb4f4494033';

global.flightsCache = global.flightsCache || [];

async function loadFlights() {
  try {
    const res = await fetch(GIST_RAW_URL + '?t=' + Date.now());
    const data = await res.json();
    if (Array.isArray(data)) {
      global.flightsCache = data;
      return data;
    }
  } catch (e) {
    console.log('Ошибка загрузки:', e.message);
  }
  return global.flightsCache || [];
}

async function saveFlights(flights) {
  global.flightsCache = flights;
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        files: {
          'samara-flights.json': {
            content: JSON.stringify(flights, null, 2)
          }
        }
      })
    });
    console.log('Сохранено в Gist');
  } catch (e) {
    console.log('Ошибка сохранения:', e.message);
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

function isAfter(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate(), date1.getHours(), date1.getMinutes());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate(), date2.getHours(), date2.getMinutes());
  return d1.getTime() > d2.getTime();
}

function isSameOrAfter(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate(), date1.getHours(), date1.getMinutes());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate(), date2.getHours(), date2.getMinutes());
  return d1.getTime() >= d2.getTime();
}

function isSameOrBefore(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate(), date1.getHours(), date1.getMinutes());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate(), date2.getHours(), date2.getMinutes());
  return d1.getTime() <= d2.getTime();
}

function isBefore(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate(), date1.getHours(), date1.getMinutes());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate(), date2.getHours(), date2.getMinutes());
  return d1.getTime() < d2.getTime();
}

function computeFlightStatus(flight) {
  if (flight.status === 'cancelled') return 'cancelled';
  if (flight.status === 'departed') return 'departed';

  const now = getSamaraNow();
  const checkInStart = parseDate(flight.checkInStart);
  const checkInEnd = parseDate(flight.checkInEnd);
  const boardingStart = parseDate(flight.boardingStart);
  const boardingEnd = parseDate(flight.boardingEnd);
  
  const hasCheckIn = checkInStart && checkInEnd;
  const hasBoarding = boardingStart && boardingEnd;

  if (hasBoarding && isAfter(now, boardingEnd)) return 'boarding_completed';
  if (hasBoarding && isSameOrAfter(now, boardingStart) && isSameOrBefore(now, boardingEnd)) return 'boarding';
  if (hasCheckIn && isAfter(now, checkInEnd)) {
    if (!hasBoarding || isBefore(now, boardingStart)) return 'checkin_completed';
  }
  if (hasCheckIn && isSameOrAfter(now, checkInStart) && isSameOrBefore(now, checkInEnd)) return 'checkin';

  const schedDep = parseDate(flight.scheduledDeparture);
  const expectedDep = parseDate(flight.expectedDeparture);
  if (expectedDep && schedDep && expectedDep.getTime() > schedDep.getTime() && isBefore(now, expectedDep)) return 'delayed';

  return 'scheduled';
}

function getStatusText(flight) {
  if (flight.status === 'cancelled') return 'Отменён';
  if (flight.status === 'departed') return 'Вылетел';

  const status = computeFlightStatus(flight);
  const expectedDep = parseDate(flight.expectedDeparture);
  const schedDep = parseDate(flight.scheduledDeparture);
  const isDelayed = expectedDep && schedDep && expectedDep.getTime() > schedDep.getTime();
  const delayedTime = expectedDep ? formatTime(expectedDep) : '';

  if (isDelayed) {
    switch (status) {
      case 'checkin': return `Задержан до ${delayedTime}\nРегистрация`;
      case 'checkin_completed': return `Задержан до ${delayedTime}\nРегистрация закончена`;
      case 'boarding': return `Задержан до ${delayedTime}\nПосадка`;
      case 'boarding_completed': return `Задержан до ${delayedTime}\nПосадка закончена`;
      default: return `Задержан до ${delayedTime}`;
    }
  } else {
    switch (status) {
      case 'checkin': return 'Регистрация';
      case 'checkin_completed': return 'Регистрация закончена';
      case 'boarding': return 'Посадка';
      case 'boarding_completed': return 'Посадка закончена';
      default: return 'По расписанию';
    }
  }
}

function getFlightDay(flight) {
  const schedDep = parseDate(flight.scheduledDeparture);
  const expectedDep = parseDate(flight.expectedDeparture);
  const depTime = expectedDep || schedDep;
  if (!depTime) return 'today';

  const todayStart = getTodayStart();
  const tomorrowStart = getTomorrowStart();
  const tomorrowEnd = getTomorrowEnd();

  if (flight.status === 'departed') return 'departed';

  if (depTime >= todayStart && depTime < tomorrowStart) return 'today';
  if (depTime >= tomorrowStart && depTime <= tomorrowEnd) return 'tomorrow';

  if (schedDep && expectedDep) {
    if (schedDep >= todayStart && schedDep < tomorrowStart && expectedDep >= tomorrowStart) return 'both';
  }

  if (depTime >= todayStart) return 'today';
  return 'tomorrow';
}

app.get('/api/flights', async (req, res) => {
  const flights = await loadFlights();
  const showDeparted = req.query.showDeparted === 'true';
  
  const sorted = [...flights].sort((a, b) => {
    const timeA = parseDate(a.expectedDeparture || a.scheduledDeparture);
    const timeB = parseDate(b.expectedDeparture || b.scheduledDeparture);
    if (!timeA || !timeB) return 0;
    return timeA.getTime() - timeB.getTime();
  });
  
  const enriched = sorted
    .filter(f => f.status !== 'departed' || showDeparted)
    .map(f => ({
      ...f,
      computedStatus: computeFlightStatus(f),
      statusText: getStatusText(f),
      flightDay: getFlightDay(f)
    }));
  
  res.json(enriched);
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
  res.status(201).json(flight);
});

app.put('/api/flights/:id', async (req, res) => {
  let flights = await loadFlights();
  const index = flights.findIndex(f => f.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Рейс не найден' });
  
  flights[index] = { ...flights[index], ...req.body, id: flights[index].id };
  await saveFlights(flights);
  res.json(flights[index]);
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
app.listen(PORT, () => {
  console.log(`Аэропорт Симашкино на порту ${PORT}`);
});

module.exports = app;
