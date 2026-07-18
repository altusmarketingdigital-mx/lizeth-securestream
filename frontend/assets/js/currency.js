// currency.js - Sistema Multimoneda Base (Sin selector global)

let exchangeRates = { MXN: 1, USD: 0.05, EUR: 0.045 }; // Fallback inicial

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
}

// Convierte a MXN para usos internos (como la suma del carrito)
window.convertToMXN = (price, baseCurrency = 'MXN') => {
    const baseRate = exchangeRates[baseCurrency] || 1;
    return parseFloat(price) / baseRate;
};

// Formatea el precio en su moneda original
window.formatPrice = (price, baseCurrency = 'MXN') => {
    const symbol = currencySymbols[baseCurrency] || '$';
    return `${symbol}${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${baseCurrency}`;
};

// No-op para evitar errores en otras vistas que dependan de este listener
window.onCurrencyChange = (fn) => {};

// Auto-inicializar
document.addEventListener('DOMContentLoaded', initCurrency);
