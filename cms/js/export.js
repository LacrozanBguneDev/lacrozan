/**
 * Export Engine - Generates standalone HTML files from page components
 */
const ExportEngine = {
    generatePageHTML(components, page) {
        const settings = Storage.getSiteSettings();
        const pageName = page ? page.name : 'Halaman';

        const componentCSS = this.getComponentCSS();
        const componentHTML = components.map(comp =>
            ComponentLibrary.renderComponent(comp.type, comp.props)
        ).join('\n');

        return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageName} - ${settings.name || 'My Website'}</title>
    <meta name="description" content="${settings.description || ''}">
    ${settings.favicon ? `<link rel="icon" href="${settings.favicon}">` : ''}
    <link href="https://fonts.googleapis.com/css2?family=${(settings.font || 'Inter').replace(' ', '+')}:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: '${settings.font || 'Inter'}', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #1e293b;
            line-height: 1.6;
        }
        a { color: inherit; text-decoration: none; }
        button { cursor: pointer; font-family: inherit; }
        img { max-width: 100%; }
        ${componentCSS}
    </style>
</head>
<body>
${componentHTML}
</body>
</html>`;
    },

    getComponentCSS() {
        return `
        .cms-navbar { display:flex; align-items:center; justify-content:space-between; padding:16px 40px; color:#fff; }
        .cms-navbar-brand { font-size:1.25rem; font-weight:700; }
        .cms-navbar-links { display:flex; gap:24px; list-style:none; }
        .cms-navbar-links a { color:#cbd5e1; text-decoration:none; font-size:0.9rem; transition:color 0.2s; }
        .cms-navbar-links a:hover { color:#fff; }
        .cms-navbar-cta { padding:8px 20px; background:#6366f1; color:#fff; border:none; border-radius:6px; font-weight:500; font-size:0.9rem; }

        .cms-hero { padding:80px 40px; text-align:center; color:#fff; }
        .cms-hero h1 { font-size:3rem; font-weight:800; margin-bottom:16px; line-height:1.2; }
        .cms-hero p { font-size:1.25rem; opacity:0.9; max-width:600px; margin:0 auto 32px; line-height:1.6; }
        .cms-hero-buttons { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
        .cms-hero-btn { padding:12px 32px; border-radius:8px; font-weight:600; font-size:1rem; cursor:pointer; border:2px solid transparent; transition:all 0.2s; }
        .cms-hero-btn.primary { background:#fff; color:#6366f1; }
        .cms-hero-btn.secondary { background:transparent; color:#fff; border-color:rgba(255,255,255,0.5); }

        .cms-features { padding:80px 40px; background:#fff; }
        .cms-features-header { text-align:center; margin-bottom:48px; }
        .cms-features-header h2 { font-size:2rem; font-weight:700; color:#1e293b; margin-bottom:12px; }
        .cms-features-header p { color:#64748b; font-size:1.1rem; max-width:500px; margin:0 auto; }
        .cms-features-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:32px; max-width:1000px; margin:0 auto; }
        .cms-feature-card { text-align:center; padding:32px 24px; border-radius:12px; transition:transform 0.2s,box-shadow 0.2s; }
        .cms-feature-card:hover { transform:translateY(-4px); box-shadow:0 10px 40px rgba(0,0,0,0.1); }
        .cms-feature-icon { width:64px; height:64px; border-radius:16px; background:#eef2ff; color:#6366f1; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:1.5rem; }
        .cms-feature-card h3 { font-size:1.15rem; font-weight:600; color:#1e293b; margin-bottom:8px; }
        .cms-feature-card p { color:#64748b; font-size:0.9rem; line-height:1.6; }

        .cms-content { padding:80px 40px; background:#f8fafc; }
        .cms-content-wrapper { display:flex; align-items:center; gap:48px; max-width:1000px; margin:0 auto; }
        .cms-content-text { flex:1; }
        .cms-content-text h2 { font-size:2rem; font-weight:700; color:#1e293b; margin-bottom:16px; }
        .cms-content-text p { color:#64748b; font-size:1rem; line-height:1.8; margin-bottom:24px; }
        .cms-content-image { flex:1; }
        .cms-content-image img { width:100%; height:300px; object-fit:cover; border-radius:12px; }
        .cms-content-image-placeholder { width:100%; height:300px; background:linear-gradient(135deg,#c7d2fe,#e0e7ff); border-radius:12px; display:flex; align-items:center; justify-content:center; color:#6366f1; font-weight:500; }

        .cms-testimonials { padding:80px 40px; background:#fff; }
        .cms-testimonials-header { text-align:center; margin-bottom:48px; }
        .cms-testimonials-header h2 { font-size:2rem; font-weight:700; color:#1e293b; margin-bottom:12px; }
        .cms-testimonials-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; max-width:1000px; margin:0 auto; }
        .cms-testimonial-card { background:#f8fafc; padding:32px; border-radius:12px; position:relative; }
        .cms-testimonial-card::before { content:"\\201C"; font-size:4rem; color:#6366f1; opacity:0.2; position:absolute; top:8px; left:16px; line-height:1; }
        .cms-testimonial-text { color:#475569; font-size:0.95rem; line-height:1.7; margin-bottom:20px; font-style:italic; }
        .cms-testimonial-author { display:flex; align-items:center; gap:12px; }
        .cms-testimonial-avatar { width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:600; }
        .cms-testimonial-name { font-weight:600; color:#1e293b; font-size:0.9rem; }
        .cms-testimonial-role { font-size:0.8rem; color:#94a3b8; }

        .cms-cta { padding:80px 40px; text-align:center; color:#fff; }
        .cms-cta h2 { font-size:2.25rem; font-weight:700; margin-bottom:16px; }
        .cms-cta p { font-size:1.15rem; opacity:0.9; max-width:500px; margin:0 auto 32px; }
        .cms-cta-btn { padding:14px 36px; background:#fff; color:#6366f1; border:none; border-radius:8px; font-size:1rem; font-weight:600; cursor:pointer; transition:transform 0.2s; }
        .cms-cta-btn:hover { transform:translateY(-2px); }

        .cms-pricing { padding:80px 40px; background:#f8fafc; }
        .cms-pricing-header { text-align:center; margin-bottom:48px; }
        .cms-pricing-header h2 { font-size:2rem; font-weight:700; color:#1e293b; margin-bottom:12px; }
        .cms-pricing-header p { color:#64748b; font-size:1.1rem; }
        .cms-pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; max-width:1000px; margin:0 auto; }
        .cms-pricing-card { background:#fff; border-radius:12px; padding:32px; text-align:center; border:1px solid #e2e8f0; transition:transform 0.2s,box-shadow 0.2s; }
        .cms-pricing-card:hover { transform:translateY(-4px); box-shadow:0 10px 40px rgba(0,0,0,0.1); }
        .cms-pricing-card.featured { border-color:#6366f1; position:relative; }
        .cms-pricing-card.featured::before { content:"Popular"; position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:#6366f1; color:#fff; padding:4px 16px; border-radius:9999px; font-size:0.8rem; font-weight:500; }
        .cms-pricing-plan { font-size:1.1rem; font-weight:600; color:#1e293b; margin-bottom:8px; }
        .cms-pricing-price { font-size:2.5rem; font-weight:800; color:#1e293b; margin-bottom:4px; }
        .cms-pricing-price span { font-size:1rem; font-weight:400; color:#94a3b8; }
        .cms-pricing-features { list-style:none; margin:24px 0; text-align:left; }
        .cms-pricing-features li { padding:8px 0; color:#475569; font-size:0.9rem; display:flex; align-items:center; gap:8px; }
        .cms-pricing-features li::before { content:"\\2713"; color:#10b981; font-weight:700; }
        .cms-pricing-btn { width:100%; padding:12px; border-radius:8px; font-weight:600; font-size:0.95rem; cursor:pointer; border:2px solid #6366f1; background:transparent; color:#6366f1; transition:all 0.2s; }
        .cms-pricing-btn:hover, .cms-pricing-card.featured .cms-pricing-btn { background:#6366f1; color:#fff; }

        .cms-contact { padding:80px 40px; background:#fff; }
        .cms-contact-header { text-align:center; margin-bottom:48px; }
        .cms-contact-header h2 { font-size:2rem; font-weight:700; color:#1e293b; margin-bottom:12px; }
        .cms-contact-header p { color:#64748b; font-size:1.1rem; }
        .cms-contact-form { max-width:600px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        .cms-form-row { display:flex; gap:16px; }
        .cms-form-group { flex:1; }
        .cms-form-group label { display:block; font-weight:500; color:#374151; margin-bottom:6px; font-size:0.9rem; }
        .cms-form-group input, .cms-form-group textarea { width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:8px; font-size:0.95rem; transition:border-color 0.2s; outline:none; font-family:inherit; }
        .cms-form-group input:focus, .cms-form-group textarea:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .cms-form-group textarea { min-height:120px; resize:vertical; }
        .cms-form-submit { padding:12px 32px; background:#6366f1; color:#fff; border:none; border-radius:8px; font-size:1rem; font-weight:600; cursor:pointer; transition:background 0.2s; align-self:flex-start; }
        .cms-form-submit:hover { background:#4f46e5; }

        .cms-faq { padding:80px 40px; background:#fff; }
        .cms-faq-header { text-align:center; margin-bottom:48px; }
        .cms-faq-header h2 { font-size:2rem; font-weight:700; color:#1e293b; margin-bottom:12px; }
        .cms-faq-list { max-width:700px; margin:0 auto; }
        .cms-faq-item { border:1px solid #e2e8f0; border-radius:8px; margin-bottom:12px; overflow:hidden; }
        .cms-faq-question { padding:16px 20px; font-weight:600; color:#1e293b; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:#f8fafc; }
        .cms-faq-answer { padding:0 20px 16px; color:#64748b; line-height:1.6; font-size:0.95rem; }

        .cms-gallery { padding:80px 40px; background:#f8fafc; }
        .cms-gallery-header { text-align:center; margin-bottom:48px; }
        .cms-gallery-header h2 { font-size:2rem; font-weight:700; color:#1e293b; margin-bottom:12px; }
        .cms-gallery-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; max-width:1000px; margin:0 auto; }
        .cms-gallery-item { border-radius:12px; overflow:hidden; aspect-ratio:4/3; background:linear-gradient(135deg,#c7d2fe,#e0e7ff); display:flex; align-items:center; justify-content:center; color:#6366f1; font-weight:500; font-size:0.9rem; }
        .cms-gallery-item img { width:100%; height:100%; object-fit:cover; }

        .cms-text-block { padding:60px 40px; max-width:800px; margin:0 auto; }
        .cms-text-block h2 { font-size:1.75rem; font-weight:700; color:#1e293b; margin-bottom:16px; }
        .cms-text-block p { color:#475569; font-size:1rem; line-height:1.8; }

        .cms-spacer { height:60px; }
        .cms-divider { padding:0 40px; }
        .cms-divider hr { border:none; border-top:1px solid #e2e8f0; }

        .cms-footer { padding:48px 40px 24px; background:#1e293b; color:#94a3b8; }
        .cms-footer-content { display:flex; justify-content:space-between; gap:40px; max-width:1000px; margin:0 auto; flex-wrap:wrap; }
        .cms-footer-brand { max-width:300px; }
        .cms-footer-brand h3 { color:#fff; font-size:1.25rem; margin-bottom:12px; }
        .cms-footer-brand p { font-size:0.9rem; line-height:1.6; }
        .cms-footer-links h4 { color:#fff; font-size:0.95rem; margin-bottom:12px; }
        .cms-footer-links ul { list-style:none; }
        .cms-footer-links li { margin-bottom:8px; }
        .cms-footer-links a { color:#94a3b8; text-decoration:none; font-size:0.9rem; transition:color 0.2s; }
        .cms-footer-links a:hover { color:#fff; }
        .cms-footer-bottom { text-align:center; padding-top:24px; margin-top:32px; border-top:1px solid #334155; font-size:0.85rem; max-width:1000px; margin-left:auto; margin-right:auto; }

        .cms-team { padding:80px 40px; background:#f8fafc; }
        .cms-team-header { text-align:center; margin-bottom:48px; }
        .cms-team-header h2 { font-size:2rem; font-weight:700; color:#1e293b; margin-bottom:12px; }
        .cms-team-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:24px; max-width:1000px; margin:0 auto; }
        .cms-team-card { text-align:center; }
        .cms-team-avatar { width:120px; height:120px; border-radius:50%; margin:0 auto 16px; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:2.5rem; font-weight:700; }
        .cms-team-name { font-weight:600; color:#1e293b; font-size:1rem; margin-bottom:4px; }
        .cms-team-role { color:#64748b; font-size:0.85rem; }

        @media (max-width:768px) {
            .cms-hero h1 { font-size:2rem; }
            .cms-hero p { font-size:1rem; }
            .cms-features-grid, .cms-testimonials-grid, .cms-pricing-grid { grid-template-columns:1fr; }
            .cms-content-wrapper { flex-direction:column; }
            .cms-gallery-grid { grid-template-columns:repeat(2,1fr); }
            .cms-team-grid { grid-template-columns:repeat(2,1fr); }
            .cms-footer-content { flex-direction:column; }
            .cms-form-row { flex-direction:column; }
            .cms-navbar { padding:12px 20px; }
            .cms-navbar-links { display:none; }
        }`;
    },

    downloadHTML(html, filename) {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'page.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    getPreviewHTML(components) {
        const settings = Storage.getSiteSettings();
        const componentHTML = components.map(comp =>
            ComponentLibrary.renderComponent(comp.type, comp.props)
        ).join('\n');

        return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=${(settings.font || 'Inter').replace(' ', '+')}:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: '${settings.font || 'Inter'}', sans-serif; color: #1e293b; line-height: 1.6; }
        a { color: inherit; text-decoration: none; }
        button { cursor: pointer; font-family: inherit; }
        img { max-width: 100%; }
        ${this.getComponentCSS()}
    </style>
</head>
<body>${componentHTML}</body>
</html>`;
    }
};
