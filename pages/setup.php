<?php
require_once __DIR__ . '/../config/config.php';

$setupComplete = false;
$error = null;
$success = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Connect to MySQL server (without selecting database)
        $dsn = "mysql:host=" . DB_HOST . ";charset=" . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]);

        // Read and execute SQL setup script
        $sqlFile = __DIR__ . '/../config/database.sql';
        if (!file_exists($sqlFile)) {
            throw new Exception('Database setup script not found');
        }

        $sql = file_get_contents($sqlFile);
        
        // Split SQL into individual statements
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        
        foreach ($statements as $statement) {
            if (!empty($statement) && !preg_match('/^--/', $statement)) {
                $pdo->exec($statement);
            }
        }

        $success = "Database setup completed successfully!";
        $setupComplete = true;

    } catch (PDOException $e) {
        $error = "Database error: " . $e->getMessage();
    } catch (Exception $e) {
        $error = $e->getMessage();
    }
}

// Test database connection
$dbConnected = false;
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $testPdo = new PDO($dsn, DB_USER, DB_PASS);
    
    // Check if tables exist
    $tables = $testPdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $expectedTables = ['game_rooms', 'room_players', 'game_progress', 'player_stats', 'game_events', 'chat_messages'];
    $dbConnected = count(array_intersect($expectedTables, $tables)) === count($expectedTables);
    
} catch (PDOException $e) {
    // Database doesn't exist or connection failed
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Setup - Multiplayer Escape Room</title>
    <link rel="stylesheet" href="../css/styles.css">
    <style>
        .setup-container {
            max-width: 800px;
            margin: 2rem auto;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .status {
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            font-weight: bold;
        }
        .status.success {
            background: #4ecdc4;
            color: #000;
        }
        .status.error {
            background: #ff6b6b;
            color: #fff;
        }
        .status.warning {
            background: #ffa500;
            color: #000;
        }
        .info-box {
            background: rgba(255, 255, 255, 0.05);
            padding: 1.5rem;
            border-radius: 10px;
            margin: 1rem 0;
        }
        .setup-form {
            text-align: center;
            margin: 2rem 0;
        }
        .requirements {
            list-style: none;
            padding: 0;
        }
        .requirements li {
            padding: 0.5rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .requirements li:before {
            content: "✓ ";
            color: #4ecdc4;
            font-weight: bold;
        }
        body {
            background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
            color: white;
            min-height: 100vh;
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body>
    <div class="setup-container">
        <h1>🔐 Database Setup</h1>
        
        <?php if ($dbConnected): ?>
            <div class="status success">
                ✅ Database is already set up and working!
            </div>
            <p><a href="dashboard.php" class="btn primary">Go to Dashboard</a></p>
            <p><a href="../index.html" class="btn secondary">Play Game</a></p>
        <?php else: ?>
            
            <?php if ($success): ?>
                <div class="status success"><?= htmlspecialchars($success) ?></div>
                <p><a href="dashboard.php" class="btn primary">Go to Dashboard</a></p>
            <?php endif; ?>

            <?php if ($error): ?>
                <div class="status error"><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>

            <?php if (!$setupComplete): ?>
                <div class="status warning">
                    ⚠️ Database not found or incomplete. Please run the setup.
                </div>

                <div class="info-box">
                    <h3>Requirements</h3>
                    <ul class="requirements">
                        <li>MySQL/MariaDB server running</li>
                        <li>PHP with PDO MySQL extension</li>
                        <li>Database user with CREATE/DROP privileges</li>
                        <li>XAMPP/WAMP/LAMP stack recommended</li>
                    </ul>
                </div>

                <div class="info-box">
                    <h3>What this setup will do:</h3>
                    <ul>
                        <li>Create database: <strong><?= DB_NAME ?></strong></li>
                        <li>Create tables for game rooms, players, progress, and chat</li>
                        <li>Set up proper indexes for performance</li>
                        <li>Insert sample data for testing</li>
                        <li>Create views for easy data access</li>
                    </ul>
                </div>

                <div class="info-box">
                    <h3>Current Configuration:</h3>
                    <ul>
                        <li><strong>Host:</strong> <?= DB_HOST ?></li>
                        <li><strong>Database:</strong> <?= DB_NAME ?></li>
                        <li><strong>User:</strong> <?= DB_USER ?></li>
                        <li><strong>Charset:</strong> <?= DB_CHARSET ?></li>
                    </ul>
                    <p><small>Edit <code>config/config.php</code> to change these settings.</small></p>
                </div>

                <div class="setup-form">
                    <form method="POST">
                        <button type="submit" class="btn primary" style="font-size: 1.2rem; padding: 1rem 2rem;">
                            🚀 Run Database Setup
                        </button>
                    </form>
                </div>

                <div class="info-box">
                    <h3>Manual Setup (Alternative)</h3>
                    <p>If the automatic setup fails, you can manually run the SQL script:</p>
                    <ol>
                        <li>Open phpMyAdmin or your MySQL client</li>
                        <li>Import the file: <code>config/database.sql</code></li>
                        <li>Or copy and paste the SQL commands from that file</li>
                    </ol>
                </div>
            <?php endif; ?>
        <?php endif; ?>

        <div style="margin-top: 3rem; text-align: center; opacity: 0.7;">
            <p>
                <a href="../index.html">← Back to Game</a> | 
                <a href="dashboard.php">Dashboard</a> |
                <a href="../README.md">Documentation</a>
            </p>
        </div>
    </div>
</body>
</html>
