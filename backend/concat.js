const fs = require('fs-extra');
const path = require('path');

// Directory containing the .md files
const sourceDir = 'markdown';

// Directory to save the concatenated files
const destDir = 'categories';

const separator = '\n---\n';
const bvPath = "buildVersion";

// Function to extract the class from a .md file
function extractClass(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/>\s*([\w\s-äöüÄÖÜß,-]+) ›|>\s*([\w\s-äöüÄÖÜß,-]+?)\n/);
  return match ? (match[1] || match[2]) : 'unknown'; // If no match is found, use 'unknown' as the class
}


async function createFilelist(created, buildVersion) {
  const files = created.map(filename => `'${filename}'`).join(',\n\t');
  const contents = `/* This file has been automatically generated. Do not modify. */
const buildVersion = ${buildVersion};
const mdFiles = [
    ${files}
];
`;
  console.log(contents)
  return await fs.writeFile(`${destDir}/filelist.js`, contents);
}

(async() => {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Read all .md files in the source directory
  let files = await fs.readdir(sourceDir);

  // Create an object to store content for each class
  const classContent = {};

  // Iterate through the .md files
  files.forEach(file => {
    if (path.extname(file) === '.md') {
      const filePath = path.join(sourceDir, file);
      const fileClass = extractClass(filePath);

      if (!classContent[fileClass]) {
        classContent[fileClass] = '';
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      classContent[fileClass] += fileContent + separator;
    }
  });

  // Write concatenated content to separate files for each class
  for (const classKey in classContent) {
    const classFileName = `${classKey}.md`;
    const classFilePath = path.join(destDir, classFileName);

    fs.writeFileSync(classFilePath, classContent[classKey]);
    console.log(`Concatenated ${classKey} to ${classFileName}`);
  }

  const fileList = Object.keys(classContent).map(classKey => {
    return path.join(destDir, `${classKey}.md`);
  });
  console.log(fileList)

  const buildVersion = +fs.readFileSync(bvPath);

  await createFilelist(fileList, buildVersion);
  console.log('File list created.');
})();


