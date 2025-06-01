// js/api.js
(function() { // IIFE to avoid polluting global scope with helpers unnecessarily
    // Helper for random number in range
    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Helper for random file size
    const getRandomFileSize = () => {
        const size = Math.random() * 5; // 0-5
        if (size < 0.1) { // Make some files very small
             return `${getRandomInt(10, 99)}KB`;
        } else if (size < 1) {
            return `${getRandomInt(100, 999)}KB`;
        }
        return `${size.toFixed(1)}MB`; // e.g., 1.2MB, 4.8MB
    };

    // Helper for random dimensions
    const getRandomDimensions = () => {
        const commonWidths = [512, 768, 1024, 1280, 1920, 2048, 4096];
        const commonHeights = [512, 768, 1024, 720, 1080, 1536, 2160];

        let width = commonWidths[getRandomInt(0, commonWidths.length - 1)];
        let height = commonHeights[getRandomInt(0, commonHeights.length - 1)];

        // Occasionally make them non-standard but plausible
        if (Math.random() < 0.2) {
            width = getRandomInt(300, 4500);
             // ensure width is multiple of 8 for some encoders
            width = width - (width % 8);
        }
         if (Math.random() < 0.2) {
            height = getRandomInt(300, 4500);
            height = height - (height % 8);
        }
        // Ensure minimum dimensions
        width = Math.max(width, 64);
        height = Math.max(height, 64);

        return `${width}x${height}`;
    };

    // Helper for random past timestamp
    const getRandomPastTimestamp = () => {
        const now = Date.now();
        // Random time in the last 90 days
        const randomPastTime = now - getRandomInt(0, 1000 * 60 * 60 * 24 * 90);
        const date = new Date(randomPastTime);

        // Format: YYYY-MM-DD HH:MM:SS
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    if (!window.api) {
        window.api = {};
    }

    window.api.probeFile = function(serverAddress, filename, fileType, subfolder) {
        return new Promise((resolve, reject) => {
            const delay = getRandomInt(50, 300); // Simulate network latency: 50ms to 300ms

            setTimeout(() => {
                // Simulate server error (e.g., 5% chance)
                if (Math.random() < 0.05) {
                    reject({
                        status: 500,
                        message: `Simulated server error while probing ${filename} on ${serverAddress}`
                    });
                    return;
                }

                // Simulate file existence (e.g., 70% chance file is "found")
                if (Math.random() < 0.70) { // 70% chance of finding file
                    const actualFilename = filename; // e.g., ComfyUI_00001.png
                    const actualSubfolder = subfolder || ''; // Ensure subfolder is empty string if null/undefined
                    const pathOnServer = `/output/${actualSubfolder ? actualSubfolder.replace(/\/$/, '') + '/' : ''}`; // Ensure trailing slash if subfolder exists

                    // Construct mock URL (matches ComfyUI's /view endpoint structure)
                    // Example: http://127.0.0.1:8188/view?filename=ComfyUI_00001.png&type=output&subfolder=optional_folder
                    const url = `http://${serverAddress}/view?filename=${encodeURIComponent(actualFilename)}&type=output&subfolder=${encodeURIComponent(actualSubfolder.replace(/\/$/, ''))}`;

                    resolve({
                        filename: actualFilename,
                        path: pathOnServer, // Path relative to server's output directory
                        type: fileType ? fileType.toUpperCase() : 'UNKNOWN', // Ensure type is uppercase
                        size: getRandomFileSize(),
                        dimensions: getRandomDimensions(),
                        created: getRandomPastTimestamp(),
                        url: url
                    });
                } else {
                    // File not found
                    reject({
                        status: 404,
                        message: `File '${filename}' not found in subfolder '${subfolder || '(root output)'}' on server ${serverAddress}.`
                    });
                }
            }, delay);
        });
    };
})();
