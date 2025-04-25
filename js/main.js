import { generateAndSetImage } from './imageUtils.js';
import { setupMagnifier } from './magnifier.js';
import { setupResizeTools } from './resizeTools.js';
import { updateCanvasRegionOnResize } from './canvasDetection.js';
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
        // Debounce the resize updates to avoid performance issues
        if (window.resizeTimer) clearTimeout(window.resizeTimer);
        
        window.resizeTimer = setTimeout(() => {
            // Recalculate and update the canvas region position
            updateCanvasRegionOnResize();
            
            // Update magnifier background size
            const magnifier = document.getElementById('magnifier');
            const imageContainer = document.getElementById('image-container');
            
            if (magnifier.style.backgroundImage) {
                const containerWidth = imageContainer.offsetWidth;
                const containerHeight = imageContainer.offsetHeight;
                magnifier.style.backgroundSize = `${containerWidth * 3}px ${containerHeight * 3}px`;
            }
        }, 100); // Wait 100ms after resize ends before updating
    });
});