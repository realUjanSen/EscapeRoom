<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../includes/Database.php';
require_once __DIR__ . '/../includes/Session.php';
require_once __DIR__ . '/../includes/GameManager.php';

Session::start();

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

$gameManager = new GameManager();
$response = ['success' => false, 'message' => 'Invalid action'];

try {
    switch ($action) {
        case 'create_room':
            $playerId = $input['player_id'] ?? uniqid('player_', true);
            $playerName = $input['player_name'] ?? '';
            
            if (empty($playerName)) {
                $response = ['success' => false, 'message' => 'Player name is required'];
                break;
            }
            
            $response = $gameManager->createRoom($playerId, $playerName);
            $response['player_id'] = $playerId;
            break;

        case 'join_room':
            $roomId = $input['room_id'] ?? '';
            $playerId = $input['player_id'] ?? uniqid('player_', true);
            $playerName = $input['player_name'] ?? '';
            
            if (empty($roomId) || empty($playerName)) {
                $response = ['success' => false, 'message' => 'Room ID and player name are required'];
                break;
            }
            
            $response = $gameManager->joinRoom($roomId, $playerId, $playerName);
            $response['player_id'] = $playerId;
            break;

        case 'leave_room':
            $roomId = $input['room_id'] ?? '';
            $playerId = $input['player_id'] ?? '';
            
            if (empty($roomId) || empty($playerId)) {
                $response = ['success' => false, 'message' => 'Room ID and player ID are required'];
                break;
            }
            
            $response = $gameManager->leaveRoom($roomId, $playerId);
            break;

        case 'start_game':
            $roomId = $input['room_id'] ?? '';
            $playerId = $input['player_id'] ?? '';
            
            if (empty($roomId) || empty($playerId)) {
                $response = ['success' => false, 'message' => 'Room ID and player ID are required'];
                break;
            }
            
            $response = $gameManager->startGame($roomId, $playerId);
            break;

        case 'update_position':
            $roomId = $input['room_id'] ?? '';
            $playerId = $input['player_id'] ?? '';
            $x = $input['x'] ?? 0;
            $y = $input['y'] ?? 0;
            
            if (empty($roomId) || empty($playerId)) {
                $response = ['success' => false, 'message' => 'Room ID and player ID are required'];
                break;
            }
            
            $response = $gameManager->updatePlayerPosition($roomId, $playerId, $x, $y);
            break;

        case 'save_progress':
            $roomId = $input['room_id'] ?? '';
            $progressData = $input['progress'] ?? [];
            
            if (empty($roomId)) {
                $response = ['success' => false, 'message' => 'Room ID is required'];
                break;
            }
            
            $response = $gameManager->saveGameProgress($roomId, $progressData);
            break;

        case 'complete_game':
            $roomId = $input['room_id'] ?? '';
            $completionTime = $input['completion_time'] ?? 0;
            
            if (empty($roomId)) {
                $response = ['success' => false, 'message' => 'Room ID is required'];
                break;
            }
            
            $response = $gameManager->completeGame($roomId, $completionTime);
            break;

        case 'get_room_players':
            $roomId = $input['room_id'] ?? $_GET['room_id'] ?? '';
            
            if (empty($roomId)) {
                $response = ['success' => false, 'message' => 'Room ID is required'];
                break;
            }
            
            $players = $gameManager->getRoomPlayers($roomId);
            $response = [
                'success' => true,
                'players' => $players
            ];
            break;

        case 'cleanup_rooms':
            $cleaned = $gameManager->cleanupExpiredRooms();
            $response = [
                'success' => true,
                'message' => "Cleaned up {$cleaned} expired rooms"
            ];
            break;

        default:
            $response = ['success' => false, 'message' => 'Unknown action: ' . $action];
    }

} catch (Exception $e) {
    $response = [
        'success' => false,
        'message' => DEBUG_MODE ? $e->getMessage() : 'An error occurred'
    ];
    
    if (DEBUG_MODE) {
        $response['debug'] = [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ];
    }
}

echo json_encode($response);
?>
