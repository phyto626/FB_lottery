let currentTabId = null;
let scrapedData = [];

// DOM Elements
const warningPanel = document.getElementById('warningPanel');
const mainPanel = document.getElementById('mainPanel');
const statusBadge = document.getElementById('statusBadge');
const commentCountEl = document.getElementById('commentCount');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const urlInput = document.getElementById('urlInput');
const goBtn = document.getElementById('goBtn');
const previewList = document.getElementById('previewList');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const copyBtn = document.getElementById('copyBtn');

// Initialize
async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;
  const tab = tabs[0];
  currentTabId = tab.id;

  // Handle auto-start from storage if we just opened/reloaded this tab
  await checkAutoStart();

  if (!tab.url || !tab.url.includes('facebook.com')) {
    warningPanel.classList.remove('hidden');
    // Hide parts of main panel to guide user to input URL
    statBoxList = mainPanel.querySelectorAll('.stats, .preview-section, .export-controls');
    statBoxList.forEach(el => el.style.display = 'none');
    startBtn.style.display = 'none';
    stopBtn.style.display = 'none';
  }

  // Check if content script is already injected and running
  try {
    const response = await chrome.tabs.sendMessage(currentTabId, { action: 'GET_STATUS' });
    if (response) {
      scrapedData = response.comments || [];
      updateUIParams(response.count, scrapedData);
      setScrapingState(response.isScraping);
    }
  } catch (e) {
    // Content script not injected yet, perfectly normal
    setScrapingState(false);
  }
}

async function checkAutoStart() {
  const data = await chrome.storage.local.get(['autoStartScraping', 'targetTabId']);
  if (data.autoStartScraping && data.targetTabId === currentTabId) {
    // Clear the flag
    await chrome.storage.local.remove(['autoStartScraping', 'targetTabId']);
    // Trigger start
    startScrapingProcess();
  }
}

async function startScrapingProcess() {
  // Inject scripts if not already present
  await chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    files: ['content/selectors.js', 'content/scraper.js']
  }).catch(() => {}); // ignore error if already injected

  chrome.tabs.sendMessage(currentTabId, { action: 'START_SCRAPING' }, (res) => {
    if (res && res.status === 'started') {
      scrapedData = [];
      updateUIParams(0, []);
      setScrapingState(true);
    }
  });
}

function setScrapingState(isScraping) {
  if (isScraping) {
    statusBadge.textContent = 'Scraping...';
    statusBadge.classList.add('active');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    exportCsvBtn.disabled = true;
    exportJsonBtn.disabled = true;
    copyBtn.disabled = true;
  } else {
    statusBadge.textContent = scrapedData.length > 0 ? 'Finished' : 'Idle';
    statusBadge.classList.remove('active');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    // Enable exports if we have data
    const hasData = scrapedData.length > 0;
    exportCsvBtn.disabled = !hasData;
    exportJsonBtn.disabled = !hasData;
    copyBtn.disabled = !hasData;
  }
}

function updateUIParams(count, comments) {
  commentCountEl.textContent = count;
  
  // Render preview (latest 3)
  previewList.innerHTML = '';
  if (comments && comments.length > 0) {
    const latest = comments.slice(-3).reverse();
    latest.forEach(c => {
      const li = document.createElement('li');
      
      const nameEl = document.createElement('span');
      nameEl.className = 'preview-name';
      nameEl.textContent = c.name || 'Anonymous';
      
      const timeEl = document.createElement('span');
      timeEl.className = 'preview-time';
      timeEl.textContent = c.time || '';

      const textEl = document.createElement('span');
      textEl.className = 'preview-text';
      textEl.textContent = c.text || (c.imageUrl ? '[Image Comment]' : '');
      
      li.appendChild(nameEl);
      li.appendChild(timeEl);
      li.appendChild(textEl);
      previewList.appendChild(li);
    });
  } else {
    previewList.innerHTML = '<li class="empty-state">No comments yet</li>';
  }
}

// Event Listeners
startBtn.addEventListener('click', () => {
  startScrapingProcess();
});

goBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) return;
  if (!url.startsWith('http')) {
    alert('請輸入正確的網址（包含 http:// 或 https://）');
    return;
  }

  // Create new tab
  const tab = await chrome.tabs.create({ url, active: true });
  // Set flag for auto-start in the new tab
  await chrome.storage.local.set({ 
    autoStartScraping: true, 
    targetTabId: tab.id 
  });
});

stopBtn.addEventListener('click', () => {
  chrome.tabs.sendMessage(currentTabId, { action: 'STOP_SCRAPING' }, (res) => {
    if (res && res.status === 'stopped') {
      scrapedData = res.comments || [];
      updateUIParams(scrapedData.length, scrapedData);
      setScrapingState(false);
    }
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PROGRESS_UPDATE') {
    scrapedData = msg.comments;
    updateUIParams(msg.count, msg.comments);
  } else if (msg.type === 'SCRAPE_COMPLETE') {
    scrapedData = msg.comments;
    updateUIParams(msg.count, msg.comments);
    setScrapingState(false);
  }
});

// EXPORT LOGIC
function escapeCsv(val) {
  if (!val) return '""';
  const str = String(val).replace(/"/g, '""');
  if (str.search(/("|,|\n|\r)/g) >= 0) {
    return `"${str}"`;
  }
  return str;
}

exportCsvBtn.addEventListener('click', () => {
  if (scrapedData.length === 0) return;
  // Included a formula column for Excel/Google Sheets to show the image directly
  const header = ['Name', 'Comment', 'Time', 'ImageURL', 'ImagePreview'].join(',');
  const rows = scrapedData.map(c => [
    escapeCsv(c.name),
    escapeCsv(c.text),
    escapeCsv(c.time),
    escapeCsv(c.imageUrl),
    c.imageUrl ? escapeCsv(`=IMAGE("${c.imageUrl}")`) : '""'
  ].join(','));
  
  const csvContent = header + '\n' + rows.join('\n');
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
  
  downloadBlob(blob, 'fb-comments.csv');
});

exportJsonBtn.addEventListener('click', () => {
  if (scrapedData.length === 0) return;
  
  // Create an object compatible with fb-lottery expectations if needed
  // fb-lottery accepts array of strings or simple formats, but JSON array of objects is safest for standard use
  const blob = new Blob([JSON.stringify(scrapedData, null, 2)], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, 'fb-comments.json');
});

copyBtn.addEventListener('click', () => {
  if (scrapedData.length === 0) return;
  const tsv = scrapedData.map(c => `${c.name}\t${c.time || ''}\t${(c.text || '').replace(/\n/g, ' ')}\t${c.imageUrl || ''}`).join('\n');
  navigator.clipboard.writeText(tsv).then(() => {
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
  });
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

init();
