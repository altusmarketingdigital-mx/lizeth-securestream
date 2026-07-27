const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
const files = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));

const dict = {
    // Navbar & Footer
    "HOME": "HOME",
    "SHOP": "SHOP",
    "SIGN IN": "SIGN IN",
    "Inicio": "Home",
    "Tienda": "Shop",
    "Iniciar Sesión": "Sign In",
    "Términos y Condiciones": "Terms and Conditions",
    "Política de Privacidad": "Privacy Policy",
    "Política de Reembolsos": "Refund Policy",
    "Explorar": "Explore",
    "Legal": "Legal",
    "Todos los derechos reservados.": "All rights reserved.",
    
    // Index Hero
    "Haz mǭs grande tu experiencia": "Make your experience bigger",
    "Haz más grande tu experiencia": "Make your experience bigger",
    "Desbloquea conocimiento premium": "Unlock Premium Knowledge",
    "Domina el arte de la barbería con contenido en video exclusivo y de alta seguridad directamente de Lizeth.": "Master the art of barbering with exclusive, highly secured video content straight from Lizeth.",
    "Explorar Catálogo": "Explore Catalog",
    "Nuevos Lanzamientos": "New Releases",
    
    // Forms (Login/Register/Forgot)
    "Bienvenido de vuelta": "Welcome back",
    "Inicia sesión en tu cuenta": "Sign in to your account",
    "Correo Electrónico": "Email Address",
    "Contraseña": "Password",
    "Recordarme": "Remember me",
    "¿Olvidaste tu contraseña?": "Forgot password?",
    "Entrar": "Sign In",
    "¿No tienes cuenta?": "Don't have an account?",
    "Regístrate": "Sign up",
    "Crear una cuenta": "Create an account",
    "Únete para acceder a contenido premium": "Join to access premium content",
    "Nombre completo": "Full Name",
    "Confirmar Contraseña": "Confirm Password",
    "Crear Cuenta": "Create Account",
    "¿Ya tienes cuenta?": "Already have an account?",
    "Recuperar Contraseña": "Recover Password",
    "Ingresa tu correo y te enviaremos instrucciones": "Enter your email and we'll send instructions",
    "Enviar Enlace": "Send Link",
    "Volver al Login": "Back to Login",

    // Catalog & Cart
    "Catálogo de Cursos": "Course Catalog",
    "Filtrar por:": "Filter by:",
    "Todos": "All",
    "Añadir al Carrito": "Add to Cart",
    "Tu Carrito": "Your Cart",
    "Resumen del Pedido": "Order Summary",
    "Subtotal": "Subtotal",
    "Impuestos": "Taxes",
    "Total": "Total",
    "Proceder al Pago": "Proceed to Checkout",
    "Tu carrito está vacío": "Your cart is empty",
    "Continuar Comprando": "Continue Shopping",

    // Dashboard
    "Panel de Control": "Dashboard",
    "Mis Cursos": "My Courses",
    "Mi Cuenta": "My Account",
    "Cerrar Sesión": "Log Out",
    "Historial de Compras": "Purchase History",
    "Configuración": "Settings",
    "Guardar Cambios": "Save Changes",
    
    // Contact
    "Contáctanos": "Contact Us",
    "Mensaje": "Message",
    "Enviar Mensaje": "Send Message",
    
    // Admin
    "Panel de Administración": "Admin Dashboard",
    "Gestión de Usuarios": "User Management",
    "Gestión de Contenido": "Content Management",
    "Subir Video": "Upload Video",
    "Ventas": "Sales",
    "Reportes": "Reports"
};

files.forEach(file => {
    const filePath = path.join(frontendDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    for (const [es, en] of Object.entries(dict)) {
        // We use global replace. Careful with HTML tags, but dict keys are mostly plain text.
        // Escape special chars in keys
        const safeEs = es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(safeEs, 'g');
        content = content.replace(regex, en);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
});

console.log('Translated basic strings to English');
