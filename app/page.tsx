"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import Link from 'next/link';

// ── Helpers ───────────────────────────────────────────────────────────────────
const VND_RATE = 26000;
function fmt$(n: number) { return `$${n.toLocaleString()}`; }
function fmtVnd(usd: number) {
  const v = usd * VND_RATE;
  return v >= 1_000_000 ? `≈${(v / 1_000_000).toFixed(1)}M ₫` : `≈${(v / 1000).toFixed(0)}k ₫`;
}

// ── Tour Card ─────────────────────────────────────────────────────────────────
function TourCard({ tour, lang, t }: { tour: any; lang: 'ru' | 'en'; t: any }) {
  const [imgIndex, setImgIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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

  // Цены в USD
  const priceBase    = tour.price   ? Number(tour.price)   : null;
  const price1       = tour.price_1 ? Number(tour.price_1) : null;
  const price2       = tour.price_2 ? Number(tour.price_2) : null;
  const displayPrice = price1 || priceBase;
  const hasDiscount  = !!price2 && !!priceBase && price2 < priceBase * 2;

  const tourName = lang === 'ru' ? tour.name_ru : (tour.name_en || tour.name_ru);
  const tourDesc = lang === 'ru' ? tour.desc_ru : (tour.desc_en || tour.desc_ru);

  return (
    <div className="card-in" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <Link href={`/tour/${tour.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>

        {/* ── ФОТО 10:7 (1000×700) ── */}
        <div
          className="relative w-full overflow-hidden bg-[#0c0f1c]"
          style={{ aspectRatio: '10/7' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {total > 0 ? (
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
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ opacity: 0.08, fontSize: 48 }}>🗺️</div>
          )}

          {/* Градиент снизу */}
          <div className="absolute bottom-0 inset-x-0 pointer-events-none"
            style={{ height: '45%', background: 'linear-gradient(to top, rgba(22,28,39,0.92) 0%, transparent 100%)' }} />

          {/* HOT */}
          {tour.hot && (
            <div className="absolute top-0 left-0 z-20" style={{ background: '#b91c1c', padding: '4px 10px' }}>
              <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#fff' }}>
                ХИТ СЕЗОНА
              </span>
            </div>
          )}

          {/* Длительность */}
          {tour.duration_h && (
            <div className="absolute bottom-3 left-4 z-10 flex items-baseline gap-1">
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                {tour.duration_h}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                ЧАС
              </span>
            </div>
          )}

          {/* Стрелки слайдера */}
          {total > 1 && (
            <>
              <button onClick={prev} className="absolute left-0 top-0 h-full w-12 z-10 flex items-center justify-start pl-2"
                style={{ opacity: imgIndex === 0 ? 0 : 1, transition: 'opacity .2s', background: 'linear-gradient(to right, rgba(0,0,0,0.3), transparent)' }}>
                <span style={{ color: '#fff', fontSize: 22, fontWeight: 300 }}>‹</span>
              </button>
              <button onClick={next} className="absolute right-0 top-0 h-full w-12 z-10 flex items-center justify-end pr-2"
                style={{ opacity: imgIndex === total - 1 ? 0 : 1, transition: 'opacity .2s', background: 'linear-gradient(to left, rgba(0,0,0,0.3), transparent)' }}>
                <span style={{ color: '#fff', fontSize: 22, fontWeight: 300 }}>›</span>
              </button>
              {/* Индикаторы — тонкие линии */}
              <div className="absolute bottom-3 right-4 flex gap-1 z-10">
                {images.map((_, idx) => (
                  <div key={idx} style={{ width: idx === imgIndex ? 16 : 6, height: 2, background: idx === imgIndex ? '#f59e0b' : 'rgba(255,255,255,0.4)', transition: 'all .3s' }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── ТЕКСТ ── */}
        <div style={{ padding: '14px 16px 16px', background: 'rgba(255,255,255,0.03)' }}>

          {/* Категория + DA NANG */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            {tour.category ? (
              <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245,158,11,0.65)' }}>
                {tour.category}
              </span>
            ) : <span />}
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)' }}>
              DA NANG
            </span>
          </div>

          {/* Название */}
          <h3 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, color: '#fff', marginBottom: tourDesc ? 8 : 14, letterSpacing: '-0.2px' }}>
            {tourName}
          </h3>

          {/* Описание — 2 строки */}
          {tourDesc && (
            <p className="line-clamp-2" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, marginBottom: 14, fontWeight: 400 }}>
              {tourDesc}
            </p>
          )}

          {/* Нижняя строка: цена + кнопка */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* Цена в USD + VND */}
            <div>
              <p style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>
                {t.totalPrice}
              </p>
              {displayPrice ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b', letterSpacing: '-0.5px', lineHeight: 1 }}>
                      {fmt$(displayPrice)}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>
                      {fmtVnd(displayPrice)}
                    </span>
                  </div>
                  {hasDiscount && (
                    <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, background: 'rgba(100,220,100,0.7)', borderRadius: '50%', flexShrink: 0 }} />
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(100,220,100,0.8)' }}>
                        За двоих {fmt$(price2!)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 18, fontWeight: 900, color: 'rgba(255,255,255,0.25)' }}>—</span>
              )}
            </div>

            {/* Кнопка */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                {t.book}
              </span>
              <span style={{ fontSize: 12, color: '#f59e0b' }}>→</span>
            </div>

          </div>
        </div>
      </Link>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [lang, setLang]                     = useState<'ru' | 'en'>('ru');
  const [tours, setTours]                   = useState<any[]>([]);
  const [filteredTours, setFilteredTours]   = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [ref, setRef]                       = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [heroLoaded, setHeroLoaded]         = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('userLang') as 'ru' | 'en';
    if (savedLang) setLang(savedLang);

    const savedCategory = sessionStorage.getItem('activeCategory');
    if (savedCategory) setActiveCategory(savedCategory);

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

    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor)     tg.setHeaderColor('#161c27');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#161c27');
    }

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

  useEffect(() => {
    sessionStorage.setItem('activeCategory', activeCategory);
    setFilteredTours(tours);
  }, [activeCategory, tours]);

  const toggleLang = () => {
    const newLang = lang === 'ru' ? 'en' : 'ru';
    setLang(newLang);
    localStorage.setItem('userLang', newLang);
  };

  const t = {
    ru: {
      subtitle:   'Дананг, Вьетнам',
      tagline:    'Однодневные приключения',
      totalPrice: 'Стоимость тура',
      noTours:    'В этой категории пока нет туров',
      rate:       '$1 = 26k ₫',
      book:       'Подробнее',
    },
    en: {
      subtitle:   'Da Nang, Vietnam',
      tagline:    'One-day adventures',
      totalPrice: 'Tour price',
      noTours:    'No tours in this category yet',
      rate:       '$1 = 26k ₫',
      book:       'Details',
    },
  };

  const HERO_IMG = 'https://iiklsmnkqgxltnqxmwtw.supabase.co/storage/v1/object/public/images/1773238568950-eaqktf.webp';

  return (
    <main style={{ fontFamily: "'DM Sans',sans-serif" }}
      className="bg-[#161c27] min-h-screen text-white flex flex-col overflow-x-hidden selection:bg-amber-500/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap');
        .bebas{ font-family:'Bebas Neue',sans-serif; }

        .hero-photo{
          position:absolute; inset:0; width:100%; height:100%;
          object-fit:cover; object-position:5% 55%;
          opacity:0; transform:scale(1.07);
          transition:opacity 1.5s ease, transform 2s ease;
        }
        .hero-photo.loaded{ opacity:1; transform:scale(1); }
        .hero-tone{
          position:absolute; inset:0;
          background:linear-gradient(160deg,rgba(160,40,0,0.2) 0%,rgba(220,120,0,0.08) 40%,rgba(13,17,23,0) 65%);
          mix-blend-mode:multiply; pointer-events:none;
        }
        .hero-fade{
          position:absolute; inset:0;
          background:linear-gradient(to bottom,rgba(22,28,39,0.1) 0%,rgba(22,28,39,0) 20%,rgba(22,28,39,0.55) 68%,rgba(22,28,39,1) 100%);
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
        style={{ background: 'linear-gradient(to bottom,rgba(22,28,39,0.97) 0%,rgba(22,28,39,0) 100%)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => setActiveCategory('All')} className="flex items-center gap-2 active:opacity-70 transition-opacity">
          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center text-base overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#92400e,#b91c1c)', boxShadow: '0 0 14px rgba(220,38,38,0.4)' }}>
            <span className="relative z-10">🐉</span>
            <span className="logo-shine" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="bebas text-[18px] tracking-[2.5px] text-white">
              DRAGON <span style={{ color: '#f59e0b' }}>TRIPS</span>
            </span>
            <span className="text-[7px] font-bold tracking-[0.28em] uppercase" style={{ color: 'rgba(245,158,11,0.65)' }}>Da Nang</span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 text-[9px] font-bold tracking-wider"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', color: '#f59e0b' }}>
            {t[lang].rate}
          </div>
          <button onClick={toggleLang}
            className="w-10 h-8 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)' }}>
            {lang === 'ru' ? 'EN' : 'RU'}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-14 pb-0 flex flex-col items-center">
        <div className="glow-breath pointer-events-none"
          style={{ position: 'absolute', top: 20, left: '50%', width: 280, height: 160, background: 'radial-gradient(ellipse,rgba(220,80,0,0.35) 0%,transparent 72%)', filter: 'blur(40px)', borderRadius: '50%' }} />

        <div className="absolute top-0 inset-x-0 overflow-hidden" style={{ height: 340 }}>
          <img src={HERO_IMG} className={`hero-photo ${heroLoaded ? 'loaded' : ''}`}
            alt="Da Nang adventures" onLoad={() => setHeroLoaded(true)} />
          <div className="hero-tone" />
          <div className="hero-fade" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-4 pb-5" style={{ paddingTop: 100, minHeight: 290 }}>
          <div className="fire-sweep h-[2px] w-14 mb-4" />
          <h1 className="bebas leading-none tracking-[3px] mb-2" style={{ fontSize: 46, textShadow: '0 2px 28px rgba(0,0,0,0.85)' }}>
            DRAGON <span style={{ color: '#f59e0b' }}>TRIPS</span>
          </h1>
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase mb-0.5"
            style={{ color: 'rgba(245,158,11,0.92)', textShadow: '0 1px 10px rgba(0,0,0,0.9)' }}>
            {t[lang].subtitle}
          </p>
          <p className="text-[9px] tracking-[0.2em] uppercase"
            style={{ color: 'rgba(255,255,255,0.45)', textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
            {t[lang].tagline}
          </p>
        </div>

        <div className="w-full h-px" style={{ background: 'linear-gradient(to right,transparent,rgba(245,158,11,0.15),transparent)' }} />
      </section>

      {/* ── TOURS LIST ── */}
      <section className="pt-4 pb-24 w-full max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(245,158,11,0.3)', borderTopColor: '#f59e0b' }} />
          </div>
        ) : filteredTours.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <span className="text-4xl" style={{ opacity: 0.2 }}>🗺️</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {t[lang].noTours}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredTours.map((tour, i) => (
              <div key={tour.id} style={{ animationDelay: `${i * 60}ms` }}>
                <TourCard tour={tour} lang={lang} t={t[lang]} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer className="w-full py-8 text-center border-t mt-auto" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <p className="text-[9px] font-bold uppercase tracking-[0.4em]" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Dragon Trips · Da Nang · 2026
        </p>
      </footer>
    </main>
  );
}