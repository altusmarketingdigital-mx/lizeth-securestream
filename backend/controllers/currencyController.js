let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 horas en milisegundos

exports.getRates = async (req, res) => {
    const now = Date.now();

    // Devolver caché si es válido
    if (cachedRates && (now - lastFetchTime) < CACHE_DURATION) {
        return res.json(cachedRates);
    }

    try {
        const response = await fetch('https://open.er-api.com/v6/latest/MXN');
        if (!response.ok) throw new Error('API Error');
        
        const data = await response.json();
        
        // Filtramos solo las monedas que nos importan para reducir payload
        cachedRates = {
            MXN: 1,
            USD: data.rates.USD || 0.05, // fallback de seguridad aproximado
            EUR: data.rates.EUR || 0.045
        };
        lastFetchTime = now;

        res.json(cachedRates);
    } catch (error) {
        console.error('Error al obtener tipo de cambio:', error);
        // Fallback seguro si la API externa falla
        if (cachedRates) {
            res.json(cachedRates);
        } else {
            res.json({ MXN: 1, USD: 0.05, EUR: 0.045 }); 
        }
    }
};
