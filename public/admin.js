// ============ ГЛОБАЛЬНЫЕ ============
let flightsDep = [];
let airlinesList = [];
let editingId = null;
let editingAirlineId = null;
let showDepartedAdmin = true; // В админке по умолчанию показываем все
const API = '/api/flights';
const AIRLINES_API = '/api/airlines';
const ADMIN_PASSWORD = 'J6NBVCH71910';

const $ = id => document.getElementById(id);

// ============ АВТОРИЗАЦИЯ ============
const loginOverlay = $('loginOverlay');
const adminContent = $('adminContent');
const loginPassword = $('loginPassword');
const loginBtn = $('loginBtn');
const loginError = $('loginError');

if (sessionStorage.getItem('adminAuth') === 'true') {
  loginOverlay.style.display = 'none';
  adminContent.style.display = 'block';
  initAdmin();
}

function tryLogin() {
  const pass = loginPassword.value;
  if (pass === ADMIN_PASSWORD) {
    sessionStorage.setItem('adminAuth', 'true');
    loginOverlay.style.display = 'none';
    adminContent.style.display = 'block';
    loginError.textContent = '';
    initAdmin();
  } else {
    loginError.textContent = '❌ Неверный пароль. Попробуйте снова.';
    loginPassword.value = '';
    loginPassword.focus();
    const box = document.querySelector('.login-box');
    box.classList.add('shake');
    setTimeout(() => box.classList.remove('shake'), 400);
  }
}

loginBtn.addEventListener('click', tryLogin);
loginPassword.addEventListener('keydown', e => {
  if (e.key === 'Enter') tryLogin();
});

// ============ ИНИЦИАЛИЗАЦИЯ ============
function initAdmin() {
  setupThemeToggle();
  setupTabs();
  setupButtons();
  loadAirportStatus();
  loadAllFlights();
  loadUrgent();
  loadAirlines();
}

// ============ ТЁМНАЯ ТЕМА ============
function setupThemeToggle() {
  const themeToggle = $('themeToggle');
  if (!themeToggle) return;
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

// ============ ФОРМАТИРОВАНИЕ ============
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

// ============ ПЕРЕКЛЮЧЕНИЕ СЕКЦИЙ ============
function setupTabs() {
  document.querySelectorAll('.main-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const section = btn.dataset.section;
      $('section-flights').style.display = section === 'flights' ? '' : 'none';
      $('section-airlines').style.display = section === 'airlines' ? '' : 'none';
      $('section-settings').style.display = section === 'settings' ? '' : 'none';
      if (section === 'flights') loadAllFlights();
      if (section === 'airlines') loadAirlines();
      if (section === 'settings') loadUrgent();
    });
  });
}

// ============ АЭРОПОРТ ============
async function loadAirportStatus() {
  try {
    const r = await fetch('/api/airport-status');
    const data = await r.json();
    if (data.status === 'closed') {
      $('btnAirportClosed').style.display = 'none';
      $('btnAirportOpen').style.display = 'flex';
    } else {
      $('btnAirportOpen').style.display = 'none';
      $('btnAirportClosed').style.display = 'flex';
    }
  } catch(e) {}
}

async function setAirportStatus(status) {
  await fetch('/api/airport-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadAirportStatus();
}

// ============ СРОЧНАЯ ИНФОРМАЦИЯ ============
async function loadUrgent() {
  try {
    const r = await fetch('/api/urgent');
    const data = await r.json();
    if (data.text) {
      $('urgentInput').value = data.text;
      $('btnUrgentDelete').style.display = 'flex';
    } else {
      $('urgentInput').value = '';
      $('btnUrgentDelete').style.display = 'none';
    }
  } catch(e) {}
}

// ============ НАСТРОЙКА КНОПОК ============
function setupButtons() {
  $('btnAirportClosed').addEventListener('click', () => setAirportStatus('closed'));
  $('btnAirportOpen').addEventListener('click', () => setAirportStatus('open'));

  $('btnUrgentSave').addEventListener('click', async () => {
    const text = $('urgentInput').value.trim();
    if (!text) return;
    await fetch('/api/urgent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    loadUrgent();
  });

  $('btnUrgentDelete').addEventListener('click', async () => {
    await fetch('/api/urgent', { method: 'DELETE' });
    loadUrgent();
  });

  $('btnDeleteOldFlights').addEventListener('click', async () => {
    if (!confirm('Удалить прошлые рейсы без статуса «Вылетел»?')) return;
    try {
      const r = await fetch('/api/old-flights', { method: 'DELETE' });
      const data = await r.json();
      alert(`Удалено: ${data.deleted}. Оставлено: ${data.kept}.`);
      loadAllFlights();
    } catch(e) { alert('Ошибка'); }
  });

  $('addFlightDep').addEventListener('click', () => {
    editingId = null;
    $('formTitleDep').textContent = 'Новый рейс';
    $('flightFormInnerDep').reset();
    $('flightIdDep').value = '';
    $('statusDep').value = 'scheduled';
    $('flightFormDep').style.display = 'block';
  });

  $('cancelFormDep').addEventListener('click', () => { $('flightFormDep').style.display = 'none'; });

  $('flightFormInnerDep').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      flightNumber: $('flightNumberDep').value,
      airline: $('airlineDep').value,
      destination: $('destinationDep').value,
      iataCode: $('iataCodeDep').value.toUpperCase(),
      scheduledDeparture: $('scheduledDepartureDep').value ? $('scheduledDepartureDep').value + ':00' : null,
      expectedDeparture: $('expectedDepartureDep').value ? $('expectedDepartureDep').value + ':00' : null,
      checkInStart: $('checkInStartDep').value ? $('checkInStartDep').value + ':00' : null,
      checkInEnd: $('checkInEndDep').value ? $('checkInEndDep').value + ':00' : null,
      checkInCounters: $('checkInCountersDep').value,
      boardingStart: $('boardingStartDep').value ? $('boardingStartDep').value + ':00' : null,
      boardingEnd: $('boardingEndDep').value ? $('boardingEndDep').value + ':00' : null,
      boardingGate: $('boardingGateDep').value,
      status: $('statusDep').value
    };
    const url = editingId ? `${API}/${editingId}?type=departure` : `${API}?type=departure`;
    await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    $('flightFormDep').style.display = 'none';
    editingId = null;
    loadAllFlights();
  });

  $('addAirlineBtn').addEventListener('click', () => {
    editingAirlineId = null;
    $('airlineFormTitle').textContent = 'Новая авиакомпания';
    $('airlineFormInner').reset();
    $('airlineId').value = '';
    $('airlineForm').style.display = 'block';
  });

  $('cancelAirlineForm').addEventListener('click', () => { $('airlineForm').style.display = 'none'; });

  $('airlineFormInner').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: $('airlineName').value.trim(),
      logo: $('airlineLogo').value.trim()
    };
    const url = editingAirlineId ? `${AIRLINES_API}/${editingAirlineId}` : AIRLINES_API;
    await fetch(url, {
      method: editingAirlineId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    $('airlineForm').style.display = 'none';
    editingAirlineId = null;
    loadAirlines();
  });

  // ============ КНОПКА ПОКАЗАТЬ/СКРЫТЬ ВЫЛЕТЕВШИЕ ============
  const toggleBtn = $('toggleDepartedAdmin');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      showDepartedAdmin = !showDepartedAdmin;
      toggleBtn.classList.toggle('active', !showDepartedAdmin);
      toggleBtn.innerHTML = showDepartedAdmin
        ? '<i class="fas fa-eye-slash"></i> Скрыть вылетевшие'
        : '<i class="fas fa-eye"></i> Показать вылетевшие';
      renderAdminFlightsList();
    });
  }
}

// ============ РЕЙСЫ ============
async function loadAllFlights() {
  try {
    const r = await fetch(`${API}?type=departure&showDeparted=true`);
    flightsDep = await r.json();
    renderAdminFlightsList();
  } catch (e) { console.log(e); }
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

function renderAdminFlightsList() {
  const list = $('adminFlightsListDep');
  const filtered = showDepartedAdmin
    ? flightsDep
    : flightsDep.filter(f => f.status !== 'departed' && f.status !== 'early_departed');

  if (!filtered.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">Нет рейсов</p>';
    return;
  }
  list.innerHTML = filtered.map(f => `
    <div class="admin-row">
      <div class="admin-row-info">
        <span class="admin-row-number">${f.flightNumber}</span>
        <span class="admin-row-route">${f.destination} (${f.iataCode || ''})</span>
        <span class="admin-row-route">${f.airline}</span>
        <span class="admin-row-route">${fmtDt(f.scheduledDeparture)}</span>
        <span class="status-tag ${getTagClass(f)}" style="font-size:10px;">${(f.statusText || '').replace(/\n/g,' ')}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn-icon" onclick="editFlightDep('${f.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="deleteFlightDep('${f.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

window.editFlightDep = function(id) {
  const f = flightsDep.find(x => x.id === id);
  if (!f) return;
  editingId = id;
  $('formTitleDep').textContent = 'Редактировать рейс';
  $('flightIdDep').value = f.id;
  $('flightNumberDep').value = f.flightNumber;
  $('airlineDep').value = f.airline;
  $('destinationDep').value = f.destination;
  $('iataCodeDep').value = f.iataCode || '';
  $('scheduledDepartureDep').value = f.scheduledDeparture ? f.scheduledDeparture.slice(0, 16) : '';
  $('expectedDepartureDep').value = f.expectedDeparture ? f.expectedDeparture.slice(0, 16) : '';
  $('checkInStartDep').value = f.checkInStart ? f.checkInStart.slice(0, 16) : '';
  $('checkInEndDep').value = f.checkInEnd ? f.checkInEnd.slice(0, 16) : '';
  $('checkInCountersDep').value = f.checkInCounters || '';
  $('boardingStartDep').value = f.boardingStart ? f.boardingStart.slice(0, 16) : '';
  $('boardingEndDep').value = f.boardingEnd ? f.boardingEnd.slice(0, 16) : '';
  $('boardingGateDep').value = f.boardingGate || '';
  $('statusDep').value = f.status;
  $('flightFormDep').style.display = 'block';
  $('flightFormDep').scrollIntoView({ behavior: 'smooth' });
};

window.deleteFlightDep = async function(id) {
  if (!confirm('Удалить рейс?')) return;
  await fetch(`${API}/${id}?type=departure`, { method: 'DELETE' });
  loadAllFlights();
};

// ============ АВИАКОМПАНИИ ============
async function loadAirlines() {
  try {
    const r = await fetch(AIRLINES_API);
    airlinesList = await r.json();
    renderAirlinesList();
    renderAirlineSelects();
  } catch (e) { airlinesList = []; }
}

function renderAirlinesList() {
  const list = $('airlinesList');
  if (!airlinesList.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">Нет авиакомпаний</p>';
    return;
  }
  list.innerHTML = airlinesList.map(a => `
    <div class="admin-row">
      <div class="admin-row-info">
        ${a.logo ? `<img src="${a.logo}" alt="${a.name}" class="airline-logo-preview" onerror="this.style.display='none'">` : ''}
        <span class="admin-row-number">${a.name}</span>
        <span class="admin-row-route" style="font-size:12px;color:var(--gray-400);word-break:break-all;">${a.logo || '—'}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn-icon" onclick="editAirline('${a.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="deleteAirline('${a.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function renderAirlineSelects() {
  const options = airlinesList.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
  $('airlineDep').innerHTML = '<option value="">— Выберите —</option>' + options;
}

window.editAirline = function(id) {
  const a = airlinesList.find(x => x.id === id);
  if (!a) return;
  editingAirlineId = id;
  $('airlineFormTitle').textContent = 'Редактировать авиакомпанию';
  $('airlineId').value = a.id;
  $('airlineName').value = a.name;
  $('airlineLogo').value = a.logo || '';
  $('airlineForm').style.display = 'block';
  $('airlineForm').scrollIntoView({ behavior: 'smooth' });
};

window.deleteAirline = async function(id) {
  if (!confirm('Удалить авиакомпанию?')) return;
  await fetch(`${AIRLINES_API}/${id}`, { method: 'DELETE' });
  loadAirlines();
};
