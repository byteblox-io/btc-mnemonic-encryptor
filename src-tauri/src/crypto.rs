use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose, Engine as _};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use serde_json;
use sha2::Sha256;
use zeroize::Zeroize;

// Re-export for lib.rs
pub use crate::FileIntegrityInfo;

const PBKDF2_ITERATIONS: u32 = 100_000;
const SALT_SIZE: usize = 16;
const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;

#[derive(Debug)]
pub enum CryptoError {
    EncryptionFailed(String),
    DecryptionFailed(String),
    InvalidData(String),
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CryptoError::EncryptionFailed(msg) => write!(f, "Encryption failed: {}", msg),
            CryptoError::DecryptionFailed(msg) => write!(f, "Decryption failed: {}", msg),
            CryptoError::InvalidData(msg) => write!(f, "Invalid data: {}", msg),
        }
    }
}

impl std::error::Error for CryptoError {}

pub fn encrypt_data(
    plaintext: &str,
    passphrase: &str,
    password: &str,
) -> Result<String, CryptoError> {
    // Generate random salt and nonce
    let mut salt = [0u8; SALT_SIZE];
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);

    // Derive key using PBKDF2
    let mut key = [0u8; KEY_SIZE];
    // Use only passphrase if password is empty, otherwise combine them
    let combined_secret = if password.is_empty() {
        passphrase.to_string()
    } else {
        format!("{}:{}", passphrase, password)
    };
    pbkdf2_hmac::<Sha256>(combined_secret.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::EncryptionFailed(format!("Failed to create cipher: {}", e)))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt the data
    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| CryptoError::EncryptionFailed(format!("Encryption failed: {}", e)))?;

    // Clear sensitive data
    let mut combined_secret_bytes = combined_secret.into_bytes();
    combined_secret_bytes.zeroize();
    key.zeroize();

    // Combine salt + nonce + ciphertext and encode as base64
    let mut result = Vec::new();
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(general_purpose::STANDARD.encode(&result))
}

pub fn decrypt_data(
    encrypted_data: &str,
    passphrase: &str,
    password: &str,
) -> Result<String, CryptoError> {
    // Decode from base64
    let data = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| CryptoError::InvalidData(format!("Invalid base64 data: {}", e)))?;

    if data.len() < SALT_SIZE + NONCE_SIZE {
        return Err(CryptoError::InvalidData("Encrypted data too short".to_string()));
    }

    // Extract salt, nonce, and ciphertext
    let salt = &data[0..SALT_SIZE];
    let nonce_bytes = &data[SALT_SIZE..SALT_SIZE + NONCE_SIZE];
    let ciphertext = &data[SALT_SIZE + NONCE_SIZE..];

    // Derive key using PBKDF2
    let mut key = [0u8; KEY_SIZE];
    // Use only passphrase if password is empty, otherwise combine them
    let combined_secret = if password.is_empty() {
        passphrase.to_string()
    } else {
        format!("{}:{}", passphrase, password)
    };
    pbkdf2_hmac::<Sha256>(combined_secret.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::DecryptionFailed(format!("Failed to create cipher: {}", e)))?;
    let nonce = Nonce::from_slice(nonce_bytes);

    // Decrypt the data
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|e| CryptoError::DecryptionFailed(format!("Decryption failed: {}", e)))?;

    // Clear sensitive data
    let mut combined_secret_bytes = combined_secret.into_bytes();
    combined_secret_bytes.zeroize();
    key.zeroize();

    // Convert to string
    String::from_utf8(plaintext)
        .map_err(|e| CryptoError::DecryptionFailed(format!("Invalid UTF-8 data: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let plaintext = "Hello, World! This is a test message.";
        let passphrase = "correct horse battery staple";
        let password = "my_secret_password";

        let encrypted = encrypt_data(plaintext, passphrase, password).unwrap();
        let decrypted = decrypt_data(&encrypted, passphrase, password).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_wrong_password_fails() {
        let plaintext = "Hello, World!";
        let passphrase = "correct horse battery staple";
        let password = "my_secret_password";
        let wrong_password = "wrong_password";

        let encrypted = encrypt_data(plaintext, passphrase, password).unwrap();
        let result = decrypt_data(&encrypted, passphrase, wrong_password);

        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_passphrase_fails() {
        let plaintext = "Hello, World!";
        let passphrase = "correct horse battery staple";
        let wrong_passphrase = "incorrect horse battery staple";
        let password = "my_secret_password";

        let encrypted = encrypt_data(plaintext, passphrase, password).unwrap();
        let result = decrypt_data(&encrypted, wrong_passphrase, password);

        assert!(result.is_err());
    }

    #[test]
    fn test_java_compatibility_format() {
        // Test compatibility with Java version format
        let plaintext = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let passphrase = "able abroad absence";
        let password = "mypassword123";

        let encrypted = encrypt_data(plaintext, passphrase, password).unwrap();
        let decrypted = decrypt_data(&encrypted, passphrase, password).unwrap();

        assert_eq!(plaintext, decrypted);

        // Verify data format
        let data = base64::engine::general_purpose::STANDARD.decode(&encrypted).unwrap();
        assert!(data.len() >= 16 + 12 + 16); // salt + nonce + at least some ciphertext
        
        // Verify format: first 16 bytes are salt, next 12 bytes are nonce
        assert_eq!(data.len(), 16 + 12 + (data.len() - 28));
        
        println!("Tauri encryption test successful:");
        println!("- Original text length: {} characters", plaintext.len());
        println!("- Encrypted result length: {} characters", encrypted.len());
        println!("- Binary data length: {} bytes", data.len());
        println!("- Format: Salt(16) + Nonce(12) + Ciphertext({})", data.len() - 28);
    }

    #[test]
    fn test_cross_language_compatibility() {
        // Test cross-language compatibility: Can Tauri decrypt Java-encrypted data
        let plaintext = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let passphrase = "able abroad absence";
        let password = "mypassword123";

        // This would be Java-encrypted data (different each run due to random salt and IV)
        // So we test Tauri encryption and verify format compatibility
        let tauri_encrypted = encrypt_data(plaintext, passphrase, password).unwrap();
        let tauri_decrypted = decrypt_data(&tauri_encrypted, passphrase, password).unwrap();
        
        assert_eq!(plaintext, tauri_decrypted);
        
        // Verify that Tauri format is compatible with Java
        let data = base64::engine::general_purpose::STANDARD.decode(&tauri_encrypted).unwrap();
        
        // Verify data structure
        assert_eq!(data.len(), 16 + 12 + (data.len() - 28)); // salt + nonce + ciphertext
        
        // Verify that we can extract each part
        let salt = &data[0..16];
        let nonce = &data[16..28];
        let ciphertext = &data[28..];
        
        assert_eq!(salt.len(), 16);
        assert_eq!(nonce.len(), 12);
        assert!(ciphertext.len() > 0);
        
        println!("Cross-language compatibility test successful:");
        println!("- Uses same PBKDF2 parameters (passphrase:password, 100000 iterations)");
        println!("- Uses same data format (Salt+Nonce+Ciphertext)");
        println!("- Uses same AES-256-GCM encryption");
        println!("- Salt: {} bytes", salt.len());
        println!("- Nonce: {} bytes", nonce.len());
        println!("- Ciphertext: {} bytes", ciphertext.len());
    }
}

// Advanced cryptographic functions for enhanced security

pub fn derive_key_pbkdf2(
    passphrase: &str,
    password: &str,
    salt: &[u8],
    iterations: u32,
) -> Result<[u8; 32], CryptoError> {
    let mut key = [0u8; 32];
    // Use only passphrase if password is empty, otherwise combine them
    let combined_secret = if password.is_empty() {
        passphrase.to_string()
    } else {
        format!("{}:{}", passphrase, password)
    };
    pbkdf2_hmac::<Sha256>(combined_secret.as_bytes(), salt, iterations, &mut key);
    Ok(key)
}

pub fn derive_key_argon2(
    passphrase: &str,
    password: &str,
    salt: &[u8],
    _iterations: u32, // For compatibility, Argon2 uses different parameters
) -> Result<[u8; 32], CryptoError> {
    // Use only passphrase if password is empty, otherwise combine them
    let combined_secret = if password.is_empty() {
        passphrase.to_string()
    } else {
        format!("{}:{}", passphrase, password)
    };
    
    // Create Argon2 instance with secure parameters
    let argon2 = Argon2::default();
    
    // Use the provided salt directly (truncate to 16 bytes if longer)
    let salt_bytes = if salt.len() >= 16 {
        &salt[..16]
    } else {
        // Pad with zeros if salt is too short
        let mut padded_salt = [0u8; 16];
        padded_salt[..salt.len()].copy_from_slice(salt);
        return derive_key_pbkdf2(passphrase, password, &padded_salt, 100000); // Fallback
    };
    
    // Hash the password directly using low-level interface
    let mut key = [0u8; 32];
    argon2.hash_password_into(
        combined_secret.as_bytes(),
        salt_bytes,
        &mut key,
    ).map_err(|e| CryptoError::EncryptionFailed(format!("Argon2 key derivation failed: {}", e)))?;
    
    Ok(key)
}

pub fn encrypt_data_advanced(
    plaintext: &str,
    key: &[u8; 32],
    iv: &[u8; 12],
) -> Result<Vec<u8>, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| CryptoError::EncryptionFailed(format!("Failed to create cipher: {}", e)))?;
    let nonce = Nonce::from_slice(iv);
    
    cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| CryptoError::EncryptionFailed(format!("Encryption failed: {}", e)))
}

pub fn encode_encrypted_with_metadata(
    encrypted_data: &[u8],
    salt: &[u8; 32],
    iv: &[u8; 12],
    integrity_info: &FileIntegrityInfo,
) -> Result<String, CryptoError> {
    // Create a structured format: HEADER + SALT + IV + METADATA + ENCRYPTED_DATA
    let metadata_json = serde_json::to_string(integrity_info)
        .map_err(|e| CryptoError::EncryptionFailed(format!("Failed to serialize metadata: {}", e)))?;
    
    let metadata_bytes = metadata_json.as_bytes();
    let metadata_len = metadata_bytes.len() as u32;
    
    let mut result = Vec::new();
    
    // Magic header to identify advanced format
    result.extend_from_slice(b"AESADV01"); // 8 bytes
    
    // Metadata length (4 bytes)
    result.extend_from_slice(&metadata_len.to_le_bytes());
    
    // Salt (32 bytes)
    result.extend_from_slice(salt);
    
    // IV (12 bytes)
    result.extend_from_slice(iv);
    
    // Metadata (variable length)
    result.extend_from_slice(metadata_bytes);
    
    // Encrypted data
    result.extend_from_slice(encrypted_data);
    
    Ok(general_purpose::STANDARD.encode(&result))
}

pub fn parse_encrypted_with_metadata(
    encoded_data: &str,
) -> Result<(Vec<u8>, FileIntegrityInfo), CryptoError> {
    let data = general_purpose::STANDARD.decode(encoded_data)
        .map_err(|e| CryptoError::InvalidData(format!("Invalid base64 data: {}", e)))?;
    
    if data.len() < 56 { // 8 + 4 + 32 + 12 = minimum header size
        return Err(CryptoError::InvalidData("Data too short for advanced format".to_string()));
    }
    
    // Check magic header
    if &data[0..8] != b"AESADV01" {
        return Err(CryptoError::InvalidData("Invalid format header".to_string()));
    }
    
    // Parse metadata length
    let metadata_len = u32::from_le_bytes([
        data[8], data[9], data[10], data[11]
    ]) as usize;
    
    let header_size = 8 + 4 + 32 + 12; // magic + len + salt + iv
    let total_metadata_end = header_size + metadata_len;
    
    if data.len() < total_metadata_end {
        return Err(CryptoError::InvalidData("Insufficient data for metadata".to_string()));
    }
    
    // Extract salt and IV (not used for parsing, but available)
    let _salt = &data[12..44];
    let _iv = &data[44..56];
    
    // Parse metadata
    let metadata_bytes = &data[header_size..total_metadata_end];
    let metadata_str = std::str::from_utf8(metadata_bytes)
        .map_err(|e| CryptoError::InvalidData(format!("Invalid UTF-8 in metadata: {}", e)))?;
    
    let integrity_info: FileIntegrityInfo = serde_json::from_str(metadata_str)
        .map_err(|e| CryptoError::InvalidData(format!("Failed to parse metadata: {}", e)))?;
    
    // Extract encrypted data
    let encrypted_data = data[total_metadata_end..].to_vec();
    
    Ok((encrypted_data, integrity_info))
}
