# Backend setup

See the project root README for the complete setup. Configure MongoDB, a 32-character JWT secret, administrator credentials and SMTP credentials in `.env`, then run `npm install`, `npm run create-admin`, and `npm run dev`.

Uploaded image and PDF files are saved under `backend/uploads`; production hosting must provide persistent storage for that directory.
