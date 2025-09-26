// Seed Phrase Shield - Enhanced with Auto-completion
console.log('🚀 Seed Phrase Shield loaded - Debug mode enabled');
console.log('📝 Current URL:', window.location.href);
console.log('🧭 User Agent:', navigator.userAgent);

// Debug function to log DOM state
function debugDOMState() {
    console.log('🔍 DOM Debug Info:');
    console.log('  - Document ready state:', document.readyState);
    console.log('  - Body exists:', !!document.body);
    console.log('  - Seed phrase input exists:', !!document.getElementById('seed-phrase-input'));
    console.log('  - Virtual keyboard modal exists:', !!document.getElementById('virtual-keyboard-modal'));
    console.log('  - Keyboard buttons found:', document.querySelectorAll('.keyboard-btn').length);
}

// Log initial state
debugDOMState();

// Message display function - declared early for use in initialization
function showMessage(message, type = 'info') {
    console.log(`Message (${type}):`, message);

    // Create or update message display
    let messageDiv = document.getElementById('app-message');
    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'app-message';
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            max-width: 300px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(messageDiv);
    }

    messageDiv.textContent = message;

    // Style based on type
    switch (type) {
        case 'success':
            messageDiv.style.backgroundColor = '#d4edda';
            messageDiv.style.color = '#155724';
            messageDiv.style.border = '1px solid #c3e6cb';
            break;
        case 'error':
            messageDiv.style.backgroundColor = '#f8d7da';
            messageDiv.style.color = '#721c24';
            messageDiv.style.border = '1px solid #f5c6cb';
            break;
        case 'info':
        default:
            messageDiv.style.backgroundColor = '#d1ecf1';
            messageDiv.style.color = '#0c5460';
            messageDiv.style.border = '1px solid #bee5eb';
    }

    // Auto-hide after 4 seconds
    setTimeout(() => {
        if (messageDiv && messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 4000);
}

// Import clipboard utilities
import { initializeClipboardUtils, preventSeedPhraseClipboardAccess, loadClipboardSettings, saveClipboardSettings } from './utils/clipboard.js';

// Import validation utilities
import { validateSeedPhrase, formatSeedPhrase } from './utils/validation.js';

// Global variables
let tauriAPI = {};
let currentTab = 'encrypt';
let isOfflineMode = false;
let clipboardSecuritySettings = {
    allowCopy: true,
    neverAllow: false,
    autoCleanTimeout: 10 // seconds
};
let clipboardCleanupTimer = null;
let appInitialized = false; // Flag to prevent duplicate initialization

// BIP39 word list cache
let bip39Words = [];

// Load BIP39 word list from JSON file using fetch
fetch('./bip39-words.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(words => {
        bip39Words = words;
        window.bip39Words = bip39Words; // Make it globally available
        console.log(`Loaded ${bip39Words.length} BIP39 words`);
    })
    .catch(error => {
        console.error('Failed to load BIP39 word list:', error);
        bip39Words = []; // Fallback to empty array
    });

// Wait for Tauri to be ready before initializing
async function waitForTauri() {
    console.log('Waiting for Tauri to be ready...');

    // Poll for Tauri API until available
    const checkInterval = setInterval(() => {
        if (window.__TAURI__) {
            console.log('Tauri API detected!');
            clearInterval(checkInterval);
            initializeApp();
        }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('Tauri API still not available after 10 seconds - continuing anyway');
        initializeApp();
    }, 10000);
}

// Initialize the application once Tauri is ready
function initializeApp() {
    // Prevent duplicate initialization
    if (appInitialized) {
        console.log('App already initialized, skipping...');
        return;
    }
    
    console.log('Initializing application...');
    appInitialized = true;

    // Initialize Tauri APIs
    initializeTauri();

    // Check network status immediately on startup
    checkNetworkStatusOnStartup();

    // Setup event listeners
    setupEventListeners();

    // Initialize form validation
    validateForms();

    // Initialize security reminders
    initializeSecurityReminders();

    console.log('Application initialized');
}

// Import and initialize UI modules
import { init as initKeyboard } from './ui/keyboard.js';
console.log('🛠️ Keyboard module imported successfully');
console.log('🛠️ initKeyboard type:', typeof initKeyboard);

// Wait for DOM to be fully loaded before initializing UI modules
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎆 DOM Content Loaded - initializing UI modules');
    console.log('🎆 Document ready state:', document.readyState);
    console.log('🎆 initKeyboard function available:', typeof initKeyboard);
    debugDOMState();
    
    try {
        console.log('🎹 About to call initKeyboard()...');
        const keyboardResult = initKeyboard();
        console.log('🎹 initKeyboard() returned:', keyboardResult);
        window.keyboardInit = keyboardResult;
        console.log('✅ Keyboard module initialized:', !!window.keyboardInit);
        
        console.log('📎 About to call initializeClipboardUtils...');
        initializeClipboardUtils(showMessage, clipboardSecuritySettings);
        console.log('✅ Clipboard utilities initialized');
        
        console.log('🎉 UI modules initialization completed successfully');
        
        // Test if window.keyboardInit has the expected methods
        if (window.keyboardInit) {
            console.log('🔍 keyboardInit methods:', Object.keys(window.keyboardInit));
        }
        
    } catch (error) {
        console.error('❌ UI module initialization failed:', error);
        console.error('Stack trace:', error.stack);
    }
});

// Start waiting for Tauri
waitForTauri();

function initializeTauri() {
    console.log('Initializing Tauri APIs...');

    if (window.__TAURI__) {
        console.log('Tauri available');

        // Core API
        if (window.__TAURI__.core) {
            tauriAPI.invoke = window.__TAURI__.core.invoke;
            console.log('✅ Core API loaded');
        }

        // Dialog API
        if (window.__TAURI__.dialog) {
            tauriAPI.save = window.__TAURI__.dialog.save;
            tauriAPI.open = window.__TAURI__.dialog.open;
            console.log('✅ Dialog API loaded');
        }

        // File System API
        if (window.__TAURI__.fs) {
            tauriAPI.writeTextFile = window.__TAURI__.fs.writeTextFile;
            tauriAPI.readTextFile = window.__TAURI__.fs.readTextFile;
            console.log('✅ FS API loaded');
        }
    } else {
        console.error('❌ Tauri not available');
    }
}

async function checkNetworkStatusOnStartup() {
    console.log('Checking network status on startup...');

    if (!tauriAPI.invoke) {
        console.log('Tauri API not available, skipping network check');
        return;
    }

    try {
        const status = await tauriAPI.invoke('check_network_status');
        if (status.is_connected) {
            console.log('Network connection detected on startup');
            showNetworkWarningWithOfflineOption();
        } else {
            console.log('No network connection detected - safe to proceed');
            enableOfflineMode();
        }
    } catch (error) {
        console.error('Failed to check network status:', error);
        // Assume offline if check fails
        enableOfflineMode();
    }
}

function showNetworkWarningWithOfflineOption() {
    const networkWarning = document.getElementById('network-warning');
    if (networkWarning) {
        // Simplified network warning without offline mode button
        const warningContent = networkWarning.querySelector('.warning-content');
        warningContent.innerHTML = `
            <span class="warning-icon">⚠️</span>
            <div class="warning-text">
                <strong>Network Connection Detected</strong>
                <p>For maximum security, please disconnect from the internet before performing encryption/decryption operations.</p>
            </div>
            <button id="dismiss-warning" class="warning-dismiss">×</button>
        `;
        networkWarning.classList.remove('hidden');

        // Setup dismiss button
        const dismissBtn = document.getElementById('dismiss-warning');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', dismissNetworkWarning);
        }
    }
}

function enableOfflineMode() {
    isOfflineMode = true;

    // Initialize clipboard utilities with showMessage function
    initializeClipboardUtils(showMessage, clipboardSecuritySettings);

    console.log('Offline mode enabled');
}

// Clipboard settings functions - Now imported from utils/clipboard.js

function showNetworkWarning() {
    showNetworkWarningWithOfflineOption();
}

function dismissNetworkWarning() {
    const networkWarning = document.getElementById('network-warning');
    if (networkWarning) {
        networkWarning.classList.add('hidden');
    }
}

// Placeholder function for wallet label dialog
function openWalletLabelDialog() {
    showMessage('Wallet label feature coming soon!', 'info');
}

// Clipboard Security Functions - Now imported from utils/clipboard.js

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
                if (window.keyboardInit && window.keyboardInit.openVirtualKeyboard) {
                    window.keyboardInit.openVirtualKeyboard('seed-phrase-input', false);
                }
            }, 100); // Small delay to ensure modal is fully closed
        });
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners...');

    // Network warning dismiss
    const dismissWarning = document.getElementById('dismiss-warning');
    if (dismissWarning) {
        dismissWarning.addEventListener('click', dismissNetworkWarning);
    }

    // Setup clipboard protection for seed phrase fields
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
    
    // Tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            console.log('Tab clicked:', tab);
            switchTab(tab);
        });
    });
    
    // Generate passphrase button
    const generateBtn = document.getElementById('generate-passphrase-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generatePassphrase);
    }
    
    // Encrypt button
    const encryptBtn = document.getElementById('encrypt-btn');
    if (encryptBtn) {
        encryptBtn.addEventListener('click', performEncryption);
    }
    
    // Encrypt with wallet label button
    const encryptWithWalletBtn = document.getElementById('encrypt-with-wallet-btn');
    if (encryptWithWalletBtn) {
        encryptWithWalletBtn.addEventListener('click', openWalletLabelDialog);
    }
    
    // Decrypt button
    const decryptBtn = document.getElementById('decrypt-btn');
    if (decryptBtn) {
        decryptBtn.addEventListener('click', performDecryption);
    }
    
    // Save encrypted button
    const saveBtn = document.getElementById('save-encrypted-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveEncryptedFile);
    }
    
    // Load encrypted button
    const loadBtn = document.getElementById('load-encrypted-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadEncryptedFile);
    }
    
    // File info button
    const fileInfoBtn = document.getElementById('show-file-info-btn');
    if (fileInfoBtn) {
        fileInfoBtn.addEventListener('click', showFileInfo);
    }
    
    // Input validation setup
    const inputs = [
        'seed-phrase-input',
        'encrypt-passphrase1',
        'encrypt-passphrase2', 
        'encrypt-password1',
        'encrypt-password2',
        'decrypt-content',
        'decrypt-passphrase',
        'decrypt-password'
    ];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', validateForms);
            
            // Special handling for seed phrase input
            if (id === 'seed-phrase-input') {
                element.addEventListener('input', () => validateSeedPhrase());
                element.addEventListener('blur', () => validateSeedPhrase());
                
                // Enable format button when seed phrase input has content
                element.addEventListener('input', function() {
                    const formatBtn = document.getElementById('format-seed-phrase-btn');
                    if (formatBtn) {
                        formatBtn.disabled = !this.value.trim();
                    }
                });
            }
        }
    });
    
    // Format seed phrase button
    const formatBtn = document.getElementById('format-seed-phrase-btn');
    if (formatBtn) {
        formatBtn.addEventListener('click', () => {
            const seedPhraseInput = document.getElementById('seed-phrase-input');
            if (seedPhraseInput && seedPhraseInput.value.trim()) {
                const originalValue = seedPhraseInput.value;
                const formattedValue = formatSeedPhrase(originalValue);
                
                if (formattedValue !== originalValue) {
                    seedPhraseInput.value = formattedValue;
                    // Trigger validation after formatting
                    validateSeedPhrase();
                    // Show feedback that formatting was applied
                    showMessage('Seed phrase formatted successfully', 'success');
                } else {
                    showMessage('Seed phrase is already properly formatted', 'info');
                }
            }
        });
    }

    // Auto-copy seed phrase to main content
    const seedPhraseInput = document.getElementById('seed-phrase-input');
    if (seedPhraseInput) {
        seedPhraseInput.addEventListener('input', autoCopySeedPhrase);
    }
    
    console.log('Event listeners setup complete');
}

// Placeholder function for auto-copying seed phrase (feature not yet implemented)
function autoCopySeedPhrase() {
    console.log('Auto-copy seed phrase feature - placeholder function');
    // This function would typically copy seed phrase input to main content area
    // For now, it's a placeholder until the full feature is implemented
}

function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    validateForms();
}

function validateForms() {
    if (currentTab === 'encrypt') {
        validateEncryptForm();
    } else {
        validateDecryptForm();
    }
}

function validateEncryptForm() {
    const seedPhrase = getValue('seed-phrase-input');
    const passphrase1 = getValue('encrypt-passphrase1');
    const passphrase2 = getValue('encrypt-passphrase2');
    // Password is now optional, so we don't require it for form validation
    const password1 = getValue('encrypt-password1');
    const password2 = getValue('encrypt-password2');
    
    // Collect validation messages
    const validationMessages = [];
    
    // Passphrase validation (required)
    const isPassphraseValid = passphrase1 && passphrase1 === passphrase2;
    if (passphrase1 && passphrase2 && !isPassphraseValid) {
        validationMessages.push('⚠️ Passphrases do not match');
    }
    
    // Password validation (optional) - if provided, both fields must match
    const isPasswordValid = !password1 || (password1 && password1 === password2);
    if (password1 && password2 && !isPasswordValid) {
        validationMessages.push('⚠️ Passwords do not match');
    }
    
    const isValid = seedPhrase && isPassphraseValid && isPasswordValid;
    
    // Update validation display
    updateValidationDisplay('encrypt-validation', validationMessages);
    
    const encryptBtn = document.getElementById('encrypt-btn');
    const encryptWithWalletBtn = document.getElementById('encrypt-with-wallet-btn');
    if (encryptBtn) encryptBtn.disabled = !isValid;
    if (encryptWithWalletBtn) encryptWithWalletBtn.disabled = !isValid;
    
    // Reset save button if form is being modified
    const saveBtn = document.getElementById('save-encrypted-btn');
    const resultArea = getValue('encrypt-result');
    if (saveBtn && !resultArea) {
        saveBtn.innerHTML = '💾 Save to File';
        saveBtn.title = 'Save encrypted content to file';
        saveBtn.disabled = true;
    }
    
    console.log('Encrypt form validation:', isValid);
}

function validateDecryptForm() {
    const content = getValue('decrypt-content');
    const passphrase = getValue('decrypt-passphrase');
    // Password is now optional, so we don't require it for form validation
    const password = getValue('decrypt-password');
    
    // Only content and passphrase are required
    const isValid = content && passphrase;
    
    // Clear validation messages for decrypt form (no mismatch validation needed)
    updateValidationDisplay('decrypt-validation', []);
    
    const decryptBtn = document.getElementById('decrypt-btn');
    if (decryptBtn) {
        decryptBtn.disabled = !isValid;
    }
    
    console.log('Decrypt form validation:', isValid);
}

function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : '';
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
    }
}

function setStatus(id, message, type = 'info') {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = message;
        element.className = `status-label status-${type}`;
    }
}

function updateValidationDisplay(validationBoxId, messages) {
    const validationBox = document.getElementById(validationBoxId);
    if (!validationBox) return;
    
    if (messages.length === 0) {
        validationBox.classList.add('hidden');
        validationBox.innerHTML = '';
    } else {
        validationBox.classList.remove('hidden');
        validationBox.innerHTML = messages.map(msg => 
            `<div class="validation-error">${msg}</div>`
        ).join('');
    }
}

async function generatePassphrase() {
    console.log('Generating passphrase...');
    
    if (!tauriAPI.invoke) {
        showMessage('Tauri API not available', 'error');
        return;
    }
    
    try {
        showMessage('Generating passphrase...', 'info');
        
        const passphrase = await tauriAPI.invoke('generate_passphrase', { wordCount: 6 });
        console.log('Generated passphrase');
        
        setValue('encrypt-passphrase1', passphrase);
        setValue('encrypt-passphrase2', passphrase);
        
        validateForms();
        showMessage('Passphrase generated successfully', 'success');
        
    } catch (error) {
        console.error('Failed to generate passphrase:', error);
        showMessage(`Failed to generate passphrase: ${error}`, 'error');
    }
}

async function performEncryption() {
    console.log('Performing encryption...');
    
    if (!tauriAPI.invoke) {
        showMessage('Tauri API not available', 'error');
        return;
    }
    
    const seedPhrase = getValue('seed-phrase-input');
    const passphrase = getValue('encrypt-passphrase1');
    const password = getValue('encrypt-password1') || ''; // Use empty string if not provided
    
    if (!seedPhrase || !passphrase) {
        showMessage('Please fill all required fields', 'error');
        return;
    }
    
    try {
        const encryptBtn = document.getElementById('encrypt-btn');
        if (encryptBtn) {
            encryptBtn.disabled = true;
            encryptBtn.textContent = '🔄 Encrypting...';
        }
        
        setStatus('encrypt-status', 'Encrypting seed phrase...', 'info');
        
        // Check if advanced crypto is enabled
        const isAdvanced = document.getElementById('enable-advanced-crypto')?.checked || false;
        let encrypted;
        
        if (isAdvanced) {
            // Use advanced crypto with integrity verification
            const keyDerivationMethod = document.getElementById('key-derivation-method')?.value || 'pbkdf2';
            const iterations = 100000; // Use default value
            
            encrypted = await tauriAPI.invoke('encrypt_with_advanced_crypto', {
                request: {
                    content: seedPhrase,
                    passphrase: passphrase,
                    password: password,
                    key_derivation_method: keyDerivationMethod,
                    iterations: iterations
                }
            });
            
            setValue('encrypt-result', encrypted.encrypted_content);
            
            // Show integrity info to user
            showIntegrityInfo(encrypted.integrity_info);
        } else {
            // Use standard encryption
            encrypted = await tauriAPI.invoke('encrypt_seed_phrase', {
                seedPhrase: seedPhrase,
                passphrase: passphrase,
                password: password
            });
            
            setValue('encrypt-result', encrypted);
        }
        
        const saveBtn = document.getElementById('save-encrypted-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            // Reset button text for regular encryption
            saveBtn.innerHTML = '💾 Save to File';
            saveBtn.title = 'Save encrypted content to file';
        }
        
        setStatus('encrypt-status', 'Encryption completed successfully', 'success');
        showMessage('Seed phrase encrypted successfully!', 'success');
        
        // Show post-encryption security reminder
        setTimeout(() => showPostEncryptionReminder(), 1000);
        
    } catch (error) {
        console.error('Encryption failed:', error);
        setValue('encrypt-result', '');
        setStatus('encrypt-status', 'Encryption failed', 'error');
        showMessage(`Encryption failed: ${error}`, 'error');
    } finally {
        const encryptBtn = document.getElementById('encrypt-btn');
        if (encryptBtn) {
            encryptBtn.disabled = false;
            encryptBtn.textContent = '🔒 Encrypt Seed Phrase';
        }
    }
}

async function performDecryption() {
    console.log('Performing decryption...');
    
    if (!tauriAPI.invoke) {
        showMessage('Tauri API not available', 'error');
        return;
    }
    
    const encryptedContent = getValue('decrypt-content');
    const passphrase = getValue('decrypt-passphrase');
    const password = getValue('decrypt-password') || ''; // Use empty string if not provided
    
    if (!encryptedContent || !passphrase) {
        showMessage('Please fill all required fields', 'error');
        return;
    }
    
    try {
        const decryptBtn = document.getElementById('decrypt-btn');
        if (decryptBtn) {
            decryptBtn.disabled = true;
            decryptBtn.textContent = '🔄 Decrypting...';
        }
        
        setStatus('decrypt-status', 'Decrypting content...', 'info');
        
        // Detect if this is advanced format by checking for the magic header
        let isAdvancedFormat = false;
        try {
            // Try to decode base64 and check for magic header
            const data = atob(encryptedContent);
            if (data.length >= 8 && data.substring(0, 8) === 'AESADV01') {
                isAdvancedFormat = true;
                console.log('Advanced crypto format detected');
            }
        } catch (error) {
            console.log('Standard format detected (base64 decode failed or no magic header)');
        }
        
        let decrypted;
        if (isAdvancedFormat) {
            // Use advanced crypto decryption
            decrypted = await tauriAPI.invoke('decrypt_with_advanced_crypto', {
                request: {
                    encrypted_content: encryptedContent,
                    passphrase: passphrase,
                    password: password
                }
            });
        } else {
            // Use standard decryption
            decrypted = await tauriAPI.invoke('decrypt_content', {
                request: {
                    encrypted_content: encryptedContent,
                    passphrase: passphrase,
                    password: password
                }
            });
        }
        
        setValue('decrypt-result', decrypted);
        setStatus('decrypt-status', 'Decryption completed successfully', 'success');
        showMessage('Content decrypted successfully!', 'success');
        
        // Show post-decryption security reminder
        setTimeout(() => showPostDecryptionReminder(), 1000);
        
    } catch (error) {
        console.error('Decryption failed:', error);
        setValue('decrypt-result', '');
        setStatus('decrypt-status', 'Decryption failed', 'error');
        showMessage(`Decryption failed: ${error}`, 'error');
    } finally {
        const decryptBtn = document.getElementById('decrypt-btn');
        if (decryptBtn) {
            decryptBtn.disabled = false;
            decryptBtn.textContent = '🔓 Decrypt Seed Phrase';
        }
    }
}

async function saveEncryptedFile() {
    console.log('Saving encrypted file...');
    
    const content = getValue('encrypt-result');
    if (!content) {
        showMessage('No encrypted content to save', 'error');
        return;
    }
    
    if (!tauriAPI.save || !tauriAPI.writeTextFile) {
        showMessage('File operations not available', 'error');
        return;
    }
    
    try {
        // Use suggested filename if available, otherwise default filename
        const defaultFilename = window.suggestedFilename || 'encrypted_seed_phrase.bin';
        
        // Get user's home directory and default to Documents folder
        let defaultPath;
        try {
            // For now, we'll construct a reasonable default path
            // In a real implementation, we could add a Tauri command to get the Documents folder
            const platform = navigator.platform.toLowerCase();
            if (platform.includes('win')) {
                defaultPath = `Documents/${defaultFilename}`;
            } else if (platform.includes('mac')) {
                defaultPath = `~/Documents/${defaultFilename}`;
            } else {
                defaultPath = `~/Documents/${defaultFilename}`;
            }
        } catch (error) {
            // Fallback to just the filename if we can't determine platform
            console.warn('Could not determine platform, using filename only:', error);
            defaultPath = defaultFilename;
        }
        
        const filePath = await tauriAPI.save({
            defaultPath: defaultPath,
            filters: [{
                name: 'Encrypted Files',
                extensions: ['bin']
            }, {
                name: 'All Files',
                extensions: ['*']
            }]
        });
        
        if (filePath) {
            await tauriAPI.writeTextFile(filePath, content);
            
            // Show full path in success message
            showMessage(`File saved successfully at: ${filePath}`, 'success');
            
            // Store the filename for future reference
            window.currentLoadedFilename = filePath.split('/').pop() || filePath.split('\\').pop();
            
            // Clear the suggested filename after successful save
            window.suggestedFilename = null;
        }
    } catch (error) {
        console.error('Failed to save file:', error);
        showMessage(`Failed to save file: ${error}`, 'error');
    }
}

async function loadEncryptedFile() {
    console.log('Loading encrypted file...');
    
    if (!tauriAPI.open || !tauriAPI.readTextFile) {
        showMessage('File operations not available', 'error');
        return;
    }
    
    try {
        const filePath = await tauriAPI.open({
            filters: [{
                name: 'Binary Files',
                extensions: ['bin']
            }, {
                name: 'Text Files',
                extensions: ['txt']
            }]
        });
        
        if (filePath) {
            const content = await tauriAPI.readTextFile(filePath);
            setValue('decrypt-content', content);
            
            // Store filename for file info functionality
            window.currentLoadedFilename = filePath.split('/').pop() || filePath.split('\\').pop();
            
            // Enable file info button
            const fileInfoBtn = document.getElementById('show-file-info-btn');
            if (fileInfoBtn) {
                fileInfoBtn.disabled = false;
            }
            
            validateForms();
            showMessage('File loaded successfully', 'success');
        }
    } catch (error) {
        console.error('Failed to load file:', error);
        showMessage(`Failed to load file: ${error}`, 'error');
    }
}

async function showFileInfo() {
    console.log('Showing file information...');
    
    const encryptedContent = getValue('decrypt-content');
    if (!encryptedContent) {
        showMessage('No encrypted content loaded', 'error');
        return;
    }
    
    if (!tauriAPI.invoke) {
        showMessage('Tauri API not available', 'error');
        return;
    }
    
    try {
        // Try to get file integrity info first (for advanced format)
        let fileInfo = null;
        try {
            fileInfo = await tauriAPI.invoke('get_file_integrity_info', {
                encrypted_content: encryptedContent
            });
        } catch (error) {
            console.log('No advanced file info available:', error);
        }
        
        // Parse wallet filename if available
        let walletInfo = null;
        if (window.currentLoadedFilename) {
            try {
                walletInfo = await tauriAPI.invoke('parse_wallet_filename', {
                    filename: window.currentLoadedFilename
                });
            } catch (error) {
                console.log('No wallet info available:', error);
            }
        }
        
        showFileInfoModal(fileInfo, walletInfo, window.currentLoadedFilename);
        
    } catch (error) {
        console.error('Failed to get file information:', error);
        showMessage(`Failed to get file information: ${error}`, 'error');
    }
}

function showFileInfoModal(integrityInfo, walletInfo, filename) {
    // Remove existing modal if any
    const existingModal = document.getElementById('file-info-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'file-info-modal';
    modal.className = 'modal';
    
    const hasIntegrityInfo = integrityInfo && integrityInfo.sha256_hash;
    const hasWalletInfo = walletInfo && walletInfo.is_wallet_file;
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>📄 File Information</h3>
                <button id="close-file-info" class="close-btn">×</button>
            </div>
            <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
                ${filename ? `
                <div class="file-info-section">
                    <h4>📁 File Details</h4>
                    <div class="file-info-grid">
                        <div class="info-item">
                            <div class="info-label">Filename:</div>
                            <div class="info-value">${filename}</div>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                ${hasWalletInfo ? `
                <div class="file-info-section">
                    <h4>🏷️ Wallet Information</h4>
                    <div class="file-info-grid">
                        <div class="info-item">
                            <div class="info-label">Wallet Label:</div>
                            <div class="info-value">${walletInfo.wallet_info.label}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Wallet Type:</div>
                            <div class="info-value">${walletInfo.wallet_info.wallet_type}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Created:</div>
                            <div class="info-value">${new Date(walletInfo.wallet_info.created_at).toLocaleString()}</div>
                        </div>
                        ${walletInfo.wallet_info.seed_phrase_word_count ? `
                        <div class="info-item">
                            <div class="info-label">Seed Phrase Words:</div>
                            <div class="info-value">${walletInfo.wallet_info.seed_phrase_word_count}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                ${hasIntegrityInfo ? `
                <div class="file-info-section">
                    <h4>🔐 Cryptographic Information</h4>
                    <div class="file-info-grid">
                        <div class="info-item">
                            <div class="info-label">Encryption Method:</div>
                            <div class="info-value">${integrityInfo.encryption_method}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Key Derivation:</div>
                            <div class="info-value">${integrityInfo.key_derivation}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">File Size:</div>
                            <div class="info-value">${integrityInfo.file_size} bytes</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Created:</div>
                            <div class="info-value">${new Date(integrityInfo.created_at).toLocaleString()}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">SHA256 Hash:</div>
                            <div class="info-value" style="word-break: break-all; font-size: 0.8em;">${integrityInfo.sha256_hash}</div>
                        </div>
                    </div>
                    <div style="margin-top: 15px; text-align: center;">
                        <button id="export-hash-btn" class="secondary-button">
                            📄 Export Hash Information
                        </button>
                        <button id="verify-integrity-btn" class="primary-button">
                            ✅ Verify File Integrity
                        </button>
                    </div>
                </div>
                ` : `
                <div class="file-info-section">
                    <h4>ℹ️ File Format</h4>
                    <p>This file uses the standard encryption format without advanced integrity verification.</p>
                </div>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    // Setup event listeners
    const closeBtn = document.getElementById('close-file-info');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
    }
    
    // Hash export functionality
    const exportHashBtn = document.getElementById('export-hash-btn');
    if (exportHashBtn && hasIntegrityInfo) {
        exportHashBtn.addEventListener('click', () => exportHashInfo(integrityInfo));
    }
    
    // Integrity verification functionality
    const verifyBtn = document.getElementById('verify-integrity-btn');
    if (verifyBtn && hasIntegrityInfo) {
        verifyBtn.addEventListener('click', () => verifyFileIntegrity());
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function showIntegrityInfo(integrityInfo) {
    console.log('Showing integrity information:', integrityInfo);
    
    const message = `🔐 Advanced Encryption Complete\n\n` +
        `✅ File integrity verification enabled\n` +
        `📊 SHA256 Hash: ${integrityInfo.sha256_hash.substring(0, 16)}...\n` +
        `📁 File Size: ${integrityInfo.file_size} bytes\n` +
        `🔑 Key Derivation: ${integrityInfo.key_derivation}\n` +
        `🛡️ Encryption: ${integrityInfo.encryption_method}`;
    
    setTimeout(() => {
        showMessage(message, 'success', 8000); // Show for 8 seconds
    }, 500);
}

async function exportHashInfo(integrityInfo) {
    console.log('Exporting hash information...');
    
    const encryptedContent = getValue('decrypt-content');
    if (!encryptedContent) {
        showMessage('No encrypted content to export hash for', 'error');
        return;
    }
    
    try {
        const hashInfo = await tauriAPI.invoke('export_integrity_hash', {
            encrypted_content: encryptedContent
        });
        
        // Create and download the hash info as a text file
        const blob = new Blob([hashInfo], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${window.currentLoadedFilename || 'encrypted_file'}_integrity.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('Hash information exported successfully!', 'success');
        
    } catch (error) {
        console.error('Failed to export hash info:', error);
        showMessage(`Failed to export hash info: ${error}`, 'error');
    }
}

async function verifyFileIntegrity() {
    console.log('Verifying file integrity...');
    
    const encryptedContent = getValue('decrypt-content');
    if (!encryptedContent) {
        showMessage('No encrypted content to verify', 'error');
        return;
    }
    
    try {
        const result = await tauriAPI.invoke('verify_file_integrity', {
            encrypted_content: encryptedContent
        });
        
        const icon = result.is_valid ? '✅' : '❌';
        const status = result.is_valid ? 'success' : 'error';
        
        showMessage(`${icon} ${result.message}`, status, 5000);
        
        if (!result.is_valid) {
            console.warn('File integrity verification failed:', {
                expected: result.expected_hash,
                actual: result.actual_hash
            });
        }
        
    } catch (error) {
        console.error('Failed to verify file integrity:', error);
        showMessage(`Failed to verify file integrity: ${error}`, 'error');
    }
}

function getCurrentFilename() {
    // This would be set when a file is loaded
    return window.currentLoadedFilename || null;
}

function displayFileInfo(parseResult) {
    if (!parseResult.is_wallet_file) {
        showMessage('This file does not appear to be a wallet file', 'info');
        return;
    }
    
    const walletInfo = parseResult.wallet_info;
    if (!walletInfo) {
        showMessage('No wallet information found in filename', 'error');
        return;
    }
    
    // Create and show file info modal
    createFileInfoModal(walletInfo);
}

function createFileInfoModal(walletInfo) {
    // Remove existing modal if any
    const existingModal = document.getElementById('file-info-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'file-info-modal';
    modal.className = 'modal';
    
    const walletTypeDisplay = typeof walletInfo.wallet_type === 'object' ? 
        walletInfo.wallet_type.Custom || 'Unknown' : 
        walletInfo.wallet_type;
    
    const wordCountDisplay = walletInfo.seed_phrase_word_count ?
        `${walletInfo.seed_phrase_word_count} words` : 'Unknown';
    
    const createdAt = new Date(walletInfo.created_at).toLocaleString();
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>📄 Wallet File Information</h3>
                <button id="close-file-info" class="close-btn">×</button>
            </div>
            <div class="file-info-content" style="padding: 20px;">
                <div class="info-section">
                    <h4>🏷️ Wallet Details</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Label:</label>
                            <span>${walletInfo.label}</span>
                        </div>
                        <div class="info-item">
                            <label>Type:</label>
                            <span>${walletTypeDisplay}</span>
                        </div>
                        <div class="info-item">
                            <label>Word Count:</label>
                            <span>${wordCountDisplay}</span>
                        </div>
                        <div class="info-item">
                            <label>Created:</label>
                            <span>${createdAt}</span>
                        </div>
                        ${walletInfo.file_path ? `
                        <div class="info-item">
                            <label>File Path:</label>
                            <span>${walletInfo.file_path}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="info-actions" style="margin-top: 20px; text-align: center;">
                    <button id="proceed-decrypt" class="primary-button" style="margin-right: 10px;">
                        🔓 Proceed to Decrypt
                    </button>
                    <button id="close-file-info-btn" class="secondary-button">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('close-file-info').addEventListener('click', () => modal.remove());
    document.getElementById('close-file-info-btn').addEventListener('click', () => modal.remove());
    document.getElementById('proceed-decrypt').addEventListener('click', () => {
        modal.remove();
        // Switch to decrypt tab and focus on passphrase
        switchTab('decrypt');
        const passphraseInput = document.getElementById('decrypt-passphrase');
        if (passphraseInput) {
            passphraseInput.focus();
        }
    });
    
    // Show modal
    modal.classList.remove('hidden');
}

// Security Reminder System
let securityConfig = {
    showFirstTimeGuide: true,
    showPostEncryptionReminder: true,
    showPostDecryptionReminder: true,
    integrateWithNetworkChecks: true
};

async function initializeSecurityReminders() {
    try {
        if (tauriAPI.invoke) {
            const config = await tauriAPI.invoke('get_security_reminder_config');
            securityConfig = { ...securityConfig, ...config };
        }
    } catch (error) {
        console.error('Failed to load security config:', error);
    }

    // Show first-time guide if enabled and not shown before
    const hasSeenGuide = localStorage.getItem('seed_phrase_shield_guide_seen');
    if (securityConfig.showFirstTimeGuide && !hasSeenGuide) {
        setTimeout(() => showFirstTimeSecurityGuide(), 2000);
    }
}

function showFirstTimeSecurityGuide() {
    const modal = document.createElement('div');
    modal.id = 'security-guide-modal';
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>🛡️ Seed Phrase Shield Security Guide</h3>
                <button id="close-security-guide" class="close-btn">×</button>
            </div>
            <div class="security-guide-content" style="padding: 25px;">
                <div class="security-section">
                    <h4>⚠️ Critical Security Reminders</h4>
                    <ul style="line-height: 1.8; margin: 15px 0;">
                        <li><strong>Network Isolation:</strong> Always disconnect from the internet when handling Seed Phrases</li>
                        <li><strong>Private Environment:</strong> Ensure no one can see your screen or shoulder-surf</li>
                        <li><strong>Secure Storage:</strong> Never store seed phrase in plain text files or cloud storage</li>
                        <li><strong>Backup Verification:</strong> Always verify encrypted backups before deleting originals</li>
                        <li><strong>Clean Environment:</strong> Clear screen and memory after operations</li>
                    </ul>
                </div>

                <div class="security-section" style="margin-top: 20px;">
                    <h4>🔒 Best Practices</h4>
                    <ul style="line-height: 1.8; margin: 15px 0;">
                        <li>Use strong, unique passphrases from the EFF wordlist</li>
                        <li>Test decryption immediately after encryption</li>
                        <li>Store encrypted files and passphrases separately</li>
                        <li>Consider using air-gapped computers for maximum security</li>
                        <li>Keep multiple encrypted backups in different locations</li>
                    </ul>
                </div>

                <div class="security-actions" style="margin-top: 25px; text-align: center;">
                    <label style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                        <input type="checkbox" id="dont-show-guide" style="margin-right: 8px;">
                        Don't show this guide again
                    </label>
                    <button id="understood-security" class="primary-button">
                        ✅ I Understand - Continue
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('close-security-guide').addEventListener('click', () => modal.remove());
    document.getElementById('understood-security').addEventListener('click', () => {
        const dontShow = document.getElementById('dont-show-guide').checked;
        if (dontShow) {
            localStorage.setItem('seed_phrase_guide_seen', 'true');
        }
        modal.remove();
    });

    modal.classList.remove('hidden');
}

function showPostEncryptionReminder(walletInfo = null) {
    if (!securityConfig.showPostEncryptionReminder) return;

    const modal = document.createElement('div');
    modal.id = 'post-encryption-reminder';
    modal.className = 'modal';

    const walletText = walletInfo ?
        `<p><strong>Wallet:</strong> ${walletInfo.label} (${walletInfo.wallet_type})</p>` : '';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>✅ Encryption Complete</h3>
                <button id="close-post-encryption" class="close-btn">×</button>
            </div>
            <div class="reminder-content" style="padding: 20px;">
                <div class="success-message" style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 3em; margin-bottom: 10px;">🎉</div>
                    <h4>Your Seed Phrase has been encrypted successfully!</h4>
                    ${walletText}
                </div>

                <div class="security-checklist">
                    <h4>🔐 Important Next Steps:</h4>
                    <div class="checklist" style="margin: 15px 0;">
                        <label style="display: block; margin: 8px 0;">
                            <input type="checkbox" style="margin-right: 8px;">
                            Save the encrypted file to secure storage
                        </label>
                        <label style="display: block; margin: 8px 0;">
                            <input type="checkbox" style="margin-right: 8px;">
                            Test decryption before deleting original
                        </label>
                        <label style="display: block; margin: 8px 0;">
                            <input type="checkbox" style="margin-right: 8px;">
                            Store passphrase separately and securely
                        </label>
                        <label style="display: block; margin: 8px 0;">
                            <input type="checkbox" style="margin-right: 8px;">
                            Create backup copies in different locations
                        </label>
                        <label style="display: block; margin: 8px 0;">
                            <input type="checkbox" style="margin-right: 8px;">
                            Clear screen and restart browser when done
                        </label>
                    </div>
                </div>

                <div class="reminder-actions" style="text-align: center; margin-top: 20px;">
                    <button id="got-it-encryption" class="primary-button">
                        👍 Got It!
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('close-post-encryption').addEventListener('click', () => modal.remove());
    document.getElementById('got-it-encryption').addEventListener('click', () => modal.remove());

    modal.classList.remove('hidden');
}

function showPostDecryptionReminder() {
    if (!securityConfig.showPostDecryptionReminder) return;

    const reminder = document.createElement('div');
    reminder.id = 'post-decryption-reminder';
    reminder.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        max-width: 400px;
        background: #fff;
        border: 2px solid #e74c3c;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(231, 76, 60, 0.3);
        z-index: 9999;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    reminder.innerHTML = `
        <div style="background: #e74c3c; color: white; padding: 12px 15px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: 16px; font-weight: 600;">🔓 Decryption Complete</h4>
            <button id="close-post-decryption" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 24px; height: 24px;">×</button>
        </div>
        <div style="padding: 15px;">
            <div style="text-align: center; margin-bottom: 15px; color: #e74c3c;">
                <div style="font-size: 2em; margin-bottom: 8px;">⚠️</div>
                <h4 style="margin: 0 0 5px 0; color: #e74c3c;">Your Seed Phrase is now visible!</h4>
                <p style="margin: 0; font-size: 14px; color: #666;">Take immediate security precautions</p>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 8px 12px; margin: 8px 0; font-size: 13px;">
                    <strong>👀 Screen Privacy:</strong> Ensure no one can see your screen
                </div>
                <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 8px 12px; margin: 8px 0; font-size: 13px;">
                    <strong>📝 Copy Safely:</strong> Copy seed phrase to secure storage only
                </div>
                <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 8px 12px; margin: 8px 0; font-size: 13px;">
                    <strong>🧹 Clear After Use:</strong> Clear result field when done
                </div>
            </div>

            <div style="text-align: center;">
                <button id="clear-screen-now" style="background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; margin-right: 8px; font-size: 13px;">
                    🧹 Clear Screen Now
                </button>
                <button id="got-it-decryption" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 13px;">
                    I'll Handle It
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(reminder);

    // Event listeners
    document.getElementById('close-post-decryption').addEventListener('click', () => reminder.remove());
    document.getElementById('got-it-decryption').addEventListener('click', () => reminder.remove());
    document.getElementById('clear-screen-now').addEventListener('click', () => {
        // Clear the decryption result
        setValue('decrypt-result', '');
        showMessage('Screen cleared for security', 'success');
        reminder.remove();
    });

    // Auto-hide after 30 seconds if user doesn't interact
    setTimeout(() => {
        if (reminder && reminder.parentNode) {
            reminder.remove();
        }
    }, 30000);
}

// Function to update main Save To File button with suggested filename
function updateMainSaveButton(suggestedFilename) {
    if (!suggestedFilename) return;

    // Store the suggested filename globally
    window.suggestedFilename = suggestedFilename;

    // Update the Save To File button text to show the suggested filename
    const saveBtn = document.getElementById('save-encrypted-btn');
    if (saveBtn) {
        const shortFilename = suggestedFilename.length > 25 ?
            suggestedFilename.substring(0, 22) + '...' :
            suggestedFilename;
        saveBtn.innerHTML = `💾 Save: ${shortFilename}`;
        saveBtn.title = `Save as: ${suggestedFilename}`; // Full filename in tooltip
    }
}

console.log('Enhanced main.js loaded successfully');