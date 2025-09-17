// Clipboard security utilities for seed phrase protection

/**
 * Prevents clipboard access on mnemonic input fields
 * @param {HTMLElement} element - The DOM element to protect
 */
export function preventMnemonicClipboardAccess(element) {
    if (!element) return;

    // Disable context menu (right-click)
    element.addEventListener('contextmenu', (e) => {
        if (isMnemonicField(element)) {
            e.preventDefault();
            showClipboardSecurityWarning('Context menu disabled for security');
        }
    });

    // Disable copy shortcuts
    element.addEventListener('keydown', (e) => {
        if (isMnemonicField(element) && (e.ctrlKey || e.metaKey)) {
            if (e.key === 'c' || e.key === 'x' || e.key === 'a') {
                if (clipboardSecuritySettings.neverAllow) {
                    e.preventDefault();
                    showClipboardSecurityWarning('Copying seed phrases is disabled for security');
                    return;
                }

                if (e.key === 'c' || e.key === 'x') {
                    e.preventDefault();
                    handleSecureCopy(element.value);
                }
            }
        }
    });
}

/**
 * Determines if an element is a mnemonic field
 * @param {HTMLElement} element - The DOM element to check
 * @returns {boolean} True if element is a mnemonic field
 */
export function isMnemonicField(element) {
    return element.id === 'btc-mnemonic-input' ||
           element.closest('.mnemonic-input-container') !== null ||
           (element.value && containsMnemonicWords(element.value));
}

/**
 * Checks if text contains BIP39 mnemonic words
 * @param {string} text - Text to analyze
 * @returns {boolean} True if text contains likely mnemonic words
 */
export function containsMnemonicWords(text) {
    if (!text || text.length < 10) return false;

    const words = text.toLowerCase().split(/\s+/);
    if (words.length < 6) return false;

    // Import BIP39 word list (must be imported in main module)
    // This function assumes bip39Words is available in scope
    const mnemonicWords = words.filter(word => window.bip39Words?.includes(word));
    return mnemonicWords.length >= Math.min(6, words.length * 0.7);
}

/**
 * Handles secure copy operation with user confirmation
 * @param {string} content - The content to copy to clipboard
 */
export function handleSecureCopy(content) {
    if (clipboardSecuritySettings.neverAllow) {
        showClipboardSecurityWarning('Copying is permanently disabled for security');
        return;
    }

    showClipboardWarningDialog(content);
}

/**
 * Displays dialog warning before copying to clipboard
 * @param {string} content - The content to copy to clipboard
 */
export function showClipboardWarningDialog(content) {
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal-content clipboard-warning-modal">
            <div class="modal-header">
                <h3>⚠️ Clipboard Security Warning</h3>
            </div>
            <div class="modal-body">
                <p><strong>You are about to copy sensitive seed phrase data to the clipboard.</strong></p>
                <p>This action may expose your seed phrase to other applications that can access the clipboard.</p>
                <div class="security-options">
                    <label class="checkbox-label">
                        <input type="checkbox" id="auto-clear-clipboard">
                        Automatically clear clipboard in ${clipboardSecuritySettings.autoCleanTimeout} seconds
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="never-allow-copy">
                        Never allow copying (permanent setting)
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button id="clipboard-cancel" class="secondary-button">Cancel</button>
                <button id="clipboard-proceed" class="primary-button">Proceed with Copy</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const autoClearCheckbox = dialog.querySelector('#auto-clear-clipboard');
    const neverAllowCheckbox = dialog.querySelector('#never-allow-copy');
    const cancelBtn = dialog.querySelector('#clipboard-cancel');
    const proceedBtn = dialog.querySelector('#clipboard-proceed');

    autoClearCheckbox.checked = true; // Default to auto-clear

    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    proceedBtn.addEventListener('click', () => {
        const autoClean = autoClearCheckbox.checked;
        const neverAllow = neverAllowCheckbox.checked;

        if (neverAllow) {
            clipboardSecuritySettings.neverAllow = true;
            saveClipboardSettings();
            showClipboardSecurityWarning('Clipboard copying permanently disabled');
        } else {
            performSecureCopy(content, autoClean);
        }

        document.body.removeChild(dialog);
    });
}

/**
 * Performs actual secure copy to clipboard
 * @param {string} content - The content to copy to clipboard
 * @param {boolean} autoClean - Whether to automatically clear clipboard after timeout
 */
export function performSecureCopy(content, autoClean = true) {
    try {
        navigator.clipboard.writeText(content).then(() => {
            showMessage('Content copied to clipboard', 'success');

            if (autoClean) {
                startClipboardCleanupTimer();
            }
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            showMessage('Failed to copy to clipboard', 'error');
        });
    } catch (error) {
        console.error('Clipboard access error:', error);
        showMessage('Clipboard access denied', 'error');
    }
}

/**
 * Starts timer to automatically clear clipboard
 */
export function startClipboardCleanupTimer() {
    if (clipboardCleanupTimer) {
        clearTimeout(clipboardCleanupTimer);
    }

    let timeLeft = clipboardSecuritySettings.autoCleanTimeout;
    const countdownMessage = document.createElement('div');
    countdownMessage.className = 'clipboard-countdown';
    countdownMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        padding: 10px 15px;
        border-radius: 6px;
        z-index: 10000;
        font-size: 14px;
    `;

    document.body.appendChild(countdownMessage);

    const updateCountdown = () => {
        countdownMessage.textContent = `⏱️ Clipboard will be cleared in ${timeLeft} seconds`;

        if (timeLeft <= 0) {
            clearClipboard();
            document.body.removeChild(countdownMessage);
        } else {
            timeLeft--;
            setTimeout(updateCountdown, 1000);
        }
    };

    updateCountdown();
}

/**
 * Clears the clipboard content
 */
export function clearClipboard() {
    try {
        navigator.clipboard.writeText('').then(() => {
            showMessage('Clipboard cleared for security', 'info');
        }).catch(err => {
            console.warn('Failed to clear clipboard:', err);
        });
    } catch (error) {
        console.warn('Clipboard clear failed:', error);
    }
}

/**
 * Shows a security warning message for clipboard actions
 * @param {string} message - The warning message to display
 */
export function showClipboardSecurityWarning(message) {
    // Create a proper modal dialog for clipboard warnings
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content clipboard-warning-modal" style="max-width: 400px;">
            <div class="modal-header">
                <h3>🔒 Security Warning</h3>
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <p><strong>${message}</strong></p>
                <p>This action is restricted for your security.</p>
            </div>
            <div class="modal-footer">
                <button class="primary-button" onclick="this.closest('.modal-overlay').remove()">OK</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }, 5000);
}

/**
 * Loads clipboard security settings from localStorage
 */
export function loadClipboardSettings() {
    try {
        const saved = localStorage.getItem('clipboardSecuritySettings');
        if (saved) {
            clipboardSecuritySettings = { ...clipboardSecuritySettings, ...JSON.parse(saved) };
        }
    } catch (error) {
        console.warn('Failed to load clipboard settings:', error);
    }
}

/**
 * Saves clipboard security settings to localStorage
 */
export function saveClipboardSettings() {
    try {
        localStorage.setItem('clipboardSecuritySettings', JSON.stringify(clipboardSecuritySettings));
    } catch (error) {
        console.warn('Failed to save clipboard settings:', error);
    }
}