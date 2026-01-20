// File: KreataRoom.jsx
import React from 'react';
import { ArrowLeft, Gamepad2, Users, Star, MessageCircle, Play } from 'lucide-react';

// Kamu bisa import fungsi format angka atau utility lain jika perlu
// import { formatNumber } from './utils'; // (Opsional jika punya file utils)

const KreataRoom = ({ user, setPage, isGuest }) => {
    
    // Data Dummy untuk konten Kreata (Nanti bisa diganti data dari Firebase)
    const featuredRooms = [
        { id: 1, title: "Mabar Mobile Legends", host: "Ryzen", viewers: 120, tag: "Game" },
        { id: 2, title: "Diskusi Coding React", host: "DevMaster", viewers: 85, tag: "Tech" },
        { id: 3, title: "Nobar Film Horor", host: "MovieManiac", viewers: 210, tag: "Movie" },
    ];

    return (
        <div className="min-h-screen bg-[#F0F4F8] dark:bg-gray-900 pb-24 pt-20">
            
            {/* Header Khusus Kreata */}
            <div className="fixed top-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md h-16 flex items-center px-4 z-40 border-b border-gray-100 dark:border-gray-800 shadow-sm">
                <button 
                    onClick={() => setPage('home')} 
                    className="p-2 mr-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
                >
                    <ArrowLeft size={20} className="text-gray-700 dark:text-white"/>
                </button>
                <div className="flex items-center gap-2">
                    <Gamepad2 className="text-emerald-500" size={24} />
                    <h1 className="text-xl font-black text-gray-800 dark:text-white tracking-tight">
                        Kreata <span className="text-emerald-500">Room</span>
                    </h1>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-2xl mx-auto px-4">
                
                {/* Banner Welcome */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg shadow-emerald-500/20 mb-6 relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-black mb-2">Selamat Datang di Kreata!</h2>
                        <p className="text-emerald-100 text-sm max-w-xs mb-4">
                            Ruang interaksi real-time, mabar game, dan diskusi komunitas eksklusif.
                        </p>
                        <button className="bg-white text-emerald-600 px-4 py-2 rounded-xl font-bold text-xs shadow-md hover:bg-gray-100 transition">
                            Buat Room Baru
                        </button>
                    </div>
                    {/* Hiasan Background */}
                    <Gamepad2 size={120} className="absolute -right-6 -bottom-6 text-white opacity-20 rotate-12"/>
                </div>

                {/* Categories */}
                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar mb-2">
                    {['Semua', 'Gaming', 'Musik', 'Curhat', 'Horor'].map((cat, i) => (
                        <button key={i} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${i === 0 ? 'bg-emerald-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}>
                            {cat}
                        </button>
                    ))}
                </div>

                {/* List Rooms */}
                <div className="space-y-4">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Star size={18} className="text-yellow-500 fill-yellow-500"/> Sedang Live
                    </h3>
                    
                    {featuredRooms.map((room) => (
                        <div key={room.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-emerald-500 transition cursor-pointer group">
                            <div className="flex justify-between items-start mb-2">
                                <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{room.tag}</span>
                            </div>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1 group-hover:text-emerald-500 transition">
                                {room.title}
                            </h3>
                            <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                                    <span className="text-xs font-medium text-gray-500">{room.host}</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-400">
                                    <span className="flex items-center gap-1 text-xs"><Users size={14}/> {room.viewers}</span>
                                    <button className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 p-1.5 rounded-full">
                                        <Play size={14} fill="currentColor"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Placeholder jika belum ada fitur */}
                <div className="mt-8 text-center p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl">
                    <MessageCircle size={32} className="mx-auto text-gray-300 mb-2"/>
                    <p className="text-gray-400 text-sm font-bold">Fitur lengkap segera hadir!</p>
                </div>

            </div>
        </div>
    );
};

export default KreataRoom;