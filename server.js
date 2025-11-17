// server.js
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Increase buffer size to allow large base64 uploads (adjust as needed)
const io = new Server(server, {
  maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve front-end static files from ./public
app.use(express.static(path.join(__dirname, "public")));

// In-memory stores (swap for DB in production)
const usersByName = {};   // { username: { socketId, online, lastSeen } }
const socketIdToUser = {}; // { socketId: username }
const history = {};       // { convId: [ { from, to, type, message, media, time } ] }
// convId = sorted "userA|userB" string

function convId(a, b) {
  return [a, b].sort().join("|");
}

function broadcastUserList() {
  const list = Object.keys(usersByName).map((u) => ({
    username: u,
    online: usersByName[u].online,
    lastSeen: usersByName[u].lastSeen || null
  }));
  io.emit("userList", list);
}

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // register event from client with username
  socket.on("register", (username) => {
    if (!username) return;
    usersByName[username] = usersByName[username] || {};
    usersByName[username].socketId = socket.id;
    usersByName[username].online = true;
    usersByName[username].lastSeen = new Date().toLocaleString();
    socketIdToUser[socket.id] = username;

    // Broadcast updated user list
    broadcastUserList();
    console.log("registered:", username);
  });

  // Client asks for fresh user list
  socket.on("requestUserList", () => {
    broadcastUserList();
  });

  // getHistory: send conversation history (between requester and target)
  socket.on("getHistory", (otherUser) => {
    const fromUser = socketIdToUser[socket.id];
    if (!fromUser || !otherUser) return;

    const id = convId(fromUser, otherUser);
    const msgs = history[id] || [];
    // send to requester only
    socket.emit("chatHistory", msgs);
  });

  // PRIVATE MESSAGE — supports text + media
  socket.on("privateMessage", (data) => {
    try {
      // data = { to, message, type, media }
      const from = socketIdToUser[socket.id];
      if (!from) return;

      const payload = {
        from,
        to: data.to,
        time: new Date().toLocaleTimeString(),
        type: data.type || "text",
        message: data.message || "",
        media: data.media || null
      };

      // save to history
      const id = convId(from, data.to);
      history[id] = history[id] || [];
      history[id].push(payload);

      // deliver to recipient if online
      const dest = usersByName[data.to];
      if (dest && dest.socketId) {
        io.to(dest.socketId).emit("receiveMessage", payload);
      } else {
        // recipient offline: optionally store for push later
      }

      // confirm to sender
      socket.emit("messageSent", payload);

      // update user list (to reflect any lastSeen change)
      broadcastUserList();

    } catch (err) {
      console.error("privateMessage error:", err);
    }
  });

  // handle disconnect
  socket.on("disconnect", () => {
    const username = socketIdToUser[socket.id];
    if (username && usersByName[username]) {
      usersByName[username].online = false;
      usersByName[username].lastSeen = new Date().toLocaleString();
      delete socketIdToUser[socket.id];
      console.log("user disconnected:", username);
      broadcastUserList();
    } else {
      console.log("socket disconnected:", socket.id);
    }
  });
});

// start server
const PORT = 9179;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
