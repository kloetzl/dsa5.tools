const entryList = document.getElementById('entry-list');
const filterInput = document.getElementById('filter-input');

const separator = '\n---\n';
var converter;


async function loadParse(path) {
  try {
    const response = await mdRequests[path];
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
    (element.querySelectorAll('h1, h2') ?? [])[0]?.textContent,
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


function display(elements) {
  const wrapper = document.createDocumentFragment();
  for (var listItem of elements) {
    wrapper.appendChild(listItem);
  }
  entryList.appendChild(wrapper);
}


const filterFunctions = {
  blockquote: (article, searchValue) => {
    let b = article.querySelector('blockquote');
    return b && b.textContent.toLowerCase().includes(searchValue);
  },
  kategorie: function (article, searchValue) {
    return filterFunctions.blockquote(article, searchValue);
  },
  volltext: (article, searchValue) => {
    return article.textContent.toLowerCase().includes(searchValue);
  },
  oder: (article, searchValue) => {
    const words = searchValue.toLowerCase().split(' ');
    const haystack = article.textContent.toLowerCase();
    return words.filter(word => word.trim()).some(word => haystack.includes(word))
  },
  name: (article, searchValue) => {
    let element = article.querySelector('h1, h2');
    return element && element.textContent.toLowerCase().includes(searchValue);
  },
  regex: (article, searchValue) => {
    let re = new RegExp(searchValue);
    return re.test(article.textContent.toLowerCase());
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


function asPromise(thing) {
  return new Promise((resolve, reject) => {
    thing.onsuccess = () => resolve(thing.result);
    thing.onerror = () => reject(thing.error);
  });
}


function openIDB() {
  return new Promise(function (resolve, reject) {
    let conn = indexedDB.open('dsa5tools', buildVersion);
    let rebuild = false;
    conn.onupgradeneeded = function (e) {
      // This fires before 'onsuccess'
      if (!conn.result.objectStoreNames.contains('htmlcache')) {
        conn.result.createObjectStore('htmlcache');
      }
      // e.version < buildVersion is false on initial creation of the DB
      rebuild = true;
    };
    conn.onsuccess = function (e) {
      resolve({db: conn.result, rebuild: rebuild});
    };
    conn.onerror = function (e) {
      reject(conn.error);
    };
  });
}


async function makeFetcher(){
  let {db, rebuild} = await openIDB();
  makeFetcher.db = db;

  async function fromIDB(path) {
    let tx = db.transaction('htmlcache', 'readonly');
    let st = tx.objectStore('htmlcache');
    let str = await asPromise(st.get(path));
    if (str) {
      const htmlNodeStrings = JSON.parse(str);

      // Create new HTML nodes from the strings
      return htmlNodeStrings.map(htmlString => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;
        return tempDiv.firstChild;
      });
    } else {
      // key wasn't in the DB
      return fetchAndStore(path);
    }
  }

  async function fetchAndStore(path) {
    let elements = await loadParse(path);
    let tx = db.transaction('htmlcache', 'readwrite');
    let st = tx.objectStore('htmlcache');
    let str = JSON.stringify(elements.map(node => node.outerHTML));
    await asPromise(st.put(str, path)); // TODO: delay?
    return elements;
  }

  return rebuild ? fetchAndStore : fromIDB;
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

  const smartFetch = await makeFetcher();

  converter = new markdownit();
  const contents = mdFiles.map(async function (path) {
    const elements = await smartFetch(path);
    if (filterString) {
      filterEntries(filterString, elements);
    }
    display(elements);
  });
  await Promise.all(contents);

  // add bootstrap styling
  for (let table of document.getElementsByTagName('table')) {
    table.classList.add('table');
  }

  if (filterString) {
    filterEntries(filterString);
  }

  const clearCache = document.getElementById('clearcache');
  clearCache.addEventListener('click', async function (e) {
    makeFetcher.db.close();
    await asPromise(indexedDB.deleteDatabase('dsa5tools'));

    document.getElementById('success').style.display = "inline";
  });
}, 1);
