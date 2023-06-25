const entryList = document.getElementById('entry-list');
const filterInput = document.getElementById('filter-input');

async function loadMarkdownFiles() {
  const converter = new markdownit();
  const contents = mdFiles.map(async function(path) {
    const response = await fetch(path);
    const markdown = await response.text();
    const html = converter.render(markdown);
    const listItem = document.createElement('li');
    listItem.innerHTML = html;
    listItem.classList.add('list-group-item');
    return listItem;
  });

  var elements = await Promise.all(contents);
  elements.sort(function (a, b) {
    const aa = (a.querySelectorAll('h1, h2') ?? [])[0]?.innerText;
    const bb = (b.querySelectorAll('h1, h2') ?? [])[0]?.innerText;
    if (aa === bb) return 0;
    return aa < bb ? -1 : 1;
  });

  const wrapper = document.createDocumentFragment();
  for (var listItem of elements) {
    wrapper.appendChild(listItem);
  }
  entryList.appendChild(wrapper);
}

function filterEntries() {
  const filterValue = filterInput.value.toLowerCase();
  const entries = entryList.getElementsByTagName('li');
  const searchType = 'simple'; //document.querySelector('input[name="search-type"]:checked').value;

  Array.from(entries).forEach((entry) => {
    const text = entry.innerText.toLowerCase();
    let isMatched = false;

    if (searchType === 'simple') {
      isMatched = text.includes(filterValue);
    } else if (searchType === 'regex') {
      const regex = new RegExp(filterValue, 'i');
      isMatched = regex.test(text);
    }

    if (isMatched) {
      entry.style.display = 'block';
    } else {
      entry.style.display = 'none';
    }
  });
}

loadMarkdownFiles();
filterInput.addEventListener('input', filterEntries);
