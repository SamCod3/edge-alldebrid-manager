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

    async deleteMagnet(apiKey, id) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/magnet/delete?agent=${CONFIG.AGENT_NAME}&apikey=${apiKey}&id=${id}`);
        return await response.json();
    }
};
