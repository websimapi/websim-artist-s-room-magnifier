import { generateAndSetImage } from './imageUtils.js';
import { setupMagnifier } from './magnifier.js';
import { setupResizeTools } from './resizeTools.js';
import { updateCanvasRegionFromPercent } from './canvasDetection.js';

// --- Resize Observer for image-container to trigger outline scaling ---
function fireImageContainerResize() {
    // Update canvas region from percentages first
    updateCanvasRegionFromPercent();
    
    // Fire a custom event on image-container every time it changes size
    const imageContainer = document.getElementById('image-container');
    if (!imageContainer) return;
    let ev = new Event('imagecontainer-resize');
    imageContainer.dispatchEvent(ev);
}

function setupContainerResizeObserver() {
    const ic = document.getElementById('image-container');
    if (!window._containerResizeObserver && ic) {
        // Use ResizeObserver to monitor image container's size
        window._containerResizeObserver = new ResizeObserver(() => {
            fireImageContainerResize();
        });
        window._containerResizeObserver.observe(ic);
    }
}

// Initialize components when the script loads
document.addEventListener('DOMContentLoaded', () => {
    generateAndSetImage();
    setupMagnifier();
    setupResizeTools();
    setupContainerResizeObserver();

    window.addEventListener('resize', () => {
        // Update canvas region and trigger resize event
        updateCanvasRegionFromPercent();
        
        const magnifier = document.getElementById('magnifier');
        const imageContainer = document.getElementById('image-container');
        if (magnifier.style.backgroundImage) {
            const containerWidth = imageContainer.offsetWidth;
            const containerHeight = imageContainer.offsetHeight;
            magnifier.style.backgroundSize = `${containerWidth * 3}px ${containerHeight * 3}px`;
        }
        // This is a second guarantee in case ResizeObserver didn't fire
        fireImageContainerResize();
    });
});