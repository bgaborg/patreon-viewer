const path = require('node:path');
const { createApp } = require('./lib/app');

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, '../data');

const app = createApp(DATA_DIR);

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
