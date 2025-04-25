// script.js
import { generateAndSetImage } from './js/imageUtils.js';
import { clearDebugElements, addDebugOutline } from './js/debug.js';
import { startResizeMode, startResize, doResize, stopResize, endResizeMode } from './js/resizeTools.js';
import { moveMagnifier } from './js/magnifier.js';

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    generateAndSetImage();
});

document.addEventListener('contextmenu', (e) => {
    // Only show context menu when clicking inside canvas region
    // Context menu handling is in js/resizeTools.js
});

document.addEventListener('click', () => {
    // Hide context menu when clicking elsewhere
    // Context menu hiding is in js/resizeTools.js
});

document.addEventListener('mousemove', moveMagnifier);

document.addEventListener('mouseenter', () => {
    // We'll let the mousemove handler decide whether to show the magnifier
    // based on cursor position
});

document.addEventListener('mouseleave', () => {
    // Hide magnifier and reset cursor on mouse leave
    // Magnifier hiding is in js/magnifier.js
});

window.addEventListener('resize', () => {
    // Optional: Recalculate background size on window resize
    // Background size recalculation is in js/magnifier.js
});