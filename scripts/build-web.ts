import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/web', { recursive: true });
await copyFile('web/index.html', 'dist/index.html');
await copyFile('web/style.css', 'dist/web/style.css');
console.log('Browser game built in dist/');
