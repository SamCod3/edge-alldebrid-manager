import { AllDebridAPI, DashboardAPI } from '../api.js';
import { DOMRenderer } from '../ui/renderer.js';
import { Toast } from '../ui/toast.js';

export class KeyController {
    constructor(callbacks) {
        this.onAuthSuccess = callbacks.onAuthSuccess;

        // DOM Elements
        this.apiKeyInput = document.getElementById('api-key-input');
        this.saveKeyBtn = document.getElementById('save-key-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.configView = document.getElementById('config-view');
        this.paramElements = {
            kmList: document.getElementById('km-list'),
            kmLoading: document.getElementById('km-loading'),
            kmLoginReq: document.getElementById('km-login-req'),
            kmNewName: document.getElementById('km-new-name'),
            kmCreateBtn: document.getElementById('km-create-btn'),
            kmRefreshBtn: document.getElementById('km-refresh-btn')
        };
    }

    init() {
        // Save Key Listener
        this.saveKeyBtn.addEventListener('click', () => this.handleSave());

        // Dashboard Listeners
        this.paramElements.kmCreateBtn.addEventListener('click', () => this.handleCreateKey());
        if (this.paramElements.kmRefreshBtn) {
            this.paramElements.kmRefreshBtn.addEventListener('click', () => this.loadDashboardKeys());
        }

        // Settings Button (Show Config)
        this.settingsBtn.addEventListener('click', () => this.showConfig());
    }

    showConfig() {
        this.configView.classList.remove('hidden');
        document.getElementById('files-view').classList.add('hidden');
        document.getElementById('search-view').classList.add('hidden');
        document.body.classList.add('config-active');
        this.loadDashboardKeys();
    }

    async handleSave() {
        const key = this.apiKeyInput.value.trim();
        if (!key) return Toast.show('Introduce una API Key válida.', 'error');

        this.saveKeyBtn.disabled = true;
        this.saveKeyBtn.textContent = "Validando...";
        Toast.show('Conectando...', 'info');

        try {
            const userInfo = await AllDebridAPI.validateApiKey(key);
            if (userInfo && userInfo.username) {
                Toast.show('✅ Éxito', 'success');

                // Save to storage
                chrome.storage.local.set({
                    alldebrid_apikey: key,
                    alldebrid_username: userInfo.username
                }, () => {
                    this.saveKeyBtn.disabled = false;
                    this.saveKeyBtn.textContent = "Guardar";
                    this.apiKeyInput.value = '';

                    // Navigation Callback
                    if (this.onAuthSuccess) this.onAuthSuccess(key, userInfo.username);
                });
            } else {
                throw new Error('La API Key no es válida o falta usuario.');
            }
        } catch (error) {
            console.error(error);
            this.saveKeyBtn.disabled = false;
            this.saveKeyBtn.textContent = "Guardar";
            Toast.show(`❌ ${error.message || 'Error desconocido'}`, 'error');
        }
    }

    async loadDashboardKeys() {
        const { kmList, kmLoading, kmLoginReq } = this.paramElements;
        kmList.innerHTML = '';
        kmLoading.classList.remove('hidden');
        kmLoginReq.classList.add('hidden');

        const res = await DashboardAPI.fetchKeys();
        kmLoading.classList.add('hidden');

        if (res.error === 'not_logged_in') {
            kmLoginReq.classList.remove('hidden');
        } else if (res.keys) {
            DOMRenderer.renderKeys(res.keys, kmList, {
                onUse: (key) => {
                    this.apiKeyInput.value = key;
                    this.handleSave(); // Auto-submit
                },
                onDelete: async (key) => {
                    const r = await DashboardAPI.deleteKey(key);
                    if (r.status === 'success') this.loadDashboardKeys();
                    else Toast.show("Error: " + r.error, 'error');
                },
                onEdit: async (key, name) => {
                    const r = await DashboardAPI.renameKey(key, name);
                    if (r.status === 'success') this.loadDashboardKeys();
                    else Toast.show("Error: " + r.error, 'error');
                }
            });
        }
    }

    async handleCreateKey() {
        const { kmNewName, kmCreateBtn } = this.paramElements;
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
            this.loadDashboardKeys();
        } else {
            Toast.show('Error: ' + (res.error || 'Desconocido'), 'error');
        }
    }
}
