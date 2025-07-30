document.addEventListener('DOMContentLoaded', function() {
    
    // Debug DOM elements
    const loadButton = document.querySelector('.green-btn');
    const clearButton = document.querySelector('.clear-btn');
    const videoInput = document.querySelector('.video-input');
    
    // Cache frequently used DOM elements
    const currentHashElement = document.getElementById('current-hash');
    const currentStatusElement = document.getElementById('current-status');
    const statusValueElement = document.querySelector('.status-value');
    const videoTitleElement = document.querySelector('.video-title');
    const videoDateElement = document.querySelector('.video-info h3');
    const videoSummaryElement = document.querySelector('.summary');
    const tagsContainerElement = document.querySelector('.tags-container');

    // Reusable function to update status
    function updateStatus(status, isSuccess = true) {
        currentStatusElement.textContent = status;
        statusValueElement.className = `status-value ${isSuccess ? 'success' : 'error'}`;
    }

    // Reusable function to reset video info to default state
    function resetVideoInfo() {
        videoTitleElement.textContent = 'Video Title';
        videoDateElement.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        videoSummaryElement.textContent = '- This vod has no summary -';
        tagsContainerElement.innerHTML = '';
    }

    // Function to format summary text for better readability
    function formatSummaryText(summaryText) {
        if (!summaryText) return '- This vod has no summary -';
        
        // Split by common paragraph separators and format
        return summaryText
            .split(/\n+/)
            .map(paragraph => paragraph.trim())
            .filter(paragraph => paragraph.length > 0)
            .join('\n\n');
    }

// ----------------------------------------------------------------------------------------------------------------------
// Hashing creates a unique, fixed-length string from any input data (in this case, a video URL)
// We use SHA-256 hashing to generate consistent database keys for our video data
// This ensures reliable lookups even if URLs contain special characters or vary slightly

    async function computeVideoHash(videoUrl) {
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
        
        // Return the final hash string that will be used as the key in Supabase queries
        // This hash is consistent for the same URL and different for different URLs
        return hashHex;
    }

// ----------------------------------------------------------------------------------------------------------------------

    async function getWubbySummary(videoUrl) {
        // Supabase configuration
        const SUPABASE_URL = "https://sbvaclmypokafpxebusn.supabase.co";
        // This key is safe to use in the frontend since we have enabled read-only Row Level Security (RLS) on our tables
        const SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmFjbG15cG9rYWZweGVidXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NDI3MTUsImV4cCI6MjA2MzExODcxNX0.7yr-OxNKpoeMstxyOG79ms4F_7eSADLBSROBgwtqTSE"; // Public anon key

        // Generate hash and construct query URL
        const videoHash = await computeVideoHash(videoUrl);
        // Query our 'wubby_summary' table in Supabase. Such an original name, I know
        const queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?video_hash=eq.${videoHash}`;

        const response = await fetch(queryUrl, {
            method: "GET",
            headers: {
            "apikey": SUPABASE_API_KEY,
            "Authorization": `Bearer ${SUPABASE_API_KEY}`,
            "Content-Type": "application/json"
            }
        });

        // Update status display
        if (response.ok) {
            updateStatus(`${response.status} - Success`, true);
        } else {
            updateStatus(`${response.status} - Error`, false);
            showError(`Supabase request failed: ${response.status} - ${response.statusText}`);
            throw new Error(`Supabase request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.length === 0) {
            console.warn("No summary found for video.");
            // Update status to show no data retrieved
            updateStatus(`${response.status} - Success - No Data Retrieved`, false);
            showWarning("No summary found for this video.");
            return null;
        }

        return data[0];
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

        const { summary, tags, upload_date, platform, created_at, pleb_title } = summaryData;

        videoTitleElement.textContent = pleb_title || 'Video Title';
        videoTitleElement.setAttribute('aria-label', `Video title: ${pleb_title || 'Video Title'}`);
        videoSummaryElement.textContent = formatSummaryText(summary);

        const dateValue = upload_date || created_at;
        const date = new Date(dateValue);
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        videoDateElement.textContent = dateValue ? date.toLocaleDateString('en-US', dateOptions) : 'Date not available';

        tagsContainerElement.innerHTML = '';
        
        if (platform) {
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

        if (tags && tags.length > 0) {
            tags.forEach(tagText => {
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = tagText;
                tagsContainerElement.appendChild(tag);
            });
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------
    // Orchestrates the entire process: hash computation, API call, and UI updates
    // Handles both successful data retrieval and error cases
    
    async function loadSelectedVideo() {
        const videoUrl = videoInput.value;
        if (videoUrl) {
            try {
                const hash = await computeVideoHash(videoUrl);
                currentHashElement.textContent = hash;
                
                const summary = await getWubbySummary(videoUrl);
                updateVideoInfo(summary);
                
            } catch (err) {
                console.error('Error:', err);
                showError(`Failed to load video: ${err.message}`);
            }
        } else {
            currentHashElement.textContent = '-';
            updateStatus('No video URL entered.', false);
            showWarning('Please enter a video URL to load.');
        }
    }

    // Don't auto-load on page load since there's no default value
    // loadSelectedVideo();

    loadButton.addEventListener('click', loadSelectedVideo);
    loadButton.setAttribute('aria-label', 'Load video data');
    
    // Clear button functionality
    clearButton.addEventListener('click', function() {
        videoInput.value = '';
        currentHashElement.textContent = '-';
        currentStatusElement.textContent = '-';
        statusValueElement.className = 'status-value';
        resetVideoInfo();
    });
    clearButton.setAttribute('aria-label', 'Clear video input and data');
}); 