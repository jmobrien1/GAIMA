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

class TestGAIMABackend(unittest.TestCase):
    
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
        """Test all layer endpoints"""
        layers = ["traffic", "construction", "closures", "incidents", "weather", "winter", "restrictions"]
        for layer in layers:
            self.test_layer_endpoint(layer)
    
    def test_real_time_updates(self):
        """Test that incident data updates in real-time"""
        print("Testing real-time updates for incidents layer...")
        
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
    print(f"Testing GAIMA backend API at {BACKEND_URL}")
    print("=" * 80)
    
    # Create test suite
    suite = unittest.TestSuite()
    suite.addTest(TestGAIMABackend("test_health_check"))
    suite.addTest(TestGAIMABackend("test_all_layer_endpoints"))
    suite.addTest(TestGAIMABackend("test_real_time_updates"))
    suite.addTest(TestGAIMABackend("test_lookahead_alerts"))
    
    # Run the tests
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)