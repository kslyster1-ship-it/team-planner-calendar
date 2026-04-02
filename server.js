const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

const PORT = process.env.PORT || 3000;

// In-memory store for rooms
const rooms = {}; // { roomId: { qc: {date:{id:ev}}, lv: {...}, presence: {cid: ts} } }

function ensureRoom(r) {
  if (!rooms[r]) rooms[r] = { qc: {}, lv: {}, presence: {} };
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

server.listen(PORT, () => console.log(`Socket.IO server listening on http://localhost:${PORT}`));
