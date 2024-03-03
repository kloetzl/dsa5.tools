const entryList = document.getElementById('entry-list');
const filterInput = document.getElementById('filter-input');

const separator = '\n---\n';
var converter;


async function loadParse(path) {
  try {
    const response = await fetch(path);
    var markdown = await response.text();
  } catch (e) {
    console.error('Failed to load ', path);
    return null;
  }

  const entries = markdown.split(separator);
  let elements = entries.filter(t => t).map(function parse(markdown) {
    const html = converter.render(markdown);
    const listItem = document.createElement('li');
    listItem.innerHTML = html;
    listItem.classList.add('list-group-item');
    return listItem;
  });

  // In order to accelerate the sorting we precompute the sort key here.
  let keys = elements.map(element => [
    (element.querySelectorAll('h1, h2') ?? [])[0]?.innerText,
    element
  ]);

  keys.sort(function sortCmp(a, b) {
    const aa = a[0];
    const bb = b[0];
    if (aa === bb) return 0;
    return aa < bb ? -1 : 1;
  });

  return keys.map(arr => arr[1]);
}


function render(elements) {
  const wrapper = document.createDocumentFragment();
  for (var listItem of elements) {
    wrapper.appendChild(listItem);
  }
  entryList.appendChild(wrapper);
}


const filterFunctions = {
  blockquote: (article, searchValue) => {
    let b = article.querySelector('blockquote');
    return b && b.innerText.toLowerCase().includes(searchValue);
  },
  kategorie: function (article, searchValue) {
    return this.blockquote(article, searchValue);
  },
  volltext: (article, searchValue) => {
    return article.innerText.toLowerCase().includes(searchValue);
  },
  oder: (article, searchValue) => {
    const words = searchValue.split(' ');
    const haystack = article.innerText.toLowerCase();
    return words.filter(word => word.trim()).some(word => haystack.includes(word.toLowerCase()))
  },
  name: (article, searchValue) => {
    let element = article.querySelector('h1, h2');
    return element && element.innerText.toLowerCase().includes(searchValue);
  },
  regex: (article, searchValue) => {
    let re = new RegExp(searchValue);
    return re.test(article.innerText.toLowerCase());
  }
  // Add more filtering functions as needed
};


function parseSearchQuery(query) {
  query = query.toLowerCase();
  const regex = /(\w+)\((.*?)\)|(\S+)/g;
  var searchCriteria = [];
  let match;

  while ((match = regex.exec(query))) {
    const [, type, value, plainWord] = match;
    if (type) {
      searchCriteria.push({ type, value });
    } else if (plainWord) {
      searchCriteria.push({ type: 'name', value: plainWord });
    }
  }

  searchCriteria = searchCriteria.filter(criterium => {
    const {type, value} = criterium;
    if (type in filterFunctions) {
      return true;
    }
    console.error(`Unsupported filter expression: ${criterium}`);
    return false;
  });

  if (searchCriteria.length == 1) {
    const {type, value} = searchCriteria[0];
    const fn = filterFunctions[type];
    return (entry => fn(entry, value));
  }

  return function doesMatch(entry) {
    return searchCriteria.every(criterium => {
      const {type, value} = criterium;
      return filterFunctions[type](entry, value);
    });
  };
}


function filterEntries(filterString, elements) {
  const matchesCriteria = parseSearchQuery(filterString);

  const entries = elements ?? entryList.getElementsByTagName('li');
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


function serializeStateToURL(state) {
  const params = new URLSearchParams();
  for (let key in state) {
    params.set(key, state[key]);
  }
  return '?' + params.toString();
}


setTimeout(async function main() {
  filterInput.addEventListener('input', function searchChange() {
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

  converter = new markdownit();
  const contents = mdFiles.map(async function (path) {
    const elements = await loadParse(path);
    if (filterString) {
      filterEntries(filterString, elements);
    }
    render(elements);
  });
  await Promise.all(contents);

  // add bootstrap styling
  for (let table of document.getElementsByTagName('table')) {
    table.classList.add('table');
  }

  if (filterString) {
    filterEntries(filterString);
  }
}, 1);
