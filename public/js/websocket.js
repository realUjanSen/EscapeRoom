class WebSocketManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.messageHandlers = new Map();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('🔗 WebSocket Connection Attempt:');
        console.log(`📍 Protocol: ${protocol}`);
        console.log(`🌐 Host: ${window.location.host}`);
        console.log(`🔗 Full URL: ${wsUrl}`);
        console.log(`🚦 Current network status: ${navigator.onLine ? 'Online' : 'Offline'}`);
        
        try {
            console.log('⚡ Creating WebSocket connection...');
            this.ws = new WebSocket(wsUrl);
            this.setupEventListeners();
        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            console.error('🔥 This could be a firewall issue - check Windows Defender settings');
            this.scheduleReconnect();
        }
    }

    setupEventListeners() {
        this.ws.onopen = () => {
            console.log('✅ Connected to server successfully!');
            console.log(`🎯 WebSocket state: ${this.ws.readyState} (OPEN)`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.onConnectionChange(true);
        };

        this.ws.onmessage = (event) => {
            console.log('📨 Received message:', event.data);
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('❌ Error parsing message:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('🔌 Disconnected from server');
            console.log(`🔍 Close code: ${event.code}, reason: ${event.reason}`);
            console.log(`🎯 WebSocket state: ${this.ws.readyState} (CLOSED)`);
            this.isConnected = false;
            this.onConnectionChange(false);
            this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('🚨 WebSocket error:', error);
            console.error('🔥 Possible causes:');
            console.error('   - Windows Firewall blocking connection');
            console.error('   - Server not running');
            console.error('   - Network connectivity issues');
            console.error('   - Port forwarding issues');
        };
    }

    handleMessage(data) {
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        } else {
            console.log('Unhandled message type:', data.type);
        }
    }

    onMessage(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    send(data) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('Cannot send message: WebSocket not connected');
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            UI.showError('Connection lost. Please refresh the page.');
        }
    }

    onConnectionChange(connected) {
        // Update UI based on connection status
        const statusIndicator = document.querySelector('.connection-status');
        if (statusIndicator) {
            statusIndicator.textContent = connected ? 'Connected' : 'Disconnected';
            statusIndicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Global WebSocket manager instance
const wsManager = new WebSocketManager();
