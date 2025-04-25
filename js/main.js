import { generateAndSetImage } from './imageUtils.js';
import { setupMagnifier } from './magnifier.js';
import { setupResizeTools } from './resizeTools.js';
import { updateCanvasRegionFromRelative, canvasRegion } from './canvasDetection.js';
import { clearDebugElements, addDebugOutline } from './debug.js';

// Initialize components when the script loads
document.addEventListener('DOMContentLoaded', () => {
    // Generate the initial image
    generateAndSetImage();
    
    // Setup the magnifier functionality
    setupMagnifier();
    
    // Setup resize tools (context menu & resize functionality)
    setupResizeTools();
    
    // Handle window resize events
    window.addEventListener('resize', () => {
        const magnifier = document.getElementById('magnifier');
        const imageContainer = document.getElementById('image-container');
        
        if (magnifier.style.backgroundImage) {
            const containerWidth = imageContainer.offsetWidth;
            const containerHeight = imageContainer.offsetHeight;
            magnifier.style.backgroundSize = `${containerWidth * 3}px ${containerHeight * 3}px`;
        }
        
        // Update canvas region based on relative position when window resizes
        updateCanvasRegionFromRelative();
        
        // Redraw outline if it's visible
        const toggleOutline = document.getElementById('toggle-outline');
        const outlineVisible = toggleOutline.textContent === 'Hide Outline';
        
        if (outlineVisible && canvasRegion) {
            clearDebugElements();
            addDebugOutline(canvasRegion, 'red', 3, 1.0);
        }
    });
});