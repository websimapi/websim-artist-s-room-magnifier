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
        
        // IMPROVED: Get histogram of brightness values to determine white threshold adaptively
        const brightnessHistogram = calculateBrightnessHistogram(data);
        const whiteThresholds = determineWhiteThresholds(brightnessHistogram);
        
        console.log("Adaptive white thresholds:", whiteThresholds);
        
        // Create white pixel maps using adaptive thresholds
        const whiteMaps = createAdaptiveWhiteMaps(data, canvas.width, canvas.height, whiteThresholds);
        
        // Apply improved edge detection
        const edgeMap = enhancedEdgeDetection(data, canvas.width, canvas.height);
        
        // Find canvas candidates with improved algorithm
        const candidates = findCanvasCandidatesImproved(whiteMaps, edgeMap, data, canvas.width, canvas.height);
        
        if (candidates.length > 0) {
            // Visualize all candidates for debugging
            candidates.forEach((candidate, i) => {
                const opacity = 0.5 - (i * 0.1); // Decreasing opacity for lower-ranked candidates
                addDebugOutline(candidate, i === 0 ? 'yellow' : 'orange', 1, opacity);
            });
            
            // Get the best candidate
            const bestCandidate = candidates[0];
            
            // Refine the corners of the best candidate for more precise detection
            const refinedCanvas = refineCanvasCorners(bestCandidate, data, canvas.width, canvas.height);
            
            // Convert to relative coordinates for the container
            const containerRect = imageContainer.getBoundingClientRect();
            const scaleX = containerRect.width / canvas.width;
            const scaleY = containerRect.height / canvas.height;
            
            canvasRegion = {
                x: refinedCanvas.x * scaleX,
                y: refinedCanvas.y * scaleY,
                width: refinedCanvas.width * scaleX,
                height: refinedCanvas.height * scaleY
            };
            
            // Visualize the final refined canvas
            addDebugOutline(canvasRegion, 'red', 2, 1.0);
            console.log("Canvas detected:", canvasRegion);
        } else {
            console.log("Canvas not detected, using fallback");
            fallbackCanvasDetection();
        }
    } catch (error) {
        console.error("Error in canvas detection:", error);
        fallbackCanvasDetection();
    }
}

function calculateBrightnessHistogram(data) {
    // Create histogram of brightness values (0-255)
    const histogram = new Array(256).fill(0);
    
    for (let i = 0; i < data.length; i += 4) {
        // Calculate brightness using perceived luminance formula
        const brightness = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
        histogram[brightness]++;
    }
    
    return histogram;
}

function determineWhiteThresholds(histogram) {
    // Find peaks in the higher brightness range
    const totalPixels = histogram.reduce((sum, count) => sum + count, 0);
    let cumulativeSum = 0;
    
    // Look for brightness values that represent the top 15%, 10%, and 5% brightest pixels
    const thresholds = [];
    
    for (let i = 255; i >= 0; i--) {
        cumulativeSum += histogram[i];
        const percentile = cumulativeSum / totalPixels;
        
        if (thresholds.length === 0 && percentile >= 0.05) {
            thresholds.push({ threshold: i, percentile: 0.05 });
        } else if (thresholds.length === 1 && percentile >= 0.10) {
            thresholds.push({ threshold: i, percentile: 0.10 });
        } else if (thresholds.length === 2 && percentile >= 0.15) {
            thresholds.push({ threshold: i, percentile: 0.15 });
            break;
        }
    }
    
    // If we couldn't find good thresholds, use defaults
    if (thresholds.length < 3) {
        return [
            { r: 230, g: 230, b: 230 },  // Very white
            { r: 210, g: 210, b: 210 },  // Less white
            { r: 190, g: 190, b: 190 }   // Even less white
        ];
    }
    
    // Convert brightness thresholds to RGB thresholds
    return thresholds.map(t => ({
        r: t.threshold,
        g: t.threshold,
        b: t.threshold
    }));
}

function createAdaptiveWhiteMaps(data, width, height, thresholds) {
    const maps = [];
    
    thresholds.forEach(threshold => {
        const map = new Array(height);
        for (let y = 0; y < height; y++) {
            map[y] = new Array(width).fill(0);
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                // Check if pixel is white-ish
                // Also check for high brightness and low saturation (characteristic of white)
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                // Calculate HSV to better identify white (high value, low saturation)
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;
                const saturation = max === 0 ? 0 : delta / max;
                
                // A pixel is white if:
                // 1. All RGB values are above threshold
                // 2. It has low saturation (close to grayscale)
                // 3. Color channels are close to each other (indicating grayscale)
                const isWhite = 
                    (r >= threshold.r && g >= threshold.g && b >= threshold.b) &&
                    (saturation < 0.15) && // Low saturation
                    (Math.abs(r - g) < 15 && Math.abs(r - b) < 15 && Math.abs(g - b) < 15); // Color channels are close
                
                map[y][x] = isWhite ? 1 : 0;
            }
        }
        maps.push(map);
    });
    
    return maps;
}

function enhancedEdgeDetection(data, width, height) {
    // Improved edge detection using Sobel-like operator
    const edgeMap = Array(height).fill().map(() => Array(width).fill(0));
    const sobelThreshold = 40; // Threshold for edge detection
    
    // Process inner pixels (exclude borders)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            // Sobel kernels for x and y direction
            let gx = 0;
            let gy = 0;
            
            // 3x3 grid around current pixel
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const idx = ((y + dy) * width + (x + dx)) * 4;
                    
                    // Calculate grayscale value
                    const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                    
                    // Apply Sobel weights
                    // For x direction
                    if (dx === -1) gx -= gray * (dy === 0 ? 2 : 1);
                    if (dx === 1) gx += gray * (dy === 0 ? 2 : 1);
                    
                    // For y direction
                    if (dy === -1) gy -= gray * (dx === 0 ? 2 : 1);
                    if (dy === 1) gy += gray * (dx === 0 ? 2 : 1);
                }
            }
            
            // Calculate gradient magnitude
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            
            // Apply threshold
            edgeMap[y][x] = magnitude > sobelThreshold ? 1 : 0;
        }
    }
    
    return edgeMap;
}

function findCanvasCandidatesImproved(whiteMaps, edgeMap, imageData, width, height) {
    const candidates = [];
    const data = imageData.data;
    
    // Minimum acceptable canvas dimensions
    const MIN_WIDTH = width * 0.08;
    const MIN_HEIGHT = height * 0.08;
    const MAX_ASPECT_RATIO = 2.0;
    
    // Process each white map (from strict to lenient thresholds)
    whiteMaps.forEach((whiteMap, mapIndex) => {
        // Use connected component analysis to find white regions
        const regions = findConnectedWhiteRegions(whiteMap, width, height);
        
        // Filter and score regions
        regions.forEach(region => {
            // Skip if too small
            if (region.width < MIN_WIDTH || region.height < MIN_HEIGHT) return;
            
            // Check aspect ratio
            const aspectRatio = Math.max(region.width / region.height, region.height / region.width);
            if (aspectRatio > MAX_ASPECT_RATIO) return;
            
            // Calculate additional quality scores
            const scores = calculateRegionScores(region, whiteMap, edgeMap, data, width, height);
            
            // Add to candidates if scores are good enough
            if (scores.totalScore > 0.6) {
                candidates.push({
                    x: region.x,
                    y: region.y,
                    width: region.width,
                    height: region.height,
                    ...scores,
                    mapIndex: mapIndex
                });
            }
        });
    });
    
    // Sort by total score (descending)
    return candidates.sort((a, b) => b.totalScore - a.totalScore);
}

function findConnectedWhiteRegions(whiteMap, width, height) {
    const visited = Array(height).fill().map(() => Array(width).fill(false));
    const regions = [];
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (whiteMap[y][x] === 1 && !visited[y][x]) {
                // Found a new white region
                const region = {
                    pixels: [],
                    minX: width,
                    minY: height,
                    maxX: 0,
                    maxY: 0
                };
                
                // Use BFS to find connected white pixels
                const queue = [{x, y}];
                visited[y][x] = true;
                
                while (queue.length > 0) {
                    const pixel = queue.shift();
                    region.pixels.push(pixel);
                    
                    // Update region bounds
                    region.minX = Math.min(region.minX, pixel.x);
                    region.minY = Math.min(region.minY, pixel.y);
                    region.maxX = Math.max(region.maxX, pixel.x);
                    region.maxY = Math.max(region.maxY, pixel.y);
                    
                    // Check neighbors (4-connectivity)
                    const neighbors = [
                        {x: pixel.x + 1, y: pixel.y},
                        {x: pixel.x - 1, y: pixel.y},
                        {x: pixel.x, y: pixel.y + 1},
                        {x: pixel.x, y: pixel.y - 1}
                    ];
                    
                    neighbors.forEach(neighbor => {
                        if (neighbor.x >= 0 && neighbor.x < width && 
                            neighbor.y >= 0 && neighbor.y < height && 
                            whiteMap[neighbor.y][neighbor.x] === 1 && 
                            !visited[neighbor.y][neighbor.x]) {
                            
                            queue.push(neighbor);
                            visited[neighbor.y][neighbor.x] = true;
                        }
                    });
                }
                
                // Calculate region properties
                region.x = region.minX;
                region.y = region.minY;
                region.width = region.maxX - region.minX + 1;
                region.height = region.maxY - region.minY + 1;
                region.area = region.pixels.length;
                region.density = region.area / (region.width * region.height);
                
                // Only add regions with good density (filled rectangles, not sparse regions)
                if (region.density > 0.7) {
                    regions.push(region);
                }
            }
        }
    }
    
    return regions;
}

function calculateRegionScores(region, whiteMap, edgeMap, imageData, width, height) {
    // Calculate various scores to determine the likelihood of being a canvas
    
    // 1. Edge strength around perimeter
    let edgeStrength = 0;
    let perimeterPixels = 0;
    
    // Check top and bottom edges
    for (let x = region.x; x < region.x + region.width; x++) {
        // Top edge
        if (region.y > 0 && edgeMap[region.y - 1][x] === 1) edgeStrength++;
        // Bottom edge
        if (region.y + region.height < height && edgeMap[region.y + region.height][x] === 1) edgeStrength++;
        perimeterPixels += 2;
    }
    
    // Check left and right edges
    for (let y = region.y; y < region.y + region.height; y++) {
        // Left edge
        if (region.x > 0 && edgeMap[y][region.x - 1] === 1) edgeStrength++;
        // Right edge
        if (region.x + region.width < width && edgeMap[y][region.x + region.width] === 1) edgeStrength++;
        perimeterPixels += 2;
    }
    
    const edgeScore = perimeterPixels > 0 ? edgeStrength / perimeterPixels : 0;
    
    // 2. Whiteness score (how consistently white is the region)
    let whiteSum = 0;
    let pixelCount = 0;
    
    for (let y = region.y; y < region.y + region.height; y++) {
        for (let x = region.x; x < region.x + region.width; x++) {
            if (x < width && y < height) { // Safety check
                const idx = (y * width + x) * 4;
                const brightness = (imageData[idx] + imageData[idx + 1] + imageData[idx + 2]) / 3;
                whiteSum += brightness;
                pixelCount++;
            }
        }
    }
    
    const avgBrightness = pixelCount > 0 ? whiteSum / pixelCount / 255 : 0;
    
    // 3. Rectangularity score (how rectangular is the region)
    const expectedArea = region.width * region.height;
    const actualArea = region.area;
    const rectangularityScore = expectedArea > 0 ? actualArea / expectedArea : 0;
    
    // 4. Position score (prefer canvas near center)
    const centerX = width / 2;
    const centerY = height / 2;
    const regionCenterX = region.x + region.width / 2;
    const regionCenterY = region.y + region.height / 2;
    
    const distanceFromCenter = Math.sqrt(
        Math.pow(regionCenterX - centerX, 2) + 
        Math.pow(regionCenterY - centerY, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
    const positionScore = 1 - (distanceFromCenter / maxDistance);
    
    // 5. Size score (prefer larger canvases, but not too big)
    const relativeSizeScore = (region.width * region.height) / (width * height);
    let sizeScore = 0;
    if (relativeSizeScore > 0.05 && relativeSizeScore < 0.5) {
        sizeScore = 1 - Math.abs(0.2 - relativeSizeScore) / 0.2; // Optimal size around 20% of image
        sizeScore = Math.max(0, Math.min(1, sizeScore)); // Clamp between 0 and 1
    }
    
    // Combine scores with weights
    const totalScore = 
        avgBrightness * 0.4 +
        edgeScore * 0.2 + 
        rectangularityScore * 0.15 + 
        positionScore * 0.15 + 
        sizeScore * 0.1;
    
    return {
        edgeScore,
        whitenessScore: avgBrightness,
        rectangularityScore,
        positionScore,
        sizeScore,
        totalScore
    };
}

function refineCanvasCorners(candidate, imageData, width, height) {
    // Get initial bounds
    const { x, y, width: rectWidth, height: rectHeight } = candidate;
    
    // Define search areas around expected corners
    const cornerSearchRadius = Math.min(rectWidth, rectHeight) * 0.1;
    
    // Find the most likely corner points by examining color gradients
    const corners = {
        topLeft: findExactCorner(x, y, -1, -1, cornerSearchRadius, imageData, width, height),
        topRight: findExactCorner(x + rectWidth, y, 1, -1, cornerSearchRadius, imageData, width, height),
        bottomLeft: findExactCorner(x, y + rectHeight, -1, 1, cornerSearchRadius, imageData, width, height),
        bottomRight: findExactCorner(x + rectWidth, y + rectHeight, 1, 1, cornerSearchRadius, imageData, width, height)
    };
    
    // Convert corner points to refined rectangle
    const refinedX = Math.min(corners.topLeft.x, corners.bottomLeft.x);
    const refinedY = Math.min(corners.topLeft.y, corners.topRight.y);
    const refinedWidth = Math.max(
        Math.abs(corners.topRight.x - corners.topLeft.x),
        Math.abs(corners.bottomRight.x - corners.bottomLeft.x)
    );
    const refinedHeight = Math.max(
        Math.abs(corners.bottomLeft.y - corners.topLeft.y),
        Math.abs(corners.bottomRight.y - corners.topRight.y)
    );
    
    return {
        x: refinedX,
        y: refinedY,
        width: refinedWidth,
        height: refinedHeight,
        confidence: candidate.totalScore
    };
}

function findExactCorner(centerX, centerY, dirX, dirY, radius, imageData, width, height) {
    // Look for the corner point with the strongest gradient in the given search area
    let bestX = centerX;
    let bestY = centerY;
    let maxGradient = 0;
    
    const startX = Math.max(0, Math.floor(centerX - (dirX === -1 ? radius : 0)));
    const endX = Math.min(width - 1, Math.ceil(centerX + (dirX === 1 ? radius : 0)));
    const startY = Math.max(0, Math.floor(centerY - (dirY === -1 ? radius : 0)));
    const endY = Math.min(height - 1, Math.ceil(centerY + (dirY === 1 ? radius : 0)));
    
    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            // Calculate gradient strength at this point
            const gradient = calculateCornerStrength(x, y, imageData, width, height);
            
            if (gradient > maxGradient) {
                maxGradient = gradient;
                bestX = x;
                bestY = y;
            }
        }
    }
    
    return { x: bestX, y: bestY };
}

function calculateCornerStrength(x, y, imageData, width, height) {
    // Safety bounds check
    if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return 0;
    
    const data = imageData.data;
    let gradientSum = 0;
    
    // Check 8 surrounding pixels
    const directions = [
        {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
        {dx: -1, dy: 0},                   {dx: 1, dy: 0},
        {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
    ];
    
    const centerIdx = (y * width + x) * 4;
    const centerColor = {
        r: data[centerIdx],
        g: data[centerIdx + 1],
        b: data[centerIdx + 2]
    };
    
    directions.forEach(({dx, dy}) => {
        const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
        
        // Calculate color difference
        const dr = Math.abs(centerColor.r - data[neighborIdx]);
        const dg = Math.abs(centerColor.g - data[neighborIdx + 1]);
        const db = Math.abs(centerColor.b - data[neighborIdx + 2]);
        
        gradientSum += dr + dg + db;
    });
    
    return gradientSum;
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