// Main game logic and state management
class EscapeRoomGame {
    constructor() {
        this.playerId = null;
        this.roomCode = null;
        this.isHost = false;
        this.gameStarted = false;
        this.players = new Map();
        this.gameObjects = new Map();
        this.inventory = [];
        this.currentPosition = { x: 100, y: 100 };
        this.selectedIP = null;
        this.wsPort = 8080;
        
        // Game canvas and context
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0 };
        this.scale = 1;
        
        // Input handling
        this.keys = {};
        this.mousePos = { x: 0, y: 0 };
        this.lastMoveTime = 0;
        this.moveThrottle = 16; // 60 FPS (16ms between frames)
        
        // WebSocket client
        this.wsClient = new WebSocketClient(this);
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Canvas event listeners will be added when canvas is created
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Mobile touch controls
        this.setupMobileControls();
    }

    setupMobileControls() {
        // Handle the existing mobile controls in the HTML
        const mobileControls = document.getElementById('mobileControls');
        if (!mobileControls) return;
        
        console.log('🎮 Setting up mobile controls');
        
        // D-pad buttons for movement
        const dpadButtons = mobileControls.querySelectorAll('.d-btn');
        dpadButtons.forEach(button => {
            const key = button.getAttribute('data-key');
            if (key) {
                // Prevent default touch behavior
                button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    console.log(`🎮 Mobile: ${key} pressed`);
                    this.keys[key] = true;
                }, { passive: false });
                
                button.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    console.log(`🎮 Mobile: ${key} released`);
                    this.keys[key] = false;
                }, { passive: false });
                
                // Also handle mouse events for desktop testing
                button.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this.keys[key] = true;
                });
                
                button.addEventListener('mouseup', (e) => {
                    e.preventDefault();
                    this.keys[key] = false;
                });
            }
        });
        
        // Action buttons for interactions
        const actionButtons = mobileControls.querySelectorAll('.action-btn');
        actionButtons.forEach(button => {
            const key = button.getAttribute('data-key');
            if (key) {
                button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    console.log(`🎮 Mobile action: ${key}`);
                    this.handleMobileAction(key);
                }, { passive: false });
                
                // Also handle click for desktop testing
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleMobileAction(key);
                });
            }
        });
    }

    setupJoystickControls(container) {
        const base = container.querySelector('.joystick-base');
        const knob = container.querySelector('.joystick-knob');
        const interactBtn = container.querySelector('.interact-btn');
        const menuBtn = container.querySelector('.menu-btn');
        
        let isDragging = false;
        let startX, startY;
        
        const handleStart = (e) => {
            isDragging = true;
            const touch = e.touches ? e.touches[0] : e;
            const rect = base.getBoundingClientRect();
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
        };
        
        const handleMove = (e) => {
            if (!isDragging) return;
            
            const touch = e.touches ? e.touches[0] : e;
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 30;
            
            if (distance <= maxDistance) {
                knob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                
                // Convert to movement
                const moveX = deltaX / maxDistance;
                const moveY = deltaY / maxDistance;
                this.handleMobileMovement(moveX, moveY);
            }
        };
        
        const handleEnd = () => {
            isDragging = false;
            knob.style.transform = 'translate(0, 0)';
            this.handleMobileMovement(0, 0);
        };
        
        base.addEventListener('touchstart', handleStart);
        base.addEventListener('mousedown', handleStart);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('mouseup', handleEnd);
        
        interactBtn.addEventListener('click', () => this.handleInteraction());
        menuBtn.addEventListener('click', () => this.toggleGameMenu());
    }

    handleMobileMovement(x, y) {
        const speed = 2;
        const newX = this.currentPosition.x + (x * speed);
        const newY = this.currentPosition.y + (y * speed);
        
        this.movePlayer(newX, newY);
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // WebSocket connection management
    connect(ip, port = 8080) {
        this.selectedIP = ip;
        this.wsPort = port;
        return this.wsClient.connect(ip, port);
    }

    // WebSocket event handlers (called by WebSocketClient)
    onWebSocketConnected() {
        console.log('Game: WebSocket connected');
    }

    onWebSocketDisconnected(event) {
        console.log('Game: WebSocket disconnected');
    }

    onWebSocketError(error) {
        console.error('Game: WebSocket error', error);
        this.showError('Connection error occurred');
    }

    onWebSocketReconnectFailed() {
        this.showError('Connection lost. Please refresh and try again.');
    }

    handleServerMessage(message) {
        if (!message || typeof message !== 'object') {
            console.error('Invalid message received:', message);
            return;
        }
        
        const { type, data } = message;
        
        if (!type) {
            console.error('Message missing type:', message);
            return;
        }
        
        switch (type) {
            case 'room_created':
                this.handleRoomCreated(data);
                break;
            case 'room_joined':
                this.handleRoomJoined(data);
                break;
            case 'player_joined':
                this.handlePlayerJoined(data);
                break;
            case 'player_left':
                this.handlePlayerLeft(data);
                break;
            case 'player_moved':
                this.handlePlayerMoved(data);
                break;
            case 'player_interacted':
                this.handlePlayerInteracted(data);
                break;
            case 'game_started':
                this.handleGameStarted(data);
                break;
            case 'game_reset':
                this.handleGameReset(data);
                break;
            case 'chat_message':
                this.handleChatMessage(data);
                break;
            case 'error':
                this.showError((data && data.message) || 'An error occurred');
                break;
            default:
                console.warn('Unknown message type:', type);
        }
    }

    // Room management
    async createRoom(playerName, isPrivate = false) {
        console.log(`🔍 DEBUG: createRoom called with playerName: ${playerName}, isPrivate: ${isPrivate}`);
        
        // Check if WebSocket exists and is connected
        console.log(`🔍 DEBUG: Pre-check - wsClient exists: ${!!this.wsClient}`);
        console.log(`🔍 DEBUG: Pre-check - wsClient.ws exists: ${this.wsClient && !!this.wsClient.ws}`);
        
        if (this.wsClient && this.wsClient.ws) {
            console.log(`🔍 DEBUG: Pre-check - WebSocket readyState: ${this.wsClient.ws.readyState}`);
            console.log(`🔍 DEBUG: Pre-check - WebSocket.OPEN: ${WebSocket.OPEN}`);
        }
        
        // Wait longer for connection to stabilize - WebSocket might be connecting but not ready
        console.log(`🔍 DEBUG: Waiting for connection to stabilize...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Increased to 1 second
        console.log(`🔍 DEBUG: After connection stabilization delay`);
        
        // Check direct WebSocket state instead of using the method
        const directConnectionCheck = this.wsClient && this.wsClient.ws && this.wsClient.ws.readyState === WebSocket.OPEN;
        console.log(`🔍 DEBUG: Direct connection check result: ${directConnectionCheck}`);
        
        if (directConnectionCheck) {
            console.log(`🔍 DEBUG: Direct check passed - sending create_room message`);
            this.sendMessage('create_room', {
                playerName,
                isPrivate
            });
            return;
        }
        
        // Try multiple times if needed
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`🔍 DEBUG: Connection check attempt ${attempts}/${maxAttempts}`);
            
            // Use both methods to check connection
            const methodCheck = this.isConnectedToServer();
            const directCheck = this.wsClient && this.wsClient.ws && this.wsClient.ws.readyState === WebSocket.OPEN;
            
            console.log(`🔍 DEBUG: Method check: ${methodCheck}, Direct check: ${directCheck}`);
            
            if (methodCheck || directCheck) {
                console.log(`🔍 DEBUG: Connection check passed on attempt ${attempts} - sending create_room message`);
                this.sendMessage('create_room', {
                    playerName,
                    isPrivate
                });
                return;
            }
            
            console.log(`🔍 DEBUG: Connection check failed on attempt ${attempts}, waiting 200ms...`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('🚨 DEBUG: All connection attempts failed - not connected to server');
        this.showError('Connection issue detected. WebSocket appears connected but connection check fails. Check console for details.');
    }

    joinRoom(roomCode, playerName) {
        if (!this.isConnectedToServer()) {
            this.showError('Not connected to server');
            return;
        }

        this.sendMessage('join_room', {
            roomCode: roomCode.toUpperCase(),
            playerName
        });
    }

    leaveRoom() {
        if (this.isConnectedToServer() && this.roomCode) {
            this.sendMessage('leave_room', {});
        }
        this.resetGameState();
    }

    startGame() {
        if (!this.isHost) {
            this.showError('Only the host can start the game');
            return;
        }

        this.sendMessage('game_start', {});
    }

    resetGame() {
        if (!this.isHost) {
            this.showError('Only the host can reset the game');
            return;
        }

        this.sendMessage('game_reset', {});
    }

    // Player movement and interactions
    handleKeyDown(e) {
        this.keys[e.key.toLowerCase()] = true;
        
        if (e.key.toLowerCase() === 'e') {
            this.handleInteraction();
        }
        
        if (e.key === 'Escape') {
            this.toggleGameMenu();
        }
    }

    handleKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }

    updatePlayerMovement() {
        // Allow movement even if game not officially started for testing
        const now = Date.now();
        if (now - this.lastMoveTime < this.moveThrottle) return;
        
        let moveX = 0;
        let moveY = 0;
        const speed = 3; // Smooth movement with smaller steps
        
        if (this.keys['w'] || this.keys['arrowup']) moveY -= speed;
        if (this.keys['s'] || this.keys['arrowdown']) moveY += speed;
        if (this.keys['a'] || this.keys['arrowleft']) moveX -= speed;
        if (this.keys['d'] || this.keys['arrowright']) moveX += speed;
        
        if (moveX !== 0 || moveY !== 0) {
            const newX = this.currentPosition.x + moveX;
            const newY = this.currentPosition.y + moveY;
            this.movePlayer(newX, newY);
            this.lastMoveTime = now;
        }
    }

    movePlayer(x, y) {
        // Simple boundary checking for container
        const gameWorld = document.getElementById('gameWorld');
        if (!gameWorld) return;
        
        const bounds = gameWorld.getBoundingClientRect();
        const minX = 10; // Player radius
        const minY = 10;
        const maxX = bounds.width - 10;
        const maxY = bounds.height - 10;
        
        const newPosition = {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y))
        };
        
        // No collision detection for now - just move
        this.currentPosition = newPosition;
        
        // Update the player HTML element position immediately
        this.updatePlayerPosition();
        
        // Send to server if connected
        if (this.isConnectedToServer()) {
            this.sendMessage('player_move', {
                position: this.currentPosition
            });
        }
    }

    updatePlayerPosition() {
        const currentPlayerElement = document.getElementById('currentPlayer');
        if (currentPlayerElement) {
            // Use CSS transform for smoother movement
            currentPlayerElement.style.transform = `translate(${this.currentPosition.x - 10}px, ${this.currentPosition.y - 10}px)`;
        }
    }

    checkCollision(position) {
        // Check collision with walls and objects
        for (const [objectId, gameObject] of this.gameObjects) {
            if (gameObject.solid && this.isColliding(position, gameObject)) {
                return true;
            }
        }
        return false;
    }

    isColliding(position, object) {
        const playerSize = 20;
        return position.x < object.x + object.width &&
               position.x + playerSize > object.x &&
               position.y < object.y + object.height &&
               position.y + playerSize > object.y;
    }

    handleInteraction() {
        if (!this.gameStarted) return;
        
        // Find nearby interactable objects
        const interactionRange = 50;
        let nearestObject = null;
        let nearestDistance = Infinity;
        
        for (const [objectId, gameObject] of this.gameObjects) {
            if (gameObject.interactable) {
                const distance = this.getDistance(this.currentPosition, gameObject);
                if (distance < interactionRange && distance < nearestDistance) {
                    nearestObject = gameObject;
                    nearestDistance = distance;
                }
            }
        }
        
        if (nearestObject) {
            this.sendMessage('player_interact', {
                objectId: nearestObject.id,
                interactionType: 'use'
            });
        }
    }

    handleInteraction(gameObject) {
        if (!this.gameStarted) return;
        
        // Check if player is close enough to interact
        const distance = this.getDistance(this.currentPosition, {
            x: gameObject.x + gameObject.width / 2,
            y: gameObject.y + gameObject.height / 2
        });
        
        if (distance > 50) {
            this.showNotification('Too far away to interact', 'warning');
            return;
        }
        
        // Send interaction message to server
        this.sendMessage('player_interact', {
            objectId: gameObject.id,
            interactionType: 'click'
        });
        
        // Show interaction feedback
        this.showNotification(`Interacting with ${gameObject.name || gameObject.type}`, 'info');
    }

    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Game rendering
    initializeCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'gameCanvas';
            this.canvas.width = 800;
            this.canvas.height = 600;
            document.getElementById('game-area')?.appendChild(this.canvas);
        }
        
        // Set canvas size to match display size
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvasEvents();
        
        console.log(`🎮 Canvas initialized: ${this.canvas.width}x${this.canvas.height}`);
        console.log(`🎮 Player position: ${this.currentPosition.x}, ${this.currentPosition.y}`);
        
        this.gameLoop();
    }

    setupCanvasEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        });

        this.canvas.addEventListener('click', (e) => {
            if (!this.gameStarted) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const clickPos = {
                x: e.clientX - rect.left + this.camera.x,
                y: e.clientY - rect.top + this.camera.y
            };
            
            // Handle click interactions
            this.handleCanvasClick(clickPos);
        });
    }

    handleCanvasClick(position) {
        // Check if clicked on an interactable object
        for (const [objectId, gameObject] of this.gameObjects) {
            if (gameObject.interactable && this.isPositionInObject(position, gameObject)) {
                this.sendMessage('player_interact', {
                    objectId: objectId,
                    interactionType: 'click'
                });
                break;
            }
        }
    }

    isPositionInObject(position, object) {
        return position.x >= object.x &&
               position.x <= object.x + object.width &&
               position.y >= object.y &&
               position.y <= object.y + object.height;
    }

    gameLoop() {
        this.updatePlayerMovement();
        this.updateCamera();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    updateCamera() {
        const gameWorld = document.getElementById('gameWorld');
        if (!gameWorld) return;
        
        // For HTML elements, we can use transform to simulate camera movement
        // Currently keeping it simple without camera following, but this can be extended
        gameWorld.style.transform = `translate(${-this.camera.x}px, ${-this.camera.y}px)`;
    }

    render() {
        // Simple rendering - just the player dot
        this.renderPlayers();
        
        // Update UI info
        this.renderUI();
    }

    renderGameObjects() {
        // Minimal - no game objects for now, just clean slate
        const gameWorld = document.getElementById('gameWorld');
        if (!gameWorld) {
            console.error('Game world container not found');
            return;
        }

        // Clear all existing game objects
        const existingObjects = gameWorld.querySelectorAll('.game-object:not(.player)');
        existingObjects.forEach(obj => obj.remove());
        
        // We'll add objects later - starting simple
    }

    renderPlayers() {
        const gameWorld = document.getElementById('gameWorld');
        if (!gameWorld) {
            console.error('Game world container not found');
            return;
        }

        // Remove existing player elements
        const existingPlayers = gameWorld.querySelectorAll('.player');
        existingPlayers.forEach(player => player.remove());

        // Render current player as a simple dot
        const currentPlayerElement = document.createElement('div');
        currentPlayerElement.className = 'player current-player';
        currentPlayerElement.id = 'currentPlayer';
        
        // Make it a simple dot - 20px circle with smooth transitions
        currentPlayerElement.style.position = 'absolute';
        currentPlayerElement.style.left = '0px';
        currentPlayerElement.style.top = '0px';
        currentPlayerElement.style.transform = `translate(${this.currentPosition.x - 10}px, ${this.currentPosition.y - 10}px)`;
        currentPlayerElement.style.width = '20px';
        currentPlayerElement.style.height = '20px';
        currentPlayerElement.style.backgroundColor = '#e74c3c';
        currentPlayerElement.style.border = '2px solid #fff';
        currentPlayerElement.style.borderRadius = '50%';
        currentPlayerElement.style.boxSizing = 'border-box';
        currentPlayerElement.style.zIndex = '100';
        currentPlayerElement.style.transition = 'transform 0.05s linear'; // Smooth movement
        
        gameWorld.appendChild(currentPlayerElement);
        
        console.log(`🎮 Player dot rendered at ${this.currentPosition.x}, ${this.currentPosition.y}`);
    }

    renderUI() {
        // Update game info in the header
        const gameInfo = document.querySelector('.game-info');
        if (gameInfo && this.roomCode) {
            let infoText = `Room: ${this.roomCode}`;
            if (this.players.size > 0) {
                infoText += ` | Players: ${this.players.size}`;
            }
            if (this.isHost) {
                infoText += ' | HOST';
            }
            gameInfo.textContent = infoText;
        }
    }

    // Message handling
    handleRoomCreated(data) {
        console.log(`🔍 DEBUG: handleRoomCreated called with data:`, data);
        
        this.roomCode = data.roomCode;
        this.playerId = data.playerId;
        this.isHost = data.isHost;
        
        // Add the host (current player) to the players map
        this.players.set(this.playerId, {
            playerId: this.playerId,
            name: data.playerName || 'Host',
            position: { x: 100, y: 100 },
            isHost: this.isHost
        });
        
        console.log(`🔍 DEBUG: Room created - roomCode: ${this.roomCode}, playerId: ${this.playerId}, isHost: ${this.isHost}`);
        
        // Save session data
        this.saveSessionData();
        
        // Show share link
        this.showShareLink();
        
        // Switch to lobby view instead of game view
        console.log(`🔍 DEBUG: Switching to lobby view...`);
        this.switchToLobbyView();
    }

    handleRoomJoined(data) {
        this.roomCode = data.roomCode;
        this.playerId = data.playerId;
        this.isHost = data.isHost;
        
        // Add existing players
        data.players.forEach(player => {
            this.players.set(player.playerId, player);
        });
        
        // Save session data
        this.saveSessionData();
        
        // Switch to lobby view instead of game view
        this.switchToLobbyView();
    }

    handlePlayerJoined(data) {
        this.players.set(data.playerId, {
            playerId: data.playerId,
            name: data.name,
            position: data.position,
            isHost: false
        });
        
        this.showNotification(`${data.name} joined the room`);
        
        // Update lobby if we're in lobby view
        if (document.getElementById('lobbyScreen').style.display !== 'none') {
            this.updatePlayersList();
            this.updateStartGameButton();
        }
    }

    handlePlayerLeft(data) {
        this.players.delete(data.playerId);
        this.showNotification(`${data.playerName} left the room`);
        
        // Update lobby if we're in lobby view
        if (document.getElementById('lobbyScreen').style.display !== 'none') {
            this.updatePlayersList();
            this.updateStartGameButton();
        }
    }

    handlePlayerMoved(data) {
        const player = this.players.get(data.playerId);
        if (player) {
            player.position = data.position;
        }
    }

    handlePlayerInteracted(data) {
        // Handle interaction effects
        console.log('Player interaction:', data);
    }

    handleGameStarted(data) {
        this.gameStarted = true;
        this.showNotification('Game started!', 'success');
        
        // Switch from lobby to game view
        this.switchToGameView();
        
        // Initialize game objects (can be loaded from server or predefined)
        this.initializeGameObjects();
    }

    handleGameReset(data) {
        this.gameStarted = false;
        this.gameObjects.clear();
        this.inventory = [];
        this.currentPosition = { x: 100, y: 100 };
        
        // Reset all players positions
        this.players.forEach(player => {
            player.position = { x: 100, y: 100 };
        });
        
        this.showNotification('Game reset', 'info');
    }

    handleChatMessage(data) {
        this.addChatMessage(data.playerName, data.message, data.timestamp);
    }

    // UI Management
    showShareLink() {
        if (this.selectedIP && this.roomCode) {
            const shareUrl = `http://${this.selectedIP}:${window.location.port || 80}/escape.html?room=${this.roomCode}`;
            
            // Update share link in UI
            const shareLinkElement = document.getElementById('share-link');
            if (shareLinkElement) {
                shareLinkElement.value = shareUrl;
                shareLinkElement.style.display = 'block';
            }
        }
    }

    switchToGameView() {
        console.log(`🔍 DEBUG: switchToGameView called`);
        
        // Hide menu screens
        document.querySelectorAll('.screen').forEach(screen => {
            console.log(`🔍 DEBUG: Hiding screen:`, screen.id);
            screen.style.display = 'none';
        });
        
        // Show game screen
        const gameScreen = document.getElementById('gameScreen');
        console.log(`🔍 DEBUG: Game screen element:`, gameScreen);
        if (gameScreen) {
            console.log(`🔍 DEBUG: Showing game screen`);
            gameScreen.style.display = 'block';
        } else {
            console.error(`🔍 DEBUG: Game screen not found!`);
        }
        
        // Initialize canvas if not already done
        if (!this.canvas) {
            console.log(`🔍 DEBUG: Initializing canvas`);
            this.initializeCanvas();
        }
        
        // Start the game loop for movement and rendering
        if (!this.gameLoopStarted) {
            this.gameLoopStarted = true;
            this.gameLoop();
        }
        
        // Initialize game objects and start rendering
        this.initializeGameObjects();
        
        // Setup chat Enter key support
        this.setupChatControls();
        
        // Setup game UI event listeners
        this.setupGameEventListeners();
    }

    switchToLobbyView() {
        console.log(`🔍 DEBUG: switchToLobbyView called`);
        
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });
        
        // Show lobby screen
        const lobbyScreen = document.getElementById('lobbyScreen');
        if (lobbyScreen) {
            lobbyScreen.style.display = 'block';
        } else {
            console.error('Lobby screen not found!');
            return;
        }
        
        // Update lobby UI
        this.updateLobbyUI();
        
        // Setup lobby event listeners
        this.setupLobbyEventListeners();
    }

    updateLobbyUI() {
        console.log(`🔍 DEBUG: updateLobbyUI called`);
        
        // Update room code display
        const roomCodeDisplay = document.getElementById('roomCodeDisplay');
        if (roomCodeDisplay) {
            roomCodeDisplay.textContent = this.roomCode;
        }
        
        // Update game room code display
        const gameRoomCode = document.getElementById('gameRoomCode');
        if (gameRoomCode) {
            gameRoomCode.textContent = this.roomCode;
        }
        
        // Update share URL
        this.updateShareURL();
        
        // Update players list
        this.updatePlayersList();
        
        // Show/hide host controls
        const hostControls = document.getElementById('hostControls');
        if (hostControls) {
            hostControls.style.display = this.isHost ? 'block' : 'none';
        }
        
        // Enable/disable start game button
        this.updateStartGameButton();
    }

    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        
        if (!playersList || !playerCount) return;
        
        // Clear existing list
        playersList.innerHTML = '';
        
        // Use the players map directly - it should contain all players including the current one
        const playersArray = Array.from(this.players.values()).sort((a, b) => {
            if (a.isHost && !b.isHost) return -1;
            if (!a.isHost && b.isHost) return 1;
            return 0;
        });
        
        playersArray.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            
            const isCurrentPlayer = player.playerId === this.playerId;
            const playerName = isCurrentPlayer ? `${player.name} (You)` : player.name;
            const hostBadge = player.isHost ? ' 👑' : '';
            
            playerElement.innerHTML = `
                <span class="player-name">${playerName}${hostBadge}</span>
                <span class="player-status">Ready</span>
            `;
            
            if (isCurrentPlayer) {
                playerElement.classList.add('current-player');
            }
            
            playersList.appendChild(playerElement);
        });
        
        // Update player count
        playerCount.textContent = this.players.size;
    }

    updateStartGameButton() {
        const startGameBtn = document.getElementById('startGameBtn');
        if (!startGameBtn) return;
        
        // Only host can start the game
        if (!this.isHost) {
            startGameBtn.style.display = 'none';
            return;
        }
        
        startGameBtn.style.display = 'block';
        
        // Use the actual player count from the players Map
        const playerCount = this.players.size;
        startGameBtn.disabled = playerCount < 1;
        
        if (playerCount >= 1) {
            startGameBtn.textContent = `🚀 Start Game (${playerCount} player${playerCount > 1 ? 's' : ''})`;
        } else {
            startGameBtn.textContent = '🚀 Waiting for players...';
        }
    }

    updateShareURL() {
        const shareUrlInput = document.getElementById('roomShareUrl');
        if (!shareUrlInput || !this.roomCode) return;
        
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.split('?')[0];
        const shareUrl = `${baseUrl}?room=${this.roomCode}`;
        
        shareUrlInput.value = shareUrl;
    }

    setupLobbyEventListeners() {
        console.log(`🔍 DEBUG: setupLobbyEventListeners called`);
        
        // Start game button
        const startGameBtn = document.getElementById('startGameBtn');
        if (startGameBtn) {
            startGameBtn.removeEventListener('click', this.handleStartGame.bind(this));
            startGameBtn.addEventListener('click', this.handleStartGame.bind(this));
        }
        
        // Leave lobby button
        const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
        if (leaveLobbyBtn) {
            leaveLobbyBtn.removeEventListener('click', this.handleLeaveLobby.bind(this));
            leaveLobbyBtn.addEventListener('click', this.handleLeaveLobby.bind(this));
        }
        
        // Copy room URL button
        const copyRoomUrlBtn = document.getElementById('copyRoomUrl');
        if (copyRoomUrlBtn) {
            copyRoomUrlBtn.removeEventListener('click', this.handleCopyRoomUrl.bind(this));
            copyRoomUrlBtn.addEventListener('click', this.handleCopyRoomUrl.bind(this));
        }
    }

    handleStartGame() {
        if (!this.isHost || !this.isConnectedToServer()) return;
        
        console.log('Starting game...');
        this.sendMessage('game_start', {
            timeLimit: document.getElementById('timeLimit')?.value || 3600,
            difficulty: document.getElementById('difficulty')?.value || 'medium'
        });
    }

    handleLeaveLobby() {
        if (confirm('Are you sure you want to leave the room?')) {
            this.leaveRoom();
        }
    }

    handleCopyRoomUrl() {
        const shareUrlInput = document.getElementById('roomShareUrl');
        if (shareUrlInput) {
            shareUrlInput.select();
            document.execCommand('copy');
            
            // Show feedback
            const copyBtn = document.getElementById('copyRoomUrl');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            }
        }
    }
    
    sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) {
            console.error('📱 Chat input not found');
            return;
        }
        
        const message = chatInput.value.trim();
        if (!message) {
            console.log('📱 Empty message, not sending');
            return;
        }
        
        console.log('📱 Sending chat message:', message);
        
        if (this.wsClient && this.wsClient.isConnected()) {
            const success = this.wsClient.sendMessage('chat_message', { 
                message: message,
                playerName: this.players.get(this.playerId)?.name || 'Unknown',
                timestamp: Date.now()
            });
            
            if (success) {
                chatInput.value = '';
                console.log('📱 Chat message sent successfully');
            } else {
                console.error('📱 Failed to send chat message');
            }
        } else {
            console.error('📱 WebSocket not connected, cannot send chat message');
        }
    }

    // Game interaction methods
    interact() {
        // Basic interaction logic - can be expanded later
        const nearbyObjects = this.findNearbyInteractables();
        if (nearbyObjects.length > 0) {
            const obj = nearbyObjects[0];
            this.sendMessage('interact', {
                objectId: obj.id,
                position: this.currentPosition
            });
        }
    }

    toggleInventory() {
        const inventoryPanel = document.querySelector('.inventory-panel');
        if (inventoryPanel) {
            inventoryPanel.classList.toggle('expanded');
        }
    }

    findNearbyInteractables() {
        // Return objects within interaction range
        // This is a placeholder - implement based on your game objects
        return [];
    }

    // Session persistence methods
    saveSessionData() {
        if (this.roomCode && this.playerId) {
            const sessionData = {
                roomCode: this.roomCode,
                playerId: this.playerId,
                isHost: this.isHost,
                playerName: this.players.get(this.playerId)?.name || '',
                timestamp: Date.now()
            };
            
            localStorage.setItem('escapeRoomSession', JSON.stringify(sessionData));
            console.log('💾 Session data saved:', sessionData);
        }
    }
    
    loadSessionData() {
        const saved = localStorage.getItem('escapeRoomSession');
        if (!saved) return null;
        
        try {
            const sessionData = JSON.parse(saved);
            
            // Check if session is still valid (not older than 1 hour)
            if (Date.now() - sessionData.timestamp > 3600000) {
                localStorage.removeItem('escapeRoomSession');
                return null;
            }
            
            console.log('💾 Loaded session data:', sessionData);
            return sessionData;
        } catch (error) {
            console.error('💾 Error loading session data:', error);
            localStorage.removeItem('escapeRoomSession');
            return null;
        }
    }
    
    clearSessionData() {
        localStorage.removeItem('escapeRoomSession');
        console.log('💾 Session data cleared');
    }

    tryReconnectSession() {
        const sessionData = this.loadSessionData();
        if (!sessionData) {
            console.log('💾 No valid session data found');
            return false;
        }
        
        console.log('💾 Attempting to reconnect to session:', sessionData);
        
        // Set the player data
        this.roomCode = sessionData.roomCode;
        this.playerId = sessionData.playerId;
        this.isHost = sessionData.isHost;
        
        // Add player to players map
        this.players.set(this.playerId, {
            playerId: this.playerId,
            name: sessionData.playerName,
            position: { x: 100, y: 100 },
            isHost: this.isHost
        });
        
        // Connect to WebSocket and rejoin room
        this.wsClient.connect('localhost').then(() => {
            console.log('💾 Reconnected to WebSocket, rejoining room...');
            this.sendMessage('join_room', {
                roomCode: this.roomCode,
                playerName: sessionData.playerName
            });
        }).catch(error => {
            console.error('💾 Failed to reconnect:', error);
            this.clearSessionData();
        });
        
        return true;
    }

    // Helper methods
    sendMessage(type, data) {
        console.log(`🔍 DEBUG: sendMessage called with type: ${type}, data:`, data);
        console.log(`🔍 DEBUG: WebSocket state before send: ${this.wsClient.ws ? this.wsClient.ws.readyState : 'null'}`);
        
        const result = this.wsClient.sendMessage(type, data);
        console.log(`🔍 DEBUG: sendMessage result:`, result);
        return result;
    }

    isConnectedToServer() {
        console.log(`🔍 DEBUG: isConnectedToServer() called from game.js`);
        console.log(`🔍 DEBUG: this.wsClient exists: ${!!this.wsClient}`);
        
        if (!this.wsClient) {
            console.log(`🔍 DEBUG: No wsClient - returning false`);
            return false;
        }
        
        console.log(`🔍 DEBUG: wsClient.ws exists: ${this.wsClient && !!this.wsClient.ws}`);
        
        if (this.wsClient && this.wsClient.ws) {
            console.log(`🔍 DEBUG: WebSocket readyState: ${this.wsClient.ws.readyState}`);
            console.log(`🔍 DEBUG: WebSocket.OPEN constant: ${WebSocket.OPEN}`);
            console.log(`🔍 DEBUG: readyState === OPEN: ${this.wsClient.ws.readyState === WebSocket.OPEN}`);
        }
        
        console.log(`🔍 DEBUG: wsClient.connectionState: ${this.wsClient ? this.wsClient.connectionState : 'N/A'}`);
        
        // Call the WebSocket client's isConnected method
        const isConnectedResult = this.wsClient ? this.wsClient.isConnected() : false;
        console.log(`🔍 DEBUG: wsClient.isConnected() returned: ${isConnectedResult}`);
        
        // Double-check by directly inspecting WebSocket state
        const directCheck = this.wsClient && this.wsClient.ws && this.wsClient.ws.readyState === WebSocket.OPEN;
        console.log(`🔍 DEBUG: Direct WebSocket state check: ${directCheck}`);
        
        console.log(`🔍 DEBUG: Final result - isConnected: ${isConnectedResult}, directCheck: ${directCheck}`);
        
        // Return the direct check if wsClient.isConnected() seems wrong
        return directCheck;
    }

    resetGameState() {
        this.playerId = null;
        this.roomCode = null;
        this.isHost = false;
        this.gameStarted = false;
        this.players.clear();
        this.gameObjects.clear();
        this.inventory = [];
        this.currentPosition = { x: 100, y: 100 };
    }

    // Public API methods
    setSelectedIP(ip) {
        this.selectedIP = ip;
    }

    getSelectedIP() {
        return this.selectedIP;
    }

    isGameStarted() {
        return this.gameStarted;
    }

    getCurrentRoom() {
        return this.roomCode;
    }

    getPlayers() {
        return Array.from(this.players.values());
    }

    disconnect() {
        this.wsClient.disconnect();
    }

    // UI and Notification Methods
    showNotification(message, type = 'info') {
        console.log(`🔔 ${type.toUpperCase()}: ${message}`);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
        // Also show in any existing notification areas
        const notificationArea = document.getElementById('notifications');
        if (notificationArea) {
            const notifElement = document.createElement('div');
            notifElement.className = `notification ${type}`;
            notifElement.textContent = message;
            notificationArea.appendChild(notifElement);
            
            setTimeout(() => {
                if (notifElement.parentNode) {
                    notifElement.parentNode.removeChild(notifElement);
                }
            }, 3000);
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
        console.error('Game Error:', message);
    }

    handleMobileAction(key) {
        // Handle action buttons (interact, inventory)
        if (key === 'e') {
            this.interact();
        } else if (key === 'i') {
            this.toggleInventory();
        }
    }

    setupChatControls() {
        const chatInput = document.getElementById('chatInput');
        const sendChatBtn = document.getElementById('sendChatBtn');
        
        if (chatInput) {
            // Handle Enter key to send messages
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }
        
        if (sendChatBtn) {
            // Handle send button click
            sendChatBtn.addEventListener('click', () => {
                this.sendChatMessage();
            });
        }
    }
}

// Export for use in other modules
window.EscapeRoomGame = EscapeRoomGame;
