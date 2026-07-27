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

    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('v');
    
    if (slug) {
        player.src({
            src: `/api/videos/stream/${slug}`,
            type: 'video/mp4' // The backend redirect or stream will handle this
        });
        
        player.on('error', function() {
            console.warn('Error loading video stream');
        });
    } else {
        alert('No se especificó un video');
    }
});
