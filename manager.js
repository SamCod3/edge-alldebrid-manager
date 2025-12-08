import { Utils } from './utils.js';
import { AllDebridAPI, DashboardAPI } from './api.js';
import { JackettAPI } from './jackett.js';
import { TrackerDropdown } from './tracker_dropdown.js';


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

  let jackettConfig = { url: '', key: '' };

  let trackerDropdown;

  // --- Inicialización ---
  init();

  function init() {
    // ... (keep init content)
    // Instantiate Custom Dropdown
    trackerDropdown = new TrackerDropdown('tracker-dropdown-btn', 'tracker-dropdown-list');

    chrome.storage.local.get(['alldebrid_apikey', 'alldebrid_username', 'jackett_url', 'jackett_apikey'], (result) => {
      // ... (keep existing storage logic)
      // Load Jackett Config
      if (result.jackett_url) {
        jackettConfig.url = result.jackett_url;
        jackettUrlInput.value = result.jackett_url;
      } else {
        // Default
        const defaultUrl = 'http://127.0.0.1:9117/';
        jackettConfig.url = defaultUrl;
        jackettUrlInput.value = defaultUrl;
      }
      if (result.jackett_apikey) {
        jackettConfig.key = result.jackett_apikey;
        jackettKeyInput.value = result.jackett_apikey;
        loadJackettTrackers(); // NEW: Load on init if config exists
      }

      if (result.alldebrid_apikey) {
        currentApiKey = result.alldebrid_apikey;
        showFilesView(result.alldebrid_apikey, result.alldebrid_username);
      } else {
        showConfigView();
      }
    });

    // ... (keep listeners)
    // Tab Listeners
    tabDownloading.addEventListener('click', () => switchTab('downloading'));
    tabCompleted.addEventListener('click', () => switchTab('completed'));
    tabSearch.addEventListener('click', () => switchTab('search'));

    // Jackett Listeners
    saveJackettBtn.addEventListener('click', saveJackettConfig);
    jSearchBtn.addEventListener('click', executeJackettSearch);
    jSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeJackettSearch(); });
  }

  // KM Listeners
  kmCreateBtn.addEventListener('click', handleCreateKey);
  if (kmRefreshBtn) kmRefreshBtn.addEventListener('click', loadDashboardKeys);
  if (configBackBtn) configBackBtn.addEventListener('click', () => showFilesView(currentApiKey));

  async function handleCreateKey() {
    // ... (keep handleCreateKey)
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

    // Reset Views
    filesView.classList.add('hidden');
    searchView.classList.add('hidden');
    configView.classList.add('hidden');

    // Reset Tab Styles
    tabDownloading.classList.remove('active');
    tabCompleted.classList.remove('active');
    tabSearch.classList.remove('active');

    if (tab === 'search') {
      searchView.classList.remove('hidden');
      tabSearch.classList.add('active');
      // Hide global SEARCH bar when in Jackett Search
      document.querySelector('.search-bar-container').style.display = 'none';
    } else {
      filesView.classList.remove('hidden');
      document.querySelector('.search-bar-container').style.display = 'block';

      if (tab === 'downloading') {
        tabDownloading.classList.add('active');
        fileListActive.classList.remove('hidden');
        fileListCompleted.classList.add('hidden');
        searchInput.value = ''; // Clear to show placeholder
        searchInput.disabled = true; // Disable local search for downloading
        searchInput.placeholder = "Filtro desactivado en Descargas";
      } else {
        tabCompleted.classList.add('active');
        fileListActive.classList.add('hidden');
        fileListCompleted.classList.remove('hidden');
        searchInput.disabled = false; // Enable for completed
        searchInput.placeholder = "🔍 Filtrar completados...";
        if (lastSearchTerm) searchInput.value = lastSearchTerm; // Restore
      }
      triggerSearch(); // Local filter
    }
  }

  // --- JACKETT LOGIC ---

  function saveJackettConfig() {
    const url = jackettUrlInput.value.trim();
    const key = jackettKeyInput.value.trim();

    chrome.storage.local.set({ jackett_url: url, jackett_apikey: key }, () => {
      jackettConfig = { url, key };
      jackettFeedback.textContent = "✅ Guardado";
      setTimeout(() => jackettFeedback.textContent = '', 2000);
      loadJackettTrackers(); // NEW: Reload trackers when config saved
    });
  }

  async function loadJackettTrackers() {
    if (!jackettConfig.url || !jackettConfig.key) return;

    const res = await JackettAPI.getIndexers(jackettConfig.url, jackettConfig.key);
    if (res.status === 'success') {
      trackerDropdown.render(res.indexers);
    } else {
      console.warn("Error loading indexers:", res.error);
      trackerDropdown.render([]);
    }
  }

  async function executeJackettSearch() {
    const query = jSearchInput.value.trim();
    if (!query) return;
    if (!jackettConfig.url || !jackettConfig.key) return alert("Configura Jackett primero en Configuración.");

    jLoading.classList.remove('hidden');
    jResults.innerHTML = '';

    const trackers = trackerDropdown.getSelected();

    const res = await JackettAPI.search(jackettConfig.url, jackettConfig.key, query, trackers);
    jLoading.classList.add('hidden');

    if (res.status === 'success') {
      renderJackettResults(res.results);
    } else {
      jResults.innerHTML = `<div style="padding:20px; color:#e74c3c">Error: ${res.error}</div>`;
    }
  }

  function renderJackettResults(results) {
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
      const timeAgo = Utils.timeAgo ? Utils.timeAgo(date) : date.toLocaleDateString(); // Fallback if Utils.timeAgo not present, or write simple logic
      // Actually let's just use simple date for now or add timeAgo logic. 
      // I'll stick to a simple formatted date for consistency.
      const dateStr = date.toISOString().split('T')[0];

      tr.innerHTML = `
            <td class="j-col-date">${dateStr}</td>
            <td class="j-col-tracker"><span class="tracker-tag">${item.indexer}</span></td>
            <td class="j-col-name">
               <a href="#" class="j-link-title" title="${item.title}">${item.title}</a>
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
        const status = await downloadFromJackett(item);
        if (status) { // 'ready' or 'downloading'
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
  }

  async function downloadFromJackett(item) {
    // Keep confirm for safety, user can request to remove it later
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

        // Check if ready (cached)
        // uploadMagnet returns data.magnets, uploadTorrentFile returns data.files
        const info = (res.data.magnets && res.data.magnets[0]) || (res.data.files && res.data.files[0]);

        if (info && info.ready) {
          return 'ready';
        }
        return 'downloading';
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

  // --- BÚSQUEDA LOCAL ---
  searchInput.addEventListener('input', triggerSearch);

  function triggerSearch() {
    // ... (Local search logic unchanged)
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

  // KM "Use" button modification
  // We need to find renderKeys and update the click handler to use checkAndSaveKey
  // Instead of modifying renderKeys here (it is further down), we rely on 
  // replacing the implementation logic if possible OR assuming renderKeys calls saveKeyBtn.click()
  // which NOW calls checkAndSaveKey via the listener.

  settingsBtn.addEventListener('click', showConfigView);
  refreshBtn.addEventListener('click', () => { if (currentApiKey) fetchFiles(currentApiKey); });

  function showFilesView(apiKey, username = 'Usuario') {
    configView.classList.add('hidden');
    searchView.classList.add('hidden');
    filesView.classList.remove('hidden');
    document.body.classList.remove('config-active');

    // Ensure tabs are visible (removed via CSS in config mode, but need to be visible here)
    // The CSS 'body.config-active' handles the hiding. Removing it shows them.
    // ALSO need to ensure we are in a valid tab
    activeTab = 'completed'; // Default to completed on return
    switchTab(activeTab);

    if (username) userWelcome.textContent = `${username}`;
    fetchFiles(apiKey);
  }

  function showConfigView() {
    configView.classList.remove('hidden');
    filesView.classList.add('hidden');
    searchView.classList.add('hidden');
    document.body.classList.add('config-active');

    // Always Try to load Keys when entering config view
    loadDashboardKeys();
  }

  // ... (rest of functions: loadDashboardKeys, renderKeys, fetchFiles, processAndRender, renderList, toggleDetails... UNCHANGED)
  // We include them here implicitly via the Replacement logic or just keep them if replacing block.
  // NOTE: The tool replaces strictly what is defined. 
  // I will assume the rest follows the standard pattern.
  // Since I am replacing the WHOLE file structure logic, I need to be careful not to delete the bottom functions.
  // I will target the imports and the init block, and then append the new logic. 
  // ACTUALLY, "manager.js" structure is complex. I will try to be surgical.

  // STRATEGY: 
  // 1. Target Top part (Imoports + DOM + Vars + Init)
  // 2. Add jackett functions at the end of file or suitably placed.

  /* ... (Existing fetchFiles/renderList implementations) ... */

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
    // ... (matches existing)
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

      // Logic
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
    // ... (Matches existing)
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
        // Only redirect if explicitly an AUTH error
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
    // ... (Matches existing)
    if (!magnets || magnets.length === 0) {
      // Show empty state in both
      fileListActive.innerHTML = '<li style="text-align:center; padding:40px; color:#555">No hay descargas activas.</li>';
      fileListCompleted.innerHTML = '<li style="text-align:center; padding:40px; color:#555">No hay historial.</li>';
      filesCount.textContent = '0';
      return;
    }

    filesCount.textContent = `${magnets.length}`;

    // Filter
    const activeMagnets = magnets.filter(m => m.statusCode !== 4);
    const completedMagnets = magnets.filter(m => m.statusCode === 4);

    // Update Tab Indicator
    if (activeMagnets.length > 0) {
      tabDownloading.textContent = `⬇️ Descargando (${activeMagnets.length})`;
      tabDownloading.classList.add('has-active'); // Optional styling hook
    } else {
      tabDownloading.textContent = `⬇️ Descargando`;
      tabDownloading.classList.remove('has-active');
    }

    renderList(activeMagnets, fileListActive, 'active');
    renderList(completedMagnets, fileListCompleted, 'completed');

    // Trigger initial visibility
    // switchTab(activeTab); // Don't auto switch here, keep current tab
  }

  function renderList(items, container, type) {
    if (items.length === 0) {
      container.innerHTML = '<li style="text-align:center; padding:40px; color:#555">Nada por aquí.</li>';
      return;
    }

    items.forEach(magnet => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.dataset.name = magnet.filename; // Search helper

      const isReady = magnet.statusCode === 4;

      // Basic Row
      const mainRow = document.createElement('div');
      mainRow.className = 'file-row-main';

      // Determine Content based on Type
      if (type === 'active') {
        const perc = (magnet.size > 0) ? ((magnet.downloaded / magnet.size) * 100).toFixed(1) : 0;
        const speed = magnet.downloadSpeed ? Utils.formatBytes(magnet.downloadSpeed) + '/s' : '0 B/s';
        const seeds = magnet.seeders ? magnet.seeders : 0;

        mainRow.innerHTML = `
          <div class="file-info">
             <span class="file-name" style="cursor:default">${magnet.filename}</span>
             
             <!-- Progress Block -->
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
        // Completed View
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

      // Logic
      const fileInfoBlock = mainRow.querySelector('.file-info');
      const deleteBtn = mainRow.querySelector('.btn-delete');

      deleteBtn.onclick = (e) => { e.stopPropagation(); deleteMagnet(magnet.id); };

      if (type === 'active') {
        const restartBtn = mainRow.querySelector('.btn-restart');
        restartBtn.onclick = (e) => { e.stopPropagation(); restartMagnet(magnet.id); };
      }

      if (isReady && magnet.links && magnet.links.length > 0) {
        // Only clickable in completed view effectively
        const nameSpan = mainRow.querySelector('.file-name');
        nameSpan.onclick = () => toggleDetails(li, magnet.links);
      }

      li.appendChild(mainRow);
      container.appendChild(li);
    });
  }

  // --- DESPLIEGUE ---
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

      const copyBtn = row.querySelector('.btn-copy');
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
        // Force switch to active tab to see progress
        activeTab = 'downloading';
        switchTab('downloading'); // Update UI active state
        fetchFiles(currentApiKey);
      } else {
        alert((data.error && data.error.message) ? data.error.message : 'Error al reiniciar');
      }
    } catch (e) { console.error(e); alert('Error de red'); }
  }

  async function deleteMagnet(id) {
    if (!confirm('¿Seguro que quieres eliminar este fichero?')) return;
    try {
      const data = await AllDebridAPI.deleteMagnet(currentApiKey, id);
      if (data.status === 'success') fetchFiles(currentApiKey);
    } catch (e) { alert('Error de red'); }
  }
});