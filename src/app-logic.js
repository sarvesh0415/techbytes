import { supabase as _supabase } from './supabaseClient';

// ═══ STATE ═══════════════════════════════════════════════════
let currentUser = null,
    currentAuthMode = 'signin',
    currentView = 'feed',
    prevView = 'feed';

let uploadedImageData = null,
    aiImageUrl = null,
    useAIImage = false,
    lastKeywords = '';

let allFeedPosts = [],
    activeFilter = 'All',
    autoSaveTimer = null,
    currentReadPost = null;

let followingSet = new Set(),
    likedPosts = new Set();

let userAvatarUrl = null; // base64 avatar stored in localStorage
let regenCounter = 0;     // increments on "New Image" click for different results

const PEXELS_API_KEY = 'XrMHBVNp8PKxNVaUJUzWusdj73xlbsQj56aYFkRCXInnTWdF2bqJ5H3j';


// ═══ THEME ═══════════════════════════════════════════════════
function toggleTheme() {
  const h = document.documentElement,
        isDark = h.getAttribute('data-theme') === 'dark';
  h.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('tb_theme', isDark ? 'light' : 'dark');
}


// ═══ UTILS ═══════════════════════════════════════════════════
function generateSlug(t) {
  return (t || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60) || 'untitled';
}

function onTitleChange() {
  document.getElementById('slugDisplay').textContent =
    generateSlug(document.getElementById('titleInput').value) || 'your-blog-title';
  scheduleAutoSave();
}

function calcReadTime(text) {
  const w = text ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(w / 200)) + ' min read';
}

function getInitial(email) {
  return (email || '?')[0].toUpperCase();
}

function avatarColor(str) {
  const c = ['#7c5cfc', '#e05cfc', '#f0b429', '#4ade80', '#fc5c7d', '#38bdf8'];
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xfffffff;
  }
  return c[h % c.length];
}

// Clean display name — strip numbers and show only letters
function displayName(email) {
  return (email || '')
    .split('@')[0]
    .replace(/\d+/g, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim() || 'Writer';
}


// ═══ AVATAR UPLOAD ════════════════════════════════════════════
function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    userAvatarUrl = e.target.result;
    localStorage.setItem('tb_avatar_' + currentUser?.id, userAvatarUrl);
    updateAllAvatarDisplays();
    showToast('', 'Profile picture updated!');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function updateAllAvatarDisplays() {
  const el = document.getElementById('profileAvatarEl');
  if (el) {
    if (userAvatarUrl) {
      el.innerHTML = `<img src="${userAvatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      el.textContent = getInitial(currentUser?.email || '?');
    }
  }
}

function loadUserAvatar() {
  if (!currentUser) return;
  userAvatarUrl = localStorage.getItem('tb_avatar_' + currentUser.id) || null;
  updateAllAvatarDisplays();
}

function getAvatarImgTag(userId, email, size) {
  const savedAvatar = localStorage.getItem('tb_avatar_' + userId);
  const color = avatarColor(userId || '');
  const initial = getInitial(email || '?');
  if (savedAvatar) {
    return `<img src="${savedAvatar}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;">`;
  }
  return `<span style="font-size:${Math.round(size * 0.4)}px;">${initial}</span>`;
}


// ═══ VIEW SWITCHING ═══════════════════════════════════════════
function switchView(view) {
  // Hide all views
  ['feedView', 'editorView', 'myblogsView', 'readView'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  // Remove active class from all nav tabs
  ['navFeed', 'navWrite', 'navMyBlogs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  document.getElementById('headerPublishBtn').classList.remove('show');

  // Show the requested view
  if (view === 'feed') {
    document.getElementById('feedView').style.display = 'block';
    document.getElementById('navFeed').classList.add('active');
    loadFeed();
    loadSidebar();
  } else if (view === 'editor') {
    document.getElementById('editorView').style.display = 'block';
    document.getElementById('navWrite').classList.add('active');
    document.getElementById('headerPublishBtn').classList.add('show');
  } else if (view === 'myblogs') {
    document.getElementById('myblogsView').style.display = 'block';
    document.getElementById('navMyBlogs').classList.add('active');
    loadMyBlogs();
  } else if (view === 'read') {
    document.getElementById('readView').style.display = 'block';
  }

  prevView = currentView;
  currentView = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function readGoBack() {
  switchView(prevView === 'read' ? 'feed' : prevView);
}


// ═══ WORD COUNT + GOAL ════════════════════════════════════════
function countWords() {
  const text = document.getElementById('blogBody').value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  const el = document.getElementById('charCount');
  el.textContent = count + ' word' + (count !== 1 ? 's' : '');
  el.className = 'char-count';
  document.getElementById('blogBody').className = 'blog-body';
  updateWordGoal(count);
  scheduleAutoSave();
}

function updateWordGoal(count) {
  if (count === undefined) {
    const t = document.getElementById('blogBody').value.trim();
    count = t ? t.split(/\s+/).length : 0;
  }
  const goal = parseInt(document.getElementById('wordGoalSelect').value);
  const bar = document.getElementById('wgBar'),
        status = document.getElementById('wgStatus');

  if (!goal) {
    bar.style.width = '0%';
    status.textContent = '';
    return;
  }

  const pct = Math.min(100, Math.round((count / goal) * 100));
  bar.style.width = pct + '%';
  bar.className = pct >= 100 ? 'wg-bar done' : 'wg-bar';

  if (pct >= 100) {
    status.textContent = 'Goal!';
  } else if (pct >= 80) {
    status.textContent = (goal - count) + ' to go';
    document.getElementById('charCount').className = 'char-count warn';
    document.getElementById('blogBody').className = 'blog-body warn';
  } else {
    status.textContent = (goal - count) + ' to go';
  }
}


// ═══ AUTO-SAVE ════════════════════════════════════════════════
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(triggerAutoSave, 30000);
}

async function triggerAutoSave() {
  if (!currentUser) return;

  const title = document.getElementById('titleInput').value.trim();
  const body = document.getElementById('blogBody').value.trim();
  if (!title && !body) return;

  try {
    const draft = {
      user_id: currentUser.id,
      title,
      body,
      caption: document.getElementById('captionInput').value.trim(),
      category: document.querySelector('.cat-chip.active')?.textContent || null,
      slug: generateSlug(title),
      image_url: (useAIImage && aiImageUrl) ? aiImageUrl : null,
      is_draft: true,
      claps: 0,
      author_email: currentUser.email
    };

    const { data: ex } = await _supabase
      .from('posts')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('is_draft', true)
      .maybeSingle();

    if (ex) {
      await _supabase.from('posts').update(draft).eq('id', ex.id);
    } else {
      await _supabase.from('posts').insert([draft]);
    }

    const ind = document.getElementById('autosaveTag');
    ind.classList.add('show');
    setTimeout(() => ind.classList.remove('show'), 3000);
  } catch (e) {}
}


// ═══ FEED ═════════════════════════════════════════════════════
async function loadFeed() {
  const grid = document.getElementById('feedGrid');
  grid.innerHTML = '';

  // Show skeleton loading cards
  for (let i = 0; i < 6; i++) {
    grid.innerHTML += `
      <div class="card-skeleton">
        <div class="card-skel-img"></div>
        <div class="card-skel-body">
          <div class="card-skel-line" style="width:40%"></div>
          <div class="card-skel-line" style="width:80%"></div>
          <div class="card-skel-line" style="width:55%"></div>
        </div>
      </div>`;
  }

  try {
    const { data, error } = await _supabase
      .from('posts')
      .select('*')
      .eq('is_draft', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    allFeedPosts = data || [];
    renderFeedGrid();
  } catch (e) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Could not load posts</div>
        <div class="empty-state-sub">${e.message}</div>
      </div>`;
  }
}

function renderFeedGrid() {
  const grid = document.getElementById('feedGrid');
  grid.innerHTML = '';

  const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  let posts = allFeedPosts;

  if (activeFilter !== 'All') {
    posts = posts.filter(p => p.category === activeFilter);
  }
  if (q) {
    posts = posts.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.body || '').toLowerCase().includes(q)
    );
  }

  if (!posts.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No posts found</div>
        <div class="empty-state-sub">Be the first to write something!</div>
        <button class="btn btn-primary" onclick="switchView('editor')">✏️ Write a Blog</button>
      </div>`;
    return;
  }

  posts.forEach(post => grid.appendChild(buildCard(post, 'feed')));
}

function setFilter(cat, el) {
  activeFilter = cat;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFeedGrid();
}

function filterPosts() {
  renderFeedGrid();
}


// ═══ MY BLOGS ════════════════════════════════════════════════
async function loadMyBlogs() {
  if (!currentUser) return;

  const grid = document.getElementById('myBlogsGrid');
  grid.innerHTML = '';

  // Show skeleton loading cards
  for (let i = 0; i < 3; i++) {
    grid.innerHTML += `
      <div class="card-skeleton">
        <div class="card-skel-img"></div>
        <div class="card-skel-body">
          <div class="card-skel-line" style="width:40%"></div>
          <div class="card-skel-line" style="width:80%"></div>
          <div class="card-skel-line" style="width:55%"></div>
        </div>
      </div>`;
  }

  try {
    const { data, error } = await _supabase
      .from('posts')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('is_draft', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    grid.innerHTML = '';

    if (!data || !data.length) {
      document.getElementById('myBlogsMeta').textContent = '0 posts published';
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No blogs yet</div>
          <div class="empty-state-sub">Start writing your first blog!</div>
          <button class="btn btn-primary" onclick="switchView('editor')">✏️ Write Your First Blog</button>
        </div>`;
      return;
    }

    document.getElementById('myBlogsMeta').textContent =
      `${data.length} blog${data.length !== 1 ? 's' : ''} published`;
    data.forEach(post => grid.appendChild(buildCard(post, 'mine')));
  } catch (e) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Error loading blogs</div>
        <div class="empty-state-sub">${e.message}</div>
      </div>`;
  }
}


// ═══ BUILD CARD ════════════════════════════════════════════════
function buildCard(post, mode) {
  const card = document.createElement('div');
  card.className = 'blog-card';

  const date = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
  const rt = calcReadTime(post.body);
  const authorName = displayName(post.author_email || currentUser?.email || '');
  const color = avatarColor(post.user_id || '');
  const avatarHtml = getAvatarImgTag(post.user_id, post.author_email, 22);
  const isLiked = likedPosts.has(post.id);

  card.innerHTML = `
    ${post.image_url
      ? `<img class="blog-card-img" src="${post.image_url}" alt="${post.title || ''}" onerror="this.style.display='none'">`
      : `<div class="blog-card-img-placeholder">📝</div>`
    }
    <div class="blog-card-body">
      ${post.category ? `<div class="blog-card-category">${post.category}</div>` : ''}
      <div class="blog-card-title">${post.title || 'Untitled'}</div>
      <div class="blog-card-excerpt">${post.body || ''}</div>
      <div class="blog-card-footer">
        <div class="blog-card-author">
          <div class="author-avatar-sm" style="background:${color}">${avatarHtml}</div>
          <div>
            <div class="blog-card-meta">${authorName}</div>
            <div class="blog-card-meta">⏱ ${rt}</div>
          </div>
        </div>
        <div class="blog-card-actions">
          <button class="btn-read" onclick='openRead(${JSON.stringify(post).replace(/'/g, "&#39;")})'>Read →</button>
          ${mode === 'mine'
            ? `<button class="btn-del" data-id="${post.id}" onclick="deletePost('${post.id}',this)">delete</button>`
            : ''
          }
        </div>
      </div>
    </div>
    <div class="like-row">
      <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="quickLike('${post.id}',this)">
        ❤️ <span class="like-num">${post.claps || 0}</span>
      </button>
      <span style="font-size:.72rem;color:var(--muted);">${date}</span>
    </div>`;

  return card;
}


// ═══ QUICK LIKE (on card) ═════════════════════════════════════
async function quickLike(postId, btn) {
  burstEffect(btn, '❤️');
  const wasLiked = likedPosts.has(postId);

  if (wasLiked) {
    likedPosts.delete(postId);
    btn.classList.remove('liked');
  } else {
    likedPosts.add(postId);
    btn.classList.add('liked');
  }

  try {
    const { data } = await _supabase
      .from('posts')
      .select('claps')
      .eq('id', postId)
      .single();

    const cur = data?.claps || 0;
    const newVal = wasLiked ? Math.max(0, cur - 1) : cur + 1;

    await _supabase.from('posts').update({ claps: newVal }).eq('id', postId);

    const numEl = btn.querySelector('.like-num');
    if (numEl) numEl.textContent = newVal;

    const idx = allFeedPosts.findIndex(p => p.id === postId);
    if (idx > -1) allFeedPosts[idx].claps = newVal;
  } catch (e) {}
}

function burstEffect(el, emoji) {
  const rect = el.getBoundingClientRect();
  const burst = document.createElement('div');
  burst.className = 'like-burst';
  burst.textContent = emoji;
  burst.style.left = (rect.left + rect.width / 2 - 12) + 'px';
  burst.style.top = (rect.top - 10) + 'px';
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 650);
}


// ═══ DELETE POST ══════════════════════════════════════════════
async function deletePost(postId, btn) {
  if (!confirm('Delete this blog post? This cannot be undone.')) return;
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const { error } = await _supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    const card = btn.closest('.blog-card');
    card.style.opacity = '0';
    card.style.transform = 'scale(.95)';
    card.style.transition = 'all .3s ease';
    setTimeout(() => { card.remove(); loadMyBlogs(); }, 300);

    showToast('delete', 'Blog deleted.');
    loadPostsCount();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'delete';
    showToast('⚠️', 'Could not delete: ' + e.message);
    console.error('Delete error:', e);
  }
}


// ═══ READ VIEW ════════════════════════════════════════════════
function openRead(post) {
  currentReadPost = post;
  prevView = currentView;
  switchView('read');

  const cover = document.getElementById('readCover');
  if (post.image_url) {
    cover.src = post.image_url;
    cover.style.display = 'block';
  } else {
    cover.style.display = 'none';
  }

  document.getElementById('readCategory').textContent = post.category || '';
  document.getElementById('readTitle').textContent = post.title || 'Untitled';

  const color = avatarColor(post.user_id || '');
  const avatarEl = document.getElementById('readAuthorAvatar');
  avatarEl.style.background = color;

  const savedAv = localStorage.getItem('tb_avatar_' + post.user_id);
  if (savedAv) {
    avatarEl.innerHTML = `<img src="${savedAv}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.textContent = getInitial(post.author_email || '?');
  }

  document.getElementById('readAuthorName').textContent = displayName(post.author_email || '');
  document.getElementById('readAuthorMeta').textContent =
    new Date(post.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    }) + ' · ' + calcReadTime(post.body);

  document.getElementById('readSlug').textContent =
    '🔗 techbytes.com/blog/' + (post.slug || generateSlug(post.title || ''));

  const cap = document.getElementById('readCaption');
  if (post.caption) {
    cap.textContent = '"' + post.caption + '"';
    cap.style.display = 'block';
  } else {
    cap.style.display = 'none';
  }

  document.getElementById('readContent').textContent = post.body || '';

  // Likes
  const liked = likedPosts.has(post.id);
  const bigBtn = document.getElementById('bigLikeBtn');
  bigBtn.className = 'big-like-btn' + (liked ? ' liked' : '');
  document.getElementById('bigLikeCount').textContent = post.claps || 0;
  document.getElementById('likeMsg').textContent = liked ? 'You liked this!' : 'Like this post!';
}

async function handleReadLike() {
  if (!currentReadPost) return;
  const btn = document.getElementById('bigLikeBtn');
  burstEffect(btn, '❤️');

  const wasLiked = likedPosts.has(currentReadPost.id);
  if (wasLiked) {
    likedPosts.delete(currentReadPost.id);
    btn.classList.remove('liked');
    document.getElementById('likeMsg').textContent = 'Like this post!';
  } else {
    likedPosts.add(currentReadPost.id);
    btn.classList.add('liked');
    document.getElementById('likeMsg').textContent = '❤️ Thanks for the like!';
  }

  try {
    const { data } = await _supabase
      .from('posts')
      .select('claps')
      .eq('id', currentReadPost.id)
      .single();

    const cur = data?.claps || 0;
    const newVal = wasLiked ? Math.max(0, cur - 1) : cur + 1;

    await _supabase.from('posts').update({ claps: newVal }).eq('id', currentReadPost.id);
    document.getElementById('bigLikeCount').textContent = newVal;
    currentReadPost.claps = newVal;
  } catch (e) {}
}


// ═══ SIDEBAR ══════════════════════════════════════════════════
async function loadSidebar() {
  if (!currentUser) return;

  // Profile card
  document.getElementById('profileCard').style.display = 'block';
  const name = displayName(currentUser.email || '');
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileEmailSidebar').textContent = currentUser.email || '';
  loadUserAvatar();
  await loadFollows();
  document.getElementById('statFollowers').textContent = followingSet.size;

  try {
    const { count: pc } = await _supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('is_draft', false);

    document.getElementById('statPosts').textContent = pc || 0;

    const { data: cd } = await _supabase
      .from('posts')
      .select('claps')
      .eq('user_id', currentUser.id)
      .eq('is_draft', false);

    document.getElementById('statLikes').textContent =
      (cd || []).reduce((s, p) => s + (p.claps || 0), 0);
  } catch (e) {}

  // Who to follow — fetch OTHER users posts
  try {
    const { data: otherPosts } = await _supabase
      .from('posts')
      .select('user_id,category,author_email')
      .eq('is_draft', false)
      .neq('user_id', currentUser.id)
      .limit(50);

    const seen = new Set();
    const suggestions = [];

    (otherPosts || []).forEach(p => {
      if (p.user_id && !seen.has(p.user_id) && suggestions.length < 5) {
        seen.add(p.user_id);
        suggestions.push(p);
      }
    });

    const fl = document.getElementById('followList');
    fl.innerHTML = '';

    if (!suggestions.length) {
      fl.innerHTML = `<div style="font-size:.82rem;color:var(--muted);">No other writers yet.<br>Be the first to invite someone!</div>`;
    } else {
      suggestions.forEach(s => {
        const color = avatarColor(s.user_id || '');
        const email = s.author_email || 'writer@techbytes.com';
        const name = displayName(email);
        const isFollowing = followingSet.has(s.user_id);
        const savedAv = localStorage.getItem('tb_avatar_' + s.user_id);

        const div = document.createElement('div');
        div.className = 'follow-item';
        div.innerHTML = `
          <div class="follow-avatar" style="background:${color}">
            ${savedAv
              ? `<img src="${savedAv}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
              : `<span>${getInitial(email)}</span>`
            }
          </div>
          <div class="follow-info">
            <div class="follow-name">${name}</div>
            <div class="follow-cat">${s.category || 'Blogger'}</div>
          </div>
          <button class="btn-follow ${isFollowing ? 'following' : ''}"
            onclick="toggleFollow('${s.user_id}',this)">
            ${isFollowing ? 'Following' : 'Follow'}
          </button>`;
        fl.appendChild(div);
      });
    }
  } catch (e) {
    document.getElementById('followList').innerHTML =
      `<div style="font-size:.82rem;color:var(--muted);">Could not load suggestions.</div>`;
  }

  // Trending tags based on categories
  try {
    const { data: catPosts } = await _supabase
      .from('posts')
      .select('category')
      .eq('is_draft', false)
      .limit(100);

    const catCount = {};
    (catPosts || []).forEach(p => {
      if (p.category) catCount[p.category] = (catCount[p.category] || 0) + 1;
    });

    const sorted = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const tl = document.getElementById('trendingList');
    tl.innerHTML = '';

    if (!sorted.length) {
      tl.innerHTML = `<div style="font-size:.82rem;color:var(--muted);">No categories yet.</div>`;
      return;
    }

    sorted.forEach(([cat, count]) => {
      tl.innerHTML += `
        <div class="trending-item">
          <span class="trending-tag">#${cat}</span>
          <span class="trending-count">${count} post${count !== 1 ? 's' : ''}</span>
        </div>`;
    });
  } catch (e) {}
}

async function loadFollows() {
  if (!currentUser) return;
  try {
    const { data, error } = await _supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUser.id);

    if (error) throw error;
    followingSet.clear();
    (data || []).forEach(r => followingSet.add(r.following_id));
  } catch (e) {
    console.warn('Could not load follows:', e);
  }
}

async function toggleFollow(userId, btn) {
  if (!currentUser) {
    showToast('⚠️', 'Please sign in first.');
    return;
  }

  const wasFollowing = followingSet.has(userId);

  // Optimistic UI update — update instantly before DB call
  if (wasFollowing) {
    followingSet.delete(userId);
    btn.textContent = 'Follow';
    btn.classList.remove('following');
  } else {
    followingSet.add(userId);
    btn.textContent = 'Following';
    btn.classList.add('following');
  }

  const statEl = document.getElementById('statFollowers');
  if (statEl) statEl.textContent = followingSet.size;

  try {
    if (wasFollowing) {
      const { error } = await _supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId);
      if (error) throw error;
      showToast('', 'Unfollowed.');
    } else {
      const { error } = await _supabase
        .from('follows')
        .insert([{ follower_id: currentUser.id, following_id: userId }]);
      if (error) throw error;
      showToast('', 'Following!');
    }
  } catch (e) {
    // Revert on failure
    if (wasFollowing) {
      followingSet.add(userId);
      btn.textContent = 'Following';
      btn.classList.add('following');
    } else {
      followingSet.delete(userId);
      btn.textContent = 'Follow';
      btn.classList.remove('following');
    }
    if (statEl) statEl.textContent = followingSet.size;
    showToast('⚠️', 'Could not update follow: ' + e.message);
  }
}


// ═══ AUTH ═════════════════════════════════════════════════════
function switchTab(mode) {
  currentAuthMode = mode;
  const isSignUp = mode === 'signup';

  document.getElementById('tabSignIn').classList.toggle('active', !isSignUp);
  document.getElementById('tabSignUp').classList.toggle('active', isSignUp);
  document.getElementById('confirmField').style.display = isSignUp ? 'block' : 'none';
  document.getElementById('authBtnText').textContent = isSignUp ? 'Create Account' : 'Sign In';
  document.getElementById('authTagline').textContent = isSignUp
    ? 'Create your account to start writing.'
    : 'Sign in to continue writing your story.';
  document.getElementById('authFooter').textContent = isSignUp
    ? 'Your account is saved to Supabase Auth'
    : 'Credentials verified against Supabase Auth';

  hideAuthMessages();
  document.getElementById('loginConfirm').value = '';
}

function handleAuth() {
  currentAuthMode === 'signup' ? handleSignUp() : handleLogin();
}

function showAuthError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.add('show');
  document.getElementById('loginSuccess').classList.remove('show');
}

function showAuthSuccess(msg) {
  const el = document.getElementById('loginSuccess');
  el.textContent = msg;
  el.classList.add('show');
  document.getElementById('loginError').classList.remove('show');
}

function hideAuthMessages() {
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('loginSuccess').classList.remove('show');
}

function setAuthLoading(l) {
  document.getElementById('authBtn').disabled = l;
  document.getElementById('loginSpinner').style.display = l ? 'inline-block' : 'none';
  document.getElementById('authBtnText').textContent = l
    ? (currentAuthMode === 'signup' ? 'Creating…' : 'Signing in…')
    : (currentAuthMode === 'signup' ? 'Create Account' : 'Sign In');
}

async function handleLogin() {
  hideAuthMessages();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAuthError('Please enter your email and password.');
    return;
  }

  setAuthLoading(true);
  try {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showAuthError(error.message || 'Invalid email or password.');
      setAuthLoading(false);
      return;
    }
    setAuthLoading(false);
    showApp(data.user);
  } catch (e) {
    setAuthLoading(false);
    showAuthError('Something went wrong.');
  }
}

async function handleSignUp() {
  hideAuthMessages();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const confirm = document.getElementById('loginConfirm').value;

  if (!email || !password) {
    showAuthError('Please enter your email and password.');
    return;
  }
  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters.');
    return;
  }
  if (password !== confirm) {
    showAuthError('Passwords do not match.');
    return;
  }

  setAuthLoading(true);
  try {
    const { data, error } = await _supabase.auth.signUp({ email, password });
    if (error) {
      showAuthError(error.message || 'Could not create account.');
      setAuthLoading(false);
      return;
    }
    setAuthLoading(false);
    if (data.session) {
      showApp(data.user);
      showToast('🎉', 'Account created! Welcome to TechBytes.');
    } else {
      showAuthSuccess('Account created! Sign in now.');
      switchTab('signin');
    }
  } catch (e) {
    setAuthLoading(false);
    showAuthError('Something went wrong.');
  }
}

async function handleSignOut() {
  await _supabase.auth.signOut();
  currentUser = null;
  showLogin();
  showToast('👋', 'Signed out.');
}

function showApp(user) {
  currentUser = user;
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('userEmailLabel').textContent = displayName(user?.email || '');
  document.getElementById('userPill').style.display = 'flex';
  document.getElementById('signoutBtn').style.display = 'inline-block';
  document.getElementById('navTabs').classList.add('show');
  loadPostsCount();
  switchView('feed');
}

function showLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('userPill').style.display = 'none';
  document.getElementById('signoutBtn').style.display = 'none';
  document.getElementById('navTabs').classList.remove('show');
  document.getElementById('postsBadge').classList.remove('show');
  document.getElementById('headerPublishBtn').classList.remove('show');
}


// ═══ PUBLISH ══════════════════════════════════════════════════
async function publishPost() {
  if (!currentUser) {
    showToast('⚠️', 'Please sign in first.');
    return;
  }

  const title = document.getElementById('titleInput').value.trim();
  const body = document.getElementById('blogBody').value.trim();
  const caption = document.getElementById('captionInput').value.trim();
  const category = document.querySelector('.cat-chip.active')?.textContent || null;

  if (!title) {
    showPublishStatus('error', '⚠️ Please add a title before publishing.');
    return;
  }
  if (!body) {
    showPublishStatus('error', '⚠️ Please write some content before publishing.');
    return;
  }

  const imageUrl = (useAIImage && aiImageUrl) ? aiImageUrl : null;
  setPublishLoading(true);

  try {
    const { error } = await _supabase.from('posts').insert([{
      user_id: currentUser.id,
      title,
      body,
      caption: caption || null,
      category,
      image_url: imageUrl,
      slug: generateSlug(title),
      claps: 0,
      is_draft: false,
      author_email: currentUser.email
    }]).select();

    if (error) {
      showPublishStatus('error', '❌ Failed: ' + (error.message || 'Unknown'));
      setPublishLoading(false);
      return;
    }

    setPublishLoading(false);
    showPublishStatus('success', '🎉 Published! Your blog is live.');
    showToast('', 'Blog published!');
    loadPostsCount();
  } catch (e) {
    setPublishLoading(false);
    showPublishStatus('error', '❌ Something went wrong.');
  }
}

function setPublishLoading(l) {
  ['headerPublishBtn', 'bottomPublishBtn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = l;
  });
  ['pubSpinH', 'pubSpinB'].forEach(id => {
    const s = document.getElementById(id);
    if (s) s.style.display = l ? 'inline-block' : 'none';
  });
}

function showPublishStatus(type, msg) {
  const el = document.getElementById('publishStatus');
  el.textContent = msg;
  el.className = 'publish-status ' + type;
  setTimeout(() => { el.className = 'publish-status'; }, 5000);
}

async function loadPostsCount() {
  if (!currentUser) return;
  try {
    const { count } = await _supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('is_draft', false);

    if (count !== null) {
      document.getElementById('postsCount').textContent = count;
      document.getElementById('postsBadge').classList.toggle('show', count > 0);
    }
  } catch (e) {}
}


// ═══ EDITOR ═══════════════════════════════════════════════════
function toggleCat(el) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
  uploadedImageData = e.target.result;
  const img = document.getElementById('uploadedImg');
  img.src = uploadedImageData;
  img.style.display = 'block';
  document.getElementById('imagePlaceholder').style.display = 'none';
  document.getElementById('imageZone').classList.add('has-image');
  document.getElementById('imageActions').style.display = 'flex';
  useAIImage = false;
  document.getElementById('aiImgToggle').classList.add('active');
  document.getElementById('genImageArea').style.display = 'none';

  // Upload to Supabase Storage
  try {
    const blob = await fetch(e.target.result).then(r => r.blob());
    const fileName = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { data, error } = await _supabase.storage
      .from('post-images')
      .upload(fileName, blob, { contentType: file.type });
    if (!error) {
      const { data: urlData } = _supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);
      uploadedImageData = urlData.publicUrl;
      img.src = uploadedImageData;
    }
  } catch (e) {
    console.warn('Could not upload to storage:', e);
  }

  showToast('', 'Image uploaded!');
};
  reader.readAsDataURL(file);
}

function removeImage() {
  uploadedImageData = null;
  const img = document.getElementById('uploadedImg');
  img.src = '';
  img.style.display = 'none';
  document.getElementById('imagePlaceholder').style.display = 'block';
  document.getElementById('imageZone').classList.remove('has-image');
  document.getElementById('imageActions').style.display = 'none';
  document.getElementById('fileInput').value = '';
}

function toggleAIImage() {
  if (!aiImageUrl) {
    generateAIImage();
  } else {
    useAIImage = !useAIImage;
    document.getElementById('aiImgToggle').classList.toggle('active', useAIImage);
  }
}

function generateLocalCaptions(title, body, category) {
  const subject = title || body.split(' ').slice(0, 4).join(' ') || 'this story';
  const cat = category || 'life';
  const words = (title + ' ' + body).toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const keyword = words[Math.floor(Math.random() * Math.min(words.length, 8))] || subject;
  return [
    `${title ? title : 'This'} — a perspective you didn't know you needed.`,
    `In the quiet corners of ${cat.toLowerCase()}, some stories demand to be told.`,
    `What does ${keyword} really mean for the world we live in today?`,
    `A deep dive into ${subject}: the insights, the lessons, and what comes next.`
  ];
}

async function suggestCaptions() {
  const title = document.getElementById('titleInput').value.trim();
  const body = document.getElementById('blogBody').value.trim();
  const category = document.querySelector('.cat-chip.active')?.textContent || '';

  if (!title && !body) {
    showToast('⚠️', 'Please write a title or content first.');
    return;
  }

  const btn = document.getElementById('suggestBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Thinking…';
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('captionChips').innerHTML = '';

  const prompt = `Blog title: ${title}\nCategory: ${category}\nContent: ${body.substring(0, 600)}\nGenerate exactly 4 catchy captions. Return ONLY a JSON array of 4 strings.`;
  let captions = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const raw = data?.content?.[0]?.text?.trim() || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) captions = JSON.parse(match[0]);
    }
  } catch (e) {}

  if (!Array.isArray(captions) || captions.length === 0) {
    captions = generateLocalCaptions(title, body, category);
    showToast('✦', '4 captions ready!');
  } else {
    showToast('✦', '4 captions generated!');
  }

  document.getElementById('loadingState').style.display = 'none';
  renderCaptions(captions);
  btn.disabled = false;
  btn.textContent = '✦ Suggest Captions';
}

function renderCaptions(captions) {
  const container = document.getElementById('captionChips');
  container.innerHTML = '';
  captions.forEach(cap => {
    const div = document.createElement('div');
    div.className = 'caption-chip';
    div.innerHTML = `<span>${cap}</span><span class="chip-use-btn">Use this →</span>`;
    div.onclick = () => {
      document.getElementById('captionInput').value = cap;
      document.querySelectorAll('.caption-chip').forEach(c => c.classList.remove('selected'));
      div.classList.add('selected');
      showToast('✓', 'Caption selected!');
    };
    container.appendChild(div);
  });
}

const CATEGORY_FALLBACKS = {
  'Technology': ['computer,code,programming', 'laptop,technology,office'],
  'Travel':     ['travel,landscape,adventure', 'beach,ocean,vacation'],
  'Lifestyle':  ['lifestyle,minimal,wellness', 'coffee,morning,calm'],
  'Education':  ['books,library,study', 'university,campus,education'],
  'Food':       ['food,restaurant,cuisine', 'cooking,kitchen,chef'],
  'Opinions':   ['people,thinking,discussion', 'newspaper,opinion,media'],
  'Entertainment': ['concert,music,entertainment', 'cinema,film,entertainment']
};

function getCategoryFallback(c) {
  const l = CATEGORY_FALLBACKS[c];
  if (!l) return 'nature,landscape,beautiful';
  return l[Math.floor(Math.random() * l.length)];
}

function extractTitleKeywords(title, category) {
  const stop = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','my','your','our','their','this','that','these','those','how','why','what','when','where','who','which','about','i','we','you','he','she','it','they','me','him','her','us','them','not','no','very','just','so']);
  const abstract = new Set(['experience','taste','feel','feeling','essence','story','guide','review','thoughts','opinion','perspective','take','look','way','thing','stuff','idea']);
  const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  const concrete = words.filter(w => !abstract.has(w));
  const visual = concrete.length > 0 ? concrete : words;
  const catEnrich = {
    'Technology': 'technology', 'Travel': 'landscape', 'Lifestyle': 'lifestyle',
    'Education': 'books', 'Food': 'cuisine', 'Opinions': 'discussion', 'Entertainment': 'entertainment'
  };
  let kw = visual.slice(0, 3);
  if (category && catEnrich[category] && kw.length < 3) {
    kw.push(catEnrich[category]);
  }
  if (kw.length === 0) return getCategoryFallback(category);
  return [...new Set(kw)].slice(0, 4).join(' ');
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

async function generateAIImage() {
  const title = document.getElementById('titleInput').value.trim();
  const body = document.getElementById('blogBody').value.trim();
  const category = document.querySelector('.cat-chip.active')?.textContent || '';

  if (!title && !body) {
    showToast('⚠️', 'Please write something first!');
    return;
  }

  const btn = document.getElementById('genImgBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Searching…';
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('genImageArea').style.display = 'none';

  let keywords = extractTitleKeywords(title, category) || getCategoryFallback(category);
  lastKeywords = keywords;
  regenCounter++;

  let imgUrl = null;

  // Primary: Pexels API
  if (PEXELS_API_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const searchQuery = encodeURIComponent(keywords);
      const page = ((regenCounter - 1) % 5) + 1;
      const resp = await fetch(
        `https://api.pexels.com/v1/search?query=${searchQuery}&per_page=5&page=${page}`,
        { signal: controller.signal, headers: { 'Authorization': PEXELS_API_KEY } }
      );
      clearTimeout(timeout);

      if (resp.ok) {
        const data = await resp.json();
        if (data.photos && data.photos.length > 0) {
          const idx = (hashString(title || keywords) + regenCounter) % data.photos.length;
          imgUrl = data.photos[idx].src.landscape || data.photos[idx].src.large;
        }
      }
    } catch (e) {
      console.warn('Pexels failed, using fallback:', e);
    }
  }

  // Fallback: loremflickr
  if (!imgUrl) {
    const lock = (hashString(title || keywords) + regenCounter) % 100000;
    imgUrl = `https://loremflickr.com/900/500/${encodeURIComponent(keywords.replace(/\s+/g, ','))}/all?lock=${lock}`;
  }

  aiImageUrl = imgUrl;
  // Upload image to Supabase Storage for permanent storage
try {
  const response = await fetch(imgUrl);
  const blob = await response.blob();
  const fileName = `ai-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { data, error } = await _supabase.storage
    .from('post-images')
    .upload(fileName, blob, { contentType: 'image/jpeg' });
  if (!error) {
    const { data: urlData } = _supabase.storage
      .from('post-images')
      .getPublicUrl(fileName);
    aiImageUrl = urlData.publicUrl;
  }
} catch (e) {
  console.warn('Could not upload to storage, using direct URL:', e);
}
  const imgEl = document.getElementById('aiGenImg');
  imgEl.style.opacity = '0';
  imgEl.style.transition = 'opacity .4s ease';

  imgEl.onload = () => {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('genImageArea').style.display = 'block';
    document.getElementById('keywordBadge').textContent = '🔍 ' + keywords;
    useAIImage = true;
    document.getElementById('aiImgToggle').classList.add('active');
    imgEl.style.opacity = '1';
    showToast('🎨', `Matched: ${keywords}`);
  };

  imgEl.onerror = () => {
    const seed = keywords.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 1000;
    aiImageUrl = `https://picsum.photos/seed/${seed + regenCounter}/900/500`;
    imgEl.src = aiImageUrl;
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('genImageArea').style.display = 'block';
    document.getElementById('keywordBadge').textContent = '🎲 Random image';
    useAIImage = true;
    imgEl.style.opacity = '1';
    showToast('🖼️', 'Image loaded (fallback)');
  };

  imgEl.src = imgUrl;
  btn.disabled = false;
  btn.textContent = 'Generate AI Image';
}

function showPreview() {
  const title = document.getElementById('titleInput').value.trim() || 'Untitled Blog';
  const body = document.getElementById('blogBody').value.trim() || '(No content yet)';
  const caption = document.getElementById('captionInput').value.trim();
  const category = document.querySelector('.cat-chip.active')?.textContent || 'Blog';

  document.getElementById('previewTitle').textContent = title;
  document.getElementById('previewText').textContent = body;
  document.getElementById('previewCaption').textContent = caption ? `"${caption}"` : '';
  document.getElementById('previewCategory').textContent = '✦ ' + category;
  document.getElementById('previewDate').textContent = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('previewReadTime').textContent = '⏱ ' + calcReadTime(body);
  document.getElementById('previewSlug').textContent = '🔗 techbytes.com/blog/' + generateSlug(title);

  const previewImg = document.getElementById('previewImage');
  let imgSrc = null;
  if (uploadedImageData && !useAIImage) imgSrc = uploadedImageData;
  else if (useAIImage && aiImageUrl) imgSrc = aiImageUrl;

  if (imgSrc) {
    previewImg.src = imgSrc;
    previewImg.style.display = 'block';
  } else {
    previewImg.style.display = 'none';
  }

  const section = document.getElementById('previewSection');
  section.classList.add('visible');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('👁', 'Preview ready!');
}

function resetForm() {
  if (!confirm('Clear everything and start fresh?')) return;

  ['titleInput', 'blogBody', 'captionInput'].forEach(id => {
    document.getElementById(id).value = '';
  });

  document.getElementById('slugDisplay').textContent = 'your-blog-title';
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('captionChips').innerHTML = '';
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('genImageArea').style.display = 'none';
  document.getElementById('previewSection').classList.remove('visible');
  document.getElementById('publishStatus').className = 'publish-status';

  removeImage();
  uploadedImageData = null;
  aiImageUrl = null;
  useAIImage = false;
  lastKeywords = '';
  countWords();
  updateWordGoal(0);
  showToast('✓', 'Form cleared!');
}

function showToast(icon, msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}


// ═══ VOICE TYPING (Web Speech API) ═══════════════════════════
let voiceRecognition = null,
    isVoiceActive = false;

function initVoiceTyping() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    document.getElementById('voiceBtn').title = 'Voice typing not supported in this browser';
    return;
  }

  voiceRecognition = new SR();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = 'en-US';

  let finalTranscript = '';

  voiceRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    if (finalTranscript) {
      const body = document.getElementById('blogBody');
      const needsSpace = body.value.length > 0 &&
        !body.value.endsWith(' ') &&
        !body.value.endsWith('\n');
      body.value += (needsSpace ? ' ' : '') + finalTranscript;
      finalTranscript = '';
      countWords();
    }
  };

  voiceRecognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      showToast('⚠️', 'Microphone access denied. Please allow mic access.');
    } else if (event.error !== 'aborted') {
      showToast('⚠️', 'Voice error: ' + event.error);
    }
    stopVoice();
  };

  voiceRecognition.onend = () => {
    if (isVoiceActive) {
      try { voiceRecognition.start(); } catch (e) { stopVoice(); }
    }
  };
}

function toggleVoice() {
  if (!voiceRecognition) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showToast('⚠️', 'Voice typing is not supported in this browser. Try Chrome.');
      return;
    }
    initVoiceTyping();
  }
  if (isVoiceActive) {
    stopVoice();
  } else {
    startVoice();
  }
}

function startVoice() {
  isVoiceActive = true;
  try {
    voiceRecognition.start();
  } catch (e) {
    voiceRecognition.stop();
    setTimeout(() => { voiceRecognition.start(); }, 200);
  }
  document.getElementById('voiceBtn').classList.add('recording');
  document.getElementById('voiceIndicator').classList.add('show');
  showToast('🎙️', 'Voice typing started — speak now!');
}

function stopVoice() {
  isVoiceActive = false;
  try { voiceRecognition.stop(); } catch (e) {}
  document.getElementById('voiceBtn').classList.remove('recording');
  document.getElementById('voiceIndicator').classList.remove('show');
  showToast('⏹️', 'Voice typing stopped.');
}


// ═══ INIT APP ═════════════════════════════════════════════════
export function initApp() {

  // Load saved theme from localStorage
  (function () {
    const s = localStorage.getItem('tb_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', s);
    setTimeout(() => {
      document.getElementById('themeBtn').textContent = s === 'dark' ? '🌙' : '☀️';
    }, 50);
  })();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        triggerAutoSave();
        showToast('💾', 'Draft saved!');
      } else if (e.key === 'p') {
        e.preventDefault();
        showPreview();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        publishPost();
      }
    }
  });

  // Check if user is already logged in (existing session)
  (async () => {
    try {
      const { data: { session } } = await _supabase.auth.getSession();
      if (session?.user) showApp(session.user);
    } catch (e) {
      console.warn('Session check failed.');
    }
  })();

  // Listen for auth state changes (login/logout events)
  _supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) showApp(session.user);
    else if (event === 'SIGNED_OUT') showLogin();
  });

  // Drag and drop image upload
  const zone = document.getElementById('imageZone');
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.style.borderColor = 'var(--accent)';
  });
  zone.addEventListener('dragleave', () => zone.style.borderColor = '');
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload({ target: { files: [file] } });
    }
  });

  initVoiceTyping();

  // Expose all functions to window so HTML onclick handlers can call them
  Object.assign(window, {
    toggleTheme, generateSlug, onTitleChange, calcReadTime, getInitial,
    avatarColor, displayName, handleAvatarUpload, updateAllAvatarDisplays,
    loadUserAvatar, getAvatarImgTag, switchView, readGoBack, countWords,
    updateWordGoal, scheduleAutoSave, triggerAutoSave, loadFeed, renderFeedGrid,
    setFilter, filterPosts, loadMyBlogs, buildCard, quickLike, burstEffect,
    deletePost, openRead, handleReadLike, loadSidebar, loadFollows, toggleFollow,
    switchTab, handleAuth, showAuthError, showAuthSuccess, hideAuthMessages,
    setAuthLoading, handleLogin, handleSignUp, handleSignOut, showApp, showLogin,
    publishPost, setPublishLoading, showPublishStatus, loadPostsCount, toggleCat,
    handleImageUpload, removeImage, toggleAIImage, generateLocalCaptions,
    suggestCaptions, renderCaptions, getCategoryFallback, extractTitleKeywords,
    hashString, generateAIImage, showPreview, resetForm, showToast,
    initVoiceTyping, toggleVoice, startVoice, stopVoice
  });
}