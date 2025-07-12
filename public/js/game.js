class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.players = new Map();
        this.currentPlayer = null;
        this.gameState = null;
        this.gameObjects = [];
        this.keys = {};
        this.lastUpdateTime = 0;
        this.gameStartTime = null;
        
        this.setupCanvas();
        this.setupControls();
        this.initializeGameObjects();
        this.startGameLoop();
    }

    setupCanvas() {
        // Make canvas responsive
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const maxWidth = container.clientWidth;
        const maxHeight = container.clientHeight;
        
        // Maintain aspect ratio
        const aspectRatio = 800 / 600;
        let width = maxWidth;
        let height = width / aspectRatio;
        
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            // Handle specific actions
            if (e.key === ' ' || e.key === 'Enter') {
                this.interactWithNearestObject();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Mouse controls
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            
            this.movePlayerToPosition(x, y);
        });
    }

    initializeGameObjects() {
        // Define the escape room layout and objects
        this.gameObjects = [
            // Walls
            { type: 'wall', x: 0, y: 0, width: 800, height: 20, color: '#8B4513' },
            { type: 'wall', x: 0, y: 0, width: 20, height: 600, color: '#8B4513' },
            { type: 'wall', x: 780, y: 0, width: 20, height: 600, color: '#8B4513' },
            { type: 'wall', x: 0, y: 580, width: 800, height: 20, color: '#8B4513' },
            
            // Interactive objects
            { type: 'desk', x: 100, y: 100, width: 80, height: 40, color: '#8B4513', interactive: true },
            { type: 'bookshelf', x: 300, y: 50, width: 60, height: 120, color: '#654321', interactive: true },
            { type: 'safe', x: 600, y: 400, width: 50, height: 50, color: '#696969', interactive: true, locked: true },
            { type: 'door', x: 400, y: 580, width: 60, height: 20, color: '#8B4513', interactive: true, locked: true },
            
            // Clues and items
            { type: 'key', x: 150, y: 120, width: 15, height: 8, color: '#FFD700', interactive: true, item: true },
            { type: 'note', x: 320, y: 80, width: 20, height: 15, color: '#FFFFFF', interactive: true, item: true },
            { type: 'puzzle', x: 500, y: 200, width: 40, height: 30, color: '#4169E1', interactive: true }
        ];
    }

    startGameLoop() {
        const gameLoop = (timestamp) => {
            const deltaTime = timestamp - this.lastUpdateTime;
            this.lastUpdateTime = timestamp;
            
            this.update(deltaTime);
            this.render();
            
            requestAnimationFrame(gameLoop);
        };
        
        requestAnimationFrame(gameLoop);
    }

    update(deltaTime) {
        if (!this.currentPlayer) return;
        
        // Update player position based on input
        this.updatePlayerMovement(deltaTime);
        
        // Update game timer
        this.updateGameTimer();
    }

    updatePlayerMovement(deltaTime) {
        const player = this.players.get(this.currentPlayer.id);
        if (!player) return;
        
        const speed = 200; // pixels per second
        const moveDistance = speed * (deltaTime / 1000);
        
        let newX = player.position.x;
        let newY = player.position.y;
        
        // Handle movement input
        if (this.keys['w'] || this.keys['arrowup']) {
            newY -= moveDistance;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            newY += moveDistance;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            newX -= moveDistance;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            newX += moveDistance;
        }
        
        // Check for collisions and boundaries
        if (this.isValidPosition(newX, newY)) {
            player.position.x = newX;
            player.position.y = newY;
            
            // Send position update to server
            wsManager.send({
                type: 'playerMove',
                x: newX,
                y: newY
            });
        }
    }

    isValidPosition(x, y) {
        const playerSize = 20;
        const margin = 5;
        
        // Check boundaries
        if (x < margin || x > this.canvas.width - playerSize - margin ||
            y < margin || y > this.canvas.height - playerSize - margin) {
            return false;
        }
        
        // Check collision with walls and objects
        for (const obj of this.gameObjects) {
            if (obj.type === 'wall' || (obj.type !== 'key' && obj.type !== 'note')) {
                if (x < obj.x + obj.width && x + playerSize > obj.x &&
                    y < obj.y + obj.height && y + playerSize > obj.y) {
                    return false;
                }
            }
        }
        
        return true;
    }

    movePlayerToPosition(targetX, targetY) {
        if (!this.currentPlayer) return;
        
        const player = this.players.get(this.currentPlayer.id);
        if (!player) return;
        
        // Simple pathfinding - move directly towards target
        const dx = targetX - player.position.x;
        const dy = targetY - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 10) {
            const moveX = player.position.x + (dx / distance) * 5;
            const moveY = player.position.y + (dy / distance) * 5;
            
            if (this.isValidPosition(moveX, moveY)) {
                player.position.x = moveX;
                player.position.y = moveY;
                
                wsManager.send({
                    type: 'playerMove',
                    x: moveX,
                    y: moveY
                });
            }
        }
    }

    interactWithNearestObject() {
        if (!this.currentPlayer) return;
        
        const player = this.players.get(this.currentPlayer.id);
        if (!player) return;
        
        const interactionDistance = 50;
        
        for (const obj of this.gameObjects) {
            if (obj.interactive) {
                const dx = obj.x + obj.width / 2 - player.position.x;
                const dy = obj.y + obj.height / 2 - player.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= interactionDistance) {
                    this.handleObjectInteraction(obj);
                    break;
                }
            }
        }
    }

    handleObjectInteraction(obj) {
        wsManager.send({
            type: 'interactWithObject',
            objectId: obj.type,
            action: 'interact'
        });
        
        // Handle local interaction effects
        if (obj.item) {
            // Add item to inventory
            this.addToInventory(obj.type);
            
            // Remove item from game world
            const index = this.gameObjects.indexOf(obj);
            if (index > -1) {
                this.gameObjects.splice(index, 1);
            }
        }
    }

    addToInventory(item) {
        const inventoryItems = document.getElementById('inventoryItems');
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.textContent = item;
        inventoryItems.appendChild(itemElement);
    }

    updateGameTimer() {
        if (this.gameStartTime) {
            const elapsed = Date.now() - this.gameStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('gameTimer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#34495e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render game objects
        this.renderGameObjects();
        
        // Render players
        this.renderPlayers();
        
        // Render UI elements
        this.renderUI();
    }

    renderGameObjects() {
        for (const obj of this.gameObjects) {
            this.ctx.fillStyle = obj.color;
            this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            
            // Add labels for interactive objects
            if (obj.interactive) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    obj.type,
                    obj.x + obj.width / 2,
                    obj.y + obj.height / 2 + 4
                );
            }
        }
    }

    renderPlayers() {
        this.players.forEach((player, id) => {
            const isCurrentPlayer = id === this.currentPlayer?.id;
            
            // Player circle
            this.ctx.fillStyle = isCurrentPlayer ? '#4ecdc4' : '#ff6b6b';
            this.ctx.beginPath();
            this.ctx.arc(player.position.x + 10, player.position.y + 10, 10, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Player name
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                player.name,
                player.position.x + 10,
                player.position.y - 5
            );
        });
    }

    renderUI() {
        // Render interaction hints
        if (this.currentPlayer) {
            const player = this.players.get(this.currentPlayer.id);
            if (player) {
                const nearbyObject = this.getNearbyInteractableObject(player.position);
                if (nearbyObject) {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    this.ctx.font = '14px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(
                        `Press SPACE to interact with ${nearbyObject.type}`,
                        this.canvas.width / 2,
                        this.canvas.height - 30
                    );
                }
            }
        }
    }

    getNearbyInteractableObject(position) {
        const interactionDistance = 50;
        
        for (const obj of this.gameObjects) {
            if (obj.interactive) {
                const dx = obj.x + obj.width / 2 - position.x;
                const dy = obj.y + obj.height / 2 - position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= interactionDistance) {
                    return obj;
                }
            }
        }
        
        return null;
    }

    // WebSocket event handlers
    onGameStarted(data) {
        this.gameState = data.gameState;
        this.gameStartTime = Date.now();
        console.log('Game started!');
    }

    onPlayerJoined(data) {
        this.players.set(data.player.id, {
            id: data.player.id,
            name: data.player.name,
            position: data.player.position
        });
        console.log(`Player ${data.player.name} joined`);
    }

    onPlayerLeft(data) {
        this.players.delete(data.playerId);
        console.log(`Player left: ${data.playerId}`);
    }

    onPlayerMoved(data) {
        const player = this.players.get(data.playerId);
        if (player) {
            player.position = data.position;
        }
    }

    onObjectInteraction(data) {
        console.log(`Player ${data.playerId} interacted with ${data.objectId}`);
        // Handle object interaction effects
    }

    setCurrentPlayer(playerData) {
        this.currentPlayer = playerData;
        
        // Add current player to players map
        this.players.set(playerData.id, {
            id: playerData.id,
            name: playerData.name,
            position: playerData.position || { x: 100, y: 100 }
        });
    }

    initializePlayers(playersData) {
        this.players.clear();
        playersData.forEach(player => {
            this.players.set(player.id, {
                id: player.id,
                name: player.name,
                position: player.position
            });
        });
    }
}

// Global game instance
let game = null;
