export const bodyHTML = `
<!-- LOGIN -->
<div id="loginOverlay">
  <div class="login-card">
    <div class="login-logo">Tech<span>Bytes</span></div>
    <p class="login-tagline" id="authTagline">Sign in to continue writing your story.</p>
    <div class="auth-tabs">
      <button class="auth-tab active" id="tabSignIn" onclick="switchTab('signin')">Sign In</button>
      <button class="auth-tab" id="tabSignUp" onclick="switchTab('signup')">Create Account</button>
    </div>
    <div class="login-field"><label>Email address</label><input type="email" id="loginEmail" placeholder="you@example.com" autocomplete="email"></div>
    <div class="login-field"><label>Password</label><input type="password" id="loginPassword" placeholder="••••••••" onkeydown="if(event.key==='Enter')handleAuth()"></div>
    <div class="login-field" id="confirmField" style="display:none;"><label>Confirm Password</label><input type="password" id="loginConfirm" placeholder="••••••••" onkeydown="if(event.key==='Enter')handleAuth()"></div>
    <button class="login-btn" id="authBtn" onclick="handleAuth()"><span class="login-spinner" id="loginSpinner"></span><span id="authBtnText">Sign In</span></button>
    <div class="login-error" id="loginError"></div>
    <div class="login-success" id="loginSuccess"></div>
    <p class="login-divider" id="authFooter">Credentials verified against Supabase Auth</p>
    <button class="guest-btn" onclick="continueWithoutAccount()">Continue without account →</button>
  </div>
</div>

<!-- HIDDEN FILE INPUT FOR AVATAR -->
<input type="file" id="avatarFileInput" accept="image/*" style="display:none;" onchange="handleAvatarUpload(event)">

<header>
  <div class="logo" onclick="switchView('feed')">Tech<span>Bytes</span></div>
  <div class="nav-tabs" id="navTabs">
    <button class="nav-tab active" id="navFeed" onclick="switchView('feed')">Feed</button>
    <button class="nav-tab" id="navWrite" onclick="switchView('editor')">Write</button>
    <button class="nav-tab" id="navMyBlogs" onclick="switchView('myblogs')">My Blogs</button>
  </div>
  <div class="header-right">
    <span class="autosave-tag" id="autosaveTag">✓ Draft saved</span>
    <span class="user-pill" id="userPill" style="display:none;"><span class="user-pill-dot"></span><span id="userEmailLabel">user</span></span>
    <div class="posts-badge" id="postsBadge">✦ <span id="postsCount">0</span> posts</div>
    <button class="btn-publish" id="headerPublishBtn" onclick="publishPost()">
      <span id="pubSpinH" style="display:none;width:13px;height:13px;border:2px solid rgba(0,0,0,.3);border-top-color:#000;border-radius:50%;animation:spin .7s linear infinite;"></span>Publish
    </button>
    <button class="theme-toggle" onclick="toggleTheme()" id="themeBtn">🌙</button>
    <button class="btn-signout" id="signoutBtn" style="display:none;" onclick="handleSignOut()">Sign out</button>
  </div>
</header>

<main>
  <!-- FEED -->
  <div id="feedView" style="display:none;">
    <div class="feed-layout">
      <div class="feed-main">
        <div class="feed-topbar">
          <div class="search-wrap">
            <span class="search-icon"></span>
            <input type="text" id="searchInput" placeholder="Search posts by title…" oninput="filterPosts()">
          </div>
        </div>
        <div class="filter-chips">
          <button class="filter-chip active" onclick="setFilter('All',this)">All</button>
          <button class="filter-chip" onclick="setFilter('Technology',this)">Technology</button>
          <button class="filter-chip" onclick="setFilter('Travel',this)">Travel</button>
          <button class="filter-chip" onclick="setFilter('Lifestyle',this)">Lifestyle</button>
          <button class="filter-chip" onclick="setFilter('Education',this)">Education</button>
          <button class="filter-chip" onclick="setFilter('Food',this)">Food</button>
          <button class="filter-chip" onclick="setFilter('Opinions',this)">Opinions</button>
          <button class="filter-chip" onclick="setFilter('Entertainment',this)">Entertainment</button>
        </div>
        <div id="feedGrid" class="blog-grid"></div>
      </div>
      <div class="sidebar">
        <div class="sidebar-card" id="profileCard" style="display:none;">
          <div class="sidebar-title">Your Profile</div>
          <div class="profile-avatar-wrap" onclick="document.getElementById('avatarFileInput').click()" title="Click to change profile picture">
            <div class="profile-avatar" id="profileAvatarEl">😊</div>
            <div class="profile-avatar-edit"></div>
          </div>
          <div class="profile-name-row">
            <div class="profile-name" id="profileName">Writer</div>
            <button class="edit-username-btn" id="editUsernameBtn" onclick="startEditUsername()" title="Edit username">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
          </div>
          <div class="edit-username-inline" id="editUsernameInline" style="display:none;">
            <input type="text" id="usernameInput" placeholder="Choose a username…" maxlength="30" onkeydown="if(event.key==='Enter')saveUsername()">
            <div class="edit-username-actions">
              <button class="edit-username-save" onclick="saveUsername()">Save</button>
              <button class="edit-username-cancel" onclick="cancelEditUsername()">Cancel</button>
            </div>
          </div>
          <div class="profile-email" id="profileEmailSidebar"></div>
          <div class="profile-stats four-col">
            <div class="stat-box"><div class="stat-num" id="statPosts">0</div><div class="stat-label">Posts</div></div>
            <div class="stat-box"><div class="stat-num" id="statLikes">0</div><div class="stat-label">Likes</div></div>
            <div class="stat-box"><div class="stat-num" id="statFollowersCount">0</div><div class="stat-label">Followers</div></div>
            <div class="stat-box"><div class="stat-num" id="statFollowingCount">0</div><div class="stat-label">Following</div></div>
          </div>
        </div>
        <div class="sidebar-card" id="followingCard" style="display:none;">
          <div class="sidebar-title">People You Follow</div>
          <div class="follow-list" id="followingUsersList"><div style="font-size:.82rem;color:var(--muted);">Loading…</div></div>
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">Discover Writers</div>
          <div class="follow-list" id="followList"><div style="font-size:.82rem;color:var(--muted);">Loading suggestions…</div></div>
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">Trending Tags</div>
          <div class="trending-list" id="trendingList"><div style="font-size:.82rem;color:var(--muted);">Loading…</div></div>
        </div>
      </div>
    </div>
  </div>

  <!-- EDITOR -->
  <div id="editorView" style="display:none;">
    <div class="editor-wrap">
      <div class="hero-label">AI-Powered Blogging</div>
      <h1 class="page-title">Share your <span class="gradient-word">experience</span><br>with the world.</h1>
      <p class="subtitle">Write your story, let AI suggest the perfect caption and generate a visual.</p>
      <p class="shortcuts-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save &nbsp;|&nbsp; <kbd>Ctrl</kbd>+<kbd>P</kbd> preview &nbsp;|&nbsp; <kbd>Ctrl</kbd>+<kbd>Enter</kbd> publish</p>
      <div class="editor-card">
        <div class="field-group">
          <div class="field-label">Blog Title</div>
          <input type="text" id="titleInput" placeholder="Give your story a title…" maxlength="120" oninput="onTitleChange()">
          <div class="slug-row"><span class="slug-prefix">techbytes.com/blog/</span><span class="slug-value" id="slugDisplay">your-blog-title</span></div>
        </div>
        <div class="field-group">
          <div class="field-label">Category</div>
          <div class="category-row">
            <button class="cat-chip" onclick="toggleCat(this)">Technology</button>
            <button class="cat-chip" onclick="toggleCat(this)">Travel</button>
            <button class="cat-chip" onclick="toggleCat(this)">Lifestyle</button>
            <button class="cat-chip" onclick="toggleCat(this)">Education</button>
            <button class="cat-chip" onclick="toggleCat(this)">Food</button>
            <button class="cat-chip" onclick="toggleCat(this)">Opinions</button>
            <button class="cat-chip" onclick="toggleCat(this)">Entertainment</button>
          </div>
        </div>
        <div class="field-group">
          <div class="field-label"><span>Your Blog</span><span style="display:flex;align-items:center;gap:.6rem;"><button class="voice-btn" id="voiceBtn" onclick="toggleVoice()" title="Voice typing"><span class="mic-icon">🎙️</span><span>Voice</span><span class="mic-dot"></span></button><span class="char-count" id="charCount">0 words</span></span></div>
          <div class="word-goal-row">
            <span class="wg-label">Goal:</span>
            <select class="wg-select" id="wordGoalSelect" onchange="updateWordGoal()">
              <option value="0">None</option><option value="300">300w</option>
              <option value="500" selected>500w</option><option value="800">800w</option><option value="1200">1200w</option>
            </select>
            <div class="wg-bar-wrap"><div class="wg-bar" id="wgBar"></div></div>
            <span class="wg-label" id="wgStatus"></span>
          </div>
          <textarea id="blogBody" class="blog-body" placeholder="Start writing…" oninput="countWords()"></textarea>
          <div class="voice-indicator" id="voiceIndicator"><span class="pulse-ring"></span><span>Listening… speak now</span></div>
        </div>
        <div class="field-group">
          <div class="field-label">Cover Image</div>
          <div class="image-zone" id="imageZone" onclick="document.getElementById('fileInput').click()">
            <div class="image-zone-inner" id="imagePlaceholder">
              <div class="image-zone-icon">🖼️</div>
              <div class="image-zone-text"><strong>Upload your photo</strong>Click to browse or drag & drop</div>
            </div>
            <img id="uploadedImg" style="display:none;" alt="Cover">
          </div>
          <input type="file" id="fileInput" accept="image/*" onchange="handleImageUpload(event)">
          <div class="image-actions" id="imageActions" style="display:none;">
            <button onclick="removeImage()">delete Remove</button>
            <button class="active" id="aiImgToggle" onclick="toggleAIImage()">✦ Use AI Image</button>
          </div>
        </div>
        <div class="field-group">
          <div class="field-label">Caption / Tagline</div>
          <input type="text" id="captionInput" placeholder="Your caption will appear here…" maxlength="200">
        </div>
        <div class="ai-panel">
          <div class="ai-panel-title"> Suggestions</div>
          <div class="ai-btn-row">
            <button id="suggestBtn" onclick="suggestCaptions()">✦ Suggest Captions</button>
            <button id="genImgBtn" onclick="generateAIImage()">Generate AI Image</button>
          </div>
          <div id="loadingState" style="display:none;">
            <div class="loading-bar"><div class="loading-bar-inner"></div></div>
            <div class="skeleton" style="width:90%"></div><div class="skeleton" style="width:75%"></div><div class="skeleton" style="width:85%"></div>
          </div>
          <div class="caption-chips" id="captionChips"></div>
          <div id="genImageArea" style="display:none;">
            <div class="gen-image-wrap">
              <img id="aiGenImg" src="" alt="AI Generated">
              <div class="gen-image-label">✦ AI Matched</div>
              <div class="gen-keyword-badge" id="keywordBadge"></div>
              <button class="regen-btn" onclick="generateAIImage()">↻ New image</button>
            </div>
          </div>
        </div>
        <div class="actions-bar">
          <button class="btn btn-ghost" onclick="resetForm()">✕ Clear</button>
          <button class="btn btn-gold" onclick="showPreview()" style="flex:1;">👁 Preview</button>
          <button class="btn-publish" id="bottomPublishBtn" onclick="publishPost()" style="display:flex;">
            <span id="pubSpinB" style="display:none;width:13px;height:13px;border:2px solid rgba(0,0,0,.3);border-top-color:#000;border-radius:50%;animation:spin .7s linear infinite;"></span>Publish
          </button>
        </div>
        <div class="publish-status" id="publishStatus"></div>
      </div>
      <div class="preview-section" id="previewSection">
        <div class="preview-header">
          <span class="preview-tag-label" id="previewCategory">Blog Preview</span>
          <div class="preview-meta-row"><span id="previewDate"></span><span id="previewReadTime"></span></div>
        </div>
        <div class="preview-body">
          <img id="previewImage" class="preview-image" src="" alt="" style="display:none;">
          <h2 class="preview-title" id="previewTitle">Untitled Blog</h2>
          <p class="preview-caption" id="previewCaption"></p>
          <div class="preview-slug-line" id="previewSlug"></div>
          <p class="preview-text" id="previewText"></p>
        </div>
      </div>
    </div>
  </div>

  <!-- MY BLOGS -->
  <div id="myblogsView" style="display:none;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
      <div>
        <div style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:900;">My <span style="background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Blogs</span></div>
        <div style="color:var(--muted);font-size:.88rem;margin-top:.2rem;" id="myBlogsMeta">Loading…</div>
      </div>
      <button class="btn btn-primary" onclick="switchView('editor')">Write New</button>
    </div>
    <div id="myBlogsGrid" class="blog-grid"></div>
  </div>

  <!-- READ VIEW -->
  <div id="readView" style="display:none;">
    <button class="read-back-btn" onclick="readGoBack()">← Back</button>
    <div class="read-article">
      <img id="readCover" class="read-cover" src="" alt="" style="display:none;">
      <div class="read-body">
        <div class="read-category-label" id="readCategory"></div>
        <h1 class="read-title" id="readTitle"></h1>
        <div class="read-author-row">
          <div class="read-author-avatar" id="readAuthorAvatar">✍</div>
          <div class="read-author-info">
            <span class="read-author-name" id="readAuthorName">Author</span>
            <span class="read-author-meta" id="readAuthorMeta"></span>
          </div>
        </div>
        <div class="read-slug-line" id="readSlug"></div>
        <p class="read-caption" id="readCaption" style="display:none;"></p>
        <div class="read-divider"></div>
        <div class="read-content" id="readContent"></div>
      </div>
      <div class="read-like-section">
        <button class="big-like-btn" id="bigLikeBtn" onclick="handleReadLike()">
          ❤️ <span class="lc" id="bigLikeCount">0</span>
        </button>
        <span class="like-msg" id="likeMsg">Like this post!</span>
      </div>
    </div>
  </div>
</main>

<div class="toast" id="toast"><span class="toast-icon" id="toastIcon">✓</span><span id="toastMsg">Done!</span><button class="toast-signin-btn" id="toastSignInBtn" style="display:none;" onclick="showLoginFromToast()">Sign In</button></div>
`;