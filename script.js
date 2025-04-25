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
        
        // ENHANCED: Multi-stage canvas detection
        
        // 1. Create multiple threshold maps for more robust detection
        const whiteMaps = createMultiThresholdMaps(data, canvas.width, canvas.height);
        
        // 2. Apply edge detection
        const edgeMap = detectEdges(data, canvas.width, canvas.height);
        
        // 3. Find canvas candidates using white regions and edge information
        const candidates = findCanvasCandidates(whiteMaps, edgeMap, canvas.width, canvas.height);
        
        // 4. Verify and refine the best candidate
        const result = refineBestCandidate(candidates, data, canvas.width, canvas.height);
        
        if (result && result.confidence > 0.6) { // Only use if confidence is high enough
            console.log("Canvas detected:", result);
            
            // Add debug visualization for all candidates (in different colors)
            if (candidates.length > 0) {
                const colors = ['yellow', 'purple', 'cyan', 'magenta', 'orange'];
                candidates.forEach((candidate, i) => {
                    addDebugOutline(candidate, colors[i % colors.length], 1);
                });
            }
            
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
            
            // Add visualization for the final result
            addDebugOutline(canvasRegion, 'red', 2);
        } else {
            console.log("Canvas not detected with sufficient confidence, using fallback");
            fallbackCanvasDetection();
        }
    } catch (error) {
        console.error("Error in canvas detection:", error);
        fallbackCanvasDetection();
    }
}

function createMultiThresholdMaps(data, width, height) {
    // Create binary maps with different thresholds
    const thresholds = [
        { r: 200, g: 200, b: 200 }, // Very white
        { r: 180, g: 180, b: 180 }, // Slightly less white
        { r: 220, g: 220, b: 220 }  // Very bright white
    ];
    
    const maps = [];
    
    thresholds.forEach(threshold => {
        const map = [];
        for (let y = 0; y < height; y++) {
            map[y] = [];
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                // Check if the pixel is within threshold
                const isWhite = (
                    data[idx] >= threshold.r && 
                    data[idx + 1] >= threshold.g && 
                    data[idx + 2] >= threshold.b
                );
                map[y][x] = isWhite ? 1 : 0;
            }
        }
        maps.push(map);
    });
    
    return maps;
}

function detectEdges(data, width, height) {
    // Simple edge detection by looking for significant color changes
    const edgeMap = [];
    const edgeThreshold = 30; // Minimum difference to consider an edge
    
    for (let y = 0; y < height; y++) {
        edgeMap[y] = [];
        for (let x = 0; x < width; x++) {
            edgeMap[y][x] = 0; // Default - not an edge
            
            if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
                const idx = (y * width + x) * 4;
                
                // Check surrounding pixels
                const leftIdx = (y * width + (x - 1)) * 4;
                const rightIdx = (y * width + (x + 1)) * 4;
                const topIdx = ((y - 1) * width + x) * 4;
                const bottomIdx = ((y + 1) * width + x) * 4;
                
                // Calculate color differences
                const diffLeft = Math.abs(data[idx] - data[leftIdx]) + 
                                Math.abs(data[idx + 1] - data[leftIdx + 1]) + 
                                Math.abs(data[idx + 2] - data[leftIdx + 2]);
                                
                const diffRight = Math.abs(data[idx] - data[rightIdx]) + 
                                 Math.abs(data[idx + 1] - data[rightIdx + 1]) + 
                                 Math.abs(data[idx + 2] - data[rightIdx + 2]);
                                 
                const diffTop = Math.abs(data[idx] - data[topIdx]) + 
                               Math.abs(data[idx + 1] - data[topIdx + 1]) + 
                               Math.abs(data[idx + 2] - data[topIdx + 2]);
                               
                const diffBottom = Math.abs(data[idx] - data[bottomIdx]) + 
                                  Math.abs(data[idx + 1] - data[bottomIdx + 1]) + 
                                  Math.abs(data[idx + 2] - data[bottomIdx + 2]);
                
                // Consider it an edge if any difference exceeds threshold
                if (diffLeft > edgeThreshold || diffRight > edgeThreshold || 
                    diffTop > edgeThreshold || diffBottom > edgeThreshold) {
                    edgeMap[y][x] = 1;
                }
            }
        }
    }
    
    return edgeMap;
}

function findCanvasCandidates(whiteMaps, edgeMap, width, height) {
    const candidates = [];
    
    // Minimum size requirements for a canvas
    const MIN_WIDTH = width * 0.05; // At least 5% of image width
    const MIN_HEIGHT = height * 0.05; // At least 5% of image height
    const MAX_ASPECT_RATIO = 2.5; // Maximum aspect ratio (width/height or height/width)
    
    // Process each white map to find rectangles
    whiteMaps.forEach((whiteMap, mapIndex) => {
        // Find potential rectangles in this map
        for (let startY = 0; startY < height; startY++) {
            for (let startX = 0; startX < width; startX++) {
                // Only process if this pixel is white in this map
                if (whiteMap[startY][startX] === 1) {
                    // Find maximum width
                    let maxWidth = 0;
                    while (startX + maxWidth < width && whiteMap[startY][startX + maxWidth] === 1) {
                        maxWidth++;
                    }
                    
                    // If this potential rectangle is too narrow, skip
                    if (maxWidth < MIN_WIDTH) continue;
                    
                    // Find maximum height for this width
                    let maxHeight = 0;
                    let isRectangle = true;
                    
                    while (isRectangle && startY + maxHeight < height) {
                        for (let x = 0; x < maxWidth; x++) {
                            if (startX + x >= width || 
                                startY + maxHeight >= height || 
                                whiteMap[startY + maxHeight][startX + x] !== 1) {
                                isRectangle = false;
                                break;
                            }
                        }
                        if (isRectangle) maxHeight++;
                    }
                    
                    // If this potential rectangle is too short, skip
                    if (maxHeight < MIN_HEIGHT) continue;
                    
                    // Check aspect ratio
                    const aspectRatio = Math.max(maxWidth / maxHeight, maxHeight / maxWidth);
                    if (aspectRatio > MAX_ASPECT_RATIO) continue;
                    
                    // Calculate whiteness score (percentage of white pixels)
                    let whiteCount = 0;
                    let totalPixels = maxWidth * maxHeight;
                    for (let y = 0; y < maxHeight; y++) {
                        for (let x = 0; x < maxWidth; x++) {
                            if (whiteMap[startY + y][startX + x] === 1) {
                                whiteCount++;
                            }
                        }
                    }
                    const whitenessScore = whiteCount / totalPixels;
                    
                    // Calculate edge score (check for edges around the perimeter)
                    let edgeCount = 0;
                    let perimeterPixels = 2 * (maxWidth + maxHeight) - 4; // -4 to avoid counting corners twice
                    
                    // Check top and bottom edges
                    for (let x = 0; x < maxWidth; x++) {
                        // Top edge
                        if (startY > 0 && edgeMap[startY - 1][startX + x] === 1) {
                            edgeCount++;
                        }
                        // Bottom edge
                        if (startY + maxHeight < height && edgeMap[startY + maxHeight][startX + x] === 1) {
                            edgeCount++;
                        }
                    }
                    
                    // Check left and right edges
                    for (let y = 0; y < maxHeight; y++) {
                        // Left edge
                        if (startX > 0 && edgeMap[startY + y][startX - 1] === 1) {
                            edgeCount++;
                        }
                        // Right edge
                        if (startX + maxWidth < width && edgeMap[startY + y][startX + maxWidth] === 1) {
                            edgeCount++;
                        }
                    }
                    
                    const edgeScore = perimeterPixels > 0 ? edgeCount / perimeterPixels : 0;
                    
                    // Calculate area and overall score
                    const area = maxWidth * maxHeight;
                    const areaScore = area / (width * height); // Normalized by image size
                    
                    // Overall confidence score (weighted combination)
                    const confidence = (
                        whitenessScore * 0.5 + 
                        edgeScore * 0.3 + 
                        areaScore * 0.2
                    );
                    
                    // Add to candidates if confidence is high enough
                    if (confidence > 0.5) {
                        candidates.push({
                            x: startX,
                            y: startY,
                            width: maxWidth,
                            height: maxHeight,
                            area: area,
                            confidence: confidence,
                            whitenessScore: whitenessScore,
                            edgeScore: edgeScore,
                            areaScore: areaScore,
                            mapIndex: mapIndex
                        });
                    }
                    
                    // Skip ahead to avoid finding overlapping rectangles
                    startX += maxWidth - 1;
                }
            }
        }
    });
    
    // Sort candidates by confidence score (descending)
    return candidates.sort((a, b) => b.confidence - a.confidence);
}

function refineBestCandidate(candidates, imageData, width, height) {
    if (candidates.length === 0) return null;
    
    // Get the best candidate
    const best = candidates[0];
    
    // Look for strong corner points to refine the rectangle
    const corners = findCornerPoints(best, imageData, width, height);
    
    if (corners) {
        // Use the refined corners
        return {
            ...best,
            x: corners.topLeft.x,
            y: corners.topLeft.y,
            width: corners.bottomRight.x - corners.topLeft.x,
            height: corners.bottomRight.y - corners.topLeft.y
        };
    }
    
    // If corner refinement fails, return the original candidate
    return best;
}

function findCornerPoints(rect, imageData, width, height) {
    // Search radius for corner refinement
    const searchRadius = Math.min(rect.width, rect.height) * 0.1;
    
    // Define search areas for each corner
    const cornerSearchAreas = {
        topLeft: {
            x: Math.max(0, rect.x - searchRadius),
            y: Math.max(0, rect.y - searchRadius),
            width: searchRadius * 2,
            height: searchRadius * 2
        },
        topRight: {
            x: Math.min(width - 1, rect.x + rect.width - searchRadius),
            y: Math.max(0, rect.y - searchRadius),
            width: searchRadius * 2,
            height: searchRadius * 2
        },
        bottomLeft: {
            x: Math.max(0, rect.x - searchRadius),
            y: Math.min(height - 1, rect.y + rect.height - searchRadius),
            width: searchRadius * 2,
            height: searchRadius * 2
        },
        bottomRight: {
            x: Math.min(width - 1, rect.x + rect.width - searchRadius),
            y: Math.min(height - 1, rect.y + rect.height - searchRadius),
            width: searchRadius * 2,
            height: searchRadius * 2
        }
    };
    
    const data = imageData.data;
    const corners = {};
    
    // Find corners based on color gradients
    for (const corner in cornerSearchAreas) {
        const area = cornerSearchAreas[corner];
        let bestX = 0, bestY = 0, maxGradient = 0;
        
        const endX = Math.min(area.x + area.width, width);
        const endY = Math.min(area.y + area.height, height);
        
        for (let y = area.y; y < endY; y++) {
            for (let x = area.x; x < endX; x++) {
                // Look at surrounding pixels to calculate gradient
                const gradientScore = calculateGradientScore(x, y, data, width, height);
                
                if (gradientScore > maxGradient) {
                    maxGradient = gradientScore;
                    bestX = x;
                    bestY = y;
                }
            }
        }
        
        corners[corner] = { x: bestX, y: bestY };
    }
    
    // Ensure the corners form a proper rectangle
    // Adjust if necessary to make a more rectangular shape
    if (Math.abs(corners.topLeft.x - corners.bottomLeft.x) > searchRadius ||
        Math.abs(corners.topRight.x - corners.bottomRight.x) > searchRadius ||
        Math.abs(corners.topLeft.y - corners.topRight.y) > searchRadius ||
        Math.abs(corners.bottomLeft.y - corners.bottomRight.y) > searchRadius) {
        
        // If corners are too far off, use a simpler approach
        corners.topLeft = { x: rect.x, y: rect.y };
        corners.topRight = { x: rect.x + rect.width, y: rect.y };
        corners.bottomLeft = { x: rect.x, y: rect.y + rect.height };
        corners.bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
    }
    
    return corners;
}

function calculateGradientScore(x, y, data, width, height) {
    // If too close to border, return 0
    if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) return 0;
    
    // Calculate gradient magnitude at this point
    let gradientMagnitude = 0;
    
    // Look at a 3x3 neighborhood
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // Skip the center pixel
            
            const currentIdx = (y * width + x) * 4;
            const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
            
            // Calculate color difference
            const diff = Math.abs(data[currentIdx] - data[neighborIdx]) + 
                          Math.abs(data[currentIdx + 1] - data[neighborIdx + 1]) + 
                          Math.abs(data[currentIdx + 2] - data[neighborIdx + 2]);
            
            gradientMagnitude += diff;
        }
    }
    
    return gradientMagnitude;
}

function addDebugOutline(region, color = 'red', thickness = 2) {
    const debugOutline = document.createElement('div');
    debugOutline.style.position = 'absolute';
    debugOutline.style.border = `${thickness}px dashed ${color}`;
    debugOutline.style.left = region.x + 'px';
    debugOutline.style.top = region.y + 'px';
    debugOutline.style.width = region.width + 'px';
    debugOutline.style.height = region.height + 'px';
    debugOutline.style.pointerEvents = 'none';
    debugOutline.style.zIndex = '1000';
    imageContainer.appendChild(debugOutline);
    
    // Add to the list of debug elements for cleanup
    debugElements.push(debugOutline);
    
    return debugOutline;
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