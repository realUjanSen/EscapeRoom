<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'escape_room_db');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Application configuration
define('APP_NAME', 'Multiplayer Escape Room');
define('APP_URL', 'http://localhost:8080');
define('APP_VERSION', '1.0.0');

// Security settings
define('SESSION_LIFETIME', 3600); // 1 hour
define('CSRF_TOKEN_NAME', 'csrf_token');
define('MAX_LOGIN_ATTEMPTS', 5);

// Game settings
define('MAX_PLAYERS_PER_ROOM', 4);
define('ROOM_TIMEOUT', 7200); // 2 hours
define('GAME_TIME_LIMIT', 1800); // 30 minutes

// File paths
define('ROOT_PATH', __DIR__ . '/../');
define('INCLUDES_PATH', ROOT_PATH . 'includes/');
define('PAGES_PATH', ROOT_PATH . 'pages/');
define('API_PATH', ROOT_PATH . 'api/');

// Error reporting (set to false in production)
define('DEBUG_MODE', true);

if (DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// Timezone
date_default_timezone_set('UTC');
?>
