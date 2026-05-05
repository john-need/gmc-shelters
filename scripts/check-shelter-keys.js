const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATABASE_PATH = path.join(PROJECT_ROOT, "database", "gmc_shelters.sqlite");
const SHELTERS_DIR = path.join(PROJECT_ROOT, "shelters");

const getShelterSlugs = (databasePath) => {
    const sql = "SELECT slug FROM shelters ORDER BY slug;";
    const raw = execFileSync("sqlite3", [databasePath, sql], { encoding: "utf8" });

    return raw
        .split(/\r?\n/)
        .map((slug) => slug.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
};

const getShelterFolders = (dirPath) => {
    return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
};

const difference = (left, rightSet) => left.filter((item) => !rightSet.has(item));

const printList = (title, items) => {
    console.log(`${title} (${items.length})`);

    if (items.length === 0) {
        console.log("  [none]");
        return;
    }

    for (const item of items) {
        console.log(`  - ${item}`);
    }
};

const main = () => {
    if (!fs.existsSync(DATABASE_PATH)) {
        console.error(`Missing database: ${DATABASE_PATH}`);
        process.exit(1);
    }

    if (!fs.existsSync(SHELTERS_DIR)) {
        console.error(`Missing directory: ${SHELTERS_DIR}`);
        process.exit(1);
    }

    const slugs = getShelterSlugs(DATABASE_PATH);
    const folders = getShelterFolders(SHELTERS_DIR);

    const slugSet = new Set(slugs);
    const folderSet = new Set(folders);

    const slugsWithoutFolder = difference(slugs, folderSet);
    const foldersWithoutSlug = difference(folders, slugSet);

    const summary = {
        databasePath: DATABASE_PATH,
        sheltersDir: SHELTERS_DIR,
        slugCount: slugs.length,
        folderCount: folders.length,
        slugsWithoutFolder,
        foldersWithoutSlug
    };

    console.log(`database slugs: ${slugs.length}`);
    console.log(`shelters folders: ${folders.length}`);
    console.log("");

    printList("Slugs with no matching folder", slugsWithoutFolder);
    console.log("");
    printList("Folders with no matching slug", foldersWithoutSlug);
    console.log("");
    console.log("JSON summary:");
    console.log(JSON.stringify(summary, null, 2));

    if (slugsWithoutFolder.length > 0 || foldersWithoutSlug.length > 0) {
        process.exit(1);
    }
};

main();

