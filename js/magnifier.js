import { isPointInCanvas } from './canvasDetection.js';

// Constants
const zoomLevel = 3; // How much to zoom in

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
}

/**
 * Moves the magnifier based on mouse position
 */
export function moveMagnifier(e) {
    const imageContainer = document.getElementById('image-container');
    const magnifier = document.getElementById('magnifier');
    
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

    // Check if cursor is over the canvas
    if (isPointInCanvas(x, y)) {
        // Hide magnifier and show brush cursor
        magnifier.style.display = 'none';
        document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000000\' d=\'M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z\'/%3E%3C/svg%3E") 0 24, auto';
        return;
    }

    // Not over canvas, show normal cursor and magnifier
    document.body.style.cursor = 'auto';

    // Position the magnifier element centered on the cursor
    magnifier.style.left = `${clientX}px`;
    magnifier.style.top = `${clientY}px`;

    // Calculate the background position for the magnifier
    const bgX = -(x * zoomLevel - magnifier.offsetWidth / 2);
    const bgY = -(y * zoomLevel - magnifier.offsetHeight / 2);

    magnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;

    // Show the magnifier
    magnifier.style.display = 'block';
}