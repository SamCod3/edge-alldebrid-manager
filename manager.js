import { Utils } from './utils.js';
import { AllDebridAPI, DashboardAPI } from './api.js';
import { TrackerDropdown } from './tracker_dropdown.js';
import { Toast } from './ui/toast.js';
import { KeyController } from './controllers/key_controller.js';
import { CastController } from './controllers/cast_controller.js';
import { JackettController } from './controllers/jackett_controller.js';
import { DOMRenderer } from './ui/renderer.js';


document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM ELEMENTS (Global Scope needed for init) ---
  // (Key Management elements moved to KeyController)
  const configBackBtn = document.getElementById('config-back-btn');
  // (TV elements moved to CastController)

  const searchView = document.getElementById('search-view');
  const tabSearch = document.getElementById('tab-search');

  const configView = document.getElementById('config-view');
  const filesView = document.getElementById('files-view');
  // (Key inputs moved to KeyController)
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
  let keyController; // Key Management
  let castController; // Casting & TV Logic
  let jackettController;

  // --- Inicialización ---
  init();

  async function init() {
    // Instantiate Custom Dropdown
    trackerDropdown = new TrackerDropdown('tracker-dropdown-btn', 'tracker-dropdown-list');

    // Initialize Key Controller
    keyController = new KeyController({
      onAuthSuccess: (key, username) => showFilesView(key, username)
    });
    keyController.init();

    // Initialize Jackett Controller
    jackettController = new JackettController({
      trackerDropdown: trackerDropdown,
      switchTab: switchTab,
      getApiKey: () => currentApiKey,
      fetchFiles: fetchFiles
    });
    jackettController.init();

    // Check AllDebrid Auth
    chrome.storage.local.get(['alldebrid_apikey', 'alldebrid_username'], (result) => {
      if (result.alldebrid_apikey) {
        currentApiKey = result.alldebrid_apikey;
        showFilesView(result.alldebrid_apikey, result.alldebrid_username);
      } else {
        keyController.showConfig();
      }
    });

    // Initialize Cast Controller
    castController = new CastController();
    await castController.init();

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

    // Event Delegation for "Close Header Menu" is now inside CastController

    // Global Header Actions
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        fetchFiles(currentApiKey);
        // Always check Jackett status on explicit refresh, so indicators update
        if (jackettController) jackettController.checkStatus();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (keyController) keyController.showConfig();
      });
    }

  }

  // --- REMOVED LEGACY TV LOGIC (Moved to CastController) ---

  // KM Listeners
  // KM Listeners -> Now handled by KeyController
  if (configBackBtn) configBackBtn.addEventListener('click', () => showFilesView(currentApiKey));

  // --- REMOVED LEGACY KEY LOGIC (Moved to KeyController) ---

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
          keyController.showConfig();
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

    const cardCallbacks = {
      onDelete: (id) => deleteMagnet(id),
      onRestart: (id) => restartMagnet(id),
      onDetails: (li, links) => toggleDetails(li, links),
      onCast: handleCast
    };

    DOMRenderer.renderFiles(activeMagnets, fileListActive, 'active', cardCallbacks);
    DOMRenderer.renderFiles(completedMagnets, fileListCompleted, 'completed', cardCallbacks);
  }

  async function handleCast(magnet) {
    // ... (Legacy magnet casting logic, kept for reference or main button)
    // For now, redirect to first video file logic if needed, or keep separate.
    // Let's reuse handleCastFile logic if possible.
    const links = magnet.links || [];
    const videoExts = ['mkv', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const vid = links.find(l => videoExts.includes(l.filename.split('.').pop().toLowerCase()));
    if (!vid) return Toast.show("No se encontró archivo de video.", 'error');

    // We need to unlock it first if not unlocked.
    // handleCastFile expects an unlocked link or will unlock it?
    // toggleDetails unlocks them all. handleCast (from main row) might not have unlocked links.
    // So we keep the unlock logic here.
    try {
      const json = await AllDebridAPI.unlockLink(currentApiKey, vid.link);
      if (json.status !== 'success') throw new Error(json.error?.message || "Error unlocking");
      castController.cast({ ...vid, link: json.data.link });
    } catch (e) { Toast.show(e.message, 'error'); }
  }



  // --- ACCIONES DE IMÁN ---
  async function deleteMagnet(id) {
    if (!confirm('¿Eliminar esta descarga del historial de AllDebrid?')) return;
    const res = await AllDebridAPI.deleteMagnet(currentApiKey, id);
    if (res.status === 'success') {
      fetchFiles(currentApiKey);
    } else {
      Toast.show('Error eliminando: ' + (res.error ? res.error.message : 'Desconocido'), 'error');
    }
  }

  async function restartMagnet(id) {
    if (!confirm('¿Reiniciar esta descarga?')) return;
    const res = await AllDebridAPI.restartMagnet(currentApiKey, id);
    if (res.status === 'success') {
      fetchFiles(currentApiKey);
    } else {
      Toast.show('Error reiniciando: ' + (res.error ? res.error.message : 'Desconocido'), 'error');
    }
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

      // Pass cast callback
      DOMRenderer.renderLinksBox(box, unlockedLinks, {
        onCast: (linkObj) => castController.cast(linkObj)
      });

    } catch (error) {
      box.innerHTML = '<div class="links-loading" style="color:#e74c3c">Error.</div>';
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
});