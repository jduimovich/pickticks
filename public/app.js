const calendar = document.getElementById('calendar');
const turnBanner = document.getElementById('turn-banner');
const userList = document.getElementById('user-list');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) {
    alert(body.error || 'Something went wrong.');
    throw new Error(body.error);
  }
  return body;
}

function dateParts(iso) {
  const d = new Date(iso + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
    day: d.getDate(),
    monthIndex: d.getMonth(),
    year: d.getFullYear(),
  };
}

function render(state) {
  const usersById = Object.fromEntries(state.users.map((u) => [u.id, u]));

  if (state.users.length === 0) {
    turnBanner.textContent = 'Add players to begin.';
  } else {
    const current = state.users[state.turnIndex];
    turnBanner.textContent = `Current turn: ${current.name}`;
  }

  calendar.innerHTML = '';

  const games = [...state.games].sort((a, b) => a.date.localeCompare(b.date));
  let currentMonthKey = null;
  let monthGrid = null;

  games.forEach((game) => {
    const parts = dateParts(game.date);
    const monthKey = `${parts.year}-${parts.monthIndex}`;

    if (monthKey !== currentMonthKey) {
      currentMonthKey = monthKey;
      const monthSection = document.createElement('section');
      monthSection.className = 'month-group';

      const heading = document.createElement('h2');
      heading.className = 'month-heading';
      heading.textContent = `${MONTH_NAMES[parts.monthIndex]} ${parts.year}`;
      monthSection.appendChild(heading);

      monthGrid = document.createElement('div');
      monthGrid.className = 'month-grid';
      monthSection.appendChild(monthGrid);

      calendar.appendChild(monthSection);
    }

    const picker = game.pickedBy !== null ? usersById[game.pickedBy] : null;
    const canPick = !picker && state.users.length > 0;

    const tile = document.createElement('div');
    tile.className = `game-tile ${picker ? 'picked' : 'available'}`;

    tile.innerHTML = `
      <div class="tile-date">
        <span class="tile-weekday">${parts.weekday}</span>
        <span class="tile-day">${parts.day}</span>
      </div>
      <div class="tile-body">
        <div class="tile-opponent">vs ${game.opponent}</div>
        ${game.note ? `<div class="tile-note">${game.note}</div>` : ''}
        <div class="tile-status">${picker ? `Picked by ${picker.name}` : 'Available'}</div>
      </div>
    `;

    if (canPick) {
      const btn = document.createElement('button');
      btn.textContent = `Pick for ${state.users[state.turnIndex].name}`;
      btn.addEventListener('click', () => pickGame(game.id));
      tile.querySelector('.tile-body').appendChild(btn);
    }

    monthGrid.appendChild(tile);
  });

  userList.innerHTML = '';
  state.users.forEach((u, idx) => {
    const li = document.createElement('li');
    if (idx === state.turnIndex) li.classList.add('active');
    li.textContent = u.name;

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'rename';
    renameBtn.className = 'rename-btn';
    renameBtn.addEventListener('click', () => renameUser(u.id, u.name));
    li.appendChild(renameBtn);

    userList.appendChild(li);
  });
}

async function refresh() {
  const state = await api('/api/state');
  render(state);
}

async function pickGame(gameId) {
  const state = await api('/api/pick', { method: 'POST', body: JSON.stringify({ gameId }) });
  render(state);
}

async function renameUser(id, currentName) {
  const name = prompt('New name:', currentName);
  if (!name || !name.trim() || name === currentName) return;
  const state = await api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
  render(state);
}

document.getElementById('add-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('new-user-name');
  if (!input.value.trim()) return;
  const state = await api('/api/users', { method: 'POST', body: JSON.stringify({ name: input.value }) });
  input.value = '';
  render(state);
});

document.getElementById('add-game-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('new-game-date').value;
  const opponent = document.getElementById('new-game-opponent').value;
  const note = document.getElementById('new-game-note').value;
  if (!date || !opponent.trim()) return;
  const state = await api('/api/games', { method: 'POST', body: JSON.stringify({ date, opponent, note }) });
  document.getElementById('new-game-date').value = '';
  document.getElementById('new-game-opponent').value = '';
  document.getElementById('new-game-note').value = '';
  render(state);
});

document.getElementById('skip-btn').addEventListener('click', async () => {
  const state = await api('/api/skip', { method: 'POST' });
  render(state);
});

document.getElementById('undo-btn').addEventListener('click', async () => {
  const state = await api('/api/undo', { method: 'POST' });
  render(state);
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  if (!confirm('Reset ALL picks? This cannot be undone.')) return;
  const state = await api('/api/reset', { method: 'POST' });
  render(state);
});

refresh();
