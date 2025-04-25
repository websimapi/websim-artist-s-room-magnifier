const imageContainer = document.getElementById('image-container');
const magnifier = document.getElementById('magnifier');

const magnifierSize = 150; // Should match CSS width/height
const zoomLevel = 3; // How much to zoom in
let canvasRegion = null; // Will store the detected canvas coordinates

async function generateAndSetImage() {
    try {
        // Updated prompt to specifically request colored walls (not white)
        const result = await websim.imageGen({
          prompt: "HD hyper realistic artist room with deep blue walls and various art supplies like paints, brushes, palettes, and easels scattered around. In the center, there's a large, blank WHITE canvas on an easel. The canvas should be clearly defined, rectangular, and stand out from its surroundings. Soft, natural light illuminates the scene.",
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

        // Detect canvas region after image loads
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => detectCanvasRegion(img);
        img.src = imageUrl;

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

function detectCanvasRegion(img) {
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
    const threshold = 200; // Threshold for what's considered "white"
    
    for (let y = 0; y < canvas.height; y++) {
        whiteMap[y] = [];
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            // Check if the pixel is white-ish (all RGB values high)
            const isWhite = (
                data[idx] > threshold && 
                data[idx + 1] > threshold && 
                data[idx + 2] > threshold
            );
            whiteMap[y][x] = isWhite ? 1 : 0;
        }
    }
    
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
    }
}

function findLargestWhiteRectangle(grid, width, height) {
    let maxArea = 0;
    let maxRect = null;
    
    // Minimum size requirements for a canvas
    const MIN_WIDTH = width * 0.1; // At least 10% of image width
    const MIN_HEIGHT = height * 0.1; // At least 10% of image height
    
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
                
                // Find maximum height for this width
                let maxHeight = 0;
                let isRectangle = true;
                
                while (isRectangle && startY + maxHeight < height) {
                    for (let x = 0; x < maxWidth; x++) {
                        if (startX + x >= width || 
                            startY + maxHeight >= height || 
                            grid[startY + maxHeight][startX + x] !== 1) {
                            isRectangle = false;
                            break;
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