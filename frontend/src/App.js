import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different data types
const createCustomIcon = (color, type) => {
  const iconHtml = `
    <div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      color: white;
    ">
      ${type.charAt(0).toUpperCase()}
    </div>
  `;
  
  return L.divIcon({
    html: iconHtml,
    className: 'custom-div-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

// Layer configurations
const LAYER_CONFIG = {
  traffic: { name: 'Traffic Conditions', color: '#EF4444', icon: 'T' },
  construction: { name: 'Road Construction', color: '#F97316', icon: 'C' },
  closures: { name: 'Lane Closures', color: '#DC2626', icon: 'L' },
  incidents: { name: 'Roadway Incidents', color: '#B91C1C', icon: 'I' },
  weather: { name: 'Weather Conditions', color: '#3B82F6', icon: 'W' },
  winter: { name: 'Illinois Winter Road Conditions', color: '#6366F1', icon: 'S' },
  restrictions: { name: 'Vehicle Restrictions', color: '#9333EA', icon: 'R' }
};

// Terms of Use Modal Component
const TermsModal = ({ isOpen, onAccept, onDecline }) => {
  const [canAccept, setCanAccept] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 10;
    if (scrolledToBottom && !hasScrolled) {
      setHasScrolled(true);
      setCanAccept(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Terms of Use</h2>
          <p className="text-sm text-gray-600 mt-2">Please read and accept our terms to continue</p>
        </div>
        
        <div 
          className="flex-1 p-6 overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="prose max-w-none text-sm">
            <h3 className="text-lg font-semibold mb-3">GAIMA Terms of Service</h3>
            <p className="mb-4">
              Welcome to the Getting Around Illinois Mobile Application (GAIMA). By using this application, 
              you agree to comply with and be bound by the following terms and conditions.
            </p>
            
            <h4 className="font-semibold mb-2">1. Acceptance of Terms</h4>
            <p className="mb-4">
              By accessing and using GAIMA, you accept and agree to be bound by the terms and provision 
              of this agreement. These terms apply to all users of the application.
            </p>
            
            <h4 className="font-semibold mb-2">2. Use License</h4>
            <p className="mb-4">
              Permission is granted to temporarily use GAIMA for personal, non-commercial transitory viewing only. 
              This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>modify or copy the application materials</li>
              <li>use the materials for any commercial purpose or for any public display</li>
              <li>attempt to reverse engineer any software contained in the application</li>
              <li>remove any copyright or other proprietary notations from the materials</li>
            </ul>
            
            <h4 className="font-semibold mb-2">3. Safety and Disclaimer</h4>
            <p className="mb-4">
              GAIMA provides traffic and road condition information for informational purposes only. 
              Users must always comply with traffic laws and drive safely. Do not use this application 
              while operating a motor vehicle.
            </p>
            
            <h4 className="font-semibold mb-2">4. Accuracy of Information</h4>
            <p className="mb-4">
              While we strive to provide accurate and up-to-date information, GAIMA makes no warranties 
              or representations as to the accuracy or completeness of the information provided. 
              Road conditions can change rapidly.
            </p>
            
            <h4 className="font-semibold mb-2">5. Privacy Policy</h4>
            <p className="mb-4">
              Your privacy is important to us. We collect minimal location data necessary to provide 
              traffic alerts and do not share personal information with third parties without consent.
            </p>
            
            <h4 className="font-semibold mb-2">6. Limitations</h4>
            <p className="mb-4">
              In no event shall GAIMA or its suppliers be liable for any damages (including, without limitation, 
              damages for loss of data or profit, or due to business interruption) arising out of the use 
              or inability to use GAIMA.
            </p>
            
            <h4 className="font-semibold mb-2">7. Emergency Situations</h4>
            <p className="mb-4">
              GAIMA is not intended for emergency situations. In case of emergency, contact local 
              emergency services immediately at 911.
            </p>
            
            <h4 className="font-semibold mb-2">8. Modifications</h4>
            <p className="mb-4">
              GAIMA may revise these terms of service at any time without notice. By using this application, 
              you are agreeing to be bound by the then current version of these terms.
            </p>
            
            <p className="mt-6 text-gray-600 text-xs">
              {!hasScrolled && "Please scroll to the bottom to accept the terms"}
            </p>
          </div>
        </div>
        
        <div className="p-6 border-t flex gap-4">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={!canAccept}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              canAccept 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

// Safety Warning Modal Component
const SafetyModal = ({ isOpen, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Safety Warning</h2>
          <p className="text-gray-700 mb-6 text-lg leading-relaxed">
            Do not use this application while operating a motor vehicle. Your safety is your responsibility.
          </p>
          <button
            onClick={onAccept}
            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

// Settings Modal Component
const SettingsModal = ({ isOpen, onClose, audioAlertsEnabled, onToggleAudio }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-semibold text-gray-900">Audio Look-Ahead Alerts</h3>
                <p className="text-sm text-gray-600">Get spoken alerts about upcoming hazards</p>
              </div>
              <button
                onClick={onToggleAudio}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  audioAlertsEnabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  audioAlertsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Layer Toggle Component
const LayerToggle = ({ layers, activeLayers, onToggleLayer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white shadow-lg rounded-full p-3 hover:shadow-xl transition-shadow"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-14 bg-white rounded-lg shadow-xl p-4 w-64 max-h-96 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-3">Map Layers</h3>
          <div className="space-y-2">
            {Object.entries(layers).map(([key, config]) => (
              <label key={key} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeLayers.includes(key)}
                  onChange={() => onToggleLayer(key)}
                  className="rounded text-blue-600"
                />
                <div className="flex items-center space-x-2 flex-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  ></div>
                  <span className="text-sm text-gray-700">{config.name}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Map center update component
const MapCenterController = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  
  return null;
};

function App() {
  // State management
  const [showTerms, setShowTerms] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeLayers, setActiveLayers] = useState(['traffic', 'incidents']);
  const [mapData, setMapData] = useState({});
  const [loading, setLoading] = useState(true);
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [userHeading, setUserHeading] = useState(0);
  
  // Illinois center coordinates
  const ILLINOIS_CENTER = [40.0417, -89.1965];
  
  // Check for accepted terms on app load
  useEffect(() => {
    const accepted = localStorage.getItem('gaima-terms-accepted');
    if (accepted === 'true') {
      setTermsAccepted(true);
      setShowSafety(true); // Show safety warning on every launch
    } else {
      setShowTerms(true); // Show terms if not accepted
    }
  }, []);

  // Handle terms of use
  const handleAcceptTerms = () => {
    localStorage.setItem('gaima-terms-accepted', 'true');
    setTermsAccepted(true);
    setShowTerms(false);
    setShowSafety(true);
  };

  const handleDeclineTerms = () => {
    alert('You must accept the terms to use GAIMA.');
    // In a real app, you might close/exit the app here
  };

  const handleSafetyAccept = () => {
    setShowSafety(false);
  };

  // Fetch data for active layers
  const fetchLayerData = async (layerType) => {
    try {
      const response = await axios.get(`${API}/layers/${layerType}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${layerType} data:`, error);
      return { data: [], count: 0 };
    }
  };

  // Load initial data and set up intervals
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const dataPromises = Object.keys(LAYER_CONFIG).map(async (layerType) => {
        const data = await fetchLayerData(layerType);
        return [layerType, data];
      });
      
      const results = await Promise.all(dataPromises);
      const newMapData = Object.fromEntries(results);
      setMapData(newMapData);
      setLoading(false);
    };

    loadData();

    // Set up real-time updates for incidents (every 30 seconds)
    const incidentInterval = setInterval(async () => {
      if (activeLayers.includes('incidents')) {
        const incidentData = await fetchLayerData('incidents');
        setMapData(prev => ({
          ...prev,
          incidents: incidentData
        }));
      }
    }, 30000);

    return () => {
      clearInterval(incidentInterval);
    };
  }, []);

  // Handle layer toggling with exclusivity rule
  const handleToggleLayer = (layerType) => {
    setActiveLayers(prev => {
      let newLayers = [...prev];
      
      if (newLayers.includes(layerType)) {
        // Remove layer
        newLayers = newLayers.filter(l => l !== layerType);
      } else {
        // Add layer
        newLayers.push(layerType);
        
        // Exclusivity rule: Traffic Conditions vs Illinois Winter Road Conditions
        if (layerType === 'traffic' && newLayers.includes('winter')) {
          newLayers = newLayers.filter(l => l !== 'winter');
        } else if (layerType === 'winter' && newLayers.includes('traffic')) {
          newLayers = newLayers.filter(l => l !== 'traffic');
        }
      }
      
      return newLayers;
    });
  };

  // Location tracking for audio alerts
  useEffect(() => {
    if (audioAlertsEnabled && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          if (position.coords.heading !== null) {
            setUserHeading(position.coords.heading);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [audioAlertsEnabled]);

  // Look-ahead alerts
  useEffect(() => {
    if (audioAlertsEnabled && userLocation) {
      const checkAlerts = async () => {
        try {
          const response = await axios.post(`${API}/alerts/lookahead`, {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            heading: userHeading
          });
          
          if (response.data.alert && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(response.data.message);
            utterance.rate = 0.9;
            utterance.volume = 0.8;
            speechSynthesis.speak(utterance);
          }
        } catch (error) {
          console.error('Error checking alerts:', error);
        }
      };

      const alertInterval = setInterval(checkAlerts, 5000);
      return () => clearInterval(alertInterval);
    }
  }, [audioAlertsEnabled, userLocation, userHeading]);

  // Render markers for active layers
  const renderMarkers = () => {
    const markers = [];
    
    activeLayers.forEach(layerType => {
      const layerData = mapData[layerType]?.data || [];
      const config = LAYER_CONFIG[layerType];
      
      layerData.forEach(point => {
        markers.push(
          <Marker
            key={point.id}
            position={[point.location.latitude, point.location.longitude]}
            icon={createCustomIcon(config.color, config.icon)}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-gray-900 mb-2">{point.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{point.details}</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Severity: {point.severity}</span>
                  <span>{new Date(point.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      });
    });
    
    return markers;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GAIMA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Modals */}
      <TermsModal 
        isOpen={showTerms} 
        onAccept={handleAcceptTerms} 
        onDecline={handleDeclineTerms} 
      />
      
      <SafetyModal 
        isOpen={showSafety} 
        onAccept={handleSafetyAccept} 
      />
      
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        audioAlertsEnabled={audioAlertsEnabled}
        onToggleAudio={() => setAudioAlertsEnabled(!audioAlertsEnabled)}
      />

      {/* Main App Interface */}
      {termsAccepted && !showSafety && (
        <>
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-[1000] bg-white shadow-md">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">G</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">GAIMA</h1>
                  <p className="text-xs text-gray-600">Getting Around Illinois</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Map Container */}
          <div style={{ height: '100vh', paddingTop: '80px' }}>
            <MapContainer
              center={ILLINOIS_CENTER}
              zoom={7}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapCenterController center={ILLINOIS_CENTER} />
              
              {renderMarkers()}
            </MapContainer>
            
            {/* Layer Toggle */}
            <LayerToggle 
              layers={LAYER_CONFIG}
              activeLayers={activeLayers}
              onToggleLayer={handleToggleLayer}
            />
            
            {/* Status Information */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
              <div className="text-xs text-gray-600">
                <div>Active Layers: {activeLayers.length}</div>
                <div>Total Points: {activeLayers.reduce((sum, layer) => sum + (mapData[layer]?.count || 0), 0)}</div>
                {audioAlertsEnabled && (
                  <div className="text-green-600 font-semibold">🔊 Audio Alerts ON</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;