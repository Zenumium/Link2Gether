import { useEffect, useRef, useState, useCallback } from 'react';
import ChatRoom from '../components/ChatRoom.js';
import { useAchievements } from '../components/achievementManager.js';
import { DISCORD_CONFIG, STORAGE_KEYS, UI_CONFIG, YOUTUBE_CONFIG } from '../utils/constants.js';
import { isValidYoutubeUrl, getYoutubeVideoId, sanitizeString, safeLocalStorageGet, safeLocalStorageSet, validateNumber, isValidYoutubeOrigin, generateRandomUsername } from '../utils/validation.js';

export default function App() { // Renamed from Home to App as is common for main React components
  // --- Refs for DOM elements and inter-component communication ---
  const youtubeRef = useRef(null); // Ref for the YouTube iframe
  const sendVideoStateRef = useRef(null); // Used to hold a function from ChatRoom to send video state
  const dropdownRef = useRef(null); // Ref for dropdown to handle outside clicks
  const watchSessionStartTimeRef = useRef(null); // To track when a video playback session starts for achievements

  // --- State Variables ---
  const [youtubeUrl, setYoutubeUrl] = useState(''); // The URL of the currently playing YouTube video
  const [youtubeInput, setYoutubeInput] = useState(''); // Input field for new YouTube URLs
  const [urlError, setUrlError] = useState(''); // Stores validation errors for YouTube URLs
  const [isYoutubePlaying, setIsYoutubePlaying] = useState(false); // Playback state of the YouTube video
  const [volume, setVolume] = useState(1); // Current volume level (0 to 1)

  // State for persistent username
  const [chatUsername, setChatUsername] = useState('');
  const [discordConnected, setDiscordConnected] = useState(false);

  // New state for Discord profile dropdown
  const [showDiscordDropdown, setShowDiscordDropdown] = useState(false);

  // New queue state and current index
  const [youtubeQueue, setYoutubeQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // State for YouTube History (now with actual search/sort functionality)
  const [youtubeHistory, setYoutubeHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('Date Added');

  // State to toggle ChatRoom visibility
  const [showChatRoom, setShowChatRoom] = useState(false);

  // --- Achievement Hook Integration ---
  const {
    stats,
    trackDiscordConnection,
    trackVideoAdded,
    trackMessageSent,
    trackQueueSize,
    startWatchSession,
    endWatchSession,
    getAllAchievements,
    unlockedCount,
    totalCount,
    formatWatchTime
  } = useAchievements();



  // Handle clicks outside of dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDiscordDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // useEffect to manage persistent username and Discord avatar
  useEffect(() => {
    const storedUsername = safeLocalStorageGet(STORAGE_KEYS.USERNAME, null);
    const storedAvatar = safeLocalStorageGet(STORAGE_KEYS.DISCORD_AVATAR, null);
    const storedUserId = safeLocalStorageGet(STORAGE_KEYS.DISCORD_USER_ID, null);

    if (!storedUsername) {
      const defaultUsername = generateRandomUsername();
      safeLocalStorageSet(STORAGE_KEYS.USERNAME, defaultUsername);
      setChatUsername(defaultUsername);
    } else {
      setChatUsername(storedUsername);
    }

    if (storedAvatar && storedUserId) {
      setDiscordConnected(true);
    }

    // Check for Discord username, avatar, and userId in URL query param and update state
    const urlParams = new URLSearchParams(window.location.search);
    const usernameFromUrl = urlParams.get('username');
    const avatarFromUrl = urlParams.get('avatar');
    const userIdFromUrl = urlParams.get('userId');

    let shouldCleanUrl = false;
    if (usernameFromUrl) {
      const sanitizedUsername = sanitizeString(usernameFromUrl);
      setChatUsername(sanitizedUsername);
      safeLocalStorageSet(STORAGE_KEYS.USERNAME, sanitizedUsername);
      shouldCleanUrl = true;
    }
    if (avatarFromUrl) {
      const sanitizedAvatar = sanitizeString(avatarFromUrl);
      safeLocalStorageSet(STORAGE_KEYS.DISCORD_AVATAR, sanitizedAvatar);
      console.log('Stored Discord avatar:', sanitizedAvatar);
      shouldCleanUrl = true;
    }
    if (userIdFromUrl) {
      const sanitizedUserId = sanitizeString(userIdFromUrl);
      safeLocalStorageSet(STORAGE_KEYS.DISCORD_USER_ID, sanitizedUserId);
      shouldCleanUrl = true;
    }
    if (usernameFromUrl && avatarFromUrl && userIdFromUrl) {
      setDiscordConnected(true);
      // Track Discord connection upon successful authentication/re-auth from URL params
      trackDiscordConnection();
    }

    // Remove query params from URL without causing a full page reload
    if (shouldCleanUrl) {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    }
  }, [trackDiscordConnection]); // Dependency on trackDiscordConnection for achievement tracking

  // Load saved volume from localStorage
  useEffect(() => {
    const savedVolume = safeLocalStorageGet(STORAGE_KEYS.VOLUME, 1, (value) => {
      return typeof value === 'number' && value >= 0 && value <= 1;
    });
    setVolume(savedVolume);
  }, []);

  // Play video from queue at currentIndex
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < youtubeQueue.length) {
      const url = youtubeQueue[currentIndex];
      setYoutubeUrl(url);
      setIsYoutubePlaying(true);
    } else if (youtubeQueue.length === 0) { // If queue becomes empty, stop playing
      setYoutubeUrl('');
      setIsYoutubePlaying(false);
    }
  }, [currentIndex, youtubeQueue]);

  // Add youtubeUrl to history when it changes and is a valid YouTube URL
  useEffect(() => {
    if (youtubeUrl) {
      const videoId = getYoutubeVideoId(youtubeUrl);
      if (videoId) {
        setYoutubeHistory(prev => {
          // Check if item already exists in history to avoid duplicates
          if (prev.some(item => item.src === youtubeUrl)) {
            return prev;
          }
          return [
            ...prev,
            {
              name: `YouTube - ${videoId}`, // Or fetch video title if possible
              src: youtubeUrl,
              type: 'youtube',
              timestamp: new Date().toLocaleString()
            }
          ];
        });
      }
    }
  }, [youtubeUrl]);

  // Handle end of YouTube video to play next in queue (YT Player API listener)
  useEffect(() => {
    const handleMessage = (event) => {
      // Only process messages from the YouTube player API and if it's a string
      if (!isValidYoutubeOrigin(event.origin) || typeof event.data !== 'string') {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        if (data.event === 'onStateChange' && data.info === 0) { // info 0 means ended
          if (currentIndex + 1 < youtubeQueue.length) {
            setCurrentIndex(currentIndex + 1);
          } else {
            setIsYoutubePlaying(false); // Stop playing if no more videos in queue
          }
        }
      } catch (error) {
        // console.warn("Could not parse YouTube player message as JSON:", event.data);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentIndex, youtubeQueue]);


  // YouTube Player Control and Volume Sync
  useEffect(() => {
    if (!youtubeRef.current || !youtubeUrl) return;

    const player = youtubeRef.current.contentWindow;

    // A small delay might be needed for the iframe to be ready, or listen for 'onReady' event
    // For now, let's assume it's ready after mounting.
    const postCommand = (func, args = []) => {
      player.postMessage(
        JSON.stringify({
          event: 'command',
          func: func,
          args: args
        }),
        '*'
      );
    };

    // Set volume whenever it changes or a new video loads
    const volumePercent = Math.round(volume * 100);
    postCommand('setVolume', [volumePercent]);


    // Control playback based on isYoutubePlaying state
    if (isYoutubePlaying) {
      postCommand('playVideo');
    } else {
      postCommand('pauseVideo');
    }
  }, [youtubeUrl, isYoutubePlaying, volume]);

  // --- Track video playback sessions for achievements ---
  useEffect(() => {
    if (isYoutubePlaying && youtubeUrl && !watchSessionStartTimeRef.current) {
      // Start a new session if video starts playing and no session is active
      watchSessionStartTimeRef.current = Date.now();
      startWatchSession();
    } else if (!isYoutubePlaying && watchSessionStartTimeRef.current) {
      // End the session if video pauses/stops and a session was active
      // IMPORTANT: endWatchSession in achievementManager.js does NOT take a duration argument.
      // It calculates duration internally from its own managed watchSessionStart.
      endWatchSession(); // Call without arguments
      watchSessionStartTimeRef.current = null;
    }
    // Cleanup function: If component unmounts or youtubeUrl changes while playing, end current session
    return () => {
      if (watchSessionStartTimeRef.current) {
        // Same as above, call without arguments
        endWatchSession();
        watchSessionStartTimeRef.current = null;
      }
    };
  }, [isYoutubePlaying, youtubeUrl, startWatchSession, endWatchSession]);


  // --- Enhanced addToQueue function (from modifications) ---
  const addToQueue = useCallback((url) => {
    if (!url) return;
    const sanitizedUrl = sanitizeString(url);
    if (!isValidYoutubeUrl(sanitizedUrl)) {
      setUrlError('Please enter a valid YouTube URL.');
      return;
    }
    setUrlError('');
    setYoutubeQueue(prev => {
      const newQueue = [...prev, sanitizedUrl];
      // Track the video addition for achievements
      trackVideoAdded();
      // Track queue size for achievements
      trackQueueSize(newQueue.length);

      if (prev.length === 0 && newQueue.length > 0) {
        setCurrentIndex(0);
        setIsYoutubePlaying(true);
      }
      return newQueue;
    });
    setYoutubeInput('');
  }, [trackVideoAdded, trackQueueSize]); // Added trackVideoAdded and trackQueueSize to dependencies


  const handleAddToQueue = useCallback(() => {
    addToQueue(youtubeInput);
  }, [youtubeInput, addToQueue]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddToQueue();
    }
  }, [handleAddToQueue]);

  const handlePlay = useCallback(() => {
    if (youtubeInput) { // If there's input, add it to queue first
      addToQueue(youtubeInput);
    } else if (currentIndex === -1 && youtubeQueue.length > 0) {
      // If no input and nothing is playing, but queue has items, start from first
      setCurrentIndex(0);
      setIsYoutubePlaying(true);
    } else if (currentIndex >= 0 && currentIndex < youtubeQueue.length && youtubeRef.current) {
      // Otherwise, play the current video if it's paused
      youtubeRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      setIsYoutubePlaying(true);
    }
  }, [youtubeInput, addToQueue, currentIndex, youtubeQueue]);

  const handlePause = useCallback(() => {
    if (youtubeRef.current) {
      youtubeRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      setIsYoutubePlaying(false);
    }
  }, []);

  const handleStop = useCallback(() => {
    if (youtubeRef.current) {
      youtubeRef.current.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
      setIsYoutubePlaying(false);
      // Optionally reset current index or clear queue on stop
      // setCurrentIndex(-1);
      // setYoutubeQueue([]);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 < youtubeQueue.length) {
      setCurrentIndex(prevIndex => prevIndex + 1);
      setIsYoutubePlaying(true);
    } else {
      setIsYoutubePlaying(false); // Stop if no next video
      // Optionally loop or indicate end of queue
    }
  }, [currentIndex, youtubeQueue.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prevIndex => prevIndex - 1);
      setIsYoutubePlaying(true);
    }
  }, [currentIndex]);

  const playFromHistory = useCallback((item) => {
    if (item && item.src) {
      const indexInQueue = youtubeQueue.indexOf(item.src);
      if (indexInQueue !== -1) {
        setCurrentIndex(indexInQueue);
      } else {
        // Add the item to the end of the queue and then set current index to it
        setYoutubeQueue(prev => {
          const newQueue = [...prev, item.src];
          setCurrentIndex(newQueue.length - 1); // Set index to the newly added item
          return newQueue;
        });
      }
      setIsYoutubePlaying(true);
    }
  }, [youtubeQueue]);


  const handleVolumeChange = useCallback((e) => {
    const newVolume = validateNumber(e.target.value, 0, 1);
    setVolume(newVolume);
    safeLocalStorageSet(STORAGE_KEYS.VOLUME, newVolume);
  }, []);

  // Effect to send video state to ChatRoom whenever it changes locally
  useEffect(() => {
    if (sendVideoStateRef.current) {
      sendVideoStateRef.current({
        youtubeUrl,
        isYoutubePlaying,
        currentIndex,
        youtubeQueue,
        volume // Including volume for potential sync
      });
    }
  }, [youtubeUrl, isYoutubePlaying, currentIndex, youtubeQueue, volume]);

  // --- Enhanced Discord connection handler (from modifications) ---
  const handleDiscordConnect = useCallback(() => {
    const oauthUrl = `${DISCORD_CONFIG.OAUTH_URL}?client_id=${DISCORD_CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_CONFIG.REDIRECT_URI)}&response_type=code&scope=${DISCORD_CONFIG.SCOPE}`;

    // Track Discord connection attempt
    trackDiscordConnection();

    window.location.href = oauthUrl;
  }, [trackDiscordConnection]); // Added trackDiscordConnection to dependencies


  const filteredHistory = youtubeHistory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedHistory = filteredHistory.sort((a, b) => {
    // Sorting by name for "Difficulty" (as no actual difficulty field exists)
    if (sortBy === 'Difficulty') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'Date Added') {
      return new Date(b.timestamp) - new Date(a.timestamp);
    }
    return 0;
  });

  // Get all achievements from the hook
  const allAchievements = getAllAchievements();


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 bg-black bg-opacity-50 backdrop-blur-md border-b border-pink-600 shadow-lg overflow-visible relative z-10">
        <div className="flex space-x-4">
          <button
            onClick={() => setShowChatRoom(prev => !prev)}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-4 py-2 rounded-md shadow-pink-400/70 shadow-lg transition duration-300"
            aria-label="Toggle Chatroom visibility"
          >
            {showChatRoom ? 'Hide Chatroom' : 'Show Chatroom'}
          </button>
          {!discordConnected ? (
            <button
              onClick={handleDiscordConnect} // Use the new useCallback for Discord connect
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-md shadow-blue-400/70 shadow-lg transition duration-300"
              aria-label="Connect with Discord"
            >
              Connect with Discord
            </button>
          ) : (
            <button
              onClick={() => {
                setDiscordConnected(false);
                const defaultUsername = generateRandomUsername();
                setChatUsername(defaultUsername);
                safeLocalStorageSet(STORAGE_KEYS.USERNAME, defaultUsername);
                safeLocalStorageSet(STORAGE_KEYS.DISCORD_USER_ID, null);
                safeLocalStorageSet(STORAGE_KEYS.DISCORD_AVATAR, null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-md shadow-red-400/70 shadow-lg transition duration-300"
              aria-label="Disconnect Discord"
            >
              Disconnect Discord
            </button>
          )}
        </div>

        {/* Discord Profile with Dropdown */}
        {discordConnected && safeLocalStorageGet(STORAGE_KEYS.DISCORD_AVATAR) && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDiscordDropdown(!showDiscordDropdown)}
              className="flex items-center space-x-2 hover:bg-pink-600 hover:bg-opacity-20 rounded-lg p-2 transition duration-300"
              aria-label="Discord profile menu"
            >
              <img
                src={`https://cdn.discordapp.com/avatars/${safeLocalStorageGet(STORAGE_KEYS.DISCORD_USER_ID)}/${safeLocalStorageGet(STORAGE_KEYS.DISCORD_AVATAR)}.png`}
                alt="Discord Profile"
                className="w-10 h-10 rounded-full border-2 border-pink-600"
                onError={(e) => {
                  e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; // Default Discord avatar
                }}
              />
              <span className="text-white font-semibold">{chatUsername}</span>
              <svg
                className={`w-4 h-4 text-white transition-transform duration-200 ${showDiscordDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDiscordDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-black bg-opacity-90 backdrop-blur-md rounded-lg shadow-2xl border border-pink-500 z-[90]">
                <div className="p-4 z-80">
                  <h3 className="text-pink-300 text-lg font-bold mb-3 text-center drop-shadow-[0_0_5px_rgba(255,105,180,0.7)]">
                    🏆 Achievements
                  </h3>
                  {/* Display total watch time from achievements hook */}
                  <p className="text-pink-200 text-sm text-center mb-4">
                    {/* CORRECTED: Use stats.watch_time as per achievementManager.js */}
                    Total Watch Time: <span className="font-bold">{formatWatchTime(stats.watch_time)}</span>
                  </p>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {/* Use allAchievements from the hook */}
                    {allAchievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg transition duration-300 ${
                          achievement.unlocked
                            ? 'bg-pink-600 bg-opacity-30 border border-pink-500'
                            : 'bg-gray-700 bg-opacity-50 border border-gray-600 opacity-60'
                        }`}
                      >
                        <div className="text-2xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <h4 className={`font-semibold ${achievement.unlocked ? 'text-white' : 'text-gray-400'}`}>
                            {achievement.name}
                          </h4>
                          <p className={`text-sm ${achievement.unlocked ? 'text-pink-200' : 'text-gray-500'}`}>
                            {achievement.description}
                            {/* Optionally show progress for non-unlocked achievements */}
                            {!achievement.unlocked && achievement.targetValue > 0 && (
                                <span className="ml-2 text-pink-300">
                                    ({achievement.currentValue}/{achievement.targetValue})
                                </span>
                            )}
                          </p>
                        </div>
                        {achievement.unlocked && (
                          <div className="text-green-400 text-xl">✓</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-pink-500">
                    <div className="text-center text-pink-300 text-sm">
                      {/* Use unlockedCount and totalCount from the hook */}
                      <span className="font-semibold">
                        {unlockedCount} / {totalCount}
                      </span>
                      <span className="ml-1">achievements unlocked</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex flex-1 px-6 py-4 space-x-6">
        <section className={`flex-1 bg-black bg-opacity-40 backdrop-blur-md rounded-3xl shadow-2xl p-6 flex flex-col transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${showChatRoom ? 'mr-6' : 'mr-0'}`}>
          <h1 className="text-center text-pink-400 text-4xl font-extrabold mb-6 drop-shadow-[0_0_10px_rgba(255,105,180,0.7)]">Link2Gether</h1>
          <div className="mb-6 flex flex-col space-y-4">
            <label htmlFor="youtube-url" className="text-pink-300 text-lg font-semibold drop-shadow-[0_0_5px_rgba(255,105,180,0.7)]">YouTube URL:</label>
            {urlError && (
              <p className="mb-2 text-red-500 text-sm font-semibold">{urlError}</p>
            )}
            <div className="flex items-center rounded-lg overflow-hidden shadow-lg bg-gradient-to-r from-pink-600 to-purple-700 bg-opacity-30 border border-pink-500 backdrop-blur-md">
              <input
                id="youtube-url"
                type="text"
                value={youtubeInput}
                onChange={(e) => {
                  setYoutubeInput(e.target.value);
                  if (urlError) setUrlError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter YouTube video URL"
                className="px-4 py-3 bg-transparent text-white placeholder-pink-300 focus:outline-none flex-grow drop-shadow-[0_0_5px_rgba(255,105,180,0.7)]"
                aria-label="YouTube video URL input"
              />
              <button
                onClick={handleAddToQueue}
                className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 font-bold transition duration-300 shadow-pink-400/70 shadow-lg"
              >
                Add to Queue
              </button>
            </div>
          </div>
          {(youtubeUrl && getYoutubeVideoId(youtubeUrl)) ? ( // Only render iframe if youtubeUrl is valid
            <iframe
              ref={youtubeRef}
              width="100%"
              height="350"
              // Correct YouTube embed URL: use www.youtube.com/embed/VID_ID
              // Ensure the origin allows for postMessage communication, iframes from youtube.com usually do.
              src={`https://www.youtube.com/embed/${getYoutubeVideoId(youtubeUrl)}?enablejsapi=1&version=3&autoplay=1&mute=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video player"
              className="mb-4 rounded-3xl shadow-2xl border-4 border-pink-600"
            />
          ) : (
            <div className="flex items-center justify-center h-80 bg-gray-900 rounded-3xl shadow-2xl border-4 border-pink-600 text-pink-300 text-xl font-semibold">
              Enter a YouTube URL to start watching!
            </div>
          )}
          <div className="flex flex-wrap items-center space-x-4 space-y-0 justify-center mb-8">
            <button
              onClick={handlePrevious}
              disabled={currentIndex <= 0}
              className="h-12 px-6 bg-pink-600 rounded-full text-white font-extrabold text-lg hover:bg-pink-700 transition duration-300 shadow-pink-400/70 shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous video"
            >
              Previous ⏮️
            </button>
            <button
              onClick={handlePlay}
              disabled={isYoutubePlaying || youtubeQueue.length === 0} // Disable if already playing or no items in queue
              className="h-12 px-6 bg-pink-600 rounded-full text-white font-extrabold text-lg hover:bg-pink-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-pink-400/70 shadow-lg flex items-center justify-center"
              aria-label="Play YouTube video"
            >
              Play ▶
            </button>
            <button
              onClick={handlePause}
              disabled={!isYoutubePlaying} // Disable if not playing
              className="h-12 px-6 bg-purple-600 rounded-full text-white font-extrabold text-lg hover:bg-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-purple-400/70 shadow-lg flex items-center justify-center"
              aria-label="Pause YouTube video"
            >
              Pause ▐▐
            </button>
            <button
              onClick={handleStop}
              disabled={!isYoutubePlaying && currentIndex === -1} // Disable if not playing and no item selected
              className="h-12 px-6 bg-pink-600 rounded-full text-white font-extrabold text-lg hover:bg-pink-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-pink-400/70 shadow-lg flex items-center justify-center"
              aria-label="Stop YouTube video"
            >
              Stop ◼
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= youtubeQueue.length - 1} // Disable if at the end of the queue
              className="h-12 px-6 bg-pink-600 rounded-full text-white font-extrabold text-lg hover:bg-pink-700 transition duration-300 shadow-pink-400/70 shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next video"
            >
              Next ⏭️
            </button>
          </div>
          <div className="w-full max-w-md flex flex-col items-center mb-6 mx-auto">
            <label htmlFor="volume-control" className="text-pink-300 mb-3 font-semibold text-lg drop-shadow-[0_0_5px_rgba(255,105,180,0.7)]">Volume: {Math.round(volume * 100)}%</label>
            <input
              id="volume-control"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full rounded-full accent-pink-500 cursor-pointer"
              aria-label="Volume control slider"
            />
          </div>
        </section>

        {/* Right Panel - YouTube History */}
        <aside className="w-96 bg-black bg-opacity-40 backdrop-blur-md rounded-3xl shadow-2xl p-6 max-h-[calc(100vh-96px)] overflow-y-auto border border-pink-500 flex flex-col">
          <h2 className="text-pink-300 text-2xl mb-4 font-bold tracking-wide text-center drop-shadow-[0_0_5px_rgba(255,105,180,0.7)]">YouTube History</h2>
          <div className="text-pink-400 text-center font-semibold mb-4">
            Next in Queue: {currentIndex + 1 < youtubeQueue.length ? getYoutubeVideoId(youtubeQueue[currentIndex + 1]) : 'No next video'}
          </div>
          <div className="flex justify-between items-center mb-4 space-x-2">
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow px-3 py-2 bg-pink-900 bg-opacity-50 rounded-md text-white placeholder-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
              aria-label="Search YouTube history"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-pink-900 bg-opacity-50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer"
              aria-label="Sort history by"
            >
              <option value="Date Added">Date Added</option>
              <option value="Difficulty">Name (A-Z)</option> {/* Renamed for clarity */}
            </select>
          </div>
          {sortedHistory.length === 0 ? (
            <p className="text-pink-400 text-center">No YouTube history found.</p>
          ) : (
            <ul className="divide-y divide-pink-600 flex-1 overflow-y-auto">
              {sortedHistory.map((item, index) => (
                <li key={index} className="py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0"> {/* Added min-w-0 to allow truncation */}
                    <p className="text-white font-semibold truncate drop-shadow-[0_0_5px_rgba(255,105,180,0.7)]">{item.name}</p>
                    <p className="text-pink-400 text-sm">{item.timestamp}</p>
                    {/* <p className="text-pink-500 text-xs">{item.type}</p> */} {/* Type is always youtube, so optional */}
                  </div>
                  <button
                    onClick={() => playFromHistory(item)}
                    className="ml-5 bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full transition duration-300 text-sm font-semibold shadow-pink-400/70 shadow-lg"
                  >
                    Play
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Chatroom section */}
        {chatUsername && (
          <section
            className={`bg-black bg-opacity-40 backdrop-blur-md rounded-3xl shadow-2xl p-6 max-h-[calc(100vh-96px)] overflow-y-auto border border-pink-500 flex flex-col ml-6 transition-[width,opacity] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              showChatRoom ? 'w-96 opacity-100 pointer-events-auto' : 'w-0 opacity-0 pointer-events-none'
            }`}
            style={{ willChange: 'width, opacity' }}
          >
          <ChatRoom
            username={chatUsername}
            videoState={{
              youtubeUrl,
              isYoutubePlaying,
              currentIndex,
              youtubeQueue
            }}
            watchTime={stats.watch_time}
            onVideoStateChange={({ videoUrl, playbackState, queue, index }) => {
              if (queue && Array.isArray(queue) && queue.length > 0) {
                setYoutubeQueue(queue);
              }
              // Only update currentIndex if it's a valid number and different
              if (typeof index === 'number' && index >= 0 && index !== currentIndex) {
                setCurrentIndex(index);
              }
              // Only update youtubeUrl if it's different and provided
              if (videoUrl && videoUrl !== youtubeUrl) {
                setYoutubeUrl(videoUrl);
              }
              // Set playback state
              if (playbackState === 'play') {
                setIsYoutubePlaying(true);
              } else if (playbackState === 'pause' || playbackState === 'stop') {
                setIsYoutubePlaying(false);
              }
            }}
            onSendVideoState={(sendVideoState) => {
              sendVideoStateRef.current = sendVideoState;
            }}
            // Assuming ChatRoom will provide an onMessageSent prop
            onMessageSent={trackMessageSent}
          />
          </section>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="flex items-center justify-center px-6 py-3 bg-black bg-opacity-50 backdrop-blur-md border-t border-pink-600 shadow-lg">
        <p className="text-sm text-white text-center">
          © {new Date().getFullYear()} <span className="font-bold">Projeckt Aqua</span>. All rights reserved.
        </p>
      </nav>
    </div>
  );
}