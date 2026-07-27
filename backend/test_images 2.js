const https = require('https');

const covers = [
    'photo-1585747860715-2ba37e788b70',
    'photo-1503951914875-452162b0f3f1',
    'photo-1622286342621-4bd786c2447c',
    'photo-1534723452862-4c874018d66d',
    'photo-1599351431202-1e0f0137899a',
    'photo-1605497788044-5a32c7078486',
    'photo-1519699047748-1e130238e932',
    'photo-1593720213428-28a5b9e94613'
];

covers.forEach(id => {
    const url = `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`;
    https.get(url, (res) => {
        console.log(`${id}: ${res.statusCode}`);
    }).on('error', (e) => {
        console.error(`${id}: ${e.message}`);
    });
});
