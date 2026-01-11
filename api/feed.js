/* ... kode atas tetap sama ... */

try {
  const mode = req.query.mode || "home";
  const limitReq = Math.min(Number(req.query.limit) || 10, 50);
  const viewerId = req.query.viewerId || null;
  const cursorId = req.query.cursor || null;

  let queryRef = db.collection(POSTS_PATH);
  let followingIds = null;
  let isFollowingFallback = false;

  // 1. Setup Mode Following
  if (mode === "following") {
    if (!viewerId) isFollowingFallback = true;
    else {
      const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (!viewerSnap.exists) isFollowingFallback = true;
      else {
        const viewerData = viewerSnap.data() || {};
        followingIds = Array.isArray(viewerData.following) ?
          viewerData.following.slice(0, 10) : [];
        if (!followingIds.length) isFollowingFallback = true;
      }
    }
  }

  // 2. Filter Query
  if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
  if (mode === "user" && req.query.userId) queryRef = queryRef.where("userId", "==", req.query.userId);
  if (mode === "following" && followingIds?.length && !isFollowingFallback) {
    queryRef = queryRef.where("userId", "in", followingIds);
  }

  // 3. Query Firestore (PENTING: Selalu ambil berdasarkan Waktu Terbaru)
  // Kita ambil buffer lebih banyak (limit * 2) buat jaga-jaga kalau ada filtering manual
  const bufferSize = limitReq * 2; 
  queryRef = queryRef.orderBy("timestamp", "desc");

  if (cursorId) {
    const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
    if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
  }

  const snap = await queryRef.limit(bufferSize).get();

  if (snap.empty && mode !== "following") {
    return res.json({ posts: [], nextCursor: null });
  }

  const allFetchedPosts = snap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    timestamp: safeMillis(d.data()?.timestamp)
  }));

  /* ================== PERBAIKAN LOGIKA FEED ================== */
  let finalPosts = [];

  if (mode === "home" || (mode === "following" && isFollowingFallback)) {
    // LOGIKA BARU: Prioritas Waktu (Terbaru diatas), tapi cegah SPAM berlebihan.
    // Kita tidak pakai SHUFFLE. Kita pakai data asli (allFetchedPosts) yang sudah urut waktu.
    
    const processedPosts = [];
    const userConsecutiveCount = {}; // Hitung user ini udah muncul berapa kali berturut-turut

    for (const post of allFetchedPosts) {
      const uid = post.userId || "anon";
      
      // Cek postingan sebelumnya siapa
      const lastPost = processedPosts[processedPosts.length - 1];
      const lastUid = lastPost ? lastPost.userId : null;

      if (lastUid === uid) {
        userConsecutiveCount[uid] = (userConsecutiveCount[uid] || 1) + 1;
      } else {
        userConsecutiveCount[uid] = 1; // Reset kalau ganti orang
      }

      // Jika user yang sama sudah muncul 2x berturut-turut, skip dulu biar variatif dikit
      // (Kecuali postingan memang sedikit < 5, hajar aja semua)
      if (allFetchedPosts.length > 5 && userConsecutiveCount[uid] > 2) {
        continue; 
      }

      processedPosts.push(post);
      
      // Stop kalau sudah memenuhi limit request user
      if (processedPosts.length >= limitReq) break;
    }

    // Jika hasil filtering terlalu sedikit (karena banyak skip), ambil saja apa adanya biar gak kosong
    if (processedPosts.length < limitReq && allFetchedPosts.length > 0) {
        finalPosts = allFetchedPosts.slice(0, limitReq);
    } else {
        finalPosts = processedPosts;
    }

  } else {
    // Untuk mode lain (user profile, meme category, dll) biarkan murni urut waktu
    finalPosts = allFetchedPosts.slice(0, limitReq);
  }
  /* =========================================================== */

  let result = finalPosts;

  // Join user data
  const uids = [...new Set(result.map(p => p.userId).filter(Boolean))];
  const userMap = {};
  if (uids.length) {
    const userSnaps = await Promise.all(
      uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
    );
    userSnaps.forEach(s => {
      if (s.exists) userMap[s.id] = s.data();
    });
  }

  let postsResponse = result.map(p => {
    const u = userMap[p.userId] || {};
    return {
      ...p,
      user: {
        username: u.username || "User",
        photoURL: u.photoURL || null,
        reputation: u.reputation || 0,
        email: u.email || ""
      }
    };
  });

  // External fetch logic (Dibiarkan sama)
  if (CONFIG.FEED_API_URL && CONFIG.FEED_API_KEY) {
     // ... (kode fetch server-to-server kamu tetap sama) ...
  }

  // Final slice untuk memastikan jumlah pas
  postsResponse = postsResponse.slice(0, limitReq);

  // Next cursor logic (Diperbaiki agar sinkron dengan hasil akhir)
  let nextCursor = null;
  if (result.length > 0) {
      // Ambil ID dari item terakhir yang BENAR-BENAR ditampilkan ke user
      const lastVisiblePost = result[result.length - 1];
      nextCursor = lastVisiblePost.id;
  }

  res.status(200).json({
    posts: postsResponse,
    nextCursor
  });

} catch (e) {
  console.error("FEED_ERROR:", e);
  res.status(500).json({
    error: true,
    message: e.message || "Unknown runtime error"
  });
}