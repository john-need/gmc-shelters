const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const getArgValue = (flag) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) {
        return undefined;
    }
    return args[idx + 1];
};

const resolveInputPath = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    return path.resolve(value);
};

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE = resolveInputPath(getArgValue("--source"), path.join(PROJECT_ROOT, "gmc-website-content"));
const DEST = resolveInputPath(getArgValue("--dest"), path.join(PROJECT_ROOT, "shelters"));

const getUniqueFileName = (destDir, fileName) => {
    let candidate = fileName;
    let current = path.join(destDir, candidate);
    let suffix = 0;

    while (fs.existsSync(current)) {
        suffix++;
        const parsed = path.parse(fileName);
        candidate = `${parsed.name}-copy${suffix}${parsed.ext}`;
        current = path.join(destDir, candidate);
    }

    return candidate;
};

const copyFile = (src, dst, options = {}) => {
    const { dryRun = false } = options;

    if (dryRun) {
        console.log(`[DRY-RUN] Would copy: ${path.relative(SOURCE, src)} -> ${path.relative(DEST, dst)}`);
        return true;
    }

    try {
        fs.copyFileSync(src, dst);
        console.log(`Copied: ${path.basename(src)} -> ${path.relative(DEST, dst)}`);
        return true;
    } catch (err) {
        console.log(`Error copying ${src}: ${err.message}`);
        return false;
    }
};

const ensureDir = (dirPath, options = {}) => {
    const { dryRun = false } = options;

    if (fs.existsSync(dirPath)) {
        return true;
    }

    if (dryRun) {
        console.log(`[DRY-RUN] Would create dir: ${path.relative(DEST, dirPath)}`);
        return true;
    }

    try {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    } catch (err) {
        console.log(`Error creating directory ${dirPath}: ${err.message}`);
        return false;
    }
};

const mergeFolders = (options = {}) => {
    const { dryRun = false } = options;

    if (!fs.existsSync(SOURCE)) {
        console.log(`Source folder not found: ${SOURCE}`);
        return;
    }

    if (!fs.existsSync(DEST)) {
        console.log(`Dest folder not found: ${DEST}`);
        return;
    }

    console.log(`mode: ${dryRun ? "dry-run" : "apply"}`);
    console.log(`source: ${SOURCE}`);
    console.log(`dest: ${DEST}`);
    console.log("");

    let copiedCount = 0;
    let skippedCount = 0;

    // Iterate over source folders
    const sourceFolders = fs.readdirSync(SOURCE, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith("."))
        .map(e => e.name);

    for (const folderName of sourceFolders) {
        const sourceFolderPath = path.join(SOURCE, folderName);
        const destFolderPath = path.join(DEST, folderName);

        // Ensure dest folder exists
        if (!ensureDir(destFolderPath, options)) {
            skippedCount++;
            continue;
        }

        // Iterate over files in source folder
        const sourceFiles = fs.readdirSync(sourceFolderPath, { withFileTypes: true })
            .filter(e => e.isFile() && !e.name.startsWith("."))
            .map(e => e.name);

        for (const fileName of sourceFiles) {
            const sourceFilePath = path.join(sourceFolderPath, fileName);
            let destFileName = fileName;
            let destFilePath = path.join(destFolderPath, destFileName);

            // Handle collisions
            if (fs.existsSync(destFilePath)) {
                destFileName = getUniqueFileName(destFolderPath, fileName);
                destFilePath = path.join(destFolderPath, destFileName);
            }

            if (copyFile(sourceFilePath, destFilePath, options)) {
                copiedCount++;
            } else {
                skippedCount++;
            }
        }
    }

    console.log("");
    console.log(`Total copied: ${copiedCount}`);
    console.log(`Total skipped/failed: ${skippedCount}`);
    console.log("Done.");
};

mergeFolders({ dryRun });

