const entryList = document.getElementById('entry-list');
const filterInput = document.getElementById('filter-input');

const separator = '\n---\n';

async function loadMarkdownFiles() {
  const converter = new markdownit();
  const contents = mdFiles.map(async function (path) {
    try {
      const response = await fetch(path);
      var markdown = await response.text();
    } catch (e) {
      console.error('Failed to load ', path);
      return null;
    }
    const entries = markdown.split(separator);
    return entries.filter(t => t).map(function (markdown) {
      const html = converter.render(markdown);
      const listItem = document.createElement('li');
      listItem.innerHTML = html;
      listItem.classList.add('list-group-item');
      return listItem;
    });
  });

  var elements = (await Promise.all(contents)).flat().filter(a => a !== null);
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


function parseSearchQuery(query) {
  const searchCriteria = [];
  const regex = /(\w+)\((.*?)\)|(\S+)/g;
  let match;

  while ((match = regex.exec(query))) {
    const [, type, value, plainWord] = match;
    if (type) {
      searchCriteria.push({ type, value });
    } else if (plainWord) {
      searchCriteria.push({ type: 'name', value: plainWord });
    }
  }

  return searchCriteria;
}


const filterFunctions = {
  blockquote: (article, searchValue) => {
    let b = article.querySelector('blockquote');
    return b && b.innerText.toLowerCase().includes(searchValue.toLowerCase());
  },
  kategorie: function (article, searchValue) {
    return this.blockquote(article, searchValue);
  },
  volltext: (article, searchValue) => {
    return article.innerText.toLowerCase().includes(searchValue.toLowerCase());
  },
  oder: (article, searchValue) => {
    const words = searchValue.split(' ');
    const haystack = article.innerText.toLowerCase();
    return words.filter(word => word.trim()).some(word => haystack.includes(word.toLowerCase()))
  },
  name: (article, searchValue) => {
    let element = article.querySelector('h1, h2');
    return element && element.innerText.toLowerCase().includes(searchValue.toLowerCase());
  },
  regex: (article, searchValue) => {
    let re = new RegExp(searchValue);
    return re.test(article.innerText.toLowerCase());
  }
  // Add more filtering functions as needed
};


function serializeStateToURL(state) {
  const params = new URLSearchParams();
  for (let key in state) {
    params.set(key, state[key]);
  }
  return '?' + params.toString();
}


function filterEntries(filterString) {
  const searchCriteria = parseSearchQuery(filterString);
  const matchesCriteria = (entry) => {
    return searchCriteria.every(criteria => {
      const {type, value} = criteria;
      if (type in filterFunctions) {
        return filterFunctions[type](entry, value);
      }
      console.error(`Unsupported filter expression: ${criteria}`);
      return false;
    });
  };

  const entries = entryList.getElementsByTagName('li');
  Array.from(entries).forEach((entry) => {
    let isMatched = matchesCriteria(entry);

    if (isMatched) {
      entry.style.display = 'block';
    } else {
      entry.style.display = 'none';
    }
  });

  document.getElementById('filter-input').classList.remove('is-invalid');
}


setTimeout(async function main() {
  filterInput.addEventListener('input', function searchChange () {
    clearTimeout(searchChange.debounceTimeoutId);
    searchChange.debounceTimeoutId = setTimeout(() => {
      const filterString = filterInput.value.toLowerCase();
      filterEntries(filterString);
      let newState = {filter: filterString};
      history.pushState(newState, document.title, serializeStateToURL(newState));
    }, 500); // Debounce delay in ms
  });

  window.addEventListener('popstate', (event) => {
    const newState = event.state;
    filterEntries(newState.filter);
  });

  if (window.location.search) {
    const searchParams = new URLSearchParams(window.location.search);
    var filterString = searchParams.get('filter');
    filterInput.value = filterString;
  }

  await loadMarkdownFiles();

  // add bootstrap styling
  for (let table of document.getElementsByTagName('table')) {
    table.classList.add('table');
  }

  if (filterString) {
    filterEntries(filterString);
  }
}, 1);
