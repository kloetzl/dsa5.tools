const fs = require('fs-extra');
const htmlToMarkdown = require('node-html-markdown');
const path = require('path');
const url = require('url');
const { JSDOM } = require('jsdom');

const sourceDir = 'html';
const destDir = 'markdown';

const nhm = new htmlToMarkdown.NodeHtmlMarkdown(
  {
    textReplace: [[/#/g, '']]
  },
  /* customTransformers (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);


function jobQueue(consume) {
  var queue = [];
  const maxJobs = 10;
  var runningJobs = 0;
  var signal;

  async function tryConsume() {
    while (runningJobs < maxJobs && queue.length) {
      runningJobs++;
      const job = queue.shift();
      await consume(job);
      runningJobs--;
    }
    if (runningJobs == 0 && queue == 0) {
      if (signal) {
        signal();
      }
    }
  }

  return {
    push : function (args) {
      queue.push(args);
      Promise.resolve().then(tryConsume);
    },
    done: async function () {
      return new Promise((resolve)=>{signal = resolve});
    }
  };
}


function rename(subpage) {
  const u = new URL(subpage, "http://localhost/");  // second parameter is mandatory but irrelevant
  const file = u.pathname;
  if (path.extname(file).toLowerCase() !== '.html') return null;
  var filename = decodeURIComponent(path.parse(file).name);

  const blocklist = [/^_/, /^index/];
  const blocked = e => blocklist.some(r => r.test(e));
  if (blocked(filename)) return null;

  // rename 'zauber.html?zauber=Ablativum' to 'Ablativum.md', etc.
  const rUrl = /\?\w+=(.+)$/;
  const match = rUrl.exec(subpage);
  if (match) {
    filename = match[1];
  }

  // avoid problems like 'Begabte/r Aufreißer/in.md'
  filename = filename.replace(/\//g, '_');
  return filename + ".md";
}


function patch(markdown, file) {
  return markdown;
}


function reformat(htmlString) {
  htmlString = htmlString.replaceAll("\uFEFF", "&nbsp;");
  const dom = new JSDOM(htmlString);
  const document = dom.window.document;

  const main = document.querySelector('#main > .mod_article');
  if (!main || !main.textContent.trim()) return;  // ignore empty articles

  const breadcrumbs = document.querySelectorAll('.breadcrumb_boxed')[0].textContent.split('›');
  var quote = document.createElement('blockquote');
  quote.innerHTML = breadcrumbs.slice(1, -1).join('›');
  main.insertBefore(quote, main.firstChild);

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
  const links = main.querySelectorAll('a');
  if (links.length > 1) return;

  for (var link of links) {
    const span = document.createElement('span');
    span.textContent = link.textContent;
    link.parentNode.insertBefore(span, link);
    span.parentNode.removeChild(link);
  }

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

  console.log(`Converted ${subpage} => ${filename}`);
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

  var res = [];
  var queue = jobQueue(async (subpage) => {
    var temp = await convert(subpage, sourceDir, destDir);
    res.push(temp)
  });

  for (var file of files) {
    queue.push(file);
  }

  await queue.done();

  const created = res.filter(_=>_);
  await createFilelist(created);
})();
