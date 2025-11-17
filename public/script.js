// --- login gate ---
let username = null;
while (!username || username.trim() === "") {
  username = prompt("Enter your name:");
}
username = username.trim();

const socket = io();
let allUserData = {};

socket.emit("register", username);
document.getElementById("username").textContent = username;

const bell = document.getElementById("bell");
const count = document.getElementById("count");
const notifications = document.getElementById("notifications");
const usersList = document.getElementById("users");

const chatHeader = document.getElementById("chatHeader");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");
const scheduleTime = document.getElementById("scheduleTime");
scheduleTime.setAttribute("step", "60");
const scheduleChat = document.getElementById("scheduleChat");
const usernameLabel = document.getElementById("username");

const emojiBtn = document.getElementById("emojiBtn");
const imageInput = document.getElementById("imageInput");
const imageBtn = document.getElementById("imageBtn");
const gifInput = document.getElementById("gifInput");
const gifBtn = document.getElementById("gifBtn");
const videoInput = document.getElementById("videoInput");
const videoBtn = document.getElementById("videoBtn");

let unread = 0;
let notifArray = [];
let currentChatUser = null;
let messageCounters = {};
let themeBgColor = "#f2f4f8";

// Now load saved data
loadState();
renderNotifications();

sendChat.disabled = true;
scheduleChat.disabled = true;
scheduleTime.disabled = true;

// Bell dropdown logic
bell.onclick = (e) => {
  e.stopPropagation();
  const open = notifications.style.display === "block";
  notifications.style.display = open ? "none" : "block";
  if (!open) {
    renderNotifications();
    unread = 0;
    count.style.display = "none";
    saveState();
  }
};

document.addEventListener("click", (e) => {
  if (!bell.contains(e.target) && !notifications.contains(e.target))
    notifications.style.display = "none";
  if (!usernameLabel.contains(e.target) && document.getElementById("userPanel"))
    document.getElementById("userPanel").remove();
});

function renderNotifications() {
  notifications.innerHTML = "";
  notifArray.forEach(n => {
    const div = document.createElement("div");
    div.classList.add("message");
    div.innerHTML = `<strong>${n.from}</strong><p>${n.message}</p><small>${n.time}</small>`;
    notifications.appendChild(div);
  });
}

// ---------------- USER LIST ----------------
socket.on("userList", (list) => {
  usersList.innerHTML = "";
  allUserData = {};
  list.forEach(u => allUserData[u.username] = u);
  list
    .filter(u => u.username !== username)
    .forEach(userObj => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = userObj.username;
      li.appendChild(span);
      if (userObj.online) {
        const status = document.createElement("small");
        status.textContent = "Online";
        status.style.marginLeft = "8px";
        status.style.color = "#4caf50";
        li.appendChild(status);
      }
      if (messageCounters[userObj.username] > 0) {
        const badge = document.createElement("span");
        badge.classList.add("msg-badge");
        badge.textContent = messageCounters[userObj.username];
        li.appendChild(badge);
      }
      li.onclick = () => openChat(userObj.username);
      usersList.appendChild(li);
    });
});

// ---------------- OPEN CHAT ----------------
function openChat(user) {
  currentChatUser = user;
  chatMessages.innerHTML = "";
  chatInput.disabled = false;
  sendChat.disabled = false;
  scheduleChat.disabled = false;
  scheduleTime.disabled = false;
  messageCounters[user] = 0;
  saveState();
  socket.emit("requestUserList");
  socket.emit("getHistory", user);
  const info = allUserData[user];
  const status =
    info ? (info.online ? "Online" : `Last seen: ${info.lastSeen}`) : "";
  chatHeader.innerHTML = `
    Chat with ${user}
    <div style="font-size:12px;color:#ccc;margin-top:4px;">${status}</div>
  `;
}

// ---------------- HISTORY ----------------
socket.on("chatHistory", (list) => {
  chatMessages.innerHTML = "";
  list.forEach(msg => {
    addMessage(
      msg.from,
      msg.type === "media" ? msg.media : msg.message,
      msg.from === username,
      msg.time,
      msg.type
    );
  });
});

// ---------------- SEND TEXT ----------------

// FIX #1: Always use `type: "text"` for text and emoji
function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg || !currentChatUser) return;
  socket.emit("privateMessage", {
    to: currentChatUser,
    message: msg,     // ensure not null
    type: "text"      // force type to "text" for emoji and normal text
  });
  chatInput.value = "";
}
sendChat.onclick = sendMessage;

chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ---------------- ADD MESSAGE IN UI ----------------

function addMessage(sender, content, isMe = false, time = "", type = "text") {
  const row = document.createElement("div");
  row.classList.add("message-row");
  if (isMe) row.classList.add("me");
  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble");
  // FIX #2: Clean rendering, prevent null content
  if (type === "image" || type === "gif") {
    bubble.innerHTML = `<img src="${content}" style="max-width:180px;border-radius:8px;"><br><small>${time}</small>`;
  } else if (type === "video") {
    bubble.innerHTML = `<video controls style="max-width:180px;"><source src="${content}"></video><br><small>${time}</small>`;
  } else {
    bubble.innerHTML = `<p>${content ? content : ""}</p><small>${time}</small>`;
  }
  row.appendChild(bubble);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ---------------- RECEIVE ----------------

socket.on("receiveMessage", (data) => {
  const { from, message, time, type, media } = data;
  // FIX #3: Defensive logic—prefer .media for media-type, .message otherwise
  let msgContent = (type === "image" || type === "gif" || type === "video") ? media : message;
  if (from === currentChatUser) {
    addMessage(from, msgContent, false, time, type);
  } else {
    messageCounters[from] = (messageCounters[from] || 0) + 1;
    unread++;
    count.style.display = "inline";
    count.textContent = unread;
    notifArray.push({
      from,
      message: (type === "image" || type === "gif" || type === "video") ? "[Media]" : message,
      time
    });
  }
  saveState();
  socket.emit("requestUserList");
});

// ---------------- SERVER CONFIRMS ----------------

socket.on("messageSent", ({ to, message, time, type, media }) => {
  let msgContent = (type === "image" || type === "gif" || type === "video") ? media : message;
  if (to === currentChatUser) {
    addMessage(username, msgContent, true, time, type);
  }
  saveState();
});

// ---------------- THEME LOGIC (unchanged) ----------------
function getContrastColor(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#FFFFFF";
}

// ---------------- OPTIONS PANEL (unchanged) ----------------
usernameLabel.onclick = () => {};

// ---------------- LOCAL STORAGE ----------------
function saveState() {
  localStorage.setItem(`msgCounters_${username}`, JSON.stringify(messageCounters));
  localStorage.setItem(`notifArray_${username}`, JSON.stringify(notifArray));
  localStorage.setItem(`unreadCount_${username}`, unread);
}
function loadState() {
  messageCounters = JSON.parse(localStorage.getItem(`msgCounters_${username}`)) || {};
  notifArray = JSON.parse(localStorage.getItem(`notifArray_${username}`)) || [];
  unread = parseInt(localStorage.getItem(`unreadCount_${username}`)) || 0;
  if (unread > 0) {
    count.textContent = unread;
    count.style.display = "inline";
  }
}

// ---------------- SCHEDULE ----------------
scheduleChat.addEventListener("click", () => {
  const msg = chatInput.value.trim();
  const t = scheduleTime.value;
  if (!msg || !currentChatUser) return alert("Select a user and enter a message.");
  if (!t) return alert("Select a time.");
  const [h, m] = t.split(":");
  const now = new Date();
  const tgt = new Date();
  tgt.setHours(h, m, 0, 0);
  if (tgt < now) return alert("Time must be future today.");
  const delay = tgt - now;
  const display = tgt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  alert(`Message scheduled at ${display}`);
  setTimeout(() => {
    socket.emit("privateMessage", { to: currentChatUser, message: msg, type: "text" });
    addMessage(username, `[Scheduled @${display}] ${msg}`, true, display);
  }, delay);
});

// ======================================================
//    EMOJI PICKER + IMAGE + GIF + VIDEO UPLOADS
// ======================================================

emojiBtn.onclick = (e) => {
  e.stopPropagation();
  // Prevent duplicate picker
  if (document.getElementById('emojiPickerPanel')) return;
  const emojiList = ["😀", "😁", "😂", "🤣", "😅", "😊", "😍", "😎", "😡", "👍", "🙏", "✨", "🔥", "❤️"];
  const picker = document.createElement("div");
  picker.id = 'emojiPickerPanel';
  picker.style.position = "absolute";
  picker.style.bottom = "80px";
  picker.style.left = "10px";
  picker.style.background = "#fff";
  picker.style.border = "1px solid #ccc";
  picker.style.padding = "10px";
  picker.style.borderRadius = "8px";
  picker.style.display = "grid";
  picker.style.gridTemplateColumns = "repeat(5, 30px)";
  picker.style.gap = "6px";
  picker.style.zIndex = 1000;
  emojiList.forEach(e => {
    const btn = document.createElement("div");
    btn.textContent = e;
    btn.style.fontSize = "24px";
    btn.style.cursor = "pointer";
    btn.onclick = () => {
      chatInput.value += e;
      picker.remove();
    };
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);

  // Remove picker if clicking elsewhere
  document.addEventListener("click", ev => {
    if (!picker.contains(ev.target)) picker.remove();
  }, { once: true });
};


// --- MEDIA INPUT BUTTONS ---
imageBtn.onclick = () => imageInput.click();
videoBtn.onclick = () => videoInput.click();
gifBtn.onclick = () => gifInput.click();

// --- FILE READERS ---
imageInput.onchange = () => readMediaFile(imageInput, "image");
videoInput.onchange = () => readMediaFile(videoInput, "video");
gifInput.onchange = () => readMediaFile(gifInput, "gif");

function readMediaFile(input, type) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => sendMedia(type, reader.result);
  reader.readAsDataURL(file);
}

function sendMedia(type, mediaURL) {
  if (!currentChatUser) return alert("Select a user first.");
  socket.emit("privateMessage", {
    to: currentChatUser,
    type,
    media: mediaURL
  });
  addMessage(username, mediaURL, true, new Date().toLocaleTimeString(), type);
}
