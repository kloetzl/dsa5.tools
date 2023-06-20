const fs = require('fs-extra');
const htmlToMarkdown = require('node-html-markdown');
const path = require('path');
const url = require('url');
const { JSDOM } = require('jsdom');

const sourceDir = 'html2';
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
  var filename = path.parse(file).name;

  if (filename == "zauber") {
    filename = u.searchParams.get("zauber");
  }

  const blocklist = [/^_/, /^index/];
  const blocked = e => blocklist.some(r => r.test(e));
  if (blocked(filename)) return null;

  return filename + ".md";
}

// Create the destination directory if it doesn't exist
fs.ensureDir(destDir, (err) => {
  if (err) {
    console.error('Error creating destination directory:', err);
    return;
  }

  fs.readdir(sourceDir, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }

    files.forEach((subpage) => {
      const filename = rename(subpage);
      if (!filename) return;

      const filePath = path.join(sourceDir, subpage);
      const destFilePath = path.join(destDir, filename);

      fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) {
          console.error('Error reading file:', err);
          return;
        }

        var markdown = nhm.translate(reformat(html));
        markdown = patch(markdown, filename);
        if (!markdown) {
          console.log(`Ignoring empty file: ${filename}`);
          return;
        }

        fs.writeFile(destFilePath, markdown, (err) => {
          if (err) {
            console.error('Error writing file:', err);
            return;
          }

          console.log(`File converted and created: ${filename}`);
        });
      });
    });
  });
});


function patch(markdown, file) {
  return markdown;
}


function reformat(htmlString) {
  const dom = new JSDOM(htmlString);
  const document = dom.window.document;

  const main = document.querySelector('#main > .mod_article');
  if (!main) return "";

  // Find the div elements with class="header"
  const headerDivs = document.querySelectorAll('div.header');
  headerDivs.forEach((div) => {
    // Replace the div with an h1 element
    const h1Element = document.createElement('h1');
    h1Element.textContent = div.textContent;
    div.parentNode.replaceChild(h1Element, div);
  });

  const spalte1Divs = document.querySelectorAll('div.spalte1');

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

  return main.outerHTML;
}

