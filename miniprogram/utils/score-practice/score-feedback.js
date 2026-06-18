function summarizeTagRuns(noteResults) {
  const runs = [];
  let current = null;

  noteResults.forEach((item, index) => {
    const primaryTag = item.issueTags[0] || null;
    if (!primaryTag) {
      if (current) {
        runs.push(current);
        current = null;
      }
      return;
    }

    if (current && current.tag === primaryTag && current.endIndex === index - 1) {
      current.endIndex = index;
      current.length += 1;
      return;
    }

    if (current) {
      runs.push(current);
    }

    current = {
      tag: primaryTag,
      startIndex: index,
      endIndex: index,
      length: 1,
    };
  });

  if (current) {
    runs.push(current);
  }

  return runs;
}

function countTags(noteResults) {
  return noteResults.reduce((map, item) => {
    item.issueTags.forEach((tag) => {
      map[tag] = (map[tag] || 0) + 1;
    });
    return map;
  }, {});
}

function getSectionLabel(noteResults, startIndex, endIndex) {
  const midpoint = (startIndex + endIndex) / 2;
  return midpoint < noteResults.length / 2 ? '前半句' : '后半句';
}

// E5: Severity modifier based on how many notes are affected.
function severityForCount(count) {
  if (count <= 5) {
    return '略有';
  }
  if (count <= 15) {
    return '明显';
  }
  return '严重';
}

function messageForTag(tag, context, severity) {
  const mod = severity || '';
  if (tag === 'early') {
    return `${context}${mod}节奏偏抢，建议降低速度后再稳住起音。`;
  }
  if (tag === 'late') {
    return `${context}${mod}起音偏晚，注意在拍点前提前准备弓子。`;
  }
  if (tag === 'pitch-high') {
    return `${context}${mod}音偏高，建议放慢后检查左手按弦稳定性。`;
  }
  if (tag === 'pitch-low') {
    return `${context}${mod}音偏低，建议先拆句慢练并确认手指落点。`;
  }
  if (tag === 'too-short') {
    return `${context}${mod}时值偏短，收弓略早，建议把长音保持到拍尾。`;
  }
  if (tag === 'missed') {
    return `${context}${mod}有漏音或无有效识别，建议靠近手机并保持单音清晰起奏。`;
  }
  return `${context}${mod}有明显不稳定点，建议拆开慢练。`;
}

function buildAdvice(noteResults) {
  if (!noteResults.length) {
    return {
      advice: '本次没有有效评测数据，请重新开始。',
      feedbackTags: [],
    };
  }

  const runs = summarizeTagRuns(noteResults)
    .filter((run) => run.length >= 3)
    .sort((a, b) => b.length - a.length);
  const tagCounts = countTags(noteResults);
  const threshold = Math.ceil(noteResults.length * 0.3);
  const globalTags = Object.keys(tagCounts)
    .filter((tag) => tagCounts[tag] >= threshold)
    .sort((a, b) => tagCounts[b] - tagCounts[a]);

  const adviceList = [];
  const feedbackTags = [];

  runs.slice(0, 2).forEach((run) => {
    const section = getSectionLabel(noteResults, run.startIndex, run.endIndex);
    const severity = severityForCount(run.length);
    adviceList.push(messageForTag(run.tag, section, severity));
    feedbackTags.push(run.tag);
  });

  globalTags.forEach((tag) => {
    if (feedbackTags.indexOf(tag) >= 0 || adviceList.length >= 2) {
      return;
    }
    const severity = severityForCount(tagCounts[tag]);
    adviceList.push(messageForTag(tag, '整段', severity));
    feedbackTags.push(tag);
  });

  if (!adviceList.length) {
    return {
      advice: '表现很好，继续保持当前节奏与手型稳定性。',
      feedbackTags: [],
    };
  }

  return {
    advice: adviceList.join(' '),
    feedbackTags,
  };
}

module.exports = {
  buildAdvice,
};
