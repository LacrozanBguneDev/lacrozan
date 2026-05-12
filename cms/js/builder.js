/**
 * Page Builder - Handles the drag & drop page builder functionality
 */
const Builder = {
    currentPage: null,
    components: [],
    selectedComponentIndex: -1,
    draggedComponentType: null,
    draggedIndex: -1,

    init() {
        this.renderComponentPanel();
        this.setupDragAndDrop();
    },

    renderComponentPanel() {
        const list = document.getElementById('componentList');
        if (!list) return;

        const categories = ComponentLibrary.getAll();
        list.innerHTML = categories.map(cat => `
            <div class="component-category">
                <div class="component-category-title">${cat.name}</div>
                <div class="component-items">
                    ${cat.components.map(comp => `
                        <div class="component-item" draggable="true" data-type="${comp.type}" onclick="Builder.addComponent('${comp.type}')" title="${comp.label}">
                            ${comp.icon}
                            <span>${comp.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.component-item');
            if (item) {
                this.draggedComponentType = item.dataset.type;
                this.draggedIndex = -1;
                e.dataTransfer.effectAllowed = 'copy';
                item.style.opacity = '0.5';
            }

            const canvasComp = e.target.closest('.canvas-component');
            if (canvasComp) {
                this.draggedIndex = parseInt(canvasComp.dataset.index);
                this.draggedComponentType = null;
                e.dataTransfer.effectAllowed = 'move';
                canvasComp.style.opacity = '0.5';
            }
        });

        document.addEventListener('dragend', (e) => {
            const item = e.target.closest('.component-item');
            if (item) item.style.opacity = '1';

            const canvasComp = e.target.closest('.canvas-component');
            if (canvasComp) canvasComp.style.opacity = '1';

            this.draggedComponentType = null;
            this.draggedIndex = -1;
            document.querySelectorAll('.drop-indicator').forEach(el => el.classList.remove('visible'));
        });

        const canvas = document.getElementById('canvasContent');
        if (!canvas) return;

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = this.draggedComponentType ? 'copy' : 'move';
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedComponentType) {
                this.addComponent(this.draggedComponentType);
            }
        });
    },

    openPage(page) {
        this.currentPage = page;
        this.components = page.components ? JSON.parse(JSON.stringify(page.components)) : [];
        this.selectedComponentIndex = -1;

        document.getElementById('builderPageTitle').value = page.name || 'Halaman Baru';
        document.getElementById('builderOverlay').classList.remove('hidden');
        document.getElementById('propertiesPanel').classList.add('hidden');

        this.renderCanvas();
    },

    addComponent(type) {
        const compDef = ComponentLibrary.getComponent(type);
        if (!compDef) return;

        const newComponent = {
            id: Storage.generateId(),
            type: type,
            props: JSON.parse(JSON.stringify(compDef.defaultProps))
        };

        this.components.push(newComponent);
        this.renderCanvas();
        this.selectComponent(this.components.length - 1);
        CMS.showToast('Komponen ditambahkan', 'success');
    },

    renderCanvas() {
        const content = document.getElementById('canvasContent');
        const emptyState = document.getElementById('canvasEmptyState');

        if (this.components.length === 0) {
            emptyState.classList.remove('hidden');
            content.innerHTML = '';
            return;
        }

        emptyState.classList.add('hidden');
        content.innerHTML = this.components.map((comp, index) => `
            <div class="canvas-component ${index === this.selectedComponentIndex ? 'selected' : ''}"
                 data-index="${index}" draggable="true"
                 onclick="Builder.selectComponent(${index})"
                 ondragover="Builder.handleCanvasDragOver(event, ${index})"
                 ondrop="Builder.handleCanvasDrop(event, ${index})">
                <div class="component-toolbar">
                    <button class="toolbar-btn" onclick="event.stopPropagation(); Builder.moveComponent(${index}, -1)" title="Pindah ke atas">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button class="toolbar-btn" onclick="event.stopPropagation(); Builder.moveComponent(${index}, 1)" title="Pindah ke bawah">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <button class="toolbar-btn" onclick="event.stopPropagation(); Builder.duplicateComponent(${index})" title="Duplikat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button class="toolbar-btn delete" onclick="event.stopPropagation(); Builder.deleteComponent(${index})" title="Hapus">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
                ${ComponentLibrary.renderComponent(comp.type, comp.props)}
            </div>
        `).join('');
    },

    handleCanvasDragOver(e, index) {
        e.preventDefault();
        e.stopPropagation();
    },

    handleCanvasDrop(e, targetIndex) {
        e.preventDefault();
        e.stopPropagation();

        if (this.draggedIndex >= 0 && this.draggedIndex !== targetIndex) {
            const comp = this.components.splice(this.draggedIndex, 1)[0];
            this.components.splice(targetIndex, 0, comp);
            this.renderCanvas();
        }
    },

    selectComponent(index) {
        this.selectedComponentIndex = index;
        this.renderCanvas();
        this.showProperties(index);
    },

    showProperties(index) {
        const comp = this.components[index];
        if (!comp) return;

        const panel = document.getElementById('propertiesPanel');
        const content = document.getElementById('propertiesContent');
        panel.classList.remove('hidden');

        const fieldGroups = ComponentLibrary.getPropertyFields(comp.type);
        content.innerHTML = fieldGroups.map(group => `
            <div class="property-group">
                <div class="property-group-title">${group.group}</div>
                ${group.fields.map(field => {
                    const value = field.isArray ? (comp.props[field.key] || []).join(', ') : (comp.props[field.key] || '');
                    if (field.type === 'textarea') {
                        return `
                            <div class="property-field">
                                <label>${field.label}</label>
                                <textarea data-key="${field.key}" ${field.isArray ? 'data-array="true"' : ''}
                                    oninput="Builder.updateProperty('${field.key}', this.value, ${field.isArray || false})">${value}</textarea>
                            </div>`;
                    }
                    if (field.type === 'color') {
                        return `
                            <div class="property-field">
                                <label>${field.label}</label>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <input type="color" value="${value}" onchange="Builder.updateProperty('${field.key}', this.value); this.nextElementSibling.value=this.value;">
                                    <input type="text" value="${value}" data-key="${field.key}" oninput="Builder.updateProperty('${field.key}', this.value); this.previousElementSibling.value=this.value;">
                                </div>
                            </div>`;
                    }
                    if (field.type === 'gradient') {
                        return `
                            <div class="property-field">
                                <label>${field.label}</label>
                                <select data-key="${field.key}" onchange="Builder.updateProperty('${field.key}', this.value)">
                                    <option value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" ${value.includes('667eea') ? 'selected' : ''}>Ungu</option>
                                    <option value="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" ${value.includes('6366f1') ? 'selected' : ''}>Indigo</option>
                                    <option value="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" ${value.includes('f093fb') ? 'selected' : ''}>Pink</option>
                                    <option value="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" ${value.includes('4facfe') ? 'selected' : ''}>Biru</option>
                                    <option value="linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" ${value.includes('a18cd1') ? 'selected' : ''}>Lavender</option>
                                    <option value="linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)" ${value.includes('ff9a9e') ? 'selected' : ''}>Coral</option>
                                    <option value="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" ${value.includes('0f172a') ? 'selected' : ''}>Gelap</option>
                                    <option value="linear-gradient(135deg, #10b981 0%, #059669 100%)" ${value.includes('10b981') ? 'selected' : ''}>Hijau</option>
                                </select>
                            </div>`;
                    }
                    if (field.type === 'number') {
                        return `
                            <div class="property-field">
                                <label>${field.label}</label>
                                <input type="number" value="${value}" data-key="${field.key}"
                                    oninput="Builder.updateProperty('${field.key}', parseInt(this.value) || 0)">
                            </div>`;
                    }
                    return `
                        <div class="property-field">
                            <label>${field.label}</label>
                            <input type="text" value="${value}" data-key="${field.key}" ${field.isArray ? 'data-array="true"' : ''}
                                oninput="Builder.updateProperty('${field.key}', this.value, ${field.isArray || false})">
                        </div>`;
                }).join('')}
            </div>
        `).join('');
    },

    updateProperty(key, value, isArray) {
        if (this.selectedComponentIndex < 0) return;
        const comp = this.components[this.selectedComponentIndex];
        if (!comp) return;

        if (isArray) {
            comp.props[key] = value.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            comp.props[key] = value;
        }

        this.renderCanvas();
    },

    moveComponent(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.components.length) return;

        const comp = this.components.splice(index, 1)[0];
        this.components.splice(newIndex, 0, comp);

        if (this.selectedComponentIndex === index) {
            this.selectedComponentIndex = newIndex;
        }

        this.renderCanvas();
    },

    duplicateComponent(index) {
        const comp = JSON.parse(JSON.stringify(this.components[index]));
        comp.id = Storage.generateId();
        this.components.splice(index + 1, 0, comp);
        this.renderCanvas();
        CMS.showToast('Komponen diduplikat', 'success');
    },

    deleteComponent(index) {
        this.components.splice(index, 1);
        if (this.selectedComponentIndex === index) {
            this.selectedComponentIndex = -1;
            document.getElementById('propertiesPanel').classList.add('hidden');
        } else if (this.selectedComponentIndex > index) {
            this.selectedComponentIndex--;
        }
        this.renderCanvas();
        CMS.showToast('Komponen dihapus', 'success');
    },

    getPageData() {
        return {
            name: document.getElementById('builderPageTitle').value || 'Halaman Baru',
            components: this.components
        };
    },

    loadFromTemplate(templateId) {
        const template = Templates.getTemplate(templateId);
        if (!template) return;

        this.components = template.components.map(comp => ({
            id: Storage.generateId(),
            type: comp.type,
            props: JSON.parse(JSON.stringify(comp.props))
        }));

        this.renderCanvas();
    },

    generateHTML() {
        return ExportEngine.generatePageHTML(this.components, this.currentPage);
    }
};
