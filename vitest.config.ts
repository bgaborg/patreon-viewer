import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'viewer',
                    include: ['patreon-viewer/**/*.test.ts'],
                },
            },
            {
                test: {
                    name: 'encoder',
                    include: ['*.test.ts'],
                },
            },
        ],
    },
});
