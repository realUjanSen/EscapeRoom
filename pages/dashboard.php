<?php
require_once __DIR__ . '/../includes/Database.php';
require_once __DIR__ . '/../includes/Session.php';

Session::start();
$db = Database::getInstance();

// Get statistics
try {
    $stats = [
        'total_rooms' => 0,
        'active_rooms' => 0,
        'total_players' => 0,
        'games_completed' => 0,
        'average_completion_time' => 0
    ];

    $totalRooms = $db->fetchOne('SELECT COUNT(*) as count FROM game_rooms');
    $stats['total_rooms'] = $totalRooms['count'];

    $activeRooms = $db->fetchOne('SELECT COUNT(*) as count FROM game_rooms WHERE status IN ("waiting", "playing") AND expires_at > NOW()');
    $stats['active_rooms'] = $activeRooms['count'];

    $totalPlayers = $db->fetchOne('SELECT COUNT(DISTINCT player_id) as count FROM room_players');
    $stats['total_players'] = $totalPlayers['count'];

    $completedGames = $db->fetchOne('SELECT COUNT(*) as count, AVG(completion_time) as avg_time FROM game_rooms WHERE status = "completed"');
    $stats['games_completed'] = $completedGames['count'];
    $stats['average_completion_time'] = round($completedGames['avg_time'] ?? 0, 2);

    $activeRoomsList = $db->fetchAll('SELECT * FROM active_rooms_view ORDER BY created_at DESC LIMIT 10');

} catch (Exception $e) {
    $error = $e->getMessage();
    $stats = null;
    $activeRoomsList = [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Dashboard - Multiplayer Escape Room</title>
    <link rel="stylesheet" href="../css/styles.css">
    <style>
        .dashboard {
            padding: 2rem;
            background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
            min-height: 100vh;
            color: white;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin: 2rem 0;
        }
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center;
        }
        .stat-number {
            font-size: 3rem;
            font-weight: bold;
            color: #4ecdc4;
            margin-bottom: 0.5rem;
        }
        .stat-label {
            font-size: 1.2rem;
            opacity: 0.8;
        }
        .rooms-table {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 2rem;
            margin-top: 2rem;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
        }
        .table th, .table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .table th {
            background: rgba(255, 255, 255, 0.05);
            font-weight: bold;
            color: #4ecdc4;
        }
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        .status-waiting { background: #ffa500; color: #000; }
        .status-playing { background: #4ecdc4; color: #000; }
        .status-completed { background: #28a745; color: #fff; }
        .nav-button {
            display: inline-block;
            padding: 1rem 2rem;
            background: linear-gradient(45deg, #4ecdc4, #44a08d);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 0.5rem;
            transition: transform 0.3s ease;
        }
        .nav-button:hover {
            transform: translateY(-2px);
        }
        .error {
            background: #ff6b6b;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <header>
            <h1>🔐 Escape Room Dashboard</h1>
            <nav>
                <a href="../index.html" class="nav-button">Play Game</a>
                <a href="admin.php" class="nav-button">Admin Panel</a>
                <a href="leaderboard.php" class="nav-button">Leaderboard</a>
            </nav>
        </header>

        <?php if (isset($error)): ?>
            <div class="error">
                <strong>Database Error:</strong> <?= htmlspecialchars($error) ?>
                <br><small>Make sure to run the database setup script first.</small>
            </div>
        <?php endif; ?>

        <?php if ($stats): ?>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number"><?= $stats['total_rooms'] ?></div>
                    <div class="stat-label">Total Rooms Created</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number"><?= $stats['active_rooms'] ?></div>
                    <div class="stat-label">Active Rooms</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number"><?= $stats['total_players'] ?></div>
                    <div class="stat-label">Total Players</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number"><?= $stats['games_completed'] ?></div>
                    <div class="stat-label">Games Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number"><?= $stats['average_completion_time'] ?>s</div>
                    <div class="stat-label">Avg Completion Time</div>
                </div>
            </div>

            <div class="rooms-table">
                <h2>Recent Active Rooms</h2>
                <?php if (empty($activeRoomsList)): ?>
                    <p>No active rooms found.</p>
                <?php else: ?>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Room ID</th>
                                <th>Status</th>
                                <th>Players</th>
                                <th>Created</th>
                                <th>Expires</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($activeRoomsList as $room): ?>
                                <tr>
                                    <td><strong><?= htmlspecialchars($room['room_id']) ?></strong></td>
                                    <td>
                                        <span class="status-badge status-<?= htmlspecialchars($room['status']) ?>">
                                            <?= ucfirst(htmlspecialchars($room['status'])) ?>
                                        </span>
                                    </td>
                                    <td>
                                        <?= $room['current_players'] ?>/<?= $room['max_players'] ?>
                                        <?php if ($room['player_names']): ?>
                                            <br><small><?= htmlspecialchars($room['player_names']) ?></small>
                                        <?php endif; ?>
                                    </td>
                                    <td><?= date('M j, H:i', strtotime($room['created_at'])) ?></td>
                                    <td><?= date('M j, H:i', strtotime($room['expires_at'])) ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <div class="rooms-table">
            <h2>Quick Actions</h2>
            <p>
                <a href="../api/game.php?action=cleanup_rooms" class="nav-button" 
                   onclick="return confirm('Clean up expired rooms?')">Clean Up Expired Rooms</a>
                <a href="../api/chat.php?action=clear_old_messages&hours=24" class="nav-button"
                   onclick="return confirm('Clear messages older than 24 hours?')">Clear Old Messages</a>
            </p>
        </div>

        <footer style="margin-top: 3rem; text-align: center; opacity: 0.7;">
            <p>Multiplayer Escape Room Dashboard | Last updated: <?= date('Y-m-d H:i:s') ?></p>
        </footer>
    </div>
</body>
</html>
