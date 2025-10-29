/**
 * PWA Installer
 * Handle service worker registration and install prompt
 */

class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    
    this.init();
  }

  async init() {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('PWA is installed');
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        console.log('Service Worker registered:', registration.scope);

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('New service worker found');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.showUpdateNotification();
            }
          });
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Handle successful install
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.isInstalled = true;
      this.hideInstallButton();
    });

    // Request notification permission if supported
    this.requestNotificationPermission();
  }

  /**
   * Show install button
   */
  showInstallButton() {
    if (this.isInstalled) return;

    // Create install banner
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="install-content">
        <i class="fas fa-download"></i>
        <span>Install Tyler's Tech Tips for a better experience</span>
      </div>
      <div class="install-actions">
        <button class="install-btn" id="pwa-install-btn">Install</button>
        <button class="dismiss-btn" id="pwa-dismiss-btn"><i class="fas fa-times"></i></button>
      </div>
    `;

    document.body.appendChild(banner);

    // Handle install button click
    document.getElementById('pwa-install-btn').addEventListener('click', () => {
      this.promptInstall();
    });

    // Handle dismiss button
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('pwa-install-dismissed', Date.now());
    });

    // Don't show if dismissed recently (within 7 days)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      banner.style.display = 'none';
    }
  }

  /**
   * Hide install button
   */
  hideInstallButton() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.remove();
    }
  }

  /**
   * Prompt user to install PWA
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log('No install prompt available');
      return;
    }

    this.deferredPrompt.prompt();

    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`Install prompt outcome: ${outcome}`);

    if (outcome === 'accepted') {
      console.log('User accepted install');
    } else {
      console.log('User dismissed install');
    }

    this.deferredPrompt = null;
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      console.log('Notification permission already granted');
      return;
    }

    if (Notification.permission === 'default') {
      // Only ask after user has been on site for a bit
      setTimeout(async () => {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);

        if (permission === 'granted') {
          this.subscribeToPushNotifications();
        }
      }, 60000); // Wait 1 minute
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Already subscribed to push');
        return;
      }

      // Subscribe (requires VAPID public key from server)
      // const subscription = await registration.pushManager.subscribe({
      //   userVisibleOnly: true,
      //   applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      // });

      // Send subscription to server
      // await fetch('/api/push/subscribe', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(subscription)
      // });

      console.log('Push subscription ready (implementation pending)');

    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  }

  /**
   * Show update notification
   */
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'pwa-update-notification';
    notification.innerHTML = `
      <div class="update-content">
        <i class="fas fa-sync-alt"></i>
        <span>A new version is available!</span>
      </div>
      <button class="update-btn" id="pwa-update-btn">Update Now</button>
    `;

    document.body.appendChild(notification);

    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      // Send message to service worker to skip waiting
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      
      // Reload page
      window.location.reload();
    });
  }
}

// Initialize PWA installer
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pwaInstaller = new PWAInstaller();
  });
} else {
  window.pwaInstaller = new PWAInstaller();
}
