document.addEventListener("DOMContentLoaded", () => {
    const videoElement = document.getElementById('protected-video');
    const watermark = document.getElementById('dynamic-watermark');
    const container = document.getElementById('secure-player-container');

    const email = localStorage.getItem('userEmail') || 'guest@domain.com';
    watermark.textContent = `ID: usr_99 | ${email}`;

    function moveWatermark() {
        const maxX = container.clientWidth - watermark.clientWidth;
        const maxY = container.clientHeight - watermark.clientHeight;

        const randomX = Math.floor(Math.random() * (maxX > 0 ? maxX : 50));
        const randomY = Math.floor(Math.random() * (maxY > 0 ? maxY : 50));

        watermark.style.left = `${randomX}px`;
        watermark.style.top = `${randomY}px`;
    }

    moveWatermark();
    setInterval(moveWatermark, 8000);

    // Prevenir descargas adicionales
    document.addEventListener('contextmenu', event => event.preventDefault());
    
    document.addEventListener('keydown', (event) => {
        if (
            event.key === 'F12' || 
            (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'J')) || 
            (event.ctrlKey && event.key === 'U')
        ) {
            event.preventDefault();
        }
    });

    // Inicializar Video.js
    const player = videojs('protected-video', {
        controls: true,
        autoplay: false,
        preload: 'auto',
        fluid: true,
        playbackRates: [0.5, 1, 1.25, 1.5, 2]
    });

    // En producción, aquí haríamos fetch a /api/videos/stream/slug
    // Si el servidor o S3 devuelve HLS, usamos type: 'application/x-mpegURL'
    // Para el demo usaremos un HLS público o fallback a MP4
    setTimeout(() => {
        // Simulando que recibimos una URL de HLS (m3u8) o MP4 seguro
        // Cambiar src por tu URL real de S3 (.m3u8)
        player.src({
            src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
            type: 'application/x-mpegURL'
        });
        
        // Manejar errores si no soporta HLS en algunos navegadores viejos sin hls.js integrado
        player.on('error', function() {
            console.warn('HLS falló, intentando MP4 fallback...');
            player.src({
                src: 'https://www.w3schools.com/html/mov_bbb.mp4',
                type: 'video/mp4'
            });
        });
    }, 1000);
});
