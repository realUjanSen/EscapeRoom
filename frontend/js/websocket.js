// WebSocket client for Escape Room Game
class WebSocketClient {
    constructor(game) {
        this.game = game;
        this.ws = null;
        this.url = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.heartbeatInterval = null;
        this.isManualClose = false;
        
        // Message queue for when disconnected
        this.messageQueue = [];
        this.maxQueueSize = 50;
        
        // Connection state
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, reconnecting
        this.lastPingTime = 0;
        this.latency = 0;
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Listen for visibility changes to handle background/foreground
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Listen for network status changes
        window.addEventListener('online', () => {
            console.log('Network came back online');
            if (this.connectionState === 'disconnected') {
                this.reconnect();
            }
        });

        window.addEventListener('offline', () => {
            console.log('Network went offline');
            this.connectionState = 'disconnected';
            this.stopHeartbeat();
        });
    }

    connect(host = 'localhost', port = 8080) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // console.log('🔍 DEBUG: Already connected to WebSocket');
            return Promise.resolve();
        }
        
        if (this.connectionState === 'connecting') {
            // console.log('🔍 DEBUG: Already attempting to connect, waiting...');
            return new Promise((resolve, reject) => {
                const checkConnection = () => {
                    if (this.connectionState === 'connected') {
                        resolve();
                    } else if (this.connectionState === 'disconnected') {
                        reject(new Error('Connection failed'));
                    } else {
                        setTimeout(checkConnection, 100);
                    }
                };
                checkConnection();
            });
        }

        // Ensure host is set correctly
        if (!host || host === 'undefined') {
            host = 'localhost';
            console.log('🔍 DEBUG: Host was undefined, defaulting to localhost');
        }

        this.url = `ws://${host}:${port}`;
        this.isManualClose = false;
        this.connectionState = 'connecting';
        
        console.log(`🔍 DEBUG: Connecting to WebSocket server: ${this.url}`);
        
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                console.log(`🔍 DEBUG: WebSocket object created:`, this.ws);
                this.setupWebSocketEvents(resolve, reject);
            } catch (error) {
                console.error('🚨 DEBUG: Error creating WebSocket:', error);
                this.connectionState = 'disconnected';
                reject(error);
            }
        });
    }

    setupWebSocketEvents(resolve, reject) {
        const connectTimeout = setTimeout(() => {
            if (this.ws.readyState !== WebSocket.OPEN) {
                this.ws.close();
                reject(new Error('Connection timeout'));
            }
        }, 10000); // 10 second timeout

        this.ws.onopen = () => {
            clearTimeout(connectTimeout);
            console.log('🔍 DEBUG: WebSocket connected successfully');
            console.log(`🔍 DEBUG: WebSocket readyState: ${this.ws.readyState}`);
            console.log(`🔍 DEBUG: WebSocket object:`, this.ws);
            
            this.connectionState = 'connected';
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.processMessageQueue();
            
            // Notify game of connection
            this.game.onWebSocketConnected();
            
            resolve();
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = (event) => {
            clearTimeout(connectTimeout);
            this.stopHeartbeat();
            
            console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
            
            if (this.connectionState === 'connecting') {
                reject(new Error(`Connection failed: ${event.reason || 'Unknown error'}`));
            }
            
            if (!this.isManualClose && this.shouldReconnect(event.code)) {
                this.connectionState = 'reconnecting';
                this.scheduleReconnect();
            } else {
                this.connectionState = 'disconnected';
            }
            
            // Notify game of disconnection
            this.game.onWebSocketDisconnected(event);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            
            if (this.connectionState === 'connecting') {
                clearTimeout(connectTimeout);
                reject(error);
            }
            
            // Notify game of error
            this.game.onWebSocketError(error);
        };
    }

    handleMessage(message) {
        console.log(`🔍 CLIENT: Received message from server:`, message);
        
        // Handle special message types
        switch (message.type) {
            case 'ping':
                this.sendPong();
                break;
            case 'pong':
                this.handlePong();
                break;
            default:
                console.log(`🔍 CLIENT: Forwarding message to game:`, message);
                // Forward to game
                this.game.handleServerMessage(message);
                break;
        }
    }

    sendMessage(type, data = {}) {
        const message = { type, data, timestamp: Date.now() };
        
        console.log(`🔍 DEBUG: Attempting to send message:`, message);
        console.log(`🔍 DEBUG: WebSocket state: ${this.ws ? this.ws.readyState : 'null'} (OPEN=${WebSocket.OPEN})`);
        console.log(`🔍 DEBUG: Connection state: ${this.connectionState}`);
        console.log(`🔍 DEBUG: isConnected(): ${this.isConnected()}`);
        
        if (this.isConnected()) {
            try {
                this.ws.send(JSON.stringify(message));
                console.log('🔍 DEBUG: Message sent successfully');
                return true;
            } catch (error) {
                console.error('🚨 DEBUG: Error sending WebSocket message:', error);
                this.queueMessage(message);
                return false;
            }
        } else {
            console.log('🚨 DEBUG: Cannot send message - not connected, queuing message');
            this.queueMessage(message);
            return false;
        }
    }

    queueMessage(message) {
        if (this.messageQueue.length >= this.maxQueueSize) {
            // Remove oldest message
            this.messageQueue.shift();
        }
        
        this.messageQueue.push(message);
        console.log(`Queued message (${this.messageQueue.length} in queue):`, message.type);
    }

    processMessageQueue() {
        if (this.messageQueue.length === 0) return;
        
        console.log(`Processing ${this.messageQueue.length} queued messages`);
        
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        
        messages.forEach(message => {
            // Check if message is still relevant (not too old)
            const messageAge = Date.now() - message.timestamp;
            if (messageAge < 30000) { // 30 seconds
                this.sendMessage(message.type, message.data);
            }
        });
    }

    disconnect() {
        this.isManualClose = true;
        this.connectionState = 'disconnected';
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
        }
        
        // Clear message queue
        this.messageQueue = [];
        
        console.log('WebSocket manually disconnected');
    }

    reconnect() {
        if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
            return;
        }
        
        if (this.url) {
            const [protocol, , hostPort] = this.url.split(/[:\/]+/);
            const [host, port] = hostPort.split(':');
            this.connect(host, parseInt(port) || 8080);
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            this.connectionState = 'disconnected';
            this.game.onWebSocketReconnectFailed();
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (this.connectionState === 'reconnecting') {
                this.reconnect();
            }
        }, delay);
    }

    shouldReconnect(closeCode) {
        // Don't reconnect for certain close codes
        const noReconnectCodes = [
            1000, // Normal closure
            1001, // Going away
            1005, // No status received
            4000, // Custom: Banned
            4001, // Custom: Invalid session
        ];
        
        return !noReconnectCodes.includes(closeCode) && !this.isManualClose;
    }

    // Heartbeat/ping-pong mechanism
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.sendPing();
            }
        }, 30000); // Send ping every 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    sendPing() {
        this.lastPingTime = Date.now();
        this.sendMessage('ping');
    }

    sendPong() {
        this.sendMessage('pong');
    }

    handlePong() {
        if (this.lastPingTime > 0) {
            this.latency = Date.now() - this.lastPingTime;
            console.log(`WebSocket latency: ${this.latency}ms`);
        }
    }

    // Page visibility handlers
    handlePageHidden() {
        // Reduce heartbeat frequency when page is hidden
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = setInterval(() => {
                if (this.isConnected()) {
                    this.sendPing();
                }
            }, 60000); // Send ping every 60 seconds when hidden
        }
    }

    handlePageVisible() {
        // Resume normal heartbeat when page becomes visible
        if (this.isConnected()) {
            this.startHeartbeat();
            
            // Send immediate ping to check connection
            this.sendPing();
        } else if (this.connectionState === 'disconnected' && !this.isManualClose) {
            // Try to reconnect when page becomes visible
            this.reconnect();
        }
    }

    // Connection state queries
    isConnected() {
        console.log(`🔍 DEBUG: WebSocketClient.isConnected() called`);
        console.log(`🔍 DEBUG: this.ws exists: ${!!this.ws}`);
        console.log(`🔍 DEBUG: this.ws type: ${typeof this.ws}`);
        console.log(`🔍 DEBUG: this.ws constructor: ${this.ws ? this.ws.constructor.name : 'N/A'}`);
        console.log(`🔍 DEBUG: this.ws.readyState: ${this.ws ? this.ws.readyState : 'N/A'}`);
        console.log(`🔍 DEBUG: WebSocket.OPEN: ${WebSocket.OPEN}`);
        console.log(`🔍 DEBUG: readyState === OPEN: ${this.ws ? (this.ws.readyState === WebSocket.OPEN) : 'N/A'}`);
        console.log(`🔍 DEBUG: connectionState: ${this.connectionState}`);
        
        if (this.ws) {
            console.log(`🔍 DEBUG: WebSocket URL: ${this.ws.url}`);
            console.log(`🔍 DEBUG: WebSocket protocol: ${this.ws.protocol}`);
            console.log(`🔍 DEBUG: WebSocket extensions: ${this.ws.extensions}`);
        }
        
        const result = this.ws && this.ws.readyState === WebSocket.OPEN;
        console.log(`🔍 DEBUG: isConnected() returning: ${result}`);
        return result;
    }

    isConnecting() {
        return this.connectionState === 'connecting';
    }

    isReconnecting() {
        return this.connectionState === 'reconnecting';
    }

    getConnectionState() {
        return this.connectionState;
    }

    getLatency() {
        return this.latency;
    }

    getQueuedMessageCount() {
        return this.messageQueue.length;
    }

    // Network quality assessment
    assessNetworkQuality() {
        if (!this.isConnected()) {
            return 'disconnected';
        }
        
        if (this.latency < 50) {
            return 'excellent';
        } else if (this.latency < 100) {
            return 'good';
        } else if (this.latency < 200) {
            return 'fair';
        } else {
            return 'poor';
        }
    }

    // Debugging and monitoring
    getDebugInfo() {
        return {
            url: this.url,
            connectionState: this.connectionState,
            readyState: this.ws ? this.ws.readyState : null,
            reconnectAttempts: this.reconnectAttempts,
            latency: this.latency,
            queuedMessages: this.messageQueue.length,
            networkQuality: this.assessNetworkQuality()
        };
    }

    // Batch message sending for efficiency
    sendBatch(messages) {
        if (!this.isConnected()) {
            messages.forEach(msg => this.queueMessage(msg));
            return false;
        }
        
        try {
            const batch = {
                type: 'batch',
                data: { messages },
                timestamp: Date.now()
            };
            
            this.ws.send(JSON.stringify(batch));
            return true;
        } catch (error) {
            console.error('Error sending batch messages:', error);
            messages.forEach(msg => this.queueMessage(msg));
            return false;
        }
    }

    // Message compression for large payloads (if needed)
    sendCompressed(type, data) {
        // For now, just use regular send
        // In the future, could implement compression for large messages
        return this.sendMessage(type, data);
    }
}

// Export for use in other modules
window.WebSocketClient = WebSocketClient;

// Commented out debug logs
const _origConsoleLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('🔍 DEBUG')) {
    return;
  }
  _origConsoleLog.apply(console, args);
};
