const express = require('express');
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, 'data', 'state.json');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function publicState(state) {
  const currentUser = state.users[state.turnIndex] || null;
  return { ...state, currentUserId: currentUser ? currentUser.id : null };
}

app.get('/api/state', (req, res) => {
  res.json(publicState(loadState()));
});

app.post('/api/pick', (req, res) => {
  const { gameId } = req.body;
  const state = loadState();

  if (state.users.length === 0) {
    return res.status(400).json({ error: 'No users configured.' });
  }

  const game = state.games.find((g) => g.id === gameId);
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  if (game.pickedBy !== null) return res.status(400).json({ error: 'Game already picked.' });

  const user = state.users[state.turnIndex];
  game.pickedBy = user.id;
  state.history.push({ type: 'pick', gameId: game.id, turnIndexBefore: state.turnIndex });
  state.turnIndex = (state.turnIndex + 1) % state.users.length;

  saveState(state);
  res.json(publicState(state));
});

app.post('/api/skip', (req, res) => {
  const state = loadState();
  if (state.users.length === 0) {
    return res.status(400).json({ error: 'No users configured.' });
  }
  state.history.push({ type: 'skip', turnIndexBefore: state.turnIndex });
  state.turnIndex = (state.turnIndex + 1) % state.users.length;
  saveState(state);
  res.json(publicState(state));
});

app.post('/api/undo', (req, res) => {
  const state = loadState();
  const last = state.history.pop();
  if (!last) return res.status(400).json({ error: 'Nothing to undo.' });

  if (last.type === 'pick') {
    const game = state.games.find((g) => g.id === last.gameId);
    if (game) game.pickedBy = null;
  }
  state.turnIndex = last.turnIndexBefore;

  saveState(state);
  res.json(publicState(state));
});

app.post('/api/reset', (req, res) => {
  const state = loadState();
  state.games.forEach((g) => { g.pickedBy = null; });
  state.turnIndex = 0;
  state.history = [];
  saveState(state);
  res.json(publicState(state));
});

app.post('/api/users', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });

  const state = loadState();
  const user = { id: state.nextUserId, name: name.trim() };
  state.nextUserId += 1;
  state.users.push(user);
  saveState(state);
  res.json(publicState(state));
});

app.put('/api/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });

  const state = loadState();
  const user = state.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  user.name = name.trim();
  saveState(state);
  res.json(publicState(state));
});

app.delete('/api/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const state = loadState();
  const hasPicks = state.games.some((g) => g.pickedBy === id);
  if (hasPicks) return res.status(400).json({ error: 'Cannot remove a user who has already picked a game.' });

  const idx = state.users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found.' });
  state.users.splice(idx, 1);
  if (state.users.length > 0) state.turnIndex = state.turnIndex % state.users.length;
  else state.turnIndex = 0;
  saveState(state);
  res.json(publicState(state));
});

app.post('/api/games', (req, res) => {
  const { date, opponent, note } = req.body;
  if (!date || !opponent) return res.status(400).json({ error: 'Date and opponent are required.' });

  const state = loadState();
  const nextId = state.games.reduce((max, g) => Math.max(max, g.id), 0) + 1;
  state.games.push({ id: nextId, date, opponent, note: note || '', pickedBy: null });
  state.games.sort((a, b) => a.date.localeCompare(b.date));
  saveState(state);
  res.json(publicState(state));
});

app.put('/api/games/:id', (req, res) => {
  const id = Number(req.params.id);
  const { date, opponent, note } = req.body;

  const state = loadState();
  const game = state.games.find((g) => g.id === id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  if (date) game.date = date;
  if (opponent) game.opponent = opponent;
  if (note !== undefined) game.note = note;
  state.games.sort((a, b) => a.date.localeCompare(b.date));
  saveState(state);
  res.json(publicState(state));
});

app.delete('/api/games/:id', (req, res) => {
  const id = Number(req.params.id);
  const state = loadState();
  const game = state.games.find((g) => g.id === id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  if (game.pickedBy !== null) return res.status(400).json({ error: 'Cannot remove a game that has already been picked.' });

  state.games = state.games.filter((g) => g.id !== id);
  saveState(state);
  res.json(publicState(state));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sens ticket picker running at http://localhost:${PORT}`);
});
