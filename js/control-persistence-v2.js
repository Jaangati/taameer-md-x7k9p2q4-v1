// Preserve Module Control Center metadata when legacy normalization runs.
(() => {
  if(!window.Store || typeof Store.normalize!=='function') return;
  const baseNormalize=Store.normalize.bind(Store);
  Store.normalize=function(){
    const meta={};
    if(Array.isArray(state.modules)) state.modules.forEach(m=>{meta[String(m.id)]={controlStatus:m.controlStatus,testers:Array.isArray(m.testers)?m.testers:[],maintenanceMessage:m.maintenanceMessage||''};});
    baseNormalize();
    state.modules=state.modules.map(m=>{
      const x=meta[String(m.id)]||{};
      return {...m,controlStatus:x.controlStatus||m.controlStatus||(m.status==='active'?'live':m.status==='soon'?'testing':'hidden'),testers:Array.isArray(x.testers)?x.testers:[],maintenanceMessage:x.maintenanceMessage||m.maintenanceMessage||''};
    });
  };
})();