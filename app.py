import os
import json
import uuid
from datetime import datetime
from flask import Flask, jsonify, request, abort
from flask_cors import CORS

# --- App Setup ---
app = Flask(__name__)
# Allow requests from your frontend development server (http://localhost:8000)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})

# --- Database Setup ---
DATABASE_FILE = 'database.json'

def get_default_data():
    """Generates the initial default data for the database."""
    default_admin_id = f"admin_{int(datetime.now().timestamp())}"
    return {
        "items": [
            { "id": 'item_1622548800000', "name": 'Beaker 250ml', "category": 'Chemistry', "totalQuantity": 20, "availableQuantity": 18 },
            { "id": 'item_1622548800001', "name": 'Test Tube Rack', "category": 'Chemistry', "totalQuantity": 15, "availableQuantity": 15 },
            { "id": 'item_1622548800002', "name": 'Microscope', "category": 'Biology', "totalQuantity": 5, "availableQuantity": 3 },
            { "id": 'item_1622548800003', "name": 'Sulfuric Acid (H2SO4)', "category": 'Chemistry', "totalQuantity": 10, "availableQuantity": 10 },
        ],
        "users": [
            {
                "id": default_admin_id, "username": 'admin', "fullName": 'Admin User', "email": 'admin@olilab.app',
                "password": 'password', "lrn": '', "gradeLevel": None, "section": None,
                "role": 'Admin', "isAdmin": True, "status": 'APPROVED',
            }
        ],
        "logs": [
             { "id": 'log_1622548800002', "userId": default_admin_id, "itemId": 'item_1622548800002', "quantity": 2, "timestamp": datetime.fromtimestamp(datetime.now().timestamp() - 86400).isoformat(), "action": 'BORROW', "status": 'APPROVED', "returnRequested": False },
             { "id": 'log_1622548800003', "userId": default_admin_id, "itemId": 'item_1622548800000', "quantity": 2, "timestamp": datetime.fromtimestamp(datetime.now().timestamp() - 172800).isoformat(), "action": 'BORROW', "status": 'APPROVED', "returnRequested": True },
        ],
        "notifications": [],
        "suggestions": [],
        "comments": [],
    }

def load_data():
    """Loads data from the JSON file. Creates the file with default data if it doesn't exist."""
    if not os.path.exists(DATABASE_FILE):
        with open(DATABASE_FILE, 'w') as f:
            json.dump(get_default_data(), f, indent=4)
    with open(DATABASE_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    """Saves the given data to the JSON file."""
    with open(DATABASE_FILE, 'w') as f:
        json.dump(data, f, indent=4)

# --- Helper Functions ---
def generate_id(prefix):
    """Generates a unique ID with a given prefix."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def has_outstanding_loans(user_id, logs):
    """Checks if a user has any items currently on loan."""
    return any(
        log['userId'] == user_id and log['action'] == 'BORROW' and log['status'] == 'APPROVED'
        for log in logs
    )

# --- API Endpoints ---

@app.route('/api/data', methods=['GET'])
def get_initial_data():
    """Endpoint to get all initial data for the app."""
    return jsonify(load_data())

# --- Items ---
@app.route('/api/items', methods=['POST'])
def add_item():
    data = load_data()
    item_data = request.json
    new_item = {
        "id": generate_id('item'),
        "name": item_data['name'],
        "category": item_data['category'],
        "totalQuantity": int(item_data['totalQuantity']),
        "availableQuantity": int(item_data['totalQuantity'])
    }
    data['items'].append(new_item)
    save_data(data)
    return jsonify(new_item), 201

@app.route('/api/items/<item_id>', methods=['PUT'])
def edit_item(item_id):
    data = load_data()
    updated_data = request.json
    item_index = next((i for i, item in enumerate(data['items']) if item['id'] == item_id), None)
    if item_index is None:
        abort(404, description="Item not found")
    
    data['items'][item_index] = updated_data
    save_data(data)
    return jsonify(updated_data)

@app.route('/api/items/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    data = load_data()
    if any(log['itemId'] == item_id and log['action'] == 'BORROW' and log['status'] == 'APPROVED' for log in data['logs']):
        abort(400, description="Cannot delete item with outstanding loans.")
    
    data['items'] = [item for item in data['items'] if item['id'] != item_id]
    save_data(data)
    return jsonify({"id": item_id})

@app.route('/api/items/import', methods=['POST'])
def import_items():
    data = load_data()
    items_to_import = request.json
    new_items = []
    for item_data in items_to_import:
        new_item = {
            "id": generate_id('item'),
            "name": item_data['name'],
            "category": item_data['category'],
            "totalQuantity": int(item_data['totalQuantity']),
            "availableQuantity": int(item_data['totalQuantity'])
        }
        data['items'].append(new_item)
        new_items.append(new_item)
    save_data(data)
    return jsonify(new_items), 201

# --- Users ---
@app.route('/api/users', methods=['POST'])
def create_user():
    data = load_data()
    user_data = request.json
    
    # Basic validation
    if any(u['username'].lower() == user_data['username'].lower() for u in data['users']):
        abort(400, description="Username is already taken.")
    if any(u['email'].lower() == user_data['email'].lower() for u in data['users']):
        abort(400, description="Email is already registered.")
    if user_data.get('lrn') and any(u.get('lrn') == user_data['lrn'] for u in data['users']):
        abort(400, description="LRN is already registered.")

    new_user = {
        "id": generate_id('user'),
        "status": "PENDING",
        **user_data
    }
    data['users'].append(new_user)
    
    # Create notification for admins
    new_notification = {
        "id": generate_id('notif'),
        "message": f"New user '{new_user['fullName']}' has registered and is awaiting approval.",
        "type": "new_user", "read": False, "timestamp": datetime.now().isoformat()
    }
    data['notifications'].append(new_notification)
    
    save_data(data)
    return jsonify({"newUser": new_user, "newNotification": new_notification}), 201

@app.route('/api/users/<user_id>', methods=['PUT'])
def edit_user(user_id):
    data = load_data()
    updated_data = request.json
    user_index = next((i for i, user in enumerate(data['users']) if user['id'] == user_id), None)
    if user_index is None:
        abort(404, description="User not found")
    
    data['users'][user_index] = updated_data
    save_data(data)
    return jsonify(updated_data)

@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    data = load_data()
    user_to_delete = next((u for u in data['users'] if u['id'] == user_id), None)
    if not user_to_delete:
        abort(404, description="User not found")

    if has_outstanding_loans(user_id, data['logs']):
        abort(400, description="Cannot delete user with outstanding borrowed items.")
    
    if user_to_delete.get('isAdmin'):
        admin_count = sum(1 for u in data['users'] if u.get('isAdmin') and u['status'] == 'APPROVED')
        if admin_count <= 1:
            abort(400, description="Cannot delete the last admin account.")

    data['users'] = [user for user in data['users'] if user['id'] != user_id]
    save_data(data)
    return jsonify({"id": user_id})

@app.route('/api/users/<user_id>/approve', methods=['POST'])
def approve_user(user_id):
    data = load_data()
    user = next((u for u in data['users'] if u['id'] == user_id), None)
    if not user:
        abort(404, description="User not found")
    user['status'] = 'APPROVED'
    save_data(data)
    return jsonify(user)

@app.route('/api/users/<user_id>/deny', methods=['POST'])
def deny_user(user_id):
    data = load_data()
    user = next((u for u in data['users'] if u['id'] == user_id), None)
    if not user:
        abort(404, description="User not found")
    user['status'] = 'DENIED'
    save_data(data)
    return jsonify(user)

# --- Logs / Borrowing ---
@app.route('/api/logs/borrow', methods=['POST'])
def request_borrow_item():
    data = load_data()
    payload = request.json
    item = next((i for i in data['items'] if i['id'] == payload['itemId']), None)

    if not item or int(payload['quantity']) > item['availableQuantity']:
        abort(400, description="Item not available or insufficient quantity.")

    new_log = {
        "id": generate_id('log'), "userId": payload['userId'], "itemId": payload['itemId'],
        "quantity": int(payload['quantity']), "timestamp": datetime.now().isoformat(),
        "action": "BORROW", "status": "PENDING", "returnRequested": False
    }
    data['logs'].append(new_log)
    
    new_notification = {
        "id": generate_id('notif'),
        "message": f"New borrow request for {item['name']}.",
        "type": "new_borrow_request", "read": False, "timestamp": datetime.now().isoformat(),
        "relatedLogId": new_log['id']
    }
    data['notifications'].append(new_notification)
    
    save_data(data)
    return jsonify({"newLog": new_log, "newNotification": new_notification}), 201

@app.route('/api/logs/<log_id>/approve', methods=['POST'])
def approve_borrow(log_id):
    data = load_data()
    log = next((l for l in data['logs'] if l['id'] == log_id), None)
    if not log:
        abort(404, description="Log entry not found")

    item = next((i for i in data['items'] if i['id'] == log['itemId']), None)
    if not item or log['quantity'] > item['availableQuantity']:
        abort(400, description="Item no longer available in the requested quantity.")

    log['status'] = 'APPROVED'
    item['availableQuantity'] -= log['quantity']
    
    save_data(data)
    return jsonify({"updatedLog": log, "updatedItem": item})

@app.route('/api/logs/<log_id>/deny', methods=['POST'])
def deny_borrow(log_id):
    data = load_data()
    payload = request.json
    log = next((l for l in data['logs'] if l['id'] == log_id), None)
    if not log:
        abort(404, description="Log entry not found")
        
    log['status'] = 'DENIED'
    log['adminNotes'] = payload['reason']
    save_data(data)
    return jsonify(log)

@app.route('/api/logs/<log_id>/request-return', methods=['POST'])
def request_return(log_id):
    data = load_data()
    log = next((l for l in data['logs'] if l['id'] == log_id), None)
    if not log:
        abort(404, description="Log entry not found")
        
    log['returnRequested'] = True
    
    item = next((i for i in data['items'] if i['id'] == log['itemId']), None)
    new_notification = {
        "id": generate_id('notif'),
        "message": f"A user has requested to return {item['name'] if item else 'an item'}.",
        "type": "return_request", "read": False, "timestamp": datetime.now().isoformat(),
        "relatedLogId": log['id']
    }
    data['notifications'].append(new_notification)

    save_data(data)
    return jsonify({"updatedLog": log, "newNotification": new_notification})

@app.route('/api/logs/return', methods=['POST'])
def return_item():
    data = load_data()
    payload = request.json
    borrow_log_data = payload['borrowLog']
    
    # Find original borrow log and update it
    borrow_log = next((l for l in data['logs'] if l['id'] == borrow_log_data['id']), None)
    if not borrow_log:
        abort(404, description="Original borrow record not found.")

    borrow_log['status'] = 'RETURNED'
    borrow_log['returnRequested'] = False # Reset flag

    # Create a new RETURN log entry
    return_log = {
        "id": generate_id('log'), "userId": borrow_log['userId'], "itemId": borrow_log['itemId'],
        "quantity": borrow_log['quantity'], "timestamp": datetime.now().isoformat(),
        "action": "RETURN", "status": "RETURNED", "adminNotes": payload['adminNotes'],
        "relatedLogId": borrow_log['id']
    }
    data['logs'].append(return_log)
    
    # Update item quantity
    item = next((i for i in data['items'] if i['id'] == borrow_log['itemId']), None)
    if item:
        item['availableQuantity'] += borrow_log['quantity']
        if item['availableQuantity'] > item['totalQuantity']:
            item['availableQuantity'] = item['totalQuantity'] # Cap at total
    
    save_data(data)
    return jsonify({
        "returnLog": return_log,
        "updatedBorrowLog": borrow_log,
        "updatedItem": item
    })

# --- Suggestions & Comments ---
@app.route('/api/suggestions', methods=['POST'])
def add_suggestion():
    data = load_data()
    suggestion_data = request.json
    new_suggestion = {
        "id": generate_id('sugg'), "status": "PENDING", "timestamp": datetime.now().isoformat(),
        **suggestion_data
    }
    data['suggestions'].append(new_suggestion)
    save_data(data)
    return jsonify(new_suggestion), 201

@app.route('/api/suggestions/<suggestion_id>/approve-item', methods=['POST'])
def approve_item_suggestion(suggestion_id):
    data = load_data()
    payload = request.json
    suggestion = next((s for s in data['suggestions'] if s['id'] == suggestion_id), None)
    if not suggestion:
        abort(404, description="Suggestion not found")

    suggestion['status'] = 'APPROVED'
    suggestion['category'] = payload['category']
    
    # Create the new item
    new_item = {
        "id": generate_id('item'), "name": suggestion['title'], "category": payload['category'],
        "totalQuantity": int(payload['totalQuantity']), "availableQuantity": int(payload['totalQuantity'])
    }
    data['items'].append(new_item)
    
    save_data(data)
    return jsonify({"updatedSuggestion": suggestion, "newItem": new_item})

@app.route('/api/suggestions/<suggestion_id>/approve-feature', methods=['POST'])
def approve_feature_suggestion(suggestion_id):
    data = load_data()
    suggestion = next((s for s in data['suggestions'] if s['id'] == suggestion_id), None)
    if not suggestion:
        abort(404, description="Suggestion not found")
        
    suggestion['status'] = 'APPROVED'
    save_data(data)
    return jsonify(suggestion)

@app.route('/api/suggestions/<suggestion_id>/deny', methods=['POST'])
def deny_suggestion(suggestion_id):
    data = load_data()
    payload = request.json
    suggestion = next((s for s in data['suggestions'] if s['id'] == suggestion_id), None)
    if not suggestion:
        abort(404, description="Suggestion not found")
        
    suggestion['status'] = 'DENIED'
    
    # Add denial reason as a comment
    new_comment = {
        "id": generate_id('comm'), "suggestionId": suggestion_id, "userId": payload['adminId'],
        "text": f"Admin Note (Denied): {payload['reason']}", "timestamp": datetime.now().isoformat()
    }
    data['comments'].append(new_comment)
    
    save_data(data)
    return jsonify({"updatedSuggestion": suggestion, "newComment": new_comment})

@app.route('/api/comments', methods=['POST'])
def add_comment():
    data = load_data()
    comment_data = request.json
    new_comment = {
        "id": generate_id('comm'), "timestamp": datetime.now().isoformat(),
        **comment_data
    }
    data['comments'].append(new_comment)
    save_data(data)
    return jsonify(new_comment), 201

# --- Main Execution ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)
