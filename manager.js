document.addEventListener('DOMContentLoaded', () => {
  // --- Elementos del DOM ---
  const configView = document.getElementById('config-view');
  const filesView = document.getElementById('files-view');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const configFeedback = document.getElementById('config-feedback');
  const searchInput = document.getElementById('search-input');
  const fileList = document.getElementById('file-list');
  const loadingDiv = document.getElementById('loading');
  const errorMsg = document.getElementById('error-msg');
  const noResultsDiv = document.getElementById('no-results');
  const settingsBtn = document.getElementById('settings-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const userWelcome = document.getElementById('user-welcome');
  const filesCount = document.getElementById('files-count');

  // Constantes
  const AGENT_NAME = "EdgeExtensionManager"; 
  let currentApiKey = '';

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
  }

  // --- BÚSQUEDA ---
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.file-item');
    let visibleCount = 0;
    items.forEach(item => {
      const name = item.querySelector('.file-name').textContent.toLowerCase();
      if (name.includes(term)) {
        item.style.display = 'block';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });
    if (visibleCount === 0 && items.length > 0) noResultsDiv.classList.remove('hidden');
    else noResultsDiv.classList.add('hidden');
  });

  // --- EVENTOS GLOBALES ---
  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) return showFeedback('Introduce una API Key válida.', 'error');
    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = "Validando...";
    showFeedback('Conectando...', 'loading');
    try {
      const userInfo = await validateApiKey(key);
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
  async function validateApiKey(key) {
    const response = await fetch(`https://api.alldebrid.com/v4/user?agent=${AGENT_NAME}&apikey=${key}`);
    const data = await response.json();
    return (data.status === 'success') ? data.data.user : null;
  }

  function showConfigView() {
    configView.classList.remove('hidden');
    filesView.classList.add('hidden');
    refreshBtn.style.display = 'none';
    searchInput.disabled = true;
  }

  function showFilesView(apiKey, username = 'Usuario') {
    configView.classList.add('hidden');
    filesView.classList.remove('hidden');
    refreshBtn.style.display = 'inline-block';
    searchInput.disabled = false;
    if (username) userWelcome.textContent = `${username}`;
    fetchFiles(apiKey);
  }

  function showFeedback(msg, type) {
    configFeedback.textContent = msg;
    configFeedback.className = 'feedback-msg ' + `feedback-${type}`;
  }

  // --- API FICHEROS ---
  async function fetchFiles(apiKey) {
    fileList.innerHTML = '';
    loadingDiv.classList.remove('hidden');
    errorMsg.classList.add('hidden');
    noResultsDiv.classList.add('hidden');
    searchInput.value = '';

    try {
      const response = await fetch(`https://api.alldebrid.com/v4/magnet/status?agent=${AGENT_NAME}&apikey=${apiKey}`);
      const data = await response.json();
      loadingDiv.classList.add('hidden');
      if (data.status === 'success') {
        renderFiles(data.data.magnets);
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

  function renderFiles(magnets) {
    if (!magnets || magnets.length === 0) {
      fileList.innerHTML = '<li style="text-align:center; padding:40px; color:#777">No hay ficheros.</li>';
      filesCount.textContent = '0'; return;
    }
    filesCount.textContent = `${magnets.length}`;

    magnets.forEach(magnet => {
      const li = document.createElement('li');
      li.className = 'file-item';
      
      const isReady = magnet.statusCode === 4;
      const statusClass = isReady ? 'status-ready' : 'status-downloading';
      const statusText = isReady ? 'Completado' : 'Descargando';
      
      const mainRow = document.createElement('div');
      mainRow.className = 'file-row-main';
      mainRow.innerHTML = `
        <div class="file-info">
            <span class="file-name" title="${isReady ? 'Clic para ver enlaces' : 'No disponible'}">${magnet.filename}</span>
            <span class="file-meta">${formatBytes(magnet.size)} • ${new Date(magnet.uploadDate * 1000).toLocaleDateString()}</span>
        </div>
        <div class="file-actions">
           <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
      `;

      // Toggle Switch
      const nameSpan = mainRow.querySelector('.file-name');
      if (isReady && magnet.links && magnet.links.length > 0) {
        nameSpan.onclick = () => toggleDetails(li, magnet.links);
      } else {
        nameSpan.classList.add('disabled');
      }

      // Borrar
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-action btn-delete';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'Eliminar';
      deleteBtn.onclick = (e) => { e.stopPropagation(); deleteMagnet(magnet.id); };
      
      mainRow.querySelector('.file-actions').appendChild(deleteBtn);
      li.appendChild(mainRow);
      fileList.appendChild(li);
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
          const res = await fetch(`https://api.alldebrid.com/v4/link/unlock?agent=${AGENT_NAME}&apikey=${currentApiKey}&link=${encodeURIComponent(linkObj.link)}`);
          const json = await res.json();
          if (json.status === 'success') return { ...linkObj, link: json.data.link };
        } catch (e) {}
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
            <span class="link-meta">${formatBytes(linkObj.size)}</span>
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

  async function deleteMagnet(id) {
    if (!confirm('¿Seguro que quieres eliminar este fichero?')) return;
    try {
      const res = await fetch(`https://api.alldebrid.com/v4/magnet/delete?agent=${AGENT_NAME}&apikey=${currentApiKey}&id=${id}`);
      const data = await res.json();
      if (data.status === 'success') fetchFiles(currentApiKey);
    } catch (e) { alert('Error de red'); }
  }

  function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
});