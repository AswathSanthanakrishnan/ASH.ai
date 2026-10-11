CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE messages ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- Preserve every legacy message in one conversation, including empty installations.
INSERT INTO conversations (id, title, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'Previous conversation',
        COALESCE((SELECT MIN(created_at) FROM messages), NOW()),
        COALESCE((SELECT MAX(created_at) FROM messages), NOW()));
UPDATE messages SET conversation_id = '00000000-0000-4000-8000-000000000001';
ALTER TABLE messages ALTER COLUMN conversation_id SET NOT NULL;
CREATE INDEX messages_conversation_history ON messages (conversation_id, created_at, id);
CREATE INDEX conversations_recent ON conversations (updated_at DESC, id);
