document.addEventListener('DOMContentLoaded', function() {
    
    // Global error handler for unhandled errors
    window.addEventListener('error', function(event) {
        console.error('Global error caught:', event.error);
        ErrorTracker.track(event.error, { 
            type: 'global_error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
        showError('An unexpected error occurred. Please refresh the page and try again.');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        ErrorTracker.track(new Error(event.reason), { 
            type: 'unhandled_rejection',
            reason: event.reason
        });
        showError('A network or processing error occurred. Please try again.');
        event.preventDefault(); // Prevent the default browser error
    });

    // Error tracking system
    const ErrorTracker = {
        errors: [],
        maxErrors: 50, // Prevent memory leaks
        
        track(error, context = {}) {
            const errorInfo = {
                timestamp: new Date().toISOString(),
                message: error.message || 'Unknown error',
                stack: error.stack,
                name: error.name,
                context: {
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    ...context
                }
            };
            
            this.errors.push(errorInfo);
            
            // Keep only the last maxErrors
            if (this.errors.length > this.maxErrors) {
                this.errors.shift();
            }
            
            // Log to console in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.group('🚨 Error Tracked');
                console.error('Message:', errorInfo.message);
                console.error('Context:', errorInfo.context);
                console.error('Stack:', errorInfo.stack);
                console.groupEnd();
            }
            
            // Store in localStorage for persistence
            this.persistErrors();
        },
        
        persistErrors() {
            try {
                localStorage.setItem('parasocial_errors', JSON.stringify(this.errors));
            } catch (e) {
                console.warn('Could not persist errors to localStorage:', e);
            }
        },
        
        getErrors() {
            return this.errors;
        },
        
        clearErrors() {
            this.errors = [];
            try {
                localStorage.removeItem('parasocial_errors');
            } catch (e) {
                console.warn('Could not clear errors from localStorage:', e);
            }
        },
        
        getErrorSummary() {
            const summary = {
                total: this.errors.length,
                byType: {},
                recent: this.errors.slice(-10) // Last 10 errors
            };
            
            this.errors.forEach(error => {
                const type = error.name || 'Unknown';
                summary.byType[type] = (summary.byType[type] || 0) + 1;
            });
            
            return summary;
        }
    };
    
    // Debug DOM elements
    const loadButton = document.querySelector('.green-btn');
    const clearButton = document.querySelector('.clear-btn');
    const videoInput = document.querySelector('.video-input');
    
    // Validate required DOM elements
    const requiredElements = {
        loadButton,
        clearButton,
        videoInput,
        currentHashElement: document.getElementById('current-hash'),
        currentStatusElement: document.getElementById('current-status'),
        statusValueElement: document.querySelector('.status-value'),
        videoTitleElement: document.querySelector('.video-title'),
        videoDateElement: document.querySelector('.video-info h3'),
        videoSummaryElement: document.querySelector('.summary'),
        tagsContainerElement: document.querySelector('.tags-container')
    };

    // Check for missing elements and log warnings
    const missingElements = Object.entries(requiredElements)
        .filter(([name, element]) => !element)
        .map(([name]) => name);

    if (missingElements.length > 0) {
        const error = new Error(`Missing required DOM elements: ${missingElements.join(', ')}`);
        ErrorTracker.track(error, { 
            type: 'dom_validation',
            missingElements: missingElements
        });
        console.error('Missing required DOM elements:', missingElements);
        showError('Page layout is incomplete. Please refresh the page.');
        return; // Exit early if critical elements are missing
    }
    
    // Cache frequently used DOM elements
    const currentHashElement = requiredElements.currentHashElement;
    const currentStatusElement = requiredElements.currentStatusElement;
    const statusValueElement = requiredElements.statusValueElement;
    const videoTitleElement = requiredElements.videoTitleElement;
    const videoDateElement = requiredElements.videoDateElement;
    const videoSummaryElement = requiredElements.videoSummaryElement;
    const tagsContainerElement = requiredElements.tagsContainerElement;

    // Reusable function to update status
    function updateStatus(status, isSuccess = true) {
        try {
            if (currentStatusElement && statusValueElement) {
                currentStatusElement.textContent = status;
                statusValueElement.className = `status-value ${isSuccess ? 'success' : 'error'}`;
            } else {
                console.warn('Status elements not found');
                ErrorTracker.track(new Error('Status elements not found'), { 
                    type: 'missing_status_elements',
                    hasCurrentStatus: !!currentStatusElement,
                    hasStatusValue: !!statusValueElement
                });
            }
        } catch (error) {
            console.error('Error updating status:', error);
            ErrorTracker.track(error, { type: 'status_update_error' });
        }
    }

    // Reusable function to reset video info to default state
    function resetVideoInfo() {
        try {
            if (videoTitleElement) videoTitleElement.textContent = 'Video Title';
            if (videoDateElement) videoDateElement.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            if (videoSummaryElement) videoSummaryElement.textContent = '- This vod has no summary -';
            if (tagsContainerElement) tagsContainerElement.innerHTML = '';
        } catch (error) {
            console.error('Error resetting video info:', error);
            ErrorTracker.track(error, { type: 'reset_video_info_error' });
        }
    }

    // Function to format summary text for better readability
    function formatSummaryText(summaryText) {
        try {
            if (!summaryText) return '- This vod has no summary -';
            
            // Validate input type
            if (typeof summaryText !== 'string') {
                console.warn('Summary text is not a string:', typeof summaryText);
                return '- This vod has no summary -';
            }
            
            // Split by common paragraph separators and format
            return summaryText
                .split(/\n+/)
                .map(paragraph => paragraph.trim())
                .filter(paragraph => paragraph.length > 0)
                .join('\n\n');
        } catch (error) {
            console.error('Error formatting summary text:', error);
            ErrorTracker.track(error, { 
                type: 'summary_format_error',
                summaryType: typeof summaryText,
                summaryLength: summaryText ? summaryText.length : 0
            });
            return '- This vod has no summary -';
        }
    }

    // Add loading state management
    function setLoadingState(isLoading) {
        const loadButton = document.querySelector('.green-btn');
        const videoInput = document.querySelector('.video-input');
        
        if (loadButton) {
            loadButton.disabled = isLoading;
            loadButton.textContent = isLoading ? 'Loading' : 'Load';
            loadButton.style.opacity = isLoading ? '0.6' : '1';
            loadButton.style.cursor = isLoading ? 'not-allowed' : 'pointer';
        }
        
        if (videoInput) {
            videoInput.disabled = isLoading;
            videoInput.style.opacity = isLoading ? '0.6' : '1';
            videoInput.style.cursor = isLoading ? 'not-allowed' : 'text';
        }
    }

// ----------------------------------------------------------------------------------------------------------------------
// Hashing creates a unique, fixed-length string from any input data (in this case, a video URL)
// We use SHA-256 hashing to generate consistent database keys for our video data
// This ensures reliable lookups even if URLs contain special characters or vary slightly

    async function computeVideoHash(videoUrl) {
        try {
            // Validate input
            if (!videoUrl || typeof videoUrl !== 'string') {
                throw new Error('Invalid video URL provided');
            }

            // Check if crypto API is available
            if (!crypto || !crypto.subtle) {
                throw new Error('Web Crypto API is not available in this browser');
            }

            // SHA-256 hash creates consistent database keys from video URLs
            // TextEncoder preserves URL encoding exactly (crucial for Twitch URLs)
            // Returns 64-character hex string for reliable Supabase lookups
            const encoder = new TextEncoder();
            
            // Encode the URL string to UTF-8 bytes, preserving all URL encodings like %20
            // This is crucial because Twitch URLs have special characters that need to be preserved exactly
            // If we just used the raw string, different URL formats would create different hashes
            const data = encoder.encode(videoUrl);
            
            // Use the Web Crypto API to generate a SHA-256 hash of the URL bytes
            // SHA-256 creates a consistent 256-bit (32-byte) hash regardless of input length
            // This gives us a reliable, fixed-length key for database lookups
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            
            // Convert the hash buffer to a regular array of numbers (0-255)
            // The hashBuffer is an ArrayBuffer, so we need to convert it to work with it
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            
            // Convert each byte to a 2-digit hexadecimal string and join them together
            // padStart(2, '0') ensures each byte becomes exactly 2 hex digits (e.g., '0A' not 'A')
            // This creates a 64-character hex string that serves as our database key
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Validate the hash output
            if (!hashHex || hashHex.length !== 64) {
                throw new Error('Hash computation failed - invalid output');
            }
            
            // Return the final hash string that will be used as the key in Supabase queries
            // This hash is consistent for the same URL and different for different URLs
            return hashHex;

        } catch (error) {
            console.error('Error computing video hash:', error);
            
            // Track the error with context
            ErrorTracker.track(error, {
                type: 'hash_computation',
                videoUrl: videoUrl ? videoUrl.substring(0, 100) : 'undefined', // Truncate for privacy
                cryptoAvailable: !!crypto,
                cryptoSubtleAvailable: !!(crypto && crypto.subtle)
            });
            
            if (error.name === 'NotSupportedError') {
                throw new Error('Hash computation not supported in this browser. Please use a modern browser.');
            } else if (error.name === 'QuotaExceededError') {
                throw new Error('Browser quota exceeded. Please try again later.');
            } else {
                throw new Error(`Hash computation failed: ${error.message}`);
            }
        }
    }

// ----------------------------------------------------------------------------------------------------------------------

    async function getWubbySummary(videoUrl) {
        // Supabase configuration
        const SUPABASE_URL = "https://sbvaclmypokafpxebusn.supabase.co";
        // This key is safe to use in the frontend since we have enabled read-only Row Level Security (RLS) on our tables
        const SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmFjbG15cG9rYWZweGVidXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NDI3MTUsImV4cCI6MjA2MzExODcxNX0.7yr-OxNKpoeMstxyOG79ms4F_7eSADLBSROBgwtqTSE"; // Public anon key

        // Validate API configuration
        if (!SUPABASE_URL || !SUPABASE_API_KEY) {
            throw new Error('API configuration is missing. Please check your Supabase setup.');
        }

        try {
            // Generate hash and construct query URL
            const videoHash = await computeVideoHash(videoUrl);
            const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=eq.${videoHash}`;

            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(queryUrl, {
                method: "GET",
                headers: {
                    "apikey": SUPABASE_API_KEY,
                    "Authorization": `Bearer ${SUPABASE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Handle different HTTP status codes
            if (response.ok) {
                updateStatus(`${response.status} - Success`, true);
            } else {
                let errorMessage = `Request failed: ${response.status}`;
                
                switch (response.status) {
                    case 400:
                        errorMessage = 'Bad request - Invalid query parameters';
                        break;
                    case 401:
                        errorMessage = 'Authentication failed - Check API key';
                        break;
                    case 403:
                        errorMessage = 'Access denied - Insufficient permissions';
                        break;
                    case 404:
                        errorMessage = 'Video not found in database';
                        break;
                    case 429:
                        errorMessage = 'Too many requests - Please wait and try again';
                        break;
                    case 500:
                        errorMessage = 'Server error - Please try again later';
                        break;
                    case 502:
                    case 503:
                    case 504:
                        errorMessage = 'Service temporarily unavailable - Please try again later';
                        break;
                    default:
                        errorMessage = `Request failed: ${response.status} - ${response.statusText}`;
                }
                
                updateStatus(`${response.status} - Error`, false);
                showError(errorMessage);
                throw new Error(errorMessage);
            }

            const data = await response.json();

            if (data.length === 0) {
                console.log("No summary found for video - this is normal for videos without metadata.");
                updateStatus(`${response.status} - Success - No Metadata Available`, true);
                return null;
            }

            return data[0];

        } catch (error) {
            // Handle specific error types
            if (error.name === 'AbortError') {
                const timeoutError = 'Request timed out. Please check your connection and try again.';
                ErrorTracker.track(error, {
                    type: 'api_timeout',
                    videoUrl: videoUrl.substring(0, 100),
                    timeout: 10000
                });
                showError(timeoutError);
                throw new Error(timeoutError);
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                const networkError = 'Network error. Please check your internet connection.';
                ErrorTracker.track(error, {
                    type: 'network_error',
                    videoUrl: videoUrl.substring(0, 100),
                    errorMessage: error.message
                });
                showError(networkError);
                throw new Error(networkError);
            } else if (error.name === 'SyntaxError') {
                const parseError = 'Invalid response from server. Please try again.';
                ErrorTracker.track(error, {
                    type: 'json_parse_error',
                    videoUrl: videoUrl.substring(0, 100),
                    errorMessage: error.message
                });
                showError(parseError);
                throw new Error(parseError);
            } else {
                // Track other API errors
                ErrorTracker.track(error, {
                    type: 'api_error',
                    videoUrl: videoUrl.substring(0, 100),
                    errorName: error.name,
                    errorMessage: error.message
                });
                // Re-throw the original error if it's already formatted
                throw error;
            }
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------
    // Summary Display Logic
    // This function updates the video information display with data retrieved from Supabase
    // It handles cases where no data is found and formats the display appropriately. Some videos dont have all new fields
    
    function updateVideoInfo(summaryData) {
        if (!summaryData) {
            resetVideoInfo();
            return;
        }

        try {
            const { summary, tags, upload_date, platform, created_at, pleb_title } = summaryData;

            // Validate and set title
            const title = pleb_title || 'Video Title';
            videoTitleElement.textContent = title;
            videoTitleElement.setAttribute('aria-label', `Video title: ${title}`);
            
            // Update document title to use pleb_title
            document.title = title;

            // Validate and format summary
            videoSummaryElement.textContent = formatSummaryText(summary);

            // Validate and format date
            const dateValue = upload_date || created_at;
            if (dateValue) {
                try {
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) {
                        throw new Error('Invalid date format');
                    }
                    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
                    videoDateElement.textContent = date.toLocaleDateString('en-US', dateOptions);
                } catch (dateError) {
                    console.warn('Invalid date format:', dateValue);
                    videoDateElement.textContent = 'Date not available';
                }
            } else {
                videoDateElement.textContent = 'Date not available';
            }

            // Clear and rebuild tags container
            tagsContainerElement.innerHTML = '';
            
            // Add platform tag if available
            if (platform && typeof platform === 'string') {
                const platformTag = document.createElement('span');
                platformTag.className = 'tag';
                platformTag.textContent = platform;
                if (platform.toLowerCase() === 'kick') {
                    platformTag.classList.add('kick');
                } else if (platform.toLowerCase() === 'twitch') {
                    platformTag.classList.add('twitch');
                }
                tagsContainerElement.appendChild(platformTag);
            }

            // Add content tags if available
            if (tags && Array.isArray(tags) && tags.length > 0) {
                tags.forEach(tagText => {
                    if (tagText && typeof tagText === 'string' && tagText.trim()) {
                        const tag = document.createElement('span');
                        tag.className = 'tag';
                        tag.textContent = tagText.trim();
                        tagsContainerElement.appendChild(tag);
                    }
                });
            }

        } catch (error) {
            console.error('Error updating video info:', error);
            ErrorTracker.track(error, {
                type: 'video_info_update',
                summaryData: summaryData ? Object.keys(summaryData) : 'null',
                hasTitle: !!(summaryData && summaryData.pleb_title),
                hasSummary: !!(summaryData && summaryData.summary),
                hasTags: !!(summaryData && summaryData.tags && Array.isArray(summaryData.tags))
            });
            showError('Failed to display video information. Please try again.');
            resetVideoInfo();
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------
    // Orchestrates the entire process: hash computation, API call, and UI updates
    // Handles both successful data retrieval and error cases
    
    async function loadSelectedVideo() {
        const videoUrl = videoInput.value.trim();
        
        // Validate URL format
        if (!videoUrl) {
            currentHashElement.textContent = '-';
            updateStatus('No video URL entered.', false);
            showWarning('Please enter a video URL to load.');
            return;
        }

        // Basic URL validation
        try {
            new URL(videoUrl);
        } catch (error) {
            showError('Please enter a valid URL format.');
            updateStatus('Invalid URL format', false);
            return;
        }

        // Check if it's a wubby.tv URL
        if (!videoUrl.includes('archive.wubby.tv')) {
            showWarning('This tool is designed for archive.wubby.tv URLs. Other URLs may not work as expected.');
        }

        try {
            setLoadingState(true);
            updateStatus('Computing hash...', true);
            
            const hash = await computeVideoHash(videoUrl);
            currentHashElement.textContent = hash;
            
            updateStatus('Fetching video data...', true);
            const summary = await getWubbySummary(videoUrl);
            updateVideoInfo(summary);
            
            // Video will play automatically when ready
        } catch (err) {
            console.error('Error:', err);
            ErrorTracker.track(err, {
                type: 'video_load',
                videoUrl: videoUrl.substring(0, 100),
                urlValid: true,
                isWubbyUrl: videoUrl.includes('archive.wubby.tv')
            });
            showError(`Failed to load video: ${err.message}`);
            updateStatus('Error occurred', false);
        } finally {
            setLoadingState(false);
        }
    }

    // Don't auto-load on page load since there's no default value
    // loadSelectedVideo();

    if (loadButton) {
        loadButton.addEventListener('click', loadSelectedVideo);
        loadButton.setAttribute('aria-label', 'Load video data');
    } else {
        const error = new Error('Load button not found');
        ErrorTracker.track(error, { type: 'missing_element', element: 'loadButton' });
        console.error('Load button not found');
    }
    
    // Clear button functionality
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            try {
                if (videoInput) videoInput.value = '';
                if (currentHashElement) currentHashElement.textContent = '-';
                if (currentStatusElement) currentStatusElement.textContent = '-';
                if (statusValueElement) statusValueElement.className = 'status-value';
                resetVideoInfo();
                // Input field is now empty
            } catch (error) {
                console.error('Error clearing input:', error);
                ErrorTracker.track(error, { type: 'clear_input_error' });
                showError('Failed to clear input. Please refresh the page.');
            }
        });
        clearButton.setAttribute('aria-label', 'Clear video input and data');
    } else {
        const error = new Error('Clear button not found');
        ErrorTracker.track(error, { type: 'missing_element', element: 'clearButton' });
        console.error('Clear button not found');
    }

    // Expose error tracking for debugging (development only)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.debugErrors = function() {
            const summary = ErrorTracker.getErrorSummary();
            console.group('🐛 Error Tracking Debug');
            console.log('Total errors:', summary.total);
            console.log('Errors by type:', summary.byType);
            console.log('Recent errors:', summary.recent);
            console.groupEnd();
            return summary;
        };
        
        // Log error summary on page load in development
        setTimeout(() => {
            const summary = ErrorTracker.getErrorSummary();
            if (summary.total > 0) {
                console.log('📊 Error Summary:', summary);
            }
        }, 1000);
    }
}); 