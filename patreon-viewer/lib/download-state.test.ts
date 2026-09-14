import { afterEach, describe, expect, it } from 'vitest';
import { finishJob, reset, state } from './download-state.js';

afterEach(() => {
    reset();
    state.sseClients.clear();
});

describe('finishJob', () => {
    it('clears the abort controller', () => {
        state.abortController = new AbortController();
        finishJob('complete');
        expect(state.status).toBe('complete');
        expect(state.abortController).toBeNull();
    });
});
