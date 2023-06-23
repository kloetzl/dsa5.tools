const entryList = document.getElementById('entry-list');
const filterInput = document.getElementById('filter-input');

function loadMarkdownFiles() {
  const converter = new markdownit();
  mdFiles.forEach((file) => {
    fetch(file)
      .then((response) => response.text())
      .then((markdown) => {
        if (!markdown) return;
        const html = converter.render(markdown);
        const listItem = document.createElement('li');
        listItem.innerHTML = html;
        listItem.classList.add('list-group-item');
        entryList.appendChild(listItem);
      })
      .catch((error) => {
        console.error('Error loading markdown file:', error);
      });
  });
}

function filterEntries() {
  const filterValue = filterInput.value.toLowerCase();
  const entries = entryList.getElementsByTagName('li');
  const searchType = document.querySelector('input[name="search-type"]:checked').value;

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
