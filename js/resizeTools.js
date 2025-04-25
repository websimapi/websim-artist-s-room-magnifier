import { canvasRegion, isPointInCanvas } from './canvasDetection.js';
import { clearDebugElements, addDebugOutline } from './debug.js';

// Resize state variables
export let isResizing = false;
let resizeHandles = [];
let resizeOutline = null;
let activeHandle = null;
let startX, startY, startWidth, startHeight, startLeft, startTop;

/**
 * Sets up resize tools and context menu
 */
export function setupResizeTools() {
    const imageContainer = document.getElementById('image-container');
    const contextMenu = document.getElementById('context-menu');
    const resizeOption = document.getElementById('resize-option');
    const submitResizeBtn = document.getElementById('submit-resize');
    
    // Context menu event listeners
    imageContainer.addEventListener('contextmenu', (e) => {
        // Only show context menu when clicking inside canvas region
        const x = e.clientX - imageContainer.getBoundingClientRect().left;
        const y = e.clientY - imageContainer.getBoundingClientRect().top;
        
        // Use the imported isPointInCanvas function
        if (isPointInCanvas(x, y)) {
            e.preventDefault();
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.top = `${e.clientY}px`;
        }
    });

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    // Resize option click handler
    resizeOption.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        startResizeMode();
    });
    
    // Submit resize button handler
    submitResizeBtn.addEventListener('click', () => {
        const rect = resizeOutline.getBoundingClientRect();
        const containerRect = imageContainer.getBoundingClientRect();
        
        // Update canvas region with new dimensions
        const newCanvasRegion = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
        };
        
        // Update the shared canvasRegion reference
        Object.assign(canvasRegion, newCanvasRegion);
        
        console.log('Canvas region updated:', canvasRegion);
        
        // Clean up resize elements
        endResizeMode();
        
        // Update the debug outline
        clearDebugElements();
        addDebugOutline(canvasRegion, 'red', 3, 1.0);
    });
}

/**
 * Starts resize mode for the canvas region
 */
function startResizeMode() {
    const imageContainer = document.getElementById('image-container');
    const resizeControls = document.getElementById('resize-controls');
    
    isResizing = true;
    
    // Create a resizable outline based on the current canvas region
    resizeOutline = document.createElement('div');
    resizeOutline.style.position = 'absolute';
    resizeOutline.style.border = '2px dashed #4CAF50';
    resizeOutline.style.left = canvasRegion.x + 'px';
    resizeOutline.style.top = canvasRegion.y + 'px';
    resizeOutline.style.width = canvasRegion.width + 'px';
    resizeOutline.style.height = canvasRegion.height + 'px';
    resizeOutline.style.pointerEvents = 'none';
    resizeOutline.style.zIndex = '999';
    imageContainer.appendChild(resizeOutline);
    
    // Add resize handles
    const handlePositions = [
        'top-left', 'top', 'top-right', 
        'left', 'right', 
        'bottom-left', 'bottom', 'bottom-right'
    ];
    
    handlePositions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.dataset.position = pos;
        handle.style.pointerEvents = 'auto';
        resizeOutline.appendChild(handle);
        resizeHandles.push(handle);
        
        handle.addEventListener('mousedown', startResize);
    });
    
    // Show submit button
    resizeControls.style.display = 'block';
    resizeControls.style.left = (canvasRegion.x + canvasRegion.width - 80) + 'px';
    resizeControls.style.top = (canvasRegion.y + canvasRegion.height - 40) + 'px';
    
    // Show normal cursor during resize mode instead of hiding it
    document.body.style.cursor = 'default';
    imageContainer.style.cursor = 'default';
}

/**
 * Starts the resize operation when handle is clicked
 */
function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    
    activeHandle = e.target;
    const rect = resizeOutline.getBoundingClientRect();
    
    startX = e.clientX;
    startY = e.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    startLeft = rect.left;
    startTop = rect.top;
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

/**
 * Performs the resize as mouse moves
 */
function doResize(e) {
    const imageContainer = document.getElementById('image-container');
    const resizeControls = document.getElementById('resize-controls');
    
    if (!activeHandle) return;
    
    const position = activeHandle.dataset.position;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const rect = resizeOutline.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft - containerRect.left;
    let newTop = startTop - containerRect.top;
    
    // Handle different resize directions
    if (position.includes('left')) {
        newWidth = startWidth - deltaX;
        newLeft = startLeft + deltaX - containerRect.left;
    } else if (position.includes('right')) {
        newWidth = startWidth + deltaX;
    }
    
    if (position.includes('top')) {
        newHeight = startHeight - deltaY;
        newTop = startTop + deltaY - containerRect.top;
    } else if (position.includes('bottom')) {
        newHeight = startHeight + deltaY;
    }
    
    // Apply minimum dimensions (50x50 pixels)
    if (newWidth < 50) {
        newWidth = 50;
        if (position.includes('left')) {
            newLeft = startLeft + startWidth - 50 - containerRect.left;
        }
    }
    
    if (newHeight < 50) {
        newHeight = 50;
        if (position.includes('top')) {
            newTop = startTop + startHeight - 50 - containerRect.top;
        }
    }
    
    // Update the outline dimensions
    resizeOutline.style.width = newWidth + 'px';
    resizeOutline.style.height = newHeight + 'px';
    resizeOutline.style.left = newLeft + 'px';
    resizeOutline.style.top = newTop + 'px';
    
    // Update submit button position
    resizeControls.style.left = (newLeft + newWidth - 80) + 'px';
    resizeControls.style.top = (newTop + newHeight - 40) + 'px';
}

/**
 * Stops the resize operation
 */
function stopResize() {
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
    activeHandle = null;
}

/**
 * Ends resize mode and cleans up
 */
function endResizeMode() {
    const imageContainer = document.getElementById('image-container');
    const resizeControls = document.getElementById('resize-controls');
    
    isResizing = false;
    
    // Remove resize handles and outline
    resizeHandles.forEach(handle => {
        if (handle.parentNode) {
            handle.parentNode.removeChild(handle);
        }
    });
    resizeHandles = [];
    
    if (resizeOutline && resizeOutline.parentNode) {
        resizeOutline.parentNode.removeChild(resizeOutline);
    }
    resizeOutline = null;
    
    // Hide resize controls
    resizeControls.style.display = 'none';
    
    // Return to 'none' cursor behavior
    document.body.style.cursor = 'none';
    imageContainer.style.cursor = 'none';
}