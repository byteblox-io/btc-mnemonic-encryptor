// Validation utilities for seed phrase security

/**
 * Checks if an element is a seed phrase field based on ID or parent container
 * @param {HTMLElement} element - The DOM element to check
 * @returns {boolean} True if element is a seed phrase field
 */
export function isSeedPhraseField(element) {
    if (!element) return false;

    return element.id === 'btc-seed-phrase-input' ||
           element.closest('.seed-phrase-input-container') !== null ||
           (element.value && containsSeedPhraseWords(element.value));
}

/**
 * Determines if text contains BIP39 seed phrase words
 * @param {string} text - Text to analyze
 * @returns {boolean} True if text contains likely seed phrase words
 */
export function containsSeedPhraseWords(text) {
    if (!text || text.length < 10) return false;

    const words = text.toLowerCase().split(/\s+/);
    if (words.length < 6) return false;

    // Import BIP39 word list (must be imported in main module)
    // This function assumes bip39Words is available in scope
    const seedPhraseWords = words.filter(word => window.bip39Words?.includes(word));
    return seedPhraseWords.length >= Math.min(6, words.length * 0.7);
}

/**
 * Validates that a seed phrase string follows BIP39 standards
 * @param {string} seedPhrase - The seed phrase string to validate
 * @returns {{isValid: boolean, message: string}} Validation result
 */
export function validateSeedPhraseStructure(seedPhrase) {
    if (!seedPhrase) return { isValid: false, message: 'No seed phrase provided' };

    const words = seedPhrase.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Check valid word count (12, 15, 18, 21, or 24)
    if (![12, 15, 18, 21, 24].includes(wordCount)) {
        return {
            isValid: false,
            message: `Invalid word count: ${wordCount}. Expected 12, 15, 18, 21, or 24 words.`
        };
    }

    // Check if BIP39 wordlist is available
    if (!window.bip39Words || window.bip39Words.length === 0) {
        return {
            isValid: false,
            message: `${wordCount} words detected. BIP39 wordlist loading... Please wait.`
        };
    }

    // Check if all words are in BIP39 wordlist
    const invalidWords = words.filter(word => !window.bip39Words.includes(word.toLowerCase()));
    if (invalidWords.length > 0) {
        return {
            isValid: false,
            message: `Invalid BIP39 words: ${invalidWords.slice(0, 3).join(', ')}${invalidWords.length > 3 ? ` (+${invalidWords.length - 3} more)` : ''}`
        };
    }

    return { isValid: true, message: `\u2705 Valid ${wordCount}-word BIP39 seed phrase` };
}

/**
 * Formats a seed phrase string by normalizing whitespace and case
 * @param {string} seedPhrase - The seed phrase string to format
 * @returns {string} Formatted seed phrase
 */
export function formatSeedPhrase(seedPhrase) {
    if (!seedPhrase) return '';

    return seedPhrase
        .toLowerCase()
        .replace(/[\W_]+/g, ' ') // Remove non-word characters except spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
}

/**
 * Updates the validation status UI
 * @param {string} statusId - ID of the status element
 * @param {boolean} isValid - Whether validation passed
 * @param {string} message - Validation message to display
 */
export function updateValidationStatus(statusId, isValid, message) {
    const statusContainer = document.getElementById('seed-phrase-validation-status');
    const statusIcon = document.getElementById('seed-phrase-status-icon');
    const statusMessage = document.getElementById('seed-phrase-status-message');
    const statusDetails = document.getElementById('seed-phrase-status-details');

    // Show the validation status container
    if (statusContainer) {
        statusContainer.classList.remove('hidden');
        // Apply validation state classes
        statusContainer.classList.remove('valid', 'invalid');
        statusContainer.classList.add(isValid ? 'valid' : 'invalid');
    }

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

/**
 * Simple validation wrapper for seed phrase input
 * @param {string} seedPhrase - The seed phrase string to validate
 * @returns {void}
 */
export function validateSeedPhrase() {
    const element = document.getElementById('seed-phrase-input');
    const statusContainer = document.getElementById('seed-phrase-validation-status');
    
    if (!element) return;

    const seedPhrase = element.value.trim();
    
    // Hide validation status if input is empty
    if (!seedPhrase) {
        if (statusContainer) {
            statusContainer.classList.add('hidden');
        }
        return;
    }

    const result = validateSeedPhraseStructure(seedPhrase);
    updateValidationStatus('seed-phrase-input', result.isValid, result.message);

    // If BIP39 wordlist is not loaded yet and we have words, retry after a delay
    if (!result.isValid && (!window.bip39Words || window.bip39Words.length === 0) && seedPhrase.split(/\s+/).length >= 3) {
        setTimeout(() => {
            const retryResult = validateSeedPhraseStructure(element.value.trim());
            updateValidationStatus('seed-phrase-input', retryResult.isValid, retryResult.message);
        }, 2000); // Retry after 2 seconds
    }
}

export async function validateSeedPhraseComprehensive(seedPhrase) {
    // First do basic structural validation
    const structureResult = validateSeedPhraseStructure(seedPhrase);

    if (!structureResult.isValid) {
        return structureResult;
    }

    // If Tauri API is available, use backend validation
    if (window.tauriAPI?.invoke) {
        try {
            const result = await window.tauriAPI.invoke('validate_seed_phrase', { seedPhrase });
            return {
                isValid: result.is_valid,
                message: result.message || structureResult.message
            };
        } catch (error) {
            console.error('Backend validation failed:', error);
            // Fallback to structural validation
            return structureResult;
        }
    }

    // No backend available, return structural validation result
    return structureResult;
}