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
        'tab-legal': 'view-legal'
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
            if (tabId === 'tab-dashboard') { loadStats(); loadUsers(); }
            if (tabId === 'tab-users') loadUsers();
            if (tabId === 'tab-clients') loadUsers();
            if (tabId === 'tab-sales') loadSales();
            if (tabId === 'tab-videos') loadVideos();
            if (tabId === 'tab-coupons') { loadCoupons(); populateCouponVideos(); }
            if (tabId === 'tab-carousel') loadCarousel();
            if (tabId === 'tab-settings') loadSettings();
            if (tabId === 'tab-legal') loadLegalSettings();
        });
    }

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
                        <td>${u.email}</td>
                        <td>Admin</td>
                        <td>${new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                `).join('');
            }

            const clientsTbody = document.getElementById('clients-tbody');
            if (clientsTbody) {
                clientsTbody.innerHTML = clients.map(u => `
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
    }

    let allSalesData = [];

    function renderSales(sales) {
        const tbody = document.getElementById('sales-tbody');
        if (!tbody) return;

        let totalRevenue = 0;
        let totalCount = sales.length;

        tbody.innerHTML = sales.map(s => {
            const price = parseFloat(s.video_price) || 0;
            totalRevenue += price;
            const orderNum = s.order_number || '<em style="color:#666;">N/A</em>';
            const country = s.country || '<em style="color:#666;">N/A</em>';
            return `
            <tr>
                <td>${new Date(s.purchase_date).toLocaleString()}</td>
                <td><code style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">${orderNum}</code></td>
                <td>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:bold;">${s.user_name || '<em style="color:#888;">Sin Nombre</em>'}</span>
                        <span style="font-size:0.85rem; color:#aaa;">${s.user_email}</span>
                    </div>
                </td>
                <td>${country}</td>
                <td>${s.video_title}</td>
                <td style="color:#16a34a; font-weight:bold;">$${price.toFixed(2)}</td>
            </tr>
            `;
        }).join('');

        const countEl = document.getElementById('sales-count');
        const revEl = document.getElementById('sales-revenue');
        if(countEl) countEl.textContent = totalCount;
        if(revEl) revEl.textContent = '$' + totalRevenue.toFixed(2);
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
            select.innerHTML = '<option value="">Válido para cualquier curso (Global)</option>' + 
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
                'hero_card_badge2', 'hero_card_image'
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
        }
    }

    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const fields = [
            'footer_text', 'hero_title', 'hero_subtitle', 'hero_body', 
            'hero_btn_text', 'hero_card_title', 'hero_card_badge1', 
            'hero_card_badge2', 'hero_card_image'
        ];
        
        const payload = {};
        fields.forEach(f => {
            const el = document.getElementById('set-' + f);
            if(el) payload[f] = el.value;
        });

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
            if (file.size > 2 * 1024 * 1024) {
                alert(`La imagen ${file.name} excede los 2MB permitidos.`);
                continue;
            }
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                selectedImages.push({
                    name: file.name,
                    data: ev.target.result // Base64
                });
                updateImagePreviews();
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
            <div style="position: relative; width: 80px; height: 80px; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2);">
                <img src="${img.data}" style="width: 100%; height: 100%; object-fit: cover;">
                <button type="button" onclick="removeImage(${index})" style="position: absolute; top: 2px; right: 2px; background: rgba(220, 38, 38, 0.9); border: none; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
            </div>
        `).join('');
    }

    window.removeImage = (index) => {
        selectedImages.splice(index, 1);
        updateImagePreviews();
    };

    document.getElementById('submit-video').addEventListener('click', async () => {
        const title = document.getElementById('v-title').value;
        const desc = document.getElementById('v-desc').value;
        const price = document.getElementById('v-price').value;
        
        const videoInput = document.getElementById('v-file');
        const videoFile = videoInput.files[0];

        if(!title || !videoFile || !price) return alert('Título, precio y archivo de video son requeridos');

        const submitBtn = document.getElementById('submit-video');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Procesando...';
        submitBtn.disabled = true;

        try {
            // 1. Obtener Presigned URL
            const presignRes = await fetch(`/api/admin/get-upload-url?fileName=${encodeURIComponent(videoFile.name)}&fileType=${encodeURIComponent(videoFile.type)}`);
            if (!presignRes.ok) throw new Error('No se pudo obtener la URL de subida. Verifica tus claves AWS.');
            const { uploadUrl, fileKey } = await presignRes.json();

            // 2. Subir directo a S3 con Barra de Progreso
            const progressContainer = document.getElementById('upload-progress-container');
            const progressBar = document.getElementById('upload-progress-bar');
            const progressText = document.getElementById('upload-percent');
            
            progressContainer.style.display = 'block';

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', uploadUrl, true);
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

            // 3. Subir metadatos e imágenes a la DB
            submitBtn.textContent = 'Guardando datos...';
            const imagesBase64 = selectedImages.map(img => img.data);

            const res = await fetch('/api/admin/videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title, 
                    description: desc, 
                    price, 
                    internal_storage_path: fileKey, 
                    images: imagesBase64 
                })
            });

            if (res.ok) {
                alert('Video agregado exitosamente a la Nube');
                document.getElementById('add-video-form').style.display = 'none';
                
                // Limpiar form
                document.getElementById('v-title').value = '';
                document.getElementById('v-desc').value = '';
                document.getElementById('v-price').value = '';
                videoInput.value = '';
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
                
                selectedImages = [];
                updateImagePreviews();

                loadVideos(); // recargar
            } else {
                alert('Error al registrar el video en la base de datos');
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
                btnSaveLegal.disabled = false;
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
