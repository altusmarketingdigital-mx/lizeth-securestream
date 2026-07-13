const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const db = new sqlite3.Database(path.resolve(__dirname, 'db/database.sqlite'));

const videos = [
    { title: "Fade Masterclass: Nivel Experto", description: "Aprende las técnicas más exclusivas para lograr un fade perfecto.", price: 49.99, slug: "fade-masterclass" },
    { title: "Diseños y Grecas", description: "Domina el arte de hacer diseños increíbles paso a paso.", price: 29.99, slug: "disenos-grecas" },
    { title: "Perfilado de Barba VIP", description: "El secreto para un perfilado de barba que dejará a tus clientes sin palabras.", price: 34.99, slug: "perfilado-vip" },
    { title: "Tijeras y Textura", description: "Técnicas avanzadas con tijera para dar volumen y textura.", price: 39.99, slug: "tijeras-textura" },
    { title: "Afeitado Tradicional", description: "Ritual completo de afeitado con toalla caliente y navaja.", price: 24.99, slug: "afeitado-tradicional" },
    { title: "Colorimetría para Barberos", description: "Introducción a los tintes y decoloraciones.", price: 54.99, slug: "colorimetria" },
    { title: "Gestión de Barbería", description: "Cómo administrar y hacer crecer tu negocio.", price: 19.99, slug: "gestion-negocio" },
    { title: "Corte Clásico Pompadour", description: "El clásico que nunca muere, explicado a la perfección.", price: 29.99, slug: "corte-pompadour" }
];

db.serialize(() => {
    videos.forEach(v => {
        db.get('SELECT id FROM videos WHERE secure_slug = ?', [v.slug], (err, row) => {
            if (!row) {
                db.run('INSERT INTO videos (id, title, description, price, secure_slug, internal_storage_path) VALUES (?, ?, ?, ?, ?, ?)', 
                [uuidv4(), v.title, v.description, v.price, v.slug, 'fake/path/' + v.slug + '.mp4']);
            }
        });
    });
});

setTimeout(() => {
    console.log('Videos insertados');
    db.close();
}, 2000);
