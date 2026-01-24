// FILE: KreataRoom.jsx
import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Users, Zap, MessageCircle, 
    ChevronDown, ChevronUp, Gamepad2, Trophy, 
    Sparkles, Rocket, Star, Heart
} from 'lucide-react';

const KREATA_IMG = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";
const WA_CHANNEL = "https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j";
const WA_GROUP = "https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss";

const KreataRoom = ({ setPage }) => {
    const [showFullInfo, setShowFullInfo] = useState(false);
    const [clicks, setClicks] = useState(0);
    const [isPulsing, setIsPulsing] = useState(false);

    // Efek sederhana untuk game clicker
    const handlePowerUp = () => {
        setClicks(prev => prev + 1);
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 200);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gray-900 pb-20 overflow-x-hidden relative">
            {/* ANIMASI BACKGROUND (Floating Stars) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
                {[...Array(10)].map((_, i) => (
                    <div 
                        key={i}
                        className="absolute animate-bounce"
                        style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            animationDuration: `${2 + Math.random() * 4}s`,
                            animationDelay: `${Math.random() * 2}s`
                        }}
                    >
                        <Star className="text-emerald-400" size={Math.random() * 20 + 10} />
                    </div>
                ))}
            </div>

            {/* HERO SECTION */}
            <div className="relative h-80 overflow-hidden">
                <button 
                    onClick={() => setPage('home')} 
                    className="absolute top-6 left-6 z-30 bg-black/40 backdrop-blur-md p-2.5 rounded-full text-white hover:scale-110 transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <img src={KREATA_IMG} className="w-full h-full object-cover scale-110" alt="Hero" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-gray-900 via-black/20" />
                
                <div className="absolute bottom-10 left-6 right-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg animate-pulse">
                            OFFICIAL PARTNER
                        </span>
                        <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/20">
                            v2.0 HUB
                        </span>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter italic">
                        KREATA <span className="text-emerald-500">ROOM</span>
                    </h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-5 -mt-6 relative z-10">
                
                {/* 1. COMMUNITY MAIN INFO */}
                <div className="bg-white dark:bg-gray-800 rounded-[32px] shadow-2xl border border-gray-100 dark:border-gray-700 p-8 mb-8 group hover:border-emerald-500/50 transition-all duration-500">
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-3 tracking-tight flex items-center justify-center md:justify-start gap-2">
                                <Users className="text-emerald-500" /> KREATA ECOSYSTEM
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                Sinergi tanpa batas antara <span className="text-emerald-500 font-bold">Koloxe, Amethyst, dan McCreata</span>. 
                                Di sini, kreativitas adalah mata uang utama.
                            </p>
                            
                            {showFullInfo && (
                                <div className="mt-4 p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-300">
                                    <p className="text-xs text-gray-500 leading-relaxed italic">
                                        Kreata Room berfungsi sebagai titik temu digital (Digital Hub) yang didukung penuh oleh infrastruktur BguneNet. 
                                        Setiap anggota memiliki akses ke fitur-fitur eksklusif kolaborasi.
                                    </p>
                                </div>
                            )}

                            <button 
                                onClick={() => setShowFullInfo(!showFullInfo)}
                                className="mt-4 inline-flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:text-emerald-400 transition"
                            >
                                {showFullInfo ? <><ChevronUp size={14}/> Less Info</> : <><ChevronDown size={14}/> More Info</>}
                            </button>
                        </div>

                        <div className="w-px h-20 bg-gray-100 dark:bg-gray-700 hidden md:block"></div>

                        <div className="flex flex-col gap-3 w-full md:w-64">
                            <a href={WA_CHANNEL} target="_blank" rel="noreferrer" className="group/btn relative overflow-hidden bg-emerald-600 text-white py-4 rounded-2xl text-center text-xs font-black uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    <Zap size={16} fill="white" /> Join Saluran
                                </div>
                            </a>
                            <a href={WA_GROUP} target="_blank" rel="noreferrer" className="border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 py-4 rounded-2xl text-center text-xs font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all">
                                Grup Komunitas
                            </a>
                        </div>
                    </div>
                </div>

                {/* 2. MINI GAME SECTION (INOVASI PENGGANTI) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    
                    {/* GAME: POWER CLICKER */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl">
                        <Rocket className="absolute -bottom-4 -right-4 text-white/10" size={120} />
                        <div className="relative z-10">
                            <h4 className="font-black text-xl mb-1 flex items-center gap-2 italic">
                                <Gamepad2 /> COMMUNITY POWER
                            </h4>
                            <p className="text-white/70 text-[10px] uppercase tracking-widest mb-6 font-bold">Tap to boost community energy!</p>
                            
                            <div className="flex flex-col items-center py-4">
                                <div className={`text-6xl font-black mb-4 ${isPulsing ? 'scale-125' : 'scale-100'} transition-transform duration-100`}>
                                    {clicks}
                                </div>
                                <button 
                                    onClick={handlePowerUp}
                                    className="bg-white text-indigo-600 px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition"
                                >
                                    BOOST POWER!
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* INTERACTIVE STATS */}
                    <div className="bg-white dark:bg-gray-800 rounded-[32px] p-8 border border-gray-100 dark:border-gray-700 shadow-xl">
                        <h4 className="font-black text-xl mb-6 flex items-center gap-2 dark:text-white italic tracking-tight">
                            <Trophy className="text-yellow-500" /> ACHIEVEMENT
                        </h4>
                        
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Innovation</span>
                                <div className="h-2 w-32 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-[90%]"></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Collaboration</span>
                                <div className="h-2 w-32 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 w-[85%]"></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Growth</span>
                                <div className="h-2 w-32 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 w-[70%]"></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                            <Sparkles className="text-emerald-500" size={18} />
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold leading-tight">
                                Karya kamu muncul otomatis di feed utama sebagai Partner Kolaborasi!
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. MANTRA KOMUNITAS */}
                <div className="text-center py-10">
                    <Heart className="mx-auto text-rose-500 animate-pulse mb-4" fill="currentColor" />
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white italic tracking-tighter">
                        "CREATING BEYOND LIMITS"
                    </h2>
                    <p className="text-gray-400 text-[10px] uppercase tracking-[0.3em] mt-2">Together as One Kreata Family</p>
                </div>
            </div>

            {/* FLOATING ACTION */}
            <div className="fixed bottom-6 right-6">
                <a 
                    href={WA_GROUP} 
                    className="w-14 h-14 bg-emerald-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition animate-bounce"
                >
                    <MessageCircle size={28} />
                </a>
            </div>
        </div>
    );
};

export default KreataRoom;