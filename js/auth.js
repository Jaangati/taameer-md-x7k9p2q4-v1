// ---------- Authentication ----------
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const user = state.users.find(u => u.username === username);
  if (!user) return alert('Invalid credentials!');
  if (user.status !== 'active') return alert('Account is ' + user.status + '. Contact admin.');

  if (!user.password) {
    state.pendingUser = user;
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('setPasswordView').classList.remove('hidden');
    document.getElementById('spName').textContent = user.fullName.split(' ')[0];
    return;
  }

  if (!(await Utils.verifyPassword(password, user.password))) return alert('Invalid credentials!');

  // Transparently upgrade legacy plaintext passwords.
  if (!user.password.startsWith('sha256:')) user.password = await Utils.hashPassword(password);
  user.lastLogin = new Date().toISOString();
  state.currentUser = user;
  localStorage.setItem('taameer_currentUser', JSON.stringify({ id: user.id }));
  save();
  showDashboard();
});

document.getElementById('setPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = document.getElementById('spPassword').value;
  const conf = document.getElementById('spConfirm').value;
  if (pw.length < 6) return alert('Password must be at least 6 characters');
  if (pw !== conf) return alert('Passwords do not match');
  if (!state.pendingUser) return alert('Session expired. Please login again.');
  const idx = state.users.findIndex(u => u.id === state.pendingUser.id);
  if (idx === -1) return alert('User not found.');
  state.users[idx].password = await Utils.hashPassword(pw);
  state.users[idx].lastLogin = new Date().toISOString();
  state.currentUser = state.users[idx];
  state.pendingUser = null;
  localStorage.setItem('taameer_currentUser', JSON.stringify({ id: state.currentUser.id }));
  save();
  document.getElementById('setPasswordView').classList.add('hidden');
  document.getElementById('loginForm').reset();
  showDashboard();
});

function checkAuth() {
  const saved = Utils.parseJSON(localStorage.getItem('taameer_currentUser'), null);
  if (!saved?.id) return;
  const fresh = state.users.find(x => x.id === saved.id && x.status === 'active');
  if (!fresh) { localStorage.removeItem('taameer_currentUser'); return; }
  if (!fresh.password) {
    state.pendingUser = fresh;
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('setPasswordView').classList.remove('hidden');
    document.getElementById('spName').textContent = fresh.fullName.split(' ')[0];
    return;
  }
  state.currentUser = fresh;
  showDashboard();
}
function logout() { state.currentUser = null; localStorage.removeItem('taameer_currentUser'); closeUserDropdown(); document.getElementById('loginView').classList.remove('hidden'); document.getElementById('dashboardView').classList.add('hidden'); document.getElementById('setPasswordView').classList.add('hidden'); document.getElementById('loginForm').reset(); }
