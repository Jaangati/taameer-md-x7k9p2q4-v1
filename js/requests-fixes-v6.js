// TAAMEER Requests v6 — authoritative completion + read routing
(() => {
  if (!window.RequestsApp) return;

  const markRead = async (id) => {
    if (!state.currentUser || !id) return;
    const now = new Date().toISOString();
    const { error } = await supabaseClient
      .from('work_request_reads')
      .upsert({ request_id: id, user_id: state.currentUser.id, last_seen_at: now }, { onConflict: 'request_id,user_id' });
    if (error) console.warn('Could not mark request read', error);
  };

  // Replace the old wrapper chain completely. The database trigger now allows assigned users
  // to close requests and records the status history once, so do not call the legacy method.
  RequestsApp.setRequestStatus = async function(id, status) {
    if (!id || !status || !state.currentUser) return;
    const patch = { status };
    if (status === 'in_progress') {
      patch.closed_at = null;
      patch.cancelled_at = null;
      patch.submitted_at = null;
      patch.reopened_at = new Date().toISOString();
    }
    if (status === 'closed') {
      patch.reopened_at = null;
    }
    if (status === 'cancelled') {
      patch.reopened_at = null;
    }

    const { data, error } = await supabaseClient
      .from('work_requests')
      .update(patch)
      .eq('id', id)
      .select('id,status,closed_at,reopened_at')
      .single();

    if (error) {
      console.error('Request status update failed', error);
      alert(error.message || 'Could not update request status.');
      return;
    }

    // Verify the database accepted the requested state instead of trusting the UI.
    if (data?.status !== status) {
      console.error('Request status was not persisted', { requested: status, actual: data?.status, id });
      alert('The request status did not save correctly. Please refresh and try again.');
      return;
    }

    // Mark the action as read AFTER the database/history update so the user's own action
    // cannot return as a fresh unread notification.
    await markRead(id);

    try { document.getElementById('requestsModal')?.remove(); } catch (_) {}

    // Reload from Supabase before changing the visible filter. This prevents stale "NEW" rows.
    try { await RequestsApp.open(); } catch (e) { console.warn('Requests reload failed', e); }
    try {
      if (status === 'closed') RequestsApp.setStatus?.('closed');
      else if (status === 'cancelled') RequestsApp.setStatus?.('cancelled');
      else RequestsApp.setStatus?.('active');
      RequestsApp.updateSidebarBadge?.();
    } catch (_) {}
  };

  // Keep the existing unread controls, but make them authoritative by reloading after marking read.
  if (window.markRequestReadV5) {
    window.markRequestReadV5 = async function(id, e) {
      e?.stopPropagation?.();
      await markRead(id);
      try { await RequestsApp.open(); RequestsApp.setStatus?.('unread'); RequestsApp.updateSidebarBadge?.(); } catch (_) {}
    };
  }

  if (window.markAllRequestsReadV5) {
    window.markAllRequestsReadV5 = async function() {
      if (!state.currentUser) return;
      try {
        const { data, error } = await supabaseClient.from('work_requests').select('id').is('deleted_at', null);
        if (error) throw error;
        const now = new Date().toISOString();
        const rows = (data || []).map(r => ({ request_id: r.id, user_id: state.currentUser.id, last_seen_at: now }));
        if (rows.length) {
          const { error: upsertError } = await supabaseClient.from('work_request_reads').upsert(rows, { onConflict: 'request_id,user_id' });
          if (upsertError) throw upsertError;
        }
        await RequestsApp.open();
        RequestsApp.setStatus?.('unread');
        RequestsApp.updateSidebarBadge?.();
      } catch (e) {
        console.error(e);
        alert('Could not mark request activity as read.');
      }
    };
  }
})();