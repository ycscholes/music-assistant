 ---
  总体评价

  Spec 结构清晰、范围控制得当（3-5 首内置短句、固定 BPM、单旋律、规则化建议），MVP 边界明确。但在现有代码基础上实施，有几个关键问题需要提前讨论。

  对 Spec 的具体建议

  1. 数据模型：practice_sessions 结构需兼容两套 sessionType

  当前 history.js 的展示逻辑高度绑定 basic 字段：
  {
    targetNote: item.targetNote,
    score: item.totalScore,
    durationText: `${item.durationSec}s`,
    avgCentText: formatCentOffset(item.avgCentOffset)
  }

  曲谱评测的 score_practice 没有 targetNote 和 avgCentOffset，而是有 pieceTitle、summaryScores 等。

  建议：
  - 在 spec 中明确定义 basic session 的最小字段规范（现有代码隐含但未文档化）
  - 历史页展示逻辑按 sessionType 分支渲染，spec 里已有提及，但建议给出 basic 的最小数据契约，方便后续统一

  2. 端上音频处理能力是否支持连续多音评测

  现有 pitch-yin.js 的 YIN 实现：
  - minFrequency: 180, maxFrequency: 3000（覆盖小提琴 G3-E7 范围，基本够用）
  - threshold: 0.12，confidence 阈值 0.55
  - 4096 采样窗口 @ 44100Hz ≈ 93ms 分析延迟

  顾虑点：
  - YIN 对快速换把、短音符的响应可能不够快（93ms 窗口 + 120ms UI 周期，一个 16分音符 @ BPM=120 只约 125ms）
  - 节拍器声音混入录音是否会导致 YIN 误检？spec 的风险控制里提到了，但建议增加一条：评测页节拍器用 视觉节拍器为主、音频为辅，或音频通过耳机输出（小程序无法强制耳机输出）

  建议：
  - 在评测算法的"帧归属"逻辑里，增加对低 confidence 帧的丢弃策略
  - 明确 pitchToleranceCent 的数值（建议第一版 50 cents，小提琴初学者容错）
  - 如果评测窗口内没有有效帧，应标记为 missed 而非计入 0 分

  3. 时间窗口评测 vs 现有帧结构

  现有 pitchFrames 结构：
  { frequency, note, octave, midi, centOffset, targetCentOffset, confidence, timestamp }

  曲谱评测需要把它按时间归属到音符窗口。Spec 中 expectedStartMs / expectedEndMs 基于固定 BPM 生成。

  建议补充：
  - 明确 countInBeats 后，startTimestamp 是用户点击"开始"的时刻，还是第一个目标音该响起的时刻？这会直接影响所有 expectedStartMs 的计算
  - 建议在 metronome-timeline.js 中暴露 getExpectedTimeForNote(noteIndex) 函数，供评测和 UI 同时消费，避免两端各自计算产生漂移

  4. 评分模型：建议增加"有效覆盖率"维度

  当前评分：
  - pitchScore * 0.6 + rhythmScore * 0.4

  但如果用户只演奏了前半句，后半句全部 missed，此时 pitchScore 和 rhythmScore 可能只基于有数据的音符计算，导致总分虚高。

  建议：
  - 增加 completionRate（完成率 = 实际演奏音符数 / 总音符数）
  - 综合分公式改为：totalScore = (pitchScore * 0.6 + rhythmScore * 0.4) * completionRate 或单独展示完成率
  - 或者把 missed 的音符以 0 分计入 pitchScore，避免选择性忽略

  5. 建议生成规则：需要更具体的聚合策略

  Spec 中的建议示例很好，但缺少具体规则：
  - "前半句节奏偏抢"——"前半句"怎么定义？连续几个音 early 算偏抢？
  - "第 3 到第 5 音偏高"——连续几个音 pitch-high 才触发？

  建议：
  - 定义最小触发阈值：例如连续 ≥3 个音有同一 issueTag，或某类标签占比 ≥30%
  - 建议优先级排序：先提最集中的问题（最多连续标签），再提次要问题
  - 增加兜底建议：如果所有音都命中且没有明显 issue，输出"表现很好，继续保持"

  6. 代码结构建议：工具模块目录组织

  现有 utils/ 都是单文件工具。新增 4 个工具模块后：
  - score-pieces.js（曲库）
  - metronome-timeline.js（时间轴）
  - score-evaluator.js（评测）
  - score-feedback.js（建议）

  建议：
  - score-pieces.js 考虑改名为 piece-library.js 或放入 data/ 目录，因为曲库本质上是数据而非工具函数
  - metronome-timeline.js 和 score-evaluator.js 是纯逻辑，放 utils/ 合理
  - 考虑给曲谱评测相关的工具加一个 modules/score-practice/ 子目录，避免 utils/ 过度膨胀

  ---
  需要确认的问题

  1. 基础练习闭环是否要先修复？ 还是先只做曲谱评测，把 detect→result→save 的完整链路在曲谱评测页里跑通，回头再修基础流程？
  2. 曲库录入方式： spec 说"不支持用户上传"，但第一版的 3-5 首曲目如何录入？是硬编码在 score-pieces.js 里，还是期望有一个简单的后台/JSON 配置？
  3. 节拍器音频策略： 小程序录音会录到扬声器播放的节拍器声音。是否考虑：
    - 纯视觉节拍器（闪烁/动画）？
    - 降低节拍器音量到最小可感知？
    - 评测时先用预备拍对齐，正式录音时关掉节拍器音频？
  4. 结果页是否复用现有的 result 页？ Spec 新增 score-result 页，但现有 result 页已经实现保存/再次练习/打开历史等功能。是新建独立页面，还是让 result 页根据 sessionType 分支渲染？
  5. 评分权重是否可调整？ pitchScore * 0.6 + rhythmScore * 0.4 是第一版的硬性公式，还是建议做成可配置？

  ---