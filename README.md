# Seed Phrase Shield

A secure, cross-platform seed phrase encryption tool built with Tauri, Rust, and TypeScript.

## Features

- 🔒 **AES-256-GCM Encryption**: Industry-standard encryption with authenticated encryption for seed phrases
- 🎲 **EFF Diceware Passphrases**: Generate and validate secure passphrases using the EFF Large Wordlist
- 🌐 **Network Isolation**: Automatic network monitoring with security warnings
- 💾 **File Operations**: Save and load encrypted content with native file dialogs
- 🎨 **Modern UI**: Clean, responsive Material Design interface
- 🚀 **Cross-Platform**: Native installers for macOS, Windows, and Linux
- 📦 **Small Bundle Size**: ~10-20MB vs 100MB+ for Electron apps

## Security Features

- **PBKDF2 Key Derivation**: 100,000 iterations with SHA-256
- **Secure Random Generation**: Cryptographically secure salt and nonce generation
- **Memory Safety**: Rust's memory safety guarantees prevent buffer overflows
- **Network Monitoring**: Warns users when network connections are detected
- **EFF Wordlist Validation**: Ensures passphrases use only verified secure words

## Usage

### Basic Workflow

1. **Generate Passphrase**: Click "🎲 Generate Secure Passphrase" for a random EFF Diceware passphrase
2. **Enter Seed Phrase**: Type or paste your seed phrase
3. **Set Credentials**: Enter your passphrase and personal password (both required for decryption)
4. **Encrypt**: Click "🔒 Encrypt Content" to generate encrypted output
5. **Save/Share**: Copy the encrypted text or save it to a file

### Decryption

1. **Load Content**: Paste encrypted text or load from file
2. **Enter Credentials**: Use the same passphrase and password from encryption
3. **Decrypt**: Click "🔓 Decrypt Content" to recover original seed phrase

### Security Best Practices

- **Disconnect from Internet**: The app will warn you if network connections are detected
- **Use Strong Passphrases**: Generate passphrases with 6+ words from the EFF wordlist
- **Secure Password Storage**: Use a password manager for your personal passwords
- **Verify Passphrases**: The app validates that all words are from the EFF wordlist

## Architecture

### Frontend (TypeScript/HTML/CSS)
- Modern Material Design interface
- Real-time form validation
- File operations with native dialogs
- Network status monitoring

### Backend (Rust)
- AES-256-GCM encryption implementation
- EFF Diceware passphrase generation
- PBKDF2 key derivation (100,000 iterations)
- Network connectivity detection

### Communication
- Tauri's IPC (Inter-Process Communication)
- Type-safe command invocation
- Structured error handling

## License

This project is licensed under the GPL-3.0 License with additional non-commercial use restrictions - see the LICENSE file for details.

**Important**: This software may not be used for commercial purposes without explicit written permission from the copyright holders.

## Security

This application is designed for maximum security:

- **No Network Dependencies**: All operations are performed locally
- **Memory Safety**: Rust prevents buffer overflows and memory corruption
- **Secure Defaults**: Uses industry-standard cryptographic parameters
- **Open Source**: Full source code available for security auditing

## Acknowledgments

- **EFF**: For the [Large Wordlist](https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases) used in Diceware passphrase generation
- **Tauri Team**: For the excellent cross-platform framework
- **Rust Crypto**: For the cryptographic implementations