/**
 * Voting UI Component
 * Handles upvote/downvote interactions
 */

class VotingUI {
  constructor() {
    this.userVotes = new Map(); // Track user's votes
  }

  /**
   * Create voting widget for a target
   * @param {string} type - 'topic' or 'comment'
   * @param {number} id - Target ID
   * @param {number} score - Current vote score
   * @param {number} upvotes - Current upvotes
   * @param {number} downvotes - Current downvotes
   * @returns {HTMLElement} - Voting widget element
   */
  createWidget(type, id, score = 0, upvotes = 0, downvotes = 0) {
    const widget = document.createElement('div');
    widget.className = 'vote-widget';
    widget.dataset.type = type;
    widget.dataset.id = id;

    const currentVote = this.userVotes.get(`${type}:${id}`) || 0;

    widget.innerHTML = `
      <button class="vote-btn vote-up ${currentVote === 1 ? 'active' : ''}" data-vote="1" title="Upvote">
        <i class="fas fa-arrow-up"></i>
      </button>
      <span class="vote-score" title="${upvotes} upvotes, ${downvotes} downvotes">${score}</span>
      <button class="vote-btn vote-down ${currentVote === -1 ? 'active' : ''}" data-vote="-1" title="Downvote">
        <i class="fas fa-arrow-down"></i>
      </button>
    `;

    // Attach event listeners
    widget.querySelectorAll('.vote-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleVote(widget, type, id, parseInt(btn.dataset.vote, 10));
      });
    });

    return widget;
  }

  /**
   * Handle vote click
   */
  async handleVote(widget, type, id, voteType) {
    if (!window.authManager || !window.authManager.isAuthenticated()) {
      alert('Please log in to vote');
      window.location.href = '/profile';
      return;
    }

    const buttons = widget.querySelectorAll('.vote-btn');
    buttons.forEach(btn => btn.disabled = true);

    try {
      const response = await window.csrfManager.fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type, id, vote: voteType })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Vote failed');
      }

      const data = await response.json();

      // Update UI based on action
      const currentVote = this.userVotes.get(`${type}:${id}`) || 0;
      let newVote = data.vote;

      // If same vote was clicked, it was removed
      if (currentVote === voteType) {
        newVote = 0;
      }

      this.userVotes.set(`${type}:${id}`, newVote);

      // Update button states
      const upBtn = widget.querySelector('.vote-up');
      const downBtn = widget.querySelector('.vote-down');
      const scoreEl = widget.querySelector('.vote-score');

      upBtn.classList.toggle('active', newVote === 1);
      downBtn.classList.toggle('active', newVote === -1);

      // Update score (optimistic update)
      const currentScore = parseInt(scoreEl.textContent, 10) || 0;
      let scoreDelta = 0;

      if (currentVote === 0 && newVote === 1) scoreDelta = 1;
      else if (currentVote === 0 && newVote === -1) scoreDelta = -1;
      else if (currentVote === 1 && newVote === 0) scoreDelta = -1;
      else if (currentVote === 1 && newVote === -1) scoreDelta = -2;
      else if (currentVote === -1 && newVote === 0) scoreDelta = 1;
      else if (currentVote === -1 && newVote === 1) scoreDelta = 2;

      scoreEl.textContent = currentScore + scoreDelta;

    } catch (error) {
      console.error('Vote error:', error);
      alert('Failed to vote: ' + error.message);
    } finally {
      buttons.forEach(btn => btn.disabled = false);
    }
  }

  /**
   * Load user's votes for multiple targets
   */
  async loadUserVotes(targets) {
    if (!window.authManager || !window.authManager.isAuthenticated()) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // Load votes in parallel
    const promises = targets.map(async ({ type, id }) => {
      try {
        const response = await fetch(`/api/vote?type=${type}&id=${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          this.userVotes.set(`${type}:${id}`, data.vote || 0);
        }
      } catch (error) {
        console.error(`Failed to load vote for ${type}:${id}`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Initialize voting widgets on page
   */
  initializeWidgets() {
    // Find all vote containers and create widgets
    document.querySelectorAll('[data-vote-container]').forEach(container => {
      const type = container.dataset.voteType;
      const id = parseInt(container.dataset.voteId, 10);
      const score = parseInt(container.dataset.voteScore || '0', 10);
      const upvotes = parseInt(container.dataset.upvotes || '0', 10);
      const downvotes = parseInt(container.dataset.downvotes || '0', 10);

      if (type && id) {
        const widget = this.createWidget(type, id, score, upvotes, downvotes);
        container.appendChild(widget);
      }
    });
  }
}

// Global voting manager
window.votingManager = new VotingUI();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.votingManager.initializeWidgets();
});
