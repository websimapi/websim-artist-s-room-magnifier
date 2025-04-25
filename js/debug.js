// Track debug elements for cleanup
let debugElements = [];
let originalImageDimensions = null;

/**
 * Sets the original image dimensions for proper scaling calculations
 */
export function setOriginalImageDimensions(width, height) {
    originalImageDimensions = { width, height };
}

/**
 * Adds a debug outline around a specified region
 */
export function addDebugOutline(region, color = 'red', thickness = 2, opacity = 1.0) {
    let imageContainer = document.getElementById('image-container');
    let outlineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    outlineSvg.setAttribute('class', 'debug-outline-svg');
    outlineSvg.style.position = 'absolute';
    outlineSvg.style.left = 0;
    outlineSvg.style.top = 0;
    outlineSvg.style.width = '100%';
    outlineSvg.style.height = '100%';
    outlineSvg.style.pointerEvents = 'none';
    outlineSvg.style.zIndex = '1000';
    outlineSvg.style.opacity = opacity;

    let rectElem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rectElem.setAttribute('stroke', color);
    rectElem.setAttribute('fill', 'none');
    rectElem.setAttribute('stroke-width', thickness);
    rectElem.setAttribute('rx', 4);
    rectElem.setAttribute('ry', 4);

    // Store original region data as percentages for perfect scaling
    outlineSvg.__regionPercent = {
        x: region.x / imageContainer.offsetWidth,
        y: region.y / imageContainer.offsetHeight,
        width: region.width / imageContainer.offsetWidth,
        height: region.height / imageContainer.offsetHeight
    };
    
    // Also store absolute values for reference
    outlineSvg.__region = { ...region };

    // Set initial coords
    updateRectPosition(rectElem, outlineSvg.__regionPercent, imageContainer);

    outlineSvg.appendChild(rectElem);
    imageContainer.appendChild(outlineSvg);
    debugElements.push(outlineSvg);

    // Attach to global window for quick re-draw on resize
    if (!window._debugOutlineResizeHandler) {
        window._debugOutlineResizeHandler = () => {
            if (!document.contains(imageContainer)) return;
            // For all debug SVGs, update their rect dims using percentage-based positioning
            document.querySelectorAll('.debug-outline-svg').forEach(svg => {
                if (svg.__regionPercent && svg.firstChild) {
                    updateRectPosition(svg.firstChild, svg.__regionPercent, imageContainer);
                }
            });
        };
        // attach to custom resize event from image container
        imageContainer.addEventListener('imagecontainer-resize', window._debugOutlineResizeHandler);
        // Fallback: also attach to window 'resize'
        window.addEventListener('resize', window._debugOutlineResizeHandler);
    }

    return outlineSvg;
}

/**
 * Updates rectangle position based on percentage values and current container size
 */
function updateRectPosition(rectElement, regionPercent, container) {
    const currentWidth = container.offsetWidth;
    const currentHeight = container.offsetHeight;
    
    // Calculate absolute position based on percentages
    const x = regionPercent.x * currentWidth;
    const y = regionPercent.y * currentHeight;
    const width = regionPercent.width * currentWidth;
    const height = regionPercent.height * currentHeight;
    
    // Update rect attributes
    rectElement.setAttribute('x', x);
    rectElement.setAttribute('y', y);
    rectElement.setAttribute('width', width);
    rectElement.setAttribute('height', height);
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