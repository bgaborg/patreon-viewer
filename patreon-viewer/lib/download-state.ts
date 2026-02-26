import type { Response } from 'express';

const MAX_LOG_ENTRIES = 500;

export interface LogEntry {
    type: string;
    message: string;
    timestamp: string;
}

export interface TargetsState {
    total: number;
    completed: number;
    skipped: number;
}

export interface EncodingState {
    total: number;
    completed: number;
    current: string | null;
}

export interface DownloadState {
    status: string;
    url: string | null;
    error: string | null;
    abortController: AbortController | null;
    log: LogEntry[];
    progress: Record<string, unknown> | null;
    targets: TargetsState;
    encoding: EncodingState;
    sseClients: Set<Response>;
}

export interface StateSnapshot {
    status: string;
    url: string | null;
    error: string | null;
    log: LogEntry[];
    progress: Record<string, unknown> | null;
    targets: TargetsState;
    encoding: EncodingState;
}

function createInitialState(): DownloadState {
    return {
        status: 'idle',
        url: null,
        error: null,
        abortController: null,
        log: [],
        progress: null,
        targets: { total: 0, completed: 0, skipped: 0 },
        encoding: { total: 0, completed: 0, current: null },
        sseClients: new Set(),
    };
}

export const state: DownloadState = createInitialState();

export function broadcast(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of state.sseClients) {
        client.write(message);
    }
}

export function addLog(type: string, message: string): void {
    const entry: LogEntry = { type, message, timestamp: new Date().toISOString() };
    state.log.push(entry);
    if (state.log.length > MAX_LOG_ENTRIES) {
        state.log.shift();
    }
    broadcast('log', entry);
}

export function reset(): void {
    state.status = 'idle';
    state.url = null;
    state.error = null;
    state.abortController = null;
    state.log = [];
    state.progress = null;
    state.targets = { total: 0, completed: 0, skipped: 0 };
    state.encoding = { total: 0, completed: 0, current: null };
}

export function getSnapshot(): StateSnapshot {
    return {
        status: state.status,
        url: state.url,
        error: state.error,
        log: state.log,
        progress: state.progress,
        targets: { ...state.targets },
        encoding: { ...state.encoding },
    };
}
