import path from 'node:path';
import { createApp } from './lib/app.js';

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, '../data');

const app = createApp(DATA_DIR);

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
