// Track debug elements for cleanup
let debugElements = [];

/**
 * Adds a debug outline around a specified region
 * NEW: Supports automatic adjustment/scaling with image-container size changes.
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

    // Store for scaling with container
    outlineSvg.__region = { ...region };

    // Set initial coords (these will be updated on resize as well)
    function updateRect() {
        const icW = imageContainer.offsetWidth;
        const icH = imageContainer.offsetHeight;
        // The region.x/y/width/height are relative to container's current size
        rectElem.setAttribute('x', region.x);
        rectElem.setAttribute('y', region.y);
        rectElem.setAttribute('width', region.width);
        rectElem.setAttribute('height', region.height);
    }
    updateRect();

    outlineSvg.appendChild(rectElem);
    imageContainer.appendChild(outlineSvg);
    debugElements.push(outlineSvg);

    // Attach to global window for quick re-draw on resize
    if (!window._debugOutlineResizeHandler) {
        window._debugOutlineResizeHandler = () => {
            if (!document.contains(imageContainer)) return;
            // For all debug SVGs, update their rect dims
            document.querySelectorAll('.debug-outline-svg').forEach(svg => {
                // Each svg should have its region on __region
                let r = svg.__region;
                if (r && svg.firstChild) {
                    svg.firstChild.setAttribute('x', r.x);
                    svg.firstChild.setAttribute('y', r.y);
                    svg.firstChild.setAttribute('width', r.width);
                    svg.firstChild.setAttribute('height', r.height);
                }
            });
        };
        // attach to custom resize event from image container
        imageContainer.addEventListener('imagecontainer-resize', window._debugOutlineResizeHandler);
        // Fallback in case: also attach to window 'resize'
        window.addEventListener('resize', window._debugOutlineResizeHandler);
    }

    return outlineSvg;
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