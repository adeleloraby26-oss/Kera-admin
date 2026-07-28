// --- Supabase setup ---------------------------------------------------
  // Use the service_role key here (Project Settings → API), NOT the anon key —
  // this dashboard needs to read every row, bypassing row-level security.
  // Keep this file off any public URL, or put it behind your own login first.
  const SUPABASE_URL = 'https://xehbsvnmlyhvxiwconne.supabase.co';
  const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlaGJzdm5tbHlodnhpd2Nvbm5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI3MTYxNywiZXhwIjoyMTAwODQ3NjE3fQ.Zf7z8M9s3fh4Wh996EPMIiklVe8Y5ne7bpvGZNTsz1o';

  const configured = !SUPABASE_URL.startsWith('https://YOUR') && window.supabase;
  const supabaseClient = configured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

  const iconMap = { location: '📍', camera: '📷', mic: '🎤', notif: '🔔', files: '📁' };
  const nameMap = { location: 'Location', camera: 'Camera', mic: 'Microphone', notif: 'Notifications', files: 'Files & Photos' };

  const counts = { sessions: 0, events: 0, granted: 0, denied: 0, consents: 0 };

  function fmtTime(iso){
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit' });
  }

  function updateStats(){
    document.getElementById('statSessions').textContent = counts.sessions;
    document.getElementById('statEvents').textContent = counts.events;
    document.getElementById('statGranted').textContent = counts.granted;
    document.getElementById('statDenied').textContent = counts.denied;
    document.getElementById('statConsents').textContent = counts.consents;
  }

  function pushFeedRow(html){
    const feed = document.getElementById('feed');
    const emptyState = feed.querySelector('.empty');
    if(emptyState) emptyState.remove();
    feed.insertAdjacentHTML('afterbegin', html);
    // keep the feed from growing forever
    while(feed.children.length > 200){
      feed.removeChild(feed.lastElementChild);
    }
  }

  function renderEvent(row){
    counts.events++;
    if(row.status === 'granted') counts.granted++;
    if(row.status === 'denied') counts.denied++;
    updateStats();

    const icon = iconMap[row.permission] || '•';
    const name = nameMap[row.permission] || row.permission;
    const detail = row.detail ? row.detail.replace(/</g,'&lt;') : '';

    pushFeedRow(`
      <div class="feed-row">
        <div class="feed-icon">${icon}</div>
        <div class="feed-body">
          <div class="feed-top">
            <div class="feed-name">${name}</div>
            <span class="feed-badge ${row.status}">${row.status}</span>
          </div>
          ${detail ? `<div class="feed-meta">${detail}</div>` : ''}
        </div>
        <div class="feed-time">${fmtTime(row.created_at)}</div>
      </div>
    `);
  }

  function renderConsent(row){
    counts.consents++;
    updateStats();
    pushFeedRow(`
      <div class="feed-row">
        <div class="feed-icon">✅</div>
        <div class="feed-body">
          <div class="feed-top">
            <div class="feed-name">Agreement completed</div>
            <span class="feed-badge granted">signed</span>
          </div>
          <div class="feed-meta">privacy: ${row.privacy_ack} · permissions: ${row.permissions_ack} · agree: ${row.agree}</div>
        </div>
        <div class="feed-time">${fmtTime(row.created_at)}</div>
      </div>
    `);
  }

  function renderSession(){
    counts.sessions++;
    updateStats();
  }

  async function loadHistory(){
    const [{ data: sessions }, { data: events }, { data: consents }] = await Promise.all([
      supabaseClient.from('kira_sessions').select('id').order('created_at', { ascending: true }),
      supabaseClient.from('kira_permission_events').select('*').order('created_at', { ascending: true }).limit(200),
      supabaseClient.from('kira_consents').select('*').order('created_at', { ascending: true })
    ]);
    counts.sessions = sessions ? sessions.length : 0;
    (events || []).forEach(e => { counts.events++; if(e.status==='granted') counts.granted++; if(e.status==='denied') counts.denied++; });
    counts.consents = consents ? consents.length : 0;
    updateStats();

    const combined = [
      ...(events || []).map(e => ({ ...e, __type: 'event' })),
      ...(consents || []).map(c => ({ ...c, __type: 'consent' }))
    ].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    document.getElementById('feed').innerHTML = '';
    if(combined.length === 0){
      document.getElementById('feed').innerHTML = '<div class="empty">No activity yet — try a permission on kira-permissions.html.</div>';
    } else {
      // re-render oldest→newest so insertAdjacentHTML('afterbegin') ends with newest on top
      combined.forEach(row => row.__type === 'event' ? renderEventNoCounts(row) : renderConsentNoCounts(row));
    }
  }

  // history versions that skip re-incrementing counts (already counted above)
  function renderEventNoCounts(row){
    const icon = iconMap[row.permission] || '•';
    const name = nameMap[row.permission] || row.permission;
    const detail = row.detail ? row.detail.replace(/</g,'&lt;') : '';
    pushFeedRow(`
      <div class="feed-row">
        <div class="feed-icon">${icon}</div>
        <div class="feed-body">
          <div class="feed-top">
            <div class="feed-name">${name}</div>
            <span class="feed-badge ${row.status}">${row.status}</span>
          </div>
          ${detail ? `<div class="feed-meta">${detail}</div>` : ''}
        </div>
        <div class="feed-time">${fmtTime(row.created_at)}</div>
      </div>
    `);
  }
  function renderConsentNoCounts(row){
    pushFeedRow(`
      <div class="feed-row">
        <div class="feed-icon">✅</div>
        <div class="feed-body">
          <div class="feed-top">
            <div class="feed-name">Agreement completed</div>
            <span class="feed-badge granted">signed</span>
          </div>
          <div class="feed-meta">privacy: ${row.privacy_ack} · permissions: ${row.permissions_ack} · agree: ${row.agree}</div>
        </div>
        <div class="feed-time">${fmtTime(row.created_at)}</div>
      </div>
    `);
  }

  async function init(){
    if(!configured){
      document.getElementById('setupNote').classList.add('show');
      document.getElementById('connDot').classList.add('off');
      document.getElementById('connLabel').textContent = 'not configured';
      return;
    }

    await loadHistory();

    const channel = supabaseClient
      .channel('kira-admin-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kira_sessions' }, () => renderSession())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kira_permission_events' }, (payload) => renderEvent(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kira_consents' }, (payload) => renderConsent(payload.new))
      .subscribe((status) => {
        const dot = document.getElementById('connDot');
        const label = document.getElementById('connLabel');
        if(status === 'SUBSCRIBED'){
          dot.classList.remove('off'); dot.classList.add('on');
          label.textContent = 'live';
        } else if(status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
          dot.classList.remove('on'); dot.classList.add('off');
          label.textContent = 'disconnected';
        } else {
          label.textContent = status.toLowerCase();
        }
      });
  }

  init();
