// --- Keep base64ToBlob and showImageModal functions as they are ---
import { app } from "/scripts/app.js";

// --- base64ToBlob function ---
function base64ToBlob(base64, contentType = '') {
    const base64Data = base64.split(',')[1] || base64;
    const byteCharacters = atob(base64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    try {
        return new Blob(byteArrays, { type: contentType });
    } catch (e) {
        console.error("Blob construction failed:", e);
        throw e;
    }
}

// --- showImageModal function ---
function showImageModal(base64DataWithPrefix) {
    if (document.querySelector('.encrypt-preview-modal-overlay')) {
        console.warn("Modal already open.");
        return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'encrypt-preview-modal-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: '10001',
        cursor: 'pointer'
    });
    const modalImg = document.createElement('img');
    try {
        if (!base64DataWithPrefix || !base64DataWithPrefix.startsWith('data:image/')) {
             throw new Error("Invalid image data format for modal.");
        }
        modalImg.src = base64DataWithPrefix;
    } catch (error) {
        console.error("Error setting modal image source:", error);
        overlay.textContent = "Error loading image.";
        overlay.style.color = "white";
        overlay.style.fontSize = "20px";
        document.body.appendChild(overlay);
        setupModalCloseHandlers(overlay, null);
        return;
    }
    Object.assign(modalImg.style, {
        maxWidth: '90%', maxHeight: '90%', objectFit: 'contain',
        border: '2px solid white', borderRadius: '5px',
        cursor: 'zoom-in'
    });
    let blobUrl = null;
    modalImg.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
            const match = base64DataWithPrefix.match(/^data:(image\/\w+);base64,(.*)$/);
            if (!match) {
                console.error("Invalid Data URI format for Blob conversion. Opening raw URI.");
                window.open(base64DataWithPrefix, '_blank'); return;
            }
            const contentType = match[1]; const base64Raw = match[2];
            if (blobUrl) { URL.revokeObjectURL(blobUrl); }
            const blob = base64ToBlob(base64Raw, contentType);
            blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
            setTimeout(() => {
                if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
            }, 30000);
        } catch (error) {
            console.error("Error creating or opening Blob URL:", error);
            try { window.open(base64DataWithPrefix, '_blank'); } catch (fallbackError) {
                 console.error("Fallback opening Data URI also failed:", fallbackError); alert("Could not open image in a new tab.");
            }
        }
    });
    overlay.appendChild(modalImg);
    document.body.appendChild(overlay);
    function setupModalCloseHandlers(overlayElement, urlToRevokeRef) {
         let localBlobUrl = urlToRevokeRef;
        const closeModal = () => {
            if (document.body.contains(overlayElement)) {
                document.body.removeChild(overlayElement);
                window.removeEventListener('keydown', keydownHandler);
                if (localBlobUrl) {
                    URL.revokeObjectURL(localBlobUrl); localBlobUrl = null;
                    if (urlToRevokeRef === blobUrl) { blobUrl = null; }
                }
            }
        };
        const keydownHandler = (e) => { if (e.key === "Escape") { closeModal(); } };
        overlayElement.addEventListener('click', (e) => { if (e.target === overlayElement) { closeModal(); } });
        window.addEventListener('keydown', keydownHandler);
        return closeModal;
    }
    setupModalCloseHandlers(overlay, blobUrl);
}


app.registerExtension({
    name: "Comfy.EncryptPreviewImage.StructureFix",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "EncryptPreviewImage") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                const widget = {
                    type: "div",
                    name: "preview_widget_container", // Name for the widget itself
                    draw: (ctx, node, widgetWidth, widgetHeight, scale) => {
                        // Style the main container managed by the widget system
                        const element = node.previewWidget.element; // This is outerContainer
                        Object.assign(element.style, {
                            overflow: 'auto', // Scrollbars HERE on the outer container
                            border: '1px solid var(--border-color, #333)',
                            backgroundColor: 'var(--comfy-input-bg, #222)',
                            boxSizing: 'border-box',
                            width: '100%', // Try to ensure it takes full widget width
                            height: '100%', // Try to ensure it takes full widget height
                            padding: '0' // No padding on outer, let inner handle it
                        });
                    },
                    computeSize: (width) => {
                        // Increase base height slightly more?
                        return [width, 300]; // Base size [width, height]
                    },
                    value: null, // Store data if needed
                };

                // Create the OUTER container element managed by the widget
                widget.element = document.createElement('div');
                widget.element.className = 'encrypt-preview-outer-container';
                // Basic styles - width/height 100% might be set in draw or here. Let's try here too.
                // These refer to the space allocated by ComfyUI's widget manager
                widget.element.style.width = '100%';
                widget.element.style.height = '100%';
                widget.element.style.position = 'relative'; // Needed for potential absolute positioning inside? Maybe not.

                // Add the widget to the node
                this.addDOMWidget(widget.name, widget.type, widget.element, widget);
                this.previewWidget = widget; // Store reference

                // Set initial size
                this.setSize(this.computeSize());

                // Add placeholder content directly to outer container initially
                widget.element.style.display = 'flex';
                widget.element.style.alignItems = 'center';
                widget.element.style.justifyContent = 'center';
                widget.element.style.color = '#888';
                widget.element.textContent = 'Waiting for preview...';
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                const outerContainer = this.previewWidget?.element;
                if (!outerContainer) {
                    console.error("Preview outer container not found!");
                    return;
                }

                // Clear previous content AND placeholder styles from outer container
                outerContainer.innerHTML = '';
                outerContainer.style.display = ''; // Reset display potentially set for placeholder
                outerContainer.style.alignItems = '';
                outerContainer.style.justifyContent = '';
                outerContainer.style.color = '';

                // Create an INNER container DIV that will hold the actual content (grid or flex item)
                const contentDiv = document.createElement('div');
                contentDiv.className = 'encrypt-preview-content-div';
                outerContainer.appendChild(contentDiv); // Add inner to outer

                if (message?.encrypted_previews && message.encrypted_previews.length > 0) {
                    const previews = message.encrypted_previews;
                    const numImages = previews.length;

                    const MIN_CELL_WIDTH = 80;
                    const GAP = 4;

                    if (numImages === 1) {
                        // --- Single Image: Style the INNER container for centering ---
                        Object.assign(contentDiv.style, {
                            display: 'flex',
                            alignItems: 'center',     // Vert center in contentDiv
                            justifyContent: 'center', // Horiz center in contentDiv
                            width: '100%',            // Make contentDiv fill outerContainer
                            height: '100%',           // Make contentDiv fill outerContainer
                            padding: '2px'            // Small padding inside flex container
                        });

                        const base64Raw = previews[0];
                        const base64DataWithPrefix = `data:image/png;base64,${base64Raw}`;
                        const img = document.createElement("img");
                        img.src = base64DataWithPrefix;
                        img.alt = `Preview 1`;
                        Object.assign(img.style, {
                            maxWidth: '100%',    // Max width relative to contentDiv
                            maxHeight: '100%',   // Max height relative to contentDiv
                            objectFit: 'contain',
                            cursor: 'pointer',
                            display: 'block'
                        });
                        img.addEventListener('click', (e) => {
                            e.stopPropagation();
                            showImageModal(base64DataWithPrefix);
                        });
                        contentDiv.appendChild(img); // Add image to INNER container

                    } else {
                        // --- Multiple Images: Style the INNER container as a grid ---
                        Object.assign(contentDiv.style, {
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(${MIN_CELL_WIDTH}px, 1fr))`,
                            gap: `${GAP}px`,
                            padding: `${GAP}px`, // Padding inside the grid container
                            // DO NOT set height: 100% on the grid container itself.
                            // Let its height be determined by content. Outer container handles overflow.
                            // Set width: 100%? Maybe not needed if it's a block element? Let's try without first.
                            // width: '100%', // Let's omit this for grid, should be block default
                        });

                        previews.forEach((base64Raw, index) => {
                            const base64DataWithPrefix = `data:image/png;base64,${base64Raw}`;
                            const img = document.createElement("img");
                            img.src = base64DataWithPrefix;
                            img.alt = `Preview ${index + 1}`;
                            Object.assign(img.style, {
                                width: '100%',         // Fill grid cell width
                                // height: 'auto',     // Default, explicit 'auto' might help?
                                objectFit: 'contain',
                                cursor: 'pointer',
                                display: 'block',      // Prevents extra space below
                                // Add max-height to prevent tall images in narrow cells from becoming huge
                                // Use viewport units as a fallback guess? Or maybe % of container?
                                // maxHeight: '30vh', // Example: Limit height - Requires testing!
                                // Let's stick to basics first, remove explicit height/maxHeight
                            });
                            img.addEventListener('click', (e) => {
                                e.stopPropagation();
                                showImageModal(base64DataWithPrefix);
                            });
                            contentDiv.appendChild(img); // Add image to INNER container
                        });
                    }
                    this.previewWidget.value = message.encrypted_previews;

                } else {
                     // --- No Previews: Style INNER container for centering text ---
                     Object.assign(contentDiv.style, {
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         width: '100%', // Fill outer container
                         height: '100%',// Fill outer container
                         color: '#888',
                         fontSize: '14px',
                         padding: '10px',
                     });
                    contentDiv.textContent = 'No preview available.';
                    this.previewWidget.value = null;
                }

                // Might still need this, maybe even more important now
                app.graph.setDirtyCanvas(true, true);

            };

             const onRemoved = nodeType.prototype.onRemoved;
             nodeType.prototype.onRemoved = function() {
                 // Basic cleanup is handled by ComfyUI removing the widget element
                 onRemoved?.apply(this, arguments);
             };
        }
    },
});