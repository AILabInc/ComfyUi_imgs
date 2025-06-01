document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const LOCAL_STORAGE_SERVERS_KEY = 'comfyui_saved_servers';
    const LOCAL_STORAGE_PROBE_SETTINGS_KEY = 'comfyui_probe_settings';
    const AUTO_REFRESH_STORAGE_KEY = 'comfyui_auto_refresh_enabled';
    const AUTO_REFRESH_INTERVAL_MS = 15000;
    const DEFAULT_PROBE_SETTINGS = { startNumber: 1, probeQuantity: 100, fileType: 'PNG', subfolder: '' };
    const DEFAULT_FILENAME_PATTERN_SETTINGS = { filePrefix: 'ComfyUI_', digitCount: 5, underscoreSuffix: true };

    // --- Element Selectors ---
    const saveServerBtn = document.getElementById('save-server-btn');
    const deleteServerBtn = document.getElementById('delete-server-btn');
    const modalElement = document.getElementById('image-preview-modal');
    const probeFilesBtn = document.getElementById('probe-files-btn');
    const stopProbingBtn = document.getElementById('stop-probing-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    const refreshCacheBtn = document.getElementById('refresh-cache-btn');
    const autoRefreshCheckbox = document.getElementById('auto-refresh-checkbox');

    // --- Global State ---
    let isProbing = false;
    let stopProbingRequested = false;
    let currentlyVisibleFileInfos = [];
    let currentModalIndex = -1;
    let selectedFiles = new Set();
    let autoRefreshIntervalId = null;
    let isAutoRefreshEnabled = false;

    // ==========================================================================
    // APP OBJECT (for functions called from UI layer)
    // ==========================================================================
    if (!window.app) window.app = {};
    window.app.requestOpenModal = (fileInfo) => { /* ... (existing, miniaturized) ... */ currentModalIndex = currentlyVisibleFileInfos.findIndex(f => f.filename === fileInfo.filename && f.path === fileInfo.path); if (window.ui) window.ui.openImagePreviewModal(fileInfo); };
    window.app.toggleFileSelection = (filename, isSelected) => { /* ... (existing, miniaturized) ... */ if (isSelected) selectedFiles.add(filename); else selectedFiles.delete(filename); if (window.ui) window.ui.updateBatchOperationBar(selectedFiles.size); };

    // ==========================================================================
    // SERVER CONNECTION LOGIC (Miniaturized)
    // ==========================================================================
    function loadSavedServers() { const sj = localStorage.getItem(LOCAL_STORAGE_SERVERS_KEY); let s = []; if (sj) { try { s = JSON.parse(sj); } catch (e) { console.error("E parse saved servers:", e); s = []; } } if (window.ui) window.ui.populateSavedServersDropdown(s); return s; }
    function saveServerAddress(sa) {
        if (window.ui) window.ui.clearServerInputError(); // Clear previous error
        if (!sa) { if (window.ui) window.ui.displayServerInputError("Server address cannot be empty."); return; }
        const sr = /^([a-zA-Z0-9\-_]+(\.[a-zA-Z0-9\-_]+)*|((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))(:(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3}))$/;
        if (!sr.test(sa)) { if (window.ui) window.ui.displayServerInputError("Invalid server address format. Use hostname:port or IP:port."); return; }

        let s = loadSavedServers();
        if (!Array.isArray(s)) s = [];
        if (!s.includes(sa)) {
            s.push(sa);
            try {
                localStorage.setItem(LOCAL_STORAGE_SERVERS_KEY, JSON.stringify(s));
            } catch (e) {
                console.warn("Error saving servers to localStorage:", e);
                if (window.ui) window.ui.displayServerInputError("Could not save server. Storage might be full or restricted.");
                return;
            }
        }
        if (window.ui) { window.ui.populateSavedServersDropdown(s); window.ui.setServerAddressInput(sa); }
        const savedServersSelectEl = document.getElementById('saved-servers');
        if (savedServersSelectEl) savedServersSelectEl.value = sa;
    }

    function deleteServerAddress(std) {
        if (window.ui) window.ui.clearServerInputError(); // Clear error related to this field
        if (!std) return;
        let s = loadSavedServers();
        if (!Array.isArray(s)) s = [];
        const il = s.length;
        s = s.filter(i => i !== std);
        if (s.length < il) {
            try {
                localStorage.setItem(LOCAL_STORAGE_SERVERS_KEY, JSON.stringify(s));
            } catch (e) {
                console.warn("Error saving servers after deletion:", e);
                if (window.ui) window.ui.displayServerInputError("Could not update server list. Storage might be full or restricted.");
                return;
            }
        } else {
            // It's not an error if the address to delete wasn't in the list, so don't show an error.
            // if (window.ui) window.ui.displayServerInputError(`Server "${std}" not in saved list.`);
            return;
        }
        if (window.ui) window.ui.populateSavedServersDropdown(s);
        if (window.ui && window.ui.getServerAddressInput() === std) {
            if (window.ui) window.ui.setServerAddressInput('');
        }
    }
    function initServerConnectionEventListeners() { if (saveServerBtn) saveServerBtn.addEventListener('click', () => { if (window.ui) saveServerAddress(window.ui.getServerAddressInput()); }); const deleteServerBtnEl = document.getElementById('delete-server-btn'); if (deleteServerBtnEl) deleteServerBtnEl.addEventListener('click', () => { if (window.ui) { const a = window.ui.getServerAddressInput(); if (!a) { window.ui.displayServerInputError("Input empty. Type or select server to delete."); return; } deleteServerAddress(a); } }); const savedServersSelectEl = document.getElementById('saved-servers'); if (savedServersSelectEl) savedServersSelectEl.addEventListener('change', () => { if (window.ui) { const sel = window.ui.getSelectedServer(); if (sel) { window.ui.setServerAddressInput(sel); window.ui.clearServerInputError(); } } }); }

    // ==========================================================================
    // PROBE CONTROL AND FILENAME PATTERN LOGIC
    // ==========================================================================
    function getCurrentProbeConfig() {
        if (!window.ui) { console.error("UI obj not avail."); return null; }
        // Clear previous validation errors for these fields at the start
        const fieldIdsToClear = ['start-number', 'probe-quantity', 'subfolder-input', 'file-prefix', 'digit-count'];
        fieldIdsToClear.forEach(id => window.ui.clearProbeSettingValidationError(id));

        const ps = window.ui.getProbeSettings();
        const pts = window.ui.getFilenamePatternSettings();
        let v = true;
        if (isNaN(ps.startNumber) || ps.startNumber < 1 || ps.startNumber > 99999) { window.ui.displayProbeSettingValidationError('start-number', 'Start number must be between 1 and 99999.'); v = false; }
        if (isNaN(ps.probeQuantity) || ps.probeQuantity < 1 || ps.probeQuantity > 1000) { window.ui.displayProbeSettingValidationError('probe-quantity', 'Quantity must be between 1 and 1000.'); v = false; }
        if (ps.probeQuantity > 500) console.warn("Warn: Probing qty > 500 may take time.");
        const sfr = /^[a-zA-Z0-9_/\-]{0,50}$/;
        if (!sfr.test(ps.subfolder)) { window.ui.displayProbeSettingValidationError('subfolder-input', 'Subfolder: max 50 chars (a-z, A-Z, 0-9, _, /, -).'); v = false; }
        const pfr = /^[a-zA-Z0-9_\-]{0,20}$/;
        if (!pfr.test(pts.filePrefix)) { window.ui.displayProbeSettingValidationError('file-prefix', 'Prefix: max 20 chars (a-z, A-Z, 0-9, _, -).'); v = false; }
        if (![3, 4, 5, 6].includes(pts.digitCount)) { window.ui.displayProbeSettingValidationError('digit-count', 'Invalid digit count.'); v = false; }
        if (!v) return null;
        return { ...ps, filenamePattern: pts };
    }
    function generatePatternPreview(fps, ps) { /* ... (existing, miniaturized) ... */ if (!window.ui || !fps || !ps) return; const en = '1'.padStart(fps.digitCount, '0'); const sfx = fps.underscoreSuffix ? '_' : ''; const ext = ps.fileType ? ps.fileType.toLowerCase() : 'png'; const pstr = `${fps.filePrefix}${en}${sfx}.${ext}`; window.ui.updateCurrentPatternDisplay(pstr); }
    function saveProbeConfig() {
        if (!window.ui) return;
        const ps = window.ui.getProbeSettings();
        const fp = window.ui.getFilenamePatternSettings();
        const cfs = { ...ps, ...fp };
        try {
            localStorage.setItem(LOCAL_STORAGE_PROBE_SETTINGS_KEY, JSON.stringify(cfs));
        } catch (e) {
            console.warn("Error saving probe config to localStorage:", e);
            // Optionally, inform user via a non-blocking message if this is critical
            if(window.ui && window.ui.displayProbingStatusMessage) {
                window.ui.displayProbingStatusMessage("Warning: Could not save probe settings. Storage might be full.", true);
            }
        }
    }
    function handleSettingsChange() { /* ... (existing, miniaturized) ... */ if (!window.ui) return; const cps = window.ui.getProbeSettings(); const cfps = window.ui.getFilenamePatternSettings(); generatePatternPreview(cfps, cps); saveProbeConfig(); }
    function loadProbeConfig() { /* ... (existing, miniaturized) ... */ if (!window.ui) return; let lc = {}; const scj = localStorage.getItem(LOCAL_STORAGE_PROBE_SETTINGS_KEY); if (scj) { try { lc = JSON.parse(scj); } catch (e) { console.error("E parsing probe settings:", e); lc = {}; } } const psta = { startNumber: lc.startNumber !== undefined ? lc.startNumber : DEFAULT_PROBE_SETTINGS.startNumber, probeQuantity: lc.probeQuantity !== undefined ? lc.probeQuantity : DEFAULT_PROBE_SETTINGS.probeQuantity, fileType: lc.fileType !== undefined ? lc.fileType : DEFAULT_PROBE_SETTINGS.fileType, subfolder: lc.subfolder !== undefined ? lc.subfolder : DEFAULT_PROBE_SETTINGS.subfolder, }; const fpsta = { filePrefix: lc.filePrefix !== undefined ? lc.filePrefix : DEFAULT_FILENAME_PATTERN_SETTINGS.filePrefix, digitCount: lc.digitCount !== undefined ? lc.digitCount : DEFAULT_FILENAME_PATTERN_SETTINGS.digitCount, underscoreSuffix: lc.underscoreSuffix !== undefined ? lc.underscoreSuffix : DEFAULT_FILENAME_PATTERN_SETTINGS.underscoreSuffix, }; window.ui.setProbeSettings(psta); window.ui.setFilenamePatternSettings(fpsta); generatePatternPreview(fpsta, psta); }
    function resetProbeSettingsToDefaults() { /* ... (existing, miniaturized) ... */ if (!window.ui) return; window.ui.setProbeSettings(DEFAULT_PROBE_SETTINGS); window.ui.setFilenamePatternSettings(DEFAULT_FILENAME_PATTERN_SETTINGS); generatePatternPreview(DEFAULT_FILENAME_PATTERN_SETTINGS, DEFAULT_PROBE_SETTINGS); saveProbeConfig(); }
    function initProbeControlEventListeners() { /* ... (existing, miniaturized) ... */ const ips = [ document.getElementById('start-number'), document.getElementById('probe-quantity'), document.getElementById('file-type'), document.getElementById('subfolder-input'), document.getElementById('file-prefix'), document.getElementById('digit-count'), document.getElementById('underscore-suffix-checkbox') ]; ips.forEach(ip => { if (ip) ip.addEventListener((ip.type === 'checkbox' || ip.tagName === 'SELECT') ? 'change' : 'input', handleSettingsChange); }); const resetSettingsBtn = document.getElementById('reset-settings-btn'); if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', resetProbeSettingsToDefaults); }

    // ==========================================================================
    // CORE PROBING WORKFLOW
    // ==========================================================================
    async function startProbing() {
        if (isProbing) return;
        if (!window.ui || !window.api) { console.error("UI or API not available"); return; }

        // Clear server address error before trying to use it
        if (window.ui && window.ui.clearServerInputError) window.ui.clearServerInputError();

        isProbing = true;
        stopProbingRequested = false;
        currentlyVisibleFileInfos = [];
        currentModalIndex = -1;
        selectedFiles.clear();
        if (window.ui) window.ui.updateBatchOperationBar(selectedFiles.size);
        window.ui.setControlsDisabledState(true);
        window.ui.clearImageGrid();
        window.ui.clearStatusMessages();
        window.ui.displayProbingStatusMessage("Starting probe...", false);

        const serverAddress = window.ui.getServerAddressInput();
        if (!serverAddress) {
            if (window.ui && window.ui.displayServerInputError) window.ui.displayServerInputError("Server address is required to start probing.");
            else if (window.ui) window.ui.displayProbingStatusMessage("Server address is empty.", true);
            window.ui.setControlsDisabledState(false);
            isProbing = false;
            return;
        }

        const config = getCurrentProbeConfig(); // This now clears its own errors
        if (!config) {
            window.ui.displayProbingStatusMessage("Probe configuration invalid. Please check settings highlighted above.", true);
            window.ui.setControlsDisabledState(false);
            isProbing = false;
            return;
        }

        const { probeQuantity, startNumber, fileType, subfolder, filenamePattern } = config;
        const { filePrefix, digitCount, underscoreSuffix } = filenamePattern;
        window.ui.updateProbeProgress(0, probeQuantity);

        for (let i = 0; i < probeQuantity; i++) {
            if (stopProbingRequested) { window.ui.displayProbingStatusMessage("Probing stopped by user.", false); break; }
            const currentFileNumber = startNumber + i;
            const numberStr = String(currentFileNumber).padStart(digitCount, '0');
            const filename = `${filePrefix}${numberStr}${underscoreSuffix ? '_' : ''}.${fileType.toLowerCase()}`;
            window.ui.displayProbingStatusMessage(`Probing: ${filename}...`, false);
            try {
                const fileInfo = await window.api.probeFile(serverAddress, filename, fileType, subfolder);
                if (!stopProbingRequested) {
                    currentlyVisibleFileInfos.push(fileInfo);
                    window.ui.addFoundImageCard(fileInfo);
                }
            } catch (error) {
                if (!stopProbingRequested) {
                    let friendlyMessage = `Error for ${filename}: `;
                    if (error && error.status === 404) friendlyMessage += "File not found.";
                    else if (error && error.status === 500) friendlyMessage += "Server error during probe.";
                    else friendlyMessage += (error.message || 'Unknown error');
                    window.ui.displayProbingStatusMessage(friendlyMessage, true);
                }
            } finally {
                if (!stopProbingRequested) window.ui.updateProbeProgress(i + 1, probeQuantity);
            }
        }
        window.ui.displayProbingStatusMessage(stopProbingRequested ? 'Probing session ended by user.' : 'Probing complete.');
        generatePatternPreview(filenamePattern, { fileType, startNumber, probeQuantity, subfolder });
        isProbing = false;
        stopProbingRequested = false;
        window.ui.setControlsDisabledState(false);
    }
    function stopProbing() { if (isProbing && !stopProbingRequested) { stopProbingRequested = true; if (window.ui) window.ui.displayProbingStatusMessage("Stop request received...", false); } }
    function initCoreEventListeners() { if (probeFilesBtn) probeFilesBtn.addEventListener('click', startProbing); if (stopProbingBtn) stopProbingBtn.addEventListener('click', stopProbing); }

    // ==========================================================================
    // MODAL EVENT LISTENERS AND NAVIGATION
    // ==========================================================================
    function initModalEventListeners() { const c = modalElement ? modalElement.querySelector('.close-modal-btn') : null; if (c && window.ui) c.addEventListener('click', window.ui.closeImagePreviewModal); if (modalElement && window.ui) modalElement.addEventListener('click', (e) => { if (e.target === modalElement) window.ui.closeImagePreviewModal(); }); document.addEventListener('keydown', (e) => { if (!modalElement || modalElement.style.display !== 'flex') return; let h = false; if (e.key === 'Escape') { if (window.ui) window.ui.closeImagePreviewModal(); h = true; } else if (e.key === 'ArrowLeft') { if (currentModalIndex > 0) currentModalIndex--; else currentModalIndex = currentlyVisibleFileInfos.length - 1; if (currentModalIndex >= 0 && window.ui && currentlyVisibleFileInfos[currentModalIndex]) window.ui.openImagePreviewModal(currentlyVisibleFileInfos[currentModalIndex]); h = true; } else if (e.key === 'ArrowRight') { if (currentModalIndex < currentlyVisibleFileInfos.length - 1) currentModalIndex++; else currentModalIndex = 0; if (window.ui && currentlyVisibleFileInfos[currentModalIndex]) window.ui.openImagePreviewModal(currentlyVisibleFileInfos[currentModalIndex]); h = true; } if (h) e.preventDefault(); }); }

    // ==========================================================================
    // BATCH OPERATIONS (Miniaturized)
    // ==========================================================================
    function selectAllFiles() { if (!window.ui) return; selectedFiles.clear(); currentlyVisibleFileInfos.forEach(fi => selectedFiles.add(fi.filename)); window.ui.setAllCheckboxesState(true); window.ui.updateBatchOperationBar(selectedFiles.size); }
    function deselectAllFiles() { if (!window.ui) return; selectedFiles.clear(); window.ui.setAllCheckboxesState(false); window.ui.updateBatchOperationBar(selectedFiles.size); }
    function downloadSelectedFiles() { if (selectedFiles.size === 0) { alert("No files selected for download."); return; } console.log("Simulating download:", Array.from(selectedFiles)); let dc = 0; selectedFiles.forEach(fn => { const fi = currentlyVisibleFileInfos.find(f => f.filename === fn); if (fi && fi.url) { console.log(`Download: ${fi.url}`); dc++; } }); if (window.ui) window.ui.displayProbingStatusMessage(`Simulated download for ${dc} files. See console.`, false); }
    function initBatchOperationEventListeners() { if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllFiles); if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAllFiles); if (downloadSelectedBtn) downloadSelectedBtn.addEventListener('click', downloadSelectedFiles); }

    // ==========================================================================
    // AUTO-REFRESH AND REFRESH CACHE
    // ==========================================================================
    function refreshCache() {
        if (isProbing) {
            if (window.ui) window.ui.displayProbingStatusMessage("Already probing. Refresh request ignored.", false);
            return;
        }
        if (window.ui) window.ui.displayProbingStatusMessage("Cache refresh requested...", false); // Optional message
        startProbing();
    }

    function toggleAutoRefresh(enable) {
        isAutoRefreshEnabled = enable; // Update state based on checkbox or direct call

        if (isAutoRefreshEnabled) {
            if (autoRefreshIntervalId === null) { // Only if not already running
                if (window.ui) window.ui.displayProbingStatusMessage("Auto-refresh enabled. Initializing probe...", false);
                refreshCache(); // Perform an immediate refresh
                autoRefreshIntervalId = setInterval(refreshCache, AUTO_REFRESH_INTERVAL_MS);
            }
        } else {
            if (autoRefreshIntervalId !== null) {
                clearInterval(autoRefreshIntervalId);
                autoRefreshIntervalId = null;
                if (window.ui) window.ui.displayProbingStatusMessage("Auto-refresh disabled.", false);
            }
        }
        localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, isAutoRefreshEnabled);
        if (window.ui) window.ui.setAutoRefreshCheckboxState(isAutoRefreshEnabled); // Ensure UI checkbox matches state
    }

    function loadAutoRefreshState() {
        const savedState = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
        const initialEnableState = savedState === 'true';

        if (window.ui) window.ui.setAutoRefreshCheckboxState(initialEnableState);

        if (initialEnableState) {
            isAutoRefreshEnabled = true;
            if (autoRefreshIntervalId === null) {
                autoRefreshIntervalId = setInterval(refreshCache, AUTO_REFRESH_INTERVAL_MS);
                if (window.ui) window.ui.displayProbingStatusMessage("Auto-refresh active from previous session.", false);
            }
        } else {
            isAutoRefreshEnabled = false;
        }
    }

    function initRefreshEventListeners() {
        if (refreshCacheBtn) refreshCacheBtn.addEventListener('click', refreshCache);
        if (autoRefreshCheckbox) {
            autoRefreshCheckbox.addEventListener('change', (event) => {
                toggleAutoRefresh(event.target.checked);
            });
        }
    }

    // --- Initialization ---
    if (window.ui && typeof window.ui.init === 'function') window.ui.init();
    loadSavedServers();
    initServerConnectionEventListeners();
    loadProbeConfig();
    initProbeControlEventListeners();
    initCoreEventListeners();
    initModalEventListeners();
    initBatchOperationEventListeners();
    loadAutoRefreshState(); // Load auto-refresh state
    initRefreshEventListeners(); // Initialize refresh and auto-refresh listeners

    if (window.ui) {
        window.ui.setControlsDisabledState(false);
        window.ui.updateBatchOperationBar(0);
    }
});
