# KampungConnect Social Features Update

## Summary of Changes

### 1. Backend Social Service (NEW)
Created a new microservice at `backend/services/social-service/` with the following capabilities:

#### Friends Management
- Send friend requests
- Accept/reject friend requests
- View friends list
- Remove friends
- View pending requests

#### Messaging System
- Send messages to other users
- View conversation history
- Mark messages as read
- Get unread message count
- Conversation-based message organization

#### Activity Planning
- Create activities with invitations
- Schedule activities with date/time/location
- Accept/decline activity invitations
- View upcoming and past activities
- Track participant responses

### 2. Database Schema Updates
Added three new tables to `backend/db/init.sql`:
- `friendships` - Tracks friend relationships and requests
- `messages` - Stores all messages between users
- `activities` - Stores planned activities
- `activity_participants` - Tracks who's invited/accepted activities

### 3. Frontend Updates - khakis.html

#### Senior-Friendly Design
- **Larger buttons and text** (increased font sizes by 15-30%)
- **Bigger touch targets** (45px circular add friend button)
- **Increased spacing** between elements
- **Larger avatar images** (100px instead of 80px)
- **Enhanced visual hierarchy** with better contrast

#### Add Friend Button
- Positioned at **top-right corner** of each senior card
- Prominent circular button with green color
- Always visible and easy to tap
- Icon-based for clarity

#### Pagination System
- **6 cards per page** for better readability
- Large, easy-to-click pagination controls
- Page numbers clearly displayed
- Previous/Next buttons with icons
- Smooth scroll to top when changing pages
- Pagination maintained separately for each tab

#### Working Features
All three social features are now fully functional:

1. **Chat/Messaging**
   - Click "Chat" button opens prompt to send message
   - Messages saved to database
   - Immediate feedback on success/failure

2. **Add Friend**
   - Top-right button on each card
   - Also available as separate action button
   - Confirmation dialog before sending
   - Friend request stored in database

3. **Plan Activity**
   - Opens multi-step prompts:
     - Activity title
     - Description (optional)
     - Date and time
     - Location (optional)
   - Creates activity with invitation
   - Stored in database with all details

### 4. Frontend Updates - khaki-profile.html

#### Enhanced Layout
- Larger profile avatar (180px)
- Bigger buttons (1.15rem font, 14px padding)
- Better spacing in profile sections
- Improved readability with larger fonts

#### Working Social Features
All three buttons in the profile now work:
- **Send Message** - Opens prompt to compose message
- **Add Friend** - Sends friend request with confirmation
- **Schedule Activity** - Multi-step activity planning wizard

### 5. Configuration Updates

#### config.js
Added social service endpoint:
```javascript
SOCIAL_SERVICE: "http://localhost:5008"
```

#### Kubernetes Deployment
- Created `k8s/services/social-service.yaml`
- Updated `build-all.bat` to build social service image
- Updated `port-forward.ps1` to forward port 5008

### 6. API Endpoints Available

#### Friends API (Port 5008)
- `GET /friends` - Get user's friends list
- `GET /friends/requests` - Get pending friend requests
- `POST /friends/request` - Send friend request
- `POST /friends/accept/:requestId` - Accept friend request
- `POST /friends/reject/:requestId` - Reject friend request
- `DELETE /friends/:friendId` - Remove friend

#### Messages API (Port 5008)
- `GET /messages/conversations` - Get all conversations
- `GET /messages/:otherUserId` - Get messages with specific user
- `POST /messages` - Send a message
- `GET /messages/unread/count` - Get unread message count

#### Activities API (Port 5008)
- `GET /activities` - Get user's activities (with status filter)
- `POST /activities` - Create new activity
- `POST /activities/:activityId/respond` - Accept/decline activity

## How to Deploy

### 1. Build the new service:
```cmd
docker build -t kampungconnect-social-service -f backend/services/social-service/Dockerfile .
```

Or use the updated build-all script:
```cmd
build-all.bat
```

### 2. Deploy to Kubernetes:
```cmd
deploy-to-kuber.bat
```

### 3. Start port forwarding:
```powershell
.\port-forward.ps1
```

The social service will be available at: http://localhost:5008

## Testing the Features

1. **View Khakis Page**: Navigate to http://localhost:8080/khakis.html
2. **Add Friend**: Click the green circular button at top-right of any khaki card
3. **Send Message**: Click "Chat" button on any khaki card
4. **Plan Activity**: Click "Plan" button and follow the prompts
5. **View Profile**: Click "View Profile" for detailed view with all social features

## Senior-Friendly Features

✅ Large, readable text (1.05-1.2rem base sizes)
✅ High contrast colors
✅ Clear visual hierarchy
✅ Large touch targets (45px+ for buttons)
✅ Prominent "Add Friend" button placement
✅ Pagination with only 6 items per page
✅ Large, easy-to-click pagination controls
✅ Clear status messages for all actions
✅ Confirmation dialogs before important actions

## Future Enhancements

Consider adding:
- Real-time messaging with WebSockets
- Push notifications for friend requests
- Activity calendar view
- Photo sharing in messages
- Group activities with multiple participants
- Activity reminders and notifications
