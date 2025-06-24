console.log('SeedHelper background service is running')

// Define interfaces for our configuration
interface RuTorrentConfig {
  serverUrl: string
  username: string
  password: string
  authEnabled: boolean
  defaultDirectory: string
  defaultLabel: string
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

        // Upload the torrent to ruTorrent
        uploadTorrentToRuTorrent(downloadItem.url, config)
      })
    } catch (error) {
      console.error('Error handling torrent download:', error)
      notifyUser('SeedHelper Error', 'Failed to process torrent download')
    }
  }
})

// Function to upload torrent to ruTorrent
async function uploadTorrentToRuTorrent(torrentUrl: string, config: RuTorrentConfig) {
  try {
    // Fetch the torrent file
    const response = await fetch(torrentUrl)
    const torrentBlob = await response.blob()

    // Create form data for upload
    const formData = new FormData()
    formData.append('torrent_file', torrentBlob, getTorrentFileName(torrentUrl))
    
    // Add directory parameter if specified
    if (config.defaultDirectory) {
      formData.append('dir_edit', config.defaultDirectory)
    }
    
    // Add label parameter if specified
    if (config.defaultLabel) {
      formData.append('label', config.defaultLabel)
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

    // Notify user of success
    notifyUser('SeedHelper', 'Torrent successfully uploaded to ruTorrent')
    console.log('Torrent uploaded successfully')

  } catch (error) {
    console.error('Error uploading torrent to ruTorrent:', error)
    notifyUser('SeedHelper Error', 'Failed to upload torrent to ruTorrent')
  }
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
