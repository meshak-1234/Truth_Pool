const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const jsAuth = fs.readFileSync('js/auth.js', 'utf8');
const jsApp = fs.readFileSync('js/app.js', 'utf8');
const jsXp = fs.readFileSync('js/xp.js', 'utf8');

function checkFile(name, content) {
  const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
  let match;
  const missing = [];
  while ((match = regex.exec(content)) !== null) {
    const id = match[1];
    if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
      missing.push(id);
    }
  }
  console.log(name, 'missing IDs:', missing);
}

checkFile('auth.js', jsAuth);
checkFile('app.js', jsApp);
checkFile('xp.js', jsXp);
