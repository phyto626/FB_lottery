let isScraping = false;
let scrapedComments = [];
let uniqueKeys = new Set();
let observer = null;
let scrollInterval = null;

// Helper to generate a unique key for deduplication
function getCommentKey(name, text) {
  // Use first 50 chars of text for composite key to avoid minor re-renders issue
  return `${name}-${text.substring(0, 50)}`;
}

// Function to safely execute clicks
function simulateClick(element) {
  if (element && typeof element.click === 'function') {
    element.click();
  }
}

// Expand "See more" texts inside comments
function expandLongTexts() {
  const buttons = Array.from(document.querySelectorAll(window.FBSelectors.seeMoreButton));
  buttons.forEach(btn => {
    // Only click if it matches "See more" AND does NOT match "See less"
    if (window.matchesKeywords(btn, window.FBSelectors.seeMoreKeywords) && 
        !window.matchesKeywords(btn, window.FBSelectors.seeLessKeywords)) {
      simulateClick(btn);
    }
  });
}

// Click "View more comments" / "Replies" - Systematically click ALL visible ones
function clickLoadMoreComments() {
  const buttons = Array.from(document.querySelectorAll(window.FBSelectors.loadMoreButton));
  let clickedCount = 0;
  buttons.forEach(btn => {
    if (window.matchesKeywords(btn, window.FBSelectors.loadMoreKeywords)) {
      // Small cooldown check to avoid rapid double clicks on same element if observer triggers fast
      if (btn.dataset.lastClicked && Date.now() - parseInt(btn.dataset.lastClicked) < 2000) return;
      
      simulateClick(btn);
      btn.dataset.lastClicked = Date.now();
      clickedCount++;
    }
  });
  return clickedCount > 0;
}

// Attempt to switch filter to "All Comments" if it's currently on "Most Relevant"
let filterSwitchAttempted = false;
function checkAndSwitchFilter() {
  if (filterSwitchAttempted) return;
  
  const buttons = Array.from(document.querySelectorAll(window.FBSelectors.filterDropdown));
  const filterBtn = buttons.find(btn => 
    window.matchesKeywords(btn, ['Most relevant', '最相關', 'Newest', '最新']) && 
    !window.matchesKeywords(btn, ['All comments', '所有留言'])
  );

  if (filterBtn) {
    console.log("FB Scraper: Found filter dropdown, opening...");
    simulateClick(filterBtn);
    
    // Wait for the popover to appear
    setTimeout(() => {
      const options = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="radio"], span'));
      const allCommentsOpt = options.find(opt => window.matchesKeywords(opt, ['All comments', '所有留言']));
      if (allCommentsOpt) {
        console.log("FB Scraper: Switching to ALL COMMENTS filter.");
        simulateClick(allCommentsOpt);
        filterSwitchAttempted = true;
      }
    }, 1000);
  }
}

// Parse a single comment node
function parseCommentNode(node) {
  try {
    // 1. Name extraction
    let name = '';
    for (let selector of window.FBSelectors.userName) {
      const nameEl = node.querySelector(selector);
      if (nameEl && nameEl.innerText) {
        name = nameEl.innerText.trim();
        break;
      }
    }
    
    // 2. Text extraction
    // Find all potential text fragments that are not part of the name
    const textEls = Array.from(node.querySelectorAll(window.FBSelectors.commentText));
    // Filter out elements that are likely wrappers for the name or have no text
    const filteredTextParts = textEls.filter(el => {
      // If it's the exact element used for the name, exclude it
      if (name && el.innerText.includes(name) && el.innerText.length < name.length + 5) return false;
      // Skip if it is a button (See more)
      if (el.getAttribute('role') === 'button') return false;
      return true;
    });

    // We want the most comprehensive text part, often the longest one if multiple are found
    // or join them if they are siblings. In modern FB, usually the first large block is it.
    let text = '';
    if (filteredTextParts.length > 0) {
      // Sort by length descending to find the main body if they are nested
      filteredTextParts.sort((a, b) => b.innerText.length - a.innerText.length);
      text = filteredTextParts[0].innerText.trim();
    }
    
    // 3. Time extraction
    let time = '';
    const nameEl = node.querySelector(window.FBSelectors.userName.join(','));
    
    // Helper to parse relative Chinese strings like "1小時", "2天前"
    function parseRelativeTime(str) {
      const now = Date.now();
      const numMatch = str.match(/(\d+)/);
      if (!numMatch) return null;
      const num = parseInt(numMatch[1]);
      if (str.includes('秒')) return new Date(now - num * 1000);
      if (str.includes('分')) return new Date(now - num * 60000);
      if (str.includes('小時') || str.includes('時')) return new Date(now - num * 3600000);
      if (str.includes('天')) return new Date(now - num * 86400000);
      if (str.includes('週') || str.includes('周')) return new Date(now - num * 604800000);
      if (str.includes('月')) return new Date(now - num * 2592000000);
      if (str.includes('年')) return new Date(now - num * 31536000000);
      return null;
    }

    // Helper to parse Chinese date strings like "2024年3月17日 21:30"
    function parseChineseDate(str) {
      if (!str) return null;
      const cleanStr = str.replace(/週./, '').replace(/\s+/g, ' ').trim();
      const match = cleanStr.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      if (match) {
        let h = 0, m = 0;
        const timePart = cleanStr.match(/(\d{1,2}):(\d{2})/);
        if (timePart) {
          h = parseInt(timePart[1]);
          m = parseInt(timePart[2]);
          if ((cleanStr.includes('下午') || cleanStr.includes('晚上') || cleanStr.includes('PM')) && h < 12) h += 12;
          if ((cleanStr.includes('上午') || cleanStr.includes('凌晨') || cleanStr.includes('AM')) && h === 12) h = 0;
        }
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), h, m);
      }
      return null;
    }

    function formatFBDate(date) {
      if (!date || isNaN(date.getTime())) return '';
      const month = date.getMonth() + 1;
      const day = date.getDate();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? '下午' : '上午';
      let displayHours = hours % 12;
      displayHours = displayHours ? displayHours : 12; 
      return `${month}月${day}日 ${ampm}${displayHours}:${minutes}`;
    }

    // Comprehensive search for anything that looks like time
    const timeElements = Array.from(node.querySelectorAll('a, span, b, div[data-utime], div[data-timestamp]'));
    let bestMatch = null;

    for (let el of timeElements) {
      // Skip name
      if (nameEl && nameEl.contains(el)) continue;

      // Priority 1: Unix timestamp attribute
      const utime = el.getAttribute('data-utime') || el.getAttribute('data-timestamp') || el.getAttribute('timestamp');
      if (utime && !isNaN(utime) && utime.length >= 10) {
        bestMatch = { date: new Date(parseInt(utime) * (utime.length === 10 ? 1000 : 1)), priority: 1 };
        break; 
      }

      // Priority 2: aria-label or title with full date
      const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (label && label.includes('年') && label.includes('日')) {
        const d = parseChineseDate(label);
        if (d) {
          if (!bestMatch || bestMatch.priority > 2) bestMatch = { date: d, priority: 2 };
        }
      }

      // Priority 3: Inner text that looks like full date
      const text = el.innerText.trim();
      if (text && text.includes('年') && text.includes('日')) {
        const d = parseChineseDate(text);
        if (d) {
           if (!bestMatch || bestMatch.priority > 3) bestMatch = { date: d, priority: 3 };
        }
      }

      // Priority 4: Relative time (1小時, 1天)
      const relativeKeywords = ['時', '分', '天', '秒', '昨天', '剛才'];
      if (text && relativeKeywords.some(kw => text.includes(kw)) && text.length < 10) {
        const d = parseRelativeTime(text);
        if (d) {
          if (!bestMatch || bestMatch.priority > 4) bestMatch = { date: d, priority: 4, raw: text };
        }
      }
    }

    if (bestMatch) {
      if (bestMatch.priority < 4) {
        time = formatFBDate(bestMatch.date);
      } else {
        // For relative time (1小時, 1天), don't calculate precise time to avoid duplicates
        // Just return the relative string as is for accuracy
        time = bestMatch.raw; 
      }
    }
    time = time.trim();

    // 4. Image extraction
    const imgEl = node.querySelector(window.FBSelectors.commentImage);
    const imageUrl = imgEl && imgEl.src ? imgEl.src : '';
    
    // Filter invalid ones or ones that are just standard links/shares
    if (!name || (!text && !imageUrl)) return null;
    
    return { name, text, time, imageUrl };
  } catch (err) {
    console.warn("Failed to parse a comment node", err);
    return null;
  }
}

// Process new nodes and extract data
function handleNewNodes() {
  expandLongTexts();
  
  const nodes = document.querySelectorAll(window.FBSelectors.commentContainer);
  let newFound = 0;
  
  nodes.forEach(node => {
    // 1. Skip if already processed
    if (node.dataset.scraped === 'true' || node.closest('[data-scraped="true"]')) return;

    // 2. Identify if this is the MAIN POST (we skip it)
    // The main post usually contains an H1 or a post message that is not a comment
    if (node.querySelector(window.FBSelectors.isPostArticle)) {
       node.dataset.scraped = 'true'; // Mark it as processed so we don't check again
       return;
    }

    // 3. For comments, try to find the actual article wrapper if we are nested
    const commentEl = node; 
    const data = parseCommentNode(commentEl);
    
    if (data) {
      // Final deduplication check using composite key
      const key = getCommentKey(data.name, data.text);
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        scrapedComments.push(data);
        newFound++;
        // Mark as scraped
        commentEl.dataset.scraped = 'true';
      }
    }
  });
  
    if (newFound > 0) {
      // Scroll the last comment into view to trigger lazy loading
      const lastNode = nodes[nodes.length - 1];
      if (lastNode) {
        lastNode.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }

      // Send progress update to popup/background
    try {
      chrome.runtime.sendMessage({
        type: 'PROGRESS_UPDATE',
        count: scrapedComments.length,
        comments: scrapedComments
      });
    } catch(e) { /* background might be disconnected temporarily */ }
  }
}

// Start scraping routine
function startScraper() {
  if (isScraping) return;
  isScraping = true;
  scrapedComments = [];
  uniqueKeys.clear();
  
  console.log("FB Comment Scraper: Started");
  
  // Set up MutationObserver to watch for new comments loaded into DOM
  observer = new MutationObserver((mutations) => {
    let shouldHandle = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        shouldHandle = true;
        break;
      }
    }
    if (shouldHandle) {
      handleNewNodes();
    }
  });
  
  // Observe the whole document body for simplicity and resilience
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Auto-scroll loop
  const minDelay = 1500;
  const maxDelay = 3500;
  let idleCounter = 0;
  
  const autoScroll = () => {
    if (!isScraping) return;
    
    // Attempt to switch to "All Comments" once it's detected
    checkAndSwitchFilter();
    
    const countBefore = scrapedComments.length;
    handleNewNodes(); 
    const countAfter = scrapedComments.length;
    
    if (countAfter > countBefore) {
      idleCounter = 0; // reset if we found new data
    } else {
      idleCounter++;
    }

    const clicked = clickLoadMoreComments();
    
    if (!clicked) {
      // Find the best scrollable container (often a modal for posts)
      const scrollable = Array.from(document.querySelectorAll('div[role="dialog"] div, div[role="main"] div, .x1n2onr6'))
        .filter(el => {
          const style = window.getComputedStyle(el);
          return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
        })
        .sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; 

      if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }
    }
    
    // Stop condition: No new comments AND no buttons to click for 10 consecutive cycles
    if (idleCounter > 10 && !clicked) {
      console.log("FB Scraper: No new content found for a while. Stopping.");
      stopScraper();
      return;
    }
    
    const nextDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
    scrollInterval = setTimeout(autoScroll, nextDelay);
  };
  
  autoScroll();
}

// Stop scraping routine
function stopScraper() {
  if (!isScraping) return;
  isScraping = false;
  console.log("FB Comment Scraper: Stopped");
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (scrollInterval) {
    clearTimeout(scrollInterval);
    scrollInterval = null;
  }
  
  // Final parse
  handleNewNodes();
  
  // Send final data
  try {
    chrome.runtime.sendMessage({
      type: 'SCRAPE_COMPLETE',
      count: scrapedComments.length,
      comments: scrapedComments
    });
  } catch(e) {}
}

// Listen for commands from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_SCRAPING') {
    startScraper();
    sendResponse({ status: 'started' });
  } else if (request.action === 'STOP_SCRAPING') {
    stopScraper();
    sendResponse({ status: 'stopped', comments: scrapedComments });
  } else if (request.action === 'GET_STATUS') {
    sendResponse({ 
      isScraping: isScraping, 
      count: scrapedComments.length, 
      comments: scrapedComments 
    });
  }
  return true;
});

// Inject marker to show script is active
window.fbScraperInjected = true;

// Check if we should auto-start (if navigation was triggered from extension)
chrome.storage.local.get(['autoStartScraping'], (result) => {
  if (result.autoStartScraping) {
    console.log('FB Scraper: Auto-start flag detected. Waiting for page load...');
    // Increased delay to 3 seconds for heavy FB pages
    setTimeout(() => {
      console.log('FB Scraper: Attempting auto-start...');
      startScraper();
      chrome.storage.local.remove(['autoStartScraping']);
    }, 3000);
  }
});
