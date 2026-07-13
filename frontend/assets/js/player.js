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

    // Prevención Forense
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

    // Simular carga de blob (En producción aquí iría el fetch auth)
    setTimeout(() => {
        // En un caso real haríamos fetch a /api/videos/stream/slug y crearíamos un URL.createObjectURL(blob)
        // Para que se vea en el demo usaremos un video de ejemplo
        videoElement.src = "https://www.w3schools.com/html/mov_bbb.mp4";
    }, 1000);
});
