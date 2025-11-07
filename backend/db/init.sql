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

CREATE TABLE offers (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  helper_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- SAMPLE DATA INSERTS
-- ========================================

-- Sample Users (mix of seniors, volunteers, caregivers, and admin)
INSERT INTO users (provider_id, email, firstname, lastname, address, password_hash, picture, provider, role, rating, location, email_verified, is_active, created_at) VALUES
-- Senior users
(NULL, 'alice.tan@example.com', 'Alice', 'Tan', '10 Bedok North Ave 3, #05-123', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 4.8, '460010', TRUE, TRUE, NOW() - INTERVAL '60 days'),
('google_102938475', 'robert.wong@gmail.com', 'Robert', 'Wong', '45 Jurong West Street 42, #12-456', NULL, 'https://lh3.googleusercontent.com/sample1', 'google', 'senior', 4.9, '640045', TRUE, TRUE, NOW() - INTERVAL '45 days'),
(NULL, 'margaret.lim@example.com', 'Margaret', 'Lim', '88 Hougang Ave 8, #03-789', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'senior', 5.0, '530088', TRUE, TRUE, NOW() - INTERVAL '30 days'),
('azure_aad_12345', 'david.chen@outlook.com', 'David', 'Chen', '22 Woodlands Ring Road, #07-234', NULL, 'https://graph.microsoft.com/sample2', 'azure', 'senior', 4.7, '730022', TRUE, TRUE, NOW() - INTERVAL '20 days'),

-- Volunteer users
(NULL, 'john.doe@example.com', 'John', 'Doe', '15 Orchard Road, #10-100', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'volunteer', 4.9, '238841', TRUE, TRUE, NOW() - INTERVAL '75 days'),
('google_384756291', 'sarah.lee@gmail.com', 'Sarah', 'Lee', '33 Tampines Street 32, #08-567', NULL, 'https://lh3.googleusercontent.com/sample3', 'google', 'volunteer', 5.0, '529033', TRUE, TRUE, NOW() - INTERVAL '50 days'),
(NULL, 'michael.ng@example.com', 'Michael', 'Ng', '77 Yishun Ave 5, #14-890', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'volunteer', 4.8, '760077', TRUE, TRUE, NOW() - INTERVAL '40 days'),
(NULL, 'emily.tan@example.com', 'Emily', 'Tan', '99 Clementi Ave 2, #06-345', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'volunteer', 4.7, '129899', TRUE, TRUE, NOW() - INTERVAL '25 days'),

-- Caregiver users
(NULL, 'linda.koh@example.com', 'Linda', 'Koh', '55 Marine Parade Road, #11-222', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'caregiver', 4.9, '449055', TRUE, TRUE, NOW() - INTERVAL '65 days'),
('azure_aad_67890', 'james.liu@outlook.com', 'James', 'Liu', '12 Bukit Batok Street 21, #09-678', NULL, 'https://graph.microsoft.com/sample4', 'azure', 'caregiver', 5.0, '651012', TRUE, TRUE, NOW() - INTERVAL '35 days'),
(NULL, 'rachel.goh@example.com', 'Rachel', 'Goh', '66 Ang Mo Kio Ave 4, #13-444', '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', 'caregiver', 4.8, '560066', TRUE, TRUE, NOW() - INTERVAL '15 days'),

-- New user without role (incomplete registration)
(NULL, 'newbie@example.com', 'New', 'User', NULL, '$2b$12$FgW/KkOp9dEhbpoEIYEea.F.8pRsWQeOyZg5GmDuLSf6HVHAhugeu', NULL, 'email', NULL, 5.0, NULL, FALSE, FALSE, NOW() - INTERVAL '2 days');

-- Sample Requests from seniors
INSERT INTO requests (user_id, title, category, description, urgency, status, created_at) VALUES
-- Requests from Alice Tan (user_id 2)
(2, 'Help with grocery shopping', 'shopping', 'Need help buying groceries from NTUC. I have a list of about 15 items. Prefer someone who can help this weekend.', 'medium', 'pending', NOW() - INTERVAL '2 days'),
(2, 'Urgent medical appointment transport', 'transport', 'Need transport to SGH for cardiology appointment tomorrow at 2pm. Very urgent.', 'urgent', 'matched', NOW() - INTERVAL '1 day'),

-- Requests from Robert Wong (user_id 3)
(3, 'Fix leaking tap', 'home_repair', 'My kitchen tap has been leaking for 3 days. Need someone handy to help fix it.', 'high', 'completed', NOW() - INTERVAL '5 days'),
(3, 'Companionship for afternoon walk', 'companionship', 'Looking for someone to accompany me for an afternoon walk at the park. I enjoy chatting about gardening.', 'low', 'pending', NOW() - INTERVAL '1 day'),

-- Requests from Margaret Lim (user_id 4)
(4, 'Help setting up smartphone', 'tech_support', 'Got a new smartphone and need help setting it up and learning how to use WhatsApp and video calls.', 'medium', 'matched', NOW() - INTERVAL '3 days'),
(4, 'Weekly medication organization', 'healthcare', 'Need help organizing my weekly medication into pill boxes every Sunday morning.', 'high', 'pending', NOW() - INTERVAL '6 hours'),

-- Requests from David Chen (user_id 5)
(5, 'Cooking assistance', 'meal_prep', 'Would like someone to help me cook simple meals twice a week. I have ingredients but struggle with the cooking process.', 'medium', 'pending', NOW() - INTERVAL '4 days'),
(5, 'Reading newspaper aloud', 'companionship', 'My eyesight is poor. Looking for someone to read the newspaper to me daily for about 30 minutes.', 'low', 'completed', NOW() - INTERVAL '10 days');

-- Sample Matches (linking requests to helpers)
INSERT INTO matches (request_id, helper_id, matched_at, status) VALUES
-- Alice's urgent transport request matched with volunteer John
(2, 6, NOW() - INTERVAL '20 hours', 'active'),

-- Robert's tap repair completed by caregiver Linda
(3, 10, NOW() - INTERVAL '4 days', 'completed'),

-- Margaret's smartphone help matched with volunteer Sarah
(5, 7, NOW() - INTERVAL '2 days', 'active'),

-- David's newspaper reading completed by volunteer Emily
(8, 9, NOW() - INTERVAL '9 days', 'completed');

-- Sample Ratings (seniors rating helpers after completed matches)
INSERT INTO ratings (match_id, rater_id, ratee_id, score, comment, created_at) VALUES
-- Robert rates Linda for fixing tap
(2, 3, 10, 5, 'Linda was very professional and fixed the tap quickly. Highly recommend!', NOW() - INTERVAL '4 days'),

-- David rates Emily for reading newspaper
(4, 5, 9, 5, 'Emily is patient and reads clearly. Very helpful and friendly.', NOW() - INTERVAL '9 days'),

-- Additional historical ratings to build helper reputations
(2, 3, 10, 4, 'Good service but arrived slightly late.', NOW() - INTERVAL '20 days'),
(4, 2, 6, 5, 'John was very helpful and on time!', NOW() - INTERVAL '15 days'),
(4, 4, 7, 5, 'Sarah explained everything clearly and was very patient.', NOW() - INTERVAL '25 days');

-- Sample Responses (comments/questions on requests)
INSERT INTO responses (request_id, user_id, parent_id, message, created_at) VALUES
-- Comments on Alice's grocery shopping request (request_id 1)
(1, 6, NULL, 'Hi Alice! I can help with grocery shopping this Saturday morning if that works for you?', NOW() - INTERVAL '1 day'),
(1, 2, 1, 'That would be perfect! Saturday at 10am?', NOW() - INTERVAL '23 hours'),
(1, 6, 2, 'Yes, 10am works great. See you then!', NOW() - INTERVAL '22 hours'),

-- Comments on Robert's companionship request (request_id 4)
(4, 7, NULL, 'I love gardening too! Would be happy to join you for a walk. When is convenient?', NOW() - INTERVAL '12 hours'),

-- Comments on Margaret's medication request (request_id 6)
(6, 10, NULL, 'I have experience with medication management. I can come every Sunday at 9am if that helps.', NOW() - INTERVAL '3 hours'),
(6, 11, NULL, 'I am also available and can help with this. I am a trained caregiver.', NOW() - INTERVAL '2 hours'),

-- Comments on David's cooking assistance request (request_id 7)
(7, 9, NULL, 'I enjoy cooking and would love to help! What type of meals do you prefer?', NOW() - INTERVAL '3 days'),
(7, 5, 6, 'I like simple Chinese dishes - nothing too spicy. Thanks for offering!', NOW() - INTERVAL '3 days');

-- Sample Offers (helpers offering to help with requests)
INSERT INTO offers (request_id, helper_id, status, created_at) VALUES
-- Offers for Alice's grocery shopping (request_id 1)
(1, 6, 'pending', NOW() - INTERVAL '1 day'),
(1, 8, 'pending', NOW() - INTERVAL '18 hours'),

-- Offers for Robert's companionship walk (request_id 4)
(4, 7, 'pending', NOW() - INTERVAL '12 hours'),
(4, 9, 'pending', NOW() - INTERVAL '8 hours'),

-- Offers for Margaret's medication organization (request_id 6)
(6, 10, 'pending', NOW() - INTERVAL '3 hours'),
(6, 11, 'pending', NOW() - INTERVAL '2 hours'),

-- Offers for David's cooking assistance (request_id 7)
(7, 9, 'accepted', NOW() - INTERVAL '3 days'),
(7, 10, 'declined', NOW() - INTERVAL '3 days'),

-- Historical offers for completed requests
(2, 6, 'accepted', NOW() - INTERVAL '20 hours'),
(3, 10, 'accepted', NOW() - INTERVAL '4 days'),
(5, 7, 'accepted', NOW() - INTERVAL '2 days'),
(8, 9, 'accepted', NOW() - INTERVAL '9 days');