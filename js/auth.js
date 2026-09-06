// ---------- Authentication ----------
function profileToUser(profile, authUser) {
  return {
    id: profile.id,
    username: profile.username || authUser?.email?.split('@')[0] || 'user',
    password: '',
    fullName: profile.full_name || authUser?.email || 'User',
    jobTitle: profile.job_title || '',
    email: profile.email || authUser?.email || '',
    phone: profile.phone || '',
    role: profile.role === 'admin' ? 'admin' : 'user',
    status: profile.status || 'active',
    avatar: profile.avatar || null,
    lastLogin: authUser?.last_sign_in_at || null,
    modules: Array.isArray(profile.modules) ? profile.modules : [],
    accentColor: profile.accent_color || null
  };
}

async function loadAuthenticatedProfile(authUser) {
  if (!supabaseClient || !authUser) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();
  if (error) throw error;
  return profileToUser(data, authUser);
}

async function completeAuthenticatedSession(authUser) {
  await loadFromCloud();
  Store.normalize();
  const profileUser = await loadAuthenticatedProfile(authUser);
  if (!profileUser || profileUser.status !== 'active') {
    await supabaseClient.auth.signOut();
    throw new Error('Your account is not active. Contact Department Management.');
  }
  state.currentUser = profileUser;
  loadSystemAccent();
  ModuleRegistry.ensureAll();
  showDashboard();

  // Team Updates must start for every authenticated session, even when the user
  // never opens the notification centre. This drives the unread badge, sound,
  // desktop/in-app alerts, and live seen/confirmation state.
  if (typeof initTeamUpdates === 'function') {
    try {
      await initTeamUpdates();
    } catch (error) {
      console.error('TAAMEER Team Updates failed to initialize', error);
    }
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const identity = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!identity || !password) return;

  let email = identity;
  if (!identity.includes('@')) {
    const cached = state.users.find(u => u.username?.toLowerCase() === identity.toLowerCase());
    email = cached?.email || '';
  }
  if (!email) return alert('Please sign in using your work email.');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (!error && data?.user) {
      await completeAuthenticatedSession(data.user);
      return;
    }

    // First secure login: create the Supabase Auth account.
    // The database trigger only allows emails already approved by Department Management.
    const { data: signup, error: signupError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { source: 'taameer-dashboard-activation' } }
    });
    if (signupError) throw signupError;
    if (signup?.session && signup?.user) {
      await completeAuthenticatedSession(signup.user);
      return;
    }
    alert('Account activation started. Please check your work email to confirm your account, then sign in again.');
  } catch (error) {
    console.error('TAAMEER Auth error', error);
    alert(error?.message || 'Unable to sign in. Please contact Department Management.');
  }
});

// Legacy first-login screen now activates the secure Supabase account.
document.getElementById('setPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = document.getElementById('spPassword').value;
  const conf = document.getElementById('spConfirm').value;
  if (pw.length < 8) return alert('Password must be at least 8 characters');
  if (pw !== conf) return alert('Passwords do not match');
  const email = state.pendingUser?.email;
  if (!email) return alert('Please return to sign in and use your work email.');
  const { data, error } = await supabaseClient.auth.signUp({ email, password: pw });
  if (error) return alert(error.message);
  state.pendingUser = null;
  document.getElementById('setPasswordView').classList.add('hidden');
  if (data?.session && data?.user) return completeAuthenticatedSession(data.user);
  alert('Please check your work email to confirm your account, then sign in.');
  document.getElementById('loginView').classList.remove('hidden');
});

async function checkAuth() {
  if (!supabaseClient) return false;
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user) return false;
    await completeAuthenticatedSession(data.session.user);
    return true;
  } catch (error) {
    console.error('TAAMEER session restore failed', error);
    await supabaseClient.auth.signOut();
    return false;
  }
}

async function logout() {
  try { await supabaseClient?.auth.signOut(); } catch (error) { console.warn('Sign out failed', error); }
  state.currentUser = null;
  closeUserDropdown();
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('setPasswordView').classList.add('hidden');
  document.getElementById('loginForm').reset();
}
