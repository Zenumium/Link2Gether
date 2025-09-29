// validation.js - Utility functions for input validation and sanitization

import { VALIDATION, YOUTUBE_CONFIG } from './constants.js';

/**
 * Sanitizes a string by trimming whitespace and removing potentially harmful characters
 * @param {string} input - The input string to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized string
 */
export const sanitizeString = (input, maxLength = VALIDATION.MAX_MESSAGE_LENGTH) => {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, maxLength);
};

/**
 * Validates and extracts YouTube video ID from URL
 * @param {string} url - YouTube URL to validate
 * @returns {string|null} Video ID if valid, null otherwise
 */
export const getYoutubeVideoId = (url) => {
  if (typeof url !== 'string') return null;

  const match = url.match(VALIDATION.YOUTUBE_URL_PATTERN);
  return match ? match[1] : null;
};

/**
 * Validates if a YouTube URL is properly formatted
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid YouTube URL
 */
export const isValidYoutubeUrl = (url) => {
  return getYoutubeVideoId(url) !== null;
};

/**
 * Generates a secure random username
 * @returns {string} Random username
 */
export const generateRandomUsername = () => {
  const adjectives = ['Cool', 'Epic', 'Awesome', 'Super', 'Mega', 'Ultra', 'Pro', 'Elite'];
  const nouns = ['User', 'Player', 'Watcher', 'Gamer', 'Viewer', 'Fan', 'Hero', 'Star'];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 9999) + 1;

  return `${adjective}${noun}${number}`;
};

/**
 * Validates username format and length
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
export const isValidUsername = (username) => {
  if (typeof username !== 'string') return false;
  if (username.length === 0 || username.length > VALIDATION.MAX_USERNAME_LENGTH) return false;

  // Allow alphanumeric, spaces, underscores, hyphens
  const usernameRegex = /^[a-zA-Z0-9 _-]+$/;
  return usernameRegex.test(username);
};

/**
 * Safely parses JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} Parsed object or fallback
 */
export const safeJsonParse = (jsonString, fallback = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return fallback;
  }
};

/**
 * Validates WebSocket message structure
 * @param {any} message - Message to validate
 * @returns {boolean} True if valid message structure
 */
export const isValidWebSocketMessage = (message) => {
  if (!message || typeof message !== 'object') return false;

  const requiredFields = ['type'];
  return requiredFields.every(field => message.hasOwnProperty(field));
};

/**
 * Sanitizes chat message content
 * @param {string} content - Message content
 * @returns {string} Sanitized content
 */
export const sanitizeMessage = (content) => {
  return sanitizeString(content, VALIDATION.MAX_MESSAGE_LENGTH);
};

/**
 * Validates message event origin for YouTube iframe
 * @param {string} origin - Origin to validate
 * @returns {boolean} True if allowed origin
 */
export const isValidYoutubeOrigin = (origin) => {
  return YOUTUBE_CONFIG.ALLOWED_ORIGINS.includes(origin);
};

/**
 * Safely retrieves data from localStorage with validation
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if not found or invalid
 * @param {function} validator - Optional validator function
 * @returns {any} Retrieved value or default
 */
export const safeLocalStorageGet = (key, defaultValue = null, validator = null) => {
  try {
    if (typeof window === 'undefined') return defaultValue;

    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;

    const parsed = safeJsonParse(item, defaultValue);
    if (validator && !validator(parsed)) return defaultValue;

    return parsed;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Safely stores data in localStorage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
export const safeLocalStorageSet = (key, value) => {
  try {
    if (typeof window === 'undefined') return;

    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error writing localStorage key "${key}":`, error);
  }
};

/**
 * Validates numeric input within range
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Validated number or default
 */
export const validateNumber = (value, min = 0, max = 1) => {
  const num = parseFloat(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
};
