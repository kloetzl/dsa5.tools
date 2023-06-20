const entryList = document.getElementById('entry-list');
const filterInput = document.getElementById('filter-input');

function loadMarkdownFiles() {
  const files = [
    'markdown/Ablativum.md',
    'markdown/Abvenenum.md',
    'markdown/Adlerauge.md',
    'markdown/Adlerschwinge.md',
    'markdown/Aeolito.md',
    'markdown/Aerofugo.md',
    'markdown/Affenarme.md',
    'markdown/Affenruf.md',
    'markdown/Alpgestalt.md',
    'markdown/Altisonus.md',
    'markdown/Analys Arkanstruktur.md',
    'markdown/Angst auslösen.md',
    'markdown/Aquafaxius.md',
    'markdown/Aquaqueris.md',
    'markdown/Aquasphaero.md',
    'markdown/Arachnea.md',
    'markdown/KSF_Armbrist%C3%BCberdrehen.md',
    'markdown/KSF_AufDistanzhalten.md',
    'markdown/KSF_Auflaufen.md',
    'markdown/KSF_Aufmerksamkeit.md',
    'markdown/KSF_Ausfall.md',
    'markdown/KSF_BallistischerSchuss.md',
    'markdown/KSF_Beih%C3%A4ndigerKampf.md',
    'markdown/KSF_Belastungsgew%C3%B6hnung.md',
    'markdown/KSF_Berittene_Lanzenformation.md',
    'markdown/KSF_BerittenerFlugkampf.md',
    'markdown/KSF_BerittenerKampf.md',
    'markdown/KSF_BerittenerSch%C3%BCtze.md',
    'markdown/KSF_Besch%C3%BCtzer.md',
    'markdown/KSF_Bet%C3%A4ubungsschlag.md',
    'markdown/KSF_Blindkampf.md',
    'markdown/magie.md',
    'markdown/vor-und-nachteile.md',
    'markdown/zauberauswahl.md'
  ];

  files.forEach((file) => {
    fetch(file)
      .then((response) => response.text())
      .then((markdown) => {
        if (!markdown) return;
        const converter = new showdown.Converter();
        const html = converter.makeHtml(markdown);
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
