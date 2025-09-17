export function init() {
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

        // Check if this is a seed phrase input field
        const isSeedPhraseField = targetInputId === 'seed-phrase-input';

        showVirtualKeyboard();
        updateKeyboardDisplay();

        if (isSeedPhraseField) {
            updateSeedPhraseSuggestions();
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

        // Update seed phrase suggestions if this is a seed phrase field
        const isSeedPhraseField = virtualKeyboard.targetInput &&
                               virtualKeyboard.targetInput.id === 'seed-phrase-input';
        if (isSeedPhraseField) {
            updateSeedPhraseSuggestions();
        }
    }

    function updateCurrentWord() {
        const words = virtualKeyboard.inputText.split(' ');
        virtualKeyboard.currentWord = words[words.length - 1] || '';
    }

    function updateSeedPhraseSuggestions() {
        // Only show suggestions if we have a current word and it's at least 1 character
        if (!virtualKeyboard.currentWord || virtualKeyboard.currentWord.length < 1) {
            hideSeedPhraseSuggestions();
            return;
        }

        const prefix = virtualKeyboard.currentWord.toLowerCase();
        const suggestions = bip39Words.filter(word =>
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

    // Defer event listener setup until DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize event listeners for virtual keyboard
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
    });

    // Setup global keyboard events for seed phrase suggestions
    document.addEventListener('keydown', function(event) {
        // Only handle keyboard events when virtual keyboard is open and target is seed phrase field
        if (!virtualKeyboard.isOpen || !virtualKeyboard.targetInput ||
            virtualKeyboard.targetInput.id !== 'seed-phrase-input') {
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
                    selectSeedPhraseSuggestion(selectedWord);
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

// Import BIP39 word list from JSON file
import('./../bip39-words.json').then(words => {
    window.bip39Words = words.default;
}).catch(error => {
    console.error('Failed to load BIP39 word list:', error);
});
