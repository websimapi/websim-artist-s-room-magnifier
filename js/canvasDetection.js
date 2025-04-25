import { addDebugOutline } from './debug.js';

// Shared state
export let canvasRegion = null;
export let canvasRegionRelative = null; // Store relative position (percentages)
export let outlineVisible = true; // Export this so other modules can access it

/**
 * Detects the canvas region in an image
 */
export function detectCanvasRegion(img) {
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
        const imageContainer = document.getElementById('image-container');
        const containerRect = imageContainer.getBoundingClientRect();
        const scaleX = containerRect.width / width;
        const scaleY = containerRect.height / height;
        
        canvasRegion = {
            x: bestCanvasRegion.minX * scaleX,
            y: bestCanvasRegion.minY * scaleY,
            width: (bestCanvasRegion.maxX - bestCanvasRegion.minX + 1) * scaleX,
            height: (bestCanvasRegion.maxY - bestCanvasRegion.minY + 1) * scaleY,
        };

        // Store relative positions as percentages
        canvasRegionRelative = {
            xPercent: canvasRegion.x / containerRect.width,
            yPercent: canvasRegion.y / containerRect.height,
            widthPercent: canvasRegion.width / containerRect.width,
            heightPercent: canvasRegion.height / containerRect.height
        };
        
        console.log('Canvas detected:', canvasRegion, bestCanvasRegion);
        console.log('Canvas relative position:', canvasRegionRelative);

        // Show debug outline
        addDebugOutline(canvasRegion, 'red', 3, 1.0);

    } catch (e) {
        console.error("Canvas detection error", e);
        fallbackCanvasDetection();
    }
}

/**
 * Determines if a pixel is very white (or off-white)
 */
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

/**
 * Applies morphological operations (dilate/erode) to a binary image
 */
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

/**
 * Finds connected white regions using flood fill algorithm
 */
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

/**
 * Validates if a region can be a canvas
 */
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

/**
 * Fallback canvas detection when automated detection fails
 */
export function fallbackCanvasDetection() {
    const imageContainer = document.getElementById('image-container');
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
    
    // Store relative positions as percentages
    canvasRegionRelative = {
        xPercent: canvasRegion.x / containerRect.width,
        yPercent: canvasRegion.y / containerRect.height,
        widthPercent: canvasRegion.width / containerRect.width,
        heightPercent: canvasRegion.height / containerRect.height
    };
    
    console.log("Using fallback canvas region:", canvasRegion);
    
    // Add visualization for the fallback region
    addDebugOutline(canvasRegion, 'orange', 2);
    console.log('Canvas relative position:', canvasRegionRelative);
}

/**
 * Updates the canvas region based on relative position
 * Returns true if the update was successful
 */
export function updateCanvasRegionFromRelative() {
    if (!canvasRegionRelative) return false;
    
    const imageContainer = document.getElementById('image-container');
    
    // Wait for container to have actual dimensions
    const containerRect = imageContainer.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
        console.warn("Container has zero dimensions, can't update canvas region");
        return false;
    }
    
    // Create canvasRegion if it doesn't exist
    if (!canvasRegion) {
        canvasRegion = {};
    }
    
    // Update absolute positions based on current container size
    canvasRegion.x = Math.round(canvasRegionRelative.xPercent * containerRect.width);
    canvasRegion.y = Math.round(canvasRegionRelative.yPercent * containerRect.height);
    canvasRegion.width = Math.round(canvasRegionRelative.widthPercent * containerRect.width);
    canvasRegion.height = Math.round(canvasRegionRelative.heightPercent * containerRect.height);
    
    console.log('Updated canvas region from relative:', canvasRegion);
    return true;
}

/**
 * Updates the relative canvas region from absolute coordinates
 */
export function updateRelativeFromCanvasRegion() {
    if (!canvasRegion) return false;
    
    const imageContainer = document.getElementById('image-container');
    
    // Wait for container to have actual dimensions
    const containerRect = imageContainer.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
        console.warn("Container has zero dimensions, can't update relative canvas region");
        return false;
    }
    
    // Create canvasRegionRelative if it doesn't exist
    if (!canvasRegionRelative) {
        canvasRegionRelative = {};
    }
    
    // Calculate relative positions with higher precision
    canvasRegionRelative.xPercent = canvasRegion.x / containerRect.width;
    canvasRegionRelative.yPercent = canvasRegion.y / containerRect.height;
    canvasRegionRelative.widthPercent = canvasRegion.width / containerRect.width;
    canvasRegionRelative.heightPercent = canvasRegion.height / containerRect.height;
    
    console.log('Updated relative position:', canvasRegionRelative);
    return true;
}

/**
 * Checks if a point is inside the canvas region
 */
export function isPointInCanvas(x, y) {
    if (!canvasRegion) return false;
    
    return (
        x >= canvasRegion.x && 
        x <= canvasRegion.x + canvasRegion.width &&
        y >= canvasRegion.y && 
        y <= canvasRegion.y + canvasRegion.height
    );
}