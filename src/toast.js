// Toast Notification Utility
// Provides a simple toast notification system for displaying errors, warnings, and success messages

// Global toast functions - no modules needed
window.showToast = function(message, type = 'error', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icons for different types
    const icons = {
        error: '❌',
        warning: '⚠️',
        success: '✅'
    };

    // Toast content
    toast.innerHTML = `
        <div class="toast-icon" aria-hidden="true">${icons[type] || 'ℹ️'}</div>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close notification">×</button>
    `;

    // Add to container
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            hideToast(toast);
        }, duration);
    }

    return toast;
};

window.hideToast = function(toast) {
    if (toast && toast.parentElement) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }
};

window.showError = function(message, duration = 5000) {
    return showToast(message, 'error', duration);
};

window.showWarning = function(message, duration = 4000) {
    return showToast(message, 'warning', duration);
};

window.showSuccess = function(message, duration = 3000) {
    return showToast(message, 'success', duration);
};

window.clearAllToasts = function() {
    const container = document.getElementById('toast-container');
    if (container) {
        container.innerHTML = '';
    }
}; 