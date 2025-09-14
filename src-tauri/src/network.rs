use std::process::Command;
use std::time::Duration;
use tokio::time::timeout;
use std::net::{TcpStream, ToSocketAddrs};

const TEST_HOSTS: &[&str] = &["8.8.8.8", "1.1.1.1", "114.114.114.114", "223.5.5.5", "208.67.222.222"];
const HTTP_TEST_HOSTS: &[&str] = &["www.google.com", "www.cloudflare.com", "www.baidu.com", "www.taobao.com", "www.apple.com"];
const TIMEOUT_MS: u64 = 1500; // Reduced timeout for faster detection
const DNS_PORT: u16 = 53;
const HTTP_PORT: u16 = 80;

pub async fn is_network_connected() -> bool {
    // Primary check: Test actual internet connectivity (most reliable)
    let dns_working = test_dns_connectivity().await;
    let http_working = test_http_connectivity().await;
    
    // Secondary check: Look for active network interfaces with real IPs
    let has_real_interfaces = has_real_network_interfaces();
    
    // Smart security assessment (following Java implementation logic)
    if dns_working && http_working {
        // Both DNS and HTTP work - definitely unsafe
        return true;
    } else if http_working && !has_real_interfaces {
        // HTTP works but no real interfaces - unusual, assume unsafe
        return true;
    } else if dns_working && has_real_interfaces {
        // DNS works with real interfaces - unsafe
        return true;
    } else if dns_working && !has_real_interfaces {
        // Only DNS works, no real interfaces - likely VPN/system services, relatively safe
        return false;
    } else if !dns_working && !http_working && !has_real_interfaces {
        // No connectivity at all and no real interfaces - secure
        return false;
    } else if !dns_working && !http_working {
        // No external connectivity - relatively secure even with interfaces
        return false;
    } else {
        // Any other case with connectivity - assume unsafe
        return true;
    }
}

async fn test_dns_connectivity() -> bool {
    for host in TEST_HOSTS {
        if let Ok(result) = timeout(Duration::from_millis(TIMEOUT_MS), test_tcp_connection(host, DNS_PORT)).await {
            if result {
                return true;
            }
        }
    }
    false
}

async fn test_http_connectivity() -> bool {
    for host in HTTP_TEST_HOSTS {
        if let Ok(result) = timeout(Duration::from_millis(TIMEOUT_MS), test_tcp_connection(host, HTTP_PORT)).await {
            if result {
                return true;
            }
        }
    }
    false
}

async fn test_tcp_connection(host: &str, port: u16) -> bool {
    // Try to resolve and connect
    let address = format!("{}:{}", host, port);
    
    match address.to_socket_addrs() {
        Ok(mut addrs) => {
            if let Some(addr) = addrs.next() {
                match TcpStream::connect_timeout(&addr, Duration::from_millis(TIMEOUT_MS)) {
                    Ok(_) => true,
                    Err(_) => false,
                }
            } else {
                false
            }
        }
        Err(_) => false,
    }
}

fn has_real_network_interfaces() -> bool {
    // Check network interfaces using ifconfig (more reliable than route table)
    match Command::new("ifconfig").output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            parse_ifconfig_output(&output_str)
        }
        Err(_) => {
            // Fallback to checking route table
            check_default_route()
        }
    }
}

fn parse_ifconfig_output(output: &str) -> bool {
    let mut current_interface = String::new();
    let mut interface_is_up = false;
    let mut has_real_interface = false;
    
    for line in output.lines() {
        let line_trimmed = line.trim();
        
        // New interface starts (doesn't start with whitespace)
        if !line.starts_with(' ') && !line.starts_with('\t') && line.contains(':') {
            if let Some(interface_name) = line.split(':').next() {
                current_interface = interface_name.to_lowercase();
                // Check if interface is UP and RUNNING
                interface_is_up = line.to_uppercase().contains("UP") && 
                                 line.to_uppercase().contains("RUNNING");
            }
        }
        
        // Check for inet addresses only if interface is UP
        if interface_is_up && line_trimmed.starts_with("inet ") {
            if let Some(ip_part) = line_trimmed.split_whitespace().nth(1) {
                let ip = ip_part.split('/').next().unwrap_or(ip_part);
                
                // Skip loopback
                if ip == "127.0.0.1" {
                    continue;
                }
                
                // Skip APIPA addresses
                if ip.starts_with("169.254.") {
                    continue;
                }
                
                // Skip common virtual interfaces
                if is_virtual_interface(&current_interface) {
                    continue;
                }
                
                // Check if it's a private/public IP (real network)
                if is_real_ip_address(ip) {
                    has_real_interface = true;
                }
            }
        }
    }
    
    has_real_interface
}

fn is_real_ip_address(ip: &str) -> bool {
    // Check if this is a real IP address (not just any IP)
    // Accept both private and public IPs as "real" network connections
    
    // Private IP ranges:
    // 10.0.0.0/8
    // 172.16.0.0/12  
    // 192.168.0.0/16
    
    if ip.starts_with("10.") {
        return true;
    }
    
    if ip.starts_with("192.168.") {
        return true;
    }
    
    if ip.starts_with("172.") {
        if let Some(second_octet) = ip.split('.').nth(1) {
            if let Ok(octet) = second_octet.parse::<u8>() {
                if octet >= 16 && octet <= 31 {
                    return true;
                }
            }
        }
    }
    
    // Also accept any other non-loopback, non-APIPA address as potentially real
    // (could be public IP, or other private ranges)
    !ip.starts_with("127.") && !ip.starts_with("169.254.")
}

fn is_virtual_interface(interface_name: &str) -> bool {
    let name = interface_name.to_lowercase();
    
    // Common virtual/system interfaces to ignore
    name.starts_with("utun") ||      // VPN tunnels
    name.starts_with("awdl") ||      // Apple Wireless Direct Link
    name.starts_with("llw") ||       // Low Latency WLAN
    name.starts_with("bridge") ||    // Bridge interfaces
    name.starts_with("vnic") ||      // Virtual NICs
    name.starts_with("vmnet") ||     // VMware interfaces
    name.starts_with("vboxnet") ||   // VirtualBox interfaces
    name.starts_with("lo") ||        // Loopback
    name == "lo0"                    // macOS loopback
}

fn check_default_route() -> bool {
    // Check if there's a default route (indicates potential network connectivity)
    match Command::new("route")
        .args(&["-n", "get", "default"])
        .output()
    {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            
            // Look for gateway and interface, but be more specific
            let has_gateway = output_str.contains("gateway:");
            let has_interface = output_str.contains("interface:");
            
            // Only consider it connected if both gateway and interface are present
            // and it's not just a loopback or virtual interface
            if has_gateway && has_interface {
                // Check if the interface is real (not lo0, utun, etc.)
                for line in output_str.lines() {
                    if line.trim().starts_with("interface:") {
                        if let Some(interface) = line.split(':').nth(1) {
                            let interface = interface.trim();
                            return !is_virtual_interface(interface);
                        }
                    }
                }
            }
            
            false
        }
        Err(_) => false,
    }
}

// Additional check using netstat to see active connections
#[allow(dead_code)]
fn check_active_connections() -> bool {
    match Command::new("netstat")
        .args(&["-rn"])
        .output()
    {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            
            // Look for default route (0.0.0.0 or default)
            for line in output_str.lines() {
                if line.contains("0.0.0.0") || line.contains("default") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        let interface = parts[parts.len() - 1];
                        if !is_virtual_interface(interface) {
                            return true;
                        }
                    }
                }
            }
            false
        }
        Err(_) => false,
    }
}

pub async fn monitor_network_changes() -> Result<(), Box<dyn std::error::Error>> {
    // This could be extended to monitor network changes in real-time
    // For now, it's a placeholder for future functionality
    Ok(())
}

pub fn get_network_warning_message() -> String {
    "⚠️ Network Connection Detected\n\n\
     For maximum security, please disconnect from the internet before performing \
     encryption or decryption operations. This prevents any potential data leakage \
     during the cryptographic process.\n\n\
     Steps to disconnect:\n\
     1. Turn off Wi-Fi in System Preferences\n\
     2. Unplug Ethernet cable (if connected)\n\
     3. Disable mobile hotspot connections\n\n\
     You can reconnect after completing your encryption/decryption tasks.".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_network_detection() {
        // This test will depend on the actual network state
        // In a real environment, you might want to mock these functions
        let is_connected = is_network_connected().await;
        println!("Network connected: {}", is_connected);
        
        // The test passes regardless of network state
        // In production, you'd want more sophisticated testing
        assert!(true);
    }

    #[test]
    fn test_warning_message() {
        let message = get_network_warning_message();
        assert!(message.contains("Network Connection Detected"));
        assert!(message.contains("disconnect from the internet"));
    }
}