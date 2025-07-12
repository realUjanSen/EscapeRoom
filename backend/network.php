<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$action = $_GET['action'] ?? '';
$response = ['success' => false, 'message' => 'Invalid action'];

try {
    switch ($action) {
        case 'get_interfaces':
            $interfaces = getNetworkInterfaces();
            $response = [
                'success' => true,
                'interfaces' => $interfaces
            ];
            break;
            
        case 'test_connection':
            $host = $_GET['host'] ?? 'localhost';
            $port = $_GET['port'] ?? 8080;
            $result = testConnection($host, $port);
            $response = [
                'success' => $result['success'],
                'message' => $result['message'],
                'latency' => $result['latency'] ?? null
            ];
            break;
            
        default:
            $response = ['success' => false, 'message' => 'Unknown action'];
    }
    
} catch (Exception $e) {
    $response = [
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ];
}

echo json_encode($response);

function getNetworkInterfaces() {
    $interfaces = [];
    $os = strtoupper(substr(PHP_OS, 0, 3));
    
    if ($os === 'WIN') {
        // Windows ipconfig
        $output = shell_exec('ipconfig /all 2>&1');
        $interfaces = parseWindowsIpconfig($output);
    } else {
        // Linux/Mac ifconfig or ip addr
        $output = shell_exec('ip addr show 2>/dev/null || ifconfig 2>/dev/null');
        $interfaces = parseLinuxIfconfig($output);
    }
    
    // Add localhost as fallback
    if (empty($interfaces)) {
        $interfaces[] = [
            'name' => 'Localhost',
            'ip' => '127.0.0.1',
            'adapter' => 'Loopback'
        ];
    }
    
    // Add current server IP if available
    $serverIP = $_SERVER['SERVER_ADDR'] ?? null;
    if ($serverIP && $serverIP !== '127.0.0.1') {
        $interfaces[] = [
            'name' => 'Server IP',
            'ip' => $serverIP,
            'adapter' => 'Web Server'
        ];
    }
    
    return $interfaces;
}

function parseWindowsIpconfig($output) {
    $interfaces = [];
    $lines = explode("\n", $output);
    $currentAdapter = '';
    
    foreach ($lines as $line) {
        $line = trim($line);
        
        // Detect adapter name
        if (strpos($line, 'adapter') !== false && strpos($line, ':') !== false) {
            $currentAdapter = trim(str_replace(':', '', $line));
            // Clean up adapter name
            $currentAdapter = preg_replace('/.*adapter\s+/i', '', $currentAdapter);
        }
        
        // Extract IPv4 addresses
        if (preg_match('/IPv4.*?:\s*(\d+\.\d+\.\d+\.\d+)/', $line, $matches)) {
            $ip = $matches[1];
            
            if ($ip !== '127.0.0.1') { // Skip localhost in main list
                $adapterType = 'Unknown';
                
                if (stripos($currentAdapter, 'wi-fi') !== false || stripos($currentAdapter, 'wireless') !== false) {
                    $adapterType = 'Wi-Fi';
                } elseif (stripos($currentAdapter, 'ethernet') !== false) {
                    $adapterType = 'Ethernet';
                } elseif (stripos($currentAdapter, 'bluetooth') !== false) {
                    $adapterType = 'Bluetooth';
                } elseif (stripos($currentAdapter, 'tailscale') !== false) {
                    $adapterType = 'Tailscale';
                } elseif (stripos($currentAdapter, 'vmnet') !== false || stripos($currentAdapter, 'vmware') !== false) {
                    $adapterType = 'VMware';
                } elseif (stripos($currentAdapter, 'virtual') !== false) {
                    $adapterType = 'Virtual';
                }
                
                $interfaces[] = [
                    'name' => $currentAdapter . ' - ' . $ip,
                    'ip' => $ip,
                    'adapter' => $adapterType
                ];
            }
        }
    }
    
    return $interfaces;
}

function parseLinuxIfconfig($output) {
    $interfaces = [];
    
    // Try ip addr format first
    if (strpos($output, 'inet ') !== false) {
        preg_match_all('/(\w+): .*?inet (\d+\.\d+\.\d+\.\d+)/s', $output, $matches, PREG_SET_ORDER);
        
        foreach ($matches as $match) {
            $interface = $match[1];
            $ip = $match[2];
            
            if ($ip !== '127.0.0.1') {
                $adapterType = 'Unknown';
                
                if (strpos($interface, 'wl') === 0 || strpos($interface, 'wifi') !== false) {
                    $adapterType = 'Wi-Fi';
                } elseif (strpos($interface, 'eth') === 0 || strpos($interface, 'en') === 0) {
                    $adapterType = 'Ethernet';
                } elseif (strpos($interface, 'docker') !== false || strpos($interface, 'br') === 0) {
                    $adapterType = 'Virtual';
                }
                
                $interfaces[] = [
                    'name' => $interface . ' - ' . $ip,
                    'ip' => $ip,
                    'adapter' => $adapterType
                ];
            }
        }
    } else {
        // Fallback ifconfig format
        preg_match_all('/(\w+).*?inet (?:addr:)?(\d+\.\d+\.\d+\.\d+)/s', $output, $matches, PREG_SET_ORDER);
        
        foreach ($matches as $match) {
            $interface = $match[1];
            $ip = $match[2];
            
            if ($ip !== '127.0.0.1') {
                $interfaces[] = [
                    'name' => $interface . ' - ' . $ip,
                    'ip' => $ip,
                    'adapter' => 'Network Interface'
                ];
            }
        }
    }
    
    return $interfaces;
}

function testConnection($host, $port) {
    $startTime = microtime(true);
    
    $connection = @fsockopen($host, $port, $errno, $errstr, 5);
    
    if ($connection) {
        fclose($connection);
        $latency = round((microtime(true) - $startTime) * 1000, 2);
        return [
            'success' => true,
            'message' => 'Connection successful',
            'latency' => $latency
        ];
    } else {
        return [
            'success' => false,
            'message' => "Connection failed: $errstr ($errno)"
        ];
    }
}
?>
