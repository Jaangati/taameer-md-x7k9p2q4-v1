// TAAMEER Module State Persistence v3 — preserve full module control metadata
(() => {
  if(!window.Store || typeof Store.normalize !== 'function') return;
  const previousNormalize = Store.normalize.bind(Store);
  Store.normalize = function(){
    const before = new Map((Array.isArray(state.modules)?state.modules:[]).map(m=>[String(m.id),{...m}]));
    previousNormalize();
    state.modules = (state.modules||[]).map(m=>{
      const meta = before.get(String(m.id)) || {};
      return {...meta,...m};
    });
  };
})();