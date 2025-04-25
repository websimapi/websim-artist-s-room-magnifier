const imageContainer = document.getElementById('image-container');
const magnifier = document.getElementById('magnifier');

const magnifierSize = 150; // Should match CSS width/height
const zoomLevel = 3; // How much to zoom in
let canvasRegion = null; // Will store the detected canvas coordinates
let originalImageUrl = null; // Store the original URL
let debugElements = []; // Track debug elements for cleanup

async function generateAndSetImage() {
    // Clear any existing debug elements
    clearDebugElements();
    
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

function clearDebugElements() {
    debugElements.forEach(el => {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    });
    debugElements = [];
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

function isVeryWhite(r, g, b) {
    // More relaxed threshold for what's considered white
    // We want to identify off-white and slightly colored white pixels too
    const minWhite = 220; // Lowered from 225
    const maxVariance = 25; // Increased from 15 to allow for shadows and slight color variations on canvas
    
    // Check average brightness first
    const avgBrightness = (r + g + b) / 3;
    if (avgBrightness < minWhite) return false;
    
    // Check if it's fairly desaturated
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const saturation = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal;
    
    return saturation < 0.15 && // Low saturation is key for white areas
           Math.abs(r - g) < maxVariance &&
           Math.abs(r - b) < maxVariance &&
           Math.abs(g - b) < maxVariance;
}

function detectCanvasRegion(img) {
    try {
        // 1. Draw image to canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 2. Create white binary map with preprocessing
        const whiteMap = [];
        let whitePixelCount = 0;
        
        // First pass: gather brightness statistics
        let brightnessSamples = [];
        for (let y = 0; y < height; y += 5) { // Sample every 5 pixels for speed
            for (let x = 0; x < width; x += 5) {
                const i = (y * width + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                brightnessSamples.push((r + g + b) / 3);
            }
        }
        
        // Sort and get threshold based on histogram
        brightnessSamples.sort((a, b) => b - a);
        const topPercentileThreshold = brightnessSamples[Math.floor(brightnessSamples.length * 0.05)]; // Top 5% brightness
        console.log("Brightness threshold:", topPercentileThreshold);
        
        // Create whiteness map
        for (let y = 0; y < height; y++) {
            whiteMap[y] = [];
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                
                // Use our improved white detection
                if (isVeryWhite(r, g, b)) {
                    whiteMap[y][x] = 1; 
                    whitePixelCount++;
                } else {
                    whiteMap[y][x] = 0;
                }
            }
        }
        
        if (whitePixelCount < 100) { // More realistic minimum threshold
            console.warn("Not enough white pixels detected:", whitePixelCount);
            fallbackCanvasDetection();
            return;
        }

        // 3. Apply morphological operations for noise reduction
        // First, dilate to connect nearby white regions
        const dilatedMap = applyMorphologicalOperation(whiteMap, width, height, 'dilate', 3);
        // Then erode to shrink back but with connections maintained
        const processedMap = applyMorphologicalOperation(dilatedMap, width, height, 'erode', 2);
        
        // 4. Find the largest white rectangle area
        const connectedRegions = findConnectedWhiteRegions(processedMap, width, height);
        
        if (connectedRegions.length === 0) {
            console.warn("No suitable white regions found");
            fallbackCanvasDetection();
            return;
        }
        
        // Sort by area (largest first)
        connectedRegions.sort((a, b) => b.area - a.area);
        
        // Find the most canvas-like region based on size, shape, and position
        let bestCanvasRegion = null;
        let bestScore = 0;
        
        for (const region of connectedRegions) {
            // Canvas is usually rectangular with aspect ratio between 0.6 and 1.6
            const wRect = region.maxX - region.minX + 1;
            const hRect = region.maxY - region.minY + 1;
            const aspect = Math.max(wRect/hRect, hRect/wRect);
            
            // Canvas is usually well-filled with white
            const fillRatio = region.area / (wRect * hRect);
            
            // Canvas position is usually centered in the frame
            const centerX = region.minX + wRect/2;
            const centerY = region.minY + hRect/2;
            const centerDistanceX = Math.abs(centerX - width/2) / (width/2);
            const centerDistanceY = Math.abs(centerY - height/2) / (height/2);
            const centerScore = 1 - (centerDistanceX + centerDistanceY) / 2;
            
            // Canvas should be a reasonable size
            const sizeRatio = (wRect * hRect) / (width * height);
            const sizeScore = sizeRatio > 0.05 && sizeRatio < 0.8 ? 1 : 0;
            
            // Calculate overall score
            const score = (
                (aspect < 2 ? 1 : 0) * 0.3 +     // Aspect ratio
                (fillRatio > 0.75 ? 1 : 0) * 0.2 + // Fill ratio
                centerScore * 0.3 +              // Center position
                sizeScore * 0.2                  // Size score
            );
            
            if (score > bestScore) {
                bestScore = score;
                bestCanvasRegion = region;
            }
        }
        
        if (!bestCanvasRegion || bestScore < 0.5) {
            console.warn("No high-scoring canvas region found:", bestScore);
            // Try the largest region as fallback before giving up
            bestCanvasRegion = connectedRegions[0];
            if (!isValidCanvasRegion(bestCanvasRegion, width, height)) {
                fallbackCanvasDetection();
                return;
            }
        }

        // 5. Map region to screen coordinates
        const containerRect = imageContainer.getBoundingClientRect();
        const scaleX = containerRect.width / width;
        const scaleY = containerRect.height / height;
        
        canvasRegion = {
            x: bestCanvasRegion.minX * scaleX,
            y: bestCanvasRegion.minY * scaleY,
            width: (bestCanvasRegion.maxX - bestCanvasRegion.minX + 1) * scaleX,
            height: (bestCanvasRegion.maxY - bestCanvasRegion.minY + 1) * scaleY,
        };

        // Show debug outline
        clearDebugElements();
        addDebugOutline(canvasRegion, 'red', 3, 1.0);
        console.log('Canvas detected:', canvasRegion, bestCanvasRegion);

    } catch (e) {
        console.error("Canvas detection error", e);
        fallbackCanvasDetection();
    }
}

function applyMorphologicalOperation(map, width, height, operation, kernelSize) {
    const result = Array.from({length: height}, () => Array(width).fill(0));
    const halfKernel = Math.floor(kernelSize/2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (operation === 'dilate') {
                // For dilation, if any pixel in the neighborhood is white, set result to white
                let hasWhite = false;
                for (let ky = -halfKernel; ky <= halfKernel; ky++) {
                    for (let kx = -halfKernel; kx <= halfKernel; kx++) {
                        const ny = y + ky;
                        const nx = x + kx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width && map[ny][nx] === 1) {
                            hasWhite = true;
                            break;
                        }
                    }
                    if (hasWhite) break;
                }
                result[y][x] = hasWhite ? 1 : 0;
            } else { // erode
                // For erosion, all pixels in neighborhood must be white
                let allWhite = true;
                for (let ky = -halfKernel; ky <= halfKernel; ky++) {
                    for (let kx = -halfKernel; kx <= halfKernel; kx++) {
                        const ny = y + ky;
                        const nx = x + kx;
                        if (ny < 0 || ny >= height || nx < 0 || nx >= width || map[ny][nx] === 0) {
                            allWhite = false;
                            break;
                        }
                    }
                    if (!allWhite) break;
                }
                result[y][x] = allWhite ? 1 : 0;
            }
        }
    }
    
    return result;
}

function findConnectedWhiteRegions(whiteMap, w, h) {
    const visited = Array.from({length: h}, () => Array(w).fill(false));
    const regions = [];
    
    // Direction vectors for 8-connected neighborhood
    const directions = [
        [1,0], [0,1], [-1,0], [0,-1],
        [1,1], [-1,1], [-1,-1], [1,-1]
    ];

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!visited[y][x] && whiteMap[y][x]) {
                // Begin flood fill with 8-connected neighbors
                const queue = [{x, y}];
                let pixels = [];
                let minX = x, maxX = x, minY = y, maxY = y;
                visited[y][x] = true;

                while (queue.length) {
                    const {x: cx, y: cy} = queue.shift();
                    pixels.push([cx, cy]);
                    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
                    minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);

                    // Check all 8 neighbors
                    directions.forEach(([dx,dy]) => {
                        const nx = cx+dx, ny = cy+dy;
                        if (nx>=0 && nx<w && ny>=0 && ny<h && whiteMap[ny][nx] && !visited[ny][nx]) {
                            visited[ny][nx]=true; 
                            queue.push({x:nx, y:ny});
                        }
                    });
                }
                
                const area = pixels.length;
                if (area > 100) { // Only consider regions larger than 100 pixels
                    regions.push({ minX, minY, maxX, maxY, area, pixels });
                }
            }
        }
    }

    return regions;
}

function isValidCanvasRegion(region, imageWidth, imageHeight) {
    if (!region) return false;
    
    const width = region.maxX - region.minX + 1;
    const height = region.maxY - region.minY + 1;
    
    // Check minimum size (relative to image)
    if (width < imageWidth * 0.05 || height < imageHeight * 0.05) return false;
    
    // Check aspect ratio - canvas is usually relatively square-ish
    const aspect = Math.max(width/height, height/width);
    if (aspect > 3) return false;
    
    // Check fill ratio
    const fillRatio = region.area / (width * height);
    if (fillRatio < 0.5) return false;
    
    return true;
}

function addDebugOutline(region, color = 'red', thickness = 2, opacity = 1.0) {
    const debugOutline = document.createElement('div');
    debugOutline.style.position = 'absolute';
    debugOutline.style.border = `${thickness}px dashed ${color}`;
    debugOutline.style.left = region.x + 'px';
    debugOutline.style.top = region.y + 'px';
    debugOutline.style.width = region.width + 'px';
    debugOutline.style.height = region.height + 'px';
    debugOutline.style.pointerEvents = 'none';
    debugOutline.style.zIndex = '1000';
    debugOutline.style.opacity = opacity;
    imageContainer.appendChild(debugOutline);
    
    // Add to the list of debug elements for cleanup
    debugElements.push(debugOutline);
    
    return debugOutline;
}

function fallbackCanvasDetection() {
    // Improved fallback: use a more realistic canvas size and position
    const containerRect = imageContainer.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    
    // Define a region that's 40% of the container width and 50% of the height
    // with a slight upward shift as canvases are usually above the center
    const width = containerRect.width * 0.4;
    const height = containerRect.height * 0.5;
    
    canvasRegion = {
        x: centerX - width / 2,
        y: centerY - height / 2 - containerRect.height * 0.05, // Shift up a bit
        width: width,
        height: height
    };
    
    console.log("Using fallback canvas region:", canvasRegion);
    
    // Add visualization for the fallback region
    addDebugOutline(canvasRegion, 'orange', 2);
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