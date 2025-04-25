/**
 * Sets up the tool belt functionality
 */
export function setupToolBelt() {
    const toolSlots = document.querySelectorAll('.tool-slot');
    
    // Position the tool belt below the canvas region
    updateToolBeltPosition();
    
    // Set the first tool (magnifier) as active by default
    const magnifierSlot = document.querySelector('.tool-slot[data-tool="magnifier"]');
    if (magnifierSlot) {
        magnifierSlot.classList.add('active');
    }
    
    // Add click event listeners to tool slots
    toolSlots.forEach(slot => {
        if (slot.dataset.tool) { // Only add listener to slots that have tools
            slot.addEventListener('click', () => {
                // Remove active class from all tools
                toolSlots.forEach(s => s.classList.remove('active'));
                
                // Add active class to clicked tool
                slot.classList.add('active');
                
                // Set the current tool
                const toolType = slot.dataset.tool;
                setActiveTool(toolType);
            });
        }
    });
}

/**
 * Sets the active tool and updates the cursor
 */
function setActiveTool(toolType) {
    const imageContainer = document.getElementById('image-container');
    
    // Reset cursor to default first
    document.body.style.cursor = 'auto';
    imageContainer.style.cursor = 'auto';
    
    // Hide magnifier by default
    const magnifier = document.getElementById('magnifier');
    if (magnifier) {
        magnifier.style.display = 'none';
    }
    
    // Store the active tool for reference in other components
    window.activeTool = toolType;
    
    // Trigger a mousemove event to update the cursor based on the new tool
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

/**
 * Updates the tool belt position to be below the canvas region
 */
export function updateToolBeltPosition() {
    const toolBelt = document.getElementById('tool-belt');
    const { canvasRegion } = window;
    
    if (canvasRegion) {
        const bottom = canvasRegion.y + canvasRegion.height + 20; // 20px padding
        toolBelt.style.top = `${bottom}px`;
        toolBelt.style.bottom = 'auto';
    }
}