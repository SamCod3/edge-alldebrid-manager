import { Utils } from './utils.js';
import { AllDebridAPI, DashboardAPI } from './api.js';
import { JackettAPI } from './jackett.js';
import { TrackerDropdown } from './tracker_dropdown.js';
import { TVManager } from './tv_manager.js';


document.addEventListener('DOMContentLoaded', () => {
  // --- DOM ELEMENTS ---
  const kmList = document.getElementById('km-list');
  const kmLoading = document.getElementById('km-loading');
  const kmLoginReq = document.getElementById('km-login-req');
  const kmNewName = document.getElementById('km-new-name');
  const kmCreateBtn = document.getElementById('km-create-btn');
  const kmRefreshBtn = document.getElementById('km-refresh-btn');
  const configBackBtn = document.getElementById('config-back-btn');

  // JACKETT DOM
  const jackettUrlInput = document.getElementById('jackett-url-input');
  const jackettKeyInput = document.getElementById('jackett-key-input');
  const saveJackettBtn = document.getElementById('save-jackett-btn');
  const jackettFeedback = document.getElementById('jackett-feedback');

  // TV DOM
  const tvNameInput = document.getElementById('tv-name-input');
  const tvIpInput = document.getElementById('tv-ip-input');
  const addTvBtn = document.getElementById('add-tv-btn');
  const tvList = document.getElementById('tv-list');
  const tvFeedback = document.getElementById('tv-feedback');

  const searchView = document.getElementById('search-view');
  const jSearchInput = document.getElementById('j-search-input');
  const jSearchBtn = document.getElementById('j-search-btn');
  const jResults = document.getElementById('j-results');
  const jLoading = document.getElementById('j-loading');
  const tabSearch = document.getElementById('tab-search');

  const configView = document.getElementById('config-view');
  const filesView = document.getElementById('files-view');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const configFeedback = document.getElementById('config-feedback');
  const searchInput = document.getElementById('search-input');
  const fileListActive = document.getElementById('list-downloading');
  const fileListCompleted = document.getElementById('list-completed');
  const tabDownloading = document.getElementById('tab-downloading');
  const tabCompleted = document.getElementById('tab-completed');

  const loadingDiv = document.getElementById('loading');
  const errorMsg = document.getElementById('error-msg');
  const noResultsDiv = document.getElementById('no-results');
  const settingsBtn = document.getElementById('settings-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const userWelcome = document.getElementById('user-welcome');
  const filesCount = document.getElementById('files-count');

  let currentApiKey = '';
  // TAB STATE: 'downloading' | 'completed' | 'search'
  let activeTab = 'completed';
  let lastSearchTerm = '';

  let trackerDropdown;
  let tvManager;

  // --- JACKETT CONTROLLER ---
  const JackettController = {
    config: { url: '', key: '' },
    STATUS: {
      CHECKING: { emoji: '🟡', text: 'Comprobando conexión...' },
      ONLINE: { emoji: '🟢', text: 'Online' },
      OFFLINE: { emoji: '🔴', text: 'Offline / Error de conexión / API Key inválida' },
      NONE: { emoji: '⚪', text: 'No configurado (Requiere URL y API Key)' }
    },

    init() {
      // Listeners
      saveJackettBtn.addEventListener('click', () => this.saveConfig());
      jSearchBtn.addEventListener('click', () => this.search());
      jSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.search(); });

      // Load Config
      chrome.storage.local.get(['jackett_url', 'jackett_apikey'], (result) => {
        if (result.jackett_url) {
          this.config.url = result.jackett_url;
          jackettUrlInput.value = result.jackett_url;
        } else {
          const defaultUrl = 'http://127.0.0.1:9117/';
          this.config.url = defaultUrl;
          jackettUrlInput.value = defaultUrl;
        }

        if (result.jackett_apikey) {
          this.config.key = result.jackett_apikey;
          jackettKeyInput.value = result.jackett_apikey;
          this.loadTrackers();
        }

        this.checkStatus();
      });
    },

    saveConfig() {
      const url = jackettUrlInput.value.trim();
      const key = jackettKeyInput.value.trim();

      chrome.storage.local.set({ jackett_url: url, jackett_apikey: key }, () => {
        this.config = { url, key };
        jackettFeedback.textContent = "✅ Guardado";
        setTimeout(() => jackettFeedback.textContent = '', 2000);
        this.loadTrackers();
        this.checkStatus();
      });
    },

    setStatus(state, isOnline = false) {
      const statusEl = document.getElementById('jackett-status');
      const tabStatusEl = document.getElementById('jackett-status-tab');
      // Update Config Indicator
      if (statusEl) {
        statusEl.textContent = state.emoji;
        statusEl.title = state.text;
      }
      // Update Tab Indicator
      if (tabStatusEl) {
        tabStatusEl.textContent = state.emoji;
        tabStatusEl.title = state.text;
        // Hide if not configured
        tabStatusEl.style.display = (state.emoji === '⚪') ? 'none' : 'inline';
      }
      // Update Tab State
      if (tabSearch) {
        tabSearch.disabled = !isOnline;
        if (!isOnline) {
          tabSearch.classList.add('disabled-tab');
          if (activeTab === 'search') switchTab('completed');
        } else {
          tabSearch.classList.remove('disabled-tab');
        }
      }
    },

    async checkStatus() {
      this.setStatus(this.STATUS.CHECKING, false);

      if (!this.config.url || !this.config.key) {
        this.setStatus(this.STATUS.NONE, false);
        return;
      }

      const isOnline = await JackettAPI.testConnection(this.config.url, this.config.key);
      if (isOnline) {
        this.setStatus(this.STATUS.ONLINE, true);
      } else {
        this.setStatus(this.STATUS.OFFLINE, false);
      }
    },

    async loadTrackers() {
      if (!this.config.url || !this.config.key) return;
      const res = await JackettAPI.getIndexers(this.config.url, this.config.key);
      if (res.status === 'success') {
        trackerDropdown.render(res.indexers);
      } else {
        console.warn("Error loading indexers:", res.error);
        trackerDropdown.render([]);
      }
    },

    async search() {
      const query = jSearchInput.value.trim();
      if (!query) return;
      if (!this.config.url || !this.config.key) return alert("Configura Jackett primero en Configuración.");

      jLoading.classList.remove('hidden');
      jResults.innerHTML = '';

      const trackers = trackerDropdown.getSelected();
      const res = await JackettAPI.search(this.config.url, this.config.key, query, trackers);
      jLoading.classList.add('hidden');

      if (res.status === 'success') {
        this.renderResults(res.results);
      } else {
        jResults.innerHTML = `<div style="padding:20px; color:#e74c3c">Error: ${res.error}</div>`;
      }
    },

    renderResults(results) {
      if (!results || results.length === 0) {
        jResults.innerHTML = '<div style="padding:20px; color:#777; text-align:center">No se encontraron resultados.</div>';
        return;
      }

      const table = document.createElement('table');
      table.className = 'j-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th width="80">Published</th>
            <th width="120">Tracker</th>
            <th>Name</th>
            <th width="80">Size</th>
            <th width="100">Category</th>
            <th width="60">Seeds</th>
            <th width="60">Action</th>
          </tr>
        </thead>
        <tbody id="j-table-body"></tbody>
      `;

      const tbody = table.querySelector('#j-table-body');

      results.forEach(item => {
        const tr = document.createElement('tr');
        const date = new Date(item.pubDate);
        const dateStr = date.toISOString().split('T')[0];

        tr.innerHTML = `
              <td class="j-col-date">${dateStr}</td>
              <td class="j-col-tracker"><span class="tracker-tag">${item.indexer}</span></td>
              <td class="j-col-name">
                 <a href="#" class="j-link-title" title="${item.title}">${item.title.replace(/\[?free\]?/gi, '').trim()}</a>
              </td>
              <td class="j-col-size">${Utils.formatBytes(item.size)}</td>
              <td class="j-col-cat">${item.category}</td>
              <td class="j-col-seeds">${item.seeders}</td>
              <td class="j-col-action"></td>
            `;

        const btn = document.createElement('button');
        btn.className = 'j-btn-icon';
        btn.innerHTML = '⚡';
        btn.title = "Enviar a AllDebrid";
        btn.onclick = async (e) => {
          e.preventDefault();
          const status = await this.download(item);
          if (status) {
            btn.innerHTML = '✔';
            btn.classList.add('sent');
            btn.disabled = true;
            if (status === 'ready') {
              tr.classList.add('j-row-sent-ready');
              btn.title = "Enviado a Descargados (Instantáneo)";
            } else {
              tr.classList.add('j-row-sent-downloading');
              btn.title = "Enviado a Cola de Descarga";
            }
          }
        };

        tr.querySelector('.j-col-action').appendChild(btn);
        tbody.appendChild(tr);
      });

      jResults.innerHTML = '';
      jResults.appendChild(table);
    },

    async download(item) {
      if (!confirm(`¿Enviar "${item.title}" a AllDebrid?`)) return false;
      const link = item.link;

      try {
        let res;
        if (link.startsWith('magnet:')) {
          res = await AllDebridAPI.uploadMagnet(currentApiKey, link);
        } else {
          const fileRes = await fetch(link);
          if (!fileRes.ok) throw new Error(`Error descargando torrent (${fileRes.status})`);
          const blob = await fileRes.blob();
          res = await AllDebridAPI.uploadTorrentFile(currentApiKey, blob);
        }

        if (res && res.status === 'success') {
          fetchFiles(currentApiKey).catch(() => { });
          const info = (res.data.magnets && res.data.magnets[0]) || (res.data.files && res.data.files[0]);
          return (info && info.ready) ? 'ready' : 'downloading';
        } else {
          alert("Error AllDebrid: " + (res.error?.message || "Desconocido"));
          return false;
        }
      } catch (e) {
        console.error(e);
        alert("Error de red o CORS al enviar.");
        return false;
      }
    }
  };


  // --- Inicialización ---
  init();

  function init() {
    // Instantiate Custom Dropdown
    trackerDropdown = new TrackerDropdown('tracker-dropdown-btn', 'tracker-dropdown-list');

    // Initialize Jackett
    JackettController.init();

    // Check AllDebrid Auth
    chrome.storage.local.get(['alldebrid_apikey', 'alldebrid_username'], (result) => {
      if (result.alldebrid_apikey) {
        currentApiKey = result.alldebrid_apikey;
        showFilesView(result.alldebrid_apikey, result.alldebrid_username);
      } else {
        showConfigView();
      }
    });

    // Initialize TV Manager
    tvManager = new TVManager();
    tvManager.load().then(renderTVList);

    // Tab Listeners (Main View)
    tabDownloading.addEventListener('click', () => switchTab('downloading'));
    tabCompleted.addEventListener('click', () => switchTab('completed'));
    tabSearch.addEventListener('click', () => switchTab('search'));

    // Tab Listeners (Config View)
    document.querySelectorAll('.config-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // 1. UI Updates
        document.querySelectorAll('.config-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 2. Hide all content
        document.querySelectorAll('.cfg-tab-content').forEach(c => c.classList.add('hidden'));

        // 3. Show target content
        const targetId = btn.dataset.target;
        document.getElementById(targetId).classList.remove('hidden');
      });
    });
  }

  // TV Listeners
  addTvBtn.addEventListener('click', async () => {
    const name = tvNameInput.value.trim();
    const ip = tvIpInput.value.trim();
    try {
      const tvs = await tvManager.addTV(name, ip);
      renderTVList(tvs);
      tvNameInput.value = '';
      tvIpInput.value = '';
      tvFeedback.textContent = '✅ Añadido';
      setTimeout(() => tvFeedback.textContent = '', 2000);
    } catch (e) {
      alert(e.message);
    }
  });

  function renderTVList() {
    tvList.innerHTML = '';
    const tvs = tvManager.getAll();

    if (tvs.length === 0) {
      tvList.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#666; padding:20px;">No hay TVs configuradas.<br>Añade una abajo 👇</div>';
      return;
    }

    tvs.forEach(tv => {
      const card = document.createElement('div');
      card.className = 'tv-card-item';

      card.innerHTML = `
        <div style="display:flex; align-items:center;">
            <div class="tv-icon-large">📺</div>
            <div class="tv-info">
                <div class="tv-name-display">${Utils.escapeHtml(tv.name)}</div>
                <div class="tv-ip-display">${Utils.escapeHtml(tv.ip)}</div>
            </div>
        </div>
        <div class="tv-actions">
           <button class="btn-icon-small btn-delete" title="Eliminar">🗑️</button>
        </div>
      `;

      // Event listener for delete
      card.querySelector('.btn-delete').addEventListener('click', () => {
        if (confirm(`¿Eliminar TV "${tv.name}"?`)) {
          tvManager.removeTV(tv.id);
          renderTVList();
        }
      });

      tvList.appendChild(card);
    });
  }

  // KM Listeners
  kmCreateBtn.addEventListener('click', handleCreateKey);
  if (kmRefreshBtn) kmRefreshBtn.addEventListener('click', loadDashboardKeys);
  if (configBackBtn) configBackBtn.addEventListener('click', () => showFilesView(currentApiKey));

  async function handleCreateKey() {
    const name = kmNewName.value.trim();
    if (!name) return;
    const originalText = kmCreateBtn.textContent;
    kmCreateBtn.disabled = true;
    kmCreateBtn.textContent = "...";
    const res = await DashboardAPI.createKey(name);
    kmCreateBtn.disabled = false;
    kmCreateBtn.textContent = originalText;
    if (res.status === 'success') {
      kmNewName.value = '';
      loadDashboardKeys();
    } else {
      alert('Error: ' + (res.error || 'Desconocido'));
    }
  }

  function switchTab(tab) {
    if (activeTab === 'completed' && tab !== 'completed') {
      lastSearchTerm = searchInput.value;
    }

    activeTab = tab;

    filesView.classList.add('hidden');
    searchView.classList.add('hidden');
    configView.classList.add('hidden');

    tabDownloading.classList.remove('active');
    tabCompleted.classList.remove('active');
    tabSearch.classList.remove('active');

    if (tab === 'search') {
      searchView.classList.remove('hidden');
      tabSearch.classList.add('active');
      document.querySelector('.search-bar-container').style.display = 'none';
    } else {
      filesView.classList.remove('hidden');
      document.querySelector('.search-bar-container').style.display = 'block';

      if (tab === 'downloading') {
        tabDownloading.classList.add('active');
        fileListActive.classList.remove('hidden');
        fileListCompleted.classList.add('hidden');
        searchInput.value = '';
        searchInput.disabled = true;
        searchInput.placeholder = "Filtro desactivado en Descargas";
      } else {
        tabCompleted.classList.add('active');
        fileListActive.classList.add('hidden');
        fileListCompleted.classList.remove('hidden');
        searchInput.disabled = false;
        searchInput.placeholder = "🔍 Filtrar completados...";
        if (lastSearchTerm) searchInput.value = lastSearchTerm;
      }
      triggerSearch();
    }
  }

  // --- BÚSQUEDA LOCAL ---
  searchInput.addEventListener('input', triggerSearch);

  function triggerSearch() {
    const term = searchInput.value.toLowerCase();
    const currentList = activeTab === 'downloading' ? fileListActive : fileListCompleted;
    const items = currentList.querySelectorAll('.file-item');

    let visibleCount = 0;
    items.forEach(item => {
      const name = item.dataset.name.toLowerCase();
      if (name.includes(term)) {
        item.style.display = 'block';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });

    if (visibleCount === 0 && items.length > 0) noResultsDiv.classList.remove('hidden');
    else noResultsDiv.classList.add('hidden');
  }

  function showFeedback(msg, type) {
    configFeedback.textContent = msg;
    configFeedback.className = 'feedback-msg ' + type;
  }

  // --- EVENTOS GLOBALES ---
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) return showFeedback('Introduce una API Key válida.', 'error');
    checkAndSaveKey(key);
  });

  async function checkAndSaveKey(key) {
    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = "Validando...";
    showFeedback('Conectando...', 'loading');

    try {
      const userInfo = await AllDebridAPI.validateApiKey(key);

      if (userInfo && userInfo.username) {
        showFeedback('✅ Éxito', 'success');

        const dataToSave = {
          alldebrid_apikey: key,
          alldebrid_username: userInfo.username
        };

        chrome.storage.local.set(dataToSave, () => {
          if (chrome.runtime.lastError) {
            console.error("Storage Error:", chrome.runtime.lastError);
            saveKeyBtn.disabled = false;
            saveKeyBtn.textContent = "Guardar";
            showFeedback('❌ Error guardando (Storage)', 'error');
            return;
          }

          currentApiKey = key;
          setTimeout(() => {
            saveKeyBtn.disabled = false;
            saveKeyBtn.textContent = "Guardar";
            configFeedback.textContent = '';
            apiKeyInput.value = '';
            showFilesView(key, userInfo.username);
          }, 1000);
        });

      } else {
        throw new Error('La API Key no es válida o falta usuario.');
      }
    } catch (error) {
      console.error(error);
      saveKeyBtn.disabled = false;
      saveKeyBtn.textContent = "Guardar";
      showFeedback(`❌ ${error.message || 'Error desconocido'}`, 'error');
    }
  }

  settingsBtn.addEventListener('click', showConfigView);
  refreshBtn.addEventListener('click', () => {
    if (currentApiKey) fetchFiles(currentApiKey);
    JackettController.checkStatus(); // NEW: Refresh Jackett status
  });

  function showFilesView(apiKey, username = 'Usuario') {
    configView.classList.add('hidden');
    searchView.classList.add('hidden');
    filesView.classList.remove('hidden');
    document.body.classList.remove('config-active');

    activeTab = 'completed';
    switchTab(activeTab);

    if (username) userWelcome.textContent = `${username}`;
    fetchFiles(apiKey);
  }

  function showConfigView() {
    configView.classList.remove('hidden');
    filesView.classList.add('hidden');
    searchView.classList.add('hidden');
    document.body.classList.add('config-active');
    loadDashboardKeys();
  }

  async function loadDashboardKeys() {
    kmList.innerHTML = '';
    kmLoading.classList.remove('hidden');
    kmLoginReq.classList.add('hidden');

    const res = await DashboardAPI.fetchKeys();
    kmLoading.classList.add('hidden');

    if (res.error === 'not_logged_in') {
      kmLoginReq.classList.remove('hidden');
    } else if (res.keys) {
      renderKeys(res.keys);
    }
  }

  function renderKeys(keys) {
    if (keys.length === 0) {
      kmList.innerHTML = '<div style="color:#777; padding:20px; grid-column: 1/-1; text-align:center;">No se encontraron claves.</div>';
      return;
    }

    keys.forEach(k => {
      const div = document.createElement('div');
      div.className = 'key-card-item';
      div.innerHTML = `
            <div class="key-icon">🔑</div>
            <div class="key-content">
                <div class="key-card-head">
                    <div class="key-name" title="${k.name}">${k.name}</div>
                    <div class="key-tools">
                        <span class="btn-icon-small btn-edit" title="Renombrar">✏️</span>
                        <span class="btn-icon-small btn-delete" title="Eliminar">🗑️</span>
                    </div>
                </div>
                <span class="key-val">${k.key.substring(0, 12)}...</span>
            </div>
            <div class="key-actions">
                <button class="btn-use-key">USAR</button>
            </div>
          `;

      div.querySelector('.btn-use-key').onclick = () => {
        apiKeyInput.value = k.key;
        saveKeyBtn.click();
      };

      div.querySelector('.btn-delete').onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar clave "${k.name}"?`)) {
          const res = await DashboardAPI.deleteKey(k.key);
          if (res.status === 'success') loadDashboardKeys();
          else alert('Error: ' + res.error);
        }
      };

      div.querySelector('.btn-edit').onclick = async (e) => {
        e.stopPropagation();
        const newName = prompt("Nuevo nombre para la clave:", k.name);
        if (newName && newName !== k.name) {
          const res = await DashboardAPI.renameKey(k.key, newName);
          if (res.status === 'success') loadDashboardKeys();
          else alert('Error: ' + res.error);
        }
      };

      kmList.appendChild(div);
    });
  }

  async function fetchFiles(apiKey) {
    fileListActive.innerHTML = '';
    fileListCompleted.innerHTML = '';
    loadingDiv.classList.remove('hidden');
    errorMsg.classList.add('hidden');
    noResultsDiv.classList.add('hidden');
    searchInput.value = '';

    try {
      const data = await AllDebridAPI.getMagnets(apiKey);
      loadingDiv.classList.add('hidden');
      if (data.status === 'success') {
        processAndRender(data.data.magnets);
      } else {
        if (data.error && data.error.code && data.error.code.includes('AUTH')) {
          console.warn('Auth Error:', data.error);
          showConfigView();
        } else {
          throw new Error(data.error ? data.error.message : 'Error desconocido de API');
        }
      }
    } catch (error) {
      loadingDiv.classList.add('hidden');
      errorMsg.textContent = error.message;
      errorMsg.classList.remove('hidden');
    }
  }

  function processAndRender(magnets) {
    if (!magnets || magnets.length === 0) {
      fileListActive.innerHTML = '<li style="text-align:center; padding:40px; color:#555">No hay descargas activas.</li>';
      fileListCompleted.innerHTML = '<li style="text-align:center; padding:40px; color:#555">No hay historial.</li>';
      filesCount.textContent = '0';
      return;
    }

    filesCount.textContent = `${magnets.length}`;
    const activeMagnets = magnets.filter(m => m.statusCode !== 4);
    const completedMagnets = magnets.filter(m => m.statusCode === 4);

    if (activeMagnets.length > 0) {
      tabDownloading.textContent = `⬇️ Descargando (${activeMagnets.length})`;
      tabDownloading.classList.add('has-active');
    } else {
      tabDownloading.textContent = `⬇️ Descargando`;
      tabDownloading.classList.remove('has-active');
    }

    renderList(activeMagnets, fileListActive, 'active');
    renderList(completedMagnets, fileListCompleted, 'completed');
  }

  function renderList(items, container, type) {
    if (items.length === 0) {
      container.innerHTML = '<li style="text-align:center; padding:40px; color:#555">Nada por aquí.</li>';
      return;
    }

    items.forEach(magnet => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.dataset.name = magnet.filename;

      const isReady = magnet.statusCode === 4;
      const mainRow = document.createElement('div');
      mainRow.className = 'file-row-main';

      if (type === 'active') {
        const perc = (magnet.size > 0) ? ((magnet.downloaded / magnet.size) * 100).toFixed(1) : 0;
        const speed = magnet.downloadSpeed ? Utils.formatBytes(magnet.downloadSpeed) + '/s' : '0 B/s';
        const seeds = magnet.seeders ? magnet.seeders : 0;

        mainRow.innerHTML = `
          <div class="file-info">
             <span class="file-name" style="cursor:default">${magnet.filename}</span>
             <div class="progress-section">
                <div class="progress-header">
                   <span>${Utils.formatBytes(magnet.downloaded)} / ${Utils.formatBytes(magnet.size)}</span>
                   <span>${perc}%</span>
                </div>
                <div class="progress-track">
                   <div class="progress-fill" style="width: ${perc}%"></div>
                </div>
                <div class="progress-stats">
                   <span class="stat-chip" title="Velocidad">🚀 ${speed}</span>
                   <span class="stat-chip" title="Semillas">🌱 ${seeds}</span>
                   <span class="stat-chip" title="Estado">${magnet.status}</span>
                </div>
             </div>
          </div>
          <div class="file-actions">
             <button class="btn-action btn-restart" title="Reiniciar">🔄</button>
             <button class="btn-action btn-delete" title="Eliminar">🗑️</button>
          </div>
        `;
      } else {
        mainRow.innerHTML = `
          <div class="file-info">
              <span class="file-name" title="Clic para ver enlaces">${magnet.filename}</span>
              <span class="file-meta">${Utils.formatBytes(magnet.size)} • ${new Date(magnet.uploadDate * 1000).toLocaleDateString()}</span>
          </div>
          <div class="file-actions">
             <span class="status-badge status-ready">Completado</span>
             <button class="btn-action btn-delete" title="Eliminar">🗑️</button>
          </div>
        `;
      }

      const fileInfoBlock = mainRow.querySelector('.file-info');
      const deleteBtn = mainRow.querySelector('.btn-delete');

      deleteBtn.onclick = (e) => { e.stopPropagation(); deleteMagnet(magnet.id); };

      if (type === 'active') {
        const restartBtn = mainRow.querySelector('.btn-restart');
        restartBtn.onclick = (e) => { e.stopPropagation(); restartMagnet(magnet.id); };
      }

      if (isReady && magnet.links && magnet.links.length > 0) {
        const nameSpan = mainRow.querySelector('.file-name');
        nameSpan.onclick = () => toggleDetails(li, magnet.links);
      }

      li.appendChild(mainRow);
      container.appendChild(li);
    });
  }

  async function toggleDetails(parentElement, links) {
    const existingBox = parentElement.querySelector('.links-box');
    if (existingBox) { existingBox.remove(); return; }

    const box = document.createElement('div');
    box.className = 'links-box';
    box.innerHTML = '<div class="links-loading">⏳ Desbloqueando enlaces directos...</div>';
    parentElement.appendChild(box);

    links.sort((a, b) => (b.size || 0) - (a.size || 0));

    try {
      const unlockPromises = links.map(async (linkObj) => {
        try {
          const json = await AllDebridAPI.unlockLink(currentApiKey, linkObj.link);
          if (json.status === 'success') return { ...linkObj, link: json.data.link };
        } catch (e) { }
        return linkObj;
      });
      const unlockedLinks = await Promise.all(unlockPromises);
      box.innerHTML = '';
      renderLinksBox(box, unlockedLinks);
    } catch (error) {
      box.innerHTML = '<div class="links-loading" style="color:#e74c3c">Error.</div>';
    }
  }

  function renderLinksBox(box, links) {
    const videoExts = ['mkv', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];

    links.forEach(linkObj => {
      const ext = linkObj.filename.split('.').pop().toLowerCase();
      const isVideo = videoExts.includes(ext);

      const row = document.createElement('div');
      row.className = `link-row ${isVideo ? 'is-video' : ''}`;
      const icon = isVideo ? '🎬' : '📄';

      row.innerHTML = `
        <div class="link-filename">
            <a href="${linkObj.link}" target="_blank" title="Descargar">${icon} ${linkObj.filename}</a>
        </div>
        <div class="link-actions">
            <span class="link-meta">${Utils.formatBytes(linkObj.size)}</span>
            <button class="btn-copy" title="Copiar enlace">📋</button>
        </div>
      `;

      const actionsDiv = row.querySelector('.link-actions');
      const copyBtn = row.querySelector('.btn-copy');

      if (isVideo) {
        const castBtn = document.createElement('button');
        castBtn.className = 'btn-cast';
        castBtn.innerHTML = '📺';
        castBtn.title = 'Enviar a TV (DLNA)';
        castBtn.onclick = () => handleCast(linkObj);
        actionsDiv.appendChild(castBtn);
      }

      copyBtn.onclick = () => {
        navigator.clipboard.writeText(linkObj.link).then(() => {
          const original = copyBtn.innerHTML;
          copyBtn.innerHTML = '✅';
          copyBtn.style.color = '#2ecc71';
          copyBtn.style.borderColor = '#2ecc71';
          setTimeout(() => {
            copyBtn.innerHTML = original;
            copyBtn.style.color = '';
            copyBtn.style.borderColor = '';
          }, 1500);
        });
      };

      box.appendChild(row);
    });
  }

  async function restartMagnet(id) {
    if (!confirm('¿Reiniciar descarga?')) return;
    try {
      const data = await AllDebridAPI.restartMagnet(currentApiKey, id);
      if (data.status === 'success') {
        activeTab = 'downloading';
        switchTab('downloading');
        fetchFiles(currentApiKey);
      } else {
        alert((data.error && data.error.message) ? data.error.message : 'Error al reiniciar');
      }
    } catch (e) { console.error(e); alert('Error de red'); }
  }

  async function handleCast(linkObj) {
    if (tvManager.tvs.length === 0) {
      alert("No hay TVs configuradas. Ve a Configuración.");
      return;
    }

    let targetTv = tvManager.tvs[0];
    if (tvManager.tvs.length > 1) {
      // Simple selection for now
      const names = tvManager.tvs.map((tv, i) => `${i + 1}: ${tv.name} (${tv.ip})`).join('\n');
      const selection = prompt(`Selecciona TV:\n${names}`, "1");
      if (!selection) return;
      const index = parseInt(selection) - 1;
      if (index >= 0 && index < tvManager.tvs.length) {
        targetTv = tvManager.tvs[index];
      } else {
        return alert("Selección inválida");
      }
    }

    const btn = document.activeElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳';

    const res = await tvManager.castToTV(linkObj.link, targetTv.ip);

    if (res.status === 'success') {
      btn.innerHTML = '▶️';
      btn.title = 'Reproduciendo en ' + targetTv.name;
      setTimeout(() => { btn.innerHTML = originalText; }, 3000);
    } else {
      btn.innerHTML = '❌';
      alert("Error al enviar: " + res.error);
      setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    }
  }

  async function deleteMagnet(id) {
    if (!confirm('¿Seguro que quieres eliminar este fichero?')) return;
    try {
      const data = await AllDebridAPI.deleteMagnet(currentApiKey, id);
      if (data.status === 'success') fetchFiles(currentApiKey);
    } catch (e) { alert('Error de red'); }
  }
});