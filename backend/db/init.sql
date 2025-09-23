-- Users table: seniors + helpers in one place
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('senior', 'helper')) DEFAULT 'senior',
    rating DECIMAL(3,2) DEFAULT 5.0, -- average rating out of 5
    location VARCHAR(100), -- can be a postal code or simple text area
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Help requests (normal or urgent)
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50), -- e.g. groceries, chores, companionship
    type VARCHAR(10) CHECK (type IN ('normal', 'urgent')) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, matched, completed
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
