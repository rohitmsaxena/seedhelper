import { useState, useEffect, useRef } from 'react'

import './SidePanel.css'

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

export const SidePanel = () => {
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    serverUrl: '',
    username: '',
    password: '',
    authEnabled: false,
    uploadLocations: [{ id: '1', directory: '', label: '', isActive: true }]
  })
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(true)
  const [isServerConfigured, setIsServerConfigured] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Accordion state - only one can be open at a time
  const [activeAccordion, setActiveAccordion] = useState<string | null>('server')

  // Load saved configuration on component mount
  useEffect(() => {
    chrome.storage.sync.get(['rutorrentConfig'], (result) => {
      if (result.rutorrentConfig) {
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
        setIsEditing(false); // Start with fields disabled if config exists

        // Check if server is configured
        const isConfigured = config.serverUrl && config.serverUrl.trim() !== '';
        setIsServerConfigured(isConfigured);

        // Set initial active accordion based on configuration state
        setActiveAccordion(isConfigured ? 'upload' : 'server');
      }
    });
  }, []);

  // Handle input changes for server config
  const handleServerConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setServerConfig({
      ...serverConfig,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Handle input changes for upload locations
  const handleUploadLocationChange = (
    id: string,
    field: 'directory' | 'label',
    value: string
  ) => {
    const updatedLocations = serverConfig.uploadLocations.map(location =>
      location.id === id ? { ...location, [field]: value } : location
    );

    const updatedConfig = {
      ...serverConfig,
      uploadLocations: updatedLocations
    };

    // Update local state
    setServerConfig(updatedConfig);

    // Save to storage
    chrome.storage.sync.set({ rutorrentConfig: updatedConfig });
  };

  // Set active upload location
  const setActiveLocation = (id: string) => {
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

  // Add new upload location
  const addUploadLocation = () => {
    const newId = Date.now().toString();
    const updatedLocations = [
      ...serverConfig.uploadLocations,
      { id: newId, directory: '', label: '', isActive: false }
    ];

    const updatedConfig = {
      ...serverConfig,
      uploadLocations: updatedLocations
    };

    // Update local state
    setServerConfig(updatedConfig);

    // Save to storage
    chrome.storage.sync.set({ rutorrentConfig: updatedConfig });
  };

  // Remove upload location
  const removeUploadLocation = (id: string) => {
    // Don't allow removing the last location
    if (serverConfig.uploadLocations.length <= 1) {
      return;
    }

    let updatedLocations = serverConfig.uploadLocations.filter(
      location => location.id !== id
    );

    // If we removed the active location, set the first one as active
    if (!updatedLocations.some(location => location.isActive)) {
      updatedLocations = updatedLocations.map((location, index) => ({
        ...location,
        isActive: index === 0
      }));
    }

    const updatedConfig = {
      ...serverConfig,
      uploadLocations: updatedLocations
    };

    // Update local state
    setServerConfig(updatedConfig);

    // Save to storage
    chrome.storage.sync.set({ rutorrentConfig: updatedConfig });
  };

  // Enable editing mode
  const enableEditing = () => {
    setIsEditing(true);
  };

  // Save configuration
  const saveConfig = () => {
    setIsLoading(true);
    chrome.storage.sync.set({ rutorrentConfig: serverConfig }, () => {
      setSaveStatus('Settings saved successfully!');
      setIsLoading(false);
      setIsEditing(false); // Disable editing after save

      // Update server configured state
      setIsServerConfigured(!!serverConfig.serverUrl);

      // Switch to upload settings if server is now configured
      if (!!serverConfig.serverUrl) {
        setActiveAccordion('upload');
      }

      setTimeout(() => setSaveStatus(''), 3000);
    });
  };

  // Test connection
  const testConnection = () => {
    // Basic URL validation
    if (!serverConfig.serverUrl) {
      setSaveStatus('Error: Server URL is required');
      setIsEditing(true); // Enable editing if validation fails
      return;
    }

    try {
      // Create URL object to validate the URL format
      new URL(serverConfig.serverUrl);

      setIsLoading(true);
      setSaveStatus('Testing connection...');

      // Send test connection request to background script
      chrome.runtime.sendMessage(
        { type: 'TEST_CONNECTION', config: serverConfig },
        (response) => {
          setIsLoading(false);
          if (response && response.success) {
            setSaveStatus(`Connection successful!`);
            setIsEditing(false); // Keep fields disabled on success
            setIsServerConfigured(true);
            setActiveAccordion('upload'); // Switch to upload settings on success
          } else {
            setSaveStatus(`Error: ${response?.message || 'Connection failed'}`);
            setIsEditing(true); // Enable editing on failure
          }
          setTimeout(() => setSaveStatus(''), 5000);
        }
      );
    } catch (error) {
      setSaveStatus('Error: Invalid server URL format');
      setIsEditing(true); // Enable editing if URL format is invalid
    }
  };

  // Toggle accordion sections
  const toggleAccordion = (section: string) => {
    setActiveAccordion(activeAccordion === section ? null : section);
  };

  // Export configuration to JSON file
  const exportConfig = () => {
    try {
      // Create a JSON string of the current configuration
      const configJson = JSON.stringify(serverConfig, null, 2);
      
      // Create a Blob with the JSON data
      const blob = new Blob([configJson], { type: 'application/json' });
      
      // Create a URL for the Blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = 'seedhelper-config.json';
      
      // Append the link to the body
      document.body.appendChild(link);
      
      // Trigger the download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSaveStatus('Configuration exported successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error exporting configuration:', error);
      setSaveStatus(`Error exporting configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };
  
  // Trigger file input click
  const triggerImportFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Import configuration from JSON file
  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedConfig = JSON.parse(content) as ServerConfig;
        
        // Validate the imported configuration
        if (!importedConfig.serverUrl) {
          throw new Error('Invalid configuration: Server URL is required');
        }
        
        // Ensure uploadLocations exists and is valid
        if (!importedConfig.uploadLocations || !Array.isArray(importedConfig.uploadLocations)) {
          importedConfig.uploadLocations = [{ id: '1', directory: '', label: '', isActive: true }];
        }
        
        // Ensure at least one location is active
        if (!importedConfig.uploadLocations.some(loc => loc.isActive)) {
          importedConfig.uploadLocations[0].isActive = true;
        }
        
        // Update state
        setServerConfig(importedConfig);
        
        // Save to storage
        chrome.storage.sync.set({ rutorrentConfig: importedConfig }, () => {
          setSaveStatus('Configuration imported successfully!');
          setIsEditing(false);
          setIsServerConfigured(!!importedConfig.serverUrl);
          setTimeout(() => setSaveStatus(''), 3000);
        });
      } catch (error) {
        console.error('Error importing configuration:', error);
        setSaveStatus(`Error importing configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => setSaveStatus(''), 5000);
      }
    };
    
    reader.onerror = () => {
      setSaveStatus('Error reading the file');
      setTimeout(() => setSaveStatus(''), 3000);
    };
    
    reader.readAsText(file);
    
    // Reset the file input
    if (event.target) {
      event.target.value = '';
    }
  };

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
            <div className="upload-locations-container">
              {serverConfig.uploadLocations.map((location) => (
                <div
                  key={location.id}
                  className={`upload-location ${location.isActive ? 'active' : ''}`}
                >
                  <div className="upload-location-header">
                    <span className="location-title">
                      {location.isActive && (
                        <span className="active-badge">Active</span>
                      )}
                      Location
                    </span>

                    {serverConfig.uploadLocations.length > 1 && (
                      <button
                        onClick={() => removeUploadLocation(location.id)}
                        className="remove-button"
                        title="Remove location"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor={`directory-${location.id}`}>Directory:</label>
                    <input
                      type="text"
                      id={`directory-${location.id}`}
                      value={location.directory}
                      onChange={(e) => handleUploadLocationChange(location.id, 'directory', e.target.value)}
                      placeholder="/downloads"
                    />
                    <small>Path where torrents will be saved (e.g., /downloads/movies)</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor={`label-${location.id}`}>Label:</label>
                    <input
                      type="text"
                      id={`label-${location.id}`}
                      value={location.label}
                      onChange={(e) => handleUploadLocationChange(location.id, 'label', e.target.value)}
                      placeholder="movies"
                    />
                    <small>Category label for the torrent (e.g., movies, tv, music)</small>
                  </div>

                  {!location.isActive && (
                    <button
                      onClick={() => setActiveLocation(location.id)}
                      className="set-active-button"
                    >
                      Set as Active
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={addUploadLocation}
                className="add-location-button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Location
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import/Export Accordion */}
      <div className="accordion">
        <div
          className="accordion-header"
          onClick={() => toggleAccordion('importexport')}
        >
          <h4>Import / Export Settings</h4>
          <div className="accordion-controls">
            <span className={`accordion-arrow ${activeAccordion === 'importexport' ? 'open' : ''}`}>▼</span>
          </div>
        </div>

        {activeAccordion === 'importexport' && (
          <div className="accordion-content">
            <div className="import-export-container">
              <p className="import-export-description">
                You can export your current configuration to a JSON file and import it later or on another device.
              </p>
              
              <div className="button-group">
                <button
                  onClick={exportConfig}
                  className="primary-button"
                  disabled={!isServerConfigured || isLoading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Export Configuration
                </button>
                
                <button
                  onClick={triggerImportFile}
                  className="secondary-button"
                  disabled={isLoading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Import Configuration
                </button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={importConfig}
                  accept=".json"
                  style={{ display: 'none' }}
                />
              </div>
              
              <div className="import-export-note">
                <small>
                  Note: Importing a configuration will overwrite your current settings.
                  Make sure to export your current configuration first if you want to keep it.
                </small>
              </div>
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
          <li>Set up one or more upload locations with directories and labels</li>
          <li>Select which location is active using the popup menu</li>
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
