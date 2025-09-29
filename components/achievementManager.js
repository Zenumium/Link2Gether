// achievementManager.js
import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '../utils/constants.js';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/validation.js';

// Achievement definitions with unlock conditions
const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 1,
    name: "First Connection",
    description: "Connected to Discord for the first time",
    icon: "🎉",
    type: "discord_connection",
    target: 1
  },
  {
    id: 2,
    name: "Video Master",
    description: "Added 10 videos to queue",
    icon: "🎬",
    type: "videos_added",
    target: 10
  },
  {
    id: 3,
    name: "Chat Champion",
    description: "Sent 50 messages in chat",
    icon: "💬",
    type: "messages_sent",
    target: 50
  },
  {
    id: 4,
    name: "Just Warming Up",
    description: "Played videos for 1 hour total",
    icon: "🥉",
    type: "watch_time",
    target: 3600 // 1 hour in seconds
  },
  {
    id: 5,
    name: "Queue Master",
    description: "Had 5 videos in queue at once",
    icon: "📋",
    type: "max_queue_size",
    target: 5
  },
  {
    id: 6,
    name: "Channel Surfer Pro",
    description: "Watch videos for 10h total",
    icon: "🥈",
    type: "watch_time",
    target: 36000 // 10 hours in seconds
  },
  {
    id: 7,
    name: "The Algorithmic Abyss Diver",
    description: "Watch videos for 50h total",
    icon: "🥇",
    type: "watch_time",
    target: 180000 // 50 hours in seconds
  },
  {
    id: 8,
    name: "Pixelated Pupil",
    description: "Watch videos for 150h total",
    icon: "🥈",
    type: "watch_time",
    target: 540000 // 150 hours in seconds
  },
  {
    id: 9,
    name: "YouTube Grandmaster (and Potential Hermit)",
    description: "Watch videos for 500h total",
    icon: "🥈",
    type: "watch_time",
    target: 1800000 // 500 hours in seconds
  },
  {
    id: 10,
    name: "Time to go Outside",
    description: "Watch videos for 1000h total",
    icon: "🥈",
    type: "watch_time",
    target: 3600000 // 1000 hours in seconds
  }
];

// Storage keys are now imported from constants.js

/**
 * Custom hook for managing achievements
 */
export const useAchievements = () => {
  const [stats, setStats] = useState({
    discord_connections: 0,
    videos_added: 0,
    messages_sent: 0,
    watch_time: 0, // Ensure this is initialized as a number
    max_queue_size: 0,
    sessions_played: 0
  });

  const [unlockedAchievements, setUnlockedAchievements] = useState(new Set());
  const [watchSessionStart, setWatchSessionStart] = useState(null);

  // Load saved data from localStorage
  useEffect(() => {
    const savedStats = safeLocalStorageGet(STORAGE_KEYS.STATS, {
      discord_connections: 0,
      videos_added: 0,
      messages_sent: 0,
      watch_time: 0,
      max_queue_size: 0,
      sessions_played: 0
    }, (data) => {
      // Validate stats structure
      return typeof data === 'object' && data !== null &&
             typeof data.watch_time === 'number';
    });

    const savedUnlocked = safeLocalStorageGet(STORAGE_KEYS.UNLOCKED, [], (data) => {
      return Array.isArray(data);
    });

    const savedWatchSession = safeLocalStorageGet(STORAGE_KEYS.WATCH_SESSION, null, (data) => {
      return typeof data === 'string' || typeof data === 'number';
    });

    setStats(savedStats);
    setUnlockedAchievements(new Set(savedUnlocked));

    if (savedWatchSession) {
      setWatchSessionStart(parseInt(savedWatchSession, 10));
    }
  }, []);

  // Save stats to localStorage whenever they change
  const saveStats = useCallback((newStats) => {
    safeLocalStorageSet(STORAGE_KEYS.STATS, newStats);
    setStats(newStats);
  }, []);

  // Save unlocked achievements to localStorage
  const saveUnlockedAchievements = useCallback((newUnlocked) => {
    safeLocalStorageSet(STORAGE_KEYS.UNLOCKED, [...newUnlocked]);
    setUnlockedAchievements(newUnlocked);
  }, []);

  // Check and unlock achievements based on current stats
  const checkAchievements = useCallback((currentStats) => {
    const newUnlocked = new Set(unlockedAchievements);
    let hasNewAchievements = false;

    ACHIEVEMENT_DEFINITIONS.forEach(achievement => {
      if (!newUnlocked.has(achievement.id)) {
        let shouldUnlock = false;

        switch (achievement.type) {
          case 'discord_connection':
            shouldUnlock = (currentStats.discord_connections || 0) >= achievement.target;
            break;
          case 'videos_added':
            shouldUnlock = (currentStats.videos_added || 0) >= achievement.target;
            break;
          case 'messages_sent':
            shouldUnlock = (currentStats.messages_sent || 0) >= achievement.target;
            break;
          case 'watch_time':
            // Ensure target and current value are numbers before comparison
            shouldUnlock = (currentStats.watch_time || 0) >= (achievement.target || 0);
            break;
          case 'max_queue_size':
            shouldUnlock = (currentStats.max_queue_size || 0) >= achievement.target;
            break;
          default:
            break;
        }

        if (shouldUnlock) {
          newUnlocked.add(achievement.id);
          hasNewAchievements = true;
          
          // You could add a notification system here
          console.log(`🎉 Achievement unlocked: ${achievement.name}`);
        }
      }
    });

    if (hasNewAchievements) {
      saveUnlockedAchievements(newUnlocked);
    }
  }, [unlockedAchievements, saveUnlockedAchievements]);

  // Track Discord connection
  const trackDiscordConnection = useCallback(() => {
    const newStats = {
      ...stats,
      discord_connections: (stats.discord_connections || 0) + 1 // Defensive: ensure it's a number
    };
    saveStats(newStats);
  }, [stats, saveStats]);

  // Track video added to queue
  const trackVideoAdded = useCallback(() => {
    const newStats = {
      ...stats,
      videos_added: (stats.videos_added || 0) + 1 // Defensive: ensure it's a number
    };
    saveStats(newStats);
  }, [stats, saveStats]);

  // Track message sent in chat
  const trackMessageSent = useCallback(() => {
    const newStats = {
      ...stats,
      messages_sent: (stats.messages_sent || 0) + 1 // Defensive: ensure it's a number
    };
    saveStats(newStats);
  }, [stats, saveStats]);

  // Track queue size changes
  const trackQueueSize = useCallback((currentQueueSize) => {
    if (currentQueueSize > (stats.max_queue_size || 0)) { // Defensive: ensure it's a number
      const newStats = {
        ...stats,
        max_queue_size: currentQueueSize
      };
      saveStats(newStats);
    }
  }, [stats, saveStats]);

  // Start watch session
  const startWatchSession = useCallback(() => {
    if (!watchSessionStart) { // Only start if not already started
      const now = Date.now();
      setWatchSessionStart(now);
      safeLocalStorageSet(STORAGE_KEYS.WATCH_SESSION, now.toString());
      console.log(`[Achievement Manager] Watch session started at: ${new Date(now).toLocaleTimeString()} (Timestamp: ${now})`);
    }
  }, [watchSessionStart]);

  // Periodic watch time updater while session is active
  useEffect(() => {
    if (!watchSessionStart) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const sessionDuration = Math.floor((now - watchSessionStart) / 1000); // in seconds

      if (sessionDuration > 0) {
        setStats(prevStats => {
          const newWatchTime = (prevStats.watch_time || 0) + 1; // increment by 1 second
          const newStats = { ...prevStats, watch_time: newWatchTime };
          safeLocalStorageSet(STORAGE_KEYS.STATS, newStats);
          return newStats;
        });
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [watchSessionStart]);

  // End watch session and update total watch time
  const endWatchSession = useCallback(() => {
    if (watchSessionStart) { // Only end if a session was active
      const now = Date.now();
      const sessionDuration = Math.floor((now - watchSessionStart) / 1000); // in seconds
      console.log(`[Achievement Manager] Watch session ended at: ${new Date(now).toLocaleTimeString()} (Timestamp: ${now})`);
      console.log(`[Achievement Manager] Session duration: ${sessionDuration} seconds`);

      if (sessionDuration > 0) { // Only add if duration is positive
        // No need to add sessionDuration here because periodic updater already increments watch_time
        const newStats = {
          ...stats,
          sessions_played: (stats.sessions_played || 0) + 1
        };
        saveStats(newStats);
        console.log(`[Achievement Manager] Total watch time finalized at: ${stats.watch_time} seconds`);
      } else {
        console.log("[Achievement Manager] Session duration was 0 or less, not updating watch time.");
      }
      
      setWatchSessionStart(null);
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.WATCH_SESSION);
        }
      } catch (error) {
        console.warn('Error removing watch session from localStorage:', error);
      }
    } else {
      console.log("[Achievement Manager] endWatchSession called, but no active watch session found.");
    }
  }, [watchSessionStart, stats, saveStats]);

  // useEffect to run checkAchievements whenever stats change
  useEffect(() => {
    checkAchievements(stats);
  }, [stats, checkAchievements]);


  // Get achievement progress for display
  const getAchievementProgress = useCallback((achievementId) => {
    const achievement = ACHIEVEMENT_DEFINITIONS.find(a => a.id === achievementId);
    if (!achievement) return { progress: 0, isUnlocked: false, currentValue: 0, targetValue: 0 };

    const isUnlocked = unlockedAchievements.has(achievementId);
    let currentValue = 0;

    switch (achievement.type) {
      case 'discord_connection':
        currentValue = stats.discord_connections;
        break;
      case 'videos_added':
        currentValue = stats.videos_added;
        break;
      case 'messages_sent':
        currentValue = stats.messages_sent;
        break;
      case 'watch_time':
        currentValue = stats.watch_time;
        break;
      case 'max_queue_size':
        currentValue = stats.max_queue_size;
        break;
      default:
        break;
    }

    const progress = Math.min((currentValue / achievement.target) * 100, 100);

    return {
      progress,
      isUnlocked,
      currentValue,
      targetValue: achievement.target
    };
  }, [stats, unlockedAchievements]);

  // Get all achievements with their current status
  const getAllAchievements = useCallback(() => {
    return ACHIEVEMENT_DEFINITIONS.map(achievement => ({
      ...achievement,
      unlocked: unlockedAchievements.has(achievement.id),
      // Adding `currentValue` and `targetValue` directly here for easier access in App.js if needed
      currentValue: getAchievementProgress(achievement.id).currentValue,
      targetValue: getAchievementProgress(achievement.id).targetValue
    }));
  }, [unlockedAchievements, getAchievementProgress]);

  // Format time for display (improved to show seconds for less than a minute)
  const formatWatchTime = useCallback((seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '0s'; // Handle invalid or non-numeric input gracefully
    }

    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    if (remainingMinutes > 0) {
      return `${remainingMinutes}m`;
    }
    // If less than a minute, show in seconds
    return `${remainingSeconds}s`;
  }, []);

  return {
    // Stats
    stats,
    
    // Achievement functions
    trackDiscordConnection,
    trackVideoAdded,
    trackMessageSent,
    trackQueueSize,
    startWatchSession,
    endWatchSession,
    
    // Achievement data
    getAllAchievements,
    getAchievementProgress,
    unlockedCount: unlockedAchievements.size,
    totalCount: ACHIEVEMENT_DEFINITIONS.length,
    
    // Utility functions
    formatWatchTime,
    
    // Raw data for debugging
    unlockedAchievements: [...unlockedAchievements]
  };
};