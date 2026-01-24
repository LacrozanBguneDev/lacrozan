import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Sparkles, Check, Volume2, VolumeX, 
    Bell, Heart, MessageSquare, Loader2, Play, Eye, 
    Link as LinkIcon, Image as ImageIcon
} from 'lucide-react';

const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

// --- KOMPONEN KEAMANAN & FORMATTING ---
// Mengubah teks menjadi elemen React aman (Tanpa dangerouslySetInnerHTML)
const RichTextRenderer = ({ text }) => {
    if (!text) return null;

    // Regex untuk mendeteksi URL, Bold (**), dan Italic (*)
    const regex = /(\bhttps?:\/\/[^\s]+)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
    
    // Pecah teks berdasarkan regex
    const parts = text.split(regex).filter(Boolean);

    return (
        <span className="break-words">
            {parts.map((part, index) => {
                // 1. Handle Link
                if (part.match(/^https?:\/\//)) {
                    return (
                        <a 
                            key={index} 
                            href={part} 
                            target="_blank" 
                            rel="noopener noreferrer" // Mencegah phishing/tabnabbing
                            className="text-emerald-400 hover:text-emerald-300 underline decoration-dotted font-bold"
                            onClick={(e) => e.stopPropagation()} // Supaya tidak memicu klik kartu
                        >
                            {part.length > 30 ? part.substring(0, 30) + '...' : part}
                        </a>
                    );
                }
                // 2. Handle Bold (**teks**)
                else if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index} className="text-white font-black text-shadow-sm">{part.slice(2, -2)}</strong>;
                }
                // 3. Handle Italic (*teks*)
                else if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={index} className="text-emerald-200">{part.slice(1, -1)}</em>;
                }
                // 4. Teks Biasa
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

    // Audio: Menggunakan musik yang lebih upbeat/fun
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
    const bgMusic = useRef(new Audio('https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3')); // Upbeat Pop Style

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
            // URL API tanpa API Key (sesuai request)
            const res = await fetch('https://app.bgunenet.my.id/api/feed?mode=search&q=%23kreata&limit=20');
            const data = await res.json();
            
            // Mapping Data API Baru ke State
            const sanitizedPosts = (data.posts || []).map(post => {
                // Logika prioritas media: mediaUrl > elemen pertama mediaUrls > null
                let finalImage = null;
                if (post.mediaUrl && post.mediaUrl !== "") {
                    finalImage = post.mediaUrl;
                } else if (post.mediaUrls && post.mediaUrls.length > 0) {
                    finalImage = post.mediaUrls[0];
                }

                return {
                    id: post.id || Math.random().toString(36), // Fallback ID
                    title: post.title || "Kreata Update",
                    content: post.content || post.text || "",
                    author: post.user?.username || "Anonymous Creator",
                    // Mengambil avatar dari user object, fallback ke UI Avatars
                    avatar: post.user?.photoURL || `https://ui-avatars.com/api/?name=${post.user?.username || 'User'}&background=random`,
                    image: finalImage,
                    commentsCount: post.commentsCount || 0,
                    // API contoh tidak ada likesCount, kita default 0 atau random untuk visual
                    likesCount: post.likesCount || Math.floor(Math.random() * 50) 
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
        const audio = audioClick.current;
        audio.currentTime = 0;
        audio.play().catch(() => {});
    };

    const toggleMusic = () => {
        if (isMuted) {
            bgMusic.current.play().catch(() => {});
        } else {
            bgMusic.current.pause();
        }
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

    // --- HALAMAN PEMBUKA (LANDING) ---
    if (!hasStarted) {
        return (
            <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                {/* Background Effects */}
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(16,185,129,0.15),transparent_70%)]"></div>
                <div className="absolute w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] -top-20 -left-20 animate-pulse"></div>
                <div className="absolute w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] -bottom-20 -right-20 animate-pulse delay-1000"></div>

                <div className="relative mb-8 group cursor-pointer" onClick={startRoom}>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-purple-500 blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                    <img 
                        src={KREATA_LOGO} 
                        className="w-36 h-36 rounded-[40px] relative z-10 border-4 border-slate-900 shadow-2xl group-hover:scale-105 transition-transform duration-500 object-cover" 
                        alt="Logo" 
                    />
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900 border border-emerald-500/50 px-4 py-1 rounded-full">
                        <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest animate-pulse">Tap to Enter</span>
                    </div>
                </div>

                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-purple-400 italic mb-4 uppercase tracking-tighter drop-shadow-lg">
                    KREATA <span className="text-white/20 not-italic font-sans">ROOM</span>
                </h1>
                <p className="text-slate-400 text-sm mb-12 max-w-xs font-medium leading-relaxed">
                    Masuki dimensi kreatif BguneNet. <br/>
                    <span className="text-emerald-500 font-bold">Musik On.</span> <span className="text-purple-400 font-bold">Vibe On.</span>
                </p>

                <button 
                    onClick={startRoom}
                    className="group relative flex items-center gap-4 bg-white text-black px-12 py-5 rounded-full font-black uppercase text-sm tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(52,211,153,0.6)]"
                >
                    <Play size={20} fill="black" className="group-hover:translate-x-1 transition-transform" /> 
                    Mulai Jelajah
                </button>
            </div>
        );
    }

    // --- HALAMAN UTAMA (FEED) ---
    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pb-32 font-sans selection:bg-emerald-500/30">
            
            {/* HEADER */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 px-4 h-20 flex items-center justify-between">
                <button onClick={() => { playClick(); setPage && setPage('home'); }} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5">
                    <ArrowLeft size={20} className="text-slate-300" />
                </button>
                <div className="flex flex-col items-center cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                    <span className="text-[9px] font-black text-purple-400 tracking-[0.4em] uppercase leading-none mb-1">Feed</span>
                    <span className="font-black italic text-xl text-white uppercase leading-none tracking-tighter">KREATA</span>
                </div>
                <button onClick={toggleMusic} className={`p-3 rounded-2xl transition-all border border-white/5 ${isMuted ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} className="animate-pulse" />}
                </button>
            </nav>

            <div className="max-w-xl mx-auto px-4 pt-28 space-y-8">

                {/* HERO BANNER (Desain lebih vibrant) */}
                <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900/40 via-slate-900 to-purple-900/40 rounded-[40px] border border-white/10 p-1 shadow-2xl">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                    <div className="bg-[#020617]/60 backdrop-blur-sm rounded-[36px] p-7 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-emerald-500 blur-lg opacity-40"></div>
                                    <img src={KREATA_LOGO} className="w-16 h-16 rounded-2xl border border-emerald-500/50 relative z-10" alt="Logo" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black italic uppercase text-white tracking-tight">Community <br/><span className="text-emerald-400">Hub</span></h2>
                                </div>
                            </div>
                            <Sparkles className="text-yellow-400 animate-spin-slow" size={24} />
                        </div>

                        <p className="text-xs text-slate-300 font-medium leading-relaxed mb-6 bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                            Gunakan hashtag <span className="text-emerald-400 font-bold">#kreata</span> di postinganmu. Sistem otomatis akan mendeteksi dan menampilkan karyamu di sini.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" rel="noreferrer" onClick={playClick}
                               className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wide hover:shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-95">
                                <MessageCircle size={16} /> Gabung Grup
                            </a>
                            <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" rel="noreferrer" onClick={playClick}
                               className="flex items-center justify-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-slate-700 transition-all active:scale-95">
                                <Bell size={16} /> Saluran Info
                            </a>
                        </div>
                    </div>
                </section>

                {/* FEED AREA */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                            <h3 className="font-black text-sm tracking-widest text-slate-400 uppercase">Live Feed</h3>
                        </div>
                        {loading && <Loader2 className="animate-spin text-emerald-500" size={18} />}
                    </div>

                    {posts.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                                <ImageIcon size={32} className="text-slate-600" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Belum ada karya #kreata</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {posts.map((post, idx) => (
                                <div key={post.id} className="group relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-[32px] overflow-hidden hover:border-emerald-500/30 transition-all duration-500 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
                                    
                                    {/* Author Info */}
                                    <div className="p-4 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img src={post.avatar} className="w-11 h-11 rounded-full border-2 border-slate-800 object-cover" alt={post.author} />
                                                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-black text-[8px] font-black px-1 rounded-sm">PRO</div>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white leading-tight">{post.author}</h4>
                                                <p className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">{post.title}</p>
                                            </div>
                                        </div>
                                        <button className="text-slate-500 hover:text-white transition-colors">
                                            <LinkIcon size={16} />
                                        </button>
                                    </div>

                                    {/* Image Content */}
                                    {post.image && (
                                        <div className="relative aspect-video bg-black overflow-hidden group-hover:aspect-square transition-all duration-700 ease-in-out">
                                            <img 
                                                src={post.image} 
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                                alt="Content" 
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-60"></div>
                                        </div>
                                    )}

                                    {/* Text & Actions */}
                                    <div className="p-5 relative">
                                        {/* Jika tidak ada gambar, beri highlight warna pada teks */}
                                        {!post.image && <div className="absolute top-0 left-5 w-10 h-1 bg-emerald-500 rounded-full mb-4"></div>}
                                        
                                        <div className="text-sm text-slate-300 leading-relaxed font-medium mb-6 line-clamp-4 group-hover:line-clamp-none transition-all">
                                            <RichTextRenderer text={post.content} />
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                            <div className="flex gap-5">
                                                <button className="flex items-center gap-2 group/btn">
                                                    <div className="p-2 bg-rose-500/10 rounded-full group-hover/btn:bg-rose-500 group-hover/btn:scale-110 transition-all">
                                                        <Heart size={16} className="text-rose-500 group-hover/btn:text-white" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">{post.likesCount}</span>
                                                </button>
                                                <button className="flex items-center gap-2 group/btn">
                                                    <div className="p-2 bg-blue-500/10 rounded-full group-hover/btn:bg-blue-500 group-hover/btn:scale-110 transition-all">
                                                        <MessageSquare size={16} className="text-blue-500 group-hover/btn:text-white" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">{post.commentsCount}</span>
                                                </button>
                                            </div>

                                            <button 
                                                onClick={() => handleViewDetail(post.id)}
                                                className="bg-white text-black px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-400 hover:scale-105 transition-all shadow-lg"
                                            >
                                                Lihat
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="py-10 text-center">
                    <div className="inline-block p-4 rounded-full bg-slate-900 border border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                            Powered by <span className="text-emerald-500">BguneNet API</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;