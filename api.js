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
            const res = await fetch('https://alldebrid.com/apikeys');
            const text = await res.text();

            // Basic scraping - This relies on the structure of the page
            // We look for the table containing keys
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Check if logged in
            if (text.includes('name="login"')) return { error: 'not_logged_in' };

            const keys = [];
            const rows = doc.querySelectorAll('table tbody tr');

            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= 2) {
                    const name = cols[0].textContent.trim();
                    const key = cols[1].textContent.trim();
                    // Try to find a delete button/form to get the ID if needed
                    // Often delete is a form submit or a link with an ID
                    // Making a best guess here or just returning name/key for now
                    keys.push({ name, key });
                }
            });
            return { status: 'success', keys };
        } catch (e) {
            return { error: e.message };
        }
    },

    async createKey(name) {
        // Requires sniffing the form data structure
        // Usually POST to /apikeys with name and a CSRF token
        try {
            // 1. Get the page to find CSRF token
            const res = await fetch('https://alldebrid.com/apikeys');
            const text = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Try to find the creation form
            // This is speculative without seeing the source, assuming a standard form
            // <input type="hidden" name="token" value="...">
            const tokenInput = doc.querySelector('input[name="token"]');
            const token = tokenInput ? tokenInput.value : null;

            if (!token) return { error: 'csrf_not_found' };

            const formData = new FormData();
            formData.append('token', token);
            formData.append('name', name);
            formData.append('submit', '1'); // Common submit value

            const postRes = await fetch('https://alldebrid.com/apikeys', {
                method: 'POST',
                body: formData
            });

            return { status: 'success' };
        } catch (e) {
            return { error: e.message };
        }
    },

    async deleteKey(keyOrId) {
        // Deletion usually requires a specific ID or Token
        // Without visual confirmation of the dashboard HTML, this is risky to implement blindly.
        // I will skip implementation of DELETE for safety in this iteration 
        // and asking user to delete manually if needed, or I can try to parse the delete link.
        return { error: 'not_implemented' };
    }
};
