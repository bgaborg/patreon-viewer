interface LogEntry {
    type: string;
    message: string;
    timestamp: string;
}

interface TargetsState {
    total: number;
    completed: number;
    skipped: number;
}

interface EncodingState {
    total: number;
    completed: number;
    current: string | null;
}

interface StateSnapshot {
    status: string;
    url: string | null;
    error: string | null;
    log: LogEntry[];
    targets: TargetsState;
    encoding: EncodingState;
}

interface EmbedDownloader {
    provider: string;
    exec: string;
}

interface Settings {
    cookie: string;
    embedDownloaders: EmbedDownloader[];
    include: Record<string, string>;
}

const els = {
    form: document.getElementById('downloadForm') as HTMLFormElement,
    urlInput: document.getElementById('urlInput') as HTMLInputElement,
    downloadBtn: document.getElementById('downloadBtn') as HTMLButtonElement,
    settingsToggle: document.getElementById('settingsToggle') as HTMLButtonElement,
    settingsPanel: document.getElementById('settingsPanel') as HTMLElement,
    cookieInput: document.getElementById('cookieInput') as HTMLInputElement,
    cookieRevealBtn: document.getElementById('cookieRevealBtn') as HTMLButtonElement,
    filterAttachmentOnly: document.getElementById('filterAttachmentOnly') as HTMLInputElement,
    mediaTypeFilters: document.getElementById('mediaTypeFilters') as HTMLElement,
    filterLockedContent: document.getElementById('filterLockedContent') as HTMLInputElement,
    filterPreviewMedia: document.getElementById('filterPreviewMedia') as HTMLInputElement,
    filterComments: document.getElementById('filterComments') as HTMLInputElement,
    embedDownloadersDisplay: document.getElementById('embedDownloadersDisplay') as HTMLElement,
    saveSettingsBtn: document.getElementById('saveSettingsBtn') as HTMLButtonElement,
    settingsSaveStatus: document.getElementById('settingsSaveStatus') as HTMLElement,
    statusCard: document.getElementById('statusCard') as HTMLElement,
    statusBadge: document.getElementById('statusBadge') as HTMLElement,
    statusUrl: document.getElementById('statusUrl') as HTMLElement,
    abortBtn: document.getElementById('abortBtn') as HTMLButtonElement,
    encodingProgressSection: document.getElementById('encodingProgressSection') as HTMLElement,
    encodingCurrent: document.getElementById('encodingCurrent') as HTMLElement,
    encodingCount: document.getElementById('encodingCount') as HTMLElement,
    encodingProgressBar: document.getElementById('encodingProgressBar') as HTMLElement,
    targetTotal: document.getElementById('targetTotal') as HTMLElement,
    targetCompleted: document.getElementById('targetCompleted') as HTMLElement,
    targetSkipped: document.getElementById('targetSkipped') as HTMLElement,
    activityLog: document.getElementById('activityLog') as HTMLElement,
    logPlaceholder: document.getElementById('logPlaceholder') as HTMLElement | null,
    logCount: document.getElementById('logCount') as HTMLElement,
};

let logEntryCount = 0;

// --- SSE ---
const evtSource = new EventSource('/download/progress');

evtSource.addEventListener('state', (e) => {
    const snapshot: StateSnapshot = JSON.parse(e.data);
    restoreState(snapshot);
});

evtSource.addEventListener('status', (e) => {
    const data = JSON.parse(e.data);
    updateStatus(data.status, data.url);
});

evtSource.addEventListener('log', (e) => {
    const entry: LogEntry = JSON.parse(e.data);
    appendLogEntry(entry);
});

evtSource.addEventListener('targets', (e) => {
    const targets: TargetsState = JSON.parse(e.data);
    updateTargets(targets);
});

evtSource.addEventListener('encoding', (e) => {
    const encoding: EncodingState = JSON.parse(e.data);
    updateEncoding(encoding);
});

// --- State Restore ---
function restoreState(snapshot: StateSnapshot): void {
    if (snapshot.status !== 'idle') {
        updateStatus(snapshot.status, snapshot.url);
    }
    if (snapshot.log?.length) {
        clearLog();
        for (const entry of snapshot.log) {
            appendLogEntry(entry);
        }
    }
    if (snapshot.targets) {
        updateTargets(snapshot.targets);
    }
    if (snapshot.encoding) {
        updateEncoding(snapshot.encoding);
    }
}

// --- Status ---
function updateStatus(status: string, url: string | null): void {
    els.statusCard.classList.remove('d-none');

    const badge = els.statusBadge;
    badge.textContent = statusLabel(status);
    badge.className = `badge fs-6 ${statusBadgeClass(status)}`;

    els.statusUrl.textContent = url || '';

    const isActive = ['downloading', 'encoding', 'aborting'].includes(status);
    els.abortBtn.classList.toggle('d-none', !isActive || status === 'aborting');
    els.downloadBtn.disabled = isActive;

    if (status === 'encoding') {
        els.encodingProgressSection.classList.remove('d-none');
    }
    if (['complete', 'error', 'aborted', 'idle'].includes(status)) {
        els.downloadBtn.disabled = false;
        els.encodingProgressBar.classList.remove('progress-bar-animated');
    }
}

const STATUS_LABELS: Record<string, string> = {
    idle: 'Idle',
    downloading: 'Downloading',
    encoding: 'Encoding',
    aborting: 'Aborting...',
    aborted: 'Aborted',
    complete: 'Complete',
    error: 'Error',
};

const STATUS_CLASSES: Record<string, string> = {
    idle: 'bg-secondary',
    downloading: 'bg-primary',
    encoding: 'bg-warning text-dark',
    aborting: 'bg-warning text-dark',
    aborted: 'bg-secondary',
    complete: 'bg-success',
    error: 'bg-danger',
};

function statusLabel(s: string): string {
    return STATUS_LABELS[s] || s;
}

function statusBadgeClass(s: string): string {
    return STATUS_CLASSES[s] || 'bg-secondary';
}

// --- Targets ---
function updateTargets(targets: TargetsState): void {
    els.targetTotal.textContent = String(targets.total || 0);
    els.targetCompleted.textContent = String(targets.completed || 0);
    els.targetSkipped.textContent = String(targets.skipped || 0);
}

// --- Encoding ---
function updateEncoding(encoding: EncodingState): void {
    els.encodingProgressSection.classList.remove('d-none');
    els.encodingCurrent.textContent = encoding.current || '';
    els.encodingCount.textContent = `${encoding.completed || 0}/${encoding.total || 0}`;

    if (encoding.total > 0) {
        const pct = Math.round(((encoding.completed || 0) / encoding.total) * 100);
        els.encodingProgressBar.style.width = `${pct}%`;
    }
}

// --- Log ---
function clearLog(): void {
    els.activityLog.innerHTML = '';
    logEntryCount = 0;
    els.logCount.textContent = '0';
}

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function appendLogEntry(entry: LogEntry): void {
    els.logPlaceholder?.remove();

    const div = document.createElement('div');
    div.className = `download-log-entry log-${entry.type || 'info'}`;

    const time = new Date(entry.timestamp).toLocaleTimeString();
    div.innerHTML = `<span class="log-time">${time}</span> <span class="log-msg">${escapeHtml(entry.message)}</span>`;

    els.activityLog.appendChild(div);
    els.activityLog.scrollTop = els.activityLog.scrollHeight;
    logEntryCount++;
    els.logCount.textContent = String(logEntryCount);
}

// --- Form Submit ---
els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = els.urlInput.value.trim();
    if (!url) return;

    els.downloadBtn.disabled = true;

    try {
        const res = await fetch('/download/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to start download');
            els.downloadBtn.disabled = false;
        }
    } catch (err) {
        alert(`Network error: ${(err as Error).message}`);
        els.downloadBtn.disabled = false;
    }
});

// --- Abort ---
els.abortBtn.addEventListener('click', async () => {
    try {
        await fetch('/download/abort', { method: 'POST' });
    } catch (err) {
        alert(`Failed to abort: ${(err as Error).message}`);
    }
});

// --- Settings Toggle ---
els.settingsToggle.addEventListener('click', () => {
    const isHidden = els.settingsPanel.classList.contains('d-none');
    els.settingsPanel.classList.toggle('d-none');
    if (isHidden) {
        loadSettings();
    }
});

// --- Attachment-only toggle ---
els.filterAttachmentOnly.addEventListener('change', () => {
    els.mediaTypeFilters.classList.toggle('d-none', els.filterAttachmentOnly.checked);
});

// --- Cookie reveal ---
els.cookieRevealBtn.addEventListener('click', () => {
    const isPassword = els.cookieInput.type === 'password';
    els.cookieInput.type = isPassword ? 'text' : 'password';
    const icon = els.cookieRevealBtn.querySelector('i');
    if (icon) icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
});

// --- Load Settings ---
async function loadSettings(): Promise<void> {
    try {
        const res = await fetch('/download/settings');
        const settings: Settings = await res.json();

        els.cookieInput.value = settings.cookie || '';

        const mediaType = settings.include?.['posts.with.media.type'];
        if (mediaType === 'attachment') {
            els.filterAttachmentOnly.checked = true;
            els.mediaTypeFilters.classList.add('d-none');
        } else if (mediaType) {
            els.filterAttachmentOnly.checked = false;
            els.mediaTypeFilters.classList.remove('d-none');
            const types = mediaType.split(',').map((s) => s.trim());
            (document.getElementById('mediaAttachment') as HTMLInputElement).checked = types.includes('attachment');
            (document.getElementById('mediaVideo') as HTMLInputElement).checked = types.includes('video');
            (document.getElementById('mediaAudio') as HTMLInputElement).checked = types.includes('audio');
            (document.getElementById('mediaImage') as HTMLInputElement).checked = types.includes('image');
        } else {
            els.filterAttachmentOnly.checked = false;
            els.mediaTypeFilters.classList.remove('d-none');
        }

        els.filterLockedContent.checked = settings.include?.['locked.content'] !== 'false';
        els.filterPreviewMedia.checked = settings.include?.['preview.media'] !== 'false';
        els.filterComments.checked = settings.include?.comments === 'true';

        if (settings.embedDownloaders?.length) {
            els.embedDownloadersDisplay.innerHTML = settings.embedDownloaders
                .map(
                    (dl) =>
                        `<div class="mb-1"><strong>${escapeHtml(dl.provider)}:</strong> <code>${escapeHtml(dl.exec)}</code></div>`,
                )
                .join('');
        } else {
            els.embedDownloadersDisplay.textContent = 'No embed downloaders configured';
        }
    } catch {
        els.embedDownloadersDisplay.textContent = 'Failed to load settings';
    }
}

// --- Save Settings ---
els.saveSettingsBtn.addEventListener('click', async () => {
    const include: Record<string, string> = {};

    if (els.filterAttachmentOnly.checked) {
        include['posts.with.media.type'] = 'attachment';
    } else {
        const types: string[] = [];
        if ((document.getElementById('mediaAttachment') as HTMLInputElement).checked) types.push('attachment');
        if ((document.getElementById('mediaVideo') as HTMLInputElement).checked) types.push('video');
        if ((document.getElementById('mediaAudio') as HTMLInputElement).checked) types.push('audio');
        if ((document.getElementById('mediaImage') as HTMLInputElement).checked) types.push('image');
        if (types.length > 0) {
            include['posts.with.media.type'] = types.join(', ');
        }
    }

    if (!els.filterLockedContent.checked) include['locked.content'] = 'false';
    if (!els.filterPreviewMedia.checked) include['preview.media'] = 'false';
    if (els.filterComments.checked) include.comments = 'true';

    let embedDownloaders: EmbedDownloader[] = [];
    try {
        const currentRes = await fetch('/download/settings');
        const current: Settings = await currentRes.json();
        embedDownloaders = current.embedDownloaders || [];
    } catch {
        /* ignore */
    }

    const settings: Settings = {
        cookie: els.cookieInput.value,
        embedDownloaders,
        include,
    };

    try {
        const res = await fetch('/download/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        const data = await res.json();
        els.settingsSaveStatus.classList.remove('d-none');
        if (res.ok) {
            els.settingsSaveStatus.textContent = 'Saved!';
            els.settingsSaveStatus.className = 'ms-2 small text-success';
        } else {
            els.settingsSaveStatus.textContent = data.error || 'Save failed';
            els.settingsSaveStatus.className = 'ms-2 small text-danger';
        }
        setTimeout(() => els.settingsSaveStatus.classList.add('d-none'), 3000);
    } catch (err) {
        alert(`Failed to save settings: ${(err as Error).message}`);
    }
});
