<?php
require_once __DIR__ . '/../includes/Database.php';
require_once __DIR__ . '/../includes/Session.php';

class GameManager {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function createRoom($playerId, $playerName) {
        $roomId = $this->generateRoomId();
        $createdAt = date('Y-m-d H:i:s');
        $expiresAt = date('Y-m-d H:i:s', time() + ROOM_TIMEOUT);

        try {
            $this->db->insert('game_rooms', [
                'room_id' => $roomId,
                'creator_id' => $playerId,
                'status' => 'waiting',
                'max_players' => MAX_PLAYERS_PER_ROOM,
                'created_at' => $createdAt,
                'expires_at' => $expiresAt
            ]);

            $this->joinRoom($roomId, $playerId, $playerName, true);

            return [
                'success' => true,
                'room_id' => $roomId,
                'message' => 'Room created successfully'
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Failed to create room: ' . $e->getMessage()
            ];
        }
    }

    public function joinRoom($roomId, $playerId, $playerName, $isCreator = false) {
        try {
            // Check if room exists and is not full
            $room = $this->getRoomInfo($roomId);
            if (!$room) {
                return ['success' => false, 'message' => 'Room not found'];
            }

            if ($room['status'] !== 'waiting') {
                return ['success' => false, 'message' => 'Game already started'];
            }

            $playerCount = $this->getPlayerCount($roomId);
            if ($playerCount >= $room['max_players']) {
                return ['success' => false, 'message' => 'Room is full'];
            }

            // Check if player already in room
            if ($this->isPlayerInRoom($roomId, $playerId)) {
                return ['success' => false, 'message' => 'Already in room'];
            }

            $this->db->insert('room_players', [
                'room_id' => $roomId,
                'player_id' => $playerId,
                'player_name' => $playerName,
                'is_creator' => $isCreator ? 1 : 0,
                'joined_at' => date('Y-m-d H:i:s'),
                'position_x' => 100,
                'position_y' => 100
            ]);

            return [
                'success' => true,
                'message' => 'Joined room successfully',
                'players' => $this->getRoomPlayers($roomId)
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Failed to join room: ' . $e->getMessage()
            ];
        }
    }

    public function leaveRoom($roomId, $playerId) {
        try {
            $this->db->delete('room_players', 'room_id = :room_id AND player_id = :player_id', [
                'room_id' => $roomId,
                'player_id' => $playerId
            ]);

            // If no players left, delete the room
            if ($this->getPlayerCount($roomId) === 0) {
                $this->deleteRoom($roomId);
            }

            return ['success' => true, 'message' => 'Left room successfully'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Failed to leave room'];
        }
    }

    public function startGame($roomId, $playerId) {
        try {
            $room = $this->getRoomInfo($roomId);
            if (!$room) {
                return ['success' => false, 'message' => 'Room not found'];
            }

            // Check if player is the creator
            $player = $this->db->fetchOne(
                'SELECT * FROM room_players WHERE room_id = :room_id AND player_id = :player_id AND is_creator = 1',
                ['room_id' => $roomId, 'player_id' => $playerId]
            );

            if (!$player) {
                return ['success' => false, 'message' => 'Only room creator can start the game'];
            }

            $this->db->update('game_rooms', [
                'status' => 'playing',
                'started_at' => date('Y-m-d H:i:s'),
                'game_ends_at' => date('Y-m-d H:i:s', time() + GAME_TIME_LIMIT)
            ], 'room_id = :room_id', ['room_id' => $roomId]);

            return [
                'success' => true,
                'message' => 'Game started',
                'game_time_limit' => GAME_TIME_LIMIT
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Failed to start game'];
        }
    }

    public function updatePlayerPosition($roomId, $playerId, $x, $y) {
        try {
            $this->db->update('room_players', [
                'position_x' => $x,
                'position_y' => $y,
                'last_activity' => date('Y-m-d H:i:s')
            ], 'room_id = :room_id AND player_id = :player_id', [
                'room_id' => $roomId,
                'player_id' => $playerId
            ]);

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Failed to update position'];
        }
    }

    public function saveGameProgress($roomId, $progressData) {
        try {
            $existing = $this->db->fetchOne(
                'SELECT id FROM game_progress WHERE room_id = :room_id',
                ['room_id' => $roomId]
            );

            if ($existing) {
                $this->db->update('game_progress', [
                    'clues_found' => json_encode($progressData['clues_found']),
                    'doors_unlocked' => json_encode($progressData['doors_unlocked']),
                    'items_collected' => json_encode($progressData['items_collected']),
                    'updated_at' => date('Y-m-d H:i:s')
                ], 'room_id = :room_id', ['room_id' => $roomId]);
            } else {
                $this->db->insert('game_progress', [
                    'room_id' => $roomId,
                    'clues_found' => json_encode($progressData['clues_found']),
                    'doors_unlocked' => json_encode($progressData['doors_unlocked']),
                    'items_collected' => json_encode($progressData['items_collected']),
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
            }

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Failed to save progress'];
        }
    }

    public function completeGame($roomId, $completionTime) {
        try {
            $this->db->update('game_rooms', [
                'status' => 'completed',
                'completed_at' => date('Y-m-d H:i:s'),
                'completion_time' => $completionTime
            ], 'room_id = :room_id', ['room_id' => $roomId]);

            return [
                'success' => true,
                'message' => 'Game completed!',
                'completion_time' => $completionTime
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Failed to complete game'];
        }
    }

    // Helper methods
    private function generateRoomId() {
        do {
            $roomId = strtoupper(substr(str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 6));
        } while ($this->getRoomInfo($roomId));
        
        return $roomId;
    }

    private function getRoomInfo($roomId) {
        return $this->db->fetchOne(
            'SELECT * FROM game_rooms WHERE room_id = :room_id AND expires_at > NOW()',
            ['room_id' => $roomId]
        );
    }

    private function getPlayerCount($roomId) {
        $result = $this->db->fetchOne(
            'SELECT COUNT(*) as count FROM room_players WHERE room_id = :room_id',
            ['room_id' => $roomId]
        );
        return $result['count'];
    }

    private function isPlayerInRoom($roomId, $playerId) {
        $result = $this->db->fetchOne(
            'SELECT id FROM room_players WHERE room_id = :room_id AND player_id = :player_id',
            ['room_id' => $roomId, 'player_id' => $playerId]
        );
        return !empty($result);
    }

    public function getRoomPlayers($roomId) {
        return $this->db->fetchAll(
            'SELECT player_id, player_name, position_x, position_y, is_creator FROM room_players WHERE room_id = :room_id',
            ['room_id' => $roomId]
        );
    }

    private function deleteRoom($roomId) {
        $this->db->delete('room_players', 'room_id = :room_id', ['room_id' => $roomId]);
        $this->db->delete('game_progress', 'room_id = :room_id', ['room_id' => $roomId]);
        $this->db->delete('game_rooms', 'room_id = :room_id', ['room_id' => $roomId]);
    }

    public function cleanupExpiredRooms() {
        $expiredRooms = $this->db->fetchAll(
            'SELECT room_id FROM game_rooms WHERE expires_at < NOW()'
        );

        foreach ($expiredRooms as $room) {
            $this->deleteRoom($room['room_id']);
        }

        return count($expiredRooms);
    }
}
?>
