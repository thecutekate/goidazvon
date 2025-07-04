const socket = io();

let me = {
  nick: 'Гость',
  avatar: 'https://cdn.glitch.global/64f67462-f466-4742-90e0-22674fa7d85b/225-default-avatar.png?v=1750874399111'
};

// Load profile
const saved = localStorage.getItem('goidazvon-profile');
if (saved) try { me = JSON.parse(saved); } catch (e) {}

// Elements
const $ = id => document.getElementById(id);
const [msgsEl, form, msgInput, fileInput, filePreview, fileNameEl, cancelFileBtn, avatarImg, avatarInput, nickInput, typingIndicator, gifBtn, gifPanel, gifSearch, gifSearchBtn, gifResults, progressBar] = 
  ['messages', 'send-form', 'msg-input', 'file-input', 'file-preview', 'file-name', 'cancel-file', 'avatar-img', 'avatar-input', 'nickname-input', 'typing-indicator', 'gif-btn', 'gif-panel', 'gif-search', 'gif-search-btn', 'gif-results', 'upload-progress'].map($);

// Initialize GIF module
let gifModule;

// Restore profile
avatarImg.src = me.avatar;
nickInput.value = me.nick;

// Save profile
const saveProfile = () => {
  me.nick = nickInput.value.trim() || 'Гость';
  me.avatar = avatarImg.src;
  localStorage.setItem('goidazvon-profile', JSON.stringify(me));
};

$('save-profile').onclick = saveProfile;

// Avatar handling
avatarImg.onclick = () => avatarInput.click();
avatarInput.onchange = () => {
  const file = avatarInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    avatarImg.src = me.avatar = e.target.result;
    saveProfile();
  };
  reader.readAsDataURL(file);
};

// File attachment
const toggleFile = (show, name = '') => {
  filePreview.classList.toggle('hidden', !show);
  fileNameEl.textContent = name;
};

fileInput.onchange = () => {
  const file = fileInput.files[0];
  toggleFile(!!file, file?.name || '');
};

cancelFileBtn.onclick = () => {
  fileInput.value = '';
  toggleFile(false);
};

// Utility functions
const linkify = text => text?.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`) || '';

const compressImage = (file, quality = 0.5) => new Promise(resolve => {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const MAX_WIDTH = 1600, MAX_HEIGHT = 1200;
      let {width, height} = img;
      
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(blob || new Blob([file])), file.type || 'image/jpeg', quality);
    };
  };
  reader.readAsDataURL(file);
});

const showProgress = percent => {
  if (!progressBar) return;
  progressBar.style.width = `${percent}%`;
  progressBar.classList.toggle('hidden', percent >= 100);
};

// Send message
form.onsubmit = async e => {
  e.preventDefault();
  const text = msgInput.value.trim();
  const file = fileInput.files[0];
  
  if (!text && !file) return;
  if (text && text.length > 5000) return alert('Сообщение слишком длинное (максимум 5000 символов)');
  if (file && file.size > 50 * 1024 * 1024) return alert('Файл слишком большой (максимум 50 МБ)');

  const data = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    nick: me.nick,
    avatar: me.avatar,
    text,
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })
  };

  const send = () => {
    socket.emit('msg', data);
    msgInput.value = fileInput.value = '';
    toggleFile(false);
    socket.emit('typing-stop', me.nick);
    showProgress(100);
  };

  try {
    showProgress(0);
    
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        data.file = {name: file.name, data: reader.result, type: file.type};
        send();
      };
      
      if (file.type.startsWith('video/')) {
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('image/') && file.size > 500 * 1024) {
        showProgress(30);
        const compressedBlob = await compressImage(file);
        showProgress(70);
        reader.readAsDataURL(compressedBlob);
      } else {
        reader.readAsDataURL(file);
      }
    } else send();
  } catch (error) {
    console.error('Ошибка при обработке файла:', error);
    alert('Не удалось обработать файл');
    showProgress(100);
  }
};

// Create message element
function createMessageElement(msg) {
  const el = document.createElement('div');
  el.classList.add('message');
  el.dataset.id = msg.id;

  const isMine = msg.nick === me.nick && msg.avatar === me.avatar;
  if (isMine) el.classList.add('self');

  let messageContent = '';
  if (msg.text) {
    // Process GIF tags first, then linkify the remaining text
    messageContent = msg.text.split(/(\[GIF:[^\]]+\])/).map(part => {
      if (part.startsWith('[GIF:')) {
        return `<img src="${part.slice(5, -1)}" class="gif-attachment" alt="GIF">`;
      } else {
        return linkify(part);
      }
    }).join('');
  }

  let fileContent = '';
  if (msg.file) {
    if (msg.file.type.startsWith('video/')) {
      fileContent = `<video class="media-attachment" controls><source src="${msg.file.data}" type="${msg.file.type}">Ваш браузер не поддерживает видео.</video>`;
    } else if (msg.file.type.startsWith('image/')) {
      fileContent = `<img src="${msg.file.data}" class="media-attachment">`;
    } else {
      fileContent = `<div class="file-attachment"><div class="file-icon">📄</div><div class="file-name">${msg.file.name}</div></div>`;
    }
  }

  el.innerHTML = `
    <div class="message-header">
      <img src="${msg.avatar}" class="avatar" width="24" height="24">
      <strong>${msg.nick}</strong>
    </div>
    <div class="message-content">${messageContent}${fileContent}</div>
    ${isMine ? `<button class="delete-btn" title="Удалить">✕</button>` : ''}
    <div class="msg-time">${msg.time}</div>
  `;

  if (isMine) {
    el.querySelector('.delete-btn').onclick = () => socket.emit('delete-msg', {id: msg.id, user: me});
  }

  return el;
}

// Socket events
const scrollToBottom = () => msgsEl.scrollTop = msgsEl.scrollHeight;

socket.on('history', messages => {
  msgsEl.innerHTML = '';
  messages.forEach(msg => msgsEl.appendChild(createMessageElement(msg)));
  scrollToBottom();
});

socket.on('msg', msg => {
  msgsEl.append(createMessageElement(msg));
  scrollToBottom();
});

socket.on('delete-msg', id => {
  const el = msgsEl.querySelector(`.message[data-id="${id}"]`);
  if (el) el.remove();
});

// Typing indicator
let typingTimer;
msgInput.oninput = () => {
  clearTimeout(typingTimer);
  if (msgInput.value.trim()) socket.emit('typing-start', {nick: me.nick, avatar: me.avatar});
  typingTimer = setTimeout(() => socket.emit('typing-stop', me.nick), 1000);
};

socket.on('user-typing', user => {
  if (user.nick === me.nick) return;
  typingIndicator.textContent = `${user.nick} печатает...`;
  typingIndicator.classList.remove('hidden');
});

socket.on('typing-stop', nick => {
  if (nick === me.nick) return;
  typingIndicator.classList.add('hidden');
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  // Initialize GIF module after DOM is loaded
  gifModule = new GifModule({
    msgInput,
    gifBtn,
    gifPanel,
    gifSearch,
    gifSearchBtn,
    gifResults,
    form
  });
  
  if (progressBar) progressBar.classList.add('hidden');
});