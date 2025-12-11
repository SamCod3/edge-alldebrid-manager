# ☁️ AllDebrid Edge/Chrome Manager

Una extensión moderna y eficiente para gestionar tus descargas de **AllDebrid** directamente desde tu navegador.
Intercepta archivos `.torrent` y enlaces magnet, gestiona tu nube personal, busca nuevos torrents con Jackett e incluso **envía contenido a tu TV** (DLNA/Kodi).

## ✨ Características Principales

### 📥 Gestión de Descargas & Nube
*   **⚡ Intercepción Inteligente**: Detecta descargas de `.torrent` y Clicks en enlaces `magnet:`, enviándolos a la nube.
*   **Gestor de Claves Seguro**: Administra, crea y cambia entre múltiples API Keys fácilmente.
*   **Panel de Control Completo**:
    *   **Descargas Activas**: Barra de progreso real, velocidad, semillas y estado en tiempo real.
    *   **Historial**: Listado de torrents completados.
    *   **Desbloqueo Automático**: Click en un torrent completado para ver y copiar/descargar sus enlaces directos.

### 📺 Casting & DLNA (NUEVO)
*   **Envía a tu TV**: Reproduce archivos de vídeo directamente en tu Smart TV (DLNA) o Kodi.
*   **Cola Inteligente (Kodi)**: Si ya hay algo reproduciéndose, lo añade a la lista de reproducción.
*   **Gestión de Dispositivos**: Guarda múltiples TVs (Salón, Dormitorio) por IP y puerto.
*   **Menú Rápido**: Selector de TV "Siempre activo" en la cabecera para casting con un click.

### 🧥 Integración con Jackett
*   **Buscador Integrado**: Busca torrents en tus trackers privados/públicos desde la extensión.
*   **Selector de Trackers Premium**: Filtra por trackers específicos con una UI moderna y badges de conteo.
*   **Feedback Visual Avanzado**:
    *   **Verde**: Archivos cacheados (Descarga instantánea).
    *   **Indicadores**: Iconos de estado para saber qué has enviado ya.

### 🎨 UI/UX Moderna
*   **Notificaciones Toast**: Sistema de alertas no intrusivas para feedback de acciones.
*   **Diseño Premium**: Tema oscuro pulido con glassmorphism, gradientes y animaciones suaves.
*   **Interfaz Modular**: Pestañas de configuración claras para General, Buscador y Casting.

---

## 🚀 Instalación
Esta extensión se carga en modo desarrollador (unpacked).

1.  Clona o descarga este repositorio.
2.  Abre la gestión de extensiones:
    *   **Edge**: `edge://extensions`
    *   **Chrome**: `chrome://extensions`
3.  Activa el **Modo de desarrollador**.
4.  Haz clic en **"Cargar descomprimida"** (Load unpacked).
5.  Selecciona la carpeta del código.

## 🛠️ Configuración

### 1. AllDebrid (General)
*   Pega tu API Key o usa el **Gestor de Claves** integrado si ya estás logueado en la web.

### 2. Jackett (Buscador)
*   Ve a **Configuración > Buscador**.
*   URL: Tu servidor Jackett (ej. `http://localhost:9117`).
*   API Key: Tu clave de Jackett.

### 3. Casting (TVs)
*   Ve a **Configuración > Casting**.
*   Añade tu TV:
    *   **Nombre**: Ej. "Samsung Salón".
    *   **Tipo**: DLNA (Smart TV genérica) o Kodi (JSON-RPC).
    *   **IP**: La IP local de la TV (ej. `192.168.1.50`).

---

## 🏗️ Arquitectura (Para Desarrolladores)

El proyecto ha sido refactorizado para ser modular y mantenible:

*   **Controllers**: Lógica de negocio separada (`KeyController`, `CastController`, `JackettController`).
*   **UI/Renderer**: Separación de las funciones de pintado del DOM (`renderer.js`, `toast.js`).
*   **Estilos**: Variables CSS modernas (`variables.css`) y diseño responsive.

**Tecnologías**:
*   Javascript (ES6 Modules)
*   Manifest V3
*   CSS3 Variables & Flexbox/Grid
*   AllDebrid API v4
*   DLNA SOAP / Kodi JSON-RPC

---
*Desarrollado con ❤️ para usuarios de AllDebrid.*
