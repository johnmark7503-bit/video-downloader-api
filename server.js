const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(express.json());

// Main Download Endpoint
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;

    // 1. Validate Input
    if (!videoUrl) {
        return res.status(400).json({
            success: false,
            error: "Missing parameter.",
            details: "Please provide a valid videoUrl in the request body."
        });
    }

    // 2. RapidAPI Security Check (Only enforces in production)
    const rapidSecret = req.headers['x-rapidapi-proxy-secret'];
    if (process.env.NODE_ENV === 'production' && !rapidSecret) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized access.",
            details: "Direct access to this API is blocked. Please use the official RapidAPI marketplace link."
        });
    }

    try {
        // 3. TikWM Engine Integration
        // Agar aapne Vercel environment variables mein TIKWM_PROXY set kiya hai toh wo utilize hoga
        const tikwmApiUrl = process.env.TIKWM_PROXY === 'true' 
            ? 'https://www.tikwm.com/api/' 
            : 'https://tikwm.com/api/';

        const response = await fetch(tikwmApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ url: videoUrl })
        });

        if (!response.ok) {
            throw new Error(`TikWM gateway responded with status: ${response.status}`);
        }

        const data = await response.json();

        // 4. Handle TikWM Error Response
        if (data.code !== 0 || !data.data) {
            return res.status(500).json({
                success: false,
                error: "TikTok direct extraction failed.",
                details: data.msg || "Url parsing is failed! Please check url."
            });
        }

        // 5. Success Clean JSON Response
        return res.status(200).json({
            success: true,
            method: "POST",
            title: data.data.title || "No Title",
            thumbnail: data.data.cover,
            duration: data.data.duration ? `${data.data.duration}s` : "N/A",
            downloadUrl: `https://tikwm.com${data.data.play}`,
            wmDownloadUrl: `https://tikwm.com${data.data.wmplay}`,
            author: data.data.author?.unique_id || "Unknown",
            platform: "TikTok",
            engine: "TikWM Premium Hybrid"
        });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({
            success: false,
            error: "Internal Server Error",
            details: error.message
        });
    }
});

// Root fallback route for diagnostics
app.get('/', (req, res) => {
    res.status(200).json({
        status: "online",
        message: "High-Speed Video Downloader API Engine is running seamlessly on Vercel.",
        endpoint: "/api/download"
    });
});

// Vercel Serverless Export Requirement
module.exports = app;

// Local Development Server Listener
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`[Local Server] Engine active and listening on http://localhost:${PORT}`);
    });
}