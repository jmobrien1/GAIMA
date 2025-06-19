import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import axios from 'axios';
import { create } from 'zustand';
import AdminDashboard from './AdminDashboard';
import { 
  MagnifyingGlassIcon, 
  MapIcon, 
  UserIcon, 
  CogIcon,
  HeartIcon,
  HomeIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Zustand store for global state
const useStore = create((set, get) => ({
  currentTab: 'map',
  setCurrentTab: (tab) => set({ currentTab: tab }),
  
  // Route data
  currentRoute: null,
  setCurrentRoute: (route) => set({ currentRoute: route }),
  
  // User preferences
  homeLocation: JSON.parse(localStorage.getItem('gaima-home-location')) || null,
  workLocation: JSON.parse(localStorage.getItem('gaima-work-location')) || null,
  favoriteLocations: JSON.parse(localStorage.getItem('gaima-favorite-locations')) || [],
  
  setHomeLocation: (location) => {
    localStorage.setItem('gaima-home-location', JSON.stringify(location));
    set({ homeLocation: location });
  },
  
  setWorkLocation: (location) => {
    localStorage.setItem('gaima-work-location', JSON.stringify(location));
    set({ workLocation: location });
  },
  
  addFavoriteLocation: (location) => {
    const favorites = [...get().favoriteLocations, { ...location, id: Date.now() }];
    localStorage.setItem('gaima-favorite-locations', JSON.stringify(favorites));
    set({ favoriteLocations: favorites });
  },
  
  removeFavoriteLocation: (id) => {
    const favorites = get().favoriteLocations.filter(fav => fav.id !== id);
    localStorage.setItem('gaima-favorite-locations', JSON.stringify(favorites));
    set({ favoriteLocations: favorites });
  },
  
  // Map center control
  mapCenter: [40.0417, -89.1965], // Illinois center
  setMapCenter: (center) => set({ mapCenter: center }),
}));

// Custom icons for different data types (now with 15 layers)
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

// Extended layer configurations for all 15 layers
const LAYER_CONFIG = {
  // High Priority
  traffic: { name: 'Traffic Conditions', color: '#EF4444', icon: 'T', priority: 'high' },
  construction: { name: 'Road Construction', color: '#F97316', icon: 'C', priority: 'high' },
  closures: { name: 'Lane Closures', color: '#DC2626', icon: 'L', priority: 'high' },
  incidents: { name: 'Roadway Incidents', color: '#B91C1C', icon: 'I', priority: 'high' },
  weather: { name: 'Weather Conditions', color: '#3B82F6', icon: 'W', priority: 'high' },
  winter: { name: 'Illinois Winter Road Conditions', color: '#6366F1', icon: 'S', priority: 'high' },
  restrictions: { name: 'Vehicle Restrictions', color: '#9333EA', icon: 'R', priority: 'high' },
  
  // Medium Priority
  cameras: { name: 'Traffic Cameras', color: '#10B981', icon: 'C', priority: 'medium' },
  'rest-areas': { name: 'Rest Areas & Services', color: '#059669', icon: 'R', priority: 'medium' },
  'ev-stations': { name: 'EV Charging Stations', color: '#0D9488', icon: 'E', priority: 'medium' },
  'toll-info': { name: 'Toll Information', color: '#0891B2', icon: 'T', priority: 'medium' },
  
  // Lower Priority  
  'special-events': { name: 'Special Events', color: '#7C3AED', icon: 'S', priority: 'lower' },
  maintenance: { name: 'Road Maintenance Schedule', color: '#A855F7', icon: 'M', priority: 'lower' },
  'emergency-services': { name: 'Emergency Services', color: '#EC4899', icon: 'E', priority: 'lower' },
  'travel-centers': { name: 'Travel Information Centers', color: '#F59E0B', icon: 'I', priority: 'lower' }
};

// Terms of Use Modal Component
const TermsModal = ({ isOpen, onAccept, onDecline }) => {
  const [canAccept, setCanAccept] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef(null);
  
  const handleScroll = (e) => {
    const element = e.target;
    const { scrollTop, scrollHeight, clientHeight } = element;
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px tolerance
    
    if (scrolledToBottom && !hasScrolled) {
      setHasScrolled(true);
      setCanAccept(true);
    }
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCanAccept(false);
      setHasScrolled(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Terms of Use</h2>
          <p className="text-sm text-gray-600 mt-2">Please read and accept our terms to continue</p>
        </div>
        
        <div 
          ref={scrollRef}
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
            
            {!hasScrolled && (
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <p className="text-blue-800 text-sm font-medium">
                  📜 Please scroll to the bottom to accept the terms
                </p>
              </div>
            )}
            
            {hasScrolled && (
              <div className="mt-8 p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
                <p className="text-green-800 text-sm font-medium">
                  ✅ Thank you for reading our terms. You may now accept and continue.
                </p>
              </div>
            )}
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
            className={`flex-1 px-4 py-2 rounded-lg transition-colors font-semibold ${
              canAccept 
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {canAccept ? 'Accept & Continue' : 'Read Terms to Continue'}
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
              <XMarkIcon className="w-6 h-6" />
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

// Enhanced Layer Toggle Component with Priority Grouping
const LayerToggle = ({ layers, activeLayers, onToggleLayer }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ high: true, medium: false, lower: false });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const groupedLayers = {
    high: Object.entries(layers).filter(([_, config]) => config.priority === 'high'),
    medium: Object.entries(layers).filter(([_, config]) => config.priority === 'medium'),
    lower: Object.entries(layers).filter(([_, config]) => config.priority === 'lower')
  };

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
        <div className="absolute right-0 top-14 bg-white rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-3">Map Layers ({activeLayers.length} active)</h3>
          
          {Object.entries(groupedLayers).map(([priority, layerEntries]) => (
            <div key={priority} className="mb-4 last:mb-0">
              <button
                onClick={() => toggleSection(priority)}
                className="flex items-center justify-between w-full p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-700 capitalize">
                  {priority} Priority ({layerEntries.length})
                </span>
                {expandedSections[priority] ? 
                  <ChevronUpIcon className="w-4 h-4" /> : 
                  <ChevronDownIcon className="w-4 h-4" />
                }
              </button>
              
              {expandedSections[priority] && (
                <div className="mt-2 space-y-2">
                  {layerEntries.map(([key, config]) => (
                    <label key={key} className="flex items-center space-x-3 cursor-pointer pl-4">
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Search Screen Component
const SearchScreen = () => {
  const { setCurrentTab, setCurrentRoute, setMapCenter } = useStore();
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState(null);

  const searchPlaces = async () => {
    if (!placeQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/search/place`, {
        query: placeQuery,
        limit: 10
      });
      setSearchResults(response.data.results);
    } catch (error) {
      console.error('Place search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const findRoute = async () => {
    if (!startLocation.trim() || !endLocation.trim()) return;
    
    setLoading(true);
    try {
      // For demo, use mock coordinates
      const response = await axios.post(`${API}/search/route`, {
        start_latitude: 41.8781,
        start_longitude: -87.6298,
        end_latitude: 39.7817,
        end_longitude: -89.6501
      });
      
      setRouteResult(response.data);
      setCurrentRoute(response.data);
      setCurrentTab('map');
    } catch (error) {
      console.error('Route search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectPlace = (place) => {
    setMapCenter([place.latitude, place.longitude]);
    setCurrentTab('map');
  };

  return (
    <div className="h-full bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Route Planning</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Location</label>
              <input
                type="text"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                placeholder="Enter starting point"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Location</label>
              <input
                type="text"
                value={endLocation}
                onChange={(e) => setEndLocation(e.target.value)}
                placeholder="Enter destination"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <button
              onClick={findRoute}
              disabled={loading || !startLocation.trim() || !endLocation.trim()}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Finding Route...' : 'Find Route'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Search Places</h2>
          
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="Search for a place in Illinois"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && searchPlaces()}
              />
            </div>
            
            <button
              onClick={searchPlaces}
              disabled={loading || !placeQuery.trim()}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Searching...' : 'Search Places'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="font-semibold text-gray-900">Search Results</h3>
              {searchResults.map((place, index) => (
                <button
                  key={index}
                  onClick={() => selectPlace(place)}
                  className="w-full p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="font-medium text-gray-900">{place.name}</div>
                  <div className="text-sm text-gray-600">{place.category}</div>
                  <div className="text-xs text-gray-500">{place.address}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Profile Screen Component
const ProfileScreen = () => {
  const { 
    homeLocation, workLocation, favoriteLocations,
    setHomeLocation, setWorkLocation, addFavoriteLocation, removeFavoriteLocation,
    setMapCenter, setCurrentTab 
  } = useStore();
  
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationModalType, setLocationModalType] = useState(''); // 'home' or 'work'
  const [locationInput, setLocationInput] = useState('');

  const handleSetLocation = (type) => {
    setLocationModalType(type);
    setShowLocationModal(true);
  };

  const saveLocation = () => {
    if (!locationInput.trim()) return;
    
    // Mock coordinates for demo (in real app, would geocode the address)
    const mockLocation = {
      name: locationInput,
      address: `${locationInput}, Illinois, USA`,
      latitude: 40.0417 + (Math.random() - 0.5) * 2,
      longitude: -89.1965 + (Math.random() - 0.5) * 2
    };
    
    if (locationModalType === 'home') {
      setHomeLocation(mockLocation);
    } else {
      setWorkLocation(mockLocation);
    }
    
    setLocationInput('');
    setShowLocationModal(false);
  };

  const goToLocation = (location) => {
    setMapCenter([location.latitude, location.longitude]);
    setCurrentTab('map');
  };

  return (
    <div className="h-full bg-gray-50 p-4 overflow-y-auto">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Profile & Preferences</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <HomeIcon className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">Home Location</div>
                  <div className="text-sm text-gray-600">
                    {homeLocation ? homeLocation.name : 'Not set'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleSetLocation('home')}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {homeLocation ? 'Change' : 'Set'}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">Work Location</div>
                  <div className="text-sm text-gray-600">
                    {workLocation ? workLocation.name : 'Not set'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleSetLocation('work')}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {workLocation ? 'Change' : 'Set'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Favorite Locations</h3>
            <HeartIcon className="w-5 h-5 text-red-500" />
          </div>
          
          {favoriteLocations.length === 0 ? (
            <p className="text-gray-600 text-center py-4">No favorite locations saved yet</p>
          ) : (
            <div className="space-y-2">
              {favoriteLocations.map((location) => (
                <div key={location.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <button
                    onClick={() => goToLocation(location)}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium text-gray-900">{location.name}</div>
                    <div className="text-sm text-gray-600">{location.address}</div>
                  </button>
                  <button
                    onClick={() => removeFavoriteLocation(location.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {(homeLocation || workLocation) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {homeLocation && (
                <button
                  onClick={() => goToLocation(homeLocation)}
                  className="w-full p-3 text-left bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <HomeIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-800 font-medium">Go to Home</span>
                  </div>
                </button>
              )}
              {workLocation && (
                <button
                  onClick={() => goToLocation(workLocation)}
                  className="w-full p-3 text-left bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <BuildingOfficeIcon className="w-4 h-4 text-green-600" />
                    <span className="text-green-800 font-medium">Go to Work</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Set {locationModalType === 'home' ? 'Home' : 'Work'} Location
              </h3>
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Enter address or location name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                onKeyPress={(e) => e.key === 'Enter' && saveLocation()}
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveLocation}
                  disabled={!locationInput.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
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

// Main Map Screen Component
const MapScreen = ({ 
  activeLayers, onToggleLayer, audioAlertsEnabled, onShowSettings,
  mapData, loading, userLocation, currentRoute 
}) => {
  const { mapCenter } = useStore();
  
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
                
                {/* Additional info for specific layer types */}
                {point.amenities && (
                  <div className="mt-2 text-xs text-gray-600">
                    <strong>Amenities:</strong> {point.amenities.join(', ')}
                  </div>
                )}
                {point.connector_types && (
                  <div className="mt-2 text-xs text-gray-600">
                    <strong>Connectors:</strong> {point.connector_types.join(', ')}
                  </div>
                )}
                {point.payment_methods && (
                  <div className="mt-2 text-xs text-gray-600">
                    <strong>Payment:</strong> {point.payment_methods.join(', ')}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      });
    });
    
    return markers;
  };

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <MapContainer
        center={mapCenter}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapCenterController center={mapCenter} />
        
        {renderMarkers()}
        
        {/* Render route polyline if available */}
        {currentRoute && currentRoute.polyline && (
          <Polyline
            positions={currentRoute.polyline}
            color="blue"
            weight={4}
            opacity={0.7}
          />
        )}
      </MapContainer>
      
      {/* Layer Toggle */}
      <LayerToggle 
        layers={LAYER_CONFIG}
        activeLayers={activeLayers}
        onToggleLayer={onToggleLayer}
      />
      
      {/* Status Information */}
      <div className="absolute bottom-20 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <div className="text-xs text-gray-600">
          <div>Active Layers: {activeLayers.length}/15</div>
          <div>Total Points: {activeLayers.reduce((sum, layer) => sum + (mapData[layer]?.count || 0), 0)}</div>
          {audioAlertsEnabled && (
            <div className="text-green-600 font-semibold">🔊 Audio Alerts ON</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Tab Navigation Component
const TabNavigation = () => {
  const { currentTab, setCurrentTab } = useStore();
  
  const tabs = [
    { id: 'map', name: 'Map', icon: MapIcon },
    { id: 'search', name: 'Search', icon: MagnifyingGlassIcon },
    { id: 'profile', name: 'Profile', icon: UserIcon }
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[1000]">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex-1 py-3 px-4 flex flex-col items-center space-y-1 transition-colors ${
                currentTab === tab.id
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Main GAIMA Application Component
const GaimaApp = () => {
  const { currentTab, currentRoute } = useStore();
  
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
  
  // Check for accepted terms on app load
  useEffect(() => {
    const accepted = localStorage.getItem('gaima-terms-accepted');
    if (accepted === 'true') {
      setTermsAccepted(true);
      setShowSafety(true);
    } else {
      setShowTerms(true);
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
  };

  const handleSafetyAccept = () => {
    setShowSafety(false);
  };

  // Fetch data for layer
  const fetchLayerData = async (layerType) => {
    try {
      const endpoint = layerType.replace('_', '-'); // Convert underscore to hyphen for URLs
      const response = await axios.get(`${API}/layers/${endpoint}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${layerType} data:`, error);
      return { data: [], count: 0 };
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const layerTypes = Object.keys(LAYER_CONFIG);
      const dataPromises = layerTypes.map(async (layerType) => {
        const data = await fetchLayerData(layerType);
        return [layerType, data];
      });
      
      const results = await Promise.all(dataPromises);
      const newMapData = Object.fromEntries(results);
      setMapData(newMapData);
      setLoading(false);
    };

    if (termsAccepted && !showSafety) {
      loadData();
    }
  }, [termsAccepted, showSafety]);

  // Handle layer toggling with exclusivity rule
  const handleToggleLayer = (layerType) => {
    setActiveLayers(prev => {
      let newLayers = [...prev];
      
      if (newLayers.includes(layerType)) {
        newLayers = newLayers.filter(l => l !== layerType);
      } else {
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

  if (loading && termsAccepted && !showSafety) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GAIMA v2.0...</p>
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
        <div className="h-screen flex flex-col">
          {/* Header */}
          <div className="flex-none bg-white shadow-md z-[1000]">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">G</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">GAIMA v2.0</h1>
                  <p className="text-xs text-gray-600">Getting Around Illinois</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <a 
                  href="/admin" 
                  className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
                  title="Admin Dashboard"
                >
                  Admin
                </a>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <CogIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 relative">
            {currentTab === 'map' && (
              <MapScreen
                activeLayers={activeLayers}
                onToggleLayer={handleToggleLayer}
                audioAlertsEnabled={audioAlertsEnabled}
                onShowSettings={() => setShowSettings(true)}
                mapData={mapData}
                loading={loading}
                userLocation={userLocation}
                currentRoute={currentRoute}
              />
            )}
            
            {currentTab === 'search' && <SearchScreen />}
            
            {currentTab === 'profile' && <ProfileScreen />}
          </div>

          {/* Tab Navigation */}
          <TabNavigation />
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GaimaApp />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;