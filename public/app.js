const calendar = document.getElementById('calendar');
const turnBanner = document.getElementById('turn-banner');
const userList = document.getElementById('user-list');
const userSummary = document.getElementById('user-summary');
const filterBar = document.getElementById('filter-bar');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

let calendarFilter = 'all';
let lastState = null;

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

function shortDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildSummaryCard({ title, countText, games, emptyText, variant }) {
  const card = document.createElement('div');
  card.className = `summary-card${variant ? ` summary-card-${variant}` : ''}`;

  const heading = document.createElement('h3');
  heading.textContent = title;
  card.appendChild(heading);

  const countLine = document.createElement('div');
  countLine.className = 'summary-count';
  countLine.textContent = countText;
  card.appendChild(countLine);

  if (games.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'summary-empty';
    empty.textContent = emptyText;
    card.appendChild(empty);
  } else {
    const list = document.createElement('ul');
    list.className = 'summary-games';
    games.forEach((g) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>vs ${g.opponent}</span><span class="summary-date">${shortDate(g.date)}</span>`;
      list.appendChild(li);
    });
    card.appendChild(list);
  }

  return card;
}

function renderSummary(state) {
  userSummary.innerHTML = '';

  state.users.forEach((u) => {
    const userGames = state.games
      .filter((g) => g.pickedBy === u.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const countText = typeof u.maxGames === 'number'
      ? `${u.pickedCount} of ${u.maxGames} tickets`
      : `${u.pickedCount} ticket${u.pickedCount === 1 ? '' : 's'}`;

    userSummary.appendChild(buildSummaryCard({
      title: u.name,
      countText,
      games: userGames,
      emptyText: 'No games picked yet.',
    }));
  });

  const remainingGames = state.games
    .filter((g) => g.pickedBy === null)
    .sort((a, b) => a.date.localeCompare(b.date));

  userSummary.appendChild(buildSummaryCard({
    title: 'Remaining',
    countText: `${remainingGames.length} ticket${remainingGames.length === 1 ? '' : 's'} unclaimed`,
    games: remainingGames,
    emptyText: 'All games have been picked.',
    variant: 'remaining',
  }));
}

function render(state) {
  lastState = state;
  const usersById = Object.fromEntries(state.users.map((u) => [u.id, u]));

  if (state.users.length === 0) {
    turnBanner.textContent = 'Add players to begin.';
  } else if (state.draftComplete) {
    turnBanner.textContent = 'All players have picked their full allotment!';
  } else {
    const current = state.users[state.turnIndex];
    turnBanner.textContent = `Current turn: ${current.name}`;
  }

  calendar.innerHTML = '';

  const games = [...state.games]
    .filter((g) => {
      if (calendarFilter === 'unselected') return g.pickedBy === null;
      if (calendarFilter === 'selected') return g.pickedBy !== null;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (games.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'calendar-empty';
    empty.textContent = calendarFilter === 'unselected'
      ? 'No games left to pick — everything has been claimed.'
      : 'No games have been picked yet.';
    calendar.appendChild(empty);
  }

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
    const canPick = !picker && state.users.length > 0 && !state.draftComplete;

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
    } else if (picker) {
      const btn = document.createElement('button');
      btn.textContent = 'Deselect';
      btn.className = 'secondary';
      btn.addEventListener('click', () => unpickGame(game.id, picker.name));
      tile.querySelector('.tile-body').appendChild(btn);
    }

    monthGrid.appendChild(tile);
  });

  userList.innerHTML = '';
  state.users.forEach((u, idx) => {
    const li = document.createElement('li');
    if (idx === state.turnIndex && !state.draftComplete) li.classList.add('active');

    const countText = typeof u.maxGames === 'number'
      ? `${u.pickedCount}/${u.maxGames} tickets`
      : `${u.pickedCount} tickets`;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${u.name} `;

    const countSpan = document.createElement('span');
    countSpan.className = 'ticket-count';
    countSpan.textContent = `(${countText})`;

    li.appendChild(nameSpan);
    li.appendChild(countSpan);

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'rename';
    renameBtn.className = 'rename-btn';
    renameBtn.addEventListener('click', () => renameUser(u.id, u.name));
    li.appendChild(renameBtn);

    const limitBtn = document.createElement('button');
    limitBtn.textContent = 'limit';
    limitBtn.className = 'rename-btn';
    limitBtn.addEventListener('click', () => editLimit(u.id, u.maxGames));
    li.appendChild(limitBtn);

    userList.appendChild(li);
  });

  renderSummary(state);
}

async function refresh() {
  const state = await api('/api/state');
  render(state);
}

async function pickGame(gameId) {
  const state = await api('/api/pick', { method: 'POST', body: JSON.stringify({ gameId }) });
  render(state);
}

async function unpickGame(gameId, ownerName) {
  if (!confirm(`Put this game back to available? ${ownerName} will pick next.`)) return;
  const state = await api(`/api/games/${gameId}/unpick`, { method: 'POST' });
  render(state);
}

async function renameUser(id, currentName) {
  const name = prompt('New name:', currentName);
  if (!name || !name.trim() || name === currentName) return;
  const state = await api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
  render(state);
}

async function editLimit(id, currentMax) {
  const input = prompt('Max games for this player (blank = unlimited):', currentMax === null || currentMax === undefined ? '' : currentMax);
  if (input === null) return;
  const maxGames = input.trim() === '' ? null : Number(input);
  if (maxGames !== null && (Number.isNaN(maxGames) || maxGames < 0)) {
    alert('Enter a whole number of games, or leave blank for unlimited.');
    return;
  }
  const state = await api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ maxGames }) });
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

filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  calendarFilter = btn.dataset.filter;
  filterBar.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
  if (lastState) render(lastState);
});

refresh();
