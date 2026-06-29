const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🔥 Smart Dual-Layer URL Expander & TikTok Extractor
async function fetchTikTokDirect(videoUrl) {
    let cleanUrl = videoUrl;

    // Agar link short hai (vt.tiktok.com ya vm.tiktok.com), toh ise expand karein
    if (videoUrl.includes('vt.tiktok.com') || videoUrl.includes('vm.tiktok.com')) {
        try {
            console.log("🔗 Short link detected. Expanding URL safely...");
            
            // Layer 1: Manual redirect capture (Super fast & stealthy)
            let expandRes = await fetch(videoUrl, { 
                method: 'GET', 
                redirect: 'manual',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            let redirectLocation = expandRes.headers.get('location');
            if (redirectLocation) {
                cleanUrl = redirectLocation;
            } else {
                // Layer 2: Fallback to full browser simulator if layer 1 fails
                let followRes = await fetch(videoUrl, {
                    method: 'GET',
                    redirect: 'follow',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5'
                    }
                });
                cleanUrl = followRes.url;
            }
            console.log(`✅ Expanded URL successfully: ${cleanUrl}`);
        } catch (e) {
            console.error("⚠️ URL Expand karne mein masla aaya:", e.message);
        }
    }

    // URL se Video ID nikalna
    const matches = cleanUrl.match(/\/video\/(\d+)/);
    if (!matches || !matches[1]) {
        throw new Error(`TikTok Video ID extract nahi ki ja saki URL se. Got URL: ${cleanUrl}`);
    }
    const videoId = matches[1];

    // TikTok official direct public API endpoint को hit karna
    const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}&version_code=262&app_name=musical_ly&channel=App%20Store&device_platform=iphone&aid=1233`;

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'User-Agent': 'com.zhiliaoapp.musically/2022602010 (Linux; U; Android 7.1.2; en_US; MIUI/HyperOS)'
        }
    });

    if (!response.ok) {
        throw new Error(`TikTok Core Server Responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.aweme_list || data.aweme_list.length === 0) {
        throw new Error("Video data not found or video might be private.");
    }

    const videoData = data.aweme_list[0].video;
    let downloadUrl = videoData.play_addr.url_list[0];
    
    if (downloadUrl.startsWith('http://')) {
        downloadUrl = downloadUrl.replace('http://', 'https://');
    }

    return {
        success: true,
        title: data.aweme_list[0].desc || "TikTok Video",
        thumbnail: videoData.cover.url_list[0] || "",
        duration: Math.round(videoData.duration / 1000) + "s",
        downloadUrl: downloadUrl, 
        platform: "TikTok Direct Engine"
    };
}

// 1. POST ROUTE
app.post('/api/download', async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL dena zaroori hai!" });

    try {
        const result = await fetchTikTokDirect(videoUrl);
        return res.json({ method: "POST (Direct Engine)", ...result });
    } catch (error) {
        console.error("Direct Extraction Error:", error.message);
        return res.status(500).json({ 
            success: false, 
            error: "Direct extraction failed.", 
            details: error.message 
        });
    }
});

// 2. GET ROUTE
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.videoUrl;
    if (!videoUrl) return res.status(400).json({ success: false, error: "Video URL query missing hai!" });

    try {
        const result = await fetchTikTokDirect(videoUrl);
        return res.json({ method: "GET (Direct Engine)", ...result });
    } catch (error) {
        console.error("Direct Extraction Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Direct High-Speed TikTok Engine live on port ${PORT}`);
});