CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    role TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
