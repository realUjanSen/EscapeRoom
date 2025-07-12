const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Game state
const gameRooms = new Map();
const players = new Map();

// WebSocket server
const wss = new WebSocket.Server({ server });

class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.gameState = {
            started: false,
            completed: false,
            startTime: null,
            clues: {
                found: [],
                remaining: ['key1', 'code2', 'puzzle3', 'finalKey']
            },
            doors: {
                main: false,
                secret: false
            }
        };
        this.maxPlayers = 4;
    }

    addPlayer(playerId, playerName, ws) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }

        const player = {
            id: playerId,
            name: playerName,
            ws: ws,
            position: { x: 100, y: 100 },
            inventory: []
        };

        this.players.set(playerId, player);
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.players.size === 0) {
            gameRooms.delete(this.id);
        }
    }

    broadcast(message, excludePlayer = null) {
        this.players.forEach((player, playerId) => {
            if (playerId !== excludePlayer && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify(message));
            }
        });
    }

    updatePlayerPosition(playerId, x, y) {
        const player = this.players.get(playerId);
        if (player) {
            player.position = { x, y };
            this.broadcast({
                type: 'playerMoved',
                playerId: playerId,
                position: { x, y }
            }, playerId);
        }
    }

    startGame() {
        if (!this.gameState.started && this.players.size > 0) {
            this.gameState.started = true;
            this.gameState.startTime = Date.now();
            this.broadcast({
                type: 'gameStarted',
                gameState: this.gameState
            });
        }
    }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        const playerId = getPlayerIdByWs(ws);
        if (playerId) {
            const player = players.get(playerId);
            if (player && player.roomId) {
                const room = gameRooms.get(player.roomId);
                if (room) {
                    room.removePlayer(playerId);
                    room.broadcast({
                        type: 'playerLeft',
                        playerId: playerId
                    });
                }
            }
            players.delete(playerId);
        }
        console.log('Client disconnected');
    });
});

function handleMessage(ws, data) {
    switch (data.type) {
        case 'joinRoom':
            handleJoinRoom(ws, data);
            break;
        case 'createRoom':
            handleCreateRoom(ws, data);
            break;
        case 'playerMove':
            handlePlayerMove(ws, data);
            break;
        case 'startGame':
            handleStartGame(ws, data);
            break;
        case 'interactWithObject':
            handleInteraction(ws, data);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleJoinRoom(ws, data) {
    const { roomId, playerName } = data;
    const playerId = uuidv4();
    
    let room = gameRooms.get(roomId);
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }

    if (room.addPlayer(playerId, playerName, ws)) {
        players.set(playerId, {
            id: playerId,
            name: playerName,
            roomId: roomId,
            ws: ws
        });

        ws.send(JSON.stringify({
            type: 'joinedRoom',
            playerId: playerId,
            roomId: roomId,
            gameState: room.gameState,
            players: Array.from(room.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                position: p.position
            }))
        }));

        room.broadcast({
            type: 'playerJoined',
            player: {
                id: playerId,
                name: playerName,
                position: { x: 100, y: 100 }
            }
        }, playerId);
    } else {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room is full'
        }));
    }
}

function handleCreateRoom(ws, data) {
    const { playerName } = data;
    const roomId = uuidv4().substring(0, 8);
    const playerId = uuidv4();
    
    const room = new GameRoom(roomId);
    gameRooms.set(roomId, room);
    
    room.addPlayer(playerId, playerName, ws);
    players.set(playerId, {
        id: playerId,
        name: playerName,
        roomId: roomId,
        ws: ws
    });

    ws.send(JSON.stringify({
        type: 'roomCreated',
        playerId: playerId,
        roomId: roomId,
        gameState: room.gameState
    }));
}

function handlePlayerMove(ws, data) {
    const playerId = getPlayerIdByWs(ws);
    if (playerId) {
        const player = players.get(playerId);
        if (player && player.roomId) {
            const room = gameRooms.get(player.roomId);
            if (room) {
                room.updatePlayerPosition(playerId, data.x, data.y);
            }
        }
    }
}

function handleStartGame(ws, data) {
    const playerId = getPlayerIdByWs(ws);
    if (playerId) {
        const player = players.get(playerId);
        if (player && player.roomId) {
            const room = gameRooms.get(player.roomId);
            if (room) {
                room.startGame();
            }
        }
    }
}

function handleInteraction(ws, data) {
    const playerId = getPlayerIdByWs(ws);
    if (playerId) {
        const player = players.get(playerId);
        if (player && player.roomId) {
            const room = gameRooms.get(player.roomId);
            if (room) {
                // Handle object interactions (clues, doors, etc.)
                room.broadcast({
                    type: 'objectInteraction',
                    playerId: playerId,
                    objectId: data.objectId,
                    action: data.action
                });
            }
        }
    }
}

function getPlayerIdByWs(ws) {
    for (const [playerId, player] of players) {
        if (player.ws === ws) {
            return playerId;
        }
    }
    return null;
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Multiplayer Escape Room Server running on port ${PORT}`);
    console.log(`📱 Game client available at: http://localhost:${PORT}`);
});
