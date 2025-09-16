// Seed Phrase Shield - Enhanced with Auto-completion
console.log('Seed Phrase Shield loaded');

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
let virtualKeyboard = {
    isOpen: false,
    targetInput: null,
    isPasswordMode: false,
    inputText: '',
    shiftPressed: false,
    capsLock: false,
    currentWord: '',
    suggestions: [],
    suggestionIndex: -1
};

// BIP39 word list cache
let bip39Words = [];

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Initialize Tauri APIs
    initializeTauri();
    
    // Check network status immediately on startup
    checkNetworkStatusOnStartup();
    
    // Load BIP39 word list
    loadBIP39WordList();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize form validation
    validateForms();
    
    // Initialize security reminders
    initializeSecurityReminders();
    
    console.log('Application initialized');
});

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
    
    // Load clipboard settings
    loadClipboardSettings();
    
    console.log('Offline mode enabled');
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

function showNetworkWarning() {
    showNetworkWarningWithOfflineOption();
}

function dismissNetworkWarning() {
    const networkWarning = document.getElementById('network-warning');
    if (networkWarning) {
        networkWarning.classList.add('hidden');
    }
}

// Clipboard Security Functions
function preventMnemonicClipboardAccess(element) {
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

function isMnemonicField(element) {
    return element.id === 'btc-mnemonic-input' || 
           element.closest('.mnemonic-input-container') !== null ||
           element.value && containsMnemonicWords(element.value);
}

function containsMnemonicWords(text) {
    if (!text || text.length < 10) return false;
    
    const words = text.toLowerCase().split(/\s+/);
    if (words.length < 6) return false;
    
    // Check if most words are from BIP39 wordlist
    const mnemonicWords = words.filter(word => bip39Words.includes(word));
    return mnemonicWords.length >= Math.min(6, words.length * 0.7);
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
            // Focus back to the mnemonic input
            const mnemonicInput = document.getElementById('btc-mnemonic-input');
            if (mnemonicInput) {
                mnemonicInput.focus();
            }
        });
    }
    
    // Use virtual keyboard button
    if (virtualKeyboardBtn) {
        virtualKeyboardBtn.addEventListener('click', () => {
            closeModal();
            // Directly open the virtual keyboard for mnemonic input
            console.log('Opening virtual keyboard for Seed Phrase input');
            setTimeout(() => {
                openVirtualKeyboard('btc-mnemonic-input', false);
            }, 100); // Small delay to ensure modal is fully closed
        });
    }
}

async function loadBIP39WordList() {
    console.log('Loading BIP39 word list...');
    
    // Use a comprehensive BIP39 word list
    bip39Words = [
        'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
        'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
        'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
        'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
        'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
        'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter',
        'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
        'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
        'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arcade', 'arch',
        'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange',
        'arrest', 'arrive', 'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault',
        'asset', 'assist', 'assume', 'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract',
        'auction', 'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid',
        'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon',
        'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner', 'bar', 'barely',
        'bargain', 'barrel', 'base', 'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because',
        'become', 'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench',
        'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind',
        'biology', 'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak',
        'bless', 'blind', 'blood', 'blossom', 'blow', 'blue', 'blur', 'blush', 'board', 'boat',
        'body', 'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow',
        'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave',
        'bread', 'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk', 'broccoli', 'broken',
        'bronze', 'broom', 'brother', 'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build',
        'bulb', 'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business',
        'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake',
        'call', 'calm', 'camera', 'camp', 'can', 'canal', 'cancel', 'candy', 'cannon', 'canoe',
        'canvas', 'canyon', 'capable', 'capital', 'captain', 'car', 'carbon', 'card', 'care', 'career',
        'careful', 'careless', 'cargo', 'carpet', 'carry', 'cart', 'case', 'cash', 'casino', 'cast',
        'casual', 'cat', 'catalog', 'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave',
        'ceiling', 'celery', 'cement', 'census', 'century', 'cereal', 'certain', 'chair', 'chalk', 'champion',
        'change', 'chaos', 'chapter', 'charge', 'chase', 'chat', 'cheap', 'check', 'cheese', 'chef',
        'cherry', 'chest', 'chicken', 'chief', 'child', 'chimney', 'choice', 'choose', 'chronic', 'chuckle',
        'chunk', 'churn', 'cigar', 'cinnamon', 'circle', 'citizen', 'city', 'civil', 'claim', 'clamp',
        'clarify', 'claw', 'clay', 'clean', 'clerk', 'clever', 'click', 'client', 'cliff', 'climb',
        'clinic', 'clip', 'clock', 'clog', 'close', 'cloth', 'cloud', 'clown', 'club', 'clump',
        'cluster', 'clutch', 'coach', 'coast', 'coconut', 'code', 'coffee', 'coil', 'coin', 'collect',
        'color', 'column', 'combine', 'come', 'comfort', 'comic', 'common', 'company', 'concert', 'conduct',
        'confirm', 'congress', 'connect', 'consider', 'control', 'convince', 'cook', 'cool', 'copper', 'copy',
        'coral', 'core', 'corn', 'correct', 'cost', 'cotton', 'couch', 'country', 'couple', 'course',
        'cousin', 'cover', 'coyote', 'crack', 'cradle', 'craft', 'cram', 'crane', 'crash', 'crater',
        'crawl', 'crazy', 'cream', 'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp', 'critic',
        'crop', 'cross', 'crouch', 'crowd', 'crucial', 'cruel', 'cruise', 'crumble', 'crunch', 'crush',
        'cry', 'crystal', 'cube', 'culture', 'cup', 'cupboard', 'curious', 'current', 'curtain', 'curve',
        'cushion', 'custom', 'cute', 'cycle', 'dad', 'damage', 'damp', 'dance', 'danger', 'daring',
        'dash', 'daughter', 'dawn', 'day', 'deal', 'debate', 'debris', 'decade', 'december', 'decide',
        'decline', 'decorate', 'decrease', 'deer', 'defense', 'define', 'defy', 'degree', 'delay', 'deliver',
        'demand', 'demise', 'denial', 'dentist', 'deny', 'depart', 'depend', 'deposit', 'depth', 'deputy',
        'derive', 'describe', 'desert', 'design', 'desk', 'despair', 'destroy', 'detail', 'detect', 'device',
        'devote', 'diagram', 'dial', 'diamond', 'diary', 'dice', 'diesel', 'diet', 'differ', 'digital',
        'dignity', 'dilemma', 'dinner', 'dinosaur', 'direct', 'dirt', 'disagree', 'discover', 'disease', 'dish',
        'dismiss', 'disorder', 'display', 'distance', 'divert', 'divide', 'divorce', 'dizzy', 'doctor', 'document',
        'dog', 'doll', 'dolphin', 'domain', 'donate', 'donkey', 'donor', 'door', 'dose', 'double',
        'dove', 'draft', 'dragon', 'drama', 'drape', 'draw', 'dream', 'dress', 'drift', 'drill',
        'drink', 'drip', 'drive', 'drop', 'drum', 'dry', 'duck', 'dumb', 'dune', 'during',
        'dust', 'dutch', 'duty', 'dwarf', 'dynamic', 'eager', 'eagle', 'early', 'earn', 'earth',
        'easily', 'east', 'easy', 'echo', 'ecology', 'economy', 'edge', 'edit', 'educate', 'effort',
        'egg', 'eight', 'either', 'elbow', 'elder', 'electric', 'elegant', 'element', 'elephant', 'elevator',
        'elite', 'else', 'embark', 'embody', 'embrace', 'emerge', 'emotion', 'employ', 'empower', 'empty',
        'enable', 'enact', 'end', 'endless', 'endorse', 'enemy', 'energy', 'enforce', 'engage', 'engine',
        'enhance', 'enjoy', 'enlist', 'enough', 'enrich', 'enroll', 'ensure', 'enter', 'entire', 'entry',
        'envelope', 'episode', 'equal', 'equip', 'era', 'erase', 'erode', 'erosion', 'error', 'erupt',
        'escape', 'essay', 'essence', 'estate', 'eternal', 'ethics', 'evidence', 'evil', 'evoke', 'evolve',
        'exact', 'example', 'excess', 'exchange', 'excite', 'exclude', 'excuse', 'execute', 'exercise', 'exhale',
        'exhibit', 'exile', 'exist', 'exit', 'exotic', 'expand', 'expect', 'expire', 'explain', 'expose',
        'express', 'extend', 'extra', 'eye', 'eyebrow', 'fabric', 'face', 'faculty', 'fade', 'faint',
        'faith', 'fall', 'false', 'fame', 'family', 'famous', 'fan', 'fancy', 'fantasy', 'farm',
        'fashion', 'fat', 'fatal', 'father', 'fatigue', 'fault', 'favorite', 'feature', 'february', 'federal',
        'fee', 'feed', 'feel', 'female', 'fence', 'festival', 'fetch', 'fever', 'few', 'fiber',
        'fiction', 'field', 'figure', 'file', 'fill', 'film', 'filter', 'final', 'find', 'fine',
        'finger', 'finish', 'fire', 'firm', 'first', 'fiscal', 'fish', 'fit', 'fitness', 'fix',
        'flag', 'flame', 'flat', 'flavor', 'flee', 'flight', 'flip', 'float', 'flock', 'floor',
        'flower', 'fluid', 'flush', 'fly', 'foam', 'focus', 'fog', 'foil', 'fold', 'follow',
        'food', 'foot', 'force', 'forest', 'forget', 'fork', 'fortune', 'forum', 'forward', 'fossil',
        'foster', 'found', 'fox', 'frame', 'frequent', 'fresh', 'friend', 'fringe', 'frog', 'front',
        'frost', 'frown', 'frozen', 'fruit', 'fuel', 'fun', 'funny', 'furnace', 'fury', 'future',
        'gadget', 'gain', 'galaxy', 'gallery', 'game', 'gap', 'garage', 'garbage', 'garden', 'garlic',
        'garment', 'gas', 'gasp', 'gate', 'gather', 'gauge', 'gaze', 'general', 'genius', 'genre',
        'gentle', 'genuine', 'gesture', 'ghost', 'giant', 'gift', 'giggle', 'ginger', 'giraffe', 'girl',
        'give', 'glad', 'glance', 'glare', 'glass', 'glide', 'glimpse', 'globe', 'gloom', 'glory',
        'glove', 'glow', 'glue', 'goat', 'goddess', 'gold', 'good', 'goose', 'gorilla', 'gospel',
        'gossip', 'govern', 'gown', 'grab', 'grace', 'grain', 'grant', 'grape', 'grass', 'gravity',
        'great', 'green', 'grid', 'grief', 'grit', 'grocery', 'group', 'grow', 'grunt', 'guard',
        'guess', 'guide', 'guilt', 'guitar', 'gun', 'gym', 'habit', 'hair', 'half', 'hammer',
        'hamster', 'hand', 'happy', 'harbor', 'hard', 'harsh', 'harvest', 'hat', 'have', 'hawk',
        'hazard', 'head', 'health', 'heart', 'heavy', 'hedgehog', 'height', 'hello', 'helmet', 'help',
        'hen', 'hero', 'hidden', 'high', 'hill', 'hint', 'hip', 'hire', 'history', 'hobby',
        'hockey', 'hold', 'hole', 'holiday', 'hollow', 'home', 'honey', 'hood', 'hope', 'horn',
        'horror', 'horse', 'hospital', 'host', 'hotel', 'hour', 'hover', 'hub', 'huge', 'human',
        'humble', 'humor', 'hundred', 'hungry', 'hunt', 'hurdle', 'hurry', 'hurt', 'husband', 'hybrid',
        'ice', 'icon', 'idea', 'identify', 'idle', 'ignore', 'ill', 'illegal', 'illness', 'image',
        'imitate', 'immense', 'immune', 'impact', 'impose', 'improve', 'impulse', 'inch', 'include', 'income',
        'increase', 'index', 'indicate', 'indoor', 'industry', 'infant', 'inflict', 'inform', 'inhale', 'inherit',
        'initial', 'inject', 'injury', 'inmate', 'inner', 'innocent', 'input', 'inquiry', 'insane', 'insect',
        'inside', 'inspire', 'install', 'intact', 'interest', 'into', 'invest', 'invite', 'involve', 'iron',
        'island', 'isolate', 'issue', 'item', 'ivory', 'jacket', 'jaguar', 'jar', 'jazz', 'jealous',
        'jeans', 'jelly', 'jewel', 'job', 'join', 'joke', 'journey', 'joy', 'judge', 'juice',
        'jump', 'jungle', 'junior', 'junk', 'just', 'kangaroo', 'keen', 'keep', 'ketchup', 'key',
        'kick', 'kid', 'kidney', 'kind', 'kingdom', 'kiss', 'kit', 'kitchen', 'kite', 'kitten',
        'kiwi', 'knee', 'knife', 'knock', 'know', 'lab', 'label', 'labor', 'ladder', 'lady',
        'lake', 'lamp', 'language', 'laptop', 'large', 'later', 'latin', 'laugh', 'laundry', 'lava',
        'law', 'lawn', 'lawsuit', 'layer', 'lazy', 'leader', 'leaf', 'learn', 'leave', 'lecture',
        'left', 'leg', 'legal', 'legend', 'leisure', 'lemon', 'lend', 'length', 'lens', 'leopard',
        'lesson', 'letter', 'level', 'liar', 'liberty', 'library', 'license', 'life', 'lift', 'light',
        'like', 'limb', 'limit', 'link', 'lion', 'liquid', 'list', 'little', 'live', 'lizard',
        'load', 'loan', 'lobster', 'local', 'lock', 'logic', 'lonely', 'long', 'loop', 'lottery',
        'loud', 'lounge', 'love', 'loyal', 'lucky', 'luggage', 'lumber', 'lunar', 'lunch', 'luxury',
        'lying', 'machine', 'mad', 'magic', 'magnet', 'maid', 'mail', 'main', 'major', 'make',
        'mammal', 'man', 'manage', 'mandate', 'mango', 'mansion', 'manual', 'maple', 'marble', 'march',
        'margin', 'marine', 'market', 'marriage', 'mask', 'mass', 'master', 'match', 'material', 'math',
        'matrix', 'matter', 'maximum', 'maze', 'meadow', 'mean', 'measure', 'meat', 'mechanic', 'medal',
        'media', 'melody', 'melt', 'member', 'memory', 'mention', 'menu', 'mercy', 'merge', 'merit',
        'merry', 'mesh', 'message', 'metal', 'method', 'middle', 'midnight', 'milk', 'million', 'mimic',
        'mind', 'minimum', 'minor', 'minute', 'miracle', 'mirror', 'misery', 'miss', 'mistake', 'mix',
        'mixed', 'mixture', 'mobile', 'model', 'modify', 'mom', 'moment', 'monitor', 'monkey', 'monster',
        'month', 'moon', 'moral', 'more', 'morning', 'mosquito', 'mother', 'motion', 'motor', 'mountain',
        'mouse', 'move', 'movie', 'much', 'muffin', 'mule', 'multiply', 'muscle', 'museum', 'mushroom',
        'music', 'must', 'mutual', 'myself', 'mystery', 'myth', 'naive', 'name', 'napkin', 'narrow',
        'nasty', 'nation', 'nature', 'near', 'neck', 'need', 'negative', 'neglect', 'neither', 'nephew',
        'nerve', 'nest', 'net', 'network', 'neutral', 'never', 'news', 'next', 'nice', 'night',
        'noble', 'noise', 'nominee', 'noodle', 'normal', 'north', 'nose', 'notable', 'note', 'nothing',
        'notice', 'novel', 'now', 'nuclear', 'number', 'nurse', 'nut', 'oak', 'obey', 'object',
        'oblige', 'obscure', 'observe', 'obtain', 'obvious', 'occur', 'ocean', 'october', 'odor', 'off',
        'offer', 'office', 'often', 'oil', 'okay', 'old', 'olive', 'olympic', 'omit', 'once',
        'one', 'onion', 'online', 'only', 'open', 'opera', 'opinion', 'oppose', 'option', 'orange',
        'orbit', 'orchard', 'order', 'ordinary', 'organ', 'orient', 'original', 'orphan', 'ostrich', 'other',
        'outdoor', 'outer', 'output', 'outside', 'oval', 'oven', 'over', 'own', 'owner', 'oxygen',
        'oyster', 'ozone', 'pact', 'paddle', 'page', 'pair', 'palace', 'palm', 'panda', 'panel',
        'panic', 'panther', 'paper', 'parade', 'parent', 'park', 'parrot', 'part', 'party', 'pass',
        'patch', 'path', 'patient', 'patrol', 'pattern', 'pause', 'pave', 'payment', 'peace', 'peanut',
        'pear', 'peasant', 'pelican', 'pen', 'penalty', 'pencil', 'people', 'pepper', 'perfect', 'permit',
        'person', 'pet', 'phone', 'photo', 'phrase', 'physical', 'piano', 'picnic', 'picture', 'piece',
        'pig', 'pigeon', 'pill', 'pilot', 'pink', 'pioneer', 'pipe', 'pistol', 'pitch', 'pizza',
        'place', 'planet', 'plastic', 'plate', 'play', 'please', 'pledge', 'pluck', 'plug', 'plunge',
        'poem', 'poet', 'point', 'polar', 'pole', 'police', 'pond', 'pony', 'pool', 'popular',
        'portion', 'position', 'possible', 'post', 'potato', 'pottery', 'poverty', 'powder', 'power', 'practice',
        'praise', 'predict', 'prefer', 'prepare', 'present', 'pretty', 'prevent', 'price', 'pride', 'primary',
        'print', 'priority', 'prison', 'private', 'prize', 'problem', 'process', 'produce', 'profit', 'program',
        'project', 'promote', 'proof', 'property', 'prosper', 'protect', 'proud', 'provide', 'public', 'pudding',
        'pull', 'pulp', 'pulse', 'pumpkin', 'punch', 'pupil', 'puppy', 'purchase', 'purity', 'purpose',
        'purse', 'push', 'put', 'puzzle', 'pyramid', 'quality', 'quantum', 'quarter', 'question', 'quick',
        'quiet', 'quilt', 'quit', 'quiz', 'quote', 'rabbit', 'raccoon', 'race', 'rack', 'radar',
        'radio', 'rail', 'rain', 'raise', 'rally', 'ramp', 'ranch', 'random', 'range', 'rapid',
        'rare', 'rate', 'rather', 'raven', 'raw', 'razor', 'ready', 'real', 'reason', 'rebel',
        'rebuild', 'recall', 'receive', 'recipe', 'record', 'recycle', 'reduce', 'reflect', 'reform', 'refuse',
        'region', 'regret', 'regular', 'reject', 'relax', 'release', 'relief', 'rely', 'remain', 'remember',
        'remind', 'remove', 'render', 'renew', 'rent', 'reopen', 'repair', 'repeat', 'replace', 'report',
        'require', 'rescue', 'resemble', 'resist', 'resource', 'response', 'result', 'retire', 'retreat', 'return',
        'reunion', 'reveal', 'review', 'reward', 'rhythm', 'rib', 'ribbon', 'rice', 'rich', 'ride',
        'ridge', 'rifle', 'right', 'rigid', 'ring', 'riot', 'ripple', 'rise', 'risk', 'ritual',
        'rival', 'river', 'road', 'roast', 'rob', 'robot', 'robust', 'rocket', 'romance', 'roof',
        'rookie', 'room', 'rose', 'rotate', 'rough', 'round', 'route', 'royal', 'rubber', 'rude',
        'rug', 'rule', 'run', 'runway', 'rural', 'sad', 'saddle', 'sadness', 'safe', 'sail',
        'salad', 'salmon', 'salon', 'salt', 'salute', 'same', 'sample', 'sand', 'satisfy', 'satoshi',
        'sauce', 'sausage', 'save', 'say', 'scale', 'scan', 'scare', 'scatter', 'scene', 'scheme',
        'school', 'science', 'scissors', 'scorpion', 'scout', 'scrap', 'screen', 'script', 'scrub', 'sea',
        'search', 'season', 'seat', 'second', 'secret', 'section', 'security', 'seed', 'seek', 'segment',
        'select', 'sell', 'seminar', 'senior', 'sense', 'sentence', 'series', 'service', 'session', 'settle',
        'setup', 'seven', 'shadow', 'shaft', 'shallow', 'share', 'shed', 'shell', 'sheriff', 'shield',
        'shift', 'shine', 'ship', 'shirt', 'shock', 'shoe', 'shoot', 'shop', 'short', 'shoulder',
        'shove', 'shrimp', 'shrug', 'shuffle', 'shy', 'sibling', 'sick', 'side', 'siege', 'sight',
        'sign', 'silent', 'silk', 'silly', 'silver', 'similar', 'simple', 'since', 'sing', 'siren',
        'sister', 'situate', 'six', 'size', 'skate', 'sketch', 'ski', 'skill', 'skin', 'skirt',
        'skull', 'slab', 'slam', 'sleep', 'slender', 'slice', 'slide', 'slight', 'slim', 'slogan',
        'slot', 'slow', 'slush', 'small', 'smart', 'smile', 'smoke', 'smooth', 'snack', 'snake',
        'snap', 'sniff', 'snow', 'soap', 'soccer', 'social', 'sock', 'soda', 'soft', 'solar',
        'sold', 'soldier', 'solid', 'solution', 'solve', 'someone', 'song', 'soon', 'sorry', 'sort',
        'soul', 'sound', 'soup', 'source', 'south', 'space', 'spare', 'spatial', 'spawn', 'speak',
        'special', 'speed', 'spell', 'spend', 'sphere', 'spice', 'spider', 'spike', 'spin', 'spirit',
        'split', 'spoil', 'sponsor', 'spoon', 'sport', 'spot', 'spray', 'spread', 'spring', 'spy',
        'square', 'squeeze', 'squirrel', 'stable', 'stadium', 'staff', 'stage', 'stairs', 'stamp', 'stand',
        'start', 'state', 'stay', 'steak', 'steel', 'stem', 'step', 'stereo', 'stick', 'still',
        'sting', 'stock', 'stomach', 'stone', 'stool', 'story', 'stove', 'strategy', 'street', 'strike',
        'strong', 'struggle', 'student', 'stuff', 'stumble', 'style', 'subject', 'submit', 'subway', 'success',
        'such', 'sudden', 'suffer', 'sugar', 'suggest', 'suit', 'summer', 'sun', 'sunny', 'sunset',
        'super', 'supply', 'supreme', 'sure', 'surface', 'surge', 'surprise', 'surround', 'survey', 'suspect',
        'sustain', 'swallow', 'swamp', 'swap', 'swear', 'sweet', 'swift', 'swim', 'swing', 'switch',
        'sword', 'symbol', 'symptom', 'syrup', 'system', 'table', 'tackle', 'tag', 'tail', 'talent',
        'talk', 'tank', 'tape', 'target', 'task', 'taste', 'tattoo', 'taxi', 'teach', 'team',
        'tell', 'ten', 'tenant', 'tennis', 'tent', 'term', 'test', 'text', 'thank', 'that',
        'theme', 'then', 'theory', 'there', 'they', 'thing', 'this', 'thought', 'three', 'thrive',
        'throw', 'thumb', 'thunder', 'ticket', 'tide', 'tiger', 'tilt', 'timber', 'time', 'tiny',
        'tip', 'tired', 'tissue', 'title', 'toast', 'tobacco', 'today', 'toddler', 'toe', 'together',
        'toilet', 'token', 'tomato', 'tomorrow', 'tone', 'tongue', 'tonight', 'tool', 'tooth', 'top',
        'topic', 'topple', 'torch', 'tornado', 'tortoise', 'toss', 'total', 'tourist', 'toward', 'tower',
        'town', 'toy', 'track', 'trade', 'traffic', 'tragic', 'train', 'transfer', 'trap', 'trash',
        'travel', 'tray', 'treat', 'tree', 'trend', 'trial', 'tribe', 'trick', 'trigger', 'trim',
        'trip', 'trophy', 'trouble', 'truck', 'true', 'truly', 'trumpet', 'trust', 'truth', 'try',
        'tube', 'tuition', 'tumble', 'tuna', 'tunnel', 'turkey', 'turn', 'turtle', 'twelve', 'twenty',
        'twice', 'twin', 'twist', 'two', 'type', 'typical', 'ugly', 'umbrella', 'unable', 'unaware',
        'uncle', 'uncover', 'under', 'undo', 'unfair', 'unfold', 'unhappy', 'uniform', 'unique', 'unit',
        'universe', 'unknown', 'unlock', 'until', 'unusual', 'unveil', 'update', 'upgrade', 'uphold', 'upon',
        'upper', 'upset', 'urban', 'urge', 'usage', 'use', 'used', 'useful', 'useless', 'usual',
        'utility', 'vacant', 'vacuum', 'vague', 'valid', 'valley', 'valve', 'van', 'vanish', 'vapor',
        'various', 'vast', 'vault', 'vehicle', 'velvet', 'vendor', 'venture', 'venue', 'verb', 'verify',
        'version', 'very', 'vessel', 'veteran', 'viable', 'vibe', 'vicious', 'victory', 'video', 'view',
        'village', 'vintage', 'violin', 'virtual', 'virus', 'visa', 'visit', 'visual', 'vital', 'vivid',
        'vocal', 'voice', 'void', 'volcano', 'volume', 'vote', 'voyage', 'wage', 'wagon', 'wait',
        'walk', 'wall', 'walnut', 'want', 'warfare', 'warm', 'warrior', 'wash', 'wasp', 'waste',
        'water', 'wave', 'way', 'wealth', 'weapon', 'wear', 'weasel', 'weather', 'web', 'wedding',
        'weekend', 'weird', 'welcome', 'west', 'wet', 'what', 'wheat', 'wheel', 'when', 'where',
        'whip', 'whisper', 'wide', 'width', 'wife', 'wild', 'will', 'win', 'window', 'wine',
        'wing', 'wink', 'winner', 'winter', 'wire', 'wisdom', 'wise', 'wish', 'witness', 'wolf',
        'woman', 'wonder', 'wood', 'wool', 'word', 'work', 'world', 'worry', 'worth', 'wrap',
        'wreck', 'wrestle', 'wrist', 'write', 'wrong', 'yard', 'year', 'yellow', 'you', 'young',
        'youth', 'zebra', 'zero', 'zone', 'zoo'
    ];
    
    console.log(`Loaded ${bip39Words.length} BIP39 words`);
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Network warning dismiss
    const dismissWarning = document.getElementById('dismiss-warning');
    if (dismissWarning) {
        dismissWarning.addEventListener('click', dismissNetworkWarning);
    }
    
    // Setup clipboard protection for mnemonic fields
    const mnemonicInputElement = document.getElementById('btc-mnemonic-input');
    if (mnemonicInputElement) {
        preventMnemonicClipboardAccess(mnemonicInputElement);
        
        // Add physical keyboard warning for mnemonic input
        mnemonicInputElement.addEventListener('keydown', function(e) {
            // Show warning when physical keyboard is used for mnemonic input
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
    
    // Virtual keyboard buttons
    document.querySelectorAll('.keyboard-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const isPassword = this.dataset.password === 'true';
            openVirtualKeyboard(targetId, isPassword);
        });
    });
    
    // Virtual keyboard modal events
    const closeKeyboard = document.getElementById('close-keyboard');
    const keyboardCancel = document.getElementById('keyboard-cancel');
    const keyboardOk = document.getElementById('keyboard-ok');
    
    if (closeKeyboard) {
        closeKeyboard.addEventListener('click', closeVirtualKeyboard);
    }
    if (keyboardCancel) {
        keyboardCancel.addEventListener('click', closeVirtualKeyboard);
    }
    if (keyboardOk) {
        keyboardOk.addEventListener('click', confirmKeyboardInput);
    }
    
    // Virtual keyboard key events
    document.querySelectorAll('.key-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            handleKeyboardInput(button.dataset.key, button.dataset.shift);
        });
    });
    
    // Close modal when clicking outside
    const modal = document.getElementById('virtual-keyboard-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeVirtualKeyboard();
            }
        });
    }
    
    // Input validation
    const inputs = [
        'btc-mnemonic-input',
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
            
            // Special handling for mnemonic input
            if (id === 'btc-mnemonic-input') {
                element.addEventListener('input', validateMnemonic);
                element.addEventListener('blur', validateMnemonic);
                
                // Enable format button when mnemonic input has content
                element.addEventListener('input', function() {
                    const formatBtn = document.getElementById('format-mnemonic-btn');
                    if (formatBtn) {
                        formatBtn.disabled = !this.value.trim();
                    }
                });
            }
        }
    });
    
    // Format mnemonic button
    const formatBtn = document.getElementById('format-mnemonic-btn');
    if (formatBtn) {
        formatBtn.addEventListener('click', formatMnemonic);
    }
    
    // Virtual keyboard events
    document.addEventListener('keydown', function(event) {
        // Only handle keyboard events when virtual keyboard is open and target is mnemonic field
        if (!virtualKeyboard.isOpen || !virtualKeyboard.targetInput || 
            virtualKeyboard.targetInput.id !== 'btc-mnemonic-input') {
            return;
        }
        
        const suggestionsContainer = document.getElementById('mnemonic-suggestions');
        if (!suggestionsContainer || suggestionsContainer.classList.contains('hidden')) {
            return;
        }
        
        const suggestionItems = suggestionsContainer.querySelectorAll('.suggestion-item');
        if (suggestionItems.length === 0) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                virtualKeyboard.suggestionIndex = Math.min(
                    virtualKeyboard.suggestionIndex + 1, 
                    suggestionItems.length - 1
                );
                updateSuggestionSelection(suggestionItems);
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                virtualKeyboard.suggestionIndex = Math.max(
                    virtualKeyboard.suggestionIndex - 1, 
                    -1
                );
                updateSuggestionSelection(suggestionItems);
                break;
                
            case 'Enter':
            case 'Tab':
                event.preventDefault();
                if (virtualKeyboard.suggestionIndex >= 0 && 
                    virtualKeyboard.suggestionIndex < suggestionItems.length) {
                    const selectedWord = suggestionItems[virtualKeyboard.suggestionIndex].textContent;
                    selectMnemonicSuggestion(selectedWord);
                }
                break;
                
            case 'Escape':
                event.preventDefault();
                hideMnemonicSuggestions();
                break;
        }
    });
    
    // Auto-copy mnemonic to main content
    const mnemonicInput = document.getElementById('btc-mnemonic-input');
    if (mnemonicInput) {
        mnemonicInput.addEventListener('input', autoCopyMnemonic);
    }
    
    console.log('Event listeners setup complete');
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
    const mnemonic = getValue('btc-mnemonic-input');
    const passphrase1 = getValue('encrypt-passphrase1');
    const passphrase2 = getValue('encrypt-passphrase2');
    // Password is now optional, so we don't require it for form validation
    const password1 = getValue('encrypt-password1');
    const password2 = getValue('encrypt-password2');
    
    // Passphrase validation (required)
    const isPassphraseValid = passphrase1 && passphrase1 === passphrase2;
    
    // Password validation (optional) - if provided, both fields must match
    const isPasswordValid = !password1 || (password1 && password1 === password2);
    
    const isValid = mnemonic && isPassphraseValid && isPasswordValid;
    
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
    
    const mnemonic = getValue('btc-mnemonic-input');
    const passphrase = getValue('encrypt-passphrase1');
    const password = getValue('encrypt-password1') || ''; // Use empty string if not provided
    
    if (!mnemonic || !passphrase) {
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
                    content: mnemonic,
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
            encrypted = await tauriAPI.invoke('encrypt_mnemonic', {
                mnemonic: mnemonic,
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
        const defaultFilename = window.suggestedFilename || 'encrypted_mnemonic.bin';
        
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
                        ${walletInfo.wallet_info.mnemonic_word_count ? `
                        <div class="info-item">
                            <div class="info-label">Mnemonic Words:</div>
                            <div class="info-value">${walletInfo.wallet_info.mnemonic_word_count}</div>
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

// Virtual Keyboard Functions
function openVirtualKeyboard(targetInputId, isPasswordMode = false) {
    const targetInput = document.getElementById(targetInputId);
    if (!targetInput) return;
    
    virtualKeyboard.isOpen = true;
    virtualKeyboard.targetInput = targetInput;
    virtualKeyboard.isPasswordMode = isPasswordMode;
    virtualKeyboard.inputText = targetInput.value;
    virtualKeyboard.shiftPressed = false;
    virtualKeyboard.capsLock = false;
    virtualKeyboard.currentWord = '';
    virtualKeyboard.suggestions = [];
    
    // Check if this is a mnemonic input field
    const isMnemonicField = targetInputId === 'btc-mnemonic-input';
    
    showVirtualKeyboard();
    updateKeyboardDisplay();
    
    if (isMnemonicField) {
        updateMnemonicSuggestions();
    }
}

function showVirtualKeyboard() {
    const modal = document.getElementById('virtual-keyboard-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeVirtualKeyboard() {
    virtualKeyboard.isOpen = false;
    virtualKeyboard.targetInput = null;
    
    const modal = document.getElementById('virtual-keyboard-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    hideMnemonicSuggestions();
}

function confirmKeyboardInput() {
    if (virtualKeyboard.targetInput) {
        virtualKeyboard.targetInput.value = virtualKeyboard.inputText;
        
        // Trigger input event for validation
        const event = new Event('input', { bubbles: true });
        virtualKeyboard.targetInput.dispatchEvent(event);
    }
    closeVirtualKeyboard();
}

function handleKeyboardInput(key, shiftKey) {
    if (!virtualKeyboard.isOpen) return;
    
    switch (key) {
        case 'backspace':
            if (virtualKeyboard.inputText.length > 0) {
                virtualKeyboard.inputText = virtualKeyboard.inputText.slice(0, -1);
                updateCurrentWord();
            }
            break;
            
        case 'clear':
            virtualKeyboard.inputText = '';
            virtualKeyboard.currentWord = '';
            break;
            
        case 'space':
            virtualKeyboard.inputText += ' ';
            virtualKeyboard.currentWord = '';
            break;
            
        case 'shift':
            virtualKeyboard.shiftPressed = !virtualKeyboard.shiftPressed;
            updateKeyboardKeys();
            return;
            
        case 'caps':
            virtualKeyboard.capsLock = !virtualKeyboard.capsLock;
            updateKeyboardKeys();
            return;
            
        default:
            let charToAdd = key;
            if (virtualKeyboard.shiftPressed || virtualKeyboard.capsLock) {
                charToAdd = shiftKey || key.toUpperCase();
                virtualKeyboard.shiftPressed = false;
                updateKeyboardKeys();
            }
            virtualKeyboard.inputText += charToAdd;
            updateCurrentWord();
            break;
    }
    
    updateKeyboardDisplay();
    
    // Update mnemonic suggestions if this is a mnemonic field
    const isMnemonicField = virtualKeyboard.targetInput && 
                           virtualKeyboard.targetInput.id === 'btc-mnemonic-input';
    if (isMnemonicField) {
        updateMnemonicSuggestions();
    }
}

function updateCurrentWord() {
    const words = virtualKeyboard.inputText.split(' ');
    virtualKeyboard.currentWord = words[words.length - 1] || '';
}

function updateMnemonicSuggestions() {
    // Only show suggestions if we have a current word and it's at least 1 character
    if (!virtualKeyboard.currentWord || virtualKeyboard.currentWord.length < 1) {
        hideMnemonicSuggestions();
        return;
    }
    
    const prefix = virtualKeyboard.currentWord.toLowerCase();
    const suggestions = bip39Words.filter(word => 
        word.toLowerCase().startsWith(prefix) && word !== prefix // Don't suggest exact matches
    ).slice(0, 8); // Limit to 8 suggestions to avoid overcrowding
    
    virtualKeyboard.suggestions = suggestions;
    
    if (suggestions.length > 0) {
        showMnemonicSuggestions(suggestions);
    } else {
        hideMnemonicSuggestions();
    }
}

function showMnemonicSuggestions(suggestions) {
    const suggestionsContainer = document.getElementById('mnemonic-suggestions');
    if (!suggestionsContainer) return;
    
    suggestionsContainer.innerHTML = '';
    
    // Add a header to explain the suggestions
    const header = document.createElement('div');
    header.className = 'suggestions-header';
    header.textContent = 'BIP39 Word Suggestions (click to select, use ↑↓ arrow keys):';
    header.style.cssText = 'padding: 6px 12px; background: #f8f9fa; font-size: 0.8em; color: #6c757d; border-bottom: 1px solid #e9ecef;';
    suggestionsContainer.appendChild(header);
    
    suggestions.forEach((word, index) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = word;
        item.dataset.index = index;
        item.addEventListener('click', () => selectMnemonicSuggestion(word));
        suggestionsContainer.appendChild(item);
    });
    
    suggestionsContainer.classList.remove('hidden');
    virtualKeyboard.suggestionIndex = -1; // Reset selection
}

function hideMnemonicSuggestions() {
    const suggestionsContainer = document.getElementById('mnemonic-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
        suggestionsContainer.innerHTML = '';
    }
}

function selectMnemonicSuggestion(word) {
    if (!virtualKeyboard.isOpen || !virtualKeyboard.currentWord) return;
    
    // Replace the current word with the selected suggestion and add a space
    const words = virtualKeyboard.inputText.split(' ');
    words[words.length - 1] = word;
    virtualKeyboard.inputText = words.join(' ') + ' '; // Add space after the word
    virtualKeyboard.currentWord = ''; // Reset current word
    
    updateKeyboardDisplay();
    hideMnemonicSuggestions();
}

function updateSuggestionSelection(suggestionItems) {
    // Remove previous selection
    suggestionItems.forEach(item => item.classList.remove('selected'));
    
    // Add selection to current item
    if (virtualKeyboard.suggestionIndex >= 0 && 
        virtualKeyboard.suggestionIndex < suggestionItems.length) {
        const selectedItem = suggestionItems[virtualKeyboard.suggestionIndex];
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ block: 'nearest' });
    }
}

function updateKeyboardDisplay() {
    const display = document.getElementById('keyboard-input-display');
    if (display) {
        if (virtualKeyboard.isPasswordMode) {
            display.textContent = '*'.repeat(virtualKeyboard.inputText.length);
        } else {
            display.textContent = virtualKeyboard.inputText;
        }
    }
}

function updateKeyboardKeys() {
    const useShift = virtualKeyboard.shiftPressed || virtualKeyboard.capsLock;
    
    document.querySelectorAll('.key-btn').forEach(button => {
        const key = button.dataset.key;
        const shiftKey = button.dataset.shift;
        
        if (shiftKey && useShift) {
            button.textContent = shiftKey;
        } else if (key && key.length === 1) {
            button.textContent = useShift ? key.toUpperCase() : key;
        }
    });
    
    // Update shift and caps key states
    const shiftKey = document.getElementById('shift-key');
    const capsKey = document.getElementById('caps-key');
    
    if (shiftKey) {
        shiftKey.classList.toggle('active', virtualKeyboard.shiftPressed);
    }
    if (capsKey) {
        capsKey.classList.toggle('active', virtualKeyboard.capsLock);
    }
}

// Mnemonic validation functions
async function validateMnemonic() {
    const mnemonicInput = document.getElementById('btc-mnemonic-input');
    const statusDiv = document.getElementById('mnemonic-validation-status');
    const statusIcon = document.getElementById('mnemonic-status-icon');
    const statusMessage = document.getElementById('mnemonic-status-message');
    const statusDetails = document.getElementById('mnemonic-status-details');
    const formatBtn = document.getElementById('format-mnemonic-btn');
    
    if (!mnemonicInput || !statusDiv) return;
    
    const mnemonic = mnemonicInput.value.trim();
    
    if (!mnemonic) {
        statusDiv.classList.add('hidden');
        if (formatBtn) formatBtn.disabled = true;
        return;
    }
    
    // Show validation status
    statusDiv.classList.remove('hidden');
    if (statusIcon) statusIcon.textContent = '⏳';
    if (statusMessage) statusMessage.textContent = 'Validating seed phrase...';
    if (statusDetails) statusDetails.textContent = '';
    
    try {
        // Basic validation
        const words = mnemonic.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        
        // Check word count
        if (wordCount !== 12 && wordCount !== 15 && wordCount !== 18 && wordCount !== 21 && wordCount !== 24) {
            showMnemonicValidationResult(false, `Invalid word count: ${wordCount}. Expected 12, 15, 18, 21, or 24 words.`);
            if (formatBtn) formatBtn.disabled = false; // Allow formatting
            return;
        }
        
        // Check if all words are in BIP39 wordlist
        const invalidWords = words.filter(word => !bip39Words.includes(word.toLowerCase()));
        if (invalidWords.length > 0) {
            showMnemonicValidationResult(false, `Invalid words: ${invalidWords.join(', ')}`);
            if (formatBtn) formatBtn.disabled = false; // Allow formatting
            return;
        }
        
        // Call backend validation if available
        if (tauriAPI.invoke) {
            try {
                const result = await tauriAPI.invoke('validate_btc_mnemonic', { mnemonic: mnemonic });
                showMnemonicValidationResult(result.is_valid, result.message || 'Seed phrase validation completed');
                if (formatBtn) formatBtn.disabled = !result.is_valid;
            } catch (error) {
                console.error('Backend validation failed:', error);
                showMnemonicValidationResult(true, `${wordCount} words detected - basic validation passed`);
                if (formatBtn) formatBtn.disabled = false;
            }
        } else {
            showMnemonicValidationResult(true, `${wordCount} words detected - basic validation passed`);
            if (formatBtn) formatBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('Mnemonic validation error:', error);
        showMnemonicValidationResult(false, 'Validation error occurred');
        if (formatBtn) formatBtn.disabled = false;
    }
}

function showMnemonicValidationResult(isValid, message) {
    const statusIcon = document.getElementById('mnemonic-status-icon');
    const statusMessage = document.getElementById('mnemonic-status-message');
    const statusDetails = document.getElementById('mnemonic-status-details');
    
    if (statusIcon) {
        statusIcon.textContent = isValid ? '✅' : '❌';
    }
    
    if (statusMessage) {
        statusMessage.textContent = isValid ? 'Valid Seed Phrase' : 'Invalid Seed Phrase';
    }
    
    if (statusDetails) {
        statusDetails.textContent = message;
    }
}

async function formatMnemonic() {
    const mnemonicInput = document.getElementById('btc-mnemonic-input');
    if (!mnemonicInput) return;
    
    const mnemonic = mnemonicInput.value.trim();
    if (!mnemonic) return;
    
    try {
        // Basic formatting
        let formatted = mnemonic
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove non-word characters except spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
        
        // Try backend formatting if available
        if (tauriAPI.invoke) {
            try {
                const result = await tauriAPI.invoke('format_mnemonic_comprehensive', { mnemonic: formatted });
                formatted = result.formatted_mnemonic || formatted;
                showMessage('Seed phrase formatted successfully', 'success');
            } catch (error) {
                console.error('Backend formatting failed:', error);
                showMessage('Basic formatting applied', 'info');
            }
        } else {
            showMessage('Basic formatting applied', 'info');
        }
        
        mnemonicInput.value = formatted;
        
        // Re-validate after formatting
        setTimeout(() => validateMnemonic(), 100);
        
    } catch (error) {
        console.error('Formatting error:', error);
        showMessage('Formatting failed', 'error');
    }
}

// File Information Functions
async function showFileInfo() {
    console.log('Showing file information...');
    
    const content = getValue('decrypt-content');
    if (!content) {
        showMessage('No file content loaded to analyze', 'error');
        return;
    }
    
    // Try to get filename from a stored variable or ask user
    let filename = getCurrentFilename();
    if (!filename) {
        filename = prompt('Enter the filename to parse wallet information:');
        if (!filename) {
            showMessage('Filename required to parse wallet information', 'error');
            return;
        }
    }
    
    try {
        if (tauriAPI.invoke) {
            const result = await tauriAPI.invoke('parse_wallet_filename', { filename: filename });
            displayFileInfo(result);
        } else {
            showMessage('File parsing not available', 'error');
        }
    } catch (error) {
        console.error('Failed to parse file info:', error);
        showMessage(`Failed to parse file info: ${error}`, 'error');
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
    
    const wordCountDisplay = walletInfo.mnemonic_word_count ? 
        `${walletInfo.mnemonic_word_count} words` : 'Unknown';
    
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

// Auto-copy mnemonic function
function autoCopyMnemonic() {
    const mnemonicInput = document.getElementById('btc-mnemonic-input');
    if (!mnemonicInput) return;
    
    const mnemonic = mnemonicInput.value.trim();
    if (mnemonic && mnemonic.split(/\s+/).length >= 12) {
        // Auto-copy to main content if it looks like a complete mnemonic
        // This would typically copy to an "encrypt content" field if it existed
        console.log('Complete seed phrase detected for auto-copy');
    }
}

// Wallet label functionality
async function openWalletLabelDialog() {
    console.log('Opening wallet label dialog...');
    
    // Validate required fields first
    const mnemonic = getValue('btc-mnemonic-input');
    const passphrase = getValue('encrypt-passphrase1');
    const password = getValue('encrypt-password1');
    
    if (!mnemonic || !passphrase || !password) {
        showMessage('Please fill all required fields before adding wallet label', 'error');
        return;
    }
    
    createWalletLabelDialog();
}

async function createWalletLabelDialog() {
    // Remove existing modal if any
    const existingModal = document.getElementById('wallet-label-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'wallet-label-modal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 550px;">
            <div class="modal-header">
                <h3>🏷️ Wallet Configuration</h3>
                <button id="close-wallet-dialog" class="close-btn">×</button>
            </div>
            <div class="wallet-dialog-content" style="padding: 25px;">
                <div class="input-section">
                    <label class="section-title">Wallet Name</label>
                    <p class="help-text">Enter a name for your wallet</p>
                    <input type="text" id="custom-wallet-label" class="text-field" 
                           placeholder="Enter wallet name..." maxlength="50" />
                </div>
                
                <div class="input-section" style="margin-top: 20px;">
                    <label class="section-title">Wallet Type</label>
                    <select id="wallet-type-select" class="text-field" style="padding: 10px;">
                        <option value="MainWallet">Main Wallet</option>
                        <option value="ColdWallet">Cold Storage Wallet</option>
                        <option value="HotWallet">Hot Wallet</option>
                        <option value="HardwareWallet">Hardware Wallet</option>
                        <option value="TestWallet">Test Wallet</option>
                        <option value="BackupWallet">Backup Wallet</option>
                        <option value="MultisigWallet">Multi-signature Wallet</option>
                        <option value="WatchOnlyWallet">Watch-only Wallet</option>
                        <option value="LightningWallet">Lightning Wallet</option>
                        <option value="TradingWallet">Trading Wallet</option>
                        <option value="SavingsWallet">Savings Wallet</option>
                        <option value="BusinessWallet">Business Wallet</option>
                        <option value="PersonalWallet">Personal Wallet</option>
                        <option value="DevelopmentWallet">Development Wallet</option>
                        <option value="Custom">Custom Type</option>
                    </select>
                </div>
                
                <div class="preview-section" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <label class="field-label">Filename Preview:</label>
                    <div id="filename-preview" style="font-family: monospace; font-size: 0.9em; color: #495057; margin-top: 5px;">
                        wallet_file_preview.bin
                    </div>
                </div>
                
                <div class="dialog-actions" style="margin-top: 25px; text-align: center;">
                    <button id="encrypt-with-label-btn" class="primary-button" style="margin-right: 10px;">
                        🔒 Encrypt with Wallet Info
                    </button>
                    <button id="cancel-wallet-dialog" class="secondary-button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('close-wallet-dialog').addEventListener('click', () => modal.remove());
    document.getElementById('cancel-wallet-dialog').addEventListener('click', () => modal.remove());
    
    // Input event listeners
    document.getElementById('custom-wallet-label').addEventListener('input', updateFilenamePreview);
    document.getElementById('wallet-type-select').addEventListener('change', updateFilenamePreview);
    
    // Encrypt with label button
    document.getElementById('encrypt-with-label-btn').addEventListener('click', performEncryptionWithWalletLabel);
    
    // Show modal and update initial preview
    modal.classList.remove('hidden');
    updateFilenamePreview();
}

function updateFilenamePreview() {
    const labelInput = document.getElementById('custom-wallet-label');
    const typeSelect = document.getElementById('wallet-type-select');
    const preview = document.getElementById('filename-preview');
    
    if (!labelInput || !typeSelect || !preview) return;
    
    const label = labelInput.value.trim() || 'MyWallet';
    const walletType = typeSelect.value;
    
    // Create metadata object for preview
    const metadata = {
        label: label,
        wallet_type: walletType,
        created_at: new Date().toISOString(),
        mnemonic_word_count: null // Will be determined during encryption
    };
    
    // Generate preview filename
    if (tauriAPI.invoke) {
        tauriAPI.invoke('generate_wallet_filename_preview', metadata)
            .then(filename => {
                preview.textContent = filename;
                // Store the filename globally and update main save button
                window.suggestedFilename = filename;
                updateMainSaveButton(filename);
            })
            .catch(error => {
                console.error('Failed to generate filename preview:', error);
                const fallbackFilename = `${label}_${walletType}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.bin`;
                preview.textContent = fallbackFilename;
                // Store the fallback filename globally and update main save button
                window.suggestedFilename = fallbackFilename;
                updateMainSaveButton(fallbackFilename);
            });
    } else {
        // Fallback preview
        const timestamp = new Date().toISOString().slice(0,19).replace(/[-:]/g,'').replace('T', '_');
        const fallbackFilename = `${label}_${walletType}_${timestamp}.bin`;
        preview.textContent = fallbackFilename;
        // Store the fallback filename globally and update main save button
        window.suggestedFilename = fallbackFilename;
        updateMainSaveButton(fallbackFilename);
    }
}

async function performEncryptionWithWalletLabel() {
    const labelInput = document.getElementById('custom-wallet-label');
    const typeSelect = document.getElementById('wallet-type-select');
    
    if (!labelInput || !typeSelect) {
        showMessage('Dialog elements not found', 'error');
        return;
    }
    
    const label = labelInput.value.trim();
    if (!label) {
        showMessage('Please enter a wallet name', 'error');
        return;
    }
    
    // Close the dialog
    const modal = document.getElementById('wallet-label-modal');
    if (modal) modal.remove();
    
    // Get form data
    const mnemonic = getValue('btc-mnemonic-input');
    const passphrase = getValue('encrypt-passphrase1');
    const password = getValue('encrypt-password1') || ''; // Use empty string if not provided
    
    if (!mnemonic || !passphrase) {
        showMessage('Please fill all required fields', 'error');
        return;
    }
    
    try {
        const encryptBtn = document.getElementById('encrypt-with-wallet-btn');
        if (encryptBtn) {
            encryptBtn.disabled = true;
            encryptBtn.textContent = '🔄 Encrypting with Label...';
        }
        
        setStatus('encrypt-status', 'Encrypting seed phrase with wallet metadata...', 'info');
        
        // Create wallet metadata
        const walletMetadata = {
            label: label,
            wallet_type: typeSelect.value,
            created_at: new Date().toISOString(),
            mnemonic_word_count: null // Will be set by backend
        };
        
        const result = await tauriAPI.invoke('encrypt_mnemonic_with_wallet_metadata', {
            mnemonic: mnemonic,
            passphrase: passphrase,
            password: password,
            wallet_metadata: walletMetadata
        });
        
        setValue('encrypt-result', result.encrypted_content);
        
        // Use the filename that was already set in the preview (stored in window.suggestedFilename)
        // instead of the backend result.suggested_filename
        const finalFilename = window.suggestedFilename || result.suggested_filename;
        
        // Store final filename globally for save operation (should already be set, but ensure it's there)
        window.suggestedFilename = finalFilename;
        
        // Enable save button and update it with the final filename
        const saveBtn = document.getElementById('save-encrypted-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            // Update button to show the final filename
            const shortFilename = finalFilename.length > 25 ? 
                finalFilename.substring(0, 22) + '...' : 
                finalFilename;
            saveBtn.innerHTML = `💾 Save: ${shortFilename}`;
            saveBtn.title = `Save as: ${finalFilename}`;
        }
        
        setStatus('encrypt-status', 'Encryption with wallet label completed successfully', 'success');
        showMessage(`Mnemonic encrypted successfully! Filename: ${finalFilename}`, 'success');
        
        // Show post-encryption security reminder with wallet info
        setTimeout(() => showPostEncryptionReminder(result.wallet_info), 1000);
        
        // Show wallet info if available
        if (result.wallet_info) {
            console.log('Wallet info:', result.wallet_info);
        }
        
    } catch (error) {
        console.error('Encryption with wallet label failed:', error);
        setValue('encrypt-result', '');
        setStatus('encrypt-status', 'Encryption failed', 'error');
        showMessage(`Encryption failed: ${error}`, 'error');
    } finally {
        const encryptBtn = document.getElementById('encrypt-with-wallet-btn');
        if (encryptBtn) {
            encryptBtn.disabled = false;
            encryptBtn.textContent = '🏷️ Encrypt with Wallet Label';
        }
    }
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
            localStorage.setItem('btc_mnemonic_guide_seen', 'true');
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