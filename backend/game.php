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
        case 'get_rooms':
            // Get list of public rooms
            $db = Database::getInstance();
            $stmt = $db->prepare("
                SELECT r.room_code, r.created_at, r.is_private, r.status,
                       COUNT(p.id) as player_count,
                       (SELECT rp.player_name FROM room_players rp WHERE rp.room_id = r.id AND rp.is_host = 1 LIMIT 1) as host_name
                FROM rooms r 
                LEFT JOIN room_players p ON r.id = p.room_id 
                WHERE r.is_private = 0 AND r.status IN ('waiting', 'in_progress')
                AND r.created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
                GROUP BY r.id
                ORDER BY r.created_at DESC
                LIMIT 20
            ");
            $stmt->execute();
            $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $response = [
                'success' => true,
                'rooms' => array_map(function($room) {
                    return [
                        'roomCode' => $room['room_code'],
                        'hostName' => $room['host_name'] ?: 'Unknown',
                        'playerCount' => (int)$room['player_count'],
                        'maxPlayers' => 8,
                        'gameStarted' => $room['status'] === 'in_progress',
                        'isPrivate' => (bool)$room['is_private']
                    ];
                }, $rooms)
            ];
            break;

        case 'create_room':
            $playerId = $input['player_id'] ?? uniqid('player_', true);
            $playerName = $input['player_name'] ?? '';
            $isPrivate = $input['is_private'] ?? false;
            
            if (empty($playerName)) {
                $response = ['success' => false, 'message' => 'Player name is required'];
                break;
            }
            
            $response = $gameManager->createRoom($playerId, $playerName, $isPrivate);
            $response['player_id'] = $playerId;
            break;

        case 'join_room':
            $roomCode = $input['room_code'] ?? '';
            $playerId = $input['player_id'] ?? uniqid('player_', true);
            $playerName = $input['player_name'] ?? '';
            
            if (empty($roomCode) || empty($playerName)) {
                $response = ['success' => false, 'message' => 'Room code and player name are required'];
                break;
            }
            
            $response = $gameManager->joinRoomByCode($roomCode, $playerId, $playerName);
            $response['player_id'] = $playerId;
            break;

        case 'leave_room':
            $roomCode = $input['room_code'] ?? '';
            $playerId = $input['player_id'] ?? '';
            
            if (empty($roomCode) || empty($playerId)) {
                $response = ['success' => false, 'message' => 'Room code and player ID are required'];
                break;
            }
            
            $response = $gameManager->leaveRoomByCode($roomCode, $playerId);
            break;

        case 'get_room_status':
            $roomCode = $input['room_code'] ?? $_GET['room_code'] ?? '';
            
            if (empty($roomCode)) {
                $response = ['success' => false, 'message' => 'Room code is required'];
                break;
            }
            
            $roomStatus = $gameManager->getRoomStatus($roomCode);
            if ($roomStatus) {
                $response = [
                    'success' => true,
                    'room' => $roomStatus
                ];
            } else {
                $response = ['success' => false, 'message' => 'Room not found'];
            }
            break;

        case 'validate_room':
            $roomCode = $input['room_code'] ?? $_GET['room_code'] ?? '';
            
            if (empty($roomCode)) {
                $response = ['success' => false, 'message' => 'Room code is required'];
                break;
            }
            
            $exists = $gameManager->roomExists($roomCode);
            $response = [
                'success' => true,
                'exists' => $exists
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
