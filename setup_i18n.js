const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
const files = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(frontendDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // 1. Change lang="es" to lang="en"
    content = content.replace(/<html lang="es">/g, '<html lang="en">');

    // 2. Add language toggle to header
    if (!content.includes('id="lang-toggle"')) {
        content = content.replace(
            /(<div class="header-nav">[\s\S]*?)(<\/div>\s*<\/header>)/,
            `$1    <button id="lang-toggle" onclick="toggleLanguage()" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; padding:5px 15px; border-radius:15px; cursor:pointer; margin-left: 10px; font-weight: bold; transition: background 0.3s;">ES</button>\n        $2`
        );
    }

    // 3. Inject script at the end of body
    if (!content.includes('i18n.js')) {
        content = content.replace(
            /<\/body>/,
            `    <script src="/assets/js/i18n.js"></script>\n</body>`
        );
    }

    fs.writeFileSync(filePath, content, 'utf-8');
});
console.log('Updated HTML headers and scripts');
