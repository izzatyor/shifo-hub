INSERT INTO public.clinics (id, name, address, phone, subscription_status)
VALUES ('11111111-1111-1111-1111-111111111111', 'Soliha Shifoxonasi', 'Toshkent sh.', '+998 90 000 00 00', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, email, clinic_id)
VALUES ('261daf6e-83aa-43cc-854f-65873ac0f926', 'Bosh administrator', 'admin@soliha.uz', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, clinic_id = EXCLUDED.clinic_id;

INSERT INTO public.user_roles (user_id, clinic_id, role)
VALUES ('261daf6e-83aa-43cc-854f-65873ac0f926', '11111111-1111-1111-1111-111111111111', 'super_admin'),
       ('261daf6e-83aa-43cc-854f-65873ac0f926', '11111111-1111-1111-1111-111111111111', 'admin')
ON CONFLICT DO NOTHING;