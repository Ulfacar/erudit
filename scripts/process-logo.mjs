import sharp from 'sharp';
const src = 'public/landing/logo.jpg';
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const T = 236; let cleared = 0;
for (let i = 0; i < data.length; i += 4) {
  if (data[i] > T && data[i+1] > T && data[i+2] > T) { data[i+3] = 0; cleared++; }
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile('public/landing/logo.png');
console.log('logo.png written, transparent px:', cleared, 'of', info.width*info.height, '(', info.width+'x'+info.height, ')');
// crop icon to its own file first, then derive sizes
await sharp('public/landing/logo.png').extract({ left: 110, top: 140, width: 285, height: 285 }).png().toFile('public/landing/_icon.png');
await sharp('public/landing/_icon.png').resize(256,256).png().toFile('public/landing/favicon-256.png');
await sharp('public/landing/_icon.png').resize(32,32).png().toFile('public/landing/favicon-32.png');
await sharp('public/landing/_icon.png').resize(180,180).png().toFile('public/landing/apple-touch-icon.png');
console.log('favicons written');
