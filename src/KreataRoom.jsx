// FILE: KreataRoom.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Users, Loader2, Heart, MessageSquare,
  ExternalLink, Zap, Info, ChevronDown, ChevronUp, MessageCircle
} from 'lucide-react';

import {
  collection, query, limit, getDocs, getDoc, doc, orderBy
} from 'firebase/firestore';

/* ================= KONFIGURASI ================= */
const FIXED_POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const FIXED_USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

const KREATA_ROOM_IMG =
  "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg";

const WA_CHANNEL_URL = "https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j";
const WA_GROUP_URL =
  "https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss?mode=wwt";

/* ================= COMPONENT ================= */
const KreataRoom = ({ setPage, db, onPostClick }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFullInfo, setShowFullInfo] = useState(false);

  // Cache user profile biar gak boros read
  const userCache = useRef({});

  useEffect(() => {
    if (!db) return;

    const fetchKreataPosts = async () => {
      setLoading(true);
      console.log("🔍 Scan Kreata feed…");

      try {
        /* ================= STEP 1: QUERY POST ================= */
        const postsRef = collection(db, FIXED_POSTS_PATH);

        // 🔥 TERBARU + RINGAN + TANPA INDEX ERROR
        const q = query(
          postsRef,
          orderBy("timestamp", "desc"),
          limit(100)
        );

        const snap = await getDocs(q);
        console.log("📦 Raw post:", snap.size);

        /* ================= STEP 2: FILTER ================= */
        const filtered = [];

        snap.forEach(d => {
          const data = d.data();
          const text = `${data.title || ""} ${data.content || ""}`.toLowerCase();

          // 🔥 fleksibel: kreata / #kreata / KREATA
          if (text.includes("kreata")) {
            filtered.push({ id: d.id, ...data });
          }
        });

        console.log("✅ Kreata post:", filtered.length);

        /* ================= STEP 3: ENRICH USER ================= */
        const enriched = await Promise.all(
          filtered.map(async post => {
            if (!post.userId) {
              return {
                ...post,
                user: { username: "Anonim", photoURL: "" }
              };
            }

            // Cache hit
            if (userCache.current[post.userId]) {
              return { ...post, user: userCache.current[post.userId] };
            }

            try {
              const uRef = doc(db, FIXED_USERS_PATH, post.userId);
              const uSnap = await getDoc(uRef);

              const userData = uSnap.exists()
                ? uSnap.data()
                : { username: "User", photoURL: "" };

              userCache.current[post.userId] = userData;

              return { ...post, user: userData };
            } catch {
              return {
                ...post,
                user: { username: "User", photoURL: "" }
              };
            }
          })
        );

        setPosts(enriched);
      } catch (e) {
        console.error("❌ Kreata error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchKreataPosts();
  }, [db]);

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 pb-20">

      {/* HERO */}
      <div className="relative h-64 md:h-80">
        <button
          onClick={() => setPage("home")}
          className="absolute top-6 left-6 z-20 bg-black/40 text-white p-2.5 rounded-full"
        >
          <ArrowLeft size={20} />
        </button>
        <img src={KREATA_ROOM_IMG} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] dark:from-gray-900 via-transparent to-black/40" />
        <div className="absolute bottom-6 left-6">
          <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded">
            Official Partner
          </span>
          <h1 className="text-3xl font-black text-white mt-2">
            KREATA <span className="text-emerald-400">ROOM</span>
          </h1>
        </div>
      </div>

      {/* INFO */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>Kreata Community</strong> adalah ekosistem kolaborasi Koloxe,
            Amethyst, dan McCreata.
          </p>

          {showFullInfo && (
            <p className="text-sm text-gray-500 mt-3">
              Kerja sama Kreata & BguneNet sebagai ruang komunitas digital
              untuk berbagi karya & interaksi.
            </p>
          )}

          <button
            onClick={() => setShowFullInfo(!showFullInfo)}
            className="text-emerald-500 text-xs font-bold mt-2 flex items-center gap-1"
          >
            {showFullInfo ? <>Tutup <ChevronUp size={14} /></> : <>Baca Selengkapnya <ChevronDown size={14} /></>}
          </button>

          <div className="flex gap-3 mt-4">
            <a href={WA_CHANNEL_URL} target="_blank"
              className="flex-1 border-2 border-emerald-500 text-emerald-500 rounded-xl py-2 text-sm font-bold flex justify-center gap-2">
              <Zap size={18} /> Saluran WA
            </a>
            <a href={WA_GROUP_URL} target="_blank"
              className="flex-1 bg-emerald-600 text-white rounded-xl py-2 text-sm font-bold flex justify-center gap-2">
              <MessageCircle size={18} /> Grup WA
            </a>
          </div>
        </div>
      </div>

      {/* FEED */}
      <div className="max-w-4xl mx-auto px-4 mt-8">
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="animate-spin mx-auto text-emerald-500" />
            <p className="text-xs text-gray-400 mt-2">Memuat Kreata…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
            <Info className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Belum ada postingan #kreata</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {posts.map(p => (
              <KreataCard
                key={p.id}
                post={p}
                onClick={() => onPostClick?.(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================= CARD ================= */
const KreataCard = ({ post, onClick }) => {
  const mediaSrc =
    post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]);

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border hover:shadow-lg cursor-pointer"
    >
      <div className="p-3 flex items-center gap-2 border-b">
        <img
          src={post.user?.photoURL || "https://c.termai.cc/i150/VrL65.png"}
          className="w-8 h-8 rounded-full"
        />
        <span className="text-xs font-bold">
          {post.user?.username || "User"}
        </span>
      </div>

      {mediaSrc && (
        <img src={mediaSrc} className="w-full aspect-video object-cover" />
      )}

      <div className="p-4">
        <h4 className="font-bold text-sm mb-1">
          {post.title || "Postingan Kreata"}
        </h4>
        <p className="text-xs text-gray-500 line-clamp-3">
          {post.content}
        </p>

        <div className="flex gap-4 text-xs text-gray-400 mt-3">
          <span className="flex gap-1">
            <Heart size={14} /> {post.likes?.length || 0}
          </span>
          <span className="flex gap-1">
            <MessageSquare size={14} /> {post.commentsCount || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

export default KreataRoom;