import { useState, useEffect } from 'react'

import './Popup.css'

interface ServerConfig {
  serverUrl: string
  username: string
  password: string
  authEnabled: boolean
}

export const Popup = () => {
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null)
  const [isConfigured, setIsConfigured] = useState<boolean>(false)

  useEffect(() => {
    // Load configuration when popup opens
    chrome.storage.sync.get(['rutorrentConfig'], (result) => {
      if (result.rutorrentConfig && result.rutorrentConfig.serverUrl) {
        setServerConfig(result.rutorrentConfig)
        setIsConfigured(true)
      } else {
        setIsConfigured(false)
      }
    })
  }, [])

  const openSidePanel = () => {
    // Open the options page for configuration
    chrome.runtime.openOptionsPage();
  }

  return (
    <main className="popup-container">
      <h3>SeedHelper</h3>
      
      {isConfigured ? (
        <div className="status-section">
          <div className="status-item">
            <span className="status-label">Server:</span>
            <span className="status-value">{serverConfig?.serverUrl}</span>
          </div>
          
          {serverConfig?.authEnabled && (
            <div className="status-item">
              <span className="status-label">Auth:</span>
              <span className="status-value">Enabled</span>
            </div>
          )}
          
          <div className="status-indicator configured">
            <span className="indicator-dot"></span>
            <span>Ready to upload torrents</span>
          </div>
        </div>
      ) : (
        <div className="status-section">
          <div className="status-indicator not-configured">
            <span className="indicator-dot"></span>
            <span>Not configured</span>
          </div>
          <p className="help-text">
            Please configure your ruTorrent server details to start uploading torrents.
          </p>
        </div>
      )}
      
      <div className="button-container">
        <button onClick={openSidePanel} className="config-button">
          {isConfigured ? 'Edit Configuration' : 'Configure Server'}
        </button>
      </div>
      
      <footer>
        <p>Click any .torrent link to upload directly to ruTorrent</p>
      </footer>
    </main>
  )
}

export default Popup
