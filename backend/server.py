from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timedelta
import random
import asyncio
from geopy.distance import geodesic
from jose import JWTError, jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
SECRET_KEY = "gaima-secret-key-for-admin-auth-2025"  # In production, use env variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class LocationPoint(BaseModel):
    latitude: float
    longitude: float

class MapDataPoint(BaseModel):
    id: str
    type: str
    location: LocationPoint
    title: str
    details: str
    severity: str
    timestamp: datetime
    
class LookAheadRequest(BaseModel):
    latitude: float
    longitude: float
    heading: float  # Direction in degrees (0-360)

class AlertResponse(BaseModel):
    alert: bool
    message: str = ""

class RouteRequest(BaseModel):
    start_latitude: float
    start_longitude: float
    end_latitude: float
    end_longitude: float
    
class PlaceSearchRequest(BaseModel):
    query: str
    limit: int = 10

class RouteResponse(BaseModel):
    distance_miles: float
    estimated_time_minutes: int
    polyline: List[List[float]]  # Array of [lat, lng] coordinates
    instructions: List[str]
    
class PlaceResult(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    category: str

class PlaceSearchResponse(BaseModel):
    results: List[PlaceResult]
    count: int

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class AdminUser(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class AdminDashboardStats(BaseModel):
    total_users: int
    active_layers: int
    total_data_points: int
    alerts_sent_today: int
    system_uptime: str

# Authentication functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # In a real app, you'd fetch the user from database
    if username != "idot_admin":
        raise credentials_exception
    
    return {"username": username}

# Mock admin data
MOCK_ADMIN_USERS = [
    AdminUser(username="john_doe", email="john@illinois.gov", last_login=datetime.utcnow() - timedelta(hours=2)),
    AdminUser(username="jane_smith", email="jane@illinois.gov", last_login=datetime.utcnow() - timedelta(days=1)),
    AdminUser(username="admin_user", email="admin@illinois.gov", last_login=datetime.utcnow() - timedelta(hours=5)),
    AdminUser(username="traffic_manager", email="traffic@illinois.gov", last_login=datetime.utcnow() - timedelta(minutes=30)),
    AdminUser(username="system_admin", email="system@illinois.gov", last_login=datetime.utcnow() - timedelta(days=3))
]

MOCK_AUDIT_LOGS = [
    {"id": str(uuid.uuid4()), "action": "User login", "user": "admin_user", "timestamp": datetime.utcnow() - timedelta(hours=1), "details": "Successful admin login"},
    {"id": str(uuid.uuid4()), "action": "Layer update", "user": "traffic_manager", "timestamp": datetime.utcnow() - timedelta(hours=2), "details": "Updated traffic layer data"},
    {"id": str(uuid.uuid4()), "action": "Alert broadcast", "user": "admin_user", "timestamp": datetime.utcnow() - timedelta(hours=3), "details": "Sent emergency alert to all users"},
    {"id": str(uuid.uuid4()), "action": "User creation", "user": "system_admin", "timestamp": datetime.utcnow() - timedelta(days=1), "details": "Created new user account"},
    {"id": str(uuid.uuid4()), "action": "System maintenance", "user": "system_admin", "timestamp": datetime.utcnow() - timedelta(days=2), "details": "Performed system backup"}
]

# Illinois major cities and highways for realistic data generation
ILLINOIS_LOCATIONS = [
    {"name": "Chicago", "lat": 41.8781, "lng": -87.6298},
    {"name": "Aurora", "lat": 41.7606, "lng": -88.3201},
    {"name": "Rockford", "lat": 42.2711, "lng": -89.0940},
    {"name": "Joliet", "lat": 41.5250, "lng": -88.0817},
    {"name": "Naperville", "lat": 41.7508, "lng": -88.1535},
    {"name": "Springfield", "lat": 39.7817, "lng": -89.6501},
    {"name": "Peoria", "lat": 40.6936, "lng": -89.5890},
    {"name": "Elgin", "lat": 42.0354, "lng": -88.2826},
    {"name": "Waukegan", "lat": 42.3636, "lng": -87.8448},
    {"name": "Cicero", "lat": 41.8456, "lng": -87.7539}
]

# Layer Priority Organization
LAYER_PRIORITIES = {
    "high": ["traffic", "construction", "closures", "incidents", "weather", "winter", "restrictions"],
    "medium": ["cameras", "rest_areas", "ev_stations", "toll_info"],
    "lower": ["special_events", "maintenance", "emergency_services", "travel_centers"]
}

def generate_random_location_near_illinois():
    """Generate random coordinates near Illinois cities"""
    base_location = random.choice(ILLINOIS_LOCATIONS)
    # Add small random offset (within ~10 miles)
    lat_offset = random.uniform(-0.1, 0.1)
    lng_offset = random.uniform(-0.1, 0.1)
    return {
        "latitude": base_location["lat"] + lat_offset,
        "longitude": base_location["lng"] + lng_offset
    }

def generate_mock_data(data_type: str, count: int = 20) -> List[Dict[str, Any]]:
    """Generate mock data for different layer types"""
    data = []
    
    severity_options = ["low", "medium", "high"]
    
    for i in range(count):
        location = generate_random_location_near_illinois()
        point = {
            "id": str(uuid.uuid4()),
            "type": data_type.upper(),
            "location": location,
            "timestamp": datetime.utcnow(),
            "severity": random.choice(severity_options)
        }
        
        # Customize based on data type
        if data_type == "traffic":
            conditions = ["Light Traffic", "Moderate Traffic", "Heavy Traffic", "Stop and Go", "Accident Delays"]
            point.update({
                "title": f"Traffic: {random.choice(conditions)}",
                "details": f"Average speed: {random.randint(15, 65)} mph. Estimated delay: {random.randint(2, 30)} minutes."
            })
            
        elif data_type == "construction":
            work_types = ["Road Resurfacing", "Bridge Repair", "Lane Expansion", "Utility Work", "Shoulder Repair"]
            point.update({
                "title": f"Construction: {random.choice(work_types)}",
                "details": f"Work zone active. Expect delays. Estimated completion: {random.randint(1, 90)} days."
            })
            
        elif data_type == "closures":
            closure_types = ["Lane Closure", "Ramp Closure", "Full Road Closure", "Shoulder Closure"]
            point.update({
                "title": random.choice(closure_types),
                "details": f"Duration: {random.randint(2, 24)} hours. Use alternate route recommended."
            })
            
        elif data_type == "incidents":
            incident_types = ["Vehicle Breakdown", "Accident", "Debris on Road", "Disabled Vehicle", "Emergency Response"]
            point.update({
                "title": f"Incident: {random.choice(incident_types)}",
                "details": f"Emergency services on scene. Avoid area if possible. Clear time: {random.randint(30, 180)} minutes."
            })
            
        elif data_type == "weather":
            conditions = ["Rain", "Snow", "Fog", "Ice Warning", "High Winds", "Poor Visibility"]
            point.update({
                "title": f"Weather: {random.choice(conditions)}",
                "details": f"Drive with caution. Visibility: {random.randint(100, 1000)} feet. Speed limit reduced."
            })
            
        elif data_type == "winter":
            conditions = ["Ice on Roadway", "Snow Covered", "Salt Trucks Active", "Chains Required", "Winter Weather Advisory"]
            point.update({
                "title": f"Winter Condition: {random.choice(conditions)}",
                "details": f"Winter driving conditions. Reduce speed. Snow depth: {random.randint(1, 12)} inches."
            })
            
        elif data_type == "restrictions":
            restriction_types = ["Weight Restriction", "Height Restriction", "Hazmat Prohibited", "No Trucks", "Load Limit"]
            point.update({
                "title": f"Vehicle Restriction: {random.choice(restriction_types)}",
                "details": f"Commercial vehicle restrictions in effect. Max weight: {random.randint(20, 80)}k lbs."
            })
            
        elif data_type == "cameras":
            camera_names = ["I-55 @ Mile Marker 120", "I-94 Northbound", "US-45 & Route 83", "I-290 Eisenhower", "I-355 Veterans Memorial"]
            point.update({
                "title": f"Traffic Camera: {random.choice(camera_names)}",
                "details": f"Live traffic camera. Last updated: {random.randint(1, 60)} seconds ago. View traffic conditions.",
                "image_url": f"https://example.com/camera/{point['id']}.jpg",
                "is_active": random.choice([True, False])
            })
            
        elif data_type == "rest_areas":
            amenities = [
                ["Restrooms", "Vending", "Picnic Tables"],
                ["Restrooms", "Gas Station", "Restaurant", "WiFi"],
                ["Restrooms", "Truck Parking", "Showers"],
                ["Restrooms", "Pet Area", "Playground", "Vending"]
            ]
            hours = ["24 Hours", "6 AM - 10 PM", "5 AM - 11 PM", "Open Daily"]
            selected_amenities = random.choice(amenities)
            point.update({
                "title": f"Rest Area - Mile {random.randint(10, 300)}",
                "details": f"Amenities: {', '.join(selected_amenities)}. Hours: {random.choice(hours)}",
                "amenities": selected_amenities,
                "hours": random.choice(hours),
                "truck_parking": "Truck Parking" in selected_amenities
            })
            
        elif data_type == "ev_stations":
            networks = ["ChargePoint", "Electrify America", "Tesla Supercharger", "EVgo", "Blink"]
            connector_types = ["CCS", "CHAdeMO", "Tesla", "J1772"]
            stations = random.randint(2, 8)
            available = random.randint(0, stations)
            point.update({
                "title": f"EV Charging - {random.choice(networks)}",
                "details": f"{available}/{stations} stations available. Connectors: {', '.join(random.sample(connector_types, 2))}",
                "network": random.choice(networks),
                "total_stations": stations,
                "available_stations": available,
                "connector_types": random.sample(connector_types, random.randint(1, 3)),
                "pricing": f"${random.uniform(0.15, 0.45):.2f}/kWh"
            })
            
        elif data_type == "toll_info":
            toll_roads = ["I-Pass Electronic", "Cash Payment", "License Plate Billing", "Pay-By-Plate"]
            rates = [f"${random.uniform(0.50, 8.50):.2f}", f"${random.uniform(1.00, 12.00):.2f}"]
            point.update({
                "title": f"Toll Plaza - {random.choice(['I-90', 'I-94', 'I-355', 'Route 83'])}",
                "details": f"Payment methods: {', '.join(random.sample(toll_roads, 2))}. Rate: {random.choice(rates)}",
                "payment_methods": random.sample(toll_roads, random.randint(2, 4)),
                "toll_rate": random.choice(rates)
            })
            
        elif data_type == "special_events":
            event_types = ["Concert", "Festival", "Sports Event", "Fair", "Marathon", "Parade"]
            impact_levels = ["High Traffic Expected", "Road Closures Possible", "Parking Limited", "Detours in Effect"]
            event_date = datetime.utcnow() + timedelta(days=random.randint(0, 30))
            point.update({
                "title": f"Special Event: {random.choice(event_types)}",
                "details": f"Event Date: {event_date.strftime('%m/%d/%Y')}. {random.choice(impact_levels)}",
                "event_type": random.choice(event_types),
                "event_date": event_date.isoformat(),
                "traffic_impact": random.choice(impact_levels)
            })
            
        elif data_type == "maintenance":
            maintenance_types = ["Pothole Repair", "Line Painting", "Sign Replacement", "Guardrail Repair", "Landscaping"]
            scheduled_date = datetime.utcnow() + timedelta(days=random.randint(1, 14))
            point.update({
                "title": f"Scheduled Maintenance: {random.choice(maintenance_types)}",
                "details": f"Scheduled: {scheduled_date.strftime('%m/%d/%Y')}. Duration: {random.randint(4, 12)} hours",
                "maintenance_type": random.choice(maintenance_types),
                "scheduled_date": scheduled_date.isoformat(),
                "estimated_duration": f"{random.randint(4, 12)} hours"
            })
            
        elif data_type == "emergency_services":
            service_types = ["State Police", "Emergency Medical", "Fire Department", "DOT Emergency Response"]
            point.update({
                "title": f"Emergency Services: {random.choice(service_types)}",
                "details": f"Emergency contact available 24/7. Response time: {random.randint(5, 20)} minutes",
                "service_type": random.choice(service_types),
                "contact_number": f"1-800-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
                "response_time": f"{random.randint(5, 20)} minutes"
            })
            
        elif data_type == "travel_centers":
            services = [
                ["Visitor Information", "Maps", "WiFi"],
                ["Tourist Brochures", "Local Attractions", "Event Calendar"],
                ["Travel Planning", "Hotel Reservations", "Restaurant Recommendations"]
            ]
            center_hours = ["8 AM - 8 PM", "9 AM - 6 PM", "24 Hours", "10 AM - 4 PM"]
            selected_services = random.choice(services)
            point.update({
                "title": f"Illinois Travel Information Center",
                "details": f"Services: {', '.join(selected_services)}. Hours: {random.choice(center_hours)}",
                "services": selected_services,
                "hours": random.choice(center_hours),
                "languages": ["English", "Spanish"] + random.sample(["French", "German", "Chinese"], 1)
            })
        
        data.append(point)
    
    return data

# Store for real-time data updates
data_store = {}
last_update = {}

async def update_incident_data():
    """Update incident data every 30 seconds to simulate real-time"""
    while True:
        data_store["incidents"] = generate_mock_data("incidents", 25)
        last_update["incidents"] = datetime.utcnow()
        await asyncio.sleep(30)

# Initialize data store
all_layer_types = ["traffic", "construction", "closures", "incidents", "weather", "winter", "restrictions", 
                   "cameras", "rest_areas", "ev_stations", "toll_info", "special_events", "maintenance", 
                   "emergency_services", "travel_centers"]

for layer_type in all_layer_types:
    data_store[layer_type] = generate_mock_data(layer_type, 15 if layer_type == "incidents" else 8)
    last_update[layer_type] = datetime.utcnow()

# Start real-time update task
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(update_incident_data())

# API Routes
@api_router.get("/")
async def root():
    return {"message": "GAIMA API - Getting Around Illinois Mobile Application"}

@api_router.get("/layers/traffic")
async def get_traffic_data():
    return {
        "data": data_store.get("traffic", []),
        "last_updated": last_update.get("traffic", datetime.utcnow()),
        "count": len(data_store.get("traffic", []))
    }

@api_router.get("/layers/construction")
async def get_construction_data():
    return {
        "data": data_store.get("construction", []),
        "last_updated": last_update.get("construction", datetime.utcnow()),
        "count": len(data_store.get("construction", []))
    }

@api_router.get("/layers/closures")
async def get_closures_data():
    return {
        "data": data_store.get("closures", []),
        "last_updated": last_update.get("closures", datetime.utcnow()),
        "count": len(data_store.get("closures", []))
    }

@api_router.get("/layers/incidents")
async def get_incidents_data():
    return {
        "data": data_store.get("incidents", []),
        "last_updated": last_update.get("incidents", datetime.utcnow()),
        "count": len(data_store.get("incidents", []))
    }

@api_router.get("/layers/weather")
async def get_weather_data():
    return {
        "data": data_store.get("weather", []),
        "last_updated": last_update.get("weather", datetime.utcnow()),
        "count": len(data_store.get("weather", []))
    }

@api_router.get("/layers/winter")
async def get_winter_data():
    return {
        "data": data_store.get("winter", []),
        "last_updated": last_update.get("winter", datetime.utcnow()),
        "count": len(data_store.get("winter", []))
    }

@api_router.get("/layers/restrictions")
async def get_restrictions_data():
    return {
        "data": data_store.get("restrictions", []),
        "last_updated": last_update.get("restrictions", datetime.utcnow()),
        "count": len(data_store.get("restrictions", []))
    }

@api_router.get("/layers/cameras")
async def get_cameras_data():
    return {
        "data": data_store.get("cameras", []),
        "last_updated": last_update.get("cameras", datetime.utcnow()),
        "count": len(data_store.get("cameras", []))
    }

@api_router.get("/layers/rest-areas")
async def get_rest_areas_data():
    return {
        "data": data_store.get("rest_areas", []),
        "last_updated": last_update.get("rest_areas", datetime.utcnow()),
        "count": len(data_store.get("rest_areas", []))
    }

@api_router.get("/layers/ev-stations")
async def get_ev_stations_data():
    return {
        "data": data_store.get("ev_stations", []),
        "last_updated": last_update.get("ev_stations", datetime.utcnow()),
        "count": len(data_store.get("ev_stations", []))
    }

@api_router.get("/layers/toll-info")
async def get_toll_info_data():
    return {
        "data": data_store.get("toll_info", []),
        "last_updated": last_update.get("toll_info", datetime.utcnow()),
        "count": len(data_store.get("toll_info", []))
    }

@api_router.get("/layers/special-events")
async def get_special_events_data():
    return {
        "data": data_store.get("special_events", []),
        "last_updated": last_update.get("special_events", datetime.utcnow()),
        "count": len(data_store.get("special_events", []))
    }

@api_router.get("/layers/maintenance")
async def get_maintenance_data():
    return {
        "data": data_store.get("maintenance", []),
        "last_updated": last_update.get("maintenance", datetime.utcnow()),
        "count": len(data_store.get("maintenance", []))
    }

@api_router.get("/layers/emergency-services")
async def get_emergency_services_data():
    return {
        "data": data_store.get("emergency_services", []),
        "last_updated": last_update.get("emergency_services", datetime.utcnow()),
        "count": len(data_store.get("emergency_services", []))
    }

@api_router.get("/layers/travel-centers")
async def get_travel_centers_data():
    return {
        "data": data_store.get("travel_centers", []),
        "last_updated": last_update.get("travel_centers", datetime.utcnow()),
        "count": len(data_store.get("travel_centers", []))
    }

@api_router.get("/layers/all")
async def get_all_layers_info():
    """Get summary information about all available layers"""
    return {
        "high_priority": {
            layer: {
                "count": len(data_store.get(layer, [])),
                "last_updated": last_update.get(layer, datetime.utcnow())
            } for layer in LAYER_PRIORITIES["high"]
        },
        "medium_priority": {
            layer: {
                "count": len(data_store.get(layer, [])),
                "last_updated": last_update.get(layer, datetime.utcnow())
            } for layer in LAYER_PRIORITIES["medium"]
        },
        "lower_priority": {
            layer: {
                "count": len(data_store.get(layer, [])),
                "last_updated": last_update.get(layer, datetime.utcnow())
            } for layer in LAYER_PRIORITIES["lower"]
        },
        "total_layers": len(all_layer_types),
        "total_data_points": sum(len(data_store.get(layer, [])) for layer in all_layer_types)
    }

@api_router.post("/alerts/lookahead")
async def get_lookahead_alerts(request: LookAheadRequest):
    """Check for hazards within 2 miles in direction of travel"""
    user_location = (request.latitude, request.longitude)
    
    # Check all high priority incidents and hazards
    all_hazards = []
    for layer_type in ["incidents", "construction", "closures", "weather"]:
        all_hazards.extend(data_store.get(layer_type, []))
    
    # Find hazards within 2 miles
    nearby_hazards = []
    for hazard in all_hazards:
        hazard_location = (hazard["location"]["latitude"], hazard["location"]["longitude"])
        distance = geodesic(user_location, hazard_location).miles
        
        if distance <= 2.0:
            # Simple direction calculation (in a real app, you'd use proper bearing calculation)
            # For demo purposes, we'll include hazards that are roughly in the direction of travel
            nearby_hazards.append({
                "hazard": hazard,
                "distance": round(distance, 1)
            })
    
    if nearby_hazards:
        # Pick the closest, highest severity hazard
        closest_hazard = min(nearby_hazards, key=lambda x: x["distance"])
        hazard_info = closest_hazard["hazard"]
        distance = closest_hazard["distance"]
        
        # Generate audio alert message
        distance_text = f"{distance} mile{'s' if distance != 1 else ''}"
        message = f"{hazard_info['title']} ahead, {distance_text}. {hazard_info['details'][:50]}..."
        
        return AlertResponse(alert=True, message=message)
    
@api_router.post("/search/route")
async def search_route(request: RouteRequest):
    """Search for a route between two points"""
    # Calculate distance using geodesic
    start_point = (request.start_latitude, request.start_longitude)
    end_point = (request.end_latitude, request.end_longitude)
    distance = geodesic(start_point, end_point).miles
    
    # Estimate time (assuming average speed of 45 mph)
    estimated_time = int((distance / 45) * 60)  # Convert to minutes
    
    # Generate a simple polyline (in real app, this would use routing service)
    # For demo, create a simple straight line with some waypoints
    num_points = max(5, int(distance / 10))  # More points for longer distances
    polyline = []
    
    for i in range(num_points + 1):
        ratio = i / num_points
        lat = request.start_latitude + (request.end_latitude - request.start_latitude) * ratio
        lng = request.start_longitude + (request.end_longitude - request.start_longitude) * ratio
        
        # Add small random variation to make it look more realistic
        if i > 0 and i < num_points:
            lat += random.uniform(-0.01, 0.01)
            lng += random.uniform(-0.01, 0.01)
        
        polyline.append([lat, lng])
    
    # Generate mock turn-by-turn instructions
    directions = [
        "Head northwest on your starting road",
        f"Continue for {distance/3:.1f} miles",
        "Stay on the main route",
        f"In {distance/2:.1f} miles, continue straight",
        "Approaching destination on the right"
    ]
    
    return RouteResponse(
        distance_miles=round(distance, 1),
        estimated_time_minutes=estimated_time,
        polyline=polyline,
        instructions=directions
    )

@api_router.post("/search/place")
async def search_place(request: PlaceSearchRequest):
    """Search for places by name or address"""
    # Mock place search results based on Illinois locations
    mock_places = [
        {"name": "Chicago O'Hare International Airport", "category": "Airport", "lat": 41.9742, "lng": -87.9073},
        {"name": "Millennium Park", "category": "Park", "lat": 41.8826, "lng": -87.6226},
        {"name": "Navy Pier", "category": "Attraction", "lat": 41.8917, "lng": -87.6086},
        {"name": "Springfield State Capitol", "category": "Government", "lat": 39.7990, "lng": -89.6544},
        {"name": "University of Illinois", "category": "Education", "lat": 40.1020, "lng": -88.2272},
        {"name": "Starved Rock State Park", "category": "Park", "lat": 41.3184, "lng": -88.9942},
        {"name": "Route 66 Begin Sign", "category": "Landmark", "lat": 41.8781, "lng": -87.6298},
        {"name": "Illinois State Fair", "category": "Event", "lat": 39.7817, "lng": -89.6501},
        {"name": "Cahokia Mounds", "category": "Historic", "lat": 38.6581, "lng": -90.0629},
        {"name": "Woodfield Mall", "category": "Shopping", "lat": 42.0409, "lng": -88.0359}
    ]
    
    # Filter places based on search query
    query_lower = request.query.lower()
    matching_places = []
    
    for place in mock_places:
        if (query_lower in place["name"].lower() or 
            query_lower in place["category"].lower() or
            len(query_lower) < 3):  # Show all for short queries
            
            matching_places.append(PlaceResult(
                name=place["name"],
                address=f"{place['name']}, Illinois, USA",
                latitude=place["lat"],
                longitude=place["lng"],
                category=place["category"]
            ))
    
    # Limit results
    matching_places = matching_places[:request.limit]
    
    return PlaceSearchResponse(
        results=matching_places,
        count=len(matching_places)
    )

# Admin Authentication Endpoints
@api_router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(login_request: AdminLoginRequest):
    """Admin login endpoint"""
    # Hardcoded credentials for demo (in real app, check against database)
    if login_request.username != "idot_admin" or login_request.password != "password123":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": login_request.username}, expires_delta=access_token_expires
    )
    
    return AdminLoginResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert to seconds
    )

# Admin Dashboard Endpoints (Protected)
@api_router.get("/admin/dashboard", response_model=AdminDashboardStats)
async def get_admin_dashboard(current_user: dict = Depends(get_current_admin_user)):
    """Get admin dashboard statistics"""
    total_data_points = sum(len(data_store.get(layer, [])) for layer in all_layer_types)
    
    return AdminDashboardStats(
        total_users=len(MOCK_ADMIN_USERS) + random.randint(1500, 2500),  # Include public users
        active_layers=len(all_layer_types),
        total_data_points=total_data_points,
        alerts_sent_today=random.randint(45, 120),
        system_uptime="15 days, 8 hours"
    )

@api_router.get("/admin/users", response_model=List[AdminUser])
async def get_admin_users(current_user: dict = Depends(get_current_admin_user)):
    """Get list of admin users"""
    return MOCK_ADMIN_USERS

@api_router.get("/admin/content")
async def get_admin_content(current_user: dict = Depends(get_current_admin_user)):
    """Get content management data"""
    return {
        "faqs": [
            {"id": 1, "question": "How often is traffic data updated?", "answer": "Every 30 seconds for incidents, every 5 minutes for traffic conditions"},
            {"id": 2, "question": "Can I save favorite locations?", "answer": "Yes, use the Profile tab to set home/work locations and save favorites"},
            {"id": 3, "question": "How do audio alerts work?", "answer": "Enable audio alerts in settings, and you'll hear warnings about hazards within 2 miles"}
        ],
        "announcements": [
            {"id": 1, "title": "System Maintenance", "content": "Scheduled maintenance on Sunday 2:00 AM - 4:00 AM", "priority": "medium"},
            {"id": 2, "title": "New Features", "content": "Profile system and favorites now available", "priority": "low"}
        ],
        "total_content_items": 5
    }

@api_router.get("/admin/alerts")
async def get_admin_alerts(current_user: dict = Depends(get_current_admin_user)):
    """Get alert broadcast management data"""
    return {
        "recent_alerts": [
            {"id": 1, "title": "Winter Weather Advisory", "sent_at": "2025-01-15T10:30:00Z", "recipients": 1250},
            {"id": 2, "title": "Highway Construction Notice", "sent_at": "2025-01-14T14:15:00Z", "recipients": 890},
            {"id": 3, "title": "System Update Notification", "sent_at": "2025-01-13T09:00:00Z", "recipients": 2100}
        ],
        "total_alerts_sent": 3,
        "total_recipients_reached": 4240
    }

@api_router.get("/admin/audit")
async def get_admin_audit_logs(current_user: dict = Depends(get_current_admin_user)):
    """Get audit logs"""
    return {
        "logs": MOCK_AUDIT_LOGS,
        "total_logs": len(MOCK_AUDIT_LOGS)
    }

@api_router.post("/admin/broadcast")
async def broadcast_alert(
    alert_data: dict,
    current_user: dict = Depends(get_current_admin_user)
):
    """Broadcast an alert to all users"""
    # In a real app, this would send push notifications or alerts
    alert_id = str(uuid.uuid4())
    
    # Add to audit log
    MOCK_AUDIT_LOGS.insert(0, {
        "id": str(uuid.uuid4()),
        "action": "Alert broadcast",
        "user": current_user["username"],
        "timestamp": datetime.utcnow(),
        "details": f"Broadcasted alert: {alert_data.get('title', 'Untitled')}"
    })
    
    return {
        "success": True,
        "alert_id": alert_id,
        "message": "Alert broadcasted successfully",
        "estimated_recipients": random.randint(800, 1500)
    }

# Original routes
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()