const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;

const app = express();
const PORT = process.env.PORT || 3000; // Render apni port khud assign karega

app.use(cors());
app.use(express.json());

// Render ke environment par yt-dlp globally install hoga, isliye hum uska direct name use karenge
const ytDlpWrap = new YTDlpWrap('yt-dlp');

// 1. BROWSER KE LIYE (GET Request)
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL missing hai!" });

    try {
        let videoInfo = await ytDlpWrap.getVideoInfo(videoUrl);
        return res.json({
            success: true,
            method: "GET (Browser)",
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration_string,
            downloadUrl: videoInfo.url || (videoInfo.formats && videoInfo.formats.pop().url)
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 2. RAPIDAPI KE LIYE (POST Request)
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL dena zaroori hai!" });

    try {
        let videoInfo = await ytDlpWrap.getVideoInfo(videoUrl);
        return res.json({
            success: true,
            method: "POST (API/App)",
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration_string,
            downloadUrl: videoInfo.url || (videoInfo.formats && videoInfo.formats.pop().url)
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`API perfectly live on port ${PORT}`);
});