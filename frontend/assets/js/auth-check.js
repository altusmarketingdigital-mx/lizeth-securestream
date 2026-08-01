// Función global universal para mostrar/ocultar contraseña (ojito)
window.togglePasswordVisibility = function(targetId, btnElement) {
    const input = document.getElementById(targetId);
    if (!input) return;
    
    const btn = btnElement || (window.event ? (window.event.currentTarget || window.event.target.closest('.toggle-password')) : null);
    
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) {
            btn.style.color = '#c850e0';
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
    } else {
        input.type = 'password';
        if (btn) {
            btn.style.color = '#aaa';
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
        const isAdmin = localStorage.getItem('isAdmin');
        const isTrueAdmin = isAdmin === '1' || isAdmin === 'true' || isAdmin === true;
        
        const signInBtns = document.querySelectorAll('a[href="/login.html"], a[href="login.html"]');
        signInBtns.forEach(btn => {
            btn.href = isTrueAdmin ? '/admin.html' : '/dashboard.html';
            btn.textContent = 'PANEL';
            
            // Inyectar botón destacado de CERRAR SESIÓN en móviles y escritorio si aún no existe
            const parent = btn.parentElement;
            if (parent && !parent.querySelector('.btn-global-logout')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.className = 'btn-global-logout';
                logoutBtn.textContent = 'SALIR';
                logoutBtn.style.cssText = "background: rgba(229, 42, 126, 0.2); border: 1px solid rgba(229, 42, 126, 0.5); color: #ff4d4d; padding: 6px 14px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 0.8rem; margin-left: 8px; transition: 0.3s; vertical-align: middle;";
                
                logoutBtn.onclick = async (e) => {
                    e.preventDefault();
                    try {
                        await fetch('/api/auth/logout', { method: 'POST' });
                    } catch(err) {}
                    localStorage.clear();
                    window.location.href = '/';
                };
                
                btn.insertAdjacentElement('afterend', logoutBtn);
            }
        });
    }
});

// Interceptor global de peticiones para garantizar envío de credenciales/tokens y detección de cierre de sesión
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    options = options || {};
    options.credentials = options.credentials || 'include';
    
    const token = localStorage.getItem('sessionToken');
    if (token) {
        if (!options.headers) {
            options.headers = { 'Authorization': 'Bearer ' + token };
        } else if (options.headers instanceof Headers) {
            if (!options.headers.has('Authorization')) {
                options.headers.append('Authorization', 'Bearer ' + token);
            }
        } else if (typeof options.headers === 'object') {
            if (!options.headers['Authorization'] && !options.headers['authorization']) {
                options.headers['Authorization'] = 'Bearer ' + token;
            }
        }
    }
    
    const response = await originalFetch.apply(this, [url, options]);
    
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
