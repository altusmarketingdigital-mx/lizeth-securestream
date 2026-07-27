document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
        const isAdmin = localStorage.getItem('isAdmin');
        const isTrueAdmin = isAdmin === '1' || isAdmin === 'true' || isAdmin === true;
        
        // Buscar botones que dirijan a login
        const signInBtns = document.querySelectorAll('a[href="/login.html"]');
        signInBtns.forEach(btn => {
            btn.href = isTrueAdmin ? '/admin.html' : '/dashboard.html';
            btn.textContent = 'PANEL';
        });
    }
});
