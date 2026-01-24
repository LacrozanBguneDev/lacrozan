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
                
                // JANGAN pakai orderBy dulu supaya tidak kena error Index Firestore
                // Kita ambil 100 data terbaru secara random/default dari Firebase
                const q = query(postsRef, limit(100));
                const querySnapshot = await getDocs(q);
                
                let filtered = [];

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    // GABUNGKAN SEMUA FIELD UNTUK DICEK (Content, Title, Category)
                    const content = (data.content || "").toLowerCase();
                    const title = (data.title || "").toLowerCase();
                    const category = (data.category || "").toLowerCase();

                    // Cek apakah ada unsur 'kreata'
                    if (content.includes('kreata') || title.includes('kreata') || category.includes('kreata')) {
                        filtered.push({ id: doc.id, ...data });
                    }
                });

                // URUTKAN MANUAL DI SINI (Terbaru ke Terlama)
                filtered.sort((a, b) => {
                    const timeA = a.timestamp?.seconds || 0;
                    const timeB = b.timestamp?.seconds || 0;
                    return timeB - timeA;
                });

                // AMBIL DATA USER (USERNAME & FOTO)
                const enrichedPosts = await Promise.all(filtered.map(async (p) => {
                    if (p.user && p.user.photoURL) return p;
                    try {
                        if (p.userId) {
                            const userRef = doc(db, FIXED_USERS_PATH, p.userId);
                            const userSnap = await getDoc(userRef);
                            if (userSnap.exists()) return { ...p, user: userSnap.data() };
                        }
                    } catch (e) { console.log("User fetch error"); }
                    return { ...p, user: p.user || { username: 'Kreator', photoURL: '' } };
                }));

                setPosts(enrichedPosts);
            } catch (error) {
                console.error("Gagal memuat data:", error);
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
                <div className="absolute bottom-0 left-0 p-6 z-10 text-white">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">Official Partner</span>
                    <h1 className="text-3xl md:text-4xl font-black leading-tight drop-shadow-md">KREATA <span className="text-emerald-400">ROOM</span></h1>
                </div>
            </div>

            {/* INFO & WA BUTTONS */}
            <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <Users size={18} className="text-emerald-500" /> Tentang Komunitas
                            </h3>
                            <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-justify">
                                <p><strong>Kreata Community</strong> adalah wadah kolaborasi yang menaungi <strong>Koloxe, Amethyst, dan McCreata</strong>.</p>
                                {showFullInfo && (
                                    <p className="mt-2 animate-in fade-in duration-300 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                        Bekerja sama dengan BguneNet untuk menghadirkan ruang ekspresi digital bagi seluruh kreator dalam ekosistem Kreata.
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setShowFullInfo(!showFullInfo)} className="mt-2 text-emerald-600 font-bold text-xs flex items-center gap-1">
                                {showFullInfo ? <>Sembunyikan <ChevronUp size={14} /></> : <>Baca Selengkapnya <ChevronDown size={14} /></>}
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0 md:w-48">
                            <a href={WA_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="bg-white border-2 border-emerald-500 text-emerald-600 py-2.5 rounded-xl text-center text-xs font-bold hover:bg-emerald-50 transition">Saluran WA</a>
                            <a href={WA_GROUP_URL} target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white py-2.5 rounded-xl text-center text-xs font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 dark:shadow-none">Grup Komunitas</a>
                        </div>
                    </div>
                </div>
            </div>

            {/* FEED SECTION */}
            <div className="max-w-4xl mx-auto px-4 mt-10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                        <Zap size={20} className="text-yellow-500 fill-yellow-500" /> Sorotan #kreata
                    </h3>
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full uppercase tracking-tighter">
                        {posts.length} Postingan Ditemukan
                    </span>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-emerald-500" size={32} />
                        <p className="text-xs text-gray-400 font-medium">Memindai 100 data terbaru...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                        <Info size={40} className="mx-auto text-gray-300 mb-3" />
                        <h4 className="font-bold text-gray-800 dark:text-white">Kosong? Cek Penulisanmu</h4>
                        <p className="text-gray-500 text-sm px-6">Kami tidak menemukan kata "kreata" di 100 data terbaru. <br/>Pastikan ngetiknya bener ya!</p>
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
    const hasMedia = post.mediaUrl && post.mediaUrl !== "";
    const userPhoto = post.user?.photoURL || "https://c.termai.cc/i150/VrL65.png";
    const content = post.content || post.caption || "";

    return (
        <div onClick={onClick} className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full">
            <div className="p-4 flex items-center gap-3">
                <img src={userPhoto} className="w-9 h-9 rounded-full object-cover border" alt="Avatar" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{post.user?.username || 'User'}</span>
            </div>

            {hasMedia && (
                <div className="w-full aspect-video overflow-hidden bg-gray-100">
                    <img src={post.mediaUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="Post" />
                </div>
            )}

            <div className="p-4 flex-1 flex flex-col">
                {post.title && <h4 className="font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{post.title}</h4>}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 whitespace-pre-wrap">{content}</p>
                <div className="mt-auto flex items-center gap-4 text-gray-400 text-xs pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-1"><Heart size={14} /> <span>{post.likes?.length || 0}</span></div>
                    <div className="flex items-center gap-1"><MessageSquare size={14} /> <span>{post.commentsCount || 0}</span></div>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;