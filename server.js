const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🚀 High-Speed TikTok Hybrid Engine (Bypasses Datacenter Blocks Automatically)
async function fetchTikTokViaTikWM(videoUrl) {
    const apiUrl = 'https://tikwm.com/api/';
    
    // TikWM direct query string accept karta hai aur short links khud hi resolve karta hai
    const response = await fetch(`${apiUrl}?url=${encodeURIComponent(videoUrl)}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`TikWM Provider Server Responded with status: ${response.status}`);
    }

    const resData = await response.json();

    // TikWM code 0 return karta hai success par
    if (resData.code !== 0 || !resData.data) {
        throw new Error(resData.msg || "Video data could not be fetched from stream cluster.");
    }

    const videoData = resData.data;

    // Relative links ko absolute links mein convert karne ka safe check
    const cleanDownloadUrl = videoData.play.startsWith('http') ? videoData.play : `https://tikwm.com${videoData.play}`;
    const cleanWmDownloadUrl = videoData.wmplay.startsWith('http') ? videoData.wmplay : `https://tikwm.com${videoData.wmplay}`;

    return {
        success: true,
        title: videoData.title || "TikTok Video",
        thumbnail: videoData.cover || "",
        duration: videoData.duration ? videoData.duration + "s" : "N/A",
        downloadUrl: cleanDownloadUrl,       // 🔥 High Quality No-Watermark Link
        wmDownloadUrl: cleanWmDownloadUrl,   // Watermarked Fallback Link
        author: videoData.author?.unique_id || "Unknown",
        platform: "TikTok Premium Hybrid Engine"
    };
}

// 1. POST ROUTE
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL dena zaroori hai!" });

    try {
        const result = await fetchTikTokViaTikWM(videoUrl);
        return res.json({ success: true, method: "POST", ...result });
    } catch (error) {
        console.error("Hybrid Extraction Error:", error.message);
        return res.status(500).json({ 
            success: false, 
            error: "TikTok direct extraction failed.", 
            details: error.message 
        });
    }
});

// 2. GET ROUTE
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL query missing hai!" });

    try {
        const result = await fetchTikTokViaTikWM(videoUrl);
        return res.json({ success: true, method: "GET", ...result });
    } catch (error) {
        console.error("Hybrid Extraction Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Local Development ke liye listener (Vercel production mein ise bypass kar dega)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Engine is running locally on port ${PORT}`);
    });
}

// 🔥 Vercel Serverless Function Export (Crucial for Vercel deployment)
module.exports = app;