import { addDebugOutline, clearDebugElements } from './debug.js';

// Shared state
export let canvasRegion = null;
export let outlineVisible = true; // Track outline visibility state

// Store original canvas detection proportions
let canvasProportions = {
    xPercent: 0,
    yPercent: 0,
    widthPercent: 0,
    heightPercent: 0
};

// NEW: Store last image input dimensions used for detection
let detectedImageSize = { width: 0, height: 0 };

/**
 * Updates the canvas region when window is resized
 */
export function updateCanvasRegionOnResize() {
    if (!canvasRegion || detectedImageSize.width === 0 || detectedImageSize.height === 0) return;

    const imageContainer = document.getElementById('image-container');
    const containerRect = imageContainer.getBoundingClientRect();

    // Use the proportions to recalculate canvas region in pixels based on the new container size
    canvasRegion.x = containerRect.width * canvasProportions.xPercent;
    canvasRegion.y = containerRect.height * canvasProportions.yPercent;
    canvasRegion.width = containerRect.width * canvasProportions.widthPercent;
    canvasRegion.height = containerRect.height * canvasProportions.heightPercent;

    // Remove and re-add the debug outline if visible
    clearDebugElements();
    if (outlineVisible) {
        addDebugOutline(canvasRegion, 'red', 3, 1.0);
    }

    // Update any existing resize outline
    updateResizeOutline();
}

/**
 * Updates the resize outline if currently in resize mode
 */
function updateResizeOutline() {
    const resizeOutline = document.querySelector('#image-container > div[style*="dashed"]');
    const resizeControls = document.getElementById('resize-controls');

    if (resizeOutline && canvasRegion) {
        resizeOutline.style.left = `${canvasRegion.x}px`;
        resizeOutline.style.top = `${canvasRegion.y}px`;
        resizeOutline.style.width = `${canvasRegion.width}px`;
        resizeOutline.style.height = `${canvasRegion.height}px`;

        // Move resize controls
        if (resizeControls.style.display !== 'none') {
            resizeControls.style.left = (canvasRegion.x + canvasRegion.width - 80) + 'px';
            resizeControls.style.top = (canvasRegion.y + canvasRegion.height - 40) + 'px';
        }
    }
}

/**
 * Stores canvas proportions relative to container size
 */
export function storeCanvasProportions() {
    if (!canvasRegion) return;

    const imageContainer = document.getElementById('image-container');
    const containerRect = imageContainer.getBoundingClientRect();

    canvasProportions = {
        xPercent: canvasRegion.x / containerRect.width,
        yPercent: canvasRegion.y / containerRect.height,
        widthPercent: canvasRegion.width / containerRect.width,
        heightPercent: canvasRegion.height / containerRect.height
    };
}

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

        // Store the dimensions the detection is based on
        detectedImageSize.width = width;
        detectedImageSize.height = height;

        // 2. White pixel map
        const whiteMap = [];
        let whitePixelCount = 0;
        let brightnessSamples = [];
        for (let y = 0; y < height; y += 5) {
            for (let x = 0; x < width; x += 5) {
                const i = (y * width + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                brightnessSamples.push((r + g + b) / 3);
            }
        }
        brightnessSamples.sort((a, b) => b - a);
        const topPercentileThreshold = brightnessSamples[Math.floor(brightnessSamples.length * 0.05)];

        for (let y = 0; y < height; y++) {
            whiteMap[y] = [];
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                if (isVeryWhite(r, g, b)) {
                    whiteMap[y][x] = 1;
                    whitePixelCount++;
                } else {
                    whiteMap[y][x] = 0;
                }
            }
        }

        if (whitePixelCount < 100) {
            fallbackCanvasDetection();
            return;
        }

        // 3. Morphological ops and region finding (unchanged)
        const dilatedMap = applyMorphologicalOperation(whiteMap, width, height, 'dilate', 3);
        const processedMap = applyMorphologicalOperation(dilatedMap, width, height, 'erode', 2);
        const connectedRegions = findConnectedWhiteRegions(processedMap, width, height);

        if (connectedRegions.length === 0) {
            fallbackCanvasDetection();
            return;
        }

        connectedRegions.sort((a, b) => b.area - a.area);
        let bestCanvasRegion = null;
        let bestScore = 0;

        for (const region of connectedRegions) {
            const wRect = region.maxX - region.minX + 1;
            const hRect = region.maxY - region.minY + 1;
            const aspect = Math.max(wRect / hRect, hRect / wRect);
            const fillRatio = region.area / (wRect * hRect);
            const centerX = region.minX + wRect / 2;
            const centerY = region.minY + hRect / 2;
            const centerDistanceX = Math.abs(centerX - width / 2) / (width / 2);
            const centerDistanceY = Math.abs(centerY - height / 2) / (height / 2);
            const centerScore = 1 - (centerDistanceX + centerDistanceY) / 2;
            const sizeRatio = (wRect * hRect) / (width * height);
            const sizeScore = sizeRatio > 0.05 && sizeRatio < 0.8 ? 1 : 0;
            const score = (
                (aspect < 2 ? 1 : 0) * 0.3 +
                (fillRatio > 0.75 ? 1 : 0) * 0.2 +
                centerScore * 0.3 +
                sizeScore * 0.2
            );
            if (score > bestScore) {
                bestScore = score;
                bestCanvasRegion = region;
            }
        }

        if (!bestCanvasRegion || bestScore < 0.5) {
            bestCanvasRegion = connectedRegions[0];
            if (!isValidCanvasRegion(bestCanvasRegion, width, height)) {
                fallbackCanvasDetection();
                return;
            }
        }

        // 5. Map region to normalized image proportions!
        // Instead of mapping to current DOM px, save normalized positions
        // relative to the detection image (NOT the container)
        const imageX = bestCanvasRegion.minX;
        const imageY = bestCanvasRegion.minY;
        const imageW = bestCanvasRegion.maxX - bestCanvasRegion.minX + 1;
        const imageH = bestCanvasRegion.maxY - bestCanvasRegion.minY + 1;

        // Save px-accurate proportions to the original detection image
        canvasProportions = {
            xPercent: imageX / width,
            yPercent: imageY / height,
            widthPercent: imageW / width,
            heightPercent: imageH / height
        };

        // Now map to DOM container in px
        const imageContainer = document.getElementById('image-container');
        const containerRect = imageContainer.getBoundingClientRect();

        canvasRegion = {
            x: canvasProportions.xPercent * containerRect.width,
            y: canvasProportions.yPercent * containerRect.height,
            width: canvasProportions.widthPercent * containerRect.width,
            height: canvasProportions.heightPercent * containerRect.height
        };

        // Show debug outline
        clearDebugElements();
        addDebugOutline(canvasRegion, 'red', 3, 1.0);

    } catch (e) {
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
    const containerRect = imageContainer.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    const width = containerRect.width * 0.4;
    const height = containerRect.height * 0.5;

    canvasProportions = {
        xPercent: (centerX - width / 2) / containerRect.width,
        yPercent: (centerY - height / 2 - containerRect.height * 0.05) / containerRect.height,
        widthPercent: width / containerRect.width,
        heightPercent: height / containerRect.height
    };

    canvasRegion = {
        x: canvasProportions.xPercent * containerRect.width,
        y: canvasProportions.yPercent * containerRect.height,
        width: canvasProportions.widthPercent * containerRect.width,
        height: canvasProportions.heightPercent * containerRect.height
    };

    clearDebugElements();
    addDebugOutline(canvasRegion, 'orange', 2);
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