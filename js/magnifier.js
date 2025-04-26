import { isPointInCanvas } from './canvasDetection.js';

// Constants
const zoomLevel = 3; // How much to zoom in

// Shared color state
let selectedColor = 'black';

// Track painting state
let isPainting = false;

/**
 * Sets up magnifier functionality
 */
export function setupMagnifier() {
    const imageContainer = document.getElementById('image-container');
    const magnifier = document.getElementById('magnifier');
    
    // Event listeners
    imageContainer.addEventListener('mousemove', moveMagnifier);
    
    imageContainer.addEventListener('mouseenter', () => {
        // Let the mousemove handler decide whether to show magnifier
    });
    
    imageContainer.addEventListener('mouseleave', () => {
        magnifier.style.display = 'none';
        document.body.style.cursor = 'auto';
    });

    // Create color sampler element
    const colorSampler = document.createElement('div');
    colorSampler.id = 'color-sampler';
    colorSampler.style.display = 'none';
    document.body.appendChild(colorSampler);
    
    // Create color selected display
    const colorSelected = document.createElement('div');
    colorSelected.id = 'color-selected';
    colorSelected.style.backgroundColor = selectedColor;
    document.body.appendChild(colorSelected);
    
    // Add click handler for color selection
    imageContainer.addEventListener('click', handleClick);
    
    // Add mouse events for click-and-drag painting
    imageContainer.addEventListener('mousedown', startPainting);
    imageContainer.addEventListener('mouseup', stopPainting);
}

/**
 * Handle click events for both color selection and drawing
 */
function handleClick(e) {
    const magnifier = document.getElementById('magnifier');
    const colorSelected = document.getElementById('color-selected');
    const imageContainer = document.getElementById('image-container');
    const activeTools = window.activeTools || [];
    
    // Get cursor position relative to the container
    const rect = imageContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if we're over the canvas
    const isOverCanvas = isPointInCanvas(x, y);
    
    if (activeTools.includes('magnifier') && magnifier.style.display === 'block') {
        // Select color when magnifier is active and visible
        const colorSampler = document.getElementById('color-sampler');
        selectedColor = getComputedStyle(colorSampler).backgroundColor;
        
        // Show the selected color indicator
        colorSelected.style.backgroundColor = selectedColor;
        colorSelected.style.display = 'block';
        
        // Update brush cursor with selected color
        updateBrushCursor();
        
        console.log('Color selected:', selectedColor);
    } else if (isOverCanvas && activeTools.includes('brush')) {
        // Draw a dot at the click position
        drawDot(x, y, selectedColor);
    }
}

/**
 * Draws a dot at the specified position with the given color
 */
function drawDot(x, y, color) {
    const imageContainer = document.getElementById('image-container');
    
    // Create a new div element for the dot
    const dot = document.createElement('div');
    dot.className = 'paint-dot';
    dot.style.position = 'absolute';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.backgroundColor = color;
    dot.style.borderRadius = '50%';
    dot.style.pointerEvents = 'none'; // Prevent dots from interfering with mouse events
    dot.style.zIndex = '500'; // Above the image but below UI elements
    
    // Add the dot to the container
    imageContainer.appendChild(dot);
}

/**
 * Start painting on mouse down
 */
function startPainting(e) {
    const imageContainer = document.getElementById('image-container');
    const activeTools = window.activeTools || [];
    
    // Get cursor position relative to the container
    const rect = imageContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if we're over the canvas and brush tool is active
    if (isPointInCanvas(x, y) && activeTools.includes('brush')) {
        isPainting = true;
        // Draw initial dot
        drawDot(x, y, selectedColor);
    }
}

/**
 * Stop painting on mouse up
 */
function stopPainting() {
    isPainting = false;
}

/**
 * Update the brush cursor with selected color
 */
export function updateBrushCursor() {
    // Create SVG brush cursor with the selected color
    const brushColor = selectedColor || 'black';
    const brushCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'%3E%3Cpath fill='%23000000' d='M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3z'/%3E%3Cpath fill='${encodeURIComponent(brushColor)}' d='M7 14.5c-1.25 0-2.25 1-2.25 2.25s1 2.25 2.25 2.25 2.25-1 2.25-2.25-1-2.25-2.25-2.25z'/%3E%3Cpath fill='%23000000' d='M20.71 4.63l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z'/%3E%3C/svg%3E") 0 24, auto`;
    
    // Store for use in moveMagnifier
    window.brushCursor = brushCursor;
}

/**
 * Moves the magnifier based on mouse position
 */
export function moveMagnifier(e) {
    const imageContainer = document.getElementById('image-container');
    const magnifier = document.getElementById('magnifier');
    const colorSampler = document.getElementById('color-sampler') || createColorSampler();
    
    // Skip if we're resizing
    if (window.isResizing) return;
    
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
    
    // Draw while dragging if painting is active
    if (isPainting && isPointInCanvas(x, y)) {
        drawDot(x, y, selectedColor);
    }

    // Check if cursor is over the canvas
    const isOverCanvas = isPointInCanvas(x, y);
    
    // Multiple active tools support
    const activeTools = window.activeTools || [];
    const hasBrush = activeTools.includes('brush');
    const hasMagnifier = activeTools.includes('magnifier');
    
    // Set appropriate cursor based on tools and position
    if (isOverCanvas) {
        // Inside canvas area - always show brush cursor when inside canvas
        magnifier.style.display = 'none';
        // Use custom brush cursor with selected color
        const brushCursor = window.brushCursor || `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'%3E%3Cpath fill='%23000000' d='M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3z'/%3E%3Cpath fill='%23000000' d='M7 14.5c-1.25 0-2.25 1-2.25 2.25s1 2.25 2.25 2.25 2.25-1 2.25-2.25-1-2.25-2.25-2.25z'/%3E%3Cpath fill='%23000000' d='M20.71 4.63l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z'/%3E%3C/svg%3E") 0 24, auto`;
        document.body.style.cursor = brushCursor;
        imageContainer.style.cursor = brushCursor;
    } else {
        // Outside canvas area
        if (hasMagnifier) {
            // Show magnifier outside canvas when magnifier tool is active
            // Position the magnifier element centered on the cursor
            magnifier.style.left = `${clientX}px`;
            magnifier.style.top = `${clientY}px`;

            // Calculate the background position for the magnifier
            const bgX = -(x * zoomLevel - magnifier.offsetWidth / 2);
            const bgY = -(y * zoomLevel - magnifier.offsetHeight / 2);

            magnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;

            // Sample color under the cursor
            sampleColorAtPosition(x, y);

            // Show the magnifier and hide cursor
            magnifier.style.display = 'block';
            document.body.style.cursor = 'none';
            imageContainer.style.cursor = 'none';
            
            // Show color sampler instead
            colorSampler.style.display = 'block';
            colorSampler.style.left = `${clientX}px`;
            colorSampler.style.top = `${clientY}px`;
        } else {
            // Normal cursor outside canvas for any other tool
            magnifier.style.display = 'none';
            colorSampler.style.display = 'none';
            document.body.style.cursor = 'auto';
            imageContainer.style.cursor = 'auto';
        }
    }
}

/**
 * Creates the color sampler element if it doesn't exist
 */
function createColorSampler() {
    const colorSampler = document.createElement('div');
    colorSampler.id = 'color-sampler';
    colorSampler.style.position = 'fixed';
    colorSampler.style.width = '10px';
    colorSampler.style.height = '10px';
    colorSampler.style.borderRadius = '50%';
    colorSampler.style.border = '1px solid white';
    colorSampler.style.boxShadow = '0 0 2px rgba(0,0,0,0.5)';
    colorSampler.style.transform = 'translate(-50%, -50%)';
    colorSampler.style.pointerEvents = 'none';
    colorSampler.style.zIndex = '1500';
    document.body.appendChild(colorSampler);
    return colorSampler;
}

/**
 * Samples color at the specified position in the image
 */
function sampleColorAtPosition(x, y) {
    const imageContainer = document.getElementById('image-container');
    const colorSampler = document.getElementById('color-sampler');
    const magnifier = document.getElementById('magnifier');
    
    // Create temporary canvas to sample color
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Use the current background image
    const computedStyle = getComputedStyle(imageContainer);
    const bgImage = computedStyle.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
    
    if (!bgImage || bgImage === 'none') {
        return;
    }
    
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        
        // Calculate the pixel coordinates in the original image
        const rect = imageContainer.getBoundingClientRect();
        const imgWidth = img.width;
        const imgHeight = img.height;
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        
        // Scale coordinates to match image dimensions
        const scaleX = imgWidth / containerWidth;
        const scaleY = imgHeight / containerHeight;
        const pixelX = Math.floor(x * scaleX);
        const pixelY = Math.floor(y * scaleY);
        
        // Get pixel data if coordinates are within bounds
        if (pixelX >= 0 && pixelX < imgWidth && pixelY >= 0 && pixelY < imgHeight) {
            try {
                const pixelData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
                const color = `rgb(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]})`;
                colorSampler.style.backgroundColor = color;
                // Update magnifier border color to match sampled pixel
                magnifier.style.borderColor = color;
            } catch (e) {
                console.warn('Could not sample color due to CORS policy:', e);
                colorSampler.style.backgroundColor = 'rgba(255, 0, 0, 0.5)'; // Fallback color
                magnifier.style.borderColor = 'rgba(255, 0, 0, 0.5)'; // Fallback color for border
            }
        }
    };
    
    img.onerror = () => {
        console.warn('Failed to load image for color sampling');
        colorSampler.style.backgroundColor = 'rgba(255, 0, 0, 0.5)'; // Fallback color
        magnifier.style.borderColor = 'rgba(255, 0, 0, 0.5)'; // Fallback color for border
    };
    
    img.src = bgImage;
}