// UI Management for Escape Room Game
class UIManager {
    constructor(game) {
        this.game = game;
        this.currentScreen = 'main-menu';
        this.isMenuOpen = false;
        
        this.initializeUI();
        this.setupEventListeners();
    }

    initializeUI() {
        // Set up initial UI state
        this.showScreen('main-menu');
        this.updateConnectionStatus(false);
        
        // Initialize form validation
        this.setupFormValidation();
        
        // Setup responsive design handlers
        this.setupResponsiveHandlers();
    }

    setupEventListeners() {
        // Main menu buttons
        document.getElementById('createRoomBtn')?.addEventListener('click', () => {
            this.showCreateRoomScreen();
        });

        document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
            this.showJoinRoomScreen();
        });

        document.getElementById('quickJoinBtn')?.addEventListener('click', () => {
            this.handleQuickJoin();
        });

        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.showScreen('settings');
        });

        // Create room form
        document.getElementById('create-room-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateRoom();
        });

        // Join room form
        document.getElementById('join-room-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleJoinRoom();
        });

        // Chat form
        document.getElementById('chat-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleChatMessage();
        });

        // Game control buttons
        document.getElementById('start-game-btn')?.addEventListener('click', () => {
            this.game.startGame();
        });

        document.getElementById('reset-game-btn')?.addEventListener('click', () => {
            this.game.resetGame();
        });

        document.getElementById('leave-room-btn')?.addEventListener('click', () => {
            this.handleLeaveRoom();
        });

        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showScreen('main-menu');
            });
        });

        // Share link copy button
        document.getElementById('copy-link-btn')?.addEventListener('click', () => {
            this.copyShareLink();
        });

        // Room refresh button
        document.getElementById('refresh-rooms-btn')?.addEventListener('click', () => {
            this.refreshRoomList();
        });

        // Settings form
        document.getElementById('settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSettingsUpdate();
        });

        // Mobile menu toggle
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Game menu toggle
        document.getElementById('game-menu-btn')?.addEventListener('click', () => {
            this.toggleGameMenu();
        });

        // Close game menu
        document.getElementById('close-game-menu')?.addEventListener('click', () => {
            this.closeGameMenu();
        });

        // Fullscreen toggle
        document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
    }

    setupFormValidation() {
        // Player name validation
        const playerNameInputs = document.querySelectorAll('input[name="player-name"]');
        playerNameInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.validatePlayerName(e.target);
            });
        });

        // Room code validation
        const roomCodeInput = document.querySelector('input[name="room-code"]');
        if (roomCodeInput) {
            roomCodeInput.addEventListener('input', (e) => {
                this.validateRoomCode(e.target);
            });
        }
    }

    setupResponsiveHandlers() {
        // Mobile-specific UI adjustments
        if (this.isMobile()) {
            document.body.classList.add('mobile');
            this.adjustMobileUI();
        } else {
            document.body.classList.add('desktop');
        }

        // Tablet detection
        if (this.isTablet()) {
            document.body.classList.add('tablet');
        }
    }

    // Screen management
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.style.display = 'block';
            this.currentScreen = screenId;
        }

        // Update navigation state
        this.updateNavigation(screenId);
    }

    updateNavigation(screenId) {
        // Update nav buttons active state
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = document.querySelector(`[data-screen="${screenId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    // Simple screen management methods
    showCreateRoomScreen() {
        const playerName = document.getElementById('playerName')?.value.trim();
        if (!playerName) {
            alert('Please enter your name first');
            return;
        }
        
        // Create room directly (IP selection is optional for power users)
        this.createRoom(playerName, false);
    }
    
    showJoinRoomScreen() {
        const playerName = document.getElementById('playerName')?.value.trim();
        const roomCode = document.getElementById('roomCode')?.value.trim().toUpperCase();
        
        if (!playerName) {
            alert('Please enter your name first');
            return;
        }
        
        if (!roomCode || roomCode.length !== 6) {
            alert('Please enter a valid 6-character room code');
            return;
        }
        
        // Join room directly (IP selection is optional for power users)
        this.joinRoom(roomCode, playerName);
    }
    
    handleQuickJoin() {
        const playerName = document.getElementById('playerName')?.value.trim();
        if (!playerName) {
            alert('Please enter your name first');
            return;
        }
        
        // Try to find a public room to join (IP selection is optional for power users)
        this.findAndJoinPublicRoom(playerName);
    }
    
    async createRoom(playerName, isPrivate) {
        // Use selected IP or default to window.location.hostname for LAN
        const selectedIP = (window.networking && window.networking.selectedIP) || window.location.hostname;
        
        console.log(`🔍 DEBUG: createRoom - using IP: ${selectedIP}`);
        
        // Connect to game server and create room
        if (!this.game.isConnectedToServer()) {
            try {
                await this.game.connect(selectedIP);
                await this.game.createRoom(playerName, isPrivate);
            } catch (error) {
                alert('Failed to connect to server: ' + error.message);
            }
        } else {
            await this.game.createRoom(playerName, isPrivate);
        }
    }
    
    joinRoom(roomCode, playerName) {
        // Use selected IP or default to current hostname for LAN
        const selectedIP = networking.selectedIP || window.location.hostname;
        
        // Connect to game server and join room
        if (!this.game.isConnectedToServer()) {
            this.game.connect(selectedIP).then(() => {
                this.game.joinRoom(roomCode, playerName);
            }).catch(error => {
                alert('Failed to connect to server: ' + error.message);
            });
        } else {
            this.game.joinRoom(roomCode, playerName);
        }
    }
    
    async findAndJoinPublicRoom(playerName) {
        try {
            const selectedIP = networking.selectedIP || window.location.hostname;
            const response = await fetch(`http://${selectedIP}:8080/api/rooms`);
            const data = await response.json();
            
            if (data.success && data.rooms.length > 0) {
                const availableRoom = data.rooms.find(room => !room.gameStarted && room.playerCount < room.maxPlayers);
                if (availableRoom) {
                    this.joinRoom(availableRoom.roomCode, playerName);
                } else {
                    alert('No available public rooms found. Creating a new room...');
                    this.createRoom(playerName, false);
                }
            } else {
                alert('No public rooms found. Creating a new room...');
                this.createRoom(playerName, false);
            }
        } catch (error) {
            console.error('Error finding public rooms:', error);
            alert('Failed to find public rooms. Creating a new room...');
            this.createRoom(playerName, false);
        }
    }

    // Form handlers
    async handleCreateRoom() {
        const form = document.getElementById('create-room-form');
        const formData = new FormData(form);
        
        const playerName = formData.get('player-name');
        const isPrivate = formData.get('room-privacy') === 'private';
        
        if (!this.validatePlayerName(form.querySelector('input[name="player-name"]'))) {
            return;
        }

        // Use selected IP or default to current hostname for LAN
        const selectedIP = networking.selectedIP || window.location.hostname;

        // Connect to server if not already connected
        if (!this.game.isConnectedToServer()) {
            try {
                await this.game.connect(selectedIP);
                await this.game.createRoom(playerName, isPrivate);
            } catch (error) {
                console.error('Failed to connect and create room:', error);
            }
        } else {
            await this.game.createRoom(playerName, isPrivate);
        }
    }

    async handleJoinRoom() {
        const form = document.getElementById('join-room-form');
        const formData = new FormData(form);
        
        const playerName = formData.get('player-name');
        const roomCode = formData.get('room-code');
        
        if (!this.validatePlayerName(form.querySelector('input[name="player-name"]'))) {
            return;
        }

        if (!this.validateRoomCode(form.querySelector('input[name="room-code"]'))) {
            return;
        }

        // Use selected IP or default to current hostname for LAN
        const selectedIP = this.game.getSelectedIP() || window.location.hostname;

        // Connect to server if not already connected, then join room
        if (!this.game.isConnectedToServer()) {
            try {
                await this.game.connect(selectedIP);
                this.game.joinRoom(roomCode, playerName);
            } catch (error) {
                console.error('Failed to connect and join room:', error);
                alert('Failed to connect to server: ' + (error.message || error));
            }
        } else {
            this.game.joinRoom(roomCode, playerName);
        }
    }

    handleChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (message && this.game.isConnectedToServer()) {
            this.game.sendMessage('chat_message', { message });
            chatInput.value = '';
        }
    }

    handleLeaveRoom() {
        if (confirm('Are you sure you want to leave the room?')) {
            this.game.leaveRoom();
            this.showScreen('main-menu');
        }
    }

    handleSettingsUpdate() {
        const form = document.getElementById('settings-form');
        const formData = new FormData(form);
        
        // Update game settings
        const volume = formData.get('volume');
        const graphics = formData.get('graphics-quality');
        const controls = formData.get('controls');
        
        // Apply settings
        this.applySettings({
            volume: parseInt(volume),
            graphics,
            controls
        });
        
        this.showNotification('Settings updated', 'success');
    }

    // Validation methods
    validatePlayerName(input) {
        const value = input.value.trim();
        const errorElement = input.parentNode.querySelector('.error-message');
        
        if (!value) {
            this.showInputError(input, 'Player name is required');
            return false;
        }
        
        if (value.length < 2) {
            this.showInputError(input, 'Player name must be at least 2 characters');
            return false;
        }
        
        if (value.length > 20) {
            this.showInputError(input, 'Player name must be less than 20 characters');
            return false;
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            this.showInputError(input, 'Player name can only contain letters, numbers, hyphens, and underscores');
            return false;
        }
        
        this.clearInputError(input);
        return true;
    }

    validateRoomCode(input) {
        const value = input.value.trim().toUpperCase();
        input.value = value; // Auto-uppercase
        
        if (!value) {
            this.showInputError(input, 'Room code is required');
            return false;
        }
        
        if (value.length !== 6) {
            this.showInputError(input, 'Room code must be 6 characters');
            return false;
        }
        
        if (!/^[A-Z0-9]+$/.test(value)) {
            this.showInputError(input, 'Room code can only contain letters and numbers');
            return false;
        }
        
        this.clearInputError(input);
        return true;
    }

    showInputError(input, message) {
        input.classList.add('error');
        
        let errorElement = input.parentNode.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            input.parentNode.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    clearInputError(input) {
        input.classList.remove('error');
        
        const errorElement = input.parentNode.querySelector('.error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    // Room management
    async refreshRoomList() {
        const roomList = document.getElementById('room-list');
        const loadingIndicator = document.getElementById('rooms-loading');
        
        if (!roomList) return;
        
        // Show loading
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        try {
            const selectedIP = this.game.getSelectedIP() || 'localhost';
            
            const response = await fetch(`http://${selectedIP}:8080/api/rooms`);
            const data = await response.json();
            
            if (data.success) {
                this.displayRooms(data.rooms);
            } else {
                this.showError('Failed to load rooms');
            }
        } catch (error) {
            console.error('Error fetching rooms:', error);
            this.showError('Failed to connect to server');
        } finally {
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }
    }

    displayRooms(rooms) {
        const roomList = document.getElementById('room-list');
        if (!roomList) return;
        
        roomList.innerHTML = '';
        
        if (rooms.length === 0) {
            roomList.innerHTML = '<div class="no-rooms">No public rooms available</div>';
            return;
        }
        
        rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'room-item';
            roomElement.innerHTML = `
                <div class="room-info">
                    <div class="room-code">${room.roomCode}</div>
                    <div class="room-details">
                        <span class="room-host">Host: ${room.hostName}</span>
                        <span class="room-players">${room.playerCount}/${room.maxPlayers} players</span>
                        <span class="room-status ${room.gameStarted ? 'in-progress' : 'waiting'}">
                            ${room.gameStarted ? 'In Progress' : 'Waiting'}
                        </span>
                    </div>
                </div>
                <button class="join-room-btn" ${room.gameStarted ? 'disabled' : ''} 
                        onclick="ui.quickJoinRoom('${room.roomCode}')">
                    ${room.gameStarted ? 'In Progress' : 'Join'}
                </button>
            `;
            
            roomList.appendChild(roomElement);
        });
    }

    quickJoinRoom(roomCode) {
        const playerName = prompt('Enter your player name:');
        if (playerName && playerName.trim()) {
            const targetIP = this.game.getSelectedIP() || window.location.hostname;
            if (!this.game.isConnectedToServer()) {
                this.game.connect(targetIP);
                setTimeout(() => {
                    if (this.game.isConnectedToServer()) {
                        this.game.joinRoom(roomCode, playerName.trim());
                    }
                }, 1000);
            } else {
                this.game.joinRoom(roomCode, playerName.trim());
            }
        }
    }

    // Share link management
    copyShareLink() {
        const shareLinkInput = document.getElementById('share-link');
        if (shareLinkInput) {
            shareLinkInput.select();
            document.execCommand('copy');
            this.showNotification('Share link copied to clipboard!', 'success');
        }
    }

    // Mobile menu management
    toggleMobileMenu() {
        const mobileMenu = document.getElementById('mobile-menu');
        const isOpen = mobileMenu.classList.contains('open');
        
        if (isOpen) {
            mobileMenu.classList.remove('open');
        } else {
            mobileMenu.classList.add('open');
        }
    }

    // Game menu management
    toggleGameMenu() {
        const gameMenu = document.getElementById('game-menu');
        if (gameMenu) {
            const isOpen = gameMenu.style.display === 'block';
            gameMenu.style.display = isOpen ? 'none' : 'block';
            this.isMenuOpen = !isOpen;
        }
    }

    closeGameMenu() {
        const gameMenu = document.getElementById('game-menu');
        if (gameMenu) {
            gameMenu.style.display = 'none';
            this.isMenuOpen = false;
        }
    }

    // Game state updates
    updateGameState(gameStarted) {
        const startBtn = document.getElementById('start-game-btn');
        const resetBtn = document.getElementById('reset-game-btn');
        const gameStatus = document.getElementById('game-status');
        
        if (startBtn) {
            startBtn.style.display = gameStarted ? 'none' : 'block';
        }
        
        if (resetBtn) {
            resetBtn.style.display = gameStarted ? 'block' : 'none';
        }
        
        if (gameStatus) {
            gameStatus.textContent = gameStarted ? 'Game In Progress' : 'Waiting to Start';
            gameStatus.className = gameStarted ? 'status-playing' : 'status-waiting';
        }
    }

    updateHostControls(isHost) {
        const hostControls = document.getElementById('host-controls');
        if (hostControls) {
            hostControls.style.display = isHost ? 'block' : 'none';
        }
    }

    updatePlayerList(players) {
        const playerList = document.getElementById('player-list');
        if (!playerList) return;
        
        playerList.innerHTML = '';
        
        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            playerElement.innerHTML = `
                <span class="player-name">${player.name}</span>
                ${player.isHost ? '<span class="host-badge">HOST</span>' : ''}
            `;
            
            playerList.appendChild(playerElement);
        });
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connection-status');
        if (statusIndicator) {
            statusIndicator.className = connected ? 'connected' : 'disconnected';
            statusIndicator.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    // Utility methods
    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Add to container
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(notification);
        
        // Add close handler
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto remove after delay
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, type === 'error' ? 5000 : 3000);
    }

    handleKeyboardShortcuts(e) {
        // Only handle shortcuts when not in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case 'Escape':
                if (this.isMenuOpen) {
                    this.closeGameMenu();
                } else if (this.currentScreen === 'game-screen') {
                    this.toggleGameMenu();
                }
                break;
            case 'F11':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'Enter':
                if (this.currentScreen === 'game-screen' && !this.isMenuOpen) {
                    // Focus chat input
                    const chatInput = document.getElementById('chat-input');
                    if (chatInput) {
                        chatInput.focus();
                    }
                }
                break;
        }
    }

    handleWindowResize() {
        // Update mobile class
        if (this.isMobile()) {
            document.body.classList.add('mobile');
            document.body.classList.remove('desktop');
        } else {
            document.body.classList.add('desktop');
            document.body.classList.remove('mobile');
        }
        
        // Resize game canvas if needed
        if (this.game.canvas) {
            this.game.canvas.width = Math.min(800, window.innerWidth - 40);
            this.game.canvas.height = Math.min(600, window.innerHeight - 200);
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    adjustMobileUI() {
        // Adjust UI for mobile devices
        const gameCanvas = document.getElementById('game-canvas');
        if (gameCanvas) {
            gameCanvas.style.width = '100%';
            gameCanvas.style.height = 'auto';
        }
        
        // Adjust chat window
        const chatWindow = document.getElementById('chat-window');
        if (chatWindow) {
            chatWindow.style.height = '200px';
        }
    }

    applySettings(settings) {
        // Apply volume settings
        if (settings.volume !== undefined) {
            // Apply audio volume (when audio is implemented)
            localStorage.setItem('game-volume', settings.volume);
        }
        
        // Apply graphics settings
        if (settings.graphics) {
            localStorage.setItem('graphics-quality', settings.graphics);
        }
        
        // Apply control settings
        if (settings.controls) {
            localStorage.setItem('controls', settings.controls);
        }
    }

    loadSettings() {
        // Load saved settings
        const volume = localStorage.getItem('game-volume') || '50';
        const graphics = localStorage.getItem('graphics-quality') || 'medium';
        const controls = localStorage.getItem('controls') || 'keyboard';
        
        // Update settings form
        const volumeInput = document.getElementById('volume-setting');
        const graphicsSelect = document.getElementById('graphics-setting');
        const controlsSelect = document.getElementById('controls-setting');
        
        if (volumeInput) volumeInput.value = volume;
        if (graphicsSelect) graphicsSelect.value = graphics;
        if (controlsSelect) controlsSelect.value = controls;
        
        return { volume: parseInt(volume), graphics, controls };
    }

    // Device detection
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth < 768;
    }

    isTablet() {
        return /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768 && window.innerWidth < 1024;
    }

    // URL parameter handling
    handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        
        if (roomCode) {
            // Auto-fill room code and switch to join screen
            const roomCodeInput = document.querySelector('input[name="room-code"]');
            if (roomCodeInput) {
                roomCodeInput.value = roomCode;
            }
            
            this.showScreen('join-room');
        }
    }

    // Initialize URL parameter handling
    init() {
        this.handleURLParameters();
        this.loadSettings();
    }
}

// Export for use in other modules
window.UIManager = UIManager;
