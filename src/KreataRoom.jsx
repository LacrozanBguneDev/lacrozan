// FILE: KreataRoom.jsx
import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Users, Loader2, Heart, MessageSquare, 
    ExternalLink, Zap, Info, ChevronDown, ChevronUp, MessageCircle 
} from 'lucide-react';
import {
    collection,
    query,
    limit,
    getDocs,
    getDoc,
    doc,
    orderBy
} from 'firebase/firestore';

const FIXED_POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const FIXED_USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";
const KREATA_ROOM_IMG = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";
const WA_CHANNEL_URL = "https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j";
const WA_GROUP_URL = "https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss?mode=wwt";

const KreataRoom = ({ setPage, db, onPostClick }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFullInfo, setShowFullInfo] = useState(false);

    useEffect(() => {
        const fetchKreataPosts = async () => {
            if (!db) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const postsRef = collection(db, FIXED_POSTS_PATH);
                
                // KITA AMBIL 100 DATA TERBARU (MENGGUNAKAN ORDERBY)
                // Jika muncul error "The query requires an index", hapus baris orderBy-nya
                const q = query(postsRef, orderBy('timestamp', 'desc'), limit(100));
                
                const querySnapshot = await getDocs(q);
                const filtered = [];

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    // PENGECEKAN SUPER LENGKAP (Judul, Konten, dan User Profile)
                    const title = (data.title || "").toLowerCase();
                    const content = (data.content || "").toLowerCase();
                    const category = (data.category || "").toLowerCase();

                    // Cek apakah ada unsur 'kreata'
                    if (title.includes('kreata') || content.includes('kreata') || category.includes('kreata')) {
                        filtered.push({ id: doc.id, ...data });
                    }
                });

                // Ambil info user untuk setiap postingan yang lolos filter
                const enrichedPosts = await Promise.all(filtered.map(async (p) => {
                    if (p.user && p.user.photoURL) return p;
                    try {
                        const userRef = doc(db, FIXED_USERS_PATH, p.userId);
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) return { ...p, user: userSnap.data() };
                    } catch (e) { console.log("User fetch error", e); }
                    return p;
                }));

                setPosts(enrichedPosts);
            } catch (error) {
                console.error("Firestore Error:", error);
                // Jika error index, kita coba ambil tanpa urutan (limit saja)
                try {
                    const fallbackQuery = query(collection(db, FIXED_POSTS_PATH), limit(100));
                    const snap = await getDocs(fallbackQuery);
                    const fallbackData = [];
                    snap.forEach(d => {
                        const dat = d.data();
                        if ((dat.content || "").toLowerCase().includes('kreata')) fallbackData.push({id: d.id, ...dat});
                    });
                    setPosts(fallbackData);
                } catch (err2) { console.log(err2); }
            } finally {
                setLoading(false);
            }
        };

        fetchKreataPosts();
    }, [db]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 pb-20">
            {/* HERO */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <button onClick={() => setPage('home')} className="absolute top-6 left-6 z-20 bg-black/30 text-white p-2.5 rounded-full hover:bg-black/50 transition">
                    <ArrowLeft size={20} />
                </button>
                <img src={KREATA_ROOM_IMG} alt="Kreata Hero" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] dark:from-gray-900 via-transparent to-black/20"></div>
                <div className="absolute bottom-6 left-6">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block">OFFICIAL PARTNER</span>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white leading-tight">KREATA <span className="text-emerald-500">ROOM</span></h1>
                </div>
            </div>

            {/* KOMUNITAS INFO */}
            <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Tentang Kreata</h3>
                            <div className={`text-sm text-gray-600 dark:text-gray-300 leading-relaxed ${!showFullInfo && 'line-clamp-2'}`}>
                                <p><strong>Kreata Community</strong> adalah wadah kolaborasi yang menaungi <strong>Koloxe, Amethyst, dan McCreata</strong>. Tempat berinteraksi dan berkreasi secara digital maupun offline.</p>
                                <p className="mt-2">Kerja sama dengan BguneNet ini memberikan ruang eksklusif bagi anggota komunitas untuk tampil di Sorotan Komunitas ini.</p>
                            </div>
                            <button onClick={() => setShowFullInfo(!showFullInfo)} className="mt-2 text-emerald-600 font-bold text-xs flex items-center gap-1">
                                {showFullInfo ? <>Tutup <ChevronUp size={14} /></> : <>Selengkapnya <ChevronDown size={14} /></>}
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0 md:w-48">
                            <a href={WA_CHANNEL_URL} target="_blank" className="bg-white border-2 border-emerald-500 text-emerald-600 py-2 rounded-xl text-center text-xs font-bold hover:bg-emerald-50 transition">Saluran WA</a>
                            <a href={WA_GROUP_URL} target="_blank" className="bg-emerald-600 text-white py-2 rounded-xl text-center text-xs font-bold hover:bg-emerald-700 transition">Grup Komunitas</a>
                        </div>
                    </div>
                </div>
            </div>

            {/* FEED SOROTAN */}
            <div className="max-w-4xl mx-auto px-4 mt-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                        <h3 className="font-bold text-xl text-gray-800 dark:text-white">Sorotan Postingan #kreata</h3>
                    </div>
                    <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">{posts.length} Karya</span>
                </div>

                {loading ? (
                    <div className="text-center py-20">
                        <Loader2 className="animate-spin text-emerald-500 mx-auto mb-4" size={40} />
                        <p className="text-gray-400 text-sm italic">Mencari karya kreatif dengan hashtag #kreata...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <Info size={48} className="mx-auto text-gray-300 mb-4" />
                        <h4 className="text-gray-800 dark:text-white font-bold">Belum ada karya terpantau</h4>
                        <p className="text-gray-500 text-sm mt-1">Pastikan postinganmu mencantumkan hashtag <span className="text-emerald-500 font-bold">#kreata</span> di caption!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {posts.map((post) => (
                            <KreataCard key={post.id} post={post} onClick={() => onPostClick && onPostClick(post.id)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const KreataCard = ({ post, onClick }) => {
    // Sesuai data JSON kamu:
    const contentText = post.content || ""; 
    const hasMedia = post.mediaUrl && post.mediaUrl !== "";
    const userPhoto = post.user?.photoURL || "https://c.termai.cc/i150/VrL65.png";

    return (
        <div onClick={onClick} className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300 cursor-pointer flex flex-col">
            <div className="p-4 flex items-center gap-3">
                <img src={userPhoto} className="w-10 h-10 rounded-full object-cover border-2 border-emerald-100" alt="Avatar" />
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-emerald-600 transition-colors">{post.user?.username || 'Kreator'}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Community Member</span>
                </div>
            </div>

            {hasMedia && (
                <div className="aspect-video bg-gray-100 overflow-hidden">
                    <img src={post.mediaUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="Karya" />
                </div>
            )}

            <div className="p-5 flex-1 flex flex-col">
                {post.title && <h4 className="font-bold text-gray-900 dark:text-white mb-2">{post.title}</h4>}
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed mb-4">
                    {contentText}
                </p>
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                            <Heart size={16} className={post.likes?.length > 0 ? "text-rose-500 fill-rose-500" : ""} />
                            <span>{post.likes?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                            <MessageSquare size={16} />
                            <span>{post.commentsCount || 0}</span>
                        </div>
                    </div>
                    <Zap size={14} className="text-yellow-400" />
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;