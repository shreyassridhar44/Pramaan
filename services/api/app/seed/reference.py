"""Reference data for the synthetic portfolio.

Regional offices are AICTE's (public information). States are grouped under them approximately; the
grouping is good enough for synthetic data and is labelled as such. Banks are fictional: no real
bank names are used anywhere in Pramaan's synthetic data (DATA_SOURCES.md 2.2).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class RegionRef:
    code: str
    name: str
    office_city: str
    lat: float
    lng: float
    camp: bool
    states: dict[str, tuple[float, tuple[str, ...]]]  # state -> (weight, cities)


REGIONS: tuple[RegionRef, ...] = (
    RegionRef(
        "western",
        "Western Region",
        "Mumbai",
        19.0760,
        72.8777,
        False,
        {
            "Maharashtra": (
                14,
                ("Pune", "Mumbai", "Nagpur", "Nashik", "Aurangabad", "Kolhapur", "Solapur"),
            ),
            "Goa": (0.5, ("Panaji", "Margao")),
        },
    ),
    RegionRef(
        "central",
        "Central Region",
        "Bhopal",
        23.2599,
        77.4126,
        False,
        {
            "Madhya Pradesh": (5, ("Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain")),
            "Chhattisgarh": (2, ("Raipur", "Bilaspur", "Durg")),
        },
    ),
    RegionRef(
        "northern",
        "Northern Region",
        "Kanpur",
        26.4499,
        80.3319,
        False,
        {
            "Uttar Pradesh": (
                10,
                ("Lucknow", "Kanpur", "Noida", "Agra", "Varanasi", "Prayagraj", "Meerut"),
            ),
            "Uttarakhand": (1.5, ("Dehradun", "Haridwar", "Roorkee")),
            "Bihar": (2, ("Patna", "Gaya", "Muzaffarpur")),
        },
    ),
    RegionRef(
        "north_western",
        "North-Western Region",
        "Chandigarh",
        30.7333,
        76.7794,
        False,
        {
            "Punjab": (3, ("Mohali", "Ludhiana", "Jalandhar", "Amritsar", "Patiala")),
            "Haryana": (4, ("Gurugram", "Faridabad", "Kurukshetra", "Sonipat", "Hisar")),
            "Rajasthan": (4, ("Jaipur", "Jodhpur", "Kota", "Udaipur", "Bikaner")),
            "Delhi": (1.5, ("New Delhi",)),
            "Himachal Pradesh": (0.7, ("Shimla", "Solan", "Hamirpur")),
            "Jammu and Kashmir": (0.7, ("Jammu", "Srinagar")),
        },
    ),
    RegionRef(
        "eastern",
        "Eastern Region",
        "Kolkata",
        22.5726,
        88.3639,
        False,
        {
            "West Bengal": (3, ("Kolkata", "Durgapur", "Siliguri", "Howrah")),
            "Odisha": (3, ("Bhubaneswar", "Cuttack", "Rourkela", "Berhampur")),
            "Jharkhand": (1.5, ("Ranchi", "Jamshedpur", "Dhanbad")),
        },
    ),
    RegionRef(
        "south_central",
        "South-Central Region",
        "Hyderabad",
        17.3850,
        78.4867,
        False,
        {
            "Telangana": (8, ("Hyderabad", "Warangal", "Karimnagar", "Khammam")),
            "Andhra Pradesh": (
                9,
                ("Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore", "Kakinada"),
            ),
        },
    ),
    RegionRef(
        "southern",
        "Southern Region",
        "Chennai",
        13.0827,
        80.2707,
        False,
        {
            "Tamil Nadu": (
                14,
                (
                    "Chennai",
                    "Coimbatore",
                    "Madurai",
                    "Tiruchirappalli",
                    "Salem",
                    "Erode",
                    "Tirunelveli",
                ),
            ),
            "Puducherry": (0.5, ("Puducherry",)),
        },
    ),
    RegionRef(
        "south_western",
        "South-Western Region",
        "Bengaluru",
        12.9716,
        77.5946,
        False,
        {
            "Karnataka": (
                8,
                ("Bengaluru", "Mysuru", "Mangaluru", "Belagavi", "Hubballi", "Davanagere"),
            ),
        },
    ),
    RegionRef(
        "north_east",
        "North-East (camp office)",
        "Guwahati",
        26.1445,
        91.7362,
        True,
        {
            "Assam": (0.8, ("Guwahati", "Jorhat", "Silchar")),
            "Meghalaya": (0.2, ("Shillong",)),
            "Tripura": (0.2, ("Agartala",)),
            "Manipur": (0.15, ("Imphal",)),
        },
    ),
    RegionRef(
        "kerala",
        "Kerala (camp office)",
        "Thiruvananthapuram",
        8.5241,
        76.9366,
        True,
        {
            "Kerala": (4, ("Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam")),
        },
    ),
    RegionRef(
        "gujarat",
        "Gujarat (camp office)",
        "Vadodara",
        22.3072,
        73.1812,
        True,
        {
            "Gujarat": (5, ("Ahmedabad", "Vadodara", "Surat", "Rajkot", "Gandhinagar")),
        },
    ),
)


@dataclass(frozen=True)
class BankRef:
    code: str
    name: str
    hq_city: str
    integration: str  # "network": answers automatically; "desk": a bank officer answers in the desk


BANKS: tuple[BankRef, ...] = (
    BankRef("BHNX", "Bharat National Bank", "Mumbai", "desk"),
    BankRef("DCCX", "Deccan Cooperative Bank", "Pune", "network"),
    BankRef("SAHX", "Sahyadri Bank", "Kolhapur", "network"),
    BankRef("GGBX", "Ganga Gramin Bank", "Lucknow", "network"),
    BankRef("VCBX", "Vindhya Commercial Bank", "Bhopal", "network"),
    BankRef("KMBX", "Konkan Mercantile Bank", "Ratnagiri", "network"),
    BankRef("NARX", "Narmada Bank", "Vadodara", "network"),
    BankRef("MFBX", "Malabar Federal Bank", "Kochi", "network"),
    BankRef("HUBX", "Himalayan Union Bank", "Chandigarh", "network"),
    BankRef("KTBX", "Kaveri Trust Bank", "Chennai", "network"),
    BankRef("ARVX", "Aravalli Bank", "Jaipur", "network"),
    BankRef("BRPX", "Brahmaputra Bank", "Guwahati", "network"),
)

NAME_PREFIXES = (
    "Sahyadri",
    "Vindhya",
    "Kaveri",
    "Narmada",
    "Aravalli",
    "Godavari",
    "Tapti",
    "Mahanadi",
    "Shivalik",
    "Nilgiri",
    "Satpura",
    "Konkan",
    "Malwa",
    "Deccan",
    "Vidarbha",
    "Doaba",
    "Kosi",
    "Tungabhadra",
    "Krishna Valley",
    "Pragati",
    "Unnati",
    "Gyanodaya",
    "Vidyadeep",
    "Prerana",
    "Navjyoti",
    "Sanskriti",
    "Abhyudaya",
    "Samarth",
    "Udaan",
    "Akshara",
    "Saraswati Vihar",
    "Sri Sai Vidya",
    "Lokmanya",
    "Rajarshi",
    "Annapurna",
    "Chinmaya Vidya",
    "Jnana Deepa",
    "Amrita Vidya",
    "Mahatma Phule",
    "Sant Gadge",
    "Swami Vivekananda",
    "Bhagirathi",
    "Yamuna",
    "Kalinga",
    "Vijaynagar",
    "Kakatiya",
    "Chola",
    "Hoysala",
    "Rashtrakuta",
    "Satavahana",
)

INSTITUTION_TYPES: tuple[tuple[str, float, tuple[tuple[str, str, float], ...]], ...] = (
    # (type label, weight, programmes as (discipline, level, probability))
    (
        "College of Engineering",
        34,
        (
            ("engineering_technology", "ug", 1.0),
            ("engineering_technology", "pg", 0.5),
            ("engineering_technology", "diploma", 0.15),
        ),
    ),
    (
        "Institute of Technology",
        18,
        (
            ("engineering_technology", "ug", 1.0),
            ("engineering_technology", "pg", 0.6),
            ("management", "pg", 0.3),
        ),
    ),
    ("Polytechnic", 12, (("engineering_technology", "diploma", 1.0),)),
    ("Institute of Management", 16, (("management", "pg", 1.0), ("management", "ug", 0.3))),
    (
        "Institute of Computer Applications",
        7,
        (("computer_applications", "pg", 1.0), ("computer_applications", "ug", 0.5)),
    ),
    ("School of Architecture and Planning", 4, (("planning", "ug", 1.0), ("planning", "pg", 0.4))),
    ("Institute of Design", 4, (("design", "ug", 1.0), ("design", "pg", 0.4))),
    ("Institute of Hotel Management", 5, (("hmct", "ug", 1.0), ("hmct", "diploma", 0.4))),
)

TRUST_PATTERNS = (
    "{p} Education Society",
    "{p} Educational Trust",
    "{p} Vidya Prasarak Mandal",
    "{p} Shikshan Sanstha",
    "{p} Foundation for Learning",
)

FIRST_NAMES = (
    "Aarav",
    "Vivaan",
    "Aditya",
    "Ishaan",
    "Rohan",
    "Kavya",
    "Ananya",
    "Diya",
    "Meera",
    "Sneha",
    "Rahul",
    "Pooja",
    "Arjun",
    "Nikhil",
    "Priya",
    "Neha",
    "Suresh",
    "Lakshmi",
    "Farhan",
    "Zoya",
    "Gurpreet",
    "Harleen",
    "Joseph",
    "Mary",
    "Biswajit",
    "Debasree",
    "Karthik",
    "Divya",
    "Imran",
    "Ayesha",
)
SURNAMES = (
    "Sharma",
    "Verma",
    "Iyer",
    "Nair",
    "Reddy",
    "Rao",
    "Patil",
    "Deshmukh",
    "Kulkarni",
    "Joshi",
    "Gupta",
    "Singh",
    "Kaur",
    "Das",
    "Banerjee",
    "Mukherjee",
    "Pillai",
    "Menon",
    "Khan",
    "Qureshi",
    "Fernandes",
    "D'Souza",
    "Hegde",
    "Shetty",
    "Naidu",
    "Choudhary",
    "Mishra",
    "Tiwari",
    "Sinha",
    "Bhat",
)
