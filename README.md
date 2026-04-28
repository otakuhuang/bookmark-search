# Bookmark Search

通过本地 AI 分析收藏夹，使用向量相似度搜索推荐合适的页面。

## 项目结构

```
bookmark-search/
├── manifest.json           # Chrome 扩展配置
├── package.json            # 依赖管理
├── vite.config.js          # Vite 构建配置
├── public/                 # 静态资源
├── images/                 # 图标
└── src/
    ├── background/         # 后台服务脚本
    │   └── index.js
    ├── popup/              # 弹窗界面
    │   ├── index.html
    │   └── main.js
    ├── utils/              # 工具函数
    │   ├── cosine.js       # 余弦相似度计算
    │   ├── indexdb.js      # IndexedDB 操作
    │   ├── queue.js        # 队列管理
    │   ├── workerClient.js # Worker 客户端
    │   └── writeQueue.js   # 写入队列
    └── worker/             # Web Worker
        └── embedding.worker.js
```

## 技术栈

- **构建工具**: Vite + @crxjs/vite-plugin
- **AI 模型**: @xenova/transformers (sentence-transformers/all-MiniLM-L6-v2)
- **存储**: IndexedDB (向量数据库)
- **向量计算**: Web Worker + 余弦相似度

## 安装

1. 克隆项目
2. 安装依赖: `bun install` 或 `npm install`
3. 构建: `bun run build` 或 `npm run build`
4. 打开 `chrome://extensions/`
5. 开启「开发者模式」
6. 点击「加载已解压的扩展程序」
7. 选择 `dist` 文件夹

## 开发

```bash
bun run dev    # 开发模式
bun run build  # 生产构建
```

## 工作原理

1. **索引构建**: 首次使用时，自动为所有收藏夹标题生成向量嵌入并存入 IndexedDB
2. **搜索**: 用户输入查询后，将查询文本转为向量
3. **相似度匹配**: 使用余弦相似度计算查询向量与所有书签向量的相似度
4. **结果返回**: 按相似度排序返回 Top 5 最相关的结果

## 硬件要求

- 内存 >= 8GB (推荐 16GB)
- 磁盘空间 >= 2GB (模型文件)

首次使用时 AI 模型会自动下载。
