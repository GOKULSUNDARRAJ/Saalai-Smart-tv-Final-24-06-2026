# Roku Deployment

## Option A: Roku Web App (Hosted Channel)

1. Run `npm run build:roku` to build the web app into `dist/roku/`
2. Host the contents of `dist/roku/` on any HTTPS web server
3. In the [Roku Developer Dashboard](https://developer.roku.com/):
   - Create a new channel of type **Direct Publisher** or **Roku Web**
   - Set the hosted URL to your server URL
   - Submit for certification

## Option B: Sideload for Testing

1. Enable Developer Mode on your Roku device (Home x3, Up x2, Right, Left, Right, Left, Right)
2. Navigate to `http://<roku-ip>` in browser
3. Upload your built files as a `.zip`

## Notes

- Roku's web engine is based on Chromium — the React app runs natively
- Remote key codes are mapped in `src/platform/keys.ts`
- For production, Roku requires HTTPS hosting
