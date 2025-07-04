// GIF module for GOIDAZVON chat
class GifModule {
  constructor(options = {}) {
    this.TENOR_API_KEY = options.apiKey || 'AIzaSyASw_xRMFlQRtESxD2liBpKfpq8C_ONcKc';
    this.msgInput = options.msgInput;
    this.gifBtn = options.gifBtn;
    this.gifPanel = options.gifPanel;
    this.gifSearch = options.gifSearch;
    this.gifSearchBtn = options.gifSearchBtn;
    this.gifResults = options.gifResults;
    this.form = options.form;
    
    this.gifSearchTimer = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.gifPanel.classList.add('hidden');
  }

  setupEventListeners() {
    // GIF button click
    this.gifBtn.onclick = (e) => {
      e.stopPropagation();
      this.togglePanel();
      if (!this.gifPanel.classList.contains('hidden')) {
        this.gifSearch.focus();
        this.loadTrendingGifs();
      }
    };

    // Close panels on outside click
    document.onclick = (e) => {
      if (!this.gifPanel.contains(e.target) && e.target !== this.gifBtn) {
        this.gifPanel.classList.add('hidden');
      }
    };

    // Close panel on form submit, scroll, or resize
    [this.form, window, window].forEach((el, i) => {
      el.addEventListener(['submit', 'scroll', 'resize'][i], () => {
        if (i < 2) {
          this.gifPanel.classList.add('hidden');
        } else if (!this.gifPanel.classList.contains('hidden')) {
          this.togglePanel(false);
        }
      });
    });

    // GIF search functionality
    this.gifSearchBtn.onclick = () => this.searchGifs();
    this.gifSearch.onkeypress = (e) => {
      if (e.key === 'Enter') this.searchGifs();
    };
  }

  togglePanel(position = true) {
    const isHidden = this.gifPanel.classList.toggle('hidden');
    if (!isHidden && position) {
      const rect = this.msgInput.getBoundingClientRect();
      this.gifPanel.style.bottom = `${window.innerHeight - rect.top + 10}px`;
      this.gifPanel.style.right = '10px';
    }
  }

  async fetchGifs(url, loadingText = 'Загрузка...') {
    try {
      this.gifResults.innerHTML = `<div class="gif-loading">${loadingText}</div>`;
      const response = await fetch(url);
      const data = await response.json();
      this.displayGifs(data.results);
    } catch (error) {
      console.error('GIF error:', error);
      this.gifResults.innerHTML = '<div class="gif-error">Ошибка загрузки</div>';
    }
  }

  loadTrendingGifs() {
    this.fetchGifs(`https://tenor.googleapis.com/v2/featured?key=${this.TENOR_API_KEY}&limit=12`);
  }

  searchGifs() {
    const query = this.gifSearch.value.trim();
    if (!query) return;
    
    clearTimeout(this.gifSearchTimer);
    this.gifSearchTimer = setTimeout(() => {
      this.fetchGifs(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${this.TENOR_API_KEY}&limit=12`,
        'Поиск...'
      );
    }, 500);
  }

  displayGifs(gifs) {
    if (!gifs || gifs.length === 0) {
      this.gifResults.innerHTML = '<div class="gif-not-found">Ничего не найдено</div>';
      return;
    }
    
    this.gifResults.innerHTML = '';
    gifs.forEach(gif => {
      const gifItem = document.createElement('div');
      gifItem.className = 'gif-item';
      gifItem.innerHTML = `<img src="${gif.media_formats.tinygif.url}" alt="GIF" loading="lazy">`;
      
      gifItem.onclick = () => {
        const gifTag = `[GIF:${gif.media_formats.gif.url}]`;
        this.msgInput.value = this.msgInput.value ? `${this.msgInput.value} ${gifTag}` : gifTag;
        this.msgInput.focus();
        this.gifPanel.classList.add('hidden');
      };
      
      this.gifResults.appendChild(gifItem);
    });
  }


}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GifModule;
} else {
  window.GifModule = GifModule;
}