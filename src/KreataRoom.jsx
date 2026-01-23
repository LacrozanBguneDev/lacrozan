// FILE: KreataRoom.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Loader2, Heart, MessageSquare, ExternalLink, Zap, Info } from 'lucide-react'; // Tambah 'Info'
import { 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs,
    getDoc,
    doc
} from 'firebase/firestore'; 

const KREATA_ROOM_IMG = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

const KreataRoom = ({ setPage, db, onPostClick }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchKreataPosts = async () => {
            if (!db) return;
            setLoading(true);
            try {
                // Ambil 50 post terakhir untuk disaring di sisi klien
                const postsRef = collection(db, 'artifacts/default-app-id/public/data/posts');
                const q = query(postsRef, orderBy('timestamp', 'desc'), limit(50));
                
                const querySnapshot = await getDocs(q);
                
                const rawPosts = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Filter: Harus mengandung #kreata (case insensitive)
                    if (data.content && data.content.toLowerCase().includes('#kreata')) {
                        rawPosts.push({ id: doc.id, ...data });
                    }
                });

                // Perkaya data dengan info user
                const enrichedPosts = await Promise.all(rawPosts.map(async (p) => {
                    if (p.user && p.user.photoURL) return p; 
                    try {
                        const userSnap = await getDoc(doc(db, 'artifacts/default-app-id/public/data/userProfiles', p.userId));
                        if (userSnap.exists()) {
                            return { ...p, user: userSnap.data() };
                        }
                    } catch (e) { console.log(e); }
                    return p;
                }));

                setPosts(enrichedPosts);
            } catch (error) {
                console.error("Gagal memuat Kreata feed:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchKreataPosts();
    }, [db]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 pb-20 animate-in fade-in duration-500">
            
            {/* --- HERO SECTION --- */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <button 
                    onClick={() => setPage('home')} 
                    className="absolute top-6 left-6 z-20 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white p-2.5 rounded-full transition"
                >
                    <ArrowLeft size={20} />
                </button>
                <img src={KREATA_ROOM_IMG} alt="Kreata Room" className="w-full h-full object-cover object-center"/>
                <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] dark:from-gray-900 via-transparent to-black/40"></div>
                <div className="absolute bottom-0 left-0 p-6 z-10">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">Official Partner</span>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-white leading-tight drop-shadow-sm">
                        KREATA <span className="text-emerald-500">ROOM</span>
                    </h1>
                </div>
            </div>

            {/* --- INFO SECTION (DESKRIPSI) --- */}
            <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 p-6 md:p-8">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hidden md:block">
                            <Users className="text-emerald-600" size={24} />
                        </div>
                        <div className="space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300 text-justify">
                            <p><strong>Kreata Community</strong> adalah wadah kolaborasi yang menaungi beberapa komunitas, yaitu <span className="text-emerald-600 font-bold">Koloxe, Amethyst, dan McCreata</span>...</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- INSTRUKSI / CARA POSTING (BARU DITAMBAHKAN) --- */}
            <div className="max-w-4xl mx-auto px-4 mt-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
                    <div className="bg-white dark:bg-emerald-900 p-2.5 rounded-full text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
                        <Info size={20} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">Ingin Karyamu Muncul di Sini?</h4>
                        <p className="text-emerald-800/80 dark:text-emerald-400/80 text-xs mt-1 leading-relaxed">
                            Cukup buat postingan baru dan sertakan hashtag <span className="font-bold bg-white dark:bg-black/30 px-1.5 py-0.5 rounded text-emerald-700 border border-emerald-200 dark:border-emerald-800 mx-1">#kreata</span> di captionmu. Otomatis akan tampil di galeri komunitas ini!
                        </p>
                    </div>
                </div>
            </div>

            {/* --- FEED GRID --- */}
            <div className="max-w-4xl mx-auto px-4 mt-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                        <Zap size={20} className="text-yellow-500 fill-yellow-500" /> Sorotan Komunitas
                    </h3>
                </div>
                
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300">
                        <p className="text-gray-400 text-sm mb-2">Belum ada postingan di Kreata Room.</p>
                        <p className="text-emerald-500 text-xs font-bold">Jadilah yang pertama dengan posting #kreata!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {posts.map((post) => (<KreataCard key={post.id} post={post} onClick={() => onPostClick && onPostClick(post.id)} />))}
                    </div>
                )}

                <div className="mt-8 mb-4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Kreata Room Community Feed</p>
                </div>
            </div>
        </div>
    );
};

// Sub-Component Card
const KreataCard = ({ post, onClick }) => {
    const hasMedia = post.mediaUrl || (post.mediaUrls && post.mediaUrls.length > 0);
    const mediaSrc = post.mediaUrl || (post.mediaUrls ? post.mediaUrls[0] : null);
    const excerpt = post.content ? (post.content.length > 100 ? post.content.substring(0, 100) + "..." : post.content) : "";

    return (
        <div onClick={onClick} className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full">
            <div className="p-3 flex items-center gap-2 border-b border-gray-50 dark:border-gray-700/50">
                <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden"><img src={post.user?.photoURL || "https://c.termai.cc/i150/VrL65.png"} className="w-full h-full object-cover"/></div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{post.user?.username || 'User'}</span>
            </div>
            {hasMedia && (<div className="relative w-full aspect-video bg-black overflow-hidden">{post.mediaType === 'video' ? (<div className="w-full h-full flex items-center justify-center bg-gray-900"><span className="text-white text-xs font-bold flex items-center gap-1"><ExternalLink size={12}/> VIDEO</span></div>) : (<img src={mediaSrc} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />)}</div>)}
            <div className="p-4 flex-1 flex flex-col"><h4 className="font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{post.title}</h4><p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-1 leading-relaxed">{excerpt}</p><div className="flex items-center gap-4 text-gray-400 text-xs mt-auto pt-3 border-t border-gray-50 dark:border-gray-700"><div className="flex items-center gap-1"><Heart size={14} className={post.likes?.length > 0 ? "text-rose-500 fill-rose-500" : ""} /><span>{post.likes?.length || 0}</span></div><div className="flex items-center gap-1"><MessageSquare size={14} /><span>{post.commentsCount || 0}</span></div></div></div>
        </div>
    );
};

export default KreataRoom;