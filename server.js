const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const ytDlpWrap = new YTDlpWrap('yt-dlp');
const cookiesPath = path.join(__dirname, 'cookies.txt');

// Helper function jo cookies ke sath ya bagair link fetch karegi
async function getVideoData(videoUrl) {
    let args = [videoUrl];
    
    // Agar cookies file maujood hai toh use arguments mein add karo
    if (fs.existsSync(cookiesPath)) {
        console.log("Using cookies.txt for authentication...");
        args.push('--cookies', cookiesPath);
    }

    let videoInfo = await ytDlpWrap.getVideoInfo(args);
    return {
        success: true,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration_string,
        downloadUrl: videoInfo.url || (videoInfo.formats && videoInfo.formats.pop().url)
    };
}

// 1. BROWSER KE LIYE (GET Request)
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL missing hai!" });

    try {
        let data = await getVideoData(videoUrl);
        return res.json({ method: "GET (Browser)", ...data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 2. RAPIDAPI KE LIYE (POST Request)
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL dena zaroori hai!" });

    try {
        let data = await getVideoData(videoUrl);
        return res.json({ method: "POST (API/App)", ...data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`API with cookies support is running on port ${PORT}`);
});