/**
 * Sets up the tool belt functionality
 */
export function setupToolBelt() {
    const toolSlots = document.querySelectorAll('.tool-slot');
    
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
    
    if (toolType === 'magnifier') {
        console.log('Magnifier tool selected');
        // We'll let the mousemove handler decide the cursor based on position
    } else if (toolType === 'brush') {
        console.log('Brush tool selected');
        // Always show brush cursor when brush tool is selected
        const brushCursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000000\' d=\'M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z\'/%3E%3C/svg%3E") 0 24, auto';
        document.body.style.cursor = brushCursor;
        imageContainer.style.cursor = brushCursor;
    }
    
    // Store the active tool for reference in other components
    window.activeTool = toolType;
}