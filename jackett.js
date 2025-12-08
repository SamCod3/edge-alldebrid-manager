
export const JackettAPI = {
    async getIndexers(url, apiKey) {
        // Endpoint: /api/v2.0/indexers/all/results/torznab/api?apikey=...&t=indexers
        // We use 'all' to get the configured list.
        const cleanUrl = url.replace(/\/$/, "");
        const endpoint = `${cleanUrl}/api/v2.0/indexers/all/results/torznab/api?apikey=${apiKey}&t=indexers&caps=1`;

        try {
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error(`Jackett Error: ${res.status}`);
            const text = await res.text();

            // Jackett returns XML. We need to parse it.
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");

            const indexers = [];
            const sites = xmlDoc.getElementsByTagName("indexer");
            for (let i = 0; i < sites.length; i++) {
                const site = sites[i];
                indexers.push({
                    id: site.getAttribute("id"),
                    title: site.getAttribute("title"),
                    link: site.querySelector("link") ? site.querySelector("link").textContent : ""
                });
            }
            return { status: 'success', indexers };
        } catch (e) {
            console.error(e);
            return { error: e.message };
        }
    },

    async search(url, apiKey, query, indexers = ['all']) {
        // We search 'all' by default or specific indexers. 
        // For simplicity, we'll start with 'all'.
        const cleanUrl = url.replace(/\/$/, "");
        // Endpoint: ...&t=search&q=query
        const endpoint = `${cleanUrl}/api/v2.0/indexers/all/results/torznab/api?apikey=${apiKey}&t=search&q=${encodeURIComponent(query)}`;

        try {
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error(`Search Error: ${res.status}`);
            const text = await res.text();

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");

            const items = xmlDoc.getElementsByTagName("item");
            const results = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const torznabAttrs = item.getElementsByTagName("torznab:attr");
                let seeders = 0;
                let peers = 0;
                let downloadVolumeFactor = 1;

                // Extract seeds/peers from torznab attributes
                for (let j = 0; j < torznabAttrs.length; j++) {
                    const name = torznabAttrs[j].getAttribute("name");
                    const val = torznabAttrs[j].getAttribute("value");
                    if (name === "seeders") seeders = parseInt(val);
                    if (name === "peers") peers = parseInt(val);
                    if (name === "downloadvolumefactor") downloadVolumeFactor = parseFloat(val);
                }

                let catId = item.querySelector("category")?.textContent || "";
                let catName = getCategoryName(catId);

                results.push({
                    title: item.querySelector("title")?.textContent || "Sin título",
                    link: item.querySelector("link")?.textContent, // Usually .torrent or magnet
                    size: parseInt(item.querySelector("size")?.textContent || "0"),
                    pubDate: item.querySelector("pubDate")?.textContent,
                    indexer: item.querySelector("jackettindexer")?.textContent || "Unknown",
                    category: catName,
                    seeders,
                    peers,
                    isFreeleech: downloadVolumeFactor === 0
                });
            }

            // Sort by seeders desc
            results.sort((a, b) => b.seeders - a.seeders);

            return { status: 'success', results };
        } catch (e) {
            return { error: e.message };
        }
    }
};

function getCategoryName(id) {
    if (!id) return "Other";
    const n = parseInt(id, 10);
    if (n >= 1000 && n < 2000) return "Console";
    if (n === 2000) return "Movies";
    if (n === 2030) return "Movies/SD";
    if (n === 2040) return "Movies/HD";
    if (n === 2045) return "Movies/UHD";
    if (n === 2060) return "Movies/3D";
    if (n > 2000 && n < 3000) return "Movies";
    if (n === 3000) return "Audio";
    if (n >= 3000 && n < 4000) return "Audio";
    if (n >= 4000 && n < 5000) return "PC";
    if (n === 5000) return "TV";
    if (n === 5030) return "TV/SD";
    if (n === 5040) return "TV/HD";
    if (n === 5045) return "TV/UHD";
    if (n > 5000 && n < 6000) return "TV";
    if (n >= 6000 && n < 7000) return "XXX";
    if (n >= 7000 && n < 8000) return "Other";
    if (n >= 8000) return "Books";
    return id; // Fallback to ID
}
