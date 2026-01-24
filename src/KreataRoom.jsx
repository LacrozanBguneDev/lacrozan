// FILE: KreataRoom.jsx LENGKAP & AMAN
import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Users, Loader2, Heart, MessageSquare, 
    Zap, Info, Plus, Link, CheckCircle2, AlertCircle, Send,
    ChevronDown, ChevronUp, MessageCircle
} from 'lucide-react';
import { collection, getDoc, doc, setDoc, getDocs } from 'firebase/firestore';

const PATH_POSTS = "artifacts/default-app-id/public/data/posts";
const PATH_KREATA_LIST = "artifacts/default-app-id/public/data/kreata_room"; 
const KREATA_IMG = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";
const WA_CHANNEL = "https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j";
const WA_GROUP = "https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss";

const KreataRoom = ({ setPage, db, onPostClick }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputLink, setInputLink] = useState("");
    const [issubmitting, setIsSubmitting] = useState(false);
    const [showFullInfo, setShowFullInfo] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const fetchRoomPosts = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, PATH_KREATA_LIST));
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
            setPosts(list);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchRoomPosts(); }, [db]);

    const handleAddPost = async () => {
        if (!inputLink) return;
        setIsSubmitting(true);
        setMsg({ type: '', text: '' });

        try {
            let postId = inputLink;
            if (inputLink.includes("?post=")) {
                const url = new URL(inputLink);
                postId = url.searchParams.get("post");
            } else if (inputLink.includes("/")) {
                postId = inputLink.split('/').pop();
            }

            const postRef = doc(db, PATH_POSTS, postId);
            const postSnap = await getDoc(postRef);

            if (!postSnap.exists()) throw new Error("Postingan tidak ditemukan.");
            
            const data = postSnap.data();
            const hasHashtag = (data.content || "").toLowerCase().includes("#kreata");

            if (!hasHashtag) throw new Error("Wajib ada hashtag #kreata");

            await setDoc(doc(db, PATH_KREATA_LIST, postId), {
                ...data,
                addedAt: Date.now()
            });

            setMsg({ type: 'success', text: 'Karya berhasil masuk sorotan!' });
            setInputLink("");
            fetchRoomPosts();
        } catch (e) {
            setMsg({ type: 'error', text: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gray-900 pb-20 transition-all">
            {/* HERO SECTION */}
            <div className="relative h-72 overflow-hidden">
                <button onClick={() => setPage('home')} className="absolute top-6 left-6 z-20 bg-black/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/40 transition">
                    <ArrowLeft size={20} />
                </button>
                <img src={KREATA_IMG} className="w-full h-full object-cover" alt="Hero" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-gray-900 via-transparent" />
                
                <div className="absolute bottom-8 left-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                            <CheckCircle2 size={10} /> OFFICIAL PARTNER
                        </span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight italic">KREATA <span className="text-emerald-500">ROOM</span></h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Elevating Creators Community</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-4 relative z-10">
                {/* INFO KOMUNITAS (YANG TADI HILANG) */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <Users size={18} className="text-emerald-500" /> Tentang Komunitas
                            </h3>
                            <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                <p><strong>Kreata Community</strong> menaungi komunitas <strong>Koloxe, Amethyst, dan McCreata</strong>.</p>
                                {showFullInfo && (
                                    <p className="mt-2 animate-in fade-in duration-300 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                        Kolaborasi dengan BguneNet ini memberikan wadah eksklusif bagi kreator untuk memamerkan karya terbaik mereka.
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setShowFullInfo(!showFullInfo)} className="mt-2 text-emerald-600 font-bold text-xs flex items-center gap-1">
                                {showFullInfo ? <>Tutup <ChevronUp size={14} /></> : <>Selengkapnya <ChevronDown size={14} /></>}
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0 md:w-48">
                            <a href={WA_CHANNEL} target="_blank" rel="noopener noreferrer" className="bg-white border-2 border-emerald-500 text-emerald-600 py-2.5 rounded-xl text-center text-[10px] font-black hover:bg-emerald-50 transition uppercase tracking-wider">Saluran WA</a>
                            <a href={WA_GROUP} target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white py-2.5 rounded-xl text-center text-[10px] font-black hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 dark:shadow-none uppercase tracking-wider">Gabung Grup WA</a>
                        </div>
                    </div>
                </div>

                {/* INPUT BOX */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-md border border-gray-100 dark:border-gray-700 mb-10">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-4 text-sm">Punya karya #kreata? Masukkan linknya di sini:</h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                            value={inputLink}
                            onChange={(e) => setInputLink(e.target.value)}
                            placeholder="Contoh: https://app.bgunenet.my.id?post=ID_KAMU" 
                            className="flex-1 bg-slate-50 dark:bg-gray-900 border-none rounded-2xl py-3 px-4 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
                        />
                        <button 
                            onClick={handleAddPost}
                            disabled={issubmitting}
                            className="bg-gray-900 dark:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2"
                        >
                            {issubmitting ? <Loader2 className="animate-spin" size={16} /> : "Klaim Sorotan"}
                        </button>
                    </div>
                    {msg.text && <p className={`mt-3 text-[10px] font-bold ${msg.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>{msg.text}</p>}
                </div>

                {/* LIST KARYA */}
                <h3 className="font-black text-xl text-gray-800 dark:text-white mb-6 flex items-center gap-2 tracking-tight">
                    <Zap size={22} className="text-yellow-500 fill-yellow-500" /> SOROTAN KOMUNITAS
                </h3>

                {loading ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin text-emerald-500 mx-auto" /></div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200">
                        <Info className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500 text-sm">Belum ada karya terpilih. Jadilah yang pertama!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {posts.map(post => (
                            <PostCard key={post.id} post={post} onClick={() => onPostClick(post.id)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const PostCard = ({ post, onClick }) => (
    <div onClick={onClick} className="group bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full">
        {post.mediaUrl && (
            <div className="aspect-video overflow-hidden">
                <img src={post.mediaUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            </div>
        )}
        <div className="p-5 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
                <img src={post.user?.photoURL || "https://c.termai.cc/i150/VrL65.png"} className="w-6 h-6 rounded-full" />
                <span className="text-[10px] font-bold text-gray-400 uppercase">{post.user?.username || 'User'}</span>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-1 italic">{post.title || "Karya Kreata"}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">{post.content}</p>
            <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700 text-gray-400">
                <div className="flex gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><Heart size={12}/> {post.likes?.length || 0}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={12}/> {post.commentsCount || 0}</span>
                </div>
                <CheckCircle2 size={12} className="text-emerald-500" />
            </div>
        </div>
    </div>
);

export default KreataRoom;