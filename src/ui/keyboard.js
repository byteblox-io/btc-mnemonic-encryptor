export function init() {
    console.log('🎹 Virtual Keyboard module init() called - START');
    console.log('🎹 Current location:', window.location.href);
    console.log('🎹 Document ready state:', document.readyState);
    
    // Virtual Keyboard Functions
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

    console.log('📝 Virtual keyboard state initialized');

    // Local reference to word lists with fallbacks
    let bip39Words = [];
    let effWords = [];

    // Load word lists with better error handling
    function loadWordLists() {
        // Load BIP39 words
        if (window.bip39Words && window.bip39Words.length > 0) {
            bip39Words = window.bip39Words;
            console.log('BIP39 words loaded from window.bip39Words:', bip39Words.length);
        } else {
            // Use fetch for BIP39 words
            fetch('./bip39-words.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(words => {
                    bip39Words = words;
                    window.bip39Words = bip39Words;
                    console.log('BIP39 words loaded via fetch:', bip39Words.length);
                })
                .catch(error => {
                    console.error('Failed to load BIP39 word list:', error);
                    bip39Words = [];
                });
        }

        // Load EFF words
        if (window.effWords && window.effWords.length > 0) {
            effWords = window.effWords;
            console.log('EFF words loaded from window.effWords:', effWords.length);
        } else {
            // Use fetch for EFF words
            fetch('./eff-wordlist.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(words => {
                    effWords = words;
                    window.effWords = effWords;
                    console.log('EFF wordlist loaded via fetch:', effWords.length);
                })
                .catch(error => {
                    console.error('Failed to load EFF wordlist:', error);
                    effWords = [];
                });
        }
    }

    // Initialize word lists loading
    loadWordLists();

    // Re-check periodically if words haven't loaded (with shorter timeout)
    let retryCount = 0;
    const maxRetries = 5; // Try for 5 seconds max
    const wordLoadCheck = setInterval(() => {
        retryCount++;
        if ((bip39Words.length === 0 || effWords.length === 0) && retryCount < maxRetries) {
            loadWordLists();
        } else {
            if (bip39Words.length > 0) {
                console.log('BIP39 words loaded successfully');
            }
            if (effWords.length > 0) {
                console.log('EFF words loaded successfully');
            }
            clearInterval(wordLoadCheck);
        }
    }, 1000);

    function openVirtualKeyboard(targetInputId, isPasswordMode = false) {
        console.log('📱 openVirtualKeyboard called with:', targetInputId, 'isPassword:', isPasswordMode);
        
        const targetInput = document.getElementById(targetInputId);
        if (!targetInput) {
            console.error('❌ Target input not found:', targetInputId);
            return;
        }
        console.log('✅ Target input found:', targetInput);

        virtualKeyboard.isOpen = true;
        virtualKeyboard.targetInput = targetInput;
        virtualKeyboard.isPasswordMode = isPasswordMode;
        virtualKeyboard.inputText = targetInput.value || ''; // Ensure we have a string
        virtualKeyboard.shiftPressed = false;
        virtualKeyboard.capsLock = false;
        virtualKeyboard.currentWord = '';
        virtualKeyboard.suggestions = [];
        virtualKeyboard.suggestionIndex = -1;

        // Initialize current word properly
        updateCurrentWord();

        // Check if this is a seed phrase input field or passphrase field
        const isSeedPhraseField = targetInputId === 'seed-phrase-input';
        const isPassphraseField = targetInputId.includes('passphrase');
        console.log('🌱 Is seed phrase field:', isSeedPhraseField);
        console.log('🔑 Is passphrase field:', isPassphraseField);

        showVirtualKeyboard();
        updateKeyboardDisplay();

        if (isSeedPhraseField) {
            updateSeedPhraseSuggestions();
        } else if (isPassphraseField) {
            updatePassphraseSuggestions();
        }
    }

    function showVirtualKeyboard() {
        console.log('📺 Attempting to show virtual keyboard modal...');
        const modal = document.getElementById('virtual-keyboard-modal');
        console.log('🔍 Modal element:', modal);
        
        if (modal) {
            console.log('✅ Modal found!');
            console.log('🔍 Modal current classes:', modal.className);
            console.log('🔍 Modal current style.display:', modal.style.display);
            
            modal.classList.remove('hidden');
            console.log('🔍 After removing hidden class:', modal.className);
            
            // Force flexbox display for proper centering
            modal.style.display = 'flex';
            console.log('📺 Modal should now be visible with flex display');
            
            // Check if modal is actually visible
            const rect = modal.getBoundingClientRect();
            console.log('🔍 Modal position and size:', rect);
        } else {
            console.error('❌ Virtual keyboard modal not found!');
            
            // List all elements with 'modal' in their ID or class
            const allModals = document.querySelectorAll('[id*="modal"], [class*="modal"]');
            console.log('🔍 All modal-related elements found:', allModals.length);
            allModals.forEach((el, i) => {
                console.log(`Modal ${i}:`, el.id, el.className);
            });
        }
    }

    function closeVirtualKeyboard() {
        virtualKeyboard.isOpen = false;
        virtualKeyboard.targetInput = null;

        const modal = document.getElementById('virtual-keyboard-modal');
        if (modal) {
            modal.classList.add('hidden');
            // Reset display style to let CSS handle it
            modal.style.display = '';
        }

        hideSeedPhraseSuggestions();
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
                virtualKeyboard.suggestions = [];
                virtualKeyboard.suggestionIndex = -1;
                hideSeedPhraseSuggestions(); // This will hide any suggestions (seed phrase or passphrase)
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

        // Update suggestions based on field type
        const isSeedPhraseField = virtualKeyboard.targetInput &&
                               virtualKeyboard.targetInput.id === 'seed-phrase-input';
        const isPassphraseField = virtualKeyboard.targetInput &&
                               virtualKeyboard.targetInput.id.includes('passphrase');
        
        if (isSeedPhraseField) {
            updateSeedPhraseSuggestions();
        } else if (isPassphraseField) {
            updatePassphraseSuggestions();
        }
    }

    function updateCurrentWord() {
        if (!virtualKeyboard.inputText) {
            virtualKeyboard.currentWord = '';
            return;
        }
        
        const words = virtualKeyboard.inputText.split(' ');
        virtualKeyboard.currentWord = words[words.length - 1] || '';
    }

    function updateSeedPhraseSuggestions() {
        // Only show suggestions if we have a current word and it's at least 1 character
        if (!virtualKeyboard.currentWord || virtualKeyboard.currentWord.length < 1) {
            hideSeedPhraseSuggestions();
            return;
        }

        // Check if bip39Words is available (use local reference first, then global)
        const bip39WordList = bip39Words.length > 0 ? bip39Words : (window.bip39Words || []);
        if (bip39WordList.length === 0) {
            console.warn('BIP39 word list not loaded yet - suggestions disabled');
            hideSeedPhraseSuggestions();
            return;
        }

        const prefix = virtualKeyboard.currentWord.toLowerCase();
        const suggestions = bip39WordList.filter(word =>
            word.toLowerCase().startsWith(prefix) && word !== prefix // Don't suggest exact matches
        ).slice(0, 8); // Limit to 8 suggestions to avoid overcrowding

        virtualKeyboard.suggestions = suggestions;

        if (suggestions.length > 0) {
            showSeedPhraseSuggestions(suggestions);
        } else {
            hideSeedPhraseSuggestions();
        }
    }

    function showSeedPhraseSuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('seed-phrase-suggestions');
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
            item.addEventListener('click', () => selectSeedPhraseSuggestion(word));
            suggestionsContainer.appendChild(item);
        });

        suggestionsContainer.classList.remove('hidden');
        virtualKeyboard.suggestionIndex = -1; // Reset selection
    }

    function hideSeedPhraseSuggestions() {
        const suggestionsContainer = document.getElementById('seed-phrase-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.classList.add('hidden');
            suggestionsContainer.innerHTML = '';
        }
    }

    function selectSeedPhraseSuggestion(word) {
        if (!virtualKeyboard.isOpen || !virtualKeyboard.currentWord) return;

        // Replace the current word with the selected suggestion and add a space
        const words = virtualKeyboard.inputText.split(' ');
        words[words.length - 1] = word;
        virtualKeyboard.inputText = words.join(' ') + ' '; // Add space after the word
        virtualKeyboard.currentWord = ''; // Reset current word

        updateKeyboardDisplay();
        hideSeedPhraseSuggestions();
    }

    // Passphrase suggestions using EFF wordlist
    function updatePassphraseSuggestions() {
        // Only show suggestions if we have a current word and it's at least 1 character
        if (!virtualKeyboard.currentWord || virtualKeyboard.currentWord.length < 1) {
            hideSeedPhraseSuggestions();
            return;
        }

        // Check if effWords is available (use local reference first, then global)
        const effWordList = effWords.length > 0 ? effWords : (window.effWords || []);
        if (effWordList.length === 0) {
            console.warn('EFF wordlist not loaded yet - suggestions disabled');
            hideSeedPhraseSuggestions();
            return;
        }

        const prefix = virtualKeyboard.currentWord.toLowerCase();
        const suggestions = effWordList.filter(word =>
            word.toLowerCase().startsWith(prefix) && word !== prefix // Don't suggest exact matches
        ).slice(0, 8); // Limit to 8 suggestions to avoid overcrowding

        virtualKeyboard.suggestions = suggestions;

        if (suggestions.length > 0) {
            showPassphraseSuggestions(suggestions);
        } else {
            hideSeedPhraseSuggestions();
        }
    }

    function showPassphraseSuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('seed-phrase-suggestions');
        if (!suggestionsContainer) return;

        suggestionsContainer.innerHTML = '';

        // Add a header to explain the suggestions
        const header = document.createElement('div');
        header.className = 'suggestions-header';
        header.textContent = 'EFF Wordlist Suggestions (click to select, use ↑↓ arrow keys):';
        header.style.cssText = 'padding: 6px 12px; background: #e3f2fd; font-size: 0.8em; color: #1565c0; border-bottom: 1px solid #bbdefb;';
        suggestionsContainer.appendChild(header);

        suggestions.forEach((word, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = word;
            item.dataset.index = index;
            item.addEventListener('click', () => selectPassphraseSuggestion(word));
            suggestionsContainer.appendChild(item);
        });

        suggestionsContainer.classList.remove('hidden');
        virtualKeyboard.suggestionIndex = -1; // Reset selection
    }

    function selectPassphraseSuggestion(word) {
        if (!virtualKeyboard.isOpen || !virtualKeyboard.currentWord) return;

        // Replace the current word with the selected suggestion and add a space
        const words = virtualKeyboard.inputText.split(' ');
        words[words.length - 1] = word;
        virtualKeyboard.inputText = words.join(' ') + ' '; // Add space after the word
        virtualKeyboard.currentWord = ''; // Reset current word

        updateKeyboardDisplay();
        hideSeedPhraseSuggestions();
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

    // Setup event listeners function
    function setupKeyboardEventListeners() {
        console.log('🎹 Setting up keyboard event listeners...');
        console.log('🔍 Document ready state:', document.readyState);
        
        // Debug: Check if modal exists
        const keyboardModal = document.getElementById('virtual-keyboard-modal');
        console.log('🔍 Virtual keyboard modal found:', !!keyboardModal);
        
        // Initialize event listeners for virtual keyboard buttons
        const keyboardButtons = document.querySelectorAll('.keyboard-btn');
        console.log('🔍 Found', keyboardButtons.length, 'keyboard buttons for setup');
        
        if (keyboardButtons.length === 0) {
            console.warn('⚠️ No keyboard buttons found during setup!');
            return;
        }
        
        keyboardButtons.forEach((btn, index) => {
            console.log(`🔍 Setting up listener for Button ${index + 1}:`, btn.dataset.target, btn.dataset.password, 'classes:', btn.className);
            
            // Remove any existing click listeners to avoid conflicts
            btn.onclick = null;
            
            // Create the event handler function
            const clickHandler = function(e) {
                console.log('🖱️ ✨ REAL Keyboard button clicked!', this.dataset.target, 'isPassword:', this.dataset.password);
                e.preventDefault();
                e.stopPropagation();
                const targetId = this.dataset.target;
                const isPassword = this.dataset.password === 'true';
                console.log('📱 ✨ Calling openVirtualKeyboard for:', targetId, 'isPassword:', isPassword);
                
                try {
                    openVirtualKeyboard(targetId, isPassword);
                    console.log('✅ openVirtualKeyboard call completed');
                } catch (error) {
                    console.error('❌ Error in openVirtualKeyboard:', error);
                }
            };
            
            btn.addEventListener('click', clickHandler);
            console.log('✅ Event listener added to button', index + 1);
        });
        
        console.log('✅ All keyboard button event listeners setup complete');
    }

    // Setup event listeners immediately since DOM is already ready when module is initialized
    setupKeyboardEventListeners();
    
    // Also setup other virtual keyboard events
    function setupVirtualKeyboardModalEvents() {
        console.log('🎹 Setting up virtual keyboard modal events...');
        
        // Virtual keyboard modal events
        const closeKeyboard = document.getElementById('close-keyboard');
        const keyboardCancel = document.getElementById('keyboard-cancel');
        const keyboardOk = document.getElementById('keyboard-ok');

        if (closeKeyboard) {
            closeKeyboard.addEventListener('click', closeVirtualKeyboard);
            console.log('✅ Close keyboard event listener added');
        }
        if (keyboardCancel) {
            keyboardCancel.addEventListener('click', closeVirtualKeyboard);
            console.log('✅ Cancel keyboard event listener added');
        }
        if (keyboardOk) {
            keyboardOk.addEventListener('click', confirmKeyboardInput);
            console.log('✅ OK keyboard event listener added');
        }

        // Virtual keyboard key events
        const keyButtons = document.querySelectorAll('.key-btn');
        console.log('🔍 Found', keyButtons.length, 'virtual key buttons');
        keyButtons.forEach(button => {
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
            console.log('✅ Modal outside click event listener added');
        }
        
        console.log('✅ Virtual keyboard modal event listeners setup complete');
    }
    
    // Setup modal events
    setupVirtualKeyboardModalEvents();

    // Setup global keyboard events for suggestions
    document.addEventListener('keydown', function(event) {
        // Only handle keyboard events when virtual keyboard is open
        if (!virtualKeyboard.isOpen || !virtualKeyboard.targetInput) {
            return;
        }

        const isSeedPhraseField = virtualKeyboard.targetInput.id === 'seed-phrase-input';
        const isPassphraseField = virtualKeyboard.targetInput.id.includes('passphrase');
        
        // Only handle suggestion navigation for seed phrase or passphrase fields
        if (!isSeedPhraseField && !isPassphraseField) {
            return;
        }

        const suggestionsContainer = document.getElementById('seed-phrase-suggestions');
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
                    if (isSeedPhraseField) {
                        selectSeedPhraseSuggestion(selectedWord);
                    } else if (isPassphraseField) {
                        selectPassphraseSuggestion(selectedWord);
                    }
                }
                break;

            case 'Escape':
                event.preventDefault();
                hideSeedPhraseSuggestions();
                break;
        }
    });

    // Return public methods
    return {
        openVirtualKeyboard,
        closeVirtualKeyboard,
        confirmKeyboardInput,
        handleKeyboardInput
    };
}

// Test function to verify the module is working - UPDATED to not interfere
function testKeyboardModule() {
    console.log('🧪 Testing keyboard module...');
    const buttons = document.querySelectorAll('.keyboard-btn');
    console.log('🧪 Test: Found', buttons.length, 'keyboard buttons');
    
    if (buttons.length > 0) {
        console.log('🧪 Test: First button:', buttons[0], 'data-target:', buttons[0].dataset.target);
        // Instead of adding a new listener, just log that buttons exist
        console.log('🧪 Test: Buttons are present and accessible');
        
        // Check if buttons already have click listeners
        buttons.forEach((btn, i) => {
            console.log(`🧪 Button ${i} onclick:`, btn.onclick);
            console.log(`🧪 Button ${i} events:`, btn);
        });
    }
}

// Call test function after a delay to ensure DOM is ready
setTimeout(() => {
    console.log('🧪 Running delayed test...');
    testKeyboardModule();
}, 2000);
