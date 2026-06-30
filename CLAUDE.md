# Music Assistant - 小提琴智能陪练 微信小程序

## 项目概述

这是一个**原生微信小程序 + CloudBase** MVP 项目，实现端上音高识别陪练流程。当前版本聚焦技术验证和最小产品闭环，提供：录音、端上识别、音准反馈、评分、保存练习记录。

核心特性：
- 使用 `wx.getRecorderManager()` 获取录音帧进行真机录音
- 使用 YIN 算法在端上估计单音基频
- 按 A4=440Hz 转换为音名，并计算 cent 偏差
- 基础评分算法：音准分 70% + 稳定性分 30%
- 完整练习闭环：首页 → 检测页 → 结果页 → 历史记录页
- CloudBase 数据库集成，保存 `practice_sessions` 结构化练习记录
- 隐私优先：不保存原始音频，不上传原始音频到第三方服务

## 项目结构

```text
miniprogram/             # 小程序源代码
  app.js / app.json       # App 入口和配置
  pages/
    index/                # 首页 - 选择目标音开始练习
    detect/               # 音准检测页 - 录音和实时反馈
    result/               # 练习结果页 - 显示评分和详情
    history/              # 练习历史页 - 列出历史记录
  services/
    practice-store.js     # CloudBase 存储服务
  utils/
    audio-frame.js        # 音频帧处理
    note.js               # 音名 <-> 频率转换
    pitch-yin.js          # YIN 音高检测算法实现
    score.js              # 评分逻辑
    target-notes.js       # 小提琴目标音定义
    tuning-status.js      # 调弦状态计算
  components/
  app.wxss                # 全局样式
  sitemap.json            # 搜索索引配置

cloudfunctions/           # CloudBase 云函数
  getOpenId/              # 获取 openid 模板函数

rules/                    # CloudBase AI 开发技能 (26+ 技能已安装)
  web-development/        # Web 前端开发规则
  miniprogram-development/# 微信小程序开发规则
  ui-design/              # UI 设计规范
  auth-wechat/            # 小程序认证
  no-sql-wx-mp-sdk/       # 小程序数据库集成
  ... 其他 20+ 技能覆盖认证、后端、数据库、AI 集成等

test/                     # 单元测试
  pitch-utils.test.js     # 音高工具测试

stitch-assets/            # UI 设计原型资源
```

## 技术栈

- **框架**: 原生微信小程序
- **后端/云服务**: 腾讯 CloudBase (云开发)
- **数据库**: CloudBase NoSQL 文档数据库
- **音频处理**: 端上 YIN 音高检测算法
- **测试**: Node.js 内置测试运行器

## 开发命令

```bash
npm test                  # 运行单元测试
npm run check:js         # JavaScript 语法检查
```

## 开发工作流

1. **微信开发者工具** 是主要的 IDE 用于预览和调试
2. 所有小程序代码位于 `miniprogram/` 目录
3. CloudBase 配置在 `miniprogram/app.js`
4. 练习记录存储在 `practice_sessions` 集合
5. CloudBase 自动注入 `_openid` 用于认证写入
6. **每次完成代码改动后必须创建 git commit**，不得累积多个改动未提交。commit 前应运行 `npm test` 确保测试通过。

## MCP 服务器 (全局配置)

当前开发环境已配置以下 MCP 服务器：
- **GitHub**: GitHub 仓库管理和代码搜索/PR 操作
- **Playwright**: 浏览器自动化测试和 UI 预览
- **Context7**: 获取最新的第三方库与框架文档
- **OpenAI Developer Docs**: 查询 OpenAI / Codex / API 官方文档

优先约定：
- 遇到库版本、API 变更、安装配置问题时，优先使用 **Context7** 或 **OpenAI Developer Docs**，不要只依赖模型记忆。
- 遇到页面联调、流程回归、交互验证时，优先使用 **Playwright** 做浏览器侧检查。

## CloudBase 开发技能

本项目已预安装完整的 CloudBase AI 开发工具包，包含：

| 类别 | 技能 |
|------|------|
| 平台开发 | web-development, miniprogram-development, cloud-functions, cloudrun-development, cloudbase-platform |
| 认证 | auth-tool, auth-web, auth-wechat, auth-nodejs, auth-http-api |
| 数据库 | no-sql-web-sdk, no-sql-wx-mp-sdk, relational-database-tool, relational-database-web, data-model-creation |
| AI 集成 | ai-model-cloudbase, ai-model-nodejs, ai-model-web, ai-model-wechat, cloudbase-agent, cloudbase-agent-ts |

## 重要备注

- 当前 MVP 版本优先支持单音、空弦和简单长音
- 此版本不支持曲谱级纠错、复音识别、AI 点评和微信支付
- 隐私保护：从不存储或上传原始音频数据
- 需要用户麦克风权限
- 已在 iOS 和 Android 微信上测试验证

## CloudBase 配置

当前环境 ID 已配置在 `miniprogram/app.js`:
```javascript
wx.cloud.init({
  env: 'brain-game-6gtx0hei4de22731',
  traceUser: true,
});
```
