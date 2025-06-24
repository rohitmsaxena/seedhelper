import { useState, useEffect } from 'react'

import './SidePanel.css'

interface ServerConfig {
  serverUrl: string
  username: string
  password: string
  authEnabled: boolean
  defaultDirectory: string
  defaultLabel: string
}

export const SidePanel = () => {
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    serverUrl: '',
    username: '',
    password: '',
    authEnabled: false,
    defaultDirectory: '',
    defaultLabel: ''
  })
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(true)
  const [isServerConfigured, setIsServerConfigured] = useState<boolean>(false)

  // Accordion state - only one can be open at a time
  const [activeAccordion, setActiveAccordion] = useState<string | null>('server')

  // Load saved configuration on component mount
  useEffect(() => {
    chrome.storage.sync.get(['rutorrentConfig'], (result) => {
      if (result.rutorrentConfig) {
        setServerConfig(result.rutorrentConfig)
        setIsEditing(false) // Start with fields disabled if config exists

        // Check if server is configured
        const isConfigured = result.rutorrentConfig.serverUrl && result.rutorrentConfig.serverUrl.trim() !== '';
        setIsServerConfigured(isConfigured)

        // Set initial active accordion based on configuration state
        setActiveAccordion(isConfigured ? 'upload' : 'server')
      }
    })
  }, [])

  // Handle input changes for server config
  const handleServerConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setServerConfig({
      ...serverConfig,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  // Handle input changes for upload settings and save automatically
  const handleUploadSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const updatedConfig = {
      ...serverConfig,
      [name]: value
    }

    // Update local state
    setServerConfig(updatedConfig)

    // Save to storage
    chrome.storage.sync.set({ rutorrentConfig: updatedConfig })
  }

  // Enable editing mode
  const enableEditing = () => {
    setIsEditing(true)
  }

  // Save configuration
  const saveConfig = () => {
    setIsLoading(true)
    chrome.storage.sync.set({ rutorrentConfig: serverConfig }, () => {
      setSaveStatus('Settings saved successfully!')
      setIsLoading(false)
      setIsEditing(false) // Disable editing after save

      // Update server configured state
      setIsServerConfigured(!!serverConfig.serverUrl)

      // Switch to upload settings if server is now configured
      if (serverConfig.serverUrl && serverConfig.serverUrl.trim() !== '') {
        setActiveAccordion('upload')
      }

      setTimeout(() => setSaveStatus(''), 3000)
    })
  }

  // Test connection
  const testConnection = () => {
    // Basic URL validation
    if (!serverConfig.serverUrl) {
      setSaveStatus('Error: Server URL is required')
      setIsEditing(true) // Enable editing if validation fails
      return
    }

    try {
      // Create URL object to validate the URL format
      new URL(serverConfig.serverUrl)

      setIsLoading(true)
      setSaveStatus('Testing connection...')

      // Send test connection request to background script
      chrome.runtime.sendMessage(
        { type: 'TEST_CONNECTION', config: serverConfig },
        (response) => {
          setIsLoading(false)
          if (response && response.success) {
            setSaveStatus(`Connection successful!`)
            setIsEditing(false) // Keep fields disabled on success
            setIsServerConfigured(true)
            setActiveAccordion('upload') // Switch to upload settings on success
          } else {
            setSaveStatus(`Error: ${response?.message || 'Connection failed'}`)
            setIsEditing(true) // Enable editing on failure
          }
          setTimeout(() => setSaveStatus(''), 5000)
        }
      )
    } catch (error) {
      setSaveStatus('Error: Invalid server URL format')
      setIsEditing(true) // Enable editing if URL format is invalid
    }
  }

  // Toggle accordion sections
  const toggleAccordion = (section: string) => {
    setActiveAccordion(activeAccordion === section ? null : section)
  }

  return (
    <main className="sidepanel-container">
      <h3>ruTorrent Server Settings</h3>

      {/* Server Configuration Accordion */}
      <div className="accordion">
        <div
          className="accordion-header"
          onClick={() => toggleAccordion('server')}
        >
          <h4>Server Configuration</h4>
          <div className="accordion-controls">
            {!isEditing && isServerConfigured && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  enableEditing();
                }}
                className="edit-button"
                title="Edit configuration"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            )}
            <span className={`accordion-arrow ${activeAccordion === 'server' ? 'open' : ''}`}>▼</span>
          </div>
        </div>

        {activeAccordion === 'server' && (
          <div className="accordion-content">
            <div className="form-group">
              <label htmlFor="serverUrl">Server URL:</label>
              <input
                type="text"
                id="serverUrl"
                name="serverUrl"
                value={serverConfig.serverUrl}
                onChange={handleServerConfigChange}
                placeholder="https://your-rutorrent-server.com/rutorrent/"
                disabled={isLoading || !isEditing}
              />
              <small>Include the full path to ruTorrent (e.g., https://example.com/rutorrent/)</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="authEnabled"
                  checked={serverConfig.authEnabled}
                  onChange={handleServerConfigChange}
                  disabled={isLoading || !isEditing}
                />
                Enable Authentication
              </label>
            </div>

            {serverConfig.authEnabled && (
              <>
                <div className="form-group">
                  <label htmlFor="username">Username:</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={serverConfig.username}
                    onChange={handleServerConfigChange}
                    placeholder="Username"
                    disabled={isLoading || !isEditing}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password:</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={serverConfig.password}
                    onChange={handleServerConfigChange}
                    placeholder="Password"
                    disabled={isLoading || !isEditing}
                  />
                </div>
              </>
            )}

            <div className="button-group">
              {isEditing ? (
                <button
                  onClick={saveConfig}
                  className="primary-button"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </button>
              ) : (
                <button
                  onClick={testConnection}
                  className="primary-button"
                  disabled={isLoading}
                >
                  {isLoading ? 'Testing...' : 'Test Connection'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Settings Accordion */}
      <div className="accordion">
        <div
          className="accordion-header"
          onClick={() => toggleAccordion('upload')}
        >
          <h4>Upload Settings</h4>
          <div className="accordion-controls">
            <span className={`accordion-arrow ${activeAccordion === 'upload' ? 'open' : ''}`}>▼</span>
          </div>
        </div>

        {activeAccordion === 'upload' && (
          <div className="accordion-content">
            <div className="form-group">
              <label htmlFor="defaultDirectory">Default Directory:</label>
              <input
                type="text"
                id="defaultDirectory"
                name="defaultDirectory"
                value={serverConfig.defaultDirectory}
                onChange={handleUploadSettingsChange}
                placeholder="/downloads"
              />
              <small>Leave empty for default directory or specify a path (e.g., /downloads/movies)</small>
            </div>

            <div className="form-group">
              <label htmlFor="defaultLabel">Default Label:</label>
              <input
                type="text"
                id="defaultLabel"
                name="defaultLabel"
                value={serverConfig.defaultLabel}
                onChange={handleUploadSettingsChange}
                placeholder="movies"
              />
              <small>Leave empty for no label or specify a label (e.g., movies, tv, music)</small>
            </div>
          </div>
        )}
      </div>

      {saveStatus && <div className="status-message">{saveStatus}</div>}

      <div className="info-section">
        <h4>How It Works</h4>
        <p>This extension will intercept .torrent file downloads and automatically upload them to your ruTorrent client.</p>
        <ol>
          <li>Configure your ruTorrent server details above</li>
          <li>Click any .torrent download link on a website</li>
          <li>The extension will upload the torrent directly to your ruTorrent client</li>
          <li>You'll receive a notification when the upload is complete</li>
        </ol>
      </div>

      <footer>
        <p>SeedHelper - ruTorrent Upload Extension</p>
      </footer>
    </main>
  )
}

export default SidePanel
