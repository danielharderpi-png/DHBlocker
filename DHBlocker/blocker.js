// 1. THE AUTOMATIC SWEEPER (Cleans up empty boxes and iframes)
const junkElements = document.querySelectorAll('iframe');

junkElements.forEach(element => {
  const parentBox = element.parentElement;
  
  // SAFEGUARD: Only delete the parent if it is NOT a core page structure
  if (parentBox && 
      parentBox.tagName !== 'BODY' && 
      parentBox.tagName !== 'HTML' && 
      parentBox.tagName !== 'MAIN') {
      
      parentBox.remove();
  }
  
  element.remove();
});

// 2. THE INTERACTIVE ZAPPER (Shift+Click to manually delete anything)
document.addEventListener('click', function(event) {
    // Checks if you are holding the Shift key during the click
    if (event.shiftKey) {
        event.preventDefault(); // Stops links or buttons from activating normally
        event.target.remove();  // Instantly deletes the exact element your mouse is over
    }
});