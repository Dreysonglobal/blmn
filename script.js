// Initialize Supabase client - Use a different variable name
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
        'https://objlzhklfzmntsrzczdm.supabase.co',
        'sb_publishable_BkY6SheoAwuRAangWIhzCQ_P3OMyYME'
    );
}

// Use the global supabaseClient - DON'T use 'const supabase'
const supabaseClient = window.supabaseClient;

// DOM Elements
const postsContainer = document.getElementById('posts-container');
const hamburger = document.getElementById('hamburger');
const navbar = document.getElementById('navbar');

// Set current year in footer
document.addEventListener('DOMContentLoaded', () => {
    const currentYear = document.getElementById('current-year');
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }
    
    // Load posts on homepage
    if (postsContainer) {
        loadPosts();
    }
    
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
    
    // Load article if on article page
    if (window.location.pathname.includes('article.html')) {
        loadArticle();
        setupShareButtons();
    }
});

// Load posts from Supabase
async function loadPosts() {
    try {
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
    
    return `
        <article class="post-card">
            ${post.image_url ? `
                <img src="${post.image_url}" alt="${post.title}" class="post-image">
            ` : `
                <div class="post-image" style="background-color: #e9ecef; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-newspaper" style="font-size: 3rem; color: #6c757d;"></i>
                </div>
            `}
            
            <div class="post-content">
                <span class="post-category">${post.category.toUpperCase()}</span>
                <h3 class="post-title">${post.title}</h3>
                <p class="post-summary">${post.summary}</p>
                
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

    const text = post && post.summary ? post.summary : (post ? post.title : '');
    
    if (navigator.share) {
        navigator.share({
            title: post ? post.title : 'Transport and Society Online',
            text: text,
            url: shareUrl
        });
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
        const { data: post, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('id', postId)
            .single();
        
        if (error) throw error;
        
        if (!post) {
            articleContent.innerHTML = `
                <div class=\"error-message\"> 
                    <h1>Article Not Found</h1>
                    <p>The requested article could not be found.</p>
                    <a href=\"index.html\" class=\"read-more\">Back to Home</a>
                </div>
            `;
            return;
        }
        
        // Update page metadata for social sharing
        updateMetaTags(post);
        // Cache current article for improved sharing on the article page
        window.currentArticle = post;
        
        // Display article
        articleContent.innerHTML = `
            <div class=\"article-header\">
                <span class=\"post-category\">${post.category.toUpperCase()}</span>
                <h1>${post.title}</h1>
                <div class=\"article-meta\">
                    <span><i class=\"far fa-calendar\"></i> ${new Date(post.created_at).toLocaleDateString()}</span>
                </div>
            </div>
            
            ${post.image_url ? `
                <img src=\"${post.image_url}\" alt=\"${post.title}\" class=\"article-image\">
            ` : ''}
            
            <div class=\"article-body\">
                ${post.content.replace(/\n/g, '<br>')}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading article:', error);
        articleContent.innerHTML = `
            <div class=\"error-message\">
                <h1>Error Loading Article</h1>
                <p>There was an error loading the article. Please try again later.</p>
                <a href=\"index.html\" class=\"read-more\">Back to Home</a>
            </div>
        `;
    }
}

// Update meta tags for social sharing
function updateMetaTags(post) {
    // Update page title
    document.title = `${post.title} - Transport and Society Online`;
    
    // Create meta tags if they don't exist
    const metaTags = {
        'og:title': post.title,
        'og:description': post.summary,
        'og:url': window.location.href,
        'og:image': post.image_url || `${window.location.origin}/default-og-image.jpg`,
        'twitter:title': post.title,
        'twitter:description': post.summary,
        'twitter:image': post.image_url || `${window.location.origin}/default-og-image.jpg`
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
}

// Setup share buttons
function setupShareButtons() {
    const whatsappBtn = document.getElementById('whatsapp-share');
    const facebookBtn = document.getElementById('facebook-share');
    const twitterBtn = document.getElementById('twitter-share');
    const copyLinkBtn = document.getElementById('copy-link');
    
    const currentUrl = encodeURIComponent(window.location.href);
    const pageTitle = encodeURIComponent(document.title);
    
    // Prefer article summary for WhatsApp share text if available
    let waText = pageTitle;
    if (typeof window.currentArticle !== 'undefined' && window.currentArticle && window.currentArticle.summary) {
        waText = encodeURIComponent(window.currentArticle.summary);
    }

    if (whatsappBtn) {
        whatsappBtn.href = `https://wa.me/?text=${waText}%20${currentUrl}`;
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
                setTimeout(() => {
                    copyLinkBtn.innerHTML = originalText;
                }, 2000);
            });
        });
    }
}

// Make sharePost available globally for onclick handlers
window.sharePost = sharePost;