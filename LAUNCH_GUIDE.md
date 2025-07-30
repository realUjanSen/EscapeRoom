#  Quick Launch Guide

## Port Architecture
- **Frontend/Backend (PHP)**: Port `3000` - Main game interface and APIs
- **WebSocket Server (Node.js)**: Port `8080` - Real-time multiplayer communication

## How to Start

### 1. Start Both Servers
```powershell
# Terminal 1: Start WebSocket Server
cd ws-server
npm start

# Terminal 2: Start PHP Server (bind to all interfaces)
php -S 0.0.0.0:3000
```

### 2. Access the Game
- **Main Game**: `http://localhost:3000/escape.html`
- **Test Page**: `http://localhost:3000/test.html`
- **NOT**: `http://localhost:8080` (WebSocket server only, no web pages)

### 3. Play the Game
1. Open `http://localhost:3000/escape.html`
2. Click "🌐 IPCONFIG" and select a network interface
3. Enter your player name
4. Click "Create Room" or "Join Room"
5. Share the generated link with friends

## Troubleshooting

### "Connection Refused" on Port 3000
```powershell
# Check if PHP server is running (should bind to all interfaces)
php -S 0.0.0.0:3000
```

### "WebSocket Connection Failed"
```powershell
# Check if WebSocket server is running
cd ws-server
npm start
```

### Can't See Game Interface
- Make sure you're using `localhost:3000`, not `localhost:8080`
- The WebSocket server (port 8080) only handles real-time communication
- The web interface is served by PHP (port 3000)

## Network Interface Names
The dropdown now shows both the adapter name and IP:
- `🌐 Wi-Fi 2 (192.168.0.103)`
- `🌐 VMware Network Adapter VMnet1 (192.168.19.1)`

This makes it easier to choose the right network for LAN play!

## PowerShell vs Bash Commands
- **PowerShell (Windows)**: Use `;` for chaining commands
- **Bash (Linux/Mac)**: Use `&&` for chaining commands

The `package.json` scripts have been updated to use PowerShell-compatible syntax.
