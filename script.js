const imageContainer = document.getElementById('image-container');
const magnifier = document.getElementById('magnifier');

const magnifierSize = 150; // Should match CSS width/height
const zoomLevel = 3; // How much to zoom in
let canvasRectPercent = null; // Stores { x, y, width, height } in percentages
let currentImageUrl = null; // Store the current image URL

async function detectCanvas(imageUrl) {
    try {
        console.log("Detecting canvas in image:", imageUrl);
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze the provided image and identify the bounding box of the largest, predominantly white or very light-colored, rectangular area, which likely represents a blank canvas. Respond directly with JSON, following this JSON schema, and no other text:
{
  "canvasRect": {
    "x": number, // top-left x coordinate (percentage, 0-100)
    "y": number, // top-left y coordinate (percentage, 0-100)
    "width": number, // width (percentage, 0-100)
    "height": number // height (percentage, 0-100)
  } | null // null if no suitable canvas is found
}`,
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageUrl },
                        },
                    ],
                },
            ],
            json: true,
        });

        const result = JSON.parse(completion.content);
        console.log("Canvas detection result:", result);
        if (result && result.canvasRect) {
             // Basic validation
            if (typeof result.canvasRect.x === 'number' &&
                typeof result.canvasRect.y === 'number' &&
                typeof result.canvasRect.width === 'number' &&
                typeof result.canvasRect.height === 'number' &&
                result.canvasRect.width > 0 && result.canvasRect.height > 0)
            {
                canvasRectPercent = result.canvasRect;
                console.log("Canvas detected at:", canvasRectPercent);
            } else {
                 console.warn("Invalid canvas coordinates received:", result.canvasRect);
                 canvasRectPercent = null;
            }
        } else {
            console.log("No canvas detected or invalid response format.");
            canvasRectPercent = null;
        }
    } catch (error) {
        console.error("Error detecting canvas:", error);
        canvasRectPercent = null; // Ensure it's null on error
    }
}


async function generateAndSetImage() {
    canvasRectPercent = null; // Reset canvas detection on new image
    try {
        console.log("Generating new image...");
        const result = await websim.imageGen({
          prompt: "HD hyper realistic artist room with various art supplies like paints, brushes, palettes, and easels scattered around. In the center, there's a large, blank white canvas on an easel. Soft, natural light illuminates the scene.",
          aspect_ratio: "16:9", // Good for full screen
        });
        const imageUrl = result.url;
        currentImageUrl = imageUrl; // Store the URL

        if (!imageUrl) {
            throw new Error("Failed to generate image URL.");
        }

        console.log("Image generated:", imageUrl);

        // Set the background for the container and the magnifier
        imageContainer.style.backgroundImage = `url(${imageUrl})`;
        magnifier.style.backgroundImage = `url(${imageUrl})`;

        // Calculate the background size for the magnifier based on zoom
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        if (containerWidth > 0 && containerHeight > 0) {
            magnifier.style.backgroundSize = `${containerWidth * zoomLevel}px ${containerHeight * zoomLevel}px`;
            console.log("Magnifier background size set.");
        } else {
            console.warn("Container dimensions are zero, delaying magnifier size calculation.");
             // Retry after a short delay, might happen if called before layout
             setTimeout(() => {
                 const cw = imageContainer.offsetWidth;
                 const ch = imageContainer.offsetHeight;
                 if (cw > 0 && ch > 0) {
                    magnifier.style.backgroundSize = `${cw * zoomLevel}px ${ch * zoomLevel}px`;
                    console.log("Magnifier background size set (delayed).");
                 } else {
                     console.error("Container dimensions still zero after delay.");
                 }
             }, 100);
        }


        // --- Detect the canvas ---
        await detectCanvas(imageUrl);
        // --- End Canvas Detection ---

    } catch (error) {
        console.error("Error generating or setting image:", error);
        imageContainer.innerText = "Failed to load image. Please try again.";
        imageContainer.style.display = 'flex';
        imageContainer.style.alignItems = 'center';
        imageContainer.style.justifyContent = 'center';
        imageContainer.style.color = 'red';
        imageContainer.style.cursor = 'default'; // Show cursor if there's an error
        currentImageUrl = null; // Clear image URL on error
    }
}

function isMouseOverCanvas(clientX, clientY) {
    if (!canvasRectPercent) {
        return false; // No canvas data
    }

    const rect = imageContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert mouse coordinates to percentages
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    // Check if the percentage coordinates are within the canvas bounds
    return (
        percentX >= canvasRectPercent.x &&
        percentX <= canvasRectPercent.x + canvasRectPercent.width &&
        percentY >= canvasRectPercent.y &&
        percentY <= canvasRectPercent.y + canvasRectPercent.height
    );
}

function moveMagnifier(e) {
    if (!currentImageUrl) return; // Don't do anything if image failed to load

    const clientX = e.clientX;
    const clientY = e.clientY;

    // Check if mouse is over the detected canvas area
    if (isMouseOverCanvas(clientX, clientY)) {
        magnifier.style.display = 'none'; // Hide magnifier
        imageContainer.style.cursor = 'default'; // Show default cursor
        // console.log("Over canvas"); // uncomment for debugging
    } else {
        // console.log("Outside canvas"); // uncomment for debugging
        imageContainer.style.cursor = 'none'; // Hide default cursor
        magnifier.style.display = 'block'; // Show magnifier

        const rect = imageContainer.getBoundingClientRect();
        // Calculate cursor position relative to the container
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Position the magnifier element centered on the cursor
        // Use clientX/Y for positioning relative to viewport
        magnifier.style.left = `${clientX}px`;
        magnifier.style.top = `${clientY}px`;

        // Calculate the background position for the magnifier
        const bgX = -(x * zoomLevel - magnifierSize / 2);
        const bgY = -(y * zoomLevel - magnifierSize / 2);
        magnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;
    }
}

// Event listeners
imageContainer.addEventListener('mousemove', moveMagnifier);

imageContainer.addEventListener('mouseenter', () => {
    if (currentImageUrl) { // Only modify cursor/magnifier if image is loaded
        // Decide initial cursor based on entry point (though moveMagnifier will quickly override)
        // It's simpler to just hide cursor and let moveMagnifier handle canvas logic immediately
         imageContainer.style.cursor = 'none';
         // Don't show magnifier immediately, let moveMagnifier decide based on canvas
    }
});

imageContainer.addEventListener('mouseleave', () => {
     if (currentImageUrl) {
        magnifier.style.display = 'none';
        imageContainer.style.cursor = 'default'; // Restore default cursor when leaving
     }
});

// Generate the image when the script loads
generateAndSetImage();

// Recalculate background size on window resize
window.addEventListener('resize', () => {
    if (currentImageUrl && magnifier.style.backgroundImage) { // Check if image is loaded
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
         if (containerWidth > 0 && containerHeight > 0) {
            magnifier.style.backgroundSize = `${containerWidth * zoomLevel}px ${containerHeight * zoomLevel}px`;
            console.log("Magnifier background size updated on resize.");
        }
    }
    // No need to recalculate canvasRectPercent as it's percentage based
});