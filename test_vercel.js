const https = require('https');

const data = JSON.stringify({
    users: [
        { email: 'test1@test.com', name: 'Test User' },
        { email: 'test2@test.com', name: 'Test User 2' }
    ],
    pwdOption: 'generic'
});

// Assuming the live vercel url is https://lizeth-securestream.vercel.app or similar
// Let's first ping the stats endpoint to get a baseline
const options = {
    hostname: 'lizeth-securestream.vercel.app', // Update if it's different
    port: 443,
    path: '/api/admin/import-users',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
        // No auth token, so it SHOULD return 401
    }
};

const req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    res.on('data', d => {
        process.stdout.write(d);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
