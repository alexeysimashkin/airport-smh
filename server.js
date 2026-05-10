const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Gist
const GIST_ID = 'e80f32bcd39d132f85d0ecb4f4494033';
const GIST_FILE = 'samara-flights.json';
const GITHUB_TOKEN = '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';
const RAW_URL = `https://gist.githubusercontent.com/alexeysimashkin/${GIST_ID}/raw/${GIST_FILE}`;

const AIRLINES = { 'AS': 'ASO Airlines', 'NS': 'Noris', '6N': 'Severavia' };

const RAW_FLIGHTS = [
  "00:00 AS-2819 Москва SVO ежедневно",
  "02:30 AS-987 Дубай DXB ежедневно",
  "03:35 NS-250 Екатеринбург SVX ежедневно",
  "04:00 AS-6232 Санкт-Петербург LED ежедневно",
  "04:40 AS-9834 Анталья AYT понедельник, среда, пятница",
  "05:50 NS-912 Самарканд SKD ежедневно",
  "06:30 AS-4633 Минск MSQ ежедневно",
  "07:00 AS-144 Тобольск RMZ ежедневно",
  "07:25 AS-2712 Москва SVO ежедневно",
  "08:05 AS-6234 Санкт-Петербург LED ежедневно",
  "08:45 NS-383 Краснодар KRR ежедневно",
  "10:20 AS-622 Краснодар KRR ежедневно",
  "11:00 AS-2615 Москва SVO ежедневно",
  "12:15 AS-478 Сургут SGC ежедневно",
  "12:30 AS-1309 Тюмень TUM ежедневно",
  "13:00 AS-1084 Геленджик GDZ ежедневно",
  "14:15 AS-9202 Стамбул IST ежедневно",
  "14:35 AS-147 Советский OVS ежедневно",
  "14:55 AS-6236 Санкт-Петербург LED ежедневно",
  "15:15 AS-130 Нижневартовск NJC ежедневно",
  "15:20 NS-548 Москва VKO ежедневно",
  "15:30 AS-4635 Минск MSQ ежедневно",
  "16:00 AS-2957 Сочи AER ежедневно",
  "16:45 AS-1478 Сургут SGC ежедневно",
  "17:15 AS-2726 Москва SVO ежедневно",
  "17:15 NS-152 Уфа UFA ежедневно",
  "17:30 AS-856 Калининград KGD ежедневно",
  "17:30 NS-328 Екатеринбург SVX воскресенье",
  "18:00 AS-421 Когалым KGP пятница, суббота, воскресенье",
  "18:00 AS-1033 Ставрополь STW понедельник-четверг",
  "18:45 AS-6238 Санкт-Петербург LED ежедневно",
  "19:00 AS-2114 Екатеринбург SVX ежедневно",
  "19:30 AS-1130 Нижневартовск NJC ежедневно",
  "20:20 AS-6240 Санкт-Петербург LED ежедневно",
  "21:35 NS-318 Тюмень TUM ежедневно",
  "21:40 AS-416 Сургут SGC воскресенье",
  "22:00 AS-9087 Санья SYX чт,сб,вс",
  "22:05 AS-421 Сургут SGC пятница, суббота, воскресенье",
  "22:15 AS-6242 Санкт-Петербург LED ежедневно",
  "22:20 AS-4637 Минск MSQ ежедневно",
  "22:30 AS-2864 Ханты-Мансийск HMA пятница",
  "23:00 AS-9056 Нячанг CXR пн,ср,пт",
  "23:05 AS-958 Элиста ESL среда",
  "23:15 AS-3841 Новосибирск OVB ежедневно",
  "23:20 6N-949 Харбин HRB суббота",
  "23:40 AS-9098 Пекин PEK ежедневно",
  "23:55 AS-6244 Санкт-Петербург LED ежедневно"
];

function parseFlight(str) {
  const parts = str.split(' ');
  const time = parts[0];
  const flightNum = parts[1];
  const prefix = flightNum.split('-')[0];
  const airline = AIRLINES[prefix] || 'Авиакомпания';
  let iataIdx = -1;
  for (let i = 2; i < parts.length; i++) {
    if (/^[A-Z]{3}$/.test(parts[i])) { iataIdx = i; break; }
  }
  const destination = parts.slice(2, iataIdx).join(' ');
  const iata = parts[iataIdx];
  const daysStr = parts.slice(iataIdx + 1).join(' ').toLowerCase();
  let days = ['everyday'];
  if (daysStr.includes('понедельник-четверг')) days = ['пн','вт','ср','чт'];
  else if (daysStr.includes('понедельник, среда, пятница')) days = ['пн','ср','пт'];
  else if (daysStr.includes('пятница, суббота, воскресенье')) days = ['пт','сб','вс'];
  else if (daysStr.includes('чт,сб,вс')) days = ['чт','сб','вс'];
  else if (daysStr.includes('пн,ср,пт')) days = ['пн','ср','пт'];
  else if (daysStr.includes('понедельник')) days = ['пн'];
  else if (daysStr.includes('вторник')) days = ['вт'];
  else if (daysStr.includes('среда')) days = ['ср'];
  else if (daysStr.includes('четверг')) days = ['чт'];
  else if (daysStr.includes('пятница')) days = ['пт'];
  else if (daysStr.includes('суббота')) days = ['сб'];
  else if (daysStr.includes('воскресенье')) days = ['вс'];

  const [h, m] = time.split(':').map(Number);
  const now = getSamaraNow();
  const depDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const checkInStart = new Date(depDate.getTime() - 3 * 3600000);
  const checkInEnd = new Date(depDate.getTime() - 40 * 60000);

  return {
    id: flightNum,
    flightNumber: flightNum,
    destination,
    iataCode: iata,
    airline,
    scheduledTime: time,
    days,
    status: 'scheduled',
    scheduledDeparture: depDate.toISOString(),
    expectedDeparture: null,
    checkInStart: checkInStart.toISOString(),
    checkInEnd: checkInEnd.toISOString(),
    checkInCounters: '',
    boardingStart: null,
    boardingEnd: null,
    boardingGate: ''
  };
}

let cachedFlights = null;

async function loadFlights() {
  if (cachedFlights) return cachedFlights;
  try {
    const r = await fetch(RAW_URL + '?t=' + Date.now());
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) {
      cachedFlights = data;
      return data;
    }
  } catch(e) {}
  const base = RAW_FLIGHTS.map(parseFlight);
  cachedFlights = base;
  await saveFlights(base);
  return base;
}

async function saveFlights(flights) {
  cachedFlights = flights;
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(flights) } } })
    });
  } catch(e) {}
}

function getSamaraNow() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (4 * 3600000));
}

function fliesToday(flight) {
  if (!flight.days || flight.days.includes('everyday')) return true;
  const today = getSamaraNow().getDay();
  const dayNames = ['вс','пн','вт','ср','чт','пт','сб'];
  return flight.days.includes(dayNames[today]);
}

function computeFlightStatus(flight) {
  if (flight.status === 'cancelled') return 'cancelled';
  if (flight.status === 'departed') return 'departed';
  const now = getSamaraNow();
  const checkInStart = flight.checkInStart ? new Date(flight.checkInStart) : null;
  const checkInEnd = flight.checkInEnd ? new Date(flight.checkInEnd) : null;
  const boardingStart = flight.boardingStart ? new Date(flight.boardingStart) : null;
  const boardingEnd = flight.boardingEnd ? new Date(flight.boardingEnd) : null;
  if (boardingEnd && now > boardingEnd) return 'boarding_completed';
  if (boardingStart && boardingEnd && now >= boardingStart && now <= boardingEnd) return 'boarding';
  if (checkInEnd && now > checkInEnd && (!boardingStart || now < boardingStart)) return 'checkin_completed';
  if (checkInStart && checkInEnd && now >= checkInStart && now <= checkInEnd) return 'checkin';
  return 'scheduled';
}

function getStatusText(flight) {
  if (flight.status === 'cancelled') return 'Отменён';
  if (flight.status === 'departed') return 'Вылетел';
  const s = computeFlightStatus(flight);
  if (s === 'checkin') return 'Регистрация';
  if (s === 'checkin_completed') return 'Регистрация закончена';
  if (s === 'boarding') return 'Посадка';
  if (s === 'boarding_completed') return 'Посадка закончена';
  return 'По расписанию';
}

app.get('/api/flights', async (req, res) => {
  let flights = await loadFlights();
  const showDeparted = req.query.showDeparted === 'true';

  flights = flights.filter(f => {
    if (f.status === 'departed') return showDeparted;
    if (f.status === 'cancelled') return true;
    return fliesToday(f);
  });

  const enriched = flights
    .map(f => ({ ...f, computedStatus: computeFlightStatus(f), statusText: getStatusText(f) }))
    .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
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
    scheduledTime: req.body.scheduledTime || '00:00',
    days: req.body.days || ['everyday'],
    status: req.body.status || 'scheduled',
    scheduledDeparture: req.body.scheduledDeparture || null,
    expectedDeparture: req.body.expectedDeparture || null,
    checkInStart: req.body.checkInStart || null,
    checkInEnd: req.body.checkInEnd || null,
    checkInCounters: req.body.checkInCounters || '',
    boardingStart: req.body.boardingStart || null,
    boardingEnd: req.body.boardingEnd || null,
    boardingGate: req.body.boardingGate || ''
  };
  flights.push(flight);
  await saveFlights(flights);
  res.status(201).json(flight);
});

app.put('/api/flights/:id', async (req, res) => {
  let flights = await loadFlights();
  const i = flights.findIndex(f => String(f.id) === String(req.params.id));
  if (i === -1) return res.status(404).json({ error: 'Не найден' });
  flights[i] = { ...flights[i], ...req.body, id: flights[i].id };
  await saveFlights(flights);
  res.json(flights[i]);
});

app.delete('/api/flights/:id', async (req, res) => {
  let flights = await loadFlights();
  const before = flights.length;
  flights = flights.filter(f => String(f.id) !== String(req.params.id));
  if (flights.length === before) return res.status(404).json({ error: 'Не найден' });
  await saveFlights(flights);
  res.status(204).send();
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('OK'));
module.exports = app;
