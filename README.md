# Wubby Parasocial Workbench

A comprehensive web-based tool for analyzing and working with parasocial content and interactions from Wubby's streams. This workbench provides tools for video transcription, VOD diary management, and content analysis.

## Features

### 🎥 Video Management
- **Video Player Integration**: Built-in video player with Vidstack for enhanced playback experience
- **URL Input System**: Support for archive.wubby.tv URLs with dropdown selection of available VODs
- **Hash-based Tracking**: Unique hash generation and status tracking for video content
- **Video Metadata Display**: Title, date, tags, and summary information

### 📝 Transcription Tools
- **Transcript Extraction**: Get transcripts from video content with subtitle support
- **VTT File Handling**: Support for WebVTT subtitle files
- **Real-time Transcript Display**: View transcripts alongside video playback
- **Transcript Analysis**: Tools for working with extracted transcript data

### 📅 VOD Diary System
- **Date Range Filtering**: Calendar-based date range selection using Flatpickr
- **Platform Filtering**: Toggle between Twitch, Kick, or both platforms
- **Video List Management**: Organized display of VOD entries with filtering capabilities
- **Responsive Design**: Mobile-friendly interface for diary management

## Project Structure

```
parasocial-clone/
├── index.html              # Main application entry point (Transcription Details)
├── transcript.html          # Transcript extraction and viewing interface
├── vod-diary.html          # VOD diary management interface
├── styles.css              # Main stylesheet with responsive design
├── README.md               # Project documentation
└── src/                    # JavaScript source files
    ├── script.js           # Core application logic and video handling
    ├── toast.js            # Toast notification system
    └── vodDiary.js         # VOD diary functionality and filtering
```

## Usage

### Transcription Details (Main Page)
- Enter a video URL from archive.wubby.tv or select from the dropdown
- Click "Load" to fetch video data and display metadata
- View video information including title, date, tags, and summary

### Get Transcript
- Load a video to extract and view transcripts
- Use the video player controls to navigate through content
- Access subtitle tracks and transcript data
- Test transcript extraction functionality

### VOD Diary
- Use the date range picker to filter VODs by date
- Toggle between Twitch and Kick platforms using the slider
- Browse and manage your VOD collection
- View organized video lists with filtering options

## Technical Details

### Dependencies
- **Vidstack Player**: Modern video player with enhanced features
- **Flatpickr**: Date range picker for VOD diary filtering

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Built for the Wubby community
- Inspired by parasocial content analysis needs
