-- Enable Realtime for the calls table
ALTER PUBLICATION supabase_realtime ADD TABLE calls;

-- Verify replication is enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'calls';

