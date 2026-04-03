const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');

/* ── Persistence ─────────────────────────────────────────── */
function loadRooms() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      console.log(`Loaded ${Object.keys(data).length} room(s) from ${DATA_FILE}`);
      return data;
    }
  } catch (e) {
    console.error('Failed to load rooms data:', e.message);
  }
  return {};
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      // Only save qc and lv data, not presence
      const toSave = {};
      for (const [rid, room] of Object.entries(rooms)) {
        toSave[rid] = { qc: room.qc || {}, lv: room.lv || {} };
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(toSave), 'utf8');
    } catch (e) {
      console.error('Failed to save rooms data:', e.message);
    }
  }, 2000); // debounce 2 seconds
}

// In-memory store for rooms, loaded from disk
const rooms = loadRooms();

function ensureRoom(r) {
  if (!rooms[r]) rooms[r] = { qc: {}, lv: {}, presence: {} };
  // Ensure presence exists even for rooms loaded from disk
  if (!rooms[r].presence) rooms[r].presence = {};
  return rooms[r];
}

io.on('connection', socket => {
  let joined = null;
  let clientCid = null;

  socket.on('join', ({ room, cid }) => {
    joined = room;
    clientCid = cid || socket.id;
    socket.join(room);
    const r = ensureRoom(room);
    // inform presence
    r.presence[clientCid] = Date.now();
    io.to(room).emit('presence', Object.keys(r.presence).length);
    // send full snapshot
    socket.emit('init', { qc: r.qc, lv: r.lv, presence: Object.keys(r.presence).length });
  });

  socket.on('presence', ({ room, cid }) => {
    const r = ensureRoom(room);
    const key = cid || socket.id;
    r.presence[key] = Date.now();
    io.to(room).emit('presence', Object.keys(r.presence).length);
  });

  socket.on('writeEvent', ({ room, type, dateStr, id, ev }) => {
    const r = ensureRoom(room);
    const store = type === 'qc' ? r.qc : r.lv;
    if (!store[dateStr]) store[dateStr] = {};
    store[dateStr][id] = ev;
    io.to(room).emit('eventAdded', { type, date: dateStr, id, ev });
    scheduleSave();
  });

  socket.on('deleteEvent', ({ room, type, dateStr, id }) => {
    const r = rooms[room];
    if (!r) return;
    const store = type === 'qc' ? r.qc : r.lv;
    if (store && store[dateStr] && store[dateStr][id]) {
      delete store[dateStr][id];
      // cleanup empty date buckets
      if (Object.keys(store[dateStr]).length === 0) delete store[dateStr];
      io.to(room).emit('eventRemoved', { type, date: dateStr, id });
      scheduleSave();
    }
  });

  socket.on('disconnect', () => {
    if (joined) {
      const r = rooms[joined];
      if (r) {
        // remove by clientCid if present
        if (clientCid && r.presence[clientCid]) delete r.presence[clientCid];
        // also try socket.id
        if (r.presence[socket.id]) delete r.presence[socket.id];
        io.to(joined).emit('presence', Object.keys(r.presence).length);
      }
    }
  });
});

// Save on graceful shutdown
process.on('SIGTERM', () => { if (saveTimer) clearTimeout(saveTimer); scheduleSave(); setTimeout(() => process.exit(0), 3000); });
process.on('SIGINT', () => { if (saveTimer) clearTimeout(saveTimer); scheduleSave(); setTimeout(() => process.exit(0), 3000); });

server.listen(PORT, () => console.log(`Socket.IO server listening on http://localhost:${PORT}`));
