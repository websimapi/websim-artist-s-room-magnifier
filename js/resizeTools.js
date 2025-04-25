import { canvasRegion, isPointInCanvas, storeCanvasProportions, outlineVisible } from './canvasDetection.js';
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
    // Track mouse position globally for accurate cursor updates
    window.lastKnownMousePosition = { x: 0, y: 0 };
    document.addEventListener('mousemove', (e) => {
        window.lastKnownMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    const imageContainer = document.getElementById('image-container');
    const contextMenu = document.getElementById('context-menu');
    const resizeOption = document.getElementById('resize-option');
    const toggleOutline = document.getElementById('toggle-outline');
    const submitResizeBtn = document.getElementById('submit-resize');
    
    // Context menu event listeners
    imageContainer.addEventListener('contextmenu', (e) => {
        // Only show context menu when clicking inside canvas region
        const x = e.clientX - imageContainer.getBoundingClientRect().left;
        const y = e.clientY - imageContainer.getBoundingClientRect().top;
        
        // Use the imported isPointInCanvas function
        if (isPointInCanvas(x, y)) {
            e.preventDefault();
            
            // Position menu but ensure it stays in viewport
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Make sure menu is visible to calculate dimensions
            contextMenu.style.display = 'block';
            const menuWidth = contextMenu.offsetWidth;
            const menuHeight = contextMenu.offsetHeight;
            
            // Calculate position to keep menu in viewport
            let menuX = e.clientX;
            let menuY = e.clientY;
            
            if (menuX + menuWidth > viewportWidth) {
                menuX = viewportWidth - menuWidth - 5;
            }
            
            if (menuY + menuHeight > viewportHeight) {
                menuY = viewportHeight - menuHeight - 5;
            }
            
            contextMenu.style.left = `${menuX}px`;
            contextMenu.style.top = `${menuY}px`;
            
            // Focus the menu for keyboard navigation
            contextMenu.tabIndex = -1;
            contextMenu.focus();
        }
    });

    // Close context menu on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && contextMenu.style.display === 'block') {
            contextMenu.style.display = 'none';
        }
    });

    // Prevent menu from closing when clicking on the menu itself
    contextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        // Don't hide if clicking on the menu itself
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
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
        
        // Clean up resize elements and handle outline visibility
        endResizeMode();
    });
    
    // Toggle outline visibility handler
    toggleOutline.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        toggleOutlineVisibility();
    });
}

/**
 * Toggles the visibility of the canvas outline
 */
function toggleOutlineVisibility() {
    // Use imported outlineVisible
    outlineVisible = !outlineVisible;
    clearDebugElements();
    
    // Update menu text based on current state
    const toggleOutline = document.getElementById('toggle-outline');
    toggleOutline.textContent = outlineVisible ? 'Hide Outline' : 'Show Outline';
    
    // If visible, redraw the outline
    if (outlineVisible && canvasRegion) {
        addDebugOutline(canvasRegion, 'red', 3, 1.0);
    }
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
    
    // Update the outline dimensions with rounded values for pixel-perfect positioning
    resizeOutline.style.width = Math.round(newWidth) + 'px';
    resizeOutline.style.height = Math.round(newHeight) + 'px';
    resizeOutline.style.left = Math.round(newLeft) + 'px';
    resizeOutline.style.top = Math.round(newTop) + 'px';
    
    // Update submit button position with rounded values
    resizeControls.style.left = Math.round(newLeft + newWidth - 80) + 'px';
    resizeControls.style.top = Math.round(newTop + newHeight - 40) + 'px';
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
    
    // Reset cursor to default first
    document.body.style.cursor = 'auto';
    imageContainer.style.cursor = 'auto';
    
    // Store the new canvas proportions for proper resizing
    // Make sure all dimensions are integers to avoid floating point issues
    if (canvasRegion) {
        canvasRegion.x = Math.round(canvasRegion.x);
        canvasRegion.y = Math.round(canvasRegion.y);
        canvasRegion.width = Math.round(canvasRegion.width);
        canvasRegion.height = Math.round(canvasRegion.height);
        storeCanvasProportions();
    }
    
    // Restore outline if it was visible before
    if (outlineVisible) {
        clearDebugElements();
        addDebugOutline(canvasRegion, 'red', 3, 1.0);
    }
    
    // Set isResizing to false BEFORE dispatching mousemove event
    isResizing = false;
    
    // Get current mouse position for accurate event triggering
    const lastMousePosition = window.lastKnownMousePosition || { x: 0, y: 0 };
    
    // Trigger a mousemove event to update cursor based on position
    const event = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: lastMousePosition.x,
        clientY: lastMousePosition.y
    });
    document.dispatchEvent(event);
}