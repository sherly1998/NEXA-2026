// Isi dua nilai ini setelah membuat project Supabase Anda.
// Gunakan "Project URL" dan "Publishable key" (atau legacy anon key), BUKAN secret key.
window.NEXA_CONFIG = {
  supabaseUrl: 'PASTE_SUPABASE_PROJECT_URL_HERE',
  supabaseAnonKey: 'PASTE_SUPABASE_ANON_KEY_HERE'
};
const pbNexaPhase2 = document.createElement('script');
pbNexaPhase2.src = 'phase-2.js';
document.head.appendChild(pbNexaPhase2);
const pbNexaPhase3 = document.createElement('script');
pbNexaPhase3.src = 'phase-3.js';
document.head.appendChild(pbNexaPhase3);
const pbNexaPhase4 = document.createElement('script');
pbNexaPhase4.src = 'phase-4.js';
document.head.appendChild(pbNexaPhase4);
const pbNexaPhase5 = document.createElement('script');
pbNexaPhase5.src = 'phase-5.js';
document.head.appendChild(pbNexaPhase5);
