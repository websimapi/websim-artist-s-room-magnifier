// Track debug elements for cleanup
let debugElements = [];

/**
 * Adds a debug outline around a specified region
 */
export function addDebugOutline(region, color = 'red', thickness = 2, opacity = 1.0) {
    if (!region) return null;
    
    // Make sure we have valid numbers before creating the outline
    if (isNaN(region.x) || isNaN(region.y) || 
        isNaN(region.width) || isNaN(region.height) ||
        region.width <= 0 || region.height <= 0) {
        console.error("Invalid region dimensions:", region);
        return null;
    }
    
    const imageContainer = document.getElementById('image-container');
    const debugOutline = document.createElement('div');
    debugOutline.style.position = 'absolute';
    debugOutline.style.border = `${thickness}px dashed ${color}`;
    debugOutline.style.left = Math.round(region.x) + 'px';
    debugOutline.style.top = Math.round(region.y) + 'px';
    debugOutline.style.width = Math.round(region.width) + 'px';
    debugOutline.style.height = Math.round(region.height) + 'px';
    debugOutline.style.pointerEvents = 'none';
    debugOutline.style.zIndex = '1000';
    debugOutline.style.opacity = opacity;
    debugOutline.className = 'debug-outline';
    imageContainer.appendChild(debugOutline);
    
    // Add to the list of debug elements for cleanup
    debugElements.push(debugOutline);
    
    return debugOutline;
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
    debugElements = [];
}