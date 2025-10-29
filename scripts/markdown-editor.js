/**
 * Lightweight Markdown Editor
 * Uses marked.js for parsing and provides live preview
 */

class MarkdownEditor {
  constructor(textareaId, options = {}) {
    this.textarea = document.getElementById(textareaId);
    if (!this.textarea) {
      console.error(`Textarea with id "${textareaId}" not found`);
      return;
    }

    this.options = {
      showPreview: options.showPreview !== false,
      previewClass: options.previewClass || 'markdown-preview',
      toolbar: options.toolbar !== false,
      maxLength: options.maxLength || 10000,
      ...options
    };

    this.init();
  }

  init() {
    // Wrap textarea in container
    this.container = document.createElement('div');
    this.container.className = 'markdown-editor';
    this.textarea.parentNode.insertBefore(this.container, this.textarea);
    this.container.appendChild(this.textarea);

    // Add toolbar if enabled
    if (this.options.toolbar) {
      this.addToolbar();
    }

    // Add preview pane if enabled
    if (this.options.showPreview) {
      this.addPreview();
    }

    // Add character counter
    this.addCharCounter();

    // Setup event listeners
    this.setupListeners();

    // Initial render
    this.updatePreview();
  }

  addToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'markdown-toolbar';
    this.toolbar.innerHTML = `
      <button type="button" data-action="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
      <button type="button" data-action="italic" title="Italic (Ctrl+I)"><em>I</em></button>
      <button type="button" data-action="heading" title="Heading">H</button>
      <button type="button" data-action="link" title="Link (Ctrl+K)">🔗</button>
      <button type="button" data-action="code" title="Code">&lt;/&gt;</button>
      <button type="button" data-action="quote" title="Quote">"</button>
      <button type="button" data-action="list" title="List">•</button>
      <button type="button" data-action="preview" title="Toggle Preview">👁</button>
    `;
    this.container.insertBefore(this.toolbar, this.textarea);

    // Toolbar event listeners
    this.toolbar.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        const action = e.target.dataset.action;
        this.executeAction(action);
      }
    });
  }

  addPreview() {
    this.previewContainer = document.createElement('div');
    this.previewContainer.className = 'markdown-preview-container';
    this.previewContainer.style.display = 'none';
    
    this.preview = document.createElement('div');
    this.preview.className = this.options.previewClass;
    
    this.previewContainer.appendChild(this.preview);
    this.container.appendChild(this.previewContainer);
  }

  addCharCounter() {
    this.counter = document.createElement('div');
    this.counter.className = 'markdown-counter';
    this.container.appendChild(this.counter);
    this.updateCounter();
  }

  setupListeners() {
    // Update preview on input
    this.textarea.addEventListener('input', () => {
      this.updatePreview();
      this.updateCounter();
    });

    // Keyboard shortcuts
    this.textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            this.executeAction('bold');
            break;
          case 'i':
            e.preventDefault();
            this.executeAction('italic');
            break;
          case 'k':
            e.preventDefault();
            this.executeAction('link');
            break;
        }
      }

      // Tab key - insert spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        this.insertText('  ');
      }
    });
  }

  executeAction(action) {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selectedText = this.textarea.value.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch(action) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        cursorOffset = selectedText ? replacement.length : 2;
        break;
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        cursorOffset = selectedText ? replacement.length : 1;
        break;
      case 'heading':
        replacement = `## ${selectedText || 'Heading'}`;
        cursorOffset = selectedText ? replacement.length : 3;
        break;
      case 'link':
        const url = prompt('Enter URL:') || 'https://';
        replacement = `[${selectedText || 'link text'}](${url})`;
        cursorOffset = replacement.length;
        break;
      case 'code':
        if (selectedText.includes('\n')) {
          replacement = `\`\`\`\n${selectedText || 'code'}\n\`\`\``;
        } else {
          replacement = `\`${selectedText || 'code'}\``;
        }
        cursorOffset = replacement.length;
        break;
      case 'quote':
        replacement = `> ${selectedText || 'quote'}`;
        cursorOffset = replacement.length;
        break;
      case 'list':
        replacement = `- ${selectedText || 'list item'}`;
        cursorOffset = replacement.length;
        break;
      case 'preview':
        this.togglePreview();
        return;
    }

    this.replaceSelection(replacement, cursorOffset);
  }

  replaceSelection(text, cursorOffset = 0) {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const before = this.textarea.value.substring(0, start);
    const after = this.textarea.value.substring(end);

    this.textarea.value = before + text + after;
    this.textarea.selectionStart = this.textarea.selectionEnd = start + cursorOffset;
    this.textarea.focus();

    this.updatePreview();
    this.updateCounter();
  }

  insertText(text) {
    const start = this.textarea.selectionStart;
    const before = this.textarea.value.substring(0, start);
    const after = this.textarea.value.substring(start);

    this.textarea.value = before + text + after;
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    this.updatePreview();
    this.updateCounter();
  }

  togglePreview() {
    if (!this.previewContainer) return;

    if (this.previewContainer.style.display === 'none') {
      this.previewContainer.style.display = 'block';
      this.textarea.style.display = 'none';
    } else {
      this.previewContainer.style.display = 'none';
      this.textarea.style.display = 'block';
    }
  }

  updatePreview() {
    if (!this.preview) return;
    
    const markdown = this.textarea.value;
    
    // Simple markdown rendering (basic support)
    let html = this.parseMarkdown(markdown);
    
    this.preview.innerHTML = html;
  }

  parseMarkdown(text) {
    // Basic markdown parser (simplified)
    // In production, use marked.js or similar library
    let html = text;

    // Escape HTML
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Quotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    return html;
  }

  updateCounter() {
    const length = this.textarea.value.length;
    const max = this.options.maxLength;
    const remaining = max - length;
    
    this.counter.textContent = `${length} / ${max} characters`;
    
    if (remaining < 100) {
      this.counter.style.color = '#ff4444';
    } else if (remaining < 500) {
      this.counter.style.color = '#ff9800';
    } else {
      this.counter.style.color = '#666';
    }
  }

  getValue() {
    return this.textarea.value;
  }

  setValue(value) {
    this.textarea.value = value;
    this.updatePreview();
    this.updateCounter();
  }
}

// Auto-initialize markdown editors
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.markdown-textarea').forEach(textarea => {
    new MarkdownEditor(textarea.id, {
      showPreview: true,
      toolbar: true
    });
  });
});
