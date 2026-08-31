const fs = require('fs');
const path = require('path');

const jpgPath = '/tmp/bnt-official-logo.jpg';
const jpgBuffer = fs.readFileSync(jpgPath);
const hexString = jpgBuffer.toString('hex').toLowerCase();

const logoDataPath = path.join(__dirname, 'apps', 'web', 'src', 'lib', 'logo-data.ts');
const newContent = `export const bntLogoHex = "${hexString}";\n`;

fs.writeFileSync(logoDataPath, newContent, 'utf8');

console.log(`✅ logo-data.ts updated with official logo hex!`);
console.log(`Hex length: ${hexString.length} chars (${jpgBuffer.length} bytes)`);
