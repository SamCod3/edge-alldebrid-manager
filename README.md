# ☁️ AllDebrid Edge/Chrome Manager

Una extensión moderna y eficiente para gestionar tus descargas de **AllDebrid** directamente desde tu navegador. Intercepta archivos `.torrent` y enlaces magnet, enviándolos automáticamente a la nube, y ofrece un panel de control completo para gestionar tu historial y claves API.

## ✨ Características Principales

*   **⚡ Intercepción Inteligente**: Detecta descargas de archivos `.torrent` y Clicks en enlaces `magnet:`, ofreciendo enviarlos a AllDebrid en lugar de descargarlos localmente.
*   **📊 Panel de Control Completo**:
    *   **Descargas Activas**: Barra de progreso real, velocidad, semillas (seeds) y estado.
    *   **Historial**: Listado de torrents completados con desbloqueo automático de enlaces.
    *   **Buscador**: Filtra instantáneamente tus archivos activos o completados.
*   **🔑 Gestión de API Keys**:
    *   Administra tus claves de AllDebrid sin salir de la extensión.
    *   **Crear, Renombrar y Borrar** claves directamente desde la interfaz.
    *   Diseño aislado para mayor seguridad y claridad.
*   **🎨 UI Premium**: Interfaz oscura, moderna y responsiva, diseñada para integrarse perfectamente con el navegador.

## 🚀 Instalación

Esta extensión está diseñada para cargarse en modo desarrollador (sin empaquetar).

1.  Clona o descarga este repositorio.
2.  Abre tu navegador (Edge o Chrome) y ve a la gestión de extensiones:
    *   **Edge**: `edge://extensions`
    *   **Chrome**: `chrome://extensions`
3.  Activa el **Modo de desarrollador** (interruptor generalmente en la esquina).
4.  Haz clic en **"Cargar descomprimida"** (Load unpacked).
5.  Selecciona la carpeta donde descargaste este código.

## 🛠️ Configuración

1.  Haz clic en el icono de la extensión en tu barra de herramientas.
2.  Si es la primera vez, verás la pantalla de **Configuración**.
3.  Tienes dos opciones:
    *   **Manual**: Pega tu API Key de AllDebrid si ya la tienes.
    *   **Gestor de Claves**: Si has iniciado sesión en la web de AllDebrid en este navegador, verás tus claves actuales. Puedes seleccionar una y darle a **"USAR"**, o crear una nueva específica para este navegador.

## 📖 Uso

### Añadir Torrents
*   **Magnets**: Simplemente haz clic en cualquier enlace magnet. La extensión lo capturará.
*   **Archivos .torrent**: Al intentar descargar un `.torrent`, la extensión pausará la descarga y te preguntará si quieres enviarlo a la nube o descargarlo localmente.
*   **Menú Contextual**: Click derecho en cualquier enlace -> "⚡ Enviar a AllDebrid".

### Gestionar Archivos
Abre la extensión para ver el estado:
*   Pestaña **⬇️ Descargando**: Muestra el progreso. Puedes **Reiniciar** (🔄) o **Eliminar** (🗑️) descargas activas.
*   Pestaña **✅ Completados**: Muestra tus archivos listos. Haz clic en el nombre para **ver los enlaces desbloqueados** listos para bajar o ver en streaming.

## 🔧 Tecnologías

*   Javascript (ES6 Modules)
*   Chrome Extension Manifest V3
*   CSS3 Variables & Flexbox/Grid
*   AllDebrid API v4

---
*Desarrollado con ❤️ para usuarios de AllDebrid.*
