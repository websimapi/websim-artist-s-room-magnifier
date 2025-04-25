const imageContainer = document.getElementById('image-container');
const magnifier = document.getElementById('magnifier');

const magnifierSize = 150; // Should match CSS width/height
const zoomLevel = 3; // How much to zoom in
let canvasRegion = null; // Will store the detected canvas coordinates
let originalImageUrl = null; // Store the original URL

async function generateAndSetImage() {
    try {
        // Updated prompt to specifically request colored walls (not white)
        const result = await websim.imageGen({
          prompt: "HD hyper realistic artist room with deep blue walls and various art supplies like paints, brushes, palettes, and easels scattered around. In the center, there's a large, blank WHITE canvas on an easel. The canvas should be clearly defined, rectangular, and stand out from its surroundings. Soft, natural light illuminates the scene.",
          aspect_ratio: "16:9", // Good for full screen
        });
        const imageUrl = result.url;
        originalImageUrl = imageUrl;

        if (!imageUrl) {
            throw new Error("Failed to generate image URL.");
        }

        // Set the background for the container and the magnifier
        imageContainer.style.backgroundImage = `url(${imageUrl})`;
        magnifier.style.backgroundImage = `url(${imageUrl})`;

        // Calculate the background size for the magnifier based on zoom
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        magnifier.style.backgroundSize = `${containerWidth * zoomLevel}px ${containerHeight * zoomLevel}px`;

        // Load image and detect canvas
        loadImageWithProxies(imageUrl);

    } catch (error) {
        console.error("Error generating or setting image:", error);
        imageContainer.innerText = "Failed to load image. Please try again.";
        imageContainer.style.display = 'flex';
        imageContainer.style.alignItems = 'center';
        imageContainer.style.justifyContent = 'center';
        imageContainer.style.color = 'red';
        imageContainer.style.cursor = 'default'; // Show cursor if there's an error
    }
}

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
        // The image is still displayed but without canvas detection
    }
}

async function convertToBlobUrl(url) {
    try {
        // Try to fetch the image as a blob
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

function loadImageWithUrl(url) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => detectCanvasRegion(img);
    img.onerror = (e) => console.error("Error loading image:", e);
    img.src = url;
}

function detectCanvasRegion(img) {
    try {
        // Create a canvas to analyze the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas dimensions to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image on canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Create a binary map of white-ish pixels
        const whiteMap = [];
        const threshold = 170; // Reduced threshold from 200 to 170 for more lenient detection
        const brightnessThreshold = 200; // Additional threshold for overall brightness
        
        for (let y = 0; y < canvas.height; y++) {
            whiteMap[y] = [];
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                
                // Check if the pixel is white-ish using multiple criteria
                // 1. Individual RGB values are high enough
                // 2. The average brightness is high
                // 3. The color is fairly balanced (not too yellow, blue, etc.)
                
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                const brightness = (r + g + b) / 3;
                const colorVariance = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
                
                // A pixel is considered white-ish if:
                // - It's very bright overall AND
                // - The RGB components are reasonably balanced (not too colorful)
                const isWhite = (
                    (r > threshold && g > threshold && b > threshold) || // Original criteria, but more lenient
                    (brightness > brightnessThreshold && colorVariance < 30) // New brightness-based criteria
                );
                
                whiteMap[y][x] = isWhite ? 1 : 0;
            }
        }
        
        // Apply a simple smoothing to fill small gaps in the detected white areas
        smoothWhiteMap(whiteMap, canvas.width, canvas.height);
        
        // Find the largest white rectangle
        const result = findLargestWhiteRectangle(whiteMap, canvas.width, canvas.height);
        
        if (result) {
            console.log("Canvas detected:", result);
            
            // Convert to relative coordinates for the container
            const containerRect = imageContainer.getBoundingClientRect();
            const scaleX = containerRect.width / canvas.width;
            const scaleY = containerRect.height / canvas.height;
            
            canvasRegion = {
                x: result.x * scaleX,
                y: result.y * scaleY,
                width: result.width * scaleX,
                height: result.height * scaleY
            };
            
            // Add visualization for debugging (can be removed in production)
            const debugOutline = document.createElement('div');
            debugOutline.style.position = 'absolute';
            debugOutline.style.border = '2px dashed red';
            debugOutline.style.left = canvasRegion.x + 'px';
            debugOutline.style.top = canvasRegion.y + 'px';
            debugOutline.style.width = canvasRegion.width + 'px';
            debugOutline.style.height = canvasRegion.height + 'px';
            debugOutline.style.pointerEvents = 'none';
            imageContainer.appendChild(debugOutline);
        } else {
            console.log("Canvas not detected");
            fallbackCanvasDetection();
        }
    } catch (error) {
        console.error("Error in canvas detection:", error);
        fallbackCanvasDetection();
    }
}

function smoothWhiteMap(whiteMap, width, height) {
    // Create a copy of the white map
    const smoothedMap = [];
    for (let y = 0; y < height; y++) {
        smoothedMap[y] = [...whiteMap[y]];
    }
    
    // Simple smoothing: if a pixel is surrounded by mostly white pixels, make it white
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            // Skip pixels that are already white
            if (whiteMap[y][x] === 1) continue;
            
            // Count white neighbors (8-connectivity)
            let whiteNeighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue; // Skip the pixel itself
                    if (whiteMap[y + dy][x + dx] === 1) {
                        whiteNeighbors++;
                    }
                }
            }
            
            // If 5 or more neighbors are white, make this pixel white too
            if (whiteNeighbors >= 5) {
                smoothedMap[y][x] = 1;
            }
        }
    }
    
    // Copy the smoothed map back to the original
    for (let y = 0; y < height; y++) {
        whiteMap[y] = [...smoothedMap[y]];
    }
}

function fallbackCanvasDetection() {
    // Fallback method: define a reasonable canvas region in the center
    const containerRect = imageContainer.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    
    // Define a region that's 30% of the container width and 40% of the height
    const width = containerRect.width * 0.3;
    const height = containerRect.height * 0.4;
    
    canvasRegion = {
        x: centerX - width / 2,
        y: centerY - height / 2,
        width: width,
        height: height
    };
    
    console.log("Using fallback canvas region:", canvasRegion);
    
    // Add visualization for the fallback region
    const debugOutline = document.createElement('div');
    debugOutline.style.position = 'absolute';
    debugOutline.style.border = '2px dashed orange';
    debugOutline.style.left = canvasRegion.x + 'px';
    debugOutline.style.top = canvasRegion.y + 'px';
    debugOutline.style.width = canvasRegion.width + 'px';
    debugOutline.style.height = canvasRegion.height + 'px';
    debugOutline.style.pointerEvents = 'none';
    imageContainer.appendChild(debugOutline);
}

function findLargestWhiteRectangle(grid, width, height) {
    let maxArea = 0;
    let maxRect = null;
    
    // Minimum size requirements for a canvas
    const MIN_WIDTH = width * 0.1; // At least 10% of image width
    const MIN_HEIGHT = height * 0.1; // At least 10% of image height
    
    // Try to find a more tolerant algorithm that can handle some non-white pixels
    const MAX_NONWHITE_RATIO = 0.15; // Allow up to 15% non-white pixels in a candidate rectangle
    
    for (let startY = 0; startY < height; startY++) {
        for (let startX = 0; startX < width; startX++) {
            // Only process if this pixel is white
            if (grid[startY][startX] === 1) {
                // Find maximum width
                let maxWidth = 0;
                while (startX + maxWidth < width && grid[startY][startX + maxWidth] === 1) {
                    maxWidth++;
                }
                
                // If this potential rectangle is too narrow, skip
                if (maxWidth < MIN_WIDTH) continue;
                
                // Find maximum height with tolerance for some non-white pixels
                let maxHeight = 0;
                let isRectangle = true;
                
                while (isRectangle && startY + maxHeight < height) {
                    let nonWhiteCount = 0;
                    let totalCount = 0;
                    
                    for (let x = 0; x < maxWidth; x++) {
                        if (startX + x >= width || startY + maxHeight >= height) {
                            isRectangle = false;
                            break;
                        }
                        
                        totalCount++;
                        if (grid[startY + maxHeight][startX + x] !== 1) {
                            nonWhiteCount++;
                            
                            // If too many non-white pixels in this row, stop expanding
                            if (nonWhiteCount / totalCount > MAX_NONWHITE_RATIO) {
                                isRectangle = false;
                                break;
                            }
                        }
                    }
                    
                    if (isRectangle) maxHeight++;
                }
                
                // If this potential rectangle is too short, skip
                if (maxHeight < MIN_HEIGHT) continue;
                
                // Calculate area and update max if needed
                const area = maxWidth * maxHeight;
                if (area > maxArea) {
                    maxArea = area;
                    maxRect = {
                        x: startX,
                        y: startY,
                        width: maxWidth,
                        height: maxHeight,
                        area: area
                    };
                }
            }
        }
    }
    
    return maxRect;
}

function isPointInCanvas(x, y) {
    if (!canvasRegion) return false;
    
    return (
        x >= canvasRegion.x && 
        x <= canvasRegion.x + canvasRegion.width &&
        y >= canvasRegion.y && 
        y <= canvasRegion.y + canvasRegion.height
    );
}

function moveMagnifier(e) {
    // Get cursor position within the viewport
    const clientX = e.clientX;
    const clientY = e.clientY;

    // Get the size and position of the container
    const rect = imageContainer.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // Calculate cursor position relative to the container
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Check if cursor is over the canvas
    if (isPointInCanvas(x, y)) {
        // Hide magnifier and show brush cursor
        magnifier.style.display = 'none';
        document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000000\' d=\'M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z\'/%3E%3C/svg%3E") 0 24, auto';
        return;
    }

    // Not over canvas, show magnifier and hide brush cursor
    document.body.style.cursor = 'none';

    // Position the magnifier element centered on the cursor
    magnifier.style.left = `${clientX}px`;
    magnifier.style.top = `${clientY}px`;

    // Calculate the background position for the magnifier
    const bgX = -(x * zoomLevel - magnifierSize / 2);
    const bgY = -(y * zoomLevel - magnifierSize / 2);

    magnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;

    // Show the magnifier
    magnifier.style.display = 'block';
}

// Event listeners
imageContainer.addEventListener('mousemove', moveMagnifier);

imageContainer.addEventListener('mouseenter', () => {
    // We'll let the mousemove handler decide whether to show the magnifier
    // based on cursor position
});

imageContainer.addEventListener('mouseleave', () => {
    magnifier.style.display = 'none';
    document.body.style.cursor = 'auto';
});

// Generate the image when the script loads
generateAndSetImage();

// Optional: Recalculate background size on window resize
window.addEventListener('resize', () => {
    if (magnifier.style.backgroundImage) {
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        magnifier.style.backgroundSize = `${containerWidth * zoomLevel}px ${containerHeight * zoomLevel}px`;
    }
});