/**
 * Storage Manager - Handles all localStorage operations for the CMS
 */
const Storage = {
    PREFIX: 'lcms_',

    get(key) {
        try {
            const data = localStorage.getItem(this.PREFIX + key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(this.PREFIX + key);
    },

    clear() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
    },

    getPages() {
        return this.get('pages') || [];
    },

    savePage(page) {
        const pages = this.getPages();
        const existingIndex = pages.findIndex(p => p.id === page.id);
        if (existingIndex >= 0) {
            pages[existingIndex] = { ...pages[existingIndex], ...page, updatedAt: Date.now() };
        } else {
            page.createdAt = Date.now();
            page.updatedAt = Date.now();
            pages.push(page);
        }
        this.set('pages', pages);
        return page;
    },

    deletePage(pageId) {
        const pages = this.getPages().filter(p => p.id !== pageId);
        this.set('pages', pages);
    },

    getPage(pageId) {
        return this.getPages().find(p => p.id === pageId) || null;
    },

    getMedia() {
        return this.get('media') || [];
    },

    saveMedia(media) {
        const mediaList = this.getMedia();
        mediaList.unshift(media);
        this.set('media', mediaList);
    },

    deleteMedia(mediaId) {
        const mediaList = this.getMedia().filter(m => m.id !== mediaId);
        this.set('media', mediaList);
    },

    getSiteSettings() {
        return this.get('siteSettings') || {
            name: 'My Website',
            description: 'Website yang dibuat dengan Lacrozan CMS',
            favicon: '',
            primaryColor: '#6366f1',
            font: 'Inter'
        };
    },

    saveSiteSettings(settings) {
        this.set('siteSettings', settings);
    },

    exportAll() {
        return {
            pages: this.getPages(),
            media: this.getMedia(),
            settings: this.getSiteSettings(),
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
        };
    },

    importAll(data) {
        if (data.pages) this.set('pages', data.pages);
        if (data.media) this.set('media', data.media);
        if (data.settings) this.set('siteSettings', data.settings);
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
};
