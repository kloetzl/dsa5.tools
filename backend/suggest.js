const fs = require('fs-extra');
const http = require('http');
const url = require('url');

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

function suggest (haystack, needle) {
  var suggestions = []; // contains label key pairs

  for (var label of haystack) {
    var score = glocal(label, needle);
    if (score > 0) {
      suggestions.push([label, score]);
    }
  }

  suggestions.sort(function(a, b) {
    return b[1] - a[1]; // sort by score
  });

  var good = suggestions.slice(0, 10);
  var best = good[0][1];
  return good.filter(a => a[1] >= best / 2).map(a => a[0]);
}

const haystack = fs.readFileSync('haystack.txt', 'utf8').split('\n').map(term => term.trim());

http.createServer(function (req, res) {
  const query = url.parse(req.url).query;
  if (!query) return;

  let term = query.subst(5, 20);
  if (!term) return;

  let data = [term,
    suggest(haystack, term)
  ];

  res.writeHead(200, {'Content-Type': 'application/application/x-suggestions+json'});
  res.end(JSON.stringify(data));
}).listen(62444);
