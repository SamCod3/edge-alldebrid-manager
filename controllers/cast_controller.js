import { TVManager } from '../tv_manager.js';
import { Toast } from '../ui/toast.js';

export class CastController {
    constructor() {
        this.tvManager = new TVManager();
        this.activeTvId = null;

        // UI Elements
        this.castMenuContainer = document.getElementById('cast-menu-container');
        this.castMenuBtn = document.getElementById('cast-menu-btn');
        this.castMenuList = document.getElementById('cast-menu-list');

        this.tvList = document.getElementById('tv-list');
        this.tvNameInput = document.getElementById('tv-name-input');
        this.tvIpInput = document.getElementById('tv-ip-input');
        this.tvTypeSelect = document.getElementById('tv-type-select');
        this.tvPortInput = document.getElementById('tv-port-input');
        this.addTvBtn = document.getElementById('add-tv-btn');
    }

    async init() {
        // Load TVs and State
        const savedTvResult = await chrome.storage.local.get(['default_tv_id']);
        const savedTvId = savedTvResult.default_tv_id;

        const tvs = await this.tvManager.load();
        this.renderTVList();
        this.updateCastMenu(tvs, savedTvId);

        this.setupListeners();
    }

    setupListeners() {
        // TV Type Toggle
        this.tvTypeSelect.addEventListener('change', () => {
            if (this.tvTypeSelect.value === 'kodi') {
                this.tvPortInput.classList.remove('hidden');
            } else {
                this.tvPortInput.classList.add('hidden');
            }
        });

        // Add TV
        this.addTvBtn.addEventListener('click', () => this.handleAddTv());

        // Cast Menu Toggle
        this.castMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.castMenuList.classList.toggle('hidden');
        });

        // Close menu/Global click
        document.addEventListener('click', (e) => {
            if (this.castMenuContainer && !this.castMenuContainer.contains(e.target)) {
                this.castMenuList.classList.add('hidden');
            }
        });
    }

    async handleAddTv() {
        const name = this.tvNameInput.value.trim();
        const ip = this.tvIpInput.value.trim();
        const type = this.tvTypeSelect.value;
        const port = this.tvPortInput.value.trim();

        try {
            await this.tvManager.addTV(name, ip, type, port);
            this.renderTVList();
            this.updateCastMenu(this.tvManager.getAll(), this.activeTvId);

            this.tvNameInput.value = '';
            this.tvIpInput.value = '';
            Toast.show('TV Añadida correctamente', 'success');
        } catch (e) {
            Toast.show(e.message, 'error');
        }
    }

    updateCastMenu(tvs, preferredId = null) {
        if (!this.castMenuContainer) return;

        this.castMenuList.innerHTML = '';
        if (tvs.length === 0) {
            this.castMenuContainer.classList.add('hidden');
            this.activeTvId = null;
            return;
        }

        this.castMenuContainer.classList.remove('hidden');

        // Determine Selection
        let selectedTv = tvs.find(t => t.id === preferredId);
        if (!selectedTv) selectedTv = tvs[0];

        this.activeTvId = selectedTv.id;
        chrome.storage.local.set({ default_tv_id: this.activeTvId });

        // Update Button
        this.castMenuBtn.title = `Conectado a: ${selectedTv.name}`;
        this.castMenuBtn.classList.add('active');
        this.castMenuBtn.innerHTML = `<span class="tv-label">${selectedTv.name}</span> 📺`;

        // Render Dropdown Items
        tvs.forEach(tv => {
            const item = document.createElement('div');
            item.className = 'cast-menu-item';
            if (tv.id === this.activeTvId) item.classList.add('selected');
            item.textContent = tv.name;
            item.onclick = (e) => {
                e.stopPropagation();
                this.updateCastMenu(tvs, tv.id);
                this.castMenuList.classList.add('hidden');
            };
            this.castMenuList.appendChild(item);
        });
    }

    renderTVList() {
        const tvs = this.tvManager.getAll();
        this.tvList.innerHTML = '';

        tvs.forEach(tv => {
            const div = document.createElement('div');
            div.className = 'tv-item';
            const typeIcon = tv.type === 'kodi' ? '📦' : '📺';
            const detail = tv.type === 'kodi' ? `${tv.ip}:${tv.port}` : tv.ip;

            div.innerHTML = `
                <div class="tv-info">
                    <span class="tv-name">${typeIcon} ${tv.name}</span>
                    <span class="tv-ip">${detail}</span>
                </div>
                <button class="btn-delete-tv" title="Eliminar">🗑️</button>
            `;

            div.querySelector('.btn-delete-tv').onclick = () => {
                this.tvManager.removeTV(tv.id).then(() => {
                    this.renderTVList();
                    if (this.activeTvId === tv.id) this.activeTvId = null;
                    this.updateCastMenu(this.tvManager.getAll(), this.activeTvId);
                    if (!this.activeTvId) chrome.storage.local.remove('default_tv_id');
                });
            };
            this.tvList.appendChild(div);
        });
    }

    async cast(linkObj) {
        // We only support 'play' action effectively right now, simplified signature
        const tvs = this.tvManager.getAll();
        if (tvs.length === 0) return Toast.show("No hay TVs configuradas. Ve a Configuración.", 'warning');

        let targetTv = tvs.find(t => t.id === this.activeTvId);
        if (!targetTv) {
            targetTv = tvs[0];
            this.updateCastMenu(tvs, tvs[0].id);
        }

        const res = await this.tvManager.castToTV(linkObj.link, targetTv);
        if (res.status === 'success') {
            const msg = res.queued
                ? `⏳ Añadido a la cola de Kodi (${targetTv.name})`
                : `▶️ Reproduciendo en ${targetTv.name}`;
            Toast.show(msg, 'success');
        } else {
            Toast.show("Error: " + res.error, 'error');
        }
    }
}
