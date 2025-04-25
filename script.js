const imageContainer = document.getElementById('image-container');
const magnifier = document.getElementById('magnifier');

const magnifierSize = 150; // Should match CSS width/height
const zoomLevel = 3; // How much to zoom in

// Canvas detection variables
let canvasRegion = null; // Will store the detected canvas coordinates

async function generateAndSetImage() {
    try {
        // Requesting HD-like dimensions. The actual size might vary.
        const result = await websim.imageGen({
          prompt: "HD hyper realistic artist room with various art supplies like paints, brushes, palettes, and easels scattered around. In the center, there's a large, blank white canvas on an easel. Soft, natural light illuminates the scene.",
          aspect_ratio: "16:9", // Good for full screen
        });
        const imageUrl = result.url;

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
        
        // Detect the canvas after image loads
        detectCanvas(imageUrl);

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

async function detectCanvas(imageUrl) {
    return new Promise((resolve) => {
        // Create a temporary image to load the generated image
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = function() {
            // Create a temporary canvas to analyze the image
            const tempCanvas = document.createElement('canvas');
            const containerWidth = imageContainer.offsetWidth;
            const containerHeight = imageContainer.offsetHeight;
            tempCanvas.width = containerWidth;
            tempCanvas.height = containerHeight;
            
            // Draw the image to the canvas, matching how it appears in the container
            const ctx = tempCanvas.getContext('2d');
            
            // Draw image to fit container while maintaining aspect ratio
            const imgAspect = img.width / img.height;
            const containerAspect = containerWidth / containerHeight;
            
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (containerAspect > imgAspect) {
                drawWidth = containerHeight * imgAspect;
                drawHeight = containerHeight;
                offsetX = (containerWidth - drawWidth) / 2;
            } else {
                drawWidth = containerWidth;
                drawHeight = containerWidth / imgAspect;
                offsetY = (containerHeight - drawHeight) / 2;
            }
            
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
            // Find the largest white area (the canvas)
            findLargestWhiteArea(ctx, containerWidth, containerHeight);
            resolve();
        };
        img.src = imageUrl;
    });
}

function findLargestWhiteArea(ctx, width, height) {
    // Simplification: Assume the canvas is near the center and scan for white regions
    // Create a grid to analyze the image
    const gridSize = 20; // pixels per grid cell
    const gridWidth = Math.ceil(width / gridSize);
    const gridHeight = Math.ceil(height / gridSize);
    
    let whiteAreas = [];
    
    // Scan the image in grid cells
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const pixelX = x * gridSize;
            const pixelY = y * gridSize;
            
            // Skip edges
            if (pixelX >= width - gridSize || pixelY >= height - gridSize) continue;
            
            // Sample the center of each grid cell
            const data = ctx.getImageData(pixelX + gridSize/2, pixelY + gridSize/2, 1, 1).data;
            
            // Check if the pixel is white-ish (high values for all RGB)
            if (data[0] > 230 && data[1] > 230 && data[2] > 230) {
                // Expand to find the rectangular white region
                const region = expandWhiteRegion(ctx, pixelX, pixelY, width, height);
                if (region) {
                    whiteAreas.push(region);
                }
            }
        }
    }
    
    // Find the largest white area by area size
    if (whiteAreas.length > 0) {
        whiteAreas.sort((a, b) => {
            const areaA = (a.right - a.left) * (a.bottom - a.top);
            const areaB = (b.right - b.left) * (b.bottom - b.top);
            return areaB - areaA; // Descending order
        });
        
        canvasRegion = whiteAreas[0];
        console.log("Detected canvas region:", canvasRegion);
    } else {
        // Fallback: guess the canvas is in the center
        const centerX = width / 2;
        const centerY = height / 2;
        canvasRegion = {
            left: centerX - width * 0.15,
            right: centerX + width * 0.15,
            top: centerY - height * 0.2,
            bottom: centerY + height * 0.1
        };
        console.log("Using fallback canvas region:", canvasRegion);
    }
}

function expandWhiteRegion(ctx, startX, startY, maxWidth, maxHeight) {
    // Start with a minimum sized region
    let left = startX;
    let right = startX + 1;
    let top = startY;
    let bottom = startY + 1;
    
    // Threshold for white detection
    const threshold = 230;
    
    // Expand right
    while (right < maxWidth) {
        const data = ctx.getImageData(right, startY, 1, 1).data;
        if (data[0] < threshold || data[1] < threshold || data[2] < threshold) {
            break;
        }
        right++;
    }
    
    // Expand left
    while (left > 0) {
        const data = ctx.getImageData(left, startY, 1, 1).data;
        if (data[0] < threshold || data[1] < threshold || data[2] < threshold) {
            break;
        }
        left--;
    }
    
    // Expand down
    while (bottom < maxHeight) {
        let isRowWhite = true;
        for (let x = left; x < right; x += 5) { // Sample every 5 pixels
            const data = ctx.getImageData(x, bottom, 1, 1).data;
            if (data[0] < threshold || data[1] < threshold || data[2] < threshold) {
                isRowWhite = false;
                break;
            }
        }
        if (!isRowWhite) break;
        bottom++;
    }
    
    // Expand up
    while (top > 0) {
        let isRowWhite = true;
        for (let x = left; x < right; x += 5) { // Sample every 5 pixels
            const data = ctx.getImageData(x, top, 1, 1).data;
            if (data[0] < threshold || data[1] < threshold || data[2] < threshold) {
                isRowWhite = false;
                break;
            }
        }
        if (!isRowWhite) break;
        top--;
    }
    
    // Calculate area and minimum dimensions
    const width = right - left;
    const height = bottom - top;
    const area = width * height;
    
    // Only return if it's a reasonably sized rectangle (not tiny noise)
    if (width > 20 && height > 20 && area > 1000) {
        return { left, right, top, bottom };
    }
    return null;
}

function isOverCanvas(x, y) {
    if (!canvasRegion) return false;
    
    return (
        x >= canvasRegion.left && 
        x <= canvasRegion.right && 
        y >= canvasRegion.top && 
        y <= canvasRegion.bottom
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

    // Check if mouse is over the canvas
    if (isOverCanvas(x, y)) {
        // If over canvas, hide the magnifier and change cursor
        magnifier.style.display = 'none';
        imageContainer.style.cursor = 'default'; // Show regular cursor
        return;
    }

    // Otherwise, show magnifier and hide cursor
    imageContainer.style.cursor = 'none';

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

imageContainer.addEventListener('mouseenter', (event) => {
    // Initial background size calculation might be needed here if the image loads late
    // but we'll rely on the initial generation setting it correctly for now.
     if (magnifier.style.backgroundImage) { // Only show if image is loaded
       // Don't automatically show - let moveMagnifier determine if we're over canvas
       moveMagnifier(event); 
     }
});

imageContainer.addEventListener('mouseleave', () => {
    magnifier.style.display = 'none';
});

// Generate the image when the script loads
generateAndSetImage();

// Optional: Recalculate background size on window resize
window.addEventListener('resize', () => {
    if (magnifier.style.backgroundImage) {
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        magnifier.style.backgroundSize = `${containerWidth * zoomLevel}px ${containerHeight * zoomLevel}px`;
        
        // Re-detect canvas on resize
        if (imageContainer.style.backgroundImage) {
            const imageUrl = imageContainer.style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
            detectCanvas(imageUrl);
        }
    }
});