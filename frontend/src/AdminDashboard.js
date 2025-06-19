import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ClockIcon,
  ShieldCheckIcon,
  SpeakerWaveIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Login Screen Component
const AdminLogin = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/admin/login`, credentials);
      const { access_token } = response.data;
      
      // Store token
      localStorage.setItem('gaima-admin-token', access_token);
      onLogin(access_token);
    } catch (error) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">GAIMA Admin</h1>
          <p className="text-gray-600">Administrative Dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="idot_admin"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="password123"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500 text-center">
          <p>Demo Credentials:</p>
          <p>Username: idot_admin</p>
          <p>Password: password123</p>
        </div>
      </div>
    </div>
  );
};

// Dashboard Stats Component
const DashboardStats = ({ stats }) => {
  const statCards = [
    {
      title: 'Total Users',
      value: stats?.total_users?.toLocaleString() || '0',
      icon: UserGroupIcon,
      color: 'bg-blue-500'
    },
    {
      title: 'Active Layers',
      value: stats?.active_layers || '0',
      icon: ChartBarIcon,
      color: 'bg-green-500'
    },
    {
      title: 'Data Points',
      value: stats?.total_data_points?.toLocaleString() || '0',
      icon: DocumentTextIcon,
      color: 'bg-purple-500'
    },
    {
      title: 'Alerts Today',
      value: stats?.alerts_sent_today || '0',
      icon: ExclamationTriangleIcon,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// User Management Component
const UserManagement = ({ users }) => {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users?.map((user, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-800">
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button className="text-green-600 hover:text-green-800">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-800">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Content Management Component
const ContentManagement = ({ content }) => {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Content Management</h3>
      </div>
      <div className="p-6">
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Frequently Asked Questions</h4>
          <div className="space-y-3">
            {content?.faqs?.map((faq, index) => (
              <div key={index} className="border rounded-lg p-4">
                <p className="font-medium text-gray-900">{faq.question}</p>
                <p className="text-sm text-gray-600 mt-1">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Announcements</h4>
          <div className="space-y-3">
            {content?.announcements?.map((announcement, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{announcement.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{announcement.content}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    announcement.priority === 'high' ? 'bg-red-100 text-red-800' :
                    announcement.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {announcement.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Alert Management Component
const AlertManagement = ({ alerts }) => {
  const [newAlert, setNewAlert] = useState({ title: '', message: '', priority: 'medium' });
  const [sending, setSending] = useState(false);

  const sendAlert = async () => {
    if (!newAlert.title.trim() || !newAlert.message.trim()) return;
    
    setSending(true);
    try {
      const token = localStorage.getItem('gaima-admin-token');
      await axios.post(`${API}/admin/broadcast`, newAlert, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Alert sent successfully!');
      setNewAlert({ title: '', message: '', priority: 'medium' });
    } catch (error) {
      alert('Failed to send alert');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Alert Broadcast</h3>
      </div>
      <div className="p-6">
        {/* Send New Alert */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-3">Broadcast New Alert</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Alert title"
              value={newAlert.title}
              onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Alert message"
              rows={3}
              value={newAlert.message}
              onChange={(e) => setNewAlert({ ...newAlert, message: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-between items-center">
              <select
                value={newAlert.priority}
                onChange={(e) => setNewAlert({ ...newAlert, priority: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <button
                onClick={sendAlert}
                disabled={sending || !newAlert.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {sending ? 'Sending...' : 'Send Alert'}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Recent Alerts</h4>
          <div className="space-y-3">
            {alerts?.recent_alerts?.map((alert, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600">
                      Sent: {new Date(alert.sent_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Recipients: {alert.recipients.toLocaleString()}
                    </p>
                  </div>
                  <SpeakerWaveIcon className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Audit Log Component
const AuditLog = ({ auditData }) => {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {auditData?.logs?.map((log, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{log.action}</p>
                  <p className="text-sm text-gray-600">User: {log.user}</p>
                  <p className="text-sm text-gray-600">{log.details}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main Admin Dashboard Component
const AdminDashboard = () => {
  const [token, setToken] = useState(localStorage.getItem('gaima-admin-token'));
  const [currentView, setCurrentView] = useState('dashboard');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
    { id: 'users', name: 'User Management', icon: UserGroupIcon },
    { id: 'content', name: 'Content Management', icon: DocumentTextIcon },
    { id: 'alerts', name: 'Alert Broadcast', icon: SpeakerWaveIcon },
    { id: 'audit', name: 'Audit Log', icon: ClockIcon }
  ];

  const fetchData = async (endpoint) => {
    try {
      const response = await axios.get(`${API}/admin/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
      }
      throw error;
    }
  };

  const loadViewData = async (view) => {
    setLoading(true);
    try {
      let newData = {};
      switch (view) {
        case 'dashboard':
          newData.stats = await fetchData('dashboard');
          break;
        case 'users':
          newData.users = await fetchData('users');
          break;
        case 'content':
          newData.content = await fetchData('content');
          break;
        case 'alerts':
          newData.alerts = await fetchData('alerts');
          break;
        case 'audit':
          newData.audit = await fetchData('audit');
          break;
      }
      setData(prev => ({ ...prev, ...newData }));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && currentView) {
      loadViewData(currentView);
    }
  }, [token, currentView]);

  const handleLogin = (newToken) => {
    setToken(newToken);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('gaima-admin-token');
    setToken(null);
    setCurrentView('dashboard');
    setData({});
  };

  if (!token) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">GAIMA Admin</h1>
              <p className="text-xs text-gray-600">v2.0 Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      currentView === item.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading...</p>
            </div>
          )}

          {!loading && currentView === 'dashboard' && <DashboardStats stats={data.stats} />}
          {!loading && currentView === 'users' && <UserManagement users={data.users} />}
          {!loading && currentView === 'content' && <ContentManagement content={data.content} />}
          {!loading && currentView === 'alerts' && <AlertManagement alerts={data.alerts} />}
          {!loading && currentView === 'audit' && <AuditLog auditData={data.audit} />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;