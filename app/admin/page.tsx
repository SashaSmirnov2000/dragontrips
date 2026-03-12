"use client";
import { useState, useRef } from 'react';
import { supabase } from '../supabase';

interface Tour {
  id?: number;
  name_ru: string;
  name_en: string;
  desc_ru: string;
  desc_en: string;
  category: string;
  image_main: string;
  gallery: string[];
  price: string | number;
  duration_h: string | number;
  hot: boolean;
  sort_order: number;
  is_active: boolean;
  available_dates: string[];
}

const EMPTY: Tour = {
  name_ru: '', name_en: '',
  desc_ru: '', desc_en: '',
  category: '', image_main: '',
  gallery: [], price: '', duration_h: '',
  hot: false, sort_order: 0, is_active: true,
  available_dates: [],
};

const CATEGORIES = ['Море', 'Горы', 'Город', 'Природа', 'Дайвинг', 'Еда', 'Культура'];
const ADMIN_PIN  = '2626';

// ── Mini Calendar для выбора доступных дат ───────────────────────────────────
function DatePicker({ selected, onChange }: { selected: string[]; onChange: (dates: string[]) => void }) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const toggle = (dateStr: string) => {
    if (selected.includes(dateStr)) onChange(selected.filter(d => d !== dateStr));
    else onChange([...selected, dateStr].sort());
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const offset      = firstDay === 0 ? 6 : firstDay - 1; // пн=0

  const monthNames = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, padding: '0 8px', lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f59e0b' }}>
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, padding: '0 8px', lineHeight: 1 }}>›</button>
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selected.includes(dateStr);
          const isPast = new Date(dateStr) < new Date(today.toDateString());

          return (
            <button
              key={idx}
              onClick={() => !isPast && toggle(dateStr)}
              style={{
                padding: '5px 0',
                border: isSelected ? '1px solid #f59e0b' : '1px solid transparent',
                borderRadius: 6,
                background: isSelected ? 'rgba(245,158,11,0.2)' : 'transparent',
                color: isPast ? 'rgba(255,255,255,0.15)' : isSelected ? '#f59e0b' : 'rgba(255,255,255,0.7)',
                fontSize: 11,
                fontWeight: isSelected ? 900 : 400,
                cursor: isPast ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                transition: 'all .15s',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected count */}
      {selected.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>
            Выбрано: {selected.length} {selected.length === 1 ? 'дата' : selected.length < 5 ? 'даты' : 'дат'}
          </span>
          <button onClick={() => onChange([])} style={{ fontSize: 9, color: 'rgba(255,100,100,0.7)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
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
    if (error) showToast('Ошибка загрузки: ' + error.message, 'err');
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
    const urls: string[] = [];
    for (const file of files) { const u = await uploadImage(file); if (u) urls.push(u); }
    setForm(f => ({ ...f, gallery: [...f.gallery, ...urls] }));
    setUploading(false);
  };

  const addGalleryUrl = () => {
    const url = galleryInput.trim(); if (!url) return;
    setForm(f => ({ ...f, gallery: [...f.gallery, url] }));
    setGalleryInput('');
  };

  const removeGalleryImg = (idx: number) =>
    setForm(f => ({ ...f, gallery: f.gallery.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!form.name_ru || !form.name_en) { showToast('Заполни названия RU и EN', 'err'); return; }
    setSaving(true);

    const cleanGallery = Array.isArray(form.gallery) ? form.gallery.filter(Boolean) : [];
    const cleanDates   = Array.isArray(form.available_dates) ? form.available_dates.filter(Boolean).sort() : [];

    const payload: any = {
      ...form,
      gallery:         cleanGallery,
      available_dates: cleanDates,
      price:           form.price      ? Number(form.price)      : null,
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
    resetForm();
    loadTours();
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    const { error } = await supabase.from('tours').delete().eq('id', id);
    setDeleting(null);
    if (error) { showToast('Ошибка удаления', 'err'); return; }
    showToast('Тур удалён');
    loadTours();
  };

  const toggleActive = async (tour: Tour) => {
    await supabase.from('tours').update({ is_active: !tour.is_active }).eq('id', tour.id!);
    loadTours();
  };

  const startEdit = (tour: Tour) => {
    setForm({
      ...tour,
      price:           tour.price      != null ? String(tour.price)      : '',
      duration_h:      tour.duration_h != null ? String(tour.duration_h) : '',
      gallery:         Array.isArray(tour.gallery)         ? tour.gallery.filter(Boolean)         : [],
      available_dates: Array.isArray(tour.available_dates) ? tour.available_dates.filter(Boolean) : [],
    });
    setEditId(tour.id!);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm(EMPTY); setEditId(null); setShowForm(false); setGalleryInput('');
  };

  // ── PIN Screen ────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;700;900&display=swap');`}</style>
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 20px', background: 'linear-gradient(135deg,#92400e,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🐉</div>
        <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: 3, color: '#fff', marginBottom: 4 }}>
          DRAGON <span style={{ color: '#f59e0b' }}>TRIPS</span>
        </p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 36 }}>Admin Panel</p>
        <input
          type="password" placeholder="PIN" value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && checkPin()}
          style={{ width: 180, padding: '14px 20px', border: `1px solid ${pinError ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 20, textAlign: 'center', letterSpacing: 8, outline: 'none', display: 'block', margin: '0 auto 14px', transition: 'border-color .2s', borderRadius: 0 }}
        />
        <button onClick={checkPin} style={{ padding: '12px 40px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#92400e,#b91c1c)', color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase' }}>
          Войти
        </button>
        {pinError && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 14, letterSpacing: 1 }}>Неверный PIN</p>}
      </div>
    </div>
  );

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#fff', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700;900&display=swap');
        .bebas { font-family:'Bebas Neue',sans-serif; }
        * { box-sizing:border-box; }

        .adm-input {
          width:100%; padding:11px 14px;
          border:1px solid rgba(255,255,255,0.08);
          background:rgba(255,255,255,0.04); color:#fff;
          font-family:'DM Sans',sans-serif; font-size:13px;
          outline:none; transition:border-color .2s; resize:vertical;
          border-radius: 0;
        }
        .adm-input:focus { border-color:rgba(245,158,11,0.5); }
        .adm-input::placeholder { color:rgba(255,255,255,0.2); }

        .adm-label {
          display:block; font-size:9px; font-weight:900;
          text-transform:uppercase; letter-spacing:2px;
          color:rgba(255,255,255,0.3); margin-bottom:7px;
        }

        .sec {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 20px 0;
          margin-bottom: 0;
        }
        .sec-title {
          font-size:9px; font-weight:900; letter-spacing:2.5px;
          text-transform:uppercase; color:rgba(245,158,11,0.6);
          margin-bottom:16px;
        }

        .tour-row {
          display:flex; gap:14px; align-items:center;
          padding:16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background .15s;
        }
        .tour-row:hover { background: rgba(255,255,255,0.02); }
        .tour-row:last-child { border-bottom: none; }

        .toggle {
          width:36px; height:20px; border-radius:0; border:none; cursor:pointer;
          position:relative; transition:background .2s; flex-shrink:0;
        }
        .toggle::after {
          content:''; position:absolute; top:3px; width:14px; height:14px;
          border-radius:0; background:#fff; transition:left .2s;
        }
        .toggle.on  { background:#16a34a; }
        .toggle.off { background:rgba(255,255,255,0.12); }
        .toggle.on::after  { left:19px; }
        .toggle.off::after { left:3px; }

        .gal-thumb {
          width:64px; height:48px; object-fit:cover;
          border:1px solid rgba(255,255,255,0.07); flex-shrink:0;
        }

        @keyframes toastIn {
          from { opacity:0; transform:translateY(12px) translateX(-50%); }
          to   { opacity:1; transform:translateY(0) translateX(-50%); }
        }
        .toast {
          position:fixed; bottom:28px; left:50%;
          padding:12px 28px; font-size:13px; font-weight:700;
          animation:toastIn .3s ease forwards; z-index:999; white-space:nowrap;
          box-shadow:0 8px 32px rgba(0,0,0,0.5);
        }
        .toast.ok  { background:#15803d; color:#fff; }
        .toast.err { background:#b91c1c; color:#fff; }

        .upload-btn {
          display:inline-flex; align-items:center; gap:8px;
          padding:9px 16px; cursor:pointer;
          border:1px dashed rgba(245,158,11,0.3);
          background:rgba(245,158,11,0.04); color:rgba(245,158,11,0.8);
          font-size:10px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase;
          transition:all .2s; white-space:nowrap;
        }
        .upload-btn:hover { background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.55); }

        .btn-fire {
          padding:11px 24px; border:none; cursor:pointer;
          background:linear-gradient(135deg,#92400e,#b91c1c); color:#fff;
          font-family:'DM Sans',sans-serif; font-size:11px; font-weight:900;
          letter-spacing:2px; text-transform:uppercase; transition:opacity .2s;
          white-space:nowrap;
        }
        .btn-fire:hover   { opacity:.85; }
        .btn-fire:disabled{ opacity:.35; cursor:not-allowed; }

        .btn-ghost {
          padding:10px 18px; cursor:pointer;
          background:transparent; border:1px solid rgba(255,255,255,0.12);
          color:rgba(255,255,255,0.5); font-size:10px; font-weight:700;
          letter-spacing:1.5px; text-transform:uppercase; transition:all .15s;
          white-space:nowrap;
        }
        .btn-ghost:hover { border-color:rgba(255,255,255,0.25); color:#fff; }

        .btn-ghost-sm {
          padding:7px 12px; cursor:pointer;
          background:transparent; border:1px solid rgba(255,255,255,0.1);
          color:rgba(255,255,255,0.45); font-size:10px; font-weight:700;
          letter-spacing:1px; text-transform:uppercase; transition:all .15s;
          white-space:nowrap;
        }
        .btn-ghost-sm:hover { border-color:rgba(255,255,255,0.22); color:#fff; }

        .btn-del {
          padding:7px 12px; cursor:pointer;
          background:transparent; border:1px solid rgba(185,28,28,0.25);
          color:rgba(239,68,68,0.7); font-size:10px; font-weight:700;
          letter-spacing:1px; text-transform:uppercase; transition:all .15s;
          white-space:nowrap;
        }
        .btn-del:hover   { border-color:rgba(185,28,28,0.5); color:#ef4444; }
        .btn-del:disabled{ opacity:.35; cursor:not-allowed; }

        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
        @media(max-width:600px) { .grid2,.grid3 { grid-template-columns:1fr; } }
        @keyframes spin { to{ transform:rotate(360deg); } }

        .date-chip {
          display:inline-flex; align-items:center; gap:5px;
          padding:3px 10px; font-size:10px; font-weight:700; color:#f59e0b;
          border:1px solid rgba(245,158,11,0.25); background:rgba(245,158,11,0.06);
          letter-spacing:0.05em;
        }
        .date-chip button {
          background:none; border:none; color:rgba(245,158,11,0.5);
          cursor:pointer; font-size:12px; line-height:1; padding:0;
        }
        .date-chip button:hover { color:#ef4444; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'rgba(13,17,23,0.98)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#92400e,#b91c1c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🐉</div>
          <div>
            <p className="bebas" style={{ fontSize:16, letterSpacing:2.5, lineHeight:1.1 }}>
              DRAGON <span style={{ color:'#f59e0b' }}>TRIPS</span>
              <span style={{ color:'rgba(255,255,255,0.25)', fontSize:12, marginLeft:10, fontFamily:'DM Sans', letterSpacing:1, fontWeight:400 }}>/ ADMIN</span>
            </p>
            <p style={{ fontSize:8, color:'rgba(255,255,255,0.25)', letterSpacing:2.5, textTransform:'uppercase' }}>Управление турами</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-fire">
          + Добавить тур
        </button>
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 16px 80px' }}>

        {/* ── FORM ── */}
        {showForm && (
          <div style={{ border:'1px solid rgba(255,255,255,0.08)', marginBottom:32, background:'rgba(255,255,255,0.02)' }}>

            {/* Form header */}
            <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(245,158,11,0.03)' }}>
              <p className="bebas" style={{ fontSize:20, letterSpacing:2.5, color:'#f59e0b' }}>
                {editId ? '✎  Редактировать тур' : '+  Новый тур'}
              </p>
              <button onClick={resetForm} className="btn-ghost-sm">✕ Отмена</button>
            </div>

            <div style={{ padding:'0 24px 24px' }}>

              {/* ── Названия ── */}
              <div className="sec">
                <p className="sec-title">Название</p>
                <div className="grid2">
                  <div>
                    <label className="adm-label">🇷🇺 Название RU *</label>
                    <input className="adm-input" placeholder="Острова Чамов" value={form.name_ru}
                      onChange={e => setForm(f => ({ ...f, name_ru: e.target.value }))} />
                  </div>
                  <div>
                    <label className="adm-label">🇬🇧 Название EN *</label>
                    <input className="adm-input" placeholder="Cham Islands Tour" value={form.name_en}
                      onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* ── Описание ── */}
              <div className="sec">
                <p className="sec-title">Описание</p>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <label className="adm-label">🇷🇺 Описание RU</label>
                    <textarea className="adm-input" rows={4} placeholder="Описание тура на русском..."
                      value={form.desc_ru} onChange={e => setForm(f => ({ ...f, desc_ru: e.target.value }))} />
                  </div>
                  <div>
                    <label className="adm-label">🇬🇧 Описание EN</label>
                    <textarea className="adm-input" rows={4} placeholder="Tour description in English..."
                      value={form.desc_en} onChange={e => setForm(f => ({ ...f, desc_en: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* ── Параметры ── */}
              <div className="sec">
                <p className="sec-title">Параметры</p>
                <div className="grid3" style={{ marginBottom:18 }}>
                  <div>
                    <label className="adm-label">Категория</label>
                    <select className="adm-input" value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">— выбрать —</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="adm-label">⏱ Длительность (ч)</label>
                    <input className="adm-input" type="number" placeholder="6" value={form.duration_h}
                      onChange={e => setForm(f => ({ ...f, duration_h: e.target.value }))} />
                  </div>
                  <div>
                    <label className="adm-label">Порядок сортировки</label>
                    <input className="adm-input" type="number" placeholder="0" value={form.sort_order}
                      onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
                  </div>
                </div>

                <div style={{ display:'flex', gap:32 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <button type="button" className={`toggle ${form.hot ? 'on' : 'off'}`} onClick={() => setForm(f => ({ ...f, hot: !f.hot }))} />
                    <span style={{ fontSize:12, color: form.hot ? '#f59e0b' : 'rgba(255,255,255,0.3)', fontWeight:700 }}>Хит сезона</span>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <button type="button" className={`toggle ${form.is_active ? 'on' : 'off'}`} onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} />
                    <span style={{ fontSize:12, color: form.is_active ? '#16a34a' : 'rgba(255,255,255,0.3)', fontWeight:700 }}>
                      {form.is_active ? 'Активен' : 'Скрыт'}
                    </span>
                  </label>
                </div>
              </div>

              {/* ── Цена ── */}
              <div className="sec">
                <p className="sec-title">Цена тура</p>
                <div style={{ display:'flex', gap:16, alignItems:'flex-end' }}>
                  <div style={{ flex:1 }}>
                    <label className="adm-label">Сумма в донгах (₫)</label>
                    <input className="adm-input" type="number" placeholder="850000" value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      style={{ fontSize:16, fontWeight:700 }} />
                  </div>
                  {form.price && (
                    <div style={{ paddingBottom:2, textAlign:'right' }}>
                      <p style={{ fontSize:20, fontWeight:900, color:'#f59e0b', letterSpacing:'-0.5px', lineHeight:1 }}>
                        {Number(form.price).toLocaleString()} ₫
                      </p>
                      <p style={{ fontSize:10, color:'rgba(255,255,255,0.28)', marginTop:3 }}>
                        ≈ {Math.round(Number(form.price) / 26000)} $
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Доступные даты ── */}
              <div className="sec">
                <p className="sec-title">Доступные даты</p>

                {/* Выбранные даты — чипы */}
                {form.available_dates.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
                    {form.available_dates.map(d => (
                      <div key={d} className="date-chip">
                        {new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day:'numeric', month:'short' })}
                        <button onClick={() => setForm(f => ({ ...f, available_dates: f.available_dates.filter(x => x !== d) }))}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                <DatePicker
                  selected={form.available_dates}
                  onChange={dates => setForm(f => ({ ...f, available_dates: dates }))}
                />
              </div>

              {/* ── Главное фото ── */}
              <div className="sec">
                <p className="sec-title">Главное фото</p>
                <div style={{ display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap' }}>
                  {form.image_main && (
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <img src={form.image_main} style={{ width:120, height:80, objectFit:'cover', border:'1px solid rgba(255,255,255,0.08)', display:'block' }} />
                      <button onClick={() => setForm(f => ({ ...f, image_main: '' }))}
                        style={{ position:'absolute', top:-8, right:-8, width:20, height:20, border:'none', background:'#b91c1c', color:'#fff', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, minWidth:200 }}>
                    <label className="upload-btn">
                      {uploading ? '⏳ Загрузка...' : '↑ Загрузить файл'}
                      <input ref={mainImgRef} type="file" accept="image/*" onChange={handleMainImg} style={{ display:'none' }} />
                    </label>
                    <input className="adm-input" placeholder="или вставь URL..." value={form.image_main}
                      onChange={e => setForm(f => ({ ...f, image_main: e.target.value }))} style={{ fontSize:11 }} />
                  </div>
                </div>
              </div>

              {/* ── Галерея ── */}
              <div className="sec">
                <p className="sec-title">Галерея <span style={{ color:'rgba(255,255,255,0.25)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>({form.gallery.length} фото)</span></p>
                {form.gallery.length > 0 && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                    {form.gallery.map((url, i) => (
                      <div key={i} style={{ position:'relative' }}>
                        <img src={url} className="gal-thumb" />
                        <button onClick={() => removeGalleryImg(i)}
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
                  <div style={{ display:'flex', gap:6, flex:1, minWidth:200 }}>
                    <input className="adm-input" placeholder="или URL..." value={galleryInput}
                      onChange={e => setGalleryInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addGalleryUrl()}
                      style={{ fontSize:11 }} />
                    <button onClick={addGalleryUrl} className="btn-ghost-sm">+ Add</button>
                  </div>
                </div>
              </div>

              {/* ── Save ── */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={resetForm} className="btn-ghost">Отмена</button>
                <button onClick={handleSave} className="btn-fire" disabled={saving}>
                  {saving ? '⏳ Сохраняю...' : editId ? '✓ Сохранить изменения' : '✓ Создать тур'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TOUR LIST ── */}
        <div style={{ marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p className="bebas" style={{ fontSize:18, letterSpacing:2.5, color:'rgba(255,255,255,0.5)' }}>
            Туры <span style={{ color:'#f59e0b' }}>({tours.length})</span>
          </p>
          <button onClick={loadTours} className="btn-ghost-sm">↻ Обновить</button>
        </div>

        <div style={{ border:'1px solid rgba(255,255,255,0.07)' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
              <div style={{ width:28, height:28, border:'2px solid rgba(245,158,11,0.2)', borderTopColor:'#f59e0b', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            </div>
          ) : tours.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,0.18)' }}>
              <p style={{ fontSize:11, letterSpacing:3, textTransform:'uppercase' }}>Туров пока нет — добавь первый</p>
            </div>
          ) : (
            tours.map(tour => (
              <div key={tour.id} className="tour-row">

                {/* Thumbnail */}
                <div style={{ width:72, height:50, overflow:'hidden', flexShrink:0, background:'#0c0f1c' }}>
                  {tour.image_main
                    ? <img src={tour.image_main} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, opacity:0.15 }}>🗺️</div>
                  }
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <p style={{ fontSize:13, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'rgba(255,255,255,0.9)' }}>
                      {tour.name_ru}
                    </p>
                    {tour.hot && (
                      <span style={{ fontSize:8, background:'rgba(185,28,28,0.15)', color:'#ef4444', padding:'2px 7px', fontWeight:900, letterSpacing:1.5, textTransform:'uppercase', flexShrink:0, border:'1px solid rgba(185,28,28,0.2)' }}>ХИТ</span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:14, fontSize:10, color:'rgba(255,255,255,0.3)', flexWrap:'wrap', alignItems:'center' }}>
                    {tour.category   && <span style={{ letterSpacing:'0.1em', textTransform:'uppercase', fontSize:9 }}>{tour.category}</span>}
                    {tour.price      && <span style={{ color:'rgba(245,158,11,0.6)', fontWeight:700 }}>{Number(tour.price).toLocaleString()} ₫</span>}
                    {tour.duration_h && <span>{tour.duration_h} ч</span>}
                    {(tour.available_dates?.length > 0) && (
                      <span style={{ color:'rgba(100,200,100,0.5)', fontSize:9 }}>
                        {tour.available_dates.length} {tour.available_dates.length === 1 ? 'дата' : 'дат'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Active toggle */}
                <button className={`toggle ${tour.is_active ? 'on' : 'off'}`} onClick={() => toggleActive(tour)} title={tour.is_active ? 'Скрыть' : 'Показать'} />

                {/* Actions */}
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => startEdit(tour)} className="btn-ghost-sm">✎ Изменить</button>
                  <button
                    onClick={() => { if (confirm(`Удалить "${tour.name_ru}"?`)) handleDelete(tour.id!); }}
                    className="btn-del" disabled={deleting === tour.id}
                  >
                    {deleting === tour.id ? '...' : '✕'}
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