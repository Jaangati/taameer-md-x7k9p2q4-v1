// ---------- Accent / theme ----------
const TAAMEER_DEFAULT_ACCENT = '#757575';
function applyAccentCSS(color) {
  const c = Utils.validColor(color);
  document.documentElement.style.setProperty('--accent', c);
  document.documentElement.style.setProperty('--accent-soft', c + '1F');
  document.documentElement.style.setProperty('--accent-hover', c + '38');
}
function applyLoginAccent() {
  const saved = localStorage.getItem('taameer_last_personal_accent');
  const c = Utils.validColor(saved || TAAMEER_DEFAULT_ACCENT);
  document.documentElement.style.setProperty('--login-accent', c);
  if (!state.currentUser) applyAccentCSS(c);
}
function applyActiveAccent() {
  const c = Utils.validColor(state.currentUser?.accentColor || state.settings.accent || TAAMEER_DEFAULT_ACCENT);
  applyAccentCSS(c);
  document.documentElement.style.setProperty('--login-accent', c);
}
function setAccent(el) { applySystemAccent(el.dataset.color, el.dataset.name); document.querySelectorAll('#colorPicker .color-swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); document.getElementById('customColor').value = el.dataset.color; document.getElementById('customColorHex').textContent = el.dataset.color; }
function setCustomAccent(color) { applySystemAccent(color, 'Custom'); document.querySelectorAll('#colorPicker .color-swatch').forEach(s => s.classList.remove('active')); document.getElementById('customColorHex').textContent = color; }
function applySystemAccent(color, name) { state.settings.accent = Utils.validColor(color); state.settings.accentName = name; if (!state.currentUser?.accentColor) applyAccentCSS(color); save(); }
function loadSystemAccent() {
  const s = state.settings;
  if (!state.currentUser) applyLoginAccent(); else applyActiveAccent();
  const c = Utils.validColor(s.accent || TAAMEER_DEFAULT_ACCENT);
  document.getElementById('customColor').value = c;
  document.getElementById('customColorHex').textContent = c;
  const swatch = document.querySelector(`#colorPicker .color-swatch[data-color="${c}"]`);
  if (swatch) { document.querySelectorAll('#colorPicker .color-swatch').forEach(x => x.classList.remove('active')); swatch.classList.add('active'); }
}
function setPersonalAccent(el) { applyPersonalAccent(el.dataset.color); document.querySelectorAll('#personalColorPicker .color-swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); document.getElementById('personalCustomColor').value = el.dataset.color; document.getElementById('personalCustomColorHex').textContent = el.dataset.color; }
function setPersonalCustomAccent(color) { applyPersonalAccent(color); document.querySelectorAll('#personalColorPicker .color-swatch').forEach(s => s.classList.remove('active')); document.getElementById('personalCustomColorHex').textContent = color; }
async function applyPersonalAccent(color) {
  if (!state.currentUser) return;
  const c = Utils.validColor(color);
  const { error } = await supabaseClient.from('profiles').update({ accent_color: c }).eq('id', state.currentUser.id);
  if (error) return alert('Could not save personal color.');
  state.currentUser.accentColor = c;
  localStorage.setItem('taameer_last_personal_accent', c);
  document.documentElement.style.setProperty('--login-accent', c);
  applyAccentCSS(c);
}
async function resetPersonalAccent() {
  if (!state.currentUser) return;
  const { error } = await supabaseClient.from('profiles').update({ accent_color: null }).eq('id', state.currentUser.id);
  if (error) return alert('Could not reset personal color.');
  state.currentUser.accentColor = null;
  localStorage.removeItem('taameer_last_personal_accent');
  document.documentElement.style.setProperty('--login-accent', TAAMEER_DEFAULT_ACCENT);
  applyAccentCSS(state.settings.accent || TAAMEER_DEFAULT_ACCENT);
  refreshPersonalColorPicker(null);
}
function refreshPersonalColorPicker(color) { document.querySelectorAll('#personalColorPicker .color-swatch').forEach(s => s.classList.remove('active')); if (color) { const swatch = document.querySelector(`#personalColorPicker .color-swatch[data-color="${color}"]`); if (swatch) swatch.classList.add('active'); document.getElementById('personalCustomColor').value = color; document.getElementById('personalCustomColorHex').textContent = color; } else { document.getElementById('personalCustomColor').value = state.settings.accent; document.getElementById('personalCustomColorHex').textContent = state.settings.accent; } }
function toggleTheme() { const html = document.documentElement; html.classList.toggle('dark'); localStorage.setItem('taameer_theme', html.classList.contains('dark') ? 'dark' : 'light'); document.getElementById('darkToggle')?.classList.toggle('on', html.classList.contains('dark')); }
function loadTheme() { if (localStorage.getItem('taameer_theme') === 'dark') document.documentElement.classList.add('dark'); applyLoginAccent(); }
