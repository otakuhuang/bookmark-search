# 收藏夹AI助手

通过Chrome内置AI分析收藏夹，推荐合适的页面。

## 项目结构

```
bookmark-search/
├── manifest.json    # 扩展配置
├── popup/         # 对话界面
│   ├── popup.html
│   └── popup.js
├── background.js  # 后台脚本
└── images/        # 图标
```

## 安装

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目文件夹

## 使用Chrome内置AI

本插件使用Chrome内置的Prompt API (Gemini Nano)，需要满足以下条件：

- Chrome版本 >= 140
- 磁盘空间 >= 22GB
- 内存 >= 16GB
- Windows 10+/macOS 13+/Linux/Chromebook Plus

首次使用时模型会自动下载。

## 硬件要求

详细的硬件要求请参阅 [Chrome AI文档](https://developer.chrome.com/docs/ai/get-started?hl=zh-cn)。

## 使用

1. 点击插件图标打开对话框
2. 描述你想要的内容或需求
3. AI会分析你的收藏夹并推荐合适的页面

## 故障排除

如果AI不可用：

1. 检查Chrome版本是否 >= 140
2. 确保磁盘空间足够
3. 尝试在地址栏输入 `chrome://on-device-internals` 查看模型状态
4. 如果模型显示"available"但仍无法使用，可能需要开启实验标志
