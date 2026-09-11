# Soliha Health Suite

Create a modern, premium multi-tenant medical clinic management system called "Soliha Shifoxonasi" (in Uzbek language).

This is a SaaS platform serving multiple clinics — each clinic has its own data, isolated from others.

Design style: Modern healthcare SaaS — think Linear, Notion, or modern fintech apps adapted for medical use. Use a sophisticated teal/emerald color palette combined with clean whites, soft shadows, rounded corners (12-16px), generous whitespace, modern sans-serif typography (Inter or similar). Avoid generic dark-mode-only or overly simple designs — this should feel premium and trustworthy.

Start with the login page:

- Split-screen layout: left side shows an elegant medical-themed illustration/gradient, right side has the login form

- Logo: "Soliha Shifoxonasi" with a medical icon

- Login form: Email field, Password field with show/hide toggle

- Role badges shown: Admin, Doktor, Qabul, Kassa, Rahbar

- All text and labels in Uzbek language

Data model requirements (Supabase):

1. A "clinics" table (id, name, address, phone, subscription_status, created_at)

2. All other tables (patients/bemorlar, rooms/palatalar, doctors/shifokorlar, payments/tolovlar, users/foydalanuvchilar, notes/izohlar) must include a "clinic_id" foreign key

3. Row Level Security so each clinic only sees its own data

4. A super-admin role that sees all clinics

Please build this step by step, starting with the login page design first, then the database schema.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3b79c6e8-95fe-4542-9021-b18a57a63d3c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
