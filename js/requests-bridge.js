// Requests runtime bridge — guarantees the module opens from navigation.
(function(){
  function getRequestsApp(){
    try {
      if (window.RequestsApp?.open) return window.RequestsApp;
      if (typeof RequestsApp !== 'undefined' && RequestsApp?.open) {
        window.RequestsApp = RequestsApp;
        return RequestsApp;
      }
    } catch (_) {}
    return null;
  }

  async function openRequestsSafely(){
    const target = document.getElementById('view-requests');
    const app = getRequestsApp();
    if (!app) {
      if (target && !target.classList.contains('hidden')) {
        target.innerHTML = '<div class="h-full flex items-center justify-center p-8"><div class="rounded-2xl bg-white border border-red-200 shadow-sm p-6 text-center"><div class="font-bold text-red-600">Requests module did not initialize</div><div class="text-xs text-gray-500 mt-2">Please refresh once. If this remains, the runtime error will be shown here.</div></div></div>';
      }
      return;
    }
    try {
      await app.open();
    } catch (err) {
      console.error('Requests bridge open failed', err);
      if (target) {
        const msg = String(err?.message || err || 'Unknown error').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        target.innerHTML = `<div class="h-full flex items-center justify-center p-8"><div class="max-w-xl rounded-2xl bg-white border border-red-200 shadow-sm p-6 text-center"><div class="font-bold text-red-600">Requests could not load</div><div class="text-xs text-gray-500 mt-2 break-words">${msg}</div></div></div>`;
      }
    }
  }

  function install(){
    const original = window.showView;
    if (typeof original !== 'function' || original.__requestsBridgeWrapped) return;
    function wrappedShowView(viewName){
      const result = original.apply(this, arguments);
      if (viewName === 'requests') setTimeout(openRequestsSafely, 0);
      return result;
    }
    wrappedShowView.__requestsBridgeWrapped = true;
    window.showView = wrappedShowView;
  }

  window.openRequestsSafely = openRequestsSafely;
  install();
  document.addEventListener('DOMContentLoaded', install, {once:true});
})();
