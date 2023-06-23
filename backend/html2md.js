const fs = require('fs-extra');
const htmlToMarkdown = require('node-html-markdown');
const path = require('path');
const url = require('url');
const { JSDOM } = require('jsdom');

const sourceDir = 'html';
const destDir = 'markdown';

const nhm = new htmlToMarkdown.NodeHtmlMarkdown(
  /* options (optional) */ {}, 
  /* customTransformers (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);


function rename(subpage) {
  const u = new URL(subpage, "http://localhost/");  // second parameter is mandatory but irrelevant
  const file = u.pathname;
  if (path.extname(file).toLowerCase() !== '.html') return null;
  var filename = decodeURIComponent(path.parse(file).name);

  // rename 'zauber.html?zauber=Ablativum' to 'Ablativum.md'
  if (filename == "zauber") {
    filename = u.searchParams.get("zauber");
  }

  const blocklist = [/^_/, /^index/];
  const blocked = e => blocklist.some(r => r.test(e));
  if (blocked(filename)) return null;

  return filename + ".md";
}

function patch(markdown, file) {
  return markdown;
}


function reformat(htmlString) {
  const dom = new JSDOM(htmlString);
  const document = dom.window.document;

  const main = document.querySelector('#main > .mod_article');
  if (!main) return;

  function replaceAs(selector, newType) {
    main.querySelectorAll(selector).forEach(function (select) {
      // Replace the select with an newType element
      const newElement = document.createElement(newType);
      newElement.textContent = select.textContent;
      select.parentNode.replaceChild(newElement, select);
    });
  }

  // cleanup
  main.querySelectorAll('title').forEach((titleElement) => {
    titleElement.remove();
  });

  replaceAs('div.header', 'h1');
  // replaceAs('.body_einzeln + div:odd', 'b');  // :odd isn't supported atm.
  replaceAs('.body_einzeln', 'h3');

  const spalte1Divs = main.querySelectorAll('div.spalte1');

  // Iterate over the div.spalte1 elements
  spalte1Divs.forEach((div) => {
    // Convert div.spalte1 to <b> element
    const bElement = document.createElement('b');
    bElement.textContent = div.textContent;
    div.parentNode.replaceChild(bElement, div);

    // Get the following div sibling
    const siblingDiv = bElement.nextElementSibling;

    // Check if the sibling is a div
    if (siblingDiv && siblingDiv.tagName === 'DIV') {
      // Convert sibling div to <span> element
      const spanElement = document.createElement('span');
      spanElement.textContent = siblingDiv.textContent;

      // Insert the span element after the <b> element
      bElement.parentNode.insertBefore(spanElement, siblingDiv);

      // Insert a line break after the span element
      const brElement = document.createElement('br');
      bElement.parentNode.insertBefore(brElement, siblingDiv);

      // Remove the original sibling div
      siblingDiv.parentNode.removeChild(siblingDiv);
    }
  });

  // remove all #s
  main.innerHTML = main.innerHTML.replace(/#/g, '');

  // has to be a leaf article
  if (main.querySelectorAll('a').length) return;

  return main.outerHTML;
}


async function convert (subpage, sourceDir, destDir) {
  const filename = rename(subpage);
  if (!filename) return;

  const filePath = path.join(sourceDir, subpage);
  const destFilePath = path.join(destDir, filename);

  const html = await fs.readFile(filePath, 'utf8');

  const reformated = reformat(html);
  if (!reformated) return;

  var markdown = nhm.translate(reformated);
  markdown = patch(markdown, filename);
  if (!markdown) {
    console.log(`Ignoring empty file: ${filename}`);
    return;
  }

  await fs.writeFile(destFilePath, markdown);

  console.log(`File converted and created: ${filename}`);
  return filename;
}


async function createFilelist(created) {
  const filelist = "/* This file has been automatically generated. Do not modify. */\n" +
    "const mdFiles = [\n\t" +
      created.map(filename => `'${destDir}/${filename}'`).join(',\n\t') +
    "\n];\n";
  return await fs.writeFile(`${destDir}/filelist.js`, filelist);
}


(async() => {
  // main entry point
  await fs.ensureDir(destDir);
  const files = await fs.readdir(sourceDir);

  const conversions = files.map(async (subpage) => 
    await convert(subpage, sourceDir, destDir)
  );

  const created = (await Promise.all(conversions)).filter(_=>_);
  await createFilelist(created);
})();
