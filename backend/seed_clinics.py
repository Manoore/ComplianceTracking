"""
Seed the My Hometown Health clinic network, grouped by region.

Usage:
    cd backend
    python seed_clinics.py                         # first tenant
    python seed_clinics.py --tenant-id 3
    python seed_clinics.py --email you@example.com # tenant that owns this user
    python seed_clinics.py --update                # refresh existing clinics in place

Existing clinics are matched by name within the tenant. Without --update they are
left untouched, so re-running is safe.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal

# Clinic.department is a string-based relationship, so every mapper it references
# must be imported before the Clinic mapper is configured.
import app.models  # noqa: F401
import app.models.department  # noqa: F401  (not re-exported from app.models)

from app.models.clinic import Clinic, ClinicType
from app.models.tenant import Tenant
from app.models.user import User

STATE = "OH"

# (name, address, city, zip, [services])
CLINICS_BY_REGION = {
    "Cleveland": [
        ("Hometown Berea", "205 W Bagley Rd", "Berea", "44017", ["Urgent Care", "Primary Care"]),
        ("Hometown Euclid", "22595 Lake Shore Blvd", "Euclid", "44123", ["Urgent Care", "Primary Care"]),
        ("Hometown Garfield Heights", "12813 Rockside Rd", "Garfield Heights", "44125", ["Urgent Care", "Primary Care"]),
        ("Hometown Lorain", "2251 Tower Blvd", "Lorain", "44053", ["Urgent Care", "Primary Care"]),
        ("Hometown Mentor on the Lake", "6006 Andrews Rd", "Mentor on the Lake", "44060", ["Urgent Care", "Primary Care"]),
        ("Hometown Parma", "7715 W Ridgewood Dr", "Parma", "44129", ["Urgent Care", "Primary Care"]),
    ],
    "Akron": [
        ("Hometown Akron", "472 E Waterloo Rd", "Akron", "44319", ["Urgent Care", "Primary Care"]),
        ("Hometown Alliance", "1939 W State St", "Alliance", "44601", ["Urgent Care", "Primary Care"]),
        ("Hometown Barberton", "49 5th St SE", "Barberton", "44203", ["Urgent Care", "Primary Care"]),
        ("Hometown Cuyahoga Falls", "2967 State St", "Cuyahoga Falls", "44223", ["Urgent Care", "Primary Care"]),
        ("Hometown Massillon", "1111 Lincoln Way E", "Massillon", "44646", ["Urgent Care", "Primary Care"]),
        ("Hometown North Canton", "1444 N Main St", "North Canton", "44720", ["Urgent Care", "Primary Care"]),
        ("Hometown Poland", "1301 Boardman Poland Rd", "Poland", "44514", ["Urgent Care", "Primary Care"]),
        ("Hometown Ravenna", "951 E Main St", "Ravenna", "44266", ["Urgent Care", "Primary Care"]),
        ("Hometown Streetsboro", "9300 State Route 14", "Streetsboro", "44241", ["Urgent Care", "Primary Care", "Wellness"]),
        ("Hometown Wooster", "4164 Burbank Rd", "Wooster", "44691", ["Urgent Care", "Primary Care"]),
    ],
    "Columbus": [
        ("Hometown Canal Winchester", "710 W Waterloo St", "Canal Winchester", "43106", ["Urgent Care", "Primary Care"]),
        ("Hometown Columbus on Clime", "4300 Clime Rd STE 110", "Columbus", "43228", ["Urgent Care", "Primary Care", "Clinical Research"]),
        ("Hometown Columbus on Morse", "1615 Morse Rd", "Columbus", "43229", ["Urgent Care", "Primary Care"]),
        ("Hometown Columbus on Stelzer", "2880 Stelzer Rd", "Columbus", "43219", ["Urgent Care", "Primary Care"]),
        ("Hometown Groveport", "3813 S Hamilton Rd", "Groveport", "43125", ["Urgent Care", "Primary Care"]),
        ("Hometown Hilliard", "2371 Hilliard Rome Rd", "Hilliard", "43026", ["Urgent Care", "Primary Care"]),
        ("Hometown Lancaster", "1612 N Memorial Dr", "Lancaster", "43130", ["Urgent Care", "Primary Care"]),
    ],
    "Dayton": [
        ("Hometown Clayton", "7709 Hoke Rd", "Clayton", "45315", ["Primary Care", "Wellness"]),
        ("Hometown Englewood", "9150 N Main St", "Englewood", "45415", ["Urgent Care", "Primary Care", "Clinical Research"]),
        ("Hometown Huber Heights", "6210 Brandt Pike Ste 102", "Huber Heights", "45424", ["Urgent Care", "Primary Care", "Clinical Research"]),
        ("Hometown Piqua", "201 E Ash St", "Piqua", "45356", ["Urgent Care", "Primary Care", "Wellness"]),
        ("Hometown Sidney", "2277 W Michigan St", "Sidney", "45365", ["Urgent Care", "Primary Care"]),
        ("Hometown Springfield North", "1200 Vester Ave", "Springfield", "45503", ["Urgent Care", "Primary Care"]),
        ("Hometown Springfield South", "1301 W 1st St", "Springfield", "45504", ["Urgent Care", "Primary Care", "Clinical Research"]),
        ("Hometown Troy", "1451 W Main St", "Troy", "45373", ["Urgent Care", "Primary Care", "Clinical Research"]),
    ],
    "Cincinnati": [
        ("Hometown Colerain", "8459 Colerain Ave", "Cincinnati", "45239", ["Urgent Care", "Primary Care"]),
        ("Hometown Milford", "1068 OH-28", "Milford", "45150", ["Urgent Care", "Primary Care", "Clinical Research"]),
    ],
}


def resolve_tenant(db, args):
    if args.tenant_id:
        t = db.query(Tenant).filter(Tenant.id == args.tenant_id).first()
        if not t:
            sys.exit(f"No tenant with id={args.tenant_id}")
        return t
    if args.email:
        user = db.query(User).filter(User.email == args.email).first()
        if not user:
            sys.exit(f"No user with email={args.email}")
        if not user.tenant_id:
            sys.exit(f"User {args.email} has no tenant assigned")
        return db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    t = db.query(Tenant).order_by(Tenant.id).first()
    if not t:
        sys.exit("No tenants exist yet. Start the API once to seed the default tenant.")
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tenant-id", type=int)
    ap.add_argument("--email")
    ap.add_argument("--update", action="store_true",
                    help="overwrite address/region/services on clinics that already exist")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        tenant = resolve_tenant(db, args)
        created = updated = skipped = 0

        for region, rows in CLINICS_BY_REGION.items():
            for name, address, city, zip_code, services in rows:
                fields = dict(
                    clinic_type=ClinicType.urgent_care if "Urgent Care" in services else ClinicType.general_practice,
                    services=services,
                    address=address,
                    city=city,
                    state=STATE,
                    zip_code=zip_code,
                    region=region,
                )
                existing = (db.query(Clinic)
                            .filter(Clinic.tenant_id == tenant.id, Clinic.name == name)
                            .first())
                if existing:
                    if args.update:
                        for k, v in fields.items():
                            setattr(existing, k, v)
                        updated += 1
                    else:
                        skipped += 1
                    continue
                db.add(Clinic(name=name, tenant_id=tenant.id, is_active=True, **fields))
                created += 1

        db.commit()
        total = sum(len(v) for v in CLINICS_BY_REGION.values())
        print(f"Tenant: {tenant.name} (id={tenant.id})")
        print(f"{total} clinics across {len(CLINICS_BY_REGION)} regions: "
              f"{created} created, {updated} updated, {skipped} already present")
        if skipped and not args.update:
            print("Re-run with --update to refresh the ones that already existed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
