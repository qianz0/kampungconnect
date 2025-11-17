-- Users table: Supports both OAuth and email/password authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    provider_id VARCHAR(255) UNIQUE, -- NULL for email/password users
    email VARCHAR(255) UNIQUE NOT NULL,
    firstname VARCHAR(255), -- Split name into firstname and lastname for better handling (used all lowercaps for postgres sensitivity issues)
    lastname VARCHAR(255),
    address VARCHAR(500),
    password_hash VARCHAR(255), -- NULL for OAuth users
    picture VARCHAR(500),
    provider VARCHAR(50) NOT NULL DEFAULT 'email', -- email, google, azure
    role VARCHAR(20) CHECK (role IN ('senior', 'volunteer', 'caregiver', 'admin')) DEFAULT NULL, -- Allow NULL for incomplete registrations
    rating DECIMAL(3,2) DEFAULT 5.0, -- average rating out of 5
    location VARCHAR(6), -- postal code
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider_id);

-- Help requests (normal or urgent)
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255), -- NEW
    category VARCHAR(50),
    description TEXT,
    urgency VARCHAR(10) CHECK (urgency IN ('low', 'medium', 'high', 'urgent')) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches (which helper took which request)
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    request_id INT REFERENCES requests(id) ON DELETE CASCADE,
    helper_id INT REFERENCES users(id),
    matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' -- active, completed, cancelled
);

-- Optional: Ratings (so seniors can rate helpers)
CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    match_id INT REFERENCES matches(id) ON DELETE CASCADE,
    rater_id INT REFERENCES users(id),
    ratee_id INT REFERENCES users(id),
    score INT CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    request_id INT REFERENCES requests(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    parent_id INT REFERENCES responses(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  helper_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    request_id INT REFERENCES requests(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- offer, match, response, reply, status_update
    title VARCHAR(255) NOT NULL,
    message TEXT,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_request ON notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read_at);

-- Notification preferences for users
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN DEFAULT TRUE,
    email VARCHAR(255),
    notify_new_responses BOOLEAN DEFAULT TRUE,
    notify_new_offers BOOLEAN DEFAULT TRUE,
    notify_request_updates BOOLEAN DEFAULT TRUE,
    notify_replies BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ========================================
-- SAMPLE DATA INSERTS
-- ========================================

-- Sample Users (mix of seniors, volunteers, caregivers, and admin)
INSERT INTO users (provider_id, email, firstname, lastname, address, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at) VALUES
-- Senior users
(NULL, 'alice.tan@gmail.com', 'Alice', 'Tan', '10 Bedok North Ave 3, #05-123', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 4.8, '460010', TRUE, TRUE, NOW() - INTERVAL '60 days'),
('google_102938475', 'robert.wong@gmail.com', 'Robert', 'Wong', '45 Jurong West Street 42, #12-456', NULL, 'https://lh3.googleusercontent.com/sample1', 'google', 'senior', 4.9, '640045', TRUE, TRUE, NOW() - INTERVAL '45 days'),
(NULL, 'margaret.lim@gmail.com', 'Margaret', 'Lim', '88 Hougang Ave 8, #03-789', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 5.0, '530088', TRUE, TRUE, NOW() - INTERVAL '30 days'),
('azure_aad_12345', 'david.chen@outlook.com', 'David', 'Chen', '22 Woodlands Ring Road, #07-234', NULL, 'https://graph.microsoft.com/sample2', 'azure', 'senior', 4.7, '730022', TRUE, TRUE, NOW() - INTERVAL '20 days'),
(NULL, 'ong.siew.lan@gmail.com', 'Siew Lan', 'Ong', '23 Clementi Ave 4, #07-234', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 4.9, '120023', TRUE, TRUE, NOW() - INTERVAL '55 days'),
('google_888001', 'lee.kim.hock@gmail.com', 'Kim Hock', 'Lee', '77 Pasir Ris Drive 10, #09-654', NULL, 'https://lh3.googleusercontent.com/sample8', 'google', 'senior', 4.7, '510077', TRUE, TRUE, NOW() - INTERVAL '48 days'),
(NULL, 'tan.bee.leng@gmail.com', 'Bee Leng', 'Tan', '14 Bukit Timah Road, #02-432', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 4.8, '259708', TRUE, TRUE, NOW() - INTERVAL '35 days'),
('azure_aad_78901', 'koh.teck.soon@outlook.com', 'Teck Soon', 'Koh', '31 Choa Chu Kang North 6, #10-101', NULL, 'https://graph.microsoft.com/sample9', 'azure', 'senior', 4.6, '689580', TRUE, TRUE, NOW() - INTERVAL '28 days'),
(NULL, 'linda.chua@gmail.com', 'Linda', 'Chua', '4 Yishun Street 81, #11-432', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 5.0, '760004', TRUE, TRUE, NOW() - INTERVAL '22 days'),
('google_888002', 'richard.low@gmail.com', 'Richard', 'Low', '66 Bedok Reservoir View, #03-987', NULL, 'https://lh3.googleusercontent.com/sample10', 'google', 'senior', 4.9, '470066', TRUE, TRUE, NOW() - INTERVAL '18 days'),
(NULL, 'ng.geok.leng@gmail.com', 'Geok Leng', 'Ng', '8 Bukit Merah View, #12-654', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 4.7, '151008', TRUE, TRUE, NOW() - INTERVAL '14 days'),
('azure_aad_78902', 'tang.soon.huat@outlook.com', 'Soon Huat', 'Tang', '17 Serangoon Garden Way', NULL, 'https://graph.microsoft.com/sample11', 'azure', 'senior', 4.8, '555947', TRUE, TRUE, NOW() - INTERVAL '12 days'),
(NULL, 'sandra.goh@gmail.com', 'Sandra', 'Goh', '12 Marine Parade Central, #06-321', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 4.9, '440012', TRUE, TRUE, NOW() - INTERVAL '9 days'),
('google_888003', 'william.tan@gmail.com', 'William', 'Tan', '239 Bukit Batok East Ave 5, #04-210', NULL, 'https://lh3.googleusercontent.com/sample12', 'google', 'senior', 4.6, '650239', TRUE, TRUE, NOW() - INTERVAL '7 days'),

-- Volunteer users
(NULL, 'john.doe@gmail.com', 'John', 'Doe', '15 Orchard Road, #10-100', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'volunteer', 4.9, '238841', TRUE, TRUE, NOW() - INTERVAL '75 days'),
('google_384756291', 'sarah.lee@gmail.com', 'Sarah', 'Lee', '33 Tampines Street 32, #08-567', NULL, 'https://lh3.googleusercontent.com/sample3', 'google', 'volunteer', 5.0, '529033', TRUE, TRUE, NOW() - INTERVAL '50 days'),
(NULL, 'michael.ng@gmail.com', 'Michael', 'Ng', '77 Yishun Ave 5, #14-890', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'volunteer', 4.8, '760077', TRUE, TRUE, NOW() - INTERVAL '40 days'),
(NULL, 'emily.tan@gmail.com', 'Emily', 'Tan', '99 Clementi Ave 2, #06-345', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'volunteer', 4.7, '129899', TRUE, TRUE, NOW() - INTERVAL '25 days'),

-- Caregiver users
(NULL, 'linda.koh@gmail.com', 'Linda', 'Koh', '55 Marine Parade Road, #11-222', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'caregiver', 4.9, '449055', TRUE, TRUE, NOW() - INTERVAL '65 days'),
('azure_aad_67890', 'james.liu@outlook.com', 'James', 'Liu', '12 Bukit Batok Street 21, #09-678', NULL, 'https://graph.microsoft.com/sample4', 'azure', 'caregiver', 5.0, '651012', TRUE, TRUE, NOW() - INTERVAL '35 days'),
(NULL, 'rachel.goh@gmail.com', 'Rachel', 'Goh', '66 Ang Mo Kio Ave 4, #13-444', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'caregiver', 4.8, '560066', TRUE, TRUE, NOW() - INTERVAL '15 days'),

-- New user without role (incomplete registration)
(NULL, 'newbie@gmail.com', 'New', 'User', NULL, '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', NULL, 5.0, NULL, FALSE, FALSE, NOW() - INTERVAL '2 days'),

-- Admin User
(NULL, 'kampungconnectsit@gmail.com', 'System', 'Admin', 'Admin Office', '$2a$12$BcC1Ctbv25OU0/sx7w/30OPPig3i33UXlM8qbH/O5ZWiA0NN1hwkG', NULL, 'email', 'admin', 5.0, NULL, TRUE, TRUE, NOW());

-- Sample Requests from seniors
INSERT INTO requests (user_id, title, category, description, urgency, status, created_at) VALUES
-- Requests from Robert Wong (user_id 2)
(2, 'Help with grocery shopping', 'shopping', 'Need help buying groceries from NTUC. I have a list of about 15 items. Prefer someone who can help this weekend.', 'medium', 'pending', NOW() - INTERVAL '2 days'),
(2, 'Urgent medical appointment transport', 'transport', 'Need transport to SGH for cardiology appointment tomorrow at 2pm. Very urgent.', 'urgent', 'matched', NOW() - INTERVAL '1 day'),

-- Requests from Margaret Lim (user_id 3)
(3, 'Fix leaking tap', 'home_repair', 'My kitchen tap has been leaking for 3 days. Need someone handy to help fix it.', 'high', 'completed', NOW() - INTERVAL '5 days'),
(3, 'Companionship for afternoon walk', 'companionship', 'Looking for someone to accompany me for an afternoon walk at the park. I enjoy chatting about gardening.', 'low', 'pending', NOW() - INTERVAL '1 day'),

-- Requests from David Chen (user_id 4)
(4, 'Help setting up smartphone', 'tech_support', 'Got a new smartphone and need help setting it up and learning how to use WhatsApp and video calls.', 'medium', 'matched', NOW() - INTERVAL '3 days'),
(4, 'Weekly medication organization', 'healthcare', 'Need help organizing my weekly medication into pill boxes every Sunday morning.', 'high', 'pending', NOW() - INTERVAL '6 hours'),

-- Requests from Siew Lan Ong (user_id 5)
(5, 'Cooking assistance', 'meal_prep', 'Would like someone to help me cook simple meals twice a week. I have ingredients but struggle with the cooking process.', 'medium', 'pending', NOW() - INTERVAL '4 days'),
(5, 'Reading newspaper aloud', 'companionship', 'My eyesight is poor. Looking for someone to read the newspaper to me daily for about 30 minutes.', 'low', 'completed', NOW() - INTERVAL '10 days');

-- Sample Matches (linking requests to helpers)
INSERT INTO matches (request_id, helper_id, matched_at, status) VALUES
-- Robert's urgent transport request (request_id 2) matched with volunteer John (user_id 15)
(2, 15, NOW() - INTERVAL '20 hours', 'active'),

-- Margaret's tap repair (request_id 3) completed by caregiver Linda (user_id 19)
(3, 19, NOW() - INTERVAL '4 days', 'completed'),

-- David's smartphone help (request_id 5) matched with volunteer Sarah (user_id 16)
(5, 16, NOW() - INTERVAL '2 days', 'active'),

-- Siew Lan's newspaper reading (request_id 8) completed by volunteer Emily (user_id 18)
(8, 18, NOW() - INTERVAL '9 days', 'completed');

-- Sample Ratings (seniors rating helpers after completed matches)
INSERT INTO ratings (match_id, rater_id, ratee_id, score, comment, created_at) VALUES
-- Margaret (user_id 3) rates Linda (user_id 19) for fixing tap
(2, 3, 19, 5, 'Linda was very professional and fixed the tap quickly. Highly recommend!', NOW() - INTERVAL '4 days'),

-- Siew Lan (user_id 5) rates Emily (user_id 18) for reading newspaper
(4, 5, 18, 5, 'Emily is patient and reads clearly. Very helpful and friendly.', NOW() - INTERVAL '9 days'),

-- Additional historical ratings to build helper reputations
(2, 3, 19, 4, 'Good service but arrived slightly late.', NOW() - INTERVAL '20 days'),
(4, 2, 15, 5, 'John was very helpful and on time!', NOW() - INTERVAL '15 days'),
(4, 4, 16, 5, 'Sarah explained everything clearly and was very patient.', NOW() - INTERVAL '25 days');

-- Sample Responses (comments/questions on requests)
INSERT INTO responses (request_id, user_id, parent_id, message, created_at) VALUES
-- Comments on Robert's grocery shopping request (request_id 1)
(1, 15, NULL, 'Hi Robert! I can help with grocery shopping this Saturday morning if that works for you?', NOW() - INTERVAL '1 day'),
(1, 2, 1, 'That would be perfect! Saturday at 10am?', NOW() - INTERVAL '23 hours'),
(1, 15, 2, 'Yes, 10am works great. See you then!', NOW() - INTERVAL '22 hours'),

-- Comments on Margaret's companionship request (request_id 4)
(4, 16, NULL, 'I love gardening too! Would be happy to join you for a walk. When is convenient?', NOW() - INTERVAL '12 hours'),

-- Comments on David's medication request (request_id 6)
(6, 19, NULL, 'I have experience with medication management. I can come every Sunday at 9am if that helps.', NOW() - INTERVAL '3 hours'),
(6, 20, NULL, 'I am also available and can help with this. I am a trained caregiver.', NOW() - INTERVAL '2 hours'),

-- Comments on Siew Lan's cooking assistance request (request_id 7)
(7, 18, NULL, 'I enjoy cooking and would love to help! What type of meals do you prefer?', NOW() - INTERVAL '3 days'),
(7, 5, 6, 'I like simple Chinese dishes - nothing too spicy. Thanks for offering!', NOW() - INTERVAL '3 days');

-- Sample Offers (helpers offering to help with requests)
INSERT INTO offers (request_id, helper_id, status, created_at) VALUES
-- Offers for Robert's grocery shopping (request_id 1)
(1, 15, 'pending', NOW() - INTERVAL '1 day'),
(1, 17, 'pending', NOW() - INTERVAL '18 hours'),

-- Offers for Margaret's companionship walk (request_id 4)
(4, 16, 'pending', NOW() - INTERVAL '12 hours'),
(4, 18, 'pending', NOW() - INTERVAL '8 hours'),

-- Offers for David's medication organization (request_id 6)
(6, 19, 'pending', NOW() - INTERVAL '3 hours'),
(6, 20, 'pending', NOW() - INTERVAL '2 hours'),

-- Offers for Siew Lan's cooking assistance (request_id 7)
(7, 18, 'accepted', NOW() - INTERVAL '3 days'),
(7, 19, 'declined', NOW() - INTERVAL '3 days'),

-- Historical offers for completed requests
(2, 15, 'accepted', NOW() - INTERVAL '20 hours'),
(3, 19, 'accepted', NOW() - INTERVAL '4 days'),
(5, 16, 'accepted', NOW() - INTERVAL '2 days'),
(8, 18, 'accepted', NOW() - INTERVAL '9 days');

-- ========================================
-- SOCIAL FEATURES TABLES
-- ========================================

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    friend_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);

-- Create indexes for friendships
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    creator_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP NOT NULL,
    location VARCHAR(500),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity participants table
CREATE TABLE IF NOT EXISTS activity_participants (
    id SERIAL PRIMARY KEY,
    activity_id INT REFERENCES activities(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'maybe')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(activity_id, user_id)
);

-- Create indexes for activities
CREATE INDEX IF NOT EXISTS idx_activities_creator ON activities(creator_id);
CREATE INDEX IF NOT EXISTS idx_activities_scheduled ON activities(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activity_participants_activity ON activity_participants(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_user ON activity_participants(user_id);

-- ========================================
-- ADMIN AND MODERATION TABLES
-- ========================================

-- Reports table for user-reported issues
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_id INT REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('abuse', 'spam', 'inappropriate', 'harassment', 'other')),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    admin_notes TEXT,
    action_taken TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Admin actions audit log
CREATE TABLE IF NOT EXISTS admin_actions (
    id SERIAL PRIMARY KEY,
    admin_id INT REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    target_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    target_request_id INT REFERENCES requests(id) ON DELETE SET NULL,
    reason TEXT,
    duration_days INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for reports and admin actions
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user ON admin_actions(target_user_id);