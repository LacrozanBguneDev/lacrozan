/**
 * Lacrozan CMS - Main Application
 */
const CMS = {
    currentPage: 'dashboard',
    selectedTemplate: null,

    init() {
        Builder.init();
        this.loadSiteSettings();
        this.renderTemplates();
        this.renderTemplatePicker();
        this.refreshDashboard();
        this.renderPages();
        this.renderMedia();
        this.setupSidebar();
        this.setupKeyboardShortcuts();
    },

    /* ===== Navigation ===== */
    navigateTo(page) {
        this.currentPage = page;

        document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById('page-' + page);
        if (target) target.classList.remove('hidden');

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

        const titles = {
            dashboard: 'Dashboard',
            pages: 'Halaman',
            templates: 'Template',
            media: 'Media',
            settings: 'Pengaturan'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        if (page === 'dashboard') this.refreshDashboard();
        if (page === 'pages') this.renderPages();
        if (page === 'media') this.renderMedia();

        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('mobile-open');
        }
    },

    setupSidebar() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(item.dataset.page);
            });
        });

        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (!document.getElementById('builderOverlay').classList.contains('hidden')) {
                    this.savePage();
                }
            }
            if (e.key === 'Escape') {
                if (!document.getElementById('previewOverlay').classList.contains('hidden')) {
                    this.closePreview();
                }
            }
        });
    },

    /* ===== Dashboard ===== */
    refreshDashboard() {
        const pages = Storage.getPages();
        const published = pages.filter(p => p.status === 'published').length;
        const draft = pages.filter(p => p.status === 'draft').length;

        document.getElementById('totalPages').textContent = pages.length;
        document.getElementById('publishedPages').textContent = published;
        document.getElementById('draftPages').textContent = draft;

        const recentList = document.getElementById('recentPagesList');
        if (pages.length === 0) {
            recentList.innerHTML = `
                <div class="empty-state small">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <p>Belum ada halaman. Buat halaman pertama Anda!</p>
                </div>`;
        } else {
            const recent = pages.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
            recentList.innerHTML = recent.map(page => `
                <div class="recent-page-item">
                    <div class="recent-page-info">
                        <div class="recent-page-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <div>
                            <div class="recent-page-name">${page.name}</div>
                            <div class="recent-page-date">${this.formatDate(page.updatedAt)}</div>
                        </div>
                    </div>
                    <span class="page-card-status ${page.status === 'published' ? 'status-published' : 'status-draft'}">${page.status === 'published' ? 'Published' : 'Draft'}</span>
                </div>
            `).join('');
        }
    },

    /* ===== Pages ===== */
    renderPages(filter, status) {
        let pages = Storage.getPages();

        if (filter) {
            const q = filter.toLowerCase();
            pages = pages.filter(p => p.name.toLowerCase().includes(q));
        }

        if (status && status !== 'all') {
            pages = pages.filter(p => p.status === status);
        }

        const grid = document.getElementById('pagesGrid');
        if (pages.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <h3>Belum Ada Halaman</h3>
                    <p>Mulai buat halaman website pertama Anda dengan page builder kami.</p>
                    <button class="btn btn-primary" onclick="CMS.showNewPageModal()">Buat Halaman Pertama</button>
                </div>`;
            return;
        }

        pages.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        grid.innerHTML = pages.map(page => `
            <div class="page-card">
                <div class="page-card-preview" style="background: ${this.getPageGradient(page)}">
                </div>
                <div class="page-card-body">
                    <div class="page-card-title">
                        ${page.name}
                        <span class="page-card-status ${page.status === 'published' ? 'status-published' : 'status-draft'}">${page.status === 'published' ? 'Published' : 'Draft'}</span>
                    </div>
                    <div class="page-card-meta">
                        <span>${(page.components || []).length} komponen</span>
                        <span>${this.formatDate(page.updatedAt)}</span>
                    </div>
                </div>
                <div class="page-card-actions">
                    <button class="btn btn-sm btn-primary" onclick="CMS.editPage('${page.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="CMS.previewSavedPage('${page.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Preview
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="CMS.togglePageStatus('${page.id}')">
                        ${page.status === 'published' ? 'Draft' : 'Publish'}
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="CMS.confirmDeletePage('${page.id}')" style="color:var(--danger);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `).join('');
    },

    filterPages(query) {
        const status = document.getElementById('filterStatus').value;
        this.renderPages(query, status);
    },

    filterByStatus(status) {
        const query = document.getElementById('searchPages').value;
        this.renderPages(query, status);
    },

    getPageGradient(page) {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        ];
        const hash = page.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return gradients[hash % gradients.length];
    },

    /* ===== Page Actions ===== */
    showNewPageModal() {
        this.selectedTemplate = null;
        document.getElementById('newPageName').value = '';
        document.querySelectorAll('.template-pick-item').forEach(el => el.classList.remove('selected'));
        document.querySelector('.template-pick-item[data-template="blank"]').classList.add('selected');
        this.selectedTemplate = 'blank';
        document.getElementById('newPageModal').classList.remove('hidden');
        document.getElementById('newPageName').focus();
    },

    createNewPage() {
        const name = document.getElementById('newPageName').value.trim();
        if (!name) {
            this.showToast('Masukkan nama halaman', 'warning');
            return;
        }

        const page = {
            id: Storage.generateId(),
            name: name,
            status: 'draft',
            components: [],
            templateId: this.selectedTemplate
        };

        Storage.savePage(page);
        this.closeModal('newPageModal');

        if (this.selectedTemplate && this.selectedTemplate !== 'blank') {
            Builder.openPage(page);
            Builder.loadFromTemplate(this.selectedTemplate);
        } else {
            Builder.openPage(page);
        }

        this.showToast('Halaman berhasil dibuat!', 'success');
    },

    editPage(pageId) {
        const page = Storage.getPage(pageId);
        if (!page) {
            this.showToast('Halaman tidak ditemukan', 'error');
            return;
        }
        Builder.openPage(page);
    },

    savePage() {
        const pageData = Builder.getPageData();
        if (!Builder.currentPage) return;

        const page = {
            ...Builder.currentPage,
            ...pageData,
            status: Builder.currentPage.status || 'draft'
        };

        Storage.savePage(page);
        Builder.currentPage = page;
        this.showToast('Halaman berhasil disimpan!', 'success');
        this.refreshDashboard();
    },

    confirmDeletePage(pageId) {
        if (confirm('Apakah Anda yakin ingin menghapus halaman ini?')) {
            Storage.deletePage(pageId);
            this.renderPages();
            this.refreshDashboard();
            this.showToast('Halaman berhasil dihapus', 'success');
        }
    },

    togglePageStatus(pageId) {
        const page = Storage.getPage(pageId);
        if (!page) return;
        page.status = page.status === 'published' ? 'draft' : 'published';
        Storage.savePage(page);
        this.renderPages();
        this.refreshDashboard();
        this.showToast(`Halaman ${page.status === 'published' ? 'dipublikasi' : 'dijadikan draft'}`, 'success');
    },

    closeBuilder() {
        if (Builder.components.length > 0) {
            if (confirm('Simpan perubahan sebelum keluar?')) {
                this.savePage();
            }
        }
        document.getElementById('builderOverlay').classList.add('hidden');
        this.renderPages();
        this.refreshDashboard();
    },

    toggleComponentPanel() {
        document.getElementById('componentPanel').classList.toggle('open');
    },

    closePropertiesPanel() {
        document.getElementById('propertiesPanel').classList.add('hidden');
        Builder.selectedComponentIndex = -1;
        Builder.renderCanvas();
    },

    /* ===== Preview ===== */
    previewPage() {
        const html = ExportEngine.getPreviewHTML(Builder.components);
        const frame = document.getElementById('previewFrame');
        document.getElementById('previewOverlay').classList.remove('hidden');

        frame.srcdoc = html;
    },

    previewSavedPage(pageId) {
        const page = Storage.getPage(pageId);
        if (!page || !page.components) return;

        const html = ExportEngine.getPreviewHTML(page.components);
        const frame = document.getElementById('previewFrame');
        document.getElementById('previewOverlay').classList.remove('hidden');

        frame.srcdoc = html;
    },

    closePreview() {
        document.getElementById('previewOverlay').classList.add('hidden');
    },

    switchDevice(device) {
        const canvas = document.getElementById('builderCanvas');
        canvas.classList.remove('tablet', 'mobile');
        if (device !== 'desktop') canvas.classList.add(device);

        document.querySelectorAll('.builder-topbar .device-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.builder-topbar .device-btn[data-device="${device}"]`).classList.add('active');
    },

    switchPreviewDevice(device) {
        const frame = document.getElementById('previewFrame');
        frame.classList.remove('tablet', 'mobile');
        if (device !== 'desktop') frame.classList.add(device);

        document.querySelectorAll('.preview-topbar .device-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.preview-topbar .device-btn[data-device="${device}"]`).classList.add('active');
    },

    /* ===== Export ===== */
    exportCurrentPage() {
        if (!Builder.currentPage) return;
        const html = ExportEngine.generatePageHTML(Builder.components, Builder.currentPage);
        const filename = (Builder.currentPage.name || 'page').toLowerCase().replace(/\s+/g, '-') + '.html';
        ExportEngine.downloadHTML(html, filename);
        this.showToast('Halaman berhasil di-export!', 'success');
    },

    exportAllPages() {
        const pages = Storage.getPages();
        if (pages.length === 0) {
            this.showToast('Tidak ada halaman untuk di-export', 'warning');
            return;
        }

        pages.forEach(page => {
            const html = ExportEngine.generatePageHTML(page.components || [], page);
            const filename = page.name.toLowerCase().replace(/\s+/g, '-') + '.html';
            ExportEngine.downloadHTML(html, filename);
        });

        this.showToast(`${pages.length} halaman berhasil di-export!`, 'success');
    },

    /* ===== Templates ===== */
    renderTemplates() {
        const grid = document.getElementById('templatesGrid');
        if (!grid) return;

        const templates = Templates.getAll();
        grid.innerHTML = templates.map(t => `
            <div class="template-card">
                <div class="template-preview">
                    <div class="template-gradient" style="background: ${t.gradient}">${t.name}</div>
                    <div class="template-overlay">
                        <button class="btn btn-primary btn-sm" onclick="CMS.useTemplate('${t.id}')">Gunakan Template</button>
                        <button class="btn btn-secondary btn-sm" onclick="CMS.previewTemplate('${t.id}')" style="background:rgba(255,255,255,0.9);color:#1e293b;">Preview</button>
                    </div>
                </div>
                <div class="template-body">
                    <div class="template-name">${t.name}</div>
                    <div class="template-desc">${t.description}</div>
                    <div class="template-tags">
                        ${t.tags.map(tag => `<span class="template-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderTemplatePicker() {
        const picker = document.getElementById('templatePicker');
        if (!picker) return;

        const templates = Templates.getAll();
        picker.innerHTML = templates.map(t => `
            <div class="template-pick-item ${t.id === 'blank' ? 'selected' : ''}" data-template="${t.id}" onclick="CMS.selectTemplate('${t.id}')">
                <div class="template-pick-preview" style="background: ${t.gradient}">${t.id === 'blank' ? 'Kosong' : ''}</div>
                <div class="template-pick-name">${t.name}</div>
            </div>
        `).join('');
    },

    selectTemplate(templateId) {
        this.selectedTemplate = templateId;
        document.querySelectorAll('.template-pick-item').forEach(el => el.classList.remove('selected'));
        document.querySelector(`.template-pick-item[data-template="${templateId}"]`).classList.add('selected');
    },

    useTemplate(templateId) {
        const template = Templates.getTemplate(templateId);
        if (!template) return;

        const name = prompt('Nama halaman:', template.name);
        if (!name) return;

        const page = {
            id: Storage.generateId(),
            name: name,
            status: 'draft',
            components: [],
            templateId: templateId
        };

        Storage.savePage(page);
        Builder.openPage(page);
        Builder.loadFromTemplate(templateId);
        this.showToast('Template diterapkan!', 'success');
    },

    previewTemplate(templateId) {
        const template = Templates.getTemplate(templateId);
        if (!template || !template.components) return;

        const components = template.components.map(comp => ({
            id: Storage.generateId(),
            type: comp.type,
            props: comp.props
        }));

        const html = ExportEngine.getPreviewHTML(components);
        const frame = document.getElementById('previewFrame');
        document.getElementById('previewOverlay').classList.remove('hidden');
        frame.srcdoc = html;
    },

    /* ===== Media ===== */
    renderMedia() {
        const grid = document.getElementById('mediaGrid');
        const media = Storage.getMedia();

        if (media.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <h3>Belum Ada Media</h3>
                    <p>Upload gambar dan file untuk digunakan di halaman Anda.</p>
                    <button class="btn btn-primary" onclick="CMS.showUploadModal()">Upload File Pertama</button>
                </div>`;
            return;
        }

        grid.innerHTML = media.map(m => `
            <div class="media-card">
                <div class="media-thumbnail">
                    ${m.type.startsWith('image/') ? `<img src="${m.data}" alt="${m.name}">` : `
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    `}
                </div>
                <div class="media-info">
                    <div class="media-name" title="${m.name}">${m.name}</div>
                    <div class="media-size">${this.formatFileSize(m.size)}</div>
                </div>
                <div class="media-actions">
                    <button class="btn btn-sm btn-ghost" onclick="CMS.copyMediaUrl('${m.id}')" title="Salin URL">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="CMS.deleteMedia('${m.id}')" style="color:var(--danger);" title="Hapus">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `).join('');
    },

    showUploadModal() {
        document.getElementById('uploadPreview').innerHTML = '';
        document.getElementById('uploadModal').classList.remove('hidden');
    },

    handleFileSelect(event) {
        const files = event.target.files;
        this.processFiles(files);
    },

    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    },

    handleDragLeave(event) {
        event.currentTarget.classList.remove('drag-over');
    },

    handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const files = event.dataTransfer.files;
        this.processFiles(files);
    },

    processFiles(files) {
        const preview = document.getElementById('uploadPreview');
        const maxSize = 5 * 1024 * 1024;

        Array.from(files).forEach(file => {
            if (file.size > maxSize) {
                this.showToast(`${file.name} terlalu besar (max 5MB)`, 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const media = {
                    id: Storage.generateId(),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: e.target.result,
                    uploadedAt: Date.now()
                };

                Storage.saveMedia(media);
                this.renderMedia();

                if (file.type.startsWith('image/')) {
                    preview.innerHTML += `
                        <div class="upload-preview-item">
                            <img src="${e.target.result}" alt="${file.name}">
                            <div class="upload-preview-name">${file.name}</div>
                        </div>`;
                }

                this.showToast(`${file.name} berhasil diupload`, 'success');
            };
            reader.readAsDataURL(file);
        });
    },

    copyMediaUrl(mediaId) {
        const media = Storage.getMedia().find(m => m.id === mediaId);
        if (!media) return;

        navigator.clipboard.writeText(media.data).then(() => {
            this.showToast('URL berhasil disalin', 'success');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = media.data;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('URL berhasil disalin', 'success');
        });
    },

    deleteMedia(mediaId) {
        if (confirm('Hapus file ini?')) {
            Storage.deleteMedia(mediaId);
            this.renderMedia();
            this.showToast('File berhasil dihapus', 'success');
        }
    },

    /* ===== Settings ===== */
    loadSiteSettings() {
        const settings = Storage.getSiteSettings();
        document.getElementById('siteName').value = settings.name || '';
        document.getElementById('siteDescription').value = settings.description || '';
        document.getElementById('siteFavicon').value = settings.favicon || '';
        document.getElementById('primaryColor').value = settings.primaryColor || '#6366f1';
        document.getElementById('primaryColorText').value = settings.primaryColor || '#6366f1';
        document.getElementById('siteFont').value = settings.font || 'Inter';
    },

    saveSiteSettings() {
        const settings = {
            name: document.getElementById('siteName').value,
            description: document.getElementById('siteDescription').value,
            favicon: document.getElementById('siteFavicon').value,
            primaryColor: document.getElementById('primaryColor').value,
            font: document.getElementById('siteFont').value
        };
        Storage.saveSiteSettings(settings);
        this.showToast('Pengaturan berhasil disimpan', 'success');
    },

    /* ===== Data Management ===== */
    exportData() {
        const data = Storage.exportAll();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lacrozan-cms-backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Data berhasil di-export', 'success');
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                Storage.importAll(data);
                this.refreshDashboard();
                this.renderPages();
                this.renderMedia();
                this.loadSiteSettings();
                this.showToast('Data berhasil di-import!', 'success');
            } catch (err) {
                this.showToast('File tidak valid', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    clearAllData() {
        if (confirm('Apakah Anda yakin ingin menghapus SEMUA data? Tindakan ini tidak dapat dikembalikan.')) {
            if (confirm('Konfirmasi sekali lagi - Hapus semua halaman, media, dan pengaturan?')) {
                Storage.clear();
                this.refreshDashboard();
                this.renderPages();
                this.renderMedia();
                this.loadSiteSettings();
                this.showToast('Semua data berhasil dihapus', 'success');
            }
        }
    },

    /* ===== Modals ===== */
    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    },

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    },

    /* ===== Toast Notifications ===== */
    showToast(message, type) {
        type = type || 'info';
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>`;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    },

    /* ===== Utilities ===== */
    formatDate(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Baru saja';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' menit lalu';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
        if (diff < 604800000) return Math.floor(diff / 86400000) + ' hari lalu';

        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
};

document.addEventListener('DOMContentLoaded', () => CMS.init());
