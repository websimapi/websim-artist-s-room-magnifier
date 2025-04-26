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
    
    // Initialize activeTools array to track multiple active tools
    window.activeTools = ['magnifier'];
    window.activeTool = 'magnifier';
    
    // Add click and contextmenu event listeners to tool slots
    toolSlots.forEach(slot => {
        if (slot.dataset.tool) { // Only add listener to slots that have tools
            // Left click selects a single tool
            slot.addEventListener('click', (e) => {
                const toolType = slot.dataset.tool;
                
                // Special handling for magnifier tool - toggle on/off
                if (toolType === 'magnifier') {
                    if (window.activeTools.includes('magnifier')) {
                        // Remove magnifier if it's active
                        window.activeTools = window.activeTools.filter(t => t !== 'magnifier');
                        slot.classList.remove('active');
                    } else {
                        // Add magnifier if it's not active
                        window.activeTools.push('magnifier');
                        slot.classList.add('active');
                    }
                } else {
                    // For other tools, behave as before
                    // Remove active class from all tools except magnifier
                    toolSlots.forEach(s => {
                        if (s.dataset.tool !== 'magnifier') {
                            s.classList.remove('active');
                        }
                    });
                    
                    // Add active class to clicked tool
                    slot.classList.add('active');
                    
                    // Set the current tools
                    const magnifierActive = window.activeTools.includes('magnifier');
                    window.activeTools = magnifierActive ? [toolType, 'magnifier'] : [toolType];
                }
                
                // Update the primary active tool for reference
                if (window.activeTools.length > 0) {
                    window.activeTool = window.activeTools[0];
                }
                
                // Update cursor based on active tools
                updateActiveToolCursor();
            });
            
            // Right click toggles a tool on/off without deselecting others
            slot.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // Prevent default context menu
                
                const toolType = slot.dataset.tool;
                
                // Toggle tool in activeTools array
                if (window.activeTools.includes(toolType)) {
                    // Only remove if it's not the last active tool
                    if (window.activeTools.length > 1) {
                        window.activeTools = window.activeTools.filter(t => t !== toolType);
                        slot.classList.remove('active');
                        
                        // If we removed the current primary tool, set a new one
                        if (window.activeTool === toolType) {
                            window.activeTool = window.activeTools[0];
                        }
                    }
                } else {
                    // Add tool to active tools
                    window.activeTools.push(toolType);
                    slot.classList.add('active');
                }
                
                // Update cursor based on active tools
                updateActiveToolCursor();
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
    
    // Update cursor based on active tools
    updateActiveToolCursor();
}

/**
 * Updates cursor based on active tools and position
 */
function updateActiveToolCursor() {
    // Trigger a mousemove event to update the cursor based on active tools
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