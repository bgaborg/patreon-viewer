(() => {
    const els = {
        form: document.getElementById('downloadForm'),
        urlInput: document.getElementById('urlInput'),
        downloadBtn: document.getElementById('downloadBtn'),
        settingsToggle: document.getElementById('settingsToggle'),
        settingsPanel: document.getElementById('settingsPanel'),
        cookieInput: document.getElementById('cookieInput'),
        cookieRevealBtn: document.getElementById('cookieRevealBtn'),
        filterAttachmentOnly: document.getElementById('filterAttachmentOnly'),
        mediaTypeFilters: document.getElementById('mediaTypeFilters'),
        filterLockedContent: document.getElementById('filterLockedContent'),
        filterPreviewMedia: document.getElementById('filterPreviewMedia'),
        filterComments: document.getElementById('filterComments'),
        embedDownloadersDisplay: document.getElementById('embedDownloadersDisplay'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        settingsSaveStatus: document.getElementById('settingsSaveStatus'),
        statusCard: document.getElementById('statusCard'),
        statusBadge: document.getElementById('statusBadge'),
        statusUrl: document.getElementById('statusUrl'),
        abortBtn: document.getElementById('abortBtn'),
        downloadProgressSection: document.getElementById('downloadProgressSection'),
        progressFilename: document.getElementById('progressFilename'),
        progressPercent: document.getElementById('progressPercent'),
        downloadProgressBar: document.getElementById('downloadProgressBar'),
        progressSpeed: document.getElementById('progressSpeed'),
        encodingProgressSection: document.getElementById('encodingProgressSection'),
        encodingCurrent: document.getElementById('encodingCurrent'),
        encodingCount: document.getElementById('encodingCount'),
        encodingProgressBar: document.getElementById('encodingProgressBar'),
        targetTotal: document.getElementById('targetTotal'),
        targetCompleted: document.getElementById('targetCompleted'),
        targetSkipped: document.getElementById('targetSkipped'),
        activityLog: document.getElementById('activityLog'),
        logPlaceholder: document.getElementById('logPlaceholder'),
        logCount: document.getElementById('logCount'),
    };

    let logEntryCount = 0;

    // --- SSE ---
    const evtSource = new EventSource('/download/progress');

    evtSource.addEventListener('state', (e) => {
        const snapshot = JSON.parse(e.data);
        restoreState(snapshot);
    });

    evtSource.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        updateStatus(data.status, data.url, data.error);
    });

    evtSource.addEventListener('log', (e) => {
        const entry = JSON.parse(e.data);
        appendLogEntry(entry);
    });

    evtSource.addEventListener('progress', (e) => {
        const progress = JSON.parse(e.data);
        updateProgress(progress);
    });

    evtSource.addEventListener('targets', (e) => {
        const targets = JSON.parse(e.data);
        updateTargets(targets);
    });

    evtSource.addEventListener('encoding', (e) => {
        const encoding = JSON.parse(e.data);
        updateEncoding(encoding);
    });

    // --- State Restore ---
    function restoreState(snapshot) {
        if (snapshot.status !== 'idle') {
            updateStatus(snapshot.status, snapshot.url, snapshot.error);
        }
        if (snapshot.log?.length) {
            clearLog();
            for (const entry of snapshot.log) {
                appendLogEntry(entry);
            }
        }
        if (snapshot.progress) {
            updateProgress(snapshot.progress);
        }
        if (snapshot.targets) {
            updateTargets(snapshot.targets);
        }
        if (snapshot.encoding) {
            updateEncoding(snapshot.encoding);
        }
    }

    // --- Status ---
    function updateStatus(status, url, _error) {
        els.statusCard.classList.remove('d-none');

        const badge = els.statusBadge;
        badge.textContent = statusLabel(status);
        badge.className = `badge fs-6 ${statusBadgeClass(status)}`;

        els.statusUrl.textContent = url || '';

        const isActive = ['downloading', 'encoding', 'aborting'].includes(status);
        els.abortBtn.classList.toggle('d-none', !isActive || status === 'aborting');
        els.downloadBtn.disabled = isActive;

        if (status === 'downloading') {
            els.downloadProgressSection.classList.remove('d-none');
        }
        if (status === 'encoding') {
            els.encodingProgressSection.classList.remove('d-none');
        }
        if (['complete', 'error', 'aborted', 'idle'].includes(status)) {
            els.downloadBtn.disabled = false;
            els.downloadProgressBar.classList.remove('progress-bar-animated');
            els.encodingProgressBar.classList.remove('progress-bar-animated');
        }
    }

    function statusLabel(s) {
        const labels = {
            idle: 'Idle',
            downloading: 'Downloading',
            encoding: 'Encoding',
            aborting: 'Aborting...',
            aborted: 'Aborted',
            complete: 'Complete',
            error: 'Error',
        };
        return labels[s] || s;
    }

    function statusBadgeClass(s) {
        const classes = {
            idle: 'bg-secondary',
            downloading: 'bg-primary',
            encoding: 'bg-warning text-dark',
            aborting: 'bg-warning text-dark',
            aborted: 'bg-secondary',
            complete: 'bg-success',
            error: 'bg-danger',
        };
        return classes[s] || 'bg-secondary';
    }

    // --- Progress ---
    function updateProgress(progress) {
        els.downloadProgressSection.classList.remove('d-none');
        els.progressFilename.textContent = progress.filename || '';
        const pct = Math.round(progress.percent || 0);
        els.progressPercent.textContent = `${pct}%`;
        els.downloadProgressBar.style.width = `${pct}%`;

        if (progress.speed) {
            const speedMb = (progress.speed / 1024 / 1024).toFixed(1);
            els.progressSpeed.textContent = `${speedMb} MB/s`;
        }
    }

    // --- Targets ---
    function updateTargets(targets) {
        els.targetTotal.textContent = targets.total || 0;
        els.targetCompleted.textContent = targets.completed || 0;
        els.targetSkipped.textContent = targets.skipped || 0;
    }

    // --- Encoding ---
    function updateEncoding(encoding) {
        els.encodingProgressSection.classList.remove('d-none');
        els.encodingCurrent.textContent = encoding.current || '';
        els.encodingCount.textContent = `${encoding.completed || 0}/${encoding.total || 0}`;

        if (encoding.total > 0) {
            const pct = Math.round(((encoding.completed || 0) / encoding.total) * 100);
            els.encodingProgressBar.style.width = `${pct}%`;
        }
    }

    // --- Log ---
    function clearLog() {
        els.activityLog.innerHTML = '';
        logEntryCount = 0;
        els.logCount.textContent = '0';
    }

    function appendLogEntry(entry) {
        if (els.logPlaceholder) {
            els.logPlaceholder.remove();
        }

        const div = document.createElement('div');
        div.className = `download-log-entry log-${entry.type || 'info'}`;

        const time = new Date(entry.timestamp).toLocaleTimeString();
        div.innerHTML = `<span class="log-time">${time}</span> <span class="log-msg">${escapeHtml(entry.message)}</span>`;

        els.activityLog.appendChild(div);
        els.activityLog.scrollTop = els.activityLog.scrollHeight;
        logEntryCount++;
        els.logCount.textContent = logEntryCount;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
            alert(`Network error: ${err.message}`);
            els.downloadBtn.disabled = false;
        }
    });

    // --- Abort ---
    els.abortBtn.addEventListener('click', async () => {
        try {
            await fetch('/download/abort', { method: 'POST' });
        } catch (err) {
            alert(`Failed to abort: ${err.message}`);
        }
    });

    // --- Settings Toggle ---
    els.settingsToggle.addEventListener('click', () => {
        const panel = els.settingsPanel;
        const isHidden = panel.classList.contains('d-none');
        panel.classList.toggle('d-none');

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
        const input = els.cookieInput;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        els.cookieRevealBtn.querySelector('i').className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    // --- Load Settings ---
    async function loadSettings() {
        try {
            const res = await fetch('/download/settings');
            const settings = await res.json();

            els.cookieInput.value = settings.cookie || '';

            // Include filters
            const mediaType = settings.include?.['posts.with.media.type'];
            if (mediaType === 'attachment') {
                els.filterAttachmentOnly.checked = true;
                els.mediaTypeFilters.classList.add('d-none');
            } else if (mediaType) {
                els.filterAttachmentOnly.checked = false;
                els.mediaTypeFilters.classList.remove('d-none');
                const types = mediaType.split(',').map((s) => s.trim());
                document.getElementById('mediaAttachment').checked = types.includes('attachment');
                document.getElementById('mediaVideo').checked = types.includes('video');
                document.getElementById('mediaAudio').checked = types.includes('audio');
                document.getElementById('mediaImage').checked = types.includes('image');
            } else {
                els.filterAttachmentOnly.checked = false;
                els.mediaTypeFilters.classList.remove('d-none');
            }

            els.filterLockedContent.checked = settings.include?.['locked.content'] !== 'false';
            els.filterPreviewMedia.checked = settings.include?.['preview.media'] !== 'false';
            els.filterComments.checked = settings.include?.comments === 'true';

            // Embed downloaders (read-only)
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
        } catch (_err) {
            els.embedDownloadersDisplay.textContent = 'Failed to load settings';
        }
    }

    // --- Save Settings ---
    els.saveSettingsBtn.addEventListener('click', async () => {
        const include = {};

        if (els.filterAttachmentOnly.checked) {
            include['posts.with.media.type'] = 'attachment';
        } else {
            const types = [];
            if (document.getElementById('mediaAttachment').checked) types.push('attachment');
            if (document.getElementById('mediaVideo').checked) types.push('video');
            if (document.getElementById('mediaAudio').checked) types.push('audio');
            if (document.getElementById('mediaImage').checked) types.push('image');
            if (types.length > 0) {
                include['posts.with.media.type'] = types.join(', ');
            }
        }

        if (!els.filterLockedContent.checked) {
            include['locked.content'] = 'false';
        }
        if (!els.filterPreviewMedia.checked) {
            include['preview.media'] = 'false';
        }
        if (els.filterComments.checked) {
            include.comments = 'true';
        }

        // Preserve embed downloaders from current settings
        let embedDownloaders = [];
        try {
            const currentRes = await fetch('/download/settings');
            const current = await currentRes.json();
            embedDownloaders = current.embedDownloaders || [];
        } catch {
            /* ignore */
        }

        const settings = {
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
            const status = els.settingsSaveStatus;
            status.classList.remove('d-none');
            if (res.ok) {
                status.textContent = 'Saved!';
                status.className = 'ms-2 small text-success';
            } else {
                status.textContent = data.error || 'Save failed';
                status.className = 'ms-2 small text-danger';
            }
            setTimeout(() => status.classList.add('d-none'), 3000);
        } catch (err) {
            alert(`Failed to save settings: ${err.message}`);
        }
    });
})();
