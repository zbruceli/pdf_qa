<div align="center">
<img width="1456" height="816" alt="Image" src="https://github.com/user-attachments/assets/b80f135b-07b7-4bd5-8da1-5287a78722c4" />
</div>

## Introduction

This is a simple and efficient document Q&A sample app based on Google Gemini File Search.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Session persistency

After the first file upload, you will find the Gemini File Store name in .config.local.

If you ever want to start fresh, delete .config.local to force a brand-new File Search store.

## Sample screenshot

<img width="1001" height="766" alt="Image" src="https://github.com/user-attachments/assets/fc637543-0904-47c5-9d53-1e9f291addd4" />