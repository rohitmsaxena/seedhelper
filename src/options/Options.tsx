import { useState, useEffect } from 'react'

import './Options.css'

interface ServerConfig {
  serverUrl: string
  username: string
  password: string
  authEnabled: boolean
}

export const Options = () => {
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    serverUrl: '',
    username: '',
    password: '',
    authEnabled: false
  })
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Load saved configuration on component mount
  useEffect(() => {
    chrome.storage.sync.get(['rutorrentConfig'], (result) => {
      if (result.rutorrentConfig) {
        setServerConfig(result.rutorrentConfig)
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

  // Save configuration
  const saveConfig = () => {
    setIsLoading(true)
    chrome.storage.sync.set({ rutorrentConfig: serverConfig }, () => {
      setSaveStatus('Settings saved successfully!')
      setIsLoading(false)
      setTimeout(() => setSaveStatus(''), 3000)
    })
  }

  // Test connection
  const testConnection = () => {
    // Basic URL validation
    if (!serverConfig.serverUrl) {
      setSaveStatus('Error: Server URL is required')
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
            setSaveStatus('Connection successful!')
          } else {
            setSaveStatus(`Error: ${response?.message || 'Connection failed'}`)
          }
          setTimeout(() => setSaveStatus(''), 5000)
        }
      )
    } catch (error) {
      setSaveStatus('Error: Invalid server URL format')
    }
  }

  return (
    <main className="options-container">
      <h3>ruTorrent Server Settings</h3>
      
      <div className="form-group">
        <label htmlFor="serverUrl">Server URL:</label>
        <input
          type="text"
          id="serverUrl"
          name="serverUrl"
          value={serverConfig.serverUrl}
          onChange={handleInputChange}
          placeholder="https://your-rutorrent-server.com/rutorrent/"
          disabled={isLoading}
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
            disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>
        </>
      )}
      
      <div className="button-group">
        <button 
          onClick={saveConfig} 
          className="primary-button"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
        <button 
          onClick={testConnection} 
          className="secondary-button"
          disabled={isLoading}
        >
          {isLoading ? 'Testing...' : 'Test Connection'}
        </button>
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
    </main>
  )
}

export default Options
