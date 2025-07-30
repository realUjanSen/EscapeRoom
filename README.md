#  Multiplayer Escape Room Game

A real-time multiplayer escape room game built for local area network (LAN) play. Work together with friends to solve cybersecurity puzzles, avoid guards, and escape!

##  Features

- **Real-time Multiplayer**: Up to 8 players per room
- **Cross-Platform**: Works on desktop, mobile, and tablets
- **LAN-Based**: No internet required - perfect for classrooms or offices
- **Interactive Puzzles**: Cybersecurity-themed riddles and challenges
- **AI Guard System**: Avoid the patrolling guard in the SE room
- **Room-Based Gameplay**: Progress through 4 connected rooms
- **Live Chat**: Team communication system
- **Mobile Controls**: Touch-friendly interface with virtual joystick

##  Quick Start

### Prerequisites

**You need to install these on your system first:**

1. **PHP 8.0+** (for static file server only)
   - **Windows**: Download from [php.net](https://windows.php.net/download/) or install via [XAMPP](https://www.apachefriends.org/)
   - **Mac**: `brew install php` or download from [php.net](https://php.net/downloads)
   - **Linux**: `sudo apt install php` (Ubuntu/Debian) or `sudo yum install php` (CentOS/RHEL)
   - **Verify**: Run `php --version` in terminal/command prompt

2. **Node.js 16+** (for multiplayer WebSocket server)
   - Download from [nodejs.org](https://nodejs.org/) (includes npm)
   - **Verify**: Run `node --version` and `npm --version` in terminal

3. **Modern web browser** (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository**
   ```bash
   # Bash/Linux/Mac
   git clone https://github.com/realUjanSen/EscapeRoom.git
   cd EscapeRoom
   ```
   ```powershell
   # PowerShell/Windows
   git clone https://github.com/realUjanSen/EscapeRoom.git
   cd EscapeRoom
   ```

2. **Install Node.js dependencies**
   ```bash
   # Bash/Linux/Mac
   cd ws-server
   npm install
   ```
   ```powershell
   # PowerShell/Windows
   cd ws-server
   npm install
   ```

3. **Start the servers**

   **Terminal 1 - PHP Server:**
   ```bash
   # Bash/Linux/Mac
   php -S 0.0.0.0:3000
   ```
   ```powershell
   # PowerShell/Windows
   php -S 0.0.0.0:3000
   ```

   **Terminal 2 - WebSocket Server:**
   ```bash
   # Bash/Linux/Mac
   cd ws-server
   node server.js
   ```
   ```powershell
   # PowerShell/Windows
   cd ws-server
   node server.js
   ```

4. **Access the game**
   - Open your browser and go to `http://localhost:3000/escape.html`
   - Other devices on your network can join using your IP address

##  How to Play

1. **Create or Join Room**: Enter your name and create/join a 6-character room code
2. **Wait in Lobby**: Host can start the game when ready
3. **Explore Rooms**: Move through connected rooms (NW → SW → SE → NE)
4. **Solve Puzzles**: Interact with computers in each room to solve cybersecurity riddles
5. **Avoid the Guard**: Don't wake up or touch the sleeping guard in the SE room
6. **Escape Together**: Complete all puzzles to unlock the master door and win!

##  Game Map

```
[NW Room] ←→ [NE Room - Master Door]
    ↕              ↕
[SW Room] ←→ [SE Room - Guard]
```

- **NW Room**: Starting room with first computer
- **SW Room**: Second puzzle computer
- **SE Room**: Third computer + sleeping guard (dangerous!)
- **NE Room**: Final computer + master door (escape exit)

## 🛠️ Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js WebSocket server + PHP development server
- **Real-time Communication**: WebSocket protocol
- **Game Engine**: Custom 2D collision detection and rendering
- **Network**: LAN-based with automatic IP discovery

##  Project Structure

```
EscapeRoom/
├── frontend/
│   ├── css/styles.css       # Game styling
│   └── js/
│       ├── game.js          # Core game logic
│       ├── websocket.js     # WebSocket communication
│       ├── networking.js    # Network interface detection
│       └── ui.js           # User interface management
├── ws-server/
│   ├── server.js           # WebSocket server
│   └── package.json
├── assets/
│   └── images/             # Game assets
├── api/                    # PHP API endpoints
├── escape.html            # Main game file
└── README.md
```

##  Controls

### Desktop
- **Movement**: WASD or Arrow Keys
- **Interact**: E key or Click
- **Chat**: Enter message and press Enter

### Mobile/Tablet
- **Movement**: Touch and drag anywhere on screen
- **Interact**: Tap on objects
- **Chat**: Tap chat input and type

## 🔧 Configuration

### Network Setup
1. Click the "🌐 IPCONFIG" button in the top-left
2. Select your network adapter
3. Share the generated URL with other players

### Server Ports
- **HTTP Server**: Port 3000 (configurable)
- **WebSocket Server**: Port 8080 (configurable in `ws-server/server.js`)


##  License

This project is open source and available under the [MIT License](LICENSE).

##  Troubleshooting

### Common Issues

**Players can't connect:**
- Ensure both servers are running (PHP + WebSocket)
- Check firewall settings - open ports 3000 and 8080:
  ```powershell
  # PowerShell (run as Administrator)
  New-NetFirewallRule -DisplayName "EscapeRoom PHP Server" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
  New-NetFirewallRule -DisplayName "EscapeRoom WebSocket Server" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
  ```
- Verify all devices are on the same network
- AP Isolation will block connections - disable it on your router
- Page loading slow, or no console errors when on a different subnet?
- Run `curl -L -v http://LAN_IPaddress:3000` to warm up the intranet's routing cache

**Game not loading:**
- Check browser console for errors
- Ensure PHP and Node.js are properly installed
- Try refreshing the page

**WebSocket connection failed:**
- Verify WebSocket server is running on port 8080
- Check for port conflicts

