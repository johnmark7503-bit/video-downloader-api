const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Render ke Linux environment aur windows local dono ke liye automatic binary path selection
const binaryPath = path.join(__dirname, 'node_modules', '.bin', 'yt-dlp');
const finalBinary = fs.existsSync(binaryPath) ? binaryPath : 'yt-dlp';
const ytDlpWrap = new YTDlpWrap(finalBinary);

const cookiesPath = path.join(__dirname, 'cookies.txt');

// Sabhi platforms (YouTube, TikTok, Insta, FB, Pinterest, X) ke liye single dynamic engine
async function getVideoData(videoUrl) {
    // Real Browser ki tarah spoof karne ke liye standard parameters aur user-agent
    let args = [
        videoUrl,
        '--no-playlist',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Accept-Language: en-US,en;q=0.9',
        '--add-header', 'Sec-Fetch-Mode: navigate'
    ];
    
    // Agar cookies.txt maujood hai toh safe authentication ke liye inject karo
    if (fs.existsSync(cookiesPath)) {
        console.log("🔒 System Security: Loading cookies.txt for verification...");
        args.push('--cookies', cookiesPath);
    }

    // Extraction process shuru
    let videoInfo = await ytDlpWrap.getVideoInfo(args);

    // Kuch platforms direct URL dete hain aur kuch formats ke andar link chhupate hain
    let directUrl = videoInfo.url;
    
    if (!directUrl && videoInfo.formats) {
        // Aise formats nikalna jo direct streamable hon aur jin mein m3u8 na ho (jo apps mein nahi chalti)
        const cleanFormats = videoInfo.formats.filter(f => f.url && !f.url.includes('.m3u8') && f.vcodec !== 'none');
        
        if (cleanFormats.length > 0) {
            // Highest quality wala link select karein
            directUrl = cleanFormats[cleanFormats.length - 1].url;
        } else {
            // Fallback: Agar kuch na mile toh aakhri available format ka link le lo
            directUrl = videoInfo.formats[videoInfo.formats.length - 1].url;
        }
    }

    return {
        success: true,
        title: videoInfo.title || videoInfo.description || "Social Media Video",
        thumbnail: videoInfo.thumbnail || (videoInfo.thumbnails && videoInfo.thumbnails[0]?.url) || "",
        duration: videoInfo.duration_string || (videoInfo.duration ? `${Math.floor(videoInfo.duration / 60)}:${videoInfo.duration % 60}` : "N/A"),
        downloadUrl: directUrl,
        platform: videoInfo.extractor_key || "Universal"
    };
}

// 1. GET REQUEST (Testing/Browser ke liye)
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL missing hai!" });

    try {
        let data = await getVideoData(videoUrl);
        return res.json({ method: "GET (Browser)", ...data });
    } catch (error) {
        console.error("Extraction failed:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 2. POST REQUEST (Client App / RapidAPI ke liye)
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL dena zaroori hai!" });

    try {
        let data = await getVideoData(videoUrl);
        return res.json({ method: "POST (API/App)", ...data });
    } catch (error) {
        console.error("Extraction failed:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Ultimate Multi-Platform Downloader Engine live on port ${PORT}`);
});