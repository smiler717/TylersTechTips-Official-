/**
 * File Upload UI Component
 * Handle file uploads with drag-and-drop
 */

class FileUploader {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      maxFiles: options.maxFiles || 5,
      maxSize: options.maxSize || 10 * 1024 * 1024, // 10MB
      allowedTypes: options.allowedTypes || ['image/*', 'application/pdf', 'text/*'],
      targetType: options.targetType || null,
      targetId: options.targetId || null,
      onUpload: options.onUpload || (() => {}),
      onError: options.onError || (() => {})
    };
    this.files = [];
    this.uploads = new Map();
    
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="file-uploader">
        <div class="upload-zone" id="upload-zone">
          <i class="fas fa-cloud-upload-alt"></i>
          <p>Drag & drop files here or <span class="browse-link">browse</span></p>
          <input type="file" id="file-input" multiple style="display: none;" accept="${this.options.allowedTypes.join(',')}">
        </div>
        <div class="file-list" id="file-list"></div>
      </div>
    `;

    this.uploadZone = this.container.querySelector('#upload-zone');
    this.fileInput = this.container.querySelector('#file-input');
    this.fileList = this.container.querySelector('#file-list');
    this.browseLink = this.container.querySelector('.browse-link');

    this.attachEvents();
  }

  attachEvents() {
    // Click to browse
    this.browseLink.addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', (e) => {
      this.handleFiles(Array.from(e.target.files));
    });

    // Drag and drop
    this.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadZone.classList.add('drag-over');
    });

    this.uploadZone.addEventListener('dragleave', () => {
      this.uploadZone.classList.remove('drag-over');
    });

    this.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadZone.classList.remove('drag-over');
      this.handleFiles(Array.from(e.dataTransfer.files));
    });
  }

  handleFiles(files) {
    if (this.files.length + files.length > this.options.maxFiles) {
      this.options.onError(`Maximum ${this.options.maxFiles} files allowed`);
      return;
    }

    for (const file of files) {
      // Validate file
      if (file.size > this.options.maxSize) {
        this.options.onError(`File ${file.name} exceeds size limit`);
        continue;
      }

      this.files.push(file);
      this.addFileToList(file);
      this.uploadFile(file);
    }
  }

  addFileToList(file) {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const isImage = file.type.startsWith('image/');

    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.fileId = fileId;
    fileItem.innerHTML = `
      <div class="file-preview">
        ${isImage 
          ? `<img src="${URL.createObjectURL(file)}" alt="${file.name}">`
          : `<i class="fas fa-file"></i>`
        }
      </div>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${this.formatFileSize(file.size)}</div>
        <div class="file-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <span class="progress-text">0%</span>
        </div>
      </div>
      <button class="file-remove" title="Remove">
        <i class="fas fa-times"></i>
      </button>
    `;

    fileItem.querySelector('.file-remove').addEventListener('click', () => {
      this.removeFile(fileId);
    });

    this.fileList.appendChild(fileItem);
    this.uploads.set(fileId, { file, element: fileItem });
  }

  async uploadFile(file) {
    const fileId = Array.from(this.uploads.entries())
      .find(([id, data]) => data.file === file)?.[0];
    
    if (!fileId) return;

    const upload = this.uploads.get(fileId);
    const progressFill = upload.element.querySelector('.progress-fill');
    const progressText = upload.element.querySelector('.progress-text');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (this.options.targetType) formData.append('targetType', this.options.targetType);
      if (this.options.targetId) formData.append('targetId', this.options.targetId);

      const response = await window.csrfManager.fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      // Update progress to 100%
      progressFill.style.width = '100%';
      progressText.textContent = '100%';

      // Mark as complete
      upload.element.classList.add('complete');
      
      // Callback
      this.options.onUpload(data.attachment);

    } catch (error) {
      console.error('Upload error:', error);
      upload.element.classList.add('error');
      progressText.textContent = 'Failed';
      this.options.onError(`Upload failed: ${file.name}`);
    }
  }

  removeFile(fileId) {
    const upload = this.uploads.get(fileId);
    if (upload) {
      upload.element.remove();
      this.uploads.delete(fileId);
      this.files = this.files.filter(f => f !== upload.file);
    }
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  clear() {
    this.files = [];
    this.uploads.clear();
    this.fileList.innerHTML = '';
  }
}

// Export for use
window.FileUploader = FileUploader;
