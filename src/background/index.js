// background.js - 轻量级 service worker
// 所有 embedding 工作都在 popup 中进行（因为 popup 支持 Web Worker）

console.log('Bookmark Search background service worker loaded');

// 监听书签变化
chrome.bookmarks.onCreated.addListener(() => {
  console.log('书签已添加，索引可能已过期');
});

chrome.bookmarks.onRemoved.addListener(() => {
  console.log('书签已删除，索引可能已过期');
});

chrome.bookmarks.onChanged.addListener(() => {
  console.log('书签已修改，索引可能已过期');
});
