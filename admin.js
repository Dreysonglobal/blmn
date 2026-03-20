// Use the global supabaseClient - Use the same variable name as script.js
const supabaseClient = window.supabaseClient || window.supabase.createClient(
    'https://apswdensachqenwsjflw.supabase.co',
    'sb_publishable_UxfaC3Ud3CL0V3AC08ZuBQ_KVZ3l2hn'
);

// Store it globally if not already stored
if (!window.supabaseClient) {
    window.supabaseClient = supabaseClient;
}

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageDiv = document.getElementById('login-message');

// Login function
async function login(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // Check if user is admin
        if (data.user) {
            showMessage('Login successful! Redirecting to dashboard...', 'success');
            
            // Store auth token in localStorage
            localStorage.setItem('admin_token', data.session.access_token);
            localStorage.setItem('admin_user', JSON.stringify(data.user));
            
            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showMessage(error.message || 'Invalid email or password', 'error');
    }
}

// Show message function
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    const token = localStorage.getItem('admin_token');
    if (token && window.location.pathname.includes('admin.html')) {
        // Verify token is still valid
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                window.location.href = 'dashboard.html';
            }
        });
    }
    
    // Login button click
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            if (!email || !password) {
                showMessage('Please enter both email and password', 'error');
                return;
            }
            
            login(email, password);
        });
    }
    
    // Allow login on Enter key
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        });
    }
});