// Initialize Supabase client (only on pages that load Supabase)
let supabaseClient = window.supabaseClient || null;
if (!supabaseClient && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(
        'https://apswdensachqenwsjflw.supabase.co',
        'sb_publishable_UxfaC3Ud3CL0V3AC08ZuBQ_KVZ3l2hn'
    );
    window.supabaseClient = supabaseClient;
}

// DOM Elements
const postsContainer = document.getElementById('posts-container');
const hamburger = document.getElementById('hamburger');
const navbar = document.getElementById('navbar');

function escapeHtml(value) {
    return (value ?? '')
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stripHtml(value) {
    return (value ?? '')
        .toString()
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toDisplayHtml(value) {
    const html = (value ?? '').toString();
    if (/<[a-z][\s\S]*>/i.test(html)) return html;
    return escapeHtml(html).replace(/\r?\n/g, '<br>');
}

function sanitizeRichHtml(dirtyHtml) {
    if (!dirtyHtml) return '';
    if (!window.DOMPurify) return dirtyHtml;

    return window.DOMPurify.sanitize(dirtyHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['style', 'class', 'target', 'rel'],
        ADD_TAGS: ['font'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
    });
}

// Set current year in footer
document.addEventListener('DOMContentLoaded', () => {
    const currentYear = document.getElementById('current-year');
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }
    
    // Load posts on homepage
    if (postsContainer) loadPosts();

    // Setup hamburger menu
    if (hamburger && navbar) {
        hamburger.addEventListener('click', () => {
            navbar.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navbar.contains(e.target) && !hamburger.contains(e.target)) {
                navbar.classList.remove('active');
            }
        });
    }

    // About dropdown menu
    const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
    dropdownToggles.forEach((toggle) => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const dropdown = toggle.closest('.nav-dropdown');
            if (!dropdown) return;

            const shouldOpen = !dropdown.classList.contains('open');
            document.querySelectorAll('.nav-dropdown.open').forEach((d) => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open', shouldOpen);
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown.open').forEach((d) => d.classList.remove('open'));
        }
    });

    document.querySelectorAll('.nav-dropdown-menu a').forEach((link) => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.nav-dropdown.open').forEach((d) => d.classList.remove('open'));
            if (navbar) navbar.classList.remove('active');
        });
    });
    
    // Setup hero slider
    setupHeroSlider();
    
    // Load article if on article page
    if (window.location.pathname.includes('article.html')) {
        loadArticle().then(() => setupShareButtons());
    }
});

// Load posts from Supabase
async function loadPosts() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (posts.length === 0) {
            postsContainer.innerHTML = `
                <div class="no-posts">
                    <p>No posts available yet. Check back soon!</p>
                </div>
            `;
            return;
        }
        
        // Cache posts for share functionality
        window.postsCache = {};
        posts.forEach(p => { window.postsCache[p.id] = p; });
        
        postsContainer.innerHTML = posts.map(post => createPostCard(post)).join('');
        
    } catch (error) {
        console.error('Error loading posts:', error);
        postsContainer.innerHTML = `
            <div class="error-message">
                <p>Unable to load posts. Please try again later.</p>
            </div>
        `;
    }
}

// Create post card HTML
function createPostCard(post) {
    const articleUrl = `article.html?id=${post.id}`;
    const safeTitle = escapeHtml(post.title);
    const safeCategory = escapeHtml((post.category || '').toUpperCase());
    const safeSummaryHtml = sanitizeRichHtml(toDisplayHtml(post.summary || ''));
    return `
        <article class="post-card">
            ${post.image_url ? `
                <img src="${post.image_url}" alt="${safeTitle}" class="post-image">
            ` : `
                <div class="post-image" style="background-color: #e9ecef; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-newspaper" style="font-size: 3rem; color: #6c757d;"></i>
                </div>
            `}
            
            <div class="post-content">
                <span class="post-category">${safeCategory}</span>
                <h3 class="post-title">${safeTitle}</h3>
                <div class="post-summary">${safeSummaryHtml}</div>
                
                <div class="post-meta">
                    <a href="${articleUrl}" class="read-more">Read Full Story</a>
                    <a href="#" class="share-link" onclick="sharePost('${post.id}'); return false;">
                        <i class="fas fa-share-alt"></i> Share
                    </a>
                </div>
            </div>
        </article>
    `;
}

// Share post function
function sharePost(postId) {
  const shareUrl = `${window.location.origin}/article.html?id=${postId}`;
  const post = window.postsCache ? window.postsCache[postId] : null;
  const text = getPostSummary(post) || (post ? post.title : 'Believers Leadership Networks');
  if (navigator.share) {
    // Try to include the post image as a shared file (best WhatsApp experience)
    if (post && post.image_url) {
      fetchImageAsFile(post.image_url, post.title).then((file) => {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({
            title: post.title,
            text: `${text}\n\n${shareUrl}`,
            url: shareUrl,
            files: [file]
          });
        }
        return navigator.share({
          title: post.title,
          text: `${text}\n\n${shareUrl}`,
          url: shareUrl
        });
      }).catch(() => {
        navigator.share({ title: post ? post.title : 'Believers Leadership Networks', text: `${text}\n\n${shareUrl}`, url: shareUrl });
      });
    } else {
      navigator.share({ title: post ? post.title : 'Believers Leadership Networks', text: `${text}\n\n${shareUrl}`, url: shareUrl });
    }
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Link copied to clipboard!');
    });
  }
}

// Load full article
async function loadArticle() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id');
  const articleContent = document.getElementById('article-content');
  
  if (!postId) {
    articleContent.innerHTML = `
      <div class="error-message">
        <h1>Article Not Found</h1>
        <p>The requested article could not be found.</p>
        <a href="index.html" class="read-more">Back to Home</a>
      </div>
    `;
    return;
  }
  
  try {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }
    const { data: post, error } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();
    
    if (error) throw error;
    
    if (!post) {
      articleContent.innerHTML = `
        <div class="error-message">
          <h1>Article Not Found</h1>
          <p>The requested article could not be found.</p>
          <a href="index.html" class="read-more">Back to Home</a>
        </div>
      `;
      return;
    }
    
    // Update page metadata for social sharing
    updateMetaTags(post);
    // Cache current article for improved sharing on the article page
    window.currentArticle = post;
    
    // Display article
    const safeTitle = escapeHtml(post.title);
    const safeCategory = escapeHtml((post.category || '').toUpperCase());
    const safeContentHtml = sanitizeRichHtml(toDisplayHtml(post.content || ''));
    articleContent.innerHTML = `
      <div class="article-header">
        <span class="post-category">${safeCategory}</span>
        <h1>${safeTitle}</h1>
        <div class="article-meta">
          <span><i class="far fa-calendar"></i> ${new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      
      ${post.image_url ? `
        <img src="${post.image_url}" alt="${safeTitle}" class="article-image">
      ` : ''}
      
      <div class="article-body">
        ${safeContentHtml}
      </div>
    `;
    
    // configure share buttons after article data is loaded
    setupShareButtons();
  } catch (error) {
    console.error('Error loading article:', error);
    articleContent.innerHTML = `
      <div class="error-message">
        <h1>Error Loading Article</h1>
        <p>There was an error loading the article. Please try again later.</p>
        <a href="index.html" class="read-more">Back to Home</a>
      </div>
    `;
  }
}

function updateMetaTags(post) {
  const fullUrl = window.location.href;
  let ogImage = post.image_url || `${window.location.origin}/images/logo.jpg`;
  
  console.log('Original image_url from post:', post.image_url);
  console.log('ogImage after fallback:', ogImage);
  
  // Ensure ogImage is an absolute URL
  if (ogImage && !ogImage.startsWith('http://') && !ogImage.startsWith('https://')) {
    ogImage = ogImage.startsWith('/') ? `${window.location.origin}${ogImage}` : `${window.location.origin}/${ogImage}`;
  }
  
  console.log('ogImage after absolute URL conversion:', ogImage);
  
  // Update page title
  document.title = `${post.title} - Believers Leadership Networks`;
  
  // Update canonical link
  const canonicalLink = document.getElementById('canonical-link');
  if (canonicalLink) {
    canonicalLink.href = fullUrl;
  }
  
  // Create or update meta tags
  const metaTags = {
    'og:title': post.title,
    'og:description': getPostSummary(post) || 'Read the full article on Believers Leadership Networks',
    'og:url': fullUrl,
    'og:image': ogImage,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:type': 'image/jpeg',
    'og:image:alt': post.title,
    'og:type': 'article',
    'og:site_name': 'Believers Leadership Networks',
    'twitter:card': 'summary_large_image',
    'twitter:title': post.title,
    'twitter:description': getPostSummary(post) || 'Read the full article on Believers Leadership Networks',
    'twitter:image': ogImage,
    'twitter:image:alt': post.title
  };
  
  Object.entries(metaTags).forEach(([property, content]) => {
    let meta = document.querySelector(`meta[property="${property}"]`) || 
               document.querySelector(`meta[name="${property}"]`);
    
    if (!meta) {
      meta = document.createElement('meta');
      if (property.startsWith('og:')) {
        meta.setAttribute('property', property);
      } else {
        meta.setAttribute('name', property);
      }
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  });
  
  console.log('Meta tags updated:', metaTags);
}

// Setup share buttons (for homepage and article page)
function setupShareButtons() {
  const whatsappBtn = document.getElementById('whatsapp-share');
  const facebookBtn = document.getElementById('facebook-share');
  const twitterBtn = document.getElementById('twitter-share');
  const copyLinkBtn = document.getElementById('copy-link');
  const currentUrl = encodeURIComponent(window.location.href);
  const pageTitle = encodeURIComponent(document.title);

  // Build WhatsApp text from summary if available
  let waText = pageTitle;
  if (typeof window.currentArticle !== 'undefined' && window.currentArticle) {
    const summary = getPostSummary(window.currentArticle);
    if (summary) waText = encodeURIComponent(summary);
    else waText = encodeURIComponent(window.currentArticle.title);
  }

  if (whatsappBtn) {
    whatsappBtn.href = `https://wa.me/?text=${waText}%20${currentUrl}`;
    // Prefer native share with image file (WhatsApp receives image + caption)
    whatsappBtn.addEventListener('click', async (e) => {
      try {
        // Only intercept if we have an article loaded and the browser supports sharing
        if (!window.currentArticle || !navigator.share) return;

        const post = window.currentArticle;
        const shareUrl = window.location.href;
        const text = getPostSummary(post) || post.title;

        // If there's an image, try to share it as a file (best WhatsApp experience)
        if (post.image_url) {
          const file = await fetchImageAsFile(post.image_url, post.title);
          if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
            e.preventDefault();
            await navigator.share({
              title: post.title,
              text: `${text}\n\n${shareUrl}`,
              url: shareUrl,
              files: [file]
            });
            return;
          }
        }

        // Otherwise, still use native share (text + link) if possible
        e.preventDefault();
        await navigator.share({
          title: post.title,
          text: `${text}\n\n${shareUrl}`,
          url: shareUrl
        });
      } catch (err) {
        // If anything fails, fall back to opening wa.me (do nothing here)
        console.warn('WhatsApp native share failed, falling back:', err);
      }
    }, { passive: false });
  }
  if (facebookBtn) {
    facebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${currentUrl}`;
  }
  if (twitterBtn) {
    twitterBtn.href = `https://twitter.com/intent/tweet?url=${currentUrl}&text=${pageTitle}`;
  }
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        const originalText = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { copyLinkBtn.innerHTML = originalText; }, 2000);
      });
    });
  }
}

// Helper: derive per-post summary
function getPostSummary(post) {
  if (!post) return '';
  const s = stripHtml((post.summary || '').trim());
  if (s) {
    return s.length > 240 ? s.substring(0, 240).trim() + '...' : s;
  }
  const text = stripHtml(post.content || '');
  return text.length > 240 ? text.substring(0, 240).trim() + '...' : text;
}

// Helper: fetch an image URL as a File for Web Share API
async function fetchImageAsFile(imageUrl, title) {
  try {
    // Ensure absolute URL (some environments may store relative paths)
    let url = imageUrl;
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = url.startsWith('/') ? `${window.location.origin}${url}` : `${window.location.origin}/${url}`;
    }

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;

    const safeBase =
      (title || 'image')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'image';

    // Derive extension from mime type when possible
    const mime = blob.type || 'image/jpeg';
    const ext = mime.includes('png') ? 'png'
              : mime.includes('webp') ? 'webp'
              : mime.includes('gif') ? 'gif'
              : 'jpg';

    return new File([blob], `${safeBase}.${ext}`, { type: mime });
  } catch (e) {
    return null;
  }
}

// Hero Slider Functionality
function setupHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    const controls = document.querySelectorAll('.hero-control');
    
    if (slides.length === 0 || controls.length === 0) return;
    
    let currentSlide = 0;
    let slideInterval;
    
    function showSlide(index) {
        // Hide all slides
        slides.forEach(slide => slide.classList.remove('active'));
        controls.forEach(control => control.classList.remove('active'));
        
        // Show current slide
        slides[index].classList.add('active');
        controls[index].classList.add('active');
        
        currentSlide = index;
    }
    
    function nextSlide() {
        const nextIndex = (currentSlide + 1) % slides.length;
        showSlide(nextIndex);
    }
    
    function startAutoSlide() {
        slideInterval = setInterval(nextSlide, 3000); // Change slide every 3 seconds
    }
    
    function stopAutoSlide() {
        clearInterval(slideInterval);
    }
    
    // Add click handlers to controls
    controls.forEach((control, index) => {
        control.addEventListener('click', () => {
            showSlide(index);
            stopAutoSlide();
            startAutoSlide(); // Restart auto-slide
        });
    });
    
    // Pause auto-slide on hover
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.addEventListener('mouseenter', stopAutoSlide);
        hero.addEventListener('mouseleave', startAutoSlide);
    }
    
    // Start auto-slide
    startAutoSlide();
}

// Make sure the sharePost function is globally accessible
window.sharePost = sharePost;
