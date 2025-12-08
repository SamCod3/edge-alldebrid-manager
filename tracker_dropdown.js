export class TrackerDropdown {
    constructor(btnId, listId) {
        this.btn = document.getElementById(btnId);
        this.list = document.getElementById(listId);
        this.initListeners();
    }

    initListeners() {
        // Toggle dropdown
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.list.classList.toggle('hidden');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.btn.contains(e.target) && !this.list.contains(e.target)) {
                this.list.classList.add('hidden');
            }
        });
    }

    render(indexers) {
        this.list.innerHTML = '';

        // Add "Todos" option
        const allDiv = document.createElement('label');
        allDiv.innerHTML = `<input type="checkbox" value="all" checked> Todos`;
        allDiv.querySelector('input').addEventListener('change', (e) => this.handleSelection(e));
        this.list.appendChild(allDiv);

        indexers.forEach(idx => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${idx.id}"> ${idx.title}`;
            label.querySelector('input').addEventListener('change', (e) => this.handleSelection(e));
            this.list.appendChild(label);
        });

        this.updateLabel();
    }

    handleSelection(e) {
        if (e.target.value === 'all' && e.target.checked) {
            // Uncheck all others
            this.list.querySelectorAll('input:not([value="all"])').forEach(cb => cb.checked = false);
        } else if (e.target.value !== 'all' && e.target.checked) {
            // Uncheck 'all'
            const allCb = this.list.querySelector('input[value="all"]');
            if (allCb) allCb.checked = false;
        }

        // If nothing checked, check 'all'
        const anyChecked = this.list.querySelector('input:checked');
        if (!anyChecked) {
            const allCb = this.list.querySelector('input[value="all"]');
            if (allCb) allCb.checked = true;
        }
        this.updateLabel();
    }

    updateLabel() {
        const checked = Array.from(this.list.querySelectorAll('input:checked'));
        if (checked.length === 1 && checked[0].value === 'all') {
            this.btn.textContent = "Seleccionar Trackers (Todos)";
        } else {
            this.btn.textContent = `Seleccionados (${checked.length})`;
        }
    }

    getSelected() {
        const checkedBoxes = Array.from(this.list.querySelectorAll('input:checked'));
        if (checkedBoxes.map(cb => cb.value).includes('all')) {
            return 'all';
        }
        return checkedBoxes.map(cb => cb.value).join(',');
    }
}
