// constants.js - Centralized constants for the application

// WebSocket configuration
export const WS_CONFIG = {
  URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
  RECONNECT_INTERVAL_MS: 1000,
  MAX_RECONNECT_ATTEMPTS: 10,
  EXPONENTIAL_BACKOFF_FACTOR: 1.5,
  SYNC_REQUEST_DELAY: 500,
  DUPLICATE_CHECK_WINDOW: 3000,
  MAX_DUPLICATE_CHECK_MESSAGES: 10,
};

// Discord OAuth configuration
export const DISCORD_CONFIG = {
  CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1379082773410873356',
  REDIRECT_URI: process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || 'http://localhost:3000/api/discord-auth',
  OAUTH_URL: 'https://discord.com/api/oauth2/authorize',
  TOKEN_URL: 'https://discord.com/api/oauth2/token',
  USER_URL: 'https://discord.com/api/users/@me',
  SCOPE: 'identify',
};

// YouTube configuration
export const YOUTUBE_CONFIG = {
  EMBED_BASE_URL: 'https://www.youtube.com/embed/',
  ALLOWED_ORIGINS: ['https://www.youtube.com', 'https://youtube.com'],
};

// Achievement storage keys
export const STORAGE_KEYS = {
  STATS: 'achievement_stats',
  UNLOCKED: 'achievement_unlocked',
  WATCH_SESSION: 'watch_session_start',
  USERNAME: 'chatUsername',
  VOLUME: 'volume',
  DISCORD_AVATAR: 'discordAvatar',
  DISCORD_USER_ID: 'discordUserId',
  DISCORD_ACCESS_TOKEN: 'discordAccessToken',
};

// Validation constants
export const VALIDATION = {
  MAX_MESSAGE_LENGTH: 500,
  MAX_USERNAME_LENGTH: 50,
  YOUTUBE_URL_PATTERN: /(?:v=|\/)([0-9A-Za-z_-]{11}).*/,
};

// UI constants
export const UI_CONFIG = {
  VOLUME_STEP: 0.01,
  WATCH_TIME_UPDATE_INTERVAL: 8000, // ms
  TYPING_TIMEOUT: 3000, // ms
  SYNC_TIMEOUT: 5000, // ms
};
