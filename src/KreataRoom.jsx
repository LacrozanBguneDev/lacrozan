import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, MessageCircle, Sparkles, Check, 
    Volume2, VolumeX, Bell, ExternalLink, 
    Heart, MessageSquare, Loader2, Play, Eye
} from 'lucide-react';

const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

const KreataRoom = ({ setPage, user }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    // Audio Refs
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
    const bgMusic = useRef(new Audio('https://www.bensound.com/bensound-music/bensound-evolution.mp3'));

    useEffect(() => {
        if (hasStarted) {
            fetchKreataPosts();
        }
        bgMusic.current.loop = true;
        bgMusic.current.volume = 0.2;

        return () => {
            bgMusic.current.pause();
        };
    }, [hasStarted]);

    const fetchKreataPosts = async () => {
        try {
            setLoading(true);
            // Menggunakan %23 untuk mewakili # di URL API
            const res = await fetch('https://app.bgunenet.my.id/api/feed?mode=search&q=%23kreata&limit=20');
            const data = await res.json();
            
            // Perbaikan Mapping: Memastikan content muncul meskipun nama field di API berbeda-beda
            const sanitizedPosts = (data.posts || []).map(post => ({
                ...post,
                displayContent: post.text || post.caption || post.content || "Karya Kreatif #Kreata",
                author: post.authorName || post.userName || "Creator",
                avatar: post.authorAvatar || post.userAvatar || `https://ui-avatars.com/api/?name=${post.authorName || 'C'}`
            }));

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
        bgMusic.current.play().catch(() => {});
    };

    // Fungsi Navigasi ke Postingan Asli (Menggunakan Link Share)
    const handleViewDetail = (postId) => {
        playClick();
        // Mengarahkan ke halaman dengan parameter ?post=ID sesuai keinginanmu
        window.location.href = `/?post=${postId}`;
    };

    if (!hasStarted) {
        return (
            <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse"></div>
                    <img src={KREATA_LOGO} className="w-32 h-32 rounded-[40px] relative z-10 border-2 border-emerald-500/50 shadow-2xl" alt="Logo" />
                </div>
                <h1 className="text-4xl font-black text-white italic mb-2 uppercase tracking-tighter">KREATA <span className="text-emerald-500">ROOM</span></h1>
                <p className="text-slate-400 text-sm mb-10 max-w-xs font-medium leading-relaxed">Masuki ekosistem kreatif untuk para editor masa depan.</p>
                <button 
                    onClick={startRoom}
                    className="group relative flex items-center gap-4 bg-emerald-500 text-black px-12 py-5 rounded-full font-black uppercase text-sm tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                >
                    <Play size={20} fill="black" /> Masuk Room
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pb-24 font-sans selection:bg-emerald-500/30">

            {/* STICKY HEADER */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/90 backdrop-blur-xl border-b border-white/5 px-6 h-20 flex items-center justify-between">
                <button onClick={() => { playClick(); setPage('home'); }} className="p-3 bg-white/5 hover:bg-emerald-500 hover:text-black rounded-2xl transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-emerald-400 tracking-[0.4em] uppercase leading-none mb-1">Official</span>
                    <span className="font-black italic text-xl uppercase leading-none tracking-tighter tracking-widest">KREATA</span>
                </div>
                <button onClick={toggleMusic} className="p-3 bg-white/5 rounded-2xl transition-all text-emerald-400">
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} className="animate-pulse" />}
                </button>
            </nav>

            <div className="max-w-xl mx-auto px-4 pt-28 space-y-6">

                {/* HERO CARD */}
                <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600/30 to-blue-600/10 rounded-[45px] border border-white/10 p-8 shadow-2xl">
                    <Sparkles className="absolute -top-4 -right-4 text-emerald-500/10" size={120} />
                    
                    <div className="flex items-center gap-5 mb-8">
                        <img src={KREATA_LOGO} className="w-20 h-20 rounded-[30px] border-2 border-emerald-500 shadow-lg object-cover" alt="Logo" />
                        <div>
                            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">The Ecosystem</h2>
                            <p className="text-[10px] text-emerald-400/80 font-black uppercase tracking-[0.2em] mt-1 text-emerald-400">Official BguneNet Partner</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed font-medium mb-8">
                        Gunakan perlindungan sistem BguneNet untuk berkarya tanpa batas. Gabung komunitas sekarang untuk update aset terbaru.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" rel="noreferrer" onClick={playClick}
                           className="flex items-center justify-center gap-2 bg-[#25D366] text-black py-4 rounded-[24px] font-black text-xs uppercase tracking-tighter hover:scale-105 transition-transform">
                            <MessageCircle size={18} fill="black" /> Group WA
                        </a>
                        <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" rel="noreferrer" onClick={playClick}
                           className="flex items-center justify-center gap-2 bg-white text-black py-4 rounded-[24px] font-black text-xs uppercase tracking-tighter hover:scale-105 transition-transform">
                            <Bell size={18} fill="black" /> Saluran
                        </a>
                    </div>
                </section>

                {/* INFO HASTAG */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[30px] p-6 flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-500 text-black rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                        <Check size={28} strokeWidth={3} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase italic text-emerald-400 leading-none mb-1">Ingin tampil di sini?</h4>
                        <p className="text-[11px] text-slate-400 font-medium">Post dengan hashtag <span className="text-white font-bold bg-emerald-500/20 px-1 rounded">#kreata</span> agar otomatis masuk ke highlight.</p>
                    </div>
                </div>

                {/* FEED KOMUNITAS */}
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="font-black italic uppercase text-sm tracking-widest text-emerald-500">Highlight Feed</h3>
                        {loading && <Loader2 className="animate-spin text-emerald-500" size={20} />}
                    </div>

                    {posts.length === 0 && !loading ? (
                        <div className="bg-white/5 rounded-[40px] py-20 text-center border border-white/5 opacity-50">
                            <p className="text-sm italic font-bold uppercase tracking-widest">Belum ada karya ditemukan</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {posts.map((post) => (
                                <div key={post.id} className="bg-slate-900/40 border border-white/5 rounded-[40px] overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
                                    
                                    {/* Post Header */}
                                    <div className="p-5 flex items-center gap-3">
                                        <img src={post.avatar} className="w-10 h-10 rounded-full border border-emerald-500/30 p-0.5" alt="Avatar" />
                                        <div>
                                            <h4 className="text-xs font-black uppercase italic text-white">{post.author}</h4>
                                            <span className="text-[9px] text-emerald-500/60 uppercase font-black tracking-widest">Creator Verified</span>
                                        </div>
                                    </div>

                                    {/* Post Image */}
                                    {post.image && (
                                        <div className="px-5">
                                            <img 
                                                src={post.image} 
                                                className="w-full aspect-square object-cover rounded-[30px] border border-white/5 shadow-inner" 
                                                alt="Karya" 
                                            />
                                        </div>
                                    )}

                                    <div className="p-6">
                                        <p className="text-xs text-slate-300 leading-relaxed mb-6 font-medium line-clamp-3">
                                            {post.displayContent}
                                        </p>

                                        {/* Action: Redirect to Detail Page */}
                                        <div className="flex items-center justify-between bg-white/5 p-2 rounded-[24px]">
                                            <div className="flex gap-4 ml-3">
                                                <div className="flex items-center gap-1.5 text-rose-500">
                                                    <Heart size={16} fill="currentColor" />
                                                    <span className="text-[10px] font-black">{post.likeCount || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-blue-400">
                                                    <MessageSquare size={16} fill="currentColor" />
                                                    <span className="text-[10px] font-black">{post.commentCount || 0}</span>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => handleViewDetail(post.id)}
                                                className="flex items-center gap-2 bg-emerald-500 text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all shadow-lg"
                                            >
                                                <Eye size={14} strokeWidth={3} /> Detail Post
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="py-20 text-center opacity-20">
                    <div className="w-10 h-1 bg-emerald-500 mx-auto mb-6 rounded-full" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">BguneNet • Kreata • 2026</p>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;