"""
Built-in compliance checklist presets for common regulatory frameworks.
Each entry maps a category key to a dict with name, description, sections, and items.
"""

PRESET_TEMPLATES: dict = {
    "osha": {
        "name": "OSHA General Industry Safety",
        "description": "Occupational Safety and Health Administration – general industry standards.",
        "sections": [
            {"title": "Hazard Communication", "order_index": 0},
            {"title": "Personal Protective Equipment", "order_index": 1},
            {"title": "Emergency Preparedness", "order_index": 2},
            {"title": "Electrical Safety", "order_index": 3},
            {"title": "Recordkeeping", "order_index": 4},
        ],
        "items": [
            {"section": "Hazard Communication", "question": "Chemical inventory and SDS binders are current and accessible.", "category": "safety", "is_critical": True},
            {"section": "Hazard Communication", "question": "Staff trained on hazard communication within last 12 months.", "category": "staff", "is_critical": True},
            {"section": "Hazard Communication", "question": "All chemical containers are properly labeled.", "category": "safety"},
            {"section": "Personal Protective Equipment", "question": "Appropriate PPE available and in good condition for all tasks.", "category": "safety", "is_critical": True},
            {"section": "Personal Protective Equipment", "question": "PPE training documented for all staff.", "category": "documentation"},
            {"section": "Personal Protective Equipment", "question": "Eye wash station tested and accessible.", "category": "safety", "is_critical": True},
            {"section": "Emergency Preparedness", "question": "Emergency exit routes are clearly marked and unobstructed.", "category": "safety", "is_critical": True},
            {"section": "Emergency Preparedness", "question": "Fire extinguishers inspected within last 12 months.", "category": "equipment", "is_critical": True},
            {"section": "Emergency Preparedness", "question": "Emergency contact list posted.", "category": "documentation"},
            {"section": "Emergency Preparedness", "question": "Emergency drill conducted within last 12 months.", "category": "staff"},
            {"section": "Electrical Safety", "question": "Electrical panels accessible and labeled.", "category": "facility"},
            {"section": "Electrical Safety", "question": "No exposed wiring or overloaded circuits observed.", "category": "safety", "is_critical": True},
            {"section": "Recordkeeping", "question": "OSHA 300 injury/illness log is current.", "category": "documentation", "is_critical": True},
            {"section": "Recordkeeping", "question": "Training records maintained for last 3 years.", "category": "documentation"},
        ],
    },

    "hipaa": {
        "name": "HIPAA Privacy & Security",
        "description": "Health Insurance Portability and Accountability Act – privacy and security safeguards.",
        "sections": [
            {"title": "Administrative Safeguards", "order_index": 0},
            {"title": "Physical Safeguards", "order_index": 1},
            {"title": "Technical Safeguards", "order_index": 2},
            {"title": "Policies & Training", "order_index": 3},
        ],
        "items": [
            {"section": "Administrative Safeguards", "question": "HIPAA Privacy Officer designated and documented.", "category": "regulatory", "is_critical": True},
            {"section": "Administrative Safeguards", "question": "Risk assessment completed within last 12 months.", "category": "regulatory", "is_critical": True},
            {"section": "Administrative Safeguards", "question": "Business Associate Agreements in place for all applicable vendors.", "category": "documentation", "is_critical": True},
            {"section": "Physical Safeguards", "question": "PHI records/workstations in secure, access-controlled areas.", "category": "facility", "is_critical": True},
            {"section": "Physical Safeguards", "question": "Visitor log maintained at all entry points.", "category": "documentation"},
            {"section": "Physical Safeguards", "question": "Printed PHI disposed via shredder or locked destruction bins.", "category": "safety"},
            {"section": "Technical Safeguards", "question": "All workstations require login; automatic timeout enabled.", "category": "equipment", "is_critical": True},
            {"section": "Technical Safeguards", "question": "EHR/PHI systems have audit logging enabled.", "category": "equipment", "is_critical": True},
            {"section": "Technical Safeguards", "question": "Encryption used for PHI stored on portable devices.", "category": "equipment"},
            {"section": "Policies & Training", "question": "All staff completed HIPAA training within last 12 months.", "category": "staff", "is_critical": True},
            {"section": "Policies & Training", "question": "Incident response plan documented and tested.", "category": "documentation"},
            {"section": "Policies & Training", "question": "Breach notification policy posted and distributed.", "category": "documentation"},
        ],
    },

    "infection_control": {
        "name": "Infection Prevention & Control",
        "description": "Standard infection control precautions for clinical settings.",
        "sections": [
            {"title": "Hand Hygiene", "order_index": 0},
            {"title": "PPE & Barrier Precautions", "order_index": 1},
            {"title": "Sterilization & Disinfection", "order_index": 2},
            {"title": "Waste Management", "order_index": 3},
            {"title": "Environment", "order_index": 4},
        ],
        "items": [
            {"section": "Hand Hygiene", "question": "Hand sanitizer dispensers present and stocked at point-of-care.", "category": "hygiene", "is_critical": True},
            {"section": "Hand Hygiene", "question": "Handwashing sinks have soap and paper towels.", "category": "hygiene", "is_critical": True},
            {"section": "Hand Hygiene", "question": "Staff observed performing hand hygiene correctly.", "category": "staff"},
            {"section": "PPE & Barrier Precautions", "question": "Gloves, masks, gowns, and eye protection stocked and accessible.", "category": "safety", "is_critical": True},
            {"section": "PPE & Barrier Precautions", "question": "Staff use appropriate PPE for clinical procedures.", "category": "staff", "is_critical": True},
            {"section": "Sterilization & Disinfection", "question": "Autoclave/sterilizer functioning and log is current.", "category": "equipment", "is_critical": True},
            {"section": "Sterilization & Disinfection", "question": "High-level disinfection protocols followed for reusable equipment.", "category": "equipment", "is_critical": True},
            {"section": "Sterilization & Disinfection", "question": "Surface disinfectants are EPA-registered and used per label.", "category": "hygiene"},
            {"section": "Waste Management", "question": "Sharps containers properly labeled, accessible, not overfilled.", "category": "safety", "is_critical": True},
            {"section": "Waste Management", "question": "Biohazard waste segregated and labeled correctly.", "category": "safety", "is_critical": True},
            {"section": "Waste Management", "question": "Regulated medical waste disposal contract current.", "category": "documentation"},
            {"section": "Environment", "question": "Clinical areas cleaned and disinfected per schedule.", "category": "hygiene"},
            {"section": "Environment", "question": "HVAC filters replaced per schedule; documentation available.", "category": "facility"},
        ],
    },

    "medication_safety": {
        "name": "Medication Safety",
        "description": "Safe storage, handling, and administration of medications.",
        "sections": [
            {"title": "Storage", "order_index": 0},
            {"title": "Administration", "order_index": 1},
            {"title": "Controlled Substances", "order_index": 2},
            {"title": "Documentation", "order_index": 3},
        ],
        "items": [
            {"section": "Storage", "question": "Medications stored at correct temperatures (refrigerator logs current).", "category": "equipment", "is_critical": True},
            {"section": "Storage", "question": "Expired medications removed and disposed per policy.", "category": "regulatory", "is_critical": True},
            {"section": "Storage", "question": "Medications locked and accessible only to authorized staff.", "category": "safety", "is_critical": True},
            {"section": "Administration", "question": "Five rights of medication administration (patient, drug, dose, route, time) followed.", "category": "staff", "is_critical": True},
            {"section": "Administration", "question": "Medication reconciliation completed at admission/transition.", "category": "documentation"},
            {"section": "Controlled Substances", "question": "Controlled substance count conducted at each shift change.", "category": "regulatory", "is_critical": True},
            {"section": "Controlled Substances", "question": "Controlled substance log accurate and up-to-date.", "category": "documentation", "is_critical": True},
            {"section": "Controlled Substances", "question": "DEA registration current.", "category": "regulatory"},
            {"section": "Documentation", "question": "Medication errors reported per policy.", "category": "documentation"},
            {"section": "Documentation", "question": "Allergy documentation present for all patients.", "category": "documentation", "is_critical": True},
        ],
    },

    "fire_safety": {
        "name": "Fire & Life Safety",
        "description": "Fire prevention, suppression systems, and evacuation readiness.",
        "sections": [
            {"title": "Fire Suppression Systems", "order_index": 0},
            {"title": "Evacuation", "order_index": 1},
            {"title": "Prevention", "order_index": 2},
        ],
        "items": [
            {"section": "Fire Suppression Systems", "question": "Sprinkler heads unobstructed and inspection current.", "category": "equipment", "is_critical": True},
            {"section": "Fire Suppression Systems", "question": "Fire alarm tested and inspection tag current.", "category": "equipment", "is_critical": True},
            {"section": "Fire Suppression Systems", "question": "Fire extinguishers tagged, inspected, not obstructed.", "category": "equipment", "is_critical": True},
            {"section": "Evacuation", "question": "Posted evacuation maps current and visible in all areas.", "category": "safety", "is_critical": True},
            {"section": "Evacuation", "question": "All exit signs illuminated.", "category": "facility", "is_critical": True},
            {"section": "Evacuation", "question": "Exit doors unobstructed and operational.", "category": "safety", "is_critical": True},
            {"section": "Evacuation", "question": "Fire drill conducted and documented in last 12 months.", "category": "documentation"},
            {"section": "Prevention", "question": "No combustible materials stored near heat sources.", "category": "safety"},
            {"section": "Prevention", "question": "Smoking policy posted and enforced.", "category": "regulatory"},
            {"section": "Prevention", "question": "Kitchen/break room appliances in good condition.", "category": "equipment"},
        ],
    },

    "equipment_maintenance": {
        "name": "Equipment Maintenance",
        "description": "Medical and facility equipment inspection and preventive maintenance.",
        "sections": [
            {"title": "Medical Equipment", "order_index": 0},
            {"title": "Facility Systems", "order_index": 1},
        ],
        "items": [
            {"section": "Medical Equipment", "question": "All medical equipment has a current PM sticker or log entry.", "category": "equipment", "is_critical": True},
            {"section": "Medical Equipment", "question": "Defibrillator/AED checked daily; pads and battery current.", "category": "equipment", "is_critical": True},
            {"section": "Medical Equipment", "question": "Scales calibrated per schedule.", "category": "equipment"},
            {"section": "Medical Equipment", "question": "Blood pressure cuffs and pulse oximeters functioning and clean.", "category": "equipment"},
            {"section": "Medical Equipment", "question": "Broken/defective equipment tagged out-of-service.", "category": "equipment", "is_critical": True},
            {"section": "Facility Systems", "question": "Generator tested monthly; log current.", "category": "equipment"},
            {"section": "Facility Systems", "question": "Emergency lighting tested and functional.", "category": "facility", "is_critical": True},
            {"section": "Facility Systems", "question": "Plumbing (no leaks, water temperature compliance for Legionella prevention).", "category": "facility"},
        ],
    },

    "patient_safety": {
        "name": "Patient Safety",
        "description": "General patient safety checks including fall prevention, ID verification, and environment.",
        "sections": [
            {"title": "Patient Identification", "order_index": 0},
            {"title": "Fall Prevention", "order_index": 1},
            {"title": "Environment of Care", "order_index": 2},
        ],
        "items": [
            {"section": "Patient Identification", "question": "Two patient identifiers used before all procedures.", "category": "staff", "is_critical": True},
            {"section": "Patient Identification", "question": "Patient armbands/ID verified at check-in.", "category": "staff"},
            {"section": "Fall Prevention", "question": "Fall risk assessment completed for all patients.", "category": "documentation", "is_critical": True},
            {"section": "Fall Prevention", "question": "Call bells within reach of patients; staff response tested.", "category": "equipment"},
            {"section": "Fall Prevention", "question": "Floor surfaces dry, non-slip mats present where needed.", "category": "facility"},
            {"section": "Environment of Care", "question": "Hallways and corridors free of trip hazards.", "category": "facility"},
            {"section": "Environment of Care", "question": "Adequate lighting in all patient care areas.", "category": "facility"},
            {"section": "Environment of Care", "question": "Patient privacy maintained (curtains, doors).", "category": "regulatory"},
        ],
    },
}
