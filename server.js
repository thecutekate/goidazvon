const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 50 * 1024 * 1024,
  pingTimeout: 30000,
  pingInterval: 60000
});

app.use(express.static(path.join(__dirname, 'public')));

const messages = new Map();
const typingTimers = new Map();

const clearTimer = (nick) => {
  if (typingTimers.has(nick)) {
    clearTimeout(typingTimers.get(nick));
    typingTimers.delete(nick);
  }
};

io.on('connection', (socket) => {
  console.log('Пользователь подключился');
  
  socket.emit('history', Array.from(messages.values()).slice(-100));

  socket.on('typing-start', (user) => {
    socket.broadcast.emit('user-typing', user);
    clearTimer(user.nick);
    typingTimers.set(user.nick, setTimeout(() => {
      socket.broadcast.emit('typing-stop', user.nick);
    }, 3000));
  });

  socket.on('typing-stop', (nick) => {
    socket.broadcast.emit('typing-stop', nick);
    clearTimer(nick);
  });

  socket.on('msg', (msg) => {
    if (msg.nick.length > 42 || (msg.text && msg.text.length > 5000)) {
      console.log('Некорректное сообщение:', msg.nick.length > 42 ? 'длинный ник' : 'длинное сообщение');
      return;
    }
    
    if (msg.file && msg.file.size > 15 * 1024 * 1024) {
      console.log('Файл слишком большой:', msg.file.name, msg.file.size);
      return;
    }

    if (messages.size > 1000) {
      messages.delete(messages.keys().next().value);
    }
    
    messages.set(msg.id, msg);
    io.emit('msg', msg);
  });

  socket.on('delete-msg', ({ id, user }) => {
    const msg = messages.get(id);
    if (msg && msg.nick === user.nick && msg.avatar === user.avatar) {
      messages.delete(id);
      io.emit('delete-msg', id);
    }
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился');
    typingTimers.forEach(timer => clearTimeout(timer));
    typingTimers.clear();
  });
});

app.get('/tenor-proxy', async (req, res) => {
  try {
    const { q } = req.query;
    const endpoint = q ? 'search' : 'featured';
    const params = q ? `q=${encodeURIComponent(q)}` : '';
    const url = `https://tenor.googleapis.com/v2/${endpoint}?${params}&key=${process.env.TENOR_KEY}`;
    
    const response = await fetch(url);
    res.json(await response.json());
  } catch (error) {
    res.status(500).json({ error: 'Tenor API error' });
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`GOIDAZVON слушает на http://localhost:${process.env.PORT || 3000}`);
});