// Main application initialization
class App {
    constructor() {
        this.init();
    }

    init() {
        console.log('🎮 Multiplayer Escape Room - Initializing...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    start() {
        console.log('🚀 Starting application...');
        console.log(`🌐 Client Info:`, {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            url: window.location.href,
            origin: window.location.origin,
            host: window.location.host
        });
        
        // Check network connectivity
        if (!navigator.onLine) {
            console.warn('⚠️ Client appears to be offline!');
        }
        
        // Log firewall/connection debugging info
        console.log('🔗 Connection debugging info:');
        console.log(`📍 Current page: ${window.location.href}`);
        console.log(`🖥️ User agent: ${navigator.userAgent}`);
        console.log(`🌍 Network status: ${navigator.onLine ? 'Online' : 'Offline'}`);
        
        // Initialize WebSocket connection
        this.initWebSocket();
        
        // Setup global error handling
        this.setupErrorHandling();
        
        // Initialize UI
        console.log('✅ UI initialized');
        
        console.log('🎉 Application ready!');
    }

    initWebSocket() {
        // Setup WebSocket message handlers
        wsManager.onMessage('roomCreated', (data) => {
            ui.onRoomCreated(data);
            if (game) {
                game.setCurrentPlayer({
                    id: data.playerId,
                    name: ui.currentPlayerName
                });
            }
        });

        wsManager.onMessage('joinedRoom', (data) => {
            ui.onJoinedRoom(data);
            if (game) {
                game.setCurrentPlayer({
                    id: data.playerId,
                    name: ui.currentPlayerName
                });
                game.initializePlayers(data.players);
            }
        });

        wsManager.onMessage('playerJoined', (data) => {
            ui.onPlayerJoined(data);
            if (game) {
                game.onPlayerJoined(data);
            }
        });

        wsManager.onMessage('playerLeft', (data) => {
            ui.onPlayerLeft(data);
            if (game) {
                game.onPlayerLeft(data);
            }
        });

        wsManager.onMessage('gameStarted', (data) => {
            ui.onGameStarted(data);
        });

        wsManager.onMessage('playerMoved', (data) => {
            if (game) {
                game.onPlayerMoved(data);
            }
        });

        wsManager.onMessage('objectInteraction', (data) => {
            if (game) {
                game.onObjectInteraction(data);
            }
        });

        wsManager.onMessage('gameCompleted', (data) => {
            ui.onGameCompleted(data);
        });

        wsManager.onMessage('error', (data) => {
            ui.onError(data);
        });

        // Connect to server
        wsManager.connect();
        
        console.log('🔌 WebSocket initialized');
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            ui.showError('An unexpected error occurred. Please refresh the page.');
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            ui.showError('An unexpected error occurred. Please refresh the page.');
        });

        console.log('🛡️ Error handling setup complete');
    }
}

// Initialize application when script loads
new App();

// Development helpers (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Add development tools to global scope for debugging
    window.debug = {
        wsManager,
        ui,
        game: () => game,
        
        // Helper functions for testing
        simulatePlayer: (name) => {
            return {
                id: 'debug-' + Math.random().toString(36).substr(2, 9),
                name: name || 'Debug Player',
                position: { 
                    x: Math.random() * 700 + 50, 
                    y: Math.random() * 500 + 50 
                }
            };
        },
        
        addTestPlayer: (name) => {
            if (game) {
                const player = window.debug.simulatePlayer(name);
                game.players.set(player.id, player);
                console.log('Added test player:', player);
            }
        },
        
        clearPlayers: () => {
            if (game) {
                game.players.clear();
                console.log('Cleared all players');
            }
        },
        
        getGameState: () => {
            return {
                currentScreen: ui.currentScreen,
                roomId: ui.currentRoomId,
                playerName: ui.currentPlayerName,
                connected: wsManager.isConnected,
                playersCount: game ? game.players.size : 0
            };
        }
    };
    
    console.log('🔧 Development tools available via window.debug');
}
