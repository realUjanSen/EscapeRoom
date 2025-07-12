-- Multiplayer Escape Room Database Schema
-- Run this script to set up the database

CREATE DATABASE IF NOT EXISTS `escape_room_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `escape_room_db`;

-- Game rooms table
CREATE TABLE `game_rooms` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `room_id` varchar(6) NOT NULL UNIQUE,
    `creator_id` varchar(255) NOT NULL,
    `status` enum('waiting','playing','completed','expired') NOT NULL DEFAULT 'waiting',
    `max_players` int(2) NOT NULL DEFAULT 4,
    `created_at` datetime NOT NULL,
    `started_at` datetime NULL,
    `completed_at` datetime NULL,
    `expires_at` datetime NOT NULL,
    `game_ends_at` datetime NULL,
    `completion_time` int(11) NULL COMMENT 'Completion time in seconds',
    PRIMARY KEY (`id`),
    INDEX `idx_room_id` (`room_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Room players table
CREATE TABLE `room_players` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `room_id` varchar(6) NOT NULL,
    `player_id` varchar(255) NOT NULL,
    `player_name` varchar(50) NOT NULL,
    `is_creator` tinyint(1) NOT NULL DEFAULT 0,
    `position_x` float NOT NULL DEFAULT 100,
    `position_y` float NOT NULL DEFAULT 100,
    `joined_at` datetime NOT NULL,
    `last_activity` datetime NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_player_room` (`room_id`, `player_id`),
    INDEX `idx_room_id` (`room_id`),
    INDEX `idx_player_id` (`player_id`),
    FOREIGN KEY (`room_id`) REFERENCES `game_rooms`(`room_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game progress table
CREATE TABLE `game_progress` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `room_id` varchar(6) NOT NULL,
    `clues_found` json NULL,
    `doors_unlocked` json NULL,
    `items_collected` json NULL,
    `created_at` datetime NOT NULL,
    `updated_at` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_room_progress` (`room_id`),
    FOREIGN KEY (`room_id`) REFERENCES `game_rooms`(`room_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Player statistics table
CREATE TABLE `player_stats` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `player_id` varchar(255) NOT NULL,
    `player_name` varchar(50) NOT NULL,
    `games_played` int(11) NOT NULL DEFAULT 0,
    `games_won` int(11) NOT NULL DEFAULT 0,
    `total_playtime` int(11) NOT NULL DEFAULT 0 COMMENT 'Total playtime in seconds',
    `best_completion_time` int(11) NULL COMMENT 'Best completion time in seconds',
    `first_played` datetime NOT NULL,
    `last_played` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_player` (`player_id`),
    INDEX `idx_player_name` (`player_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game events log table (for analytics and debugging)
CREATE TABLE `game_events` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `room_id` varchar(6) NOT NULL,
    `player_id` varchar(255) NULL,
    `event_type` varchar(50) NOT NULL,
    `event_data` json NULL,
    `created_at` datetime NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_room_id` (`room_id`),
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat messages table
CREATE TABLE `chat_messages` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `room_id` varchar(6) NOT NULL,
    `player_id` varchar(255) NOT NULL,
    `player_name` varchar(50) NOT NULL,
    `message` text NOT NULL,
    `created_at` datetime NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_room_id` (`room_id`),
    INDEX `idx_created_at` (`created_at`),
    FOREIGN KEY (`room_id`) REFERENCES `game_rooms`(`room_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some sample data for testing
INSERT INTO `game_rooms` (`room_id`, `creator_id`, `status`, `created_at`, `expires_at`) VALUES
('ABC123', 'test-player-1', 'waiting', NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR)),
('XYZ789', 'test-player-2', 'completed', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 1 HOUR));

INSERT INTO `room_players` (`room_id`, `player_id`, `player_name`, `is_creator`, `joined_at`) VALUES
('ABC123', 'test-player-1', 'Alice', 1, NOW()),
('XYZ789', 'test-player-2', 'Bob', 1, DATE_SUB(NOW(), INTERVAL 1 HOUR));

-- Create a view for active rooms with player counts
CREATE VIEW `active_rooms_view` AS
SELECT 
    gr.room_id,
    gr.status,
    gr.max_players,
    gr.created_at,
    gr.expires_at,
    COUNT(rp.id) as current_players,
    GROUP_CONCAT(rp.player_name) as player_names
FROM game_rooms gr
LEFT JOIN room_players rp ON gr.room_id = rp.room_id
WHERE gr.expires_at > NOW()
GROUP BY gr.room_id;

-- Create indexes for better performance
CREATE INDEX idx_room_players_activity ON room_players(last_activity);
CREATE INDEX idx_game_events_timestamp ON game_events(created_at);
CREATE INDEX idx_chat_timestamp ON chat_messages(created_at);

COMMIT;
