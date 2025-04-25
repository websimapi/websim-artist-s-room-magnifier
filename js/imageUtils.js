import { detectCanvasRegion } from './canvasDetection.js';
import { clearDebugElements } from './debug.js';

// Shared state
let originalImageUrl = null;

/**
 * Generates an image using AI and sets it as the background
 */
export async function generateAndSetImage() {
    clearDebugElements();
    
    try {
        const result = await websim.imageGen({
          prompt: "HD hyper realistic artist room with deep blue walls and various art supplies like paints, brushes, palettes, and easels scattered around. In the center, there's a large, blank WHITE canvas on an easel. The canvas should be clearly defined, rectangular, and stand out from its surroundings. Soft, natural light illuminates the scene.",
          aspect_ratio: "16:9",
        });
        const imageUrl = result.url;
        originalImageUrl = imageUrl;

        if (!imageUrl) {
            throw new Error("Failed to generate image URL.");
        }

        const imageContainer = document.getElementById('image-container');
        const magnifier = document.getElementById('magnifier');
        
        // Set the background for the container and the magnifier
        imageContainer.style.backgroundImage = `url(${imageUrl})`;
        magnifier.style.backgroundImage = `url(${imageUrl})`;

        // Calculate the background size for the magnifier based on zoom
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        magnifier.style.backgroundSize = `${containerWidth * 3}px ${containerHeight * 3}px`;

        // Load image and detect canvas
        loadImageWithProxies(imageUrl);

    } catch (error) {
        console.error("Error generating or setting image:", error);
        const imageContainer = document.getElementById('image-container');
        imageContainer.innerText = "Failed to load image. Please try again.";
        imageContainer.style.display = 'flex';
        imageContainer.style.alignItems = 'center';
        imageContainer.style.justifyContent = 'center';
        imageContainer.style.color = 'red';
        imageContainer.style.cursor = 'default';
    }
}

/**
 * Attempts to load an image using multiple CORS proxies
 */
async function loadImageWithProxies(imageUrl) {
    // List of CORS proxies to try
    const corsProxies = [
        (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url) => `https://cors-anywhere.herokuapp.com/${url}`,
        (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        (url) => `https://crossorigin.me/${url}`,
        (url) => `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
        // Direct attempt without proxy as last resort
        (url) => url
    ];

    // Try to convert to blob URL as an alternative method
    try {
        const blobUrl = await convertToBlobUrl(imageUrl);
        if (blobUrl) {
            console.log("Successfully converted to blob URL");
            loadImageWithUrl(blobUrl);
            return;
        }
    } catch (error) {
        console.warn("Blob URL conversion failed, trying proxies", error);
    }

    // Try each proxy in sequence
    let succeeded = false;
    for (let i = 0; i < corsProxies.length && !succeeded; i++) {
        try {
            const proxyUrl = corsProxies[i](imageUrl);
            console.log(`Trying proxy #${i+1}: ${proxyUrl.substring(0, 50)}...`);
            
            // Create a new image and try to load it
            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            // Use a promise to handle the async image loading
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    console.log(`Successfully loaded image with proxy #${i+1}`);
                    try {
                        detectCanvasRegion(img);
                        succeeded = true;
                        resolve();
                    } catch (e) {
                        console.error("Canvas detection failed:", e);
                        reject(e);
                    }
                };
                img.onerror = (e) => {
                    console.warn(`Failed to load with proxy #${i+1}:`, e);
                    reject(new Error(`Proxy #${i+1} failed`));
                };
                img.src = proxyUrl;
                
                // Set a timeout to avoid hanging forever
                setTimeout(() => reject(new Error("Timeout")), 5000);
            });
            
        } catch (error) {
            console.warn(`Proxy #${i+1} attempt failed:`, error);
        }
    }
    
    if (!succeeded) {
        console.warn("All proxy attempts failed, falling back to basic functionality without canvas detection");
    }
}

/**
 * Converts a URL to a blob URL to work around CORS issues
 */
async function convertToBlobUrl(url) {
    try {
        const response = await fetch(url, {
            mode: 'cors',
            cache: 'no-cache',
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.warn("Blob URL conversion failed:", error);
        return null;
    }
}

/**
 * Loads an image from a URL and detects the canvas region
 */
function loadImageWithUrl(url) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => detectCanvasRegion(img);
    img.onerror = (e) => console.error("Error loading image:", e);
    img.src = url;
}