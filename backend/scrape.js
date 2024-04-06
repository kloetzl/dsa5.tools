const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Configuration
const baseUrl = 'https://dsa.ulisses-regelwiki.de/'; // Replace with the base URL
const outputDir = 'html'; // Replace with the path to the output directory
const requestDelay = 200; // Delay in milliseconds between consecutive requests
const requestLimit = 10000; // Number of requests to be made
const queue = ['hexenfluchauswahl.html'];  // Initial subpage to visit
const bvPath = "buildVersion";

// Create the output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Set of visited subpages
const visitedSubpages = new Set();

// Function to scrape a URL and save the HTML content
async function scrapeUrl(url, outputFilename) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const outputPath = path.join(outputDir, outputFilename);

    fs.writeFileSync(outputPath, html);
    console.log(`Saved: ${outputPath}`);
    visitedSubpages.add(url);

    const extractedLinks = extractLinks(html);
    queue.push(...extractedLinks);
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

    if (href && !visitedSubpages.has(href) && not_blocked(href)) {
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
  let requestCount = 0;

  while (requestCount < requestLimit && queue.length > 0) {
    const url = queue.shift();
    if (visitedSubpages.has(baseUrl + url)) continue;
    const outputFilename = url.replace(/\//g, '_');

    await scrapeUrl(`${baseUrl}${url}`, outputFilename);
    await delay(requestDelay);

    requestCount++;
  }

  console.log(queue);
}

function bumpBuildVersion() {
  var bv = 0;
  try {
    bv = +fs.readFileSync(bvPath);
  } catch (e){}
  bv++;
  fs.writeFileSync(bvPath, `${bv}\n`);
}

// Start scraping
startScraping();
bumpBuildVersion();
