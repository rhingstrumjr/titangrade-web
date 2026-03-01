-- Add auto_send_emails to assignments (default true for backwards compatibility)
ALTER TABLE assignments ADD COLUMN auto_send_emails BOOLEAN DEFAULT true;

-- Add email_sent to submissions (default false)
ALTER TABLE submissions ADD COLUMN email_sent BOOLEAN DEFAULT false;

-- For existing graded submissions, assume emails were sent to keep things clean
UPDATE submissions SET email_sent = true WHERE status = 'graded';
