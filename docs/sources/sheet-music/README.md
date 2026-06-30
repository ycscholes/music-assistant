# 曲谱来源记录

## 说明

本目录用于记录曲谱评测 MVP 的首批完整谱面来源。评测运行时不直接解析 PDF/PNG，实际使用的是人工整理后的本地静态音符序列。

运行时不直接展示这些 PDF/PNG；小程序内的五线谱由 `miniprogram/utils/score-practice/piece-library.js` 的本地 `notes` 数据渲染。

## 来源登记字段

后续新增上音考级曲目时，每首曲目都按以下字段登记，确保来源、裁剪、录谱和校对可以追溯：

| 字段 | 说明 |
| --- | --- |
| `sourceId` | 稳定来源 ID，建议格式为 `shcm_violin_<level>_<slug>_<edition>` |
| `examSystem` | 考级体系，例如 `上海音乐学院社会艺术水平考级` |
| `instrument` | 乐器，近期固定为 `violin` |
| `edition` | 教材或曲目单版本，例如 `2011修订版` |
| `examLevel` | 考级级别 |
| `examCategory` | 音阶、练习曲、指定乐曲、自选乐曲等 |
| `title` | 曲名 |
| `sourceUrl` | 官方曲目单、教材购买页或谱源页面 |
| `localFile` | 已落盘的 PDF、图片、MusicXML、MIDI 或 LilyPond 文件 |
| `pageOrCrop` | 页码、系统图裁剪范围或导入说明 |
| `inputFormat` | `pdf`、`scan-image`、`png`、`musicxml`、`midi`、`lilypond` |
| `verificationStatus` | `source-saved`、`notes-entered`、`boxes-entered`、`reviewed` |

当前实现支持两种运行时谱面模式：

- `generated`：从结构化 `notes` 通过 VexFlow 生成系统图。
- `source-image`：直接使用已落盘谱图作为系统图，只叠加 `noteBoxes` 与评测高亮，不改写谱面外观。

CloudBase 存储路径版本从 `formal-score-v3` 起用于 source-image 与 generated 两类资产。

## 下载状态

当前仓库已保存 3 首测试曲目的完整谱源，不再只记录选段来源：

- `b-major-scale-violin.jpg`
- `g-minor-scale-violin.jpg`
- `twinkle-twinkle-public-domain.png`
- `haydn-serenade-qintongji.abc`
- `vivaldi-lestro-armonico-op3-rv356-mutopia-a4-pdfs.zip`
- `vivaldi-lestro-armonico-op3-rv356-mutopia-lys.zip`
- `vivaldi-lestro-armonico-op3-rv356-mutopia-mids.zip`
- `vivaldi-rv356-yqlq-pdf-source.pdf`
- `vivaldi-rv356-pdf-clean-page-001.png`
- `vivaldi-rv356-pdf-clean-page-002.png`
- `vivaldi-rv356-pdf-clean-page-003.png`
- `vivaldi-rv356-pdf-notes.audit.json`

说明：当前终端沙箱仍无法直接访问本地代理端口，Mutopia ZIP 通过浏览器下载后复制到本目录；Violinspiration 页面直接暴露的是曲目封面 JPG，实际 PDF 下载由弹窗表单承载，未在无需个人信息的链路里暴露；Wikimedia 原 PNG 通过浏览器访问后保存为本地 PNG 谱图备份。

运行时 `notes` 数据已根据可校验谱源更新：

- 小星星使用 Wikimedia 文件页列出的完整 LilyPond 源，整理为 42 个目标音。
- 维瓦尔第使用一起练琴 PDF 清洗版作为视觉校对基准，并以 `vivaldi-rv356-pdf-notes.audit.json` 记录 PDF 视觉转录目标音；小程序正式显示使用 VexFlow 预生成 PNG。
- 海顿《小夜曲》使用琴童记曲目页暴露的 ABC 互动谱脚本整理为目标音序列，并按上音小提琴考级四级乐曲登记。
- 音阶组合按 B 大调、g 和声小调、g 旋律小调及对应主和弦琶音规则整理为完整练习序列；本地保存的 Violinspiration JPG 仅作为来源页面封面备份。

## 曲目

### 0. 上音小提琴考级 POC 登记

- `sourceId`: `shcm_violin_grade1_2011_catalog`
- `examSystem`: 上海音乐学院社会艺术水平考级
- `instrument`: violin
- `edition`: 2011 修订版教材，以 2020 年上音通知为近期依据
- `examLevel`: 一级
- `examCategory`: 曲目单与教材来源
- `title`: 上音小提琴考级一级 POC 曲目池
- `sourceUrl`:
  - https://www.shcmusic.edu.cn/2020/0716/c1662a23410/page.htm
  - https://www.shcmusic.edu.cn/_upload/article/files/9f/c2/f1e9902842b58187259b0a869932/42c61f99-eb48-48d2-b14d-f4e841c12a2f.docx
  - https://www.shcmusic.edu.cn/2022/0524/c1662a39623/page.htm
- `localFile`: 待补入教材 PDF/扫描图或授权谱图
- `pageOrCrop`: 待按单曲记录页码和系统裁剪范围
- `inputFormat`: `pdf` / `scan-image`
- `verificationStatus`: `source-saved`
- 备注：当前代码已支持 source-image 谱面模式；上音教材图补齐后，只需追加曲目数据与 `sourceImageSystems` 元数据即可进入现有评测链路。

### 1. 练习音阶组合

- 曲目：B 大调音阶
- 来源页面：https://violinspiration.com/b-major-scales-arpeggios-violin-sheet-music/
- 目标文件名：`b-major-scale-violin.jpg`
- 直接谱图：https://violinspiration.com/wp-content/uploads/B-Major-Scales-Arpeggios-violin-sheet-music.jpg
- 下载日期：2026-05-06
- 文件格式：JPG
- 谱源范围：完整 B 大调音阶与琶音谱面来源
- 备注：页面公开 JPG 为封面图；应用内 `notes` 使用 B 大调音阶上下行与主和弦琶音上下行。

- 曲目：g 小调音阶
- 来源页面：https://violinspiration.com/g-minor-scales-arpeggios-violin-sheet-music-tutorial/
- 目标文件名：`g-minor-scale-violin.jpg`
- 直接谱图：https://violinspiration.com/wp-content/uploads/G-Minor-Scales-and-arpeggios-violin-sheet-music.jpg
- 下载日期：2026-05-06
- 文件格式：JPG
- 谱源范围：完整 g 小调音阶与琶音谱面来源
- 备注：页面公开 JPG 为封面图；应用内 `notes` 使用 g 和声小调、g 旋律小调与 g 小调主和弦琶音。

### 2. 维瓦尔第 a 小调协奏曲

- 曲目：Violin Concerto in A minor, RV 356
- 来源页面：https://imslp.org/wiki/Violin_Concerto_in_A_minor%2C_RV_356_%28Vivaldi%2C_Antonio%29
- 目标文件名：`vivaldi-rv356-imslp.pdf`
- 下载日期：2026-05-06
- 文件格式：PDF
- 谱源范围：完整作品页面，包含完整谱面文件入口
- 备注：作为人工校对 RV356 的参考入口；本次已落盘的完整谱源使用下方 Mutopia PDF/LilyPond/MIDI 打包文件。

- 曲目：L'estro Armonico, Op. 3（包含 RV356）
- 来源页面：https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2048
- 目标文件名：
  - `vivaldi-lestro-armonico-op3-rv356-mutopia-a4-pdfs.zip`
  - `vivaldi-lestro-armonico-op3-rv356-mutopia-lys.zip`
  - `vivaldi-lestro-armonico-op3-rv356-mutopia-mids.zip`
- 下载 URL：
  - https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-a4-pdfs.zip
  - https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-lys.zip
  - https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-mids.zip
- 下载日期：2026-05-06
- 文件格式：ZIP（PDF / LilyPond / MIDI）
- 授权：Mutopia Project 分发页面标注的许可为准
- 谱源范围：完整 Op. 3 打包源，可用于提取 RV356 完整谱面、LilyPond 和 MIDI
- 下载状态：已下载并通过 `unzip -t` 校验

- 曲目：a 小调协奏曲第一乐章（一起练琴 PDF 清洗版）
- 目标文件名：
  - `vivaldi-rv356-yqlq-pdf-source.pdf`
  - `vivaldi-rv356-pdf-clean-page-001.png`
  - `vivaldi-rv356-pdf-clean-page-002.png`
  - `vivaldi-rv356-pdf-clean-page-003.png`
  - `vivaldi-rv356-pdf-notes.audit.json`
- 保存日期：2026-06-29
- 文件格式：PDF / PNG / JSON
- 谱源范围：PDF 可见的第一乐章 pickup 到第 80 小节终止；小程序按 pickup + 第 1 小节、之后每小节一行生成 80 个 VexFlow PNG 系统图。
- 清洗说明：Page 1 去除右上角二维码和一起练琴品牌区，Page 2-3 去除左上角一起练琴 logo；清洗区域避开标题、作者、速度标记、小节号、指法、力度、弓法和谱面主体。
- 运行时说明：PDF 只作为视觉验收基准，正式谱面由 `scripts/generate-score-assets.js` 使用 VexFlow 预生成 PNG 与 `noteBoxes`；音高、节奏和时值评测使用 `vivaldi-rv356-pdf-notes.audit.json` 派生的本地 notes 模块，其中八分音符保留为 `durationBeat: 0.5`，十六分音符保留为 `durationBeat: 0.25`，速度按 PDF 标注为 `bpm: 96`。

### 3. 小星星 Twinkle Twinkle Little Star

- 曲目：Twinkle Twinkle Little Star
- 来源页面：https://commons.wikimedia.org/wiki/File:Twinkle_Twinkle_Sheet_Music.png
- 原始谱图：https://upload.wikimedia.org/wikipedia/commons/9/90/Twinkle_Twinkle_Sheet_Music.png
- LilyPond 源：同一 Wikimedia Commons 文件页的源代码区
- 目标文件名：`twinkle-twinkle-public-domain.png`
- 下载日期：2026-05-06
- 文件格式：PNG
- 授权：Public domain（Wikimedia Commons 文件页标注作者将作品释入公有领域）
- 谱源范围：完整公有领域儿歌曲谱图片与 LilyPond 源
- 备注：已保存本地 PNG 谱图备份。

### 4. 海顿《小夜曲》

- 曲目：小夜曲 / Serenade
- 作者登记：海顿
- 考级来源：上海音乐学院社会艺术水平考级，小提琴考级曲集第 2 册，四级乐曲
- 曲目列表页面：https://qintongji.com/kaoji-violin/
- 互动谱页面：https://qintongji.com/%e6%b5%b7%e9%a1%bf%e3%80%8a%e5%b0%8f%e5%a4%9c%e6%9b%b2%e3%80%8b%e5%b0%8f%e6%8f%90%e7%90%b4%e6%9b%b2-haydns-serenade/
- ABC 脚本来源：https://qintongji.com/player/score/js/Serenade_-_Joseph_Haydn.js
- 目标文件名：`haydn-serenade-qintongji.abc`
- 下载日期：2026-06-27
- 文件格式：ABC
- 谱源范围：完整互动谱 Violin I 旋律，脚本标注 `T:Serenade`、`C:Joseph Haydn`、`Q:1/4=80`
- 备注：IMSLP 对应作品页将传统 Haydn 归属的 Op.3 No.5 / Hob.III:17 归入 Roman Hoffstetter；应用内按用户指定和上音考级曲目登记保留“海顿”。

## 可复现下载命令

在具备公网访问的环境中，可以从仓库根目录执行以下命令补齐完整谱源文件：

```bash
mkdir -p docs/sources/sheet-music

curl -L -o docs/sources/sheet-music/vivaldi-lestro-armonico-op3-rv356-mutopia-a4-pdfs.zip \
  https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-a4-pdfs.zip
curl -L -o docs/sources/sheet-music/vivaldi-lestro-armonico-op3-rv356-mutopia-lys.zip \
  https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-lys.zip
curl -L -o docs/sources/sheet-music/vivaldi-lestro-armonico-op3-rv356-mutopia-mids.zip \
  https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-mids.zip

curl -L -o docs/sources/sheet-music/b-major-scale-violin.jpg \
  https://violinspiration.com/wp-content/uploads/B-Major-Scales-Arpeggios-violin-sheet-music.jpg
curl -L -o docs/sources/sheet-music/g-minor-scale-violin.jpg \
  https://violinspiration.com/wp-content/uploads/G-Minor-Scales-and-arpeggios-violin-sheet-music.jpg
curl -L -o docs/sources/sheet-music/twinkle-twinkle-public-domain.png \
  https://upload.wikimedia.org/wikipedia/commons/9/90/Twinkle_Twinkle_Sheet_Music.png
```

## 本地化约束

- 下载后的原始谱面应保留在本目录。
- 曲目若经过裁剪或重编排，需要在后续提交中追加说明。
- 应用内置曲目以 `miniprogram/utils/score-practice/piece-library.js` 为准。
