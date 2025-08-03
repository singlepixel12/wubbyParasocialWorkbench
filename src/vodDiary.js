// vod-diary.js
// ----------------------------------------------
// This script renders a list of the most recent VODs

(function () {
    // Sample data (newest first)
    const sampleVideos = [
        {
            url: 'https://archive.wubby.tv/vods/public/jul_2025/27_MEDIA%20SHARE%20NIGHT%20FINALLY%20-%20POUR%20A%20DRINK%20-%20TAKE%20YOUR%20SHOES%20OFF%20-%20MAKE%20SURE%20THE%20LIGHTING%20IS%20RIGHT%20-%20SNAP%20A%20PIC%20OF%20THOSE%20TOES%20-PLEASE%20MEDIA_1753659052_000.mp4',
            title: 'Kick Friday Madness',
            platform: 'kick',
            summary: 'A wild Friday stream with community games, random antics, and spicy takes that had chat popping off all night long. Clip this! Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum accumsan.',
            tags: ['kick', 'community', 'games'],
            date: '2025-07-18T20:00:00Z'
        },
        {
            url: '#',
            title: 'Cooking IRL – Chaos in the Kitchen',
            platform: 'twitch',
            summary: 'Attempted to bake a 12-layer cake; only 8 survived. Fire alarm cameo. Chat redeemed too many hydrates. A masterpiece of disaster, but delicious nonetheless.',
            tags: ['twitch', 'cooking', 'irl'],
            date: '2025-07-17T18:00:00Z'
        },
        {
            url: '#',
            title: 'Retro Speed-run Marathon',
            platform: 'kick',
            summary: 'Blasted through classic retro titles at break-neck speed. New PB on level 3! Featuring guest appearances, controller cam, and inevitable rage resets.',
            tags: ['speedrun', 'retro', 'kick'],
            date: '2025-07-16T22:00:00Z'
        },
        {
            url: '#',
            title: 'Just Chatting – Q&A Extravaganza',
            platform: 'twitch',
            summary: 'Answered your most burning questions about life, streaming, and hot-sauce tier lists. Mods barely kept up with !commands. Long wholesome tangents included.',
            tags: ['just chatting', 'twitch', 'q&a'],
            date: '2025-07-15T19:00:00Z'
        },
        {
            url: '#',
            title: 'Horror VR – Heart-Rate Monitor Special',
            platform: 'kick',
            summary: 'Strapped on the headset for spooky VR thrills. Screamed, sweated, and possibly cried. Heart-rate monitor peaked at 174 bpm. Never again… until next week.',
            tags: ['vr', 'horror', 'kick'],
            date: '2025-07-14T21:00:00Z'
        }
    ];

    const SUPABASE_URL = 'https://sbvaclmypokafpxebusn.supabase.co';
    const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidmFjbG15cG9rYWZweGVidXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NDI3MTUsImV4cCI6MjA2MzExODcxNX0.7yr-OxNKpoeMstxyOG79ms4F_7eSADLBSROBgwtqTSE';

    const platformSlider = document.getElementById('platform-slider');
    let listEl;
    const thumbLabel = platformSlider ? platformSlider.querySelector('.thumb-label') : null;
    const dateInput = document.getElementById('date-range');

    // Determine date format based on locale/timezone
    function getLocaleFormat() {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const lang = navigator.language || 'en-US';
        const isAU = tz.startsWith('Australia') || lang.toLowerCase().includes('-au');
        return isAU ? 'dmy' : 'mdy';
    }

    function formatDateDisplay(dateObj){
        const pad = n => String(n).padStart(2,'0');
        const d = pad(dateObj.getDate());
        const m = pad(dateObj.getMonth()+1);
        const y = dateObj.getFullYear();
        return getLocaleFormat()==='dmy' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
    }

    // Extract original title from video URL
    // Removes timestamp suffix (_1753659052_000) and decodes URL encoding
    // Returns clean title for display without technical artifacts
    function extractOriginalTitle(videoUrl) {
        if (!videoUrl || videoUrl === '#') return '';
        
        try {
            // Get the filename from the URL
            const url = new URL(videoUrl);
            const pathParts = url.pathname.split('/');
            const filename = pathParts[pathParts.length - 1];
            
            // Remove the file extension
            const nameWithoutExt = filename.replace(/\.(mp4|webm|avi|mov)$/i, '');
            
            // Decode URL encoding and replace %20 with spaces
            const decodedName = decodeURIComponent(nameWithoutExt);
            
            // Remove timestamp suffix (e.g., _1753659052_000)
            const nameWithoutTimestamp = decodedName.replace(/_\d+_\d+$/, '');
            
            return nameWithoutTimestamp;
        } catch (error) {
            console.error('Error extracting original title:', error);
            return '';
        }
    }

    // Helper to render list
    async function renderList() {
        if (!listEl) return;
        const platform = platformSlider ? platformSlider.dataset.state || 'both' : 'both';
        const {from, to} = getSelectedRange();
        const videos = await fetchRecentVideos(50, platform, from, to);
        listEl.innerHTML = '';
        videos.forEach(v => listEl.appendChild(createVideoCard(v)));
    }

    async function fetchRecentVideos(limit = 50, platformFilter = 'both', fromDate=null, toDate=null) {
        let queryUrl = `${SUPABASE_URL}/rest/v1/wubby_summary?select=pleb_title,platform,tags,summary,upload_date,video_url&order=upload_date.desc.nullslast&limit=${limit}`;
        if (platformFilter !== 'both') {
            queryUrl += `&platform=eq.${platformFilter}`;
        }
        if(fromDate && toDate){
            const fromISO = fromDate.toISOString();
            const toISO = toDate.toISOString();
            queryUrl += `&upload_date=gte.${fromISO}&upload_date=lte.${toISO}`;
        }

        try {
            const resp = await fetch(queryUrl, {
                headers: {
                    apikey: SUPABASE_API_KEY,
                    Authorization: `Bearer ${SUPABASE_API_KEY}`
                }
            });

            if (!resp.ok) {
                showError(`Failed to load videos: ${resp.status} - ${resp.statusText}`);
                throw new Error(`[Supabase] Request failed: ${resp.status}`);
            }

            const data = await resp.json();
            // Map to expected fields
            return data.map(row => ({
                url: row.video_url || '#',
                title: row.pleb_title || 'Untitled',
                platform: row.platform || 'unknown',
                summary: row.summary || '-',
                tags: Array.isArray(row.tags) ? row.tags : (row.tags ? row.tags : []),
                date: row.upload_date || row.created_at
            }));
        } catch (err) {
            console.error(err);
            showWarning('Using sample data - could not load from server.');
            // Fallback to stub data if call fails
            return [...sampleVideos].slice(0, limit);
        }
    }

    function createVideoCard(video) {
        const card = document.createElement('div');
        card.className = 'video-card';

        // Platform tag (top right)
        const platformTag = document.createElement('span');
        platformTag.className = 'platform-tag tag ' + (video.platform === 'kick' ? 'kick' : 'twitch');
        platformTag.textContent = video.platform;
        card.appendChild(platformTag);

        const thumbLink = document.createElement('a');
        // Store video URL in localStorage and redirect to player page
        thumbLink.href = 'player.html';
        thumbLink.target = '_blank';
        thumbLink.className = 'thumbnail-link';
        thumbLink.addEventListener('click', (e) => {
            // Store the video URL in localStorage before navigating
            localStorage.setItem('selectedVideoUrl', video.url);
        });
        
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail';
        
        // Add hover play button
        const playButton = document.createElement('div');
        playButton.className = 'play-button';
        playButton.innerHTML = `
            <div class="play-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>
        `;
        
        thumb.appendChild(playButton);
        thumbLink.appendChild(thumb);

        const info = document.createElement('div');
        info.className = 'info';

        const title = document.createElement('h3');
        title.textContent = video.title;

        // Add original title subheading
        const originalTitle = document.createElement('h4');
        originalTitle.className = 'original-title';
        originalTitle.textContent = extractOriginalTitle(video.url);

        const dateSpan = document.createElement('span');
        dateSpan.className = 'upload-date';
        if (video.date) {
            const d = new Date(video.date);
            dateSpan.textContent = formatDateDisplay(d);
        }

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        video.tags.forEach(t => {
            if (t === video.platform) return; // avoid duplicate platform tag in tag list
            const tag = document.createElement('span');
            tag.className = 'tag ' + (t === 'kick' ? 'kick' : t === 'twitch' ? 'twitch' : '');
            tag.textContent = t;
            tagsContainer.appendChild(tag);
        });

        const summary = document.createElement('p');
        summary.className = 'summary';
        summary.textContent = video.summary;

        info.appendChild(title);
        info.appendChild(originalTitle);
        info.appendChild(dateSpan);
        info.appendChild(summary);
        info.appendChild(tagsContainer);

        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.textContent = 'Expand ▼';
        expandBtn.addEventListener('click', () => {
            const expanded = card.classList.toggle('expanded');
            expandBtn.textContent = expanded ? 'Collapse ▲' : 'Expand ▼';
        });

        card.appendChild(thumbLink);
        card.appendChild(info);
        card.appendChild(expandBtn);

        return card;
    }

    function setPlatformState(state){
        if(!platformSlider) return;
        platformSlider.dataset.state = state;
        platformSlider.classList.remove('both','twitch','kick');
        platformSlider.classList.add(state);
        if(thumbLabel) thumbLabel.textContent = state;
        renderList();
    }

    // retain cycle function for keyboard toggle
    function cyclePlatformState(){
        const states=['both','twitch','kick'];
        const curr=platformSlider.dataset.state||'both';
        const idx=(states.indexOf(curr)+1)%states.length;
        setPlatformState(states[idx]);
    }

    function getSelectedRange(){
        const defaultTo = new Date();
        const defaultFrom = new Date();
        defaultFrom.setDate(defaultFrom.getDate()-7);
        if(!dateInput || !dateInput._flatpickr || !dateInput._flatpickr.selectedDates.length){
            return {from: defaultFrom, to: defaultTo};
        }
        const [from,to] = dateInput._flatpickr.selectedDates;
        return {from:from||defaultFrom, to:to||defaultTo};
    }

    document.addEventListener('DOMContentLoaded', () => {
        listEl = document.getElementById('video-list');
        if (!listEl) {
            console.error('[VOD Diary] #video-list element not found');
            return;
        }

        if(thumbLabel) thumbLabel.textContent = platformSlider.dataset.state;
        renderList();

        if (platformSlider) {
            platformSlider.addEventListener('click', (e) => {
                const rect = platformSlider.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const ratio = x / rect.width;
                let target = 'both';
                if (ratio < 0.33) target = 'both';
                else if (ratio < 0.66) target = 'twitch';
                else target = 'kick';

                setPlatformState(target);
            });

            // allow cycling via keyboard maybe future
        }

        // flatpickr init
        if(dateInput){
            const fpFormat = getLocaleFormat()==='dmy' ? 'd/m/Y' : 'm/d/Y';
            flatpickr(dateInput, {
                mode:'range',
                dateFormat: fpFormat,
                defaultDate:[getSelectedRange().from, getSelectedRange().to],
                onReady: function(selectedDates, dateStr, instance){
                    const btn = document.createElement('button');
                    btn.textContent = 'This Week';
                    btn.style.width='100%';
                    btn.style.margin='4px 0 0';
                    btn.style.padding='4px';
                    btn.style.background='#222';
                    btn.style.color='#fff';
                    btn.style.border='1px solid #555';
                    btn.style.cursor='pointer';
                    btn.addEventListener('click', () => {
                        const to = new Date();
                        const from = new Date();
                        from.setDate(to.getDate()-7);
                        instance.setDate([from,to], true);
                        renderList();
                    });
                    instance.calendarContainer.appendChild(btn);
                },
                onClose: function(selectedDates){
                    if(selectedDates.length===2){
                        renderList();
                    }
                }
            });
        }
    });
})(); 