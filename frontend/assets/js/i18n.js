const dictEN_to_ES = {
    // Navbar & Footer
    "HOME": "INICIO",
    "SHOP": "TIENDA",
    "SIGN IN": "INICIAR SESIÓN",
    "Home": "Inicio",
    "Shop": "Tienda",
    "Sign In": "Iniciar Sesión",
    "Terms and Conditions": "Términos y Condiciones",
    "Privacy Policy": "Política de Privacidad",
    "Refund Policy": "Política de Reembolsos",
    "Explore": "Explorar",
    "Legal": "Legal",
    "All rights reserved.": "Todos los derechos reservados.",
    
    // Index Hero
    "Make your experience bigger": "Haz más grande tu experiencia",
    "Unlock Premium Knowledge": "Desbloquea conocimiento premium",
    "Master the art of barbering with exclusive, highly secured video content straight from Lizeth.": "Domina el arte de la barbería con contenido en video exclusivo y de alta seguridad directamente de Lizeth.",
    "Explore Catalog": "Explorar Catálogo",
    "New Releases": "Nuevos Lanzamientos",
    
    // Forms
    "Welcome back": "Bienvenido de vuelta",
    "Sign in to your account": "Inicia sesión en tu cuenta",
    "Email Address": "Correo Electrónico",
    "Password": "Contraseña",
    "Remember me": "Recordarme",
    "Forgot password?": "¿Olvidaste tu contraseña?",
    "Don't have an account?": "¿No tienes cuenta?",
    "Sign up": "Regístrate",
    "Create an account": "Crear una cuenta",
    "Join to access premium content": "Únete para acceder a contenido premium",
    "Full Name": "Nombre completo",
    "Confirm Password": "Confirmar Contraseña",
    "Create Account": "Crear Cuenta",
    "Already have an account?": "¿Ya tienes cuenta?",
    "Recover Password": "Recuperar Contraseña",
    "Enter your email and we'll send instructions": "Ingresa tu correo y te enviaremos instrucciones",
    "Send Link": "Enviar Enlace",
    "Back to Login": "Volver al Login",

    // Catalog & Cart
    "Video Catalog": "Catálogo de Videos",
    "Select the videos you want to acquire.": "Selecciona los videos que deseas adquirir.",
    "Filter by:": "Filtrar por:",
    "All": "Todos",
    "Add to Cart": "Añadir al Carrito",
    "Your Cart": "Tu Carrito",
    "Order Summary": "Resumen del Pedido",
    "Subtotal": "Subtotal",
    "Taxes": "Impuestos",
    "Total": "Total",
    "Proceed to Checkout": "Proceder al Pago",
    "Your cart is empty": "Tu carrito está vacío",
    "Continue Shopping": "Continuar Comprando",
    "Empty Cart": "Vaciar Carrito",
    "Discount Code": "Código de descuento",
    "Apply": "Aplicar",
    "Pay with Card": "Pagar con Tarjeta",

    // Dashboard
    "Dashboard": "Panel de Control",
    "My Courses": "Mis Videos",
    "My Account": "Mi Cuenta",
    "Log Out": "Cerrar Sesión",
    "Purchase History": "Historial de Compras",
    "Settings": "Configuración",
    "Save Changes": "Guardar Cambios",
    
    // Contact
    "Contact Us": "Contáctanos",
    "Message": "Mensaje",
    "Send Message": "Enviar Mensaje",
    
    // Admin
    "Admin Dashboard": "Panel de Administración",
    "User Management": "Gestión de Usuarios",
    "Content Management": "Gestión de Contenido",
    "Upload Video": "Subir Video",
    "Sales": "Ventas",
    "Reports": "Reportes",

    // Extras / Nuevos
    "LOG IN": "INICIAR SESIÓN",
    "REGISTER": "REGISTRO",
    "Welcome back to the shop, sweetie!": "¡Bienvenido de nuevo a la tienda, cariño!",
    "Username / Email": "Usuario / Correo",
    "ENTER SHOP": "ENTRAR A LA TIENDA",
    "Join the elite club of shiny bald heads.": "Únete al club de élite de los mejores.",
    "Name": "Nombre",
    "E-mail address": "Correo electrónico",
    "CREATE ACCOUNT": "CREAR CUENTA",

    // Donations
    "💖  Support the Production": "💖  Apoya la Producción",
    "Every donation helps me create better content and buy better equipment. Thank you for your support!": "Cada donativo me permite crear mejor contenido y comprar mejores equipos. ¡Gracias por tu apoyo!",
    "Your Name (Optional)": "Tu Nombre (Opcional)",
    "Your Email (Optional)": "Tu Email (Opcional)",
    "Leave me a special message...": "Déjame un mensaje especial...",
    "Other amount": "Otro monto",
    "Donate with Card": "Donar con Tarjeta"
};

function initLanguage() {
    let lang = localStorage.getItem('lang') || 'en';
    applyLanguage(lang);
}

function toggleLanguage() {
    let currentLang = localStorage.getItem('lang') || 'en';
    let newLang = currentLang === 'en' ? 'es' : 'en';
    localStorage.setItem('lang', newLang);
    
    if (newLang === 'en') {
        location.reload(); // Reload to restore English HTML base
    } else {
        applyLanguage(newLang);
    }
}

function applyLanguage(lang) {
    const toggleBtns = document.querySelectorAll('#lang-toggle');
    toggleBtns.forEach(btn => {
        // Mostrar el idioma en el que YA ESTÁ la página, de esa forma no se confunde
        btn.innerHTML = lang === 'en' ? '🇺🇸 EN' : '🇪🇸 ES';
    });

    if (lang === 'en') return;

    // Apply Spanish translation
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const nodesToReplace = [];
    
    while (node = walker.nextNode()) {
        const text = node.nodeValue.trim();
        if (text && dictEN_to_ES[text]) {
            nodesToReplace.push({ node, text });
        } else if (text) {
            // Check for partial matches or inner strings if exact match fails
            for (const [en, es] of Object.entries(dictEN_to_ES)) {
                if (text.includes(en)) {
                    nodesToReplace.push({ node, en, es });
                }
            }
        }
    }

    nodesToReplace.forEach(item => {
        if (item.text) {
            item.node.nodeValue = item.node.nodeValue.replace(item.text, dictEN_to_ES[item.text]);
        } else if (item.en && item.es) {
            item.node.nodeValue = item.node.nodeValue.replace(item.en, item.es);
        }
    });

    // Also replace placeholder attributes
    const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
    inputs.forEach(input => {
        const ph = input.getAttribute('placeholder');
        if (dictEN_to_ES[ph]) {
            input.setAttribute('placeholder', dictEN_to_ES[ph]);
        }
    });
}

document.addEventListener('DOMContentLoaded', initLanguage);
