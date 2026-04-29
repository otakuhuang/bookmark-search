# Bookmark Search

通过向量嵌入技术分析收藏夹，使用向量相似度搜索推荐合适的页面。

## 功能特性

- **语义搜索**: 使用多语言 Sentence Transformer 模型生成向量嵌入，理解中文语义
- **本地运行**: 所有模型在本地执行，保护隐私
- **快速响应**: HNSW 索引加速相似度搜索
- **断点续传**: 支持中断后继续处理

## 项目结构

```
bookmark-search/
├── manifest.json           # Chrome 扩展配置
├── package.json            # 依赖管理
├── vite.config.js          # Vite 构建配置
├── public/                 # 静态资源
│   ├── images/             # 图标
│   └── models/             # 模型文件
└── src/
    ├── background/          # 后台服务脚本
    │   └── index.js
    ├── popup/              # 弹窗界面
    │   ├── index.html      # 主界面
    │   ├── main.js
    │   ├── loading.html    # 加载页面
    │   ├── loading.js
    │   ├── settings.html   # 设置页面
    │   └── settings.js
    ├── sandbox/            # 沙箱环境 (嵌入模型运行)
    │   └── sandbox.html
    ├── utils/              # 工具函数
    │   ├── cosine.js       # 余弦相似度
    │   ├── hnswIndex.js     # HNSW 索引
    │   ├── indexdb.js      # IndexedDB 操作
    │   ├── queue.js        # 队列管理
    │   ├── workerClient.js # Worker 客户端
    │   └── writeQueue.js   # 写入队列
    └── worker/              # Web Worker
        └── embedding.worker.js
```

## 技术栈

- **构建工具**: Vite + @crxjs/vite-plugin
- **嵌入模型**: @xenova/transformers (paraphrase-multilingual-MiniLM-L12-v2)
- **存储**: IndexedDB (HNSW 向量索引)
- **向量计算**: Web Worker + 沙箱环境隔离

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

1. **初始化**: 用户首次使用时，显示 loading 页面
2. **向量生成**: 自动遍历所有书签，使用嵌入模型生成向量嵌入
3. **索引构建**: 将向量存入 IndexedDB 的 HNSW 索引
4. **搜索**: 用户输入查询后，转换为向量并在索引中查找相似结果
5. **结果展示**: 按相似度排序返回最相关的结果

## 硬件要求

- 内存 >= 8GB (推荐 16GB)
- 磁盘空间 >= 2GB (模型文件)

首次使用时嵌入模型会自动下载到本地。
