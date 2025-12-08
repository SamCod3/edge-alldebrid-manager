# ☁️ AllDebrid Edge/Chrome Manager

Una extensión moderna y eficiente para gestionar tus descargas de **AllDebrid** directamente desde tu navegador. Intercepta archivos `.torrent` y enlaces magnet, enviándolos automáticamente a la nube, y ofrece un panel de control completo para gestionar tu historial y claves API.

## ✨ Características Principales

*   **⚡ Intercepción Inteligente**: Detecta descargas de archivos `.torrent` y Clicks en enlaces `magnet:`, ofreciendo enviarlos a AllDebrid en lugar de descargarlos localmente.
*   **🧥 Integración con Jackett**:
    *   **Buscador Integrado**: Busca torrents en tus trackers privados/públicos desde la extensión.
    *   **Resultados Detallados**: Tabla con fecha, tracker, nombre, tamaño, categoría y semillas.
    *   **Feedback Visual**:
        *   **Verde**: Archivos ya en la nube (Ready/Cached).
        *   **Rojo**: Archivos enviándose a descargar.
        *   **Check ✔**: Indica qué archivos ya has enviado en esta sesión.
*   **📊 Panel de Control Completo**:
    *   **Descargas Activas**: Barra de progreso real, velocidad, semillas (seeds) y estado.
    *   **Historial**: Listado de torrents completados con desbloqueo automático de enlaces.
    *   **Buscador**: Filtra instantáneamente tus archivos activos o completados.
*   **🔑 Gestión de API Keys**:
    *   Administra tus claves de AllDebrid sin salir de la extensión.
    *   **Crear, Renombrar y Borrar** claves directamente desde la interfaz.

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

### AllDebrid
1.  Haz clic en el icono de la extensión.
2.  Si estás logueado en AllDebrid, verás tus claves en el **Gestor de Claves**. Dale a "USAR" o crea una nueva.
3.  Si no, puedes pegar tu API Key manualmente.

### Jackett (Opcional)
Para buscar torrents directamente:
1.  Ve a Configuración (⚙️).
2.  Introduce la **URL** de tu servidor Jackett (ej. `http://localhost:9117`).
3.  Introduce la **API Key** de Jackett (visible en el dashboard de Jackett).
4.  ¡Listo! Usa la pestaña 🔍 **Buscar**.

## 📖 Uso

### Buscador Jackett
*   Escribe el nombre de la película o serie.
*   Dale al botón ⚡ (Rayo) para enviar a AllDebrid.
*   **Colores**:
    *   **Título Verde**: ¡Está en caché! Descarga instantánea.
    *   **Título Rojo**: Se está descargando en la nube.
    *   **Botón ✔**: Ya enviaste este archivo.

### Añadir Torrents Externos
*   **Magnets**: Click en cualquier enlace magnet.
*   **Archivos .torrent**: La extensión intercepta la descarga y te pregunta.
*   **Menú Contextual**: Click derecho -> "⚡ Enviar a AllDebrid".

### Gestionar Archivos
*   Pestaña **⬇️ Descargando**: Progreso, velocidad y acciones (Reiniciar/Eliminar).
*   Pestaña **✅ Completados**: Archivos listos. Click para **ver enlaces desbloqueados**.

## 🔧 Tecnologías

*   Javascript (ES6 Modules)
*   Chrome Extension Manifest V3
*   CSS3 Variables & Flexbox/Grid
*   AllDebrid API v4

---
*Desarrollado con ❤️ para usuarios de AllDebrid.*
