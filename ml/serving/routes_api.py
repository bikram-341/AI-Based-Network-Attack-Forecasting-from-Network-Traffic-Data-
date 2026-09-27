from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from ml.serving.auth import get_current_user
from ml.serving.database import get_db

router = APIRouter(prefix="/api", tags=["api"])

class AlertUpdate(BaseModel):
    status: str

@router.get("/forecasts")
async def get_forecasts(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    forecasts = await db["forecasts"].find({"user_id": current_user["id"]}).sort("timestamp", -1).to_list(100)
    return forecasts

@router.get("/forecasts/{forecast_id}")
async def get_forecast_detail(forecast_id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    forecast = await db["forecasts"].find_one({"_id": forecast_id, "user_id": current_user["id"]})
    if not forecast:
        raise HTTPException(status_code=404, detail="Forecast not found")
    return forecast

@router.get("/alerts")
async def get_alerts(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    alerts = await db["alerts"].find({"user_id": current_user["id"]}).sort("timestamp", -1).to_list(100)
    return alerts

@router.patch("/alerts/{alert_id}")
async def update_alert_status(alert_id: str, update: AlertUpdate, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    if update.status not in ["new", "investigating", "resolved"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db["alerts"].update_one(
        {"_id": alert_id, "user_id": current_user["id"]},
        {"$set": {"status": update.status}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found or status not changed")
    return {"message": "Alert updated successfully"}

@router.get("/network-states")
async def get_network_states(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    states = await db["network_states"].find({"user_id": current_user["id"]}).sort("timestamp", -1).limit(50).to_list(50)
    return states


class SettingsPayload(BaseModel):
    primary_model: Optional[str] = "gru"
    rollout_horizon: Optional[int] = 8
    discount_factor: Optional[float] = 0.85
    critical_threshold: Optional[int] = 80
    high_threshold: Optional[int] = 65
    predictive_alerting: Optional[bool] = True


@router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if db is not None:
        doc = await db["user_settings"].find_one({"user_id": current_user["id"]})
        if doc:
            return {
                "primary_model": doc.get("primary_model", "gru"),
                "rollout_horizon": doc.get("rollout_horizon", 8),
                "discount_factor": doc.get("discount_factor", 0.85),
                "critical_threshold": doc.get("critical_threshold", 80),
                "high_threshold": doc.get("high_threshold", 65),
                "predictive_alerting": doc.get("predictive_alerting", True),
            }
    return {
        "primary_model": "gru",
        "rollout_horizon": 8,
        "discount_factor": 0.85,
        "critical_threshold": 80,
        "high_threshold": 65,
        "predictive_alerting": True
    }


@router.post("/settings")
async def save_settings(payload: SettingsPayload, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    from datetime import datetime
    try:
        import ml.serving.inference_server as inf
        if payload.critical_threshold is not None:
            inf.RISK_THRESH["critical"] = payload.critical_threshold
        if payload.high_threshold is not None:
            inf.RISK_THRESH["high"] = payload.high_threshold
        if payload.discount_factor is not None:
            inf.RISK_DISCOUNT = payload.discount_factor
        if payload.rollout_horizon is not None:
            inf.ROLLOUT_K = payload.rollout_horizon
    except Exception:
        pass

    data = payload.dict()
    if db is not None:
        await db["user_settings"].update_one(
            {"user_id": current_user["id"]},
            {"$set": {**data, "user_id": current_user["id"], "updated_at": datetime.utcnow()}},
            upsert=True
        )
    return {"message": "Settings updated successfully", "settings": data}

