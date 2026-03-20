// Initialize Supabase client - Use var instead of const to avoid redeclaration
var supabaseClient = window.supabaseClient;

if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
        'https://apswdensachqenwsjflw.supabase.co',
        'sb_publishable_UxfaC3Ud3CL0V3AC08ZuBQ_KVZ3l2hn'
    );
    window.supabaseClient = supabaseClient;
}

// DOM Elements - Declare them but don't initialize yet
let logoutBtn, messageDiv, savePostBtn, clearFormBtn, imageUpload, uploadProgress, postsContainer;
let postIdInput, postTitleInput, postCategoryInput, postSummaryInput, postContentInput, postImageInput;
let editorsReady = false;
let pendingEditorData = null;

function sanitizeHtml(dirtyHtml) {
    if (!dirtyHtml) return '';
    if (!window.DOMPurify) return dirtyHtml;

    return window.DOMPurify.sanitize(dirtyHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['style', 'class', 'target', 'rel'],
        ADD_TAGS: ['font'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
    });
}

function getEditorHtml(editorId) {
    const editor = window.tinymce && window.tinymce.get(editorId);
    if (editor) return editor.getContent({ format: 'html' }).trim();

    const el = document.getElementById(editorId);
    return el ? el.value.trim() : '';
}

function setEditorHtml(editorId, html) {
    const editor = window.tinymce && window.tinymce.get(editorId);
    if (editor) {
        editor.setContent(html || '');
        return;
    }

    const el = document.getElementById(editorId);
    if (el) el.value = html || '';
}

async function initializeEditors() {
    if (!window.tinymce) return;
    if (!postSummaryInput || !postContentInput) return;
    if (editorsReady) return;

    const baseConfig = {
        branding: false,
        promotion: false,
        plugins: 'paste lists link table code autolink charmap searchreplace visualblocks wordcount',
        paste_data_images: false,
        paste_as_text: false,
        paste_merge_formats: false,
        paste_remove_styles_if_webkit: false,
        paste_remove_spans: false,
        valid_elements: '*[*]',
        font_family_formats: [
            'Arial=arial,helvetica,sans-serif',
            'Calibri=calibri,sans-serif',
            'Cambria=cambria,serif',
            'Courier New=courier new,courier,monospace',
            'Georgia=georgia,serif',
            'Segoe UI=segoe ui,sans-serif',
            'Tahoma=tahoma,arial,helvetica,sans-serif',
            'Times New Roman=times new roman,times,serif',
            'Trebuchet MS=trebuchet ms,geneva,sans-serif',
            'Verdana=verdana,geneva,sans-serif',
        ].join(';'),
        font_size_formats: '8pt 9pt 10pt 11pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt 60pt 72pt',
        content_style: 'body { font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; }',
    };

    const summaryConfig = {
        ...baseConfig,
        selector: '#post-summary',
        height: 220,
        menubar: false,
        toolbar:
            'undo redo | fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | outdent indent | removeformat | link | code',
    };

    const contentConfig = {
        ...baseConfig,
        selector: '#post-content',
        height: 520,
        menubar: true,
        toolbar:
            'undo redo | styles | fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist | outdent indent | blockquote | link table | removeformat | code',
    };

    await Promise.all([window.tinymce.init(summaryConfig), window.tinymce.init(contentConfig)]);
    editorsReady = true;

    if (pendingEditorData) {
        setEditorHtml('post-summary', pendingEditorData.summary);
        setEditorHtml('post-content', pendingEditorData.content);
        pendingEditorData = null;
    }
}

// Check authentication
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Auth session error:', error);
            return false;
        }
        
        if (!session) {
            console.log('No session found, redirecting to login');
            window.location.href = 'admin.html';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Check auth error:', error);
        return false;
    }
}

// Show message
function showMessage(text, type = 'success') {
    if (!messageDiv) return;
    
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (messageDiv) {
            messageDiv.style.display = 'none';
        }
    }, 3000);
}

// Upload image to Supabase Storage
async function uploadImage(file) {
    try {
        if (!uploadProgress) return null;
        
        // Show progress bar
        uploadProgress.style.display = 'block';
        const progressFill = uploadProgress.querySelector('.progress-fill');
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `post-images/${fileName}`;
        
        const { data, error } = await supabaseClient.storage
            .from('post-images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('post-images')
            .getPublicUrl(filePath);
        
        return urlData.publicUrl;
        
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    } finally {
        // Hide progress bar after a delay
        setTimeout(() => {
            if (uploadProgress) {
                uploadProgress.style.display = 'none';
                const progressFill = uploadProgress.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = '0%';
                }
            }
        }, 1000);
    }
}

// Save or update post
async function savePost() {
    try {
        if (!postTitleInput || !postSummaryInput || !postContentInput) {
            showMessage('Form elements not loaded properly', 'error');
            return;
        }
        
        const title = postTitleInput.value.trim();
        const category = postCategoryInput.value;
        const summary = sanitizeHtml(getEditorHtml('post-summary'));
        const content = sanitizeHtml(getEditorHtml('post-content'));
        const imageUrl = postImageInput ? postImageInput.value.trim() : '';
        const postId = postIdInput ? postIdInput.value : '';
        
        console.log('Saving post with data:', { title, category, summary, content, imageUrl, postId });
        
        // Validation
        if (!title || !summary || !content) {
            showMessage('Please fill in all required fields (title, summary, content)', 'error');
            return;
        }
        
        const postData = {
            title,
            category,
            summary,
            content,
            image_url: imageUrl || null,
            published: true,
            updated_at: new Date().toISOString()
        };
        
        let result;
        
        if (postId) {
            // Update existing post
            console.log('Updating post with ID:', postId);
            const { data, error } = await supabaseClient
                .from('posts')
                .update(postData)
                .eq('id', postId)
                .select();
            
            if (error) throw error;
            result = data[0];
            showMessage('Post updated successfully!');
        } else {
            // Create new post
            console.log('Creating new post');
            const { data, error } = await supabaseClient
                .from('posts')
                .insert([{ ...postData, created_at: new Date().toISOString() }])
                .select();
            
            if (error) throw error;
            result = data[0];
            showMessage('Post published successfully!');
        }
        
        // Clear form
        clearForm();
        
        // Reload posts list
        loadPosts();
        
        return result;
        
    } catch (error) {
        console.error('Save error:', error);
        showMessage(error.message || 'Error saving post', 'error');
    }
}

// Load all posts for management
async function loadPosts() {
    try {
        if (!postsContainer) {
            console.error('postsContainer is null - element not found');
            return;
        }
        
        console.log('Loading posts from database...');
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Database error:', error);
            throw error;
        }
        
        console.log('Posts loaded:', posts);
        
        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = '<p>No posts yet. Create your first post!</p>';
            return;
        }
        
        postsContainer.innerHTML = posts.map(post => `
            <div class="admin-post-item" data-id="${post.id}">
                <div class="admin-post-info">
                    <h3>${post.title}</h3>
                    <p><strong>Category:</strong> ${post.category} | 
                       <strong>Published:</strong> ${new Date(post.created_at).toLocaleDateString()}</p>
                </div>
                <div class="admin-post-actions">
                    <button class="btn btn-sm btn-edit" onclick="window.editPost('${post.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-delete" onclick="window.deletePost('${post.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load posts error:', error);
        if (postsContainer) {
            postsContainer.innerHTML = '<p>Error loading posts. Please check console for details.</p>';
        }
    }
}

// Edit post
async function editPost(postId) {
    try {
        console.log('Editing post with ID:', postId);
        const { data: post, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('id', postId)
            .single();
        
        if (error) throw error;
        
        // Fill form with post data
        if (postIdInput) postIdInput.value = post.id;
        if (postTitleInput) postTitleInput.value = post.title;
        if (postCategoryInput) postCategoryInput.value = post.category;
        if (editorsReady) {
            setEditorHtml('post-summary', post.summary || '');
            setEditorHtml('post-content', post.content || '');
        } else {
            if (postSummaryInput) postSummaryInput.value = post.summary || '';
            if (postContentInput) postContentInput.value = post.content || '';
            pendingEditorData = { summary: post.summary || '', content: post.content || '' };
        }
        if (postImageInput) postImageInput.value = post.image_url || '';
        
        // Update button text
        if (savePostBtn) {
            savePostBtn.innerHTML = '<i class="fas fa-save"></i> Update Post';
        }
        
        // Scroll to form
        const createSection = document.querySelector('#create-section');
        if (createSection) {
            createSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        showMessage('Post loaded for editing');
        
    } catch (error) {
        console.error('Edit error:', error);
        showMessage('Error loading post for editing', 'error');
    }
}

// Delete post
async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log('Deleting post with ID:', postId);
        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);
        
        if (error) throw error;
        
        showMessage('Post deleted successfully');
        loadPosts();
        
    } catch (error) {
        console.error('Delete error:', error);
        showMessage('Error deleting post', 'error');
    }
}

// Clear form
function clearForm() {
    if (postIdInput) postIdInput.value = '';
    if (postTitleInput) postTitleInput.value = '';
    if (postCategoryInput) postCategoryInput.value = 'news';
    setEditorHtml('post-summary', '');
    setEditorHtml('post-content', '');
    if (postImageInput) postImageInput.value = '';
    if (savePostBtn) {
        savePostBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Post';
    }
}

// Logout
async function logout() {
    try {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = 'admin.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Initialize DOM elements
function initializeElements() {
    logoutBtn = document.getElementById('logout-btn');
    messageDiv = document.getElementById('message');
    savePostBtn = document.getElementById('save-post-btn');
    clearFormBtn = document.getElementById('clear-form-btn');
    imageUpload = document.getElementById('image-upload');
    uploadProgress = document.getElementById('upload-progress');
    postsContainer = document.getElementById('admin-posts-container');
    
    // Form elements
    postIdInput = document.getElementById('post-id');
    postTitleInput = document.getElementById('post-title');
    postCategoryInput = document.getElementById('post-category');
    postSummaryInput = document.getElementById('post-summary');
    postContentInput = document.getElementById('post-content');
    postImageInput = document.getElementById('post-image');
    
    console.log('Elements initialized:', {
        logoutBtn: !!logoutBtn,
        messageDiv: !!messageDiv,
        savePostBtn: !!savePostBtn,
        postsContainer: !!postsContainer
    });
}

// Setup event listeners
function setupEventListeners() {
    // Save post button
    if (savePostBtn) {
        console.log('Setting up savePostBtn listener');
        savePostBtn.addEventListener('click', savePost);
    } else {
        console.error('savePostBtn not found');
    }
    
    // Clear form button
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearForm);
    }
    
    // Logout button
    if (logoutBtn) {
        console.log('Setting up logoutBtn listener');
        logoutBtn.addEventListener('click', logout);
    } else {
        console.error('logoutBtn not found');
    }
    
    // Image upload
    if (imageUpload) {
        imageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                showMessage('Please select an image file', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showMessage('Image size should be less than 5MB', 'error');
                return;
            }
            
            try {
                const imageUrl = await uploadImage(file);
                if (postImageInput) {
                    postImageInput.value = imageUrl;
                }
                showMessage('Image uploaded successfully!');
            } catch (error) {
                showMessage('Error uploading image', 'error');
            }
            
            // Reset file input
            imageUpload.value = '';
        });
    }
    
    // Sidebar navigation
    const sidebarLinks = document.querySelectorAll('.dashboard-sidebar a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                
                if (targetSection) {
                    // Update active state
                    sidebarLinks.forEach(l => l.parentElement.classList.remove('active'));
                    link.parentElement.classList.add('active');
                    
                    // Scroll to section
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard initialized');
    
    // Initialize elements
    initializeElements();

    // Initialize rich-text editors (TinyMCE)
    await initializeEditors();
    
    // Check authentication
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        console.log('Not authenticated, redirecting...');
        return;
    }
    
    console.log('User authenticated');
    
    // Setup event listeners
    setupEventListeners();
    
    // Load posts
    await loadPosts();
    
    console.log('Dashboard setup complete');
});

// Make functions available globally for onclick handlers
window.editPost = editPost;
window.deletePost = deletePost;
window.savePost = savePost;
window.logout = logout;
