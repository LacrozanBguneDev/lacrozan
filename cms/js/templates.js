/**
 * Template Library - Pre-built page templates
 */
const Templates = {
    list: [
        {
            id: 'blank',
            name: 'Halaman Kosong',
            description: 'Mulai dari awal dengan halaman kosong.',
            gradient: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            tags: ['Kosong'],
            components: []
        },
        {
            id: 'landing',
            name: 'Landing Page',
            description: 'Template landing page lengkap dengan hero, fitur, testimoni, dan CTA.',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            tags: ['Bisnis', 'Marketing'],
            components: [
                { type: 'navbar', props: { brand: 'MyBrand', links: ['Beranda', 'Fitur', 'Harga', 'Kontak'], ctaText: 'Daftar', bgColor: '#1e293b' } },
                { type: 'hero', props: { title: 'Solusi Digital Terbaik untuk Bisnis Anda', subtitle: 'Tingkatkan produktivitas dan efisiensi bisnis Anda dengan platform all-in-one kami.', btnPrimary: 'Mulai Gratis', btnSecondary: 'Lihat Demo', bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } },
                { type: 'features', props: { title: 'Fitur Unggulan', subtitle: 'Semua yang Anda butuhkan untuk mengembangkan bisnis.', features: [
                    { icon: '\u26A1', title: 'Super Cepat', desc: 'Loading halaman kurang dari 1 detik untuk pengalaman terbaik.' },
                    { icon: '\uD83D\uDD12', title: 'Keamanan Tinggi', desc: 'Data Anda dilindungi dengan enkripsi standar industri.' },
                    { icon: '\uD83D\uDCCA', title: 'Analitik Lengkap', desc: 'Pantau performa bisnis Anda dengan dashboard real-time.' }
                ] } },
                { type: 'testimonials', props: { title: 'Dipercaya oleh Ribuan Pengguna', testimonials: [
                    { text: 'Platform ini mengubah cara kami mengelola bisnis. Sangat direkomendasikan!', name: 'Andi Pratama', role: 'CEO, TechIndo', initial: 'A' },
                    { text: 'Fitur analitiknya luar biasa. Kami bisa memantau semua metrik penting.', name: 'Rina Sari', role: 'Marketing Director', initial: 'R' },
                    { text: 'Customer support yang responsif dan selalu siap membantu.', name: 'Fajar Nugroho', role: 'Founder, StartUp', initial: 'F' }
                ] } },
                { type: 'cta', props: { title: 'Siap Tingkatkan Bisnis Anda?', subtitle: 'Bergabung dengan 10.000+ pengguna yang sudah merasakan manfaatnya.', btnText: 'Daftar Gratis Sekarang', bgGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' } },
                { type: 'footer', props: { brand: 'MyBrand', description: 'Platform digital terdepan untuk solusi bisnis modern.', columns: [{ title: 'Produk', links: ['Fitur', 'Harga', 'FAQ', 'API'] }, { title: 'Perusahaan', links: ['Tentang', 'Blog', 'Karir', 'Kontak'] }], copyright: '\u00A9 2025 MyBrand. All rights reserved.' } }
            ]
        },
        {
            id: 'portfolio',
            name: 'Portfolio',
            description: 'Tampilkan karya dan proyek terbaik Anda dengan template portfolio profesional.',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            tags: ['Pribadi', 'Portfolio'],
            components: [
                { type: 'navbar', props: { brand: 'John Doe', links: ['Tentang', 'Portfolio', 'Skill', 'Kontak'], ctaText: 'Hire Me', bgColor: '#0f172a' } },
                { type: 'hero', props: { title: 'Hi, Saya John Doe', subtitle: 'Full Stack Developer & UI/UX Designer dengan pengalaman 5 tahun membangun produk digital.', btnPrimary: 'Lihat Portfolio', btnSecondary: 'Download CV', bgGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' } },
                { type: 'content', props: { title: 'Tentang Saya', text: 'Saya adalah seorang developer yang passionate dengan desain yang bersih dan code yang rapi. Saya percaya bahwa teknologi bisa membuat dunia menjadi lebih baik.', imageUrl: '', btnText: 'Hubungi Saya' } },
                { type: 'gallery', props: { title: 'Portfolio Saya', images: [
                    { url: '', alt: 'Project 1' }, { url: '', alt: 'Project 2' }, { url: '', alt: 'Project 3' },
                    { url: '', alt: 'Project 4' }, { url: '', alt: 'Project 5' }, { url: '', alt: 'Project 6' }
                ] } },
                { type: 'contact', props: { title: 'Hubungi Saya', subtitle: 'Tertarik berkolaborasi? Kirim pesan dan saya akan segera merespons.', btnText: 'Kirim Pesan' } },
                { type: 'footer', props: { brand: 'John Doe', description: 'Full Stack Developer & UI/UX Designer', columns: [{ title: 'Sosial Media', links: ['GitHub', 'LinkedIn', 'Twitter'] }], copyright: '\u00A9 2025 John Doe' } }
            ]
        },
        {
            id: 'business',
            name: 'Company Profile',
            description: 'Template profesional untuk menampilkan profil perusahaan Anda.',
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            tags: ['Bisnis', 'Perusahaan'],
            components: [
                { type: 'navbar', props: { brand: 'PT. Maju Jaya', links: ['Beranda', 'Tentang', 'Layanan', 'Tim', 'Kontak'], ctaText: 'Konsultasi', bgColor: '#1e293b' } },
                { type: 'hero', props: { title: 'PT. Maju Jaya', subtitle: 'Perusahaan teknologi terdepan yang berfokus pada inovasi dan solusi digital untuk Indonesia.', btnPrimary: 'Konsultasi Gratis', btnSecondary: 'Tentang Kami', bgGradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' } },
                { type: 'features', props: { title: 'Layanan Kami', subtitle: 'Solusi lengkap untuk kebutuhan digital bisnis Anda.', features: [
                    { icon: '\uD83D\uDCBB', title: 'Web Development', desc: 'Pembuatan website profesional dengan teknologi terbaru.' },
                    { icon: '\uD83D\uDCF1', title: 'Mobile App', desc: 'Aplikasi mobile untuk Android dan iOS.' },
                    { icon: '\u2601\uFE0F', title: 'Cloud Solutions', desc: 'Infrastruktur cloud yang scalable dan reliable.' }
                ] } },
                { type: 'content', props: { title: 'Tentang Perusahaan', text: 'Berdiri sejak 2015, PT. Maju Jaya telah melayani lebih dari 500 klien di seluruh Indonesia. Kami berkomitmen untuk memberikan solusi teknologi terbaik.', imageUrl: '', btnText: 'Selengkapnya' } },
                { type: 'team', props: { title: 'Tim Kami', members: [
                    { name: 'Ahmad', role: 'CEO', initial: 'A' },
                    { name: 'Sarah', role: 'CTO', initial: 'S' },
                    { name: 'Budi', role: 'Lead Designer', initial: 'B' },
                    { name: 'Maya', role: 'Lead Developer', initial: 'M' }
                ] } },
                { type: 'contact', props: { title: 'Hubungi Kami', subtitle: 'Konsultasikan kebutuhan digital Anda dengan tim kami.', btnText: 'Kirim Pesan' } },
                { type: 'footer', props: { brand: 'PT. Maju Jaya', description: 'Perusahaan teknologi terdepan di Indonesia.', columns: [{ title: 'Layanan', links: ['Web Development', 'Mobile App', 'Cloud Solutions'] }, { title: 'Kontak', links: ['info@majujaya.id', '+62 21 1234567', 'Jakarta, Indonesia'] }], copyright: '\u00A9 2025 PT. Maju Jaya. All rights reserved.' } }
            ]
        },
        {
            id: 'saas',
            name: 'SaaS Product',
            description: 'Template untuk produk SaaS dengan pricing dan fitur lengkap.',
            gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            tags: ['SaaS', 'Produk'],
            components: [
                { type: 'navbar', props: { brand: 'CloudApp', links: ['Fitur', 'Harga', 'FAQ', 'Blog'], ctaText: 'Coba Gratis', bgColor: '#1e293b' } },
                { type: 'hero', props: { title: 'Kelola Segalanya dari Satu Dashboard', subtitle: 'Platform manajemen all-in-one yang membantu tim Anda bekerja lebih efisien dan produktif.', btnPrimary: 'Coba 14 Hari Gratis', btnSecondary: 'Lihat Demo', bgGradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' } },
                { type: 'features', props: { title: 'Kenapa Memilih CloudApp?', subtitle: 'Tools terbaik untuk produktivitas tim modern.', features: [
                    { icon: '\uD83D\uDE80', title: 'Deployment Instan', desc: 'Deploy project Anda dalam hitungan detik.' },
                    { icon: '\uD83D\uDD04', title: 'Auto Scaling', desc: 'Otomatis menyesuaikan resource sesuai kebutuhan.' },
                    { icon: '\uD83D\uDCCA', title: 'Real-time Analytics', desc: 'Monitor performa dengan data real-time.' }
                ] } },
                { type: 'pricing', props: { title: 'Pilih Paket Anda', subtitle: 'Harga transparan tanpa biaya tersembunyi.', plans: [
                    { name: 'Starter', price: 'Rp 99K', period: '/bulan', features: ['1 Project', '5GB Storage', 'Email Support', 'SSL Gratis'], featured: false },
                    { name: 'Professional', price: 'Rp 299K', period: '/bulan', features: ['10 Projects', '50GB Storage', 'Priority Support', 'SSL Gratis', 'Custom Domain', 'API Access'], featured: true },
                    { name: 'Enterprise', price: 'Rp 799K', period: '/bulan', features: ['Unlimited Projects', '500GB Storage', '24/7 Support', 'SSL Gratis', 'Custom Domain', 'API Access', 'SLA 99.9%'], featured: false }
                ] } },
                { type: 'faq', props: { title: 'Pertanyaan Umum', items: [
                    { question: 'Apakah ada free trial?', answer: 'Ya! Kami menyediakan free trial 14 hari tanpa perlu kartu kredit.' },
                    { question: 'Bisa upgrade/downgrade kapan saja?', answer: 'Tentu, Anda bisa mengubah paket kapan saja tanpa penalti.' },
                    { question: 'Bagaimana dengan keamanan data?', answer: 'Data Anda dienkripsi end-to-end dan disimpan di data center tier 3.' },
                    { question: 'Apakah ada money-back guarantee?', answer: 'Ya, kami menyediakan garansi uang kembali 30 hari.' }
                ] } },
                { type: 'cta', props: { title: 'Mulai Perjalanan Digital Anda', subtitle: 'Join 5.000+ perusahaan yang sudah menggunakan CloudApp.', btnText: 'Daftar Gratis', bgGradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' } },
                { type: 'footer', props: { brand: 'CloudApp', description: 'Platform manajemen all-in-one untuk tim modern.', columns: [{ title: 'Produk', links: ['Fitur', 'Harga', 'Changelog', 'API Docs'] }, { title: 'Support', links: ['Help Center', 'Status', 'Contact'] }], copyright: '\u00A9 2025 CloudApp. All rights reserved.' } }
            ]
        },
        {
            id: 'restaurant',
            name: 'Restoran / Kafe',
            description: 'Template untuk restoran atau kafe dengan menu dan galeri foto.',
            gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
            tags: ['Restoran', 'F&B'],
            components: [
                { type: 'navbar', props: { brand: 'Warung Nusantara', links: ['Menu', 'Tentang', 'Galeri', 'Reservasi'], ctaText: 'Pesan', bgColor: '#1c1917' } },
                { type: 'hero', props: { title: 'Cita Rasa Nusantara yang Otentik', subtitle: 'Nikmati hidangan tradisional Indonesia yang dimasak dengan bumbu pilihan dan cinta.', btnPrimary: 'Lihat Menu', btnSecondary: 'Reservasi', bgGradient: 'linear-gradient(135deg, #1c1917 0%, #44403c 100%)' } },
                { type: 'features', props: { title: 'Kenapa Warung Nusantara?', subtitle: 'Pengalaman kuliner terbaik untuk Anda.', features: [
                    { icon: '\uD83C\uDF5C', title: 'Resep Autentik', desc: 'Resep turun temurun dari berbagai daerah di Indonesia.' },
                    { icon: '\uD83C\uDF3F', title: 'Bahan Segar', desc: 'Bahan-bahan segar dan berkualitas setiap hari.' },
                    { icon: '\u2764\uFE0F', title: 'Dimasak dengan Cinta', desc: 'Setiap hidangan dibuat dengan penuh perhatian.' }
                ] } },
                { type: 'gallery', props: { title: 'Galeri Foto', images: [
                    { url: '', alt: 'Nasi Goreng' }, { url: '', alt: 'Sate' }, { url: '', alt: 'Rendang' },
                    { url: '', alt: 'Gado-gado' }, { url: '', alt: 'Bakso' }, { url: '', alt: 'Es Teh' }
                ] } },
                { type: 'testimonials', props: { title: 'Kata Pengunjung', testimonials: [
                    { text: 'Rendangnya juara! Rasa seperti masakan nenek di kampung.', name: 'Dewi', role: 'Food Blogger', initial: 'D' },
                    { text: 'Tempat yang nyaman dan makanan yang lezat. Pasti balik lagi!', name: 'Riko', role: 'Regular Customer', initial: 'R' },
                    { text: 'Porsi besar, harga bersahabat. Recommended banget!', name: 'Lisa', role: 'Customer', initial: 'L' }
                ] } },
                { type: 'contact', props: { title: 'Reservasi', subtitle: 'Booking meja untuk pengalaman makan yang lebih nyaman.', btnText: 'Kirim Reservasi' } },
                { type: 'footer', props: { brand: 'Warung Nusantara', description: 'Cita rasa Nusantara yang otentik sejak 2010.', columns: [{ title: 'Jam Buka', links: ['Sen-Jum: 10:00 - 22:00', 'Sab-Ming: 09:00 - 23:00'] }, { title: 'Kontak', links: ['+62 812 3456 7890', 'Jl. Merdeka No. 123', 'Jakarta'] }], copyright: '\u00A9 2025 Warung Nusantara' } }
            ]
        }
    ],

    getAll() {
        return this.list;
    },

    getTemplate(id) {
        return this.list.find(t => t.id === id) || null;
    }
};
