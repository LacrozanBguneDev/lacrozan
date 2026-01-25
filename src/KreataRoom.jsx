import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Sparkles, Check, Volume2, VolumeX, 
    Bell, Heart, MessageSquare, Loader2, Play, Eye, 
    Link as LinkIcon, Image as ImageIcon, MessageCircle, // <--- SUDAH DITAMBAHKAN
    User
} from 'lucide-react';

const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

// --- KOMPONEN KEAMANAN & FORMATTING ---
const RichTextRenderer = ({ text }) => {
    if (!text) return null;
    // Regex: URL, Bold (**), Italic (*)
    const regex = /(\bhttps?:\/\/[^\s]+)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
    const parts = text.split(regex).filter(Boolean);

    return (
        <span className="break-words font-light">
            {parts.map((part, index) => {
                if (part.match(/^https?:\/\//)) {
                    return (
                        <a key={index} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                           className="text-emerald-400 font-bold hover:underline decoration-wavy decoration-emerald-500/50">
                            LINK EKSTERNAL ↗
                        </a>
                    );
                } else if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index} className="text-white font-black">{part.slice(2, -2)}</strong>;
                } else if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={index} className="text-emerald-200 not-italic">{part.slice(1, -1)}</em>;
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};

const KreataRoom = ({ setPage }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    // Audio Refs (Musik Upbeat)
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
    const bgMusic = useRef(new Audio('https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3')); 

    useEffect(() => {
        if (hasStarted) {
            fetchKreataPosts();
            bgMusic.current.loop = true;
            bgMusic.current.volume = 0.3;
            bgMusic.current.play().catch(() => console.log("Autoplay blocked"));
        }
        return () => {
            bgMusic.current.pause();
        };
    }, [hasStarted]);

    const fetchKreataPosts = async () => {
        try {
            setLoading(true);
            const res = await fetch('https://app.bgunenet.my.id/api/feed?mode=search&q=#kreata&limit=20');
            const data = await res.json();
            
            const sanitizedPosts = (data.posts || []).map(post => {
                let finalImage = null;
                if (post.mediaUrl && post.mediaUrl !== "") finalImage = post.mediaUrl;
                else if (post.mediaUrls && post.mediaUrls.length > 0) finalImage = post.mediaUrls[0];

                return {
                    id: post.id || Math.random().toString(36),
                    title: post.title || "Kreata Update",
                    content: post.content || post.text || "",
                    author: post.user?.username || "Anonymous",
                    // Fix: Pastikan avatar valid atau gunakan inisial
                    avatar: post.user?.photoURL && post.user.photoURL.startsWith('http') 
                            ? post.user.photoURL 
                            : `https://ui-avatars.com/api/?name=${post.user?.username || 'User'}&background=10b981&color=fff`,
                    image: finalImage,
                    commentsCount: post.commentsCount || 0,
                    likesCount: post.likesCount || 0
                };
            });
            setPosts(sanitizedPosts);
        } catch (e) {
            console.error("Gagal load Kreata posts", e);
        } finally {
            setLoading(false);
        }
    };

    const playClick = () => {
        audioClick.current.currentTime = 0;
        audioClick.current.play().catch(() => {});
    };

    const toggleMusic = () => {
        if (isMuted) bgMusic.current.play().catch(() => {});
        else bgMusic.current.pause();
        setIsMuted(!isMuted);
    };

    const startRoom = () => {
        playClick();
        setHasStarted(true);
    };

    const handleViewDetail = (postId) => {
        playClick();
        window.location.href = `/?post=${postId}`;
    };

    // --- HALAMAN INTRO ---
    if (!hasStarted) {
        return (
            <div className="fixed inset-0 z-[999] bg-[#050505] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#050505] to-[#050505]"></div>
                
                <div className="relative z-10 animate-fade-in-up">
                    <div className="relative mb-8 inline-block group cursor-pointer" onClick={startRoom}>
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-[35px] blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                        <img src={KREATA_LOGO} className="relative w-32 h-32 rounded-[32px] border-2 border-slate-800 shadow-2xl object-cover" alt="Logo" />
                    </div>
                    
                    <h1 className="text-5xl font-black text-white italic mb-2 tracking-tighter drop-shadow-lg">
                        KREATA <span className="text-emerald-500">ROOM</span>
                    </h1>
                    <p className="text-slate-500 text-sm mb-10 tracking-widest uppercase font-bold">Sound On • Vibe On</p>
                    
                    <button onClick={startRoom} className="bg-emerald-500 hover:bg-emerald-400 text-black px-10 py-4 rounded-full font-black uppercase text-sm tracking-[0.2em] transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center gap-3 mx-auto">
                        <Play size={18} fill="black" /> Masuk
                    </button>
                </div>
            </div>
        );
    }

    // --- HALAMAN UTAMA ---
    return (
        <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-emerald-500/40 pb-32">
            
            {/* HEADER STICKY & BLUR */}
            <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-4 flex items-center justify-between">
                <button onClick={() => { playClick(); setPage && setPage('home'); }} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                    <ArrowLeft size={22} className="text-slate-300" />
                </button>
                <div className="flex flex-col items-center cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                    <span className="text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase leading-none">Feed</span>
                    <span className="font-black italic text-lg text-white uppercase tracking-tighter">KREATA</span>
                </div>
                <button onClick={toggleMusic} className={`p-2 rounded-xl transition-all ${isMuted ? 'text-rose-500 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} className="animate-pulse" />}
                </button>
            </nav>

            <div className="max-w-md mx-auto px-4 pt-24 space-y-8">
                
                {/* HERO CARD - GLOWING EFFECT */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-[30px] opacity-20 blur group-hover:opacity-40 transition duration-500"></div>
                    <div className="relative bg-[#0a0a0a] rounded-[28px] p-6 border border-white/10">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <img src={KREATA_LOGO} className="w-14 h-14 rounded-xl border border-white/10" alt="Icon" />
                                <div>
                                    <h2 className="text-lg font-black italic text-white uppercase leading-none">Community</h2>
                                    <span className="text-xs font-bold text-emerald-500 tracking-wider">OFFICIAL HUB</span>
                                </div>
                            </div>
                            <Sparkles className="text-yellow-500/80" size={20} />
                        </div>
                        
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                            Gunakan hashtag <span className="text-white font-bold bg-emerald-500/20 px-1 rounded">#kreata</span> agar karyamu muncul otomatis di sini.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" rel="noreferrer" onClick={playClick}
                               className="flex items-center justify-center gap-2 bg-[#25D366] text-black py-3 rounded-xl font-bold text-xs uppercase tracking-tight hover:scale-105 transition-transform shadow-lg shadow-green-900/20">
                                <MessageCircle size={16} fill="black" /> Join Group
                            </a>
                            <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" rel="noreferrer" onClick={playClick}
                               className="flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-tight hover:bg-slate-700 transition-colors border border-white/5">
                                <Bell size={16} fill="white" /> Info Channel
                            </a>
                        </div>
                    </div>
                </div>

                {/* FEED LIST */}
                <div>
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Live Updates
                        </h3>
                        {loading && <Loader2 className="animate-spin text-emerald-500" size={16} />}
                    </div>

                    {posts.length === 0 && !loading ? (
                        <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/5">
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Belum ada konten #kreata</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {posts.map((post) => (
                                <div key={post.id} className="bg-[#0f0f0f] border border-white/5 rounded-[32px] overflow-hidden hover:border-emerald-500/30 transition-all duration-300">
                                    
                                    {/* HEADER POST */}
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img src={post.avatar} className="w-10 h-10 rounded-full bg-slate-800 object-cover border border-white/10" alt="Ava" onError={(e) => {e.target.src=`https://ui-avatars.com/api/?name=${post.author}`}} />
                                                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-[8px] font-black text-black px-1 rounded border border-[#0f0f0f]">PRO</div>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white leading-tight">{post.author}</h4>
                                                <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{post.title}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MEDIA / GAMBAR */}
                                    {post.image ? (
                                        <div className="w-full bg-black relative">
                                            <img src={post.image} className="w-full h-auto max-h-[400px] object-contain mx-auto" alt="Content" loading="lazy" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-32 bg-gradient-to-br from-emerald-900/10 to-slate-900/10 flex items-center justify-center border-y border-white/5">
                                            <ImageIcon className="text-slate-700 opacity-20" size={40} />
                                        </div>
                                    )}

                                    {/* CAPTION & BUTTONS */}
                                    <div className="p-5">
                                        <div className="text-xs text-slate-300 leading-relaxed font-medium mb-4 line-clamp-3">
                                            <RichTextRenderer text={post.content} />
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                            <div className="flex gap-4">
                                                <div className="flex items-center gap-1.5 text-slate-400">
                                                    <Heart size={16} className={post.likesCount > 0 ? "text-rose-500 fill-rose-500" : ""} />
                                                    <span className="text-[10px] font-bold">{post.likesCount}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-400">
                                                    <MessageSquare size={16} className={post.commentsCount > 0 ? "text-blue-500 fill-blue-500" : ""} />
                                                    <span className="text-[10px] font-bold">{post.commentsCount}</span>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleViewDetail(post.id)}
                                                className="bg-white/5 hover:bg-emerald-500 hover:text-black text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all flex items-center gap-2"
                                            >
                                                <Eye size={12} /> View
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pb-10 pt-4 flex justify-center opacity-30">
                     <div className="w-12 h-1 bg-slate-700 rounded-full"></div>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;