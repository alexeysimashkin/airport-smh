let currentFlights = [];
let editingId = null;
let currentTab = 'today';
let showDeparted = false;
const API = '/api/flights';

const $ = id => document.getElementById(id);
const clockTime = $('clockTime');
const lastUpdated = $('lastUpdated');
const lastUpdated2 = $('lastUpdated2');
const flightsToday = $('flightsToday');
const flightsTomorrow = $('flightsTomorrow');
const adminPanel = $('adminPanel');
const flightForm = $('flightForm');
const formTitle = $('formTitle');
const adminList = $('adminFlightsList');
const modalOverlay = $('modalOverlay');
const modalBody = $('modalBody');
const modalTitle = $('modalTitle');
const toggleDeparted = $('toggleDeparted');

// Самарское время (UTC+4)
const SAMARA_OFFSET = 4 * 60;
function getSamaraNow() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (SAMARA_OFFSET * 60000));
}

// Часы
setInterval(() => {
  const now = getSamaraNow();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  clockTime.textContent = `${h}:${m}`;
}, 1000);

// Парсинг даты
function parseDate(dateStr) {
  if (!dateStr) return null;
  const [datePart, timePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0);
}

// Форматирование
function fmtTm(s) {
  if (!s) return '—';
  const d = parseDate(s);
  if (!d) return '—';
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDt(s) {
  if (!s) return '—';
  const d = parseDate(s);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDateOnly(s) {
  if (!s) return '—';
  const d = parseDate(s);
  if (!d) return '—';
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// Загрузка данных
async function load() {
  try {
    const url = `${API}?showDeparted=${showDeparted}`;
    const r = await fetch(url);
    currentFlights = await r.json();
    renderBoards();
    renderAdmin();
    const now = getSamaraNow();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    lastUpdated.textContent = timeStr;
    lastUpdated2.textContent = timeStr;
  } catch(e) {
    console.error('Ошибка загрузки:', e);
  }
}

// Определение класса для статуса
function getTagClass(flight) {
  if (flight.status === 'cancelled') return 'tag-cancel';
  if (flight.status === 'departed') return 'tag-departed';
  switch(flight.computedStatus) {
    case 'checkin': return 'tag-checkin';
    case 'checkin_completed': return 'tag-checkin-end';
    case 'boarding': return 'tag-boarding';
    case 'boarding_completed': return 'tag-boarding-end';
    case 'delayed': return 'tag-delay';
    default: return 'tag-ok';
  }
}

// Строка рейса для таблицы
function renderFlightRow(f) {
  const schedDep = parseDate(f.scheduledDeparture);
  const expectedDep = parseDate(f.expectedDeparture);
  const delayed = expectedDep && schedDep && expectedDep.getTime() > schedDep.getTime();
  const cancelled = f.status === 'cancelled';
  const departed = f.status === 'departed';
  
  let timeHtml;
  if (cancelled || departed) {
    timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span>`;
  } else if (delayed) {
    timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span><br><span class="time-new">${fmtTm(f.expectedDeparture)}</span>`;
  } else {
    timeHtml = fmtTm(f.scheduledDeparture);
  }
  
  const opacity = departed ? 'opacity:0.6;' : '';
  
  return `<tr onclick="showDetail('${f.id}')" style="${opacity}">
    <td class="time-cell">${timeHtml}</td>
    <td><div class="dest-cell"><span class="dest-name">${f.destination}</span><span class="dest-iata">${f.iataCode}</span></div></td>
    <td class="flight-num">${f.flightNumber}</td>
    <td><div class="airline-cell"><div class="airline-avatar">${f.airline.charAt(0)}</div>${f.airline}</div></td>
    <td class="gate-cell">${f.boardingGate || '—'}</td>
    <td><span class="status-tag ${getTagClass(f)}">${f.statusText.replace(/\n/g,'<br>')}</span></td>
  </tr>`;
}

// Отрисовка обоих табло
function renderBoards() {
  // === СЕГОДНЯ ===
  // Показываем: today + both + (departed если включён показ)
  let todayFlights = currentFlights.filter(f => {
    if (f.flightDay === 'today' || f.flightDay === 'both') return true;
    if (showDeparted && f.flightDay === 'departed') return true;
    return false;
  });
  
  if (todayFlights.length === 0) {
    flightsToday.innerHTML = `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane"></i><p>Нет рейсов на сегодня</p></div></td></tr>`;
  } else {
    flightsToday.innerHTML = todayFlights.map(renderFlightRow).join('');
  }
  
  // === ЗАВТРА ===
  // Показываем: tomorrow + both (вылетевшие на завтра не попадают)
  let tomorrowFlights = currentFlights.filter(f => {
    return f.flightDay === 'tomorrow' || f.flightDay === 'both';
  });
  
  if (tomorrowFlights.length === 0) {
    flightsTomorrow.innerHTML = `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane"></i><p>Нет рейсов на завтра</p></div></td></tr>`;
  } else {
    flightsTomorrow.innerHTML = tomorrowFlights.map(renderFlightRow).join('');
  }
}

// Отрисовка списка в админке
function renderAdmin() {
  if (!currentFlights.length) {
    adminList.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">Нет рейсов</p>';
    return;
  }
  adminList.innerHTML = currentFlights.map(f => `
    <div class="admin-row">
      <div class="admin-row-info">
        <span class="admin-row-number">${f.flightNumber}</span>
        <span class="admin-row-route">${f.destination} (${f.iataCode})</span>
        <span style="font-size:12px;color:var(--gray-400);">${fmtDt(f.scheduledDeparture)}</span>
        <span class="status-tag ${getTagClass(f)}" style="font-size:10px;">${f.statusText}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn-icon" onclick="event.stopPropagation();editFlight('${f.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="event.stopPropagation();deleteFlight('${f.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ==================== ДЕТАЛИ РЕЙСА ====================
window.showDetail = function(id) {
  const f = currentFlights.find(x => x.id === id);
  if (!f) return;
  
  modalTitle.textContent = `Рейс ${f.flightNumber}`;
  
  const expectedDep = parseDate(f.expectedDeparture);
  const schedDep = parseDate(f.scheduledDeparture);
  const delayed = expectedDep && schedDep && expectedDep.getTime() > schedDep.getTime();
  const departed = f.status === 'departed';
  
  const delayHtml = (delayed && !departed) ? `
    <div class="modal-delay-banner">
      <i class="fas fa-clock"></i>
      <span>Задержан до ${fmtTm(f.expectedDeparture)}</span>
    </div>` : '';

  const doneCheckIn = ['checkin_completed','boarding','boarding_completed'].includes(f.computedStatus) || departed;
  const activeBoarding = ['boarding','boarding_completed'].includes(f.computedStatus) || departed;

  modalBody.innerHTML = `
    <div>
      <div class="modal-flight-top">
        <div>
          <div class="modal-flight-num">${f.flightNumber}</div>
          <div class="modal-flight-dest">${f.destination}</div>
          <div class="modal-flight-iata">Код IATA: ${f.iataCode}</div>
        </div>
        <span class="status-tag ${getTagClass(f)}" style="font-size:14px;">${f.statusText.replace(/\n/g,'<br>')}</span>
      </div>
      ${delayHtml}
      <div class="modal-fs-destination">
        <h2>${f.destination}</h2>
        <span class="modal-fs-iata">${f.iataCode}</span>
      </div>
      <div class="modal-fs-info-row">
        <span>Россия</span>
      </div>
      <div class="modal-fs-table">
        <div class="modal-fs-table-row header">
          <div>Дата вылета</div>
          <div>Время по расписанию</div>
          <div>Ожидаемое время</div>
          <div>Выход</div>
          <div>Терминал</div>
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
        <h3>Регистрация</h3>
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
          <div class="timeline-item ${activeBoarding ? 'active' : ''}">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-time">${fmtTm(f.boardingStart)}</div>
              <div class="timeline-label">Начало посадки${f.boardingGate ? ' • Выход ' + f.boardingGate : ''}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-fs-status">
        <span class="status-tag ${getTagClass(f)}" style="font-size:15px;padding:10px 24px;">${f.statusText.replace(/\n/g,'<br>')}</span>
      </div>
      <div class="modal-fs-extra">
        <div class="modal-fs-extra-item">
          <span class="extra-label">Время вылета по расписанию</span>
          <span class="extra-value">${fmtDt(f.scheduledDeparture)}</span>
        </div>
        <div class="modal-fs-extra-item">
          <span class="extra-label">Ожидаемое время вылета</span>
          <span class="extra-value">${fmtDt(f.expectedDeparture)}</span>
        </div>
        <div class="modal-fs-extra-item">
          <span class="extra-label">Выход на посадку</span>
          <span class="extra-value">${f.boardingGate || '—'}</span>
        </div>
      </div>
    </div>`;

  modalOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
};

// ==================== МОДАЛКА ====================
$('modalClose').onclick = () => { 
  modalOverlay.classList.remove('show'); 
  document.body.style.overflow = ''; 
};

modalOverlay.onclick = e => { 
  if (e.target === modalOverlay) { 
    modalOverlay.classList.remove('show'); 
    document.body.style.overflow = ''; 
  }
};

document.addEventListener('keydown', e => { 
  if (e.key === 'Escape') { 
    modalOverlay.classList.remove('show'); 
    document.body.style.overflow = ''; 
  }
});

// ==================== ТАБЫ ====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    $('boardToday').style.display = currentTab === 'today' ? '' : 'none';
    $('boardTomorrow').style.display = currentTab === 'tomorrow' ? '' : 'none';
  });
});

// ==================== ВЫЛЕТЕВШИЕ ====================
toggleDeparted.addEventListener('click', () => {
  showDeparted = !showDeparted;
  toggleDeparted.classList.toggle('active', showDeparted);
  toggleDeparted.innerHTML = showDeparted 
    ? '<i class="fas fa-eye-slash"></i> Скрыть вылетевшие' 
    : '<i class="fas fa-eye"></i> Показать вылетевшие';
  load();
});

// ==================== АДМИНКА ====================
$('adminToggle').onclick = () => { 
  adminPanel.style.display = adminPanel.style.display !== 'none' ? 'none' : 'block'; 
};

$('addFlightBtn').onclick = () => { 
  editingId = null; 
  formTitle.textContent = 'Новый рейс'; 
  $('flightFormInner').reset(); 
  $('flightId').value = ''; 
  $('status').value = 'scheduled';
  flightForm.style.display = 'block'; 
};

$('cancelForm').onclick = () => { 
  flightForm.style.display = 'none'; 
};

// Редактирование
window.editFlight = function(id) {
  const f = currentFlights.find(x => x.id === id);
  if (!f) return;
  editingId = id;
  formTitle.textContent = 'Редактировать рейс';
  $('flightId').value = f.id;
  $('flightNumber').value = f.flightNumber;
  $('airline').value = f.airline;
  $('destination').value = f.destination;
  $('iataCode').value = f.iataCode;
  $('scheduledDeparture').value = f.scheduledDeparture ? f.scheduledDeparture.slice(0, 16) : '';
  $('expectedDeparture').value = f.expectedDeparture ? f.expectedDeparture.slice(0, 16) : '';
  $('checkInStart').value = f.checkInStart ? f.checkInStart.slice(0, 16) : '';
  $('checkInEnd').value = f.checkInEnd ? f.checkInEnd.slice(0, 16) : '';
  $('checkInCounters').value = f.checkInCounters || '';
  $('boardingStart').value = f.boardingStart ? f.boardingStart.slice(0, 16) : '';
  $('boardingEnd').value = f.boardingEnd ? f.boardingEnd.slice(0, 16) : '';
  $('boardingGate').value = f.boardingGate || '';
  $('status').value = f.status;
  flightForm.style.display = 'block';
  flightForm.scrollIntoView({ behavior: 'smooth' });
};

// Удаление
window.deleteFlight = async function(id) {
  if (!confirm('Удалить рейс?')) return;
  await fetch(`${API}/${id}`, { method:'DELETE' });
  load();
};

// Сохранение
$('flightFormInner').onsubmit = async function(e) {
  e.preventDefault();
  const body = {
    flightNumber: $('flightNumber').value,
    airline: $('airline').value,
    destination: $('destination').value,
    iataCode: $('iataCode').value.toUpperCase(),
    scheduledDeparture: $('scheduledDeparture').value ? $('scheduledDeparture').value + ':00' : null,
    expectedDeparture: $('expectedDeparture').value ? $('expectedDeparture').value + ':00' : null,
    checkInStart: $('checkInStart').value ? $('checkInStart').value + ':00' : null,
    checkInEnd: $('checkInEnd').value ? $('checkInEnd').value + ':00' : null,
    checkInCounters: $('checkInCounters').value,
    boardingStart: $('boardingStart').value ? $('boardingStart').value + ':00' : null,
    boardingEnd: $('boardingEnd').value ? $('boardingEnd').value + ':00' : null,
    boardingGate: $('boardingGate').value,
    status: $('status').value
  };
  const url = editingId ? `${API}/${editingId}` : API;
  await fetch(url, { 
    method: editingId?'PUT':'POST', 
    headers:{'Content-Type':'application/json'}, 
    body:JSON.stringify(body) 
  });
  flightForm.style.display = 'none';
  editingId = null;
  load();
};

// Автообновление каждые 30 секунд
setInterval(load, 30000);

// Первая загрузка
load();
