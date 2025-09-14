use rand::seq::SliceRandom;
use rand::thread_rng;
use std::collections::HashSet;
use std::fs;
use std::path::Path;

use crate::ValidationResult;

// EFF Large Wordlist embedded as a fallback
const EFF_WORDLIST: &str = include_str!("../../resources/eff_large_wordlist.txt");

pub fn load_eff_wordlist() -> Result<HashSet<String>, Box<dyn std::error::Error>> {
    let mut wordlist = HashSet::new();
    
    // Try to load from external file first
    let external_paths = [
        "resources/eff_large_wordlist.txt",
        "../resources/eff_large_wordlist.txt",
        "../../resources/eff_large_wordlist.txt",
    ];
    
    let mut loaded_from_file = false;
    for path in &external_paths {
        if Path::new(path).exists() {
            match fs::read_to_string(path) {
                Ok(content) => {
                    for line in content.lines() {
                        let line = line.trim();
                        if !line.is_empty() && !line.starts_with('#') {
                            // EFF wordlist format: "11111 abacus"
                            if let Some(word) = line.split_whitespace().nth(1) {
                                wordlist.insert(word.to_lowercase());
                            }
                        }
                    }
                    loaded_from_file = true;
                    break;
                }
                Err(_) => continue,
            }
        }
    }
    
    // Fallback to embedded wordlist
    if !loaded_from_file {
        for line in EFF_WORDLIST.lines() {
            let line = line.trim();
            if !line.is_empty() && !line.starts_with('#') {
                if let Some(word) = line.split_whitespace().nth(1) {
                    wordlist.insert(word.to_lowercase());
                }
            }
        }
    }
    
    if wordlist.is_empty() {
        return Err("Failed to load any words from wordlist".into());
    }
    
    Ok(wordlist)
}

pub fn generate_diceware_passphrase(
    word_count: usize,
    wordlist: &HashSet<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    if wordlist.is_empty() {
        return Err("Wordlist is empty".into());
    }
    
    if word_count == 0 {
        return Err("Word count must be greater than 0".into());
    }
    
    let words: Vec<&String> = wordlist.iter().collect();
    let mut rng = thread_rng();
    let mut selected_words = Vec::new();
    
    for _ in 0..word_count {
        if let Some(word) = words.choose(&mut rng) {
            selected_words.push((*word).clone());
        }
    }
    
    if selected_words.len() != word_count {
        return Err("Failed to generate enough words".into());
    }
    
    Ok(selected_words.join(" "))
}

pub fn validate_passphrase(passphrase: &str, wordlist: &HashSet<String>) -> ValidationResult {
    let words: Vec<&str> = passphrase.split_whitespace().collect();
    let mut errors = Vec::new();
    let mut valid_words = Vec::new();
    let mut invalid_words = Vec::new();
    
    // Check minimum word count
    if words.len() < 3 {
        errors.push("Passphrase must contain at least 3 words".to_string());
    }
    
    // Check maximum word count (reasonable limit)
    if words.len() > 20 {
        errors.push("Passphrase should not exceed 20 words".to_string());
    }
    
    // Check each word against the wordlist
    for word in &words {
        let word_lower = word.to_lowercase();
        if wordlist.contains(&word_lower) {
            valid_words.push(word.to_string());
        } else {
            invalid_words.push(word.to_string());
            errors.push(format!("'{}' is not in the EFF wordlist", word));
        }
    }
    
    // Check for empty passphrase
    if words.is_empty() {
        errors.push("Passphrase cannot be empty".to_string());
    }
    
    // Check for duplicate words (reduces entropy)
    let unique_words: HashSet<&str> = words.iter().cloned().collect();
    if unique_words.len() != words.len() {
        errors.push("Passphrase contains duplicate words, which reduces security".to_string());
    }
    
    ValidationResult {
        is_valid: errors.is_empty(),
        errors,
        valid_words,
        invalid_words,
    }
}

pub fn calculate_passphrase_entropy(word_count: usize, wordlist_size: usize) -> f64 {
    if word_count == 0 || wordlist_size == 0 {
        return 0.0;
    }
    
    // Entropy = log2(wordlist_size^word_count)
    (word_count as f64) * (wordlist_size as f64).log2()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_wordlist() -> HashSet<String> {
        let mut wordlist = HashSet::new();
        wordlist.insert("correct".to_string());
        wordlist.insert("horse".to_string());
        wordlist.insert("battery".to_string());
        wordlist.insert("staple".to_string());
        wordlist.insert("test".to_string());
        wordlist.insert("word".to_string());
        wordlist
    }

    #[test]
    fn test_validate_valid_passphrase() {
        let wordlist = create_test_wordlist();
        let result = validate_passphrase("correct horse battery", &wordlist);
        
        assert!(result.is_valid);
        assert_eq!(result.valid_words.len(), 3);
        assert_eq!(result.invalid_words.len(), 0);
    }

    #[test]
    fn test_validate_invalid_word() {
        let wordlist = create_test_wordlist();
        let result = validate_passphrase("correct horse invalid", &wordlist);
        
        assert!(!result.is_valid);
        assert_eq!(result.valid_words.len(), 2);
        assert_eq!(result.invalid_words.len(), 1);
        assert!(result.errors.iter().any(|e| e.contains("invalid")));
    }

    #[test]
    fn test_validate_too_few_words() {
        let wordlist = create_test_wordlist();
        let result = validate_passphrase("correct horse", &wordlist);
        
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("at least 3 words")));
    }

    #[test]
    fn test_generate_passphrase() {
        let wordlist = create_test_wordlist();
        let result = generate_diceware_passphrase(4, &wordlist);
        
        assert!(result.is_ok());
        let passphrase = result.unwrap();
        let words: Vec<&str> = passphrase.split_whitespace().collect();
        assert_eq!(words.len(), 4);
        
        // All words should be from the wordlist
        for word in words {
            assert!(wordlist.contains(word));
        }
    }

    #[test]
    fn test_entropy_calculation() {
        let entropy = calculate_passphrase_entropy(4, 7776);
        // 4 words from EFF large wordlist (7776 words) = 4 * log2(7776) ≈ 51.7 bits
        assert!((entropy - 51.7).abs() < 0.1);
    }
}