/**
 * Helper Rating Component - Similar to Grab driver ratings
 * Used for displaying helper ratings in lists and cards
 */

class HelperRatingComponent {
    constructor() {
        this.cache = new Map(); // Cache rating data
        this.loadCSS();
    }

    loadCSS() {
        // Load helper ratings CSS if not already loaded
        if (!document.querySelector('link[href*="helper-ratings.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/helper-ratings.css';
            document.head.appendChild(link);
        }
    }

    /**
     * Generate rating badge class based on rating value
     */
    getRatingClass(rating) {
        const score = parseFloat(rating);
        if (score >= 4.8) return 'excellent';
        if (score >= 4.0) return 'good';
        if (score >= 3.0) return 'average';
        return 'poor';
    }

    /**
     * Generate stars display
     */
    generateStars(rating, showHalf = true) {
        const score = parseFloat(rating);
        const fullStars = Math.floor(score);
        const hasHalf = showHalf && (score % 1) >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

        return '★'.repeat(fullStars) + 
               (hasHalf ? '☆' : '') + 
               '☆'.repeat(emptyStars);
    }

    /**
     * Create inline rating display (for lists)
     */
    createInlineRating(helperData, options = {}) {
        const {
            showCount = true,
            showStars = true,
            clickable = false,
            size = 'small'
        } = options;

        const rating = helperData.rating || 5.0;
        const totalRatings = helperData.totalRatings || 0;
        const ratingClass = this.getRatingClass(rating);
        const isNewHelper = totalRatings < 5;

        const clickableClass = clickable ? 'helper-rating-clickable' : '';
        const clickHandler = clickable ? `onclick="viewHelperProfile(${helperData.id})"` : '';

        if (isNewHelper) {
            return `
                <div class="helper-rating-inline ${clickableClass}" ${clickHandler}>
                    <span class="new-helper-badge">New Helper</span>
                    ${totalRatings > 0 ? 
                        `<span class="rating-count-small">(${totalRatings} review${totalRatings !== 1 ? 's' : ''})</span>` 
                        : ''
                    }
                </div>
            `;
        }

        return `
            <div class="helper-rating-inline ${clickableClass}" ${clickHandler}>
                <span class="rating-badge-small ${ratingClass}">${parseFloat(rating).toFixed(1)}</span>
                ${showStars ? `<span class="rating-stars-small">${this.generateStars(rating)}</span>` : ''}
                ${showCount ? `<span class="rating-count-small">(${totalRatings})</span>` : ''}
            </div>
        `;
    }

    /**
     * Create card rating display (for helper cards)
     */
    createCardRating(helperData, options = {}) {
        const {
            showTrustBadges = true,
            showTrend = false
        } = options;

        const rating = helperData.rating || 5.0;
        const totalRatings = helperData.totalRatings || 0;
        const completedTasks = helperData.completedTasks || 0;
        const isVerified = helperData.isVerified || false;
        const memberSince = helperData.memberSince || new Date();

        const ratingDisplay = this.createInlineRating(helperData, { 
            clickable: true, 
            showStars: true 
        });

        const trustBadges = showTrustBadges ? this.generateTrustBadges({
            isVerified,
            completedTasks,
            memberSince,
            rating: parseFloat(rating)
        }) : '';

        const trendIndicator = showTrend ? this.generateTrendIndicator(helperData.ratingTrend) : '';

        return `
            <div class="helper-card-rating">
                <div class="rating-summary">
                    ${ratingDisplay}
                    ${trendIndicator}
                </div>
                ${trustBadges}
            </div>
        `;
    }

    /**
     * Generate trust badges based on helper metrics
     */
    generateTrustBadges({ isVerified, completedTasks, memberSince, rating }) {
        const badges = [];
        
        if (isVerified) {
            badges.push('<span class="trust-badge verified">✓ Verified</span>');
        }
        
        if (completedTasks >= 50) {
            badges.push('<span class="trust-badge experienced">Experienced</span>');
        } else if (completedTasks >= 10) {
            badges.push('<span class="trust-badge">Regular</span>');
        }

        if (rating >= 4.9 && completedTasks >= 20) {
            badges.push('<span class="trust-badge verified">Top Rated</span>');
        }

        return badges.length > 0 ? `
            <div class="trust-indicators">
                ${badges.join('')}
            </div>
        ` : '';
    }

    /**
     * Generate trend indicator
     */
    generateTrendIndicator(trend) {
        if (!trend) return '';

        const icons = {
            up: '↗',
            down: '↘', 
            stable: '→'
        };

        return `
            <div class="rating-trend ${trend}">
                ${icons[trend] || icons.stable}
            </div>
        `;
    }

    /**
     * Fetch and cache helper rating data
     */
    async fetchHelperRating(helperId) {
        if (this.cache.has(helperId)) {
            return this.cache.get(helperId);
        }

        try {
            const response = await window.AuthManager.authenticatedFetch(
                `http://localhost:5006/api/ratings/helper-profile/${helperId}`
            );
            
            if (response.ok) {
                const data = await response.json();
                const ratingData = {
                    id: helperId,
                    rating: parseFloat(data.ratings.average),
                    totalRatings: data.ratings.total,
                    completedTasks: data.helper.completedTasks,
                    memberSince: data.helper.memberSince,
                    isVerified: data.helper.isVerified || false,
                    name: data.helper.name
                };
                
                this.cache.set(helperId, ratingData);
                return ratingData;
            }
        } catch (error) {
            console.error('Failed to fetch helper rating:', error);
        }

        // Return default data if fetch fails
        return {
            id: helperId,
            rating: 5.0,
            totalRatings: 0,
            completedTasks: 0,
            memberSince: new Date(),
            isVerified: false
        };
    }

    /**
     * Update helper rating display in existing elements
     */
    async updateHelperRatingDisplay(helperId, containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Show loading state
        container.innerHTML = `
            <div class="helper-rating-inline">
                <div class="spinner-border spinner-border-sm" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;

        try {
            const helperData = await this.fetchHelperRating(helperId);
            const ratingHTML = options.card ? 
                this.createCardRating(helperData, options) : 
                this.createInlineRating(helperData, options);
            
            container.innerHTML = ratingHTML;
        } catch (error) {
            container.innerHTML = `
                <div class="helper-rating-inline">
                    <span class="text-muted small">Rating unavailable</span>
                </div>
            `;
        }
    }

    /**
     * Batch update multiple helper ratings
     */
    async updateMultipleRatings(helperRatingMappings) {
        const promises = helperRatingMappings.map(({ helperId, containerId, options }) =>
            this.updateHelperRatingDisplay(helperId, containerId, options)
        );
        
        await Promise.all(promises);
    }
}

// Initialize global helper rating component
window.HelperRating = new HelperRatingComponent();

// Global function to view helper profile (called from rating components)
function viewHelperProfile(helperId) {
    window.location.href = `/helper-profile.html?helperId=${helperId}`;
}

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HelperRatingComponent;
}