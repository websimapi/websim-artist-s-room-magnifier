import { generateAndSetImage } from './imageUtils.js';
import { setupMagnifier } from './magnifier.js';
import { setupResizeTools } from './resizeTools.js';
import { updateCanvasRegionFromRelative, canvasRegion, canvasRegionRelative, outlineVisible } from './canvasDetection.js';
import { clearDebugElements, addDebugOutline } from './debug.js';

// Initialize components when the script loads
document.addEventListener('DOMContentLoaded', () => {
    // Generate the initial image
    generateAndSetImage();
    
    // Setup the magnifier functionality
    setupMagnifier();
    
    // Setup resize tools (context menu & resize functionality)
    setupResizeTools();
    
    // Handle window resize events with debouncing
    let resizeTimer;
    window.addEventListener('resize', () => {
        // Clear previous timeout to implement debouncing
        clearTimeout(resizeTimer);
        
        // Update immediately to prevent jarring UI shifts
        updateMagnifierSize();
        
        // Schedule the more intensive operations after resize completes
        resizeTimer = setTimeout(handleWindowResize, 200);
    });
});

/**
 * Updates just the magnifier size during resize
 */
function updateMagnifierSize() {
    const magnifier = document.getElementById('magnifier');
    const imageContainer = document.getElementById('image-container');
    
    if (magnifier.style.backgroundImage) {
        const containerWidth = imageContainer.offsetWidth;
        const containerHeight = imageContainer.offsetHeight;
        magnifier.style.backgroundSize = `${containerWidth * 3}px ${containerHeight * 3}px`;
    }
}

/**
 * Handles window resize events with improved outline management
 */
function handleWindowResize() {
    console.log("Window resize completed, updating canvas region...");
    
    // First ensure the relative position is accurate before updating
    // This is crucial if the resize happened after a manual resize operation
    const imageContainer = document.getElementById('image-container');
    const containerRect = imageContainer.getBoundingClientRect();
    
    // Completely recalculate the canvas region from relative values
    if (canvasRegionRelative) {
        // Update canvas region from relative position
        canvasRegion.x = canvasRegionRelative.xPercent * containerRect.width;
        canvasRegion.y = canvasRegionRelative.yPercent * containerRect.height;
        canvasRegion.width = canvasRegionRelative.widthPercent * containerRect.width;
        canvasRegion.height = canvasRegionRelative.heightPercent * containerRect.height;
        
        console.log('Repositioned canvas region after resize:', canvasRegion);
        
        // Clear existing outlines and redraw if needed
        clearDebugElements();
        
        // Only redraw outline if it should be visible
        if (outlineVisible) {
            addDebugOutline(canvasRegion, 'red', 3, 1.0);
        }
        
        // Force a mouse move event to update cursor if needed
        if (window.lastKnownMousePosition) {
            const event = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: window.lastKnownMousePosition.x,
                clientY: window.lastKnownMousePosition.y
            });
            document.dispatchEvent(event);
        }
    }
}