// 收藏夹搜索插件 - 后台脚本

// 监听收藏夹变化，可用于缓存或统计
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  console.log('新增收藏夹:', bookmark.title);
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  console.log('删除收藏夹:', removeInfo.nodeTitles);
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  console.log('收藏夹已修改:', changeInfo.title);
});

chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
  console.log('收藏夹已移动');
});

// 可在此扩展其他功能，如快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-search') {
    console.log('触发搜索命令');
  }
});