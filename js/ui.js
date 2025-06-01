window.ui = (function() {
    // --- Private IntersectionObserver for lazy loading ---
    let imageIntersectionObserver;

    // --- Private Cached Element References ---
    let modalElement, modalImage, modalFileInfoContainer, closeModalButton;
    let batchOpBar, selectedCountText;
    let autoRefreshCheckboxEl;
    let probeFilesBtnEl;

    // --- Private Helper Functions for Field Errors ---
    function _showFieldError(inputId, message) {
        const inputElement = document.getElementById(inputId);
        if (!inputElement) {
            console.warn(`_showFieldError: Element with ID '${inputId}' not found.`);
            return;
        }
        _clearFieldError(inputId); // Clear existing error first

        let errorElement = document.createElement('small');
        errorElement.id = inputId + '-error';
        errorElement.className = 'field-error-message';
        errorElement.textContent = message;

        // Insert after the input's parent if it's a simple wrapper, or directly after input
        // This logic might need adjustment based on exact HTML structure around inputs
        const parent = inputElement.parentNode;
        if (parent && parent.lastChild === inputElement) { // If input is the last child of its parent
            parent.appendChild(errorElement);
        } else {
            parent.insertBefore(errorElement, inputElement.nextSibling);
        }
        inputElement.classList.add('input-error');
    }

    function _clearFieldError(inputId) {
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            inputElement.classList.remove('input-error');
        }
        const errorElement = document.getElementById(inputId + '-error');
        if (errorElement && errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
        }
    }

    function initializeLazyLoadObserver() {
        imageIntersectionObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const spinner = img.nextElementSibling;
                    img.src = img.dataset.src;
                    if (spinner && spinner.classList.contains('image-loading-spinner')) spinner.style.display = 'block';
                    img.onload = () => {
                        img.removeAttribute('data-src');
                        img.classList.remove('lazy-load-image');
                        if (spinner && spinner.classList.contains('image-loading-spinner')) spinner.style.display = 'none';
                        observer.unobserve(img);
                    };
                    img.onerror = () => {
                        console.error("Error loading image:", img.dataset.src);
                        img.alt = `Error loading ${img.alt}`;
                        if (spinner && spinner.classList.contains('image-loading-spinner')) spinner.style.display = 'none';
                        observer.unobserve(img);
                    };
                }
            });
        }, { rootMargin: "0px 0px 100px 0px" });
    }

    function cacheInteractiveElements() {
        modalElement = document.getElementById('image-preview-modal');
        if (modalElement) {
            modalImage = document.getElementById('modal-image-src');
            modalFileInfoContainer = document.getElementById('modal-file-info');
            closeModalButton = modalElement.querySelector('.close-modal-btn');
        } else { console.error("Modal elements not found!"); }

        batchOpBar = document.getElementById('batch-operation-bar');
        selectedCountText = document.getElementById('selected-count-text');
        if (!batchOpBar || !selectedCountText) { console.error("Batch operation bar elements not found!");}

        autoRefreshCheckboxEl = document.getElementById('auto-refresh-checkbox');
        if (!autoRefreshCheckboxEl) console.error("Auto-refresh checkbox not found!");

        probeFilesBtnEl = document.getElementById('probe-files-btn');
        if (!probeFilesBtnEl) console.error("Probe files button not found!");
    }

    initializeLazyLoadObserver();
    document.addEventListener('DOMContentLoaded', cacheInteractiveElements);

    const publicApi = {
        init: () => {
            publicApi.updateBatchOperationBar(0);
            console.log("UI initialized.");
        },

        // --- Server Connection UI ---
        getServerAddressInput: () => { const el = document.getElementById('server-address'); return el ? el.value.trim() : ''; },
        setServerAddressInput: (address) => { const el = document.getElementById('server-address'); if (el) el.value = address; },
        populateSavedServersDropdown: (servers) => { const el = document.getElementById('saved-servers'); if (!el) return; el.innerHTML = ''; const ph = document.createElement('option'); ph.value = ''; ph.textContent = 'Select a saved server'; el.appendChild(ph); if (servers && Array.isArray(servers)) { servers.forEach(s => { if (s) { const o = document.createElement('option'); o.value = s; o.textContent = s; el.appendChild(o); }}); } },
        getSelectedServer: () => { const el = document.getElementById('saved-servers'); return el ? el.value : ''; },
        displayServerInputError: (message) => _showFieldError('server-address', message),
        clearServerInputError: () => _clearFieldError('server-address'),

        // --- Probe & Filename Settings UI ---
        getProbeSettings: () => ({ startNumber: parseInt(document.getElementById('start-number').value, 10) || 1, probeQuantity: parseInt(document.getElementById('probe-quantity').value, 10) || 100, fileType: document.getElementById('file-type').value || 'PNG', subfolder: document.getElementById('subfolder-input').value.trim() || '' }),
        getFilenamePatternSettings: () => ({ filePrefix: document.getElementById('file-prefix').value.trim() || 'ComfyUI_', digitCount: parseInt(document.getElementById('digit-count').value, 10) || 5, underscoreSuffix: document.getElementById('underscore-suffix-checkbox').checked }),
        setProbeSettings: (settings) => { if (settings) { document.getElementById('start-number').value = settings.startNumber; document.getElementById('probe-quantity').value = settings.probeQuantity; document.getElementById('file-type').value = settings.fileType; document.getElementById('subfolder-input').value = settings.subfolder; } },
        setFilenamePatternSettings: (patternSettings) => { if (patternSettings) { document.getElementById('file-prefix').value = patternSettings.filePrefix; document.getElementById('digit-count').value = patternSettings.digitCount; document.getElementById('underscore-suffix-checkbox').checked = patternSettings.underscoreSuffix; } },
        displayProbeSettingValidationError: (elementId, message) => _showFieldError(elementId, message),
        clearProbeSettingValidationError: (elementId) => _clearFieldError(elementId),
        updateCurrentPatternDisplay: (patternString) => { const el = document.getElementById('current-pattern-display'); if (el) el.textContent = `当前匹配模式: ${patternString}`; },

        // --- Probing Status & Results UI ---
        updateProbeProgress: (current, total) => { const pb = document.getElementById('probe-progress'); const pt = document.getElementById('progress-text'); if (pb) { pb.value = current; pb.max = total; } if (pt) pt.textContent = `已完成: ${current}/${total}`; },
        clearImageGrid: () => { const imageGrid = document.getElementById('image-grid'); if (imageGrid) { imageGrid.innerHTML = ''; } },
        clearStatusMessages: () => { const el = document.getElementById('status-messages'); if (el) el.innerHTML = ''; },
        displayProbingStatusMessage: (message, isError = false) => { const el = document.getElementById('status-messages'); if (el) { const msgDiv = document.createElement('div'); msgDiv.textContent = message; if (isError) msgDiv.classList.add('error-message'); el.appendChild(msgDiv); el.scrollTop = el.scrollHeight; } },
        addFoundImageCard: function(fileInfo) {
            const imageGrid = document.getElementById('image-grid'); if (!imageGrid) return;
            const card = document.createElement('div'); card.className = 'image-card'; card.dataset.filename = fileInfo.filename;
            const thumbContainer = document.createElement('div'); thumbContainer.className = 'image-thumbnail-container';
            const img = document.createElement('img'); img.alt = fileInfo.filename; img.className = 'lazy-load-image';
            img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; img.dataset.src = fileInfo.url;
            const spinnerEl = document.createElement('div'); spinnerEl.className = 'image-loading-spinner'; spinnerEl.style.display = 'none';
            thumbContainer.appendChild(img); thumbContainer.appendChild(spinnerEl);
            thumbContainer.addEventListener('click', (e) => { if (e.target.type !== 'checkbox') { if (window.app && typeof window.app.requestOpenModal === 'function') window.app.requestOpenModal(fileInfo); else publicApi.openImagePreviewModal(fileInfo); } });
            const infoDiv = document.createElement('div'); infoDiv.className = 'image-card-info';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'image-select-checkbox'; checkbox.dataset.filename = fileInfo.filename;
            checkbox.addEventListener('change', (event) => { if (window.app && typeof window.app.toggleFileSelection === 'function') window.app.toggleFileSelection(fileInfo.filename, event.target.checked); else console.warn("app.toggleFileSelection not defined."); });
            const pFilename = document.createElement('p'); pFilename.className = 'filename'; pFilename.textContent = `文件名: ${fileInfo.filename}`;
            const pFileTypeSize = document.createElement('p'); pFileTypeSize.className = 'filetype'; pFileTypeSize.textContent = `类型: ${fileInfo.type} | 大小: ${fileInfo.size}`;
            infoDiv.appendChild(checkbox); infoDiv.appendChild(pFilename); infoDiv.appendChild(pFileTypeSize);
            card.appendChild(thumbContainer); card.appendChild(infoDiv);
            imageGrid.appendChild(card);
            if (imageIntersectionObserver && img) imageIntersectionObserver.observe(img);
        },

        // --- Modal UI ---
        openImagePreviewModal: (fileInfo) => { if (!modalElement || !modalImage || !modalFileInfoContainer) { cacheInteractiveElements(); if(!modalElement) return; } modalImage.src = fileInfo.url; modalImage.alt = fileInfo.filename; modalFileInfoContainer.innerHTML = `<p><strong>File Name:</strong> ${fileInfo.filename}</p><p><strong>Path:</strong> ${fileInfo.path}</p><p><strong>Dimensions:</strong> ${fileInfo.dimensions}</p><p><strong>Size:</strong> ${fileInfo.size}</p><p><strong>Created:</strong> ${fileInfo.created}</p>`; modalElement.style.display = 'flex'; document.body.classList.add('modal-open'); modalElement.dataset.currentFilename = fileInfo.filename; },
        closeImagePreviewModal: () => { if (!modalElement || !modalImage) return; modalElement.style.display = 'none'; modalImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; document.body.classList.remove('modal-open'); if (modalElement.dataset.currentFilename) delete modalElement.dataset.currentFilename; },

        // --- Batch Operations UI ---
        updateBatchOperationBar: (count) => { if (!batchOpBar || !selectedCountText) { cacheInteractiveElements(); if (!batchOpBar || !selectedCountText) return; } if (count > 0) { selectedCountText.textContent = `已选择: ${count}个文件`; batchOpBar.style.display = 'flex'; } else { batchOpBar.style.display = 'none'; } },
        setAllCheckboxesState: (isChecked) => { const imageGrid = document.getElementById('image-grid'); if (imageGrid) { const checkboxes = imageGrid.querySelectorAll('.image-select-checkbox'); checkboxes.forEach(checkbox => { checkbox.checked = isChecked; }); } },

        // --- Auto-Refresh UI ---
        setAutoRefreshCheckboxState: (isChecked) => { if (!autoRefreshCheckboxEl) { cacheInteractiveElements(); if(!autoRefreshCheckboxEl) return; } autoRefreshCheckboxEl.checked = isChecked; },

        // --- General Controls State ---
        setControlsDisabledState: (disabled) => {
            const controlIds = [ 'server-address', 'save-server-btn', 'delete-server-btn', 'saved-servers', 'start-number', 'probe-quantity', 'file-type', 'subfolder-input', 'file-prefix', 'digit-count', 'underscore-suffix-checkbox', 'reset-settings-btn', 'refresh-cache-btn' ];
            controlIds.forEach(id => { const e = document.getElementById(id); if (e) e.disabled = disabled; });
            const stopBtn = document.getElementById('stop-probing-btn'); if (stopBtn) stopBtn.disabled = !disabled;
            if (probeFilesBtnEl) {
                probeFilesBtnEl.disabled = disabled;
                if (disabled) {
                    probeFilesBtnEl.innerHTML = '探测中... <span class="spinner"></span>';
                } else {
                    probeFilesBtnEl.textContent = '探测文件';
                }
            }
        }
    };
    return publicApi;
})();
