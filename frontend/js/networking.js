// Networking utilities for IP configuration and server detection
class NetworkManager {
    constructor() {
        this.availableIPs = [];
        this.selectedIP = null;
        this.currentPort = 8080;
    }

    async getNetworkInterfaces() {
        try {
            // Try to get network interfaces via backend API
            const response = await fetch('/backend/network.php?action=get_interfaces');
            const data = await response.json();
            
            if (data.success) {
                this.availableIPs = data.interfaces;
                return this.availableIPs;
            }
        } catch (error) {
            console.warn('Failed to get network interfaces from backend:', error);
        }

        // Fallback: try to detect via WebRTC (limited but works in browser)
        return this.detectIPsViaWebRTC();
    }

    async detectIPsViaWebRTC() {
        return new Promise((resolve) => {
            const ips = [];
            const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
            
            if (!RTCPeerConnection) {
                // Fallback to common local IPs
                resolve([
                    { name: 'Local Host', ip: '127.0.0.1', adapter: 'Loopback' },
                    { name: 'Auto-detect', ip: window.location.hostname, adapter: 'Current' }
                ]);
                return;
            }

            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            
            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) return;
                
                const candidate = ice.candidate.candidate;
                const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                
                if (ipMatch) {
                    const ip = ipMatch[1];
                    if (!ips.find(item => item.ip === ip)) {
                        let adapterName = 'Unknown';
                        
                        if (ip.startsWith('192.168.')) {
                            adapterName = 'Wi-Fi';
                        } else if (ip.startsWith('10.')) {
                            adapterName = 'Ethernet';
                        } else if (ip.startsWith('172.')) {
                            adapterName = 'Network';
                        } else if (ip === '127.0.0.1') {
                            adapterName = 'Loopback';
                        } else {
                            adapterName = 'Public';
                        }
                        
                        ips.push({
                            name: `${adapterName} (${ip})`,
                            ip: ip,
                            adapter: adapterName
                        });
                    }
                }
            };
            
            // Timeout after 2 seconds
            setTimeout(() => {
                pc.close();
                
                // Add current location as fallback
                if (ips.length === 0) {
                    ips.push({
                        name: 'Current Location',
                        ip: window.location.hostname,
                        adapter: 'Current Browser'
                    });
                }
                
                resolve(ips);
            }, 2000);
        });
    }

    generateShareURL(selectedIP, roomCode = null) {
        const ip = selectedIP || window.location.hostname;
        const port = 3000; // PHP server always runs on port 3000
        const path = roomCode ? `/escape.html?room=${roomCode}` : '/escape.html';
        
        return `http://${ip}:${port}${path}`;
    }

    async refreshNetworkList() {
        const interfaces = await this.getNetworkInterfaces();
        this.updateIPDropdown(interfaces);
        return interfaces;
    }

    updateIPDropdown(interfaces) {
        const ipList = document.getElementById('ipList');
        
        if (!ipList) {
            console.error('IP list element not found');
            return;
        }
        
        if (!interfaces || interfaces.length === 0) {
            ipList.innerHTML = '<div class="no-interfaces">No network interfaces found</div>';
            return;
        }

        console.log('Updating IP dropdown with interfaces:', interfaces);
        ipList.innerHTML = '';
        
        interfaces.forEach((iface, index) => {
            const ipItem = document.createElement('div');
            ipItem.className = 'ip-item';
            ipItem.innerHTML = `
                <div class="ip-info">
                    <div class="adapter-name">${iface.adapter}</div>
                    <div class="ip-address">${iface.ip}</div>
                </div>
                <button class="select-btn" data-ip="${iface.ip}" data-adapter="${iface.adapter}">
                    Select
                </button>
            `;
            
            ipItem.querySelector('.select-btn').addEventListener('click', () => {
                this.selectIP(iface.ip, iface.adapter);
            });
            
            ipList.appendChild(ipItem);
        });

        // Don't auto-select anything - let the user choose
    }

    selectIP(ip, adapter) {
        this.selectedIP = ip;
        this.selectedAdapter = adapter;
        
        // Truncate adapter name if longer than 20 characters
        const displayAdapter = adapter.length > 20 ? adapter.substring(0, 17) + '...' : adapter;
        
        // Update button text to show selected adapter + IP
        const ipConfigBtn = document.getElementById('ipConfigBtn');
        if (ipConfigBtn) {
            ipConfigBtn.innerHTML = `🌐 ${displayAdapter} (${ip})`;
        }

        // DON'T close dropdown - let user keep it open to compare options
        // document.getElementById('ipDropdown').classList.add('hidden');
        
        // Update visual selection
        document.querySelectorAll('.ip-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`[data-ip="${ip}"]`).closest('.ip-item');
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // Update share URL
        const shareUrl = this.generateShareURL(ip);
        const shareUrlInput = document.getElementById('shareUrl');
        if (shareUrlInput) {
            shareUrlInput.value = shareUrl;
        }
        
        // Show success message
        this.showMessage(`Selected: ${adapter} (${ip}) - You can now create/join rooms`, 'success');
    }

    copyShareURL() {
        if (!this.selectedIP) {
            this.showMessage('Please select a network interface first', 'error');
            return;
        }
        
        const shareUrlInput = document.getElementById('shareUrl');
        
        if (shareUrlInput && shareUrlInput.value) {
            shareUrlInput.select();
            shareUrlInput.setSelectionRange(0, 99999); // For mobile devices
            
            try {
                document.execCommand('copy');
                this.showMessage('Share URL copied to clipboard!', 'success');
            } catch (err) {
                // Fallback for modern browsers
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrlInput.value).then(() => {
                        this.showMessage('Share URL copied to clipboard!', 'success');
                    }).catch(() => {
                        this.showMessage('Failed to copy URL', 'error');
                    });
                } else {
                    this.showMessage('Copy not supported on this device', 'warning');
                }
            }
        } else {
            this.showMessage('No URL to copy - select an interface first', 'error');
        }
    }

    showMessage(text, type = 'info') {
        // Create or update message element
        let messageEl = document.querySelector('.network-message');
        
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.className = 'network-message';
            document.querySelector('.ip-dropdown').appendChild(messageEl);
        }
        
        messageEl.textContent = text;
        messageEl.className = `network-message ${type}`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (messageEl) {
                messageEl.remove();
            }
        }, 3000);
    }

    // Auto-detect current server configuration
    detectCurrentConfig() {
        const currentHost = window.location.hostname;
        const currentPort = window.location.port || (window.location.protocol === 'https:' ? 443 : 80);
        
        this.currentPort = parseInt(currentPort);
        
        return {
            host: currentHost,
            port: this.currentPort,
            protocol: window.location.protocol
        };
    }

    // Initialize the IP configuration system
    async init() {
        const config = this.detectCurrentConfig();
        console.log('Detected server config:', config);
        
        // Setup event listeners
        const ipConfigBtn = document.getElementById('ipConfigBtn');
        if (ipConfigBtn) {
            // Ensure button starts with default text
            ipConfigBtn.innerHTML = '🌐 IPCONFIG';
            
            ipConfigBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleIPDropdown();
            });
        }
        
        const refreshBtn = document.getElementById('refreshIp');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshNetworkList();
            });
        }
        
        const copyBtn = document.getElementById('copyUrl');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyShareURL();
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ip-config-btn') && !e.target.closest('.ip-dropdown')) {
                this.hideIPDropdown();
            }
        });
        
        // Initial load - just populate the list, don't auto-select
        try {
            await this.refreshNetworkList();
            return Promise.resolve();
        } catch (error) {
            console.error('Failed to initialize networking:', error);
            return Promise.reject(error);
        }
    }

    toggleIPDropdown() {
        const dropdown = document.getElementById('ipDropdown');
        if (!dropdown) {
            console.error('IP dropdown element not found');
            return;
        }
        
        dropdown.classList.toggle('hidden');
        
        if (!dropdown.classList.contains('hidden')) {
            this.refreshNetworkList();
        }
    }

    hideIPDropdown() {
        document.getElementById('ipDropdown').classList.add('hidden');
    }
}

// Global network manager instance
const networkManager = new NetworkManager();
