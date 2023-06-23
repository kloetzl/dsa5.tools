const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Configuration
const baseUrl = 'https://ulisses-regelwiki.de/'; // Replace with the base URL
const outputDir = 'html'; // Replace with the path to the output directory
const requestDelay = 1000; // Delay in milliseconds between consecutive requests
const requestLimit = 30; // Number of requests to be made

// Create the output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Set of visited subpages
const visitedSubpages = new Set();

// Function to scrape a URL and save the HTML content
async function scrapeUrl(url, outputFilename) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36',
      },
    });
    const html = response.data;
    const outputPath = path.join(outputDir, outputFilename);
    fs.writeFileSync(outputPath, html);
    console.log(`Saved: ${outputPath}`);
    visitedSubpages.add(url);
  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
  }
}

// Function to extract links from the HTML content
function extractLinks(html) {
  const dom = new JSDOM(html);
  const links = dom.window.document.querySelectorAll('a');
  const extractedLinks = [];

  for (const link of links) {
    const href = link.getAttribute('href');
    const blocklist = [/\//, /#/, /@/, /WdV18/, /start.html/];
    const not_blocked = e => !blocklist.some(r => r.test(e));

    if (href && !visitedSubpages.has(baseUrl + href) && not_blocked(href)) {
      extractedLinks.push(href);
    }
  }

  return extractedLinks;
}

// Function to delay execution
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to start scraping
async function startScraping() {
  const queue = ['sf_kampfsonderfertigkeiten.html'];
  let requestCount = 0;

  while (requestCount < requestLimit && queue.length > 0) {
    const url = queue.shift();
    const outputFilename = `${url.replace(/\//g, '_')}`;

    await scrapeUrl(`${baseUrl}${url}`, outputFilename);
    await delay(requestDelay);

    const response = await axios.get(`${baseUrl}${url}`);
    const html = response.data;
    const extractedLinks = extractLinks(html);
    queue.push(...extractedLinks);

    requestCount++;
  }

  console.log(queue);
}

// Start scraping
startScraping();
