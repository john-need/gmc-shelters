const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const IMAGE_EXTENSIONS = {
    ".jpg": true,
    ".jpeg": true,
    ".png": true,
    ".gif": true,
    ".webp": true,
    ".avif": true,
    ".svg": true,
    ".bmp": true,
    ".tif": true,
    ".tiff": true
};

const normalizeImageName = (name) => {
    const parsed = path.parse(name);
    const normalized = parsed.name
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-")
        .replace(/--+/g, "-")
        .trim();
    return `${normalized}${parsed.ext.toLowerCase()}`;
};

const renamePath = (currPath, newPath, options = {}) => {
    const { dryRun = false } = options;

    if (currPath === newPath) {
        return newPath;
    }

    if (fs.existsSync(newPath)) {
        console.log(`${dryRun ? "[DRY-RUN] " : ""}Skipping rename because target already exists: ${newPath}`);
        return currPath;
    }

    if (dryRun) {
        console.log(`[DRY-RUN] Would rename: ${path.basename(currPath)} -> ${path.basename(newPath)}`);
        return newPath;
    }

    try {
        fs.renameSync(currPath, newPath);
        console.log(`Renamed: ${path.basename(currPath)} -> ${path.basename(newPath)}`);
        return newPath;
    } catch (err) {
        console.log(`Error: ${err.message}`);
        return currPath;
    }
};

const processDirectory = (dirPath, options = {}) => {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                processDirectory(fullPath, options);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (IMAGE_EXTENSIONS[ext]) {
                    const normalized = normalizeImageName(entry.name);
                    if (normalized !== entry.name) {
                        const newPath = path.join(dirPath, normalized);
                        renamePath(fullPath, newPath, options);
                    }
                }
            }
        }
    } catch (err) {
        console.log(`Error processing directory ${dirPath}: ${err.message}`);
    }
};

const main = () => {
    const baseDir = path.resolve(__dirname, "..");
    const targetDirs = [
        path.join(baseDir, "gmc-website-content"),
        path.join(baseDir, "shelters")
    ];

    console.log(`mode: ${dryRun ? "dry-run" : "apply"}`);
    console.log(`base dir: ${baseDir}`);
    console.log("");

    for (const targetDir of targetDirs) {
        if (fs.existsSync(targetDir)) {
            console.log(`Processing: ${targetDir}`);
            processDirectory(targetDir, { dryRun });
            console.log("");
        } else {
            console.log(`Skipping (not found): ${targetDir}`);
            console.log("");
        }
    }

    console.log("Done.");
};

main();

