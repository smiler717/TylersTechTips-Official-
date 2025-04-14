// Generic function to handle comments for a specific article
function setupComments(articleId, formId, nameId, messageId, listId) {
    const form = document.getElementById(formId);
    const nameInput = document.getElementById(nameId);
    const messageInput = document.getElementById(messageId);
    const commentsList = document.getElementById(listId);

    // Load existing comments from localStorage
    const comments = JSON.parse(localStorage.getItem(`comments-${articleId}`)) || [];
    comments.forEach(comment => displayComment(comment));

    // Handle form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const message = messageInput.value.trim();
        if (name && message) {
            const comment = {
                name,
                message,
                date: new Date().toLocaleString()
            };
            comments.push(comment);
            localStorage.setItem(`comments-${articleId}`, JSON.stringify(comments));
            displayComment(comment);
            form.reset();
        }
    });

    // Display a single comment
    function displayComment(comment) {
        const commentDiv = document.createElement('div');
        commentDiv.classList.add('comment');
        commentDiv.innerHTML = `
            <p><strong>${comment.name}</strong> <span class="comment-date">${comment.date}</span></p>
            <p>${comment.message}</p>
        `;
        commentsList.appendChild(commentDiv);
    }
}

// Setup comments for each article
setupComments('cpu', 'comment-form-cpu', 'name-cpu', 'message-cpu', 'comments-list-cpu');
setupComments('pc', 'comment-form-pc', 'name-pc', 'message-pc', 'comments-list-pc');