const COLLECTION = 'practice_sessions';

function getDb() {
  if (!wx.cloud) {
    throw new Error('CloudBase is not available in this Mini Program runtime.');
  }
  return wx.cloud.database();
}

async function savePracticeSession(session) {
  const db = getDb();
  const payload = Object.assign({}, session, {
    createdAt: db.serverDate(),
  });

  delete payload._openid;
  return db.collection(COLLECTION).add({ data: payload });
}

async function listPracticeSessions(options = {}) {
  const pageSize = options.pageSize || 20;
  const skip = options.skip || 0;
  const db = getDb();

  return db
    .collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
}

module.exports = {
  COLLECTION,
  savePracticeSession,
  listPracticeSessions,
};
