⏺ UI Design Spec Review

  总体评价

  Spec 的美学方向很清晰——"纸面调音器 + 乌木象牙"的混合体，冷静、精确、成熟。当前代码里 detect 页已经部分走了这条路（暖色羊皮纸渐变、Georgia
  衬线、木质调色板），但首页/result/历史页仍停留在冷色灰绿的"企业工具"风格。Spec 的核心任务是把 detect 页的气质扩散到全应用，这个方向是对的。

  以下是我的建议：

  ---
  1. 最大风险：冷色全局 token 与暖色 spec 的冲突

  当前 app.wxss 定义了 10 个 CSS 自定义属性，全部是冷色调：

  ┌──────────────┬──────────────────┬──────────────────┐
  │    Token     │      当前值      │    Spec 期望     │
  ├──────────────┼──────────────────┼──────────────────┤
  │ --primary    │ #163B5C 深海军蓝 │ #171614 近黑墨色 │
  ├──────────────┼──────────────────┼──────────────────┤
  │ --accent     │ #D94F30 朱红     │ #9A4D38 克制红棕 │
  ├──────────────┼──────────────────┼──────────────────┤
  │ --surface    │ #FFFFFF 白       │ #F5EFE3 象牙     │
  ├──────────────┼──────────────────┼──────────────────┤
  │ --background │ #F4F7F6 冷灰绿   │ #FBFAF4 暖纸     │
  ├──────────────┼──────────────────┼──────────────────┤
  │ --line       │ #D7E0E4 冷灰线   │ #D8D0C0 纸色线   │
  ├──────────────┼──────────────────┼──────────────────┤
  │ --ink        │ #20303A 冷深色   │ #171614 暖墨     │
  └──────────────┴──────────────────┴──────────────────┘

  建议：
  - Spec 应明确说明这是一次 token 全量替换，而不是"新增一套暖色 token"。如果两套共存，页面间跳转的视觉割裂会更大
  - 建议在 spec 中增加一节 "迁移策略"——是直接修改 app.wxss 的 token 值，还是渐进式逐页切换？直接替换对 detect 页影响最小（它已经在用硬编码暖色值），但对首页/result/历史页是一次全量视觉重写
  - 替换后需检查：--success（绿色）和 --danger（红色）在暖纸底色上的对比度是否足够

  ---
  2. detect 页是"对齐标杆"，但 spec 对它的描述偏少

  当前 detect 页是整个应用视觉最成熟的页面——羊皮纸渐变、衬线字体、木质色板、动画过渡。Spec 的"Pitch Detection"一节描述了"大字音名 + cent 偏差 + 参考线 + 弦选择"，但没有提到：

  - 当前已有的 gauge + needle 表盘动画——spec 是否保留？还是替换为更"纸面"的视觉？
  - 当前已有的 violin head + 弦高亮交互——这是现有的核心交互模式，spec 用"G/D/A/E selector as minimal segmented text or line tabs"一笔带过，但实际上它是一个带位置感的小提琴头像选择器，视觉冲击力远大于文字标签

  建议：
  - 明确 gauge/needle 和 violin head 的去留。如果去掉，需要给出替代方案——"fine vertical or horizontal pitch reference line"太抽象，不够指导实现
  - 如果保留 violin head，需说明如何融入"纸面"视觉（当前它的暖色渐变已经和 spec 方向一致，问题不大）
  - 如果去掉 gauge/needle，"large current note name"和"cent deviation"需要更具体的布局规格——字号、位置、对齐方式

  ---
  3. 首页"practice console"需要更具体的布局定义

  Spec 说首页从"feature menu"变成"practice console"，但具体描述只有：

  ▎ "Today's practice target. A single main action. Secondary actions as quiet text or line buttons. Small status strip."

  当前首页是：hero 区 + 2 列 metric 网格 + 3 个全宽按钮 + 3 条练习提示。从"功能菜单"到"练习控制台"是一个很大的变化，但 spec 缺少布局细节。

  建议：
  - 补充首页的核心布局结构——至少是一个线框级描述：主操作区在什么位置？今天的目标怎么展示？次要入口（曲谱评测、历史）放在哪里？
  - "Today's practice target"——这个数据从哪来？是用户上次练习的音？还是系统推荐？当前代码没有这个逻辑，需要与产品逻辑对齐
  - 去掉当前的"guide"区（3 条练习提示）是否符合预期？这些文案在 MVP 阶段有引导作用

  ---
  4. 曲谱评测页的视觉描述过于简略

  Spec 对"Score Practice"的描述：

  ▎ "Piece title, BPM, current practice stage. Minimal progress indicator. One clear start/continue action. Current measure or phrase guidance."

  但这与曲谱评测 spec 里定义的 6 页流程（列表→准备→评测→结果）不对齐。Spec 只描述了一个笼统的"score practice"状态，没有区分：

  - 曲谱列表页：多首曲目怎么排列？卡片还是行列表？
  - 练习准备页：曲目信息怎么展示？
  - 曲谱评测页：节拍器视觉、预备拍状态、当前目标音提示——这些都是动态的，需要比"minimal progress indicator"更具体的指引
  - 曲谱结果页：与基础 result 页的关系是什么？共用布局还是独立？

  建议：
  - 按曲谱评测 spec 的 6 页流程逐页补充视觉指引
  - 或者至少说明：新增的 4 个曲谱页面（score-list, score-prepare, score-practice, score-result）是复用现有页面的视觉框架，还是有独立的布局定义

  ---
  5. Typography 需要更具体的字号层级

  Spec 提到"Songti SC / STSong serif"和"Georgia-style serif"，但没有给出字号层级。当前代码的字号跨度极大（18rpx 到 104rpx），暖色纸面风格需要重新定义这个层级。

  建议：
  - 定义一个核心字号谱系，例如：

  ┌───────────────────────┬───────────┬────────────────────────────────┐
  │         用途          │   当前    │            建议方向            │
  ├───────────────────────┼───────────┼────────────────────────────────┤
  │ 大号读数（音名/分数） │ 40-104rpx │ 更大更突出的衬线，如 80-120rpx │
  ├───────────────────────┼───────────┼────────────────────────────────┤
  │ 页面标题              │ 44-56rpx  │ 适中衬线，如 48-56rpx          │
  ├───────────────────────┼───────────┼────────────────────────────────┤
  │ 区段标题              │ 32-34rpx  │ 紧凑衬线                       │
  ├───────────────────────┼───────────┼────────────────────────────────┤
  │ 正文/元数据           │ 24-28rpx  │ 系统字体                       │
  ├───────────────────────┼───────────┼────────────────────────────────┤
  │ 微标签                │ 18-22rpx  │ 系统字体                       │
  └───────────────────────┴───────────┴────────────────────────────────┘

  - 明确哪些场景用衬线、哪些用系统字体。Spec 说"display and large reading labels"用衬线、"body text"用系统字体，但"metric values"和"button labels"属于哪一类？

  ---
  6. "Style primitives"定义了但缺少 CSS 实现指引

  Spec 列出了 7 个 style primitives（Paper page container, Fine rule divider, Primary action control, Pitch readout block, Quiet metadata label, Ledger row, Markup callout），但只说"expressed through shared
  app.wxss tokens and page-level classes"。

  建议：
  - 为每个 primitive 给出 1-2 行 CSS 类的定义方向，例如：
    - .paper-page — background: var(--background); padding: 40rpx 32rpx;
    - .rule — height: 1rpx; background: var(--line); margin: 24rpx 0;
    - .ledger-row — display: flex; padding: 20rpx 0; border-bottom: 1rpx solid var(--line);
  - 这不需要完整 CSS，但需要足够让实现者理解间距、边框、背景等关键属性

  ---
  7. 交互规则中的"one primary action per screen"

  这个原则很好，但当前首页有 3 个并列按钮（开始练习、曲谱评测、查看历史）。如果改为"one primary action"，次要入口的视觉降级幅度需要明确。

  建议：
  - "quiet text or line buttons"具体是什么样式？当前 .secondary-button 是全宽描边按钮，仍然很显眼
  - 考虑用"文字链接"或"细线按钮"而非描边按钮——例如只保留文字 + 右箭头，不加边框和背景

  ---
  8. 缺少深色模式的考虑

  这不是 MVP 需求，但值得在 spec 中提一句"out of scope"。

  当前所有页面都是浅色。暖纸色系在深色模式下需要完全不同的色板（深棕/深灰底 + 亮纸色文字），如果不在 spec 中标注为"未来扩展"，实现时可能把暖色 token 硬编码成浅色值，增加后续迁移成本。

  ---
  需要确认的问题

  1. detect 页的 gauge/needle 和 violin head 交互是否保留？ 这是当前最有视觉辨识度的元素，spec 的描述暗示要简化，但没有明确说去掉。
  2. 全局 token 是一次性替换还是逐页迁移？ 影响实现顺序和测试策略。
  3. 首页"Today's practice target"的数据来源是什么？ 需要产品逻辑配合。
  4. 曲谱评测的 4 个新页面是否需要在此 spec 中定义视觉？ 还是单独出一份曲谱评测 UI spec？
  5. Result 页是否复用？ 基础练习和曲谱评测共用一个 result 页（按 sessionType 分支），还是各自独立？
  