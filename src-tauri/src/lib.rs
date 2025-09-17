use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri::State;
use thiserror::Error;
use chrono::{DateTime, Utc};
use base64::{engine::general_purpose, Engine as _};
use aes_gcm::{KeyInit, aead::Aead};

pub mod crypto;
pub mod diceware;
pub mod seed_phrase;
pub mod network;
pub mod bip39_wordlist;

use crypto::*;
use diceware::*;
use seed_phrase::*;
use network::*;
use bip39_wordlist::*;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Encryption failed: {0}")]
    EncryptionError(String),
    #[error("Decryption failed: {0}")]
    DecryptionError(String),
    #[error("Validation failed: {0}")]
    ValidationError(String),
    #[error("File operation failed: {0}")]
    FileError(String),
    #[error("Network security violation: {0}")]
    NetworkError(String),
    #[error("Seed phrase validation failed: {0}")]
    SeedPhraseError(String),
    #[error("Crypto operation failed: {0}")]
    CryptoError(#[from] crypto::CryptoError),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptRequest {
    pub content: String,
    pub passphrase: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecryptRequest {
    pub encrypted_content: String,
    pub passphrase: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub valid_words: Vec<String>,
    pub invalid_words: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub is_connected: bool,
    pub warning_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum WalletType {
    MainWallet,
    ColdWallet,
    HotWallet,
    TestWallet,
    Custom(String),
}

impl WalletType {
    pub fn to_string(&self) -> String {
        match self {
            WalletType::MainWallet => "Main Wallet".to_string(),
            WalletType::ColdWallet => "Cold Wallet".to_string(),
            WalletType::HotWallet => "Hot Wallet".to_string(),
            WalletType::TestWallet => "Test Wallet".to_string(),
            WalletType::Custom(name) => name.clone(),
        }
    }

    pub fn from_string(s: &str) -> Self {
        match s {
            "Main Wallet" => WalletType::MainWallet,
            "Cold Wallet" => WalletType::ColdWallet,
            "Hot Wallet" => WalletType::HotWallet,
            "Test Wallet" => WalletType::TestWallet,
            _ => WalletType::Custom(s.to_string()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WalletMetadata {
    pub label: String,
    pub wallet_type: WalletType,
    pub created_at: DateTime<Utc>,
    pub seed_phrase_word_count: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WalletInfo {
    pub label: String,
    pub wallet_type: WalletType,
    pub created_at: DateTime<Utc>,
    pub file_path: Option<String>,
    pub seed_phrase_word_count: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptWithMetadataRequest {
    pub content: String,
    pub passphrase: String,
    pub password: String,
    pub wallet_metadata: Option<WalletMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptWithMetadataResult {
    pub encrypted_content: String,
    pub suggested_filename: String,
    pub wallet_info: Option<WalletInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilenameParseResult {
    pub is_wallet_file: bool,
    pub wallet_info: Option<WalletInfo>,
    pub original_filename: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileIntegrityInfo {
    pub sha256_hash: String,
    pub file_size: u64,
    pub created_at: DateTime<Utc>,
    pub encryption_method: String,
    pub key_derivation: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdvancedEncryptRequest {
    pub content: String,
    pub passphrase: String,
    pub password: Option<String>, // Make password optional
    pub key_derivation_method: Option<String>, // "pbkdf2" or "argon2"
    pub iterations: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdvancedEncryptResult {
    pub encrypted_content: String,
    pub integrity_info: FileIntegrityInfo,
    pub salt: String,
    pub iv: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IntegrityVerificationResult {
    pub is_valid: bool,
    pub expected_hash: String,
    pub actual_hash: String,
    pub message: String,
}

// Application state to hold the wordlist
pub struct AppState {
    pub wordlist: HashSet<String>,
}

#[tauri::command]
async fn encrypt_seed_phrase(
    seed_phrase: String,
    passphrase: String,
    password: Option<String>, // Make password optional
    state: State<'_, AppState>,
) -> Result<String, AppError> {

    // Validate seed phrase first
    let validator = SeedPhraseValidator::new();
    let seed_phrase_validation = validator.validate_seed_phrase(&seed_phrase);
    if !seed_phrase_validation.is_valid {
        return Err(AppError::SeedPhraseError(format!(
            "Seed phrase validation failed: {}",
            seed_phrase_validation.errors.join(", ")
        )));
    }

    // Validate passphrase
    let validation = validate_passphrase(&passphrase, &state.wordlist);
    if !validation.is_valid {
        return Err(AppError::ValidationError(format!(
            "Invalid passphrase: {}",
            validation.errors.join(", ")
        )));
    }

    // Use empty string if password is not provided
    let password = password.unwrap_or_default();

    // Perform encryption
    encrypt_data(&seed_phrase, &passphrase, &password)
        .map_err(|e| AppError::EncryptionError(e.to_string()))
}

#[tauri::command]
async fn decrypt_content(
    request: DecryptRequest,
    state: State<'_, AppState>,
) -> Result<String, AppError> {

    // Validate passphrase
    let validation = validate_passphrase(&request.passphrase, &state.wordlist);
    if !validation.is_valid {
        return Err(AppError::ValidationError(format!(
            "Invalid passphrase: {}",
            validation.errors.join(", ")
        )));
    }

    // Use empty string if password is not provided
    let password = request.password;

    // Perform decryption
    decrypt_data(&request.encrypted_content, &request.passphrase, &password)
        .map_err(|e| AppError::DecryptionError(e.to_string()))
}

#[tauri::command]
async fn generate_passphrase(
    word_count: Option<usize>,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let count = word_count.unwrap_or(6);
    generate_diceware_passphrase(count, &state.wordlist)
        .map_err(|e| AppError::ValidationError(e.to_string()))
}

#[tauri::command]
async fn validate_passphrase_words(
    passphrase: String,
    state: State<'_, AppState>,
) -> Result<ValidationResult, AppError> {
    Ok(validate_passphrase(&passphrase, &state.wordlist))
}

#[tauri::command]
async fn check_network_status() -> Result<NetworkStatus, AppError> {
    let is_connected = is_network_connected().await;
    let warning_message = if is_connected {
        Some("Network connection detected. For maximum security, please disconnect from the internet before performing encryption/decryption operations.".to_string())
    } else {
        None
    };

    Ok(NetworkStatus {
        is_connected,
        warning_message,
    })
}

#[tauri::command]
async fn save_to_file(_content: String, _filename: String) -> Result<(), AppError> {
    // This will be handled by the frontend using the dialog plugin
    // The actual file saving will be done through the frontend
    Ok(())
}

#[tauri::command]
async fn validate_seed_phrase(seed_phrase: String) -> Result<SeedPhraseValidationResult, AppError> {
    let validator = SeedPhraseValidator::new();
    Ok(validator.validate_seed_phrase(&seed_phrase))
}

#[tauri::command]
async fn format_seed_phrase(raw_input: String) -> Result<String, AppError> {
    let formatted = SeedPhraseFormatter::clean_input(&raw_input);
    
    // Validate the formatted result
    if !SeedPhraseFormatter::validate_format(&formatted) {
        return Err(AppError::SeedPhraseError(
            "Failed to format seed phrase properly".to_string()
        ));
    }
    
    Ok(formatted)
}

#[tauri::command]
async fn format_seed_phrase_comprehensive(raw_input: String) -> Result<SeedPhraseFormatResult, AppError> {
    let result = SeedPhraseFormatter::format_seed_phrase_comprehensive(&raw_input);
    
    // Validate the formatting result
    if let Err(e) = SeedPhraseFormatter::validate_and_confirm_format(&result) {
        return Err(AppError::SeedPhraseError(format!("Formatting validation failed: {}", e)));
    }
    
    Ok(result)
}

#[tauri::command]
async fn encrypt_seed_phrase_with_wallet_metadata(
    seed_phrase: String,
    passphrase: String,
    password: Option<String>, // Make password optional
    wallet_metadata: Option<WalletMetadata>,
    state: State<'_, AppState>,
) -> Result<EncryptWithMetadataResult, AppError> {

    // Validate seed phrase first
    let validator = SeedPhraseValidator::new();
    let seed_phrase_validation = validator.validate_seed_phrase(&seed_phrase);
    if !seed_phrase_validation.is_valid {
        return Err(AppError::SeedPhraseError(format!(
            "Seed phrase validation failed: {}",
            seed_phrase_validation.errors.join(", ")
        )));
    }

    // Validate passphrase
    let validation = validate_passphrase(&passphrase, &state.wordlist);
    if !validation.is_valid {
        return Err(AppError::ValidationError(format!(
            "Invalid passphrase: {}",
            validation.errors.join(", ")
        )));
    }

    // Use empty string if password is not provided
    let password = password.unwrap_or_default();

    // Perform encryption
    let encrypted_content = encrypt_data(&seed_phrase, &passphrase, &password)
        .map_err(|e| AppError::EncryptionError(e.to_string()))?;

    // Generate filename and wallet info
    let (suggested_filename, wallet_info) = if let Some(mut metadata) = wallet_metadata {
        // Update metadata with actual seed phrase word count
        metadata.seed_phrase_word_count = Some(seed_phrase_validation.word_count);
        
        let filename = generate_wallet_filename(&metadata);
        let wallet_info = WalletInfo {
            label: metadata.label.clone(),
            wallet_type: metadata.wallet_type.clone(),
            created_at: metadata.created_at,
            file_path: None,
            seed_phrase_word_count: Some(seed_phrase_validation.word_count),
        };
        (filename, Some(wallet_info))
    } else {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
        (format!("seed_phrase_{}.bin", timestamp), None)
    };

    Ok(EncryptWithMetadataResult {
        encrypted_content,
        suggested_filename,
        wallet_info,
    })
}

#[tauri::command]
async fn generate_wallet_filename_preview(metadata: WalletMetadata) -> Result<String, AppError> {
    Ok(generate_wallet_filename(&metadata))
}

#[tauri::command]
async fn parse_wallet_filename(filename: String) -> Result<FilenameParseResult, AppError> {
    let result = parse_filename_for_wallet_info(&filename);
    Ok(result)
}

#[tauri::command]
async fn get_preset_wallet_labels() -> Result<Vec<String>, AppError> {
    Ok(vec![
        "Main Wallet".to_string(),
        "Cold Wallet".to_string(),
        "Hot Wallet".to_string(),
        "Test Wallet".to_string(),
        "Hardware Wallet".to_string(),
        "Backup Wallet".to_string(),
        "Multi-sig Wallet".to_string(),
    ])
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityReminderConfig {
    pub show_first_time_guide: bool,
    pub show_post_encryption_reminder: bool,
    pub show_post_decryption_reminder: bool,
    pub integrate_with_network_checks: bool,
}

#[tauri::command]
async fn get_security_reminder_config() -> Result<SecurityReminderConfig, AppError> {
    // Return default security reminder configuration
    // In a real implementation, this could be loaded from user preferences
    Ok(SecurityReminderConfig {
        show_first_time_guide: true,
        show_post_encryption_reminder: true,
        show_post_decryption_reminder: true,
        integrate_with_network_checks: true,
    })
}

#[tauri::command]
async fn check_enhanced_network_security(has_seed_phrase_content: bool) -> Result<NetworkStatus, AppError> {
    let is_connected = is_network_connected().await;
    
    let warning_message = if is_connected {
        if has_seed_phrase_content {
            Some("⚠️ Network connection detected! When handling seed phrases, it is strongly recommended to disconnect from the network to ensure maximum security. Seed phrase leakage may result in asset loss.".to_string())
        } else {
            Some("Network connection detected. For maximum security, please disconnect from the internet before performing encryption/decryption operations.".to_string())
        }
    } else {
        None
    };

    Ok(NetworkStatus {
        is_connected,
        warning_message,
    })
}

#[tauri::command]
async fn get_seed_phrase_suggestions(prefix: String, limit: Option<usize>) -> Result<Vec<String>, AppError> {
    let suggestion_limit = limit.unwrap_or(8);
    Ok(get_bip39_suggestions(&prefix, suggestion_limit))
}

#[tauri::command]
async fn validate_seed_phrase_word(word: String) -> Result<bool, AppError> {
    Ok(is_valid_bip39_word(&word))
}

pub fn generate_wallet_filename(metadata: &WalletMetadata) -> String {
    let timestamp = metadata.created_at.format("%Y%m%d_%H%M%S").to_string();
    let wallet_type_str = metadata.wallet_type.to_string();
    
    // Create a safe filename by replacing invalid characters
    let safe_label = metadata.label
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>();
    
    let word_count_suffix = if let Some(count) = metadata.seed_phrase_word_count {
        format!("_{}words", count)
    } else {
        String::new()
    };
    
    format!("{}_{}{}_{}.bin", 
        safe_label, 
        wallet_type_str, 
        word_count_suffix,
        timestamp
    )
}

pub fn parse_filename_for_wallet_info(filename: &str) -> FilenameParseResult {
    // Remove file extension
    let name_without_ext = filename
        .strip_suffix(".bin")
        .or_else(|| filename.strip_suffix(".txt"))
        .unwrap_or(filename);
    
    // Check if it's a wallet file by looking for BTC pattern
    if !name_without_ext.contains("_BTC_") {
        return FilenameParseResult {
            is_wallet_file: false,
            wallet_info: None,
            original_filename: filename.to_string(),
        };
    }
    
    // Split by underscores and try to parse
    let parts: Vec<&str> = name_without_ext.split('_').collect();
    
    if parts.len() < 4 {
        return FilenameParseResult {
            is_wallet_file: false,
            wallet_info: None,
            original_filename: filename.to_string(),
        };
    }
    
    // Try to extract components
    let mut label = String::new();
    let mut wallet_type_str = String::new();
    let mut word_count: Option<usize> = None;
    let mut timestamp_str = String::new();
    
    // Find BTC position to work backwards
    if let Some(btc_pos) = parts.iter().position(|&x| x == "BTC") {
        if btc_pos > 0 && btc_pos + 1 < parts.len() {
            // Extract timestamp (after BTC)
            timestamp_str = parts[btc_pos + 1].to_string();
            
            // Extract label and wallet type (before BTC)
            let before_btc: Vec<&str> = parts[..btc_pos].to_vec();
            
            if !before_btc.is_empty() {
                // Check if the last part before BTC is a word count
                if let Some(last_part) = before_btc.last() {
                    if last_part.ends_with("words") || last_part.ends_with("词") {
                        let count_str = if last_part.ends_with("words") {
                            last_part.trim_end_matches("words")
                        } else {
                            last_part.trim_end_matches("词")
                        };
                        if let Ok(count) = count_str.parse::<usize>() {
                            word_count = Some(count);
                            // Remove word count from parts
                            let remaining_parts = &before_btc[..before_btc.len() - 1];
                            if remaining_parts.len() >= 2 {
                                label = remaining_parts[0].to_string();
                                wallet_type_str = remaining_parts[1..].join("_");
                            }
                        } else {
                            // No valid word count, treat all as label and type
                            if before_btc.len() >= 2 {
                                label = before_btc[0].to_string();
                                wallet_type_str = before_btc[1..].join("_");
                            }
                        }
                    } else {
                        // No word count suffix
                        if before_btc.len() >= 2 {
                            label = before_btc[0].to_string();
                            wallet_type_str = before_btc[1..].join("_");
                        }
                    }
                }
            }
        }
    }
    
    // Parse timestamp
    let created_at = if !timestamp_str.is_empty() {
        // Try to parse timestamp in format YYYYMMDD_HHMMSS
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&timestamp_str, "%Y%m%d_%H%M%S") {
            DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc)
        } else {
            Utc::now() // Fallback to current time
        }
    } else {
        Utc::now()
    };
    
    if !label.is_empty() && !wallet_type_str.is_empty() {
        let wallet_info = WalletInfo {
            label,
            wallet_type: WalletType::from_string(&wallet_type_str),
            created_at,
            file_path: Some(filename.to_string()),
            seed_phrase_word_count: word_count,
        };
        
        FilenameParseResult {
            is_wallet_file: true,
            wallet_info: Some(wallet_info),
            original_filename: filename.to_string(),
        }
    } else {
        FilenameParseResult {
            is_wallet_file: false,
            wallet_info: None,
            original_filename: filename.to_string(),
        }
    }
}

#[tauri::command]
async fn encrypt_with_advanced_crypto(
    request: AdvancedEncryptRequest,
    state: State<'_, AppState>,
) -> Result<AdvancedEncryptResult, AppError> {
    use sha2::{Sha256, Digest};
    use rand::RngCore;
    
    // Validate passphrase
    let validation = validate_passphrase(&request.passphrase, &state.wordlist);
    if !validation.is_valid {
        return Err(AppError::ValidationError(format!(
            "Invalid passphrase: {}",
            validation.errors.join(", ")
        )));
    }
    
    // Use empty string if password is not provided
    let password = request.password.unwrap_or_default();
    
    // Generate random salt and IV
    let mut salt = [0u8; 32];
    let mut iv = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut iv);
    
    // Choose key derivation method
    let key_derivation_method = request.key_derivation_method
        .unwrap_or_else(|| "pbkdf2".to_string());
    let iterations = request.iterations.unwrap_or(100000);
    
    // Derive key using specified method
    let key = match key_derivation_method.as_str() {
        "argon2" => derive_key_argon2(&request.passphrase, &password, &salt, iterations)?,
        _ => derive_key_pbkdf2(&request.passphrase, &password, &salt, iterations)?,
    };
    
    // Encrypt content with AES-256-GCM
    let encrypted_content = encrypt_data_advanced(&request.content, &key, &iv)
        .map_err(|e| AppError::EncryptionError(e.to_string()))?;
    
    // Calculate SHA256 hash of encrypted content
    let mut hasher = Sha256::new();
    hasher.update(&encrypted_content);
    let hash = format!("{:x}", hasher.finalize());
    
    // Create integrity info
    let integrity_info = FileIntegrityInfo {
        sha256_hash: hash,
        file_size: encrypted_content.len() as u64,
        created_at: Utc::now(),
        encryption_method: "AES-256-GCM".to_string(),
        key_derivation: format!("{}-{}", key_derivation_method, iterations),
    };
    
    // Encode final result
    let final_content = encode_encrypted_with_metadata(&encrypted_content, &salt, &iv, &integrity_info)
        .map_err(|e| AppError::EncryptionError(e.to_string()))?;
    
    Ok(AdvancedEncryptResult {
        encrypted_content: final_content,
        integrity_info,
        salt: general_purpose::STANDARD.encode(&salt),
        iv: general_purpose::STANDARD.encode(&iv),
    })
}

#[tauri::command]
async fn verify_file_integrity(
    encrypted_content: String,
) -> Result<IntegrityVerificationResult, AppError> {
    use sha2::{Sha256, Digest};
    
    // Parse the encrypted content to extract metadata
    let (content_bytes, integrity_info) = parse_encrypted_with_metadata(&encrypted_content)
        .map_err(|e| AppError::ValidationError(e.to_string()))?;
    
    // Calculate actual hash
    let mut hasher = Sha256::new();
    hasher.update(&content_bytes);
    let actual_hash = format!("{:x}", hasher.finalize());
    
    let is_valid = actual_hash == integrity_info.sha256_hash;
    let message = if is_valid {
        "File integrity verified successfully".to_string()
    } else {
        "File integrity verification failed - file may be corrupted or tampered with".to_string()
    };
    
    Ok(IntegrityVerificationResult {
        is_valid,
        expected_hash: integrity_info.sha256_hash,
        actual_hash,
        message,
    })
}

#[tauri::command]
async fn get_file_integrity_info(
    encrypted_content: String,
) -> Result<FileIntegrityInfo, AppError> {
    let (_, integrity_info) = parse_encrypted_with_metadata(&encrypted_content)
        .map_err(|e| AppError::ValidationError(e.to_string()))?;
    
    Ok(integrity_info)
}

#[tauri::command]
async fn decrypt_with_advanced_crypto(
    request: DecryptRequest,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    use sha2::{Sha256, Digest};
    
    // Validate passphrase
    let validation = validate_passphrase(&request.passphrase, &state.wordlist);
    if !validation.is_valid {
        return Err(AppError::ValidationError(format!(
            "Invalid passphrase: {}",
            validation.errors.join(", ")
        )));
    }
    
    // Use empty string if password is not provided
    let password = request.password;
    
    // Parse the encrypted content to extract metadata and encrypted data
    let (encrypted_data, integrity_info) = parse_encrypted_with_metadata(&request.encrypted_content)
        .map_err(|e| AppError::DecryptionError(e.to_string()))?;
    
    // Verify file integrity before decryption
    let mut hasher = Sha256::new();
    hasher.update(&encrypted_data);
    let actual_hash = format!("{:x}", hasher.finalize());
    
    if actual_hash != integrity_info.sha256_hash {
        return Err(AppError::DecryptionError(
            "File integrity verification failed - file may be corrupted or tampered with".to_string()
        ));
    }
    
    // Extract salt and IV from the metadata (they're in the encrypted data structure)
    let data = general_purpose::STANDARD.decode(&request.encrypted_content)
        .map_err(|e| AppError::DecryptionError(format!("Invalid base64 data: {}", e)))?;
    
    // Extract salt (32 bytes starting at position 12) and IV (12 bytes starting at position 44)
    let salt = &data[12..44];
    let iv = &data[44..56];
    
    // Determine key derivation method from metadata
    let key_derivation_parts: Vec<&str> = integrity_info.key_derivation.split('-').collect();
    let key_derivation_method = key_derivation_parts.get(0).unwrap_or(&"pbkdf2");
    let iterations: u32 = key_derivation_parts.get(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(100000);
    
    // Derive key using the same method used for encryption
    let key = match *key_derivation_method {
        "argon2" => derive_key_argon2(&request.passphrase, &password, salt, iterations)?,
        _ => derive_key_pbkdf2(&request.passphrase, &password, salt, iterations)?,
    };
    
    // Decrypt the data
    let cipher = aes_gcm::Aes256Gcm::new_from_slice(&key)
        .map_err(|e| AppError::DecryptionError(format!("Failed to create cipher: {}", e)))?;
    let nonce = aes_gcm::Nonce::from_slice(iv);
    
    let plaintext = cipher.decrypt(nonce, encrypted_data.as_slice())
        .map_err(|e| AppError::DecryptionError(format!("Decryption failed: {}", e)))?;
    
    // Convert to string
    String::from_utf8(plaintext)
        .map_err(|e| AppError::DecryptionError(format!("Invalid UTF-8 data: {}", e)))
}

#[tauri::command]
async fn export_integrity_hash(
    encrypted_content: String,
) -> Result<String, AppError> {
    let integrity_info = get_file_integrity_info(encrypted_content).await?;
    
    let export_data = format!(
        "File Integrity Information\n{}",
        "==========================",
    );
    let export_data = format!(
        "{}\nSHA256 Hash: {}\nFile Size: {} bytes\nCreated: {}\nEncryption: {}\nKey Derivation: {}\n",
        export_data,
        integrity_info.sha256_hash,
        integrity_info.file_size,
        integrity_info.created_at.format("%Y-%m-%d %H:%M:%S UTC"),
        integrity_info.encryption_method,
        integrity_info.key_derivation
    );
    
    Ok(export_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load EFF wordlist
    let wordlist = load_eff_wordlist().unwrap_or_else(|e| {
        eprintln!("Warning: Failed to load EFF wordlist: {}", e);
        HashSet::new()
    });

    let app_state = AppState { wordlist };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            encrypt_seed_phrase,
            decrypt_content,
            decrypt_with_advanced_crypto,
            generate_passphrase,
            validate_passphrase_words,
            check_network_status,
            save_to_file,
            validate_seed_phrase,
            format_seed_phrase,
            format_seed_phrase_comprehensive,
            encrypt_seed_phrase_with_wallet_metadata,
            generate_wallet_filename_preview,
            parse_wallet_filename,
            get_preset_wallet_labels,
            get_security_reminder_config,
            check_enhanced_network_security,
            get_seed_phrase_suggestions,
            validate_seed_phrase_word,
            encrypt_with_advanced_crypto,
            verify_file_integrity,
            get_file_integrity_info,
            export_integrity_hash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
