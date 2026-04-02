# Team Planner — 启用多人实时协作

当前项目的 `index.html` 已内建对 Firebase Realtime Database 的支持：只要把你的 Firebase web app 的 `firebaseConfig` 写入（或通过界面粘贴），打开分享链接后，其他人打开同一链接即可实时查看与编辑日历。

下面是启用步骤：

1. 在 Firebase 控制台创建项目
   - 访问 https://console.firebase.google.com/ ，创建一个新项目（免费）。
   - 在左侧选择 **Realtime Database** → **创建数据库**，测试模式（Test mode）可以快速开始。

2. 添加一个 Web App 并获取配置对象
   - 进入 **Project settings → General → Your apps → Add app (Web)**。
   - 记录下生成的 `firebaseConfig` 对象（含 `apiKey`、`databaseURL` 等字段）。

3. 在页面中配置
   - 本地调试：打开 `index.html`，点击页面顶部的“Share”或“Configure Firebase”按钮，粘贴你在上一步复制的 `firebaseConfig` JSON，然后保存并连接。
   - 或者直接把 `FIREBASE_CONFIG` 常量替换为你的配置，部署后每位访问相同 `#room=...` 的用户会同步同一个房间。

4. 分享房间
   - 页面会在 URL hash 中生成 `#room=<id>`（或你可以手动共享该链接）。任何打开该链接的人都会连接到同一个 Firebase 路径并实时同步数据。

5. 本地模式与注意事项
   - 如果未配置 Firebase，页面会在本地保存数据（local mode），此时不会与其他人同步。
   - 在测试阶段使用“测试模式”数据库要注意安全和权限，生产部署时请配置合适的数据库规则与认证。

可选：在无法使用 Firebase 时的替代方案
- 我可以为你添加一个基于 Node.js + Socket.IO 的简单后端（`server.js`）和前端连接代码，用于在局域网或自托管服务器上进行实时同步。如果需要我可以继续添加并演示如何运行它。

本地 Socket.IO 服务器（可选）
- 我已在仓库中添加了 `server.js` 和 `package.json`，可以在本地运行一个 Socket.IO 实时服务器，作为 Firebase 的替代方案或在无法使用 Firebase 时使用。

运行步骤：
1. 进入项目根目录（包含 `package.json` 和 `server.js`）

```bash
npm install
npm start
```

2. 打开浏览器访问 `index.html`（或直接通过 `http://localhost:3000/index.html`），页面会尝试连接到 `http://localhost:3000` 的 Socket.IO 服务器并加入当前 `#room=` 房间。

说明：
- 当本地 Socket.IO 服务器可用时，客户端会向服务器请求房间快照并通过 `writeEvent` 将事件发送到服务器，由服务器广播给同房间的其它客户端。
- 如果同时配置了 Firebase，Firebase 优先；否则客户端会优先使用本地 Socket.IO 服务器，再回退到本地浏览器存储。

安全：若在公网部署此服务器，请加固 CORS、认证以及持久化存储（当前为内存存储，仅用于本地或测试）。

---
如果你希望我直接添加 Socket.IO 后端与客户端集成，请回复“添加本地后端”，我会继续实现并将步骤写入 `package.json` 与 `server.js`。