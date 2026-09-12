-- Set default deposit to 5,000 MMK
ALTER TABLE orders ALTER COLUMN required_deposit SET DEFAULT '5000';
