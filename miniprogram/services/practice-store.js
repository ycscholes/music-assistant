const COLLECTION = 'practice_sessions';

function getDb() {
  if (!wx.cloud) {
    throw new Error('CloudBase is not available in this Mini Program runtime.');
  }
  return wx.cloud.database();
}

function translateError(error) {
  if (!error) return new Error('未知错误');
  const code = error.errCode || error.code || '';
  const msg = error.errMsg || error.message || '';

  if (code === -502005 || msg.includes('EnvironmentNotExists') || msg.includes('env') && msg.includes('not found') || msg.includes('not exists')) {
    return new Error('云开发环境不存在或已过期。请检查 app.js 中的 env 配置是否正确。');
  }
  if (code === -501007 || msg.includes('InternalError') || msg.includes('request') && msg.includes('fail')) {
    return new Error('云开发服务暂时不可用，请检查网络连接后重试。');
  }
  if (code === -502001 || msg.includes('Permission denied') || msg.includes('Unauthorized')) {
    return new Error('云开发权限不足，请检查安全规则配置。');
  }
  return error;
}

async function savePracticeSession(session) {
  const db = getDb();
  const payload = Object.assign({}, session, {
    createdAt: db.serverDate(),
    sessionType: session && session.sessionType ? session.sessionType : 'basic',
  });

  delete payload._openid;
  try {
    return await db.collection(COLLECTION).add({ data: payload });
  } catch (error) {
    throw translateError(error);
  }
}

async function listPracticeSessions(options = {}) {
  const pageSize = options.pageSize || 20;
  const skip = options.skip || 0;
  const db = getDb();

  try {
    return await db
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
  } catch (error) {
    throw translateError(error);
  }
}

module.exports = {
  COLLECTION,
  savePracticeSession,
  listPracticeSessions,
};
