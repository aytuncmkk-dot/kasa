// ============================================================
// CONFIG — Supabase ayarları, sabitler
// ============================================================

// Supabase bağlantı bilgileri
var SB_URL = 'https://yvlstnhwtjacaurgzbxz.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2bHN0bmh3dGphY2F1cmd6Ynh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzgxODcsImV4cCI6MjA5MTkxNDE4N30.CaiNFoFMGL1oTDBEwuRtKmperfztxhcwtMdNvwa37DY';
var SB_AUTH_URL = SB_URL;
var SB_AUTH_KEY = SB_KEY;

// Yetkilendirme listeleri
var ADMIN_EMAILS = ['aytunc.mkk@gmail.com'];
var IZINLI_EMAILS = [
  'aytunc.mkk@gmail.com',
  'akkas.ergun@gmail.com',
  'ozlemmekik@gmail.com',
  'engin_akkas@hotmail.com',
  'rizaakkas60@hotmail.com'
];

// Global durum
var mevcutKullanici = null;
var isAdmin = false;
// Header obje — db.js tarafından getSBH() içinde kullanılıyor
var SB_H = {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY};


// State (uygulama verisi)
var kayitlar = [], faturalar = [], fonHareketler = [];
var stoklar = [], stokHareketleri = [], avansHareketler = [];
var gelirKatlar = [], giderKatlar = [], dagitimKatlar = [], ortaklar = [];
var odemeSatirlari = [];
var _duzId = null;
var _tumKayitlar = false;
var _adisyonData = null;
var today = ldStr(new Date());
var thisMonth = today.slice(0, 7);
