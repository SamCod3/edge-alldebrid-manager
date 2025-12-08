import { Utils } from './utils.js';
import { AllDebridAPI, DashboardAPI } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // ... (existing DOM elements)

  // NEW DOM ELEMENTS
  const kmList = document.getElementById('km-list');
  const kmLoading = document.getElementById('km-loading');
  const kmLoginReq = document.getElementById('km-login-req');
  const kmNewName = document.getElementById('km-new-name');
  const kmCreateBtn = document.getElementById('km-create-btn');
  const kmRefreshBtn = document.getElementById('km-refresh-btn'); // Add this to HTML if missing, but style supports it
  const configBackBtn = document.getElementById('config-back-btn');

  // ... (rest of vars)

  // ... (init and watchers)

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

  // ... (existing code)

  function showConfigView() {
    configView.classList.remove('hidden');
    filesView.classList.add('hidden');
    document.body.classList.add('config-active');

    // Always Try to load Keys when entering config view
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

  // ... (rest of existing functions)
  // --- Elementos del DOM ---
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
  let activeTab = 'completed'; // 'downloading' | 'completed'

  // --- Inicialización ---
  init();

  function init() {
    chrome.storage.local.get(['alldebrid_apikey', 'alldebrid_username'], (result) => {
      if (result.alldebrid_apikey) {
        currentApiKey = result.alldebrid_apikey;
        showFilesView(result.alldebrid_apikey, result.alldebrid_username);
      } else {
        showConfigView();
      }
    });

    // Tab Listeners
    tabDownloading.addEventListener('click', () => switchTab('downloading'));
    tabCompleted.addEventListener('click', () => switchTab('completed'));
  }

  function switchTab(tab) {
    activeTab = tab;

    // UI Updates
    if (tab === 'downloading') {
      tabDownloading.classList.add('active');
      tabCompleted.classList.remove('active');
      fileListActive.classList.remove('hidden');
      fileListCompleted.classList.add('hidden');
    } else {
      tabDownloading.classList.remove('active');
      tabCompleted.classList.add('active');
      fileListActive.classList.add('hidden');
      fileListCompleted.classList.remove('hidden');
    }

    // Refresh Filter (Search)
    triggerSearch();
  }

  // --- BÚSQUEDA ---
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

    // Only show no results if we have items but none match, or if empty list handled in render
    if (visibleCount === 0 && items.length > 0) noResultsDiv.classList.remove('hidden');
    else noResultsDiv.classList.add('hidden');
  }

  // --- EVENTOS GLOBALES ---
  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) return showFeedback('Introduce una API Key válida.', 'error');
    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = "Validando...";
    showFeedback('Conectando...', 'loading');
    try {
      const userInfo = await AllDebridAPI.validateApiKey(key);
      if (userInfo) {
        showFeedback('✅ Éxito', 'success');
        chrome.storage.local.set({
          alldebrid_apikey: key,
          alldebrid_username: userInfo.username
        }, () => {
          currentApiKey = key;
          setTimeout(() => {
            saveKeyBtn.disabled = false;
            saveKeyBtn.textContent = "Validar y Guardar";
            configFeedback.textContent = '';
            apiKeyInput.value = '';
            showFilesView(key, userInfo.username);
          }, 1000);
        });
      } else { throw new Error('Key inválida'); }
    } catch (error) {
      saveKeyBtn.disabled = false;
      saveKeyBtn.textContent = "Validar y Guardar";
      showFeedback(`❌ ${error.message}`, 'error');
    }
  });

  settingsBtn.addEventListener('click', showConfigView);
  refreshBtn.addEventListener('click', () => { if (currentApiKey) fetchFiles(currentApiKey); });

  // --- VISTAS ---



  function showFilesView(apiKey, username = 'Usuario') {
    configView.classList.add('hidden');
    filesView.classList.remove('hidden');
    document.body.classList.remove('config-active');

    if (username) userWelcome.textContent = `${username}`;
    fetchFiles(apiKey);
  }

  function showFeedback(msg, type) {
    configFeedback.textContent = msg;
    configFeedback.className = 'feedback-msg ' + `feedback-${type}`;
  }

  // --- API FICHEROS ---
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
        if (data.error && data.error.code.includes('AUTH')) showConfigView();
        throw new Error(data.error ? data.error.message : 'Error desconocido');
      }
    } catch (error) {
      loadingDiv.classList.add('hidden');
      errorMsg.textContent = error.message;
      errorMsg.classList.remove('hidden');
    }
  }

  function processAndRender(magnets) {
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
    switchTab(activeTab);
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