import { app } from "/scripts/app.js";

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

function showImageModal(base64DataWithPrefix) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: '10001',
        cursor: 'pointer'
    });

    const modalImg = document.createElement('img');
    modalImg.src = base64DataWithPrefix; // Use the full Data URI for display
    Object.assign(modalImg.style, {
        maxWidth: '90%', maxHeight: '90%', objectFit: 'contain',
        border: '2px solid white', borderRadius: '5px',
        cursor: 'zoom-in'
    });

    modalImg.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent closing modal when clicking image
        try {
            const match = base64DataWithPrefix.match(/^data:(image\/\w+);base64,(.*)$/);
            if (!match) {
                console.error("Invalid Data URI format for Blob conversion.");
                // Fallback: try opening the raw URI directly (might fail)
                window.open(base64DataWithPrefix, '_blank');
                return;
            }
            const contentType = match[1];
            const base64Raw = match[2];
            const blob = base64ToBlob(base64Raw, contentType);
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
            // Consider revoking the URL later if needed, but browser usually handles it
            // setTimeout(() => URL.revokeObjectURL(blobUrl), 60000); // Example: revoke after 1 minute
        } catch (error) {
            console.error("Error creating or opening Blob URL:", error);
            window.open(base64DataWithPrefix, '_blank'); // Fallback on error
        }
    });

    overlay.appendChild(modalImg);
    document.body.appendChild(overlay);

    const closeModal = () => {
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            window.removeEventListener('keydown', keydownHandler);
        }
    };

    const keydownHandler = (e) => {
        if (e.key === "Escape") {
            closeModal();
        }
    };
    window.addEventListener('keydown', keydownHandler);

    overlay.addEventListener('click', (e) => {
        // Only close if the click is directly on the overlay, not the image
        if (e.target === overlay) {
            closeModal();
        }
    });
}


app.registerExtension({
    name: "Comfy.EncryptPreviewImage",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "EncryptPreviewImage") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                const widget = {
                    type: "div",
                    name: "preview_grid",
                    draw: (ctx, node, widgetWidth, widgetHeight, scale) => {
                        const element = node.previewWidget.element;
                        Object.assign(element.style, {
                            width: `${widgetWidth}px`,
                            height: `${widgetHeight}px`,
                            overflow: 'auto',
                            border: '1px solid var(--border-color, #333)',
                            backgroundColor: 'var(--comfy-input-bg, #222)',
                            padding: '2px',
                        });
                    },
                    computeSize: (width) => {
                        return [width, 200];
                    },
                };

                widget.element = document.createElement('div');
                widget.element.className = 'encrypt-preview-grid-widget';
                this.addDOMWidget("preview_grid", "div", widget.element, widget);
                this.previewWidget = widget;
                this.setSize(this.computeSize());
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                const previewDiv = this.previewWidget?.element;
                if (!previewDiv) { return; }

                previewDiv.innerHTML = '';
                Object.assign(previewDiv.style, {
                     display: 'block',
                     gridTemplateColumns: '',
                     gap: ''
                 });

                if (message?.encrypted_previews && message.encrypted_previews.length > 0) {
                    const previews = message.encrypted_previews; // These are raw base64 strings
                    const numImages = previews.length;

                    const containerWidth = previewDiv.clientWidth - 4;
                    const gap = 4;
                    let grid = null;

                    // Simplified: Always use fallback calculation for now
                    // as the API call proved problematic without natural dimensions
                    const minCellWidth = 100;
                    const maxCols = 8;
                    let cols = Math.max(1, Math.floor(containerWidth / (minCellWidth + gap)));
                    cols = Math.min(cols, numImages, maxCols);
                    let cellWidth = Math.floor((containerWidth - (cols - 1) * gap) / cols);
                    cellWidth = Math.max(32, cellWidth);
                    grid = {
                        cols: cols,
                        imageWidth: cellWidth,
                        imageHeight: cellWidth
                    };

                    Object.assign(previewDiv.style, {
                        display: 'grid',
                        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                        gap: `${gap}px`,
                        alignItems: 'center',
                        justifyItems: 'center'
                    });

                    previews.forEach((base64Raw, index) => {
                        const img = document.createElement("img");
                        // IMPORTANT: Add the prefix here for display and passing to modal
                        const base64DataWithPrefix = `data:image/png;base64,${base64Raw}`;
                        img.src = base64DataWithPrefix;
                        img.alt = `Preview ${index + 1}`;
                        Object.assign(img.style, {
                            width: `${grid.imageWidth}px`,
                            height: `${grid.imageHeight}px`,
                            objectFit: 'contain',
                            cursor: 'pointer'
                        });

                        // Attach listener to show modal with the *prefixed* data URI
                        img.addEventListener('click', (e) => {
                            e.stopPropagation();
                            showImageModal(base64DataWithPrefix);
                        });
                        previewDiv.appendChild(img);
                    });

                } else {
                    previewDiv.textContent = 'No preview available.';
                }
            };
        }
    },
});