import { CONFIG } from './config.js';
import { AllDebridAPI } from './api.js';

const MENU_ID = "sendToAllDebrid";

// 1. INIT
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "⚡ Enviar a AllDebrid", contexts: ["link"] });
});

// 2. ABRIR GESTOR
chrome.action.onClicked.addListener(async () => {
  const managerUrl = chrome.runtime.getURL("manager.html");
  const tabs = await chrome.tabs.query({ url: managerUrl });
  if (tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: managerUrl });
  }
});

// 3. MENÚ CONTEXTUAL
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_ID && info.linkUrl) {
    await processLinkOrTorrent(info.linkUrl);
  }
});

// 4. INTERCEPTOR DE DESCARGAS
chrome.downloads.onCreated.addListener((downloadItem) => {
  // Detectar .torrent por extensión o MIME
  const isTorrent = downloadItem.filename.toLowerCase().endsWith('.torrent') ||
    downloadItem.mime === 'application/x-bittorrent';

  if (isTorrent) {
    // 1. Pausamos para que no avance
    chrome.downloads.pause(downloadItem.id);

    // 2. Preguntamos
    chrome.notifications.create(`torrent-ask-${downloadItem.id}`, {
      type: 'basic',
      iconUrl: 'icon.png',
      title: '📦 Torrent Detectado',
      message: `¿Enviar "${downloadItem.filename}" a AllDebrid?`,
      buttons: [{ title: '⚡ Sí, enviar a Nube' }, { title: '💾 No, bajar local' }],
      priority: 2,
      requireInteraction: true
    });
  }
});

// 5. RESPUESTA NOTIFICACIÓN
chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
  if (notifId.startsWith('torrent-ask-')) {
    const downloadId = parseInt(notifId.split('-')[2]);

    if (btnIdx === 0) {
      // --- OPCIÓN SÍ: ENVIAR ---
      chrome.downloads.search({ id: downloadId }, (results) => {
        if (results && results.length > 0) {
          const item = results[0];
          const urlToFetch = item.finalUrl || item.url;

          // 1. Cancelamos y Borramos la descarga del navegador INMEDIATAMENTE
          // Esto evita que el navegador siga intentando bajarlo al disco
          chrome.downloads.cancel(downloadId, () => {
            if (chrome.runtime.lastError) console.log("Error cancelando:", chrome.runtime.lastError);
            chrome.downloads.erase({ id: downloadId });
          });

          // 2. Procesamos la subida internamente
          processLinkOrTorrent(urlToFetch);
        }
      });
    } else {
      // --- OPCIÓN NO: BAJAR LOCAL ---
      chrome.downloads.resume(downloadId);
    }
    chrome.notifications.clear(notifId);
  }
});

// --------------------------------------------------------
// LÓGICA CORE DE SUBIDA
// --------------------------------------------------------

async function processLinkOrTorrent(url) {
  if (url.startsWith('magnet:')) {
    // Es Magnet: Se envía la URL tal cual
    await uploadMagnetUrl(url);
  } else {
    // Es .torrent (http o blob): Descargamos el binario y subimos el archivo
    await uploadTorrentFile(url);
  }
}

// A) Subir Magnet (Método URL)
async function uploadMagnetUrl(magnet) {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  notify("⏳ Procesando Magnet...", "Enviando enlace...");

  try {
    const json = await AllDebridAPI.uploadMagnet(apiKey, magnet);
    handleApiResponse(json);
  } catch (e) {
    notify("❌ Error", e.message);
  }
}

// B) Subir Fichero .torrent (Método POST FILE)
async function uploadTorrentFile(fileUrl) {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  notify("⏳ Descargando .torrent...", "Obteniendo archivo para subir...");

  try {
    // 1. Descargar el archivo a la memoria de la extensión
    // Al hacerlo desde background, usamos las cookies del navegador automágicamente
    const fileRes = await fetch(fileUrl);

    if (!fileRes.ok) throw new Error(`No se pudo descargar el .torrent original (${fileRes.status})`);

    const blob = await fileRes.blob();

    notify("⏳ Subiendo a AllDebrid...", "Enviando archivo...");

    // 2. Subir archivo físico
    const json = await AllDebridAPI.uploadTorrentFile(apiKey, blob);
    handleApiResponse(json);

  } catch (e) {
    console.error(e);
    notify("❌ Error de Subida", "No se pudo procesar el archivo .torrent. Posiblemente requiere login o captcha.");
  }
}

// --- UTILIDADES ---

async function getApiKey() {
  const data = await chrome.storage.local.get(['alldebrid_apikey']);
  if (!data.alldebrid_apikey) {
    notify("⚠️ Falta Configuración", "Guarda tu API Key en la extensión.");
    return null;
  }
  return data.alldebrid_apikey;
}

function handleApiResponse(json) {
  if (json.status === 'success') {
    // La respuesta de 'upload/file' difiere ligeramente o puede traer varios
    const magnets = json.data.magnets || json.data.files;

    if (magnets && magnets.length > 0) {
      const item = magnets[0];
      if (item.error) notify("❌ Error API", item.error.message);
      else notify("✅ ¡Éxito!", `"${item.name}" añadido correctamente.`);
    } else {
      notify("✅ Enviado", "El torrent se ha añadido.");
    }
  } else {
    notify("❌ Error", json.error ? json.error.message : "Desconocido");
  }
}

function notify(title, msg) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: title,
    message: msg,
    priority: 1
  });
}