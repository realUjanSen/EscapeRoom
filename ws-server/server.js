const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

// Game state management
const rooms = new Map(); // roomCode -> room data
const players = new Map(); // ws -> player data

class GameRoom {
    constructor(roomCode, hostPlayerId, isPrivate = false) {
        this.roomCode = roomCode;
        this.hostPlayerId = hostPlayerId;
        this.isPrivate = isPrivate;
        this.players = new Map(); // playerId -> player data
        this.gameState = {
            started: false,
            items: new Map(),
            interactions: new Map(),
            puzzles: new Map(),
            timer: null,
            duration: 0
        };
        this.maxPlayers = 8;
        this.createdAt = Date.now();
    }

    addPlayer(playerId, playerData) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }
        this.players.set(playerId, {
            ...playerData,
            position: { x: 100, y: 100 },
            isHost: playerId === this.hostPlayerId,
            connected: true,
            joinedAt: Date.now()
        });
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (playerId === this.hostPlayerId && this.players.size > 0) {
            // Transfer host to next player
            const nextPlayer = this.players.keys().next().value;
            this.hostPlayerId = nextPlayer;
            this.players.get(nextPlayer).isHost = true;
        }
    }

    broadcast(message, excludePlayerId = null) {
        this.players.forEach((player, playerId) => {
            if (playerId !== excludePlayerId && player.ws && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify(message));
            }
        });
    }

    getPublicData() {
        return {
            roomCode: this.roomCode,
            playerCount: this.players.size,
            maxPlayers: this.maxPlayers,
            isPrivate: this.isPrivate,
            gameStarted: this.gameState.started,
            hostName: this.players.get(this.hostPlayerId)?.name || 'Unknown'
        };
    }
}

// Get network interfaces for LAN binding
function getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (!iface.internal && iface.family === 'IPv4') {
                addresses.push({
                    name: name,
                    address: iface.address,
                    netmask: iface.netmask
                });
            }
        }
    }
    
    return addresses;
}

// HTTP endpoints
app.get('/api/network-interfaces', (req, res) => {
    try {
        const interfaces = getNetworkInterfaces();
        res.json({ success: true, interfaces });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/rooms', (req, res) => {
    const publicRooms = Array.from(rooms.values())
        .filter(room => !room.isPrivate && room.players.size > 0)
        .map(room => room.getPublicData());
    
    res.json({ success: true, rooms: publicRooms });
});

// WebSocket server
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection from:', req.connection.remoteAddress);

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(ws, message);
        } catch (error) {
            console.error('Error parsing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid JSON format'
            }));
        }
    });

    ws.on('close', () => {
        const player = players.get(ws);
        if (player) {
            handlePlayerDisconnect(player.playerId, player.roomCode);
        }
        players.delete(ws);
        console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    function handleMessage(ws, message) {
        console.log(`🔍 SERVER: Received message type: ${message.type}`, message);
        const { type, data } = message;

        switch (type) {
            case 'create_room':
                handleCreateRoom(ws, data);
                break;
            
            case 'join_room':
                handleJoinRoom(ws, data);
                break;
            
            case 'leave_room':
                handleLeaveRoom(ws, data);
                break;
            
            case 'player_move':
                handlePlayerMove(ws, data);
                break;
            
            case 'player_interact':
                handlePlayerInteract(ws, data);
                break;
            
            case 'game_start':
                handleGameStart(ws, data);
                break;
            
            case 'game_reset':
                handleGameReset(ws, data);
                break;
            
            case 'chat_message':
                handleChatMessage(ws, data);
                break;
                
            case 'door_state_change':
                handleDoorStateChange(ws, data);
                break;
                
            case 'ping':
                // Respond to ping with pong for heartbeat
                console.log(`🔍 SERVER: Received ping, sending pong`);
                ws.send(JSON.stringify({
                    type: 'pong',
                    data: { timestamp: Date.now() }
                }));
                break;
            
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Unknown message type: ${type}`
                }));
        }
    }

    function handleCreateRoom(ws, data) {
        const { playerName, isPrivate = false } = data;
        
        if (!playerName || playerName.length < 1 || playerName.length > 20) {
            return ws.send(JSON.stringify({
                type: 'error',
                message: 'Player name must be between 1 and 20 characters'
            }));
        }

        // Generate 6-character uppercase room code
        let roomCode;
        do {
            roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (rooms.has(roomCode));

        // Set connection-scope variables
        const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        const room = new GameRoom(roomCode, playerId, isPrivate);
        const playerData = {
            playerId,
            name: playerName,
            ws
        };

        if (room.addPlayer(playerId, playerData)) {
            rooms.set(roomCode, room);
            players.set(ws, { playerId, roomCode });
            
            ws.send(JSON.stringify({
                type: 'room_created',
                data: {
                    roomCode,
                    playerId,
                    isHost: true,
                    playerName: playerName,
                    room: room.getPublicData(),
                    players: Array.from(room.players.values()).map(p => ({
                        playerId: p.playerId,
                        name: p.name,
                        position: p.position,
                        isHost: p.isHost
                    }))
                }
            }));

            console.log(`Room ${roomCode} created by ${playerName}`);
        } else {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to create room'
            }));
        }
    }

    function handleJoinRoom(ws, data) {
        const { roomCode, playerName } = data;
        
        if (!roomCode || !playerName) {
            return ws.send(JSON.stringify({
                type: 'error',
                message: 'Room code and player name are required'
            }));
        }

        const room = rooms.get(roomCode.toUpperCase());
        if (!room) {
            return ws.send(JSON.stringify({
                type: 'error',
                message: 'Room not found'
            }));
        }

        if (room.gameState.started) {
            return ws.send(JSON.stringify({
                type: 'error',
                message: 'Game already in progress'
            }));
        }

        const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        const playerData = {
            playerId,
            name: playerName,
            ws
        };

        if (room.addPlayer(playerId, playerData)) {
            players.set(ws, { playerId, roomCode: room.roomCode });

            // Send join confirmation to player
            ws.send(JSON.stringify({
                type: 'room_joined',
                data: {
                    roomCode: room.roomCode,
                    playerId,
                    isHost: playerId === room.hostPlayerId,
                    room: room.getPublicData(),
                    players: Array.from(room.players.values()).map(p => ({
                        playerId: p.playerId,
                        name: p.name,
                        position: p.position,
                        isHost: p.isHost
                    }))
                }
            }));

            // Broadcast to other players
            room.broadcast({
                type: 'player_joined',
                data: {
                    playerId,
                    name: playerName,
                    position: room.players.get(playerId).position
                }
            }, playerId);

            console.log(`${playerName} joined room ${room.roomCode}`);
        } else {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Room is full or join failed'
            }));
        }
    }

    function handleLeaveRoom(ws, data) {
        const player = players.get(ws);
        if (player) {
            handlePlayerDisconnect(player.playerId, player.roomCode);
        }
    }

    function handlePlayerMove(ws, data) {
        const player = players.get(ws);
        if (!player) return;

        const { playerId, roomCode } = player;
        const room = rooms.get(roomCode);
        if (!room || !room.players.has(playerId)) return;

        const { position } = data;
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') return;

        // Update player position
        room.players.get(playerId).position = position;

        // Broadcast to other players
        room.broadcast({
            type: 'player_moved',
            data: {
                playerId,
                position
            }
        }, playerId);
    }

    function handlePlayerInteract(ws, data) {
        const player = players.get(ws);
        if (!player) return;

        const { playerId, roomCode } = player;
        const room = rooms.get(roomCode);
        if (!room || !room.players.has(playerId)) return;

        const { objectId, interactionType } = data;

        // Process interaction logic here
        room.broadcast({
            type: 'player_interacted',
            data: {
                playerId,
                objectId,
                interactionType,
                timestamp: Date.now()
            }
        });
    }

    function handleGameStart(ws, data) {
        const player = players.get(ws);
        if (!player) return;

        const { playerId, roomCode } = player;
        const room = rooms.get(roomCode);
        if (!room || room.hostPlayerId !== playerId) {
            return ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can start the game'
            }));
        }

        if (room.players.size < 1) {
            return ws.send(JSON.stringify({
                type: 'error',
                message: 'Need at least 1 player to start'
            }));
        }

        room.gameState.started = true;
        room.gameState.timer = Date.now();

        room.broadcast({
            type: 'game_started',
            data: {
                timestamp: room.gameState.timer,
                players: Array.from(room.players.values()).map(p => ({
                    playerId: p.playerId,
                    name: p.name,
                    position: p.position
                }))
            }
        });

        console.log(`Game started in room ${room.roomCode}`);
    }

    function handleGameReset(ws, data) {
        const player = players.get(ws);
        if (!player) return;

        const { playerId, roomCode } = player;
        const room = rooms.get(roomCode);
        if (!room || room.hostPlayerId !== playerId) {
            return ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can reset the game'
            }));
        }

        room.gameState = {
            started: false,
            items: new Map(),
            interactions: new Map(),
            puzzles: new Map(),
            timer: null,
            duration: 0
        };

        // Reset player positions
        room.players.forEach(player => {
            player.position = { x: 100, y: 100 };
        });

        room.broadcast({
            type: 'game_reset',
            data: {
                timestamp: Date.now()
            }
        });

        console.log(`Game reset in room ${room.roomCode}`);
    }

    function handleChatMessage(ws, data) {
        console.log('🔍 SERVER: handleChatMessage called with data:', data);
        
        const player = players.get(ws);
        console.log('🔍 SERVER: Player data found:', player);
        
        if (!player) {
            console.log('❌ CHAT REJECTED: Player not found in players map');
            console.log('❌ CHAT REJECTED: Available players:', Array.from(players.keys()).length);
            return;
        }

        const { playerId, roomCode } = player;
        console.log('🔍 SERVER: Player ID:', playerId, 'Room Code:', roomCode);
        
        const room = rooms.get(roomCode);
        console.log('🔍 SERVER: Room found:', room ? room.roomCode : 'null');
        console.log('🔍 SERVER: Available rooms:', Array.from(rooms.keys()));
        
        if (!room) {
            console.log('❌ CHAT REJECTED: Room not found');
            return;
        }
        
        if (!room.players.has(playerId)) {
            console.log('❌ CHAT REJECTED: Player not in room');
            console.log('❌ CHAT REJECTED: Room players:', Array.from(room.players.keys()));
            return;
        }

        const { message } = data;
        console.log('🔍 SERVER: Message content:', message);
        
        if (!message || message.length > 200) {
            console.log('❌ CHAT REJECTED: Invalid message (empty or too long)');
            return;
        }

        const roomPlayer = room.players.get(playerId);
        console.log('🔍 SERVER: Room player found:', roomPlayer ? roomPlayer.name : 'null');
        
        console.log(`📱 Broadcasting chat message from ${roomPlayer.name}: ${message}`);
        
        room.broadcast({
            type: 'chat_message',
            data: {
                playerId,
                playerName: roomPlayer.name,
                message,
                timestamp: Date.now()
            }
        });
        
        console.log('✅ CHAT SUCCESS: Message broadcasted to room');
    }

    function handleDoorStateChange(ws, data) {
        console.log('🚪 SERVER: handleDoorStateChange called with data:', data);
        
        const player = players.get(ws);
        if (!player) {
            console.log('❌ DOOR STATE REJECTED: Player not found');
            return;
        }

        const { playerId, roomCode } = player;
        const room = rooms.get(roomCode);
        
        if (!room) {
            console.log('❌ DOOR STATE REJECTED: Room not found');
            return;
        }
        
        if (!room.players.has(playerId)) {
            console.log('❌ DOOR STATE REJECTED: Player not in room');
            return;
        }

        const { doorId, isOpen, fromRoom, targetRoom } = data;
        
        if (!doorId) {
            console.log('❌ DOOR STATE REJECTED: Invalid door data');
            return;
        }

        console.log(`🚪 Broadcasting door state change: ${doorId} is now ${isOpen ? 'OPEN' : 'CLOSED'}`);
        
        // Broadcast door state change to all players in the room (including sender for confirmation)
        room.broadcast({
            type: 'door_state_change',
            data: {
                doorId,
                isOpen,
                fromRoom,
                targetRoom,
                changedBy: playerId
            }
        });
        
        console.log('✅ DOOR STATE SUCCESS: Change broadcasted to room');
    }

    function handlePlayerDisconnect(playerId, roomCode) {
        const room = rooms.get(roomCode);
        if (!room) return;

        const player = room.players.get(playerId);
        if (player) {
            room.removePlayer(playerId);
            
            // Broadcast player left
            room.broadcast({
                type: 'player_left',
                data: {
                    playerId,
                    playerName: player.name
                }
            });

            console.log(`${player.name} left room ${roomCode}`);

            // Clean up empty rooms
            if (room.players.size === 0) {
                rooms.delete(roomCode);
                console.log(`Room ${roomCode} deleted (empty)`);
            }
        }
        
        currentRoom = null;
        playerId = null;
    }
});

// Clean up inactive rooms periodically
setInterval(() => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [roomCode, room] of rooms.entries()) {
        if (now - room.createdAt > maxAge && room.players.size === 0) {
            rooms.delete(roomCode);
            console.log(`Cleaned up inactive room: ${roomCode}`);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Start server
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for LAN access

server.listen(PORT, HOST, () => {
    console.log(`Escape Room WebSocket Server running on ${HOST}:${PORT}`);
    console.log('Available network interfaces:');
    getNetworkInterfaces().forEach(iface => {
        console.log(`  ${iface.name}: ${iface.address}`);
    });
    console.log(`Local access: http://localhost:3000`);
    console.log(`LAN access: Use one of the IP addresses above with port 3000. 8080 is for WebSocket connections; don't use it in the browser`);
});

module.exports = { server, wss, rooms, players };
