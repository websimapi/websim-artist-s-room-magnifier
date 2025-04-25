import { generateAndSetImage } from './imageUtils.js';
import { setupMagnifier } from './magnifier.js';
import { setupResizeTools } from './resizeTools.js';
import { updateCanvasRegionOnResize } from './canvasDetection.js';

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
        // Update magnifier background size
        const magnifier = document.getElementById('magnifier');
        const imageContainer = document.getElementById('image-container');
        
        if (magnifier.style.backgroundImage) {
            const containerWidth = imageContainer.offsetWidth;
            const containerHeight = imageContainer.offsetHeight;
            magnifier.style.backgroundSize = `${containerWidth * 3}px ${containerHeight * 3}px`;
        }
        
        // Call the new function to update canvas region dimensions
        updateCanvasRegionOnResize();
    });
});