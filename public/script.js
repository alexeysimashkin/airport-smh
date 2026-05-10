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

// Самарское время
const SAMARA_OFFSET = 4 * 60;
function getSamaraNow() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (SAMARA_OFFSET * 60000));
}

setInterval(() => {
  const now = getSamaraNow();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  clockTime.textContent = `${h}:${m}`;
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

async function load() {
  const r = await fetch(API);
  currentFlights = await r.json();
  renderAll();
  const now = getSamaraNow();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  lastUpdated.textContent = ts;
  lastUpdated2.textContent = ts;
}

function getTagClass(f) {
  if (f.status === 'cancelled') return 'tag-cancel';
  if (f.status === 'departed') return 'tag-departed';
  if (f.computedStatus === 'checkin') return 'tag-checkin';
  if (f.computedStatus === 'checkin_completed') return 'tag-checkin-end';
  if (f.computedStatus === 'boarding') return 'tag-boarding';
  if (f.computedStatus === 'boarding_completed') return 'tag-boarding-end';
  if (f.computedStatus === 'delayed') return 'tag-delay';
  return 'tag-ok';
}

function renderFlightRow(f) {
  const delayed = f.expectedDeparture && new Date(f.expectedDeparture) > new Date(f.scheduledDeparture);
  const departed = f.status === 'departed';
  const cancelled = f.status === 'cancelled';
  
  let timeHtml;
  if (cancelled || departed) {
    timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span>`;
  } else if (delayed) {
    timeHtml = `<span class="time-old">${fmtTm(f.scheduledDeparture)}</span><br><span class="time-new">${fmtTm(f.expectedDeparture)}</span>`;
  } else {
    timeHtml = fmtTm(f.scheduledDeparture);
  }
  
  return `<tr onclick="showDetail('${f.id}')" style="${departed ? 'opacity:0.6;' : ''}">
    <td class="time-cell">${timeHtml}</td>
    <td><div class="dest-cell"><span class="dest-name">${f.destination}</span><span class="dest-iata">${f.iataCode || ''}</span></div></td>
    <td class="flight-num">${f.flightNumber}</td>
    <td><div class="airline-cell"><div class="airline-avatar">${(f.airline || 'A').charAt(0)}</div>${f.airline || ''}</div></td>
    <td class="gate-cell">${f.boardingGate || '—'}</td>
    <td><span class="status-tag ${getTagClass(f)}">${(f.statusText || 'По расписанию').replace(/\n/g,'<br>')}</span></td>
  </tr>`;
}

function renderAll() {
  // Админка
  if (!currentFlights.length) {
    adminList.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">Нет рейсов</p>';
  } else {
    adminList.innerHTML = currentFlights.map(f => `
      <div class="admin-row">
        <div class="admin-row-info">
          <span class="admin-row-number">${f.flightNumber}</span>
          <span class="admin-row-route">${f.destination} (${f.iataCode || ''})</span>
          <span class="status-tag ${getTagClass(f)}" style="font-size:10px;">${(f.statusText || 'По расписанию').replace(/\n/g,' ')}</span>
        </div>
        <div class="admin-row-actions">
          <button class="btn-icon" onclick="event.stopPropagation();editFlight('${f.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="event.stopPropagation();deleteFlight('${f.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }
  
  // Табло — ВСЕ рейсы
  let visible = currentFlights.filter(f => f.status !== 'departed' || showDeparted);
  
  if (visible.length === 0) {
    const empty = `<tr class="empty"><td colspan="6"><div class="empty-msg"><i class="fas fa-plane"></i><p>Нет рейсов</p></div></td></tr>`;
    flightsToday.innerHTML = empty;
    flightsTomorrow.innerHTML = empty;
  } else {
    flightsToday.innerHTML = visible.map(renderFlightRow).join('');
    flightsTomorrow.innerHTML = visible.map(renderFlightRow).join('');
  }
}

window.showDetail = function(id) {
  const f = currentFlights.find(x => x.id === id);
  if (!f) return;
  
  modalTitle.textContent = `Рейс ${f.flightNumber}`;
  
  modalBody.innerHTML = `
    <div class="modal-flight-top">
      <div>
        <div class="modal-flight-num">${f.flightNumber}</div>
        <div class="modal-flight-dest">${f.destination}</div>
        <div class="modal-flight-iata">${f.iataCode || ''}</div>
      </div>
      <span class="status-tag ${getTagClass(f)}" style="font-size:14px;">${(f.statusText || 'По расписанию').replace(/\n/g,'<br>')}</span>
    </div>
    <div class="modal-fs-extra">
      <div class="modal-fs-extra-item"><span class="extra-label">Авиакомпания</span><span class="extra-value">${f.airline || '—'}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Вылет по расписанию</span><span class="extra-value">${fmtDt(f.scheduledDeparture)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Ожидаемый вылет</span><span class="extra-value">${fmtDt(f.expectedDeparture)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Регистрация</span><span class="extra-value">${fmtDt(f.checkInStart)} — ${fmtDt(f.checkInEnd)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Стойки</span><span class="extra-value">${f.checkInCounters || '—'}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Посадка</span><span class="extra-value">${fmtDt(f.boardingStart)} — ${fmtDt(f.boardingEnd)}</span></div>
      <div class="modal-fs-extra-item"><span class="extra-label">Выход</span><span class="extra-value">${f.boardingGate || '—'}</span></div>
    </div>`;

  modalOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
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

toggleDeparted.addEventListener('click', () => {
  showDeparted = !showDeparted;
  toggleDeparted.classList.toggle('active', showDeparted);
  toggleDeparted.innerHTML = showDeparted ? '<i class="fas fa-eye-slash"></i> Скрыть вылетевшие' : '<i class="fas fa-eye"></i> Показать вылетевшие';
  renderAll();
});

$('adminToggle').onclick = () => { adminPanel.style.display = adminPanel.style.display !== 'none' ? 'none' : 'block'; };
$('addFlightBtn').onclick = () => { editingId = null; formTitle.textContent = 'Новый рейс'; $('flightFormInner').reset(); $('flightId').value = ''; $('status').value = 'scheduled'; flightForm.style.display = 'block'; };
$('cancelForm').onclick = () => { flightForm.style.display = 'none'; };

window.editFlight = function(id) {
  const f = currentFlights.find(x => x.id === id);
  if (!f) return;
  editingId = id;
  formTitle.textContent = 'Редактировать рейс';
  $('flightId').value = f.id;
  $('flightNumber').value = f.flightNumber;
  $('airline').value = f.airline;
  $('destination').value = f.destination;
  $('iataCode').value = f.iataCode || '';
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

window.deleteFlight = async function(id) {
  if (!confirm('Удалить рейс?')) return;
  await fetch(`${API}/${id}`, { method:'DELETE' });
  load();
};

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
  await fetch(url, { method: editingId?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  flightForm.style.display = 'none';
  editingId = null;
  load();
};

setInterval(load, 30000);
load();
