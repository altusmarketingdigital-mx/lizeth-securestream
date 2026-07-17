document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const settings = await res.json();
            
            // Inyectar en elementos por ID
            const textMappings = {
                'footer_text': 'dyn-footer_text',
                'hero_title': 'dyn-hero_title',
                'hero_subtitle': 'dyn-hero_subtitle',
                'hero_body': 'dyn-hero_body',
                'hero_btn_text': 'dyn-hero_btn_text',
                'hero_card_title': 'dyn-hero_card_title',
                'hero_card_badge1': 'dyn-hero_card_badge1',
                'hero_card_badge2': 'dyn-hero_card_badge2',
                'donation_text': 'dyn-donation_text'
            };

            for (const [key, id] of Object.entries(textMappings)) {
                const el = document.getElementById(id);
                if (el && settings[key]) {
                    el.innerHTML = settings[key]; // usamos innerHTML por si hay <br>
                }
            }

            // Inyectar imágenes
            const imageMappings = {
                'hero_card_image': 'dyn-hero_card_image',
                'logo_url': 'dyn-logo_img'
            };

            for (const [key, id] of Object.entries(imageMappings)) {
                const el = document.getElementById(id);
                if (el && settings[key]) {
                    el.src = settings[key];
                }
            }

            // Mantenimiento
            if (settings['is_maintenance_mode'] === 'true') {
                const isAdmin = localStorage.getItem('isAdmin') === 'true';
                const isPathAdmin = window.location.pathname.includes('admin') || window.location.pathname.includes('maintenance') || window.location.pathname.includes('login');
                if (!isAdmin && !isPathAdmin) {
                    window.location.href = '/maintenance.html';
                }
            }
        }
    } catch (e) {
        console.error('Error cargando configuraciones del sitio', e);
    }
});
