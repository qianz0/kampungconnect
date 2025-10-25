-- Users table: Supports both OAuth and email/password authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    provider_id VARCHAR(255) UNIQUE, -- NULL for email/password users
    email VARCHAR(255) UNIQUE NOT NULL,
    firstName VARCHAR(255), -- Split name into firstName and lastName for better handling
    lastName VARCHAR(255),
    password_hash VARCHAR(255), -- NULL for OAuth users
    picture VARCHAR(500),
    provider VARCHAR(50) NOT NULL DEFAULT 'email', -- email, google, azure
    role VARCHAR(20) CHECK (role IN ('senior', 'volunteer', 'caregiver', 'admin')) DEFAULT NULL, -- Allow NULL for incomplete registrations
    rating DECIMAL(3,2) DEFAULT 5.0, -- average rating out of 5
    location VARCHAR(100), -- can be a postal code or simple text area
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
