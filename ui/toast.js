export class Toast {
    static init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    }

    /**
     * Show a toast notification
     * @param {string} message 
     * @param {'info'|'success'|'error'|'warning'} type 
     * @param {number} duration ms
     */
    static show(message, type = 'info', duration = 3000) {
        this.init();
        const container = document.getElementById('toast-container');

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this._getIcon(type)}</span>
            <span class="toast-msg">${message}</span>
        `;

        container.appendChild(toast);

        // Animation In
        requestAnimationFrame(() => toast.classList.add('show'));

        // Auto Dismiss
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }

    static _getIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }
}
