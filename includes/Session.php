<?php
require_once __DIR__ . '/../config/config.php';

class Session {
    public static function start() {
        if (session_status() === PHP_SESSION_NONE) {
            session_set_cookie_params([
                'lifetime' => SESSION_LIFETIME,
                'path' => '/',
                'domain' => '',
                'secure' => isset($_SERVER['HTTPS']),
                'httponly' => true,
                'samesite' => 'Strict'
            ]);
            session_start();
        }
    }

    public static function set($key, $value) {
        self::start();
        $_SESSION[$key] = $value;
    }

    public static function get($key, $default = null) {
        self::start();
        return $_SESSION[$key] ?? $default;
    }

    public static function has($key) {
        self::start();
        return isset($_SESSION[$key]);
    }

    public static function remove($key) {
        self::start();
        if (isset($_SESSION[$key])) {
            unset($_SESSION[$key]);
        }
    }

    public static function destroy() {
        self::start();
        session_destroy();
        $_SESSION = [];
    }

    public static function regenerateId() {
        self::start();
        session_regenerate_id(true);
    }

    public static function generateCSRFToken() {
        self::start();
        if (!self::has(CSRF_TOKEN_NAME)) {
            self::set(CSRF_TOKEN_NAME, bin2hex(random_bytes(32)));
        }
        return self::get(CSRF_TOKEN_NAME);
    }

    public static function validateCSRFToken($token) {
        self::start();
        $sessionToken = self::get(CSRF_TOKEN_NAME);
        return $sessionToken && hash_equals($sessionToken, $token);
    }

    public static function setFlashMessage($type, $message) {
        self::start();
        $_SESSION['flash_messages'][$type][] = $message;
    }

    public static function getFlashMessages($type = null) {
        self::start();
        if ($type) {
            $messages = $_SESSION['flash_messages'][$type] ?? [];
            unset($_SESSION['flash_messages'][$type]);
            return $messages;
        } else {
            $messages = $_SESSION['flash_messages'] ?? [];
            unset($_SESSION['flash_messages']);
            return $messages;
        }
    }
}
?>
