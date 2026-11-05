-- Optional sample data for testing. Run after schema.sql.
insert into public.tasks (title, description, priority, status, assigned_to) values
  ('Prepare monthly field report', 'Compile outputs and outcomes from all branch offices.', 'high', 'in_progress', 'Nusrat Jahan'),
  ('Update participant training schedule', 'Confirm venues and facilitators for next quarter.', 'medium', 'pending', 'Rafiq Ahmed'),
  ('Review partner MoU draft', null, 'high', 'pending', 'Tahmina Akter'),
  ('Archive Q2 survey data', 'Move cleaned datasets to the shared drive.', 'low', 'completed', 'Sabbir Hasan'),
  ('Set up onboarding checklist', 'Checklist for new programme staff.', 'medium', 'completed', 'Farzana Islam'),
  ('Coordinate health camp logistics', 'Transport, supplies and volunteer roster.', 'high', 'in_progress', 'Nusrat Jahan');
