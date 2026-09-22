/**
 * Cliente da API SalaFácil (SPEC-002 §6).
 * NFR-S11: o DOM é montado com createElement/textContent — `innerHTML` é proibido.
 */

const state = { token: null, user: null, rooms: [] };

const el = (id) => document.getElementById(id);

function say(text, isError = false) {
  const node = el('message');
  node.textContent = text;
  node.className = isError ? 'error' : 'ok';
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = payload && payload.error ? payload.error : { message: 'Falha na requisição' };
    const details = Array.isArray(error.details) && error.details.length > 0 ? ` (${error.details.join('; ')})` : '';
    throw new Error(`${error.message}${details}`);
  }
  return payload;
}

/** O campus opera em America/Sao_Paulo (BR-5); o backend exige ISO com fuso. */
function toIsoUtc(date, time) {
  const local = new Date(`${date}T${time}:00-03:00`);
  return local.toISOString();
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fillRoomSelects() {
  for (const id of ['room', 'filter-room']) {
    const select = el(id);
    select.replaceChildren();
    if (id === 'filter-room') {
      const any = document.createElement('option');
      any.value = '';
      any.textContent = 'Todas';
      select.append(any);
    }
    for (const room of state.rooms) {
      const option = document.createElement('option');
      option.value = room.id;
      option.textContent = `${room.code} — ${room.name} (${room.capacity} lugares)`;
      select.append(option);
    }
  }
}

function renderAgenda(reservations) {
  const body = el('agenda').querySelector('tbody');
  body.replaceChildren();
  if (reservations.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'Nenhuma reserva para o filtro selecionado.';
    row.append(cell);
    body.append(row);
    return;
  }
  for (const item of reservations) {
    const row = document.createElement('tr');
    const cells = [
      item.room.code,
      formatTime(item.startsAt),
      formatTime(item.endsAt),
      item.purpose,
      item.user.name,
    ];
    for (const value of cells) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const actions = document.createElement('td');
    if (state.user.role === 'ADMIN' || item.userId === state.user.id) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Cancelar';
      button.addEventListener('click', () => cancelReservation(item.id));
      actions.append(button);
    }
    row.append(actions);
    body.append(row);
  }
}

async function loadRooms() {
  const payload = await api('/api/rooms');
  state.rooms = payload.data;
  fillRoomSelects();
}

async function loadAgenda() {
  const params = new URLSearchParams();
  const roomId = el('filter-room').value;
  const date = el('filter-date').value;
  if (roomId) params.set('roomId', roomId);
  if (date) params.set('date', date);
  const payload = await api(`/api/reservations?${params.toString()}`);
  renderAgenda(payload.data);
}

async function cancelReservation(id) {
  try {
    await api(`/api/reservations/${id}/cancel`, { method: 'PATCH' });
    say('Reserva cancelada.');
    await loadAgenda();
  } catch (error) {
    say(error.message, true);
  }
}

el('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: el('email').value, password: el('password').value }),
    });
    state.token = payload.token;
    state.user = payload.user;
    el('session').textContent = `${payload.user.name} (${payload.user.role})`;
    el('login-view').hidden = true;
    el('app-view').hidden = false;
    el('logout').hidden = false;
    const today = new Date().toISOString().slice(0, 10);
    el('date').value = today;
    el('filter-date').value = today;
    await loadRooms();
    await loadAgenda();
    say('Autenticado.');
  } catch (error) {
    say(error.message, true);
  }
});

el('reservation-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const date = el('date').value;
    await api('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        roomId: el('room').value,
        purpose: el('purpose').value,
        startsAt: toIsoUtc(date, el('start').value),
        endsAt: toIsoUtc(date, el('end').value),
      }),
    });
    say('Reserva confirmada.');
    el('filter-date').value = date;
    await loadAgenda();
  } catch (error) {
    say(error.message, true);
  }
});

el('refresh').addEventListener('click', () => {
  loadAgenda().catch((error) => say(error.message, true));
});

el('logout').addEventListener('click', () => {
  state.token = null;
  state.user = null;
  el('app-view').hidden = true;
  el('logout').hidden = true;
  el('login-view').hidden = false;
  el('session').textContent = 'não autenticado';
  say('Sessão encerrada.');
});
