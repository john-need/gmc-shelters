const path = require("path");

const fs = require("fs")



const renameFolder = (currPath, newPath) => {
    try {
        fs.renameSync(currPath, newPath)
        console.log("Successfully renamed the directory.")
    } catch (err) {
        console.log(err)
    }
}


const readFolders = () => {
    const myDir = path.resolve(__dirname);
    console.log("myDir: ", myDir);
    const folders = fs.readdirSync(myDir);
    console.log("folders: ", folders);
    const newFolders = folders
        .map((fn) => [fn, fn.toLowerCase()
            .replace(/-1st/gi, "-1")
            .replace(/-2nd/gi, "-2")
            .replace(/-3rd/gi, "-3")
            .replace(/--/gi, "-")
        ]);
    console.log("newFolders: ", newFolders);
    newFolders.forEach(([currPath, newPath]) => {
        renameFolder(path.join(myDir, currPath), path.join(myDir, newPath));
    });

};

readFolders();
