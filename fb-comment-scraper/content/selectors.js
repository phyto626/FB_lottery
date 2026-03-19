/**
 * Centralized DOM Selectors for Facebook Comments
 * As Facebook frequently updates its React class names, we rely heavily on generic 
 * attributes like `dir="auto"`, `role="article"`, or `role="button"`, as well as 
 * localized strings for multi-language support.
 */

const FBSelectors = {
  // Comment Container: FB comments usually have role="article"
  commentContainer: 'div[role="article"], div[data-testid="UFI2Comment/body"], div[data-commentid]',
  // Marker to identify the main post and avoid scraping it
  isPostArticle: 'h1, [data-testid="post_message"], [data-ad-comet-preview="message"]',

  // Username: Typically inside a strong tag, or a link with specific text direction
  userName: [
    'h3 span[dir="auto"]',
    'a[role="link"] strong',
    'a[role="link"] span[dir="auto"]'
  ],

  // Comment Text: The main body of the comment is usually setting dir="auto"
  // It can be a div or a span.
  commentText: 'div[dir="auto"], span[dir="auto"]',

  // Comment Time: Usually a relative time like "1h" or "2d" that is also a link
  commentTime: 'a[role="link"], a[target="_self"], span[aria-label], a[title]',

  // Image: Images attached to comments
  commentImage: 'a[role="link"] img, img[alt="Comment image"]',

  // "See more" text expansion button (within a comment)
  seeMoreButton: 'div[role="button"], span[role="button"]',
  seeMoreKeywords: ['See more', '查看更多', '… See more', '...查看更多'],
  seeLessKeywords: ['See less', '查看較少', 'See Less'],

  // Comment filter (Most Relevant / All Comments)
  filterDropdown: 'div[role="button"]',
  filterKeywords: ['Most relevant', '最相關', 'Newest', '最新', 'All comments', '所有留言'],
  allCommentsKeywords: ['All comments', '所有留言'],

  // "View more comments" / "Load more" button (at the bottom of the thread)
  loadMoreButton: 'div[role="button"], span[role="button"]',
  loadMoreKeywords: [
    'View more comments', 
    '查看更多留言', 
    'View previous comments', 
    '查看先前的留言', 
    'View more replies',
    '查看更多回覆',
    'Show more comments',
    '顯示更多留言',
    'More comments',
    '更多留言',
    'Load more',
    '載入更多',
    'Replies',
    '則回覆'
  ]
};

// Helper: check if element text or aria-label matches localized keywords
function matchesKeywords(element, keywords) {
  if (!element) return false;
  const text = (element.innerText || '').trim().toLowerCase();
  const label = (element.getAttribute('aria-label') || '').trim().toLowerCase();
  
  return keywords.some(kw => {
    const lkw = kw.toLowerCase();
    return text.includes(lkw) || label.includes(lkw);
  });
}

// Ensure it can be imported as module if used in proper module context, or global fallback
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FBSelectors, matchesKeywords };
} else {
  // For standard content script injection
  window.FBSelectors = FBSelectors;
  window.matchesKeywords = matchesKeywords;
}
