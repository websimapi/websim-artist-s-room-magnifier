const imageContainer = document.getElementById('image-container');
const magnifier = document.getElementById('magnifier');

const magnifierSize = 150; // Should match CSS width/height
const zoomLevel = 3; // How much to zoom in
let canvasRegion = null; // Will store the detected canvas coordinates
let originalImageUrl = null; // Store the original URL
let canvasShape = null; // Will store the canvas shape points for irregular shapes

async function generateAndSetImage() {
    try {
        // Updated prompt to emphasize PURE WHITE SOLID CANVAS with clearer instructions
        const result = await websim.imageGen({
          prompt: "HD hyper realistic artist room with rich red walls and various art supplies like paints, brushes, and easels. In the center, there's a prominent, PURE SOLID WHITE canvas on an easel, with absolutely no markings on the canvas surface. The canvas must be perfectly white (RGB 255,255,255) with sharp boundaries against its surroundings. No other white elements should be in the room besides the canvas. The room should have good lighting but avoid strong reflections on the canvas.",
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
        // Clear any previous visualizations
        const existingVisualizations = document.querySelectorAll('.canvas-visualization');
        existingVisualizations.forEach(el => el.remove());
        
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
        // More lenient thresholds to detect near-white pixels
        const threshold = 190; // Lower to catch more off-white pixels
        const colorVarianceThreshold = 30; // Higher to allow more variance in white shades
        
        for (let y = 0; y < canvas.height; y++) {
            whiteMap[y] = [];
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                
                // Check if the pixel is white-ish using multiple criteria
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                const brightness = (r + g + b) / 3;
                const colorVariance = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
                
                // More lenient criteria for what counts as white
                const isWhite = (
                    // High RGB values with acceptable variance
                    (r > threshold && g > threshold && b > threshold && colorVariance < colorVarianceThreshold) ||
                    // Very high brightness with reasonable color balance
                    (brightness > 230 && colorVariance < 25) ||
                    // Very close to white
                    (r > 245 && g > 245 && b > 245)
                );
                
                whiteMap[y][x] = isWhite ? 1 : 0;
            }
        }
        
        // Apply smoothing to fill small gaps
        smoothWhiteMap(whiteMap, canvas.width, canvas.height, 2); // Increased smoothing passes
        
        // Try to find canvas using connected component analysis first
        const canvasComponents = findCanvasComponents(whiteMap, canvas.width, canvas.height);
        
        if (canvasComponents && canvasComponents.length > 0) {
            console.log("Canvas shapes detected:", canvasComponents.length);
            
            // Sort by area (largest first)
            canvasComponents.sort((a, b) => b.area - a.area);
            
            // Get the largest component as our canvas
            const largestComponent = canvasComponents[0];
            
            // Convert to relative coordinates for the container
            const containerRect = imageContainer.getBoundingClientRect();
            const scaleX = containerRect.width / canvas.width;
            const scaleY = containerRect.height / canvas.height;
            
            // Store the canvas shape points for precise hover detection
            canvasShape = largestComponent.points.map(point => ({
                x: point.x * scaleX,
                y: point.y * scaleY
            }));
            
            // Create a bounding box for the shape
            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
            
            for (const point of largestComponent.points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
            
            canvasRegion = {
                x: minX * scaleX,
                y: minY * scaleY,
                width: (maxX - minX) * scaleX,
                height: (maxY - minY) * scaleY
            };
            
            // Visualize only the polygon shape with green outline
            visualizeCanvasShape(canvasShape);
        } else {
            // Fallback to the original rectangle detection method
            const result = findLargestWhiteRectangle(whiteMap, canvas.width, canvas.height);
            
            if (result) {
                console.log("Canvas detected as rectangle:", result);
                
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
                
                // Add visualization - only rectangle in this case with green outline
                const debugOutline = document.createElement('div');
                debugOutline.className = 'canvas-visualization';
                debugOutline.style.position = 'absolute';
                debugOutline.style.border = '2px dashed green';
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
        }
    } catch (error) {
        console.error("Error in canvas detection:", error);
        fallbackCanvasDetection();
    }
}

function smoothWhiteMap(whiteMap, width, height, passes = 1) {
    for (let pass = 0; pass < passes; pass++) {
        // Create a copy of the white map
        const smoothedMap = [];
        for (let y = 0; y < height; y++) {
            smoothedMap[y] = [...whiteMap[y]];
        }
        
        // More aggressive smoothing: more neighbors = white
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
                
                // If 4 or more neighbors are white, make this pixel white too
                if (whiteNeighbors >= 4) {
                    smoothedMap[y][x] = 1;
                }
            }
        }
        
        // Copy the smoothed map back to the original
        for (let y = 0; y < height; y++) {
            whiteMap[y] = [...smoothedMap[y]];
        }
    }
}

function findCanvasComponents(whiteMap, width, height) {
    // Implementation of connected components analysis to find white areas
    const visited = Array(height).fill().map(() => Array(width).fill(false));
    const components = [];
    
    // Minimum area for a component to be considered a canvas
    const MIN_AREA = width * height * 0.005; // Reduced to 0.5% of image area to catch smaller canvases
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (whiteMap[y][x] === 1 && !visited[y][x]) {
                // Found a new component
                const component = {
                    points: [],
                    area: 0
                };
                
                // Use flood fill to find all connected white pixels
                const queue = [{x, y}];
                visited[y][x] = true;
                
                while (queue.length > 0) {
                    const current = queue.shift();
                    component.points.push(current);
                    component.area++;
                    
                    // Check 8-connected neighbors
                    const directions = [
                        {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
                        {dx: -1, dy: 0},                   {dx: 1, dy: 0},
                        {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
                    ];
                    
                    for (const dir of directions) {
                        const nx = current.x + dir.dx;
                        const ny = current.y + dir.dy;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
                            whiteMap[ny][nx] === 1 && !visited[ny][nx]) {
                            queue.push({x: nx, y: ny});
                            visited[ny][nx] = true;
                        }
                    }
                }
                
                // Only consider components that are large enough
                if (component.area >= MIN_AREA) {
                    components.push(component);
                }
            }
        }
    }
    
    return components;
}

function visualizeCanvasShape(points) {
    // Remove any previous visualizations
    const existingVisualizations = document.querySelectorAll('.canvas-visualization');
    existingVisualizations.forEach(el => el.remove());
    
    // Create an SVG to visualize the actual shape
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.className = 'canvas-visualization';
    svg.setAttribute("style", "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;");
    
    // Create a polygon from the points
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');
    polygon.setAttribute("points", pointsString);
    polygon.setAttribute("style", "fill: rgba(0, 0, 0, 0); stroke: green; stroke-width: 2;");
    
    svg.appendChild(polygon);
    imageContainer.appendChild(svg);
}

function findLargestWhiteRectangle(whiteMap, width, height) {
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
            if (whiteMap[startY][startX] === 1) {
                // Find maximum width
                let maxWidth = 0;
                while (startX + maxWidth < width && whiteMap[startY][startX + maxWidth] === 1) {
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
                        if (whiteMap[startY + maxHeight][startX + x] !== 1) {
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

function fallbackCanvasDetection() {
    // Clear any previous visualizations first
    const existingVisualizations = document.querySelectorAll('.canvas-visualization');
    existingVisualizations.forEach(el => el.remove());
    
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
    
    // Add visualization for the fallback region with green outline (not orange)
    const debugOutline = document.createElement('div');
    debugOutline.className = 'canvas-visualization';
    debugOutline.style.position = 'absolute';
    debugOutline.style.border = '2px dashed green';
    debugOutline.style.left = canvasRegion.x + 'px';
    debugOutline.style.top = canvasRegion.y + 'px';
    debugOutline.style.width = canvasRegion.width + 'px';
    debugOutline.style.height = canvasRegion.height + 'px';
    debugOutline.style.pointerEvents = 'none';
    debugOutline.style.zIndex = '10';
    imageContainer.appendChild(debugOutline);
}

function isPointInCanvas(x, y) {
    // First check if there's a specific canvas shape detected
    if (canvasShape && canvasShape.length > 0) {
        return isPointInPolygon(x, y, canvasShape);
    }
    
    // Fallback to bounding box check
    if (!canvasRegion) return false;
    
    return (
        x >= canvasRegion.x && 
        x <= canvasRegion.x + canvasRegion.width &&
        y >= canvasRegion.y && 
        y <= canvasRegion.y + canvasRegion.height
    );
}

function isPointInPolygon(x, y, polygon) {
    // Ray-casting algorithm to determine if a point is inside a polygon
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
        if (intersect) inside = !inside;
    }
    
    return inside;
}

function moveMagnifier(e) {
    // Get cursor position within the viewport
    const clientX = e.clientX;
    const clientY = e.clientY;

    // Get the size and position of the container
    const rect = imageContainer.getBoundingClientRect();

    // Calculate cursor position relative to the container
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Debug - log cursor position and whether it's in canvas (uncomment if needed)
    // console.log(`Cursor at ${x},${y}, isInCanvas: ${isPointInCanvas(x, y)}`);

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
    const containerWidth = rect.width;
    const containerHeight = rect.height;
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