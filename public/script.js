let currentFlights = [];
let currentTab = 'today';
let showDeparted = false;
let audioEnabled = localStorage.getItem('audioEnabled') !== 'false';
let airlinesList = [];
const API = '/api/flights';

const $ = id => document.getElementById(id);
const clockTime = $('clockTime');
const lastUpdated = $('lastUpdated');
const lastUpdated2 = $('lastUpdated2');
const flightsToday = $('flightsToday');
const flightsTomorrow = $('flightsTomorrow');
const modalOverlay = $('modalOverlay');
const modalBody = $('modalBody');
const modalTitle = $('modalTitle');
const toggleDeparted = $('toggleDeparted');

const spinnerOverlay = $('spinnerOverlay');
setTimeout(() => {
  if (spinnerOverlay) spinnerOverlay.style.display = 'none';
}, 1500);

const SAMARA_OFFSET = 4 * 60;
function getSamaraNow() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (SAMARA_OFFSET * 60000));
}

setInterval(() => {
  const now = getSamaraNow();
  clockTime.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}, 1000);

function fmtTm(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDt(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDateOnly(s) {
  if (!s) return '—';
  const d = new Date(s);
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ============ ЛОГОТИПЫ АВИАКОМПАНИЙ ============
function getAirlineLogo(airlineName) {
  if (!airlineName) return null;
  const found = airlinesList.find(a => a.name.toLowerCase() === airlineName.toLowerCase());
  return found && found.logo ? found.logo : null;
}

function getAirlineInitials(airline) {
  return (airline || 'A').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

async function loadAirlines() {
  try {
    const r = await fetch('/api/airlines');
    airlinesList = await r.json();
  } catch(e) { airlinesList = []; }
}

// ============ ТЁМНАЯ ТЕМА ============
const themeToggle = $('themeToggle');
if (themeToggle) {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️';
  }
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
  });
}

// ============ АУДИО ============
const audioToggle = $('audioToggle');
if (audioToggle) {
  audioToggle.textContent = audioEnabled ? '🔊' : '🔇';
  audioToggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    localStorage.setItem('audioEnabled', audioEnabled);
    audioToggle.textContent = audioEnabled ? '🔊' : '🔇';
  });
}

let isSpeaking = false;
let speechQueue = [];

function speak(text, lang = 'ru-RU') {
  if (!audioEnabled) return;
  if ('speechSynthesis' in window) {
    speechQueue.push({ text, lang });
    processQueue();
  }
}

function processQueue() {
  if (isSpeaking || speechQueue.length === 0) return;
  isSpeaking = true;
  const { text, lang } = speechQueue.shift();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = lang === 'en-US' ? 0.85 : 0.9;
  u.pitch = 1;
  u.onend = () => { isSpeaking = false; setTimeout(() => processQueue(), 300); };
  u.onerror = () => { isSpeaking = false; setTimeout(() => processQueue(), 300); };
  window.speechSynthesis.speak(u);
}

function formatCountersForSpeech(counters) {
  if (!counters) return '';
  return counters.replace(/\./g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ');
}

let lastAnnounced = {};

function announceStatusChange(f, statusType) {
  const now = getSamaraNow();
  const timeKey = f.id + '-' + statusType;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (lastAnnounced[timeKey] && nowMinutes - lastAnnounced[timeKey] < 2) return;
  lastAnnounced[timeKey] = nowMinutes;

  const airline = f.airline || '';
  const flight = f.flightNumber || '';
  const city = f.destination || '';
  const counters = formatCountersForSpeech(f.checkInCounters || '');
  const gate = f.boardingGate || '';
  const delayTime = f.expectedDeparture ? fmtTm(f.expectedDeparture) : '';

  let textRu = '';
  let textEn = '';

  switch (statusType) {
    case 'checkin':
      textRu = `Уважаемые пассажиры! Начинается регистрация билетов и оформление багажа на рейс авиакомпании ${airline}, ${flight}, вылетающих в ${city}. Приглашаем вас пройти к стойкам номер ${counters}.`;
      textEn = `Attention please! Check-in for ${airline} flight ${flight} to ${city} is open now at check-in counter number ${counters}.`;
      break;
    case 'checkin_completed':
      textRu = `Уважаемые пассажиры! Закончилась регистрация билетов и оформление багажа на рейс авиакомпании ${airline}, ${flight}, вылетающих в ${city}.`;
      textEn = `Attention please! Check-in for ${airline} flight ${flight} to ${city} is finished.`;
      break;
    case 'boarding':
      textRu = `Уважаемые пассажиры! Начинается посадка на рейс авиакомпании ${airline}, ${flight}, вылетающих в ${city}. Приглашаем вас пройти к выходу на посадку номер ${gate}.`;
      textEn = `Attention please! Boarding for ${airline} flight ${flight} to ${city} is open now at gate number ${gate}.`;
      break;
    case 'boarding_completed':
      textRu = `Уважаемые пассажиры! Закончилась посадка на рейс авиакомпании ${airline}, ${flight}, вылетающих в ${city}.`;
      textEn = `Attention please! Boarding for ${airline} flight ${flight} to ${city} is finished.`;
      break;
    case 'delayed':
      textRu = `Внимание! К сведению пассажиров, вылетающих рейсом авиакомпании ${airline} ${flight} в ${city}, вылет вашего рейса задерживается до ${delayTime}. От имени авиакомпании мы приносим свои извинения за доставленные неудобства!`;
      textEn = `Attention please! Information for ${airline} flight ${flight} to ${city} has been delayed till ${delayTime}. On behalf of the airline, we apologise for the inconvenience.`;
      break;
    case 'cancelled':
      textRu = `Внимание! К сведению пассажиров, вылетающих рейсом авиакомпании ${airline} ${flight} в ${city}, ваш рейс отменён. Просим вас обращаться в представительство авиакомпании за получением более подробной информации.`;
      textEn = `Attention please! ${airline} flight ${flight} to ${city} has been cancelled! Please go to the ${airline} office for more information.`;
      break;
    case 'departed':
      textRu = `Уважаемые пассажиры! Рейс авиакомпании ${airline} ${flight} в ${city} вылетел.`;
      textEn = `${airline} flight ${flight} to ${city} has departed.`;
      break;
    case 'feeding':
      textRu = `Уважаемые пассажиры! Для пассажиров рейса авиакомпании ${airline} ${flight} в ${city} предоставляется питание.`;
      textEn = `Attention please! Meal service is provided for ${airline} flight ${flight} to ${city}.`;
      break;
  }
  if (textRu) speak(textRu, 'ru-RU');
  if (textEn) speak(textEn, 'en-US');
}

function checkScheduleForAudio() {
  if (!audioEnabled) return;
  const now = getSamaraNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  currentFlights.forEach(f => {
    if (f.status === 'departed' || f.status === 'early_departed' || f.status === 'cancelled') return;
    if (f.checkInStart) {
      const t = new Date(f.checkInStart);
      if (nowMinutes === t.getHours() * 60 + t.getMinutes()) announceStatusChange(f, 'checkin');
    }
    if (f.checkInEnd) {
      const t = new Date(f.checkInEnd);
      if (nowMinutes === t.getHours() * 60 + t.getMinutes()) announceStatusChange(f, 'checkin_completed');
    }
    if (f.boardingStart) {
      const t = new Date(f.boardingStart);
      if (nowMinutes === t.getHours() * 60 + t.getMinutes()) announceStatusChange(f, 'boarding');
    }
    if (f.boardingEnd) {
      const t = new Date(f.boardingEnd);
      if (nowMinutes === t.getHours() * 60 + t.getMinutes()) announceStatusChange(f, 'boarding_completed');
    }
  });
}

// ============ АЭРОПОРТ ============
async function loadAirportStatus() {
  try {
    const r = await fetch('/api/airport-status');
    const data = await r.json();
    const banner = $('airportBanner');
    if (data.status === 'closed') {
      banner.classList.add('closed');
      banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span id="airportBannerText">Аэропорт закрыт</span>';
    } else {
      banner.classList.remove('closed');
      banner.innerHTML = '<i class="fas fa-check-circle"></i> <span id="airportBannerText">Аэропорт открыт</span>';
    }
  } catch(e) {}
}

// ============ СРОЧНАЯ ИНФОРМАЦИЯ ============
async function loadUrgent() {
  try {
    const r = await fetch('/api/urgent');
    const data = await r.json();
    if (data.text) {
      $('urgentInfo').style.display = 'flex';
      $('urgentInfoText').textContent = data.text;
    } else {
      $('urgentInfo').style.display = 'none';
    }
  } catch(e) {}
}

// ============ PUSH ============
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BNcC-bM8H_Py4XHqFzFcGK_kYfHKjLeZqFpZ8YrFqWXqKpFzFpFzA')
      });
    }
  } catch(e) {}
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

// ============ ЗАГРУЗКА ============
async function load() {
  try {
    await loadAirlines();
    const r = await fetch(`${API}?showDeparted=${showDeparted}`);
    const oldFlights = currentFlights;
    currentFlights = await r.json();
    renderAll();
    const now = getSamaraNow();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    if (lastUpdated) lastUpdated.textContent = ts;
    if (lastUpdated2) lastUpdated2.textContent = ts;

    if (oldFlights.length > 0) {
      currentFlights.forEach(f => {
        const old = oldFlights.find(o => o.id === f.id);
        if (old) {
          if (f.status !== old.status && f.status !== 'scheduled') announceStatusChange(f, f.status);
          if (f.expectedDeparture && f.expectedDeparture !== old.expectedDeparture) {
            const newExp = new Date(f.expectedDeparture);
            const sched = new Date(f.scheduledDeparture);
            if (newExp > sched) announceStatusChange(f, 'delayed');
          }
        }
      });
    }
    checkScheduleForAudio();
  } catch(e) { console.log(e); }
}

function getTagClass(f) {
  if (f.status === 'cancelled') return 'tag-cancel';
  if (f.status === 'departed' || f.status === 'early_departed') return 'tag-departed';
  if (f.status === 'suspended') return 'tag-suspended';
  if (f.computedStatus === 'early') return 'tag-early';
  if (f.computedStatus === 'checkin') return 'tag-checkin';
  if (f.computedStatus === 'checkin_completed') return 'tag-checkin-end';
  if (f.computedStatus === 'boarding') return 'tag-boarding';
  if (f.computedStatus === 'boarding_completed') return 'tag-boarding-end';
  if (f.computedStatus === 'delayed') return 'tag-delay';
  return 'tag-ok';
}

function renderFlightRow(f) {
  const delayed = f.expectedDeparture && new Date(f.expectedDeparture) > new Date(f.scheduledDeparture);
  const early = f.computedStatus === 'early';
  const departed = f.status === 'departed' || f.status === 'early_departed';
  const cancelled = f.status === 'cancelled';
  const feeding = f.status === 'feeding';

  let timeHtml;
  if (cancelled || departed) timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span>`;
  else if (delayed || early) timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span><br><span class="time-new">${fmtTm(f.expectedDeparture)}</span>`;
  else timeHtml = fmtTm(f.scheduledDeparture);

  let statusHtml = `<span class="status-tag ${getTagClass(f)}">${(f.statusText || 'По расписанию').replace(/\n/g,'<br>')}</span>`;
  if (feeding) statusHtml += `<span class="status-feeding-sub">Предоставление питания</span>`;

  const logo = getAirlineLogo(f.airline);
  const initials = getAirlineInitials(f.airline);
  const airlineHtml = logo
    ? `<img src="${logo}" alt="${f.airline}" class="airline-logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="airline-avatar" style="display:none">${initials}</div>${f.airline || ''}`
    : `<div class="airline-avatar">${initials}</div>${f.airline || ''}`;

  return `<tr onclick="showDetail('${f.id}')" style="${departed ? 'opacity:0.6;' : ''}">
    <td class="time-cell">${timeHtml}</td>
    <td><div class="dest-cell"><span class="dest-name">${f.destination}</span><span class="dest-iata">${f.iataCode || ''}</span></div></td>
    <td class="flight-num">${f.flightNumber}</td>
    <td><div class="airline-cell">${airlineHtml}</div></td>
    <td class="gate-cell">${f.boardingGate || '—'}</td>
    <td>${statusHtml}</td>
  </tr>`;
}

function renderAll() {
  const todayFlights = currentFlights.filter(f => {
    if (f.status === 'departed' || f.status === 'early_departed') return showDeparted;
    return (f.flightDay || 'today') === 'today';
  });
  if (flightsToday) {
    flightsToday.innerHTML = todayFlights.length === 0
      ? `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane"></i><p>Нет рейсов на сегодня</p></div></td></tr>`
      : todayFlights.map(renderFlightRow).join('');
  }

  const tomorrowFlights = currentFlights.filter(f => {
    if (f.status === 'departed' || f.status === 'early_departed') return false;
    return (f.flightDay || 'today') === 'tomorrow';
  });
  if (flightsTomorrow) {
    flightsTomorrow.innerHTML = tomorrowFlights.length === 0
      ? `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane"></i><p>Нет рейсов на завтра</p></div></td></tr>`
      : tomorrowFlights.map(renderFlightRow).join('');
  }
}

// ============ ДЕТАЛИ ============
window.showDetail = function(id) {
  const f = currentFlights.find(x => x.id === id);
  if (!f) return;
  modalTitle.textContent = `Рейс ${f.flightNumber}`;
  const delayed = f.expectedDeparture && new Date(f.expectedDeparture) > new Date(f.scheduledDeparture);
  const early = f.computedStatus === 'early';
  const delayHtml = (delayed || early) ? `<div class="modal-delay-banner"><i class="fas fa-clock"></i><span>${early ? 'Ранний вылет' : 'Задержан до ' + fmtTm(f.expectedDeparture)}</span></div>` : '';
  const tagClass = getTagClass(f);
  const doneCheckIn = ['checkin_completed','boarding','boarding_completed','departed','early_departed'].includes(f.computedStatus);
  const activeBoarding = ['boarding','boarding_completed'].includes(f.computedStatus);

  const logo = getAirlineLogo(f.airline);
  const initials = getAirlineInitials(f.airline);
  const airlineHtml = logo
    ? `<img src="${logo}" alt="${f.airline}" class="airline-logo" style="width:40px;height:40px;"><span>${f.airline}</span>`
    : `<div class="airline-avatar" style="width:40px;height:40px;">${initials}</div><span>${f.airline}</span>`;

  modalBody.innerHTML = `
    <div class="modal-flight-top">
      <div>
        <div class="modal-flight-num">${f.flightNumber}</div>
        <div class="modal-flight-airline" style="display:flex;align-items:center;gap:8px;">${airlineHtml}</div>
      </div>
      <span class="status-tag ${tagClass}" style="font-size:14px;">${(f.statusText || 'По расписанию').replace(/\n/g,'<br>')}</span>
    </div>
    ${delayHtml}
    <div class="modal-fs-destination">
      <h2>${f.destination}</h2>
      <span class="modal-fs-iata">${f.iataCode || ''}</span>
    </div>
    <div class="modal-fs-info-row"><span>Россия</span></div>
    <div class="modal-fs-table">
      <div class="modal-fs-table-row header">
        <div>Дата</div><div>Время по расписанию</div><div>Ожидаемое время</div><div>Выход</div><div>Терминал</div>
      </div>
      <div class="modal-fs-table-row">
        <div><strong>${fmtDateOnly(f.scheduledDeparture)}</strong></div>
        <div><strong>${fmtTm(f.scheduledDeparture)}</strong></div>
        <div><strong>${fmtTm(f.expectedDeparture || f.scheduledDeparture)}</strong></div>
        <div><strong>${f.boardingGate || '—'}</strong></div>
        <div><strong>А</strong></div>
      </div>
    </div>
    <div class="modal-fs-timeline">
      <h3>Регистрация и посадка</h3>
      <div class="timeline-items">
        <div class="timeline-item ${doneCheckIn ? 'done' : ''}">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-time">${fmtTm(f.checkInStart)}</div>
            <div class="timeline-label">Начало регистрации${f.checkInCounters ? ' • Стойки ' + f.checkInCounters : ''}</div>
          </div>
        </div>
        <div class="timeline-item ${doneCheckIn ? 'done' : ''}">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-time">${fmtTm(f.checkInEnd)}</div>
            <div class="timeline-label">Окончание регистрации</div>
          </div>
        </div>
        ${f.boardingStart ? `
        <div class="timeline-item ${activeBoarding ? 'active' : ''}">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-time">${fmtTm(f.boardingStart)}</div>
            <div class="timeline-label">Начало посадки${f.boardingGate ? ' • Выход ' + f.boardingGate : ''}</div>
          </div>
        </div>
        ${f.boardingEnd ? `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-time">${fmtTm(f.boardingEnd)}</div>
            <div class="timeline-label">Окончание посадки</div>
          </div>
        </div>` : ''}` : ''}
      </div>
    </div>
    <div class="modal-fs-extra">
      <div class="modal-fs-extra-item"><span class="extra-label">Авиакомпания</span><span class="extra-value">${f.airline || '—'}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">По расписанию</span><span class="extra-value">${fmtDt(f.scheduledDeparture)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Ожидаемое</span><span class="extra-value">${fmtDt(f.expectedDeparture)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Регистрация</span><span class="extra-value">${fmtTm(f.checkInStart)} — ${fmtTm(f.checkInEnd)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Посадка</span><span class="extra-value">${fmtTm(f.boardingStart)} — ${fmtTm(f.boardingEnd)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Стойки</span><span class="extra-value">${f.checkInCounters || '—'}</span></div>
    </div>
    <button class="btn-share" onclick="event.stopPropagation(); shareFlight('${f.id}')">
      <i class="fas fa-share-alt"></i> Поделиться рейсом
    </button>`;
  modalOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
};

window.shareFlight = function(id) {
  const f = currentFlights.find(x => x.id === id);
  if (!f) return;
  const text = `🛫 Рейс ${f.flightNumber}\n📍 ${f.destination} (${f.iataCode || ''})\n🕐 По расписанию: ${fmtTm(f.scheduledDeparture)}\n🕐 Ожидаемый: ${fmtTm(f.expectedDeparture || f.scheduledDeparture)}\n🏷️ Стойки: ${f.checkInCounters || '—'}\n🚪 Выход: ${f.boardingGate || '—'}\n📌 Статус: ${(f.statusText || 'По расписанию').replace(/\n/g, ' ')}\n🔗 ar-smh.ru`;
  if (navigator.share) navigator.share({ title: `Рейс ${f.flightNumber}`, text });
  else navigator.clipboard.writeText(text).then(() => alert('Информация скопирована!'));
};

$('modalClose').onclick = () => { modalOverlay.classList.remove('show'); document.body.style.overflow = ''; };
modalOverlay.onclick = e => { if (e.target === modalOverlay) { modalOverlay.classList.remove('show'); document.body.style.overflow = ''; } };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { modalOverlay.classList.remove('show'); document.body.style.overflow = ''; } });

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    $('boardToday').style.display = currentTab === 'today' ? '' : 'none';
    $('boardTomorrow').style.display = currentTab === 'tomorrow' ? '' : 'none';
  });
});

if (toggleDeparted) {
  toggleDeparted.addEventListener('click', () => {
    showDeparted = !showDeparted;
    toggleDeparted.classList.toggle('active', showDeparted);
    toggleDeparted.innerHTML = showDeparted ? '<i class="fas fa-eye-slash"></i> Скрыть вылетевшие' : '<i class="fas fa-eye"></i> Показать вылетевшие';
    load();
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => subscribeToPush());
}

setInterval(() => { load(); checkScheduleForAudio(); }, 30000);
loadAirportStatus();
loadUrgent();
load();
