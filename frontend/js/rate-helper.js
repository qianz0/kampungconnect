// Configuration
const API_URL = 'http://localhost:5006/api';
let currentRating = 5;

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // Show loading overlay
        document.getElementById('loadingOverlay').style.display = 'flex';
        
        // Initialize AuthManager first
        await window.AuthManager.initialize();
        
        // Check authentication before loading ratings
        const isAuthenticated = await window.AuthManager.checkAuthentication();
        if (!isAuthenticated) {
            window.location.href = '/login.html';
            return;
        }

        // Get user info and update UI
        const currentUser = window.AuthManager.getCurrentUser();
        if (currentUser) {
            // Update user info in navbar
            document.getElementById('userName').textContent = 
                currentUser.firstname && currentUser.lastname 
                    ? `${currentUser.firstname} ${currentUser.lastname}`
                    : currentUser.email;
            
            const avatar = document.getElementById('userAvatar');
            avatar.src = currentUser.picture || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.firstname + ' ' + currentUser.lastname)}&background=6c757d&color=fff`;
            avatar.alt = currentUser.firstname + ' ' + currentUser.lastname;
        }
        
        await loadPendingRatings();
        document.getElementById('loadingOverlay').style.display = 'none';
    } catch (error) {
        console.error('Failed to initialize:', error);
        showAlert('Failed to load ratings. Please try again later.', 'danger');
        document.getElementById('loadingOverlay').style.display = 'none';
    }
});

// Load pending ratings
async function loadPendingRatings() {
    try {
        // Use AuthManager for authenticated requests
        const response = await window.AuthManager.authenticatedFetch(`${API_URL}/ratings/pending-ratings`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load pending ratings');
        }

        const data = await response.json();
        displayPendingRatings(data.pendingRatings);

    } catch (error) {
        console.error('Error loading pending ratings:', error);
        const errorMessage = error.response ? error.response.data.error : error.message;
        document.getElementById('pendingList').innerHTML = `
            <div class="empty-state">
                <p style="color: #e74c3c;">❌ Failed to load pending ratings: ${errorMessage}</p>
            </div>
        `;
    }
}

// Display pending ratings
function displayPendingRatings(ratings) {
    const pendingList = document.getElementById('pendingList');

    if (ratings.length === 0) {
        pendingList.innerHTML = `
            <div class="text-center py-5">
                <div class="display-1 text-muted mb-4">🎉</div>
                <h4 class="text-muted mb-2">All Caught Up!</h4>
                <p class="text-muted">You don't have any pending ratings</p>
            </div>
        `;
        return;
    }

    pendingList.innerHTML = ratings.map(rating => {
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(rating.firstname + ' ' + rating.lastname)}&background=6c757d&color=fff`;
        return `
            <div class="card mb-3 hover-shadow cursor-pointer" onclick="openRatingModal(${rating.match_id}, '${rating.firstname} ${rating.lastname}', '${rating.title}')">
                <div class="card-body d-flex align-items-center py-3">
                    <img src="${avatarUrl}" 
                         class="rounded-circle me-3" 
                         alt="${rating.firstname} ${rating.lastname}"
                         width="48" height="48">
                    <div class="flex-grow-1">
                        <h5 class="card-title mb-1">${rating.firstname} ${rating.lastname}</h5>
                        <p class="card-text text-muted mb-2">${rating.title}</p>
                        <span class="badge bg-secondary">${rating.category}</span>
                    </div>
                    <button class="btn btn-primary ms-3" 
                            onclick="event.stopPropagation(); openRatingModal(${rating.match_id}, '${rating.firstname} ${rating.lastname}', '${rating.title}')">
                        <i class="fas fa-star me-2"></i>Rate Helper
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Open rating modal
function openRatingModal(matchId, helperName, requestTitle) {
    document.getElementById('currentMatchId').value = matchId;
    document.getElementById('modalHelperName').textContent = helperName;
    document.getElementById('modalRequestTitle').textContent = requestTitle;
    document.getElementById('ratingComment').value = '';
    setRating(5); // Reset to default
    
    const ratingModal = new bootstrap.Modal(document.getElementById('ratingModal'));
    ratingModal.show();
}

// Close modal
function closeModal() {
    const ratingModal = bootstrap.Modal.getInstance(document.getElementById('ratingModal'));
    if (ratingModal) {
        ratingModal.hide();
    }
}

// Set star rating
function setRating(rating) {
    currentRating = rating;
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('filled');
        } else {
            star.classList.remove('filled');
        }
    });
}

// Submit rating
async function submitRating(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const matchId = parseInt(document.getElementById('currentMatchId').value);
    const comment = document.getElementById('ratingComment').value.trim();

    try {
        const response = await window.AuthManager.authenticatedFetch(`${API_URL}/ratings`, {
            method: 'POST',
            body: JSON.stringify({
                matchId,
                score: currentRating,
                comment: comment || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to submit rating');
        }

        showAlert('✅ Rating submitted successfully!', 'success');
        closeModal();
        
        // Reload pending ratings
        setTimeout(() => {
            loadPendingRatings();
        }, 1000);

    } catch (error) {
        console.error('Error submitting rating:', error);
        showAlert(`❌ ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Rating';
    }
}

// Show alert message
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas ${type === 'success' ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-danger'} me-2"></i>
            ${message}
        </div>
    `;
    alertBox.className = `alert alert-${type === 'success' ? 'success' : 'danger'} d-flex align-items-center fade show`;
    
    setTimeout(() => {
        alertBox.classList.remove('show');
        setTimeout(() => {
            alertBox.className = 'alert d-none';
        }, 150);
    }, 5000);
}

// Close modal on background click
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ratingModal').addEventListener('click', (e) => {
        if (e.target.id === 'ratingModal') {
            closeModal();
        }
    });
});