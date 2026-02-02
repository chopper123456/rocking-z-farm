const fs = require('fs');
const path = 'src/components/Modules/EquipmentModule.jsx';
let s = fs.readFileSync(path, 'utf8');
const bad = /\{\s*alerts\.length > 0 && \(\s*John Deere[\s\S]*?<\/p>\s*<\/div>\s*\n\s*\n\s*\{\s*alerts\.length > 0 && \(\s*\n/;
s = s.replace(bad, '{alerts.length > 0 && (\n');
fs.writeFileSync(path, s);
console.log('Done');
