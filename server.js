const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🌐 Global High-Speed Working Mirrors List
const COBALT_MIRRORS = [
    'https://co.wuk.sh/api/json',
    'https://cobalt.api.lostpoint.me/api/json',
    'https://cobalt.api.timelessnesses.me/api/json',
    'https://cobalt.synzr.space/api/json',
    'https://cobalt.0x7c00.one/api/json'
];

async function fetchWithMirrorRotation(videoUrl) {
    let lastError = null;

    // Har mirror ko bari-bari try karein jab tak response na mil jaye
    for (const endpoint of COBALT_MIRRORS) {
        try {
            console.log(`📡 Requesting Cluster Mirror: ${endpoint}`);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    url: videoUrl,
                    vQuality: '720',
                    isAudioOnly: false,
                    filenamePattern: 'classic'
                }),
                signal: AbortSignal.timeout(5000) // Agar 5 seconds mein response na aaye toh agla mirror try karo
            });

            if (!response.ok) continue; // Server down hai ya block hai, agle par jao

            const data = await response.json();

            if (data.status === 'stream' || data.status === 'redirect') {
                return {
                    success: true,
                    title: data.text || "Downloaded Video",
                    downloadUrl: data.url,
                    platform: "Multi-Cluster Wrapper Engine"
                };
            } else if (data.status === 'picker') {
                return {
                    success: true,
                    title: "Multi-Quality Video",
                    downloadUrl: data.picker[0].url,
                    platform: "Multi-Cluster Wrapper Engine"
                };
            }
        } catch (error) {
            console.warn(`❌ Mirror ${endpoint} failed:`, error.message);
            lastError = error;
        }
    }

    throw new Error(lastError ? lastError.message : "Saare high-speed wrapper clusters down hain ya Render IP block hai.");
}

// 1. POST ROUTE
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL dena zaroori hai!" });

    try {
        const result = await fetchWithMirrorRotation(videoUrl);
        return res.json({ method: "POST (Multi-Mirror)", ...result });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: "Extraction failed across all instances. Try again or check the link.",
            details: error.message 
        });
    }
});

// 2. GET ROUTE
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL query missing hai!" });

    try {
        const result = await fetchWithMirrorRotation(videoUrl);
        return res.json({ method: "GET (Multi-Mirror)", ...result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Multi-Mirror Load-Balancer is live on port ${PORT}`);
});