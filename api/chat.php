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

Session::start();

$db = Database::getInstance();
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

$response = ['success' => false, 'message' => 'Invalid action'];

try {
    switch ($action) {
        case 'send_message':
            $roomId = $input['room_id'] ?? '';
            $playerId = $input['player_id'] ?? '';
            $playerName = $input['player_name'] ?? '';
            $message = trim($input['message'] ?? '');
            
            if (empty($roomId) || empty($playerId) || empty($playerName) || empty($message)) {
                $response = ['success' => false, 'message' => 'All fields are required'];
                break;
            }
            
            if (strlen($message) > 500) {
                $response = ['success' => false, 'message' => 'Message too long (max 500 characters)'];
                break;
            }
            
            // Check if player is in the room
            $playerInRoom = $db->fetchOne(
                'SELECT id FROM room_players WHERE room_id = :room_id AND player_id = :player_id',
                ['room_id' => $roomId, 'player_id' => $playerId]
            );
            
            if (!$playerInRoom) {
                $response = ['success' => false, 'message' => 'Player not in room'];
                break;
            }
            
            // Insert message
            $messageId = $db->insert('chat_messages', [
                'room_id' => $roomId,
                'player_id' => $playerId,
                'player_name' => $playerName,
                'message' => $message,
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            $response = [
                'success' => true,
                'message_id' => $messageId,
                'message' => 'Message sent successfully'
            ];
            break;

        case 'get_messages':
            $roomId = $input['room_id'] ?? $_GET['room_id'] ?? '';
            $since = $input['since'] ?? $_GET['since'] ?? '1970-01-01 00:00:00';
            
            if (empty($roomId)) {
                $response = ['success' => false, 'message' => 'Room ID is required'];
                break;
            }
            
            $messages = $db->fetchAll(
                'SELECT player_name, message, created_at FROM chat_messages 
                 WHERE room_id = :room_id AND created_at > :since 
                 ORDER BY created_at ASC LIMIT 50',
                ['room_id' => $roomId, 'since' => $since]
            );
            
            $response = [
                'success' => true,
                'messages' => $messages
            ];
            break;

        case 'clear_old_messages':
            $hoursAgo = $input['hours'] ?? 24;
            $cutoff = date('Y-m-d H:i:s', time() - ($hoursAgo * 3600));
            
            $deleted = $db->query(
                'DELETE FROM chat_messages WHERE created_at < :cutoff',
                ['cutoff' => $cutoff]
            )->rowCount();
            
            $response = [
                'success' => true,
                'deleted' => $deleted,
                'message' => "Deleted {$deleted} old messages"
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
