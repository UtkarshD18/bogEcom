## GitHub Auto Deploy Setup (App Engine)

These workflows are added:

- `.github/workflows/deploy-backend.yml`
- `.github/workflows/deploy-client.yml`

They deploy automatically on push to `main`/`master`.

### 1) Create a deploy service account

Run once (replace project if needed):

```powershell
gcloud config set project healthy-one-gram
gcloud iam service-accounts create github-deployer --display-name "GitHub App Engine Deployer"
gcloud projects add-iam-policy-binding healthy-one-gram --member="serviceAccount:github-deployer@healthy-one-gram.iam.gserviceaccount.com" --role="roles/appengine.deployer"
gcloud projects add-iam-policy-binding healthy-one-gram --member="serviceAccount:github-deployer@healthy-one-gram.iam.gserviceaccount.com" --role="roles/storage.admin"
gcloud projects add-iam-policy-binding healthy-one-gram --member="serviceAccount:github-deployer@healthy-one-gram.iam.gserviceaccount.com" --role="roles/cloudbuild.builds.editor"
gcloud iam service-accounts add-iam-policy-binding healthy-one-gram@appspot.gserviceaccount.com --member="serviceAccount:github-deployer@healthy-one-gram.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"
gcloud iam service-accounts keys create github-deployer-key.json --iam-account="github-deployer@healthy-one-gram.iam.gserviceaccount.com"
```

### 2) Add GitHub repository secrets

In GitHub repo: `Settings -> Secrets and variables -> Actions -> New repository secret`

Required:

- `GCP_PROJECT_ID` = `healthy-one-gram`
- `GCP_SA_KEY` = contents of `github-deployer-key.json`
- `MONGO_URI`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `CLIENT_URL`
- `ADMIN_URL`
- `NEXT_PUBLIC_API_URL`

Optional:

- `EMAIL`
- `EMAIL_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_API_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### 3) Push to main/master

When you push:

- changes under `server/**` trigger backend deploy
- changes under `frontend/client/**` trigger client deploy

You can also run either workflow manually from the GitHub Actions tab.
