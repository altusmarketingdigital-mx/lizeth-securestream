document.addEventListener('DOMContentLoaded', async () => {
    // Determine which page we are on based on the path or a data attribute
    const container = document.getElementById('dynamic-legal-content');
    if (!container) return;

    const pageType = container.getAttribute('data-page-type'); // e.g. "terms", "privacy", "refunds"
    if (!pageType) return;

    const lang = localStorage.getItem('lang') || 'en';
    const key = `page_${pageType}_${lang}`;

    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const settings = await res.json();
            if (settings[key] && settings[key].trim() !== '') {
                container.innerHTML = settings[key];
            } else {
                container.innerHTML = lang === 'en' 
                    ? '<p>This document is currently being updated. Please check back later.</p>' 
                    : '<p>Este documento está siendo actualizado. Por favor, vuelva más tarde.</p>';
            }
        } else {
            throw new Error('Failed to fetch settings');
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = lang === 'en' 
            ? '<p>Error loading content.</p>' 
            : '<p>Error al cargar el contenido.</p>';
    }
});
