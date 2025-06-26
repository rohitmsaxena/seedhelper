import { useState, useEffect } from 'react'

import './Popup.css'

interface UploadLocation {
  id: string
  directory: string
  label: string
  isActive: boolean
}

interface ServerConfig {
  serverUrl: string
  username: string
  password: string
  authEnabled: boolean
  uploadLocations: UploadLocation[]
}

export const Popup = () => {
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null)
  const [isConfigured, setIsConfigured] = useState<boolean>(false)

  useEffect(() => {
    // Load configuration when popup opens
    chrome.storage.sync.get(['rutorrentConfig'], (result) => {
      if (result.rutorrentConfig && result.rutorrentConfig.serverUrl) {
        // Ensure backward compatibility with old config format
        const config = { ...result.rutorrentConfig };
        
        // Convert old format to new format if needed
        if (!config.uploadLocations) {
          config.uploadLocations = [{
            id: '1',
            directory: config.defaultDirectory || '',
            label: config.defaultLabel || '',
            isActive: true
          }];
          
          // Remove old properties
          delete config.defaultDirectory;
          delete config.defaultLabel;
        }
        
        setServerConfig(config);
        setIsConfigured(true);
      } else {
        setIsConfigured(false);
      }
    });
  }, []);

  const openOptionsPage = () => {
    // Open the options page for configuration
    chrome.runtime.openOptionsPage();
  };
  
  const openSidebar = () => {
    // Get the current tab to open the sidebar
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].windowId) {
        // Open the sidebar in the current window
        chrome.sidePanel.open({ windowId: tabs[0].windowId })
          .catch(error => console.error('Error opening sidepanel:', error));
        
        // Close the popup after opening the sidebar
        window.close();
      }
    });
  };
  
  // Set active upload location
  const setActiveLocation = (id: string) => {
    if (!serverConfig) return;
    
    const updatedLocations = serverConfig.uploadLocations.map(location => ({
      ...location,
      isActive: location.id === id
    }));
    
    const updatedConfig = {
      ...serverConfig,
      uploadLocations: updatedLocations
    };
    
    // Update local state
    setServerConfig(updatedConfig);
    
    // Save to storage
    chrome.storage.sync.set({ rutorrentConfig: updatedConfig });
  };
  
  // Get display name for location
  const getLocationDisplayName = (location: UploadLocation) => {
    if (location.label) {
      return location.label;
    } else if (location.directory) {
      return location.directory.split('/').pop() || location.directory;
    } else {
      return "Default Location";
    }
  };

  return (
    <main className="popup-container">
      <div className="popup-header">
        <h3>SeedHelper</h3>
        <button 
          onClick={openSidebar}
          className="sidebar-button"
          title="Open Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
      
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
          
          {/* Upload Locations List */}
          {serverConfig && serverConfig.uploadLocations && serverConfig.uploadLocations.length > 0 && (
            <div className="upload-locations">
              <ul className="location-list">
                {serverConfig.uploadLocations.map(location => (
                  <li 
                    key={location.id} 
                    className={`location-item ${location.isActive ? 'active' : ''}`}
                    onClick={() => setActiveLocation(location.id)}
                  >
                    <label className="location-label">
                      <input 
                        type="radio" 
                        name="activeLocation" 
                        checked={location.isActive}
                        onChange={() => setActiveLocation(location.id)}
                      />
                      <div className="location-details">
                        <span className="location-name">
                          {getLocationDisplayName(location)}
                        </span>
                        {location.directory && (
                          <span className="location-path">
                            {location.directory}
                          </span>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
        <button onClick={openOptionsPage} className="config-button">
          {isConfigured ? 'Edit Configuration' : 'Configure Server'}
        </button>
      </div>
      
      <footer>
        <p>Click any .torrent link to upload directly to ruTorrent</p>
      </footer>
    </main>
  )
}
