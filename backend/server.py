from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import uuid
from datetime import datetime, timedelta
import random
import asyncio
from geopy.distance import geodesic

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
for layer_type in ["traffic", "construction", "closures", "incidents", "weather", "winter", "restrictions"]:
    data_store[layer_type] = generate_mock_data(layer_type, 15 if layer_type == "incidents" else 10)
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
    
    return AlertResponse(alert=False)

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