console.log('SeedHelper background service is running')

// Define interfaces for our configuration
interface UploadLocation {
  id: string
  directory: string
  label: string
  isActive: boolean
}

interface RuTorrentConfig {
  serverUrl: string
  username: string
  password: string
  authEnabled: boolean
  uploadLocations: UploadLocation[]
}

// Listen for download events
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  // Check if the file is a torrent file
  if (downloadItem.url && (downloadItem.url.endsWith('.torrent') || downloadItem.mime === 'application/x-bittorrent')) {
    console.log('Torrent download detected:', downloadItem.url)

    try {
      // Cancel the download
      await chrome.downloads.cancel(downloadItem.id)

      // Get ruTorrent configuration
      chrome.storage.sync.get(['rutorrentConfig'], async (result) => {
        const config: RuTorrentConfig = result.rutorrentConfig

        if (!config || !config.serverUrl) {
          console.error('ruTorrent configuration not found')
          notifyUser('SeedHelper Error', 'ruTorrent server configuration not found. Please configure it in the side panel.')
          return
        }

        // Ensure backward compatibility with old config format
        if (!config.uploadLocations) {
          config.uploadLocations = [{
            id: '1',
            directory: (config as any).defaultDirectory || '',
            label: (config as any).defaultLabel || '',
            isActive: true
          }]
        }

        // Upload the torrent to ruTorrent
        uploadTorrentToRuTorrent(downloadItem.url, config, getTorrentFileName(downloadItem.url))
      })
    } catch (error) {
      console.error('Error handling torrent download:', error)
      notifyUser('SeedHelper Error', 'Failed to process torrent download')
    }
  }
})

// Function to upload torrent to ruTorrent
async function uploadTorrentToRuTorrent(torrentUrl: string, config: RuTorrentConfig, fileName: string) {
  try {
    // Fetch the torrent file
    const response = await fetch(torrentUrl)
    const torrentBlob = await response.blob()

    // Find active upload location
    const activeLocation = config.uploadLocations.find(location => location.isActive) || config.uploadLocations[0]

    // Create form data for upload
    const formData = new FormData()
    formData.append('torrent_file', torrentBlob, fileName)

    // Add directory parameter if specified
    if (activeLocation.directory) {
      formData.append('dir_edit', activeLocation.directory)
    }

    // Add label parameter if specified
    if (activeLocation.label) {
      formData.append('label', activeLocation.label)
    }

    // Prepare the request
    const uploadUrl = `${config.serverUrl.replace(/\/$/, '')}/php/addtorrent.php`
    const requestOptions: RequestInit = {
      method: 'POST',
      body: formData,
      credentials: 'include',
    }

    // Add authentication if enabled
    if (config.authEnabled && config.username && config.password) {
      const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`)
      requestOptions.headers = {
        'Authorization': authHeader
      }
    }

    // Send the upload request
    const uploadResponse = await fetch(uploadUrl, requestOptions)

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status: ${uploadResponse.status}`)
    }

    // Show success alert
    showUploadSuccessAlert(fileName, config, activeLocation)

    // Notify user of success
    notifyUser('SeedHelper', `Torrent "${fileName}" successfully uploaded to ruTorrent`)
    console.log('Torrent uploaded successfully')

  } catch (error) {
    console.error('Error uploading torrent to ruTorrent:', error)
    notifyUser('SeedHelper Error', 'Failed to upload torrent to ruTorrent')
  }
}

// Function to show upload success alert
function showUploadSuccessAlert(fileName: string, config: RuTorrentConfig, activeLocation: UploadLocation) {
  // Create and inject alert element
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]?.id) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: createSuccessAlert,
        args: [fileName, config.serverUrl, activeLocation.directory, activeLocation.label]
      }).catch(error => {
        console.error("Failed to inject alert script:", error);
      });
    }
  });
}

// Function to be injected into the page to create the alert
function createSuccessAlert(fileName: string, serverUrl: string, directory: string, label: string) {
  // Create alert container
  const alertContainer = document.createElement('div');
  alertContainer.style.position = 'fixed';
  alertContainer.style.top = '20px';
  alertContainer.style.right = '20px';
  alertContainer.style.zIndex = '9999';
  alertContainer.style.backgroundColor = 'rgba(46, 204, 113, 0.95)';
  alertContainer.style.color = 'white';
  alertContainer.style.padding = '15px 20px';
  alertContainer.style.borderRadius = '5px';
  alertContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  alertContainer.style.maxWidth = '350px';
  alertContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  alertContainer.style.display = 'flex';
  alertContainer.style.flexDirection = 'column';
  alertContainer.style.transition = 'opacity 0.3s ease-in-out';

  // Create header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '10px';

  const title = document.createElement('h4');
  title.textContent = 'Torrent Uploaded';
  title.style.margin = '0';
  title.style.fontWeight = '600';
  title.style.fontSize = '16px';

  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.color = 'white';
  closeButton.style.fontSize = '20px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.padding = '0';
  closeButton.style.marginLeft = '10px';
  closeButton.style.lineHeight = '1';
  closeButton.onclick = () => {
    document.body.removeChild(alertContainer);
  };

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create content
  const content = document.createElement('div');

  const fileNameElem = document.createElement('p');
  fileNameElem.textContent = `File: ${fileName}`;
  fileNameElem.style.margin = '5px 0';
  fileNameElem.style.fontSize = '14px';

  content.appendChild(fileNameElem);

  if (directory) {
    const directoryElem = document.createElement('p');
    directoryElem.textContent = `Directory: ${directory}`;
    directoryElem.style.margin = '5px 0';
    directoryElem.style.fontSize = '14px';
    content.appendChild(directoryElem);
  }

  if (label) {
    const labelElem = document.createElement('p');
    labelElem.textContent = `Label: ${label}`;
    labelElem.style.margin = '5px 0';
    labelElem.style.fontSize = '14px';
    content.appendChild(labelElem);
  }

  // Assemble alert
  alertContainer.appendChild(header);
  alertContainer.appendChild(content);

  // Add to page
  document.body.appendChild(alertContainer);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    alertContainer.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(alertContainer)) {
        document.body.removeChild(alertContainer);
      }
    }, 300);
  }, 5000);
}

// Helper function to extract filename from URL
function getTorrentFileName(url: string): string {
  const urlParts = url.split('/')
  let fileName = urlParts[urlParts.length - 1]

  // Remove query parameters if present
  if (fileName.includes('?')) {
    fileName = fileName.split('?')[0]
  }

  // Ensure it has .torrent extension
  if (!fileName.endsWith('.torrent')) {
    fileName += '.torrent'
  }

  return fileName
}

// Function to show notifications to the user
function notifyUser(title: string, message: string) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'img/logo-128.png',
    title: title,
    message: message
  })
}

// Listen for messages from popup or sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TEST_CONNECTION') {
    testRuTorrentConnection(request.config)
      .then(result => sendResponse({ success: true, message: result }))
      .catch(error => sendResponse({ success: false, message: error.message }))
    return true // Required for async sendResponse
  }
})

// Function to test ruTorrent connection
async function testRuTorrentConnection(config: RuTorrentConfig): Promise<string> {
  try {
    if (!config || !config.serverUrl) {
      throw new Error('Server URL is required')
    }

    const testUrl = `${config.serverUrl.replace(/\/$/, '')}/php/getsettings.php`
    const requestOptions: RequestInit = {
      method: 'GET',
      credentials: 'include',
    }

    // Add authentication if enabled
    if (config.authEnabled && config.username && config.password) {
      const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`)
      requestOptions.headers = {
        'Authorization': authHeader
      }
    }

    const response = await fetch(testUrl, requestOptions)

    if (!response.ok) {
      throw new Error(`Connection failed with status: ${response.status}`)
    }

    return 'Connection successful!'
  } catch (error) {
    console.error('Connection test failed:', error)
    throw new Error(`Connection failed: ${error instanceof Error ? error.message : "error"}`)
  }
}

// Initialize context menus when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Create parent context menu item for torrent links
  chrome.contextMenus.create({
    id: "seedhelperTorrentMenu",
    title: "Upload to ruTorrent",
    contexts: ["link"],
    targetUrlPatterns: ["*://*/*.torrent", "*://*/*.torrent?*"]
  });

  // Initial placeholder menu item - will be replaced dynamically
  chrome.contextMenus.create({
    id: "loadingLocations",
    parentId: "seedhelperTorrentMenu",
    title: "Loading upload locations...",
    contexts: ["link"]
  });

  // Update context menu with available upload locations
  initializeContextMenuWithUploadLocations();
});

// Initialize context menu with available upload locations
function initializeContextMenuWithUploadLocations() {
  // Get configuration from storage
  chrome.storage.sync.get(['rutorrentConfig'], (result) => {
    if (!result.rutorrentConfig) return;

    const config = result.rutorrentConfig;

    // Ensure backward compatibility with old config format
    if (!config.uploadLocations) {
      config.uploadLocations = [{
        id: '1',
        directory: (config as any).defaultDirectory || '',
        label: (config as any).defaultLabel || '',
        isActive: true
      }];
    }

    // Remove existing location menu items
    chrome.contextMenus.remove("loadingLocations", () => {
      // Create menu items for each upload location
      config.uploadLocations.forEach((location: { id: any; isActive: any }) => {
        const locationName = getLocationDisplayNameForMenu(location)
        const menuId = `upload-to-${location.id}`

        chrome.contextMenus.create({
          id: menuId,
          parentId: 'seedhelperTorrentMenu',
          title: locationName,
          contexts: ['link'],
          // Add a checkmark to the active location
          checked: location.isActive,
          type: 'normal',
        })
      })
    });
  });
}

// Get display name for location in context menu
function getLocationDisplayNameForMenu(location: any): string {
  if (location.label && location.directory) {
    return `${location.label} (${location.directory})`;
  } else if (location.label) {
    return location.label;
  } else if (location.directory) {
    return location.directory;
  } else {
    return "Default Location";
  }
}

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.toString().startsWith('upload-to-')) {
    const locationId = info.menuItemId.toString().replace('upload-to-', '');
    const torrentUrl = info.linkUrl;

    if (torrentUrl) {
      // Get configuration from storage
      chrome.storage.sync.get(['rutorrentConfig'], (result) => {
        if (!result.rutorrentConfig) {
          notifyUser('SeedHelper Error', 'ruTorrent server configuration not found. Please configure it in the side panel.');
          return;
        }

        const config = result.rutorrentConfig;

        // Ensure backward compatibility with old config format
        if (!config.uploadLocations) {
          config.uploadLocations = [{
            id: '1',
            directory: (config as any).defaultDirectory || '',
            label: (config as any).defaultLabel || '',
            isActive: true
          }];
        }

        // Find the selected location
        const selectedLocation = config.uploadLocations.find(
          (loc: { id: string }) => loc.id === locationId,
        )

        if (!selectedLocation) {
          notifyUser('SeedHelper Error', 'Selected upload location not found.');
          return;
        }

        // Extract filename from URL
        const fileName = getTorrentFileName(torrentUrl);

        // Upload the torrent to the selected location
        uploadTorrentFromContextMenu(torrentUrl, config, fileName, selectedLocation);
      });
    }
  }
});

// Function to upload torrent to a specific location from context menu
function uploadTorrentFromContextMenu(torrentUrl: string, config: any, fileName: string, location: any) {
  console.log(`Uploading torrent ${fileName} to ${location.directory || 'default directory'}`);

  // Fetch the torrent file
  fetch(torrentUrl)
    .then(response => response.blob())
    .then(blob => {
      // Create form data for upload
      const formData = new FormData();
      formData.append('torrent_file', blob, fileName);

      // Add directory if specified
      if (location.directory) {
        formData.append('dir_edit', location.directory);
      }

      // Add label if specified
      if (location.label) {
        formData.append('label', location.label);
      }

      // Set up authentication if enabled
      let headers = new Headers();
      if (config.authEnabled && config.username && config.password) {
        const authString = `${config.username}:${config.password}`;
        const encodedAuth = btoa(authString);
        headers.append('Authorization', `Basic ${encodedAuth}`);
      }

      // Upload to ruTorrent
      return fetch(`${config.serverUrl}/php/addtorrent.php`, {
        method: 'POST',
        headers: headers,
        body: formData
      });
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(() => {
      // Show success notification
      showUploadSuccessAlert(fileName, config, location);

      // Notify user
      notifyUser('Torrent Upload Success', `${fileName} has been uploaded to ${location.directory || 'default directory'}`);
    })
    .catch(error => {
      console.error('Error uploading torrent:', error);
      notifyUser('Upload Error', `Failed to upload ${fileName}: ${error.message}`);
    });
}

// Listen for changes in storage to update context menu
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.rutorrentConfig) {
    // Update context menu when configuration changes
    initializeContextMenuWithUploadLocations();
  }
});
