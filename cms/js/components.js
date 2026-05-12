/**
 * Component Library - Defines all available page builder components
 */
const ComponentLibrary = {
    categories: [
        {
            name: 'Navigasi',
            components: [
                {
                    type: 'navbar',
                    label: 'Navbar',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>',
                    defaultProps: {
                        brand: 'MyBrand',
                        links: ['Beranda', 'Tentang', 'Layanan', 'Kontak'],
                        ctaText: 'Mulai',
                        bgColor: '#1e293b',
                        textColor: '#ffffff'
                    }
                }
            ]
        },
        {
            name: 'Hero & Header',
            components: [
                {
                    type: 'hero',
                    label: 'Hero Section',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/><path d="M8 9h8M10 12h4"/></svg>',
                    defaultProps: {
                        title: 'Selamat Datang di Website Kami',
                        subtitle: 'Kami menyediakan solusi terbaik untuk kebutuhan bisnis Anda dengan teknologi terkini.',
                        btnPrimary: 'Mulai Sekarang',
                        btnSecondary: 'Pelajari Lebih',
                        bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }
                }
            ]
        },
        {
            name: 'Konten',
            components: [
                {
                    type: 'features',
                    label: 'Fitur',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
                    defaultProps: {
                        title: 'Fitur Unggulan',
                        subtitle: 'Semua yang Anda butuhkan dalam satu platform.',
                        features: [
                            { icon: '\u26A1', title: 'Cepat & Ringan', desc: 'Performa tinggi dengan loading yang super cepat.' },
                            { icon: '\uD83D\uDD12', title: 'Aman & Terpercaya', desc: 'Keamanan data terjamin dengan enkripsi terbaik.' },
                            { icon: '\uD83C\uDF10', title: 'Global Access', desc: 'Akses dari mana saja di seluruh dunia.' }
                        ]
                    }
                },
                {
                    type: 'content',
                    label: 'Teks + Gambar',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h9M3 7h5M3 17h7"/></svg>',
                    defaultProps: {
                        title: 'Tentang Kami',
                        text: 'Kami adalah tim yang berdedikasi untuk memberikan solusi digital terbaik. Dengan pengalaman bertahun-tahun, kami telah membantu ratusan bisnis tumbuh secara online.',
                        imageUrl: '',
                        btnText: 'Pelajari Lebih',
                        reverse: false
                    }
                },
                {
                    type: 'textBlock',
                    label: 'Blok Teks',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M8 13h8M8 17h6"/></svg>',
                    defaultProps: {
                        title: 'Judul Bagian',
                        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.'
                    }
                },
                {
                    type: 'gallery',
                    label: 'Galeri',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
                    defaultProps: {
                        title: 'Galeri Kami',
                        images: [
                            { url: '', alt: 'Gambar 1' },
                            { url: '', alt: 'Gambar 2' },
                            { url: '', alt: 'Gambar 3' },
                            { url: '', alt: 'Gambar 4' },
                            { url: '', alt: 'Gambar 5' },
                            { url: '', alt: 'Gambar 6' }
                        ]
                    }
                }
            ]
        },
        {
            name: 'Sosial',
            components: [
                {
                    type: 'testimonials',
                    label: 'Testimoni',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
                    defaultProps: {
                        title: 'Apa Kata Mereka',
                        testimonials: [
                            { text: 'Layanan yang sangat memuaskan! Tim sangat profesional dan responsif.', name: 'Ahmad Rizky', role: 'CEO, TechCo', initial: 'A' },
                            { text: 'Website kami jadi lebih modern dan cepat. Sangat direkomendasikan!', name: 'Siti Nurhaliza', role: 'Marketing Manager', initial: 'S' },
                            { text: 'Proses pengerjaan cepat dan hasilnya melebihi ekspektasi kami.', name: 'Budi Santoso', role: 'Founder, StartupXYZ', initial: 'B' }
                        ]
                    }
                },
                {
                    type: 'team',
                    label: 'Tim',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
                    defaultProps: {
                        title: 'Tim Kami',
                        members: [
                            { name: 'Ahmad', role: 'CEO', initial: 'A' },
                            { name: 'Siti', role: 'CTO', initial: 'S' },
                            { name: 'Budi', role: 'Designer', initial: 'B' },
                            { name: 'Dewi', role: 'Developer', initial: 'D' }
                        ]
                    }
                }
            ]
        },
        {
            name: 'Bisnis',
            components: [
                {
                    type: 'pricing',
                    label: 'Harga',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
                    defaultProps: {
                        title: 'Pilih Paket Anda',
                        subtitle: 'Pilih paket yang sesuai dengan kebutuhan bisnis Anda.',
                        plans: [
                            { name: 'Starter', price: 'Rp 99K', period: '/bulan', features: ['1 Website', '5GB Storage', 'Email Support', 'SSL Gratis'], featured: false },
                            { name: 'Professional', price: 'Rp 199K', period: '/bulan', features: ['5 Website', '25GB Storage', 'Priority Support', 'SSL Gratis', 'Custom Domain'], featured: true },
                            { name: 'Enterprise', price: 'Rp 499K', period: '/bulan', features: ['Unlimited Website', '100GB Storage', '24/7 Support', 'SSL Gratis', 'Custom Domain', 'API Access'], featured: false }
                        ]
                    }
                },
                {
                    type: 'cta',
                    label: 'Call to Action',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
                    defaultProps: {
                        title: 'Siap Untuk Memulai?',
                        subtitle: 'Bergabung dengan ribuan pengguna yang telah mempercayakan website mereka kepada kami.',
                        btnText: 'Mulai Gratis',
                        bgGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                    }
                },
                {
                    type: 'contact',
                    label: 'Form Kontak',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
                    defaultProps: {
                        title: 'Hubungi Kami',
                        subtitle: 'Kami siap membantu Anda. Silakan isi form di bawah ini.',
                        fields: ['Nama', 'Email', 'Pesan'],
                        btnText: 'Kirim Pesan'
                    }
                },
                {
                    type: 'faq',
                    label: 'FAQ',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
                    defaultProps: {
                        title: 'Pertanyaan Umum',
                        items: [
                            { question: 'Bagaimana cara memulai?', answer: 'Anda bisa mulai dengan mendaftar akun gratis dan memilih template yang sesuai.' },
                            { question: 'Apakah ada biaya tersembunyi?', answer: 'Tidak ada biaya tersembunyi. Semua fitur sesuai dengan paket yang Anda pilih.' },
                            { question: 'Bisa custom domain?', answer: 'Ya, semua paket berbayar mendukung custom domain.' }
                        ]
                    }
                }
            ]
        },
        {
            name: 'Layout',
            components: [
                {
                    type: 'spacer',
                    label: 'Spasi',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12H3M21 6H3M21 18H3"/></svg>',
                    defaultProps: {
                        height: 60
                    }
                },
                {
                    type: 'divider',
                    label: 'Garis Pemisah',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>',
                    defaultProps: {
                        color: '#e2e8f0'
                    }
                }
            ]
        },
        {
            name: 'Footer',
            components: [
                {
                    type: 'footer',
                    label: 'Footer',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/></svg>',
                    defaultProps: {
                        brand: 'MyBrand',
                        description: 'Solusi digital terbaik untuk bisnis Anda. Kami hadir untuk membantu Anda tumbuh.',
                        columns: [
                            { title: 'Produk', links: ['Fitur', 'Harga', 'FAQ'] },
                            { title: 'Perusahaan', links: ['Tentang', 'Blog', 'Karir'] }
                        ],
                        copyright: '\u00A9 2025 MyBrand. All rights reserved.'
                    }
                }
            ]
        }
    ],

    getAll() {
        return this.categories;
    },

    getComponent(type) {
        for (const cat of this.categories) {
            const comp = cat.components.find(c => c.type === type);
            if (comp) return comp;
        }
        return null;
    },

    renderComponent(type, props) {
        const renderers = {
            navbar: (p) => `
                <nav class="cms-navbar" style="background:${p.bgColor || '#1e293b'}">
                    <div class="cms-navbar-brand">${p.brand || 'MyBrand'}</div>
                    <ul class="cms-navbar-links">
                        ${(p.links || []).map(l => `<li><a href="#">${l}</a></li>`).join('')}
                    </ul>
                    <button class="cms-navbar-cta">${p.ctaText || 'Mulai'}</button>
                </nav>`,

            hero: (p) => `
                <section class="cms-hero" style="background:${p.bgGradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}">
                    <h1>${p.title || 'Hero Title'}</h1>
                    <p>${p.subtitle || 'Subtitle text here'}</p>
                    <div class="cms-hero-buttons">
                        <button class="cms-hero-btn primary">${p.btnPrimary || 'Get Started'}</button>
                        ${p.btnSecondary ? `<button class="cms-hero-btn secondary">${p.btnSecondary}</button>` : ''}
                    </div>
                </section>`,

            features: (p) => `
                <section class="cms-features">
                    <div class="cms-features-header">
                        <h2>${p.title || 'Features'}</h2>
                        <p>${p.subtitle || ''}</p>
                    </div>
                    <div class="cms-features-grid">
                        ${(p.features || []).map(f => `
                            <div class="cms-feature-card">
                                <div class="cms-feature-icon">${f.icon || '\u2B50'}</div>
                                <h3>${f.title || 'Feature'}</h3>
                                <p>${f.desc || 'Description'}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>`,

            content: (p) => `
                <section class="cms-content">
                    <div class="cms-content-wrapper" style="${p.reverse ? 'flex-direction: row-reverse;' : ''}">
                        <div class="cms-content-text">
                            <h2>${p.title || 'About Us'}</h2>
                            <p>${p.text || 'Content text here'}</p>
                            ${p.btnText ? `<button class="cms-hero-btn primary" style="background:#6366f1;color:#fff;border:none;">${p.btnText}</button>` : ''}
                        </div>
                        <div class="cms-content-image">
                            ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.title || ''}">` : '<div class="cms-content-image-placeholder">400 x 300</div>'}
                        </div>
                    </div>
                </section>`,

            textBlock: (p) => `
                <section class="cms-text-block">
                    <h2>${p.title || 'Title'}</h2>
                    <p>${p.text || 'Text content'}</p>
                </section>`,

            testimonials: (p) => `
                <section class="cms-testimonials">
                    <div class="cms-testimonials-header">
                        <h2>${p.title || 'Testimonials'}</h2>
                    </div>
                    <div class="cms-testimonials-grid">
                        ${(p.testimonials || []).map(t => `
                            <div class="cms-testimonial-card">
                                <p class="cms-testimonial-text">${t.text}</p>
                                <div class="cms-testimonial-author">
                                    <div class="cms-testimonial-avatar">${t.initial || t.name[0]}</div>
                                    <div>
                                        <div class="cms-testimonial-name">${t.name}</div>
                                        <div class="cms-testimonial-role">${t.role}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>`,

            team: (p) => `
                <section class="cms-team">
                    <div class="cms-team-header">
                        <h2>${p.title || 'Our Team'}</h2>
                    </div>
                    <div class="cms-team-grid">
                        ${(p.members || []).map(m => `
                            <div class="cms-team-card">
                                <div class="cms-team-avatar">${m.initial || m.name[0]}</div>
                                <div class="cms-team-name">${m.name}</div>
                                <div class="cms-team-role">${m.role}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>`,

            pricing: (p) => `
                <section class="cms-pricing">
                    <div class="cms-pricing-header">
                        <h2>${p.title || 'Pricing'}</h2>
                        <p>${p.subtitle || ''}</p>
                    </div>
                    <div class="cms-pricing-grid">
                        ${(p.plans || []).map(plan => `
                            <div class="cms-pricing-card ${plan.featured ? 'featured' : ''}">
                                <div class="cms-pricing-plan">${plan.name}</div>
                                <div class="cms-pricing-price">${plan.price}<span>${plan.period || ''}</span></div>
                                <ul class="cms-pricing-features">
                                    ${(plan.features || []).map(f => `<li>${f}</li>`).join('')}
                                </ul>
                                <button class="cms-pricing-btn">Pilih Paket</button>
                            </div>
                        `).join('')}
                    </div>
                </section>`,

            cta: (p) => `
                <section class="cms-cta" style="background:${p.bgGradient || 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'}">
                    <h2>${p.title || 'Ready to Start?'}</h2>
                    <p>${p.subtitle || ''}</p>
                    <button class="cms-cta-btn">${p.btnText || 'Get Started'}</button>
                </section>`,

            contact: (p) => `
                <section class="cms-contact">
                    <div class="cms-contact-header">
                        <h2>${p.title || 'Contact Us'}</h2>
                        <p>${p.subtitle || ''}</p>
                    </div>
                    <form class="cms-contact-form" onsubmit="event.preventDefault()">
                        <div class="cms-form-row">
                            <div class="cms-form-group">
                                <label>Nama</label>
                                <input type="text" placeholder="Nama lengkap">
                            </div>
                            <div class="cms-form-group">
                                <label>Email</label>
                                <input type="email" placeholder="email@contoh.com">
                            </div>
                        </div>
                        <div class="cms-form-group">
                            <label>Pesan</label>
                            <textarea placeholder="Tulis pesan Anda..."></textarea>
                        </div>
                        <button type="submit" class="cms-form-submit">${p.btnText || 'Kirim Pesan'}</button>
                    </form>
                </section>`,

            faq: (p) => `
                <section class="cms-faq">
                    <div class="cms-faq-header">
                        <h2>${p.title || 'FAQ'}</h2>
                    </div>
                    <div class="cms-faq-list">
                        ${(p.items || []).map(item => `
                            <div class="cms-faq-item">
                                <div class="cms-faq-question">
                                    <span>${item.question}</span>
                                    <span>\u25BC</span>
                                </div>
                                <div class="cms-faq-answer">${item.answer}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>`,

            gallery: (p) => `
                <section class="cms-gallery">
                    <div class="cms-gallery-header">
                        <h2>${p.title || 'Gallery'}</h2>
                    </div>
                    <div class="cms-gallery-grid">
                        ${(p.images || []).map((img, i) => `
                            <div class="cms-gallery-item">
                                ${img.url ? `<img src="${img.url}" alt="${img.alt || ''}">` : `Gambar ${i + 1}`}
                            </div>
                        `).join('')}
                    </div>
                </section>`,

            spacer: (p) => `<div class="cms-spacer" style="height:${p.height || 60}px"></div>`,

            divider: (p) => `<div class="cms-divider"><hr style="border-top-color:${p.color || '#e2e8f0'}"></div>`,

            footer: (p) => `
                <footer class="cms-footer">
                    <div class="cms-footer-content">
                        <div class="cms-footer-brand">
                            <h3>${p.brand || 'MyBrand'}</h3>
                            <p>${p.description || ''}</p>
                        </div>
                        ${(p.columns || []).map(col => `
                            <div class="cms-footer-links">
                                <h4>${col.title}</h4>
                                <ul>
                                    ${(col.links || []).map(link => `<li><a href="#">${link}</a></li>`).join('')}
                                </ul>
                            </div>
                        `).join('')}
                    </div>
                    <div class="cms-footer-bottom">
                        ${p.copyright || '\u00A9 2025 MyBrand'}
                    </div>
                </footer>`
        };

        const renderer = renderers[type];
        return renderer ? renderer(props) : `<div style="padding:20px;text-align:center;color:#999;">Komponen tidak dikenal: ${type}</div>`;
    },

    getPropertyFields(type) {
        const fields = {
            navbar: [
                { group: 'Konten', fields: [
                    { key: 'brand', label: 'Nama Brand', type: 'text' },
                    { key: 'links', label: 'Link Menu (pisahkan koma)', type: 'text', isArray: true },
                    { key: 'ctaText', label: 'Teks Tombol', type: 'text' }
                ]},
                { group: 'Tampilan', fields: [
                    { key: 'bgColor', label: 'Warna Background', type: 'color' },
                    { key: 'textColor', label: 'Warna Teks', type: 'color' }
                ]}
            ],
            hero: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' },
                    { key: 'subtitle', label: 'Sub Judul', type: 'textarea' },
                    { key: 'btnPrimary', label: 'Tombol Utama', type: 'text' },
                    { key: 'btnSecondary', label: 'Tombol Sekunder', type: 'text' }
                ]},
                { group: 'Tampilan', fields: [
                    { key: 'bgGradient', label: 'Background', type: 'gradient' }
                ]}
            ],
            features: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' },
                    { key: 'subtitle', label: 'Sub Judul', type: 'text' }
                ]}
            ],
            content: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' },
                    { key: 'text', label: 'Teks', type: 'textarea' },
                    { key: 'imageUrl', label: 'URL Gambar', type: 'text' },
                    { key: 'btnText', label: 'Teks Tombol', type: 'text' }
                ]}
            ],
            textBlock: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' },
                    { key: 'text', label: 'Teks', type: 'textarea' }
                ]}
            ],
            testimonials: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' }
                ]}
            ],
            team: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' }
                ]}
            ],
            pricing: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' },
                    { key: 'subtitle', label: 'Sub Judul', type: 'text' }
                ]}
            ],
            cta: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' },
                    { key: 'subtitle', label: 'Sub Judul', type: 'textarea' },
                    { key: 'btnText', label: 'Teks Tombol', type: 'text' }
                ]},
                { group: 'Tampilan', fields: [
                    { key: 'bgGradient', label: 'Background', type: 'gradient' }
                ]}
            ],
            contact: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' },
                    { key: 'subtitle', label: 'Sub Judul', type: 'text' },
                    { key: 'btnText', label: 'Teks Tombol', type: 'text' }
                ]}
            ],
            faq: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' }
                ]}
            ],
            gallery: [
                { group: 'Konten', fields: [
                    { key: 'title', label: 'Judul', type: 'text' }
                ]}
            ],
            spacer: [
                { group: 'Tampilan', fields: [
                    { key: 'height', label: 'Tinggi (px)', type: 'number' }
                ]}
            ],
            divider: [
                { group: 'Tampilan', fields: [
                    { key: 'color', label: 'Warna', type: 'color' }
                ]}
            ],
            footer: [
                { group: 'Konten', fields: [
                    { key: 'brand', label: 'Nama Brand', type: 'text' },
                    { key: 'description', label: 'Deskripsi', type: 'textarea' },
                    { key: 'copyright', label: 'Copyright', type: 'text' }
                ]}
            ]
        };

        return fields[type] || [];
    }
};
