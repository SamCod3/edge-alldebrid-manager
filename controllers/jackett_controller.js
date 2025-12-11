import { JackettAPI } from '../jackett.js';
import { AllDebridAPI } from '../api.js';
import { Utils } from '../utils.js';

export class JackettController {
    constructor(dependencies) {
        this.deps = dependencies; // { trackerDropdown, switchTab, getApiKey, fetchFiles }
        this.config = { url: '', key: '' };
        this.STATUS = {
            CHECKING: { emoji: '🟡', text: 'Comprobando conexión...' },
            ONLINE: { emoji: '🟢', text: 'Online' },
            OFFLINE: { emoji: '🔴', text: 'Offline / Error de conexión / API Key inválida' },
            NONE: { emoji: '⚪', text: 'No configurado (Requiere URL y API Key)' }
        };

        // DOM Elements
        this.els = {
            urlInput: document.getElementById('jackett-url-input'),
            keyInput: document.getElementById('jackett-key-input'),
            saveBtn: document.getElementById('save-jackett-btn'),
            feedback: document.getElementById('jackett-feedback'),
            searchInput: document.getElementById('j-search-input'),
            searchBtn: document.getElementById('j-search-btn'),
            results: document.getElementById('j-results'),
            loading: document.getElementById('j-loading'),
            statusIndicator: document.getElementById('jackett-status'),
            tabStatusIndicator: document.getElementById('jackett-status-tab'),
            tabSearch: document.getElementById('tab-search')
        };
    }

    init() {
        // Listeners
        if (this.els.saveBtn) this.els.saveBtn.addEventListener('click', () => this.saveConfig());
        if (this.els.searchBtn) this.els.searchBtn.addEventListener('click', () => this.search());
        if (this.els.searchInput) this.els.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.search();
        });

        // Load Config
        chrome.storage.local.get(['jackett_url', 'jackett_apikey'], (result) => {
            if (result.jackett_url) {
                this.config.url = result.jackett_url;
                if (this.els.urlInput) this.els.urlInput.value = result.jackett_url;
            } else {
                const defaultUrl = 'http://127.0.0.1:9117/';
                this.config.url = defaultUrl;
                if (this.els.urlInput) this.els.urlInput.value = defaultUrl;
            }

            if (result.jackett_apikey) {
                this.config.key = result.jackett_apikey;
                if (this.els.keyInput) this.els.keyInput.value = result.jackett_apikey;
                this.loadTrackers();
            }

            this.checkStatus();
        });
    }

    saveConfig() {
        const url = this.els.urlInput.value.trim();
        const key = this.els.keyInput.value.trim();

        chrome.storage.local.set({ jackett_url: url, jackett_apikey: key }, () => {
            this.config = { url, key };
            this.els.feedback.textContent = "✅ Guardado";
            setTimeout(() => this.els.feedback.textContent = '', 2000);
            this.loadTrackers();
            this.checkStatus();
        });
    }

    setStatus(state, isOnline = false) {
        // Update Config Indicator
        if (this.els.statusIndicator) {
            this.els.statusIndicator.textContent = state.emoji;
            this.els.statusIndicator.title = state.text;
        }
        // Update Tab Indicator
        if (this.els.tabStatusIndicator) {
            this.els.tabStatusIndicator.textContent = state.emoji;
            this.els.tabStatusIndicator.title = state.text;
            // Hide if not configured
            this.els.tabStatusIndicator.style.display = (state.emoji === '⚪') ? 'none' : 'inline';
        }
        // Update Tab State
        if (this.els.tabSearch) {
            this.els.tabSearch.disabled = !isOnline;
            if (!isOnline) {
                this.els.tabSearch.classList.add('disabled-tab');
                // Use dependency to switch tab if current is search
                // We assume the caller handles the active tab check or we pass activeTab in context
                // For simplicity, we just trigger the switch logic if needed
                // But accessing activeTab global is bad. 
                // Suggestion: The dependency switchTab should handle "if current is search then switch"
                // OR we just expose the state and let main handle it.
                // For now, let's call the generic switch dependency which might force a switch
                // this.deps.switchTab('completed'); // forceful switch might be annoying on load
            } else {
                this.els.tabSearch.classList.remove('disabled-tab');
            }
        }
    }

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
            // If offline and we are on search tab, we should kick user out?
            // Doing this logic here is tricky without state. leaving for Phase 3.
        }
    }

    async loadTrackers() {
        if (!this.config.url || !this.config.key) return;
        const res = await JackettAPI.getIndexers(this.config.url, this.config.key);
        if (res.status === 'success') {
            this.deps.trackerDropdown.render(res.indexers);
        } else {
            console.warn("Error loading indexers:", res.error);
            this.deps.trackerDropdown.render([]);
        }
    }

    async search() {
        const query = this.els.searchInput.value.trim();
        if (!query) return;
        if (!this.config.url || !this.config.key) return Toast.show("Configura Jackett primero en Configuración.", 'warning');

        this.els.loading.classList.remove('hidden');
        this.els.results.innerHTML = '';

        const trackers = this.deps.trackerDropdown.getSelected();
        const res = await JackettAPI.search(this.config.url, this.config.key, query, trackers);
        this.els.loading.classList.add('hidden');

        if (res.status === 'success') {
            this.renderResults(res.results);
        } else {
            this.els.results.innerHTML = `<div style="padding:20px; color:#e74c3c">Error: ${res.error}</div>`;
        }
    }

    renderResults(results) {
        if (!results || results.length === 0) {
            this.els.results.innerHTML = '<div style="padding:20px; color:#777; text-align:center">No se encontraron resultados.</div>';
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

        this.els.results.innerHTML = '';
        this.els.results.appendChild(table);
    }

    async download(item) {
        if (!confirm(`¿Enviar "${item.title}" a AllDebrid?`)) return false;
        const link = item.link;
        const apiKey = this.deps.getApiKey();

        if (!apiKey) {
            Toast.show("No hay API Key de AllDebrid configurada.", 'error');
            return false;
        }

        try {
            let res;
            if (link.startsWith('magnet:')) {
                res = await AllDebridAPI.uploadMagnet(apiKey, link);
            } else {
                const fileRes = await fetch(link);
                if (!fileRes.ok) throw new Error(`Error descargando torrent (${fileRes.status})`);
                const blob = await fileRes.blob();
                res = await AllDebridAPI.uploadTorrentFile(apiKey, blob);
            }

            if (res && res.status === 'success') {
                this.deps.fetchFiles(apiKey).catch(() => { });
                const info = (res.data.magnets && res.data.magnets[0]) || (res.data.files && res.data.files[0]);
                return (info && info.ready) ? 'ready' : 'downloading';
            } else {
                Toast.show("Error AllDebrid: " + (res.error?.message || "Desconocido"), 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            Toast.show("Error de red o CORS al enviar.", 'error');
            return false;
        }
    }
}
