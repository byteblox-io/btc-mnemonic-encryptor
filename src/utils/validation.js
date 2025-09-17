// Validation utilities for seed phrase security

/**
 * Checks if an element is a mnemonic field based on ID or parent container
 * @param {HTMLElement} element - The DOM element to check
 * @returns {boolean} True if element is a mnemonic field
 */
export function isMnemonicField(element) {
    if (!element) return false;

    return element.id === 'btc-mnemonic-input' ||
           element.closest('.mnemonic-input-container') !== null ||
           (element.value && containsMnemonicWords(element.value));
}

/**
 * Determines if text contains BIP39 mnemonic words
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
 * Validates that a mnemonic string follows BIP39 standards
 * @param {string} mnemonic - The mnemonic string to validate
 * @returns {{isValid: boolean, message: string}} Validation result
 */
export function validateMnemonicStructure(mnemonic) {
    if (!mnemonic) return { isValid: false, message: 'No mnemonic provided' };

    const words = mnemonic.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Check valid word count (12, 15, 18, 21, or 24)
    if (![12, 15, 18, 21, 24].includes(wordCount)) {
        return {
            isValid: false,
            message: `Invalid word count: ${wordCount}. Expected 12, 15, 18, 21, or 24 words.`
        };
    }

    // Check if all words are in BIP39 wordlist
    const invalidWords = words.filter(word => !window.bip39Words?.includes(word.toLowerCase()));
    if (invalidWords.length > 0) {
        return {
            isValid: false,
            message: `Invalid words: ${invalidWords.join(', ')}`
        };
    }

    return { isValid: true, message: `${wordCount} words detected - basic validation passed` };
}

/**
 * Formats a mnemonic string by normalizing whitespace and case
 * @param {string} mnemonic - The mnemonic string to format
 * @returns {string} Formatted mnemonic
 */
export function formatMnemonic(mnemonic) {
    if (!mnemonic) return '';

    return mnemonic
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

/**
 * Performs comprehensive mnemonic validation
 * @param {string} mnemonic - The mnemonic string to validate
 * @returns {Promise<{isValid: boolean, message: string}>} Validation result
 */
export async function validateMnemonicComprehensive(mnemonic) {
    // First do basic structural validation
    const structureResult = validateMnemonicStructure(mnemonic);

    if (!structureResult.isValid) {
        return structureResult;
    }

    // If Tauri API is available, use backend validation
    if (window.tauriAPI?.invoke) {
        try {
            const result = await window.tauriAPI.invoke('validate_btc_mnemonic', { mnemonic });
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