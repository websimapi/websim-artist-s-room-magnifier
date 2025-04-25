import { generateAndSetImage } from './imageUtils.js';
import { setupMagnifier } from './magnifier.js';
import { setupResizeTools } from './resizeTools.js';
import { updateCanvasRegionFromRelative, canvasRegion, outlineVisible } from './canvasDetection.js';
import { clearDebugElements, addDebugOutline } from './debug.js';

// Initialize components when the script loads
document.addEventListener('DOMContentLoaded', () => {
    // Generate the initial image
    generateAndSetImage();
    
    // Setup the magnifier functionality
    setupMagnifier();
    
    // Setup resize tools (context menu & resize functionality)
    setupResizeTools();
    
    // Handle window resize events - improved version
    window.addEventListener('resize', handleWindowResize);
});

/**
 * Handles window resize events with improved outline management
 */
function handleWindowResize() {
    // Update magnifier background size
    const magnifier = document.getElementById('magnifier');
    const imageContainer = document.getElementById('image-container');
    
    if (magnifier.style.backgroundImage) {
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        magnifier.style.backgroundSize = `${containerWidth * 3}px ${containerHeight * 3}px`;
    }
    
    // Update canvas region based on relative position
    if (updateCanvasRegionFromRelative()) {
        // If we have an outline and it should be visible, redraw it
        if (outlineVisible) {
            clearDebugElements();
            addDebugOutline(canvasRegion, 'red', 3, 1.0);
        }
    }
    
    // Also update any debug outlines that might be visible
    const debugElements = document.querySelectorAll('#image-container > div[style*="position: absolute"][style*="border"]');
    if (debugElements.length > 0) {
        clearDebugElements();
        if (outlineVisible && canvasRegion) {
            addDebugOutline(canvasRegion, 'red', 3, 1.0);
        }
    }
}