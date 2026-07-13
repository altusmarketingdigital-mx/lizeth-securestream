// currency.js - Sistema Multimoneda Global

let exchangeRates = { MXN: 1, USD: 0.05, EUR: 0.045 }; // Fallback inicial
let currentCurrency = localStorage.getItem('selectedCurrency') || 'MXN';
let currencyListeners = [];

const currencySymbols = {
    MXN: '$',
    USD: '$',
    EUR: '€'
};

async function initCurrency() {
    try {
        const res = await fetch('/api/currency/rates');
        if (res.ok) {
            exchangeRates = await res.json();
        }
    } catch (error) {
        console.error('Error cargando tipos de cambio:', error);
    }
    
    // Inyectar el selector en el DOM si no existe
    setupCurrencySelector();
    updateAllPrices();
}

function setupCurrencySelector() {
    const navs = document.querySelectorAll('.header-nav');
    navs.forEach(nav => {
        // Evitar duplicados
        if (nav.querySelector('.currency-selector-container')) return;

        const container = document.createElement('div');
        container.className = 'currency-selector-container';
        container.style.marginLeft = '1rem';
        
        container.innerHTML = `
            <select class="currency-dropdown" style="
                background: rgba(255,255,255,0.1); 
                color: white; 
                border: 1px solid rgba(255,255,255,0.2); 
                border-radius: 20px; 
                padding: 5px 10px; 
                font-family: 'Century Gothic', sans-serif;
                cursor: pointer;
                outline: none;
            ">
                <option value="MXN" style="color: black;">🇲🇽 MXN</option>
                <option value="USD" style="color: black;">🇺🇸 USD</option>
                <option value="EUR" style="color: black;">🇪🇺 EUR</option>
            </select>
        `;

        const select = container.querySelector('select');
        select.value = currentCurrency;
        
        select.addEventListener('change', (e) => {
            setCurrency(e.target.value);
            // Sincronizar otros selectores si hay varios (mobile/desktop)
            document.querySelectorAll('.currency-dropdown').forEach(s => s.value = e.target.value);
        });

        nav.appendChild(container);
    });
}

function setCurrency(currencyCode) {
    if (exchangeRates[currencyCode]) {
        currentCurrency = currencyCode;
        localStorage.setItem('selectedCurrency', currencyCode);
        updateAllPrices();
        
        // Notificar a otras funciones que dependen de esto
        currencyListeners.forEach(fn => fn(currencyCode));
    }
}

// Para uso en templates JS literales
window.formatPrice = (priceInMXN) => {
    const rate = exchangeRates[currentCurrency] || 1;
    const converted = parseFloat(priceInMXN) * rate;
    const symbol = currencySymbols[currentCurrency] || '$';
    
    return `${symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currentCurrency}`;
};

// Actualiza elementos del DOM que ya estén renderizados (como el total del carrito)
function updateAllPrices() {
    // Si necesitas actualizar el DOM manualmente, se puede hacer aquí o usando Listeners.
    // Como las vistas catalog y product se renderizan dinámicamente con JS, podemos
    // notificar a esos scripts para que hagan un re-render.
    currencyListeners.forEach(fn => fn(currentCurrency));
}

window.onCurrencyChange = (fn) => {
    currencyListeners.push(fn);
};

// Auto-inicializar
document.addEventListener('DOMContentLoaded', initCurrency);
