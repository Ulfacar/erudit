import sharp from 'sharp';
const src = 'public/landing/logo.jpg';
// Tighter square around just the circular emblem (exclude the "B" of the wordmark).
const left = 110, top = 140, size = 285;
await sharp(src).extract({ left, top, width: size, height: size }).resize(256,256).png().toFile('public/landing/favicon-256.png');
await sharp('public/landing/favicon-256.png').resize(32,32).png().toFile('public/landing/favicon-32.png');
await sharp('public/landing/favicon-256.png').resize(180,180).png().toFile('public/landing/apple-touch-icon.png');
console.log('done');
