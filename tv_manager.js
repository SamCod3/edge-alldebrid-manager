export class TVManager {
    static CONFIG_KEY = 'alldebrid_tvs';

    // Standard DLNA Service URNs
    static SERVICE_TYPES = [
        'urn:schemas-upnp-org:service:AVTransport:1',
        'urn:schemas-upnp-org:service:RenderingControl:1'
    ];

    constructor() {
        this.tvs = [];
    }

    /**
     * Loads TVs from Chrome storage.
     */
    async load() {
        return new Promise((resolve) => {
            chrome.storage.local.get([TVManager.CONFIG_KEY], (result) => {
                this.tvs = result[TVManager.CONFIG_KEY] || [];
                resolve(this.tvs);
            });
        });
    }

    /**
     * Saves TVs to Chrome storage.
     */
    async save() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [TVManager.CONFIG_KEY]: this.tvs }, () => {
                resolve();
            });
        });
    }

    /**
     * Adds a new TV.
     * @param {string} name Friendly name
     * @param {string} ip IP Address
     */
    async addTV(name, ip, type = 'dlna', port = 8080) {
        if (!name || !ip) throw new Error("Nombre e IP son obligatorios.");
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) throw new Error("Formato de IP inválido.");

        this.tvs.push({
            id: Date.now().toString(),
            name,
            ip,
            type: type,
            port: parseInt(port) || 8080
        });
        await this.save();
        return this.tvs;
    }

    /**
     * Removes a TV by ID.
     * @param {string} id TV ID
     */
    async removeTV(id) {
        this.tvs = this.tvs.filter(tv => tv.id !== id);
        await this.save();
        return this.tvs;
    }

    /**
     * Returns all configured TVs.
     */
    getAll() {
        return this.tvs;
    }

    /**
     * Casts a video URL to a specific TV IP using DLNA/UPnP.
     * @param {string} videoUrl Direct URL to the video file
     * @param {string} tvIp TV IP Address
     */
    async castToTV(videoUrl, tv) {
        if (tv.type === 'kodi') {
            return this._castToKodi(videoUrl, tv);
        } else {
            return this._castToDLNA(videoUrl, tv.ip);
        }
    }

    async _castToKodi(videoUrl, tv) {
        const url = `http://${tv.ip}:${tv.port}/jsonrpc`;
        const headers = { 'Content-Type': 'application/json' };

        // Helper to send request
        const send = async (method, params = {}, id = 1) => {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ jsonrpc: "2.0", method, params, id })
            });
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            return await res.json();
        };

        try {
            // 1. Check if Playing
            const activeRes = await send("Player.GetActivePlayers");
            const isPlaying = activeRes.result && activeRes.result.length > 0;

            if (isPlaying) {
                // 2a. Queue (Playlist.Add)
                console.log(`[Cast] Kodi active, queuing to playlist 1...`);
                // Playlist 1 is typically Video
                await send("Playlist.Add", { playlistid: 1, item: { file: videoUrl } });
                return { status: 'success', queued: true };
            } else {
                // 2b. Play Immediately (Player.Open)
                console.log(`[Cast] Kodi idle, playing immediately...`);
                await send("Player.Open", { item: { file: videoUrl } });
                return { status: 'success', queued: false };
            }
        } catch (error) {
            console.error("[Cast] Kodi Error:", error);
            return { status: 'error', error: error.message };
        }
    }

    async _castToDLNA(videoUrl, tvIp) {
        // ... existing castToTV code ...
        // 1. Generate Metadata
        const metadata = this._generateMetadata(videoUrl);

        // 2. Construct the SetAVTransportURI action
        const setUriBody = this._buildSoapBody('SetAVTransportURI', {
            InstanceID: '0',
            CurrentURI: videoUrl,
            CurrentURIMetaData: metadata
        });

        const controlUrl = `http://${tvIp}:9197/upnp/control/AVTransport1`;

        try {
            console.log(`[Cast] Setting URI on ${tvIp}...`);
            await this._sendSoapRequest(controlUrl, 'SetAVTransportURI', setUriBody);

            // 3. Construct Play action
            try {
                const playBody = this._buildSoapBody('Play', {
                    InstanceID: '0',
                    Speed: '1'
                });
                console.log(`[Cast] Sending Play command to ${tvIp}...`);
                await this._sendSoapRequest(controlUrl, 'Play', playBody);
            } catch (playError) {
                const msg = playError.message || playError.toString();
                if (!msg.includes('701') && !msg.includes('Transition not available')) {
                    console.warn("[Cast] Play warning:", playError);
                }
            }

            return { status: 'success' };
        } catch (error) {
            console.error("[Cast] Error:", error);
            return { status: 'error', error: error.message };
        }
    }

    _generateMetadata(url) {
        let filename = url.split('/').pop() || 'video';
        try { filename = decodeURIComponent(filename); } catch (e) { }

        // Clean the title
        const title = this._cleanTitle(filename);

        const ext = filename.split('.').pop().toLowerCase();
        let mime = 'video/mp4';
        if (ext === 'mkv') mime = 'video/x-matroska';
        if (ext === 'avi') mime = 'video/x-msvideo';
        if (ext === 'm4v') mime = 'video/mp4';
        if (ext === 'webm') mime = 'video/webm';

        // ProtocolInfo: Use simple compatibility flags
        const protocolInfo = `http-get:*:${mime}:DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000`;

        // Note: Do not escape the XML tags here (< >). The _buildSoapBody function will escape the entire string.
        // However, the content INSIDE the XML tags (like filename and URL) must be escaped relative to THIS XML.
        return `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
<item id="0" parentID="-1" restricted="1">
<dc:title>${this._escapeXml(title)}</dc:title>
<upnp:class>object.item.videoItem</upnp:class>
<res protocolInfo="${protocolInfo}">${this._escapeXml(url)}</res>
</item>
</DIDL-Lite>`;
    }

    _cleanTitle(filename) {
        // 1. Remove extension
        let name = filename.replace(/\.[^/.]+$/, "");

        // 2. Replace dots/underscores with spaces
        name = name.replace(/[._]/g, " ");

        // 3. Common trash patterns to remove (case insensitive)
        const patterns = [
            /\b(1080p|720p|2160p|4k|uhd|fhd|hd)\b/gi,
            /\b(x264|x265|h264|h265|hevc|avc)\b/gi,
            /\b(bluray|web-dl|webrip|hdtv|bdrip|brrip|dvdrip)\b/gi,
            /\b(aac|ac3|eac3|dts|truehd|atmos|mp3|flac)\b/gi,
            /\b(hdr|hdr10|dv|dolby|vision|10bit|8bit)\b/gi,
            /\b(5\.1|7\.1|2\.0)\b/g,
            // Removed SxxExx pattern to preserve episode info
            // Let's remove group names often at the end like "-RARBG", "-AMZN"
            /(-[a-z0-9]+)$/yi
        ];

        patterns.forEach(p => name = name.replace(p, ""));

        // 4. Clean up empty brackets/parentheses caused by removal of content inside them
        // Pattern matches () or [] with only whitespace or symbols inside
        name = name.replace(/\(\s*[-\.]*\s*\)/g, "");
        name = name.replace(/\[\s*[-\.]*\s*\]/g, "");

        // 5. Cleanup extra spaces and leading/trailing dashes/dots
        name = name.replace(/\s+/g, " ");
        name = name.replace(/^[\s\.\-_]+|[\s\.\-_]+$/g, "");

        // Restore Season/Episode formatting if it got messed up (e.g. "S01 E01" -> "S01E01")
        // Simple pass: if name becomes empty, revert to filename
        if (!name || name.length < 3) return filename;

        return name;
    }

    /**
     * Helper to build SOAP XML body.
     */
    _buildSoapBody(action, args) {
        let argsXml = '';
        for (const [key, value] of Object.entries(args)) {
            argsXml += `<${key}>${this._escapeXml(value)}</${key}>`;
        }

        return `<?xml version="1.0" encoding="utf-8"?>
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <s:Body>
        <u:${action} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
          ${argsXml}
        </u:${action}>
      </s:Body>
    </s:Envelope>`;
    }

    /**
     * Sends the SOAP request using fetch.
     */
    async _sendSoapRequest(url, action, body) {
        // Note: This relies on the extension having permission to access the TV's IP.
        // Ensure manifest.json has appropriate permissions (e.g., <all_urls> or specific IPs if possible).

        const headers = {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': `"urn:schemas-upnp-org:service:AVTransport:1#${action}"`
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`SOAP Request failed (${response.status}): ${text}`);
        }

        return response;
    }

    _escapeXml(unsafe) {
        return unsafe.toString().replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }
}
