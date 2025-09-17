use bip39::Mnemonic;
use std::str::FromStr;

fn main() {
    println!("Generating valid BIP39 seed phrases for different word counts...\n");

    // Generate 12-word seed phrase
    let seed_phrase12 = Mnemonic::generate(12).expect("Failed to generate 12-word seed phrase");
    println!("12-word seed phrase:");
    println!("{}", seed_phrase12);
    println!("Word count: {}", seed_phrase12.word_count());
    println!("Valid: {}\n", validate_seed_phrase(&seed_phrase12.to_string()));

    // Generate 15-word seed phrase
    let seed_phrase15 = Mnemonic::generate(15).expect("Failed to generate 15-word seed phrase");
    println!("15-word seed phrase:");
    println!("{}", seed_phrase15);
    println!("Word count: {}", seed_phrase15.word_count());
    println!("Valid: {}\n", validate_seed_phrase(&seed_phrase15.to_string()));

    // Generate 18-word seed phrase
    let seed_phrase18 = Mnemonic::generate(18).expect("Failed to generate 18-word seed phrase");
    println!("18-word seed phrase:");
    println!("{}", seed_phrase18);
    println!("Word count: {}", seed_phrase18.word_count());
    println!("Valid: {}\n", validate_seed_phrase(&seed_phrase18.to_string()));

    // Generate 21-word seed phrase
    let seed_phrase21 = Mnemonic::generate(21).expect("Failed to generate 21-word seed phrase");
    println!("21-word seed phrase:");
    println!("{}", seed_phrase21);
    println!("Word count: {}", seed_phrase21.word_count());
    println!("Valid: {}\n", validate_seed_phrase(&seed_phrase21.to_string()));

    // Generate 24-word seed phrase
    let seed_phrase24 = Mnemonic::generate(24).expect("Failed to generate 24-word seed phrase");
    println!("24-word seed phrase:");
    println!("{}", seed_phrase24);
    println!("Word count: {}", seed_phrase24.word_count());
    println!("Valid: {}\n", validate_seed_phrase(&seed_phrase24.to_string()));
}

fn validate_seed_phrase(seed_phrase_str: &str) -> bool {
    Mnemonic::from_str(seed_phrase_str).is_ok()
}