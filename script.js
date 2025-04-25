const imageContainer = document.getElementById('image-container');
const magnifier = document.getElementById('magnifier');
const statusElement = document.getElementById('status');

const magnifierSize = 150; // Should match CSS width/height
const zoomLevel = 3; // How much to zoom in

let canvasRect = null; // Stores { x, y, width, height } of the detected canvas relative to container
let isDetecting = false;
let imageLoaded = false;
let currentImageUrl = null;

// --- Canvas Detection ---

const WHITE_THRESHOLD = 235; // Pixels with R, G, B above this are considered "white"
const MIN_CANVAS_AREA = 1000; // Minimum pixel area to be considered the canvas

function isWhite(r, g, b) {
    return r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD;
}

// Simple algorithm to find the largest rectangle of "white" pixels
// Note: This is computationally intensive and might be slow.
function detectCanvasArea(img) {
    isDetecting = true;
    statusElement.textContent = 'Analyzing image for canvas...';
    statusElement.style.display = 'block';
    console.log("Starting canvas detection...");

    // Use a timeout to allow the UI to update before blocking the main thread
    setTimeout(() => {
        try {
            const containerWidth = imageContainer.offsetWidth;
            const containerHeight = imageContainer.offsetHeight;

            if (containerWidth === 0 || containerHeight === 0) {
                 console.error("Container dimensions are zero.");
                 statusElement.textContent = 'Error: Container size invalid.';
                 isDetecting = false;
                 return;
            }

            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = containerWidth;
            offscreenCanvas.height = containerHeight;
            const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true }); // Optimization hint

            // Draw the image scaled to fit the container
            ctx.drawImage(img, 0, 0, containerWidth, containerHeight);

            const imageData = ctx.getImageData(0, 0, containerWidth, containerHeight);
            const data = imageData.data;

            let maxRect = { x: 0, y: 0, width: 0, height: 0, area: 0 };

            // --- Find Largest White Rectangle (Simplified Scanline Approach) ---
            // Create a cache for runs of white pixels per row
             const whiteRuns = new Array(containerHeight);
             for (let y = 0; y < containerHeight; y++) {
                 whiteRuns[y] = [];
                 let currentRunStart = -1;
                 for (let x = 0; x < containerWidth; x++) {
                     const index = (y * containerWidth + x) * 4;
                     const r = data[index];
                     const g = data[index + 1];
                     const b = data[index + 2];

                     if (isWhite(r, g, b)) {
                         if (currentRunStart === -1) {
                             currentRunStart = x;
                         }
                     } else {
                         if (currentRunStart !== -1) {
                             whiteRuns[y].push({ start: currentRunStart, end: x });
                             currentRunStart = -1;
                         }
                     }
                 }
                  if (currentRunStart !== -1) { // Handle run extending to the edge
                      whiteRuns[y].push({ start: currentRunStart, end: containerWidth });
                  }
             }

             // Find largest rectangle using histogram-based approach on runs
             for (let r1 = 0; r1 < containerHeight; r1++) {
                 let currentMinWidth = containerWidth + 1;
                 for (let r2 = r1; r2 < containerHeight; r2++) {
                      // Find the intersection of white runs between r1 and r2
                      // This simplified part finds the *longest common continuous* white segment
                      // A more robust method uses a histogram/stack approach for max rect in histogram
                      let bestIntersection = { start: 0, end: 0 };

                      // Basic intersection check (needs improvement for multiple runs)
                      if(whiteRuns[r1].length > 0 && whiteRuns[r2].length > 0) {
                         // Find overlapping run - very simplified, assumes one main run
                         const run1 = whiteRuns[r1][0]; // Assuming first run is relevant
                         const run2 = whiteRuns[r2][0]; // Assuming first run is relevant
                         const start = Math.max(run1.start, run2.start);
                         const end = Math.min(run1.end, run2.end);

                         if(end > start){
                             // This is just the width at r1 and r2, need to check rows in between
                             // For now, we approximate: find min width between r1 and r2 for this x-range
                             let minWidthInStripe = end - start;
                             for(let y = r1 + 1; y < r2; y++){
                                 let rowWidth = 0;
                                 for(const run of whiteRuns[y]){
                                     const overlapStart = Math.max(start, run.start);
                                     const overlapEnd = Math.min(end, run.end);
                                     if(overlapEnd > overlapStart) {
                                         rowWidth = Math.max(rowWidth, overlapEnd - overlapStart);
                                     }
                                 }
                                 minWidthInStripe = Math.min(minWidthInStripe, rowWidth);
                                 if(minWidthInStripe === 0) break; // No point continuing this stripe
                             }

                             const width = minWidthInStripe;
                             const height = r2 - r1 + 1;
                             const area = width * height;

                             if (area > maxRect.area && area >= MIN_CANVAS_AREA) {
                                 // Find the starting x for this rectangle (approximate center of widest part)
                                 let rectX = start; // Needs refinement
                                 for(let y = r1; y <= r2; y++){
                                     for(const run of whiteRuns[y]){
                                        const overlapStart = Math.max(start, run.start);
                                        const overlapEnd = Math.min(end, run.end);
                                        if(overlapEnd - overlapStart >= width) {
                                            rectX = overlapStart; // Take the start of the qualifying run
                                            break;
                                        }
                                     }
                                     if(rectX !== start) break;
                                 }

                                 maxRect = { x: rectX, y: r1, width: width, height: height, area: area };
                             }
                         }
                     }
                 }
             }
            // --- End Detection ---


            if (maxRect.area > 0) {
                canvasRect = maxRect;
                console.log("Canvas detected:", canvasRect);
                statusElement.textContent = 'Canvas detected.';
                 setTimeout(() => { statusElement.style.display = 'none'; }, 2000);
            } else {
                console.log("Could not detect a significant white canvas area.");
                canvasRect = null;
                statusElement.textContent = 'Canvas not detected.';
                 setTimeout(() => { statusElement.style.display = 'none'; }, 3000);
            }

        } catch (error) {
            console.error("Error during canvas detection:", error);
            statusElement.textContent = 'Error analyzing image.';
            // Handle potential CORS errors if image source is external and not configured correctly
            if (error instanceof DOMException && error.name === 'SecurityError') {
                statusElement.textContent = 'Error: Cannot analyze image due to security restrictions (CORS).';
                console.error("Potential CORS issue. Ensure image source allows canvas access.");
            }
             setTimeout(() => { statusElement.style.display = 'none'; }, 5000);
        } finally {
            isDetecting = false;
            console.log("Canvas detection finished.");
        }
    }, 50); // Timeout to allow UI update
}


// --- Image Generation and Loading ---

async function generateAndSetImage() {
    statusElement.textContent = 'Generating image...';
    statusElement.style.display = 'block';
    imageLoaded = false;
    canvasRect = null; // Reset detection on new image
    imageContainer.style.backgroundImage = 'none'; // Clear previous image
    magnifier.style.backgroundImage = 'none';
    magnifier.style.display = 'none';
    imageContainer.classList.remove('canvas-hover');
    imageContainer.style.cursor = 'wait'; // Show loading cursor

    try {
        const result = await websim.imageGen({
            prompt: "HD hyper realistic artist room with various art supplies like paints, brushes, palettes, and easels scattered around. In the center, there's a large, blank white canvas on an easel. Soft, natural light illuminates the scene.",
            aspect_ratio: "16:9",
        });
        const imageUrl = result.url;
        currentImageUrl = imageUrl; // Store the URL

        if (!imageUrl) {
            throw new Error("Failed to generate image URL.");
        }

        statusElement.textContent = 'Loading image...';

        // Load the image via an Image object to allow drawing to canvas
        const img = new Image();
        // IMPORTANT: Required for getImageData if the image URL is cross-origin.
        // websim.imageGen URLs *should* be same-origin or allow CORS, but this is safer.
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            console.log("Image loaded successfully.");
            statusElement.textContent = 'Image loaded.';
            imageContainer.style.backgroundImage = `url(${imageUrl})`;
            magnifier.style.backgroundImage = `url(${imageUrl})`;

            // Recalculate background size for magnifier
            updateMagnifierBackgroundSize();

            imageLoaded = true;
            imageContainer.style.cursor = 'none'; // Ready, hide cursor for magnifier mode

            // Start canvas detection after image is loaded and displayed
            detectCanvasArea(img);
        };

        img.onerror = (err) => {
            console.error("Error loading image element:", err);
            throw new Error("Failed to load generated image.");
        };

        img.src = imageUrl;

    } catch (error) {
        console.error("Error generating or setting image:", error);
        statusElement.style.display = 'none'; // Hide status on error
        imageContainer.innerHTML = `<p style="color: red; text-align: center; padding: 20px; font-family: sans-serif;">Failed to load image. ${error.message}. Please try refreshing.</p>`;
        imageContainer.style.display = 'flex';
        imageContainer.style.alignItems = 'center';
        imageContainer.style.justifyContent = 'center';
        imageContainer.style.cursor = 'default'; // Show cursor if there's an error
    }
}

// --- Magnifier Logic ---

function updateMagnifierBackgroundSize() {
     if (!imageLoaded) return;
     const containerWidth = imageContainer.offsetWidth;
     const containerHeight = imageContainer.offsetHeight;
     if (containerWidth > 0 && containerHeight > 0) {
        magnifier.style.backgroundSize = `${containerWidth * zoomLevel}px ${containerHeight * zoomLevel}px`;
     }
}


function moveMagnifier(relX, relY, clientX, clientY) {
    // Position the magnifier element centered on the cursor
    magnifier.style.left = `${clientX}px`;
    magnifier.style.top = `${clientY}px`;

    // Calculate the background position for the magnifier
    const bgX = -(relX * zoomLevel - magnifierSize / 2);
    const bgY = -(relY * zoomLevel - magnifierSize / 2);

    magnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;
    magnifier.style.display = 'block';
}

// --- Event Handlers ---

function handleMouseMove(e) {
    if (!imageLoaded || isDetecting) {
        imageContainer.style.cursor = 'wait'; // Show wait cursor if not ready
        return;
    }

    const rect = imageContainer.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    // Calculate cursor position relative to the container
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Check if mouse is over the detected canvas area
    if (canvasRect &&
        x >= canvasRect.x && x <= canvasRect.x + canvasRect.width &&
        y >= canvasRect.y && y <= canvasRect.y + canvasRect.height)
    {
        // Over the canvas: hide magnifier, show canvas cursor
        magnifier.style.display = 'none';
        imageContainer.classList.add('canvas-hover');
         // Ensure default none cursor is not applied
         imageContainer.style.cursor = ''; // Let CSS class handle it
    } else {
        // Outside canvas: show magnifier, hide default cursor
        imageContainer.classList.remove('canvas-hover');
        imageContainer.style.cursor = 'none';
        moveMagnifier(x, y, clientX, clientY);
    }
}

imageContainer.addEventListener('mousemove', handleMouseMove);

imageContainer.addEventListener('mouseenter', () => {
     if (imageLoaded && !isDetecting) {
         // Don't show magnifier immediately, mousemove will handle it
         // Set initial cursor state based on position (though mousemove will override quickly)
         // imageContainer.style.cursor = 'none';
     } else if (!imageLoaded) {
         imageContainer.style.cursor = 'wait';
     }
});

imageContainer.addEventListener('mouseleave', () => {
    magnifier.style.display = 'none';
    imageContainer.classList.remove('canvas-hover');
    imageContainer.style.cursor = 'default'; // Show default cursor when leaving
});

// --- Initialization and Resize ---

// Generate the image when the script loads
generateAndSetImage();

// Recalculate background size on window resize
window.addEventListener('resize', () => {
    // Recalculate magnifier size
    updateMagnifierBackgroundSize();

    // Re-detect canvas area on resize as proportions change
    // Only re-detect if an image was successfully loaded previously
    if (imageLoaded && currentImageUrl && !isDetecting) {
         // Reload the image into an img tag to re-detect based on new size
         const img = new Image();
         img.crossOrigin = 'Anonymous';
         img.onload = () => {
             console.log("Redetecting canvas after resize...");
             detectCanvasArea(img);
         };
         img.onerror = () => console.error("Failed to reload image for resize detection.");
         img.src = currentImageUrl; // Use the stored URL
    } else {
        // If detection is already running, or no image loaded, do nothing on resize for now
        console.log("Skipping resize detection (image not ready or detection in progress).")
    }
});