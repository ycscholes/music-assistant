# 小提琴智能陪练小程序 MVP

这是一个原生微信小程序 + CloudBase 的 MVP，实现端上音高识别陪练流程。当前版本聚焦技术验证和最小产品闭环：录音、端上识别、音准反馈、评分、保存练习记录。

## 已实现能力

- 真机录音入口：使用 `wx.getRecorderManager()` 获取录音帧。
- 端上音高识别：使用 YIN 算法估计单音基频。
- 音名换算：按 A4=440Hz 转换为音名、频率和 cent 偏差。
- 基础评分：音准分 70% + 稳定性分 30%。
- 练习闭环：首页、检测页、结果页、历史记录页。
- 曲谱评测：内置练习曲、固定 BPM 时间线、本地五线谱显示、当前音符高亮、曲谱评测结果页。
- CloudBase 数据：通过 `wx.cloud.database()` 保存 `practice_sessions` 结构化记录。
- 隐私默认：不保存原始音频，不上传原始音频到第三方服务。

## 曲谱评测显示规则

- 曲谱准备页继续使用 `staff-score` 组件从本地 `notes` 数据渲染预览谱。
- 曲谱评测页优先使用构建期生成的正式谱面 PNG 系统图，每行固定 8 个节拍，不在小程序运行时加载 VexFlow。
- 生成资产位于 `miniprogram/images/scores/<pieceId>/system-000.png`，元数据位于 `miniprogram/utils/score-practice/generated-score-assets.js`。
- 当前评测音符通过元数据 `noteBoxes` 在图片上叠加高亮，随固定 BPM 时间线推进并自动切换当前系统。
- 如果某曲目缺少生成资产，评测页会回退到原有 `staff-score` WXML 简化谱面。

## 项目结构

```text
miniprogram/
  app.js
  app.json
  pages/
    index/      首页
    detect/     音准检测
    result/     练习结果
    history/    练习记录
    score-list/ 曲谱列表
    score-prepare/ 曲谱准备
    score-practice/ 曲谱评测
    score-result/ 曲谱评测结果
  components/
    staff-score/ 本地五线谱组件
  services/
    practice-store.js
  utils/
    audio-frame.js
    note.js
    pitch-yin.js
    score.js
    score-practice/
      generated-score-assets.js
      piece-library.js
      score-assets.js
      staff-layout.js
      metronome-timeline.js
      score-evaluator.js
      score-feedback.js
cloudfunctions/
  getOpenId/
test/
  pitch-utils.test.js
```

## CloudBase 配置

1. 在 `miniprogram/app.js` 中替换环境 ID：

```js
wx.cloud.init({
  env: 'brain-game-6gtx0hei4de22731',
  traceUser: true,
});
```

2. 创建数据库集合 `practice_sessions`。

3. 建议集合权限只允许用户读写自己的记录。客户端写入时不要手动设置 `_openid`，CloudBase 会自动注入。

4. `getOpenId` 云函数来自模板，当前 MVP 不依赖它完成主流程，可保留用于后续调试身份。

## 本地验证

```bash
npm run generate:score-assets
npm test
npm run check:js
```

## 开发环境

- 微信开发者工具已安装，CLI 路径为 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`。
- `codex` CLI 已安装，当前全局 MCP 包含 `github`、`playwright`、`context7`、`openaiDeveloperDocs`。
- `claude` CLI 已安装，建议使用用户级 MCP 配置，并在本项目加载 `.claude/settings.local.json`。
- CloudBase 与小程序开发规则以 `AGENTS.md`、`CLAUDE.md` 和 `rules/` 目录为准。

## 打开项目

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project /Users/paul/workspace/music-assistant
```

## 真机验收

- iOS 和 Android 各至少一台可以完成麦克风授权、开始检测、停止检测。
- 空弦 G/D/A/E 在安静环境下能稳定显示接近目标音名。
- 连续检测 30 秒不崩溃、不卡顿。
- 拒绝麦克风权限后有明确恢复指引。
- 练习结果可以保存到 `practice_sessions`，历史页可以读取。

## 已知限制

- 当前版本优先支持单音、空弦和简单长音。
- 不支持曲谱级纠错、复音识别、AI 点评和微信支付。
- 如果目标基础库或设备无法提供可分析的 PCM 录音帧，需要降级为录后一小段分析或重新评估音频采集路线。
