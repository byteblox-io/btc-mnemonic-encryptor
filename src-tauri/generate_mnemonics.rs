use bip39::Mnemonic;
use std::str::FromStr;

fn main() {
    println!("Generating valid BIP39 mnemonics for different word counts...\n");

    // Generate 12-word mnemonic
    let mnemonic12 = Mnemonic::generate(12).expect("Failed to generate 12-word mnemonic");
    println!("12-word mnemonic:");
    println!("{}", mnemonic12);
    println!("Word count: {}", mnemonic12.word_count());
    println!("Valid: {}\n", validate_mnemonic(&mnemonic12.to_string()));

    // Generate 15-word mnemonic
    let mnemonic15 = Mnemonic::generate(15).expect("Failed to generate 15-word mnemonic");
    println!("15-word mnemonic:");
    println!("{}", mnemonic15);
    println!("Word count: {}", mnemonic15.word_count());
    println!("Valid: {}\n", validate_mnemonic(&mnemonic15.to_string()));

    // Generate 18-word mnemonic
    let mnemonic18 = Mnemonic::generate(18).expect("Failed to generate 18-word mnemonic");
    println!("18-word mnemonic:");
    println!("{}", mnemonic18);
    println!("Word count: {}", mnemonic18.word_count());
    println!("Valid: {}\n", validate_mnemonic(&mnemonic18.to_string()));

    // Generate 21-word mnemonic
    let mnemonic21 = Mnemonic::generate(21).expect("Failed to generate 21-word mnemonic");
    println!("21-word mnemonic:");
    println!("{}", mnemonic21);
    println!("Word count: {}", mnemonic21.word_count());
    println!("Valid: {}\n", validate_mnemonic(&mnemonic21.to_string()));

    // Generate 24-word mnemonic
    let mnemonic24 = Mnemonic::generate(24).expect("Failed to generate 24-word mnemonic");
    println!("24-word mnemonic:");
    println!("{}", mnemonic24);
    println!("Word count: {}", mnemonic24.word_count());
    println!("Valid: {}\n", validate_mnemonic(&mnemonic24.to_string()));
}

fn validate_mnemonic(mnemonic_str: &str) -> bool {
    Mnemonic::from_str(mnemonic_str).is_ok()
}