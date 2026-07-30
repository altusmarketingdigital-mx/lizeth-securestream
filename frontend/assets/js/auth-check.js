document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
        const isAdmin = localStorage.getItem('isAdmin');
        const isTrueAdmin = isAdmin === '1' || isAdmin === 'true' || isAdmin === true;
        
        const signInBtns = document.querySelectorAll('a[href="/login.html"]');
        signInBtns.forEach(btn => {
            btn.href = isTrueAdmin ? '/admin.html' : '/dashboard.html';
            btn.textContent = 'PANEL';
        });
    }
});

// Interceptor global de peticiones para detectar la expiración de sesión por inicio en otro dispositivo
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    if (response.status === 401) {
        try {
            const clone = response.clone();
            const data = await clone.json();
            if (data.code === 'SINGLE_DEVICE_SESSION_EXPIRED' || (data.message && data.message.includes('iniciado sesión en otro dispositivo'))) {
                localStorage.clear();
                alert(data.message || 'Has iniciado sesión en otro dispositivo. Por seguridad, esta sesión ha sido cerrada.');
                window.location.href = '/login.html';
            }
        } catch(e) {}
    }
    
    return response;
};
