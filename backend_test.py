#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime
import unittest
import random

# Get the backend URL from the frontend .env file
BACKEND_URL = "https://998052b2-272a-427e-a882-35b3ce87965e.preview.emergentagent.com/api"

# Illinois bounds for coordinate validation
ILLINOIS_BOUNDS = {
    "lat_min": 36.97,
    "lat_max": 42.51,
    "lng_min": -91.51,
    "lng_max": -87.02
}

# Admin credentials for testing
ADMIN_CREDENTIALS = {
    "username": "idot_admin",
    "password": "password123"
}

class TestGAIMABackend(unittest.TestCase):
    
    def setUp(self):
        """Set up for tests that require authentication"""
        self.admin_token = None
    
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.admin_token:
            return self.admin_token
            
        response = requests.post(f"{BACKEND_URL}/admin/login", json=ADMIN_CREDENTIALS)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.admin_token = data["access_token"]
        return self.admin_token
    
    def test_health_check(self):
        """Test the basic health check endpoint"""
        response = requests.get(f"{BACKEND_URL}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("message", data)
        print(f"✅ Health check endpoint working: {data['message']}")
    
    def test_layer_endpoint(self, layer_name):
        """Test a specific layer endpoint"""
        response = requests.get(f"{BACKEND_URL}/layers/{layer_name}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("data", data)
        self.assertIn("last_updated", data)
        self.assertIn("count", data)
        self.assertEqual(len(data["data"]), data["count"])
        
        # Check data is not empty
        self.assertGreater(len(data["data"]), 0)
        
        # Validate data structure for each item
        for item in data["data"]:
            self.validate_map_data_point(item)
            
        print(f"✅ Layer endpoint /layers/{layer_name} working with {len(data['data'])} items")
        return data
    
    def validate_map_data_point(self, point):
        """Validate the structure of a map data point"""
        # Check required fields
        self.assertIn("id", point)
        self.assertIn("type", point)
        self.assertIn("location", point)
        self.assertIn("title", point)
        self.assertIn("details", point)
        self.assertIn("severity", point)
        self.assertIn("timestamp", point)
        
        # Check location structure
        self.assertIn("latitude", point["location"])
        self.assertIn("longitude", point["location"])
        
        # Validate coordinates are within Illinois bounds
        lat = point["location"]["latitude"]
        lng = point["location"]["longitude"]
        self.assertTrue(ILLINOIS_BOUNDS["lat_min"] <= lat <= ILLINOIS_BOUNDS["lat_max"], 
                        f"Latitude {lat} outside Illinois bounds")
        self.assertTrue(ILLINOIS_BOUNDS["lng_min"] <= lng <= ILLINOIS_BOUNDS["lng_max"], 
                        f"Longitude {lng} outside Illinois bounds")
        
        # Validate severity is one of the expected values
        self.assertIn(point["severity"], ["low", "medium", "high"])
    
    def test_all_layer_endpoints(self):
        """Test all 15 layer endpoints"""
        # Original 7 layers
        original_layers = ["traffic", "construction", "closures", "incidents", "weather", "winter", "restrictions"]
        
        # New 8 layers
        new_layers = ["cameras", "rest-areas", "ev-stations", "toll-info", "special-events", 
                      "maintenance", "emergency-services", "travel-centers"]
        
        print("\n=== Testing Original 7 Layer Endpoints ===")
        for layer in original_layers:
            self.test_layer_endpoint(layer)
        
        print("\n=== Testing New 8 Layer Endpoints ===")
        for layer in new_layers:
            self.test_layer_endpoint(layer)
    
    def test_layers_all_endpoint(self):
        """Test the /api/layers/all endpoint that provides a summary of all 15 layers"""
        print("\n=== Testing /api/layers/all Summary Endpoint ===")
        response = requests.get(f"{BACKEND_URL}/layers/all")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("high_priority", data)
        self.assertIn("medium_priority", data)
        self.assertIn("lower_priority", data)
        self.assertIn("total_layers", data)
        self.assertIn("total_data_points", data)
        
        # Verify layer counts match expected grouping
        self.assertEqual(len(data["high_priority"]), 7, "Should have 7 high priority layers")
        self.assertEqual(len(data["medium_priority"]), 4, "Should have 4 medium priority layers")
        self.assertEqual(len(data["lower_priority"]), 4, "Should have 4 lower priority layers")
        self.assertEqual(data["total_layers"], 15, "Should have 15 total layers")
        
        # Verify each layer has count and last_updated
        for priority_group in ["high_priority", "medium_priority", "lower_priority"]:
            for layer, info in data[priority_group].items():
                self.assertIn("count", info)
                self.assertIn("last_updated", info)
                self.assertGreater(info["count"], 0, f"Layer {layer} should have data")
        
        print(f"✅ Layers summary endpoint working with {data['total_layers']} layers and {data['total_data_points']} total data points")
        print(f"   - High priority layers: {len(data['high_priority'])}")
        print(f"   - Medium priority layers: {len(data['medium_priority'])}")
        print(f"   - Lower priority layers: {len(data['lower_priority'])}")
    
    def test_search_route_api(self):
        """Test the route planning API"""
        print("\n=== Testing Route Planning API ===")
        
        # Test routes between major Illinois cities
        test_routes = [
            {
                "name": "Chicago to Springfield",
                "start": {"lat": 41.8781, "lng": -87.6298},
                "end": {"lat": 39.7817, "lng": -89.6501}
            },
            {
                "name": "Rockford to Peoria",
                "start": {"lat": 42.2711, "lng": -89.0940},
                "end": {"lat": 40.6936, "lng": -89.5890}
            },
            {
                "name": "Naperville to Waukegan",
                "start": {"lat": 41.7508, "lng": -88.1535},
                "end": {"lat": 42.3636, "lng": -87.8448}
            }
        ]
        
        for route in test_routes:
            # Prepare request data
            request_data = {
                "start_latitude": route["start"]["lat"],
                "start_longitude": route["start"]["lng"],
                "end_latitude": route["end"]["lat"],
                "end_longitude": route["end"]["lng"]
            }
            
            # Send request
            response = requests.post(f"{BACKEND_URL}/search/route", json=request_data)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            # Check response structure
            self.assertIn("distance_miles", data)
            self.assertIn("estimated_time_minutes", data)
            self.assertIn("polyline", data)
            self.assertIn("instructions", data)
            
            # Validate data
            self.assertGreater(data["distance_miles"], 0)
            self.assertGreater(data["estimated_time_minutes"], 0)
            self.assertGreater(len(data["polyline"]), 0)
            self.assertGreater(len(data["instructions"]), 0)
            
            # Validate polyline structure
            for point in data["polyline"]:
                self.assertEqual(len(point), 2)
                lat, lng = point
                self.assertTrue(ILLINOIS_BOUNDS["lat_min"] <= lat <= ILLINOIS_BOUNDS["lat_max"])
                self.assertTrue(ILLINOIS_BOUNDS["lng_min"] <= lng <= ILLINOIS_BOUNDS["lng_max"])
            
            print(f"✅ Route planning for {route['name']} working:")
            print(f"   - Distance: {data['distance_miles']} miles")
            print(f"   - Time: {data['estimated_time_minutes']} minutes")
            print(f"   - Polyline points: {len(data['polyline'])}")
            print(f"   - Instructions: {len(data['instructions'])}")
    
    def test_search_place_api(self):
        """Test the place search API"""
        print("\n=== Testing Place Search API ===")
        
        # Test search queries
        test_queries = ["Chicago", "Springfield", "University", "Park", "Airport"]
        
        for query in test_queries:
            # Prepare request data
            request_data = {
                "query": query,
                "limit": 10
            }
            
            # Send request
            response = requests.post(f"{BACKEND_URL}/search/place", json=request_data)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            # Check response structure
            self.assertIn("results", data)
            self.assertIn("count", data)
            self.assertEqual(len(data["results"]), data["count"])
            
            # Validate results
            if data["count"] > 0:
                for place in data["results"]:
                    self.assertIn("name", place)
                    self.assertIn("address", place)
                    self.assertIn("latitude", place)
                    self.assertIn("longitude", place)
                    self.assertIn("category", place)
                    
                    # Validate coordinates
                    self.assertTrue(ILLINOIS_BOUNDS["lat_min"] <= place["latitude"] <= ILLINOIS_BOUNDS["lat_max"])
                    self.assertTrue(ILLINOIS_BOUNDS["lng_min"] <= place["longitude"] <= ILLINOIS_BOUNDS["lng_max"])
            
            print(f"✅ Place search for '{query}' returned {data['count']} results")
            if data["count"] > 0:
                for place in data["results"][:3]:  # Show first 3 results
                    print(f"   - {place['name']} ({place['category']})")
    
    def test_admin_login(self):
        """Test admin login endpoint"""
        print("\n=== Testing Admin Login ===")
        
        # Test with valid credentials
        response = requests.post(f"{BACKEND_URL}/admin/login", json=ADMIN_CREDENTIALS)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("access_token", data)
        self.assertIn("token_type", data)
        self.assertIn("expires_in", data)
        
        # Validate token type and expiration
        self.assertEqual(data["token_type"], "bearer")
        self.assertGreater(data["expires_in"], 0)
        
        print(f"✅ Admin login successful with valid credentials")
        print(f"   - Token type: {data['token_type']}")
        print(f"   - Expires in: {data['expires_in']} seconds")
        
        # Test with invalid credentials
        invalid_credentials = {
            "username": "wrong_user",
            "password": "wrong_password"
        }
        
        response = requests.post(f"{BACKEND_URL}/admin/login", json=invalid_credentials)
        self.assertEqual(response.status_code, 401)
        
        print(f"✅ Admin login correctly rejected invalid credentials")
    
    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        print("\n=== Testing Admin Dashboard ===")
        
        # Get admin token
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test with valid token
        response = requests.get(f"{BACKEND_URL}/admin/dashboard", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("total_users", data)
        self.assertIn("active_layers", data)
        self.assertIn("total_data_points", data)
        self.assertIn("alerts_sent_today", data)
        self.assertIn("system_uptime", data)
        
        # Validate data
        self.assertGreater(data["total_users"], 0)
        self.assertEqual(data["active_layers"], 15)
        self.assertGreater(data["total_data_points"], 0)
        self.assertGreater(data["alerts_sent_today"], 0)
        self.assertTrue(len(data["system_uptime"]) > 0)
        
        print(f"✅ Admin dashboard endpoint working")
        print(f"   - Total users: {data['total_users']}")
        print(f"   - Active layers: {data['active_layers']}")
        print(f"   - Total data points: {data['total_data_points']}")
        print(f"   - Alerts sent today: {data['alerts_sent_today']}")
        print(f"   - System uptime: {data['system_uptime']}")
        
        # Test without token
        response = requests.get(f"{BACKEND_URL}/admin/dashboard")
        self.assertEqual(response.status_code, 401)
        
        print(f"✅ Admin dashboard correctly rejected unauthenticated request")
    
    def test_admin_users(self):
        """Test admin users endpoint"""
        print("\n=== Testing Admin Users ===")
        
        # Get admin token
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test with valid token
        response = requests.get(f"{BACKEND_URL}/admin/users", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertTrue(isinstance(data, list))
        self.assertGreater(len(data), 0)
        
        # Validate user data
        for user in data:
            self.assertIn("id", user)
            self.assertIn("username", user)
            self.assertIn("email", user)
            self.assertIn("created_at", user)
            self.assertIn("is_active", user)
        
        print(f"✅ Admin users endpoint working with {len(data)} users")
        for user in data[:3]:  # Show first 3 users
            print(f"   - {user['username']} ({user['email']})")
        
        # Test without token
        response = requests.get(f"{BACKEND_URL}/admin/users")
        self.assertEqual(response.status_code, 401)
        
        print(f"✅ Admin users endpoint correctly rejected unauthenticated request")
    
    def test_admin_content(self):
        """Test admin content endpoint"""
        print("\n=== Testing Admin Content ===")
        
        # Get admin token
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test with valid token
        response = requests.get(f"{BACKEND_URL}/admin/content", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("faqs", data)
        self.assertIn("announcements", data)
        self.assertIn("total_content_items", data)
        
        # Validate data
        self.assertTrue(isinstance(data["faqs"], list))
        self.assertTrue(isinstance(data["announcements"], list))
        self.assertGreater(len(data["faqs"]), 0)
        self.assertGreater(len(data["announcements"]), 0)
        self.assertEqual(data["total_content_items"], len(data["faqs"]) + len(data["announcements"]))
        
        print(f"✅ Admin content endpoint working")
        print(f"   - FAQs: {len(data['faqs'])}")
        print(f"   - Announcements: {len(data['announcements'])}")
        
        # Test without token
        response = requests.get(f"{BACKEND_URL}/admin/content")
        self.assertEqual(response.status_code, 401)
        
        print(f"✅ Admin content endpoint correctly rejected unauthenticated request")
    
    def test_admin_alerts(self):
        """Test admin alerts endpoint"""
        print("\n=== Testing Admin Alerts ===")
        
        # Get admin token
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test with valid token
        response = requests.get(f"{BACKEND_URL}/admin/alerts", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("recent_alerts", data)
        self.assertIn("total_alerts_sent", data)
        self.assertIn("total_recipients_reached", data)
        
        # Validate data
        self.assertTrue(isinstance(data["recent_alerts"], list))
        self.assertGreater(len(data["recent_alerts"]), 0)
        self.assertEqual(data["total_alerts_sent"], len(data["recent_alerts"]))
        self.assertGreater(data["total_recipients_reached"], 0)
        
        print(f"✅ Admin alerts endpoint working")
        print(f"   - Recent alerts: {len(data['recent_alerts'])}")
        print(f"   - Total alerts sent: {data['total_alerts_sent']}")
        print(f"   - Total recipients reached: {data['total_recipients_reached']}")
        
        # Test without token
        response = requests.get(f"{BACKEND_URL}/admin/alerts")
        self.assertEqual(response.status_code, 401)
        
        print(f"✅ Admin alerts endpoint correctly rejected unauthenticated request")
    
    def test_admin_audit(self):
        """Test admin audit logs endpoint"""
        print("\n=== Testing Admin Audit Logs ===")
        
        # Get admin token
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test with valid token
        response = requests.get(f"{BACKEND_URL}/admin/audit", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("logs", data)
        self.assertIn("total_logs", data)
        
        # Validate data
        self.assertTrue(isinstance(data["logs"], list))
        self.assertGreater(len(data["logs"]), 0)
        self.assertEqual(data["total_logs"], len(data["logs"]))
        
        # Validate log structure
        for log in data["logs"]:
            self.assertIn("id", log)
            self.assertIn("action", log)
            self.assertIn("user", log)
            self.assertIn("timestamp", log)
            self.assertIn("details", log)
        
        print(f"✅ Admin audit logs endpoint working with {data['total_logs']} logs")
        for log in data["logs"][:3]:  # Show first 3 logs
            print(f"   - {log['action']} by {log['user']}: {log['details']}")
        
        # Test without token
        response = requests.get(f"{BACKEND_URL}/admin/audit")
        self.assertEqual(response.status_code, 401)
        
        print(f"✅ Admin audit logs endpoint correctly rejected unauthenticated request")
    
    def test_admin_broadcast(self):
        """Test admin broadcast endpoint"""
        print("\n=== Testing Admin Broadcast ===")
        
        # Get admin token
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Prepare alert data
        alert_data = {
            "title": "Test Emergency Alert",
            "message": "This is a test emergency alert for GAIMA v2.0 testing.",
            "severity": "high",
            "target_area": "statewide"
        }
        
        # Test with valid token
        response = requests.post(f"{BACKEND_URL}/admin/broadcast", json=alert_data, headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check response structure
        self.assertIn("success", data)
        self.assertIn("alert_id", data)
        self.assertIn("message", data)
        self.assertIn("estimated_recipients", data)
        
        # Validate data
        self.assertTrue(data["success"])
        self.assertTrue(len(data["alert_id"]) > 0)
        self.assertTrue(len(data["message"]) > 0)
        self.assertGreater(data["estimated_recipients"], 0)
        
        print(f"✅ Admin broadcast endpoint working")
        print(f"   - Alert ID: {data['alert_id']}")
        print(f"   - Message: {data['message']}")
        print(f"   - Estimated recipients: {data['estimated_recipients']}")
        
        # Test without token
        response = requests.post(f"{BACKEND_URL}/admin/broadcast", json=alert_data)
        self.assertEqual(response.status_code, 401)
        
        print(f"✅ Admin broadcast endpoint correctly rejected unauthenticated request")
    
    def test_real_time_updates(self):
        """Test that incident data updates in real-time"""
        print("\n=== Testing Real-Time Updates ===")
        
        # Get initial data
        initial_data = self.test_layer_endpoint("incidents")
        initial_ids = {item["id"] for item in initial_data["data"]}
        initial_timestamp = initial_data["last_updated"]
        
        # Wait for at least 30 seconds (the update interval in the server)
        print("Waiting 35 seconds for real-time updates...")
        time.sleep(35)
        
        # Get updated data
        updated_data = self.test_layer_endpoint("incidents")
        updated_ids = {item["id"] for item in updated_data["data"]}
        updated_timestamp = updated_data["last_updated"]
        
        # Check if data has been updated
        self.assertNotEqual(initial_ids, updated_ids, "Incident IDs should change after update")
        
        # Parse timestamps if they're strings
        if isinstance(initial_timestamp, str):
            initial_timestamp = datetime.fromisoformat(initial_timestamp.replace("Z", "+00:00"))
        if isinstance(updated_timestamp, str):
            updated_timestamp = datetime.fromisoformat(updated_timestamp.replace("Z", "+00:00"))
            
        # Check if timestamp has been updated
        self.assertGreater(updated_timestamp, initial_timestamp, "Last updated timestamp should increase")
        
        print(f"✅ Real-time updates confirmed for incidents layer")
        print(f"   - Initial timestamp: {initial_timestamp}")
        print(f"   - Updated timestamp: {updated_timestamp}")
        print(f"   - Changed IDs: {len(initial_ids - updated_ids)} removed, {len(updated_ids - initial_ids)} added")
    
    def test_lookahead_alerts(self):
        """Test the look-ahead alert system"""
        print("\n=== Testing Look-Ahead Alert System ===")
        
        # Test locations in Illinois
        test_locations = [
            {"name": "Chicago", "lat": 41.8781, "lng": -87.6298},
            {"name": "Springfield", "lat": 39.7817, "lng": -89.6501},
            {"name": "Peoria", "lat": 40.6936, "lng": -89.5890}
        ]
        
        # Test different headings
        test_headings = [0, 90, 180, 270]
        
        print("Testing look-ahead alert system...")
        
        alert_count = 0
        total_tests = 0
        
        for location in test_locations:
            for heading in test_headings:
                total_tests += 1
                
                # Prepare request data
                request_data = {
                    "latitude": location["lat"],
                    "longitude": location["lng"],
                    "heading": heading
                }
                
                # Send request
                response = requests.post(f"{BACKEND_URL}/alerts/lookahead", json=request_data)
                self.assertEqual(response.status_code, 200)
                data = response.json()
                
                # Check response structure
                self.assertIn("alert", data)
                
                # If alert is true, check message
                if data["alert"]:
                    alert_count += 1
                    self.assertIn("message", data)
                    self.assertTrue(len(data["message"]) > 0)
                    print(f"✅ Alert triggered for {location['name']} heading {heading}°: {data['message']}")
        
        print(f"✅ Look-ahead alert system working: {alert_count}/{total_tests} alerts triggered")
        
        # Test with random coordinates within Illinois bounds
        for _ in range(5):
            # Generate random coordinates within Illinois
            lat = random.uniform(ILLINOIS_BOUNDS["lat_min"], ILLINOIS_BOUNDS["lat_max"])
            lng = random.uniform(ILLINOIS_BOUNDS["lng_min"], ILLINOIS_BOUNDS["lng_max"])
            heading = random.uniform(0, 359)
            
            # Prepare request data
            request_data = {
                "latitude": lat,
                "longitude": lng,
                "heading": heading
            }
            
            # Send request
            response = requests.post(f"{BACKEND_URL}/alerts/lookahead", json=request_data)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            # Check response structure
            self.assertIn("alert", data)
            
            # If alert is true, check message
            if data["alert"]:
                self.assertIn("message", data)
                self.assertTrue(len(data["message"]) > 0)
                print(f"✅ Alert triggered for random location ({lat:.4f}, {lng:.4f}) heading {heading:.1f}°: {data['message']}")
            else:
                print(f"✅ No alert for random location ({lat:.4f}, {lng:.4f}) heading {heading:.1f}°")

if __name__ == "__main__":
    # Run the tests
    print(f"Testing GAIMA v2.0 backend API at {BACKEND_URL}")
    print("=" * 80)
    
    # Create test suite
    suite = unittest.TestSuite()
    suite.addTest(TestGAIMABackend("test_health_check"))
    suite.addTest(TestGAIMABackend("test_all_layer_endpoints"))
    suite.addTest(TestGAIMABackend("test_layers_all_endpoint"))
    suite.addTest(TestGAIMABackend("test_search_route_api"))
    suite.addTest(TestGAIMABackend("test_search_place_api"))
    suite.addTest(TestGAIMABackend("test_admin_login"))
    suite.addTest(TestGAIMABackend("test_admin_dashboard"))
    suite.addTest(TestGAIMABackend("test_admin_users"))
    suite.addTest(TestGAIMABackend("test_admin_content"))
    suite.addTest(TestGAIMABackend("test_admin_alerts"))
    suite.addTest(TestGAIMABackend("test_admin_audit"))
    suite.addTest(TestGAIMABackend("test_admin_broadcast"))
    suite.addTest(TestGAIMABackend("test_real_time_updates"))
    suite.addTest(TestGAIMABackend("test_lookahead_alerts"))
    
    # Run the tests
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)