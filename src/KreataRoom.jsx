import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Sparkles, Volume2, VolumeX, 
    Bell, Loader2, Play, Eye, 
    MessageCircle, Share2, ExternalLink 
} from 'lucide-react';

const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

// --- FORMATTING TEKS AMAN (ANTI XSS) ---
const RichTextRenderer = ({ text }) => {
    if (!text) return null;
    // Regex untuk URL, Bold (**), Italic (*)
    const regex = /(\bhttps?:\/\/[^\s]+)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
    const parts = text.split(regex).filter(Boolean);

    return (
        <span className="break-words font-light text-[13px] leading-6">
            {parts.map((part, index) => {
                if (part.match(/^https?:\/\//)) {
                    return (
                        <a key={index} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                           className="text-emerald-400 font-bold hover:underline decoration-dotted truncate inline-block max-w-full align-bottom">
                            LINK TAUTAN ↗
                        </a>
                    );
                } else if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index} className="text-white font-black tracking-wide">{part.slice(2, -2)}</strong>;
                } else if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={index} className="text-emerald-200 not-italic bg-emerald-500/10 px-1 rounded">{part.slice(1, -1)}</em>;
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

    // Audio Refs (Musik Upbeat & Fun)
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
    const bgMusic = useRef(new Audio('https://cdn.pixabay.com/audio/2022/10/25/audio_27521713d2.mp3')); // Lofi/Chill Upbeat

    useEffect(() => {
        if (hasStarted) {
            fetchKreataPosts();
            bgMusic.current.loop = true;
            bgMusic.current.volume = 0.4;
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
                // Logika Foto: Prioritas mediaUrl, lalu mediaUrls[0]. Jika string kosong, anggap null.
                let finalImage = null;
                if (post.mediaUrl && post.mediaUrl.length > 5) finalImage = post.mediaUrl;
                else if (post.mediaUrls && post.mediaUrls.length > 0) finalImage = post.mediaUrls[0];

                return {
                    id: post.id || Math.random().toString(36),
                    title: post.title || "Kreata Post",
                    content: post.content || post.text || "",
                    author: post.user?.username || "Anonymous",
                    // Avatar logic: Simpan URL asli, nanti di handle onError di render
                    avatar: post.user?.photoURL || null,
                    image: finalImage,
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

    const handleShare = async (post) => {
        playClick();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Postingan ${post.author} di Kreata`,
                    text: post.content.substring(0, 50) + '...',
                    url: `https://app.bgunenet.my.id/?post=${post.id}`
                });
            } catch (error) {
                console.log('Error sharing:', error);
            }
        } else {
            // Fallback copy link
            navigator.clipboard.writeText(`https://app.bgunenet.my.id/?post=${post.id}`);
            alert('Link disalin ke clipboard!');
        }
    };

    // --- HALAMAN INTRO ---
    if (!hasStarted) {
        return (
            <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                {/* Background Animation */}
                <div className="absolute w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse"></div>
                
                <div className="relative z-10 animate-fade-in">
                    <div className="relative mb-8 inline-block cursor-pointer group" onClick={startRoom}>
                        <div className="absolute inset-0 bg-emerald-500 rounded-[35px] blur-xl opacity-40 group-hover:opacity-60 transition duration-500"></div>
                        <img src={KREATA_LOGO} className="relative w-36 h-36 rounded-[35px] border-4 border-[#020617] shadow-2xl object-cover transform group-hover:scale-105 transition duration-500" alt="Logo" />
                    </div>
                    
                    <h1 className="text-5xl font-black text-white italic mb-3 tracking-tighter drop-shadow-2xl">
                        KREATA <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">ROOM</span>
                    </h1>
                    <p className="text-slate-400 text-sm mb-12 font-medium tracking-widest uppercase">
                        Tempat Karya Berkumpul
                    </p>
                    
                    <button onClick={startRoom} className="relative group bg-white text-black pl-8 pr-10 py-4 rounded-full font-black uppercase text-sm tracking-[0.2em] transition-all hover:bg-emerald-400 hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.1)] flex items-center gap-3 mx-auto overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-full -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <Play size={20} fill="black" /> MASUK SEKARANG
                    </button>
                </div>
            </div>
        );
    }

    // --- HALAMAN UTAMA ---
    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/40 pb-32">
            
            {/* HEADER */}
            <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-[#020617]/90 backdrop-blur-md border-b border-white/5 px-4 flex items-center justify-between">
                <button onClick={() => { playClick(); setPage && setPage('home'); }} className="p-2 rounded-xl active:scale-95 transition-transform">
                    <ArrowLeft size={24} className="text-slate-100" />
                </button>
                <div className="flex flex-col items-center" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                    <span className="font-black italic text-xl text-white uppercase tracking-tighter">KREATA</span>
                </div>
                <button onClick={toggleMusic} className={`p-2 rounded-xl transition-all ${isMuted ? 'text-slate-500' : 'text-emerald-400'}`}>
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} className="animate-pulse" />}
                </button>
            </nav>

            <div className="max-w-md mx-auto px-4 pt-24 space-y-6">
                
                {/* INFO BANNER */}
                <div className="bg-gradient-to-r from-emerald-900/40 to-slate-900 rounded-[24px] p-5 border border-white/5 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <img src={KREATA_LOGO} className="w-12 h-12 rounded-xl shadow-lg" alt="Icon" />
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Official Feed</h2>
                            <p className="text-[10px] text-emerald-400 font-medium">Kreata Community adalah wadah kolaborasi yang menaungi komunitas Koloxe, Amethyst, dan McCreata untuk mengembangkan aktivitas komunitas secara berkelanjutan. Melalui kerja sama dengan BguneNet, Kreata Community mendapatkan ruang komunitas digital sebagai sarana pendukung aktivitas, sementara BguneNet memperoleh partisipasi komunitas yang aktif dalam ekosistemnya. Biar muncul Disini posting menggunakan hastag<span className="bg-emerald-500/20 px-1 rounded text-white">#kreata</span></p>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" rel="noreferrer" onClick={playClick}
                           className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-black py-2.5 rounded-lg font-bold text-[10px] uppercase shadow-lg active:scale-95 transition-transform">
                            <MessageCircle size={14} fill="black" /> Grup WA
                        </a>
                        <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" rel="noreferrer" onClick={playClick}
                           className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white py-2.5 rounded-lg font-bold text-[10px] uppercase border border-white/10 active:scale-95 transition-transform">
                            <Bell size={14} fill="white" /> Saluran
                        </a>
                    </div>
                </div>

                {/* FEED LIST */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 px-1">
                        <Sparkles size={14} className="text-emerald-500" />
                        <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Postingan Terbaru</h3>
                        {loading && <Loader2 className="animate-spin text-emerald-500 ml-auto" size={16} />}
                    </div>

                    {posts.length === 0 && !loading ? (
                        <div className="text-center py-16 bg-white/5 rounded-3xl border border-dashed border-white/10">
                            <p className="text-xs font-bold text-slate-600 uppercase">Belum ada karya baru</p>
                        </div>
                    ) : (
                        posts.map((post) => (
                            <div key={post.id} className="bg-[#0f111a] border border-white/5 rounded-[24px] overflow-hidden shadow-xl">
                                
                                {/* AUTHOR HEADER */}
                                <div className="p-4 flex items-center gap-3 border-b border-white/5 bg-[#131620]">
                                    <img 
                                        src={post.avatar || `https://ui-avatars.com/api/?name=${post.author}&background=random`} 
                                        onError={(e) => {
                                            // Fallback jika gambar error/broken
                                            e.target.onerror = null; 
                                            e.target.src = `https://ui-avatars.com/api/?name=${post.author}&background=10b981&color=fff&size=128`;
                                        }}
                                        className="w-9 h-9 rounded-full bg-slate-800 object-cover ring-2 ring-[#020617]" 
                                        alt="Avatar" 
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-bold text-white truncate">{post.author}</h4>
                                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Creator</p>
                                    </div>
                                    <button onClick={() => handleShare(post)} className="text-slate-500 hover:text-white p-2">
                                        <Share2 size={16} />
                                    </button>
                                </div>

                                {/* CONTENT BODY */}
                                <div className="p-0">
                                    {/* Jika ada gambar, tampilkan. Jika null/kosong, skip render div ini */}
                                    {post.image && (
                                        <div className="w-full bg-black relative border-b border-white/5">
                                            <img 
                                                src={post.image} 
                                                className="w-full h-auto max-h-[450px] object-contain mx-auto" 
                                                alt="Content" 
                                                loading="lazy" 
                                            />
                                        </div>
                                    )}

                                    {/* Text Area */}
                                    <div className="p-5">
                                        <div className="text-slate-300">
                                            <RichTextRenderer text={post.content} />
                                        </div>
                                    </div>
                                </div>

                                {/* ACTION BUTTONS (Share & Lihat) */}
                                <div className="p-3 pt-0 flex gap-2">
                                    <button 
                                        onClick={() => handleShare(post)}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Share2 size={14} /> Share
                                    </button>
                                    <button 
                                        onClick={() => handleViewDetail(post.id)}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-wide flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
                                    >
                                        <ExternalLink size={14} /> Buka
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Bottom Spacer */}
                <div className="pb-10 pt-4 flex justify-center opacity-20">
                     <div className="w-16 h-1 bg-slate-600 rounded-full"></div>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;