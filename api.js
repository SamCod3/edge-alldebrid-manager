import { CONFIG } from './config.js';

export const AllDebridAPI = {
    async validateApiKey(apiKey) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/user?agent=${CONFIG.AGENT_NAME}&apikey=${apiKey}`);
        const data = await response.json();
        return (data.status === 'success') ? data.data.user : null;
    },

    async getMagnets(apiKey) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/magnet/status?agent=${CONFIG.AGENT_NAME}&apikey=${apiKey}`);
        return await response.json();
    },

    async uploadMagnet(apiKey, magnet) {
        const url = `${CONFIG.API_BASE_URL}/magnet/upload?agent=${CONFIG.AGENT_NAME}&apikey=${apiKey}&magnets[]=${encodeURIComponent(magnet)}`;
        const response = await fetch(url);
        return await response.json();
    },

    async uploadTorrentFile(apiKey, blob) {
        const formData = new FormData();
        formData.append('files[]', blob, 'upload.torrent');

        const response = await fetch(`${CONFIG.API_BASE_URL}/magnet/upload/file?agent=${CONFIG.AGENT_NAME}&apikey=${apiKey}`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    },

    async unlockLink(apiKey, link) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/link/unlock?agent=${CONFIG.AGENT_NAME}&apikey=${apiKey}&link=${encodeURIComponent(link)}`);
        return await response.json();
    },

    async restartMagnet(apiKey, id) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/magnet/restart?agent=${CONFIG.AGENT_NAME}&apikey=${apiKey}&id=${id}`);
        return await response.json();
    },

    async deleteMagnet(apiKey, id) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/magnet/delete?agent=${CONFIG.AGENT_NAME}&apikey=${apiKey}&id=${id}`);
        return await response.json();
    }
};

export const DashboardAPI = {
    async fetchKeys() {
        try {
            const res = await fetch('https://alldebrid.com/apikeys', { credentials: 'include' });
            const text = await res.text();

            // Check if logged in
            if (text.includes('name="login"')) return { error: 'not_logged_in' };

            // Strategy 2: Regex parse the specific JS variables
            // var keys = [ ... ];
            const keysMatch = text.match(/var keys = (\[[\s\S]*?\]);/);

            const foundKeys = [];

            if (keysMatch && keysMatch[1]) {
                try {
                    const jsonKeys = JSON.parse(keysMatch[1]);
                    jsonKeys.forEach(k => {
                        foundKeys.push({
                            name: k.name,
                            key: k.apikey
                        });
                    });
                } catch (e) {
                    console.error('Error parsing keys JSON', e);
                }
            }

            return { status: 'success', keys: foundKeys };
        } catch (e) {
            return { error: e.message };
        }
    },

    async createKey(name) {
        try {
            // Based on source, it's a simple POST to /apikeys with 'name'
            // No explicit CSRF token field was found in the static HTML form.
            // We rely on standard cookies 'credentials: include'.

            const formData = new FormData();
            formData.append('name', name);
            // Sometimes forms send 'submit' name with value
            // <input ... name='submit' value='Crear' /> would send submit=Crear? 
            // HTML says: <input ... type='submit' value='Crear' /> (no name attribute on submit button)
            // ensure we mimic exactly if possible. The form has no hidden inputs.

            const postRes = await fetch('https://alldebrid.com/apikeys/', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            // Retrieve text to see if success or error
            // A success usually reloads the page. We can check the response text for the new key name?
            // Or just let the caller reload the list.

            if (postRes.ok) return { status: 'success' };
            return { error: 'Network error: ' + postRes.status };

        } catch (e) {
            return { error: e.message };
        }
    },

    async deleteKey(key) {
        try {
            const formData = new FormData();
            formData.append('delete', key); // Reversed from 'post("/apikeys/", {delete: key})'

            const res = await fetch('https://alldebrid.com/apikeys/', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (res.ok) return { status: 'success' };
            return { error: 'Network error: ' + res.status };
        } catch (e) {
            return { error: e.message };
        }
    },

    async renameKey(key, newName) {
        try {
            // Reversed from: request.open("GET", "/apikeys?apikey=" + ... + "&newName=" + ...)
            const url = `https://alldebrid.com/apikeys?apikey=${encodeURIComponent(key)}&newName=${encodeURIComponent(newName)}`;
            const res = await fetch(url, { credentials: 'include' });
            const text = await res.text();

            if (text === 'Updated') return { status: 'success' };
            return { error: 'Failed to update: ' + text };
        } catch (e) {
            return { error: e.message };
        }
    }
};
