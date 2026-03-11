"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import Link from 'next/link';

// ── Tour Card ─────────────────────────────────────────────────────────────────
function TourCard({ tour, lang, t }: { tour: any; lang: 'ru' | 'en'; t: any }) {
  const [imgIndex, setImgIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Нормализуем gallery — Supabase может вернуть null, строку или массив
  const rawGallery = tour.gallery;
  const galleryArr: string[] = Array.isArray(rawGallery)
    ? rawGallery
    : (typeof rawGallery === 'string' && rawGallery.startsWith('{'))
      ? rawGallery.replace(/[{}"]/g, '').split(',').map((s: string) => s.trim())
      : [];

  const images: string[] = [
    ...(tour.image_main ? [tour.image_main] : []),
    ...galleryArr,
  ].filter(Boolean);

  const total = images.length;

  const prev = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setImgIndex(i => (i - 1 + total) % total);
  }, [total]);

  const next = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setImgIndex(i => (i + 1) % total);
  }, [total]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      if (dx < 0) setImgIndex(i => (i + 1) % total);
      else        setImgIndex(i => (i - 1 + total) % total);
      e.stopPropagation();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Единственное поле цены
  const priceNum = tour.price ? Number(tour.price) : null;
  const tourName = lang === 'ru' ? tour.name_ru : (tour.name_en || tour.name_ru);

  return (
    <div
      className="card-in group flex flex-col rounded-2xl overflow-hidden active:scale-[0.98] transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 30px -15px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── IMAGE / GALLERY ── */}
      <div
        className="relative w-full overflow-hidden bg-[#0c0f1c]"
        style={{ aspectRatio: '1/1' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {total > 0 ? (
          <>
            {/* Слайдер: каждый слайд абсолютно позиционирован, переключаем opacity */}
            <div className="relative w-full h-full">
              {images.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                  style={{ opacity: idx === imgIndex ? 1 : 0 }}
                  alt={`${tourName} ${idx + 1}`}
                  draggable={false}
                />
              ))}
            </div>

            {total > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center z-10"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', opacity: imgIndex === 0 ? 0 : 1, transition: 'opacity .2s', fontSize: 18, lineHeight: 1 }}
                >‹</button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center z-10"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', opacity: imgIndex === total - 1 ? 0 : 1, transition: 'opacity .2s', fontSize: 18, lineHeight: 1 }}
                >›</button>

                {/* Dot indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                  {images.map((_, idx) => (
                    <div key={idx} className="rounded-full transition-all duration-300"
                      style={{ width: idx === imgIndex ? 12 : 4, height: 4, background: idx === imgIndex ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl" style={{ opacity: 0.12 }}>🗺️</div>
        )}

        {/* HOT badge */}
        {tour.hot && (
          <div className="absolute top-3 left-3 z-20">
            <span className="px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-tight"
              style={{ background: 'linear-gradient(135deg,#92400e,#b91c1c)', color: '#fff', boxShadow: '0 0 14px rgba(185,28,28,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
              🔥 {t.hot}
            </span>
          </div>
        )}

        {/* Bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-1/3 pointer-events-none"
          style={{ background: 'linear-gradient(to top,rgba(6,8,16,0.85),transparent)' }} />

        {/* Duration chip */}
        {tour.duration_h && (
          <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg text-[8px] font-bold z-10"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            ⏱ {tour.duration_h}ч
          </span>
        )}
      </div>

      {/* ── BODY ── */}
      <Link href={`/tour/${tour.id}`} className="p-4 flex flex-col flex-1">
        {/* Category */}
        {tour.category && (
          <p className="text-[8px] font-black uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(245,158,11,0.75)' }}>
            {tour.category}
          </p>
        )}

        {/* Name */}
        <h3 className="text-[14px] font-bold leading-[1.25] mb-3 line-clamp-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {tourName}
        </h3>

        {/* Price + arrow */}
        <div className="mt-auto pt-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[7px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {t.totalPrice}
            </span>
            <span className="text-[15px] font-black tracking-tight" style={{ color: '#f59e0b' }}>
              {priceNum ? `${priceNum.toLocaleString()} ₫` : '—'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <span style={{ color: '#f59e0b', fontSize: 14 }}>→</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [lang, setLang]                   = useState<'ru' | 'en'>('ru');
  const [tours, setTours]                 = useState<any[]>([]);
  const [filteredTours, setFilteredTours] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [ref, setRef]                     = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [heroLoaded, setHeroLoaded]       = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('userLang') as 'ru' | 'en';
    if (savedLang) setLang(savedLang);

    const savedCategory = sessionStorage.getItem('activeCategory');
    if (savedCategory) setActiveCategory(savedCategory);

    // ── Telegram ref / referral (оригинальный) ────────────────────────────
    const initRefLogic = () => {
      const tg = (window as any).Telegram?.WebApp;
      const urlParams = new URLSearchParams(window.location.search);
      const refFromUrl = urlParams.get('tgWebAppStartParam');
      const refFromTgUnsafe = tg?.initDataUnsafe?.start_param;
      let refFromRaw = null;
      if (tg?.initData) {
        try {
          const rawParams = new URLSearchParams(tg.initData);
          const startParam = rawParams.get('start_param');
          if (startParam) refFromRaw = startParam;
        } catch (e) { console.error(e); }
      }
      const savedRef = localStorage.getItem('referrer');
      const activeRef = refFromUrl || refFromTgUnsafe || refFromRaw;
      if (activeRef) { setRef(activeRef); localStorage.setItem('referrer', activeRef); return true; }
      else if (savedRef) { setRef(savedRef); return true; }
      return false;
    };
    initRefLogic();
    const interval = setInterval(() => { if (initRefLogic()) clearInterval(interval); }, 500);
    setTimeout(() => clearInterval(interval), 3000);

    // ── Telegram WebApp init ──────────────────────────────────────────────
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor)     tg.setHeaderColor('#060810');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#060810');
    }

    // ── Load tours (только активные, поле is_active = true) ───────────────
    async function loadTours() {
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (!error && data) setTours(data);
      setLoading(false);
    }
    loadTours();

    setTimeout(() => setHeroLoaded(true), 100);
    return () => clearInterval(interval);
  }, []);

  // ── Filter by category ────────────────────────────────────────────────────
  useEffect(() => {
    sessionStorage.setItem('activeCategory', activeCategory);
    if (activeCategory === 'All') setFilteredTours(tours);
    else setFilteredTours(tours.filter(t => t.category === activeCategory));
  }, [activeCategory, tours]);

  const toggleLang = () => {
    const newLang = lang === 'ru' ? 'en' : 'ru';
    setLang(newLang);
    localStorage.setItem('userLang', newLang);
  };

  // ── Категории — добавляй по мере надобности ───────────────────────────────
  const categories = [
    { id: 'All',   icon: '✦',  ru: 'Все туры',  en: 'All'       },
    { id: 'Море',  icon: '🌊', ru: 'Море',       en: 'Sea'       },
    { id: 'Горы',  icon: '⛰️', ru: 'Горы',       en: 'Mountains' },
    { id: 'Город', icon: '🏯', ru: 'Город',      en: 'City'      },
    // { id: 'Природа', icon: '🌿', ru: 'Природа', en: 'Nature' },
    // { id: 'Дайвинг', icon: '🤿', ru: 'Дайвинг', en: 'Diving' },
  ];

  const t = {
    ru: {
      subtitle:   'Дананг, Вьетнам',
      tagline:    'Однодневные приключения',
      totalPrice: 'Стоимость тура',
      noTours:    'В этой категории пока нет туров',
      hot:        'ХИТ',
      rate:       '1$ ≈ 26k ₫',
    },
    en: {
      subtitle:   'Da Nang, Vietnam',
      tagline:    'One-day adventures',
      totalPrice: 'Tour price',
      noTours:    'No tours in this category yet',
      hot:        'TOP',
      rate:       '1$ ≈ 26k ₫',
    },
  };

  const HERO_IMG = 'https://iiklsmnkqgxltnqxmwtw.supabase.co/storage/v1/object/public/images/1773238568950-eaqktf.webp';

  return (
    <main style={{ fontFamily: "'DM Sans',sans-serif" }}
      className="bg-[#060810] min-h-screen text-white flex flex-col overflow-x-hidden selection:bg-amber-500/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap');
        .bebas{ font-family:'Bebas Neue',sans-serif; }

        .hero-photo{
          position:absolute; inset:0; width:100%; height:100%;
          object-fit:cover; object-position:center 85%;
          opacity:0; transform:scale(1.07);
          transition:opacity 1.5s ease, transform 2s ease;
        }
        .hero-photo.loaded{ opacity:1; transform:scale(1); }
        .hero-tone{
          position:absolute; inset:0;
          background:linear-gradient(160deg,rgba(160,40,0,0.45) 0%,rgba(220,120,0,0.18) 40%,rgba(6,8,16,0) 65%);
          mix-blend-mode:multiply; pointer-events:none;
        }
        .hero-fade{
          position:absolute; inset:0;
          background:linear-gradient(to bottom,rgba(6,8,16,0.45) 0%,rgba(6,8,16,0) 30%,rgba(6,8,16,0.75) 72%,rgba(6,8,16,1) 100%);
          pointer-events:none;
        }
        .hero-sides{
          position:absolute; inset:0;
          background:linear-gradient(to right,rgba(6,8,16,0.55) 0%,transparent 30%,transparent 70%,rgba(6,8,16,0.55) 100%);
          pointer-events:none;
        }

        @keyframes fireSweep{ 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        .fire-sweep{
          background:linear-gradient(90deg,#f59e0b,#ef4444,#f59e0b,#ef4444);
          background-size:200% 100%; animation:fireSweep 3s linear infinite;
        }
        @keyframes glowBreath{
          0%,100%{ opacity:0.4; transform:translateX(-50%) scale(1); }
          50%    { opacity:0.8; transform:translateX(-50%) scale(1.08); }
        }
        .glow-breath{ animation:glowBreath 5s ease-in-out infinite; }

        @keyframes fadeUp{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .card-in{ animation:fadeUp 0.45s ease forwards; opacity:0; }

        .pill-on{
          background:linear-gradient(135deg,#92400e,#b91c1c) !important;
          border-color:rgba(245,158,11,0.3) !important;
          color:#fff !important;
          box-shadow:0 4px 20px rgba(220,38,38,0.25);
        }

        @keyframes shine{ 0%{left:-80%} 55%,100%{left:130%} }
        .logo-shine{
          position:absolute; top:0; left:-80%; width:55%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent);
          transform:skewX(-18deg); animation:shine 4s ease-in-out infinite;
        }

        .no-scrollbar::-webkit-scrollbar{ display:none; }
        .no-scrollbar{ scrollbar-width:none; }
        .line-clamp-2{
          display:-webkit-box; -webkit-line-clamp:2;
          -webkit-box-orient:vertical; overflow:hidden;
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-[100] flex items-center justify-between px-4 h-14"
        style={{ background:'linear-gradient(to bottom,rgba(6,8,16,0.97) 0%,rgba(6,8,16,0) 100%)', backdropFilter:'blur(10px)' }}>
        <button onClick={() => setActiveCategory('All')} className="flex items-center gap-2 active:opacity-70 transition-opacity">
          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center text-base overflow-hidden"
            style={{ background:'linear-gradient(135deg,#92400e,#b91c1c)', boxShadow:'0 0 14px rgba(220,38,38,0.4)' }}>
            <span className="relative z-10">🐉</span>
            <span className="logo-shine" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="bebas text-[18px] tracking-[2.5px] text-white">
              DRAGON <span style={{ color:'#f59e0b' }}>TRIPS</span>
            </span>
            <span className="text-[7px] font-bold tracking-[0.28em] uppercase" style={{ color:'rgba(245,158,11,0.65)' }}>Da Nang</span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider"
            style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', color:'#f59e0b' }}>
            {t[lang].rate}
          </div>
          <button onClick={toggleLang}
            className="w-10 h-8 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 flex items-center justify-center"
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.65)' }}>
            {lang === 'ru' ? 'EN' : 'RU'}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-14 pb-0 flex flex-col items-center">
        <div className="glow-breath pointer-events-none"
          style={{ position:'absolute', top:20, left:'50%', width:280, height:160, background:'radial-gradient(ellipse,rgba(220,80,0,0.35) 0%,transparent 72%)', filter:'blur(40px)', borderRadius:'50%' }} />

        <div className="absolute top-0 inset-x-0 overflow-hidden" style={{ height:340 }}>
          <img src={HERO_IMG} className={`hero-photo ${heroLoaded ? 'loaded' : ''}`}
            alt="Da Nang adventures" onLoad={() => setHeroLoaded(true)} />
          <div className="hero-tone" />
          <div className="hero-sides" />
          <div className="hero-fade" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-4 pb-5" style={{ paddingTop:100, minHeight:290 }}>
          <div className="fire-sweep h-[2px] w-14 rounded-full mb-4" />
          <h1 className="bebas leading-none tracking-[3px] mb-2" style={{ fontSize:46, textShadow:'0 2px 28px rgba(0,0,0,0.85)' }}>
            DRAGON <span style={{ color:'#f59e0b' }}>TRIPS</span>
          </h1>
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase mb-0.5"
            style={{ color:'rgba(245,158,11,0.92)', textShadow:'0 1px 10px rgba(0,0,0,0.9)' }}>
            {t[lang].subtitle}
          </p>
          <p className="text-[9px] tracking-[0.2em] uppercase"
            style={{ color:'rgba(255,255,255,0.45)', textShadow:'0 1px 8px rgba(0,0,0,0.9)' }}>
            {t[lang].tagline}
          </p>
        </div>

        {/* ── CATEGORIES ── */}
        <div className="relative z-10 w-full px-3 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all active:scale-95 border ${activeCategory === cat.id ? 'pill-on' : ''}`}
                style={activeCategory !== cat.id ? { background:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.45)' } : {}}>
                <span className="text-[13px] leading-none">{cat.icon}</span>
                {lang === 'ru' ? cat.ru : cat.en}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-px" style={{ background:'linear-gradient(to right,transparent,rgba(245,158,11,0.15),transparent)' }} />
      </section>

      {/* ── TOURS GRID ── */}
      <section className="px-3 pt-6 pb-24 w-full max-w-4xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor:'rgba(245,158,11,0.3)', borderTopColor:'#f59e0b' }} />
          </div>
        ) : filteredTours.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <span className="text-4xl" style={{ opacity:0.2 }}>🗺️</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color:'rgba(255,255,255,0.25)' }}>
              {t[lang].noTours}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTours.map((tour, i) => (
              <div key={tour.id} style={{ animationDelay:`${i * 50}ms` }}>
                <TourCard tour={tour} lang={lang} t={t[lang]} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer className="w-full py-8 text-center border-t mt-auto" style={{ borderColor:'rgba(255,255,255,0.04)' }}>
        <p className="text-[9px] font-bold uppercase tracking-[0.4em]" style={{ color:'rgba(255,255,255,0.15)' }}>
          Dragon Trips · Da Nang · 2026
        </p>
      </footer>
    </main>
  );
}