class UI {
    constructor() {
        this.currentScreen = 'menu';
        this.currentRoomId = null;
        this.currentPlayerName = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Menu screen events
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.createRoom();
        });

        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.joinRoom();
        });

        // Lobby screen events
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
            this.leaveLobby();
        });

        // Game screen events
        document.getElementById('leaveGameBtn').addEventListener('click', () => {
            this.leaveGame();
        });

        document.getElementById('sendChatBtn').addEventListener('click', () => {
            this.sendChatMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        // Game complete screen events
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.playAgain();
        });

        // Enter key handlers for inputs
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createRoom();
            }
        });

        document.getElementById('roomId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
    }

    createRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        
        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }

        if (playerName.length > 20) {
            this.showError('Name must be 20 characters or less');
            return;
        }

        this.currentPlayerName = playerName;
        
        wsManager.send({
            type: 'createRoom',
            playerName: playerName
        });
    }

    joinRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        const roomId = document.getElementById('roomId').value.trim();
        
        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }

        if (!roomId) {
            this.showError('Please enter a room ID');
            return;
        }

        if (playerName.length > 20) {
            this.showError('Name must be 20 characters or less');
            return;
        }

        this.currentPlayerName = playerName;
        
        wsManager.send({
            type: 'joinRoom',
            roomId: roomId.toUpperCase(),
            playerName: playerName
        });
    }

    startGame() {
        wsManager.send({
            type: 'startGame'
        });
    }

    leaveLobby() {
        this.showScreen('menu');
        this.currentRoomId = null;
        this.currentPlayerName = null;
    }

    leaveGame() {
        this.showScreen('menu');
        this.currentRoomId = null;
        this.currentPlayerName = null;
        
        if (game) {
            game = null;
        }
    }

    playAgain() {
        this.showScreen('menu');
        this.currentRoomId = null;
        this.currentPlayerName = null;
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (message) {
            // For now, just display locally - could extend to send via WebSocket
            this.addChatMessage(this.currentPlayerName, message);
            chatInput.value = '';
        }
    }

    addChatMessage(playerName, message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageElement.innerHTML = `
            <span class="chat-time">[${timestamp}]</span>
            <span class="chat-player">${playerName}:</span>
            <span class="chat-text">${message}</span>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenName);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenName;
        }
    }

    showError(message) {
        // Create or update error message
        let errorElement = document.querySelector('.error-message');
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #ff6b6b;
                color: white;
                padding: 1rem 2rem;
                border-radius: 8px;
                z-index: 1000;
                font-weight: bold;
                box-shadow: 0 5px 15px rgba(255, 107, 107, 0.3);
            `;
            document.body.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }, 3000);
    }

    showSuccess(message) {
        // Create or update success message
        let successElement = document.querySelector('.success-message');
        
        if (!successElement) {
            successElement = document.createElement('div');
            successElement.className = 'success-message';
            successElement.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #4ecdc4;
                color: white;
                padding: 1rem 2rem;
                border-radius: 8px;
                z-index: 1000;
                font-weight: bold;
                box-shadow: 0 5px 15px rgba(78, 205, 196, 0.3);
            `;
            document.body.appendChild(successElement);
        }
        
        successElement.textContent = message;
        successElement.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (successElement) {
                successElement.style.display = 'none';
            }
        }, 3000);
    }

    updatePlayersList(players) {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        players.forEach(player => {
            const listItem = document.createElement('li');
            listItem.textContent = player.name;
            playersList.appendChild(listItem);
        });
        
        // Update players online count
        const playersOnlineElement = document.getElementById('playersOnline');
        if (playersOnlineElement) {
            playersOnlineElement.textContent = players.length;
        }
    }

    // WebSocket event handlers
    onRoomCreated(data) {
        this.currentRoomId = data.roomId;
        document.getElementById('roomIdDisplay').textContent = data.roomId;
        this.showScreen('lobby');
        this.showSuccess(`Room created! Share ID: ${data.roomId}`);
        
        // Initialize players list with current player
        this.updatePlayersList([{
            id: data.playerId,
            name: this.currentPlayerName
        }]);
    }

    onJoinedRoom(data) {
        this.currentRoomId = data.roomId;
        document.getElementById('roomIdDisplay').textContent = data.roomId;
        this.showScreen('lobby');
        this.showSuccess(`Joined room: ${data.roomId}`);
        
        // Update players list
        this.updatePlayersList(data.players);
    }

    onPlayerJoined(data) {
        this.showSuccess(`${data.player.name} joined the room`);
        
        // Update players list (need to get current list and add new player)
        const currentList = Array.from(document.getElementById('playersList').children).map(li => ({
            name: li.textContent
        }));
        currentList.push({ name: data.player.name });
        this.updatePlayersList(currentList);
    }

    onPlayerLeft(data) {
        // Update players list by removing the player
        const currentList = Array.from(document.getElementById('playersList').children)
            .map(li => ({ name: li.textContent }))
            .filter(player => player.name !== data.playerName);
        this.updatePlayersList(currentList);
    }

    onGameStarted(data) {
        this.showScreen('game');
        this.showSuccess('Game started! Find the clues to escape!');
        
        // Initialize game
        if (!game) {
            game = new Game();
        }
        
        game.onGameStarted(data);
    }

    onGameCompleted(data) {
        this.showScreen('gameComplete');
        
        // Update completion stats
        const completionTime = document.getElementById('completionTime');
        const teamPlayers = document.getElementById('teamPlayers');
        
        if (data.completionTime) {
            const minutes = Math.floor(data.completionTime / 60000);
            const seconds = Math.floor((data.completionTime % 60000) / 1000);
            completionTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (data.players) {
            teamPlayers.textContent = data.players.join(', ');
        }
    }

    onError(data) {
        this.showError(data.message);
    }
}

// Global UI manager instance
const ui = new UI();
