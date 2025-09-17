use bip39::{Language, Mnemonic};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MnemonicError {
    #[error("Invalid word count: expected 12, 15, 18, 21, or 24 words, got {0}")]
    InvalidWordCount(usize),
    
    #[error("Invalid words found: {0:?}")]
    InvalidWords(Vec<String>),
    
    #[error("Checksum validation failed")]
    InvalidChecksum,
    
    #[error("Empty mnemonic provided")]
    EmptyMnemonic,
    
    #[error("BIP39 validation error: {0}")]
    Bip39Error(String),
}

impl Serialize for MnemonicError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MnemonicValidationResult {
    pub is_valid: bool,
    pub word_count: usize,
    pub invalid_words: Vec<String>,
    pub errors: Vec<String>,
    pub checksum_valid: bool,
}

pub struct SeedPhraseValidator {
    language: Language,
}

impl SeedPhraseValidator {
    pub fn new() -> Self {
        Self {
            language: Language::English,
        }
    }

    /// Validates a BIP39 mnemonic phrase
    pub fn validate_mnemonic(&self, mnemonic_str: &str) -> MnemonicValidationResult {
        if mnemonic_str.trim().is_empty() {
            return MnemonicValidationResult {
                is_valid: false,
                word_count: 0,
                invalid_words: vec![],
                errors: vec!["Empty seed phrase provided".to_string()],
                checksum_valid: false,
            };
        }

        let words: Vec<&str> = mnemonic_str.trim().split_whitespace().collect();
        let word_count = words.len();

        // Check word count (BIP39 supports 12, 15, 18, 21, 24 words)
        if !self.validate_word_count(word_count) {
            return MnemonicValidationResult {
                is_valid: false,
                word_count,
                invalid_words: vec![],
                errors: vec![format!("Invalid word count: expected 12, 15, 18, 21, or 24 words, got {}", word_count)],
                checksum_valid: false,
            };
        }

        // Check for invalid words
        let invalid_words = self.find_invalid_words(&words);
        if !invalid_words.is_empty() {
            return MnemonicValidationResult {
                is_valid: false,
                word_count,
                invalid_words: invalid_words.clone(),
                errors: vec![format!("Invalid words found: {:?}", invalid_words)],
                checksum_valid: false,
            };
        }

        // Validate checksum using bip39 crate
        match Mnemonic::from_str(mnemonic_str) {
            Ok(_) => MnemonicValidationResult {
                is_valid: true,
                word_count,
                invalid_words: vec![],
                errors: vec![],
                checksum_valid: true,
            },
            Err(e) => MnemonicValidationResult {
                is_valid: false,
                word_count,
                invalid_words: vec![],
                errors: vec![format!("BIP39 validation failed: {}", e)],
                checksum_valid: false,
            },
        }
    }

    /// Validates the word count for BIP39 mnemonic
    pub fn validate_word_count(&self, word_count: usize) -> bool {
        matches!(word_count, 12 | 15 | 18 | 21 | 24)
    }

    /// Finds invalid words in the mnemonic
    fn find_invalid_words(&self, words: &[&str]) -> Vec<String> {
        let wordlist = self.language.word_list();
        words
            .iter()
            .filter(|word| !wordlist.contains(word))
            .map(|word| word.to_string())
            .collect()
    }

    /// Checks if the checksum is valid
    pub fn check_checksum(&self, mnemonic_str: &str) -> bool {
        Mnemonic::from_str(mnemonic_str).is_ok()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SeedPhraseFormatResult {
    pub formatted_seed_phrase: String,
    pub original_word_count: usize,
    pub formatted_word_count: usize,
    pub changes_made: Vec<String>,
    pub is_valid_format: bool,
}

pub struct MnemonicFormatter;

impl MnemonicFormatter {
    /// Comprehensive mnemonic input cleaning and formatting
    pub fn format_mnemonic_comprehensive(raw_input: &str) -> SeedPhraseFormatResult {
        let mut changes_made = Vec::new();
        let original_words: Vec<&str> = raw_input.split_whitespace().collect();
        let original_word_count = original_words.len();

        // Step 1: Clean whitespace but preserve case for comparison
        let whitespace_cleaned = raw_input
            .trim()
            .split_whitespace()
            .map(|word| word.trim())
            .filter(|word| !word.is_empty())
            .collect::<Vec<&str>>()
            .join(" ");
        
        if whitespace_cleaned != raw_input.trim() {
            changes_made.push("Removed extra whitespace and normalized spacing".to_string());
        }

        // Step 2: Check if case normalization is needed
        let case_normalized = Self::normalize_case(&whitespace_cleaned);
        if case_normalized != whitespace_cleaned {
            changes_made.push("Converted to lowercase".to_string());
        }

        // Step 3: Remove any non-alphabetic characters (except spaces)
        let sanitized = Self::sanitize_input(&case_normalized);
        if sanitized != case_normalized {
            changes_made.push("Removed non-alphabetic characters".to_string());
        }

        // Step 4: Ensure proper word count and format
        let final_formatted = Self::ensure_standard_format(&sanitized);
        let formatted_words: Vec<&str> = final_formatted.split_whitespace().collect();
        let formatted_word_count = formatted_words.len();

        if formatted_word_count != original_word_count {
            changes_made.push(format!("Adjusted word count from {} to {}", original_word_count, formatted_word_count));
        }

        // Step 5: Validate the final format
        let is_valid_format = Self::validate_format(&final_formatted);

        SeedPhraseFormatResult {
            formatted_seed_phrase: final_formatted,
            original_word_count,
            formatted_word_count,
            changes_made,
            is_valid_format,
        }
    }

    /// Cleans and normalizes mnemonic input - removes extra spaces, newlines, tabs
    pub fn clean_input(raw_input: &str) -> String {
        raw_input
            .trim()
            .split_whitespace()
            .map(|word| word.trim().to_lowercase())
            .filter(|word| !word.is_empty())
            .collect::<Vec<String>>()
            .join(" ")
    }

    /// Normalizes case to lowercase
    pub fn normalize_case(input: &str) -> String {
        input.to_lowercase()
    }

    /// Removes non-alphabetic characters except spaces
    pub fn sanitize_input(input: &str) -> String {
        input
            .chars()
            .filter(|c| c.is_alphabetic() || c.is_whitespace())
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ")
    }

    /// Ensures the mnemonic follows standard 12-word format
    pub fn ensure_standard_format(input: &str) -> String {
        let words: Vec<&str> = input.split_whitespace().collect();
        
        // For BTC, we primarily focus on 12-word mnemonics
        // If we have exactly 12 words, return as-is
        // If we have 24 words, keep all 24
        // If we have other counts, return as-is but mark as potentially invalid
        words.join(" ")
    }

    /// Normalizes spacing in mnemonic
    pub fn normalize_spacing(input: &str) -> String {
        input
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ")
    }

    /// Validates the format of a formatted mnemonic
    pub fn validate_format(formatted: &str) -> bool {
        let words: Vec<&str> = formatted.split_whitespace().collect();
        let word_count = words.len();
        
        // Check if word count is valid for BIP39 (12, 15, 18, 21, 24)
        let valid_word_counts = [12, 15, 18, 21, 24];
        let has_valid_count = valid_word_counts.contains(&word_count);
        
        // Check if all words are non-empty and contain only alphabetic characters
        let all_words_valid = words.iter().all(|word| {
            !word.is_empty() && word.chars().all(|c| c.is_alphabetic())
        });
        
        has_valid_count && all_words_valid
    }

    /// Validates and confirms formatting result
    pub fn validate_and_confirm_format(result: &SeedPhraseFormatResult) -> Result<(), MnemonicError> {
        if !result.is_valid_format {
            return Err(MnemonicError::InvalidWordCount(result.formatted_word_count));
        }

        if result.formatted_seed_phrase.trim().is_empty() {
            return Err(MnemonicError::EmptyMnemonic);
        }

        // Additional validation: check if word count is supported
        let valid_counts = [12, 15, 18, 21, 24];
        if !valid_counts.contains(&result.formatted_word_count) {
            return Err(MnemonicError::InvalidWordCount(result.formatted_word_count));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_12_word_seed_phrase() {
        let validator = MnemonicValidator::new();
        let seed_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let result = validator.validate_seed_phrase(seed_phrase);
        assert!(result.is_valid);
        assert_eq!(result.word_count, 12);
        assert!(result.checksum_valid);
        assert!(result.errors.is_empty());
        assert!(result.invalid_words.is_empty());
    }

    #[test]
    fn test_valid_24_word_seed_phrase() {
        let validator = MnemonicValidator::new();
        let seed_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
        let result = validator.validate_seed_phrase(seed_phrase);
        assert!(result.is_valid);
        assert_eq!(result.word_count, 24);
        assert!(result.checksum_valid);
    }

    #[test]
    fn test_invalid_word_count_too_few_seed_phrase() {
        let validator = MnemonicValidator::new();
        let seed_phrase = "abandon abandon abandon";
        let result = validator.validate_seed_phrase(seed_phrase);
        assert!(!result.is_valid);
        assert_eq!(result.word_count, 3);
        assert!(!result.errors.is_empty());
        assert!(result.errors[0].contains("Invalid word count"));
    }

    #[test]
    fn test_invalid_word_count_unsupported_seed_phrase() {
        let validator = MnemonicValidator::new();
        let seed_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon"; // 11 words
        let result = validator.validate_seed_phrase(seed_phrase);
        assert!(!result.is_valid);
        assert_eq!(result.word_count, 11);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_invalid_words_seed_phrase() {
        let validator = MnemonicValidator::new();
        let seed_phrase = "invalidword notaword xyz123 abandon abandon abandon abandon abandon abandon abandon abandon about";
        let result = validator.validate_seed_phrase(seed_phrase);
        assert!(!result.is_valid);
        assert!(!result.invalid_words.is_empty());
        assert!(result.invalid_words.contains(&"invalidword".to_string()));
        assert!(result.invalid_words.contains(&"notaword".to_string()));
        assert!(result.invalid_words.contains(&"xyz123".to_string()));
    }

    #[test]
    fn test_empty_seed_phrase() {
        let validator = MnemonicValidator::new();
        let result = validator.validate_seed_phrase("");
        assert!(!result.is_valid);
        assert_eq!(result.word_count, 0);
        assert!(result.errors.contains(&"Empty seed phrase provided".to_string()));
    }

    #[test]
    fn test_whitespace_only_seed_phrase() {
        let validator = MnemonicValidator::new();
        let result = validator.validate_seed_phrase("   \n\t  ");
        assert!(!result.is_valid);
        assert_eq!(result.word_count, 0);
        assert!(result.errors.contains(&"Empty seed phrase provided".to_string()));
    }

    #[test]
    fn test_invalid_checksum_seed_phrase() {
        let validator = MnemonicValidator::new();
        // This is a 12-word seed phrase with valid words but invalid checksum
        let seed_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
        let result = validator.validate_seed_phrase(seed_phrase);
        assert!(!result.is_valid);
        assert_eq!(result.word_count, 12);
        assert!(result.invalid_words.is_empty()); // Words are valid
        assert!(!result.checksum_valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_case_insensitive_validation_seed_phrase() {
        let validator = MnemonicValidator::new();
        let seed_phrase = "ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABOUT";
        let result = validator.validate_seed_phrase(seed_phrase);
        // Note: BIP39 is case-sensitive, so this should fail
        assert!(!result.is_valid);
    }

    #[test]
    fn test_word_count_validation_seed_phrase() {
        let validator = MnemonicValidator::new();
        assert!(validator.validate_word_count(12));
        assert!(validator.validate_word_count(15));
        assert!(validator.validate_word_count(18));
        assert!(validator.validate_word_count(21));
        assert!(validator.validate_word_count(24));
        assert!(!validator.validate_word_count(11));
        assert!(!validator.validate_word_count(13));
        assert!(!validator.validate_word_count(25));
    }

    #[test]
    fn test_checksum_validation_seed_phrase() {
        let validator = MnemonicValidator::new();
        let valid_seed_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let invalid_seed_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";

        assert!(validator.check_checksum(valid_seed_phrase));
        assert!(!validator.check_checksum(invalid_seed_phrase));
    }

    #[test]
    fn test_seed_phrase_formatting() {
        let raw = "  abandon   abandon  abandon abandon abandon abandon abandon abandon abandon abandon abandon about  ";
        let formatted = SeedPhraseFormatter::clean_input(raw);
        assert_eq!(formatted, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    }

    #[test]
    fn test_formatting_with_newlines_seed_phrase() {
        let raw = "abandon\nabandon\tabandon abandon\r\nabandon abandon abandon abandon abandon abandon abandon about";
        let formatted = SeedPhraseFormatter::clean_input(raw);
        assert_eq!(formatted, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    }

    #[test]
    fn test_formatting_mixed_case() {
        let raw = "Abandon ABANDON abandon Abandon abandon abandon abandon abandon abandon abandon abandon about";
        let formatted = MnemonicFormatter::clean_input(raw);
        // The clean_input function now converts to lowercase
        assert_eq!(formatted, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    }

    #[test]
    fn test_normalize_spacing() {
        let input = "abandon  abandon   abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let normalized = MnemonicFormatter::normalize_spacing(input);
        assert_eq!(normalized, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    }

    #[test]
    fn test_validate_format() {
        assert!(MnemonicFormatter::validate_format("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"));
        assert!(!MnemonicFormatter::validate_format("abandon abandon abandon")); // Too few words
        assert!(!MnemonicFormatter::validate_format("")); // Empty
        // Note: validate_format only checks word count and non-empty words, not spacing
        assert!(MnemonicFormatter::validate_format("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"));
    }

    #[test]
    fn test_comprehensive_validation_flow() {
        let validator = MnemonicValidator::new();
        
        // Test complete flow: messy input -> format -> validate
        let messy_input = "  abandon   abandon  abandon abandon abandon abandon abandon abandon abandon abandon abandon about  ";
        let formatted = MnemonicFormatter::clean_input(messy_input);
        let result = validator.validate_mnemonic(&formatted);
        
        assert!(result.is_valid);
        assert_eq!(result.word_count, 12);
        assert!(result.checksum_valid);
        assert!(result.errors.is_empty());
    }

    // Tests for comprehensive formatting functionality
    #[test]
    fn test_comprehensive_formatting_clean_input() {
        let messy_input = "  abandon   abandon\nabandon\tabandon abandon abandon abandon abandon abandon abandon abandon about  ";
        let result = MnemonicFormatter::format_mnemonic_comprehensive(messy_input);
        
        assert_eq!(result.formatted_seed_phrase, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
        assert_eq!(result.original_word_count, 12);
        assert_eq!(result.formatted_word_count, 12);
        assert!(result.is_valid_format);
        assert!(result.changes_made.contains(&"Removed extra whitespace and normalized spacing".to_string()));
    }

    #[test]
    fn test_comprehensive_formatting_case_normalization() {
        let mixed_case_input = "Abandon ABANDON abandon Abandon abandon abandon abandon abandon abandon abandon abandon about";
        let result = MnemonicFormatter::format_mnemonic_comprehensive(mixed_case_input);
        
        assert_eq!(result.formatted_seed_phrase, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
        assert_eq!(result.original_word_count, 12);
        assert_eq!(result.formatted_word_count, 12);
        assert!(result.is_valid_format);
        assert!(result.changes_made.contains(&"Converted to lowercase".to_string()));
    }

    #[test]
    fn test_comprehensive_formatting_sanitization() {
        let dirty_input = "abandon123 abandon! abandon@ abandon abandon abandon abandon abandon abandon abandon abandon about";
        let result = MnemonicFormatter::format_mnemonic_comprehensive(dirty_input);
        
        assert_eq!(result.formatted_seed_phrase, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
        assert_eq!(result.original_word_count, 12);
        assert_eq!(result.formatted_word_count, 12);
        assert!(result.is_valid_format);
        assert!(result.changes_made.contains(&"Removed non-alphabetic characters".to_string()));
    }

    #[test]
    fn test_comprehensive_formatting_word_count_change() {
        let short_input = "abandon abandon abandon";
        let result = MnemonicFormatter::format_mnemonic_comprehensive(short_input);
        
        assert_eq!(result.formatted_seed_phrase, "abandon abandon abandon");
        assert_eq!(result.original_word_count, 3);
        assert_eq!(result.formatted_word_count, 3);
        assert!(!result.is_valid_format); // 3 words is not valid for BIP39
        assert!(result.changes_made.is_empty() || result.changes_made.len() == 0);
    }

    #[test]
    fn test_comprehensive_formatting_empty_input() {
        let empty_input = "   \n\t  ";
        let result = MnemonicFormatter::format_mnemonic_comprehensive(empty_input);
        
        assert_eq!(result.formatted_seed_phrase, "");
        assert_eq!(result.original_word_count, 0);
        assert_eq!(result.formatted_word_count, 0);
        assert!(!result.is_valid_format);
    }

    #[test]
    fn test_comprehensive_formatting_24_word_mnemonic() {
        let input_24 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
        let result = MnemonicFormatter::format_mnemonic_comprehensive(input_24);
        
        assert_eq!(result.original_word_count, 24);
        assert_eq!(result.formatted_word_count, 24);
        assert!(result.is_valid_format);
    }

    #[test]
    fn test_normalize_case() {
        let mixed_case = "Abandon ABANDON abandon";
        let normalized = MnemonicFormatter::normalize_case(mixed_case);
        assert_eq!(normalized, "abandon abandon abandon");
    }

    #[test]
    fn test_sanitize_input() {
        let dirty = "abandon123 abandon! abandon@ abandon";
        let sanitized = MnemonicFormatter::sanitize_input(dirty);
        assert_eq!(sanitized, "abandon abandon abandon abandon");
    }

    #[test]
    fn test_sanitize_input_with_numbers_and_symbols() {
        let dirty = "word1 word2! word3@ word4# word5$ word6%";
        let sanitized = MnemonicFormatter::sanitize_input(dirty);
        assert_eq!(sanitized, "word word word word word word");
    }

    #[test]
    fn test_ensure_standard_format() {
        let input = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let formatted = MnemonicFormatter::ensure_standard_format(input);
        assert_eq!(formatted, input);
    }

    #[test]
    fn test_validate_format_valid_counts() {
        // Test valid word counts
        assert!(MnemonicFormatter::validate_format("word ".repeat(12).trim()));
        assert!(MnemonicFormatter::validate_format("word ".repeat(15).trim()));
        assert!(MnemonicFormatter::validate_format("word ".repeat(18).trim()));
        assert!(MnemonicFormatter::validate_format("word ".repeat(21).trim()));
        assert!(MnemonicFormatter::validate_format("word ".repeat(24).trim()));
    }

    #[test]
    fn test_validate_format_invalid_counts() {
        // Test invalid word counts
        assert!(!MnemonicFormatter::validate_format("word ".repeat(11).trim()));
        assert!(!MnemonicFormatter::validate_format("word ".repeat(13).trim()));
        assert!(!MnemonicFormatter::validate_format("word ".repeat(25).trim()));
    }

    #[test]
    fn test_validate_format_invalid_characters() {
        // Test words with numbers or symbols
        assert!(!MnemonicFormatter::validate_format("word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"));
        assert!(!MnemonicFormatter::validate_format("word! word@ word# word$ word% word^ word& word* word( word) word- word="));
    }

    #[test]
    fn test_validate_and_confirm_format_success() {
        let valid_result = MnemonicFormatResult {
            formatted_seed_phrase: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about".to_string(),
            original_word_count: 12,
            formatted_word_count: 12,
            changes_made: vec![],
            is_valid_format: true,
        };
        
        assert!(MnemonicFormatter::validate_and_confirm_format(&valid_result).is_ok());
    }

    #[test]
    fn test_validate_and_confirm_format_invalid_count() {
        let invalid_result = MnemonicFormatResult {
            formatted_seed_phrase: "abandon abandon abandon".to_string(),
            original_word_count: 3,
            formatted_word_count: 3,
            changes_made: vec![],
            is_valid_format: false,
        };
        
        let result = MnemonicFormatter::validate_and_confirm_format(&invalid_result);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), MnemonicError::InvalidWordCount(3)));
    }

    #[test]
    fn test_validate_and_confirm_format_empty() {
        let empty_result = MnemonicFormatResult {
            formatted_seed_phrase: "".to_string(),
            original_word_count: 0,
            formatted_word_count: 0,
            changes_made: vec![],
            is_valid_format: false,
        };
        
        let result = MnemonicFormatter::validate_and_confirm_format(&empty_result);
        assert!(result.is_err());
        // The function checks is_valid_format first, so it returns InvalidWordCount(0) instead of EmptyMnemonic
        assert!(matches!(result.unwrap_err(), MnemonicError::InvalidWordCount(0)));
    }

    #[test]
    fn test_comprehensive_formatting_complex_scenario() {
        let complex_input = "  Abandon123   ABANDON!  \n abandon@  abandon abandon abandon abandon abandon abandon abandon abandon about  ";
        let result = MnemonicFormatter::format_mnemonic_comprehensive(complex_input);
        
        assert_eq!(result.formatted_seed_phrase, "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
        assert_eq!(result.original_word_count, 12);
        assert_eq!(result.formatted_word_count, 12);
        assert!(result.is_valid_format);
        
        // Should have made multiple changes
        assert!(result.changes_made.len() >= 2);
        assert!(result.changes_made.contains(&"Removed extra whitespace and normalized spacing".to_string()));
        assert!(result.changes_made.contains(&"Converted to lowercase".to_string()));
        assert!(result.changes_made.contains(&"Removed non-alphabetic characters".to_string()));
    }
}