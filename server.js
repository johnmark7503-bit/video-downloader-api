const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Stable Production Mirror Core Engine
async function fetchViaThirdParty(videoUrl) {
    // Cobalt api cluster routing update
    const apiEndpoint = 'https://co.wuk.sh/api/json'; 
    
    const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
            url: videoUrl,
            vQuality: '720', // API format check
            isAudioOnly: false,
            filenamePattern: 'classic'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mirror Engine Response Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.status === 'stream' || data.status === 'redirect') {
        return {
            success: true,
            title: data.text || "Downloaded Video",
            downloadUrl: data.url,
            platform: "Production Wrapper Cluster"
        };
    } else if (data.status === 'picker') {
        return {
            success: true,
            title: "Multi-Quality Video",
            downloadUrl: data.picker[0].url,
            platform: "Production Wrapper Cluster"
        };
    } else {
        throw new Error(data.text || "Format extraction failed.");
    }
}

// POST ROUTE
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL ('videoUrl' key ke sath) dena zaroori hai!" });

    try {
        const result = await fetchViaThirdParty(videoUrl);
        return res.json({ method: "POST", ...result });
    } catch (error) {
        console.error("Extraction Error:", error.message);
        return res.status(500).json({ 
            success: false, 
            error: "Extraction failed or service temporarily busy.", 
            details: error.message 
        });
    }
});

// GET ROUTE
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL query missing hai!" });

    try {
        const result = await fetchViaThirdParty(videoUrl);
        return res.json({ method: "GET", ...result });
    } catch (error) {
        console.error("Extraction Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Wrapper Engine running flawlessly on port ${PORT}`);
});