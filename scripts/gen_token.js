const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign(
    { id: '86a0c202-ee26-4ba3-8eef-70379da81a01', email: 'jahargreaves@lineone.net', name: 'John Hargteaves' },
    process.env.JWT_SECRET || 'Liz_Pablo_SuperSecretKey_2026',
    { expiresIn: '1h' }
);
console.log("Token:", token);
