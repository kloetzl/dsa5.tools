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
  wrapper.append(...elements);
  entryList.appendChild(wrapper);
}


const filterFunctions = {
  blockquote: (article, searchValue) => {
    let b = article.querySelector('blockquote');
    return b && b.textContent.toLowerCase().includes(searchValue);
  },
  kategorie: (article, searchValue) => {
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



function extractCategoryFromEntry(entry) {
  const blockquote = entry.querySelector('blockquote');
  if (!blockquote) return null;

  const text = blockquote.textContent.trim();
  // Extract everything before the first "›"
  const parts = text.split('›');
  return parts.length > 0 ? parts[0].trim() : null;
}

function buildCategoryDropdown() {
  const categoryList = document.getElementById('category-list');
  
  // Sample categories

  const entries = Array.from(document.getElementsByClassName('list-group-item'));
  var categories = new Set();

  entries.forEach(entry => {
    const category = extractCategoryFromEntry(entry);
    if (category) {
      entry.setAttribute('data-category', category); // Used for filtering
      categories.add(category);
    }
  });

  categories = Array.from(categories);
  categories.sort();

  // Add categories to dropdown
  categories.forEach(category => {
    const item = document.createElement('li');
    item.innerHTML = `<a class="dropdown-item" href="#" data-category="${category}">${category}</a>`;
    categoryList.appendChild(item);
  });

  // Category selection
  categoryList.addEventListener('click', function(e) {
    if (e.target.classList.contains('dropdown-item')) {
      e.preventDefault();
      
      // Remove active class from all items
      document.querySelectorAll('#category-list .dropdown-item').forEach(item => {
        item.classList.remove('active');
      });
      
      // Add active class to clicked item
      e.target.classList.add('active');
      
      // Update dropdown button text
      const selectedText = e.target.textContent;
      const categoryDropdown = document.getElementById('category-dropdown');
      categoryDropdown.innerHTML = `<i class="bi bi-filter"></i> ${selectedText === 'Alle Kategorien' ? 'Alle' : selectedText}`;
      
      // Here you would trigger your filter function
      filterEntries(filterInput.value.toLowerCase());
    }
  });
  return;
}


function filterEntries(filterString, elements) {
  const selectedCategory = document.querySelector('#category-list .active')?.getAttribute('data-category')
  if (selectedCategory && selectedCategory != 'all') {
    filterString += ` kategorie(${selectedCategory})`;
  }

  const matchesCriteria = parseSearchQuery(filterString);
  const entries = elements ?? entryList.getElementsByClassName('list-group-item');

  Array.from(entries).forEach((entry) => {
    entry.style.display = matchesCriteria(entry) ? 'block' : 'none';
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


function glocal(haystack, needle) {
  haystack = ' ' + haystack.toLowerCase();
  needle = ' ' + needle.toLowerCase();

  const H = haystack.length - 1;
  const N = needle.length - 1;

  const MATCH = 2.0;
  const MISMATCH = -3.0;
  const GAP = -1.0;

  var matrix = []; // N x H
  for (let i = 0; i <= N; i++) {
    matrix[i] = Array(H + 1);
  }
  // We could get away with O(min(N, H)) memory but I don't care atm.

  // init, prefer matches starting at the beginning
  matrix[0][0] = MATCH * 2;
  for (let j = 1; j <= H; j++) {
    // favor matches at whole words
    matrix[0][j] = haystack[j] == ' ' ? MATCH : GAP;
  }
  for (let i = 1; i <= N; i++) {
    matrix[i][0] = needle[i] == ' ' ? MATCH : GAP;
  }

  // align needle against haystack
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= H; j++) {
      var diag = matrix[i - 1][j - 1] + (haystack[j] == needle[i] ? MATCH : MISMATCH);

      var top = matrix[i - 1][j] + GAP;
      var left = matrix[i][j - 1] + GAP;

      var score = Math.max(diag, top, left);

      if (i > 1 && j > 1) {
        // ignore swaps such as 'wuhctschlag'
        var swapped = haystack[j] == needle[i - 1] && haystack[j - 1] == needle[i];
        if (swapped) {
          score = Math.max(score, matrix[i - 2][j - 2] + MATCH);
        }
      }

      matrix[i][j] = score;
    }
  }

  // The needle should be matched completely. But I don't do matrix[N][H] as
  // that favors short haystacks.
  return Math.max(...matrix[N]);
}


function later(callback) {
  Promise.resolve().then(callback)
}


function tryReorder(filterString) {
  const isComplex = /(\w+)\((.*?)\)/g.test(filterString);
  if (isComplex) return;

  const visible = Array.from(entryList.getElementsByClassName('list-group-item'))
    .filter(entry => entry.style.display == "block");

  if (visible.length > 20 || visible.length < 2) return;

  var scoresAndElements = visible.map(function (entry) {
    const haystack = entry.querySelector('h1, h2').textContent.toLowerCase();
    const score = glocal(haystack, filterString);
    return [score + 1 / haystack.length, entry];
  });

  scoresAndElements = scoresAndElements
    .filter(pair => pair[0] > 0)
    .sort((a,b) => b[0] - a[0]); // descending

  const bestScore = scoresAndElements[0][0];
  const elements = scoresAndElements
    .filter(pair => pair[0] == bestScore)
    .map(pair => pair[1]);

  // hoist best entries
  entryList.prepend(...elements);
}


later(async function main() {
  filterInput.addEventListener('input', function searchChange() {
    clearTimeout(searchChange.debounceTimeoutId);
    searchChange.debounceTimeoutId = setTimeout(() => {
      const filterString = filterInput.value.toLowerCase();
      filterEntries(filterString);
      const newState = {filter: filterString};
      history.pushState(newState, document.title, serializeStateToURL(newState));

      later(() => tryReorder(filterString));
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

  buildCategoryDropdown();
});
