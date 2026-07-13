document.addEventListener('DOMContentLoaded', async () => {
    const email = localStorage.getItem('userEmail');
    if (!email) window.location.href = '/';
    document.getElementById('admin-user-info').textContent = email;

    // Tabs
    const tabs = {
        'tab-dashboard': 'view-dashboard',
        'tab-videos': 'view-videos',
        'tab-users': 'view-users',
        'tab-coupons': 'view-coupons'
    };

    for (const [tabId, viewId] of Object.entries(tabs)) {
        document.getElementById(tabId).addEventListener('click', (e) => {
            e.preventDefault();
            // Limpiar activos
            Object.keys(tabs).forEach(t => document.getElementById(t).classList.remove('active'));
            Object.values(tabs).forEach(v => document.getElementById(v).style.display = 'none');
            
            // Activar actual
            document.getElementById(tabId).classList.add('active');
            document.getElementById(viewId).style.display = 'block';

            // Cargar datos según la vista
            if (tabId === 'tab-dashboard') loadStats();
            if (tabId === 'tab-users') loadUsers();
            if (tabId === 'tab-videos') loadVideos();
            if (tabId === 'tab-coupons') loadCoupons();
        });
    }

    // Funciones de carga (Requieren JWT válido con rol admin)
    async function apiGet(endpoint) {
        const res = await fetch(endpoint);
        if (res.status === 403 || res.status === 401) {
            alert('Acceso denegado. Se requieren privilegios de administrador.');
            window.location.href = '/dashboard.html';
            return null;
        }
        return res.json();
    }

    async function loadStats() {
        const data = await apiGet('/api/admin/stats');
        if (data) {
            document.getElementById('stat-users').textContent = data.totalUsers;
            document.getElementById('stat-premium').textContent = data.premiumUsers;
            document.getElementById('stat-videos').textContent = data.totalVideos;
        }
    }

    async function loadUsers() {
        const data = await apiGet('/api/admin/users');
        if (data) {
            const tbody = document.getElementById('users-tbody');
            tbody.innerHTML = data.map(u => `
                <tr>
                    <td>${u.email}</td>
                    <td><span class="badge ${u.has_premium ? 'premium-badge' : ''}">${u.has_premium ? 'Premium' : 'Gratis'}</span></td>
                    <td>${u.is_admin ? 'Admin' : 'Usuario'}</td>
                    <td>${new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
    }

    async function loadVideos() {
        const data = await apiGet('/api/admin/videos');
        if (data) {
            const tbody = document.getElementById('videos-tbody');
            tbody.innerHTML = data.map(v => `
                <tr>
                    <td>${v.title}</td>
                    <td><code>${v.secure_slug}</code></td>
                    <td>${new Date(v.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
    }

    async function loadCoupons() {
        const data = await apiGet('/api/coupons');
        if (data) {
            const tbody = document.getElementById('coupons-tbody');
            tbody.innerHTML = data.map(c => `
                <tr>
                    <td><strong>${c.code}</strong></td>
                    <td>${c.discount_percentage}%</td>
                    <td><span class="badge ${c.is_active ? 'premium-badge' : ''}" style="${!c.is_active ? 'background: #555; color: #fff;' : ''}">${c.is_active ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <button class="btn-primary sm-btn toggle-coupon" data-id="${c.id}" data-active="${c.is_active}" style="padding: 5px 10px; font-size: 0.8rem; background: ${c.is_active ? '#dc2626' : '#16a34a'};">
                            ${c.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                    </td>
                </tr>
            `).join('');

            document.querySelectorAll('.toggle-coupon').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    const currentActive = e.target.getAttribute('data-active') === 'true';
                    await fetch(`/api/coupons/${id}/toggle`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active: !currentActive })
                    });
                    loadCoupons();
                });
            });
        }
    }

    // Formularios
    document.getElementById('btn-add-video').addEventListener('click', () => {
        document.getElementById('add-video-form').style.display = 'block';
    });

    document.getElementById('submit-video').addEventListener('click', async () => {
        const title = document.getElementById('v-title').value;
        const desc = document.getElementById('v-desc').value;
        const price = document.getElementById('v-price').value;
        const path = document.getElementById('v-path').value;

        if(!title || !path || !price) return alert('Título, precio y ruta son requeridos');

        const res = await fetch('/api/admin/videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description: desc, price, internal_storage_path: path })
        });

        if (res.ok) {
            alert('Video agregado exitosamente');
            document.getElementById('add-video-form').style.display = 'none';
            loadVideos(); // recargar
        } else {
            alert('Error al agregar video');
        }
    });

    document.getElementById('btn-add-coupon').addEventListener('click', () => {
        document.getElementById('add-coupon-form').style.display = 'block';
    });

    document.getElementById('submit-coupon').addEventListener('click', async () => {
        const code = document.getElementById('c-code').value;
        const discount = document.getElementById('c-discount').value;

        if(!code || !discount) return alert('Código y porcentaje son requeridos');

        const res = await fetch('/api/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, discount_percentage: discount })
        });

        if (res.ok) {
            alert('Cupón creado exitosamente');
            document.getElementById('add-coupon-form').style.display = 'none';
            document.getElementById('c-code').value = '';
            document.getElementById('c-discount').value = '';
            loadCoupons();
        } else {
            const err = await res.json();
            alert(err.error || 'Error al crear cupón');
        }
    });

    // Carga inicial
    loadStats();
});
