# Phase 1 Setup Checklist

## Before Running the Project

### Accounts & Services
- [ ] Neon PostgreSQL account created (console.neon.tech)
- [ ] Clerk account created (dashboard.clerk.com)
- [ ] Mobimatter sandbox API key obtained
- [ ] Mobimatter merchant ID obtained

### Environment Setup
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill all values in `.env.local`:
  - [ ] `DATABASE_URL` (from Neon)
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (from Clerk)
  - [ ] `CLERK_SECRET_KEY` (from Clerk)
  - [ ] `MOBIMATTER_API_KEY` (sandbox)
  - [ ] `MOBIMATTER_MERCHANT_ID`
  - [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3000`

### Database
- [ ] Neon database created and accessible
- [ ] Schema migration run: `psql $DATABASE_URL -f schema.sql`
- [ ] Tables created successfully (check in Neon console)

### Dependencies
- [ ] Node.js 18+ installed (`node --version`)
- [ ] `npm install` completed without errors
- [ ] Check `node_modules/` folder exists

### Clerk Configuration
- [ ] Sign-in provider configured (email/password or OAuth)
- [ ] Redirect URIs set:
  - [ ] `http://localhost:3000/admin/signin`
  - [ ] `http://localhost:3000/admin/dashboard` (post sign-in)

---

## Running Locally

```bash
# Start dev server
npm run dev

# In another terminal (optional: monitor logs)
npm run lint
```

Visit: `http://localhost:3000`

---

## Testing Checklist

### Page Access
- [ ] Home page loads (`http://localhost:3000`)
- [ ] Admin dashboard redirects to sign-in (`http://localhost:3000/admin/dashboard`)

### Authentication
- [ ] Clerk sign-in page appears
- [ ] Can create new Clerk account
- [ ] Redirected to admin dashboard after sign-in
- [ ] "Sign Out" button visible (UserButton in header)

### Batch Creation
- [ ] Click "Create New Batch" button
- [ ] Product dropdown loads (shows Mobimatter products)
- [ ] Can select quantity 1–5000
- [ ] Batch creation succeeds
- [ ] Batch appears in dashboard

### Batch Detail
- [ ] Click batch card to see detail
- [ ] Stats shown: total, unused, redeemed
- [ ] Codes listed in table (status column shows "non-utilisé")
- [ ] Status badge shows "prêt"

### Export
- [ ] Click "Export as PDF" — downloads file
- [ ] Click "Export as CSV" — downloads file
- [ ] CSV is readable (open in Excel or text editor)
- [ ] PDF shows grid of QR codes

---

## Issues? Check These First

| Issue | Solution |
|-------|----------|
| "Clerk keys not found" | Restart dev server; `.env.local` must be in project root |
| "Cannot connect to database" | Verify DATABASE_URL; test with `psql $DATABASE_URL -l` |
| "Products list empty" | Check Mobimatter API key and base URL; look at server logs |
| "QR codes not showing" | Ensure `qrcode` npm package installed; check browser console for JS errors |
| "Sign-in redirects to empty page" | Check Clerk redirect URIs in dashboard |
| "404 on `/admin/dashboard`" | Ensure you're signed in to Clerk; check browser cookies |

---

## Success Criteria

Phase 1 is complete when:

✅ Admin can sign in via Clerk  
✅ Admin can create a batch (10–100 codes)  
✅ Batch appears in dashboard with correct stats  
✅ Admin can navigate to batch detail  
✅ Admin can export as PDF (QR grid)  
✅ Admin can export as CSV (code list)  
✅ Database shows new batch, codes, and activity log entries  

Once all above pass → **Phase 1 validated, ready for Phase 2**.

---

## Next: Phase 2 Kickoff

Once Phase 1 is working, we'll build:

1. Public redemption page (`/r/:code`)
2. KYC form + Mobimatter order creation
3. Real eSIM QR + LPA delivery
4. Error handling & concurrent redemption prevention

Flag any issues or questions before proceeding.
