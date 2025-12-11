import { Utils } from '../utils.js';

export const DOMRenderer = {
    renderFiles(items, container, type, callbacks) {
        // callbacks: { onDelete, onRestart, onDetails }
        if (items.length === 0) {
            container.innerHTML = '<li style="text-align:center; padding:40px; color:#555">Nada por aquí.</li>';
            return;
        }

        items.forEach(magnet => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.dataset.name = magnet.filename;

            const isReady = magnet.statusCode === 4;
            const mainRow = document.createElement('div');
            mainRow.className = 'file-row-main';

            if (type === 'active') {
                const perc = (magnet.size > 0) ? ((magnet.downloaded / magnet.size) * 100).toFixed(1) : 0;
                const speed = magnet.downloadSpeed ? Utils.formatBytes(magnet.downloadSpeed) + '/s' : '0 B/s';
                const seeds = magnet.seeders ? magnet.seeders : 0;

                mainRow.innerHTML = `
          <div class="file-info">
             <span class="file-name" style="cursor:default">${magnet.filename}</span>
             <div class="progress-section">
                <div class="progress-header">
                   <span>${Utils.formatBytes(magnet.downloaded)} / ${Utils.formatBytes(magnet.size)}</span>
                   <span>${perc}%</span>
                </div>
                <div class="progress-track">
                   <div class="progress-fill" style="width: ${perc}%"></div>
                </div>
                <div class="progress-stats">
                   <span class="stat-chip" title="Velocidad">🚀 ${speed}</span>
                   <span class="stat-chip" title="Semillas">🌱 ${seeds}</span>
                   <span class="stat-chip" title="Estado">${magnet.status}</span>
                </div>
             </div>
          </div>
          <div class="file-actions">
             <button class="btn-action btn-restart" title="Reiniciar">🔄</button>
             <button class="btn-action btn-delete" title="Eliminar">🗑️</button>
          </div>
        `;
            } else {
                mainRow.innerHTML = `
          <div class="file-info">
              <span class="file-name" title="Clic para ver enlaces">${magnet.filename}</span>
              <span class="file-meta">${Utils.formatBytes(magnet.size)} • ${new Date(magnet.uploadDate * 1000).toLocaleDateString()}</span>
          </div>
          <div class="file-actions">
             <span class="status-badge status-ready">Completado</span>
             <button class="btn-action btn-delete" title="Eliminar">🗑️</button>
          </div>
        `;
            }

            const fileInfoBlock = mainRow.querySelector('.file-info');
            const deleteBtn = mainRow.querySelector('.btn-delete');

            deleteBtn.onclick = (e) => { e.stopPropagation(); callbacks.onDelete(magnet.id); };

            if (type === 'active') {
                const restartBtn = mainRow.querySelector('.btn-restart');
                restartBtn.onclick = (e) => { e.stopPropagation(); callbacks.onRestart(magnet.id); };
            }

            if (isReady && magnet.links && magnet.links.length > 0) {
                const nameSpan = mainRow.querySelector('.file-name');
                if (type === 'completed') {
                    nameSpan.onclick = () => callbacks.onDetails(li, magnet.links);
                }
            }

            li.appendChild(mainRow);
            container.appendChild(li);
        });
    },

    renderLinksBox(box, links, callbacks) {
        // callbacks: { onCast } 
        // Note: we need to pass callbacks from toggleDetails down to here.
        const videoExts = ['mkv', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];

        links.forEach(linkObj => {
            const ext = linkObj.filename.split('.').pop().toLowerCase();
            const isVideo = videoExts.includes(ext);

            const row = document.createElement('div');
            row.className = `link-row ${isVideo ? 'is-video' : ''}`;
            const icon = isVideo ? '🎬' : '📄';

            let actionsHtml = `<span class="link-meta">${Utils.formatBytes(linkObj.size)}</span>
                               <button class="btn-copy" title="Copiar enlace">📋</button>`;

            if (isVideo) {
                actionsHtml = `<button class="btn-action-small btn-cast-file" title="Reproducir (Play)">📺</button>
                                ${actionsHtml}`;
            }

            row.innerHTML = `
        <div class="link-row-wrapper">
            <div class="link-filename">
                <a href="${linkObj.link}" target="_blank" title="Descargar">${icon} ${linkObj.filename}</a>
            </div>
        </div>
        <div class="link-actions">
            ${actionsHtml}
        </div>
      `;

            // Copy button logic
            row.querySelector('.btn-copy').onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(linkObj.link).then(() => {
                    const btn = e.target;
                    const original = btn.textContent;
                    btn.textContent = '✅';
                    setTimeout(() => btn.textContent = original, 1000);
                });
            };

            if (isVideo) {
                const castBtn = row.querySelector('.btn-cast-file');
                if (castBtn) {
                    castBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (callbacks && callbacks.onCast) {
                            callbacks.onCast(linkObj, 'play');
                        }
                    };
                }
            }

            box.appendChild(row);
        });
    },

    renderKeys(keys, container, callbacks) {
        // callbacks: { onUse, onDelete, onEdit }
        container.innerHTML = '';
        if (keys.length === 0) {
            container.innerHTML = '<div style="color:#777; padding:20px; grid-column: 1/-1; text-align:center;">No se encontraron claves.</div>';
            return;
        }

        keys.forEach(k => {
            const div = document.createElement('div');
            div.className = 'key-card-item';
            div.innerHTML = `
            <div class="key-icon">🔑</div>
            <div class="key-content">
                <div class="key-card-head">
                    <div class="key-name" title="${k.name}">${k.name}</div>
                    <div class="key-tools">
                        <span class="btn-icon-small btn-edit" title="Renombrar">✏️</span>
                        <span class="btn-icon-small btn-delete" title="Eliminar">🗑️</span>
                    </div>
                </div>
                <span class="key-val">${k.key.substring(0, 12)}...</span>
            </div>
            <div class="key-actions">
                <button class="btn-use-key">USAR</button>
            </div>
          `;

            div.querySelector('.btn-use-key').onclick = () => callbacks.onUse(k.key);

            div.querySelector('.btn-delete').onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`¿Eliminar clave "${k.name}"?`)) {
                    callbacks.onDelete(k.key);
                }
            };

            div.querySelector('.btn-edit').onclick = async (e) => {
                e.stopPropagation();
                const newName = prompt("Nuevo nombre para la clave:", k.name);
                if (newName && newName !== k.name) {
                    callbacks.onEdit(k.key, newName);
                }
            };

            container.appendChild(div);
        });
    },

    renderTVList(tvs, container, callbacks) {
        // callbacks: { onDelete }
        container.innerHTML = '';
        if (tvs.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#666; padding:20px;">No hay TVs configuradas.<br>Añade una abajo 👇</div>';
            return;
        }

        tvs.forEach(tv => {
            const card = document.createElement('div');
            card.className = 'tv-card-item';

            card.innerHTML = `
        <div style="display:flex; align-items:center;">
            <div class="tv-icon-large">📺</div>
            <div class="tv-info">
                <div class="tv-name-display">${Utils.escapeHtml(tv.name)}</div>
                <div class="tv-ip-display">${Utils.escapeHtml(tv.ip)}</div>
            </div>
        </div>
        <div class="tv-actions">
           <button class="btn-icon-small btn-delete" title="Eliminar">🗑️</button>
        </div>
      `;

            // Event listener for delete
            card.querySelector('.btn-delete').addEventListener('click', () => {
                if (confirm(`¿Eliminar TV "${tv.name}"?`)) {
                    callbacks.onDelete(tv.id);
                }
            });

            container.appendChild(card);
        });
    }
};
