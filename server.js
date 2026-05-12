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

const DAILY_FLIGHTS = [
  { fn:"AS-2819", to:"Москва", iata:"SVO", al:"ASO Airlines", t:"00:00" },
  { fn:"AS-987", to:"Дубай", iata:"DXB", al:"ASO Airlines", t:"02:30" },
  { fn:"NS-250", to:"Екатеринбург", iata:"SVX", al:"Noris", t:"03:35" },
  { fn:"AS-6232", to:"Санкт-Петербург", iata:"LED", al:"ASO Airlines", t:"04:00" },
  { fn:"NS-912", to:"Самарканд", iata:"SKD", al:"Noris", t:"05:50" },
  { fn:"AS-4633", to:"Минск", iata:"MSQ", al:"ASO Airlines", t:"06:30" },
  { fn:"AS-144", to:"Тобольск", iata:"RMZ", al:"ASO Airlines", t:"07:00" },
  { fn:"AS-2712", to:"Москва", iata:"SVO", al:"ASO Airlines", t:"07:25" },
  { fn:"AS-6234", to:"Санкт-Петербург", iata:"LED", al:"ASO Airlines", t:"08:05" },
  { fn:"NS-383", to:"Краснодар", iata:"KRR", al:"Noris", t:"08:45" },
  { fn:"AS-622", to:"Краснодар", iata:"KRR", al:"ASO Airlines", t:"10:20" },
  { fn:"AS-2615", to:"Москва", iata:"SVO", al:"ASO Airlines", t:"11:00" },
  { fn:"AS-478", to:"Сургут", iata:"SGC", al:"ASO Airlines", t:"12:15" },
  { fn:"AS-1309", to:"Тюмень", iata:"TUM", al:"ASO Airlines", t:"12:30" },
  { fn:"AS-1084", to:"Геленджик", iata:"GDZ", al:"ASO Airlines", t:"13:00" },
  { fn:"AS-9202", to:"Стамбул", iata:"IST", al:"ASO Airlines", t:"14:15" },
  { fn:"AS-147", to:"Советский", iata:"OVS", al:"ASO Airlines", t:"14:35" },
  { fn:"AS-6236", to:"Санкт-Петербург", iata:"LED", al:"ASO Airlines", t:"14:55" },
  { fn:"AS-130", to:"Нижневартовск", iata:"NJC", al:"ASO Airlines", t:"15:15" },
  { fn:"NS-548", to:"Москва", iata:"VKO", al:"Noris", t:"15:20" },
  { fn:"AS-4635", to:"Минск", iata:"MSQ", al:"ASO Airlines", t:"15:30" },
  { fn:"AS-2957", to:"Сочи", iata:"AER", al:"ASO Airlines", t:"16:00" },
  { fn:"AS-1478", to:"Сургут", iata:"SGC", al:"ASO Airlines", t:"16:45" },
  { fn:"AS-2726", to:"Москва", iata:"SVO", al:"ASO Airlines", t:"17:15" },
  { fn:"NS-152", to:"Уфа", iata:"UFA", al:"Noris", t:"17:15" },
  { fn:"AS-856", to:"Калининград", iata:"KGD", al:"ASO Airlines", t:"17:30" },
  { fn:"AS-6238", to:"Санкт-Петербург", iata:"LED", al:"ASO Airlines", t:"18:45" },
  { fn:"AS-2114", to:"Екатеринбург", iata:"SVX", al:"ASO Airlines", t:"19:00" },
  { fn:"AS-1130", to:"Нижневартовск", iata:"NJC", al:"ASO Airlines", t:"19:30" },
  { fn:"AS-6240", to:"Санкт-Петербург", iata:"LED", al:"ASO Airlines", t:"20:20" },
  { fn:"NS-318", to:"Тюмень", iata:"TUM", al:"Noris", t:"21:35" },
  { fn:"AS-6242", to:"Санкт-Петербург", iata:"LED", al:"ASO Airlines", t:"22:15" },
  { fn:"AS-4637", to:"Минск", iata:"MSQ", al:"ASO Airlines", t:"22:20" },
  { fn:"AS-3841", to:"Новосибирск", iata:"OVB", al:"ASO Airlines", t:"23:15" },
  { fn:"AS-9098", to:"Пекин", iata:"PEK", al:"ASO Airlines", t:"23:40" },
  { fn:"AS-6244", to:"Санкт-Петербург", iata:"LED", al:"ASO Airlines", t:"23:55" }
];

function samaraDate() {
  const d = new Date();
  d.setHours(d.getHours() + 4);
  return d;
}

function todayStr() { return samaraDate().toISOString().slice(0,10); }
function tomorrowStr() {
  const d = samaraDate();
  d.setDate(d.getDate()+1);
  return d.toISOString().slice(0,10);
}

function mk(f, date) {
  return {
    id: f.fn+'-'+date,
    flightNumber: f.fn,
    destination: f.to,
    iataCode: f.iata,
    airline: f.al,
    scheduledTime: f.t,
    scheduledDeparture: date+'T'+f.t+':00',
    expectedDeparture: null,
    checkInStart: null, checkInEnd: null, checkInCounters: '',
    boardingStart: null, boardingEnd: null, boardingGate: '',
    status: 'scheduled'
  };
}

async function load() {
  try { const r = await pool.query('SELECT data FROM flights'); return r.rows.map(x=>x.data); }
  catch(e) { return []; }
}

async function save(flights) {
  try {
    await pool.query('DELETE FROM flights');
    for (const f of flights) await pool.query('INSERT INTO flights (id, data) VALUES ($1,$2)', [f.id, JSON.stringify(f)]);
  } catch(e) {}
}

function enrich(f) {
  const dep = f.scheduledDeparture||'';
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const day = dep.startsWith(tomorrow) ? 'tomorrow' : 'today';
  return { ...f, flightDay: day, computedStatus: f.status, statusText: f.status==='cancelled'?'Отменён':f.status==='departed'?'Вылетел':'По расписанию' };
}

app.get('/api/flights', async (req, res) => {
  let flights = await load();
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const existing = new Set(flights.map(f=>f.id));
  const add = [];
  
  for (const f of DAILY_FLIGHTS) {
    const idT = f.fn+'-'+today;
    if (!existing.has(idT)) add.push(mk(f, today));
    const idM = f.fn+'-'+tomorrow;
    if (!existing.has(idM)) add.push(mk(f, tomorrow));
  }
  
  if (add.length) { flights.push(...add); await save(flights); }
  
  // Очистка вчерашних departed
  const cleaned = flights.filter(f=>f.status!=='departed'||(f.scheduledDeparture||'').startsWith(today));
  if (cleaned.length !== flights.length) { flights = cleaned; await save(flights); }
  
  let result = flights.map(enrich);
  const showDep = req.query.showDeparted === 'true';
  if (!showDep) result = result.filter(f=>f.status!=='departed');
  result.sort((a,b)=>(a.scheduledTime||'').localeCompare(b.scheduledTime||''));
  res.json(result);
});

app.post('/api/flights', async (req,res) => {
  const flights = await load();
  const f = {
    id: Date.now().toString(),
    flightNumber: req.body.flightNumber||'',
    destination: req.body.destination||'',
    iataCode: req.body.iataCode||'',
    airline: req.body.airline||'',
    scheduledTime: req.body.scheduledTime||'',
    scheduledDeparture: req.body.scheduledDeparture||null,
    expectedDeparture: req.body.expectedDeparture||null,
    checkInStart: req.body.checkInStart||null,
    checkInEnd: req.body.checkInEnd||null,
    checkInCounters: req.body.checkInCounters||'',
    boardingStart: req.body.boardingStart||null,
    boardingEnd: req.body.boardingEnd||null,
    boardingGate: req.body.boardingGate||'',
    status: req.body.status||'scheduled'
  };
  flights.push(f);
  await save(flights);
  res.status(201).json(enrich(f));
});

app.put('/api/flights/:id', async (req,res) => {
  const flights = await load();
  const i = flights.findIndex(f=>f.id===req.params.id);
  if (i===-1) return res.status(404).json({error:'Не найден'});
  flights[i] = {...flights[i], ...req.body, id: flights[i].id};
  await save(flights);
  res.json(enrich(flights[i]));
});

app.delete('/api/flights/:id', async (req,res) => {
  let flights = await load();
  flights = flights.filter(f=>f.id!==req.params.id);
  await save(flights);
  res.status(204).send();
});

app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('OK'));
module.exports = app;
