document.addEventListener('DOMContentLoaded', async () => {
    const email = localStorage.getItem('userEmail');
    if (!email) {
        window.location.href = '/';
        return;
    }
    document.getElementById('admin-user-info').textContent = email;

    const tabs = {
        'tab-dashboard': 'view-dashboard',
        'tab-videos': 'view-videos',
        'tab-users': 'view-users',
        'tab-clients': 'view-clients',
        'tab-sales': 'view-sales',
        'tab-coupons': 'view-coupons',
        'tab-carousel': 'view-carousel',
        'tab-settings': 'view-settings',
        'tab-legal': 'view-legal',
        'tab-donations': 'view-donations'
    };

    let perms = [];
    try {
        perms = JSON.parse(localStorage.getItem('permissions') || '[]');
    } catch(e) {}
    
    const hasPerm = (p) => perms.includes('all') || perms.includes(p);
    
    if (!hasPerm('view_dashboard')) document.getElementById('tab-dashboard').style.display = 'none';
    if (!hasPerm('manage_users')) document.getElementById('tab-users').style.display = 'none';
    if (!hasPerm('manage_clients')) document.getElementById('tab-clients').style.display = 'none';
    if (!hasPerm('manage_videos')) document.getElementById('tab-videos').style.display = 'none';
    if (!hasPerm('view_sales')) document.getElementById('tab-sales').style.display = 'none';
    if (!hasPerm('manage_coupons')) document.getElementById('tab-coupons').style.display = 'none';
    if (!hasPerm('manage_settings')) {
        document.getElementById('tab-carousel').style.display = 'none';
        document.getElementById('tab-settings').style.display = 'none';
        document.getElementById('tab-legal').style.display = 'none';
        document.getElementById('tab-donations').style.display = 'none';
    }


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
            if (tabId === 'tab-dashboard') { loadStats(); loadUsers(); }
            if (tabId === 'tab-users') loadUsers();
            if (tabId === 'tab-clients') loadUsers();
            if (tabId === 'tab-sales') loadSales();
            if (tabId === 'tab-videos') loadVideos();
            if (tabId === 'tab-coupons') { loadCoupons(); populateCouponVideos(); }
            if (tabId === 'tab-carousel') loadCarousel();
            if (tabId === 'tab-settings') loadSettings();
            if (tabId === 'tab-legal') loadLegalSettings();
            if (tabId === 'tab-donations') loadDonations();
        });
    }

    // Auto-activar el primer tab visible
    const firstVisibleTab = Object.keys(tabs).find(t => document.getElementById(t).style.display !== 'none');
    if (firstVisibleTab) document.getElementById(firstVisibleTab).click();
    else document.getElementById('view-dashboard').style.display = 'none'; // Si no hay nada, ocultar todo

    const btnExport = document.getElementById('btn-export-clients');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                const clients = data.filter(u => !u.is_admin);
                
                let csv = "Nombre,Email,Premium,FechaRegistro,Bloqueado\n";
                clients.forEach(c => {
                    const name = (c.name || 'Sin Nombre').replace(/,/g, '');
                    const email = c.email;
                    const premium = c.has_premium ? 'Si' : 'No';
                    const date = new Date(c.created_at).toLocaleDateString();
                    const blocked = c.is_blocked ? 'Si' : 'No';
                    csv += `${name},${email},${premium},${date},${blocked}\n`;
                });
                
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('hidden', '');
                a.setAttribute('href', url);
                a.setAttribute('download', 'clientes.csv');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (e) {
                console.error(e);
                alert('Error al exportar clientes');
            }
        });
    }

    // Logout Handler
    const btnLogout = document.getElementById('btn-admin-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const token = localStorage.getItem('token');
                await fetch('/api/auth/logout', { 
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            } catch (error) {
                console.error('Error closing session:', error);
            }
            localStorage.removeItem('token');
            localStorage.removeItem('userEmail');
            window.location.href = '/';
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
            document.getElementById('stat-videos').textContent = data.totalVideos;
            
            const todayEl = document.getElementById('stat-rev-today');
            const monthEl = document.getElementById('stat-rev-month');
            const yearEl = document.getElementById('stat-rev-year');
            
            if (todayEl) todayEl.textContent = '$' + (data.revToday || 0).toFixed(2);
            if (monthEl) monthEl.textContent = '$' + (data.revMonth || 0).toFixed(2);
            if (yearEl) yearEl.textContent = '$' + (data.revYear || 0).toFixed(2);
        }
    }

    async function loadUsers() {
        const data = await apiGet('/api/admin/users');
        if (data) {
            const admins = data.filter(u => u.is_admin);
            const clients = data.filter(u => !u.is_admin);
            
            document.getElementById('stat-users').textContent = admins.length;
            document.getElementById('stat-clients').textContent = clients.length;

            const usersTbody = document.getElementById('users-tbody');
            if (usersTbody) {
                usersTbody.innerHTML = admins.map(u => `
                    <tr>
                        <td>${u.name || '-'}</td>
                        <td>${u.email}</td>
                        <td>${u.role || 'Administrador'}</td>
                        <td>${new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-primary sm-btn edit-user-btn" style="background:#2563eb;" data-id="${u.id}" data-name="${u.name || ''}" data-email="${u.email}" data-role="${u.role || 'Administrador'}" data-permissions='${JSON.stringify(u.permissions || [])}'>Editar</button>
                            <button class="btn-primary sm-btn delete-user-btn" style="background:#dc2626;" data-id="${u.id}">Eliminar</button>
                        </td>
                    </tr>
                `).join('');

                // Listeners for edit/delete buttons
                document.querySelectorAll('.edit-user-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.target.getAttribute('data-id');
                        const name = e.target.getAttribute('data-name');
                        const email = e.target.getAttribute('data-email');
                        const role = e.target.getAttribute('data-role');
                        const permsStr = e.target.getAttribute('data-permissions');
                        let perms = [];
                        try { perms = JSON.parse(permsStr); } catch (err) {}
                        
                        document.getElementById('u-id').value = id;
                        document.getElementById('u-name').value = name;
                        document.getElementById('u-email').value = email;
                        document.getElementById('u-role').value = role;
                        document.getElementById('u-password').placeholder = 'Dejar en blanco para mantener actual';
                        
                        document.querySelectorAll('.u-perm').forEach(chk => {
                            chk.checked = perms.includes('all') || perms.includes(chk.value);
                        });
                        
                        document.getElementById('user-form-title').textContent = 'Editar Usuario';
                        document.getElementById('user-form-panel').style.display = 'block';
                    });
                });

                document.querySelectorAll('.delete-user-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        if (!confirm('¿Estás seguro de que deseas eliminar este usuario de forma permanente?')) return;
                        const id = e.target.getAttribute('data-id');
                        const token = localStorage.getItem('token');
                        try {
                            const res = await fetch(`/api/admin/users/${id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': 'Bearer ' + token }
                            });
                            const result = await res.json();
                            if (res.ok) {
                                alert('Usuario eliminado');
                                loadUsers();
                            } else {
                                alert(result.error || 'Error al eliminar');
                            }
                        } catch(err) {
                            console.error(err);
                            alert('Error de red');
                        }
                    });
                });
            }

            allClientsData = clients;
            renderClients(clients);

            const searchInput = document.getElementById('search-clients');
            if (searchInput && !searchInput.hasAttribute('data-listener')) {
                searchInput.setAttribute('data-listener', 'true');
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const filtered = allClientsData.filter(c => 
                        (c.name && c.name.toLowerCase().includes(term)) ||
                        (c.email && c.email.toLowerCase().includes(term))
                    );
                    renderClients(filtered);
                });
            }
        }
    }

    let allClientsData = [];

    function renderClients(clientsToRender) {
        const clientsTbody = document.getElementById('clients-tbody');
        if (clientsTbody) {
            clientsTbody.innerHTML = clientsToRender.map(u => `
                <tr>
                    <td style="${u.is_blocked ? 'text-decoration: line-through; color: #888;' : ''}">
                        <div style="display:flex; align-items:center; gap: 8px;">
                            <span>${u.name || '<em style="color:#666;">Sin Nombre</em>'}</span>
                            <button class="btn-primary sm-btn edit-name-btn" data-id="${u.id}" data-name="${u.name || ''}" style="background:transparent; border:1px solid #666; padding:2px 6px; font-size:0.7rem;" title="Editar Nombre">✎</button>
                        </div>
                    </td>
                    <td style="${u.is_blocked ? 'text-decoration: line-through; color: #888;' : ''}">${u.email}</td>
                    <td>${u.has_premium ? '<span style="color:#16a34a;">Sí</span>' : 'No'}</td>
                    <td>${new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-primary sm-btn block-btn" data-id="${u.id}" style="background: ${u.is_blocked ? '#16a34a' : '#dc2626'}; padding: 4px 8px; font-size: 0.8rem; margin-right: 5px;">
                            ${u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button class="btn-primary sm-btn reset-btn" data-id="${u.id}" style="background: #2563eb; padding: 4px 8px; font-size: 0.8rem;">
                            Nueva Clave
                        </button>
                    </td>
                </tr>
            `).join('');

            document.querySelectorAll('.edit-name-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    const currentName = e.target.getAttribute('data-name');
                    const newName = prompt('Ingresa el nuevo nombre para este cliente:', currentName);
                    
                    if (newName !== null && newName.trim() !== '') {
                        const token = localStorage.getItem('token');
                        const res = await fetch(`/api/admin/users/${id}/name`, {
                            method: 'PUT',
                            headers: { 
                                'Authorization': 'Bearer ' + token,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ name: newName.trim() })
                        });
                        
                        const data = await res.json();
                        if (res.ok) {
                            loadUsers();
                        } else {
                            alert(data.error || 'Error al actualizar el nombre');
                        }
                    }
                });
            });

            document.querySelectorAll('.block-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (!confirm('¿Seguro que deseas cambiar el estado de este cliente?')) return;
                    const id = e.target.getAttribute('data-id');
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/admin/users/${id}/toggle-block`, {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message);
                        loadUsers();
                    } else {
                        alert(data.error || 'Error');
                    }
                });
            });

            document.querySelectorAll('.reset-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (!confirm('¿Generar nueva contraseña para este cliente? Se cerrará su sesión actual.')) return;
                    const id = e.target.getAttribute('data-id');
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(`NUEVA CONTRASEÑA GENERADA:\n\n${data.newPassword}\n\nCopia y envía esta contraseña al cliente.`);
                    } else {
                        alert(data.error || 'Error');
                    }
                });
            });
        }
    }

    let allSalesData = [];

    function renderSales(sales) {
        const tbody = document.getElementById('sales-tbody');
        if (!tbody) return;

        tbody.innerHTML = sales.map(s => {
            const orderNum = s.order_number || '<em style="color:#666;">N/A</em>';
            const country = s.country || '<em style="color:#666;">N/A</em>';
            const status = s.status || 'exitoso';
            const amount = parseFloat(s.amount) || 0;
            
            let statusColor = '#16a34a'; // verde
            if (status.toLowerCase() === 'cancelado') statusColor = '#dc2626'; // rojo
            if (status.toLowerCase() === 'rechazado') statusColor = '#f59e0b'; // naranja
            
            return `
            <tr>
                <td>${new Date(s.purchase_date).toLocaleString()}</td>
                <td><code style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">${orderNum}</code></td>
                <td>
                    <div style="font-weight:bold;">${s.user_name || 'Desconocido'}</div>
                    <div style="font-size:0.85rem; color:#aaa;">${s.user_email || ''}</div>
                </td>
                <td>${country}</td>
                <td>${s.video_title}</td>
                <td><span style="background:${statusColor}; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.8rem; text-transform:uppercase;">${status}</span></td>
                <td style="color:#16a34a; font-weight:bold;">$${amount.toFixed(2)}</td>
            </tr>
            `;
        }).join('');

        const countEl = document.getElementById('sales-count');
        const revEl = document.getElementById('sales-revenue');
        if(countEl) countEl.textContent = sales.length;
        if(revEl) revEl.textContent = '$' + sales.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0).toFixed(2);
    }

    async function loadSales() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/sales', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) throw new Error('Error al obtener ventas');
            allSalesData = await res.json();
            
            renderSales(allSalesData);

            const searchInput = document.getElementById('search-sales');
            if (searchInput && !searchInput.hasAttribute('data-listener')) {
                searchInput.setAttribute('data-listener', 'true');
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const filtered = allSalesData.filter(s => 
                        (s.user_name && s.user_name.toLowerCase().includes(term)) ||
                        (s.user_email && s.user_email.toLowerCase().includes(term))
                    );
                    renderSales(filtered);
                });
            }

            const countEl = document.getElementById('sales-count');
            const revEl = document.getElementById('sales-revenue');
            if(countEl) countEl.textContent = totalCount;
            if(revEl) revEl.textContent = '$' + totalRevenue.toFixed(2);

        } catch (err) {
            console.error('Error cargando ventas:', err);
        }
    }

    async function loadVideos() {
        const data = await apiGet('/api/admin/videos');
        if (data) {
            const tbody = document.getElementById('videos-tbody');
            tbody.innerHTML = data.map(v => {
                const isPublished = new Date(v.published_at) <= new Date();
                const pubStatus = isPublished ? '<span style="color:#16a34a;">Publicado</span>' : '<span style="color:#f59e0b;">Programado</span>';
                const visStatus = v.is_hidden ? '<span style="color:#dc2626;">(Oculto)</span>' : '';
                const sym = v.currency === 'EUR' ? '€' : '$';
                const salePrice = v.sale_price ? `<br><span style="color:#16a34a;">${sym}${v.sale_price} ${v.currency}</span>` : '';
                const pubDateStr = v.published_at ? new Date(v.published_at).toLocaleString() : '';
                
                return `
                <tr>
                    <td><strong>${v.title}</strong><br><span style="font-size:0.8rem;color:#888;">${v.secure_slug}</span></td>
                    <td>${sym}${v.price} ${v.currency} ${salePrice}</td>
                    <td>${pubStatus} ${visStatus}<br><span style="font-size:0.8rem;color:#aaa;">${pubDateStr}</span></td>
                    <td>
                        <button class="btn-primary sm-btn edit-video-btn" style="background:#2563eb;" 
                            data-id="${v.id}" 
                            data-title="${v.title.replace(/"/g, '&quot;')}" 
                            data-desc="${(v.description||'').replace(/"/g, '&quot;')}"
                            data-price="${v.price}"
                            data-saleprice="${v.sale_price || ''}"
                            data-currency="${v.currency || 'MXN'}"
                            data-pub="${v.published_at ? new Date(v.published_at).toISOString().slice(0,16) : ''}"
                            data-hidden="${v.is_hidden}"
                            data-path="${(v.internal_storage_path||'').replace(/"/g, '&quot;')}"
                            data-slug="${v.secure_slug}">
                            Editar
                        </button>
                        <button class="btn-primary sm-btn delete-video-btn" style="background:#dc2626;" data-id="${v.id}">Eliminar</button>
                    </td>
                </tr>
                `;
            }).join('');

            document.querySelectorAll('.edit-video-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    document.getElementById('v-id').value = id;
                    document.getElementById('v-title').value = e.target.getAttribute('data-title');
                    
                    if (window.videoDescEditor) {
                        window.videoDescEditor.root.innerHTML = e.target.getAttribute('data-desc');
                    } else {
                        const el = document.getElementById('v-desc-editor');
                        if (el) el.innerHTML = e.target.getAttribute('data-desc');
                    }
                    
                    document.getElementById('v-price').value = e.target.getAttribute('data-price');
                    document.getElementById('v-sale-price').value = e.target.getAttribute('data-saleprice');
                    document.getElementById('v-currency').value = e.target.getAttribute('data-currency');
                    document.getElementById('v-published-at').value = e.target.getAttribute('data-pub');
                    document.getElementById('v-is-hidden').checked = e.target.getAttribute('data-hidden') === 'true';
                    
                    const videoPath = e.target.getAttribute('data-path');
                    const videoSlug = e.target.getAttribute('data-slug');
                    
                    if (videoPath && videoPath.trim() !== '') {
                        document.getElementById('v-current-video-container').style.display = 'block';
                        document.getElementById('v-current-video').textContent = videoPath;
                        
                        let downloadBtn = document.getElementById('v-current-video-download');
                        if (!downloadBtn) {
                            downloadBtn = document.createElement('a');
                            downloadBtn.id = 'v-current-video-download';
                            downloadBtn.target = '_blank';
                            // We don't force 'download' attribute if it's external, but it's safe to have it
                            downloadBtn.style.background = 'rgba(255,255,255,0.1)';
                            downloadBtn.style.border = '1px solid rgba(255,255,255,0.2)';
                            downloadBtn.style.padding = '5px 10px';
                            downloadBtn.style.borderRadius = '6px';
                            downloadBtn.style.color = 'white';
                            downloadBtn.style.textDecoration = 'none';
                            downloadBtn.style.fontSize = '0.85rem';
                            downloadBtn.style.marginLeft = '10px';
                            downloadBtn.style.whiteSpace = 'nowrap';
                            downloadBtn.title = 'Descargar / Ver Video';
                            downloadBtn.innerHTML = '⬇️ Ver / Descargar';
                            
                            const parentDiv = document.getElementById('v-current-video').parentNode;
                            if (parentDiv.tagName === 'DIV') {
                                parentDiv.parentNode.appendChild(downloadBtn);
                            } else {
                                parentDiv.appendChild(downloadBtn);
                            }
                        }
                        
                        if (videoPath.startsWith('http')) {
                            downloadBtn.href = videoPath;
                            downloadBtn.style.display = 'inline-block';
                        } else if (videoSlug && videoSlug !== 'undefined' && videoSlug !== 'null' && videoSlug.trim() !== '') {
                            downloadBtn.href = `/api/videos/stream/${videoSlug}`;
                            downloadBtn.style.display = 'inline-block';
                        } else {
                            // If no slug and no external URL, fallback to internal storage path directly (might not be accessible from frontend but worth a try)
                            downloadBtn.href = `/${videoPath}`;
                            downloadBtn.style.display = 'inline-block';
                        }
                    } else {
                        document.getElementById('v-current-video-container').style.display = 'none';
                        document.getElementById('v-current-video').textContent = '';
                        const downloadBtn = document.getElementById('v-current-video-download');
                        if (downloadBtn) {
                            downloadBtn.style.display = 'none';
                        }
                    }
                    
                    const token = localStorage.getItem('token');
                    fetch(`/api/videos/${id}/images`, { headers: { 'Authorization': 'Bearer ' + token } })
                        .then(res => res.ok ? res.json() : [])
                        .then(images => {
                            if (Array.isArray(images)) {
                                selectedImages = images.map(img => ({
                                    file: null,
                                    data: img.image_data,
                                    id: img.id
                                }));
                                updateImagePreviews();
                            }
                        }).catch(console.error);

                    document.getElementById('add-video-form').style.display = 'block';
                    document.getElementById('add-video-form').scrollIntoView({ behavior: 'smooth' });
                });
            });

            document.querySelectorAll('.delete-video-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('¿Estás seguro de que deseas eliminar (ocultar) este video? Los clientes que ya lo compraron seguirán teniendo acceso.')) {
                        const id = e.target.getAttribute('data-id');
                        const token = localStorage.getItem('token');
                        const res = await fetch('/api/admin/videos/' + id, {
                            method: 'DELETE',
                            headers: { 'Authorization': 'Bearer ' + token }
                        });
                        if (res.ok) {
                            alert('Video eliminado exitosamente');
                            loadVideos();
                        } else {
                            alert('Error al eliminar video');
                        }
                    }
                });
            });
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
                    <td>${c.video_title || '<span style="color:#aaa;">Global</span>'}</td>
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

    async function populateCouponVideos() {
        const data = await apiGet('/api/admin/videos');
        if (data) {
            const select = document.getElementById('c-video');
            select.innerHTML = '<option value="">Válido para cualquier video (Global)</option>' + 
                data.map(v => `<option value="${v.id}">${v.title}</option>`).join('');
        }
    }

    async function loadCarousel() {
        const data = await apiGet('/api/carousel');
        if (data) {
            const grid = document.getElementById('carousel-grid');
            if (data.length === 0) {
                grid.innerHTML = '<p style="color: #aaa;">No hay imágenes en el carrusel.</p>';
                return;
            }
            grid.innerHTML = data.map(img => `
                <div style="position: relative; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5);">
                    <img src="${img.image_data}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;">
                    <button class="btn-delete-carousel" data-id="${img.id}" style="position: absolute; top: 10px; right: 10px; background: #dc2626; color: white; border: none; border-radius: 5px; padding: 5px 10px; cursor: pointer;">Eliminar</button>
                </div>
            `).join('');

            document.querySelectorAll('.btn-delete-carousel').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('¿Eliminar esta imagen del carrusel?')) {
                        const id = e.target.getAttribute('data-id');
                        await fetch(`/api/carousel/${id}`, { method: 'DELETE' });
                        loadCarousel();
                    }
                });
            });
        }
    }

    async function loadSettings() {
        const data = await apiGet('/api/settings'); // Public endpoint but used by admin too
        if (data) {
            const fields = [
                'footer_text', 'hero_title', 'hero_subtitle', 'hero_body', 
                'hero_btn_text', 'hero_card_title', 'hero_card_badge1', 
                'hero_card_badge2', 'hero_card_image', 'donation_text'
            ];
            fields.forEach(f => {
                const el = document.getElementById('set-' + f);
                if(el) {
                    el.value = data[f] || '';
                    if (f === 'logo_url' || f === 'hero_card_image') {
                        const preview = document.getElementById('preview-' + f);
                        if (data[f] && preview) {
                            preview.innerHTML = `<img src="${data[f]}" style="max-width:100%; max-height:100px; border-radius:5px;">`;
                        }
                    }
                }
            });
            const chk = document.getElementById('set-is_maintenance_mode');
            if (chk) chk.checked = data['is_maintenance_mode'] === 'true';
        }
    }

    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const fields = [
            'footer_text', 'hero_title', 'hero_subtitle', 'hero_body', 
            'hero_btn_text', 'hero_card_title', 'hero_card_badge1', 
            'hero_card_badge2', 'hero_card_image', 'donation_text'
        ];
        
        const payload = {};
        fields.forEach(f => {
            const el = document.getElementById('set-' + f);
            if(el) payload[f] = el.value;
        });
        const chk = document.getElementById('set-is_maintenance_mode');
        if (chk) payload['is_maintenance_mode'] = chk.checked ? 'true' : 'false';

        const btn = document.getElementById('btn-save-settings');
        btn.textContent = 'Guardando...';
        btn.disabled = true;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Configuración guardada exitosamente');
            } else {
                alert('Error al guardar configuración');
            }
        } catch(e) {
            alert('Error de red');
        } finally {
            btn.textContent = 'Guardar Cambios';
            btn.disabled = false;
        }
    });

    const btnFixCors = document.getElementById('btn-fix-cors');
    if (btnFixCors) {
        btnFixCors.addEventListener('click', async () => {
            btnFixCors.textContent = 'Aplicando...';
            btnFixCors.disabled = true;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/admin/fix-cors', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + token
                    }
                });
                const data = await res.json();
                if (res.ok) {
                    alert(data.message || 'Permisos CORS aplicados correctamente en S3.');
                } else {
                    alert('Error: ' + (data.error || 'No se pudo configurar CORS'));
                }
            } catch(e) {
                alert('Error de red al contactar al servidor.');
            } finally {
                btnFixCors.textContent = 'Reparar Permisos CORS de Amazon S3';
                btnFixCors.disabled = false;
            }
        });
    }

    // Image Handlers for Settings
    ['logo_url', 'hero_card_image'].forEach(f => {
        const fileInput = document.getElementById('file-' + f);
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return alert('La imagen excede los 2MB.');

                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    document.getElementById('set-' + f).value = base64;
                    document.getElementById('preview-' + f).innerHTML = `<img src="${base64}" style="max-width:100%; max-height:100px; border-radius:5px;">`;
                };
                reader.readAsDataURL(file);
            });
        }
    });

    // Formularios
    let selectedImages = [];
    
    document.getElementById('btn-add-video').addEventListener('click', () => {
        document.getElementById('add-video-form').style.display = 'block';
        document.getElementById('v-current-video-container').style.display = 'none';
        document.getElementById('v-current-video').textContent = '';
        selectedImages = [];
        updateImagePreviews();
    });

    document.getElementById('v-images').addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        for (const file of files) {
            if (selectedImages.length >= 10) {
                alert('No puedes subir más de 10 imágenes.');
                break;
            }
            if (!file.type.startsWith('image/')) {
                alert('Solo se permiten archivos de imagen.');
                continue;
            }
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 800; // Resize to max 800px to keep payload very small
                    
                    if (width > height) {
                        if (width > maxDim) {
                            height = Math.round((height *= maxDim / width));
                            width = maxDim;
                        }
                    } else {
                        if (height > maxDim) {
                            width = Math.round((width *= maxDim / height));
                            height = maxDim;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Compress as WebP with 0.7 quality
                    const compressedDataUrl = canvas.toDataURL('image/webp', 0.7);
                    
                    selectedImages.push({
                        name: file.name,
                        data: compressedDataUrl
                    });
                    updateImagePreviews();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        // Limpiar input para permitir seleccionar el mismo archivo de nuevo si se borra
        e.target.value = '';
    });

    function updateImagePreviews() {
        const container = document.getElementById('img-previews');
        const counter = document.getElementById('img-counter');
        
        counter.textContent = `(${selectedImages.length} / 10)`;
        container.innerHTML = selectedImages.map((img, index) => `
            <div style="position: relative; width: 100px; height: 100px; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2);">
                <img src="${img.data}" style="width: 100%; height: 100%; object-fit: cover;">
                <button type="button" onclick="removeImage(${index})" style="position: absolute; top: 2px; right: 2px; background: rgba(220, 38, 38, 0.9); border: none; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;" title="Eliminar">✕</button>
                ${index === 0 
                    ? `<div style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(16, 185, 129, 0.9); color: white; font-size: 0.65rem; text-align: center; padding: 3px 0; font-weight: bold; pointer-events: none;">PORTADA</div>`
                    : `<button type="button" onclick="makeCover(${index})" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0, 0, 0, 0.7); color: white; border: none; font-size: 0.65rem; text-align: center; padding: 3px 0; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(37, 99, 235, 0.9)'" onmouseout="this.style.background='rgba(0, 0, 0, 0.7)'">Hacer Portada</button>`
                }
            </div>
        `).join('');
    }

    window.removeImage = (index) => {
        selectedImages.splice(index, 1);
        updateImagePreviews();
    };

    window.makeCover = (index) => {
        if (index > 0 && index < selectedImages.length) {
            const img = selectedImages.splice(index, 1)[0];
            selectedImages.unshift(img);
            updateImagePreviews();
        }
    };

    document.getElementById('submit-video').addEventListener('click', async () => {
        const id = document.getElementById('v-id').value;
        const title = document.getElementById('v-title').value;
        const desc = window.videoDescEditor ? window.videoDescEditor.root.innerHTML : document.getElementById('v-desc-editor').innerHTML;
        const price = document.getElementById('v-price').value;
        const sale_price = document.getElementById('v-sale-price').value;
        const currency = document.getElementById('v-currency').value;
        const published_at = document.getElementById('v-published-at').value;
        const is_hidden = document.getElementById('v-is-hidden').checked;
        
        const videoInput = document.getElementById('v-file');
        const videoFile = videoInput.files[0];
        const videoUrl = document.getElementById('v-url').value.trim();

        if(!title || !price) return alert('Título y precio son requeridos');
        if(!id && !videoFile && !videoUrl) return alert('Debes seleccionar un archivo de video o proporcionar un enlace directo para nuevos videos');

        const submitBtn = document.getElementById('submit-video');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Procesando...';
        submitBtn.disabled = true;

        try {
            let fileKey = null;

            if (videoUrl) {
                fileKey = videoUrl; // El backend lo guardará tal cual
            } else if (videoFile) {
                // 1. Obtener Presigned URL
                const presignRes = await fetch(`/api/admin/get-upload-url?fileName=${encodeURIComponent(videoFile.name)}&fileType=${encodeURIComponent(videoFile.type)}`);
                if (!presignRes.ok) throw new Error('No se pudo obtener la URL de subida. Verifica tus claves AWS.');
                const uploadData = await presignRes.json();
                fileKey = uploadData.fileKey;

                // 2. Subir directo a S3 con Barra de Progreso
                const progressContainer = document.getElementById('upload-progress-container');
                const progressBar = document.getElementById('upload-progress-bar');
                const progressText = document.getElementById('upload-percent');
                
                progressContainer.style.display = 'block';

                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', uploadData.uploadUrl, true);
                    xhr.setRequestHeader('Content-Type', videoFile.type);
                    
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            progressBar.style.width = percent + '%';
                            progressText.textContent = percent + '%';
                        }
                    };
                    
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve();
                        } else {
                            reject(new Error('Falló la subida a S3'));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Error de red al subir a S3'));
                    xhr.send(videoFile);
                });
            }

            // 3. Subir metadatos e imágenes a la DB
            submitBtn.textContent = 'Guardando datos...';
            const imagesBase64 = selectedImages.map(img => img.data);
            const token = localStorage.getItem('token');

            const payload = { 
                title, 
                description: desc, 
                price, 
                sale_price,
                currency,
                published_at,
                is_hidden,
                images: imagesBase64 
            };
            if (fileKey) payload.internal_storage_path = fileKey;

            const url = id ? `/api/admin/videos/${id}` : '/api/admin/videos';
            const method = id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert(`Video ${id ? 'actualizado' : 'agregado'} exitosamente`);
                document.getElementById('add-video-form').style.display = 'none';
                
                // Limpiar form
                document.getElementById('v-id').value = '';
                document.getElementById('v-title').value = '';
                if (window.videoDescEditor) window.videoDescEditor.root.innerHTML = '';
                document.getElementById('v-price').value = '';
                document.getElementById('v-sale-price').value = '';
                document.getElementById('v-published-at').value = '';
                document.getElementById('v-is-hidden').checked = false;
                videoInput.value = '';
                
                const progressContainer = document.getElementById('upload-progress-container');
                if(progressContainer) {
                    progressContainer.style.display = 'none';
                    document.getElementById('upload-progress-bar').style.width = '0%';
                }
                
                selectedImages = [];
                updateImagePreviews();

                loadVideos(); // recargar
            } else {
                if (res.status === 413) {
                    alert('Error: Las imágenes son demasiado pesadas. Como subiste estas imágenes antes de la actualización del compresor, necesitas borrarlas de este video y volverlas a subir para que el sistema las comprima.');
                    return;
                }
                let errorMsg = 'Error al registrar el video en la base de datos (Código ' + res.status + ')';
                try {
                    const errorData = await res.json();
                    if (errorData.details) {
                        errorMsg += '\\nDetalles: ' + errorData.details;
                    } else if (errorData.error) {
                        errorMsg += '\\nError: ' + errorData.error;
                    }
                } catch (e) {
                    errorMsg += '\\nNo se pudo obtener más información del servidor.';
                }
                alert(errorMsg);
            }
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    document.getElementById('btn-add-coupon').addEventListener('click', () => {
        document.getElementById('add-coupon-form').style.display = 'block';
    });

    document.getElementById('submit-coupon').addEventListener('click', async () => {
        const code = document.getElementById('c-code').value;
        const discount = document.getElementById('c-discount').value;
        const video_id = document.getElementById('c-video').value;

        if(!code || !discount) return alert('Código y porcentaje son requeridos');

        const res = await fetch('/api/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, discount_percentage: discount, video_id: video_id || null })
        });

        if (res.ok) {
            alert('Cupón creado exitosamente');
            document.getElementById('add-coupon-form').style.display = 'none';
            document.getElementById('c-code').value = '';
            document.getElementById('c-discount').value = '';
            document.getElementById('c-video').value = '';
            loadCoupons();
        } else {
            const err = await res.json();
            alert(err.error || 'Error al crear cupón');
        }
    });

    // Carrusel form
    document.getElementById('btn-add-carousel').addEventListener('click', () => {
        document.getElementById('add-carousel-form').style.display = 'block';
    });

    let currentCarouselBase64 = null;
    document.getElementById('carousel-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return alert('La imagen excede los 2MB.');

        const reader = new FileReader();
        reader.onload = (ev) => {
            currentCarouselBase64 = ev.target.result;
            document.getElementById('carousel-preview').innerHTML = `<img src="${currentCarouselBase64}" style="max-width:100%; max-height:200px; border-radius: 8px;">`;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('submit-carousel').addEventListener('click', async () => {
        if (!currentCarouselBase64) return alert('Selecciona una imagen primero');
        
        const title = document.getElementById('carousel-title').value;
        const link = document.getElementById('carousel-link').value;

        const btn = document.getElementById('submit-carousel');
        btn.textContent = 'Guardando...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/carousel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    image_data: currentCarouselBase64,
                    title: title,
                    link_url: link
                })
            });

            if (res.ok) {
                alert('Imagen agregada al carrusel');
                document.getElementById('add-carousel-form').style.display = 'none';
                document.getElementById('carousel-file').value = '';
                document.getElementById('carousel-title').value = '';
                document.getElementById('carousel-link').value = '';
                document.getElementById('carousel-preview').innerHTML = '';
                currentCarouselBase64 = null;
                loadCarousel();
            } else {
                alert('Error al agregar imagen');
            }
        } catch (e) {
            alert('Error de red');
        } finally {
            btn.textContent = 'Guardar Imagen';
            btn.disabled = false;
        }
    });

    // --- LEGAL PAGES LOGIC ---
    let quillEditors = {};
    const legalFields = ['terms-en', 'terms-es', 'privacy-en', 'privacy-es', 'refunds-en', 'refunds-es'];
    
    // Initialize Quill
    if (typeof Quill !== 'undefined') {
        const toolbarOptions = [
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'header': 1 }, { 'header': 2 }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            ['clean']
        ];
        
        legalFields.forEach(field => {
            const el = document.getElementById('editor-' + field);
            if (el) {
                quillEditors[field] = new Quill('#editor-' + field, {
                    theme: 'snow',
                    modules: { toolbar: toolbarOptions }
                });
            }
        });

        // Initialize Video Description Editor
        const descEl = document.getElementById('v-desc-editor');
        if (descEl) {
            window.videoDescEditor = new Quill('#v-desc-editor', {
                theme: 'snow',
                modules: { toolbar: toolbarOptions }
            });
        }
    }

    async function loadLegalSettings() {
        const data = await apiGet('/api/settings');
        if (data && typeof Quill !== 'undefined') {
            legalFields.forEach(field => {
                const key = 'page_' + field.replace('-', '_');
                if (data[key] && quillEditors[field]) {
                    quillEditors[field].root.innerHTML = data[key];
                }
            });
        }
    }

    const btnSaveLegal = document.getElementById('btn-save-legal');
    if (btnSaveLegal) {
        btnSaveLegal.addEventListener('click', async () => {
            btnSaveLegal.textContent = 'Guardando...';
            btnSaveLegal.disabled = true;

            const payload = {};
            legalFields.forEach(field => {
                const key = 'page_' + field.replace('-', '_');
                if (quillEditors[field]) {
                    payload[key] = quillEditors[field].root.innerHTML;
                }
            });

            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    alert('Páginas legales actualizadas exitosamente');
                } else {
                    alert('Error al guardar las páginas legales');
                }
            } catch (error) {
                console.error(error);
                alert('Error de red');
            } finally {
                btnSaveLegal.textContent = 'Guardar Cambios';
            }
        });
    }

    async function loadDonations() {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/donations', { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await res.json();
            const tbody = document.getElementById('donations-tbody');
            if (tbody && Array.isArray(data)) {
                tbody.innerHTML = data.map(d => `
                    <tr>
                        <td>${new Date(d.created_at).toLocaleString()}</td>
                        <td><strong>${d.name || 'Anónimo'}</strong></td>
                        <td>${d.email || '-'}</td>
                        <td>${d.message || '-'}</td>
                        <td style="color:#16a34a; font-weight:bold;">$${d.amount}</td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error('Error cargando donaciones:', err);
        }
    }

    // Lógica para mostrar/ocultar contraseñas
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    e.currentTarget.style.color = '#fff';
                } else {
                    input.type = 'password';
                    e.currentTarget.style.color = '#aaa';
                }
            }
        });
    });

    // --- USER CRUD LOGIC ---
    const btnAddUser = document.getElementById('btn-add-user');
    if (btnAddUser) {
        btnAddUser.addEventListener('click', () => {
            document.getElementById('u-id').value = '';
            document.getElementById('u-name').value = '';
            document.getElementById('u-email').value = '';
            document.getElementById('u-password').value = '';
            document.getElementById('u-password').placeholder = 'Contraseña obligatoria';
            document.getElementById('u-role').value = 'Administrador';
            
            document.querySelectorAll('.u-perm').forEach(chk => chk.checked = false);
            
            document.getElementById('user-form-title').textContent = 'Agregar Nuevo Usuario';
            document.getElementById('user-form-panel').style.display = 'block';
        });
    }

    const btnCancelUser = document.getElementById('btn-cancel-user');
    if (btnCancelUser) {
        btnCancelUser.addEventListener('click', () => {
            document.getElementById('user-form-panel').style.display = 'none';
        });
    }

    const btnSaveUser = document.getElementById('btn-save-user');
    if (btnSaveUser) {
        btnSaveUser.addEventListener('click', async () => {
            const id = document.getElementById('u-id').value;
            const name = document.getElementById('u-name').value;
            const email = document.getElementById('u-email').value;
            const password = document.getElementById('u-password').value;
            const role = document.getElementById('u-role').value;
            
            const permissions = Array.from(document.querySelectorAll('.u-perm:checked')).map(chk => chk.value);
            
            const token = localStorage.getItem('token');

            if (!email || (!id && !password)) {
                alert('Faltan campos obligatorios');
                return;
            }

            const payload = { name, email, role, permissions };
            if (password) payload.password = password;

            const url = id ? `/api/admin/users/${id}` : `/api/admin/users`;
            const method = id ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    alert(data.message || 'Usuario guardado correctamente');
                    document.getElementById('user-form-panel').style.display = 'none';
                    loadUsers();
                } else {
                    alert(data.error || 'Error al guardar');
                }
            } catch (err) {
                console.error(err);
                alert('Error de red');
            }
        });
    }

    // --- IMPORT CSV LOGIC ---
    const btnShowImport = document.getElementById('btn-show-import');
    if (btnShowImport) {
        btnShowImport.addEventListener('click', () => {
            const panel = document.getElementById('import-csv-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
    }

    const btnProcessImport = document.getElementById('btn-process-import');
    if (btnProcessImport) {
        btnProcessImport.addEventListener('click', async () => {
            const fileInput = document.getElementById('csv-file-input');
            const file = fileInput.files[0];
            const msgEl = document.getElementById('import-status-msg');
            const pwdOpt = document.getElementById('import-pwd-option').value;
            
            if (!file) {
                msgEl.style.color = 'var(--error)';
                msgEl.textContent = 'Por favor selecciona un archivo.';
                return;
            }

            msgEl.style.color = '#fff';
            msgEl.textContent = 'Procesando archivo...';

            const reader = new FileReader();
            reader.onload = async (e) => {
                let text = e.target.result;
                // Normalizar saltos de línea de Windows/Mac a formato estándar
                text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                
                const rows = text.split('\n').filter(r => r.trim() !== '');
                if (rows.length < 2) {
                    msgEl.style.color = 'var(--error)';
                    msgEl.textContent = 'El archivo parece estar vacío o no tener datos suficientes.';
                    return;
                }

                // Detect delimiter
                const headerLine = rows[0];
                const delimiter = headerLine.includes('\t') ? '\t' : ',';
                const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());

                const emailIdx = headers.indexOf('email') !== -1 ? headers.indexOf('email') : headers.findIndex(h => h.includes('mail'));
                const fnIdx = headers.indexOf('first_name') !== -1 ? headers.indexOf('first_name') : headers.findIndex(h => h.includes('name') && !h.includes('last'));
                const lnIdx = headers.indexOf('last_name');

                if (emailIdx === -1) {
                    msgEl.style.color = 'var(--error)';
                    msgEl.textContent = 'No se encontró la columna de email en el archivo.';
                    return;
                }

                const usersToImport = [];
                for (let i = 1; i < rows.length; i++) {
                    const cols = rows[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
                    const email = cols[emailIdx];
                    if (!email) continue;
                    
                    let name = '';
                    if (fnIdx !== -1 && cols[fnIdx]) name += cols[fnIdx];
                    if (lnIdx !== -1 && cols[lnIdx]) name += ' ' + cols[lnIdx];
                    
                    usersToImport.push({ email, name: name.trim() });
                }

                if (usersToImport.length === 0) {
                    msgEl.style.color = 'var(--error)';
                    msgEl.textContent = 'No se encontraron usuarios válidos.';
                    return;
                }

                msgEl.textContent = `Enviando ${usersToImport.length} usuarios al servidor...`;

                try {
                    const token = localStorage.getItem('token');
                    
                    const chunkSize = 10;
                    let totalImported = 0;
                    let totalDuplicates = 0;
                    let hasError = false;

                    for (let i = 0; i < usersToImport.length; i += chunkSize) {
                        const chunk = usersToImport.slice(i, i + chunkSize);
                        msgEl.textContent = `Enviando lote ${Math.floor(i/chunkSize) + 1} de ${Math.ceil(usersToImport.length/chunkSize)} (procesando ${chunk.length} usuarios)...`;

                        const res = await fetch('/api/admin/import-users', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify({ users: chunk, pwdOption: pwdOpt })
                        });
                        
                        const data = await res.json();
                        if (res.ok) {
                            totalImported += data.imported || 0;
                            totalDuplicates += data.duplicates || 0;
                        } else {
                            hasError = true;
                            msgEl.style.color = 'var(--error)';
                            msgEl.textContent = data.error || 'Error en la importación de un lote.';
                            break;
                        }
                    }
                    
                    if (!hasError) {
                        msgEl.style.color = 'var(--primary)';
                        msgEl.textContent = `¡Éxito! ${totalImported} importados. ${totalDuplicates} omitidos (ya existían).`;
                        loadClients();
                    }
                } catch (err) {
                    console.error(err);
                    msgEl.style.color = 'var(--error)';
                    msgEl.textContent = 'Error de conexión con el servidor (posible tiempo de espera agotado). Intenta subir un archivo más pequeño.';
                }
            };
            reader.readAsText(file);
        });
    }

    // Cargar inicial
    loadStats();
    loadUsers();
});
