const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = '8657070527:AAFJP97c3zAjl6wxpd1fnOWaWZnOWZQLRH0';
const CHANNEL_ID = '-1003993034048';

global.flightsCache = global.flightsCache || [];
global.pinnedMessages = global.pinnedMessages || [];

// Максимальная длина одного сообщения (с запасом)
const MAX_MESSAGE_LENGTH = 4000;

// Загружаем рейсы из ВСЕХ закреплённых сообщений
async function loadFlights() {
  try {
    // Получаем информацию о чате (последнее закреплённое)
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHANNEL_ID}`
    );
    const data = await res.json();
    
    let allFlights = [];
    
    if (data.ok && data.result.pinned_message && data.result.pinned_message.text) {
      try {
        const firstPart = JSON.parse(data.result.pinned_message.text);
        if (Array.isArray(firstPart)) {
          allFlights = firstPart;
        }
      } catch(e) {
        // Если не парсится — может быть ссылкой на следующую часть
        const match = data.result.pinned_message.text.match(/\[ЧАСТЬ 1\]/);
        if (match) {
          // Загружаем все части через getUpdates
          const updatesRes = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=50`
          );
          const updatesData = await updatesRes.json();
          
          if (updatesData.ok) {
            const allTexts = [];
            for (const update of updatesData.result) {
              const msg = update.channel_post || update.message;
              if (msg && String(msg.chat.id) === String(CHANNEL_ID) && msg.text) {
                allTexts.push(msg.text);
              }
            }
            // Склеиваем все части
            const fullText = allTexts.join('').replace(/\[ЧАСТЬ \d+\]/g, '');
            try {
              allFlights = JSON.parse(fullText);
            } catch(e2) {}
          }
        }
      }
    }
    
    if (allFlights.length > 0) {
      global.flightsCache = allFlights;
      return allFlights;
    }
  } catch (e) {
    console.log('Ошибка загрузки:', e.message);
  }
  return global.flightsCache;
}

// Сохраняем рейсы в несколько закреплённых сообщений
async function saveFlights(flights) {
  global.flightsCache = flights;
  try {
    const text = JSON.stringify(flights);
    
    // Удаляем старые закреплённые сообщения (открепляем)
    try {
      await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/unpinAllChatMessages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHANNEL_ID })
        }
      );
    } catch(e) {}
    
    // Небольшая пауза
    await new Promise(r => setTimeout(r, 500));
    
    // Разбиваем на части
    const parts = [];
    for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
      parts.push(text.slice(i, i + MAX_MESSAGE_LENGTH));
    }
    
    // Отправляем каждую часть и закрепляем
    for (let i = 0; i < parts.length; i++) {
      const partText = parts[i];
      const label = parts.length > 1 ? `[ЧАСТЬ ${i + 1}]\n` : '';
      
      const sendRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHANNEL_ID,
            text: label + partText
          })
        }
      );
      const sendData = await sendRes.json();
      
      if (sendData.ok) {
        // Закрепляем сообщение
        await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/pinChatMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: CHANNEL_ID,
              message_id: sendData.result.message_id,
              disable_notification: true
            })
          }
        );
        
        // Пауза между отправками чтобы не получить бан
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  } catch (e) {
    console.log('Ошибка сохранения:', e.message);
  }
}

// Самарское время (UTC+4)
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
    if (schedDep >= todayStart && schedDep < tomorrowStart && expectedDep >= tomorrowStart) {
      return 'both';
    }
  }

  if (depTime >= todayStart) return 'today';
  return 'tomorrow';
}

// API
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
    .filter(f => {
      if (f.status === 'departed' && !showDeparted) return false;
      return true;
    })
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
  console.log(`Аэропорт Симашкино запущен на порту ${PORT}`);
});

module.exports = app;
