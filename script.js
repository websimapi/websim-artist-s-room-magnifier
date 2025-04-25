const imageContainer = document.getElementById('image-container');
const magnifier = document.getElementById('magnifier');
const brushCursor = document.getElementById('brush-cursor');
const analysisCanvas = document.getElementById('analysis-canvas');
const ctx = analysisCanvas.getContext('2d', { willReadFrequently: true });

const magnifierSize = 150; // Should match CSS width/height
const zoomLevel = 3; // How much to zoom in

// Canvas detection variables
let canvasRegion = null; // Will store {x, y, width, height} of the detected canvas
let imageLoaded = false;

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

        // Load the image for pixel analysis
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Attempt to avoid CORS issues
        img.onload = () => {
            // Set canvas dimensions to match image
            analysisCanvas.width = img.width;
            analysisCanvas.height = img.height;
            
            // Draw the image to the canvas
            ctx.drawImage(img, 0, 0);
            
            // Detect the canvas region
            detectCanvasRegion();
            
            imageLoaded = true;
        };
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

function detectCanvasRegion() {
    try {
        const imageData = ctx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
        const data = imageData.data;
        const width = analysisCanvas.width;
        const height = analysisCanvas.height;
        
        // Identify white/near-white areas (using a threshold)
        const whiteThreshold = 220; // RGB values above this are considered "white-ish"
        const whitePixels = [];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                
                // Check if pixel is white-ish (all RGB values high)
                if (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) {
                    whitePixels.push({x, y});
                }
            }
        }
        
        // Find largest rectangular white region using a simple clustering approach
        // This is a simplified approach - a more complex algorithm might be needed for better detection
        if (whitePixels.length > 0) {
            // Start with white pixel regions with minimum area
            const minRegionSize = 50 * 50; // Minimum pixel area to be considered a canvas
            
            // Group white pixels into regions
            const regions = [];
            const pixelMap = new Map();
            
            // Convert white pixels to a map for quick lookup
            whitePixels.forEach(pixel => {
                pixelMap.set(`${pixel.x},${pixel.y}`, true);
            });
            
            // Try to find rectangular regions
            for (let i = 0; i < whitePixels.length; i++) {
                const start = whitePixels[i];
                
                // Find maximum width
                let maxWidth = 0;
                while (pixelMap.has(`${start.x + maxWidth},${start.y}`)) {
                    maxWidth++;
                    if (start.x + maxWidth >= width) break;
                }
                
                if (maxWidth < 10) continue; // Skip narrow regions
                
                // Find maximum height
                let maxHeight = 0;
                let isRectangular = true;
                
                while (isRectangular && start.y + maxHeight < height) {
                    // Check if entire row is white
                    for (let x = 0; x < maxWidth; x++) {
                        if (!pixelMap.has(`${start.x + x},${start.y + maxHeight}`)) {
                            isRectangular = false;
                            break;
                        }
                    }
                    
                    if (isRectangular) {
                        maxHeight++;
                    }
                }
                
                if (maxHeight < 10) continue; // Skip short regions
                
                const area = maxWidth * maxHeight;
                if (area >= minRegionSize) {
                    regions.push({
                        x: start.x,
                        y: start.y,
                        width: maxWidth,
                        height: maxHeight,
                        area: area
                    });
                }
            }
            
            // Sort regions by area (largest first)
            regions.sort((a, b) => b.area - a.area);
            
            // Use the largest region as our canvas
            if (regions.length > 0) {
                // Convert from image coordinates to viewport coordinates
                const containerRect = imageContainer.getBoundingClientRect();
                const scaleX = containerRect.width / width;
                const scaleY = containerRect.height / height;
                
                canvasRegion = {
                    x: regions[0].x * scaleX,
                    y: regions[0].y * scaleY,
                    width: regions[0].width * scaleX,
                    height: regions[0].height * scaleY
                };
                
                console.log("Detected canvas region:", canvasRegion);
            }
        }
    } catch (error) {
        console.error("Error detecting canvas region:", error);
    }
}

function isPointInCanvasRegion(x, y) {
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

    // Check if cursor is over the canvas region
    const isOverCanvas = isPointInCanvasRegion(clientX, clientY);
    
    if (isOverCanvas) {
        // Hide magnifier and show brush cursor
        magnifier.style.display = 'none';
        brushCursor.style.display = 'block';
        brushCursor.style.left = `${clientX}px`;
        brushCursor.style.top = `${clientY}px`;
    } else {
        // Show magnifier and hide brush cursor
        brushCursor.style.display = 'none';
        
        // Get the size and position of the container
        const rect = imageContainer.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;

        // Calculate cursor position relative to the container
        const x = clientX - rect.left;
        const y = clientY - rect.top;

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
}

// Event listeners
imageContainer.addEventListener('mousemove', moveMagnifier);

imageContainer.addEventListener('mouseenter', (event) => {
    if (imageLoaded) {
        // Will show the appropriate cursor based on position
        moveMagnifier(event);
    }
});

imageContainer.addEventListener('mouseleave', () => {
    magnifier.style.display = 'none';
    brushCursor.style.display = 'none';
});

// Generate the image when the script loads
generateAndSetImage();

// Optional: Recalculate on window resize
window.addEventListener('resize', () => {
    if (imageLoaded) {
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        magnifier.style.backgroundSize = `${containerWidth * zoomLevel}px ${containerHeight * zoomLevel}px`;
        
        // Recalculate canvas region scale if image was analyzed
        if (canvasRegion) {
            const imageWidth = analysisCanvas.width;
            const imageHeight = analysisCanvas.height;
            const scaleX = containerWidth / imageWidth;
            const scaleY = containerHeight / imageHeight;
            
            canvasRegion = {
                x: canvasRegion.x * scaleX / (canvasRegion.previousScaleX || 1),
                y: canvasRegion.y * scaleY / (canvasRegion.previousScaleY || 1),
                width: canvasRegion.width * scaleX / (canvasRegion.previousScaleX || 1),
                height: canvasRegion.height * scaleY / (canvasRegion.previousScaleY || 1),
                previousScaleX: scaleX,
                previousScaleY: scaleY
            };
        }
    }
});