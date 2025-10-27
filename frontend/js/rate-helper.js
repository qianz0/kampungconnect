// Configuration
const API_URL = 'http://localhost:5006/api';
let currentRating = 5;
let authToken = null;

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    authToken = localStorage.getItem('authToken');
    
    if (!authToken) {
        showAlert('Please login to view ratings', 'error');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
        return;
    }

    loadPendingRatings();
});

// Load pending ratings
async function loadPendingRatings() {
    try {
        const response = await fetch(`${API_URL}/ratings/pending-ratings`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load pending ratings');
        }

        const data = await response.json();
        displayPendingRatings(data.pendingRatings);

    } catch (error) {
        console.error('Error loading pending ratings:', error);
        document.getElementById('pendingList').innerHTML = `
            <div class="empty-state">
                <p style="color: #e74c3c;">❌ Failed to load pending ratings</p>
            </div>
        `;
    }
}

// Display pending ratings
function displayPendingRatings(ratings) {
    const pendingList = document.getElementById('pendingList');

    if (ratings.length === 0) {
        pendingList.innerHTML = `
            <div class="empty-state">
                <h3>All Caught Up! 🎉</h3>
                <p>You don't have any pending ratings</p>
            </div>
        `;
        return;
    }

    pendingList.innerHTML = ratings.map(rating => {
        const initials = `${rating.firstname.charAt(0)}${rating.lastname.charAt(0)}`.toUpperCase();
        return `
            <div class="pending-item" onclick="openRatingModal(${rating.match_id}, '${rating.firstname} ${rating.lastname}', '${rating.title}')">
                <div class="helper-avatar">${initials}</div>
                <div class="helper-info">
                    <div class="helper-name">${rating.firstname} ${rating.lastname}</div>
                    <div class="request-title">${rating.title}</div>
                    <span class="request-category">${rating.category}</span>
                </div>
                <button class="rate-btn" onclick="event.stopPropagation(); openRatingModal(${rating.match_id}, '${rating.firstname} ${rating.lastname}', '${rating.title}')">
                    Rate Helper
                </button>
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
    document.getElementById('ratingModal').classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('ratingModal').classList.remove('active');
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
        const response = await fetch(`${API_URL}/ratings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
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
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type} show`;
    
    setTimeout(() => {
        alertBox.classList.remove('show');
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