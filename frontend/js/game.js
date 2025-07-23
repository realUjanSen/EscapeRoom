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
        this.currentPosition = { x: 200, y: 134 }; // Start in center of NW room (400x268)
        this.selectedIP = null;
        this.wsPort = 8080;
        this.currentScreen = 'mainMenu';
        this.roomListUpdateInterval = null;
        
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
        
        // Touch handling
        this.touchStartTime = 0;
        this.touchMoved = false;
        
        // Click/Touch destination for progressive movement
        this.destination = null;
        
        // Interaction debounce to prevent rapid repeated interactions
        this.lastInteractionTime = 0;
        this.interactionCooldown = 300; // 300ms cooldown between interactions
        
        // Game world dimensions (fixed size that scales to fit screen)
        this.GAME_WORLD_WIDTH = 800;
        this.GAME_WORLD_HEIGHT = 536;
        
        // Room system
        this.roomTransitions = {
            'NW': ['SW'],    // Start only leads to SW
            'SW': ['SE'],    // SW only leads to SE
            'SE': ['NE'],    // SE only leads to NE
            'NE': []         // NE is the final room
        };
        this.rooms = new Map();
        this.currentRoom = 'NW'; // Start in Northwest
        this.setupRooms(); // Define room bounds
        
        // Game state tracking
        this.gameState = {
            hasKeyA: false,
            hasKeyB: false,
            hasKeyC: false,
            hasUSB: false,
            knowsCode: false,
            guardAsleep: false
        };
        
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
            case 'door_state_change':
                this.handleDoorStateChange(data);
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
        
        // Clear any existing players from previous sessions
        this.players.clear();
        
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

        // Clear any existing players from previous sessions
        this.players.clear();

        this.sendMessage('join_room', {
            roomCode: roomCode.toUpperCase(),
            playerName
        });
    }

    leaveRoom() {
        console.log('🚪 DEBUG: leaveRoom called');
        if (this.isConnectedToServer() && this.roomCode) {
            console.log('🚪 DEBUG: Sending leave_room message');
            this.sendMessage('leave_room', {});
        }
        this.resetGameState();
        
        // Switch back to main menu
        this.switchToMainMenu();
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
        
        // Check for doors near player on movement keys to give visual feedback
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
            this.checkForNearbyDoors();
        }
    }
    
    // Visual feedback for nearby doors
    checkForNearbyDoors() {
        const nearbyDoor = this.findNearbyDoor();
        if (nearbyDoor && nearbyDoor.doorElement) {
            // Highlight door
            nearbyDoor.doorElement.style.boxShadow = '0 0 15px rgba(255, 255, 0, 0.8)';
            
            // Reset highlight after a short delay
            setTimeout(() => {
                if (nearbyDoor.doorElement.dataset.isOpen !== 'true') {
                    nearbyDoor.doorElement.style.boxShadow = 'none';
                }
            }, 1000);
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
        
        // Handle keyboard movement (WASD)
        if (this.keys['w'] || this.keys['arrowup']) moveY -= speed;
        if (this.keys['s'] || this.keys['arrowdown']) moveY += speed;
        if (this.keys['a'] || this.keys['arrowleft']) moveX -= speed;
        if (this.keys['d'] || this.keys['arrowright']) moveX += speed;
        
        // If player is using keyboard, cancel any click/touch destination
        if (moveX !== 0 || moveY !== 0) {
            this.destination = null;
        }
        
        // Handle click/touch destination movement (only if no keyboard input)
        if (this.destination && moveX === 0 && moveY === 0) {
            const dx = this.destination.x - this.currentPosition.x;
            const dy = this.destination.y - this.currentPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If we're close enough to destination, stop
            if (distance < speed) {
                this.destination = null;
            } else {
                // Move toward destination
                moveX = (dx / distance) * speed;
                moveY = (dy / distance) * speed;
            }
        }
        
        if (moveX !== 0 || moveY !== 0) {
            const newX = this.currentPosition.x + moveX;
            const newY = this.currentPosition.y + moveY;
            this.movePlayer(newX, newY);
            this.lastMoveTime = now;
        }
    }

    movePlayer(x, y) {
        // Use fixed game world dimensions and current room bounds
        const currentRoomData = this.rooms.get(this.currentRoom);
        if (!currentRoomData) {
            console.error('Current room not found:', this.currentRoom);
            return;
        }
        
        const room = currentRoomData.bounds;
        let minX = room.x + 10; // Player radius
        let minY = room.y + 10;
        let maxX = room.x + room.width - 10;
        let maxY = room.y + room.height - 10;
        
        // Check if player is trying to move through a door
        let newRoom = null;
        
        // Get player position and proposed position
        const playerPos = {...this.currentPosition};
        const proposedPos = {x, y};
        
        // Check if player is crossing a boundary with an open door
        for (const targetRoom of currentRoomData.doors) {
            const doorId = `door-${this.currentRoom}-to-${targetRoom}`;
            const doorIdReversed = `door-${targetRoom}-to-${this.currentRoom}`;
            
            const doorElement = document.getElementById(doorId) || document.getElementById(doorIdReversed);
            
            if (doorElement && doorElement.dataset.isOpen === 'true') {
                // Door is open - check if player is crossing through this door
                const targetRoomData = this.rooms.get(targetRoom);
                if (!targetRoomData) continue;
                
                const targetBounds = targetRoomData.bounds;
                
                // Get door position and dimensions
                const doorX = parseInt(doorElement.style.left);
                const doorY = parseInt(doorElement.style.top);
                const doorWidth = parseInt(doorElement.style.width);
                const doorHeight = parseInt(doorElement.style.height);
                
                // Create door area matching the actual door dimensions
                const doorMargin = 0; // No extra margin
                const doorArea = {
                    left: doorX - doorMargin,
                    right: doorX + doorWidth + doorMargin,
                    top: doorY - doorMargin,
                    bottom: doorY + doorHeight + doorMargin
                };
                
                // Check if player is within the door area
                const playerInDoorArea = (
                    proposedPos.x + 10 >= doorArea.left &&
                    proposedPos.x - 10 <= doorArea.right &&
                    proposedPos.y + 10 >= doorArea.top &&
                    proposedPos.y - 10 <= doorArea.bottom
                );
                
                // Check which boundary the door is on
                let crossingDoor = false;
                
                // Determine if player is at a room boundary AND within the door area
                if (playerInDoorArea) {
                    console.log('🚪 Player in door area, checking if crossing boundary');
                    
                    // Force check door status again
                    const isDoorOpen = doorElement.dataset.isOpen === 'true';
                    console.log('🚪 Door is open according to dataset:', isDoorOpen);
                    
                    if (!isDoorOpen) {
                        // Fix any visual inconsistency
                        console.log('⚠️ Door in crossing area appears closed - fixing any visual inconsistency');
                        const isHorizontal = doorWidth > doorHeight;
                        const hasOpenTransform = doorElement.style.transform && 
                                              (doorElement.style.transform.includes('-30deg') || 
                                               doorElement.style.transform.includes('30deg'));
                                               
                        if (hasOpenTransform) {
                            console.log('⚠️ Door visually appears open but dataset says closed - fixing...');
                            doorElement.dataset.isOpen = 'true';
                        }
                    }
                    
                    // Increase tolerance for boundary crossing
                    const tolerance = 15;  // Increased from 10 to make crossing easier
                    
                    // Right wall door
                    if (Math.abs(proposedPos.x - maxX) < tolerance && targetBounds.x > room.x) {
                        if (isDoorOpen) crossingDoor = true;
                    }
                    // Left wall door
                    else if (Math.abs(proposedPos.x - minX) < tolerance && targetBounds.x < room.x) {
                        if (isDoorOpen) crossingDoor = true;
                    }
                    // Bottom wall door
                    else if (Math.abs(proposedPos.y - maxY) < tolerance && targetBounds.y > room.y) {
                        if (isDoorOpen) crossingDoor = true;
                    }
                    // Top wall door
                    else if (Math.abs(proposedPos.y - minY) < tolerance && targetBounds.y < room.y) {
                        if (isDoorOpen) crossingDoor = true;
                    }
                }
                
                if (crossingDoor) {
                    // Double check that the door is actually open
                    if (doorElement.dataset.isOpen !== 'true') {
                        console.log('⚠️ Door appears to be closed but trying to cross!');
                        console.log('⚠️ Forcing door open to fix state inconsistency');
                        
                        // Fix the inconsistent door state
                        doorElement.dataset.isOpen = 'true';
                        const isHorizontal = doorWidth > doorHeight;
                        const rotation = isHorizontal ? 'rotate(-30deg)' : 'rotate(30deg)';
                        doorElement.style.transform = rotation;
                        doorElement.style.backgroundColor = '#A0522D';
                        doorElement.style.boxShadow = '0 0 10px rgba(255, 255, 0, 0.5)';
                    }
                    
                    newRoom = targetRoom;
                    console.log('🚪 Detected player crossing through door to room:', targetRoom);
                    console.log('🚪 Door position:', {x: doorX, y: doorY, width: doorWidth, height: doorHeight});
                    console.log('🚪 Player position:', proposedPos);
                    console.log('🚪 Door area:', doorArea);
                    console.log('🚪 Door is open:', doorElement.dataset.isOpen === 'true');
                } else if (playerInDoorArea) {
                    console.log('🚪 Player in door area but not crossing boundary:', {
                        playerPos: proposedPos,
                        boundaries: {minX, minY, maxX, maxY},
                        doorIsOpen: doorElement.dataset.isOpen === 'true'
                    });
                    break;
                }
            }
        }
        
        // If player is moving to a new room, allow them to move beyond the current room bounds
        if (newRoom) {
            const oldRoom = this.currentRoom;
            // Change room
            this.currentRoom = newRoom;
            
            // Re-render everything for the new room
            this.renderRoomBoundaries();
            this.renderDoors();
            
            // Get new room bounds for position constraint
            const newRoomData = this.rooms.get(newRoom);
            if (newRoomData) {
                const newRoomBounds = newRoomData.bounds;
                minX = newRoomBounds.x + 10;
                minY = newRoomBounds.y + 10;
                maxX = newRoomBounds.x + newRoomBounds.width - 10;
                maxY = newRoomBounds.y + newRoomBounds.height - 10;
                
                // Move player a bit further into the new room to avoid getting stuck
                const oldRoomData = this.rooms.get(oldRoom);
                if (oldRoomData) {
                    const oldBounds = oldRoomData.bounds;
                    const newBounds = newRoomData.bounds;
                    const offset = 25; // Move 25px further into the new room
                    
                    // Determine direction of movement and adjust position
                    if (newBounds.x > oldBounds.x) {
                        // Moving right
                        x += offset;
                    } else if (newBounds.x < oldBounds.x) {
                        // Moving left
                        x -= offset;
                    } else if (newBounds.y > oldBounds.y) {
                        // Moving down
                        y += offset;
                    } else if (newBounds.y < oldBounds.y) {
                        // Moving up
                        y -= offset;
                    }
                }
                
                console.log('🚪 Player walked through door to room:', newRoom, 'from room:', oldRoom);
                console.log(`🚪 Moved player to position ${x}, ${y} in new room`);
                console.log('🚪 New room bounds:', newRoomBounds);
            }
        }
        
        const newPosition = {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y))
        };
        
        // Update position
        this.currentPosition = newPosition;
        
        // Update the player HTML element position immediately
        this.updatePlayerPosition();
        
        // Send to server if connected
        if (this.isConnectedToServer()) {
            this.sendMessage('player_move', {
                position: this.currentPosition
            });
        }
        
        console.log(`🎮 Player moved to ${newPosition.x}, ${newPosition.y} in room ${this.currentRoom}`);
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
        // Debounce mechanism to prevent rapid repeated interactions
        const now = Date.now();
        if (now - this.lastInteractionTime < this.interactionCooldown) {
            return; // Too soon since last interaction, ignore
        }
        this.lastInteractionTime = now;
        
        // Check for nearby doors first (E key functionality)
        const nearbyDoor = this.findNearbyDoor();
        if (nearbyDoor) {
            // Use door element if provided, otherwise find it
            let doorElement = nearbyDoor.doorElement;
            
            if (!doorElement) {
                // Find the door element based on current room and target room
                const doorId = `door-${this.currentRoom}-to-${nearbyDoor.targetRoom}`;
                const doorIdReversed = `door-${nearbyDoor.targetRoom}-to-${this.currentRoom}`;
                doorElement = document.getElementById(doorId) || document.getElementById(doorIdReversed);
            }
            
            if (doorElement) {
                console.log('🚪 Found door element, simulating click');
                
                // Simulate a click event to ensure identical behavior
                doorElement.click();
                return;
            } else {
                console.error('🚪 Could not find door element for door to room:', nearbyDoor.targetRoom);
            }
        }
        
        // If no doors nearby, check for other interactable objects
        if (!this.gameStarted) return;
        
        // Find nearby interactable objects
        const interactionRange = 50;
        let nearestObject = null;
        let nearestDistance = Infinity;
        
        for (const [objectId, gameObject] of this.gameObjects) {
            if (gameObject.interactable) {
                const distance = this.getDistance(this.currentPosition, {
                    x: gameObject.x + gameObject.width / 2,
                    y: gameObject.y + gameObject.height / 2
                });
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
        } else {
            console.log('🚫 Nothing to interact with nearby');
            this.showNotification('Nothing to interact with nearby', 'info');
        }
    }
    
    findNearbyDoor() {
        const interactionRange = 100; // Increased range for doors to make keyboard interaction easier
        const currentRoomData = this.rooms.get(this.currentRoom);
        if (!currentRoomData) return null;
        
        console.log(`🔍 Looking for door near player at (${this.currentPosition.x}, ${this.currentPosition.y}) in room ${this.currentRoom}`);
        
        // Check each door in the current room
        let closestDoor = null;
        let closestDistance = Infinity;
        
        for (const targetRoom of currentRoomData.doors) {
            const targetRoomData = this.rooms.get(targetRoom);
            if (!targetRoomData) continue;
            
            // Check if door element exists already
            const doorId = `door-${this.currentRoom}-to-${targetRoom}`;
            const doorIdReversed = `door-${targetRoom}-to-${this.currentRoom}`;
            const doorElement = document.getElementById(doorId) || document.getElementById(doorIdReversed);
            
            // Get door position - either from DOM element or calculate if not found
            let doorX, doorY, doorWidth, doorHeight;
            
            if (doorElement) {
                // Use the actual DOM element position
                doorX = parseInt(doorElement.style.left);
                doorY = parseInt(doorElement.style.top);
                doorWidth = parseInt(doorElement.style.width);
                doorHeight = parseInt(doorElement.style.height);
            } else {
                // Calculate door position using room bounds (same logic as renderDoors)
                const room = currentRoomData.bounds;
                const targetBounds = targetRoomData.bounds;
                
                if (targetBounds.x < room.x) {
                    // Door on left wall
                    doorX = room.x;
                    doorY = room.y + room.height / 2 - 30;
                    doorWidth = 10;
                    doorHeight = 60;
                } else if (targetBounds.x > room.x) {
                    // Door on right wall
                    doorX = room.x + room.width - 10;
                    doorY = room.y + room.height / 2 - 30;
                    doorWidth = 10;
                    doorHeight = 60;
                } else if (targetBounds.y < room.y) {
                    // Door on top wall
                    doorX = room.x + room.width / 2 - 30;
                    doorY = room.y;
                    doorWidth = 60;
                    doorHeight = 10;
                } else {
                    // Door on bottom wall
                    doorX = room.x + room.width / 2 - 30;
                    doorY = room.y + room.height - 10;
                    doorWidth = 60;
                    doorHeight = 10;
                }
            }
            
            // Check if player is close to this door
            const doorCenterX = doorX + doorWidth / 2;
            const doorCenterY = doorY + doorHeight / 2;
            const distance = this.getDistance(this.currentPosition, { x: doorCenterX, y: doorCenterY });
            
            // Keep track of the closest door within range
            if (distance < interactionRange && distance < closestDistance) {
                closestDistance = distance;
                closestDoor = { 
                    targetRoom, 
                    doorX, 
                    doorY, 
                    doorWidth, 
                    doorHeight,
                    isHorizontal: doorWidth > doorHeight,
                    doorElement: doorElement // Store the DOM element if found
                };
            }
        }
        
        return closestDoor;
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

        // Render current player as a red dot
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
        currentPlayerElement.style.backgroundColor = '#e74c3c'; // Red for current player
        currentPlayerElement.style.border = '2px solid #fff';
        currentPlayerElement.style.borderRadius = '50%';
        currentPlayerElement.style.boxSizing = 'border-box';
        currentPlayerElement.style.zIndex = '100';
        currentPlayerElement.style.transition = 'transform 0.05s linear'; // Smooth movement
        
        gameWorld.appendChild(currentPlayerElement);
        
        console.log(`🎮 Current player dot rendered at ${this.currentPosition.x}, ${this.currentPosition.y}`);
        
        // Render OTHER players as blue dots
        this.players.forEach((player, playerId) => {
            // Skip the current player (already rendered above)
            if (playerId === this.playerId) return;
            
            const otherPlayerElement = document.createElement('div');
            otherPlayerElement.className = 'player other-player';
            otherPlayerElement.id = `player-${playerId}`;
            
            // Style as blue dot
            otherPlayerElement.style.position = 'absolute';
            otherPlayerElement.style.left = '0px';
            otherPlayerElement.style.top = '0px';
            otherPlayerElement.style.transform = `translate(${player.position.x - 10}px, ${player.position.y - 10}px)`;
            otherPlayerElement.style.width = '20px';
            otherPlayerElement.style.height = '20px';
            otherPlayerElement.style.backgroundColor = '#3498db'; // Blue for other players
            otherPlayerElement.style.border = '2px solid #fff';
            otherPlayerElement.style.borderRadius = '50%';
            otherPlayerElement.style.boxSizing = 'border-box';
            otherPlayerElement.style.zIndex = '99';
            otherPlayerElement.style.transition = 'transform 0.1s linear'; // Smooth movement
            
            // Add player name above the dot
            const nameElement = document.createElement('div');
            nameElement.className = 'player-name';
            nameElement.textContent = player.name;
            nameElement.style.position = 'absolute';
            nameElement.style.top = '-25px';
            nameElement.style.left = '50%';
            nameElement.style.transform = 'translateX(-50%)';
            nameElement.style.color = '#fff';
            nameElement.style.fontSize = '12px';
            nameElement.style.fontWeight = 'bold';
            nameElement.style.textAlign = 'center';
            nameElement.style.background = 'rgba(0,0,0,0.8)';
            nameElement.style.padding = '2px 6px';
            nameElement.style.borderRadius = '3px';
            nameElement.style.whiteSpace = 'nowrap';
            nameElement.style.pointerEvents = 'none';
            
            otherPlayerElement.appendChild(nameElement);
            gameWorld.appendChild(otherPlayerElement);
            
            console.log(`🎮 Other player ${player.name} rendered at ${player.position.x}, ${player.position.y}`);
        });
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
        
        // Clear any existing players from previous sessions
        this.players.clear();
        
        this.roomCode = data.roomCode;
        this.playerId = data.playerId;
        this.isHost = data.isHost;
        
        // Add players from server data (should include the host)
        if (data.players && Array.isArray(data.players)) {
            data.players.forEach(player => {
                this.players.set(player.playerId, player);
            });
        }
        
        console.log(`🔍 DEBUG: Room created - roomCode: ${this.roomCode}, playerId: ${this.playerId}, isHost: ${this.isHost}`);
        console.log(`🔍 DEBUG: Players in room:`, this.players.size);
        
        // Save session data
        this.saveSessionData();
        
        // Show share link
        this.showShareLink();
        
        // Switch to lobby view instead of game view
        console.log(`🔍 DEBUG: Switching to lobby view...`);
        this.switchToLobbyView();
    }

    handleRoomJoined(data) {
        // Clear any existing players from previous sessions
        this.players.clear();
        
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
            
            // Re-render all players to update the moved player's position
            this.renderPlayers();
            
            console.log(`🎮 Player ${player.name} moved to ${data.position.x}, ${data.position.y}`);
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

    handleDoorStateChange(data) {
        console.log('🚪 Received door state change from server:', data);
        
        // Find the door element
        const doorElement = document.getElementById(data.doorId);
        if (doorElement) {
            // Update door visual state to match what was sent from server
            doorElement.dataset.isOpen = data.isOpen ? 'true' : 'false';
            
            // Get door dimensions for proper rotation
            const doorWidth = parseInt(doorElement.style.width) || 0;
            const doorHeight = parseInt(doorElement.style.height) || 0;
            const isHorizontal = doorWidth > doorHeight;
            
            if (data.isOpen) {
                // Door is open
                const rotation = isHorizontal ? 'rotate(-30deg)' : 'rotate(30deg)';
                doorElement.style.transform = rotation;
                doorElement.style.backgroundColor = '#A0522D';
                doorElement.style.boxShadow = '0 0 10px rgba(255, 255, 0, 0.5)';
            } else {
                // Door is closed
                doorElement.style.transform = 'none';
                doorElement.style.backgroundColor = '#8B4513';
                doorElement.style.boxShadow = 'none';
            }
            
            console.log(`🚪 Updated door ${data.doorId} to ${data.isOpen ? 'OPEN' : 'CLOSED'} state`);
        } else {
            console.error('🚪 Could not find door element:', data.doorId);
        }
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
        
        this.currentScreen = 'game';
        
        // Stop room list updates
        this.stopRoomListUpdates();
        
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
        
        // Setup game world scaling
        this.setupGameWorldScaling();
        
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
        
        // Render all players (current + others)
        this.renderPlayers();
        
        // Setup chat Enter key support
        this.setupChatControls();
        
        // Setup game UI event listeners
        this.setupGameEventListeners();
    }

    setupGameWorldScaling() {
        console.log('🎮 Setting up game world scaling');
        
        const gameWorld = document.getElementById('gameWorld');
        if (!gameWorld) {
            console.error('Game world container not found');
            return;
        }
        
        // Set the game world to fixed dimensions
        gameWorld.style.width = this.GAME_WORLD_WIDTH + 'px';
        gameWorld.style.height = this.GAME_WORLD_HEIGHT + 'px';
        gameWorld.style.position = 'relative';
        gameWorld.style.overflow = 'hidden';
        
        // Make sure game world is properly sized
        console.log(`🎮 Game world set to ${this.GAME_WORLD_WIDTH}x${this.GAME_WORLD_HEIGHT}`);
    }

    initializeGameObjects() {
        console.log('🔍 DEBUG: initializeGameObjects called');
        
        // Clear existing objects
        this.gameObjects.clear();
        
        // Render room boundaries and doors
        this.renderRoomBoundaries();
        this.renderDoors();
        
        console.log('🎮 Game objects initialized for room:', this.currentRoom);
    }
    
    renderRoomBoundaries() {
        const gameWorld = document.getElementById('gameWorld');
        if (!gameWorld) return;
        
        // Remove existing room elements
        const existingRooms = gameWorld.querySelectorAll('.room-boundary');
        existingRooms.forEach(room => room.remove());
        
        // Render all rooms with different colors
        const roomColors = {
            'NW': 'rgba(255, 0, 0, 0.1)',   // Red tint for start room
            'SW': 'rgba(0, 255, 0, 0.1)',   // Green tint
            'SE': 'rgba(0, 0, 255, 0.1)',   // Blue tint
            'NE': 'rgba(255, 255, 0, 0.1)'  // Yellow tint for end room
        };
        
        for (const [roomId, roomData] of this.rooms) {
            const roomElement = document.createElement('div');
            roomElement.className = 'room-boundary';
            roomElement.id = `room-${roomId}`;
            roomElement.style.position = 'absolute';
            roomElement.style.left = roomData.bounds.x + 'px';
            roomElement.style.top = roomData.bounds.y + 'px';
            roomElement.style.width = roomData.bounds.width + 'px';
            roomElement.style.height = roomData.bounds.height + 'px';
            roomElement.style.backgroundColor = roomColors[roomId] || 'rgba(128, 128, 128, 0.1)';
            roomElement.style.border = '1px solid #666'; // Same border for all rooms
            roomElement.style.boxSizing = 'border-box';
            roomElement.style.zIndex = '1';
            
            // Add room label
            const label = document.createElement('div');
            label.textContent = roomData.name;
            label.style.position = 'absolute';
            label.style.top = '10px';
            label.style.left = '10px';
            label.style.color = '#fff';
            label.style.fontSize = '12px';
            label.style.fontWeight = 'bold';
            label.style.background = 'rgba(0,0,0,0.7)';
            label.style.padding = '2px 6px';
            label.style.borderRadius = '3px';
            
            roomElement.appendChild(label);
            gameWorld.appendChild(roomElement);
        }
    }
    
    renderDoors() {
        const gameWorld = document.getElementById('gameWorld');
        if (!gameWorld) return;
        
        // Remove existing doors
        const existingDoors = gameWorld.querySelectorAll('.door');
        existingDoors.forEach(door => door.remove());
        
        // Track processed door pairs to avoid duplicates
        const processedConnections = new Set();
        
        // Add doors for ALL rooms, but avoid duplicates
        for (const [roomId, roomData] of this.rooms) {
            const room = roomData.bounds;
            
            // Add doors to connected rooms
            roomData.doors.forEach(targetRoom => {
                // Create a unique key for this connection (sorted to avoid duplicates)
                const connectionKey = [roomId, targetRoom].sort().join('-');
                if (processedConnections.has(connectionKey)) {
                    return; // Skip if we already processed this connection
                }
                processedConnections.add(connectionKey);
                
                const targetRoomData = this.rooms.get(targetRoom);
                if (!targetRoomData) return;
                
                const targetBounds = targetRoomData.bounds;
                
                // Determine door position based on relative room positions
                let doorX, doorY, doorWidth, doorHeight;
                
                if (targetBounds.x < room.x) {
                    // Door on left wall - center it vertically
                    doorX = room.x; // Exactly at the boundary
                    doorY = room.y + (room.height / 2) - 30; // Center vertically
                    doorWidth = 10;
                    doorHeight = 60;
                } else if (targetBounds.x > room.x) {
                    // Door on right wall - center it vertically  
                    doorX = room.x + room.width - 10; // Exactly at the boundary
                    doorY = room.y + (room.height / 2) - 30; // Center vertically
                    doorWidth = 10;
                    doorHeight = 60;
                } else if (targetBounds.y < room.y) {
                    // Door on top wall - center it horizontally
                    doorX = room.x + (room.width / 2) - 30; // Center horizontally
                    doorY = room.y; // Exactly at the boundary
                    doorWidth = 60;
                    doorHeight = 10;
                } else {
                    // Door on bottom wall - center it horizontally
                    doorX = room.x + (room.width / 2) - 30; // Center horizontally
                    doorY = room.y + room.height - 10; // Exactly at the boundary
                    doorWidth = 60;
                    doorHeight = 10;
                }
                
                const doorElement = document.createElement('div');
                doorElement.className = 'door';
                doorElement.id = `door-${roomId}-to-${targetRoom}`;
                doorElement.style.position = 'absolute';
                doorElement.style.left = doorX + 'px';
                doorElement.style.top = doorY + 'px';
                doorElement.style.width = doorWidth + 'px';
                doorElement.style.height = doorHeight + 'px';
                doorElement.style.backgroundColor = '#8B4513';
                doorElement.style.border = '2px solid #654321';
                doorElement.style.cursor = 'pointer';
                doorElement.style.zIndex = '10';
                doorElement.style.transition = 'transform 0.3s ease-in-out';
                doorElement.style.transformOrigin = doorWidth > doorHeight ? 'left center' : 'center top'; // Axis for rotation
                
                // Store door state
                doorElement.dataset.isOpen = 'false';
                doorElement.dataset.targetRoom = targetRoom;
                doorElement.dataset.fromRoom = roomId;
                
                // Add click handler for room transitions
                doorElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Allow transition from either connected room
                    if (this.currentRoom === roomId || this.currentRoom === targetRoom) {
                        this.openDoor(doorElement);
                        
                        // Add helper text to guide the user
                        if (doorElement.dataset.isOpen === 'true') {
                            this.showNotification('Door opened! Walk through to enter the next room.', 'success');
                        }
                    }
                });
                
                // Add hover effect
                doorElement.addEventListener('mouseenter', () => {
                    if (this.currentRoom === roomId || this.currentRoom === targetRoom) {
                        if (doorElement.dataset.isOpen !== 'true') {
                            doorElement.style.backgroundColor = '#A0522D';
                        }
                        
                        const isOpen = doorElement.dataset.isOpen === 'true';
                        const newRoom = this.currentRoom === roomId ? targetRoom : roomId;
                        const newRoomData = this.rooms.get(newRoom);
                        
                        if (isOpen) {
                            doorElement.title = `Walk through to ${newRoomData.name}`;
                            doorElement.style.cursor = 'pointer';
                            doorElement.style.outline = '2px dashed yellow';
                        } else {
                            doorElement.title = `Click to open door to ${newRoomData.name}`;
                        }
                    }
                });
                
                doorElement.addEventListener('mouseleave', () => {
                    if (doorElement.dataset.isOpen !== 'true') {
                        doorElement.style.backgroundColor = '#8B4513';
                    }
                    doorElement.style.outline = 'none';
                });
                
                gameWorld.appendChild(doorElement);
            });
        }
    }
    
    openDoor(doorElement) {
        if (!doorElement || !doorElement.dataset) {
            console.error('🚪 Invalid door element passed to openDoor:', doorElement);
            return;
        }
        
        // Get door properties from dataset
        const isOpen = doorElement.dataset.isOpen === 'true';
        const targetRoom = doorElement.dataset.targetRoom;
        const fromRoom = doorElement.dataset.fromRoom;
        
        // Toggle door state - store as string 'true' or 'false' for dataset compatibility
        const newState = !isOpen;
        doorElement.dataset.isOpen = newState ? 'true' : 'false';
        
        // Get door dimensions to determine orientation (horizontal/vertical)
        const doorWidth = parseInt(doorElement.style.width) || 0;
        const doorHeight = parseInt(doorElement.style.height) || 0;
        const isHorizontal = doorWidth > doorHeight;
        
        // Force browser to reflow to ensure style changes are applied
        void doorElement.offsetWidth;
        
        // Apply rotation based on door orientation
        if (!newState) {
            // Door is closed
            doorElement.style.transform = 'none';
            doorElement.style.backgroundColor = '#8B4513'; // Reset to original color
            doorElement.style.boxShadow = 'none';
            
            // Remove any open indicators
            let openIndicator = doorElement.querySelector('.door-open-indicator');
            if (openIndicator) {
                openIndicator.remove();
            }
        } else {
            // Door is open - rotate 30 degrees
            const rotation = isHorizontal ? 'rotate(-30deg)' : 'rotate(30deg)';
            doorElement.style.transform = rotation;
            doorElement.style.backgroundColor = '#A0522D'; // Slightly lighter when open
            doorElement.style.boxShadow = '0 0 10px rgba(255, 255, 0, 0.5)'; // Yellow glow for open doors
            
            // Force reflow again to ensure transform is applied
            void doorElement.offsetWidth;
        }
        
        // Log the change more clearly
        console.log(`🚪 Door toggled from ${isOpen ? 'OPEN→CLOSED' : 'CLOSED→OPEN'} between ${fromRoom || 'unknown'} and ${targetRoom || 'unknown'}`);
        console.log(`🚪 Door is now ${newState ? 'OPEN' : 'CLOSED'} (dataset value: ${doorElement.dataset.isOpen})`);
        
        // Send door state change to server so other players can see it
        if (this.isConnectedToServer()) {
            this.sendMessage('door_state_change', {
                doorId: doorElement.id,
                isOpen: newState,
                fromRoom: fromRoom || 'unknown',
                targetRoom: targetRoom || 'unknown'
            });
        }
    }
    
    changeRoom(newRoom) {
        console.log('🚪 Changing room from', this.currentRoom, 'to', newRoom);
        
        this.currentRoom = newRoom;
        
        // Reset player position to center of new room
        const room = this.rooms.get(newRoom);
        if (room) {
            this.currentPosition.x = room.bounds.x + room.bounds.width / 2;
            this.currentPosition.y = room.bounds.y + room.bounds.height / 2;
        }
        
        // Re-render everything for the new room
        this.renderRoomBoundaries();
        this.renderDoors();
        this.renderPlayers();
        
        console.log('🚪 Now in room:', newRoom, 'at position:', this.currentPosition);
    }

    setupGameEventListeners() {
        console.log('🔍 DEBUG: setupGameEventListeners called');
        
        // Setup keyboard event listeners for game controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Setup mouse event listeners for game interactions
        const gameWorld = document.getElementById('gameWorld');
        if (gameWorld) {
            // Click-to-move support
            gameWorld.addEventListener('click', (e) => this.handleGameClick(e));
            
            // Touch support for mobile devices
            gameWorld.addEventListener('touchstart', (e) => this.handleTouchStart(e));
            gameWorld.addEventListener('touchmove', (e) => this.handleTouchMove(e));
            gameWorld.addEventListener('touchend', (e) => this.handleTouchEnd(e));
            
            console.log('🎮 Touch and click event listeners added to game world');
        }
        
        // Setup leave game button
        const leaveGameBtn = document.getElementById('leaveGameBtn');
        if (leaveGameBtn) {
            leaveGameBtn.removeEventListener('click', this.handleLeaveGame.bind(this));
            leaveGameBtn.addEventListener('click', this.handleLeaveGame.bind(this));
            console.log('🚪 DEBUG: Leave game button event listener added');
        }
        
        console.log('🎮 Game event listeners setup complete');
    }

    handleGameClick(e) {
        console.log('🔍 DEBUG: handleGameClick called', e);
        
        // Handle game world clicks for click-to-move
        const gameWorld = document.getElementById('gameWorld');
        if (!gameWorld) return;
        
        const rect = gameWorld.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        console.log('🎮 Game click at:', clickX, clickY);
        console.log('🎮 Current room:', this.currentRoom);
        console.log('🎮 Player position:', this.currentPosition);
        
        // Always allow clicks - the movement system will handle room boundaries
        this.destination = { x: clickX, y: clickY };
        console.log('🎯 Destination set to:', this.destination);
    }

    handleTouchStart(e) {
        console.log('🔍 DEBUG: handleTouchStart called');
        e.preventDefault(); // Prevent scrolling and default touch behavior
        
        // Store initial touch position for potential drag detection
        this.touchStartTime = Date.now();
        this.touchMoved = false;
    }

    handleTouchMove(e) {
        console.log('🔍 DEBUG: handleTouchMove called');
        e.preventDefault(); // Prevent scrolling
        this.touchMoved = true; // Mark that touch has moved
    }

    handleTouchEnd(e) {
        console.log('🔍 DEBUG: handleTouchEnd called');
        e.preventDefault();
        
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - this.touchStartTime;
        
        // Only treat as tap if touch was brief and didn't move much
        if (!this.touchMoved && touchDuration < 500) {
            const touch = e.changedTouches[0];
            const gameWorld = document.getElementById('gameWorld');
            if (!gameWorld) return;
            
            const rect = gameWorld.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            
            console.log('🎮 Touch tap at:', touchX, touchY);
            console.log('🎮 Current room:', this.currentRoom);
            console.log('🎮 Player position:', this.currentPosition);
            
            // Always allow taps - the movement system will handle room boundaries
            this.destination = { x: touchX, y: touchY };
            console.log('🎯 Touch destination set to:', this.destination);
        }
        
        // Reset touch tracking
        this.touchStartTime = 0;
        this.touchMoved = false;
    }

    switchToMainMenu() {
        console.log('🏠 DEBUG: switchToMainMenu called');
        
        this.currentScreen = 'mainMenu';
        
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });
        
        // Show main menu
        const mainMenuScreen = document.getElementById('mainMenuScreen');
        if (mainMenuScreen) {
            mainMenuScreen.style.display = 'block';
            console.log('🏠 DEBUG: Main menu shown');
        } else {
            console.error('🏠 DEBUG: Main menu screen not found');
        }
        
        // Clear any session data
        this.clearSessionData();
        
        // Start room list updates
        this.startRoomListUpdates();
    }

    switchToLobbyView() {
        console.log(`🔍 DEBUG: switchToLobbyView called`);
        
        this.currentScreen = 'lobby';
        
        // Stop room list updates
        this.stopRoomListUpdates();
        
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
        this.leaveRoom();
    }

    handleLeaveGame() {
        this.leaveRoom();
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
        console.log('� CLIENT: sendChatMessage called');
        
        const chatInput = document.getElementById('chatInput');
        console.log('🔍 CLIENT: Chat input found:', !!chatInput);
        
        if (!chatInput) {
            console.error('❌ CLIENT: Chat input not found');
            return;
        }
        
        const message = chatInput.value.trim();
        console.log('� CLIENT: Message value:', message);
        
        if (!message) {
            console.log('❌ CLIENT: Empty message, not sending');
            return;
        }
        
        console.log('� CLIENT: Checking WebSocket connection...');
        console.log('🔍 CLIENT: this.wsClient exists:', !!this.wsClient);
        console.log('🔍 CLIENT: WebSocket connected:', this.wsClient?.isConnected());
        console.log('🔍 CLIENT: WebSocket readyState:', this.wsClient?.ws?.readyState);
        console.log('🔍 CLIENT: WebSocket OPEN constant:', WebSocket.OPEN);
        
        if (this.wsClient && this.wsClient.isConnected()) {
            console.log('� CLIENT: WebSocket connected, preparing message');
            
            const playerName = this.players.get(this.playerId)?.name || 'Unknown';
            console.log('🔍 CLIENT: Player name:', playerName);
            console.log('🔍 CLIENT: Player ID:', this.playerId);
            
            const messageData = { 
                message: message,
                playerName: playerName,
                timestamp: Date.now()
            };
            console.log('� CLIENT: Message data:', messageData);
            
            console.log('🔍 CLIENT: Sending message via WebSocket...');
            const success = this.wsClient.sendMessage('chat_message', messageData);
            
            console.log('🔍 CLIENT: Send result:', success);
            
            if (success) {
                chatInput.value = '';
                console.log('✅ CLIENT: Chat message sent successfully');
            } else {
                console.error('❌ CLIENT: Failed to send chat message');
            }
        } else {
            console.error('❌ CLIENT: WebSocket not connected, cannot send chat message');
            console.error('❌ CLIENT: Connection details:');
            console.error('  - wsClient exists:', !!this.wsClient);
            console.error('  - isConnected:', this.wsClient?.isConnected());
            console.error('  - ws exists:', !!this.wsClient?.ws);
            console.error('  - ws readyState:', this.wsClient?.ws?.readyState);
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
        
        // Set the player data but DON'T add to players map yet - let server do that
        this.roomCode = sessionData.roomCode;
        this.playerId = sessionData.playerId;
        this.isHost = sessionData.isHost;
        
        // Don't automatically try to reconnect - let the user choose to reconnect manually
        // The connection errors are too disruptive for automatic reconnection
        console.log('💾 Session found but skipping automatic reconnection to avoid connection errors');
        this.clearSessionData();
        
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
    showNotification(message, type = 'info', duration = 3000) {
        console.log(`🔔 ${type.toUpperCase()}: ${message}`);
        
        // Prevent duplicate notifications
        const notificationId = `${type}-${message.replace(/\s+/g, '-')}`;
        if (document.querySelector(`[data-notification-id="${notificationId}"]`)) {
            console.log('🔔 Duplicate notification skipped:', message);
            return;
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.dataset.notificationId = notificationId;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after specified duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
        
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
        console.log('📱 DEBUG: setupChatControls called');
        const chatInput = document.getElementById('chatInput');
        const sendChatBtn = document.getElementById('sendChatBtn');
        
        console.log('📱 DEBUG: chatInput found:', !!chatInput);
        console.log('📱 DEBUG: sendChatBtn found:', !!sendChatBtn);
        
        if (chatInput) {
            // Remove any existing event listeners
            chatInput.removeEventListener('keydown', this.chatKeyHandler);
            
            // Create bound handler
            this.chatKeyHandler = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    console.log('📱 DEBUG: Enter key pressed in chat');
                    this.sendChatMessage();
                }
            };
            
            // Add event listener
            chatInput.addEventListener('keydown', this.chatKeyHandler);
            console.log('📱 DEBUG: Enter key handler added to chat input');
        }
        
        if (sendChatBtn) {
            // Remove any existing event listeners
            sendChatBtn.removeEventListener('click', this.chatClickHandler);
            
            // Create bound handler
            this.chatClickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📱 DEBUG: Send chat button clicked');
                this.sendChatMessage();
            };
            
            // Add event listener
            sendChatBtn.addEventListener('click', this.chatClickHandler);
            console.log('📱 DEBUG: Click handler added to send chat button');
        }
    }

    addChatMessage(playerName, message, timestamp) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            console.error('📱 Chat messages container not found');
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        const time = new Date(timestamp).toLocaleTimeString();
        const isOwnMessage = playerName === (this.players.get(this.playerId)?.name || 'Unknown');
        
        messageElement.innerHTML = `
            <div class="chat-message-header">
                <span class="chat-player-name ${isOwnMessage ? 'own-message' : ''}">${playerName}</span>
                <span class="chat-timestamp">${time}</span>
            </div>
            <div class="chat-message-content">${message}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        console.log('📱 Added chat message to UI:', { playerName, message, timestamp });
    }
    
    // Room list functionality
    loadPublicRooms() {
        console.log('🔍 DEBUG: Loading public rooms');
        fetch('http://localhost:8080/api/rooms')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.displayPublicRooms(data.rooms);
                } else {
                    console.error('Failed to load rooms:', data.message);
                    this.showRoomListError('Failed to load rooms');
                }
            })
            .catch(error => {
                console.error('Error loading rooms:', error);
                this.showRoomListError('Unable to connect to server');
            });
    }
    
    displayPublicRooms(rooms) {
        const publicRoomsContainer = document.getElementById('publicRooms');
        if (!publicRoomsContainer) return;
        
        if (rooms.length === 0) {
            publicRoomsContainer.innerHTML = '<div class="no-rooms">No public rooms available. Create one to get started!</div>';
            return;
        }
        
        publicRoomsContainer.innerHTML = rooms.map(room => `
            <div class="room-item ${room.gameStarted ? 'game-started' : 'waiting'}" data-room-code="${room.roomCode}">
                <div class="room-header">
                    <span class="room-code">${room.roomCode}</span>
                    <span class="room-status ${room.gameStarted ? 'playing' : 'waiting'}">
                        ${room.gameStarted ? '🎮 Playing' : '⏳ Waiting'}
                    </span>
                </div>
                <div class="room-info">
                    <div class="room-details">
                        <span class="player-count">👥 ${room.playerCount}/${room.maxPlayers}</span>
                        <span class="host-name">Host: ${room.hostName}</span>
                    </div>
                    <button class="join-room-btn btn btn-small" 
                            data-room-code="${room.roomCode}" 
                            ${room.gameStarted ? 'disabled' : ''}>
                        ${room.gameStarted ? 'Game in Progress' : 'Join Room'}
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click handlers for join buttons
        publicRoomsContainer.querySelectorAll('.join-room-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomCode = e.target.getAttribute('data-room-code');
                if (roomCode && !e.target.disabled) {
                    this.joinRoom(roomCode);
                }
            });
        });
    }
    
    showRoomListError(message) {
        const publicRoomsContainer = document.getElementById('publicRooms');
        if (publicRoomsContainer) {
            publicRoomsContainer.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }
    
    startRoomListUpdates() {
        // Load rooms immediately
        this.loadPublicRooms();
        
        // Set up periodic updates every 5 seconds
        if (this.roomListUpdateInterval) {
            clearInterval(this.roomListUpdateInterval);
        }
        
        this.roomListUpdateInterval = setInterval(() => {
            if (this.currentScreen === 'mainMenu') {
                this.loadPublicRooms();
            }
        }, 5000);
    }
    
    stopRoomListUpdates() {
        if (this.roomListUpdateInterval) {
            clearInterval(this.roomListUpdateInterval);
            this.roomListUpdateInterval = null;
        }
    }

    // Define 2x2 grid of rooms based on game world size
    setupRooms() {
        const w = this.GAME_WORLD_WIDTH / 2;  // 400px each
        const h = this.GAME_WORLD_HEIGHT / 2; // 268px each
        
        this.rooms.set('NW', { 
            name: 'Northwest Room (Start)',
            bounds: { x: 0, y: 0, width: w, height: h },
            doors: ['SW'] // Only door to SW (start room)
        });
        this.rooms.set('SW', { 
            name: 'Southwest Room',
            bounds: { x: 0, y: h, width: w, height: h },
            doors: ['NW', 'SE'] // Doors back to NW and forward to SE
        });
        this.rooms.set('SE', { 
            name: 'Southeast Room',
            bounds: { x: w, y: h, width: w, height: h },
            doors: ['SW', 'NE'] // Doors back to SW and forward to NE
        });
        this.rooms.set('NE', { 
            name: 'Northeast Room (End)',
            bounds: { x: w, y: 0, width: w, height: h },
            doors: ['SE'] // Only door back to SE (end room)
        });
        
        console.log('🏠 Rooms setup complete:', this.rooms);
    }
}

// Export for use in other modules
window.EscapeRoomGame = EscapeRoomGame;
