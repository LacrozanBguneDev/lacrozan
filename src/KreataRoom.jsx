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
    doc
} from 'firebase/firestore';

// --- KONFIGURASI PATH ---
const FIXED_POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const FIXED_USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

// Link & Gambar
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
                // Ambil 100 postingan terbaru untuk difilter
                const q = query(postsRef, limit(100));
                const querySnapshot = await getDocs(q);

                const filtered = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    // PENYEBAB MASALAH SEBELUMNYA:
                    // Kita harus cek semua kemungkinan field (content, title, caption)
                    // Dan paksa ke lowercase agar #KREATA atau #kreata tetap kena.
                    const contentTxt = (data.content || "").toLowerCase();
                    const titleTxt = (data.title || "").toLowerCase();
                    const captionTxt = (data.caption || "").toLowerCase();

                    if (contentTxt.includes('kreata') || titleTxt.includes('kreata') || captionTxt.includes('kreata')) {
                        filtered.push({ id: doc.id, ...data });
                    }
                });

                // Urutkan manual (Terbaru di atas)
                filtered.sort((a, b) => {
                    const timeA = a.timestamp?.seconds || 0;
                    const timeB = b.timestamp?.seconds || 0;
                    return timeB - timeA;
                });

                // Ambil data User Profil jika belum ada
                const enrichedPosts = await Promise.all(filtered.map(async (p) => {
                    if (p.user && p.user.photoURL) return p;
                    try {
                        if (p.userId) {
                            const userRef = doc(db, FIXED_USERS_PATH, p.userId);
                            const userSnap = await getDoc(userRef);
                            if (userSnap.exists()) return { ...p, user: userSnap.data() };
                        }
                    } catch (e) { console.error(e); }
                    return { ...p, user: p.user || { username: 'User', photoURL: '' } };
                }));

                setPosts(enrichedPosts);
            } catch (error) {
                console.error("Error fetching kreata posts:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchKreataPosts();
    }, [db]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 pb-20 animate-in fade-in duration-500">

            {/* HERO SECTION */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <button onClick={() => setPage('home')} className="absolute top-6 left-6 z-20 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white p-2.5 rounded-full transition">
                    <ArrowLeft size={20} />
                </button>
                <img src={KREATA_ROOM_IMG} alt="Kreata Room" className="w-full h-full object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] dark:from-gray-900 via-transparent to-black/40"></div>
                <div className="absolute bottom-0 left-0 p-6 z-10">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">Official Partner</span>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-white leading-tight drop-shadow-sm">KREATA <span className="text-emerald-500">ROOM</span></h1>
                </div>
            </div>

            {/* INFO SECTION */}
            <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 md:p-8">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hidden md:block shrink-0">
                            <Users className="text-emerald-600" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2 md:hidden">Tentang Komunitas</h3>
                            <div className="space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300 text-justify">
                                <p><strong>Kreata Community</strong> adalah wadah kolaborasi yang menaungi beberapa komunitas, yaitu <span className="text-emerald-600 font-bold"> Koloxe, Amethyst, dan McCreata</span>, yang disatukan dalam satu ekosistem komunitas.</p>
                                {showFullInfo && (
                                    <p className="animate-in fade-in slide-in-from-top-2 duration-300 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                        Kerja sama antara <strong>Kreata Community</strong> dan <strong>BguneNet</strong> dilakukan melalui penyediaan ruang komunitas digital di platform BguneNet sebagai sarana pendukung aktivitas komunitas.
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setShowFullInfo(!showFullInfo)} className="mt-3 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 hover:underline">
                                {showFullInfo ? <>Tutup <ChevronUp size={14} /></> : <>Baca Selengkapnya <ChevronDown size={14} /></>}
                            </button>

                            <div className="my-6 border-b border-gray-100 dark:border-gray-700 w-full"></div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <a href={WA_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-emerald-500 text-emerald-600 py-2.5 px-4 rounded-xl text-sm font-bold transition hover:bg-emerald-50">
                                    <Zap size={18} /> Join Saluran WA
                                </a>
                                <a href={WA_GROUP_URL} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-sm font-bold transition shadow-lg shadow-emerald-200">
                                    <MessageCircle size={18} /> Gabung Grup WA
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* HOW TO JOIN */}
            <div className="max-w-4xl mx-auto px-4 mt-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-4">
                    <Info className="text-emerald-600 shrink-0" size={20} />
                    <p className="text-emerald-800 dark:text-emerald-400 text-xs">
                        Ingin karyamu muncul di sini? Gunakan hashtag <span className="font-bold">#kreata</span> pada postinganmu.
                    </p>
                </div>
            </div>

            {/* FEED GRID */}
            <div className="max-w-4xl mx-auto px-4 mt-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2"><Zap size={20} className="text-yellow-500" /> Sorotan Komunitas</h3>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">{posts.length} Postingan</span>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-emerald-500" size={32} />
                        <p className="text-xs text-gray-400">Memuat postingan #kreata...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300">
                        <Info size={32} className="mx-auto text-gray-400 mb-2" />
                        <h4 className="font-bold text-gray-800 dark:text-white">Tidak ada postingan #kreata</h4>
                        <p className="text-gray-500 text-sm">Coba buat postingan baru dengan hashtag tersebut.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {posts.map((post) => (
                            <KreataCard key={post.id} post={post} onClick={() => onPostClick && onPostClick(post.id)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// CARD COMPONENT
const KreataCard = ({ post, onClick }) => {
    // Sesuai data kamu, mediaUrl bisa string kosong "".
    const hasMedia = post.mediaUrl && post.mediaUrl !== "";
    const contentText = post.content || post.caption || "";
    const userPhoto = post.user?.photoURL || "https://c.termai.cc/i150/VrL65.png";

    return (
        <div onClick={onClick} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition cursor-pointer flex flex-col h-full">
            <div className="p-3 flex items-center gap-2 border-b border-gray-50 dark:border-gray-700/50">
                <img src={userPhoto} className="w-8 h-8 rounded-full object-cover border border-gray-100" alt="User" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{post.user?.username || 'User'}</span>
            </div>

            {hasMedia && (
                <div className="relative w-full aspect-video bg-black overflow-hidden">
                    <img src={post.mediaUrl} className="w-full h-full object-cover" loading="lazy" alt="Post content" />
                </div>
            )}

            <div className="p-4 flex-1 flex flex-col">
                {post.title && <h4 className="font-bold text-gray-900 dark:text-white mb-1">{post.title}</h4>}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 whitespace-pre-wrap">{contentText}</p>

                <div className="flex items-center gap-4 text-gray-400 text-xs mt-auto pt-3 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex items-center gap-1">
                        <Heart size={14} className={post.likes?.length > 0 ? "text-rose-500 fill-rose-500" : ""} />
                        <span>{post.likes?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <MessageSquare size={14} />
                        <span>{post.commentsCount || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;