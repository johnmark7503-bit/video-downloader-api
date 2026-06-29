const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🔥 Direct Reverse-Engineered TikTok Extractor
async function fetchTikTokDirect(videoUrl) {
    // 1. TikTok short URL (vt.tiktok.com) ko clean full URL mein convert karne ke liye expand check
    let cleanUrl = videoUrl;
    if (videoUrl.includes('vt.tiktok.com') || videoUrl.includes('vm.tiktok.com')) {
        const expandRes = await fetch(videoUrl, { method: 'HEAD', redirect: 'follow' });
        cleanUrl = expandRes.url;
    }

    // 2. URL se Video ID nikalna
    const matches = cleanUrl.match(/\/video\/(\d+)/);
    if (!matches || !matches[1]) {
        throw new Error("TikTok Video ID extract nahi ki ja saki URL se.");
    }
    const videoId = matches[1];

    // 3. TikTok official direct public API endpoint ko hit karna (No Cloudflare Block on this endpoint)
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
    
    // 4. Data parsing aur direct clean watermarked/no-watermarked links nikalna
    if (!data.aweme_list || data.aweme_list.length === 0) {
        throw new Error("Video data not found or video might be private.");
    }

    const videoData = data.aweme_list[0].video;
    
    // No-Watermark high quality mp4 stream url picking
    let downloadUrl = videoData.play_addr.url_list[0];
    
    // Secure connection check
    if (downloadUrl.startsWith('http://')) {
        downloadUrl = downloadUrl.replace('http://', 'https://');
    }

    return {
        success: true,
        title: data.aweme_list[0].desc || "TikTok Video",
        thumbnail: videoData.cover.url_list[0] || "",
        duration: Math.round(videoData.duration / 1000) + "s",
        downloadUrl: downloadUrl, // 🔥 Direct streamable .mp4 link
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