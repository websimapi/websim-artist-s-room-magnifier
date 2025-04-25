// Track debug elements for cleanup
let debugElements = [];
let activeOutline = null;

/**
 * Adds a debug outline around a specified region
 */
export function addDebugOutline(region, color = 'red', thickness = 2, opacity = 1.0) {
    const imageContainer = document.getElementById('image-container');
    
    // Clear any existing outlines
    clearDebugElements();
    
    const debugOutline = document.createElement('div');
    debugOutline.style.position = 'absolute';
    debugOutline.style.border = `${thickness}px dashed ${color}`;
    debugOutline.style.left = region.x + 'px';
    debugOutline.style.top = region.y + 'px';
    debugOutline.style.width = region.width + 'px';
    debugOutline.style.height = region.height + 'px';
    debugOutline.style.pointerEvents = 'none';
    debugOutline.style.zIndex = '1000';
    debugOutline.style.opacity = opacity;
    debugOutline.classList.add('canvas-outline');
    imageContainer.appendChild(debugOutline);
    
    // Keep track of the active outline
    activeOutline = debugOutline;
    
    // Add to the list of debug elements for cleanup
    debugElements.push(debugOutline);
    
    return debugOutline;
}

/**
 * Updates the position of the active outline based on the current region
 */
export function updateOutlinePosition(region) {
    if (!activeOutline) return;
    
    activeOutline.style.left = region.x + 'px';
    activeOutline.style.top = region.y + 'px';
    activeOutline.style.width = region.width + 'px';
    activeOutline.style.height = region.height + 'px';
}

/**
 * Clears all debug elements from the page
 */
export function clearDebugElements() {
    debugElements.forEach(el => {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    });
    activeOutline = null;
    debugElements = [];
}