// Configuration
const API_URL = 'http://localhost:5006/api';
let currentRating = 5;
let pastRatingsLoaded = false;
let allPastRatings = []; // Store all ratings for pagination and filtering
let filteredRatings = []; // Store filtered ratings
let currentUserRole = null; // Store current user role
window.currentRatingsPage = 1; // Current page for pagination

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
            // Update UI based on user role
            updateUIForRole(currentUser.role);
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
                <i class="fas fa-check-circle fa-4x text-success mb-4"></i>
                <h4 class="text-success mb-2">All Caught Up!</h4>
                <p class="text-muted">No pending ratings at the moment. Thank you for your feedback!</p>
            </div>
        `;
        return;
    }

    pendingList.innerHTML = ratings.map(rating => {
        const avatarUrl = rating.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(rating.firstname + ' ' + rating.lastname)}&background=28a745&color=fff`;
        return `
            <div class="card mb-3 border-0 shadow-sm hover-shadow" style="cursor: pointer;" 
                 onclick="openRatingModal(${rating.match_id}, '${rating.firstname} ${rating.lastname}', '${rating.title}')">
                <div class="card-body py-4">
                    <div class="row align-items-center">
                        <div class="col-md-2 text-center mb-3 mb-md-0">
                            <img src="${avatarUrl}" 
                                 alt="${rating.firstname} ${rating.lastname}" 
                                 class="rounded-circle shadow-sm" 
                                 style="width: 80px; height: 80px; object-fit: cover;">
                        </div>
                        <div class="col-md-7">
                            <h5 class="mb-2 fw-bold text-primary">
                                <i class="fas fa-hands-helping me-2"></i>
                                ${rating.firstname} ${rating.lastname}
                            </h5>
                            <p class="mb-2 text-dark">
                                <i class="fas fa-tasks me-2 text-muted"></i>
                                <strong>Service provided:</strong> ${rating.title}
                            </p>
                            <small class="text-muted">
                                <i class="fas fa-calendar-check me-1"></i>
                                Completed ${new Date(rating.completed_at).toLocaleDateString('en-MY')}
                            </small>
                        </div>
                        <div class="col-md-3 text-center">
                            <button class="btn btn-warning btn-lg px-4 fw-bold" 
                                    onclick="event.stopPropagation(); openRatingModal(${rating.match_id}, '${rating.firstname} ${rating.lastname}', '${rating.title}')">
                                <i class="fas fa-star me-2"></i>Rate Volunteer
                            </button>
                            <small class="text-muted d-block mt-2">
                                <i class="fas fa-heart me-1"></i>
                                Share your experience
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Open rating modal
function openRatingModal(matchId, volunteerName, requestTitle) {
    document.getElementById('currentMatchId').value = matchId;
    document.getElementById('modalHelperName').textContent = volunteerName;
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

        // Refresh past ratings if they are currently visible
        setTimeout(() => {
            refreshPastRatingsIfVisible();
        }, 1500);

    } catch (error) {
        console.error('Error submitting rating:', error);
        showAlert(`❌ ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Rating';
    }
}

// Function to refresh past ratings if they are currently visible
async function refreshPastRatingsIfVisible() {
    const pastRatingsSection = document.getElementById('pastRatingsSection');
    
    // Only refresh if the past ratings section is currently visible
    if (pastRatingsSection && pastRatingsSection.style.display === 'block') {
        console.log('Refreshing past ratings after new rating submission...');
        
        // Show temporary loading indicator
        const pastRatingsContent = document.getElementById('pastRatingsContent');
        const originalContent = pastRatingsContent.innerHTML;
        
        // Add subtle loading indicator
        pastRatingsContent.innerHTML += `
            <div class="alert alert-info text-center mt-2" id="refreshingIndicator">
                <i class="fas fa-sync fa-spin me-2"></i>
                <small>Updating your reviews...</small>
            </div>
        `;
        
        try {
            // Force reload the ratings data
            pastRatingsLoaded = false;
            await loadPastRatings();
            
            // Remove the loading indicator (it will be replaced by new content)
            const refreshingIndicator = document.getElementById('refreshingIndicator');
            if (refreshingIndicator) {
                refreshingIndicator.remove();
            }
            
            // Show a subtle indicator that the list was updated
            showAlert('✨ Your new rating has been added to your past reviews!', 'success');
            
            // Also refresh profile page volunteer rating if it exists (for same-page updates)
            if (typeof window.refreshProfileVolunteerRating === 'function') {
                window.refreshProfileVolunteerRating();
            }
        } catch (error) {
            console.error('Failed to refresh past ratings:', error);
            // Remove loading indicator and restore original content on error
            const refreshingIndicator = document.getElementById('refreshingIndicator');
            if (refreshingIndicator) {
                refreshingIndicator.remove();
            }
            // Silently fail - don't disrupt the user experience
        }
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

// Past Ratings Functions
async function togglePastRatings() {
    const pastRatingsSection = document.getElementById('pastRatingsSection');
    const pastRatingsContent = document.getElementById('pastRatingsContent');
    const filterSection = document.getElementById('filterSection');
    const toggleBtn = document.querySelector('[onclick="togglePastRatings()"]');
    const currentUser = window.AuthManager.getCurrentUser();
    const isVolunteer = currentUser && (currentUser.role === 'helper' || currentUser.role === 'volunteer');
    
    if (pastRatingsSection.style.display === 'none' || pastRatingsSection.style.display === '') {
        // Show past ratings
        pastRatingsSection.style.display = 'block';
        toggleBtn.innerHTML = `<i class="fas fa-eye-slash me-2"></i>Hide ${isVolunteer ? 'Community Feedback' : 'My Past Reviews'}`;
        
        // Load past ratings if not already loaded
        if (!pastRatingsLoaded) {
            await loadPastRatings();
        }
        
        // Show filter section if there are ratings
        if (allPastRatings.length > 0) {
            filterSection.style.display = 'block';
            updateFilterOptions(isVolunteer);
        }
    } else {
        // Hide past ratings
        pastRatingsSection.style.display = 'none';
        filterSection.style.display = 'none';
        toggleBtn.innerHTML = `<i class="fas fa-eye me-2"></i>View ${isVolunteer ? 'Community Feedback' : 'My Past Reviews'}`;
    }
}

async function loadPastRatings() {
    try {
        const pastRatingsContent = document.getElementById('pastRatingsContent');
        pastRatingsContent.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading your past ratings...</p>
            </div>
        `;

        const token = window.AuthManager.getToken();
        const currentUser = window.AuthManager.getCurrentUser();
        console.log('Current user:', currentUser); // Debug log
        console.log('API URL:', `${API_URL}/ratings/my-ratings`); // Debug log
        
        const response = await fetch(`${API_URL}/ratings/my-ratings`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status); // Debug log

        if (!response.ok) {
            if (response.status === 401) {
                await window.AuthManager.logout();
                window.location.href = '/login.html';
                return;
            }
            throw new Error(`Failed to load past ratings: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received data:', data); // Debug log
        allPastRatings = data.ratings || []; // Store globally for pagination
        filteredRatings = [...allPastRatings]; // Initialize filtered ratings
        currentUserRole = data.userRole || currentUser.role; // Store user role
        
        // Update UI based on user role
        const userRole = data.userRole || currentUser.role;
        updateUIForRole(userRole);
        
        displayPastRatings(filteredRatings, userRole);
        pastRatingsLoaded = true;
    } catch (error) {
        console.error('Error loading past ratings:', error);
        const pastRatingsContent = document.getElementById('pastRatingsContent');
        pastRatingsContent.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load past ratings. Please try again later.
                <br><small>Error: ${error.message}</small>
            </div>
        `;
    }
}

function displayPastRatings(ratings, userRole) {
    const pastRatingsContent = document.getElementById('pastRatingsContent');
    
    const isVolunteer = userRole === 'helper' || userRole === 'volunteer';
    
    if (!ratings || ratings.length === 0) {
        pastRatingsContent.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-heart fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">${isVolunteer ? 'No Community Feedback' : 'No Past Ratings'}</h5>
                <p class="text-muted">${isVolunteer ? 
                    "You haven't received any community ratings yet." : 
                    "You haven't rated any volunteers yet."}</p>
            </div>
        `;
        return;
    }

    // Show filter info if filters are applied
    const sortFilter = document.getElementById('sortFilter')?.value || 'recent';
    const ratingFilter = document.getElementById('ratingFilter')?.value || 'all';
    const isFiltered = sortFilter !== 'recent' || ratingFilter !== 'all';
    
    let filterInfoHtml = '';
    if (isFiltered && ratings.length < allPastRatings.length) {
        filterInfoHtml = `
            <div class="filter-info d-flex justify-content-between align-items-center">
                <span>
                    <i class="fas fa-filter me-2"></i>
                    Showing ${ratings.length} of ${allPastRatings.length} ratings
                </span>
                <button class="clear-filters-btn" onclick="clearAllFilters()">
                    <i class="fas fa-times me-1"></i>Clear Filters
                </button>
            </div>
        `;
    }

    // For volunteers, show community statistics
    if (isVolunteer && ratings.length > 0) {
        const avgRating = parseFloat(allPastRatings[0]?.avg_rating || 0);
        const totalRatings = parseInt(allPastRatings[0]?.total_ratings || 0);
        const currentMonth = new Date().toLocaleDateString('en-MY', { month: 'long' });
        
        pastRatingsContent.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card bg-primary text-white text-center">
                        <div class="card-body">
                            <h3 class="mb-0">${avgRating.toFixed(1)}/5</h3>
                            <small>Average Community Rating</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-success text-white text-center">
                        <div class="card-body">
                            <h3 class="mb-0">${totalRatings}</h3>
                            <small>Total Reviews</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-info text-white text-center">
                        <div class="card-body">
                            <h3 class="mb-0">${avgRating.toFixed(1)}/5</h3>
                            <small>This ${currentMonth}</small>
                        </div>
                    </div>
                </div>
            </div>
            ${filterInfoHtml}
            <h6 class="text-muted mb-3">
                <i class="fas fa-comments me-2"></i>Community Feedback
            </h6>
            <div id="ratingsContent"></div>
        `;
        
        // Display individual ratings in the ratingsContent div
        displayRatingsList(ratings, userRole);
    } else {
        pastRatingsContent.innerHTML = `
            ${filterInfoHtml}
            <h6 class="text-muted mb-3">
                <i class="fas fa-list me-2"></i>Your Past Reviews
            </h6>
            <div id="ratingsContent"></div>
        `;
        
        displayRatingsList(ratings, userRole);
    }
}

function displayRatingsList(ratings, userRole) {
    const ratingsContent = document.getElementById('ratingsContent');
    const isVolunteer = userRole === 'helper' || userRole === 'volunteer';
    
    // Pagination logic - 5 ratings per page
    const currentPage = window.currentRatingsPage || 1;
    const ratingsPerPage = 5;
    const totalPages = Math.ceil(ratings.length / ratingsPerPage);
    const startIndex = (currentPage - 1) * ratingsPerPage;
    const endIndex = startIndex + ratingsPerPage;
    const paginatedRatings = ratings.slice(startIndex, endIndex);

    const ratingsHtml = paginatedRatings.map(rating => {
        const ratingDate = new Date(rating.created_at).toLocaleDateString('en-MY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const stars = generateStarDisplay(rating.score);

        return `
            <div class="card mb-3 border-0 shadow-sm hover-shadow">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-3 text-center mb-3 mb-md-0">
                            <img src="${rating.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent((rating.firstname || '') + ' ' + (rating.lastname || ''))}&background=17a2b8&color=fff`}" 
                                 alt="${rating.firstname} ${rating.lastname}" 
                                 class="rounded-circle mb-2" 
                                 style="width: 80px; height: 80px; object-fit: cover;">
                            <h6 class="mb-1 fw-bold">${rating.firstname} ${rating.lastname}</h6>
                            <small class="text-muted">${ratingDate}</small>
                            ${isVolunteer ? 
                                '<small class="text-success d-block"><i class="fas fa-heart me-1"></i>Community Member</small>' : 
                                '<small class="text-info d-block"><i class="fas fa-hands-helping me-1"></i>Volunteer</small>'
                            }
                        </div>
                        <div class="col-md-9">
                            <div class="d-flex align-items-center mb-3">
                                <div class="me-3">
                                    ${stars}
                                </div>
                                <span class="badge bg-primary rounded-pill fs-6">${rating.score}/5</span>
                            </div>
                            ${rating.comment ? `
                                <div class="bg-light rounded p-3">
                                    <small class="text-muted d-block mb-1">
                                        <i class="fas fa-quote-left me-1"></i>
                                        ${isVolunteer ? 'Your feedback:' : 'Your review:'}
                                    </small>
                                    <p class="mb-0 fst-italic">"${rating.comment}"</p>
                                </div>
                            ` : `
                                <div class="bg-light rounded p-3">
                                    <small class="text-muted fst-italic">
                                        <i class="fas fa-comment-slash me-1"></i>
                                        No written feedback provided
                                    </small>
                                </div>
                            `}
                            ${rating.title ? `
                                <div class="mt-2">
                                    <small class="text-muted d-block">
                                        <i class="fas fa-tasks me-1"></i>Service provided:
                                    </small>
                                    <small class="text-dark fw-bold">${rating.title}</small>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Generate pagination
    const paginationHtml = totalPages > 1 ? `
        <div class="pagination">
            <button ${currentPage === 1 ? 'disabled' : ''} 
                onclick="changePage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            <span class="page-info">Page ${currentPage} of ${totalPages}</span>
            <button ${currentPage === totalPages ? 'disabled' : ''} 
                onclick="changePage(${currentPage + 1})">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    ` : '';

    ratingsContent.innerHTML = ratingsHtml + paginationHtml;
}

function generateStarDisplay(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHtml = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="fas fa-star text-warning"></i>';
    }
    
    // Half star
    if (hasHalfStar) {
        starsHtml += '<i class="fas fa-star-half-alt text-warning"></i>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="far fa-star text-warning"></i>';
    }
    
    return starsHtml;
}

// Pagination function for past ratings
function changePage(page) {
    window.currentRatingsPage = page;
    displayPastRatings(filteredRatings, currentUserRole);
}

// Filter Functions
function updateFilterOptions(isVolunteer) {
    const sortFilter = document.getElementById('sortFilter');
    
    // Update sort options based on user role
    if (isVolunteer) {
        sortFilter.innerHTML = `
            <option value="recent">Most Recent</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
            <option value="comments">With Feedback</option>
        `;
    } else {
        sortFilter.innerHTML = `
            <option value="recent">Most Recent</option>
            <option value="highest">Highest Rated Given</option>
            <option value="lowest">Lowest Rated Given</option>
            <option value="comments">With Comments</option>
        `;
    }
}

function applySortFilter() {
    const sortValue = document.getElementById('sortFilter').value;
    const ratingValue = document.getElementById('ratingFilter').value;
    
    // Apply both sort and rating filters
    let sortedRatings = [...allPastRatings];
    
    // First apply rating filter - filter for exact rating match
    if (ratingValue !== 'all') {
        const exactRating = parseInt(ratingValue);
        sortedRatings = sortedRatings.filter(rating => rating.score === exactRating);
    }
    
    // Then apply sort filter
    switch (sortValue) {
        case 'highest':
            sortedRatings.sort((a, b) => b.score - a.score);
            break;
        case 'lowest':
            sortedRatings.sort((a, b) => a.score - b.score);
            break;
        case 'comments':
            // Show ratings with comments first, then sort by date
            sortedRatings.sort((a, b) => {
                if (a.comment && !b.comment) return -1;
                if (!a.comment && b.comment) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            });
            break;
        case 'recent':
        default:
            sortedRatings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
    }
    
    filteredRatings = sortedRatings;
    window.currentRatingsPage = 1; // Reset to first page
    displayPastRatings(filteredRatings, currentUserRole);
}

function applyRatingFilter() {
    applySortFilter(); // Use the same function since it handles both filters
}

function clearAllFilters() {
    // Reset filter values
    document.getElementById('sortFilter').value = 'recent';
    document.getElementById('ratingFilter').value = 'all';
    
    // Reset filtered ratings to show all
    filteredRatings = [...allPastRatings];
    window.currentRatingsPage = 1;
    displayPastRatings(filteredRatings, currentUserRole);
}

// Update UI labels based on user role
function updateUIForRole(userRole) {
    const isVolunteer = userRole === 'helper' || userRole === 'volunteer';
    const toggleBtn = document.querySelector('[onclick="togglePastRatings()"]');
    
    // Update toggle button text
    if (toggleBtn) {
        if (isVolunteer) {
            toggleBtn.innerHTML = '<i class="fas fa-eye me-2"></i>View Community Feedback';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-eye me-2"></i>View My Past Reviews';
        }
    }
    
    // Update main section titles
    const pendingTitle = document.getElementById('pendingTitle');
    const pendingSubtitle = document.getElementById('pendingSubtitle');
    const ratingsTitle = document.getElementById('ratingsTitle');
    const ratingsSubtitle = document.getElementById('ratingsSubtitle');
    
    if (isVolunteer) {
        if (pendingTitle) pendingTitle.textContent = 'Community Feedback';
        if (pendingSubtitle) pendingSubtitle.textContent = 'See how the community values your help';
        if (ratingsTitle) ratingsTitle.textContent = 'Community Appreciation';
        if (ratingsSubtitle) ratingsSubtitle.textContent = 'Reviews and Feedback from those you\'ve helped';
    } else {
        if (pendingTitle) pendingTitle.textContent = 'Rate Volunteers';
        if (pendingSubtitle) pendingSubtitle.textContent = 'Share your experience to help our community';
        if (ratingsTitle) ratingsTitle.textContent = 'Your Past Reviews';
        if (ratingsSubtitle) ratingsSubtitle.textContent = 'View your feedback to community volunteers';
    }
}