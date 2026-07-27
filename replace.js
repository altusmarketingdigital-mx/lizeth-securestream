const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.html') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('frontend');
let count = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    
    content = content.replace(/\bCursos\b/g, 'Videos');
    content = content.replace(/\bcursos\b/g, 'videos');
    content = content.replace(/\bCurso\b/g, 'Video');
    content = content.replace(/\bcurso\b/g, 'video');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
        console.log('Updated:', file);
    }
});
console.log('Total files updated:', count);
