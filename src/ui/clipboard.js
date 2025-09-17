export function init() {
    // Clipboard Security Functions
    let clipboardSecuritySettings = {
        allowCopy: true,
        neverAllow: false,
        autoCleanTimeout: 10 // seconds
    };
    let clipboardCleanupTimer = null;

    function preventSeedPhraseClipboardAccess(element) {
        if (!element) return;

        // Disable context menu (right-click)
        element.addEventListener('contextmenu', (e) => {
            if (isSeedPhraseField(element)) {
                e.preventDefault();
                showClipboardSecurityWarning('Context menu disabled for security');
            }
        });

        // Disable copy shortcuts
        element.addEventListener('keydown', (e) => {
            if (isSeedPhraseField(element) && (e.ctrlKey || e.metaKey)) {
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

    function isSeedPhraseField(element) {
        return element.id === 'seed-phrase-input' ||
               element.closest('.seed-phrase-input-container') !== null ||
               element.value && containsSeedPhraseWords(element.value);
    }

    function containsSeedPhraseWords(text) {
        if (!text || text.length < 10) return false;

        const words = text.toLowerCase().split(/\s+/);
        if (words.length < 6) return false;

        // Check if most words are from BIP39 wordlist
        const seedPhraseWords = words.filter(word => window.bip39Words.includes(word));
        return seedPhraseWords.length >= Math.min(6, words.length * 0.7);
    }

    function handleSecureCopy(content) {
        if (clipboardSecuritySettings.neverAllow) {
            showClipboardSecurityWarning('Copying is permanently disabled for security');
            return;
        }

        showClipboardWarningDialog(content);
    }

    function showClipboardWarningDialog(content) {
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

    function performSecureCopy(content, autoClean = true) {
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

    function startClipboardCleanupTimer() {
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

    function clearClipboard() {
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

    function showClipboardSecurityWarning(message) {
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

    function loadClipboardSettings() {
        try {
            const saved = localStorage.getItem('clipboardSecuritySettings');
            if (saved) {
                clipboardSecuritySettings = { ...clipboardSecuritySettings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Failed to load clipboard settings:', error);
        }
    }

    function saveClipboardSettings() {
        try {
            localStorage.setItem('clipboardSecuritySettings', JSON.stringify(clipboardSecuritySettings));
        } catch (error) {
            console.warn('Failed to save clipboard settings:', error);
        }
    }

    // Initialize event listeners for clipboard protection
    const seedPhraseInputElement = document.getElementById('seed-phrase-input');
    if (seedPhraseInputElement) {
        preventSeedPhraseClipboardAccess(seedPhraseInputElement);

        // Add physical keyboard warning for seed phrase input
        seedPhraseInputElement.addEventListener('keydown', function(e) {
            // Show warning when physical keyboard is used for seed phrase input
            if (!e.isTrusted) return; // Only for real user events

            // Show warning modal for physical keyboard usage
            showPhysicalKeyboardWarning();
        }, { once: true }); // Only show once per session
    }

    // Setup clipboard event listeners - moved to DOMContentLoaded handler in main.js
// This prevents duplicate initialization
// All clipboard setup is now handled by main.js's DOMContentLoaded handler

    // Return public methods
    return {
        preventSeedPhraseClipboardAccess,
        handleSecureCopy,
        showClipboardSecurityWarning,
        loadClipboardSettings,
        saveClipboardSettings
    };
}

// Physical Keyboard Warning Function
function showPhysicalKeyboardWarning() {
    // Check if user has disabled this warning
    const hasDisabledWarning = localStorage.getItem('disable_keyboard_warning') === 'true';
    if (hasDisabledWarning) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>⚠️ Physical Keyboard Security Warning</h3>
                <button class="close-btn" id="close-keyboard-warning">×</button>
            </div>
            <div class="modal-body">
                <p><strong>You are using a physical keyboard to input seed phrase words.</strong></p>
                <p>For maximum security, consider using the virtual keyboard to prevent potential keyloggers from capturing your seed phrase.</p>
                <div class="security-reminder" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Security Recommendations:</strong></p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Ensure your computer is free from malware</li>
                        <li>Use the virtual keyboard (⌨️ button) for maximum security</li>
                        <li>Check for any suspicious software or hardware keyloggers</li>
                        <li>Consider using an air-gapped computer for seed phrase operations</li>
                    </ul>
                </div>
                <div style="margin-top: 20px;">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="dont-show-keyboard-warning">
                        <span>Don't show this warning again</span>
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-button" id="continue-physical-keyboard">Continue with Physical Keyboard</button>
                <button class="primary-button" id="use-virtual-keyboard">⌨️ Use Virtual Keyboard</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Set up event listeners for all buttons
    const dontShowCheckbox = modal.querySelector('#dont-show-keyboard-warning');
    const closeBtn = modal.querySelector('#close-keyboard-warning');
    const continueBtn = modal.querySelector('#continue-physical-keyboard');
    const virtualKeyboardBtn = modal.querySelector('#use-virtual-keyboard');

    // Function to handle modal closing
    const closeModal = () => {
        if (dontShowCheckbox && dontShowCheckbox.checked) {
            localStorage.setItem('disable_keyboard_warning', 'true');
        }
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    };

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Continue with physical keyboard
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            closeModal();
            // Focus back to the seed phrase input
            const seedPhraseInput = document.getElementById('seed-phrase-input');
            if (seedPhraseInput) {
                seedPhraseInput.focus();
            }
        });
    }

    // Use virtual keyboard button
    if (virtualKeyboardBtn) {
        virtualKeyboardBtn.addEventListener('click', () => {
            closeModal();
            // Directly open the virtual keyboard for seed phrase input
            console.log('Opening virtual keyboard for Seed Phrase input');
            setTimeout(() => {
                const keyboardInit = window.keyboardInit;
                if (keyboardInit && keyboardInit.openVirtualKeyboard) {
                    keyboardInit.openVirtualKeyboard('seed-phrase-input', false);
                }
            }, 100); // Small delay to ensure modal is fully closed
        });
    }
}

// Global reference to initialize later
window.physicalKeyboardWarning = showPhysicalKeyboardWarning;
