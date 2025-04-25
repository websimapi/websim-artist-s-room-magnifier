import { generateAndSetImage } from './imageUtils.js';
import { setupMagnifier } from './magnifier.js';
import { setupResizeTools } from './resizeTools.js';
import { updateCanvasRegionCoordinates } from './canvasDetection.js';
import { updateOutlinePosition } from './debug.js';

// Initialize components when the script loads
document.addEventListener('DOMContentLoaded', () => {
    // Generate the initial image
    generateAndSetImage();
    
    // Setup the magnifier functionality
    setupMagnifier();
    
    // Setup resize tools (context menu & resize functionality)
    setupResizeTools();
    
    // Handle window resize events
    window.addEventListener('resize', handleWindowResize);
});

/**
 * Handle window resize by updating canvas region and outline
 */
function handleWindowResize() {
    // Update the canvas region coordinates based on new container size
    const updatedRegion = updateCanvasRegionCoordinates();
    
    if (updatedRegion) {
        // Update the position of the outline
        updateOutlinePosition(updatedRegion);
    }
    
    // Update magnifier background size
    const magnifier = document.getElementById('magnifier');
    const imageContainer = document.getElementById('image-container');
    
    if (magnifier.style.backgroundImage) {
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        magnifier.style.backgroundSize = `${containerWidth * 3}px ${containerHeight * 3}px`;
    }
}