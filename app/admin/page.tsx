"use client";
import { useState, useRef } from 'react';
import { supabase } from '../supabase';

interface Tour {
  id?: number;
  name_ru: string;
  name_en: string;
  desc_ru: string;
  desc_en: string;
  route_ru: string;
  route_en: string;
  category: string;
  image_main: string;
  gallery: string[];
  price: string | number;      // базовая цена USD (за 1 чел или группа)
  price_1: string | number;    // цена за 1 чел USD (если отличается)
  price_2: string | number;    // цена за 2 чел USD (со скидкой)
  duration_h: string | number;
  hot: boolean;
  sort_order: number;
  is_active: boolean;
  available_dates: string[];
}

const EMPTY: Tour = {
  name_ru: '', name_en: '',
  desc_ru: '', desc_en: '',
  route_ru: '', route_en: '',
  category: '', image_main: '',
  gallery: [],
  price: '', price_1: '', price_2: '',
  duration_h: '',
  hot: false, sort_order: 0, is_active: true,
  available_dates: [],
};

const CATEGORIES = ['Море', 'Горы', 'Город', 'Природа', 'Дайвинг', 'Еда', 'Культура'];
const ADMIN_PIN  = '2626';
const VND_RATE   = 26000;

function usdToVnd(usd: string | number): string {
  const n = Number(usd);
  if (!n) return '';
  return (n * VND_RATE).toLocaleString('ru-RU');
}

// ── Inline Calendar ────────────────────────────────────────────────────────────
function DatePicker({ selected, onChange }: { selected: string[]; onChange: (d: string[]) => void }) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const toggle = (dateStr: string) => {
    if (selected.includes(dateStr)) onChange(selected.filter(d => d !== dateStr));
    else onChange([...selected, dateStr].sort());
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };

  return (
    <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', padding:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <button onClick={prevMonth} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:20, padding:'0 6px' }}>‹</button>
        <span style={{ fontSize:12, fontWeight:900, letterSpacing:'0.15em', textTransform:'uppercase', color:'#f59e0b' }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:20, padding:'0 6px' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:6 }}>
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:8, fontWeight:900, color:'rgba(255,255,255,0.2)', letterSpacing:'0.1em', padding:'2px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const dateStr    = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isSel      = selected.includes(dateStr);
          const isPast     = new Date(dateStr) < new Date(today.toDateString());
          return (
            <button key={idx} onClick={() => !isPast && toggle(dateStr)}
              style={{ padding:'6px 0', border: isSel ? '1px solid #f59e0b' : '1px solid transparent', background: isSel ? 'rgba(245,158,11,0.18)' : 'transparent', color: isPast ? 'rgba(255,255,255,0.12)' : isSel ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize:11, fontWeight: isSel ? 900 : 400, cursor: isPast ? 'not-allowed' : 'pointer', textAlign:'center', transition:'all .12s' }}>
              {day}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:10, color:'#f59e0b', fontWeight:700 }}>
            Выбрано: {selected.length}
          </span>
          <button onClick={() => onChange([])} style={{ fontSize:9, color:'rgba(240,80,80,0.7)', background:'none', border:'none', cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700 }}>
            Очистить
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminTours() {
  const [authed, setAuthed]     = useState(false);
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState(false);

  const [tours, setTours]       = useState<Tour[]>([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [form, setForm]         = useState<Tour>(EMPTY);
  const [editId, setEditId]     = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [activeTab, setActiveTab] = useState<'ru'|'en'>('ru');

  const [galleryInput, setGalleryInput] = useState('');
  const [uploading, setUploading]       = useState(false);
  const mainImgRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const checkPin = () => {
    if (pin === ADMIN_PIN) { setAuthed(true); loadTours(); }
    else { setPinError(true); setTimeout(() => setPinError(false), 1200); }
  };

  const loadTours = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tours').select('*').order('sort_order', { ascending: true });
    if (error) showToast('Ошибка: ' + error.message, 'err');
    else setTours(data || []);
    setLoading(false);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext  = file.name.split('.').pop();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('images').upload(name, file, { upsert: true });
    if (error) { showToast('Ошибка загрузки: ' + error.message, 'err'); return null; }
    return supabase.storage.from('images').getPublicUrl(name).data.publicUrl;
  };

  const handleMainImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) setForm(f => ({ ...f, image_main: url }));
    setUploading(false);
  };

  const handleGalleryImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    for (const file of files) { const u = await uploadImage(file); if (u) setForm(f => ({ ...f, gallery: [...f.gallery, u] })); }
    setUploading(false);
  };

  const addGalleryUrl = () => {
    const url = galleryInput.trim(); if (!url) return;
    setForm(f => ({ ...f, gallery: [...f.gallery, url] }));
    setGalleryInput('');
  };

  const handleSave = async () => {
    if (!form.name_ru || !form.name_en) { showToast('Заполни названия RU и EN', 'err'); return; }
    setSaving(true);

    const payload: any = {
      ...form,
      gallery:         Array.isArray(form.gallery) ? form.gallery.filter(Boolean) : [],
      available_dates: Array.isArray(form.available_dates) ? form.available_dates.filter(Boolean).sort() : [],
      price:           form.price      ? Number(form.price)      : null,
      price_1:         form.price_1    ? Number(form.price_1)    : null,
      price_2:         form.price_2    ? Number(form.price_2)    : null,
      duration_h:      form.duration_h ? Number(form.duration_h) : null,
      sort_order:      Number(form.sort_order) || 0,
    };
    if (!editId) delete payload.id;

    const result = editId
      ? await supabase.from('tours').update(payload).eq('id', editId)
      : await supabase.from('tours').insert([payload]);

    setSaving(false);
    if (result.error) { showToast('Ошибка: ' + result.error.message, 'err'); return; }
    showToast(editId ? '✓ Тур обновлён' : '✓ Тур добавлен');
    resetForm(); loadTours();
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    const { error } = await supabase.from('tours').delete().eq('id', id);
    setDeleting(null);
    if (error) { showToast('Ошибка удаления', 'err'); return; }
    showToast('Тур удалён'); loadTours();
  };

  const toggleActive = async (tour: Tour) => {
    await supabase.from('tours').update({ is_active: !tour.is_active }).eq('id', tour.id!);
    loadTours();
  };

  const startEdit = (tour: Tour) => {
    setForm({
      ...tour,
      price:           tour.price      != null ? String(tour.price)      : '',
      price_1:         (tour as any).price_1 != null ? String((tour as any).price_1) : '',
      price_2:         (tour as any).price_2 != null ? String((tour as any).price_2) : '',
      duration_h:      tour.duration_h != null ? String(tour.duration_h) : '',
      route_ru:        (tour as any).route_ru || '',
      route_en:        (tour as any).route_en || '',
      gallery:         Array.isArray(tour.gallery) ? tour.gallery.filter(Boolean) : [],
      available_dates: Array.isArray(tour.available_dates) ? tour.available_dates.filter(Boolean) : [],
    });
    setEditId(tour.id!);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => { setForm(EMPTY); setEditId(null); setShowForm(false); setGalleryInput(''); setActiveTab('ru'); };

  const f = (key: keyof Tour) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  // ── PIN ────────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;700;900&display=swap');`}</style>
      <div style={{ textAlign:'center', padding:'0 24px' }}>
        <div style={{ width:52, height:52, margin:'0 auto 18px', background:'linear-gradient(135deg,#92400e,#b91c1c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🐉</div>
        <p style={{ fontFamily:"'Bebas Neue'", fontSize:26, letterSpacing:3, color:'#fff', marginBottom:4 }}>
          DRAGON <span style={{ color:'#f59e0b' }}>TRIPS</span>
        </p>
        <p style={{ fontSize:9, color:'rgba(255,255,255,0.25)', letterSpacing:4, textTransform:'uppercase', marginBottom:32 }}>Admin Panel</p>
        <input type="password" placeholder="PIN" value={pin}
          onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkPin()}
          style={{ width:160, padding:'13px 16px', border:`1px solid ${pinError?'#ef4444':'rgba(255,255,255,0.1)'}`, background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:20, textAlign:'center', letterSpacing:8, outline:'none', display:'block', margin:'0 auto 14px', borderRadius:0, fontFamily:'DM Sans' }} />
        <button onClick={checkPin}
          style={{ padding:'11px 36px', border:'none', cursor:'pointer', background:'linear-gradient(135deg,#92400e,#b91c1c)', color:'#fff', fontSize:10, fontWeight:900, letterSpacing:3, textTransform:'uppercase' }}>
          Войти
        </button>
        {pinError && <p style={{ color:'#ef4444', fontSize:11, marginTop:12 }}>Неверный PIN</p>}
      </div>
    </div>
  );

  // ── MAIN ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', color:'#fff', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700;900&display=swap');
        .bebas { font-family:'Bebas Neue',sans-serif; }
        *{ box-sizing:border-box; }

        .inp {
          width:100%; padding:11px 14px;
          border:1px solid rgba(255,255,255,0.08);
          background:rgba(255,255,255,0.04); color:#fff;
          font-family:'DM Sans',sans-serif; font-size:13px;
          outline:none; transition:border-color .2s; resize:vertical; border-radius:0;
        }
        .inp:focus { border-color:rgba(245,158,11,0.45); }
        .inp::placeholder { color:rgba(255,255,255,0.2); }

        .lbl {
          display:block; font-size:9px; font-weight:900;
          text-transform:uppercase; letter-spacing:2px;
          color:rgba(255,255,255,0.28); margin-bottom:6px;
        }

        .sec { border-top:1px solid rgba(255,255,255,0.06); padding:20px 0; }
        .sec-t { font-size:9px; font-weight:900; letter-spacing:2.5px; text-transform:uppercase; color:rgba(245,158,11,0.55); margin-bottom:16px; }

        .tour-row { display:flex; gap:12px; align-items:center; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.05); transition:background .15s; }
        .tour-row:hover { background:rgba(255,255,255,0.02); }
        .tour-row:last-child { border-bottom:none; }

        .tog { width:36px; height:20px; border:none; cursor:pointer; position:relative; transition:background .2s; flex-shrink:0; }
        .tog::after { content:''; position:absolute; top:3px; width:14px; height:14px; background:#fff; transition:left .2s; }
        .tog.on  { background:#16a34a; } .tog.on::after  { left:19px; }
        .tog.off { background:rgba(255,255,255,0.12); } .tog.off::after { left:3px; }

        .btn-fire { padding:11px 22px; border:none; cursor:pointer; background:linear-gradient(135deg,#92400e,#b91c1c); color:#fff; font-family:'DM Sans',sans-serif; font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; transition:opacity .2s; white-space:nowrap; }
        .btn-fire:hover { opacity:.85; } .btn-fire:disabled { opacity:.35; cursor:not-allowed; }

        .btn-ghost { padding:10px 16px; cursor:pointer; background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.45); font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; transition:all .15s; white-space:nowrap; }
        .btn-ghost:hover { border-color:rgba(255,255,255,0.22); color:#fff; }

        .btn-sm { padding:6px 12px; cursor:pointer; background:transparent; border:1px solid rgba(255,255,255,0.09); color:rgba(255,255,255,0.4); font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; transition:all .15s; white-space:nowrap; }
        .btn-sm:hover { border-color:rgba(255,255,255,0.2); color:#fff; }

        .btn-del { padding:6px 12px; cursor:pointer; background:transparent; border:1px solid rgba(185,28,28,0.2); color:rgba(239,68,68,0.6); font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; transition:all .15s; white-space:nowrap; }
        .btn-del:hover { border-color:rgba(185,28,28,0.45); color:#ef4444; } .btn-del:disabled { opacity:.3; cursor:not-allowed; }

        .upload-btn { display:inline-flex; align-items:center; gap:8px; padding:9px 14px; cursor:pointer; border:1px dashed rgba(245,158,11,0.28); background:rgba(245,158,11,0.04); color:rgba(245,158,11,0.75); font-size:10px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; transition:all .2s; white-space:nowrap; }
        .upload-btn:hover { background:rgba(245,158,11,0.09); border-color:rgba(245,158,11,0.5); }

        .g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
        @media(max-width:600px) { .g2,.g3 { grid-template-columns:1fr; } }

        @keyframes spin { to{ transform:rotate(360deg); } }
        @keyframes toastIn { from{opacity:0;transform:translateY(10px) translateX(-50%)} to{opacity:1;transform:translateY(0) translateX(-50%)} }
        .toast { position:fixed; bottom:24px; left:50%; padding:12px 24px; font-size:13px; font-weight:700; animation:toastIn .3s ease forwards; z-index:999; white-space:nowrap; box-shadow:0 8px 32px rgba(0,0,0,0.5); }
        .toast.ok { background:#15803d; color:#fff; } .toast.err { background:#b91c1c; color:#fff; }

        .tab-btn { padding:8px 16px; border:none; cursor:pointer; font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; transition:all .15s; border-bottom:2px solid transparent; background:transparent; }
        .tab-btn.active { color:#f59e0b; border-bottom-color:#f59e0b; }
        .tab-btn:not(.active) { color:rgba(255,255,255,0.3); }

        .price-usd-row { display:flex; gap:14px; }
        .price-field { flex:1; }
        .price-preview { padding:10px 14px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; justify-content:center; min-width:110px; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'rgba(13,17,23,0.98)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, background:'linear-gradient(135deg,#92400e,#b91c1c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>🐉</div>
          <div>
            <p className="bebas" style={{ fontSize:15, letterSpacing:2.5, lineHeight:1.1 }}>
              DRAGON <span style={{ color:'#f59e0b' }}>TRIPS</span>
              <span style={{ color:'rgba(255,255,255,0.2)', fontSize:11, marginLeft:8, fontFamily:'DM Sans', letterSpacing:1, fontWeight:400 }}>/ ADMIN</span>
            </p>
            <p style={{ fontSize:8, color:'rgba(255,255,255,0.22)', letterSpacing:2.5, textTransform:'uppercase' }}>Управление турами</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-fire">+ Добавить тур</button>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'24px 16px 80px' }}>

        {/* ══════════════ FORM ══════════════ */}
        {showForm && (
          <div style={{ border:'1px solid rgba(255,255,255,0.08)', marginBottom:28, background:'rgba(255,255,255,0.015)' }}>

            {/* Form header */}
            <div style={{ padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(245,158,11,0.025)' }}>
              <p className="bebas" style={{ fontSize:19, letterSpacing:2.5, color:'#f59e0b' }}>
                {editId ? '✎  Редактировать тур' : '+  Новый тур'}
              </p>
              <button onClick={resetForm} className="btn-sm">✕ Отмена</button>
            </div>

            <div style={{ padding:'0 22px 22px' }}>

              {/* ── Названия ── */}
              <div className="sec">
                <p className="sec-t">Название</p>
                <div className="g2">
                  <div>
                    <label className="lbl">🇷🇺 RU *</label>
                    <input className="inp" placeholder="Острова Чамов" value={form.name_ru} onChange={f('name_ru')} />
                  </div>
                  <div>
                    <label className="lbl">🇬🇧 EN *</label>
                    <input className="inp" placeholder="Cham Islands Tour" value={form.name_en} onChange={f('name_en')} />
                  </div>
                </div>
              </div>

              {/* ── Описание + Маршрут — табы ── */}
              <div className="sec">
                <p className="sec-t">Описание и маршрут</p>

                {/* Lang tabs */}
                <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:16 }}>
                  <button className={`tab-btn ${activeTab==='ru'?'active':''}`} onClick={() => setActiveTab('ru')}>🇷🇺 Русский</button>
                  <button className={`tab-btn ${activeTab==='en'?'active':''}`} onClick={() => setActiveTab('en')}>🇬🇧 English</button>
                </div>

                {activeTab === 'ru' ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    <div>
                      <label className="lbl">Описание тура</label>
                      <textarea className="inp" rows={5} placeholder="Подробное описание тура, что включено, что взять с собой..." value={form.desc_ru} onChange={f('desc_ru')} />
                    </div>
                    <div>
                      <label className="lbl">Маршрут и остановки</label>
                      <textarea className="inp" rows={6} placeholder="08:00 — Отправление из отеля&#10;09:30 — Первая остановка: ...&#10;12:00 — Обед в ...&#10;14:00 — ..." value={form.route_ru} onChange={f('route_ru')} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    <div>
                      <label className="lbl">Tour Description</label>
                      <textarea className="inp" rows={5} placeholder="Detailed tour description, what's included..." value={form.desc_en} onChange={f('desc_en')} />
                    </div>
                    <div>
                      <label className="lbl">Route & Stops</label>
                      <textarea className="inp" rows={6} placeholder="08:00 — Departure from hotel&#10;09:30 — First stop: ...&#10;12:00 — Lunch at ...&#10;14:00 — ..." value={form.route_en} onChange={f('route_en')} />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Параметры ── */}
              <div className="sec">
                <p className="sec-t">Параметры</p>
                <div className="g3" style={{ marginBottom:18 }}>
                  <div>
                    <label className="lbl">Категория</label>
                    <select className="inp" value={form.category} onChange={f('category')}>
                      <option value="">— выбрать —</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">⏱ Длительность (ч)</label>
                    <input className="inp" type="number" placeholder="6" value={form.duration_h} onChange={f('duration_h')} />
                  </div>
                  <div>
                    <label className="lbl">Сортировка</label>
                    <input className="inp" type="number" placeholder="0" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:28 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <button type="button" className={`tog ${form.hot?'on':'off'}`} onClick={() => setForm(p => ({ ...p, hot: !p.hot }))} />
                    <span style={{ fontSize:12, color: form.hot ? '#f59e0b' : 'rgba(255,255,255,0.28)', fontWeight:700 }}>Хит сезона</span>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <button type="button" className={`tog ${form.is_active?'on':'off'}`} onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))} />
                    <span style={{ fontSize:12, color: form.is_active ? '#16a34a' : 'rgba(255,255,255,0.28)', fontWeight:700 }}>
                      {form.is_active ? 'Активен' : 'Скрыт'}
                    </span>
                  </label>
                </div>
              </div>

              {/* ── ЦЕНЫ в долларах ── */}
              <div className="sec">
                <p className="sec-t">Цены (USD $)</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginBottom:16, letterSpacing:'0.05em' }}>
                  Курс 1 $ = {VND_RATE.toLocaleString()} ₫ — донги считаются автоматически
                </p>

                {/* Базовая цена */}
                <div style={{ marginBottom:14 }}>
                  <label className="lbl">Базовая цена за тур ($ USD)</label>
                  <div className="price-usd-row">
                    <div className="price-field">
                      <input className="inp" type="number" placeholder="35" value={form.price} onChange={f('price')} style={{ fontSize:16, fontWeight:700 }} />
                    </div>
                    {form.price && (
                      <div className="price-preview">
                        <p style={{ fontSize:16, fontWeight:900, color:'#f59e0b', letterSpacing:'-0.3px', lineHeight:1 }}>${Number(form.price)}</p>
                        <p style={{ fontSize:9, color:'rgba(255,255,255,0.28)', marginTop:3 }}>≈ {usdToVnd(form.price)} ₫</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Цена за 1 и за 2 — в одной строке */}
                <div style={{ padding:16, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderLeft:'2px solid rgba(245,158,11,0.3)' }}>
                  <p style={{ fontSize:9, fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', color:'rgba(245,158,11,0.5)', marginBottom:14 }}>
                    Групповые цены (оставь пустым если нет скидки)
                  </p>
                  <div className="g2">
                    <div>
                      <label className="lbl">Цена за 1 чел. ($)</label>
                      <div className="price-usd-row" style={{ gap:8 }}>
                        <div className="price-field">
                          <input className="inp" type="number" placeholder="35" value={form.price_1} onChange={f('price_1')} />
                        </div>
                        {form.price_1 && (
                          <div className="price-preview" style={{ minWidth:80, padding:'8px 10px' }}>
                            <p style={{ fontSize:13, fontWeight:900, color:'#f59e0b', lineHeight:1 }}>${Number(form.price_1)}</p>
                            <p style={{ fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:2 }}>≈ {usdToVnd(form.price_1)} ₫</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="lbl">Цена за 2 чел. ($, каждый)</label>
                      <div className="price-usd-row" style={{ gap:8 }}>
                        <div className="price-field">
                          <input className="inp" type="number" placeholder="28" value={form.price_2} onChange={f('price_2')} />
                        </div>
                        {form.price_2 && (
                          <div className="price-preview" style={{ minWidth:80, padding:'8px 10px' }}>
                            <p style={{ fontSize:13, fontWeight:900, color:'#f59e0b', lineHeight:1 }}>${Number(form.price_2)}</p>
                            <p style={{ fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:2 }}>≈ {usdToVnd(form.price_2)} ₫</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {form.price_1 && form.price_2 && (
                    <p style={{ marginTop:12, fontSize:10, color:'rgba(100,200,100,0.7)', fontWeight:600 }}>
                      Скидка за 2 чел: ${(Number(form.price_1) - Number(form.price_2)).toFixed(0)}/чел
                      · итого за двоих ${(Number(form.price_2) * 2).toFixed(0)} вместо ${(Number(form.price_1) * 2).toFixed(0)}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Доступные даты ── */}
              <div className="sec">
                <p className="sec-t">Доступные даты</p>
                {form.available_dates.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                    {form.available_dates.map(d => (
                      <div key={d} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', border:'1px solid rgba(245,158,11,0.25)', background:'rgba(245,158,11,0.06)', fontSize:10, fontWeight:700, color:'#f59e0b' }}>
                        {new Date(d+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}
                        <button onClick={() => setForm(p => ({ ...p, available_dates: p.available_dates.filter(x => x !== d) }))}
                          style={{ background:'none', border:'none', color:'rgba(245,158,11,0.45)', cursor:'pointer', fontSize:13, lineHeight:1, padding:0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <DatePicker selected={form.available_dates} onChange={dates => setForm(p => ({ ...p, available_dates: dates }))} />
              </div>

              {/* ── Главное фото ── */}
              <div className="sec">
                <p className="sec-t">Главное фото <span style={{ color:'rgba(255,255,255,0.2)', fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:9 }}>1000×700</span></p>
                <div style={{ display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap' }}>
                  {form.image_main && (
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <img src={form.image_main} style={{ width:140, height:98, objectFit:'cover', border:'1px solid rgba(255,255,255,0.08)', display:'block' }} />
                      <button onClick={() => setForm(p => ({ ...p, image_main: '' }))}
                        style={{ position:'absolute', top:-7, right:-7, width:20, height:20, border:'none', background:'#b91c1c', color:'#fff', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, minWidth:180 }}>
                    <label className="upload-btn">
                      {uploading ? '⏳ Загрузка...' : '↑ Загрузить файл'}
                      <input ref={mainImgRef} type="file" accept="image/*" onChange={handleMainImg} style={{ display:'none' }} />
                    </label>
                    <input className="inp" placeholder="или вставь URL..." value={form.image_main}
                      onChange={e => setForm(p => ({ ...p, image_main: e.target.value }))} style={{ fontSize:11 }} />
                  </div>
                </div>
              </div>

              {/* ── Галерея ── */}
              <div className="sec">
                <p className="sec-t">Галерея <span style={{ color:'rgba(255,255,255,0.2)', fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:9 }}>1000×700 · {form.gallery.length} фото</span></p>
                {form.gallery.length > 0 && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                    {form.gallery.map((url, i) => (
                      <div key={i} style={{ position:'relative' }}>
                        <img src={url} style={{ width:70, height:49, objectFit:'cover', border:'1px solid rgba(255,255,255,0.08)' }} />
                        <button onClick={() => setForm(p => ({ ...p, gallery: p.gallery.filter((_,j) => j !== i) }))}
                          style={{ position:'absolute', top:-6, right:-6, width:18, height:18, border:'none', background:'#b91c1c', color:'#fff', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <label className="upload-btn">
                    {uploading ? '⏳...' : '↑ Добавить фото'}
                    <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handleGalleryImg} style={{ display:'none' }} />
                  </label>
                  <div style={{ display:'flex', gap:6, flex:1, minWidth:180 }}>
                    <input className="inp" placeholder="или URL..." value={galleryInput}
                      onChange={e => setGalleryInput(e.target.value)} onKeyDown={e => e.key==='Enter'&&addGalleryUrl()} style={{ fontSize:11 }} />
                    <button onClick={addGalleryUrl} className="btn-sm">+ Add</button>
                  </div>
                </div>
              </div>

              {/* Save */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={resetForm} className="btn-ghost">Отмена</button>
                <button onClick={handleSave} className="btn-fire" disabled={saving}>
                  {saving ? '⏳ Сохраняю...' : editId ? '✓ Сохранить' : '✓ Создать тур'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ TOUR LIST ══════════════ */}
        <div style={{ marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p className="bebas" style={{ fontSize:17, letterSpacing:2.5, color:'rgba(255,255,255,0.45)' }}>
            Туры <span style={{ color:'#f59e0b' }}>({tours.length})</span>
          </p>
          <button onClick={loadTours} className="btn-sm">↻ Обновить</button>
        </div>

        <div style={{ border:'1px solid rgba(255,255,255,0.07)' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'50px 0' }}>
              <div style={{ width:28, height:28, border:'2px solid rgba(245,158,11,0.2)', borderTopColor:'#f59e0b', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
            </div>
          ) : tours.length === 0 ? (
            <div style={{ textAlign:'center', padding:'50px 0', color:'rgba(255,255,255,0.15)' }}>
              <p style={{ fontSize:10, letterSpacing:3, textTransform:'uppercase' }}>Туров пока нет — добавь первый</p>
            </div>
          ) : (
            tours.map(tour => (
              <div key={tour.id} className="tour-row">
                <div style={{ width:70, height:49, overflow:'hidden', flexShrink:0, background:'#0c0f1c' }}>
                  {tour.image_main
                    ? <img src={tour.image_main} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, opacity:0.12 }}>🗺️</div>
                  }
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <p style={{ fontSize:13, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'rgba(255,255,255,0.9)' }}>{tour.name_ru}</p>
                    {tour.hot && <span style={{ fontSize:8, background:'rgba(185,28,28,0.12)', color:'#ef4444', padding:'2px 6px', fontWeight:900, letterSpacing:1.5, textTransform:'uppercase', flexShrink:0, border:'1px solid rgba(185,28,28,0.18)' }}>ХИТ</span>}
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:10, color:'rgba(255,255,255,0.28)', flexWrap:'wrap', alignItems:'center' }}>
                    {tour.category   && <span style={{ letterSpacing:'0.12em', textTransform:'uppercase', fontSize:9 }}>{tour.category}</span>}
                    {tour.price      && <span style={{ color:'rgba(245,158,11,0.65)', fontWeight:700 }}>${Number(tour.price)}</span>}
                    {(tour as any).price_2 && <span style={{ color:'rgba(100,200,100,0.55)', fontWeight:700 }}>×2 ${Number((tour as any).price_2)}/чел</span>}
                    {tour.duration_h && <span>{tour.duration_h}ч</span>}
                    {(tour as any).available_dates?.length > 0 && <span style={{ color:'rgba(100,200,100,0.45)', fontSize:9 }}>{(tour as any).available_dates.length} дат</span>}
                  </div>
                </div>
                <button className={`tog ${tour.is_active?'on':'off'}`} onClick={() => toggleActive(tour)} title={tour.is_active?'Скрыть':'Показать'} />
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => startEdit(tour)} className="btn-sm">✎</button>
                  <button onClick={() => { if(confirm(`Удалить "${tour.name_ru}"?`)) handleDelete(tour.id!); }} className="btn-del" disabled={deleting===tour.id}>
                    {deleting===tour.id ? '...' : '✕'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}