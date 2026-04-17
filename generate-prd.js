const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
        LevelFormat, PageBreak } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "1A3A6B" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

// 标题
const titleStyle = { size: 48, bold: true, font: "Arial", color: "1A3A6B" };
const heading1Style = { size: 32, bold: true, font: "Arial", color: "1A3A6B" };
const heading2Style = { size: 28, bold: true, font: "Arial", color: "1A3A6B" };
const heading3Style = { size: 24, bold: true, font: "Arial", color: "333333" };
const bodyStyle = { size: 24, font: "Arial", color: "333333" };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1A3A6B" },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "1A3A6B" },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "333333" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers2",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers3",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // 封面
      new Paragraph({ spacing: { before: 2000 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "小提琴智能陪练小程序", ...titleStyle })]
      }),
      new Paragraph({ spacing: { before: 400 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "产品需求文档（PRD）", ...bodyStyle })]
      }),
      new Paragraph({ spacing: { before: 800 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "版本：V1.0", ...bodyStyle })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "日期：2026年4月", ...bodyStyle })]
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // 目录
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("目录")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "1. 项目概述", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "2. 目标用户", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "3. 核心功能", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "4. 商业模式", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "5. 技术架构", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "6. 开发计划", ...bodyStyle })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // 1. 项目概述
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. 项目概述")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 产品背景")] }),
      new Paragraph({ children: [new TextRun({ text: "随着素质教育的普及，中国约有4000万琴童（6-14岁）学习乐器。然而，家长普遍面临以下痛点：", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "不懂音乐，无法辅导孩子练习", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "专业陪练老师费用高昂（150-300元/课时）且难预约", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "孩子练习时无法实时获知音准、节奏是否正确", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.2 产品定位")] }),
      new Paragraph({ children: [new TextRun({ text: "一款面向琴童家长的小提琴/弦乐智能陪练小程序，通过AI音准检测技术帮助琴童在练习时实时检测音准和节奏是否正确。", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.3 价值主张")] }),
      new Paragraph({ children: [new TextRun({ text: "专业：专注小提琴/弦乐，精度高于泛化产品", ...bodyStyle })] }),
      new Paragraph({ children: [new TextRun({ text: "便捷：微信小程序即开即用，无需下载App", ...bodyStyle })] }),
      new Paragraph({ children: [new TextRun({ text: "实惠：年费299元仅为竞品（一起练琴699元）的43%", ...bodyStyle })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // 2. 目标用户
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. 目标用户")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 主要用户")] }),
      new Paragraph({ children: [new TextRun({ text: "琴童家长：孩子6-14岁，正在学习小提琴/弦乐", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 100 } }),
      new Paragraph({ children: [new TextRun({ text: "用户特征：", ...bodyStyle, bold: true })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "有一定的教育消费意愿，愿意为孩子投资", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "工作繁忙，陪伴时间有限", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "使用微信频率高，习惯小程序生态", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 次要用户")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "成人自学者：希望独立学习小提琴", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "器乐老师：用于辅助教学", ...bodyStyle })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // 3. 核心功能
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. 核心功能")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 MVP阶段（Phase 1）")] }),
      new Paragraph({ children: [new TextRun({ text: "音准检测：实时识别演奏音高，与标准音高对比，显示偏差值", ...bodyStyle })] }),
      new Paragraph({ children: [new TextRun({ text: "简单评分：基于音准准确度和稳定性给出综合评分", ...bodyStyle })] }),
      new Paragraph({ children: [new TextRun({ text: "基础调音器：帮助乐器调弦", ...bodyStyle })] }),
      new Paragraph({ children: [new TextRun({ text: "节拍器：辅助练习节奏", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 Phase 1.1（粘性增强）")] }),
      new Paragraph({ children: [new TextRun({ text: "练琴打卡：每日练习记录，连续打卡激励", ...bodyStyle })] }),
      new Paragraph({ children: [new TextRun({ text: "成长记录：练习时长、得分趋势图", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.3 Phase 2.0（差异化）")] }),
      new Paragraph({ children: [new TextRun({ text: "AI点评：指出具体错误音符和纠正建议", ...bodyStyle })] }),
      new Paragraph({ children: [new TextRun({ text: "练习建议：根据薄弱环节推荐练习曲目", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 300 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.4 功能优先级矩阵")] }),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [3010, 3008, 3008],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: headerBorders, width: { size: 3010, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "功能", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 3008, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "优先级", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 3008, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "阶段", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3010, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "音准检测", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "P0（核心）", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MVP", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3010, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "评分系统", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "P0（核心）", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MVP", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3010, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "调音器", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "P1（重要）", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MVP", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3010, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "节拍器", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "P1（重要）", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MVP", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3010, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "打卡记录", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "P2（增强）", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Phase 1.1", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3010, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "AI点评", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "P2（增强）", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Phase 2.0", ...bodyStyle })] })] }),
            ]
          }),
        ]
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // 4. 商业模式
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. 商业模式")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 定价策略")] }),
      new Paragraph({ children: [new TextRun({ text: "采用免费增值（Freemium）模式，每个功能限次数体验：", ...bodyStyle })] }),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [3008, 3009, 3009],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: headerBorders, width: { size: 3008, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "层级", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 3009, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "功能", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 3009, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "限制", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "免费", bold: true, color: "4CAF50", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "调音器 + 节拍器 + 音准检测 + 评分", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "各功能总共10-20次体验", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "付费（年费299元）", bold: true, color: "FF8C42", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "全部功能无限使用", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "无限制", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "付费（含打卡）", bold: true, color: "FF8C42", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "打卡 + 成长记录 + AI点评", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "无限制", ...bodyStyle })] })] }),
            ]
          }),
        ]
      }),
      new Paragraph({ spacing: { before: 300 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 竞品定价对比")] }),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [3008, 3009, 3009],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: headerBorders, width: { size: 3008, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "产品", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 3009, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "年费", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 3009, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "备注", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "小叶子钢琴陪练", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "2899元", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "钢琴为主", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "一起练琴", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "699元", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "11种乐器，含小提琴", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3008, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "我们的小程序", bold: true, color: "4CAF50", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "299元", bold: true, color: "4CAF50", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 3009, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "专注弦乐，微信生态", ...bodyStyle })] })] }),
            ]
          }),
        ]
      }),
      new Paragraph({ spacing: { before: 300 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.3 收入预测（保守估算）")] }),
      new Paragraph({ children: [new TextRun({ text: "假设：", ...bodyStyle, bold: true })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "上线第一年：5万免费用户，5%转化率 = 2500付费用户", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "年费收入：2500 x 299元 = 74.75万元", ...bodyStyle })] }),
      new Paragraph({ children: [new TextRun({ text: "盈亏平衡点：约100-200付费用户（覆盖开发+运维成本）", ...bodyStyle })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // 5. 技术架构
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. 技术架构")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 技术选型")] }),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [2500, 6526],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: headerBorders, width: { size: 2500, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "模块", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 6526, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "技术方案", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "前端", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 6526, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "微信小程序（原生开发）", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "后端", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 6526, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "微信云开发（云函数 + 云数据库）", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "AI能力", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 6526, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "第三方音准SDK（Azure音频分析 / 音兔API）", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "支付", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 6526, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "微信支付（小程序订阅）", ...bodyStyle })] })] }),
            ]
          }),
        ]
      }),
      new Paragraph({ spacing: { before: 300 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.2 系统架构图")] }),
      new Paragraph({ children: [new TextRun({ text: "微信小程序", ...bodyStyle, bold: true })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "音频采集（wx.createInnerAudioContext）", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "音准SDK调用（REST API / SDK）", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "评分引擎（本地计算 + 云函数辅助）", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "数据存储（云数据库）", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "微信支付（订阅付费）", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 300 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.3 第三方SDK选型建议")] }),
      new Paragraph({ numbering: { reference: "numbers2", level: 0 }, children: [new TextRun({ text: "Azure 音频分析：精度高，有免费额度（推荐）", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "numbers2", level: 0 }, children: [new TextRun({ text: "音兔API：专注乐器检测，中文支持好", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "numbers2", level: 0 }, children: [new TextRun({ text: "自研方案（长期）：积累数据后训练模型", ...bodyStyle })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // 6. 开发计划
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. 开发计划")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 MVP阶段（预计4-6周）")] }),
      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [1500, 2000, 5526],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: headerBorders, width: { size: 1500, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "周次", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 2000, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "模块", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
              new TableCell({ borders: headerBorders, width: { size: 5526, type: WidthType.DXA }, shading: { fill: "1A3A6B", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "任务", bold: true, color: "FFFFFF", font: "Arial", size: 22 })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 1500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "第1周", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "项目搭建", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 5526, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "小程序注册、开发者工具、项目框架搭建", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 1500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "第2-3周", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "核心功能", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 5526, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "音频采集模块、音准SDK集成、评分引擎", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 1500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "第4周", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "辅助功能", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 5526, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "调音器、节拍器、UI美化", ...bodyStyle })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 1500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "第5-6周", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "商业化", ...bodyStyle })] })] }),
              new TableCell({ borders, width: { size: 5526, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "免费限次功能、微信支付集成、测试上线", ...bodyStyle })] })] }),
            ]
          }),
        ]
      }),
      new Paragraph({ spacing: { before: 300 } }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.2 后续迭代")] }),
      new Paragraph({ numbering: { reference: "numbers3", level: 0 }, children: [new TextRun({ text: "Phase 1.1（2-3周）：打卡记录、成长趋势", ...bodyStyle })] }),
      new Paragraph({ numbering: { reference: "numbers3", level: 0 }, children: [new TextRun({ text: "Phase 2.0（4-6周）：AI点评、练习建议", ...bodyStyle })] }),
      new Paragraph({ spacing: { before: 500 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "— 文档结束 —", color: "999999", font: "Arial", size: 20 })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/Users/chen.yu/WorkBuddy/20260413092942/violin-practice-app/docs/PRD-小提琴智能陪练小程序.docx', buffer);
  console.log('PRD文档已生成');
});
