"use client";
import { useState, useRef } from 'react';
import { supabase } from '../supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Tour {
  id?: number;
  name_ru: string;
  name_en: string;
  desc_ru: string;
  desc_en: string;
  category: string;
  image_main: string;
  gallery: string[];
  price: string | number;   // одна цена за тур
  duration_h: string | number;
  hot: boolean;
  sort_order: number;
  is_active: boolean;
}

const EMPTY: Tour = {
  name_ru: '', name_en: '',
  desc_ru: '', desc_en: '',
  category: '',
  image_main: '',
  gallery: [],
  price: '',
  duration_h: '',
  hot: false,
  sort_order: 0,
  is_active: true,
};

const CATEGORIES = ['Море', 'Горы', 'Город', 'Природа', 'Дайвинг', 'Еда', 'Культура'];
const ADMIN_PIN  = '2626';

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

  // ── Helpers ────────────────────────────────────────────────────────────────
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

  // ── Image upload ──────────────────────────────────────────────────────────
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

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name_ru || !form.name_en) { showToast('Заполни названия RU и EN', 'err'); return; }
    setSaving(true);

    // gallery: убеждаемся что это чистый массив строк
    const cleanGallery = Array.isArray(form.gallery)
      ? form.gallery.filter(Boolean)
      : [];

    const payload: any = {
      ...form,
      gallery:    cleanGallery,
      price:      form.price      ? Number(form.price)      : null,
      duration_h: form.duration_h ? Number(form.duration_h) : null,
      sort_order: Number(form.sort_order) || 0,
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
      price:      tour.price      != null ? String(tour.price)      : '',
      duration_h: tour.duration_h != null ? String(tour.duration_h) : '',
      // gallery из Supabase может прийти как null или не-массив — нормализуем
      gallery: Array.isArray(tour.gallery) ? tour.gallery.filter(Boolean) : [],
    });
    setEditId(tour.id!);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm(EMPTY); setEditId(null); setShowForm(false); setGalleryInput('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;700;900&display=swap');`}</style>
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px', background: 'linear-gradient(135deg,#92400e,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: '0 0 28px rgba(220,38,38,0.4)' }}>🐉</div>
        <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: 3, color: '#fff', marginBottom: 6 }}>
          DRAGON <span style={{ color: '#f59e0b' }}>TRIPS</span>
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 32 }}>Admin Panel</p>
        <input
          type="password" placeholder="PIN" value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && checkPin()}
          style={{ width: 180, padding: '14px 20px', borderRadius: 14, border: `1px solid ${pinError ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 20, textAlign: 'center', letterSpacing: 8, outline: 'none', display: 'block', margin: '0 auto 16px', transition: 'border-color .2s' }}
        />
        <button onClick={checkPin} style={{ padding: '12px 40px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#92400e,#b91c1c)', color: '#fff', fontSize: 13, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>
          Войти
        </button>
        {pinError && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 12, letterSpacing: 1 }}>Неверный PIN</p>}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN ADMIN UI
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#060810', color: '#fff', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700;900&display=swap');
        .bebas { font-family:'Bebas Neue',sans-serif; }
        *{ box-sizing:border-box; }

        .adm-input{
          width:100%; padding:11px 14px; border-radius:10px;
          border:1px solid rgba(255,255,255,0.08);
          background:rgba(255,255,255,0.04); color:#fff;
          font-family:'DM Sans',sans-serif; font-size:13px;
          outline:none; transition:border-color .2s; resize:vertical;
        }
        .adm-input:focus{ border-color:rgba(245,158,11,0.5); }
        .adm-input::placeholder{ color:rgba(255,255,255,0.25); }

        .adm-label{
          display:block; font-size:10px; font-weight:900;
          text-transform:uppercase; letter-spacing:1.5px;
          color:rgba(255,255,255,0.35); margin-bottom:6px;
        }

        .sec{ background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:18px; padding:24px; margin-bottom:16px; }
        .sec-title{ font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:rgba(245,158,11,0.7); margin-bottom:16px; }

        .tour-row{
          display:flex; gap:12px; align-items:center;
          padding:14px 16px; border-radius:16px;
          border:1px solid rgba(255,255,255,0.06);
          background:rgba(255,255,255,0.02);
          transition:border-color .2s, background .2s;
        }
        .tour-row:hover{ border-color:rgba(245,158,11,0.2); background:rgba(255,255,255,0.035); }

        .toggle{
          width:36px; height:20px; border-radius:10px; border:none; cursor:pointer;
          position:relative; transition:background .2s; flex-shrink:0;
        }
        .toggle::after{
          content:''; position:absolute; top:3px; width:14px; height:14px;
          border-radius:50%; background:#fff; transition:left .2s;
        }
        .toggle.on { background:#16a34a; }
        .toggle.off{ background:rgba(255,255,255,0.15); }
        .toggle.on::after { left:19px; }
        .toggle.off::after{ left:3px; }

        .gal-thumb{
          width:64px; height:48px; border-radius:8px; object-fit:cover;
          border:1px solid rgba(255,255,255,0.08); flex-shrink:0;
        }

        @keyframes toastIn{
          from{ opacity:0; transform:translateY(12px) translateX(-50%); }
          to  { opacity:1; transform:translateY(0) translateX(-50%); }
        }
        .toast{
          position:fixed; bottom:28px; left:50%;
          padding:12px 24px; border-radius:12px; font-size:13px; font-weight:700;
          animation:toastIn .3s ease forwards; z-index:999; white-space:nowrap;
          box-shadow:0 8px 32px rgba(0,0,0,0.4);
        }
        .toast.ok { background:#15803d; color:#fff; }
        .toast.err{ background:#b91c1c; color:#fff; }

        .upload-btn{
          display:inline-flex; align-items:center; gap:8px;
          padding:9px 18px; border-radius:10px; cursor:pointer;
          border:1px dashed rgba(245,158,11,0.35);
          background:rgba(245,158,11,0.06); color:rgba(245,158,11,0.85);
          font-size:11px; font-weight:900; letter-spacing:1px; text-transform:uppercase;
          transition:all .2s; white-space:nowrap;
        }
        .upload-btn:hover{ background:rgba(245,158,11,0.12); border-color:rgba(245,158,11,0.6); }

        .btn-fire{
          padding:12px 28px; border-radius:12px; border:none; cursor:pointer;
          background:linear-gradient(135deg,#92400e,#b91c1c); color:#fff;
          font-family:'DM Sans',sans-serif; font-size:12px; font-weight:900;
          letter-spacing:1.5px; text-transform:uppercase; transition:opacity .2s;
          white-space:nowrap;
        }
        .btn-fire:hover{ opacity:.85; }
        .btn-fire:disabled{ opacity:.4; cursor:not-allowed; }

        .btn-ghost-sm{
          padding:7px 14px; border-radius:9px; cursor:pointer;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);
          color:rgba(255,255,255,0.55); font-size:11px; font-weight:700;
          letter-spacing:.5px; text-transform:uppercase; transition:all .15s;
          white-space:nowrap;
        }
        .btn-ghost-sm:hover{ background:rgba(255,255,255,0.09); color:#fff; }

        .btn-del{
          padding:7px 14px; border-radius:9px; cursor:pointer;
          background:rgba(185,28,28,0.08); border:1px solid rgba(185,28,28,0.2);
          color:#ef4444; font-size:11px; font-weight:700; letter-spacing:.5px;
          text-transform:uppercase; transition:all .15s; white-space:nowrap;
        }
        .btn-del:hover{ background:rgba(185,28,28,0.18); }
        .btn-del:disabled{ opacity:.4; cursor:not-allowed; }

        .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .grid3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
        @media(max-width:600px){
          .grid2,.grid3{ grid-template-columns:1fr; }
        }

        @keyframes spin{ to{ transform:rotate(360deg); } }

        /* Price highlight block */
        .price-block{
          background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2);
          border-radius:14px; padding:18px 20px;
          display:flex; align-items:center; gap:14px;
        }
        .price-icon{
          width:40px; height:40px; border-radius:10px; flex-shrink:0;
          background:rgba(245,158,11,0.12); display:flex; align-items:center;
          justify-content:center; font-size:18px;
        }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'rgba(6,8,16,0.97)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#92400e,#b91c1c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, boxShadow:'0 0 14px rgba(220,38,38,0.3)' }}>🐉</div>
          <div>
            <p className="bebas" style={{ fontSize:17, letterSpacing:2, lineHeight:1.1 }}>
              DRAGON <span style={{ color:'#f59e0b' }}>TRIPS</span>
              <span style={{ color:'rgba(255,255,255,0.3)', fontSize:13, marginLeft:10, fontFamily:'DM Sans', letterSpacing:0 }}>Admin</span>
            </p>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:2, textTransform:'uppercase' }}>Управление турами</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-fire" style={{ fontSize:11 }}>
          + Добавить тур
        </button>
      </div>

      <div style={{ maxWidth:820, margin:'0 auto', padding:'24px 16px 80px' }}>

        {/* ── FORM ── */}
        {showForm && (
          <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:22, padding:'24px 20px', marginBottom:28 }}>

            {/* Form header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <p className="bebas" style={{ fontSize:22, letterSpacing:2, color:'#f59e0b' }}>
                {editId ? '✎ Редактировать тур' : '+ Новый тур'}
              </p>
              <button onClick={resetForm} className="btn-ghost-sm">✕ Отмена</button>
            </div>

            {/* ── Названия ── */}
            <div className="sec">
              <p className="sec-title">📝 Название</p>
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
              <p className="sec-title">📄 Описание</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label className="adm-label">🇷🇺 Описание RU</label>
                  <textarea className="adm-input" rows={3} placeholder="Описание тура на русском..."
                    value={form.desc_ru} onChange={e => setForm(f => ({ ...f, desc_ru: e.target.value }))} />
                </div>
                <div>
                  <label className="adm-label">🇬🇧 Описание EN</label>
                  <textarea className="adm-input" rows={3} placeholder="Tour description in English..."
                    value={form.desc_en} onChange={e => setForm(f => ({ ...f, desc_en: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* ── Параметры ── */}
            <div className="sec">
              <p className="sec-title">🏷 Категория и параметры</p>
              <div className="grid3" style={{ marginBottom:16 }}>
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

              {/* Флаги */}
              <div style={{ display:'flex', gap:24, paddingTop:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button className={`toggle ${form.hot ? 'on' : 'off'}`} onClick={() => setForm(f => ({ ...f, hot: !f.hot }))} />
                  <span style={{ fontSize:12, color: form.hot ? '#f59e0b' : 'rgba(255,255,255,0.35)', fontWeight: form.hot ? 800 : 400 }}>🔥 Хит</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button className={`toggle ${form.is_active ? 'on' : 'off'}`} onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} />
                  <span style={{ fontSize:12, color: form.is_active ? '#16a34a' : 'rgba(255,255,255,0.35)' }}>
                    {form.is_active ? '✓ Активен' : '○ Скрыт'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── ЦЕНА (одна) ── */}
            <div className="sec">
              <p className="sec-title">💰 Цена тура</p>
              <div className="price-block">
                <div className="price-icon">₫</div>
                <div style={{ flex:1 }}>
                  <label className="adm-label" style={{ marginBottom:8 }}>Цена за тур (вьетнамских донг)</label>
                  <input
                    className="adm-input"
                    type="number"
                    placeholder="850 000"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    style={{ fontSize:16, fontWeight:700 }}
                  />
                </div>
                {form.price && (
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:9, color:'rgba(245,158,11,0.5)', fontWeight:900, textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Предпросмотр</p>
                    <p style={{ fontSize:18, fontWeight:900, color:'#f59e0b', letterSpacing:-0.5 }}>
                      {Number(form.price).toLocaleString()} ₫
                    </p>
                    <p style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginTop:2 }}>
                      ≈ {(Number(form.price) / 26000).toFixed(0)} $
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Главное фото ── */}
            <div className="sec">
              <p className="sec-title">🖼 Главное фото</p>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start', flexWrap:'wrap' }}>
                {form.image_main && (
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <img src={form.image_main} style={{ width:120, height:80, objectFit:'cover', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', display:'block' }} />
                    <button onClick={() => setForm(f => ({ ...f, image_main: '' }))}
                      style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', border:'none', background:'#b91c1c', color:'#fff', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, minWidth:200 }}>
                  <label className="upload-btn">
                    {uploading ? '⏳ Загрузка...' : '↑ Загрузить фото'}
                    <input ref={mainImgRef} type="file" accept="image/*" onChange={handleMainImg} style={{ display:'none' }} />
                  </label>
                  <input className="adm-input" placeholder="или вставь URL..." value={form.image_main}
                    onChange={e => setForm(f => ({ ...f, image_main: e.target.value }))} style={{ fontSize:11 }} />
                </div>
              </div>
            </div>

            {/* ── Галерея ── */}
            <div className="sec">
              <p className="sec-title">🖼 Галерея <span style={{ color:'rgba(255,255,255,0.3)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>({form.gallery.length} фото)</span></p>
              {form.gallery.length > 0 && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                  {form.gallery.map((url, i) => (
                    <div key={i} style={{ position:'relative' }}>
                      <img src={url} className="gal-thumb" />
                      <button onClick={() => removeGalleryImg(i)}
                        style={{ position:'absolute', top:-5, right:-5, width:18, height:18, borderRadius:'50%', border:'none', background:'#b91c1c', color:'#fff', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
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
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:6 }}>
              <button onClick={resetForm} className="btn-ghost-sm">Отмена</button>
              <button onClick={handleSave} className="btn-fire" disabled={saving}>
                {saving ? '⏳ Сохраняю...' : editId ? '✓ Сохранить изменения' : '✓ Создать тур'}
              </button>
            </div>
          </div>
        )}

        {/* ── TOUR LIST ── */}
        <div style={{ marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p className="bebas" style={{ fontSize:20, letterSpacing:2, color:'rgba(255,255,255,0.6)' }}>
            Туры <span style={{ color:'#f59e0b' }}>({tours.length})</span>
          </p>
          <button onClick={loadTours} className="btn-ghost-sm">↻ Обновить</button>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid rgba(245,158,11,0.3)', borderTopColor:'#f59e0b', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : tours.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,0.2)' }}>
            <p style={{ fontSize:40, marginBottom:12 }}>🗺️</p>
            <p style={{ fontSize:11, letterSpacing:2, textTransform:'uppercase' }}>Туров пока нет — добавь первый!</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {tours.map(tour => (
              <div key={tour.id} className="tour-row">

                {/* Thumbnail */}
                <div style={{ width:62, height:46, borderRadius:10, overflow:'hidden', flexShrink:0, background:'#0c0f1c' }}>
                  {tour.image_main
                    ? <img src={tour.image_main} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, opacity:0.2 }}>🗺️</div>
                  }
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <p style={{ fontSize:13, fontWeight:900, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {tour.name_ru}
                    </p>
                    {tour.hot && (
                      <span style={{ fontSize:9, background:'rgba(245,158,11,0.12)', color:'#f59e0b', padding:'2px 8px', borderRadius:4, fontWeight:900, letterSpacing:1, textTransform:'uppercase', flexShrink:0 }}>🔥 хит</span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:10, color:'rgba(255,255,255,0.35)', flexWrap:'wrap' }}>
                    {tour.category  && <span>📍 {tour.category}</span>}
                    {tour.price     && <span style={{ color:'rgba(245,158,11,0.7)', fontWeight:700 }}>₫ {Number(tour.price).toLocaleString()}</span>}
                    {tour.duration_h && <span>⏱ {tour.duration_h}ч</span>}
                  </div>
                </div>

                {/* Active toggle */}
                <button className={`toggle ${tour.is_active ? 'on' : 'off'}`} onClick={() => toggleActive(tour)} title={tour.is_active ? 'Скрыть' : 'Показать'} />

                {/* Actions */}
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => startEdit(tour)} className="btn-ghost-sm">✎</button>
                  <button
                    onClick={() => { if (confirm(`Удалить "${tour.name_ru}"?`)) handleDelete(tour.id!); }}
                    className="btn-del" disabled={deleting === tour.id}
                  >
                    {deleting === tour.id ? '...' : '✕'}
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── TOAST ── */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}