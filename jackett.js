
export const JackettAPI = {
    async getIndexers(url, apiKey) {
        // Endpoint: /api/v2.0/indexers/all/results/torznab/api?apikey=...&t=indexers
        // We use 'all' to get the configured list.
        const cleanUrl = url.replace(/\/$/, "");
        const endpoint = `${cleanUrl}/api/v2.0/indexers/all/results/torznab/api?apikey=${apiKey}&t=indexers&caps=1&configured=true`;

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
                // Double check configured attribute just in case API ignores param
                // Note: Some older Jackett versions might not strictly obey &configured=true
                // The attribute is usually 'configured' or implied if returned by that query.
                // We'll trust the API query primarily but adding the check is safer if the attribute exists.
                if (site.getAttribute("configured") === "false") continue;

                // Title can be an attribute or a child tag <title>
                let title = site.getAttribute("title");
                if (!title) {
                    const titleNode = site.querySelector("title");
                    if (titleNode) title = titleNode.textContent;
                }

                indexers.push({
                    id: site.getAttribute("id"),
                    title: title || site.getAttribute("id"), // Fallback to ID
                    link: site.querySelector("link") ? site.querySelector("link").textContent : ""
                });
            }
            return { status: 'success', indexers };
        } catch (e) {
            console.error(e);
            return { error: e.message };
        }
    },

    async search(url, apiKey, query, indexers = 'all') {
        const cleanUrl = url.replace(/\/$/, "");

        let indexerList = ['all'];
        if (indexers !== 'all') {
            indexerList = indexers.split(',');
        }

        // Helper to fetch valid results from one endpoint
        const fetchOne = async (idxId) => {
            const endpoint = `${cleanUrl}/api/v2.0/indexers/${idxId}/results/torznab/api?apikey=${apiKey}&t=search&q=${encodeURIComponent(query)}&limit=100`;
            try {
                const res = await fetch(endpoint);
                if (!res.ok) throw new Error(`Status ${res.status}`);
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
                        link: item.querySelector("link")?.textContent,
                        size: parseInt(item.querySelector("size")?.textContent || "0"),
                        pubDate: item.querySelector("pubDate")?.textContent,
                        indexer: item.querySelector("jackettindexer")?.textContent || "Unknown",
                        category: catName,
                        seeders,
                        peers,
                        isFreeleech: downloadVolumeFactor === 0
                    });
                }
                return results;
            } catch (e) {
                console.error(`Error fetching indexer ${idxId}:`, e);
                return []; // Return empty on single tracker failure
            }
        };

        try {
            const promises = indexerList.map(id => fetchOne(id));
            const resultsArrays = await Promise.all(promises);

            // Flatten results
            let allResults = resultsArrays.flat();

            // Deduplicate by title + size (rudimentary)
            // Actually usually unnecessary if trackers are distinct, but good practice
            // We'll skip complex dedup for now to ensure speed.

            // Sort by size desc (largest first)
            allResults.sort((a, b) => b.size - a.size);

            return { status: 'success', results: allResults };
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
