import { useState, useEffect } from 'react'

import './SidePanel.css'

interface ServerConfig {
  serverUrl: string
  username: string
  password: string
  authEnabled: boolean
}

/**
 * The SidePanel component is a configuration panel for the SeedHelper
 * extension. It allows users to enter their ruTorrent server details,
 * enable authentication, and test their connection to the server.
 *
 * The component also displays a status message indicating whether the
 * connection test was successful or not.
 *
 * The component's state is stored in the `chrome.storage.sync` API, which
 * is a persistent storage mechanism provided by the Chrome extension
 * framework. This means that the user's configuration is saved even when
 * the user closes the browser.
 *
 * The component's state is also used to send messages to the background
 * script when the user clicks the "Test Connection" button. The background
 * script receives the message and sends a request to the ruTorrent server
 * to test the connection. The response from the server is then sent back
 * to the component, which updates its state accordingly.
 *
 * The component also renders a form with input fields for the user to
 * enter their server details. The form is rendered conditionally based on
 * whether the user has enabled authentication or not. If authentication is
 * enabled, the component renders additional input fields for the user to
 * enter their username and password.
 *
 * The component also renders a status message indicating whether the
 * connection test was successful or not. The status message is displayed
 * below the form.
 */
export const SidePanel = () => {
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    serverUrl: '',
    username: '',
    password: '',
    authEnabled: false
  })
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(true)

  // Load saved configuration on component mount
  useEffect(() => {
    chrome.storage.sync.get(['rutorrentConfig'], (result) => {
      if (result.rutorrentConfig) {
        setServerConfig(result.rutorrentConfig)
        setIsEditing(false) // Start with fields disabled if config exists
      }
    })
  }, [])

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setServerConfig({
      ...serverConfig,
      [name]: type === 'checkbox' ? checked : value
    })
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

  return (
    <main className="sidepanel-container">
      <h3>ruTorrent Server Settings</h3>

      <div className="form-header">
        <h4>Server Configuration</h4>
        {!isEditing && (
          <button 
            onClick={enableEditing} 
            className="edit-button"
            title="Edit configuration"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="serverUrl">Server URL:</label>
        <input
          type="text"
          id="serverUrl"
          name="serverUrl"
          value={serverConfig.serverUrl}
          onChange={handleInputChange}
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
            onChange={handleInputChange}
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
              onChange={handleInputChange}
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
              onChange={handleInputChange}
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
